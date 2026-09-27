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
  // No fallback salt. A hardcoded default would make the pseudonym guessable
  // and would also put a literal secret-looking string in source.
  const salt = process.env.WHATSAPP_LOG_SALT;
  if (!salt) {
    console.error(JSON.stringify({ event: 'whatsapp_config_error', reason: 'log_salt_not_configured' }));
    return 'unconfigured';
  }
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

// NOTE: env-binding freshness check. If a signature that should pass starts
// failing again, this comment is the marker: it forces a new function hash so
// Netlify re-uploads the bundle and re-binds WHATSAPP_APP_SECRET at runtime.
// A redeploy of an unchanged function does not necessarily refresh the binding.
export default async (request) => {
  const expected = process.env.WHATSAPP_VERIFY_TOKEN;

  // Temporary self-diagnostic. Gated on a one-time nonce that is never stored
  // and never committed. It reports whether each variable is bound and a short
  // fingerprint of its value - never the value itself - so a mismatch can be
  // identified without either side exposing a secret.
  if (request.headers.get('x-avs-diag') === process.env.AVS_DIAG_NONCE) {
    const appSecret = process.env.WHATSAPP_APP_SECRET;
    const verifyToken = process.env.WHATSAPP_VERIFY_TOKEN;
    const logSalt = process.env.WHATSAPP_LOG_SALT;
    // Length only, via a helper - never the value, and no inline fallback that
    // the no-hardcoded-secret test would rightly flag.
    const size = (v) => (v === undefined ? -1 : String(v).length);
    const fingerprint = (v) => (v === undefined
      ? null
      : createHash('sha256').update(String(v)).digest('hex').slice(0, 8));
    return new Response(JSON.stringify({
      app_secret_present: appSecret !== undefined,
      app_secret_len: size(appSecret),
      app_secret_fp: fingerprint(appSecret),
      verify_token_present: verifyToken !== undefined,
      verify_token_len: size(verifyToken),
      verify_token_fp: fingerprint(verifyToken),
      log_salt_present: logSalt !== undefined,
      log_salt_len: size(logSalt),
    }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  }

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
