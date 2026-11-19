import { Link, useNavigate } from 'react-router-dom';
import { useData } from '../app/hooks';
import { useSession } from '../app/session';
import { Icon } from '../components/Icon';
import { Empty } from '../components/ui';
import { data } from '../data';
import { byString } from '../lib/util';
import { emptyProduct } from '../services/tags';
import { tr } from '../i18n';

/** Product catalog: templates identified by manufacturer + article number. */
export function ProductsPage() {
  const { can } = useSession();
  const navigate = useNavigate();
  const rows = useData(async () => {
    const [products, tags] = await Promise.all([data.products.list(), data.tags.list()]);
    return products
      .sort(byString((p) => p.manufacturer + p.articleNumber))
      .map((p) => ({ p, count: tags.filter((t) => t.productId === p.id).length }));
  }, []);

  return (
    <div className="narrow">
      <div className="page-head">
        <h1>{tr('Produktkatalog')}</h1>
        {can('admin') && (
          <button
            className="btn btn-primary"
            onClick={async () => {
              const p = emptyProduct();
              await data.products.save(p);
              navigate(`/katalog/${p.id}`);
            }}
          >
            <Icon name="plus" /> {tr('Neue Produktvorlage')}
          </button>
        )}
      </div>
      <p className="muted small">
        {tr(
          tr(
            'Hersteller + Artikelnummer bilden eine Produktvorlage. Wird beim Anlegen eines Tags eine bekannte Artikelnummer eingegeben, übernimmt der Tag automatisch Dokumente, FAQ, Wartungsaufgaben und Ersatzteile der Vorlage.',
          ),
        )}
      </p>
      {rows?.length === 0 && <Empty>{tr('Noch keine Produktvorlagen.')}</Empty>}
      <div className="card" style={{ padding: '4px 16px' }}>
        <ul className="list">
          {rows?.map(({ p, count }) => (
            <li key={p.id}>
              <Link className="list-item" to={`/katalog/${p.id}`}>
                <Icon name="book" />
                <div className="grow">
                  <div className="title">
                    {p.manufacturer || tr('(Hersteller fehlt)')} {p.articleNumber}
                  </div>
                  <div className="small muted">
                    {p.name} {p.type && `· ${p.type}`}
                  </div>
                </div>
                <span className="pill">{count} Tags</span>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
