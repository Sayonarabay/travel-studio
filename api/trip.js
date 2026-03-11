/**
 * /api/trip.js — Trip persistence endpoint
 *
 * GET  /api/trip?id=ts_xxx  → Returns stored trip JSON
 * POST /api/trip             → Stores trip JSON (body: {tripId, data})
 *
 * Storage strategy (in order of availability):
 *   1. Vercel KV (Redis) — if KV_REST_API_URL env var is set
 *   2. In-memory Map (fallback — resets on cold start, fine for MVP)
 *
 * To enable persistent storage across all devices:
 *   → Vercel dashboard → Storage → Create KV database → link to project
 *   → The env vars KV_REST_API_URL and KV_REST_API_TOKEN are auto-injected
 */

// In-memory fallback (works during one server instance lifecycle)
const memStore = new Map();

// TTL: 30 days in seconds
const TTL_SECONDS = 60 * 60 * 24 * 30;

// ── Vercel KV helpers ──────────────────────────────────────────────────────
async function kvSet(key, value) {
  const url = process.env.KV_REST_API_URL;
  const token = process.env.KV_REST_API_TOKEN;
  if (!url || !token) return false;
  try {
    const res = await fetch(`${url}/set/${encodeURIComponent(key)}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(value),
    });
    // Set expiry
    await fetch(`${url}/expire/${encodeURIComponent(key)}/${TTL_SECONDS}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    });
    return res.ok;
  } catch (e) {
    console.error('[KV set error]', e);
    return false;
  }
}

async function kvGet(key) {
  const url = process.env.KV_REST_API_URL;
  const token = process.env.KV_REST_API_TOKEN;
  if (!url || !token) return null;
  try {
    const res = await fetch(`${url}/get/${encodeURIComponent(key)}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return null;
    const json = await res.json();
    return json?.result ?? null;
  } catch (e) {
    console.error('[KV get error]', e);
    return null;
  }
}

// ── Main handler ──────────────────────────────────────────────────────────
export default async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const hasKV = !!(process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN);

  // ── GET: retrieve trip ──
  if (req.method === 'GET') {
    const id = req.query?.id;
    if (!id || typeof id !== 'string' || !id.startsWith('ts_')) {
      return res.status(400).json({ error: 'Invalid trip id' });
    }

    let trip = null;

    if (hasKV) {
      trip = await kvGet(`trip:${id}`);
    } else {
      trip = memStore.get(id) || null;
    }

    if (!trip) {
      return res.status(404).json({ error: 'Trip not found', id });
    }

    return res.status(200).json({ trip, source: hasKV ? 'kv' : 'memory' });
  }

  // ── POST: store trip ──
  if (req.method === 'POST') {
    let body = req.body;
    // Parse if needed
    if (typeof body === 'string') {
      try { body = JSON.parse(body); } catch { return res.status(400).json({ error: 'Invalid JSON' }); }
    }

    const { tripId, data } = body || {};
    if (!tripId || typeof tripId !== 'string' || !tripId.startsWith('ts_')) {
      return res.status(400).json({ error: 'Missing or invalid tripId' });
    }
    if (!data || typeof data !== 'object') {
      return res.status(400).json({ error: 'Missing data' });
    }

    // Sanitize — don't store massive HTML if it blows up KV limits (512KB)
    const payload = {
      ...data,
      tripId,
      savedAt: new Date().toISOString(),
    };

    // Trim large HTML fields if needed
    const MAX_FIELD = 40000; // chars
    for (const k of ['timelineHTML','tipsHTML','recapHTML','ctaHTML','transportHTML','expHTML']) {
      if (payload[k] && payload[k].length > MAX_FIELD) {
        payload[k] = payload[k].slice(0, MAX_FIELD) + '<!-- trimmed -->';
      }
    }

    let saved = false;
    if (hasKV) {
      saved = await kvSet(`trip:${tripId}`, payload);
    } else {
      memStore.set(tripId, payload);
      // Keep max 500 trips in memory
      if (memStore.size > 500) {
        const oldest = memStore.keys().next().value;
        memStore.delete(oldest);
      }
      saved = true;
    }

    return res.status(200).json({
      ok: saved,
      tripId,
      storage: hasKV ? 'kv' : 'memory',
      url: `${req.headers['x-forwarded-proto'] || 'https'}://${req.headers['host']}/#viaje=${tripId}`,
    });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
