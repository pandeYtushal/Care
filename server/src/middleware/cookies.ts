import type { NextFunction, Request, Response } from 'express';
declare global { namespace Express { interface Request { cookies?: Record<string, string> } } }

export function cookieParser(_req: Request, _res: Response, next: NextFunction) {
  const cookies: Record<string, string> = {};
  for (const part of (_req.headers.cookie ?? '').split(';')) {
    const separator = part.indexOf('=');
    if (separator < 1) continue;
    const key = part.slice(0, separator).trim();
    try { cookies[key] = decodeURIComponent(part.slice(separator + 1).trim()); } catch { /* Ignore malformed cookies. */ }
  }
  _req.cookies = cookies;
  next();
}

export function setSessionCookie(res: Response, token: string, expiresAt: Date, secure: boolean) {
  // Cross-site Vercel -> Render sessions need None; localhost must use Lax
  // because browsers reject SameSite=None cookies unless they are Secure.
  const sameSite = secure ? 'None' : 'Lax';
  res.append('Set-Cookie', `atelier_session=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=${sameSite}; Expires=${expiresAt.toUTCString()}${secure ? '; Secure' : ''}`);
}

export function clearSessionCookie(res: Response, secure: boolean) {
  const sameSite = secure ? 'None' : 'Lax';
  res.append('Set-Cookie', `atelier_session=; Path=/; HttpOnly; SameSite=${sameSite}; Expires=Thu, 01 Jan 1970 00:00:00 GMT${secure ? '; Secure' : ''}`);
}
