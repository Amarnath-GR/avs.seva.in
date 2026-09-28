import { test } from 'node:test';
import assert from 'node:assert/strict';

// A lead is the first real contact anyone makes with this business. The
// function that forwards it must never be the reason a customer's form fails:
// a Netlify form-notify handler that returns non-2xx makes the submission
// appear to fail, so the customer thinks nobody received it and may not retry.
//
// These tests pin that, plus the redaction and the fail-closed behaviour when
// the bridge is not configured.

const SECRET = 'test-bridge-secret';

async function makeHandler(env) {
  const saved = { ...process.env };
  Object.assign(process.env, env);
  const mod = await import('../netlify/functions/lead-alert.mjs');
  return {
    handler: mod.default,
    restore: () => { process.env = saved; },
  };
}

const call = (handler, body) =>
  handler({ method: 'POST', body: JSON.stringify(body) });

test('a lead with a bridge configured is forwarded to the bridge', async (t) => {
  const calls = [];
  const savedFetch = globalThis.fetch;
  globalThis.fetch = async (url, opts) => {
    calls.push({ url, opts });
    return { ok: true, status: 200 };
  };
  t.after(() => { globalThis.fetch = savedFetch; });

  const { handler, restore } = await makeHandler({
    AVS_BRIDGE_URL: 'https://chat.avsseva.in', AVS_BRIDGE_SECRET: SECRET,
  });
  t.after(restore);

  const res = await call(handler, {
    name: 'Amar Rathod', email: 'amar@example.com', message: 'audit please',
  });
  assert.equal(res.statusCode, 200);
  assert.equal(calls.length, 1);
  assert.match(calls[0].url, /\/lead$/);
  assert.equal(calls[0].opts.headers['X-Avs-Bridge-Secret'], SECRET);
});

test('the shared secret is never sent in the request body', async (t) => {
  const calls = [];
  const savedFetch = globalThis.fetch;
  globalThis.fetch = async (url, opts) => {
    calls.push(opts.body);
    return { ok: true, status: 200 };
  };
  t.after(() => { globalThis.fetch = savedFetch; });

  const { handler, restore } = await makeHandler({
    AVS_BRIDGE_URL: 'https://chat.avsseva.in', AVS_BRIDGE_SECRET: SECRET,
  });
  t.after(restore);

  await call(handler, { name: 'A', email: 'a@example.com', message: 'x' });
  assert.ok(!calls[0].includes(SECRET), 'the secret leaked into the body');
});

test('an unreachable bridge does not fail the customer submission', async (t) => {
  const savedFetch = globalThis.fetch;
  globalThis.fetch = async () => { throw new Error('ECONNREFUSED'); };
  t.after(() => { globalThis.fetch = savedFetch; });

  const { handler, restore } = await makeHandler({
    AVS_BRIDGE_URL: 'https://chat.avsseva.in', AVS_BRIDGE_SECRET: SECRET,
  });
  t.after(restore);

  // The lead is lost, but the customer must not be shown a failure - retrying
  // would send the same enquiry twice and they would assume it was ignored.
  const res = await call(handler, { name: 'A', email: 'a@example.com' });
  assert.equal(res.statusCode, 200);
});

test('a bridge that rejects the alert does not fail the submission', async (t) => {
  const savedFetch = globalThis.fetch;
  globalThis.fetch = async () => ({ ok: false, status: 401 });
  t.after(() => { globalThis.fetch = savedFetch; });

  const { handler, restore } = await makeHandler({
    AVS_BRIDGE_URL: 'https://chat.avsseva.in', AVS_BRIDGE_SECRET: SECRET,
  });
  t.after(restore);
  assert.equal((await call(handler, { name: 'A' })).statusCode, 200);
});

test('a missing bridge configuration is a safe no-op, not a crash', async (t) => {
  const { handler, restore } = await makeHandler({
    AVS_BRIDGE_URL: '', AVS_BRIDGE_SECRET: '',
  });
  t.after(restore);
  const res = await call(handler, { name: 'A', email: 'a@example.com' });
  assert.equal(res.statusCode, 200);
});

test('oversized fields are truncated before forwarding', async (t) => {
  let body = null;
  const savedFetch = globalThis.fetch;
  globalThis.fetch = async (url, opts) => { body = JSON.parse(opts.body); return { ok: true }; };
  t.after(() => { globalThis.fetch = savedFetch; });

  const { handler, restore } = await makeHandler({
    AVS_BRIDGE_URL: 'https://chat.avsseva.in', AVS_BRIDGE_SECRET: SECRET,
  });
  t.after(restore);

  await call(handler, {
    name: 'x'.repeat(500), email: 'y'.repeat(500), message: 'z'.repeat(9000),
  });
  assert.ok(body.name.length <= 100);
  assert.ok(body.email.length <= 200);
  assert.ok(body.message.length <= 2000);
});

test('a malformed body does not crash the handler', async (t) => {
  const { handler, restore } = await makeHandler({
    AVS_BRIDGE_URL: 'https://chat.avsseva.in', AVS_BRIDGE_SECRET: SECRET,
  });
  t.after(restore);
  const res = await handler({ method: 'POST', body: 'not json at all' });
  assert.equal(res.statusCode, 200);
});

test('a non-POST request is refused', async (t) => {
  const { handler, restore } = await makeHandler({
    AVS_BRIDGE_URL: 'https://chat.avsseva.in', AVS_BRIDGE_SECRET: SECRET,
  });
  t.after(restore);
  assert.equal((await handler({ method: 'GET' })).statusCode, 405);
});
