import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { api } from '../lib/api';

export type UserRole = 'PATIENT' | 'DOCTOR' | 'ADMIN';
export interface User { id: string; email: string; role: UserRole; fullName: string | null }
type AuthContextValue = { user: User | null; loading: boolean; refresh: () => Promise<void>; signOut: () => Promise<void> };
const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const refresh = async () => {
    try { const result = await api<{ user: User }>('/auth/me'); setUser(result.user); }
    catch { setUser(null); }
    finally { setLoading(false); }
  };
  useEffect(() => { void refresh(); }, []);
  const signOut = async () => { await api('/auth/logout', { method: 'POST', body: '{}' }); setUser(null); };
  return <AuthContext.Provider value={{ user, loading, refresh, signOut }}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuth must be used inside AuthProvider');
  return value;
}
