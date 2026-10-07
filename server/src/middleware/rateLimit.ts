import type { NextFunction, Request, Response } from 'express';
import { createHash } from 'node:crypto';

type Bucket = { count: number; resetAt: number };
export function rateLimit(max: number, windowMs: number, identity?: (req: Request) => string) {
  const buckets = new Map<string, Bucket>();
  let lastCleanup = Date.now();
  return (req: Request, res: Response, next: NextFunction) => {
    const now = Date.now();
    if (now - lastCleanup > windowMs) {
      for (const [key, bucket] of buckets) if (bucket.resetAt <= now) buckets.delete(key);
      lastCleanup = now;
    }
    const identityKey = identity?.(req);
    const key = `${req.ip}:${req.baseUrl}${req.path}${identityKey ? `:${createHash('sha256').update(identityKey).digest('hex')}` : ''}`;
    const bucket = buckets.get(key);
    if (!bucket || bucket.resetAt <= now) buckets.set(key, { count: 1, resetAt: now + windowMs });
    else bucket.count += 1;
    const current = buckets.get(key)!;
    res.setHeader('RateLimit-Limit', max);
    res.setHeader('RateLimit-Remaining', Math.max(0, max - current.count));
    if (current.count > max) {
      res.setHeader('Retry-After', Math.ceil((current.resetAt - now) / 1000));
      return res.status(429).json({ error: { message: 'Too many requests. Try again shortly.' } });
    }
    next();
  };
}
