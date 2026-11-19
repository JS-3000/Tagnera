// Editors for maintenance tasks, spare parts and FAQ of a product template or a single tag.
import { useState } from 'react';
import { useData } from '../app/hooks';
import { data } from '../data';
import {
  INTERVAL_UNIT_LABELS,
  type Faq,
  type IntervalUnit,
  type MaintenanceTask,
  type OwnerType,
  type SparePart,
} from '../data/types';
import { uuid } from '../lib/util';
import { intervalLabel } from '../services/maintenance';
import { loadOwned } from '../services/tags';
import { Icon } from './Icon';
import { Empty, Field, Modal } from './ui';
import { tr } from '../i18n';

interface OwnerProps {
  ownerType: OwnerType;
  ownerId: string;
  /** for a tag: id of its product, so tasks can reference the product's spare parts too */
  productId?: string | null;
  readOnly?: boolean;
}

// ---------------------------------------------------------------- maintenance tasks

export function TasksEditor({ ownerType, ownerId, productId, readOnly }: OwnerProps) {
  const tasks = useData(() => loadOwned(data.tasks, ownerType, ownerId), [ownerType, ownerId]);
  const parts = useData(async () => {
    const own = await loadOwned(data.spareParts, ownerType, ownerId);
    const fromProduct = productId ? await loadOwned(data.spareParts, 'product', productId) : [];
    return [...fromProduct, ...own];
  }, [ownerType, ownerId, productId]);
  const [edit, setEdit] = useState<MaintenanceTask | null>(null);
  const partName = (id: string) => parts?.find((p) => p.id === id)?.name ?? '?';

  return (
    <>
      {tasks?.length === 0 && <Empty>{tr('Keine Wartungsaufgaben.')}</Empty>}
      <ul className="list">
        {tasks?.map((t) => (
          <li key={t.id} className="list-item">
            <div className="grow">
              <div className="title">
                {t.title} – {intervalLabel(t.intervalValue, t.intervalUnit)}
              </div>
              {t.description && <div className="small muted">{t.description}</div>}
              {t.requiredParts.length > 0 && (
                <div className="small">
                  {tr('Teile:')} {t.requiredParts.map((r) => `${r.quantity} × ${partName(r.sparePartId)}`).join(', ')}
                </div>
              )}
            </div>
            {!readOnly && (
              <>
                <button className="icon-btn" aria-label={tr('Bearbeiten')} onClick={() => setEdit(t)}>
                  <Icon name="edit" />
                </button>
                <button
                  className="icon-btn"
                  aria-label={tr('Löschen')}
                  onClick={() =>
                    confirm(tr('Aufgabe „{{name}}“ löschen?', { name: t.title })) && data.tasks.remove(t.id)
                  }
                >
                  <Icon name="trash" />
                </button>
              </>
            )}
          </li>
        ))}
      </ul>
      {!readOnly && (
        <button
          className="btn btn-block"
          onClick={() =>
            setEdit({
              id: uuid(),
              ownerType,
              ownerId,
              title: '',
              description: '',
              intervalValue: 1,
              intervalUnit: 'years',
              requiredParts: [],
            })
          }
        >
          <Icon name="plus" /> {tr('Wartungsaufgabe hinzufügen')}
        </button>
      )}
      {edit && <TaskModal task={edit} parts={parts ?? []} onClose={() => setEdit(null)} />}
    </>
  );
}

function TaskModal({ task, parts, onClose }: { task: MaintenanceTask; parts: SparePart[]; onClose: () => void }) {
  const [t, setT] = useState(task);
  const set = (patch: Partial<MaintenanceTask>) => setT((x) => ({ ...x, ...patch }));
  const qtyOf = (id: string) => t.requiredParts.find((r) => r.sparePartId === id)?.quantity ?? 0;
  const setQty = (id: string, q: number) =>
    set({
      requiredParts: [
        ...t.requiredParts.filter((r) => r.sparePartId !== id),
        ...(q > 0 ? [{ sparePartId: id, quantity: q }] : []),
      ],
    });

  return (
    <Modal title={tr('Wartungsaufgabe')} onClose={onClose}>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          await data.tasks.save(t);
          onClose();
        }}
      >
        <Field label={tr('Aufgabe')}>
          <input
            type="text"
            value={t.title}
            onChange={(e) => set({ title: e.target.value })}
            placeholder={tr('z. B. Dichtung wechseln')}
            required
          />
        </Field>
        <div className="form-grid">
          <Field label={tr('Intervall – Anzahl')}>
            <input
              type="number"
              min={1}
              value={t.intervalValue}
              onChange={(e) => set({ intervalValue: Math.max(1, Number(e.target.value) || 1) })}
            />
          </Field>
          <Field label={tr('Intervall – Einheit')}>
            <select value={t.intervalUnit} onChange={(e) => set({ intervalUnit: e.target.value as IntervalUnit })}>
              {(Object.keys(INTERVAL_UNIT_LABELS) as IntervalUnit[]).map((u) => (
                <option key={u} value={u}>
                  {tr(INTERVAL_UNIT_LABELS[u][1])}
                </option>
              ))}
            </select>
          </Field>
        </div>
        <p className="small muted" style={{ marginTop: -6 }}>
          = {intervalLabel(t.intervalValue, t.intervalUnit)}
        </p>
        <Field label={tr('Beschreibung')}>
          <textarea value={t.description} onChange={(e) => set({ description: e.target.value })} />
        </Field>
        {parts.length > 0 && (
          <div className="field">
            <span>{tr('Benötigte Ersatzteile (für den Wartungsreport)')}</span>
            {parts.map((p) => (
              <div key={p.id} className="list-item" style={{ padding: '4px 0' }}>
                <span className="grow">{p.name}</span>
                <input
                  type="number"
                  min={0}
                  value={qtyOf(p.id)}
                  onChange={(e) => setQty(p.id, Math.max(0, Number(e.target.value) || 0))}
                  style={{ width: 90 }}
                  aria-label={`${tr('Menge')} ${p.name}`}
                />
              </div>
            ))}
          </div>
        )}
        <button className="btn btn-primary btn-block" type="submit">
          {tr('Speichern')}
        </button>
      </form>
    </Modal>
  );
}

// ---------------------------------------------------------------- spare parts

export function PartsEditor({ ownerType, ownerId, readOnly }: OwnerProps) {
  const parts = useData(() => loadOwned(data.spareParts, ownerType, ownerId), [ownerType, ownerId]);
  const suppliers = useData(() => data.suppliers.list(), []);
  const [edit, setEdit] = useState<SparePart | null>(null);
  const supplierName = (id: string | null) => suppliers?.find((s) => s.id === id)?.name ?? '–';

  return (
    <>
      {parts?.length === 0 && <Empty>{tr('Keine Ersatzteile.')}</Empty>}
      <ul className="list">
        {parts?.map((p) => (
          <li key={p.id} className="list-item">
            <div className="grow">
              <div className="title">{p.name}</div>
              <div className="small muted">
                {tr('Hersteller-Nr.')} <span className="mono">{p.manufacturerPartNumber || '–'}</span>{' '}
                {tr('· Bestell-Nr.')} <span className="mono">{p.supplierOrderNumber || '–'}</span> ·{' '}
                {supplierName(p.supplierId)}
              </div>
            </div>
            {!readOnly && (
              <>
                <button className="icon-btn" aria-label={tr('Bearbeiten')} onClick={() => setEdit(p)}>
                  <Icon name="edit" />
                </button>
                <button
                  className="icon-btn"
                  aria-label={tr('Löschen')}
                  onClick={() =>
                    confirm(tr('Ersatzteil „{{name}}“ löschen?', { name: p.name })) && data.spareParts.remove(p.id)
                  }
                >
                  <Icon name="trash" />
                </button>
              </>
            )}
          </li>
        ))}
      </ul>
      {!readOnly && (
        <button
          className="btn btn-block"
          onClick={() =>
            setEdit({
              id: uuid(),
              ownerType,
              ownerId,
              name: '',
              manufacturerPartNumber: '',
              supplierId: suppliers?.[0]?.id ?? null,
              supplierOrderNumber: '',
              notes: '',
            })
          }
        >
          <Icon name="plus" /> {tr('Ersatzteil hinzufügen')}
        </button>
      )}
      {edit && (
        <Modal title={tr('Ersatzteil')} onClose={() => setEdit(null)}>
          <PartForm
            part={edit}
            suppliers={suppliers ?? []}
            onSave={async (p) => {
              await data.spareParts.save(p);
              setEdit(null);
            }}
          />
        </Modal>
      )}
    </>
  );
}

function PartForm({
  part,
  suppliers,
  onSave,
}: {
  part: SparePart;
  suppliers: { id: string; name: string }[];
  onSave: (p: SparePart) => void;
}) {
  const [p, setP] = useState(part);
  const set = (patch: Partial<SparePart>) => setP((x) => ({ ...x, ...patch }));
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSave(p);
      }}
    >
      <Field label={tr('Bezeichnung')}>
        <input type="text" value={p.name} onChange={(e) => set({ name: e.target.value })} required />
      </Field>
      <div className="form-grid">
        <Field label={tr('Herstellerartikelnummer')}>
          <input
            type="text"
            value={p.manufacturerPartNumber}
            onChange={(e) => set({ manufacturerPartNumber: e.target.value })}
          />
        </Field>
        <Field label={tr('Bestellnummer beim Lieferanten')}>
          <input
            type="text"
            value={p.supplierOrderNumber}
            onChange={(e) => set({ supplierOrderNumber: e.target.value })}
          />
        </Field>
      </div>
      <Field
        label={tr('Lieferant')}
        hint={tr('Lieferanten werden unter „Lieferanten“ gepflegt (inkl. Bestell-E-Mail).')}
      >
        <select value={p.supplierId ?? ''} onChange={(e) => set({ supplierId: e.target.value || null })}>
          <option value="">{tr('– kein Lieferant –')}</option>
          {suppliers.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
      </Field>
      <Field label={tr('Hinweis')}>
        <input type="text" value={p.notes} onChange={(e) => set({ notes: e.target.value })} />
      </Field>
      <button className="btn btn-primary btn-block" type="submit">
        {tr('Speichern')}
      </button>
    </form>
  );
}

// ---------------------------------------------------------------- FAQ

export function FaqEditor({ ownerType, ownerId, readOnly }: OwnerProps) {
  const faqs = useData(
    () => loadOwned(data.faqs, ownerType, ownerId).then((l) => l.sort((a, b) => a.sort - b.sort)),
    [ownerType, ownerId],
  );
  const [edit, setEdit] = useState<Faq | null>(null);

  const move = async (i: number, dir: -1 | 1) => {
    if (!faqs) return;
    const list = [...faqs];
    const j = i + dir;
    if (j < 0 || j >= list.length) return;
    [list[i], list[j]] = [list[j], list[i]];
    await data.faqs.saveMany(list.map((f, k) => ({ ...f, sort: k })));
  };

  return (
    <>
      {faqs?.length === 0 && <Empty>{tr('Keine Fragen.')}</Empty>}
      {faqs?.map((f, i) => (
        <details key={f.id} className="acc">
          <summary>{f.question}</summary>
          <div className="acc-body">
            {f.answer}
            {!readOnly && (
              <div className="btn-row" style={{ marginTop: 10 }}>
                <button className="btn btn-sm" onClick={() => setEdit(f)}>
                  <Icon name="edit" size={18} /> {tr('Bearbeiten')}
                </button>
                <button
                  className="btn btn-sm"
                  onClick={() => move(i, -1)}
                  disabled={i === 0}
                  aria-label={tr('nach oben')}
                >
                  ↑
                </button>
                <button
                  className="btn btn-sm"
                  onClick={() => move(i, 1)}
                  disabled={i === faqs.length - 1}
                  aria-label={tr('nach unten')}
                >
                  ↓
                </button>
                <button
                  className="btn btn-sm btn-danger"
                  onClick={() => confirm(tr('Frage löschen?')) && data.faqs.remove(f.id)}
                >
                  <Icon name="trash" size={18} /> {tr('Löschen')}
                </button>
              </div>
            )}
          </div>
        </details>
      ))}
      {!readOnly && (
        <button
          className="btn btn-block"
          onClick={() => setEdit({ id: uuid(), ownerType, ownerId, question: '', answer: '', sort: faqs?.length ?? 0 })}
        >
          <Icon name="plus" /> {tr('Frage hinzufügen')}
        </button>
      )}
      {edit && <FaqModal faq={edit} onClose={() => setEdit(null)} />}
    </>
  );
}

function FaqModal({ faq, onClose }: { faq: Faq; onClose: () => void }) {
  const [f, setF] = useState(faq);
  return (
    <Modal title={tr('Frage & Antwort')} onClose={onClose}>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          await data.faqs.save(f);
          onClose();
        }}
      >
        <Field label={tr('Frage')}>
          <input type="text" value={f.question} onChange={(e) => setF({ ...f, question: e.target.value })} required />
        </Field>
        <Field label={tr('Antwort')}>
          <textarea value={f.answer} onChange={(e) => setF({ ...f, answer: e.target.value })} required />
        </Field>
        <button className="btn btn-primary btn-block" type="submit">
          {tr('Speichern')}
        </button>
      </form>
    </Modal>
  );
}
