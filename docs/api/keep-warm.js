/**
 * Keep-warm: pings Render backend so it stays awake (used by cron-job.org).
 * When Vercel Root Directory is "docs", this file must live in docs/api/ so it is deployed.
 */
const BACKEND_URL = process.env.FITBIT_BACKEND_URL || 'https://fitbit-public-backend.onrender.com';

export default async function handler(req, res) {
  try {
    const url = `${BACKEND_URL.replace(/\/$/, '')}/health`;
    await fetch(url);
    res.status(200).json({ ok: true });
  } catch (e) {
    res.status(500).json({ ok: false, error: String(e.message) });
  }
}
