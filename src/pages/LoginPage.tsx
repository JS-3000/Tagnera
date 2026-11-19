// Simulated login (prototype): choose a demo user, no password.
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useSession } from '../app/session';
import { Icon } from '../components/Icon';
import { Logo } from '../components/Logo';
import { ROLE_LABELS, type Role } from '../data/types';
import { tr } from '../i18n';

const ROLE_INFO: Record<Role, string> = {
  admin: 'alles, inkl. Meldungen, Katalog und Benutzerverwaltung',
  editor: 'Tagebuch, Wartungen (nach Scan), Bestellungen',
  reader: 'nur ansehen',
};

export function LoginPage() {
  const { users, switchUser } = useSession();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const back = params.get('back') || '/';
  const order: Role[] = ['admin', 'editor', 'reader'];

  return (
    <div className="narrow" style={{ maxWidth: 560, margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'center', margin: '8px 0 20px' }}>
        <Logo showSlogan size={40} />
      </div>
      <section className="card">
        <h1>{tr('Anmelden (Demo)')}</h1>
        <p className="muted small">
          {tr(
            tr(
              'Im Prototyp gibt es keine Passwörter. Wähle einen Demo-Benutzer – später meldet man sich hier mit dem eigenen Account an.',
            ),
          )}
        </p>
        <div className="actions" style={{ gridTemplateColumns: '1fr' }}>
          {[...users]
            .sort((a, b) => order.indexOf(a.role) - order.indexOf(b.role))
            .map((u) => (
              <button
                key={u.id}
                className="btn btn-lg login-user"
                onClick={() => {
                  switchUser(u.id);
                  navigate(back, { replace: true });
                }}
              >
                <Icon name="users" />
                <span style={{ textAlign: 'left', flex: 1, whiteSpace: 'normal' }}>
                  {u.name} · <span style={{ color: 'var(--accent-dark)' }}>{ROLE_LABELS[u.role]}</span>
                  <br />
                  <span className="small muted" style={{ fontWeight: 500 }}>
                    {tr(ROLE_INFO[u.role])}
                  </span>
                </span>
              </button>
            ))}
        </div>
      </section>
      <p className="small muted" style={{ textAlign: 'center' }}>
        {tr('Ohne Anmeldung können Sie nach dem Scan eines QR-Codes eine Störung melden.')}
      </p>
    </div>
  );
}
