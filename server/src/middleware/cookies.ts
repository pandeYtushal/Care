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
  // SameSite=None is required for cross-domain cookies (Vercel -> Render)
  res.append('Set-Cookie', `atelier_session=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=None; Expires=${expiresAt.toUTCString()}${secure ? '; Secure' : ''}`);
}

export function clearSessionCookie(res: Response, secure: boolean) {
  res.append('Set-Cookie', `atelier_session=; Path=/; HttpOnly; SameSite=None; Expires=Thu, 01 Jan 1970 00:00:00 GMT${secure ? '; Secure' : ''}`);
}
