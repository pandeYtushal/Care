import bcrypt from 'bcrypt';
import { pool } from '../db';

async function provision() {
  const email = process.env.DOCTOR_EMAIL?.trim().toLowerCase();
  const fullName = process.env.DOCTOR_NAME?.trim();
  const password = process.env.DOCTOR_PASSWORD;
  const phone = process.env.DOCTOR_PHONE?.trim() || null;
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('Set a valid DOCTOR_EMAIL in the server environment.');
  if (!fullName || fullName.length > 120) throw new Error('Set DOCTOR_NAME (maximum 120 characters).');
  if (phone && !/^\+[1-9]\d{7,14}$/.test(phone)) throw new Error('Set DOCTOR_PHONE in E.164 format, such as +14155552671, or leave it blank.');
  if (!password || password.length < 12 || password.length > 72 || Buffer.byteLength(password, 'utf8') > 72 || !/[a-z]/.test(password) || !/[A-Z]/.test(password) || !/[0-9]/.test(password)) {
    throw new Error('Set a DOCTOR_PASSWORD of 12–72 characters with uppercase, lowercase, and a number.');
  }
  const passwordHash = await bcrypt.hash(password, 12);
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const existing = await client.query('SELECT id FROM users WHERE lower(email) = $1 FOR UPDATE', [email]);
    if (existing.rowCount) throw new Error('A user with this email already exists. Use a separate, controlled provisioning process for existing accounts.');
    const result = await client.query(`INSERT INTO users(email, phone, password_hash, role) VALUES ($1, $2, $3, 'DOCTOR') RETURNING id`, [email, phone, passwordHash]);
    await client.query('INSERT INTO doctors(user_id, display_name) VALUES ($1, $2)', [result.rows[0].id, fullName]);
    await client.query('INSERT INTO notification_preferences(user_id) VALUES ($1)', [result.rows[0].id]);
    await client.query(`INSERT INTO audit_logs(actor_user_id, action, resource_type, resource_id, metadata)
      VALUES (NULL, 'DOCTOR_ACCOUNT_PROVISIONED', 'USER', $1, '{"source":"controlled-cli"}')`, [result.rows[0].id]);
    await client.query('COMMIT');
    console.log('Doctor account provisioned. Sign in through the portal login form.');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally { client.release(); await pool.end(); }
}

void provision().catch((error: unknown) => {
  console.error('Doctor provisioning failed:', error instanceof Error ? error.message : 'Unknown error');
  process.exitCode = 1;
  void pool.end();
});
