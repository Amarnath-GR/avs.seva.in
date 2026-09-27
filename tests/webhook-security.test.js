import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import handler from '../netlify/functions/whatsapp-webhook.mjs';

const VERIFY_TOKEN = 'test-verify-token';
const APP_SECRET = 'test-app-secret';

const sign = (body, secret = APP_SECRET) =>
  'sha256=' + createHmac('sha256', secret).update(body, 'utf8').digest('hex');

const post = (body, signature) =>
  handler(new Request('https://example.test/wh', {
    method: 'POST',
    headers: signature ? { 'x-hub-signature-256': signature } : {},
    body,
  }));

const get = (url) => handler(new Request(url));

const MESSAGE_BODY = JSON.stringify({
  entry: [{ changes: [{ value: { messages: [{ from: '919999999999', type: 'text', timestamp: '1' }] } }] }],
});

process.env.WHATSAPP_VERIFY_TOKEN = VERIFY_TOKEN;
process.env.WHATSAPP_APP_SECRET = APP_SECRET;

test('GET with the correct verify token echoes the challenge', async () => {
  const res = await get(`https://example.test/wh?hub.mode=subscribe&hub.verify_token=${VERIFY_TOKEN}&hub.challenge=echo123`);
  assert.equal(res.status, 200);
  assert.equal(await res.text(), 'echo123');
});

test('GET with a wrong verify token is rejected', async () => {
  const res = await get('https://example.test/wh?hub.mode=subscribe&hub.verify_token=wrong&hub.challenge=x');
  assert.equal(res.status, 403);
});

test('POST with a valid signature is accepted', async () => {
  const res = await post(MESSAGE_BODY, sign(MESSAGE_BODY));
  assert.equal(res.status, 200);
});

test('POST with an invalid signature is rejected', async () => {
  const res = await post(MESSAGE_BODY, 'sha256=' + '0'.repeat(64));
  assert.equal(res.status, 401);
});

test('POST with no signature is rejected', async () => {
  const res = await post(MESSAGE_BODY, null);
  assert.equal(res.status, 401);
});

test('POST signed with the wrong secret is rejected', async () => {
  const res = await post(MESSAGE_BODY, sign(MESSAGE_BODY, 'attacker-secret'));
  assert.equal(res.status, 401);
});

test('a valid signature over a different body does not pass', async () => {
  const other = JSON.stringify({ entry: [{ changes: [{ value: { status: 'x' } }] }] });
  const res = await post(MESSAGE_BODY, sign(other));
  assert.equal(res.status, 401);
});

test('oversized bodies are refused', async () => {
  const res = await post('x'.repeat(600 * 1024), 'sha256=zz');
  assert.equal(res.status, 413);
});

test('non-POST, non-GET methods are rejected', async () => {
  const res = await handler(new Request('https://example.test/wh', { method: 'PUT' }));
  assert.equal(res.status, 405);
});

test('the source contains no hardcoded verify token or app secret', async () => {
  const { readFile } = await import('node:fs/promises');
  const src = await readFile(new URL('../netlify/functions/whatsapp-webhook.mjs', import.meta.url), 'utf8');
  // No hardcoded credentials, and no in-source default for the verify token.
  assert.equal(/verify_token\s*=\s*['"][^'"]+['"]/.test(src), false);
  assert.equal(/FALLBACK_VERIFY_TOKEN\s*=/.test(src), false);
  assert.equal(/APP_SECRET\s*=\s*['"][^'"]+['"]/.test(src), false);
  assert.equal(src.includes('process.env.WHATSAPP_VERIFY_TOKEN ||'), false);
  assert.equal(src.includes('process.env.WHATSAPP_APP_SECRET ||'), false);
});
