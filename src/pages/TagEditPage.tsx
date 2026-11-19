import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useData } from '../app/hooks';
import { useSession } from '../app/session';
import { Icon } from '../components/Icon';
import { FaqEditor, PartsEditor, TasksEditor } from '../components/OwnedEditors';
import { Empty, Field, toast } from '../components/ui';
import { data } from '../data';
import type { Product, Tag } from '../data/types';
import { isUuid, normalizeKey } from '../lib/util';
import { applyProduct, deleteTag, emptyTag, findProduct, saveTag } from '../services/tags';
import { tr } from '../i18n';

const TYPES = [
  'Handventil',
  'Regelventil',
  'Pumpe',
  'Filter',
  'Behälter',
  'Wärmetauscher',
  'Messgerät',
  'Motor',
  'Klappe',
];

export function TagEditPage() {
  const { id } = useParams();
  const [params] = useSearchParams();
  const isNew = !id;
  const existing = useData(() => (id ? data.tags.get(id) : Promise.resolve(undefined)), [id]);

  if (!isNew && existing === undefined) return <Empty>{tr('Lädt …')}</Empty>;
  const presetId = params.get('id');
  const initial = existing ?? emptyTag(presetId && isUuid(presetId) ? presetId.toLowerCase() : undefined);
  return <TagForm key={initial.id} initial={initial} isNew={isNew} />;
}

function TagForm({ initial, isNew }: { initial: Tag; isNew: boolean }) {
  const { can } = useSession();
  const navigate = useNavigate();
  const [tag, setTag] = useState<Tag>(initial);
  const [detected, setDetected] = useState<Product | null>(null);
  const [error, setError] = useState('');
  const plants = useData(
    () => data.tags.list().then((l) => [...new Set(l.map((t) => t.plant).filter(Boolean))].sort()),
    [],
  );
  const linked = useData(
    () => (tag.productId ? data.products.get(tag.productId) : Promise.resolve(undefined)),
    [tag.productId],
  );

  const set = (patch: Partial<Tag>) => setTag((t) => ({ ...t, ...patch }));

  // "Produkt erkannt": look up the catalog whenever article number / manufacturer change.
  useEffect(() => {
    let alive = true;
    const t = setTimeout(async () => {
      const p = await findProduct(tag.articleNumber, tag.manufacturer);
      if (!alive) return;
      if (p && p.id !== tag.productId) {
        setDetected(p);
        setTag((cur) => applyProduct(cur, p)); // automatic takeover of all template data
      } else if (!p && tag.productId) {
        setTag((cur) => ({ ...cur, productId: null }));
        setDetected(null);
      }
    }, 300);
    return () => {
      alive = false;
      clearTimeout(t);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tag.articleNumber, tag.manufacturer]);

  if (!can('edit')) return <Empty>{tr('Nur Bearbeiter und Administratoren können Tags bearbeiten.')}</Empty>;

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!tag.tagNumber.trim()) return setError(tr('Bitte eine Tag-Nummer eingeben.'));
    const dup = (await data.tags.list()).find(
      (t) => t.id !== tag.id && normalizeKey(t.tagNumber) === normalizeKey(tag.tagNumber),
    );
    if (dup) return setError(tr('Die Tag-Nummer {{n}} gibt es schon.', { n: dup.tagNumber }));
    await saveTag(tag);
    toast(isNew ? tr('Tag angelegt') : tr('Gespeichert'));
    navigate(`/t/${tag.id}`, { replace: true });
  };

  return (
    <div className="narrow">
      <div className="page-head">
        <Link to={isNew ? '/tags' : `/t/${tag.id}`} className="btn btn-sm" aria-label={tr('Zurück')}>
          <Icon name="back" size={18} />
        </Link>
        <h1>{isNew ? tr('Neuer Tag') : tr('{{n}} bearbeiten', { n: initial.tagNumber })}</h1>
      </div>

      <form onSubmit={save}>
        <section className="card">
          <div className="form-grid">
            <Field label={tr('Tag-Nummer *')}>
              <input
                type="text"
                value={tag.tagNumber}
                onChange={(e) => set({ tagNumber: e.target.value.toUpperCase() })}
                placeholder={tr('z. B. HV-1001')}
                autoCapitalize="characters"
                required
              />
            </Field>
            <Field label={tr('Typ')}>
              <input type="text" list="types" value={tag.type} onChange={(e) => set({ type: e.target.value })} />
              <datalist id="types">
                {TYPES.map((t) => (
                  <option key={t} value={t} />
                ))}
              </datalist>
            </Field>
            <Field label={tr('Hersteller')}>
              <input type="text" value={tag.manufacturer} onChange={(e) => set({ manufacturer: e.target.value })} />
            </Field>
            <Field label={tr('Artikelnummer')} hint={tr('Bekannte Artikelnummern werden im Produktkatalog erkannt.')}>
              <input type="text" value={tag.articleNumber} onChange={(e) => set({ articleNumber: e.target.value })} />
            </Field>

            {(detected || linked) && (
              <div className="alert full" style={{ gridColumn: '1 / -1' }}>
                <Icon name="check" />
                <div>
                  <div className="title">
                    {detected ? tr('Produkt erkannt') : tr('Verknüpft mit Produktvorlage')}:{' '}
                    {(detected ?? linked)!.manufacturer} {(detected ?? linked)!.articleNumber} –{' '}
                    {(detected ?? linked)!.name}
                  </div>
                  <div className="small">
                    {tr(
                      tr(
                        'Dokumente, FAQ, Wartungsaufgaben, Ersatzteile und Support-Kontakt werden aus der Vorlage übernommen. Spätere Änderungen an der Vorlage gelten automatisch auch für diesen Tag.',
                      ),
                    )}
                  </div>
                </div>
              </div>
            )}

            <Field label={tr('Bezeichnung / Funktion')} full>
              <input type="text" value={tag.description} onChange={(e) => set({ description: e.target.value })} />
            </Field>
            <Field label={tr('Anlage')}>
              <input
                type="text"
                list="plants"
                value={tag.plant}
                onChange={(e) => set({ plant: e.target.value })}
                placeholder={tr('z. B. Wasseraufbereitung')}
              />
              <datalist id="plants">
                {plants?.map((p) => (
                  <option key={p} value={p} />
                ))}
              </datalist>
            </Field>
            <Field label={tr('Standort')}>
              <input type="text" value={tag.location} onChange={(e) => set({ location: e.target.value })} />
            </Field>
            <Field
              label={tr('Bestellnummer (Bauteil)')}
              hint={linked?.orderNumber ? tr('leer = aus Vorlage: {{n}}', { n: linked.orderNumber }) : undefined}
            >
              <input type="text" value={tag.orderNumber} onChange={(e) => set({ orderNumber: e.target.value })} />
            </Field>
            <Field label={tr('Inbetriebnahme')} hint={tr('Startdatum für Wartungsintervalle ohne bisherigen Eintrag')}>
              <input type="date" value={tag.commissionedAt} onChange={(e) => set({ commissionedAt: e.target.value })} />
            </Field>
            <Field label={tr('Notizen')} full>
              <textarea value={tag.notes} onChange={(e) => set({ notes: e.target.value })} />
            </Field>
          </div>
        </section>

        <section className="card">
          <h2>{tr('Support-Kontakt')}</h2>
          <p className="small muted">
            {tr('Leer lassen = Kontakt aus der Produktvorlage')}
            {linked?.supportEmail || linked?.supportPhone ? ` (${linked.supportName || linked.supportEmail})` : ''}.
          </p>
          <div className="form-grid">
            <Field label={tr('Name / Firma')} full>
              <input type="text" value={tag.supportName} onChange={(e) => set({ supportName: e.target.value })} />
            </Field>
            <Field label={tr('E-Mail')}>
              <input type="email" value={tag.supportEmail} onChange={(e) => set({ supportEmail: e.target.value })} />
            </Field>
            <Field label={tr('Telefon')}>
              <input type="tel" value={tag.supportPhone} onChange={(e) => set({ supportPhone: e.target.value })} />
            </Field>
          </div>
        </section>

        {error && (
          <div className="alert overdue">
            <div>{error}</div>
          </div>
        )}
        <button className="btn btn-primary btn-lg btn-block" type="submit">
          <Icon name="check" /> {isNew ? tr('Tag anlegen') : tr('Speichern')}
        </button>
      </form>

      {!isNew && (
        <>
          <h2 style={{ marginTop: 32 }}>{tr('Zusätzlich nur für diesen Tag')}</h2>
          <p className="small muted">
            {tr('Ergänzt die Daten aus der Produktvorlage – z. B. für Bauteile ohne Vorlage.')}
          </p>
          <section className="card">
            <h3>{tr('Wartungsaufgaben')}</h3>
            <TasksEditor ownerType="tag" ownerId={tag.id} productId={tag.productId} />
          </section>
          <section className="card">
            <h3>{tr('Ersatzteile')}</h3>
            <PartsEditor ownerType="tag" ownerId={tag.id} />
          </section>
          <section className="card">
            <h3>{tr('FAQ')}</h3>
            <FaqEditor ownerType="tag" ownerId={tag.id} />
          </section>
          {can('admin') && (
            <button
              className="btn btn-danger btn-block"
              onClick={async () => {
                if (!confirm(tr('Tag {{n}} mit Tagebuch und Dokumenten löschen?', { n: initial.tagNumber }))) return;
                await deleteTag(tag.id);
                toast(tr('Tag gelöscht'));
                navigate('/tags', { replace: true });
              }}
            >
              <Icon name="trash" /> {tr('Tag löschen')}
            </button>
          )}
        </>
      )}
    </div>
  );
}
