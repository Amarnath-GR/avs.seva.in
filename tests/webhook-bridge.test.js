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

function messageBody(text, from = '919999999999', type = 'text') {
  const msg = { from, type, timestamp: '1' };
  if (type === 'text') msg.text = { body: text };
  return JSON.stringify({ entry: [{ changes: [{ value: { messages: [msg] } }] }] });
}

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
