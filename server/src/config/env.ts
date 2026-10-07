import dotenv from 'dotenv';

dotenv.config();

function required(name: string, minimum = 1): string {
  const value = process.env[name]?.trim();
  if (!value || value.length < minimum) {
    throw new Error(`Missing or invalid required environment variable: ${name}`);
  }
  return value;
}

const nodeEnv = required('NODE_ENV');
if (!['development', 'test', 'production'].includes(nodeEnv)) throw new Error('NODE_ENV must be development, test, or production.');
const rawOrigins = process.env.APP_ORIGINS ?? '';
const allowedOrigins = rawOrigins.split(',').map((origin) => origin.trim()).filter(Boolean);

if (nodeEnv === 'production' && allowedOrigins.length === 0) {
  throw new Error('APP_ORIGINS must contain the production frontend origin(s).');
}
for (const origin of allowedOrigins) {
  let parsed: URL;
  try { parsed = new URL(origin); } catch { throw new Error('APP_ORIGINS must contain exact HTTP(S) origins only.'); }
  if (!['http:', 'https:'].includes(parsed.protocol) || parsed.origin !== origin || parsed.username || parsed.password || origin === '*') {
    throw new Error('APP_ORIGINS must contain exact HTTP(S) origins only, without paths or credentials.');
  }
  if (nodeEnv === 'production' && parsed.protocol !== 'https:') throw new Error('Production APP_ORIGINS must use HTTPS.');
}

export const env = Object.freeze({
  nodeEnv,
  port: Number(required('PORT')),
  databaseUrl: required('DATABASE_URL'),
  allowedOrigins,
  sessionTtlHours: Number(process.env.SESSION_TTL_HOURS ?? 168),
  trustProxyHops: Number(process.env.TRUST_PROXY_HOPS ?? 0),
  googleClientId: process.env.GOOGLE_CLIENT_ID?.trim() ?? '',
  googleClientSecret: process.env.GOOGLE_CLIENT_SECRET?.trim() ?? '',
  googleRedirectUri: process.env.GOOGLE_REDIRECT_URI?.trim() ?? '',
  googleCalendarRedirectUri: process.env.GOOGLE_CALENDAR_REDIRECT_URI?.trim() ?? '',
  googleTokenEncryptionKey: process.env.GOOGLE_TOKEN_ENCRYPTION_KEY?.trim() ?? '',
  twilioAccountSid: process.env.TWILIO_ACCOUNT_SID?.trim() ?? '',
  twilioAuthToken: process.env.TWILIO_AUTH_TOKEN?.trim() ?? '',
  twilioVerifyServiceSid: process.env.TWILIO_VERIFY_SERVICE_SID?.trim() ?? '',
  resendApiKey: process.env.RESEND_API_KEY?.trim() ?? '',
  resendFromEmail: process.env.RESEND_FROM_EMAIL?.trim() ?? '',
});

const googleValues = [env.googleClientId, env.googleClientSecret, env.googleRedirectUri];
if (googleValues.some(Boolean) && googleValues.some((value) => !value)) {
  throw new Error('Set GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, and GOOGLE_REDIRECT_URI together.');
}
if (env.googleRedirectUri) {
  let redirect: URL;
  try { redirect = new URL(env.googleRedirectUri); } catch { throw new Error('GOOGLE_REDIRECT_URI must be an absolute URL.'); }
  if (!['http:', 'https:'].includes(redirect.protocol) || (nodeEnv === 'production' && redirect.protocol !== 'https:')) {
    throw new Error('GOOGLE_REDIRECT_URI must use HTTPS in production.');
  }
  if (allowedOrigins.length && !allowedOrigins.includes(redirect.origin)) {
    throw new Error('GOOGLE_REDIRECT_URI must use an origin listed in APP_ORIGINS so the session cookie returns to the app.');
  }
}
if (env.googleCalendarRedirectUri) {
  let redirect: URL;
  try { redirect = new URL(env.googleCalendarRedirectUri); } catch { throw new Error('GOOGLE_CALENDAR_REDIRECT_URI must be an absolute URL.'); }
  if (!['http:', 'https:'].includes(redirect.protocol) || (nodeEnv === 'production' && redirect.protocol !== 'https:')) throw new Error('GOOGLE_CALENDAR_REDIRECT_URI must use HTTPS in production.');
  if (allowedOrigins.length && !allowedOrigins.includes(redirect.origin)) throw new Error('GOOGLE_CALENDAR_REDIRECT_URI must use an origin listed in APP_ORIGINS.');
}
if (env.googleTokenEncryptionKey && env.googleTokenEncryptionKey.length < 32) throw new Error('GOOGLE_TOKEN_ENCRYPTION_KEY must contain at least 32 characters.');
const twilioValues = [env.twilioAccountSid, env.twilioAuthToken, env.twilioVerifyServiceSid];
if (twilioValues.some(Boolean) && twilioValues.some((value) => !value)) {
  throw new Error('Set TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, and TWILIO_VERIFY_SERVICE_SID together.');
}
if (Boolean(env.resendApiKey) !== Boolean(env.resendFromEmail)) throw new Error('Set RESEND_API_KEY and RESEND_FROM_EMAIL together.');
if (env.resendFromEmail && !/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(env.resendFromEmail.replace(/^.*<([^<>]+)>$/, '$1'))) {
  throw new Error('RESEND_FROM_EMAIL must be a valid verified sender address.');
}

if (!Number.isInteger(env.port) || env.port < 1 || env.port > 65535) throw new Error('PORT must be a valid TCP port.');
if (!Number.isInteger(env.sessionTtlHours) || env.sessionTtlHours < 1 || env.sessionTtlHours > 720) throw new Error('SESSION_TTL_HOURS must be between 1 and 720.');
if (!Number.isInteger(env.trustProxyHops) || env.trustProxyHops < 0 || env.trustProxyHops > 5) throw new Error('TRUST_PROXY_HOPS must be an integer between 0 and 5.');
