import { useEffect, useRef } from 'react';
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';
import { useData } from '../app/hooks';
import { useSession } from '../app/session';
import { ROLE_LABELS } from '../data/types';
import { loadAllTaskStatuses } from '../services/maintenance';
import { HeaderSearch } from './HeaderSearch';
import { Icon, type IconName } from './Icon';
import { ToastHost } from './ui';

interface NavItem {
  to: string;
  label: string;
  icon: IconName;
  admin?: boolean;
}

const FIELD: NavItem[] = [
  { to: '/', label: 'Übersicht', icon: 'report' },
  { to: '/scan', label: 'Scannen', icon: 'scan' },
  { to: '/hinweise', label: 'Hinweise', icon: 'bell' },
];
const MANAGE: NavItem[] = [
  { to: '/tags', label: 'Tags', icon: 'tag' },
  { to: '/katalog', label: 'Produktkatalog', icon: 'book' },
  { to: '/lieferanten', label: 'Lieferanten', icon: 'truck' },
  { to: '/etiketten', label: 'QR-Etiketten', icon: 'qr' },
  { to: '/import', label: 'CSV-Import', icon: 'upload', admin: true },
  { to: '/report', label: 'Wartungsreport', icon: 'calendar' },
];
const MOBILE: NavItem[] = [
  { to: '/scan', label: 'Scannen', icon: 'scan' },
  { to: '/tags', label: 'Tags', icon: 'list' },
  { to: '/hinweise', label: 'Hinweise', icon: 'bell' },
  { to: '/report', label: 'Report', icon: 'report' },
  { to: '/einstellungen', label: 'Mehr', icon: 'settings' },
];

export function Layout() {
  const { user, can } = useSession();
  const statuses = useData(() => loadAllTaskStatuses(), []);
  const alertCount = statuses?.filter((s) => s.status !== 'ok').length ?? 0;
  const visible = (n: NavItem) => !n.admin || can('admin');

  // Only the content area scrolls – jump back to the top on every page change.
  const scrollRef = useRef<HTMLElement>(null);
  const { pathname } = useLocation();
  useEffect(() => {
    scrollRef.current?.scrollTo(0, 0);
  }, [pathname]);

  const link = (n: NavItem) => (
    <NavLink key={n.to} to={n.to} end={n.to === '/'}>
      <Icon name={n.icon} size={22} />
      <span>{n.label}</span>
      {n.to === '/hinweise' && alertCount > 0 && <span className="badge-count">{alertCount}</span>}
    </NavLink>
  );

  return (
    <div className="app">
      <header className="topbar">
        <Link to="/" className="brand" aria-label="Tagnera Startseite">
          <img src={`${import.meta.env.BASE_URL}favicon.svg`} alt="" />
          <span>
            Tag<span className="accent">nera</span>
          </span>
        </Link>
        <HeaderSearch />
        <div className="spacer" />
        {user && (
          <Link to="/einstellungen" className="who" style={{ textDecoration: 'none', color: '#fff' }}>
            {user.name}
            <br />
            <span style={{ color: 'var(--accent)' }}>{ROLE_LABELS[user.role]}</span>
          </Link>
        )}
        <Link to="/hinweise" className="icon-btn" aria-label="Hinweise">
          <Icon name="bell" />
          {alertCount > 0 && <span className="badge-count">{alertCount}</span>}
        </Link>
      </header>

      <nav className="sidebar" aria-label="Hauptnavigation">
        <div className="group">Feld</div>
        {FIELD.filter(visible).map(link)}
        <div className="group">Verwaltung</div>
        {MANAGE.filter(visible).map(link)}
        <div className="group">System</div>
        {link({ to: '/einstellungen', label: 'Einstellungen', icon: 'settings' })}
      </nav>

      <main className="scroll" ref={scrollRef}>
        <div className="content">
          <Outlet />
        </div>
      </main>

      <nav className="bottomnav" aria-label="Navigation">
        {MOBILE.map(link)}
      </nav>
      <ToastHost />
    </div>
  );
}
