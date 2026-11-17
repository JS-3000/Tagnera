// Simulated login: the current user is chosen in the settings (no password).
// The UI asks `can('edit')` / `can('admin')` to show or hide functions.

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { data } from '../data';
import type { Role, User } from '../data/types';
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
  user: User | null;
  users: User[];
  can(p: Permission): boolean;
  switchUser(id: string): void;
}

const SessionContext = createContext<Session>({
  user: null,
  users: [],
  can: () => false,
  switchUser: () => {},
});

export function SessionProvider({ children }: { children: ReactNode }) {
  const users = useData(() => data.users.list(), []);
  const [currentId, setCurrentId] = useState(() => loadSettings().currentUserId);

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
  const user = list.find((u) => u.id === currentId) ?? list.find((u) => u.role === 'admin') ?? list[0] ?? null;

  const switchUser = useCallback((id: string) => {
    saveSettings({ currentUserId: id });
    setCurrentId(id);
  }, []);

  const can = useCallback((p: Permission) => (user ? ALLOWED[user.role].includes(p) : false), [user]);

  return <SessionContext.Provider value={{ user, users: list, can, switchUser }}>{children}</SessionContext.Provider>;
}

export const useSession = () => useContext(SessionContext);
