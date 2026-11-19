// "Störung melden" – works without an account.
import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useData } from '../app/hooks';
import { useSession } from '../app/session';
import { DictateButton } from '../components/DictateButton';
import { Icon } from '../components/Icon';
import { Empty, Field } from '../components/ui';
import { data } from '../data';
import { createIssue } from '../services/issues';
import { speechLang, tr } from '../i18n';

export function IssueFormPage() {
  const { id = '' } = useParams();
  const { user } = useSession();
  const tag = useData(() => data.tags.get(id), [id]);
  const [description, setDescription] = useState('');
  const [name, setName] = useState(user?.name ?? '');
  const [phone, setPhone] = useState('');
  const [photo, setPhoto] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);

  useEffect(() => {
    if (!photo) return setPreview(null);
    const u = URL.createObjectURL(photo);
    setPreview(u);
    return () => URL.revokeObjectURL(u);
  }, [photo]);

  if (tag === undefined) return <Empty>{tr('Lädt …')}</Empty>;

  if (sent) {
    return (
      <div className="narrow" style={{ maxWidth: 640, margin: '0 auto' }}>
        <div className="alert" style={{ padding: 20 }}>
          <Icon name="check" size={32} />
          <div>
            <div className="title" style={{ fontSize: '1.2rem' }}>
              {tr('Danke, Ihre Meldung ist eingegangen.')}
            </div>
            <div>
              {tr('Störung an')} <b>{tag.tagNumber}</b> {tr('wurde an die Instandhaltung übermittelt.')}
              {phone && tr(' Bei Rückfragen melden wir uns telefonisch.')}
            </div>
          </div>
        </div>
        <div className="actions">
          <Link className="btn btn-primary btn-lg" to="/scan?scan=1">
            <Icon name="scan" /> {tr('Weiteres Bauteil scannen')}
          </Link>
          <Link className="btn btn-lg" to={`/t/${tag.id}`}>
            {tr('Zurück zum Bauteil')}
          </Link>
        </div>
      </div>
    );
  }

  return (
    <form
      className="narrow"
      style={{ maxWidth: 640, margin: '0 auto' }}
      onSubmit={async (e) => {
        e.preventDefault();
        if (!description.trim() || !name.trim()) return;
        setBusy(true);
        try {
          await createIssue({ tagId: tag.id, tagNumber: tag.tagNumber, description, name, phone, photo });
          setSent(true);
        } finally {
          setBusy(false);
        }
      }}
    >
      <div className="page-head">
        <Link to={`/t/${tag.id}`} className="btn btn-sm" aria-label={tr('Zurück')}>
          <Icon name="back" size={18} />
        </Link>
        <h1>
          {tr('Störung melden ·')} {tag.tagNumber}
        </h1>
      </div>
      <section className="card">
        <p className="small muted" style={{ marginTop: 0 }}>
          {tag.type}
          {tag.description && ` – ${tag.description}`}
        </p>
        <div className="dictate-row">
          <DictateButton
            lang={speechLang()}
            onText={(text) => setDescription((d) => (d.trim() ? `${d.trim()} ${text}` : text))}
          />
        </div>
        <Field label={tr('Was ist passiert? *')}>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder={tr('z. B. tropft an der Welle, ungewöhnliches Geräusch …')}
            required
          />
        </Field>
        <div className="form-grid">
          <Field label={tr('Ihr Name *')}>
            <input type="text" value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" required />
          </Field>
          <Field label={tr('Telefon (optional, für Rückfragen)')}>
            <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} autoComplete="tel" />
          </Field>
        </div>
        <div className="field">
          <span>{tr('Foto (optional)')}</span>
          <label className="btn btn-block">
            <Icon name="camera" /> {photo ? tr('Anderes Foto wählen') : tr('Foto aufnehmen / auswählen')}
            <input
              type="file"
              accept="image/*"
              capture="environment"
              hidden
              onChange={(e) => setPhoto(e.target.files?.[0] ?? null)}
            />
          </label>
          {preview && (
            <img
              src={preview}
              alt={tr('Vorschau')}
              style={{ maxWidth: 160, maxHeight: 120, borderRadius: 8, marginTop: 8 }}
            />
          )}
        </div>
      </section>
      <button
        className="btn btn-primary btn-lg btn-block"
        type="submit"
        disabled={busy || !description.trim() || !name.trim()}
      >
        <Icon name="mail" /> {tr('Meldung absenden')}
      </button>
    </form>
  );
}
