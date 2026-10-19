import { useState, type FormEvent } from 'react';
import { ArrowRight, CheckCircle2, Phone } from 'lucide-react';
import { api, ApiError } from '../lib/api';
import { useAuth } from '../auth/AuthProvider';
import { PageHeader } from '../portal/PortalPrimitives';

export default function AccountPage() {
  const { user } = useAuth();
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  async function sendCode() {
    setBusy(true);
    setError('');
    setMessage('');
    try {
      const result = await api<{ message: string }>('/auth/phone/link/send-code', {
        method: 'POST',
        body: JSON.stringify({ phone }),
      });
      setSent(true);
      setMessage(result.message);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not send a code. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  async function verify(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError('');
    setMessage('');
    try {
      const result = await api<{ message: string }>('/auth/phone/link/verify-code', {
        method: 'POST',
        body: JSON.stringify({ phone, code }),
      });
      setMessage(result.message);
      setSent(false);
      setCode('');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not verify the code. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="portal-content account-page">
      <PageHeader
        eyebrow="ACCOUNT"
        title="Sign-in & security"
        description="Manage the details you use to access your private care space."
      />

      <section className="account-card patient-security-card" aria-labelledby="phone-link-title">
        <div className="account-security-intro">
          <div className="account-feature-icon"><Phone size={19} aria-hidden="true" /></div>
          <div className="account-card-heading">
            <span className="eyebrow">PHONE VERIFICATION</span>
            <h2 id="phone-link-title">Connect a mobile number</h2>
            <p>Verify a number to use one-time SMS codes when signing in.</p>
          </div>
        </div>
        <div className="account-security-form">
          <div className="account-identity">
            <span>Current sign-in email</span>
            <strong>{user?.email || 'Email unavailable'}</strong>
          </div>

          <form className="auth-form" onSubmit={verify}>
          <label>
            Mobile number
            <input
              type="tel"
              autoComplete="tel"
              inputMode="tel"
              required
              maxLength={16}
              placeholder="+919876543210"
              value={phone}
              onChange={(event) => {
                setPhone(event.target.value);
                setSent(false);
                setCode('');
                setError('');
                setMessage('');
              }}
            />
            <small>Include your country code, such as +91 for India.</small>
          </label>

          {sent && (
            <>
              <label>
                Verification code
                <input
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  required
                  maxLength={10}
                  value={code}
                  onChange={(event) => setCode(event.target.value)}
                />
              </label>
              <button className="account-resend" type="button" disabled={busy} onClick={() => void sendCode()}>
                {busy ? 'Sending…' : 'Didn’t receive a code? Send another'}
              </button>
            </>
          )}

          {error && <div role="alert" className="form-error">{error}</div>}
          {message && <div role="status" className="auth-notice"><CheckCircle2 size={16} aria-hidden="true" />{message}</div>}

          {!sent ? (
            <button className="button button-primary auth-submit" type="button" disabled={busy || !phone} onClick={() => void sendCode()}>
              {busy ? 'Sending code…' : 'Send verification code'} {!busy && <ArrowRight size={16} aria-hidden="true" />}
            </button>
          ) : (
            <button className="button button-primary auth-submit" type="submit" disabled={busy || !code}>
              {busy ? 'Verifying…' : 'Verify and link phone'} {!busy && <ArrowRight size={16} aria-hidden="true" />}
            </button>
          )}
          </form>
        </div>
      </section>
    </main>
  );
}
