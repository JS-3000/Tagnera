import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useData } from '../app/hooks';
import { useSession } from '../app/session';
import { DictateButton } from '../components/DictateButton';
import { Icon } from '../components/Icon';
import { Empty, Field, StatusBadge, toast } from '../components/ui';
import { LOG_KIND_LABELS, type LogKind } from '../data/types';
import { fmtDate, today } from '../lib/util';
import { intervalLabel } from '../services/maintenance';
import { isScanned } from '../services/scanProof';
import { addLogEntry, loadTagDetail, savePhoto } from '../services/tags';
import { speechLang, tr } from '../i18n';

export function LogEntryPage() {
  const { id = '' } = useParams();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { user, can } = useSession();
  const detail = useData(() => loadTagDetail(id), [id]);

  // Nachweis vor Ort: editors may complete maintenance only after scanning the tag's QR code
  const scanned = isScanned(id);
  const mayComplete = can('admin') || scanned;
  const preTask = mayComplete ? params.get('task') : null;
  const [date, setDate] = useState(today());
  const [person, setPerson] = useState(user?.name ?? '');
  const [kind, setKind] = useState<LogKind>(preTask ? 'wartung' : 'pruefung');
  const [description, setDescription] = useState('');
  const [done, setDone] = useState<string[]>(preTask ? [preTask] : []);
  const [photo, setPhoto] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (user && !person) setPerson(user.name);
  }, [user, person]);

  useEffect(() => {
    if (!photo) return setPreview(null);
    const u = URL.createObjectURL(photo);
    setPreview(u);
    return () => URL.revokeObjectURL(u);
  }, [photo]);

  if (!can('edit')) return <Empty>{tr('Nur Bearbeiter und Administratoren können Einträge anlegen.')}</Empty>;
  if (detail === undefined) return <Empty>{tr('Lädt …')}</Empty>;
  if (detail === null) return <Empty>{tr('Tag nicht gefunden.')}</Empty>;

  const toggle = (taskId: string) =>
    setDone((d) => {
      const next = d.includes(taskId) ? d.filter((x) => x !== taskId) : [...d, taskId];
      if (next.length > 0) setKind('wartung');
      return next;
    });

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      const file = photo ? await savePhoto(photo) : null;
      const doneTitles = detail.tasks.filter((t) => done.includes(t.task.id)).map((t) => t.task.title);
      await addLogEntry({
        tagId: detail.tag.id,
        date,
        person: person.trim(),
        kind,
        description: description.trim() || (doneTitles.length ? doneTitles.join(', ') + tr(' durchgeführt.') : ''),
        photoFileId: file?.id ?? null,
        completedTaskIds: mayComplete ? done : [],
        source: scanned ? 'scan' : 'manual',
      });
      toast(done.length ? tr('Gespeichert – Wartungsintervall neu gestartet') : tr('Eintrag gespeichert'));
      navigate(`/t/${detail.tag.id}`, { replace: true });
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={save}>
      <div className="page-head">
        <Link to={`/t/${detail.tag.id}`} className="btn btn-sm" aria-label={tr('Zurück')}>
          <Icon name="back" size={18} />
        </Link>
        <h1>
          {tr('Neuer Eintrag ·')} {detail.tag.tagNumber}
        </h1>
      </div>

      <section className="card">
        <div className="field">
          <span>{tr('Art')}</span>
          <div className="segmented">
            {(Object.keys(LOG_KIND_LABELS) as LogKind[]).map((k) => (
              <button type="button" key={k} className={kind === k ? 'on' : ''} onClick={() => setKind(k)}>
                {LOG_KIND_LABELS[k]}
              </button>
            ))}
          </div>
        </div>

        {detail.tasks.length > 0 && (
          <div className="field">
            <span>{tr('Erledigte Wartungsaufgaben')}</span>
            <span className="hint" style={{ marginBottom: 6 }}>
              {tr('Angehakte Aufgaben starten ihr Intervall ab dem Eintragsdatum neu.')}
            </span>
            {!mayComplete && (
              <div className="alert due" style={{ marginBottom: 8 }}>
                <Icon name="scan" />
                <div>
                  <div className="title">{tr('Erst den QR-Code am Bauteil scannen')}</div>
                  <div className="small">
                    {tr(
                      tr(
                        'Wartungen können Bearbeiter nur nach dem Scan vor Ort als erledigt markieren. Andere Einträge werden als „ohne Scan erfasst“ gespeichert.',
                      ),
                    )}
                  </div>
                </div>
              </div>
            )}
            {detail.tasks.map((s) => (
              <label
                key={s.task.id}
                className={`check${done.includes(s.task.id) ? ' checked' : ''}`}
                style={mayComplete ? undefined : { opacity: 0.55 }}
              >
                <input
                  type="checkbox"
                  checked={done.includes(s.task.id)}
                  disabled={!mayComplete}
                  onChange={() => toggle(s.task.id)}
                />
                <span style={{ flex: 1 }}>
                  <b>{s.task.title}</b>
                  <br />
                  <span className="small muted">
                    {intervalLabel(s.task.intervalValue, s.task.intervalUnit)} · {tr('fällig')} {fmtDate(s.dueDate)}
                  </span>
                </span>
                <StatusBadge status={s.status} />
              </label>
            ))}
          </div>
        )}

        <div className="dictate-row">
          <DictateButton
            lang={speechLang()}
            onText={(text) => setDescription((d) => (d.trim() ? `${d.trim()} ${text}` : text))}
          />
        </div>
        <Field label={tr('Beschreibung')}>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder={tr('Was wurde gemacht? Befund?')}
          />
        </Field>

        <div className="form-grid">
          <Field label={tr('Datum')}>
            <input type="date" value={date} max={today()} onChange={(e) => setDate(e.target.value)} required />
          </Field>
          <Field label={tr('Person')}>
            <input type="text" value={person} onChange={(e) => setPerson(e.target.value)} required />
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
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 8 }}>
              <img src={preview} alt={tr('Vorschau')} style={{ maxWidth: 140, maxHeight: 110, borderRadius: 8 }} />
              <button type="button" className="btn btn-sm btn-danger" onClick={() => setPhoto(null)}>
                {tr('Entfernen')}
              </button>
            </div>
          )}
        </div>
      </section>

      <button className="btn btn-primary btn-lg btn-block" type="submit" disabled={busy}>
        <Icon name="check" /> {tr('Speichern')}
      </button>
    </form>
  );
}
