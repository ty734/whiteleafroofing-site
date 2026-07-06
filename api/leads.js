// Leads dashboard API (list / update status / delete).
// Protected by a shared password sent in the X-Dash-Key header, checked against
// DASHBOARD_PASSWORD. The dashboard HTML itself is a data-free shell; all lead
// PII is served only through this authenticated endpoint.

import { listLeads, updateStatus, deleteLead, storeReady, STATUSES } from '../lib/store.js';

function authorized(req) {
  const key = req.headers['x-dash-key'] || '';
  const expected = process.env.DASHBOARD_PASSWORD || '';
  // Constant-ish comparison; both are short shared secrets.
  return expected.length > 0 && key === expected;
}

export default async function handler(req, res) {
  if (!authorized(req)) {
    return res.status(401).json({ ok: false, error: 'unauthorized' });
  }
  if (!storeReady()) {
    return res.status(503).json({ ok: false, error: 'storage_not_connected' });
  }

  try {
    if (req.method === 'GET') {
      const leads = await listLeads();
      return res.status(200).json({ ok: true, leads, statuses: STATUSES });
    }

    const b = req.body || {};

    if (req.method === 'PATCH' || (req.method === 'POST' && b.action === 'status')) {
      const lead = await updateStatus(String(b.id || ''), String(b.status || ''));
      return res.status(lead ? 200 : 404).json({ ok: Boolean(lead), lead });
    }

    if (req.method === 'DELETE' || (req.method === 'POST' && b.action === 'delete')) {
      await deleteLead(String(b.id || ''));
      return res.status(200).json({ ok: true });
    }

    res.setHeader('Allow', 'GET, PATCH, DELETE, POST');
    return res.status(405).json({ ok: false, error: 'method_not_allowed' });
  } catch (err) {
    console.error('Leads API error:', err && err.stack ? err.stack : err);
    return res.status(500).json({ ok: false, error: 'server_error' });
  }
}
