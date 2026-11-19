import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useData, useMedia } from '../app/hooks';
import { useSession } from '../app/session';
import { Icon } from '../components/Icon';
import { Empty, StatusBadge } from '../components/ui';
import { data } from '../data';
import type { Tag } from '../data/types';
import { byString, fmtDate } from '../lib/util';
import {
  loadAllTaskStatuses,
  STATUS_RANK,
  worstStatus,
  type MaintStatus,
  type TaskStatus,
} from '../services/maintenance';
import { tr } from '../i18n';

interface Row {
  tag: Tag;
  orderNumber: string;
  next: TaskStatus | null;
  status: MaintStatus | null;
}

type SortKey = 'tag' | 'type' | 'plant' | 'due' | 'status';

export function TagsPage() {
  const { can } = useSession();
  const navigate = useNavigate();
  const wide = useMedia('(min-width: 900px)');
  const [q, setQ] = useState('');
  const [plant, setPlant] = useState('');
  const [statusFilter, setStatusFilter] = useState<'' | MaintStatus>('');
  const [sort, setSort] = useState<SortKey>('tag');
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const rows = useData(async (): Promise<Row[]> => {
    const [tags, products, statuses] = await Promise.all([
      data.tags.list(),
      data.products.list(),
      loadAllTaskStatuses(),
    ]);
    const productById = new Map(products.map((p) => [p.id, p]));
    return tags.map((tag) => {
      const own = statuses.filter((s) => s.tag.id === tag.id);
      return {
        tag,
        orderNumber: tag.orderNumber || (tag.productId ? (productById.get(tag.productId)?.orderNumber ?? '') : ''),
        next: own[0] ?? null, // statuses are sorted by due date
        status: own.length ? worstStatus(own) : null,
      };
    });
  }, []);

  const plants = useMemo(() => [...new Set((rows ?? []).map((r) => r.tag.plant).filter(Boolean))].sort(), [rows]);

  const visible = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const list = (rows ?? []).filter((r) => {
      if (plant && r.tag.plant !== plant) return false;
      if (statusFilter && r.status !== statusFilter) return false;
      if (!needle) return true;
      const t = r.tag;
      return [t.tagNumber, t.type, t.plant, t.manufacturer, t.articleNumber, r.orderNumber, t.description, t.location]
        .join(' ')
        .toLowerCase()
        .includes(needle);
    });
    const cmp: Record<SortKey, (a: Row, b: Row) => number> = {
      tag: byString((r) => r.tag.tagNumber),
      type: byString((r) => r.tag.type + r.tag.tagNumber),
      plant: byString((r) => r.tag.plant + r.tag.tagNumber),
      due: (a, b) => (a.next?.dueDate ?? '9999').localeCompare(b.next?.dueDate ?? '9999'),
      status: (a, b) =>
        STATUS_RANK[b.status ?? 'ok'] - STATUS_RANK[a.status ?? 'ok'] ||
        (a.next?.dueDate ?? '').localeCompare(b.next?.dueDate ?? ''),
    };
    return list.sort(cmp[sort]);
  }, [rows, q, plant, statusFilter, sort]);

  const toggle = (id: string) =>
    setSelected((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  const allSelected = visible.length > 0 && visible.every((r) => selected.has(r.tag.id));

  const th = (key: SortKey, label: string) => (
    <th className="sortable" onClick={() => setSort(key)} aria-sort={sort === key ? 'ascending' : undefined}>
      {label} {sort === key && '▾'}
    </th>
  );

  return (
    <div>
      <div className="page-head">
        <h1>
          {tr('Tags')}{' '}
          {rows && (
            <span className="muted small">
              ({visible.length} {tr('von')} {rows.length})
            </span>
          )}
        </h1>
        {can('edit') && (
          <Link className="btn btn-primary" to="/tags/neu">
            <Icon name="plus" /> {tr('Neuer Tag')}
          </Link>
        )}
        {can('admin') && wide && (
          <Link className="btn" to="/import">
            <Icon name="upload" /> {tr('CSV-Import')}
          </Link>
        )}
        <button
          className="btn"
          disabled={selected.size === 0}
          onClick={() => navigate(`/etiketten?tags=${[...selected].join(',')}`)}
        >
          <Icon name="printer" /> {tr('Etiketten (')}
          {selected.size})
        </button>
      </div>

      <div className="card" style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
        <input
          type="search"
          placeholder={tr('Suche: Tag, Typ, Hersteller, Art.-Nr., Bestellnummer …')}
          value={q}
          onChange={(e) => setQ(e.target.value)}
          style={{ flex: '3 1 260px' }}
          aria-label={tr('Suche')}
        />
        <select
          value={plant}
          onChange={(e) => setPlant(e.target.value)}
          style={{ flex: '1 1 160px' }}
          aria-label={tr('Anlage')}
        >
          <option value="">{tr('Alle Anlagen')}</option>
          {plants.map((p) => (
            <option key={p}>{p}</option>
          ))}
        </select>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as '' | MaintStatus)}
          style={{ flex: '1 1 140px' }}
          aria-label={tr('Status')}
        >
          <option value="">{tr('Alle Status')}</option>
          <option value="overdue">{tr('Überfällig')}</option>
          <option value="due">{tr('Fällig')}</option>
          <option value="ok">{tr('OK')}</option>
        </select>
      </div>

      {rows === undefined ? (
        <Empty>{tr('Lädt …')}</Empty>
      ) : visible.length === 0 ? (
        <Empty>{tr('Keine Tags gefunden.')}</Empty>
      ) : wide ? (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>
                  <label className="tap">
                    <input
                      type="checkbox"
                      checked={allSelected}
                      onChange={() => setSelected(allSelected ? new Set() : new Set(visible.map((r) => r.tag.id)))}
                      aria-label={tr('Alle auswählen')}
                    />
                  </label>
                </th>
                {th('tag', tr('Tag'))}
                {th('type', tr('Typ'))}
                {th('plant', tr('Anlage'))}
                <th>{tr('Hersteller / Art.-Nr.')}</th>
                <th>{tr('Bestellnummer')}</th>
                {th('due', tr('Nächste Wartung'))}
                {th('status', tr('Status'))}
              </tr>
            </thead>
            <tbody>
              {visible.map((r) => (
                <tr key={r.tag.id} className="clickable" onClick={() => navigate(`/t/${r.tag.id}`)}>
                  <td onClick={(e) => e.stopPropagation()}>
                    <label className="tap">
                      <input
                        type="checkbox"
                        checked={selected.has(r.tag.id)}
                        onChange={() => toggle(r.tag.id)}
                        aria-label={`${r.tag.tagNumber} auswählen`}
                      />
                    </label>
                  </td>
                  <td>
                    <b>{r.tag.tagNumber}</b>
                    {r.tag.description && <div className="small muted">{r.tag.description}</div>}
                  </td>
                  <td>{r.tag.type}</td>
                  <td>{r.tag.plant}</td>
                  <td>
                    {r.tag.manufacturer}
                    {r.tag.articleNumber && <span className="muted"> / {r.tag.articleNumber}</span>}
                    {r.tag.productId && (
                      <span className="pill" style={{ marginLeft: 6 }}>
                        {tr('Vorlage')}
                      </span>
                    )}
                  </td>
                  <td className="mono small">{r.orderNumber}</td>
                  <td>
                    {r.next ? (
                      <>
                        {fmtDate(r.next.dueDate)}
                        <div className="small muted">{r.next.task.title}</div>
                      </>
                    ) : (
                      '–'
                    )}
                  </td>
                  <td>
                    <StatusBadge status={r.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="card" style={{ padding: '4px 12px' }}>
          <ul className="list">
            {visible.map((r) => (
              <li key={r.tag.id} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <label className="tap">
                  <input
                    type="checkbox"
                    checked={selected.has(r.tag.id)}
                    onChange={() => toggle(r.tag.id)}
                    style={{ accentColor: 'var(--accent)' }}
                    aria-label={`${r.tag.tagNumber} auswählen`}
                  />
                </label>
                <Link className="list-item" to={`/t/${r.tag.id}`} style={{ flex: 1 }}>
                  <div className="grow">
                    <div className="title">{r.tag.tagNumber}</div>
                    <div className="small muted">
                      {r.tag.type} · {r.tag.manufacturer} {r.tag.articleNumber}
                    </div>
                    {r.next && (
                      <div className="small">
                        {tr('Nächste Wartung:')} {fmtDate(r.next.dueDate)}
                      </div>
                    )}
                  </div>
                  <StatusBadge status={r.status} />
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
