/**
 * /api/trip.js — Trip persistence using Vercel Blob
 *
 * GET  /api/trip?id=ts_xxx  → Returns stored trip JSON
 * POST /api/trip             → Stores trip JSON (body: {tripId, data})
 *
 * Setup:
 *   Vercel dashboard → Storage → Create Database → Blob
 *   Connect to your project → the env var BLOB_READ_WRITE_TOKEN is injected automatically.
 */

import { put, head } from '@vercel/blob';

const PREFIX = 'trips/';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const hasBlob = !!process.env.BLOB_READ_WRITE_TOKEN;

  // ── GET ─────────────────────────────────────────────────────────────────
  if (req.method === 'GET') {
    const id = req.query?.id;
    if (!id || !id.startsWith('ts_'))
      return res.status(400).json({ error: 'Invalid id' });

    if (!hasBlob)
      return res.status(404).json({ error: 'No storage', id });

    try {
      const { url } = await head(`${PREFIX}${id}.json`, {
        token: process.env.BLOB_READ_WRITE_TOKEN,
      });
      const r = await fetch(url);
      if (!r.ok) return res.status(404).json({ error: 'Not found', id });
      const trip = await r.json();
      return res.status(200).json({ trip });
    } catch {
      return res.status(404).json({ error: 'Not found', id });
    }
  }

  // ── POST ─────────────────────────────────────────────────────────────────
  if (req.method === 'POST') {
    let body = req.body;
    if (typeof body === 'string') {
      try { body = JSON.parse(body); } catch { return res.status(400).json({ error: 'Invalid JSON' }); }
    }

    const { tripId, data } = body || {};
    if (!tripId || !tripId.startsWith('ts_'))
      return res.status(400).json({ error: 'Invalid tripId' });

    if (!hasBlob) {
      console.warn('BLOB_READ_WRITE_TOKEN not set');
      return res.status(200).json({ ok: false, reason: 'no_storage', tripId });
    }

    try {
      const payload = { ...data, tripId, savedAt: new Date().toISOString() };

      // Trim large HTML fields
      const MAX = 50000;
      for (const k of ['timelineHTML','tipsHTML','recapHTML','ctaHTML','transportHTML','expHTML','introHTML']) {
        if (payload[k]?.length > MAX) payload[k] = payload[k].slice(0, MAX) + '<!-- trimmed -->';
      }

      const { url } = await put(
        `${PREFIX}${tripId}.json`,
        JSON.stringify(payload),
        { access: 'public', token: process.env.BLOB_READ_WRITE_TOKEN, addRandomSuffix: false }
      );

      return res.status(200).json({
        ok: true, tripId, blobUrl: url,
        tripUrl: `${req.headers['x-forwarded-proto']||'https'}://${req.headers.host}/#viaje=${tripId}`,
      });
    } catch (e) {
      console.error('[trip save error]', e);
      return res.status(500).json({ error: 'Save failed', detail: e.message });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
