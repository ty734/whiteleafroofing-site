// White Leaf Roofing — automated review request (Vercel cron, weekly).
// Emails ONE review ask, in Andy's voice, to leads marked "won" in the dashboard
// that have a valid email and haven't been asked before. Max 5 per run, oldest
// first. BCCs Tyler on every send so nothing goes out unseen.
//
// SAFETY: does nothing until REVIEW_ASK_ENABLED=1 is set in Vercel env vars.
// That flag is the owner's consent switch for emailing customers.

import { listLeads, patchLead, storeReady } from '../lib/store.js';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const MAX_PER_RUN = 5;

export default async function handler(req, res) {
  // Vercel cron sends Authorization: Bearer <CRON_SECRET> when the secret is set.
  if (process.env.CRON_SECRET && req.headers.authorization !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ ok: false, error: 'unauthorized' });
  }
  if (process.env.REVIEW_ASK_ENABLED !== '1') {
    return res.status(200).json({ ok: true, skipped: 'REVIEW_ASK_ENABLED is not 1' });
  }
  if (!storeReady()) {
    return res.status(200).json({ ok: true, skipped: 'storage not connected' });
  }

  const leads = await listLeads();
  const candidates = leads
    .filter((l) => l.status === 'won' && !l.reviewAskedAt && EMAIL_RE.test(l.email || ''))
    .sort((a, b) => a.createdAt - b.createdAt)
    .slice(0, MAX_PER_RUN);

  const apiKey = (process.env.RESEND_API_KEY || '').replace(/[^\x21-\x7E]/g, '');
  const sent = [];
  for (const lead of candidates) {
    const first = (lead.name || '').trim().split(/\s+/)[0] || 'there';
    const text = [
      `Hi ${first},`,
      '',
      'Andy here from White Leaf Roofing. Thanks for trusting me with your roof.',
      '',
      "If you have thirty seconds, would you tell me how it went? Two questions, that's it:",
      '',
      'https://whiteleafroofing.com/review/',
      '',
      'Your honest word is how a one-man shop competes with the big companies, and I read every response myself.',
      '',
      'Thanks again,',
      'Andy Johnson',
      'White Leaf Roofing · ROC #325377',
      '480-363-2898'
    ].join('\n');

    try {
      const r = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from: 'Andy at White Leaf Roofing <andy@whiteleafroofing.com>',
          to: [lead.email],
          bcc: ['tycoles@gmail.com'],
          reply_to: 'andy@wlcbuilt.com',
          subject: 'How did we do?',
          text
        })
      });
      if (!r.ok) throw new Error(`Resend ${r.status}: ${await r.text().catch(() => '')}`);
      await patchLead(lead.id, { reviewAskedAt: Date.now() });
      sent.push(lead.id);
    } catch (err) {
      console.error(`Review ask failed for lead ${lead.id}:`, err && err.stack ? err.stack : err);
      // Not stamped, so it retries next week.
    }
  }

  return res.status(200).json({ ok: true, sent: sent.length, candidates: candidates.length });
}
