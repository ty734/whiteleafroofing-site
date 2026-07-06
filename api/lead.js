// White Leaf Roofing — lead capture endpoint (Vercel serverless function)
// Sends every submission to Andy + Tyler via Resend, then redirects to /thank-you/.
// Env var required: RESEND_API_KEY (Vercel project settings).

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const b = req.body || {};
  const name = String(b.name || '').trim().slice(0, 120);
  const phone = String(b.phone || '').trim().slice(0, 40);
  const email = String(b.email || '').trim().slice(0, 160);
  const message = String(b.message || '').trim().slice(0, 3000);
  const page = String(b.page || '').trim().slice(0, 200);
  const honeypot = String(b.company || '').trim(); // hidden field real users never see
  const startedAt = Number(b.t || 0);

  // Spam checks: honeypot filled or submitted faster than a human types
  if (honeypot || (startedAt && Date.now() - startedAt < 3000)) {
    return res.redirect(303, '/thank-you/');
  }
  if (!name || !(phone || email)) {
    return res.status(400).json({ error: 'Please include your name and a phone number or email.' });
  }

  const lines = [
    `Name: ${name}`,
    `Phone: ${phone || '(not given)'}`,
    `Email: ${email || '(not given)'}`,
    message ? `Message: ${message}` : null,
    page ? `Came from: https://whiteleafroofing.com${page}` : null,
    `Received: ${new Date().toLocaleString('en-US', { timeZone: 'America/Phoenix' })} (Phoenix time)`
  ].filter(Boolean);

  // Strip any stray non-printable characters (e.g. a BOM/whitespace picked up
  // when the env var was set) so the Authorization header is always valid.
  const apiKey = (process.env.RESEND_API_KEY || '').replace(/[^\x21-\x7E]/g, '');

  try {
    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        from: 'White Leaf Roofing <leads@whiteleafroofing.com>',
        to: ['andy@wlcbuilt.com', 'tycoles@gmail.com'],
        reply_to: email || undefined,
        subject: `New lead: ${name}${page ? ` (${page})` : ''}`,
        text: lines.join('\n')
      })
    });
    if (!r.ok) {
      const detail = await r.text().catch(() => '');
      throw new Error(`Resend ${r.status}: ${detail}`);
    }
  } catch (err) {
    console.error('Lead email failed:', err && err.stack ? err.stack : err);
    // Do not lose the lead silently: still show thank-you, error is logged in Vercel.
  }

  // Future scope: INSERT into Vercel Postgres here for the leads dashboard.

  const wantsJson = (req.headers.accept || '').includes('application/json');
  if (wantsJson) return res.status(200).json({ ok: true });
  return res.redirect(303, '/thank-you/');
}
