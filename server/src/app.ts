import cors from 'cors';
import express from 'express';
import { randomUUID } from 'node:crypto';
import { env } from './config/env';
import { pool } from './db';
import { errorHandler, HttpError } from './http';
import { rateLimit } from './middleware/rateLimit';
import { cookieParser } from './middleware/cookies';
import authRouter from './routes/auth';
import portalRouter from './routes/portal';
import bookingRouter from './routes/booking';
import integrationsRouter from './routes/integrations';

export const app = express();
app.disable('x-powered-by');
app.set('trust proxy', env.trustProxyHops);
app.use((req, res, next) => {
  res.setHeader('X-Request-Id', randomUUID());
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  res.setHeader('Cross-Origin-Resource-Policy', 'same-site');
  res.setHeader('X-Permitted-Cross-Domain-Policies', 'none');
  res.setHeader('Content-Security-Policy', "default-src 'none'; base-uri 'none'; frame-ancestors 'none'");
  res.setHeader('Cache-Control', 'no-store');
  if (env.nodeEnv === 'production') res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  next();
});
app.use('/api', rateLimit(120, 60_000));
app.use(cors({
  origin(origin, callback) {
    if (!origin || env.allowedOrigins.includes(origin)) return callback(null, true);
    return callback(new HttpError(403, 'Origin is not allowed by CORS.'));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'X-Requested-With', 'X-Upload-Name', 'X-Upload-Category', 'X-Appointment-Id'],
  maxAge: 600,
}));
app.use((req, res, next) => {
  if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) {
    const origin = req.get('origin');
    if (!origin || !env.allowedOrigins.includes(origin)) return res.status(403).json({ error: { message: 'Request origin is not allowed.' } });
    const isPrivateRecordUpload=req.path==='/api/portal/records'&&req.method==='POST'&&Boolean(req.is(['application/pdf','image/jpeg','image/png']));
    if (!req.is('application/json')&&!isPrivateRecordUpload) return res.status(415).json({ error: { message: 'Unsupported request content type.' } });
  }
  next();
});
app.use(express.json({ limit: '64kb', strict: true }));
app.use('/api/portal/records', express.raw({ type: ['application/pdf','image/jpeg','image/png'], limit: '8mb' }));
app.use(cookieParser);
app.get('/api/health', (_req, res) => res.json({ status: 'ok' }));
app.get('/api/ready', async (_req, res) => {
  try { await pool.query('SELECT 1'); return res.json({ status: 'ready' }); }
  catch { return res.status(503).json({ error: { message: 'Service is not ready.' } }); }
});
app.use('/api/auth', authRouter);
app.use('/api/portal', portalRouter);
app.use('/api/booking', bookingRouter);
app.use('/api/integrations', integrationsRouter);
app.use((_req, res) => res.status(404).json({ error: { message: 'Not found.' } }));
app.use(errorHandler);
