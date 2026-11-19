// Maintenance calendar: month view with coloured dots per day, list of the chosen day.
// Only administrators can mark a task as done here (entry "ohne Scan erfasst");
// editors complete maintenance on the component page after scanning the QR code.
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useData, useMedia } from '../app/hooks';
import { useSession } from '../app/session';
import { Icon } from '../components/Icon';
import { Empty, StatusBadge, toast } from '../components/ui';
import { addDays, fmtDate, today } from '../lib/util';
import { intervalLabel, STATUS_RANK, type MaintStatus } from '../services/maintenance';
import { loadOccurrences, monthName, type Occurrence } from '../services/report';
import { addLogEntry } from '../services/tags';
import { tr } from '../i18n';

const WEEKDAYS = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];
const pad = (n: number) => String(n).padStart(2, '0');

/** Monday-based 6-week grid around a month */
function monthGrid(year: number, month: number): string[] {
  const first = `${year}-${pad(month)}-01`;
  const weekday = (new Date(Date.UTC(year, month - 1, 1)).getUTCDay() + 6) % 7; // 0 = Monday
  const start = addDays(first, -weekday);
  return Array.from({ length: 42 }, (_, i) => addDays(start, i));
}

export function CalendarPage() {
  const { can, user } = useSession();
  const wide = useMedia('(min-width: 900px)');
  const t = today();
  const [ym, setYm] = useState(() => ({ y: Number(t.slice(0, 4)), m: Number(t.slice(5, 7)) }));
  const [selected, setSelected] = useState(t);
  const days = useMemo(() => monthGrid(ym.y, ym.m), [ym]);
  const occ = useData(() => loadOccurrences(days[0], days[41]), [days[0], days[41]]);

  const byDay = useMemo(() => {
    const m = new Map<string, Occurrence[]>();
    for (const o of occ ?? []) m.set(o.date, [...(m.get(o.date) ?? []), o]);
    return m;
  }, [occ]);

  const step = (dir: -1 | 1) =>
    setYm(({ y, m }) => {
      const n = m + dir;
      return n < 1 ? { y: y - 1, m: 12 } : n > 12 ? { y: y + 1, m: 1 } : { y, m: n };
    });

  const goToday = () => {
    setYm({ y: Number(t.slice(0, 4)), m: Number(t.slice(5, 7)) });
    setSelected(t);
  };

  const complete = async (o: Occurrence) => {
    if (
      !confirm(
        tr('„{{task}}“ an {{tag}} als erledigt markieren?\nDer Eintrag wird als „ohne Scan erfasst“ gespeichert.', {
          task: o.status.task.title,
          tag: o.status.tag.tagNumber,
        }),
      )
    )
      return;
    await addLogEntry({
      tagId: o.status.tag.id,
      date: t,
      person: user?.name ?? '',
      kind: 'wartung',
      description: `${o.status.task.title} – im Wartungskalender als erledigt markiert.`,
      photoFileId: null,
      completedTaskIds: [o.status.task.id],
      source: 'manual',
    });
    toast(tr('Erledigt – Intervall neu gestartet'));
  };

  const list = byDay.get(selected) ?? [];

  const calendar = (
    <section className="card cal">
      <div className="cal-head">
        <button className="btn btn-sm" onClick={() => step(-1)} aria-label={tr('Vorheriger Monat')}>
          ‹
        </button>
        <h2>
          {monthName(ym.m)} {ym.y}
        </h2>
        <button className="btn btn-sm" onClick={() => step(1)} aria-label={tr('Nächster Monat')}>
          ›
        </button>
        <button className="btn btn-sm" onClick={goToday}>
          {tr('Heute')}
        </button>
      </div>
      <div className="cal-grid" role="grid">
        {WEEKDAYS.map((w) => (
          <div key={w} className="cal-wd">
            {tr(w)}
          </div>
        ))}
        {days.map((d) => {
          const items = byDay.get(d) ?? [];
          const counts: Record<MaintStatus, number> = { ok: 0, due: 0, overdue: 0 };
          items.forEach((o) => counts[o.state]++);
          const out = Number(d.slice(5, 7)) !== ym.m;
          return (
            <button
              key={d}
              className={`cal-day${out ? ' out' : ''}${d === t ? ' today' : ''}${d === selected ? ' sel' : ''}`}
              onClick={() => setSelected(d)}
              aria-label={`${fmtDate(d)}: ${tr('{{n}} Wartungen', { n: items.length })}`}
              aria-pressed={d === selected}
            >
              <span className="cal-num">{Number(d.slice(8, 10))}</span>
              <span className="cal-dots">
                {(['overdue', 'due', 'ok'] as MaintStatus[]).map((st) =>
                  Array.from({ length: Math.min(counts[st], 3) }, (_, i) => <i key={st + i} className={`dot ${st}`} />),
                )}
              </span>
            </button>
          );
        })}
      </div>
      <div className="cal-legend small muted">
        <span>
          <i className="dot ok" /> {tr('geplant')}
        </span>
        <span>
          <i className="dot due" /> {tr('fällig')}
        </span>
        <span>
          <i className="dot overdue" /> {tr('überfällig')}
        </span>
      </div>
    </section>
  );

  const dayList = (
    <section className="card">
      <h2>{fmtDate(selected)}</h2>
      {occ === undefined ? (
        <Empty>{tr('Lädt …')}</Empty>
      ) : list.length === 0 ? (
        <Empty>{tr('Keine Wartungen an diesem Tag.')}</Empty>
      ) : (
        <ul className="list">
          {[...list]
            .sort((a, b) => STATUS_RANK[b.state] - STATUS_RANK[a.state])
            .map((o) => (
              <li
                key={o.status.tag.id + o.status.task.id}
                className="list-item wrap"
                style={{ alignItems: 'flex-start' }}
              >
                <div className="grow">
                  <Link to={`/t/${o.status.tag.id}`}>
                    <b>{o.status.tag.tagNumber}</b>
                  </Link>{' '}
                  <span className="small muted">{o.status.tag.description || o.status.tag.type}</span>
                  <div style={{ fontWeight: 600 }}>{o.status.task.title}</div>
                  <div className="small muted">
                    {o.carried ? `${tr('überfällig seit {{date}}', { date: fmtDate(o.status.dueDate) })} · ` : ''}
                    {intervalLabel(o.status.task.intervalValue, o.status.task.intervalUnit)}
                  </div>
                </div>
                <div className="item-actions" style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <StatusBadge status={o.state} />
                  {can('admin') && (o.carried || o.date === o.status.dueDate) && o.date <= addDays(t, 30) && (
                    <button className="btn btn-sm" onClick={() => complete(o)}>
                      <Icon name="check" size={18} /> {tr('Erledigt')}
                    </button>
                  )}
                  <Link className="btn btn-sm" to={`/t/${o.status.tag.id}`}>
                    {tr('Bauteil')}
                  </Link>
                </div>
              </li>
            ))}
        </ul>
      )}
      {!can('admin') && list.length > 0 && (
        <p className="small muted" style={{ marginBottom: 0 }}>
          {tr('Wartungen werden nach dem Scan des QR-Codes auf der Bauteilseite als erledigt markiert.')}
        </p>
      )}
    </section>
  );

  return (
    <div>
      <div className="page-head">
        <h1>{tr('Wartungskalender')}</h1>
        <Link className="btn" to="/report">
          <Icon name="report" /> {tr('Wartungsreport')}
        </Link>
      </div>
      {wide ? (
        <div className="cal-layout">
          {calendar}
          {dayList}
        </div>
      ) : (
        <>
          {calendar}
          {dayList}
        </>
      )}
    </div>
  );
}
