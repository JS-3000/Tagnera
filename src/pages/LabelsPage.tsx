import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useData } from '../app/hooks';
import { Icon } from '../components/Icon';
import { QrCode } from '../components/QrCode';
import { Empty, Field } from '../components/ui';
import { data } from '../data';
import type { Tag } from '../data/types';
import { byString } from '../lib/util';
import { LABEL_FORMATS, perSheet, type LabelFormat } from '../services/labelFormats';
import { appBaseUrl, loadSettings, saveSettings, tagUrl } from '../services/settings';

const FORMAT_KEY = 'tagnera.labelFormat';

export function LabelsPage() {
  const [params] = useSearchParams();
  const tags = useData(() => data.tags.list().then((l) => l.sort(byString((t) => t.tagNumber))), []);
  const [formatId, setFormatId] = useState(() => localStorage.getItem(FORMAT_KEY) || 'L6011');
  const format = LABEL_FORMATS.find((f) => f.id === formatId) ?? LABEL_FORMATS[0];
  const [selected, setSelected] = useState<Set<string> | null>(() => {
    const p = params.get('tags');
    return p ? new Set(p.split(',')) : null; // null = all
  });
  const [skip, setSkip] = useState(0);
  const [copies, setCopies] = useState(1);
  const [outline, setOutline] = useState(false);
  const [offX, setOffX] = useState(loadSettings().labelOffsetXmm);
  const [offY, setOffY] = useState(loadSettings().labelOffsetYmm);
  const [plantFilter, setPlantFilter] = useState('');

  const plants = useMemo(() => [...new Set((tags ?? []).map((t) => t.plant).filter(Boolean))].sort(), [tags]);
  const chosen = useMemo(
    () => (tags ?? []).filter((t) => (selected ? selected.has(t.id) : true)),
    [tags, selected],
  );

  // the sequence of labels (empty slots for already used labels on the first sheet)
  const slots: (Tag | null)[] = useMemo(() => {
    const list: (Tag | null)[] = Array(Math.min(skip, perSheet(format) - 1)).fill(null);
    for (const t of chosen) for (let i = 0; i < copies; i++) list.push(t);
    return list;
  }, [chosen, copies, skip, format]);
  const sheets: (Tag | null)[][] = [];
  for (let i = 0; i < slots.length; i += perSheet(format)) sheets.push(slots.slice(i, i + perSheet(format)));

  const toggle = (id: string) => {
    const base = selected ?? new Set((tags ?? []).map((t) => t.id));
    const n = new Set(base);
    if (n.has(id)) n.delete(id);
    else n.add(id);
    setSelected(n);
  };

  return (
    <div>
      {/* page setup only while this page is shown */}
      <style>{`@media print { @page { size: A4 portrait; margin: 0; } }`}</style>

      <div className="no-print">
        <div className="page-head">
          <h1>QR-Etiketten</h1>
          <button className="btn btn-primary" onClick={() => window.print()} disabled={chosen.length === 0}>
            <Icon name="printer" /> Drucken ({sheets.length} {sheets.length === 1 ? 'Blatt' : 'Blätter'})
          </button>
        </div>

        <div className="grid-2">
          <section className="card">
            <h2>Format</h2>
            <Field label="Etikettenbogen">
              <select
                value={format.id}
                onChange={(e) => {
                  setFormatId(e.target.value);
                  try {
                    localStorage.setItem(FORMAT_KEY, e.target.value);
                  } catch {
                    /* ignore */
                  }
                }}
              >
                {LABEL_FORMATS.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.name} – {f.description}
                  </option>
                ))}
              </select>
            </Field>
            <div className="form-grid">
              <Field label="Erste freie Position" hint={`Bei angebrochenem Bogen: 1–${perSheet(format)}`}>
                <input
                  type="number"
                  min={1}
                  max={perSheet(format)}
                  value={skip + 1}
                  onChange={(e) => setSkip(Math.max(0, Math.min(perSheet(format) - 1, (Number(e.target.value) || 1) - 1)))}
                />
              </Field>
              <Field label="Etiketten pro Tag">
                <input type="number" min={1} max={10} value={copies} onChange={(e) => setCopies(Math.max(1, Number(e.target.value) || 1))} />
              </Field>
              <Field label="Versatz X (mm)" hint="+ = nach rechts">
                <input
                  type="number"
                  step={0.5}
                  value={offX}
                  onChange={(e) => {
                    const v = Number(e.target.value) || 0;
                    setOffX(v);
                    saveSettings({ labelOffsetXmm: v });
                  }}
                />
              </Field>
              <Field label="Versatz Y (mm)" hint="+ = nach unten">
                <input
                  type="number"
                  step={0.5}
                  value={offY}
                  onChange={(e) => {
                    const v = Number(e.target.value) || 0;
                    setOffY(v);
                    saveSettings({ labelOffsetYmm: v });
                  }}
                />
              </Field>
            </div>
            <label className={`check${outline ? ' checked' : ''}`}>
              <input type="checkbox" checked={outline} onChange={(e) => setOutline(e.target.checked)} />
              Umrisse mitdrucken (für Probedruck auf Normalpapier)
            </label>
            <p className="small muted" style={{ marginBottom: 0 }}>
              Im Druckdialog <b>Skalierung 100 % / „Tatsächliche Größe“</b> und <b>Ränder: keine</b> wählen, Kopf- und
              Fußzeilen ausschalten. Erst auf Normalpapier testen und gegen den Bogen halten. QR-Adresse:{' '}
              <span className="mono">{appBaseUrl()}</span>
            </p>
          </section>

          <section className="card">
            <div className="section-head">
              <h2>Tags ({chosen.length})</h2>
              <button className="btn btn-sm" onClick={() => setSelected(null)}>
                Alle
              </button>
              <button className="btn btn-sm" onClick={() => setSelected(new Set())}>
                Keine
              </button>
            </div>
            {plants.length > 1 && (
              <select
                value={plantFilter}
                onChange={(e) => {
                  setPlantFilter(e.target.value);
                  if (e.target.value)
                    setSelected(new Set((tags ?? []).filter((t) => t.plant === e.target.value).map((t) => t.id)));
                }}
                style={{ marginBottom: 8 }}
                aria-label="Anlage"
              >
                <option value="">Nach Anlage auswählen …</option>
                {plants.map((p) => (
                  <option key={p}>{p}</option>
                ))}
              </select>
            )}
            <div style={{ maxHeight: 300, overflowY: 'auto' }}>
              {tags?.length === 0 && <Empty>Keine Tags vorhanden.</Empty>}
              {tags?.map((t) => {
                const on = selected ? selected.has(t.id) : true;
                return (
                  <label key={t.id} className={`check${on ? ' checked' : ''}`} style={{ minHeight: 44, marginBottom: 4 }}>
                    <input type="checkbox" checked={on} onChange={() => toggle(t.id)} />
                    <b>{t.tagNumber}</b> <span className="muted small">{t.plant}</span>
                  </label>
                );
              })}
            </div>
          </section>
        </div>
        <h2>Vorschau</h2>
      </div>

      <div className="sheets">
        {sheets.map((sheet, i) => (
          <Sheet key={i} format={format} slots={sheet} outline={outline} offX={offX} offY={offY} />
        ))}
      </div>
    </div>
  );
}

function Sheet({
  format: f,
  slots,
  outline,
  offX,
  offY,
}: {
  format: LabelFormat;
  slots: (Tag | null)[];
  outline: boolean;
  offX: number;
  offY: number;
}) {
  return (
    <div className="sheet">
      {slots.map((tag, i) => {
        const col = i % f.cols;
        const row = Math.floor(i / f.cols);
        return (
          <div
            key={i}
            className={`label${outline ? ' outline' : ''}`}
            style={{
              left: `${f.marginLeft + col * f.pitchX + offX}mm`,
              top: `${f.marginTop + row * f.pitchY + offY}mm`,
              width: `${f.width}mm`,
              height: `${f.height}mm`,
            }}
          >
            {tag && <Label tag={tag} f={f} />}
          </div>
        );
      })}
    </div>
  );
}

/** One label: QR code left; logo, tag number and plant right. */
function Label({ tag, f }: { tag: Tag; f: LabelFormat }) {
  const pad = Math.max(1.2, f.height * 0.07);
  const qr = Math.min(f.height - 2 * pad, f.width * 0.46);
  const textW = f.width - qr - 3 * pad;
  const tagFont = Math.min(f.height * 0.24, textW / (Math.max(tag.tagNumber.length, 5) * 0.62));
  const plantFont = Math.max(1.9, Math.min(tagFont * 0.52, textW / (Math.max(tag.plant.length, 8) * 0.55)));
  const logoH = Math.min(f.height * 0.2, 7);
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: `${pad}mm`, padding: `${pad}mm`, height: '100%' }}>
      <QrCode text={tagUrl(tag.id)} style={{ width: `${qr}mm`, height: `${qr}mm`, flex: 'none' }} />
      <div style={{ minWidth: 0, flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: `${pad * 0.5}mm` }}>
        <img src={`${import.meta.env.BASE_URL}logo.svg`} alt="Tagnera" style={{ height: `${logoH}mm`, width: 'auto', alignSelf: 'flex-start' }} />
        <div style={{ fontSize: `${tagFont}mm`, fontWeight: 800, lineHeight: 1.05, whiteSpace: 'nowrap', color: '#000' }}>
          {tag.tagNumber}
        </div>
        {tag.plant && (
          <div style={{ fontSize: `${plantFont}mm`, lineHeight: 1.1, color: '#222', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {tag.plant}
          </div>
        )}
      </div>
    </div>
  );
}
