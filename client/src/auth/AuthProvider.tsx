import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { api, ApiError } from '../lib/api';

export type UserRole = 'PATIENT' | 'DOCTOR' | 'ADMIN';
export interface User { id: string; email: string; role: UserRole; fullName: string | null }
type AuthContextValue = { user: User | null; loading: boolean; sessionCheckFailed: boolean; refresh: () => Promise<void>; signOut: () => Promise<void> };
const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [sessionCheckFailed, setSessionCheckFailed] = useState(false);
  const refresh = async () => {
    setLoading(true);
    try { const result = await api<{ user: User }>('/auth/me'); setUser(result.user); setSessionCheckFailed(false); }
    catch (error) {
      if (error instanceof ApiError && (error.status === 401 || error.status === 403)) {
        setUser(null);
        setSessionCheckFailed(false);
      } else {
        setSessionCheckFailed(true);
      }
    }
    finally { setLoading(false); }
  };
  useEffect(() => { void refresh(); }, []);
  const signOut = async () => { await api('/auth/logout', { method: 'POST', body: '{}' }); setUser(null); };
  return <AuthContext.Provider value={{ user, loading, sessionCheckFailed, refresh, signOut }}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuth must be used inside AuthProvider');
  return value;
}
