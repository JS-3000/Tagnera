import { useRef, useState } from 'react';
import { useSession } from '../app/session';
import { Icon } from '../components/Icon';
import { Field, toast } from '../components/ui';
import { data } from '../data';
import { ROLE_LABELS, type Role, type User } from '../data/types';
import { uuid } from '../lib/util';
import { exportAll, importAll } from '../services/backup';
import { loadDemoData } from '../services/demoData';
import { currentAppUrl, loadSettings, saveSettings } from '../services/settings';

export function SettingsPage() {
  const { user, users, can, switchUser } = useSession();
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const [qrBase, setQrBase] = useState(loadSettings().qrBaseUrl);

  const run = async (fn: () => Promise<unknown>, okMsg: string) => {
    setBusy(true);
    try {
      await fn();
      toast(okMsg);
    } catch (e) {
      alert('Fehler: ' + (e instanceof Error ? e.message : String(e)));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <div className="page-head">
        <h1>Einstellungen</h1>
      </div>
      <div className="card-grid">
        <section className="card">
          <h2>Benutzer & Rolle</h2>
          <p className="muted small">
            Prototyp ohne echten Login: Wähle hier, als wer du die App bedienst. Die Oberfläche blendet Funktionen je
            nach Rolle aus.
          </p>
          <div className="segmented" role="radiogroup" aria-label="Benutzer">
            {users.map((u) => (
              <button key={u.id} className={u.id === user?.id ? 'on' : ''} onClick={() => switchUser(u.id)}>
                {u.name}
                <br />
                <span className="small" style={{ fontWeight: 500 }}>
                  {ROLE_LABELS[u.role]}
                </span>
              </button>
            ))}
          </div>
          <ul className="small muted" style={{ marginBottom: 0 }}>
            <li>
              <b>Leser:</b> nur ansehen
            </li>
            <li>
              <b>Bearbeiter:</b> Tagebuch, Wartungen, Bestellungen, Tags anlegen
            </li>
            <li>
              <b>Administrator:</b> alles inkl. Katalog, Lieferanten, Import und Benutzerverwaltung
            </li>
          </ul>
        </section>

        {can('admin') && <UserAdmin users={users} />}

        <section className="card">
          <h2>Daten</h2>
          <p className="muted small">
            Alle Daten liegen nur in diesem Browser auf diesem Gerät. Mit Export/Import überträgst du sie auf ein
            anderes Gerät.
          </p>
          <div className="actions">
            <button className="btn" disabled={busy} onClick={() => run(exportAll, 'Export erstellt')}>
              <Icon name="download" /> Daten exportieren
            </button>
            {can('admin') && (
              <>
                <button className="btn" disabled={busy} onClick={() => fileRef.current?.click()}>
                  <Icon name="upload" /> Daten importieren
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
                    if (!confirm('Import ersetzt ALLE Daten auf diesem Gerät. Fortfahren?')) return;
                    void run(async () => {
                      const r = await importAll(f);
                      toast(`${r.tags} Tags importiert`);
                    }, 'Import abgeschlossen');
                  }}
                />
              </>
            )}
            {can('admin') && (
              <>
                <button
                  className="btn btn-primary"
                  disabled={busy}
                  onClick={() => {
                    if (!confirm('Demo-Daten laden? Vorhandene Daten auf diesem Gerät werden gelöscht.')) return;
                    void run(loadDemoData, 'Demo-Daten geladen');
                  }}
                >
                  <Icon name="list" /> Demo-Daten laden
                </button>
                <button
                  className="btn btn-danger"
                  disabled={busy}
                  onClick={() => {
                    if (!confirm('Wirklich ALLE Daten auf diesem Gerät löschen?')) return;
                    void run(() => data.clearAll(), 'Alle Daten gelöscht');
                  }}
                >
                  <Icon name="trash" /> Alles löschen
                </button>
              </>
            )}
          </div>
        </section>

        <section className="card">
          <h2>QR-Code-Adresse</h2>
          <p className="muted small">
            Diese Adresse steht in jedem QR-Code. Leer lassen = aktuelle Adresse der App (
            <span className="mono">{currentAppUrl()}</span>). Wichtig, wenn du Etiketten lokal druckst, die App aber
            über GitHub Pages nutzt.
          </p>
          <Field label="Basis-URL für QR-Codes">
            <input
              type="url"
              placeholder="https://js-3000.github.io/Tagnera/"
              value={qrBase}
              onChange={(e) => setQrBase(e.target.value)}
              onBlur={() => saveSettings({ qrBaseUrl: qrBase.trim() })}
            />
          </Field>
        </section>

        <section className="card">
          <h2>Über</h2>
          <p style={{ margin: 0 }}>
            <b>Tagnera</b> – brings your tag a level up. Prototyp-Version {__APP_VERSION__}.
          </p>
        </section>
      </div>
    </div>
  );
}

function UserAdmin({ users }: { users: User[] }) {
  const [name, setName] = useState('');
  const [role, setRole] = useState<Role>('editor');
  const update = (u: User, patch: Partial<User>) => data.users.save({ ...u, ...patch });

  return (
    <section className="card">
      <h2>Benutzerverwaltung</h2>
      <ul className="list">
        {users.map((u) => (
          <li key={u.id} className="list-item">
            <input
              className="grow"
              type="text"
              defaultValue={u.name}
              onBlur={(e) => e.target.value.trim() && update(u, { name: e.target.value.trim() })}
              aria-label="Name"
            />
            <select
              value={u.role}
              onChange={(e) => update(u, { role: e.target.value as Role })}
              style={{ width: 160 }}
              aria-label="Rolle"
            >
              {Object.entries(ROLE_LABELS).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
            <button
              className="icon-btn"
              aria-label="Benutzer löschen"
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
          placeholder="Name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          aria-label="Name des neuen Benutzers"
        />
        <select value={role} onChange={(e) => setRole(e.target.value as Role)} aria-label="Rolle des neuen Benutzers">
          {Object.entries(ROLE_LABELS).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </select>
        <button className="btn btn-dark" type="submit">
          <Icon name="plus" /> Hinzufügen
        </button>
      </form>
    </section>
  );
}
