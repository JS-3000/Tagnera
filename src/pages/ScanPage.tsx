import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useData } from '../app/hooks';
import { useSession } from '../app/session';
import { Icon } from '../components/Icon';
import { Logo } from '../components/Logo';
import { QrScanner } from '../components/QrScanner';
import { Empty, StatusBadge } from '../components/ui';
import { data } from '../data';
import type { Tag } from '../data/types';
import { loadAllTaskStatuses, worstStatus, type MaintStatus } from '../services/maintenance';
import { loadSettings, parseScannedText } from '../services/settings';
import { markScanned } from '../services/scanProof';
import { searchTags } from '../services/tags';
import { tr } from '../i18n';

export function ScanPage() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const { can } = useSession();
  // Start the camera automatically if it worked before on this device or "?scan=1" is set.
  const [active, setActive] = useState(() => params.get('scan') === '1' || loadSettings().recentTagIds.length > 0);
  const [attempt, setAttempt] = useState(0);
  const [foreign, setForeign] = useState<string | null>(null);
  const [query, setQuery] = useState('');

  const tagCount = useData(() => data.tags.list().then((l) => l.length), []);
  const recent = useData(async () => {
    const ids = loadSettings().recentTagIds;
    const [tags, statuses] = await Promise.all([
      Promise.all(ids.map((id) => data.tags.get(id))),
      loadAllTaskStatuses(),
    ]);
    return tags
      .filter((t): t is Tag => !!t)
      .map((t) => {
        const own = statuses.filter((s) => s.tag.id === t.id);
        return { tag: t, status: own.length ? worstStatus(own) : null };
      });
  }, []);
  const results = useData(() => (query.trim() ? searchTags(query) : Promise.resolve([])), [query]);

  // Stop the camera when the app goes to the background.
  useEffect(() => {
    const onVis = () => document.hidden && setActive(false);
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, []);

  const onResult = (text: string) => {
    const id = parseScannedText(text);
    if (id) {
      setActive(false);
      markScanned(id);
      navigate(`/t/${id}`);
    } else {
      setForeign(text);
      setActive(false);
    }
  };

  const start = () => {
    setForeign(null);
    setActive(true);
    setAttempt((a) => a + 1);
  };

  const openByQuery = async () => {
    const list = await searchTags(query);
    if (list.length === 1) navigate(`/t/${list[0].id}`);
  };

  return (
    <div className="narrow" style={{ maxWidth: 640 }}>
      {tagCount === 0 && (
        <div className="alert info">
          <div>
            <div className="title">{tr('Noch keine Daten auf diesem Gerät')}</div>
            {can('admin') ? (
              <>
                {tr('Stelle in den')} <Link to="/einstellungen">{tr('Einstellungen')}</Link>{' '}
                {tr('die Demo wieder her („Demo zurücksetzen“) oder lege unter')} <Link to="/tags">{tr('Tags')}</Link>{' '}
                {tr('den ersten Tag an.')}
              </>
            ) : (
              <>{tr('In den Einstellungen stellt „Demo zurücksetzen“ die Demo wieder her.')}</>
            )}
          </div>
        </div>
      )}

      <div className="scan-brand">
        <Logo showSlogan size={26} />
      </div>
      <QrScanner key={attempt} active={active} onResult={onResult} onStart={start} />

      {foreign && (
        <div className="alert due">
          <div>
            <div className="title">{tr('Kein ConnecTag-Code')}</div>
            <div className="small" style={{ wordBreak: 'break-all' }}>
              {tr('Inhalt:')} {foreign}
            </div>
          </div>
        </div>
      )}

      {!active && (
        <button className="btn btn-primary btn-lg btn-block" onClick={start} style={{ marginBottom: 16 }}>
          <Icon name="scan" size={28} /> {tr('Nächstes Bauteil scannen')}
        </button>
      )}

      <section className="card">
        <h2>{tr('Tag-Nummer suchen')}</h2>
        <form
          className="searchbar"
          onSubmit={(e) => {
            e.preventDefault();
            void openByQuery();
          }}
        >
          <input
            type="search"
            inputMode="search"
            autoCapitalize="characters"
            placeholder={tr('z. B. HV-1001')}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label={tr('Tag-Nummer')}
          />
          <button className="btn btn-dark" type="submit" aria-label={tr('Suchen')}>
            <Icon name="search" />
          </button>
        </form>
        {query.trim() && results && (
          <ul className="list" style={{ marginTop: 8 }}>
            {results.slice(0, 8).map((t) => (
              <li key={t.id}>
                <Link className="list-item" to={`/t/${t.id}`}>
                  <div className="grow">
                    <div className="title">{t.tagNumber}</div>
                    <div className="small muted">
                      {t.type} · {t.plant}
                    </div>
                  </div>
                  <Icon name="back" className="flip" />
                </Link>
              </li>
            ))}
            {results.length === 0 && <Empty>{tr('Kein Tag gefunden.')}</Empty>}
          </ul>
        )}
      </section>

      <section className="card">
        <h2>{tr('Zuletzt gescannt')}</h2>
        {recent && recent.length > 0 ? <RecentList items={recent} /> : <Empty>{tr('Noch nichts gescannt.')}</Empty>}
      </section>
    </div>
  );
}

function RecentList({ items }: { items: { tag: Tag; status: MaintStatus | null }[] }) {
  return (
    <ul className="list">
      {items.map(({ tag, status }) => (
        <li key={tag.id}>
          <Link className="list-item" to={`/t/${tag.id}`}>
            <Icon name="tag" />
            <div className="grow">
              <div className="title">{tag.tagNumber}</div>
              <div className="small muted">
                {tag.type}
                {tag.plant && ` · ${tag.plant}`}
              </div>
            </div>
            <StatusBadge status={status} />
          </Link>
        </li>
      ))}
    </ul>
  );
}
