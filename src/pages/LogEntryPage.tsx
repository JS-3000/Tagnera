import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useData } from '../app/hooks';
import { useSession } from '../app/session';
import { Icon } from '../components/Icon';
import { Empty, Field, StatusBadge, toast } from '../components/ui';
import { LOG_KIND_LABELS, type LogKind } from '../data/types';
import { fmtDate, today } from '../lib/util';
import { intervalLabel } from '../services/maintenance';
import { addLogEntry, loadTagDetail, savePhoto } from '../services/tags';

export function LogEntryPage() {
  const { id = '' } = useParams();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { user, can } = useSession();
  const detail = useData(() => loadTagDetail(id), [id]);

  const preTask = params.get('task');
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

  if (!can('edit')) return <Empty>Nur Bearbeiter und Administratoren können Einträge anlegen.</Empty>;
  if (detail === undefined) return <Empty>Lädt …</Empty>;
  if (detail === null) return <Empty>Tag nicht gefunden.</Empty>;

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
        description: description.trim() || (doneTitles.length ? doneTitles.join(', ') + ' durchgeführt.' : ''),
        photoFileId: file?.id ?? null,
        completedTaskIds: done,
      });
      toast(done.length ? 'Gespeichert – Wartungsintervall neu gestartet' : 'Eintrag gespeichert');
      navigate(`/t/${detail.tag.id}`, { replace: true });
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={save}>
      <div className="page-head">
        <Link to={`/t/${detail.tag.id}`} className="btn btn-sm" aria-label="Zurück">
          <Icon name="back" size={18} />
        </Link>
        <h1>Neuer Eintrag · {detail.tag.tagNumber}</h1>
      </div>

      <section className="card">
        <div className="field">
          <span>Art</span>
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
            <span>Erledigte Wartungsaufgaben</span>
            <span className="hint" style={{ marginBottom: 6 }}>
              Angehakte Aufgaben starten ihr Intervall ab dem Eintragsdatum neu.
            </span>
            {detail.tasks.map((s) => (
              <label key={s.task.id} className={`check${done.includes(s.task.id) ? ' checked' : ''}`}>
                <input type="checkbox" checked={done.includes(s.task.id)} onChange={() => toggle(s.task.id)} />
                <span style={{ flex: 1 }}>
                  <b>{s.task.title}</b>
                  <br />
                  <span className="small muted">
                    {intervalLabel(s.task.intervalValue, s.task.intervalUnit)} · fällig {fmtDate(s.dueDate)}
                  </span>
                </span>
                <StatusBadge status={s.status} />
              </label>
            ))}
          </div>
        )}

        <Field label="Beschreibung">
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Was wurde gemacht? Befund?"
          />
        </Field>

        <div className="form-grid">
          <Field label="Datum">
            <input type="date" value={date} max={today()} onChange={(e) => setDate(e.target.value)} required />
          </Field>
          <Field label="Person">
            <input type="text" value={person} onChange={(e) => setPerson(e.target.value)} required />
          </Field>
        </div>

        <div className="field">
          <span>Foto (optional)</span>
          <label className="btn btn-block">
            <Icon name="camera" /> {photo ? 'Anderes Foto wählen' : 'Foto aufnehmen / auswählen'}
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
              <img src={preview} alt="Vorschau" style={{ maxWidth: 140, maxHeight: 110, borderRadius: 8 }} />
              <button type="button" className="btn btn-sm btn-danger" onClick={() => setPhoto(null)}>
                Entfernen
              </button>
            </div>
          )}
        </div>
      </section>

      <button className="btn btn-primary btn-lg btn-block" type="submit" disabled={busy}>
        <Icon name="check" /> Speichern
      </button>
    </form>
  );
}
