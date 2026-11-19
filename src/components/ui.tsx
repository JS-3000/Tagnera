// Small reusable UI pieces.
import { useEffect, useState, type ReactNode } from 'react';
import { useFileUrl } from '../app/hooks';
import { STATUS_LABELS, type MaintStatus } from '../services/maintenance';
import { Icon } from './Icon';
import { tr } from '../i18n';

export function StatusBadge({ status }: { status: MaintStatus | null }) {
  if (!status) return <span className="status status-none">{tr('Keine Wartung')}</span>;
  return <span className={`status status-${status}`}>{STATUS_LABELS[status]}</span>;
}

export function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [onClose]);
  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" role="dialog" aria-modal="true" aria-label={title}>
        <div className="modal-head">
          <h2>{title}</h2>
          <button className="icon-btn" onClick={onClose} aria-label={tr('Schließen')}>
            <Icon name="close" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

/** Field wrapper: label + input + optional hint */
export function Field({
  label,
  hint,
  children,
  full,
}: {
  label: string;
  hint?: ReactNode;
  children: ReactNode;
  full?: boolean;
}) {
  return (
    <label className={`field${full ? ' full' : ''}`}>
      <span>{label}</span>
      {children}
      {hint && <span className="hint">{hint}</span>}
    </label>
  );
}

/** Shows a photo or PDF full-screen inside the app. */
export function FileViewer({
  fileId,
  mimeType,
  name,
  onClose,
}: {
  fileId: string;
  mimeType: string;
  name: string;
  onClose: () => void;
}) {
  const url = useFileUrl(fileId);
  const isImage = mimeType.startsWith('image/');
  return (
    <div className="lightbox" role="dialog" aria-label={name}>
      <div className="lb-bar">
        {url && (
          <a className="btn btn-sm" href={url} target="_blank" rel="noreferrer">
            <Icon name="external" size={18} /> {tr('In neuem Tab')}
          </a>
        )}
        {url && (
          <a className="btn btn-sm" href={url} download={name}>
            <Icon name="download" size={18} /> {tr('Speichern')}
          </a>
        )}
        <button className="btn btn-sm btn-primary" onClick={onClose}>
          <Icon name="close" size={18} /> {tr('Schließen')}
        </button>
      </div>
      <div className="lb-body">
        {!url ? (
          <span style={{ color: '#fff' }}>{tr('Lädt …')}</span>
        ) : isImage ? (
          <img src={url} alt={name} />
        ) : mimeType === 'application/pdf' ? (
          <iframe src={url} title={name} />
        ) : (
          <a className="btn btn-primary" href={url} download={name}>
            {tr('Datei herunterladen')}
          </a>
        )}
      </div>
    </div>
  );
}

/** Thumbnail for an image stored in the database */
export function StoredImage({
  fileId,
  alt,
  className,
  onClick,
}: {
  fileId: string;
  alt: string;
  className?: string;
  onClick?: () => void;
}) {
  const url = useFileUrl(fileId);
  if (!url) return null;
  return <img src={url} alt={alt} className={className} onClick={onClick} />;
}

// ---------------------------------------------------------------- toast

let showToastImpl: (msg: string) => void = () => {};
export const toast = (msg: string) => showToastImpl(msg);

export function ToastHost() {
  const [msg, setMsg] = useState<string | null>(null);
  useEffect(() => {
    let t: ReturnType<typeof setTimeout>;
    showToastImpl = (m) => {
      setMsg(m);
      clearTimeout(t);
      t = setTimeout(() => setMsg(null), 2800);
    };
    return () => clearTimeout(t);
  }, []);
  return msg ? (
    <div className="toast" role="status">
      {msg}
    </div>
  ) : null;
}

export function Empty({ children }: { children: ReactNode }) {
  return <div className="empty">{children}</div>;
}
