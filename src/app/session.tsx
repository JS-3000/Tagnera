// Simulated login: the current user is chosen on the login page / in the settings (no password).
// The UI asks `can('edit')` / `can('admin')` to show or hide functions.
// Without login (role 'public') a scan only shows tag + description and "Störung melden".

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { data } from '../data';
import type { Role, SessionRole, User } from '../data/types';
import { uuid } from '../lib/util';
import { loadSettings, saveSettings } from '../services/settings';
import { useData } from './hooks';

export type Permission = 'view' | 'edit' | 'admin';

const ALLOWED: Record<Role, Permission[]> = {
  reader: ['view'],
  editor: ['view', 'edit'],
  admin: ['view', 'edit', 'admin'],
};

interface Session {
  user: User | null; // null = not logged in (public)
  users: User[];
  role: SessionRole;
  isPublic: boolean;
  /** false while the user list is still loading */
  ready: boolean;
  can(p: Permission): boolean;
  switchUser(id: string): void;
  logout(): void;
}

const SessionContext = createContext<Session>({
  user: null,
  users: [],
  role: 'public',
  isPublic: true,
  ready: false,
  can: () => false,
  switchUser: () => {},
  logout: () => {},
});

export function SessionProvider({ children }: { children: ReactNode }) {
  const users = useData(() => data.users.list(), []);
  const [currentId, setCurrentId] = useState(() => loadSettings().currentUserId);
  const [loggedOut, setLoggedOut] = useState(() => !!loadSettings().loggedOut);

  // First start (or all users deleted): create a default administrator.
  useEffect(() => {
    if (users && users.length === 0) {
      // small delay: during "Demo-Daten laden" the table is briefly empty
      const t = setTimeout(async () => {
        if ((await data.users.list()).length === 0) {
          await data.users.save({ id: uuid(), name: 'Administrator', role: 'admin' });
        }
      }, 800);
      return () => clearTimeout(t);
    }
  }, [users]);

  const list = users ?? [];
  const user = loggedOut
    ? null
    : (list.find((u) => u.id === currentId) ?? list.find((u) => u.role === 'admin') ?? list[0] ?? null);
  const role: SessionRole = user ? user.role : 'public';

  const switchUser = useCallback((id: string) => {
    saveSettings({ currentUserId: id, loggedOut: false });
    setCurrentId(id);
    setLoggedOut(false);
  }, []);

  const logout = useCallback(() => {
    saveSettings({ loggedOut: true });
    setLoggedOut(true);
  }, []);

  const can = useCallback((p: Permission) => (user ? ALLOWED[user.role].includes(p) : false), [user]);

  return (
    <SessionContext.Provider value={{ user, users: list, role, isPublic: !user, ready: users !== undefined, can, switchUser, logout }}>
      {children}
    </SessionContext.Provider>
  );
}

export const useSession = () => useContext(SessionContext);
