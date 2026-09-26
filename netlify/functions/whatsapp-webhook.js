// WhatsApp Cloud API webhook receiver for AVS Seva.
// Verification token is read from the WHATSAPP_VERIFY_TOKEN environment variable.
// Event payloads are logged as summaries only; full message bodies are not stored.

exports.handler = async (event) => {
  const expected = process.env.WHATSAPP_VERIFY_TOKEN;

  if (event.httpMethod === 'GET') {
    const params = event.queryStringParameters || {};
    if (params['hub.mode'] === 'subscribe' && params['hub.verify_token'] === expected) {
      return { statusCode: 200, body: params['hub.challenge'] || '' };
    }
    return { statusCode: 403, body: 'verification failed' };
  }

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'method not allowed' };
  }

  let payload;
  try {
    payload = JSON.parse(event.body || '{}');
  } catch {
    return { statusCode: 400, body: 'invalid json' };
  }

  const entries = payload.entry || [];
  for (const entry of entries) {
    for (const change of entry.changes || []) {
      const value = change.value || {};
      const messages = value.messages || [];
      for (const message of messages) {
        // Only metadata is recorded. Message text is intentionally not stored.
        console.log(JSON.stringify({
          event: 'whatsapp_message',
          from: message.from,
          message_type: message.type,
          timestamp: message.timestamp,
        }));
      }
      if (value.statuses) {
        for (const status of value.statuses) {
          console.log(JSON.stringify({
            event: 'whatsapp_status',
            id: status.id,
            status: status.status,
            timestamp: status.timestamp,
          }));
        }
      }
    }
  }

  return { statusCode: 200, body: 'EVENT_RECEIVED' };
};
