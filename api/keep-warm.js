/**
 * Called by Vercel Cron every 10 min to ping the Render backend so it stays awake.
 * That way we only use the Fitbit refresh token when the access token expires (~8h), not on every cold start.
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
