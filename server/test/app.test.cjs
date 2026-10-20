const { before, after, test } = require('node:test');
const assert = require('node:assert/strict');

process.env.NODE_ENV = 'test';
process.env.PORT = '5000';
process.env.DATABASE_URL = 'postgresql://invalid:invalid@127.0.0.1:5432/unused';
process.env.APP_ORIGINS = 'http://localhost:5173';
process.env.GOOGLE_CLIENT_ID = '';
process.env.GOOGLE_CLIENT_SECRET = '';
process.env.GOOGLE_REDIRECT_URI = '';
process.env.GOOGLE_CALENDAR_REDIRECT_URI = '';

const { app } = require('../dist/app.js');
const { HttpError, requiredUuid } = require('../dist/http.js');
const { pool } = require('../dist/db.js');
const { profileNameForRole } = require('../dist/auth/identity.js');
const { externalFetch } = require('../dist/integrations/http.js');
let server;
let origin;
before(async () => {
  server = app.listen(0, '127.0.0.1');
  await new Promise((resolve, reject) => { server.once('listening', resolve); server.once('error', reject); });
  origin = `http://127.0.0.1:${server.address().port}`;
});
after(async () => { await new Promise((resolve) => server.close(resolve)); });

test('health endpoint returns liveness and security headers', async () => {
  const response = await fetch(`${origin}/api/health`);
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { status: 'ok' });
  assert.equal(response.headers.get('x-content-type-options'), 'nosniff');
  assert.equal(response.headers.get('x-frame-options'), 'DENY');
  assert.match(response.headers.get('x-request-id') ?? '', /^[0-9a-f-]{36}$/i);
});

test('CORS allows only the configured exact origin', async () => {
  const allowed = await fetch(`${origin}/api/health`, { headers: { Origin: 'http://localhost:5173' } });
  assert.equal(allowed.headers.get('access-control-allow-origin'), 'http://localhost:5173');
  assert.equal(allowed.headers.get('access-control-allow-credentials'), 'true');
  const denied = await fetch(`${origin}/api/health`, { headers: { Origin: 'https://attacker.example' } });
  assert.equal(denied.status, 403);
  assert.equal(denied.headers.get('access-control-allow-origin'), null);
});

test('an unauthenticated auth check returns a normal 401 without querying a session', async () => {
  const response = await fetch(`${origin}/api/auth/me`);
  assert.equal(response.status, 401);
  assert.deepEqual(await response.json(), { error: { message: 'Sign in to continue.' } });
});

test('Google sign-in start reports missing provider configuration safely', async () => {
  const response = await fetch(`${origin}/api/auth/google`, { redirect: 'manual' });
  assert.equal(response.status, 302);
  assert.equal(response.headers.get('location'), 'http://localhost:5173/login?auth_error=google_not_configured');
});

test('Google callback rejects missing state and returns to the login page', async () => {
  const response = await fetch(`${origin}/api/auth/google/callback`, { redirect: 'manual' });
  assert.equal(response.status, 302);
  assert.equal(response.headers.get('location'), 'http://localhost:5173/login?auth_error=google_cancelled');
});

test('state-changing browser requests require an allowed Origin', async () => {
  const response = await fetch(`${origin}/api/auth/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: 'x@example.com', password: 'not-a-real-password' }),
  });
  assert.equal(response.status, 403);

  const unsignedWebhook = await fetch(`${origin}/api/payments/webhook`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}',
  });
  assert.equal(unsignedWebhook.status, 403);
});

test('PUT mutations require an allowed Origin and JSON content type', async () => {
  const preflight = await fetch(`${origin}/api/portal/availability`, {
    method: 'OPTIONS', headers: {
      Origin: 'http://localhost:5173',
      'Access-Control-Request-Method': 'PUT',
      'Access-Control-Request-Headers': 'content-type',
    },
  });
  assert.equal(preflight.status, 204);
  assert.match(preflight.headers.get('access-control-allow-methods') ?? '', /PUT/);

  const missingOrigin = await fetch(`${origin}/api/not-real`, {
    method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: '{}',
  });
  assert.equal(missingOrigin.status, 403);

  const wrongContentType = await fetch(`${origin}/api/not-real`, {
    method: 'PUT', headers: { Origin: 'http://localhost:5173', 'Content-Type': 'text/plain' }, body: '{}',
  });
  assert.equal(wrongContentType.status, 415);

  const validMutation = await fetch(`${origin}/api/not-real`, {
    method: 'PUT', headers: { Origin: 'http://localhost:5173', 'Content-Type': 'application/json' }, body: '{}',
  });
  assert.equal(validMutation.status, 404);
});

test('authentication routes apply a request limit before processing credentials', async () => {
  const send = () => fetch(`${origin}/api/auth/login`, {
    method: 'POST', headers: { Origin: 'http://localhost:5173', 'Content-Type': 'application/json' }, body: '{}',
  });
  const responses = [];
  for (let i = 0; i < 9; i += 1) responses.push(await send());
  assert.equal(responses.slice(0, 8).every((response) => response.status === 400), true);
  assert.equal(responses[8].status, 429);
});

test('unknown API routes return a safe not-found response', async () => {
  const response = await fetch(`${origin}/api/not-real`);
  assert.equal(response.status, 404);
  assert.deepEqual(await response.json(), { error: { message: 'Not found.' } });
});

test('outbound provider requests abort when their timeout expires', async () => {
  const originalFetch = global.fetch;
  global.fetch = (_url, init) => new Promise((_resolve, reject) => {
    const signal = init.signal;
    if (signal.aborted) return reject(signal.reason);
    signal.addEventListener('abort', () => reject(signal.reason), { once: true });
  });
  try {
    await assert.rejects(externalFetch('https://provider.invalid', {}, 5), (error) => error.name === 'TimeoutError');
  } finally {
    global.fetch = originalFetch;
  }
});

test('UUID route/query identifiers are rejected before reaching PostgreSQL', () => {
  assert.equal(requiredUuid('550e8400-e29b-41d4-a716-446655440000', 'appointment id'), '550e8400-e29b-41d4-a716-446655440000');
  for (const value of ['not-a-uuid', "' OR 1=1 --", '', null]) {
    assert.throws(() => requiredUuid(value, 'appointment id'), (error) => error instanceof HttpError && error.status === 400);
  }
});

test('doctor identity always prefers the doctor profile when a patient profile also exists', async () => {
  assert.equal(profileNameForRole('DOCTOR', { full_name: 'Patient Name', display_name: 'Dr. Clinician' }), 'Dr. Clinician');
  assert.equal(profileNameForRole('PATIENT', { full_name: 'Patient Name', display_name: 'Dr. Clinician' }), 'Patient Name');

  const originalQuery = pool.query;
  pool.query = async (query, values) => {
    if (query.includes('SELECT s.id AS session_id')) {
      return {
        rowCount: 1,
        rows: [{ session_id: 'session-id', id: 'user-id', email: 'doctor@example.test', role: 'DOCTOR', patient_id: 'patient-id', doctor_id: 'doctor-id' }],
      };
    }
    if (query.includes('SELECT display_name FROM doctors WHERE id = $1')) {
      assert.deepEqual(values, ['doctor-id']);
      return { rowCount: 1, rows: [{ display_name: 'Dr. Clinician' }] };
    }
    throw new Error('Unexpected database query in doctor identity regression test.');
  };

  try {
    const response = await fetch(`${origin}/api/auth/me`, {
      headers: { Cookie: `atelier_session=${'a'.repeat(43)}` },
    });
    assert.equal(response.status, 200);
    assert.deepEqual((await response.json()).user, {
      id: 'user-id',
      email: 'doctor@example.test',
      role: 'DOCTOR',
      fullName: 'Dr. Clinician',
    });
  } finally {
    pool.query = originalQuery;
  }
});

test('doctor patient directory is role-scoped and server-paginated', async () => {
  const originalQuery = pool.query;
  pool.query = async (query, values) => {
    if (query.includes('SELECT s.id AS session_id')) {
      return { rowCount: 1, rows: [{ session_id: 'session-id', id: 'doctor-user', email: 'doctor@example.test', role: 'DOCTOR', patient_id: null, doctor_id: 'doctor-id' }] };
    }
    if (query.includes('max(a.starts_at) AS last_appointment')) {
      assert.deepEqual(values, ['doctor-id', 'Ali', '%Ali%', 25]);
      assert.match(query, /ORDER BY p\.full_name ASC NULLS LAST,p\.full_name ASC LIMIT 25 OFFSET \$4/);
      return { rowCount: 1, rows: [{ id: 'patient-id', full_name: 'Alice Example', email: 'alice@example.test', phone: null, last_appointment: null, appointment_count: 1 }] };
    }
    if (query.includes('SELECT count(*)::int AS total')) {
      assert.deepEqual(values, ['doctor-id', 'Ali', '%Ali%']);
      return { rowCount: 1, rows: [{ total: 26 }] };
    }
    throw new Error('Unexpected database query in patient directory test.');
  };
  try {
    const response = await fetch(`${origin}/api/portal/patient-directory?search=Ali&page=2&sort=full_name&order=asc`, { headers: { Cookie: `atelier_session=${'a'.repeat(43)}` } });
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), {
      patients: [{ id: 'patient-id', full_name: 'Alice Example', email: 'alice@example.test', phone: null, last_appointment: null, appointment_count: 1 }],
      total: 26,
      page: 2,
      pageSize: 25,
    });
  } finally {
    pool.query = originalQuery;
  }
});

test('doctor patient directory rejects unrecognized sort columns and directions', async () => {
  const originalQuery = pool.query;
  pool.query = async (query) => {
    if (query.includes('SELECT s.id AS session_id')) {
      return { rowCount: 1, rows: [{ session_id: 'session-id', id: 'doctor-user', email: 'doctor@example.test', role: 'DOCTOR', patient_id: null, doctor_id: 'doctor-id' }] };
    }
    throw new Error('Invalid sort must be rejected before querying directory rows.');
  };
  try {
    const response = await fetch(`${origin}/api/portal/patient-directory?sort=full_name%3Bdrop%20table&order=asc`, { headers: { Cookie: `atelier_session=${'a'.repeat(43)}` } });
    assert.equal(response.status, 400);
    const invalidDirection = await fetch(`${origin}/api/portal/patient-directory?sort=full_name&order=asc%3Bdrop%20table`, { headers: { Cookie: `atelier_session=${'a'.repeat(43)}` } });
    assert.equal(invalidDirection.status, 400);
  } finally {
    pool.query = originalQuery;
  }
});

test('doctor calendar range is bounded and parameterized', async () => {
  const originalQuery = pool.query;
  const from = '2026-10-01T00:00:00.000Z';
  const to = '2026-11-01T00:00:00.000Z';
  pool.query = async (query, values) => {
    if (query.includes('SELECT s.id AS session_id')) {
      return { rowCount: 1, rows: [{ session_id: 'session-id', id: 'doctor-user', email: 'doctor@example.test', role: 'DOCTOR', patient_id: null, doctor_id: 'doctor-id' }] };
    }
    if (query.includes('a.starts_at >= $2 AND a.starts_at < $3')) {
      assert.deepEqual(values, ['doctor-id', from, to]);
      return { rowCount: 0, rows: [] };
    }
    throw new Error('Unexpected database query in doctor calendar range test.');
  };
  try {
    const response = await fetch(`${origin}/api/portal/appointments?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`, { headers: { Cookie: `atelier_session=${'a'.repeat(43)}` } });
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { appointments: [] });
  } finally {
    pool.query = originalQuery;
  }
});

test('completed consultations cannot be overwritten', async () => {
  const originalQuery = pool.query;
  const originalConnect = pool.connect;
  pool.query = async (query) => {
    if (query.includes('SELECT s.id AS session_id')) {
      return { rowCount: 1, rows: [{ session_id: 'session-id', id: 'doctor-user', email: 'doctor@example.test', role: 'DOCTOR', patient_id: null, doctor_id: 'doctor-id' }] };
    }
    throw new Error('Unexpected pool query in completed consultation test.');
  };
  pool.connect = async () => ({
    query: async (query) => {
      if (query === 'BEGIN' || query === 'ROLLBACK') return { rowCount: 0, rows: [] };
      if (query.includes('SELECT id,patient_id,status FROM appointments')) {
        return { rowCount: 1, rows: [{ id: 'appointment-id', patient_id: 'patient-id', status: 'COMPLETED' }] };
      }
      throw new Error('Completed consultation must not be updated.');
    },
    release() {},
  });
  try {
    const response = await fetch(`${origin}/api/portal/appointments/550e8400-e29b-41d4-a716-446655440000/consultation`, {
      method: 'PUT',
      headers: { Origin: 'http://localhost:5173', Cookie: `atelier_session=${'a'.repeat(43)}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ notes: 'attempted change', complete: false }),
    });
    assert.equal(response.status, 409);
    assert.equal((await response.json()).error.message, 'This consultation is complete and can no longer be edited.');
  } finally {
    pool.query = originalQuery;
    pool.connect = originalConnect;
  }
});
