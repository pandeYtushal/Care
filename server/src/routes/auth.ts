import { createHash, createPublicKey, randomBytes, timingSafeEqual, verify as verifySignature } from 'node:crypto';
import bcrypt from 'bcrypt';
import { Router, type Request } from 'express';
import { env } from '../config/env';
import { pool } from '../db';
import { asyncRoute, HttpError } from '../http';
import { hashSessionToken, requireAuth } from '../middleware/auth';
import { clearSessionCookie, setSessionCookie } from '../middleware/cookies';
import { rateLimit } from '../middleware/rateLimit';
import { sendPasswordResetEmail } from '../integrations/email';
import { externalFetch } from '../integrations/http';

const router = Router();
const authLimit = rateLimit(8, 15 * 60 * 1000);
const phoneIdentity = (req: Request) => typeof req.body?.phone === 'string' ? req.body.phone : 'missing-phone';
const phoneSendLimit = rateLimit(3, 15 * 60 * 1000, phoneIdentity);
const phoneVerifyLimit = rateLimit(8, 15 * 60 * 1000, phoneIdentity);
const passwordResetRequestLimit = rateLimit(4, 15 * 60 * 1000, (req) => typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : 'missing-email');
const passwordResetSubmitLimit = rateLimit(8, 15 * 60 * 1000);
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const e164Pattern = /^\+[1-9]\d{7,14}$/;
const dummyPasswordHash = bcrypt.hash(randomBytes(24).toString('hex'), 12);
function requiredString(value: unknown, name: string, max: number) {
  if (typeof value !== 'string' || !value.trim() || value.trim().length > max) throw new HttpError(400, `Enter a valid ${name}.`);
  return value.trim();
}
function newPassword(value: unknown) {
  if (typeof value !== 'string' || value.length < 12 || value.length > 72 || Buffer.byteLength(value, 'utf8') > 72
      || !/[a-z]/.test(value) || !/[A-Z]/.test(value) || !/[0-9]/.test(value)) {
    throw new HttpError(400, 'Use at least 12 characters with upper and lowercase letters and a number.');
  }
  return value;
}
async function createSession(userId: string) {
  const token = randomBytes(32).toString('base64url');
  const expiresAt = new Date(Date.now() + env.sessionTtlHours * 60 * 60 * 1000);
  await pool.query('INSERT INTO user_sessions (user_id, token_hash, expires_at) VALUES ($1, $2, $3)', [userId, hashSessionToken(token), expiresAt]);
  return { token, expiresAt };
}
function safeUser(row: Record<string, unknown>) {
  return { id: row.id, email: row.email, role: row.role, fullName: row.full_name ?? row.display_name ?? null };
}

const oauthCookieOptions = `Path=/; HttpOnly; SameSite=Lax; Max-Age=600${env.nodeEnv === 'production' ? '; Secure' : ''}`;
function setOAuthCookie(res: Parameters<typeof setSessionCookie>[0], name: string, value: string) {
  res.append('Set-Cookie', `${name}=${encodeURIComponent(value)}; ${oauthCookieOptions}`);
}
function clearOAuthCookie(res: Parameters<typeof clearSessionCookie>[0], name: string) {
  res.append('Set-Cookie', `${name}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${env.nodeEnv === 'production' ? '; Secure' : ''}`);
}
const frontendUrl = () => (env.googleRedirectUri ? new URL(env.googleRedirectUri).origin : '') || env.allowedOrigins[0] || 'http://localhost:5173';
const googleError = (res: Parameters<typeof clearSessionCookie>[0], code: string) => res.redirect(`${frontendUrl()}/login?auth_error=${encodeURIComponent(code)}`);

type GoogleJwk = JsonWebKey & { kid?: string };
type GoogleClaims = { iss?: string; aud?: string | string[]; azp?: string; sub?: string; email?: string; email_verified?: boolean | string; name?: string; nonce?: string; exp?: number; iat?: number };
let googleKeys: GoogleJwk[] = [];
let googleKeysExpireAt = 0;
async function googleSigningKey(kid: string): Promise<GoogleJwk | undefined> {
  if (Date.now() > googleKeysExpireAt) {
    const response = await externalFetch('https://www.googleapis.com/oauth2/v3/certs');
    if (!response.ok) throw new Error('Google signing keys are unavailable.');
    const data = await response.json() as { keys?: GoogleJwk[] };
    if (!Array.isArray(data.keys)) throw new Error('Google signing keys were invalid.');
    googleKeys = data.keys;
    const maxAge = Number(response.headers.get('cache-control')?.match(/max-age=(\d+)/i)?.[1] ?? 300);
    googleKeysExpireAt = Date.now() + Math.min(Math.max(maxAge, 60), 3600) * 1000;
  }
  return googleKeys.find((key) => key.kid === kid);
}
async function verifyGoogleIdToken(token: string, expectedNonce: string) {
  const pieces = token.split('.');
  if (pieces.length !== 3) throw new Error('Invalid Google credential.');
  const header = JSON.parse(Buffer.from(pieces[0], 'base64url').toString('utf8')) as { alg?: string; kid?: string };
  const claims = JSON.parse(Buffer.from(pieces[1], 'base64url').toString('utf8')) as GoogleClaims;
  if (header.alg !== 'RS256' || !header.kid) throw new Error('Invalid Google credential.');
  const key = await googleSigningKey(header.kid);
  if (!key) throw new Error('Google signing key not found.');
  const publicKey = createPublicKey({ key, format: 'jwk' });
  const signature = Buffer.from(pieces[2], 'base64url');
  if (!verifySignature('RSA-SHA256', Buffer.from(`${pieces[0]}.${pieces[1]}`), publicKey, signature)) throw new Error('Invalid Google signature.');
  const audienceOk = Array.isArray(claims.aud) ? claims.aud.includes(env.googleClientId) : claims.aud === env.googleClientId;
  const now = Math.floor(Date.now() / 1000);
  if (!['accounts.google.com', 'https://accounts.google.com'].includes(claims.iss ?? '') || !audienceOk || (Array.isArray(claims.aud) && claims.azp !== env.googleClientId)
      || !claims.sub || !claims.email || !(claims.email_verified === true || claims.email_verified === 'true')
      || !claims.exp || claims.exp < now || !claims.iat || claims.iat > now + 300 || claims.nonce !== expectedNonce) {
    throw new Error('Google identity claims were invalid.');
  }
  return { subject: claims.sub, email: claims.email.trim().toLowerCase(), name: claims.name?.trim() || 'Patient' };
}

router.get('/google', (req, res) => {
  if (!env.googleClientId || !env.googleClientSecret || !env.googleRedirectUri) return googleError(res, 'google_not_configured');
  const state = randomBytes(32).toString('base64url');
  const nonce = randomBytes(32).toString('base64url');
  const verifier = randomBytes(48).toString('base64url');
  const challenge = createHash('sha256').update(verifier).digest('base64url');
  setOAuthCookie(res, 'atelier_google_state', state);
  setOAuthCookie(res, 'atelier_google_nonce', nonce);
  setOAuthCookie(res, 'atelier_google_verifier', verifier);
  const params = new URLSearchParams({ client_id: env.googleClientId, redirect_uri: env.googleRedirectUri, response_type: 'code', scope: 'openid email profile', state, nonce, code_challenge: challenge, code_challenge_method: 'S256', prompt: 'select_account' });
  return res.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`);
});

router.get('/google/callback', asyncRoute(async (req, res) => {
  const state = req.cookies?.atelier_google_state ?? '';
  const nonce = req.cookies?.atelier_google_nonce ?? '';
  const verifier = req.cookies?.atelier_google_verifier ?? '';
  for (const name of ['atelier_google_state', 'atelier_google_nonce', 'atelier_google_verifier']) clearOAuthCookie(res, name);
  const suppliedState = typeof req.query.state === 'string' ? req.query.state : '';
  if (!state || !nonce || !verifier || !suppliedState || state.length !== suppliedState.length || !timingSafeEqual(Buffer.from(state), Buffer.from(suppliedState)) || typeof req.query.code !== 'string') return googleError(res, 'google_cancelled');
  if (!env.googleClientId || !env.googleClientSecret || !env.googleRedirectUri) return googleError(res, 'google_not_configured');
  try {
    const tokenResponse = await externalFetch('https://oauth2.googleapis.com/token', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ code: req.query.code, client_id: env.googleClientId, client_secret: env.googleClientSecret, redirect_uri: env.googleRedirectUri, grant_type: 'authorization_code', code_verifier: verifier }) });
    if (!tokenResponse.ok) return googleError(res, 'google_signin_failed');
    const tokenPayload = await tokenResponse.json() as { id_token?: string };
    if (!tokenPayload.id_token) return googleError(res, 'google_signin_failed');
    const identity = await verifyGoogleIdToken(tokenPayload.id_token, nonce);
    const client = await pool.connect();
    let sessionToken = '';
    let expiresAt = new Date();
    try {
      await client.query('BEGIN');
      let account = await client.query(`SELECT u.id, u.email, u.role, u.disabled_at FROM auth_identities i JOIN users u ON u.id = i.user_id WHERE i.provider = 'GOOGLE' AND i.provider_subject = $1 FOR UPDATE OF u`, [identity.subject]);
      if (!account.rowCount) {
        account = await client.query('SELECT id, email, role, disabled_at FROM users WHERE lower(email) = $1 FOR UPDATE', [identity.email]);
        if (account.rowCount) {
          await client.query(`INSERT INTO auth_identities(user_id, provider, provider_subject) VALUES ($1, 'GOOGLE', $2)`, [account.rows[0].id, identity.subject]);
          await client.query('UPDATE users SET email_verified_at = COALESCE(email_verified_at, now()) WHERE id = $1', [account.rows[0].id]);
        } else {
          const randomPasswordHash = await bcrypt.hash(randomBytes(48).toString('base64url'), 12);
          const created = await client.query(`INSERT INTO users(email, password_hash, role, email_verified_at) VALUES ($1, $2, 'PATIENT', now()) RETURNING id, email, role, disabled_at`, [identity.email, randomPasswordHash]);
          account = created;
          await client.query('INSERT INTO patients(user_id, full_name) VALUES ($1, $2)', [account.rows[0].id, identity.name]);
          await client.query('INSERT INTO notification_preferences(user_id) VALUES ($1)', [account.rows[0].id]);
          await client.query(`INSERT INTO auth_identities(user_id, provider, provider_subject) VALUES ($1, 'GOOGLE', $2)`, [account.rows[0].id, identity.subject]);
          await client.query(`INSERT INTO audit_logs(actor_user_id, action, resource_type, resource_id) VALUES ($1, 'ACCOUNT_REGISTERED_GOOGLE', 'USER', $1)`, [account.rows[0].id]);
        }
      }
      if (!account.rowCount || account.rows[0].disabled_at) throw new Error('Account is unavailable.');
      sessionToken = randomBytes(32).toString('base64url');
      expiresAt = new Date(Date.now() + env.sessionTtlHours * 60 * 60 * 1000);
      await client.query('INSERT INTO user_sessions(user_id, token_hash, expires_at) VALUES ($1, $2, $3)', [account.rows[0].id, hashSessionToken(sessionToken), expiresAt]);
      await client.query(`INSERT INTO audit_logs(actor_user_id, action, resource_type, resource_id) VALUES ($1, 'SESSION_CREATED_GOOGLE', 'USER', $1)`, [account.rows[0].id]);
      await client.query('COMMIT');
    } catch (error) { await client.query('ROLLBACK'); throw error; }
    finally { client.release(); }
    setSessionCookie(res, sessionToken, expiresAt, env.nodeEnv === 'production');
    return res.redirect(`${frontendUrl()}/login?google=success`);
  } catch (error) {
    console.error('Google sign-in failed', { errorType: error instanceof Error ? error.name : 'UnknownError' });
    return googleError(res, 'google_signin_failed');
  }
}));

async function twilioVerify(path: 'Verifications' | 'VerificationCheck', fields: Record<string, string>) {
  if (!env.twilioAccountSid || !env.twilioAuthToken || !env.twilioVerifyServiceSid) throw new HttpError(503, 'Phone sign-in is not configured yet.');
  const authorization = Buffer.from(`${env.twilioAccountSid}:${env.twilioAuthToken}`).toString('base64');
  const response = await externalFetch(`https://verify.twilio.com/v2/Services/${encodeURIComponent(env.twilioVerifyServiceSid)}/${path}`, {
    method: 'POST', headers: { Authorization: `Basic ${authorization}`, 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams(fields),
  });
  const payload = await response.json().catch(() => ({})) as { status?: string };
  if (!response.ok) throw new HttpError(response.status === 429 ? 429 : 503, response.status === 429 ? 'Too many code requests. Try again shortly.' : 'Phone sign-in is temporarily unavailable.');
  return payload;
}

router.post('/phone/send-code', phoneSendLimit, asyncRoute(async (req, res) => {
  const phone = requiredString(req.body?.phone, 'phone number', 16);
  if (!e164Pattern.test(phone)) throw new HttpError(400, 'Enter a phone number in international format, such as +14155552671.');
  await twilioVerify('Verifications', { To: phone, Channel: 'sms' });
  return res.json({ message: 'If the number can sign in, a verification code has been sent.' });
}));

router.post('/phone/verify-code', phoneVerifyLimit, asyncRoute(async (req, res) => {
  const phone = requiredString(req.body?.phone, 'phone number', 16);
  const code = requiredString(req.body?.code, 'verification code', 10);
  if (!e164Pattern.test(phone) || !/^\d{4,10}$/.test(code)) throw new HttpError(400, 'Enter a valid phone number and verification code.');
  const verification = await twilioVerify('VerificationCheck', { To: phone, Code: code });
  if (verification.status !== 'approved') throw new HttpError(401, 'The phone number or verification code is incorrect.');
  const fullName = typeof req.body?.fullName === 'string' ? req.body.fullName.trim() : '';
  const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    let result = await client.query(`SELECT u.id, u.email, u.role, u.disabled_at, p.full_name, d.display_name FROM users u LEFT JOIN patients p ON p.user_id = u.id LEFT JOIN doctors d ON d.user_id = u.id WHERE u.phone = $1 FOR UPDATE OF u`, [phone]);
    if (!result.rowCount) {
      if (!fullName || fullName.length > 120 || !emailPattern.test(email) || email.length > 254) throw new HttpError(400, 'This number has no account yet. Enter your name and email to create a patient account.');
      const randomPasswordHash = await bcrypt.hash(randomBytes(48).toString('base64url'), 12);
      const inserted = await client.query(`INSERT INTO users(email, phone, phone_verified_at, password_hash, role) VALUES ($1, $2, now(), $3, 'PATIENT') RETURNING id, email, role, disabled_at`, [email, phone, randomPasswordHash]);
      await client.query('INSERT INTO patients(user_id, full_name) VALUES ($1, $2)', [inserted.rows[0].id, fullName]);
      await client.query('INSERT INTO notification_preferences(user_id) VALUES ($1)', [inserted.rows[0].id]);
      await client.query(`INSERT INTO audit_logs(actor_user_id, action, resource_type, resource_id) VALUES ($1, 'ACCOUNT_REGISTERED_PHONE', 'USER', $1)`, [inserted.rows[0].id]);
      result = await client.query(`SELECT u.id, u.email, u.role, u.disabled_at, p.full_name, d.display_name FROM users u LEFT JOIN patients p ON p.user_id = u.id LEFT JOIN doctors d ON d.user_id = u.id WHERE u.id = $1`, [inserted.rows[0].id]);
    } else if (!result.rows[0].phone_verified_at) {
      await client.query('UPDATE users SET phone_verified_at = now() WHERE id = $1', [result.rows[0].id]);
    }
    if (!result.rowCount || result.rows[0].disabled_at) throw new HttpError(401, 'The phone number or verification code is incorrect.');
    const token = randomBytes(32).toString('base64url');
    const expiresAt = new Date(Date.now() + env.sessionTtlHours * 60 * 60 * 1000);
    await client.query('INSERT INTO user_sessions (user_id, token_hash, expires_at) VALUES ($1, $2, $3)', [result.rows[0].id, hashSessionToken(token), expiresAt]);
    await client.query(`INSERT INTO audit_logs(actor_user_id, action, resource_type, resource_id) VALUES ($1, 'SESSION_CREATED_PHONE', 'USER', $1)`, [result.rows[0].id]);
    await client.query('COMMIT');
    setSessionCookie(res, token, expiresAt, env.nodeEnv === 'production');
    return res.json({ user: safeUser(result.rows[0]) });
  } catch (error) { await client.query('ROLLBACK'); throw error; }
  finally { client.release(); }
}));

router.post('/phone/link/send-code', requireAuth, phoneSendLimit, asyncRoute(async (req, res) => {
  const phone = requiredString(req.body?.phone, 'phone number', 16);
  if (!e164Pattern.test(phone)) throw new HttpError(400, 'Enter a phone number in international format, such as +14155552671.');
  await twilioVerify('Verifications', { To: phone, Channel: 'sms' });
  return res.json({ message: 'If the number can be linked, a verification code has been sent.' });
}));

router.post('/phone/link/verify-code', requireAuth, phoneVerifyLimit, asyncRoute(async (req, res) => {
  const phone = requiredString(req.body?.phone, 'phone number', 16);
  const code = requiredString(req.body?.code, 'verification code', 10);
  if (!e164Pattern.test(phone) || !/^\d{4,10}$/.test(code)) throw new HttpError(400, 'Enter a valid phone number and verification code.');
  const verification = await twilioVerify('VerificationCheck', { To: phone, Code: code });
  if (verification.status !== 'approved') throw new HttpError(401, 'The phone number or verification code is incorrect.');
  await pool.query('UPDATE users SET phone = $1, phone_verified_at = now() WHERE id = $2', [phone, req.user!.id]);
  await pool.query(`INSERT INTO audit_logs(actor_user_id, action, resource_type, resource_id) VALUES ($1, 'PHONE_NUMBER_VERIFIED', 'USER', $1)`, [req.user!.id]);
  return res.json({ message: 'Phone number verified and linked to your account.' });
}));

router.post('/forgot-password', passwordResetRequestLimit, asyncRoute(async (req, res) => {
  // Check configuration before looking up the account so configuration errors
  // cannot reveal whether an email has an account.
  if (!env.resendApiKey || !env.resendFromEmail) throw new HttpError(503, 'Password reset email is not configured yet.');
  const generic = { message: 'If an account exists for that email, password reset instructions will be sent shortly.' };
  const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
  if (!emailPattern.test(email) || email.length > 254) return res.json(generic);
  const account = await pool.query(`SELECT u.id,u.email,COALESCE(p.full_name,d.display_name,'there') AS full_name
    FROM users u LEFT JOIN patients p ON p.user_id=u.id LEFT JOIN doctors d ON d.user_id=u.id
    WHERE lower(u.email)=$1 AND u.disabled_at IS NULL`, [email]);
  if (!account.rowCount) return res.json(generic);

  const token = randomBytes(32).toString('base64url');
  const tokenHash = createHash('sha256').update(token).digest('hex');
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('DELETE FROM password_reset_tokens WHERE user_id=$1', [account.rows[0].id]);
    await client.query(`INSERT INTO password_reset_tokens(user_id,token_hash,expires_at)
      VALUES($1,$2,now()+interval '30 minutes')`, [account.rows[0].id, tokenHash]);
    await client.query('COMMIT');
  } catch (error) { await client.query('ROLLBACK'); throw error; }
  finally { client.release(); }

  try {
    await sendPasswordResetEmail(account.rows[0].email, account.rows[0].full_name, token);
  } catch {
    // Keep the response indistinguishable for existing and unknown accounts.
    await pool.query('DELETE FROM password_reset_tokens WHERE token_hash=$1', [tokenHash]);
  }
  return res.json(generic);
}));

router.post('/reset-password', passwordResetSubmitLimit, asyncRoute(async (req, res) => {
  const token = typeof req.body?.token === 'string' ? req.body.token : '';
  if (token.length < 32 || token.length > 100) throw new HttpError(400, 'This reset link is invalid or has expired. Request a new one.');
  const password = newPassword(req.body?.password);
  const passwordHash = await bcrypt.hash(password, 12);
  const tokenHash = createHash('sha256').update(token).digest('hex');
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const reset = await client.query(`SELECT t.id,t.user_id FROM password_reset_tokens t JOIN users u ON u.id=t.user_id
      WHERE t.token_hash=$1 AND t.used_at IS NULL AND t.expires_at>now() AND u.disabled_at IS NULL FOR UPDATE OF t,u`, [tokenHash]);
    if (!reset.rowCount) throw new HttpError(400, 'This reset link is invalid or has expired. Request a new one.');
    const userId = reset.rows[0].user_id as string;
    await client.query('UPDATE users SET password_hash=$1,email_verified_at=COALESCE(email_verified_at,now()),updated_at=now() WHERE id=$2', [passwordHash, userId]);
    await client.query('UPDATE password_reset_tokens SET used_at=now() WHERE id=$1', [reset.rows[0].id]);
    await client.query('DELETE FROM password_reset_tokens WHERE user_id=$1 AND id<>$2', [userId, reset.rows[0].id]);
    await client.query('DELETE FROM user_sessions WHERE user_id=$1', [userId]);
    await client.query(`INSERT INTO audit_logs(actor_user_id,action,resource_type,resource_id,metadata)
      VALUES($1,'PASSWORD_RESET','USER',$1,'{}')`, [userId]);
    await client.query('COMMIT');
  } catch (error) { await client.query('ROLLBACK'); throw error; }
  finally { client.release(); }
  return res.json({ message: 'Your password has been reset. Sign in with your new password.' });
}));

router.post('/register', authLimit, asyncRoute(async (req, res) => {
  const fullName = requiredString(req.body?.fullName, 'name', 120);
  const email = requiredString(req.body?.email, 'email', 254).toLowerCase();
  const password = newPassword(req.body?.password);
  if (!emailPattern.test(email)) throw new HttpError(400, 'Enter a valid email address.');
  const passwordHash = await bcrypt.hash(password, 12);
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const user = await client.query(`INSERT INTO users (email, password_hash, role) VALUES ($1, $2, 'PATIENT') RETURNING id, email, role`, [email, passwordHash]);
    const patient = await client.query('INSERT INTO patients (user_id, full_name) VALUES ($1, $2) RETURNING full_name', [user.rows[0].id, fullName]);
    await client.query('INSERT INTO notification_preferences (user_id) VALUES ($1)', [user.rows[0].id]);
    const token = randomBytes(32).toString('base64url');
    const expiresAt = new Date(Date.now() + env.sessionTtlHours * 60 * 60 * 1000);
    await client.query('INSERT INTO user_sessions (user_id, token_hash, expires_at) VALUES ($1, $2, $3)', [user.rows[0].id, hashSessionToken(token), expiresAt]);
    await client.query('INSERT INTO audit_logs (actor_user_id, action, resource_type, resource_id) VALUES ($1, $2, $3, $1)', [user.rows[0].id, 'ACCOUNT_REGISTERED', 'USER']);
    await client.query('COMMIT');
    setSessionCookie(res, token, expiresAt, env.nodeEnv === 'production');
    return res.status(201).json({ user: { ...safeUser(user.rows[0]), fullName: patient.rows[0].full_name } });
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally { client.release(); }
}));

router.post('/login', authLimit, asyncRoute(async (req, res) => {
  const email = requiredString(req.body?.email, 'email', 254).toLowerCase();
  if (!emailPattern.test(email)) throw new HttpError(401, 'Email or password is incorrect.');
  const password = req.body?.password;
  if (typeof password !== 'string' || password.length < 1 || password.length > 72 || Buffer.byteLength(password, 'utf8') > 72) throw new HttpError(401, 'Email or password is incorrect.');
  const found = await pool.query(
    `SELECT u.id, u.email, u.password_hash, u.role, u.disabled_at,
            p.full_name, d.display_name
       FROM users u LEFT JOIN patients p ON p.user_id = u.id
       LEFT JOIN doctors d ON d.user_id = u.id WHERE lower(u.email) = $1`, [email],
  );
  const valid = await bcrypt.compare(password, found.rowCount ? found.rows[0].password_hash : await dummyPasswordHash);
  if (!found.rowCount || !valid || found.rows[0].disabled_at) throw new HttpError(401, 'Email or password is incorrect.');
  const { token, expiresAt } = await createSession(found.rows[0].id);
  await pool.query('INSERT INTO audit_logs (actor_user_id, action, resource_type, resource_id) VALUES ($1, $2, $3, $1)', [found.rows[0].id, 'SESSION_CREATED', 'USER']);
  setSessionCookie(res, token, expiresAt, env.nodeEnv === 'production');
  return res.json({ user: safeUser(found.rows[0]) });
}));

router.post('/logout', asyncRoute(async (req, res) => {
  const token = req.cookies?.atelier_session;
  if (typeof token === 'string' && token.length >= 40 && token.length <= 100) {
    await pool.query('DELETE FROM user_sessions WHERE token_hash = $1', [hashSessionToken(token)]);
  }
  clearSessionCookie(res, env.nodeEnv === 'production');
  return res.status(204).end();
}));

router.get('/me', requireAuth, asyncRoute(async (req, res) => {
  const user = req.user!;
  const result = user.patientId
    ? await pool.query('SELECT full_name FROM patients WHERE id = $1', [user.patientId])
    : user.doctorId ? await pool.query('SELECT display_name AS full_name FROM doctors WHERE id = $1', [user.doctorId]) : { rows: [] };
  return res.json({ user: { id: user.id, email: user.email, role: user.role, fullName: result.rows[0]?.full_name ?? null } });
}));

export default router;
