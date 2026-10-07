import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth, type UserRole } from '../auth/AuthProvider';

export function AuthGate() {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (loading) return <main className="route-state" aria-live="polite">Loading your secure session…</main>;
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  return <Outlet />;
}

export function RoleGate({ roles }: { roles: UserRole[] }) {
  const { user, loading } = useAuth();
  if (loading) return <main className="route-state" aria-live="polite">Loading your secure session…</main>;
  if (!user) return <Navigate to="/login" replace />;
  if (!roles.includes(user.role)) return <Navigate to={user.role === 'DOCTOR' ? '/doctor' : user.role === 'PATIENT' ? '/patient' : '/'} replace />;
  return <Outlet />;
}
