// Document list with version history ("Neu hinzugefügt am …", "Ältere Versionen").
import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import type { DocumentVersion, OwnerType } from '../data/types';
import { daysBetween, fmtDate, fmtSize, today, toDateStr } from '../lib/util';
import { addDocument, addDocumentVersion, removeDocument, type DocWithVersions } from '../services/tags';
import { Icon } from './Icon';
import { Empty, Field, FileViewer, Modal, toast } from './ui';
import { tr } from '../i18n';

// stored as data (German); translated only for display
const CATEGORIES = ['Anleitung', 'Datenblatt', 'Zeichnung', 'Zertifikat', 'Prüfbericht', 'Foto', 'Sonstiges'];
const NEW_DAYS = 30; // show "NEU" badge for 30 days

const dateOf = (iso: string) => toDateStr(new Date(iso));

interface Props {
  docs: DocWithVersions[];
  /** where new documents are attached */
  owner: { ownerType: OwnerType; ownerId: string };
  canAdd: boolean;
  /** may add versions / delete documents of this owner type */
  canManage: (d: DocWithVersions) => boolean;
}

export function DocumentList({ docs, owner, canAdd, canManage }: Props) {
  const [view, setView] = useState<DocumentVersion | null>(null);
  const [adding, setAdding] = useState(false);
  const [versionFor, setVersionFor] = useState<DocWithVersions | null>(null);
  const navigate = useNavigate();
  const location = useLocation();

  // PDFs open in the in-app viewer, images in the lightbox
  const open = (v: DocumentVersion, title: string) => {
    if (v.mimeType === 'application/pdf') {
      const src = v.url ?? `idb:${v.fileId}`;
      const q = new URLSearchParams({ src, name: title, back: location.pathname });
      navigate(`/viewer?${q.toString()}`);
    } else {
      setView(v);
    }
  };

  return (
    <>
      {docs.length === 0 && <Empty>{tr('Keine Dokumente vorhanden.')}</Empty>}
      <ul className="list">
        {docs.map((d) => {
          if (d.request) {
            return (
              <li key={d.doc.id} style={{ padding: '10px 0' }}>
                <div className="list-item wrap" style={{ padding: 0 }}>
                  <Icon name="doc" size={28} className="muted" />
                  <span className="grow">
                    <span className="title">{d.doc.title}</span>
                    <br />
                    <span className="small muted">
                      {tr('Bei')} {d.request.manufacturer} {tr('noch nicht öffentlich verfügbar')}
                    </span>
                  </span>
                  <div className="item-actions no-print">
                    <a className="btn btn-sm" href={d.request.mailto}>
                      <Icon name="mail" size={18} /> {tr('Beim Hersteller anfragen')}
                    </a>
                  </div>
                </div>
              </li>
            );
          }
          const isNew = !d.shipped && daysBetween(dateOf(d.current.addedAt), today()) <= NEW_DAYS;
          return (
            <li key={d.doc.id} style={{ padding: '10px 0' }}>
              <div className="list-item wrap" style={{ padding: 0 }}>
                <button
                  className="btn btn-ghost"
                  style={{ padding: 0, minHeight: 0, textAlign: 'left', flex: 1, justifyContent: 'flex-start' }}
                  onClick={() => open(d.current, d.doc.title)}
                >
                  <Icon name="doc" size={28} />
                  <span className="grow" style={{ fontWeight: 400 }}>
                    <span className="title" style={{ fontWeight: 700 }}>
                      {d.doc.title}
                    </span>{' '}
                    {isNew && <span className="pill new">{tr('NEU')}</span>}
                    <br />
                    <span className="small muted">
                      {d.doc.category}
                      {d.shipped ? tr(' · Herstellerdokument') : d.inherited ? tr(' · aus Produktvorlage') : ''}
                      {d.current.size > 0 && ` · ${fmtSize(d.current.size)}`}
                    </span>
                    <br />
                    <span className="small">
                      {d.shipped
                        ? tr('Stand {{date}}', { date: fmtDate(dateOf(d.current.addedAt)) })
                        : d.older.length === 0
                          ? tr('Neu hinzugefügt am {{date}}', { date: fmtDate(dateOf(d.current.addedAt)) })
                          : tr('Neue Version vom {{date}}', { date: fmtDate(dateOf(d.current.addedAt)) })}
                      {d.current.note && ` – ${d.current.note}`}
                    </span>
                  </span>
                </button>
                {!d.shipped && canManage(d) && (
                  <div className="btn-row no-print item-actions">
                    <button className="btn btn-sm" onClick={() => setVersionFor(d)}>
                      <Icon name="upload" size={18} /> {tr('Neue Version')}
                    </button>
                    <button
                      className="icon-btn"
                      aria-label={tr('Dokument löschen')}
                      onClick={() =>
                        confirm(tr('„{{name}}“ mit allen Versionen löschen?', { name: d.doc.title })) &&
                        removeDocument(d.doc.id)
                      }
                    >
                      <Icon name="trash" />
                    </button>
                  </div>
                )}
              </div>
              {d.older.length > 0 && (
                <details className="acc" style={{ marginTop: 8, marginLeft: 36 }}>
                  <summary className="small">
                    {tr('Ältere Versionen (')}
                    {d.older.length})
                  </summary>
                  <ul className="list acc-body">
                    {d.older.map((v) => (
                      <li key={v.id}>
                        <button
                          className="btn btn-ghost btn-sm"
                          style={{ justifyContent: 'flex-start', width: '100%', textAlign: 'left' }}
                          onClick={() => open(v, `${d.doc.title} (${fmtDate(dateOf(v.addedAt))})`)}
                        >
                          <Icon name="file" size={18} />
                          <span style={{ fontWeight: 500 }}>
                            {fmtDate(dateOf(v.addedAt))} – {v.note || v.fileName}
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                </details>
              )}
            </li>
          );
        })}
      </ul>
      {canAdd && (
        <button className="btn btn-block no-print" style={{ marginTop: 8 }} onClick={() => setAdding(true)}>
          <Icon name="plus" /> {tr('Dokument hochladen')}
        </button>
      )}

      {view && (
        <FileViewer fileId={view.fileId} mimeType={view.mimeType} name={view.fileName} onClose={() => setView(null)} />
      )}
      {adding && <UploadModal owner={owner} onClose={() => setAdding(false)} />}
      {versionFor && <VersionModal doc={versionFor} onClose={() => setVersionFor(null)} />}
    </>
  );
}

function UploadModal({ owner, onClose }: { owner: Props['owner']; onClose: () => void }) {
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('Anleitung');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);

  return (
    <Modal title={tr('Dokument hochladen')} onClose={onClose}>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          if (!file) return;
          setBusy(true);
          await addDocument(owner.ownerType, owner.ownerId, { title: title.trim(), category, note: note.trim() }, file);
          toast(tr('Dokument gespeichert'));
          onClose();
        }}
      >
        <Field label={tr('Datei (PDF oder Bild)')}>
          <input
            type="file"
            accept="application/pdf,image/*"
            required
            onChange={(e) => {
              const f = e.target.files?.[0] ?? null;
              setFile(f);
              if (f && !title) setTitle(f.name.replace(/\.[^.]+$/, ''));
            }}
          />
        </Field>
        <Field label={tr('Titel')}>
          <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} required />
        </Field>
        <Field label={tr('Kategorie')}>
          <select value={category} onChange={(e) => setCategory(e.target.value)}>
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {tr(c)}
              </option>
            ))}
          </select>
        </Field>
        <Field label={tr('Bemerkung (optional)')} hint={tr('z. B. Revision oder was sich geändert hat')}>
          <input type="text" value={note} onChange={(e) => setNote(e.target.value)} />
        </Field>
        <button className="btn btn-primary btn-block" disabled={!file || busy} type="submit">
          {tr('Speichern')}
        </button>
      </form>
    </Modal>
  );
}

function VersionModal({ doc, onClose }: { doc: DocWithVersions; onClose: () => void }) {
  const [file, setFile] = useState<File | null>(null);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  return (
    <Modal title={`${tr('Neue Version')}: ${doc.doc.title}`} onClose={onClose}>
      <p className="small muted">{tr('Die bisherige Version bleibt unter „Ältere Versionen“ erhalten.')}</p>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          if (!file) return;
          setBusy(true);
          await addDocumentVersion(doc.doc.id, file, note.trim());
          toast(tr('Neue Version gespeichert'));
          onClose();
        }}
      >
        <Field label={tr('Datei (PDF oder Bild)')}>
          <input
            type="file"
            accept="application/pdf,image/*"
            required
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          />
        </Field>
        <Field label={tr('Was ist neu?')} hint={tr('z. B. „Rev. D – geänderte Drehmomente“')}>
          <input type="text" value={note} onChange={(e) => setNote(e.target.value)} />
        </Field>
        <button className="btn btn-primary btn-block" disabled={!file || busy} type="submit">
          {tr('Version speichern')}
        </button>
      </form>
    </Modal>
  );
}
