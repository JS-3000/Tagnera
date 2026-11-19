// Hall monitor: big-screen view for a TV in the workshop (#/monitor).
// Shows today's work, overdue tasks, today's completed work, open fault reports and the next 7 days.
// Refreshes every minute, pages through long lists automatically, keeps the screen awake.
// Note: without a server the monitor shows the data of the device it runs on.
import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useData } from '../app/hooks';
import { Logo } from '../components/Logo';
import { data } from '../data';
import { LOG_KIND_LABELS, type IssueReport, type LogEntry, type Tag } from '../data/types';
import { addDays, fmtDate, today } from '../lib/util';
import { loadAllTaskStatuses, type TaskStatus } from '../services/maintenance';
import { loadOccurrences, type Occurrence } from '../services/report';
import { locale, tr } from '../i18n';

const REFRESH_MS = 60_000;
const PAGE_MS = 9_000;
const WEEKDAY = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];

interface MonitorData {
  plants: string[];
  overdue: TaskStatus[];
  dueToday: TaskStatus[];
  doneToday: { entry: LogEntry; tag: Tag | undefined }[];
  issues: IssueReport[];
  week: Occurrence[];
}

export function MonitorPage() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const plant = params.get('anlage');
  const [tick, setTick] = useState(0);
  const [now, setNow] = useState(() => new Date());

  // clock every second, data every minute
  useEffect(() => {
    const c = setInterval(() => setNow(new Date()), 1000);
    const r = setInterval(() => setTick((x) => x + 1), REFRESH_MS);
    return () => {
      clearInterval(c);
      clearInterval(r);
    };
  }, []);

  const d = useData(async (): Promise<MonitorData> => {
    const t = today();
    const [statuses, tags, entries, issues, week] = await Promise.all([
      loadAllTaskStatuses(),
      data.tags.list(),
      data.logEntries.findBy('date', t),
      data.issues.list(),
      loadOccurrences(addDays(t, 1), addDays(t, 7)),
    ]);
    const inPlant = (tag: Tag | undefined) => !plant || tag?.plant === plant;
    const byId = new Map(tags.map((x) => [x.id, x]));
    const st = statuses.filter((s) => inPlant(s.tag));
    return {
      plants: plant ? [plant] : [...new Set(tags.map((x) => x.plant).filter(Boolean))].sort(),
      overdue: st.filter((s) => s.status === 'overdue').sort((a, b) => a.dueDate.localeCompare(b.dueDate)),
      dueToday: st.filter((s) => s.dueDate === t),
      doneToday: entries
        .map((entry) => ({ entry, tag: byId.get(entry.tagId) }))
        .filter((x) => inPlant(x.tag))
        .sort((a, b) => b.entry.createdAt.localeCompare(a.entry.createdAt)),
      issues: issues
        .filter((i) => i.status !== 'done' && inPlant(byId.get(i.tagId)))
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
      week: week.filter((o) => inPlant(o.status.tag)),
    };
  }, [tick, plant]);

  // keep the screen on while the monitor is open (Wake Lock API, where available)
  useEffect(() => {
    let lock: { release(): Promise<void> } | null = null;
    const nav = navigator as Navigator & {
      wakeLock?: { request(type: 'screen'): Promise<{ release(): Promise<void> }> };
    };
    const request = async () => {
      try {
        if (nav.wakeLock && document.visibilityState === 'visible') lock = await nav.wakeLock.request('screen');
      } catch {
        /* not allowed / not supported */
      }
    };
    void request();
    const onVis = () => document.visibilityState === 'visible' && void request();
    document.addEventListener('visibilitychange', onVis);
    return () => {
      document.removeEventListener('visibilitychange', onVis);
      void lock?.release().catch(() => {});
    };
  }, []);

  // leave with Esc (or when fullscreen is closed with Esc)
  const leave = () => {
    if (document.fullscreenElement) void document.exitFullscreen().catch(() => {});
    navigate('/', { replace: true });
  };
  useEffect(() => {
    const startedFullscreen = !!document.fullscreenElement;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && leave();
    const onFs = () => startedFullscreen && !document.fullscreenElement && navigate('/', { replace: true });
    window.addEventListener('keydown', onKey);
    document.addEventListener('fullscreenchange', onFs);
    return () => {
      window.removeEventListener('keydown', onKey);
      document.removeEventListener('fullscreenchange', onFs);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    document.title = `${tr('Hallen-Monitor')} · ConnecTag`;
  }, []);

  const t = today();
  const days = Array.from({ length: 7 }, (_, i) => addDays(t, i + 1));

  return (
    <div className="mon">
      <header className="mon-head">
        <Logo variant="dark" size={56} />
        <div className="mon-plant">{d ? d.plants.join(' · ') || tr('Alle Anlagen') : ''}</div>
        <div className="mon-clock">
          <div className="mon-time">{now.toLocaleTimeString(locale(), { hour: '2-digit', minute: '2-digit' })}</div>
          <div className="mon-date">
            {now.toLocaleDateString(locale(), { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })}
          </div>
        </div>
      </header>

      <main className="mon-main">
        <Column title={tr('Überfällig')} tone="overdue" count={d?.overdue.length}>
          <Paged
            items={d?.overdue ?? []}
            empty={tr('Keine überfälligen Wartungen')}
            render={(s) => (
              <Row
                key={s.tag.id + s.task.id}
                tag={s.tag.tagNumber}
                title={s.task.title}
                sub={s.tag.description || s.tag.type}
                right={tr('seit {{n}} T.', { n: -daysLeft(s) })}
              />
            )}
          />
        </Column>
        <Column title={tr('Heute fällig')} tone="due" count={d?.dueToday.length}>
          <Paged
            items={d?.dueToday ?? []}
            empty={tr('Heute ist nichts fällig')}
            render={(s) => (
              <Row
                key={s.tag.id + s.task.id}
                tag={s.tag.tagNumber}
                title={s.task.title}
                sub={s.tag.description || s.tag.type}
              />
            )}
          />
        </Column>
        <Column title={tr('Heute erledigt')} tone="ok" count={d?.doneToday.length}>
          <Paged
            items={d?.doneToday ?? []}
            empty={tr('Noch nichts erledigt')}
            render={({ entry, tag }) => (
              <Row
                key={entry.id}
                tag={tag?.tagNumber ?? '?'}
                title={entry.description || LOG_KIND_LABELS[entry.kind]}
                sub={`${LOG_KIND_LABELS[entry.kind]} · ${entry.person}`}
                right={new Date(entry.createdAt).toLocaleTimeString(locale(), { hour: '2-digit', minute: '2-digit' })}
              />
            )}
          />
        </Column>
      </main>

      <section className="mon-bottom">
        <Column title={tr('Offene Störmeldungen')} tone="overdue" count={d?.issues.length}>
          <Paged
            items={d?.issues ?? []}
            empty={tr('Keine offenen Meldungen')}
            render={(i) => (
              <Row
                key={i.id}
                tag={i.tagNumber}
                title={i.description}
                sub={`${i.name} · ${new Date(i.createdAt).toLocaleString(locale(), { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}`}
              />
            )}
          />
        </Column>
        <Column title={tr('Nächste 7 Tage')} tone="neutral" count={d?.week.length}>
          <div className="mon-week">
            {days.map((day) => {
              const items = (d?.week ?? []).filter((o) => o.date === day);
              const wd = tr(WEEKDAY[new Date(day + 'T12:00:00').getDay()]);
              return (
                <div key={day} className="mon-day">
                  <div className="mon-day-head">
                    {wd} {fmtDate(day).slice(0, 6)}
                  </div>
                  {items.slice(0, 3).map((o) => (
                    <div key={o.status.tag.id + o.status.task.id} className={`mon-chip ${o.state}`}>
                      {o.status.tag.tagNumber}
                    </div>
                  ))}
                  {items.length > 3 && <div className="mon-more">+{items.length - 3}</div>}
                  {items.length === 0 && <div className="mon-none">–</div>}
                </div>
              );
            })}
          </div>
        </Column>
      </section>

      <button
        className="mon-exit"
        onClick={leave}
        aria-label={tr('Hallen-Monitor beenden')}
        title={tr('Beenden (Esc)')}
      >
        ✕
      </button>
    </div>
  );
}

const daysLeft = (s: TaskStatus) => s.daysLeft;

function Column({
  title,
  tone,
  count,
  children,
}: {
  title: string;
  tone: string;
  count?: number;
  children: ReactNode;
}) {
  return (
    <section className={`mon-col ${tone}`}>
      <h2>
        {title}
        <span className="mon-count">{count ?? ''}</span>
      </h2>
      {children}
    </section>
  );
}

function Row({ tag, title, sub, right }: { tag: string; title: string; sub?: string; right?: string }) {
  return (
    <div className="mon-row">
      <div className="mon-tag">{tag}</div>
      <div className="mon-text">
        <div className="mon-title">{title}</div>
        {sub && <div className="mon-sub">{sub}</div>}
      </div>
      {right && <div className="mon-right">{right}</div>}
    </div>
  );
}

/** Shows as many rows as fit; with more items it pages through them automatically. */
function Paged<T>({ items, render, empty }: { items: T[]; render: (t: T) => ReactNode; empty: string }) {
  const box = useRef<HTMLDivElement>(null);
  const [perPage, setPerPage] = useState(4);
  const [page, setPage] = useState(0);

  useLayoutEffect(() => {
    const el = box.current;
    if (!el) return;
    const measure = () => {
      const row = el.querySelector('.mon-row') as HTMLElement | null;
      const rowH = row ? row.offsetHeight + 10 : 80;
      setPerPage(Math.max(1, Math.floor((el.clientHeight + 10) / rowH)));
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [items.length]);

  const pages = Math.max(1, Math.ceil(items.length / perPage));
  useEffect(() => {
    if (pages <= 1) return setPage(0);
    const id = setInterval(() => setPage((p) => (p + 1) % pages), PAGE_MS);
    return () => clearInterval(id);
  }, [pages]);

  const current = items.slice((page % pages) * perPage, (page % pages) * perPage + perPage);
  return (
    <div className="mon-list" ref={box}>
      {items.length === 0 ? <div className="mon-empty">{empty}</div> : current.map(render)}
      {pages > 1 && (
        <div className="mon-pages">
          {Array.from({ length: pages }, (_, i) => (
            <i key={i} className={i === page % pages ? 'on' : ''} />
          ))}
        </div>
      )}
    </div>
  );
}
