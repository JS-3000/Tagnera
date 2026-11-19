// In-app PDF viewer (pdf.js): page by page, zoom, back button, download.
// Works for shipped documents (URL) and uploaded ones (src = "idb:<fileId>").
import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import type { PDFDocumentProxy, RenderTask } from 'pdfjs-dist';
import { Icon } from '../components/Icon';
import { data } from '../data';
import { tr } from '../i18n';

// legacy build = broader browser support (older iPhones)
type PdfJs = typeof import('pdfjs-dist');
let pdfjsPromise: Promise<PdfJs> | null = null;
function loadPdfJs(): Promise<PdfJs> {
  if (!pdfjsPromise) {
    pdfjsPromise = Promise.all([
      import('pdfjs-dist/legacy/build/pdf.js') as unknown as Promise<PdfJs>,
      import('pdfjs-dist/legacy/build/pdf.worker.min.js?url'),
    ]).then(([lib, worker]) => {
      lib.GlobalWorkerOptions.workerSrc = (worker as { default: string }).default;
      return lib;
    });
  }
  return pdfjsPromise;
}

const MAX_CANVAS_PIXELS = 12_000_000; // stay below the iOS Safari canvas limit

export function PdfViewerPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const src = params.get('src') ?? '';
  const name = params.get('name') ?? tr('Dokument');
  const back = params.get('back');

  const [doc, setDoc] = useState<PDFDocumentProxy | null>(null);
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [page, setPage] = useState(() => Number(src.match(/#page=(\d+)/)?.[1] ?? 1));
  const [zoom, setZoom] = useState(1);
  const [rendering, setRendering] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  const taskRef = useRef<RenderTask | null>(null);

  const openUrl = src.startsWith('idb:') ? blobUrl : src;

  // load file + document
  useEffect(() => {
    let alive = true;
    let url: string | null = null;
    (async () => {
      try {
        let bytes: ArrayBuffer;
        if (src.startsWith('idb:')) {
          const f = await data.files.get(src.slice(4));
          if (!f) throw new Error(tr('Datei nicht gefunden'));
          bytes = await f.blob.arrayBuffer();
        } else {
          const res = await fetch(src.split('#')[0]);
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          bytes = await res.arrayBuffer();
        }
        url = URL.createObjectURL(new Blob([bytes], { type: 'application/pdf' }));
        if (alive) setBlobUrl(url);
        const pdfjs = await loadPdfJs();
        const pdf = await pdfjs.getDocument({ data: new Uint8Array(bytes), isEvalSupported: false }).promise;
        if (alive) {
          setPage((p) => Math.min(Math.max(1, p), pdf.numPages));
          setDoc(pdf);
        }
      } catch (e) {
        if (alive)
          setError(
            navigator.onLine
              ? String(e instanceof Error ? e.message : e)
              : tr('Keine Verbindung und das Dokument wurde auf diesem Gerät noch nicht geöffnet.'),
          );
      }
    })();
    return () => {
      alive = false;
      if (url) URL.revokeObjectURL(url);
    };
  }, [src]);

  // render current page (fit to width × zoom)
  const render = useCallback(async () => {
    if (!doc || !canvasRef.current || !boxRef.current) return;
    taskRef.current?.cancel();
    setRendering(true);
    try {
      const p = await doc.getPage(page);
      const base = p.getViewport({ scale: 1 });
      const fit = (boxRef.current.clientWidth - 16) / base.width;
      const cssScale = Math.max(0.2, fit * zoom);
      let dpr = window.devicePixelRatio || 1;
      const px = base.width * base.height * (cssScale * dpr) ** 2;
      if (px > MAX_CANVAS_PIXELS) dpr = dpr * Math.sqrt(MAX_CANVAS_PIXELS / px);
      const vp = p.getViewport({ scale: cssScale * dpr });
      const canvas = canvasRef.current;
      canvas.width = Math.floor(vp.width);
      canvas.height = Math.floor(vp.height);
      canvas.style.width = `${Math.floor(vp.width / dpr)}px`;
      canvas.style.height = `${Math.floor(vp.height / dpr)}px`;
      const task = p.render({ canvasContext: canvas.getContext('2d')!, viewport: vp });
      taskRef.current = task;
      await task.promise;
    } catch (e) {
      if ((e as { name?: string })?.name !== 'RenderingCancelledException') console.error(e);
    } finally {
      setRendering(false);
    }
  }, [doc, page, zoom]);

  useEffect(() => {
    void render();
  }, [render]);

  useEffect(() => {
    const onResize = () => void render();
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [render]);

  useEffect(() => {
    boxRef.current?.scrollTo(0, 0);
  }, [page]);

  const pages = doc?.numPages ?? 0;
  const go = (n: number) => setPage((p) => Math.min(Math.max(1, p + n), pages || 1));
  const goBack = () => {
    if (window.history.length > 1 && !back) navigate(-1);
    else navigate(back || '/');
  };

  // swipe left/right to change pages (only when not zoomed in)
  const touch = useRef<{ x: number; y: number } | null>(null);

  return (
    <div className="pdfv">
      <div className="pdfv-bar">
        <button className="btn btn-sm" onClick={goBack}>
          <Icon name="back" size={18} /> {tr('Zurück')}
        </button>
        <div className="pdfv-title" title={name}>
          {name}
        </div>
        {blobUrl && (
          <a className="btn btn-sm" href={blobUrl} download={name.endsWith('.pdf') ? name : `${name}.pdf`}>
            <Icon name="download" size={18} /> <span className="hide-xs">{tr('Herunterladen')}</span>
          </a>
        )}
      </div>

      <div
        className="pdfv-body"
        ref={boxRef}
        onTouchStart={(e) => (touch.current = { x: e.touches[0].clientX, y: e.touches[0].clientY })}
        onTouchEnd={(e) => {
          const t = touch.current;
          touch.current = null;
          if (!t || zoom > 1 || e.changedTouches.length !== 1) return;
          const dx = e.changedTouches[0].clientX - t.x;
          const dy = e.changedTouches[0].clientY - t.y;
          if (Math.abs(dx) > 70 && Math.abs(dx) > Math.abs(dy) * 1.5) go(dx < 0 ? 1 : -1);
        }}
      >
        {error ? (
          <div className="pdfv-msg">
            <p>{tr('Das Dokument kann hier nicht angezeigt werden.')}</p>
            <p className="small">{error}</p>
            {openUrl && (
              <a className="btn btn-primary" href={openUrl} target="_blank" rel="noreferrer">
                <Icon name="external" /> {tr('In neuem Tab öffnen')}
              </a>
            )}
          </div>
        ) : !doc ? (
          <div className="pdfv-msg">{tr('Dokument wird geladen …')}</div>
        ) : (
          <canvas ref={canvasRef} className={rendering ? 'busy' : ''} />
        )}
      </div>

      {doc && (
        <div className="pdfv-bar bottom">
          <button className="btn btn-sm" onClick={() => go(-1)} disabled={page <= 1} aria-label={tr('Vorherige Seite')}>
            ‹
          </button>
          <span className="pdfv-page">
            <span className="hide-xs">{tr('Seite')} </span>
            <input
              type="number"
              min={1}
              max={pages}
              value={page}
              onChange={(e) => {
                const v = Number(e.target.value);
                if (v >= 1 && v <= pages) setPage(v);
              }}
              aria-label={tr('Seite')}
            />{' '}
            / {pages}
          </span>
          <button
            className="btn btn-sm"
            onClick={() => go(1)}
            disabled={page >= pages}
            aria-label={tr('Nächste Seite')}
          >
            ›
          </button>
          <span className="pdfv-sep" />
          <button
            className="btn btn-sm"
            onClick={() => setZoom((z) => Math.max(0.5, +(z / 1.25).toFixed(2)))}
            aria-label={tr('Verkleinern')}
          >
            −
          </button>
          <button className="btn btn-sm pdfv-zoom" onClick={() => setZoom(1)} aria-label={tr('An Breite anpassen')}>
            {Math.round(zoom * 100)} %
          </button>
          <button
            className="btn btn-sm"
            onClick={() => setZoom((z) => Math.min(5, +(z * 1.25).toFixed(2)))}
            aria-label={tr('Vergrößern')}
          >
            +
          </button>
          {openUrl && (
            <a
              className="btn btn-sm hide-xs"
              href={openUrl}
              target="_blank"
              rel="noreferrer"
              title={tr('In neuem Tab öffnen')}
            >
              <Icon name="external" size={18} />
            </a>
          )}
        </div>
      )}
    </div>
  );
}
