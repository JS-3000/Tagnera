import { useEffect, useRef } from 'react';
import { Link, Navigate, NavLink, Outlet, useLocation } from 'react-router-dom';
import { useData, useOnline, useTitle } from '../app/hooks';
import { useSession } from '../app/session';
import { ROLE_LABELS } from '../data/types';
import { data } from '../data';
import { loadAllTaskStatuses } from '../services/maintenance';
import { HeaderSearch } from './HeaderSearch';
import { Icon, type IconName } from './Icon';
import { Logo } from './Logo';
import { ToastHost } from './ui';
import { tr } from '../i18n';

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
  { to: '/meldungen', label: 'Meldungen', icon: 'mail', admin: true },
];
const MANAGE: NavItem[] = [
  { to: '/tags', label: 'Tags', icon: 'tag' },
  { to: '/katalog', label: 'Produktkatalog', icon: 'book' },
  { to: '/lieferanten', label: 'Lieferanten', icon: 'truck' },
  { to: '/etiketten', label: 'QR-Etiketten', icon: 'qr' },
  { to: '/import', label: 'CSV-Import', icon: 'upload', admin: true },
  { to: '/report', label: 'Wartungsreport', icon: 'report' },
  { to: '/kalender', label: 'Wartungskalender', icon: 'calendar' },
];
const MOBILE: NavItem[] = [
  { to: '/scan', label: 'Scannen', icon: 'scan' },
  { to: '/tags', label: 'Tags', icon: 'list' },
  { to: '/hinweise', label: 'Hinweise', icon: 'bell' },
  { to: '/report', label: 'Report', icon: 'report' },
  { to: '/einstellungen', label: 'Mehr', icon: 'settings' },
];
// administrators: "Meldungen" instead of "Hinweise" (those stay reachable via the bell)
const MOBILE_ADMIN: NavItem[] = [
  MOBILE[0],
  MOBILE[1],
  { to: '/meldungen', label: 'Meldungen', icon: 'mail' },
  MOBILE[3],
  MOBILE[4],
];
// without account
const PUBLIC_NAV: NavItem[] = [
  { to: '/scan', label: 'Scannen', icon: 'scan' },
  { to: '/anmelden', label: 'Anmelden', icon: 'users' },
];

/** pages that can be opened without an account */
const isPublicPath = (p: string) =>
  p === '/' || p === '/scan' || p === '/anmelden' || p === '/einstellungen' || /^\/t\/[^/]+(\/meldung)?$/.test(p);

export function Layout() {
  const { user, can, isPublic, ready } = useSession();
  const online = useOnline();
  const statuses = useData(() => loadAllTaskStatuses(), []);
  const alertCount = isPublic ? 0 : (statuses?.filter((s) => s.status !== 'ok').length ?? 0);
  const newIssues = useData(() => data.issues.findBy('status', 'new').then((l) => l.length), []) ?? 0;
  const visible = (n: NavItem) => !n.admin || can('admin');

  // Only the content area scrolls – jump back to the top on every page change.
  const scrollRef = useRef<HTMLElement>(null);
  const { pathname } = useLocation();
  useEffect(() => {
    scrollRef.current?.scrollTo(0, 0);
  }, [pathname]);
  const routeTitle = [
    ...FIELD,
    ...MANAGE,
    { to: '/einstellungen', label: 'Einstellungen' },
    { to: '/anmelden', label: 'Anmelden' },
  ].find((n) => n.to !== '/' && pathname.startsWith(n.to))?.label;
  useTitle(
    pathname.startsWith('/t/')
      ? undefined
      : routeTitle
        ? tr(routeTitle)
        : pathname === '/'
          ? tr('Übersicht')
          : undefined,
  );

  const link = (n: NavItem) => (
    <NavLink key={n.to} to={n.to} end={n.to === '/'}>
      <Icon name={n.icon} size={22} />
      <span>{tr(n.label)}</span>
      {n.to === '/hinweise' && alertCount > 0 && <span className="badge-count">{alertCount}</span>}
      {n.to === '/meldungen' && newIssues > 0 && <span className="badge-count">{newIssues}</span>}
    </NavLink>
  );

  // protected pages without login -> login page, then back
  if (ready && isPublic && !isPublicPath(pathname)) {
    return <Navigate to={`/anmelden?back=${encodeURIComponent(pathname)}`} replace />;
  }

  return (
    <div className="app">
      <header className="topbar">
        <Link to="/" className="brand" aria-label={tr('ConnecTag Startseite')}>
          <Logo variant="dark" size={30} />
        </Link>
        {!isPublic && <HeaderSearch />}
        <div className="spacer" />
        {!online && (
          <span
            className="offline-pill"
            role="status"
            title={tr('Keine Verbindung – die App arbeitet mit den Daten auf diesem Gerät.')}
          >
            {tr('Offline')}
          </span>
        )}
        {user && (
          <Link to="/einstellungen" className="who" style={{ textDecoration: 'none', color: '#fff' }}>
            <span className="who-name">
              {user.name}
              <br />
            </span>
            <span style={{ color: 'var(--accent)' }}>{ROLE_LABELS[user.role]}</span>
          </Link>
        )}
        {isPublic ? (
          <Link to={`/anmelden?back=${encodeURIComponent(pathname)}`} className="btn btn-sm btn-primary">
            {tr('Anmelden')}
          </Link>
        ) : (
          <Link to="/hinweise" className="icon-btn" aria-label={tr('Hinweise')}>
            <Icon name="bell" />
            {alertCount > 0 && <span className="badge-count">{alertCount}</span>}
          </Link>
        )}
      </header>

      <nav className="sidebar" aria-label={tr('Hauptnavigation')}>
        {isPublic ? (
          PUBLIC_NAV.map(link)
        ) : (
          <>
            <div className="group">{tr('Feld')}</div>
            {FIELD.filter(visible).map(link)}
            <div className="group">{tr('Verwaltung')}</div>
            {MANAGE.filter(visible).map(link)}
            <div className="group">{tr('System')}</div>
            {link({ to: '/einstellungen', label: 'Einstellungen', icon: 'settings' })}
          </>
        )}
      </nav>

      <main className="scroll" ref={scrollRef}>
        <div className="content">
          <Outlet />
        </div>
      </main>

      <nav className="bottomnav" aria-label={tr('Navigation')}>
        {(isPublic ? PUBLIC_NAV : can('admin') ? MOBILE_ADMIN : MOBILE).map(link)}
      </nav>
      <ToastHost />
    </div>
  );
}
