import { Pool } from 'pg';
import { env } from './config/env';

export const pool = new Pool({
  connectionString: env.databaseUrl,
  max: 10,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 5_000,
  ssl: env.nodeEnv === 'production' ? { rejectUnauthorized: true } : undefined,
});

pool.on('error', (error) => {
  const code = 'code' in error && typeof error.code === 'string' ? error.code : undefined;
  console.error('Unexpected idle database connection error', {
    errorType: error.name,
    ...(code ? { code } : {}),
  });
});
