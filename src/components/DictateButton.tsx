// Voice note: dictate text with the Web Speech API. Hidden when the browser does not support it.
import { useEffect, useRef, useState } from 'react';
import { Icon } from './Icon';

interface RecognitionLike {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  start(): void;
  stop(): void;
  onresult:
    | ((e: {
        resultIndex: number;
        results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }>;
      }) => void)
    | null;
  onend: (() => void) | null;
  onerror: ((e: { error: string }) => void) | null;
}

type RecognitionCtor = new () => RecognitionLike;
const getCtor = (): RecognitionCtor | undefined => {
  const w = window as unknown as { SpeechRecognition?: RecognitionCtor; webkitSpeechRecognition?: RecognitionCtor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition;
};

export const speechSupported = () => !!getCtor();

export function DictateButton({
  lang,
  onText,
  label = 'Diktieren',
}: {
  lang: string;
  onText: (text: string) => void;
  label?: string;
}) {
  const [listening, setListening] = useState(false);
  const [error, setError] = useState('');
  const rec = useRef<RecognitionLike | null>(null);
  const textRef = useRef(onText);
  textRef.current = onText;

  useEffect(() => () => rec.current?.stop(), []);

  const Ctor = getCtor();
  if (!Ctor) return null;

  const toggle = () => {
    if (listening) {
      rec.current?.stop();
      return;
    }
    setError('');
    const r = new Ctor();
    r.lang = lang;
    r.interimResults = false;
    r.continuous = false;
    r.onresult = (e) => {
      let text = '';
      for (let i = e.resultIndex; i < e.results.length; i++)
        if (e.results[i].isFinal) text += e.results[i][0].transcript;
      if (text.trim()) textRef.current(text.trim());
    };
    r.onerror = (e) => setError(e.error === 'not-allowed' ? 'Kein Zugriff auf das Mikrofon.' : '');
    r.onend = () => setListening(false);
    rec.current = r;
    try {
      r.start();
      setListening(true);
    } catch {
      setListening(false);
    }
  };

  return (
    <span className="dictate">
      <button
        type="button"
        className={`btn btn-sm${listening ? ' btn-primary rec' : ''}`}
        onClick={toggle}
        aria-pressed={listening}
        aria-label={label}
      >
        <Icon name="mic" size={18} /> {listening ? 'Stopp' : label}
      </button>
      {error && (
        <span className="small" style={{ color: 'var(--overdue)' }}>
          {error}
        </span>
      )}
    </span>
  );
}
