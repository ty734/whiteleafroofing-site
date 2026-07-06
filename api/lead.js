// White Leaf Roofing — lead capture endpoint (Vercel serverless function)
// Sends every real submission to Andy + Tyler via Resend, then redirects to /thank-you/.
// Env vars: RESEND_API_KEY (required), TURNSTILE_SECRET (optional bot check).

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const DISPOSABLE = /@(mailinator|guerrillamail|10minutemail|tempmail|trashmail|yopmail|sharklasers|discard\.email|getnada|throwaway)/i;

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
  const honeypot = String(b.company || '').trim(); // hidden field; real users never see it
  const startedAt = Number(b.t || 0);
  const wantsJson = (req.headers.accept || '').includes('application/json');

  // Silently accept-and-drop obvious bots so they don't retry or see an error.
  const dropSilently = () =>
    wantsJson ? res.status(200).json({ ok: true }) : res.redirect(303, '/thank-you/');

  // 1. Honeypot filled, or submitted faster than a human could type.
  if (honeypot || (startedAt && Date.now() - startedAt < 3000)) return dropSilently();

  // 2. Cloudflare Turnstile (only enforced once the secret is configured).
  //    A Turnstile miss may be a real customer, so bounce them back to retry
  //    rather than silently dropping (unlike the honeypot, which is always a bot).
  if (process.env.TURNSTILE_SECRET) {
    const token = String(b['cf-turnstile-response'] || '');
    const ip = req.headers['x-forwarded-for'] || '';
    const verify = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: `secret=${encodeURIComponent(process.env.TURNSTILE_SECRET)}&response=${encodeURIComponent(token)}&remoteip=${encodeURIComponent(ip)}`
    }).then((r) => r.json()).catch(() => ({ success: false }));
    if (!verify.success) {
      const msg = 'Please complete the "I am human" check and try again.';
      return wantsJson
        ? res.status(400).json({ ok: false, error: msg })
        : res.redirect(303, (page || '/free-estimate/') + '?error=verify');
    }
  }

  // 3. Content heuristics: links in the message are a near-certain spam signature here.
  if (/https?:\/\/|www\.|\[url\]|<a\s/i.test(message)) return dropSilently();
  // A "name" with no letters is a bot.
  if (name && !/[a-z]/i.test(name)) return dropSilently();

  // 4. Real validation: a valid email OR a real phone number must be present.
  //    (The contact form uses one "email or phone" field, so check digits across both.)
  const allDigits = (phone + ' ' + email).replace(/\D/g, '');
  const phoneValid = allDigits.length >= 10 && allDigits.length <= 15;
  const emailValid = (EMAIL_RE.test(email) || EMAIL_RE.test(phone)) && !DISPOSABLE.test(email) && !DISPOSABLE.test(phone);

  if (!name || !(phoneValid || emailValid)) {
    const msg = 'Please enter your name and a valid phone number or email so Andy can reach you.';
    return wantsJson
      ? res.status(400).json({ ok: false, error: msg })
      : res.redirect(303, '/free-estimate/?error=1');
  }

  const lines = [
    `Name: ${name}`,
    `Phone: ${phone || '(not given)'}`,
    `Email: ${email || '(not given)'}`,
    message ? `Message: ${message}` : null,
    page ? `Came from: https://whiteleafroofing.com${page}` : null,
    `Received: ${new Date().toLocaleString('en-US', { timeZone: 'America/Phoenix' })} (Phoenix time)`
  ].filter(Boolean);

  // Strip stray non-printable characters (e.g. a BOM) from the key so the header is always valid.
  const apiKey = (process.env.RESEND_API_KEY || '').replace(/[^\x21-\x7E]/g, '');

  try {
    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: 'White Leaf Roofing <leads@whiteleafroofing.com>',
        to: ['andy@wlcbuilt.com', 'tycoles@gmail.com'],
        reply_to: EMAIL_RE.test(email) ? email : undefined,
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
    // Do not lose a real lead silently: still show thank-you; error is logged in Vercel.
  }

  // Future scope: INSERT into Vercel Postgres here for the leads dashboard.

  if (wantsJson) return res.status(200).json({ ok: true });
  return res.redirect(303, '/thank-you/');
}
