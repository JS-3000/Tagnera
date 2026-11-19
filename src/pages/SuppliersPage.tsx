import { useState } from 'react';
import { useData } from '../app/hooks';
import { useSession } from '../app/session';
import { Icon } from '../components/Icon';
import { Empty, Field, Modal } from '../components/ui';
import { data } from '../data';
import type { Supplier } from '../data/types';
import { byString, uuid } from '../lib/util';
import { tr } from '../i18n';

export function SuppliersPage() {
  const { can } = useSession();
  const suppliers = useData(() => data.suppliers.list().then((l) => l.sort(byString((s) => s.name))), []);
  const [edit, setEdit] = useState<Supplier | null>(null);

  return (
    <div className="narrow">
      <div className="page-head">
        <h1>{tr('Lieferanten')}</h1>
        {can('admin') && (
          <button
            className="btn btn-primary"
            onClick={() =>
              setEdit({ id: uuid(), name: '', orderEmail: '', phone: '', contactPerson: '', customerNumber: '' })
            }
          >
            <Icon name="plus" /> {tr('Neuer Lieferant')}
          </button>
        )}
      </div>
      {suppliers?.length === 0 && <Empty>{tr('Noch keine Lieferanten.')}</Empty>}
      <div className="card" style={{ padding: '4px 16px' }}>
        <ul className="list">
          {suppliers?.map((s) => (
            <li key={s.id} className="list-item">
              <Icon name="truck" />
              <div className="grow">
                <div className="title">{s.name}</div>
                <div className="small muted">
                  {tr('Bestellung:')} {s.orderEmail || '–'} {tr('· Tel.')} {s.phone || '–'}
                  {s.contactPerson && ` · ${s.contactPerson}`}
                  {s.customerNumber && ` · ${tr('Kd.-Nr.')} ${s.customerNumber}`}
                </div>
              </div>
              {can('admin') && (
                <>
                  <button className="icon-btn" aria-label={tr('Bearbeiten')} onClick={() => setEdit(s)}>
                    <Icon name="edit" />
                  </button>
                  <button
                    className="icon-btn"
                    aria-label={tr('Löschen')}
                    onClick={() => confirm(tr('{{name}} löschen?', { name: s.name })) && data.suppliers.remove(s.id)}
                  >
                    <Icon name="trash" />
                  </button>
                </>
              )}
            </li>
          ))}
        </ul>
      </div>
      {edit && <SupplierModal supplier={edit} onClose={() => setEdit(null)} />}
    </div>
  );
}

function SupplierModal({ supplier, onClose }: { supplier: Supplier; onClose: () => void }) {
  const [s, setS] = useState(supplier);
  const set = (patch: Partial<Supplier>) => setS((x) => ({ ...x, ...patch }));
  return (
    <Modal title={tr('Lieferant')} onClose={onClose}>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          await data.suppliers.save(s);
          onClose();
        }}
      >
        <Field label={tr('Name *')}>
          <input type="text" value={s.name} onChange={(e) => set({ name: e.target.value })} required />
        </Field>
        <Field label={tr('Bestell-E-Mail')} hint={tr('Empfänger für den Button „Bestellen“')}>
          <input type="email" value={s.orderEmail} onChange={(e) => set({ orderEmail: e.target.value })} />
        </Field>
        <div className="form-grid">
          <Field label={tr('Telefon')}>
            <input type="tel" value={s.phone} onChange={(e) => set({ phone: e.target.value })} />
          </Field>
          <Field label={tr('Ansprechpartner')}>
            <input type="text" value={s.contactPerson} onChange={(e) => set({ contactPerson: e.target.value })} />
          </Field>
          <Field label={tr('Unsere Kundennummer')}>
            <input type="text" value={s.customerNumber} onChange={(e) => set({ customerNumber: e.target.value })} />
          </Field>
        </div>
        <button className="btn btn-primary btn-block" type="submit">
          {tr('Speichern')}
        </button>
      </form>
    </Modal>
  );
}
