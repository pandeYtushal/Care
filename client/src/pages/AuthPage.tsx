import { useEffect, useState, type FormEvent } from 'react';
import { Link, Navigate, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, ArrowRight, HeartPulse, Mail, Phone } from 'lucide-react';
import { useAuth } from '../auth/AuthProvider';
import { api, ApiError } from '../lib/api';

type Props = { mode: 'login' | 'register' };
type LoginUser = { id?: string; role: 'PATIENT' | 'DOCTOR' | 'ADMIN' };

export default function AuthPage({ mode }: Props) {
  const isRegister = mode === 'register';
  const { user, refresh } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [search] = useSearchParams();
  const clinicianLogin = !isRegister && search.get('workspace') === 'doctor';
  const [method, setMethod] = useState<'email' | 'phone'>('email');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [codeSent, setCodeSent] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const authError = search.get('auth_error');
    if (authError === 'google_not_configured') setError('Google sign-in is not configured yet. Use email or phone, or add the Google OAuth settings to the server.');
    else if (authError) setError('Google sign-in did not complete. Please try again or use another sign-in method.');
  }, [search]);

  if (user) return <Navigate to={user.role === 'PATIENT' ? '/patient' : user.role === 'DOCTOR' ? '/doctor' : '/'} replace />;

  function goToUser(role: LoginUser['role']) {
    const from = (location.state as { from?: string } | null)?.from;
    const home = role === 'PATIENT' ? '/patient' : role === 'DOCTOR' ? '/doctor' : '/';
    navigate(from && home !== '/' && from.startsWith(home) ? from : home, { replace: true });
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError(''); setNotice(''); setBusy(true);
    try {
      const result = await api<{ user: LoginUser }>(isRegister ? '/auth/register' : '/auth/login', { method: 'POST', body: JSON.stringify({ ...(isRegister ? { fullName } : {}), email, password }) });
      await refresh();
      goToUser(result.user.role);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'We could not reach the clinic service. Please try again.');
    } finally { setBusy(false); }
  }

  async function sendPhoneCode() {
    setError(''); setNotice(''); setBusy(true);
    try {
      const result = await api<{ message: string }>('/auth/phone/send-code', { method: 'POST', body: JSON.stringify({ phone }) });
      setCodeSent(true); setNotice(result.message);
    } catch (err) { setError(err instanceof ApiError ? err.message : 'We could not send the code. Please try again.'); }
    finally { setBusy(false); }
  }

  async function verifyPhone(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError(''); setNotice(''); setBusy(true);
    try {
      const result = await api<{ user: LoginUser }>('/auth/phone/verify-code', { method: 'POST', body: JSON.stringify({ phone, code, ...(fullName ? { fullName } : {}), ...(email ? { email } : {}) }) });
      await refresh();
      goToUser(result.user.role);
    } catch (err) { setError(err instanceof ApiError ? err.message : 'We could not verify the code. Please try again.'); }
    finally { setBusy(false); }
  }

  return (
    <main className="auth-page">
      <aside className={`auth-story${clinicianLogin ? ' auth-story-clinician' : ''}`}>
        <Link to="/" className="auth-brand">
          <span className="auth-brand-mark"><HeartPulse size={20} aria-hidden="true" /></span>
          <span>Dr. Kiran</span>
        </Link>
        <div className="auth-story-copy">
          <div className="auth-eyebrow">{clinicianLogin ? 'CLINICAL WORKSPACE' : 'PRIVATE PATIENT CARE'}</div>
          <h1>{clinicianLogin ? 'Make room for better care.' : 'Good care begins with a good conversation.'}</h1>
          <p>{clinicianLogin ? 'Your appointments, patient context, and practice tools in one focused workspace.' : 'A private place to book a visit, share what matters, and stay connected to your care.'}</p>
        </div>
        <p className="auth-story-footer">© {new Date().getFullYear()} Dr. Kiran · Private practice</p>
      </aside>

      <section className="auth-panel">
        <div className="auth-panel-inner">
          <Link to="/" className="auth-back"><ArrowLeft size={16} aria-hidden="true" /> Back to practice</Link>
          <div className="auth-card-symbol"><HeartPulse size={20} aria-hidden="true" /></div>
          <div className="auth-eyebrow auth-card-eyebrow">{clinicianLogin ? 'CLINICIAN ACCESS' : 'YOUR CARE PORTAL'}</div>
          <h2>{isRegister ? 'Create your account' : clinicianLogin ? 'Welcome, doctor' : 'Welcome back'}</h2>
          <p className="auth-intro">{isRegister ? 'Create a patient account to continue to your care.' : clinicianLogin ? 'Sign in to manage your schedule and patient care.' : 'Sign in to access your care and appointments.'}</p>

          {!isRegister && search.get('reset') === 'success' && (
            <div role="status" className="p-4 mb-6 text-sm font-medium text-teal-800 bg-teal-50 border border-teal-100 rounded-xl">
              Your password has been updated. You can sign in now.
            </div>
          )}

          <a href={`${import.meta.env.VITE_API_URL || ''}/api/auth/google`} className="auth-google">
            <svg aria-hidden="true" viewBox="0 0 24 24" className="w-5 h-5">
              <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
              <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
              <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
              <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
            </svg>
            Continue with Google
          </a>

          <div className="auth-divider">or continue with</div>

          <div className="auth-methods" role="group" aria-label="Choose a sign-in method">
            <button type="button" aria-pressed={method === 'email'} className={method === 'email' ? 'active' : ''} onClick={() => { setMethod('email'); setError(''); }}><Mail size={14} aria-hidden="true" /> Email</button>
            <button type="button" aria-pressed={method === 'phone'} className={method === 'phone' ? 'active' : ''} onClick={() => { setMethod('phone'); setError(''); }}><Phone size={14} aria-hidden="true" /> Phone</button>
          </div>

          {method === 'email' ? (
            <form className="auth-fields" onSubmit={submit}>
              {isRegister && (
                <label>Full name<input autoComplete="name" required maxLength={120} value={fullName} onChange={(e) => setFullName(e.target.value)} /></label>
              )}
              <label>Email address<input type="email" autoComplete="email" required maxLength={254} value={email} onChange={(e) => setEmail(e.target.value)} /></label>
              <label><span className="auth-label-row"><span>Password</span>{!isRegister && <Link to="/forgot-password">Forgot password?</Link>}</span><input type="password" autoComplete={isRegister ? 'new-password' : 'current-password'} required minLength={isRegister ? 12 : 1} maxLength={72} value={password} onChange={(e) => setPassword(e.target.value)} />{isRegister && <span className="auth-hint">12–72 characters, including uppercase, lowercase, and a number.</span>}</label>

              {error && <div role="alert" className="auth-alert">{error}</div>}
              {notice && <div role="status" className="auth-notice">{notice}</div>}

              <button className="auth-submit" type="submit" disabled={busy}>
                {busy ? 'Please wait…' : isRegister ? 'Create patient account' : 'Sign in'} {!busy && <ArrowRight size={18} />}
              </button>
            </form>
          ) : (
            <form className="auth-fields" onSubmit={verifyPhone}>
              <label>Mobile number<input type="tel" autoComplete="tel" required maxLength={16} placeholder="+91 98765 43210" value={phone} onChange={(e) => { setPhone(e.target.value); setCodeSent(false); }} /><span className="auth-hint">Include your country code.</span></label>

              {(isRegister || fullName || email || codeSent) && (
                <>
                  <label>Full name<input autoComplete="name" required={isRegister} maxLength={120} value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder={isRegister ? '' : 'For a new patient account'} /></label>
                  <label>Email address<input type="email" autoComplete="email" required={isRegister} maxLength={254} value={email} onChange={(e) => setEmail(e.target.value)} placeholder={isRegister ? '' : 'For a new patient account'} /></label>
                </>
              )}

              {codeSent && (
                <label>Verification code<input className="auth-code-input" inputMode="numeric" autoComplete="one-time-code" required maxLength={10} value={code} onChange={(e) => setCode(e.target.value)} placeholder="000000" /></label>
              )}

              {error && <div role="alert" className="auth-alert">{error}</div>}
              {notice && <div role="status" className="auth-notice">{notice}</div>}

              {!codeSent ? (
                <button className="auth-submit" type="button" onClick={() => void sendPhoneCode()} disabled={busy || !phone}>
                  {busy ? 'Sending…' : 'Send verification code'} {!busy && <ArrowRight size={18} />}
                </button>
              ) : (
                <button className="auth-submit" type="submit" disabled={busy || !code}>
                  {busy ? 'Verifying…' : 'Verify and sign in'} {!busy && <ArrowRight size={18} />}
                </button>
              )}

              {codeSent && (
                <button type="button" className="auth-resend" onClick={() => void sendPhoneCode()} disabled={busy}>
                  Send a new code
                </button>
              )}
            </form>
          )}

          <div className="auth-switch">
            {isRegister ? 'Already have an account?' : clinicianLogin ? 'Doctor access is provisioned by the practice.' : 'New to the practice?'} {!clinicianLogin && <Link to={isRegister ? '/login' : '/register'}>{isRegister ? 'Sign in' : 'Create an account'}</Link>}
          </div>

          <p className="auth-privacy-note">Health information should only be shared through your authenticated patient portal.</p>
        </div>
      </section>
    </main>
  );
}
