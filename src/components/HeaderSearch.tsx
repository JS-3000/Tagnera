// Desktop only: quick search for tags in the top bar (Enter opens the first hit).
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useData } from '../app/hooks';
import { searchTags } from '../services/tags';
import { Icon } from './Icon';

export function HeaderSearch() {
  const navigate = useNavigate();
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const hits = useData(() => (q.trim() ? searchTags(q).then((l) => l.slice(0, 8)) : Promise.resolve([])), [q]);

  const go = (id: string) => {
    setQ('');
    setOpen(false);
    navigate(`/t/${id}`);
  };

  return (
    <div className="header-search" role="search">
      <Icon name="search" size={18} />
      <input
        type="search"
        placeholder="Tag suchen … (z. B. HV-1001, Pumpe, Kieselmann)"
        value={q}
        onChange={(e) => {
          setQ(e.target.value);
          setOpen(true);
          setActive(0);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        onKeyDown={(e) => {
          if (!hits?.length) return;
          if (e.key === 'ArrowDown') setActive((a) => Math.min(a + 1, hits.length - 1));
          else if (e.key === 'ArrowUp') setActive((a) => Math.max(a - 1, 0));
          else if (e.key === 'Enter') go(hits[active].id);
          else if (e.key === 'Escape') setOpen(false);
        }}
        aria-label="Tag suchen"
      />
      {open && q.trim() && hits && (
        <div className="results">
          {hits.length === 0 && (
            <div className="muted small" style={{ padding: 10 }}>
              Kein Tag gefunden.
            </div>
          )}
          {hits.map((t, i) => (
            <a
              key={t.id}
              href={`#/t/${t.id}`}
              className={i === active ? 'on' : ''}
              onMouseDown={(e) => {
                e.preventDefault();
                go(t.id);
              }}
            >
              <Icon name="tag" size={18} />
              <b>{t.tagNumber}</b>
              <span className="muted small">
                {t.type} {t.plant && `· ${t.plant}`}
              </span>
            </a>
          ))}
        </div>
      )}
    </div>
  );
}
