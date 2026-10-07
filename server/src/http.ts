import type { NextFunction, Request, Response } from 'express';

export class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
    this.name = 'HttpError';
  }
}

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export function requiredUuid(value: unknown, label = 'id'): string {
  if (typeof value !== 'string' || !uuidPattern.test(value)) throw new HttpError(400, `Enter a valid ${label}.`);
  return value;
}

export function asyncRoute(fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>) {
  return (req: Request, res: Response, next: NextFunction) => { void fn(req, res, next).catch(next); };
}

export function errorHandler(error: unknown, req: Request, res: Response, _next: NextFunction) {
  if (error instanceof HttpError) return res.status(error.status).json({ error: { message: error.message } });
  if (error && typeof error === 'object' && 'code' in error && error.code === '23505') {
    return res.status(409).json({ error: { message: 'This account already exists.' } });
  }
  const status = error && typeof error === 'object' && 'status' in error && typeof error.status === 'number' ? error.status : 500;
  if (status === 400) return res.status(400).json({ error: { message: 'The request could not be processed.' } });
  if (status === 413) return res.status(413).json({ error: { message: 'The request is too large.' } });
  const candidateCode = error && typeof error === 'object' && 'code' in error ? error.code : undefined;
  const safeCode = typeof candidateCode === 'string' && /^[A-Z0-9]{5}$/.test(candidateCode) ? candidateCode : undefined;
  console.error('Unhandled API error', {
    requestId: res.getHeader('X-Request-Id'),
    method: req.method,
    errorType: error instanceof Error ? error.name : 'UnknownError',
    ...(safeCode ? { code: safeCode } : {}),
  });
  return res.status(500).json({ error: { message: 'An unexpected error occurred.' } });
}
