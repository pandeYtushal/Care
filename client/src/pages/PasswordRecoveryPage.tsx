import { useState, type FormEvent } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, HeartPulse } from 'lucide-react';
import { api, ApiError } from '../lib/api';

export default function PasswordRecoveryPage({ mode }: { mode: 'request' | 'reset' }) {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const token = params.get('token') ?? '';
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const resetting = mode === 'reset';

  async function submit(event: FormEvent) {
    event.preventDefault(); setError(''); setMessage('');
    if (resetting && !token) { setError('This reset link is missing its token. Request a new one.'); return; }
    if (resetting && password !== confirm) { setError('Those passwords do not match.'); return; }
    setBusy(true);
    try {
      const result = await api<{ message: string }>('/auth/' + (resetting ? 'reset-password' : 'forgot-password'), {
        method: 'POST', body: JSON.stringify(resetting ? { token, password } : { email }),
      });
      if (resetting) navigate('/login?reset=success', { replace: true });
      else setMessage(result.message);
    } catch (cause) { setError(cause instanceof ApiError ? cause.message : 'We could not complete that request. Please try again.'); }
    finally { setBusy(false); }
  }

  return <main className="auth-page">
    <aside className="auth-story">
      <Link to="/" className="auth-brand"><span className="auth-brand-mark"><HeartPulse size={21}/></span><span>Dr. Kiran</span></Link>
      <div className="auth-story-copy"><div className="auth-eyebrow">PRIVATE PATIENT CARE</div><h1>A little help getting back to your care.</h1><p>Your account stays private and protected.</p></div>
      <p className="auth-story-footer">© {new Date().getFullYear()} Dr. Kiran · Private practice</p>
    </aside>
    <section className="auth-panel"><div className="auth-panel-inner recovery-card">
      <Link to="/login" className="auth-back inline-flex min-h-11 items-center"><ArrowLeft size={16}/> Back to sign in</Link>
      <div className="auth-card-symbol"><HeartPulse size={20}/></div>
      <div className="auth-eyebrow auth-card-eyebrow">ACCOUNT ACCESS</div><h2>{resetting ? 'Choose a new password' : 'Forgot your password?'}</h2>
      <p className="auth-intro">{resetting ? 'Use a strong password you have not used here before.' : 'Enter your account email. If it is registered, we’ll email you a secure reset link.'}</p>
      <form onSubmit={submit} className="auth-fields">
        {!resetting ? <label>Email address<input type="email" autoComplete="email" required maxLength={254} value={email} onChange={e=>setEmail(e.target.value)}/></label> : <>
          <label>New password<input type="password" autoComplete="new-password" required minLength={12} maxLength={72} value={password} onChange={e=>setPassword(e.target.value)}/><small className="auth-hint">12–72 characters, including uppercase, lowercase, and a number.</small></label>
          <label>Confirm new password<input type="password" autoComplete="new-password" required minLength={12} maxLength={72} value={confirm} onChange={e=>setConfirm(e.target.value)}/></label>
        </>}
        {error&&<p role="alert" className="auth-alert">{error}</p>}{message&&<p role="status" className="auth-notice">{message}</p>}
        <button className="auth-submit min-h-11" disabled={busy}>{busy?'Please wait…':resetting?'Save new password':'Email reset link'}</button>
      </form>
      {!resetting&&<p className="auth-privacy-note">For your security, the response is the same whether or not the email has an account.</p>}
    </div></section>
  </main>;
}
