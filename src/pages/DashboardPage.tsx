// Desktop start page: overview instead of the camera screen.
import { Link, useNavigate } from 'react-router-dom';
import { useData, useMedia } from '../app/hooks';
import { useSession } from '../app/session';
import { Columns } from '../components/Columns';
import { Icon } from '../components/Icon';
import { Empty, StatusBadge } from '../components/ui';
import { data } from '../data';
import { LOG_KIND_LABELS } from '../data/types';
import { fmtDate, today } from '../lib/util';
import { describeDue, loadAllTaskStatuses, STATUS_RANK, worstStatus, type MaintStatus } from '../services/maintenance';
import { loadSettings } from '../services/settings';
import { ScanPage } from './ScanPage';

/** "/" shows the scanner on phones and the overview on large screens. */
export function HomePage() {
  const wide = useMedia('(min-width: 900px)');
  return wide ? <DashboardPage /> : <ScanPage />;
}

const HORIZON_DAYS = 60;

export function DashboardPage() {
  const { can } = useSession();
  const navigate = useNavigate();
  const d = useData(async () => {
    const [tags, statuses, entries] = await Promise.all([
      data.tags.list(),
      loadAllTaskStatuses(),
      data.logEntries.list(),
    ]);
    const tagStatus = new Map<string, MaintStatus>();
    for (const t of tags) {
      const own = statuses.filter((s) => s.tag.id === t.id);
      if (own.length) tagStatus.set(t.id, worstStatus(own));
    }
    const count = (st: MaintStatus) => [...tagStatus.values()].filter((x) => x === st).length;
    const upcoming = statuses
      .filter((s) => s.status !== 'ok' || s.daysLeft <= HORIZON_DAYS)
      .sort((a, b) => STATUS_RANK[b.status] - STATUS_RANK[a.status] || a.dueDate.localeCompare(b.dueDate));
    const byId = new Map(tags.map((t) => [t.id, t]));
    const latest = entries
      .sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt))
      .slice(0, 8)
      .map((e) => ({ e, tag: byId.get(e.tagId) }));
    const plants = new Map<string, { total: number; worst: MaintStatus | null }>();
    for (const t of tags) {
      const key = t.plant || '(ohne Anlage)';
      const p = plants.get(key) ?? { total: 0, worst: null };
      p.total++;
      const st = tagStatus.get(t.id);
      if (st && (!p.worst || STATUS_RANK[st] > STATUS_RANK[p.worst])) p.worst = st;
      plants.set(key, p);
    }
    const recent = loadSettings()
      .recentTagIds.map((id) => byId.get(id))
      .filter((t) => !!t)
      .slice(0, 5);
    return {
      total: tags.length,
      overdue: count('overdue'),
      due: count('due'),
      ok: count('ok'),
      upcoming,
      latest,
      plants: [...plants.entries()].sort((a, b) => a[0].localeCompare(b[0])),
      recent,
    };
  }, []);

  if (!d) return <Empty>Lädt …</Empty>;

  return (
    <div>
      <div className="page-head">
        <h1>
          Übersicht{' '}
          <span className="muted small" style={{ fontWeight: 400 }}>
            {fmtDate(today())}
          </span>
        </h1>
        {can('edit') && (
          <Link className="btn btn-primary" to="/tags/neu">
            <Icon name="plus" /> Neuer Tag
          </Link>
        )}
        <Link className="btn" to="/scan">
          <Icon name="scan" /> Mit Webcam scannen
        </Link>
        <Link className="btn" to="/report">
          <Icon name="printer" /> Wartungsreport
        </Link>
      </div>

      {d.total === 0 && (
        <div className="alert info">
          <div>
            <div className="title">Noch keine Daten auf diesem Gerät</div>
            {can('admin') ? (
              <>
                In den <Link to="/einstellungen">Einstellungen</Link> „Demo zurücksetzen“ wählen, einen{' '}
                <Link to="/tags/neu">Tag anlegen</Link> oder Tags per <Link to="/import">CSV importieren</Link>.
              </>
            ) : (
              'Die Demo lässt sich in den Einstellungen mit „Demo zurücksetzen“ wiederherstellen.'
            )}
          </div>
        </div>
      )}

      <div className="kpis">
        <Link className="kpi" to="/tags">
          <div className="num">{d.total}</div>
          <div className="lbl">Tags gesamt</div>
        </Link>
        <Link className="kpi overdue" to="/hinweise">
          <div className="num" style={{ color: 'var(--overdue)' }}>
            {d.overdue}
          </div>
          <div className="lbl">Tags mit überfälliger Wartung</div>
        </Link>
        <Link className="kpi due" to="/hinweise">
          <div className="num" style={{ color: '#a8560b' }}>
            {d.due}
          </div>
          <div className="lbl">Tags mit fälliger Wartung</div>
        </Link>
        <Link className="kpi ok" to="/tags">
          <div className="num" style={{ color: 'var(--ok)' }}>
            {d.ok}
          </div>
          <div className="lbl">Tags ohne offene Wartung</div>
        </Link>
      </div>

      <Columns
        left="2fr"
        right="1fr"
        tiles={[
          {
            key: 'maint',
            col: 'left',
            grow: true,
            node: (
              <section className="card">
                <div className="section-head">
                  <h2>
                    <Icon name="calendar" /> Wartungen: offen & nächste {HORIZON_DAYS} Tage
                  </h2>
                  <Link className="btn btn-sm" to="/report">
                    Report
                  </Link>
                </div>
                {d.upcoming.length === 0 ? (
                  <Empty>Keine anstehenden Wartungen.</Empty>
                ) : (
                  <div className="table-wrap" style={{ border: 0 }}>
                    <table className="table">
                      <thead>
                        <tr>
                          <th>Tag</th>
                          <th>Aufgabe</th>
                          <th>Fällig</th>
                          <th>Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {d.upcoming.map((s) => (
                          <tr
                            key={s.tag.id + s.task.id}
                            className="clickable"
                            onClick={() => navigate(`/t/${s.tag.id}`)}
                          >
                            <td>
                              <b>{s.tag.tagNumber}</b>
                              <div className="small muted">
                                {s.tag.type}
                                {s.tag.plant && ` · ${s.tag.plant}`}
                              </div>
                            </td>
                            <td>{s.task.title}</td>
                            <td className="nowrap">
                              {fmtDate(s.dueDate)}
                              <div className="small muted">{describeDue(s)}</div>
                            </td>
                            <td>
                              <StatusBadge status={s.status} />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </section>
            ),
          },
          {
            key: 'plants',
            col: 'right',
            node: (
              <section className="card">
                <h2>Anlagen</h2>
                {d.plants.length === 0 && <Empty>–</Empty>}
                <ul className="list">
                  {d.plants.map(([name, p]) => (
                    <li key={name} className="list-item">
                      <Icon name="box" />
                      <div className="grow">
                        <div className="title">{name}</div>
                        <div className="small muted">{p.total} Tags</div>
                      </div>
                      <StatusBadge status={p.worst} />
                    </li>
                  ))}
                </ul>
              </section>
            ),
          },
          {
            key: 'latest',
            col: 'right',
            node: (
              <section className="card">
                <h2>Letzte Tagebucheinträge</h2>
                {d.latest.length === 0 && <Empty>Noch keine Einträge.</Empty>}
                <ul className="list">
                  {d.latest.map(({ e, tag }) => (
                    <li key={e.id}>
                      <Link className="list-item" to={`/t/${e.tagId}`} style={{ alignItems: 'flex-start' }}>
                        <div className="grow">
                          <div>
                            <b>{tag?.tagNumber ?? '?'}</b> · {LOG_KIND_LABELS[e.kind]}{' '}
                            <span className="small muted">
                              {fmtDate(e.date)} · {e.person}
                            </span>
                          </div>
                          <div
                            className="small muted"
                            style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                          >
                            {e.description}
                          </div>
                        </div>
                      </Link>
                    </li>
                  ))}
                </ul>
              </section>
            ),
          },
          {
            key: 'recent',
            col: 'right',
            node: d.recent.length > 0 && (
              <section className="card">
                <h2>Zuletzt geöffnet</h2>
                <ul className="list">
                  {d.recent.map((t) => (
                    <li key={t!.id}>
                      <Link className="list-item" to={`/t/${t!.id}`}>
                        <Icon name="tag" size={20} />
                        <b>{t!.tagNumber}</b> <span className="small muted">{t!.type}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </section>
            ),
          },
        ]}
      />
    </div>
  );
}
