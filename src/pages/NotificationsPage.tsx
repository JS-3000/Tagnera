import { Link } from 'react-router-dom';
import { useData } from '../app/hooks';
import { Icon } from '../components/Icon';
import { Empty, StatusBadge } from '../components/ui';
import { fmtDate } from '../lib/util';
import { describeDue, loadAllTaskStatuses, STATUS_RANK } from '../services/maintenance';

/** In-app notifications (no push): all due and overdue maintenance tasks. */
export function NotificationsPage() {
  const list = useData(
    () =>
      loadAllTaskStatuses().then((l) =>
        l
          .filter((s) => s.status !== 'ok')
          .sort((a, b) => STATUS_RANK[b.status] - STATUS_RANK[a.status] || a.dueDate.localeCompare(b.dueDate)),
      ),
    [],
  );

  return (
    <div>
      <div className="page-head">
        <h1>Hinweise</h1>
      </div>
      <p className="muted small">
        Fällige und überfällige Wartungen. Im Prototyp gibt es keine Push-Nachrichten – die Hinweise erscheinen nur hier
        und als Zähler an der Glocke.
      </p>
      {list === undefined ? (
        <Empty>Lädt …</Empty>
      ) : list.length === 0 ? (
        <div className="alert">
          <Icon name="check" />
          <div>
            <div className="title">Alles erledigt</div>
            Keine fälligen Wartungen.
          </div>
        </div>
      ) : (
        <div className="alert-grid">
          {list.map((s) => (
            <Link
              key={s.tag.id + s.task.id}
              to={`/t/${s.tag.id}`}
              className={`alert ${s.status}`}
              style={{ textDecoration: 'none' }}
            >
              <Icon name="calendar" size={28} />
              <div style={{ flex: 1 }}>
                <div className="title">
                  {s.tag.tagNumber} · {s.task.title}
                </div>
                <div className="small">
                  {s.tag.type}
                  {s.tag.plant && ` · ${s.tag.plant}`}
                </div>
                <div className="small">
                  Fällig am {fmtDate(s.dueDate)} – {describeDue(s)}
                </div>
              </div>
              <StatusBadge status={s.status} />
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
