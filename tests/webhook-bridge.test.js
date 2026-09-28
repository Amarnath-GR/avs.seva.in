import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';

process.env.WHATSAPP_APP_SECRET = 'test-app-secret';
process.env.WHATSAPP_VERIFY_TOKEN = 'test-verify-token';
process.env.WHATSAPP_LOG_SALT = 'test-log-salt';
// Bridge deliberately left unconfigured for these tests, so the handler skips
// the forward path and returns 200. That is the fail-safe behaviour.
delete process.env.AVS_BRIDGE_URL;
delete process.env.AVS_BRIDGE_SECRET;
delete process.env.WHATSAPP_ACCESS_TOKEN;
delete process.env.WHATSAPP_PHONE_NUMBER_ID;

const { default: handler } = await import('../netlify/functions/whatsapp-webhook.mjs');

const APP_SECRET = 'test-app-secret';

const sign = (body, secret = APP_SECRET) =>
  'sha256=' + createHmac('sha256', secret).update(body, 'utf8').digest('hex');


const post = (body, signature) =>
  handler(new Request('https://example.test/wh', {
    method: 'POST',
    headers: signature ? { 'x-hub-signature-256': signature } : {},
    body,
  }));

test('a signed text message returns 200 even with no bridge configured', async () => {
  const body = messageBody('hi');
  const res = await post(body, sign(body));
  assert.equal(res.status, 200);
  assert.equal(await res.text(), 'EVENT_RECEIVED');
});

test('a signed media message also returns 200', async () => {
  const body = messageBody('', '919999999999', 'image');
  const res = await post(body, sign(body));
  assert.equal(res.status, 200);
});

test('an unsigned request is still rejected', async () => {
  const res = await post(messageBody('hi'), null);
  assert.equal(res.status, 401);
});

test('a request signed with the wrong secret is rejected', async () => {
  const body = messageBody('hi');
  const res = await post(body, sign(body, 'wrong'));
  assert.equal(res.status, 401);
});

test('a payload with no messages returns 200', async () => {
  const body = JSON.stringify({ entry: [{ changes: [{ value: { statuses: [] } }] }] });
  const res = await post(body, sign(body));
  assert.equal(res.status, 200);
});

test('the bridge secrets are read from the environment, never hardcoded', async () => {
  const { readFile } = await import('node:fs/promises');
  const src = await readFile(
    new URL('../netlify/functions/whatsapp-webhook.mjs', import.meta.url), 'utf8');
  assert.equal(/AVS_BRIDGE_SECRET\s*=\s*['"][^'"]+['"]/.test(src), false);
  assert.equal(/AVS_BRIDGE_URL\s*=\s*['"][^'"]+['"]/.test(src), false);
  assert.equal(/WHATSAPP_ACCESS_TOKEN\s*=\s*['"][^'"]+['"]/.test(src), false);
  assert.equal(/WHATSAPP_PHONE_NUMBER_ID\s*=\s*['"][^'"]+['"]/.test(src), false);
});

test('the Graph API token is sent as a bearer header, not in the body', async () => {
  const { readFile } = await import('node:fs/promises');
  const src = await readFile(
    new URL('../netlify/functions/whatsapp-webhook.mjs', import.meta.url), 'utf8');
  assert.equal(src.includes('Authorization: `Bearer ${token}`'), true);
  assert.equal(/access_token/.test(src), false);
});

function messageBody(text, from = '919999999999', type = 'text', id) {
  const msg = { from, type, timestamp: '1' };
  if (id) msg.id = id;
  if (type === 'text') msg.text = { body: text };
  return JSON.stringify({ entry: [{ changes: [{ value: { messages: [msg] } }] }] });
}

// A payload with explicit ids on every message, so replies can be matched.
const multiBody = JSON.stringify({
  entry: [{ changes: [{ value: { messages: [
    { id: 'wamid.FIRST', from: '919000000001', type: 'text', timestamp: '1', text: { body: 'a' } },
    { id: 'wamid.SECOND', from: '919000000002', type: 'text', timestamp: '1', text: { body: 'b' } },
  ] } }] }],
});

// Stubs the Cloud API so we can see exactly which recipient got which reply.
function captureSends(bridgeResponse) {
  const calls = [];
  const realFetch = globalThis.fetch;
  const realLog = console.log;
  const realWarn = console.warn;
  console.log = () => {};
  console.warn = () => {};
  process.env.AVS_BRIDGE_URL = 'https://bridge.test/webhook';
  process.env.AVS_BRIDGE_SECRET = 'x'.repeat(32);
  process.env.WHATSAPP_ACCESS_TOKEN = 'test-token';
  process.env.WHATSAPP_PHONE_NUMBER_ID = '12345';
  globalThis.fetch = async (url, opts) => {
    if (String(url).includes('graph.facebook.com')) {
      calls.push(JSON.parse(opts.body));
      return new Response('{}', { status: 200 });
    }
    return new Response(JSON.stringify(bridgeResponse),
                        { status: 200, headers: { 'content-type': 'application/json' } });
  };
  return () => {
    globalThis.fetch = realFetch;
    console.log = realLog;
    console.warn = realWarn;
    delete process.env.AVS_BRIDGE_URL;
    delete process.env.AVS_BRIDGE_SECRET;
    delete process.env.WHATSAPP_ACCESS_TOKEN;
    delete process.env.WHATSAPP_PHONE_NUMBER_ID;
    return calls;
  };
}

test('replies are matched by message id, not by position', async () => {
  // The bridge drops duplicates, so results can be shorter than the messages
  // sent. Positional matching would then send sender one the second sender's
  // reply. This is the test that would catch that.
  const restore = captureSends({ ok: true, handled: 1, results: [
    { id: 'wamid.SECOND', action: 'advance', reply: 'reply for the second sender' },
  ] });
  try {
    await post(multiBody, sign(multiBody));
    const calls = restore();
    assert.equal(calls.length, 1);
    assert.equal(calls[0].to, '919000000002');
    assert.match(calls[0].text.body, /second sender/);
  } finally { restore(); }
});

test('a duplicate dropped by the bridge gets no reply', async () => {
  const restore = captureSends({ ok: true, handled: 0, duplicates_dropped: 1, results: [] });
  try {
    await post(multiBody, sign(multiBody));
    assert.equal(restore().length, 0);
  } finally { restore(); }
});

test('position fallback still works for a bridge that returns no ids', async () => {
  const restore = captureSends({ ok: true, handled: 2, results: [
    { action: 'advance', reply: 'first reply' },
    { action: 'advance', reply: 'second reply' },
  ] });
  try {
    await post(multiBody, sign(multiBody));
    const calls = restore();
    assert.equal(calls.length, 2);
    assert.match(calls[0].text.body, /first reply/);
    assert.match(calls[1].text.body, /second reply/);
  } finally { restore(); }
});

test('a bridge failure cannot turn the webhook into an error', async () => {
  // Point the bridge at a closed port. The handler must still return 200 so
  // Meta does not retry the same event forever.
  process.env.AVS_BRIDGE_URL = 'http://127.0.0.1:9/webhook';
  process.env.AVS_BRIDGE_SECRET = 'x'.repeat(32);
  const body = messageBody('hi');
  const res = await post(body, sign(body));
  assert.equal(res.status, 200);
  delete process.env.AVS_BRIDGE_URL;
  delete process.env.AVS_BRIDGE_SECRET;
});

test('an oversized body is refused with 413, correctly signed or not', async () => {
  const big = 'x'.repeat(600 * 1024);
  // Correctly signed: size is checked before the signature, so the reason
  // reported is the real one.
  const signed = await post(big, sign(big));
  assert.equal(signed.status, 413, 'a signed oversized body must be 413');
  // Unsigned oversized: still 413, still refused, still no work done.
  const unsigned = await post(big, null);
  assert.equal(unsigned.status, 413);
});

test('a normal-sized body is still processed after the size check moved', async () => {
  const restore = captureLogs();
  try {
    const body = messageBody('hi');
    const res = await post(body, sign(body));
    assert.equal(res.status, 200);
  } finally { restore(); }
});

test('the raw phone number is never written to the log', async () => {
  const realLog = console.log;
  const lines = [];
  console.log = (...a) => lines.push(a.join(' '));
  try {
    const body = messageBody('hi', '919000000777');
    await post(body, sign(body));
  } finally { console.log = realLog; }
  const joined = lines.join('\n');
  assert.ok(joined.length > 0, 'expected the handler to log something');
  assert.ok(!joined.includes('919000000777'), 'raw phone number leaked into the log');
});
