import { createHash } from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';
import { pool } from '../db';

export type Role = 'PATIENT' | 'DOCTOR' | 'ADMIN';
export type AuthUser = { id: string; role: Role; email: string; patientId: string | null; doctorId: string | null; sessionId: string };
declare global { namespace Express { interface Request { user?: AuthUser } } }

export const SESSION_COOKIE = 'atelier_session';
export const hashSessionToken = (token: string) => createHash('sha256').update(token).digest('hex');

export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  try {
    const token = req.cookies?.[SESSION_COOKIE];
    if (typeof token !== 'string' || token.length < 40 || token.length > 100) {
      return res.status(401).json({ error: { message: 'Sign in to continue.' } });
    }
    const result = await pool.query(
      `SELECT s.id AS session_id, u.id, u.email, u.role,
              p.id AS patient_id, d.id AS doctor_id
         FROM user_sessions s JOIN users u ON u.id = s.user_id
         LEFT JOIN patients p ON p.user_id = u.id
         LEFT JOIN doctors d ON d.user_id = u.id
        WHERE s.token_hash = $1 AND s.expires_at > now() AND u.disabled_at IS NULL`,
      [hashSessionToken(token)],
    );
    if (!result.rowCount) return res.status(401).json({ error: { message: 'Your session has expired. Sign in again.' } });
    const row = result.rows[0];
    req.user = { id: row.id, role: row.role, email: row.email, patientId: row.patient_id, doctorId: row.doctor_id, sessionId: row.session_id };
    return next();
  } catch (error) { return next(error); }
}

export function requireRole(...roles: Role[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) return res.status(401).json({ error: { message: 'Sign in to continue.' } });
    if (!roles.includes(req.user.role)) return res.status(403).json({ error: { message: 'You do not have access to this resource.' } });
    return next();
  };
}
