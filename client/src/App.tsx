import { Component, Suspense, lazy, type ErrorInfo, type ReactNode } from 'react';
import { Link, Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider } from './auth/AuthProvider';
import { AuthGate, RoleGate } from './components/RouteGuards';
import { LoaderCircle } from 'lucide-react';

const AuthPage = lazy(() => import('./pages/AuthPage'));
const PasswordRecoveryPage = lazy(() => import('./pages/PasswordRecoveryPage'));
const AccountPage = lazy(() => import('./pages/AccountPage'));
const LandingPage = lazy(() => import('./pages/LandingPage'));
const PortalLayout = lazy(() => import('./pages/PortalPage').then((page) => ({ default: page.PortalLayout })));
const PortalHome = lazy(() => import('./pages/PortalPage').then((page) => ({ default: page.PortalHome })));
const PortalSection = lazy(() => import('./pages/PortalPage').then((page) => ({ default: page.PortalSection })));
const AppointmentDetail = lazy(() => import('./pages/PortalPage').then((page) => ({ default: page.AppointmentDetail })));
const PatientDetail = lazy(() => import('./pages/PortalPage').then((page) => ({ default: page.PatientDetail })));
const BookingPage = lazy(() => import('./pages/PortalPage').then((page) => ({ default: page.BookingPage })));
const StaticPage = lazy(() => import('./pages/StaticPage'));

function RouteLoading() {
  return (
    <main className="grid min-h-dvh place-items-center bg-canvas px-5 text-ink" aria-busy="true">
      <div className="flex items-center gap-3 rounded-xl border border-border bg-surface px-5 py-4 shadow-sm" role="status">
        <LoaderCircle className="animate-spin text-brand motion-reduce:animate-none" size={20} aria-hidden="true" />
        <span className="text-sm font-medium">Opening your care space…</span>
      </div>
    </main>
  );
}

class AppErrorBoundary extends Component<
  { children: ReactNode },
  { failed: boolean; errorMessage: string }
> {
  state = { failed: false, errorMessage: '' };
  static getDerivedStateFromError(error: Error) {
    return { failed: true, errorMessage: error.message };
  }
  componentDidCatch(error: Error, _info: ErrorInfo) {
    console.error('UI render error', { errorType: error.name });
  }
  render() {
    if (this.state.failed) {
      return (
        <main className="grid min-h-dvh place-items-center bg-canvas px-5 py-12 text-center text-ink">
          <section className="w-full max-w-lg rounded-2xl border border-border bg-surface p-7 shadow-sm sm:p-10">
            <span className="eyebrow">PAGE ERROR</span>
            <h1 className="mt-2 text-3xl">We couldn’t load this page</h1>
            <p className="mt-3 text-sm text-ink-muted">
              Please try again. Your appointment and care records remain safe.
            </p>
            {(import.meta as unknown as { env?: { DEV?: boolean } }).env?.DEV && (
              <pre className="mt-4 overflow-auto text-left text-xs" role="status">
                Development detail: {this.state.errorMessage}
              </pre>
            )}
            <div className="mt-7 flex flex-col justify-center gap-3 sm:flex-row">
              <button
                className="btn btn-primary"
                type="button"
                onClick={() => window.location.reload()}
              >
                Try again
              </button>
              <Link className="btn btn-secondary" to="/">
                Go to home
              </Link>
            </div>
          </section>
        </main>
      );
    }
    return this.props.children;
  }
}

function NotFound() {
  return (
    <main className="grid min-h-dvh place-items-center bg-canvas px-5 py-12 text-center text-ink">
      <section className="w-full max-w-lg rounded-2xl border border-border bg-surface p-7 shadow-sm sm:p-10">
        <span className="eyebrow">NOT FOUND</span>
        <h1 className="mt-2 text-3xl">That page isn’t here</h1>
        <p className="mt-3 text-sm text-ink-muted">
          The address may have changed. Return to the practice and choose a page from there.
        </p>
        <Link className="btn btn-primary mt-7" to="/">
          Return to the practice
        </Link>
      </section>
    </main>
  );
}
function LandingRoutes() { return <LandingPage />; }
function App() {
  return (
    <AppErrorBoundary>
      <AuthProvider>
        <Suspense fallback={<RouteLoading />}>
          <Routes>
            {/* Public pages are section anchors on the practice site. */}
            <Route path="/" element={<LandingRoutes />} />
            <Route path="/about" element={<StaticPage type="about" />} />
            <Route path="/philosophy" element={<StaticPage type="philosophy" />} />
            <Route path="/services" element={<LandingRoutes />} />
            <Route path="/consultations" element={<LandingRoutes />} />
            <Route path="/contact" element={<LandingRoutes />} />
            <Route path="/faq" element={<LandingRoutes />} />
            
            {/* Legal Pages */}
            <Route path="/privacy" element={<StaticPage type="privacy" />} />
            <Route path="/terms" element={<StaticPage type="terms" />} />

            {/* Authentication and account recovery. */}
            <Route path="/login" element={<AuthPage mode="login" />} />
            <Route path="/register" element={<AuthPage mode="register" />} />
            <Route path="/forgot-password" element={<PasswordRecoveryPage mode="request" />} />
            <Route path="/reset-password" element={<PasswordRecoveryPage mode="reset" />} />

            <Route element={<AuthGate />}>
              <Route element={<RoleGate roles={['PATIENT']} />}>
                <Route path="/patient" element={<PortalLayout role="PATIENT" />}>
                  <Route index element={<PortalHome role="PATIENT" />} />
                  <Route path="account" element={<AccountPage />} />
                  <Route path="profile" element={<PortalSection title="Your profile" role="PATIENT" />} />
                  <Route path="appointments" element={<PortalSection title="Appointments" role="PATIENT" />} />
                  <Route path="appointments/:id" element={<AppointmentDetail role="PATIENT" />} />
                  <Route path="book" element={<BookingPage />} />
                  <Route path="history" element={<PortalSection title="Care history" role="PATIENT" />} />
                  <Route path="reports" element={<PortalSection title="Reports" role="PATIENT" />} />
                  <Route path="prescriptions" element={<PortalSection title="Prescriptions" role="PATIENT" />} />
                  <Route path="payments" element={<PortalSection title="Payments" role="PATIENT" />} />
                  <Route path="notifications" element={<PortalSection title="Notifications" role="PATIENT" />} />
                </Route>
              </Route>

              <Route element={<RoleGate roles={['DOCTOR']} />}>
                <Route path="/doctor" element={<PortalLayout role="DOCTOR" />}>
                  <Route index element={<PortalHome role="DOCTOR" />} />
                  <Route path="account" element={<AccountPage />} />
                  <Route path="profile" element={<PortalSection title="Practice profile" role="DOCTOR" />} />
                  <Route path="calendar" element={<PortalSection title="Calendar" role="DOCTOR" />} />
                  <Route path="appointments" element={<PortalSection title="Appointments" role="DOCTOR" />} />
                  <Route path="appointments/:id" element={<AppointmentDetail role="DOCTOR" />} />
                  <Route path="patients" element={<PortalSection title="Patients" role="DOCTOR" />} />
                  <Route path="patients/:id" element={<PatientDetail />} />
                  <Route path="availability" element={<PortalSection title="Availability" role="DOCTOR" />} />
                  <Route path="services" element={<PortalSection title="Consultation services" role="DOCTOR" />} />
                  <Route path="integrations" element={<PortalSection title="Integrations" role="DOCTOR" />} />
                  <Route path="reports" element={<Navigate to="/doctor/patients" replace />} />
                  <Route path="prescriptions" element={<PortalSection title="Prescriptions" role="DOCTOR" />} />
                  <Route path="payments" element={<PortalSection title="Payments" role="DOCTOR" />} />
                  <Route path="notifications" element={<PortalSection title="Notifications" role="DOCTOR" />} />
                </Route>
              </Route>
            </Route>

            <Route path="*" element={<NotFound />} />
          </Routes>
        </Suspense>
      </AuthProvider>
    </AppErrorBoundary>
  );
}
export default App;
