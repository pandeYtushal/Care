import { readdir, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pool } from '../db';

const migrationDir = resolve(__dirname, '../../../database/migrations');
async function migrate() {
const client = await pool.connect();
try {
  await client.query('SELECT pg_advisory_lock(741902614)');
  await client.query('CREATE TABLE IF NOT EXISTS schema_migrations (name text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())');
  const applied = new Set((await client.query<{name:string}>('SELECT name FROM schema_migrations')).rows.map((row) => row.name));
  const files = (await readdir(migrationDir)).filter((file) => /^\d+_[a-z0-9_-]+\.sql$/i.test(file)).sort();
  for (const file of files) {
    if (applied.has(file)) continue;
    const sql = await readFile(resolve(migrationDir, file), 'utf8');
    await client.query('BEGIN');
    try {
      await client.query(sql);
      await client.query('INSERT INTO schema_migrations (name) VALUES ($1)', [file]);
      await client.query('COMMIT');
      console.log(`Applied ${file}`);
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    }
  }
} finally {
  await client.query('SELECT pg_advisory_unlock(741902614)').catch(() => undefined);
  client.release();
  await pool.end();
}
}
void migrate().catch((error: unknown) => { console.error('Migration failed', error instanceof Error ? error.message : error); process.exitCode = 1; });
