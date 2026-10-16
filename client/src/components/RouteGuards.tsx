import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { RefreshCw } from 'lucide-react';
import { useAuth, type UserRole } from '../auth/AuthProvider';

export function AuthGate() {
  const { user, loading, sessionCheckFailed, refresh } = useAuth();
  const location = useLocation();
  if (loading) return <main className="route-state" aria-live="polite">Loading your secure session…</main>;
  if (sessionCheckFailed) return <SessionRetry onRetry={() => void refresh()} />;
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  return <Outlet />;
}

export function RoleGate({ roles }: { roles: UserRole[] }) {
  const { user, loading, sessionCheckFailed, refresh } = useAuth();
  if (loading) return <main className="route-state" aria-live="polite">Loading your secure session…</main>;
  if (sessionCheckFailed) return <SessionRetry onRetry={() => void refresh()} />;
  if (!user) return <Navigate to="/login" replace />;
  if (!roles.includes(user.role)) return <Navigate to={user.role === 'DOCTOR' ? '/doctor' : user.role === 'PATIENT' ? '/patient' : '/'} replace />;
  return <Outlet />;
}

function SessionRetry({ onRetry }: { onRetry: () => void }) {
  return <main className="route-state route-state-error" role="alert">
    <div>
      <h1>We couldn’t check your sign-in</h1>
      <p>The care service did not respond. Your session has not been treated as signed out.</p>
      <button className="btn btn-primary" type="button" onClick={onRetry}><RefreshCw size={16} aria-hidden="true" /> Try again</button>
    </div>
  </main>;
}
