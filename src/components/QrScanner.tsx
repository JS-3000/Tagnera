// Camera QR scanner based on html5-qrcode, with our own scan frame and torch button.
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';
import { useEffect, useRef, useState } from 'react';
import { Icon } from './Icon';
import { tr } from '../i18n';

interface Props {
  active: boolean;
  onResult: (text: string) => void;
  onStart: () => void;
}

type State = 'idle' | 'starting' | 'running' | 'error';

export function QrScanner({ active, onResult, onStart }: Props) {
  const scanner = useRef<Html5Qrcode | null>(null);
  const resultRef = useRef(onResult);
  resultRef.current = onResult;
  const [state, setState] = useState<State>('idle');
  const [error, setError] = useState('');
  const [torchSupported, setTorchSupported] = useState(false);
  const [torchOn, setTorchOn] = useState(false);

  useEffect(() => {
    if (!active) return;
    let cancelled = false;
    let s: Html5Qrcode | null = null;
    // Start slightly delayed, so a quick mount/unmount (React StrictMode) never opens the camera twice.
    const timer = setTimeout(() => {
      if (!cancelled) begin();
    }, 60);
    setState('starting');
    setError('');

    const begin = () => {
      s = new Html5Qrcode('qr-reader', {
        formatsToSupport: [Html5QrcodeSupportedFormats.QR_CODE],
        verbose: false,
        // use the browser's native BarcodeDetector where available (faster)
        experimentalFeatures: { useBarCodeDetectorIfSupported: true },
      });
      const sc = s;
      scanner.current = sc;

      sc.start(
        { facingMode: 'environment' },
        { fps: 12, aspectRatio: 1 },
        (text) => {
          if (cancelled) return;
          cancelled = true;
          navigator.vibrate?.(80);
          resultRef.current(text);
        },
        () => {
          /* no code in this frame – ignore */
        },
      )
        .then(() => {
          if (cancelled) {
            void stop(sc);
            return;
          }
          setState('running');
          try {
            setTorchSupported(sc.getRunningTrackCameraCapabilities().torchFeature().isSupported());
          } catch {
            setTorchSupported(false);
          }
        })
        .catch((e: unknown) => {
          if (cancelled) return;
          setState('error');
          const msg = String(e instanceof Error ? e.message : e);
          setError(
            /NotAllowed|Permission/i.test(msg)
              ? tr('Kein Zugriff auf die Kamera. Bitte Kamera-Berechtigung im Browser erlauben.')
              : /secure|https/i.test(msg) || !window.isSecureContext
                ? tr('Die Kamera funktioniert nur über HTTPS.')
                : tr('Kamera konnte nicht gestartet werden: ') + msg,
          );
        });
    };

    return () => {
      cancelled = true;
      clearTimeout(timer);
      setTorchOn(false);
      setTorchSupported(false);
      setState('idle');
      if (s) void stop(s);
    };
  }, [active]);

  const toggleTorch = async () => {
    const s = scanner.current;
    if (!s) return;
    try {
      await s.getRunningTrackCameraCapabilities().torchFeature().apply(!torchOn);
      setTorchOn(!torchOn);
    } catch {
      setTorchSupported(false);
    }
  };

  return (
    <div className="scanner">
      <div id="qr-reader" />
      {state === 'running' && (
        <div className="scan-frame">
          <span />
        </div>
      )}
      {state !== 'running' && (
        <div className="scan-overlay">
          {state === 'starting' && <span>{tr('Kamera wird gestartet …')}</span>}
          {state === 'error' && <span>{error}</span>}
          {(state === 'idle' || state === 'error') && (
            <button className="btn btn-primary btn-lg" onClick={onStart}>
              <Icon name="camera" /> {tr('Kamera starten')}
            </button>
          )}
        </div>
      )}
      {state === 'running' && torchSupported && (
        <button
          className={`torch${torchOn ? ' on' : ''}`}
          onClick={toggleTorch}
          aria-label={tr('Taschenlampe')}
          aria-pressed={torchOn}
        >
          <Icon name="flash" size={28} />
        </button>
      )}
    </div>
  );
}

async function stop(s: Html5Qrcode) {
  try {
    if (s.isScanning) await s.stop();
    s.clear();
  } catch {
    /* already stopped */
  }
}
