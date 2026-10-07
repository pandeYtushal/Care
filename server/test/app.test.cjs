const { before, after, test } = require('node:test');
const assert = require('node:assert/strict');

process.env.NODE_ENV = 'test';
process.env.PORT = '5000';
process.env.DATABASE_URL = 'postgresql://invalid:invalid@127.0.0.1:5432/unused';
process.env.APP_ORIGINS = 'http://localhost:5173';

const { app } = require('../dist/app.js');
const { HttpError, requiredUuid } = require('../dist/http.js');
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
  const denied = await fetch(`${origin}/api/health`, { headers: { Origin: 'https://attacker.example' } });
  assert.equal(denied.status, 403);
  assert.equal(denied.headers.get('access-control-allow-origin'), null);
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
