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

// --- Chat bridge -----------------------------------------------------------
// The Python engine lives on the VPS. We forward each verified payload there
// and send the returned reply back through the Cloud API. Failures here are
// logged and swallowed: a webhook that throws would make Meta retry the same
// event indefinitely, which is worse than a missed reply.

const BRIDGE_TIMEOUT_MS = 8000;
const MAX_REPLY_CHARS = 4096;

function bridgeConfig() {
  const url = process.env.AVS_BRIDGE_URL;
  const secret = process.env.AVS_BRIDGE_SECRET;
  if (!url || !secret) return null;
  return { url, secret };
}

async function sendWhatsAppText(to, text) {
  const token = process.env.WHATSAPP_ACCESS_TOKEN;
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  if (!token || !phoneNumberId) {
    console.error(JSON.stringify({ event: 'whatsapp_send_skipped', reason: 'credentials_missing' }));
    return false;
  }
  const endpoint = `https://graph.facebook.com/v21.0/${phoneNumberId}/messages`;
  const res = await fetch(endpoint, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to,
      type: 'text',
      text: { preview_url: false, body: String(text).slice(0, MAX_REPLY_CHARS) },
    }),
  });
  if (!res.ok) {
    console.warn(JSON.stringify({ event: 'whatsapp_send_failed', status: res.status }));
    return false;
  }
  return true;
}

async function forwardToBridge(payload) {
  const config = bridgeConfig();
  if (!config) {
    console.warn(JSON.stringify({ event: 'whatsapp_bridge_skipped', reason: 'not_configured' }));
    return { handled: 0, replied: 0 };
  }

  let body;
  try {
    const res = await fetch(config.url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Avs-Bridge-Secret': config.secret },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(BRIDGE_TIMEOUT_MS),
    });
    if (!res.ok) {
      console.warn(JSON.stringify({ event: 'whatsapp_bridge_error', status: res.status }));
      return { handled: 0, replied: 0 };
    }
    body = await res.json();
  } catch (err) {
    // Never let a bridge failure become a webhook failure.
    console.warn(JSON.stringify({ event: 'whatsapp_bridge_unreachable', reason: String(err && err.name) }));
    return { handled: 0, replied: 0 };
  }

  const messages = [];
  for (const entry of (payload.entry || []).slice(0, MAX_ENTRIES)) {
    for (const change of (entry.changes || []).slice(0, MAX_CHANGES)) {
      for (const m of ((change.value || {}).messages || []).slice(0, MAX_MESSAGES)) {
        messages.push(m);
      }
    }
  }

  let replied = 0;
  const results = (body && body.results) || [];

  // Match by message id, never by position. The bridge may drop duplicates or
  // exceed a cap, so index i in results is not necessarily index i in
  // messages. Matching positionally would send a customer someone else's
  // reply. Fall back to position only when no ids are present at all.
  const hasIds = results.some((r) => r && r.id);
  const byId = new Map();
  for (const r of results) {
    if (r && r.id) byId.set(r.id, r);
  }

  for (let i = 0; i < messages.length; i += 1) {
    const to = messages[i].from;
    const result = hasIds ? byId.get(messages[i].id) : results[i];
    const reply = result && result.reply;
    if (!to || !reply) continue;
    try {
      if (await sendWhatsAppText(to, reply)) replied += 1;
    } catch (err) {
      console.warn(JSON.stringify({ event: 'whatsapp_send_error', reason: String(err && err.name) }));
    }
  }

  return { handled: (body && body.handled) || messages.length, replied };
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

  const signature = request.headers.get('x-hub-signature-256');

  // Size is checked before the signature, deliberately. HMAC over a huge body
  // is wasted work, and returning 401 for an oversized request misreports the
  // reason. It also matches the documented behaviour and the unit test.
  if (rawBody.length > MAX_BODY_BYTES) {
    console.warn(JSON.stringify({ event: 'whatsapp_payload_too_large',
                                  bytes: rawBody.length }));
    return new Response('payload too large', { status: 413 });
  }

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

  // Forward to the VPS chat bridge, which runs the Python engine. The bridge
  // URL and shared secret come from the environment; neither is in source.
  const results = await forwardToBridge(payload);
  console.log(JSON.stringify({
    event: 'whatsapp_bridge',
    handled: results.handled,
    replied: results.replied,
  }));

  return new Response('EVENT_RECEIVED', { status: 200 });
};
