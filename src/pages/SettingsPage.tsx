import { useRef, useState } from 'react';
import { useSession } from '../app/session';
import { Icon } from '../components/Icon';
import { Columns } from '../components/Columns';
import { Logo } from '../components/Logo';
import { Field, toast } from '../components/ui';
import { data } from '../data';
import { ROLE_LABELS, type Role, type User } from '../data/types';
import { uuid } from '../lib/util';
import { exportAll, importAll } from '../services/backup';
import { DEMO_VERSION, resetDemo } from '../services/demoData';
import { currentAppUrl, loadSettings, saveSettings } from '../services/settings';
import { getLang, setLang, tr } from '../i18n';

export function SettingsPage() {
  const { user, users, can, switchUser, logout, isPublic } = useSession();
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const [qrBase, setQrBase] = useState(loadSettings().qrBaseUrl);

  const run = async (fn: () => Promise<unknown>, okMsg: string) => {
    setBusy(true);
    try {
      await fn();
      toast(okMsg);
    } catch (e) {
      alert(tr('Fehler: ') + (e instanceof Error ? e.message : String(e)));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <div className="page-head">
        <h1>{tr('Einstellungen')}</h1>
      </div>
      <Columns
        tiles={[
          {
            key: 'user',
            order: 1,
            col: 'left',
            node: (
              <section className="card">
                <h2>{tr('Benutzer & Rolle')}</h2>
                <p className="muted small">
                  {tr(
                    tr(
                      'Prototyp ohne echten Login: Wähle hier, als wer du die App bedienst. Die Oberfläche blendet Funktionen je nach Rolle aus.',
                    ),
                  )}
                </p>
                <div className="segmented" role="radiogroup" aria-label={tr('Benutzer')}>
                  {users.map((u) => (
                    <button key={u.id} className={u.id === user?.id ? 'on' : ''} onClick={() => switchUser(u.id)}>
                      {u.name}
                      <br />
                      <span className="small" style={{ fontWeight: 500 }}>
                        {ROLE_LABELS[u.role]}
                      </span>
                    </button>
                  ))}
                  <button className={isPublic ? 'on' : ''} onClick={logout}>
                    {tr('Öffentlich')}
                    <br />
                    <span className="small" style={{ fontWeight: 500 }}>
                      {tr('ohne Account')}
                    </span>
                  </button>
                </div>
                <ul className="small muted" style={{ marginBottom: 0 }}>
                  <li>
                    <b>{tr('Öffentlich (ohne Account):')}</b>{' '}
                    {tr('nach dem Scan nur Tag, Bezeichnung und „Störung melden“')}
                  </li>
                  <li>
                    <b>{tr('Leser:')}</b> {tr('nur ansehen')}
                  </li>
                  <li>
                    <b>{tr('Bearbeiter:')}</b> {tr('Tagebuch, Wartungen, Bestellungen, Tags anlegen')}
                  </li>
                  <li>
                    <b>{tr('Administrator:')}</b>{' '}
                    {tr('alles inkl. Katalog, Lieferanten, Import und Benutzerverwaltung')}
                  </li>
                </ul>
              </section>
            ),
          },
          {
            key: 'data',
            order: 3,
            col: 'left',
            node: (
              <section className="card">
                <h2>{tr('Daten')}</h2>
                <p className="muted small">
                  {tr(
                    tr(
                      'Alle Daten liegen nur in diesem Browser auf diesem Gerät – was du löschst oder änderst, betrifft nur dich. Die „Demoanlage ConnecTag“ (Demo-Version',
                    ),
                  )}{' '}
                  {DEMO_VERSION}
                  {tr(') wird automatisch geladen und lässt sich jederzeit zurücksetzen.')}
                </p>
                <div className="actions">
                  <button className="btn" disabled={busy} onClick={() => run(exportAll, tr('Export erstellt'))}>
                    <Icon name="download" /> {tr('Daten exportieren')}
                  </button>
                  {can('admin') && (
                    <>
                      <button className="btn" disabled={busy} onClick={() => fileRef.current?.click()}>
                        <Icon name="upload" /> {tr('Daten importieren')}
                      </button>
                      <input
                        ref={fileRef}
                        type="file"
                        accept="application/json,.json"
                        hidden
                        onChange={(e) => {
                          const f = e.target.files?.[0];
                          e.target.value = '';
                          if (!f) return;
                          if (!confirm(tr('Import ersetzt ALLE Daten auf diesem Gerät. Fortfahren?'))) return;
                          void run(async () => {
                            const r = await importAll(f);
                            toast(tr('{{n}} Tags importiert', { n: r.tags }));
                          }, tr('Import abgeschlossen'));
                        }}
                      />
                    </>
                  )}
                  <button
                    className="btn btn-primary"
                    disabled={busy}
                    onClick={() => {
                      if (
                        !confirm(
                          tr(
                            'Demo auf den Originalzustand zurücksetzen? Änderungen an den 10 Demo-Tags gehen verloren, eigene Tags bleiben erhalten.',
                          ),
                        )
                      )
                        return;
                      void run(resetDemo, tr('Demo zurückgesetzt'));
                    }}
                  >
                    <Icon name="back" /> {tr('Demo zurücksetzen')}
                  </button>
                  {can('admin') && (
                    <button
                      className="btn btn-danger"
                      disabled={busy}
                      onClick={() => {
                        if (
                          !confirm(
                            tr(
                              'Wirklich ALLE Daten auf diesem Gerät löschen? Die Demo wird beim nächsten Start neu geladen.',
                            ),
                          )
                        )
                          return;
                        void run(() => data.clearAll(), tr('Alle Daten gelöscht'));
                      }}
                    >
                      <Icon name="trash" /> {tr('Alles löschen')}
                    </button>
                  )}
                </div>
              </section>
            ),
          },
          {
            key: 'about',
            order: 5,
            col: 'left',
            node: (
              <section className="card">
                <h2>{tr('Über')}</h2>
                <p style={{ margin: 0 }}>
                  <Logo showSlogan size={36} />
                  <br />
                  <span className="small muted">
                    {tr('Prototyp-Version')} {__APP_VERSION__}
                  </span>
                </p>
              </section>
            ),
          },
          { key: 'admin', order: 2, col: 'right', node: can('admin') && <UserAdmin users={users} /> },
          {
            key: 'lang',
            order: 3,
            col: 'right',
            node: (
              <section className="card">
                <h2>{tr('Sprache')} / Language</h2>
                <div className="segmented" role="radiogroup" aria-label="Sprache / Language">
                  <button className={getLang() === 'de' ? 'on' : ''} onClick={() => setLang('de')}>
                    Deutsch
                  </button>
                  <button className={getLang() === 'en' ? 'on' : ''} onClick={() => setLang('en')}>
                    English
                  </button>
                </div>
                <p className="small muted" style={{ marginBottom: 0 }}>
                  {tr('Demo-Inhalte und Herstellerdokumente bleiben deutsch.')}
                </p>
              </section>
            ),
          },
          {
            key: 'qr',
            order: 4,
            col: 'right',
            node: (
              <section className="card">
                <h2>{tr('QR-Code-Adresse')}</h2>
                <p className="muted small">
                  {tr('Diese Adresse steht in jedem QR-Code. Leer lassen = aktuelle Adresse der App (')}
                  <span className="mono">{currentAppUrl()}</span>
                  {tr('). Wichtig, wenn du Etiketten lokal druckst, die App aber über GitHub Pages nutzt.')}
                </p>
                <Field label={tr('Basis-URL für QR-Codes')}>
                  <input
                    type="url"
                    placeholder={tr('https://js-3000.github.io/Tagnera/')}
                    value={qrBase}
                    onChange={(e) => setQrBase(e.target.value)}
                    onBlur={() => saveSettings({ qrBaseUrl: qrBase.trim() })}
                  />
                </Field>
              </section>
            ),
          },
        ]}
      />
    </div>
  );
}

function UserAdmin({ users }: { users: User[] }) {
  const [name, setName] = useState('');
  const [role, setRole] = useState<Role>('editor');
  const update = (u: User, patch: Partial<User>) => data.users.save({ ...u, ...patch });

  return (
    <section className="card">
      <h2>{tr('Benutzerverwaltung')}</h2>
      <ul className="list">
        {users.map((u) => (
          <li key={u.id} className="user-row">
            <input
              type="text"
              defaultValue={u.name}
              onBlur={(e) => e.target.value.trim() && update(u, { name: e.target.value.trim() })}
              aria-label={tr('Name')}
            />
            <select
              value={u.role}
              onChange={(e) => update(u, { role: e.target.value as Role })}
              aria-label={tr('Rolle')}
            >
              {Object.entries(ROLE_LABELS).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
            <button
              className="icon-btn"
              aria-label={tr('Benutzer löschen')}
              disabled={users.length <= 1}
              onClick={() => confirm(`${u.name} löschen?`) && data.users.remove(u.id)}
            >
              <Icon name="trash" />
            </button>
          </li>
        ))}
      </ul>
      <form
        className="inline-form"
        style={{ marginTop: 12 }}
        onSubmit={(e) => {
          e.preventDefault();
          if (!name.trim()) return;
          void data.users.save({ id: uuid(), name: name.trim(), role });
          setName('');
        }}
      >
        <input
          type="text"
          placeholder={tr('Name')}
          value={name}
          onChange={(e) => setName(e.target.value)}
          aria-label={tr('Name des neuen Benutzers')}
        />
        <select
          value={role}
          onChange={(e) => setRole(e.target.value as Role)}
          aria-label={tr('Rolle des neuen Benutzers')}
        >
          {Object.entries(ROLE_LABELS).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </select>
        <button className="btn btn-dark" type="submit">
          <Icon name="plus" /> {tr('Hinzufügen')}
        </button>
      </form>
    </section>
  );
}
