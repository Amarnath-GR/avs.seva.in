// Notify the VPS when a Netlify form submission lands.
// Receives the Netlify form payload, extracts only the lead's own fields,
// and posts to the authenticated bridge. No credentials, no message body
// logging beyond what the customer typed.
const BRIDGE = process.env.AVS_BRIDGE_URL;
const SECRET = process.env.AVS_BRIDGE_SECRET;

export default async (req) => {
  if (req.method !== 'POST') return { statusCode: 405, body: 'no' };
  if (!BRIDGE || !SECRET) {
    console.error('lead-alert: bridge not configured');
    return { statusCode: 200, body: 'OK' };
  }
  let form = {};
  try {
    form = JSON.parse(req.body || '{}');
  } catch { form = {}; }
  const name = String(form.name || '').slice(0, 100);
  const email = String(form.email || '').slice(0, 200);
  const message = String(form.message || '').slice(0, 2000);
  try {
    const res = await fetch(`${BRIDGE}/lead`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Avs-Bridge-Secret': SECRET },
      body: JSON.stringify({ name, email, message }),
    });
    if (!res.ok) console.error('lead-alert: bridge refused', res.status);
  } catch (e) {
    // Never fail the customer's submission because alerting failed.
    console.error('lead-alert: unreachable', e.message);
  }
  return { statusCode: 200, body: 'OK' };
};
