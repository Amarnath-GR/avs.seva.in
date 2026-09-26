// WhatsApp Cloud API webhook receiver for AVS Seva.
// ESM module because the repository package.json sets "type": "module".
// The verification token is read from WHATSAPP_VERIFY_TOKEN at runtime.
// Only message metadata is logged. Message bodies are never stored.

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

  let payload;
  try {
    payload = await request.json();
  } catch {
    return new Response('invalid json', { status: 400 });
  }

  for (const entry of payload.entry || []) {
    for (const change of entry.changes || []) {
      const value = change.value || {};
      for (const message of value.messages || []) {
        console.log(JSON.stringify({
          event: 'whatsapp_message',
          from: message.from,
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
