// Lead store for the White Leaf Roofing dashboard.
// Production: Upstash Redis via its REST API (env vars auto-added by the Vercel
// KV / Upstash integration). Local dev/testing: a JSON file under the OS temp dir,
// so the whole flow can be exercised without a live database.

import { promises as fs } from 'fs';
import os from 'os';
import path from 'path';

const REST_URL = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL || '';
const REST_TOKEN = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN || '';
const INDEX = 'leads:index';
const DEV_FILE = path.join(os.tmpdir(), 'wlr-leads-dev.json');

export const STATUSES = ['new', 'called', 'won'];
export const storeReady = () => Boolean(REST_URL && REST_TOKEN) || process.env.LEADS_DEV === '1';
const usingRedis = () => Boolean(REST_URL && REST_TOKEN);

// ---- Upstash REST (pipeline of commands) ----
async function redis(pipeline) {
  const r = await fetch(`${REST_URL}/pipeline`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${REST_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(pipeline)
  });
  if (!r.ok) throw new Error(`redis ${r.status}: ${await r.text().catch(() => '')}`);
  return (await r.json()).map((x) => x.result);
}

// ---- Local dev file backend ----
async function devRead() {
  try { return JSON.parse(await fs.readFile(DEV_FILE, 'utf8')); }
  catch { return {}; }
}
async function devWrite(obj) {
  await fs.writeFile(DEV_FILE, JSON.stringify(obj), 'utf8');
}

// ---- Public API ----
export async function addLead(lead) {
  const id = `${Date.now()}${Math.floor(Math.random() * 1000)}`;
  const record = {
    id,
    name: lead.name || '',
    phone: lead.phone || '',
    email: lead.email || '',
    message: lead.message || '',
    page: lead.page || '',
    status: 'new',
    createdAt: Date.now()
  };
  if (usingRedis()) {
    await redis([
      ['SET', `lead:${id}`, JSON.stringify(record)],
      ['ZADD', INDEX, String(record.createdAt), id]
    ]);
  } else {
    const all = await devRead();
    all[id] = record;
    await devWrite(all);
  }
  return record;
}

export async function listLeads() {
  if (usingRedis()) {
    const [ids] = await redis([['ZREVRANGE', INDEX, '0', '-1']]);
    if (!ids || !ids.length) return [];
    const keys = ids.map((id) => `lead:${id}`);
    const [vals] = await redis([['MGET', ...keys]]);
    return (vals || []).filter(Boolean).map((v) => JSON.parse(v));
  }
  const all = await devRead();
  return Object.values(all).sort((a, b) => b.createdAt - a.createdAt);
}

export async function updateStatus(id, status) {
  if (!STATUSES.includes(status)) throw new Error('bad status');
  if (usingRedis()) {
    const [raw] = await redis([['GET', `lead:${id}`]]);
    if (!raw) return null;
    const lead = JSON.parse(raw);
    lead.status = status;
    await redis([['SET', `lead:${id}`, JSON.stringify(lead)]]);
    return lead;
  }
  const all = await devRead();
  if (!all[id]) return null;
  all[id].status = status;
  await devWrite(all);
  return all[id];
}

// Merge arbitrary fields into a lead (used by the review-ask cron to stamp
// reviewAskedAt so no customer is ever emailed twice).
export async function patchLead(id, fields) {
  if (usingRedis()) {
    const [raw] = await redis([['GET', `lead:${id}`]]);
    if (!raw) return null;
    const lead = { ...JSON.parse(raw), ...fields };
    await redis([['SET', `lead:${id}`, JSON.stringify(lead)]]);
    return lead;
  }
  const all = await devRead();
  if (!all[id]) return null;
  all[id] = { ...all[id], ...fields };
  await devWrite(all);
  return all[id];
}

export async function deleteLead(id) {
  if (usingRedis()) {
    await redis([['DEL', `lead:${id}`], ['ZREM', INDEX, id]]);
    return true;
  }
  const all = await devRead();
  if (all[id]) { delete all[id]; await devWrite(all); }
  return true;
}
