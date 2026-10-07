import { app } from './app';
import { env } from './config/env';
import { pool } from './db';

const server = app.listen(env.port, '0.0.0.0', () => {
  console.log(`Atelier Care API listening on port ${env.port} (${env.nodeEnv})`);
});

async function shutdown(signal: string) {
  console.log(`Received ${signal}; shutting down.`);
  server.close(async () => {
    await pool.end();
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 10_000).unref();
}
process.on('SIGTERM', () => void shutdown('SIGTERM'));
process.on('SIGINT', () => void shutdown('SIGINT'));
