import { Component, Suspense, lazy, type ErrorInfo, type ReactNode } from 'react';
import { Link, Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider } from './auth/AuthProvider';
import { AuthGate, RoleGate } from './components/RouteGuards';
import { LoaderCircle } from 'lucide-react';

const AuthPage = lazy(() => import('./pages/AuthPage'));
const PasswordRecoveryPage = lazy(() => import('./pages/PasswordRecoveryPage'));
const AccountPage = lazy(() => import('./pages/AccountPage'));
const LandingPage = lazy(() => import('./pages/LandingPage'));
const PatientPortalLayout = lazy(() => import('./patient/PatientPortalLayout'));
const DoctorPortalLayout = lazy(() => import('./doctor/DoctorPortalLayout'));
const PatientOverviewPage = lazy(() => import('./patient/PatientOverviewPage'));
const DoctorOverviewPage = lazy(() => import('./doctor/DoctorOverviewPage'));
const AppointmentDetailPage = lazy(() => import('./portal/AppointmentDetailPage'));
const BookingPage = lazy(() => import('./patient/BookingPage'));
const DoctorCalendarPage = lazy(() => import('./doctor/DoctorCalendarPage'));
const DoctorPatientsPage = lazy(() => import('./doctor/DoctorPatientsPage'));
const DoctorAppointmentsPage = lazy(() => import('./doctor/DoctorAppointmentsPage'));
const DoctorServicesPage = lazy(() => import('./doctor/DoctorServicesPage'));
const DoctorAvailabilityPage = lazy(() => import('./doctor/DoctorAvailabilityPage'));
const DoctorIntegrationsPage = lazy(() => import('./doctor/DoctorIntegrationsPage'));
const DoctorPatientDetailPage = lazy(() => import('./doctor/DoctorPatientDetailPage'));
const DoctorPrescriptionsPage = lazy(() => import('./doctor/DoctorPrescriptionsPage'));
const ProfilePage = lazy(() => import('./portal/ProfilePage'));
const CareHistoryPage = lazy(() => import('./portal/PortalActivityPages').then((page) => ({ default: page.CareHistoryPage })));
const PatientReportsPage = lazy(() => import('./portal/PortalActivityPages').then((page) => ({ default: page.PatientReportsPage })));
const NotificationsPage = lazy(() => import('./portal/PortalActivityPages').then((page) => ({ default: page.NotificationsPage })));
const PaymentsPage = lazy(() => import('./portal/PortalActivityPages').then((page) => ({ default: page.PaymentsPage })));
const PatientAppointmentsPage = lazy(() => import('./patient/PatientAppointmentsPage'));
const PatientPrescriptionsPage = lazy(() => import('./patient/PatientPrescriptionsPage'));
const StaticPage = lazy(() => import('./pages/StaticPage'));

function RouteLoading() {
  return (
    <main id="main-content" tabIndex={-1} className="grid min-h-dvh place-items-center bg-canvas px-5 text-ink" aria-busy="true">
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
        <main id="main-content" tabIndex={-1} className="grid min-h-dvh place-items-center bg-canvas px-5 py-12 text-center text-ink">
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
    <main id="main-content" tabIndex={-1} className="grid min-h-dvh place-items-center bg-canvas px-5 py-12 text-center text-ink">
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
function App() {
  return (
    <AppErrorBoundary>
      <AuthProvider>
        <Suspense fallback={<RouteLoading />}>
          <Routes>
            {/* Public pages are section anchors on the practice site. */}
            <Route path="/" element={<LandingPage />} />
            <Route path="/about" element={<StaticPage type="about" />} />
            <Route path="/philosophy" element={<StaticPage type="philosophy" />} />
            <Route path="/care" element={<LandingPage />} />
            <Route path="/services" element={<LandingPage />} />
            <Route path="/consultations" element={<LandingPage />} />
            <Route path="/contact" element={<LandingPage />} />
            <Route path="/faq" element={<LandingPage />} />
            
            {/* Legal Pages */}
            <Route path="/privacy" element={<StaticPage type="privacy" />} />
            <Route path="/terms" element={<StaticPage type="terms" />} />
            <Route path="/booking-policy" element={<StaticPage type="policies" />} />

            {/* Authentication and account recovery. */}
            <Route path="/login" element={<AuthPage mode="login" />} />
            <Route path="/register" element={<AuthPage mode="register" />} />
            <Route path="/forgot-password" element={<PasswordRecoveryPage mode="request" />} />
            <Route path="/reset-password" element={<PasswordRecoveryPage mode="reset" />} />

            <Route element={<AuthGate />}>
              <Route element={<RoleGate roles={['PATIENT']} />}>
                <Route path="/patient" element={<PatientPortalLayout />}>
                  <Route index element={<PatientOverviewPage />} />
                  <Route path="account" element={<AccountPage />} />
                  <Route path="profile" element={<ProfilePage role="PATIENT" />} />
                  <Route path="appointments" element={<PatientAppointmentsPage />} />
                  <Route path="appointments/:id" element={<AppointmentDetailPage role="PATIENT" />} />
                  <Route path="book" element={<BookingPage />} />
                  <Route path="history" element={<CareHistoryPage />} />
                  <Route path="reports" element={<PatientReportsPage />} />
                  <Route path="prescriptions" element={<PatientPrescriptionsPage />} />
                  <Route path="payments" element={<PaymentsPage role="PATIENT" />} />
                  <Route path="notifications" element={<NotificationsPage />} />
                </Route>
              </Route>

              <Route element={<RoleGate roles={['DOCTOR']} />}>
                <Route path="/doctor" element={<DoctorPortalLayout />}>
                  <Route index element={<DoctorOverviewPage />} />
                  <Route path="account" element={<AccountPage />} />
                  <Route path="profile" element={<ProfilePage role="DOCTOR" />} />
                  <Route path="calendar" element={<DoctorCalendarPage />} />
                  <Route path="appointments" element={<DoctorAppointmentsPage />} />
                  <Route path="appointments/:id" element={<AppointmentDetailPage role="DOCTOR" />} />
                  <Route path="patients" element={<DoctorPatientsPage />} />
                  <Route path="patients/:id" element={<DoctorPatientDetailPage />} />
                  <Route path="availability" element={<DoctorAvailabilityPage />} />
                  <Route path="services" element={<DoctorServicesPage />} />
                  <Route path="integrations" element={<DoctorIntegrationsPage />} />
                  <Route path="reports" element={<Navigate to="/doctor/patients" replace />} />
                  <Route path="prescriptions" element={<DoctorPrescriptionsPage />} />
                  <Route path="payments" element={<PaymentsPage role="DOCTOR" />} />
                  <Route path="notifications" element={<NotificationsPage />} />
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
