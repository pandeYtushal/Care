import { useState, type FormEvent } from 'react';
import { api, ApiError } from '../lib/api';
import { useAuth } from '../auth/AuthProvider';

export default function AccountPage() {
  const { user } = useAuth();
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  async function sendCode() {
    setBusy(true); setError(''); setMessage('');
    try {
      const result = await api<{ message: string }>('/auth/phone/link/send-code', { method: 'POST', body: JSON.stringify({ phone }) });
      setSent(true); setMessage(result.message);
    } catch (err) { setError(err instanceof ApiError ? err.message : 'Could not send a code. Please try again.'); }
    finally { setBusy(false); }
  }
  async function verify(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError(''); setMessage('');
    try {
      const result = await api<{ message: string }>('/auth/phone/link/verify-code', { method: 'POST', body: JSON.stringify({ phone, code }) });
      setMessage(result.message); setSent(false); setCode('');
    } catch (err) { setError(err instanceof ApiError ? err.message : 'Could not verify the code. Please try again.'); }
    finally { setBusy(false); }
  }

  return <main className="portal-content"><div className="eyebrow">ACCOUNT</div><h1>Account settings</h1><p className="portal-lede">Manage how you sign in to Atelier Care.</p><section className="account-card"><h2>Link a mobile number</h2><p>Verify your phone number to use one-time SMS codes for future sign-ins. You are signed in as {user?.email}.</p><form className="auth-form" onSubmit={verify}>
    <label>Mobile number<input type="tel" autoComplete="tel" required maxLength={16} placeholder="+14155552671" value={phone} onChange={(event) => { setPhone(event.target.value); setSent(false); }} /><small>Include country code, for example +91 for India.</small></label>
    {sent && <label>Verification code<input inputMode="numeric" autoComplete="one-time-code" required maxLength={10} value={code} onChange={(event) => setCode(event.target.value)} /></label>}
    {error && <div role="alert" className="form-error">{error}</div>}{message && <div role="status" className="auth-notice">{message}</div>}
    {!sent ? <button className="button button-primary auth-submit" type="button" disabled={busy || !phone} onClick={() => void sendCode()}>{busy ? 'Sending…' : 'Send verification code'}</button> : <button className="button button-primary auth-submit" type="submit" disabled={busy || !code}>{busy ? 'Verifying…' : 'Verify and link phone'}</button>}
  </form></section></main>;
}
