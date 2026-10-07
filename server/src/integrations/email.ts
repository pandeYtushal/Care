import { env } from '../config/env';
import { HttpError } from '../http';
import { externalFetch } from './http';

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]!);
}

export async function sendPasswordResetEmail(email: string, fullName: string, token: string) {
  if (!env.resendApiKey || !env.resendFromEmail) throw new HttpError(503, 'Password reset email is not configured yet.');
  const origin = env.allowedOrigins[0] ?? 'http://localhost:5173';
  const resetUrl = `${origin}/reset-password?token=${encodeURIComponent(token)}`;
  const name = escapeHtml(fullName || 'there');
  const response = await externalFetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${env.resendApiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: env.resendFromEmail,
      to: [email],
      subject: 'Reset your Atelier Care password',
      html: `<div style="font-family:Arial,sans-serif;color:#293833;max-width:560px;margin:auto;padding:28px"><p style="color:#527a60;font-weight:700">ATELIER CARE</p><h1 style="font-size:24px">Reset your password</h1><p>Hello ${name},</p><p>We received a request to reset the password for your Atelier Care account. This secure link expires in 30 minutes and can only be used once.</p><p style="margin:28px 0"><a href="${resetUrl}" style="background:#47775f;color:white;text-decoration:none;padding:13px 19px;border-radius:7px">Choose a new password</a></p><p>If you didn’t request this, you can ignore this email. Your password will not change.</p><p style="font-size:12px;color:#78867d;word-break:break-all">If the button does not work, copy this link:<br>${resetUrl}</p></div>`,
      text: `Hello ${fullName || 'there'},\n\nWe received a request to reset your Atelier Care password. This link expires in 30 minutes and can only be used once:\n${resetUrl}\n\nIf you did not request this, ignore this email.`,
    }),
  });
  if (!response.ok) {
    // Do not log the recipient, reset URL, token, or provider response body.
    console.error('Password reset email provider rejected a request', { status: response.status });
    throw new HttpError(503, 'Password reset email could not be sent. Try again later.');
  }
}
