import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useData } from '../app/hooks';
import { useSession } from '../app/session';
import { DocumentList } from '../components/Documents';
import { Icon } from '../components/Icon';
import { FaqEditor, PartsEditor, TasksEditor } from '../components/OwnedEditors';
import { Empty, Field, toast } from '../components/ui';
import { data } from '../data';
import type { Product } from '../data/types';
import { byString, nowIso } from '../lib/util';
import { deleteProduct, loadDocuments } from '../services/tags';

export function ProductPage() {
  const { id = '' } = useParams();
  const product = useData(() => data.products.get(id), [id]);
  if (product === undefined) return <Empty>Lädt … (oder Vorlage nicht gefunden)</Empty>;
  return <ProductView key={product.id} initial={product} />;
}

function ProductView({ initial }: { initial: Product }) {
  const { can } = useSession();
  const navigate = useNavigate();
  const admin = can('admin');
  const [p, setP] = useState(initial);
  const [dirty, setDirty] = useState(false);
  const suppliers = useData(() => data.suppliers.list(), []);
  const docs = useData(() => loadDocuments([{ ownerType: 'product', ownerId: p.id }]), [p.id]);
  const tags = useData(
    () => data.tags.findBy('productId', p.id).then((l) => l.sort(byString((t) => t.tagNumber))),
    [p.id],
  );
  const set = (patch: Partial<Product>) => {
    setP((x) => ({ ...x, ...patch }));
    setDirty(true);
  };

  return (
    <div>
      <div className="page-head">
        <Link to="/katalog" className="btn btn-sm" aria-label="Zurück">
          <Icon name="back" size={18} />
        </Link>
        <h1>
          {p.manufacturer || 'Neue Vorlage'} {p.articleNumber}
        </h1>
      </div>

      <form
        className="card product-form"
        onSubmit={async (e) => {
          e.preventDefault();
          await data.products.save({ ...p, updatedAt: nowIso() });
          setDirty(false);
          toast('Vorlage gespeichert');
        }}
      >
        <fieldset disabled={!admin} style={{ border: 0, padding: 0, margin: 0 }}>
          <div className="form-grid">
            <Field label="Hersteller *">
              <input
                type="text"
                value={p.manufacturer}
                onChange={(e) => set({ manufacturer: e.target.value })}
                required
              />
            </Field>
            <Field label="Artikelnummer *">
              <input
                type="text"
                value={p.articleNumber}
                onChange={(e) => set({ articleNumber: e.target.value })}
                required
              />
            </Field>
            <Field label="Bezeichnung">
              <input type="text" value={p.name} onChange={(e) => set({ name: e.target.value })} />
            </Field>
            <Field label="Typ">
              <input type="text" value={p.type} onChange={(e) => set({ type: e.target.value })} />
            </Field>
            <Field label="Beschreibung" full>
              <textarea value={p.description} onChange={(e) => set({ description: e.target.value })} />
            </Field>
            <Field label="Lieferant (Bauteil)">
              <select value={p.supplierId ?? ''} onChange={(e) => set({ supplierId: e.target.value || null })}>
                <option value="">–</option>
                {suppliers?.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Bestellnummer (Bauteil)">
              <input type="text" value={p.orderNumber} onChange={(e) => set({ orderNumber: e.target.value })} />
            </Field>
          </div>
          <h3>Support-Kontakt</h3>
          <div className="form-grid">
            <Field label="Name / Firma" full>
              <input type="text" value={p.supportName} onChange={(e) => set({ supportName: e.target.value })} />
            </Field>
            <Field label="E-Mail">
              <input type="email" value={p.supportEmail} onChange={(e) => set({ supportEmail: e.target.value })} />
            </Field>
            <Field label="Telefon">
              <input type="tel" value={p.supportPhone} onChange={(e) => set({ supportPhone: e.target.value })} />
            </Field>
          </div>
          {admin && (
            <button className="btn btn-primary btn-block" type="submit" disabled={!dirty}>
              <Icon name="check" /> {dirty ? 'Vorlage speichern' : 'Gespeichert'}
            </button>
          )}
        </fieldset>
      </form>

      <div className="card-grid">
        <section className="card">
          <h2>Dokumente</h2>
          <p className="small muted">
            Neue Versionen erscheinen bei allen verknüpften Tags als „Neue Version vom …“, die alte bleibt unter „Ältere
            Versionen“.
          </p>
          <DocumentList
            docs={docs ?? []}
            owner={{ ownerType: 'product', ownerId: p.id }}
            canAdd={admin}
            canManage={() => admin}
          />
        </section>
        <section className="card">
          <h2>Wartungsaufgaben</h2>
          <TasksEditor ownerType="product" ownerId={p.id} readOnly={!admin} />
        </section>
        <section className="card">
          <h2>Ersatzteile</h2>
          <PartsEditor ownerType="product" ownerId={p.id} readOnly={!admin} />
        </section>
        <section className="card">
          <h2>FAQ</h2>
          <FaqEditor ownerType="product" ownerId={p.id} readOnly={!admin} />
        </section>
        <section className="card">
          <h2>Verknüpfte Tags ({tags?.length ?? 0})</h2>
          {tags?.length === 0 && <Empty>Kein Tag nutzt diese Vorlage.</Empty>}
          <ul className="list">
            {tags?.map((t) => (
              <li key={t.id}>
                <Link className="list-item" to={`/t/${t.id}`}>
                  <b>{t.tagNumber}</b> <span className="muted">{t.description}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      </div>
      {admin && (
        <button
          className="btn btn-danger btn-block"
          onClick={async () => {
            if (!confirm('Vorlage löschen? Verknüpfte Tags bleiben erhalten, verlieren aber die Vorlagendaten.'))
              return;
            await deleteProduct(p.id);
            navigate('/katalog', { replace: true });
          }}
        >
          <Icon name="trash" /> Vorlage löschen
        </button>
      )}
    </div>
  );
}
