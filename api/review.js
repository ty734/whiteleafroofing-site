// White Leaf Roofing — review-gate endpoint (Vercel serverless function)
// The /review/ page posts here for EVERY rating. 1-3 star feedback is the whole
// point: it reaches Andy + Tyler privately instead of becoming a public review.
// 4-5 star visitors get redirected to Google by the page itself after this returns.
// Env vars: RESEND_API_KEY (required).

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const b = req.body || {};
  const rating = Math.round(Number(b.rating) || 0);
  const feedback = String(b.feedback || '').trim().slice(0, 3000);
  const name = String(b.name || '').trim().slice(0, 120);
  const honeypot = String(b.company || '').trim();
  const startedAt = Number(b.t || 0);

  // Bots: accept-and-drop silently.
  if (honeypot || (startedAt && Date.now() - startedAt < 2000)) {
    return res.status(200).json({ ok: true });
  }
  if (rating < 1 || rating > 5) {
    return res.status(400).json({ ok: false, error: 'Pick a rating from 1 to 5.' });
  }
  // Links in feedback are spam, same signature as the lead form.
  if (/https?:\/\/|www\.|\[url\]|<a\s/i.test(feedback)) {
    return res.status(200).json({ ok: true });
  }

  const urgent = rating <= 3;
  const lines = [
    `Rating: ${rating}/5${urgent ? '  <-- NEEDS A PERSONAL CALL, do not let this become a public review' : ''}`,
    `Name: ${name || '(not given)'}`,
    feedback ? `Feedback: ${feedback}` : 'Feedback: (none written)',
    `Received: ${new Date().toLocaleString('en-US', { timeZone: 'America/Phoenix' })} (Phoenix time)`,
    urgent ? '' : 'This customer was sent on to Google to leave a public review.'
  ].filter(Boolean);

  const apiKey = (process.env.RESEND_API_KEY || '').replace(/[^\x21-\x7E]/g, '');
  try {
    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: 'White Leaf Roofing <leads@whiteleafroofing.com>',
        to: ['andy@wlcbuilt.com', 'tycoles@gmail.com'],
        subject: urgent
          ? `Unhappy customer (${rating}/5)${name ? `: ${name}` : ''} - call them before they post publicly`
          : `Review feedback ${rating}/5${name ? `: ${name}` : ''}`,
        text: lines.join('\n')
      })
    });
    if (!r.ok) {
      const detail = await r.text().catch(() => '');
      throw new Error(`Resend ${r.status}: ${detail}`);
    }
  } catch (err) {
    console.error('Review email failed:', err && err.stack ? err.stack : err);
    // Never block the visitor on an email hiccup; error is logged in Vercel.
  }

  return res.status(200).json({ ok: true });
}
