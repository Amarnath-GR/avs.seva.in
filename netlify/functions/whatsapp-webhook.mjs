// WhatsApp Cloud API webhook receiver for AVS Seva.
// ESM module because the repository package.json sets "type": "module".
//
// Security:
//   - GET verification reads WHATSAPP_VERIFY_TOKEN from the environment only.
//     There is no fallback value in source.
//   - POST requests are authenticated with X-Hub-Signature-256, an HMAC-SHA256
//     of the raw request body keyed by the Meta app secret. Without this,
//     anyone who learns the URL can inject fabricated message events.
//   - Phone numbers are salted-hashed in logs. The raw number is never written.
//
// Only message metadata is logged. Message bodies are never stored.

import { createHmac, createHash, timingSafeEqual } from 'node:crypto';

const MAX_BODY_BYTES = 512 * 1024;
const MAX_ENTRIES = 20;
const MAX_CHANGES = 20;
const MAX_MESSAGES = 50;

// Stable pseudonym for a sender. Lets us correlate a conversation without
// storing the phone number itself.
function pseudonymise(phone) {
  const salt = process.env.WHATSAPP_LOG_SALT || 'avs-seva';
  return createHash('sha256').update(`${salt}:${String(phone)}`).digest('hex').slice(0, 16);
}

function safeEqual(a, b) {
  const left = Buffer.from(a || '', 'utf8');
  const right = Buffer.from(b || '', 'utf8');
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

function signatureIsValid(rawBody, header, appSecret) {
  if (!appSecret) {
    // Fail closed. An unsigned webhook is worse than no webhook, because it
    // looks like it is working while accepting anything.
    console.error(JSON.stringify({ event: 'whatsapp_signature_error', reason: 'app_secret_not_configured' }));
    return false;
  }
  if (!header || !header.startsWith('sha256=')) return false;
  const expected = 'sha256=' + createHmac('sha256', appSecret).update(rawBody, 'utf8').digest('hex');
  return safeEqual(expected, header);
}

export default async (request) => {
  const expected = process.env.WHATSAPP_VERIFY_TOKEN;

  if (request.method === 'GET') {
    const params = new URL(request.url).searchParams;
    if (params.get('hub.mode') === 'subscribe' && params.get('hub.verify_token') === expected) {
      return new Response(params.get('hub.challenge') || '', { status: 200 });
    }
    return new Response('verification failed', { status: 403 });
  }

  if (request.method !== 'POST') {
    return new Response('method not allowed', { status: 405 });
  }

  // Read the body as text: the HMAC must be computed over the exact bytes sent.
  let rawBody;
  try {
    rawBody = await request.text();
  } catch {
    return new Response('unreadable body', { status: 400 });
  }
  if (rawBody.length > MAX_BODY_BYTES) {
    return new Response('payload too large', { status: 413 });
  }

  const signature = request.headers.get('x-hub-signature-256');
  if (!signatureIsValid(rawBody, signature, process.env.WHATSAPP_APP_SECRET)) {
    console.warn(JSON.stringify({ event: 'whatsapp_signature_rejected' }));
    return new Response('invalid signature', { status: 401 });
  }

  let payload;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return new Response('invalid json', { status: 400 });
  }

  const entries = (payload.entry || []).slice(0, MAX_ENTRIES);
  for (const entry of entries) {
    for (const change of (entry.changes || []).slice(0, MAX_CHANGES)) {
      const value = change.value || {};
      for (const message of (value.messages || []).slice(0, MAX_MESSAGES)) {
        console.log(JSON.stringify({
          event: 'whatsapp_message',
          sender: pseudonymise(message.from),
          message_type: message.type,
          timestamp: message.timestamp,
        }));
      }
      for (const status of value.statuses || []) {
        console.log(JSON.stringify({
          event: 'whatsapp_status',
          id: status.id,
          status: status.status,
          timestamp: status.timestamp,
        }));
      }
    }
  }

  return new Response('EVENT_RECEIVED', { status: 200 });
};
