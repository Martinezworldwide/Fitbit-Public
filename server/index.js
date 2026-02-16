/**
 * Fitbit High Score – backend for GitHub Pages frontend.
 * Public mode: set FITBIT_REFRESH_TOKEN in env; backend caches profile/leaderboard for public API (no login).
 * One-time setup: visit /auth/fitbit, complete OAuth, then copy refresh token into Render env and redeploy.
 */
require('dotenv').config();
const express = require('express');
const rateLimit = require('express-rate-limit');
const axios = require('axios');

const PORT = process.env.PORT || 3000;
const BASE_URL = process.env.BASE_URL || `http://localhost:${PORT}`;
const FRONTEND_ORIGIN = process.env.FRONTEND_ORIGIN || 'http://localhost:3000';

const app = express();

app.set('trust proxy', 1);

// CORS: allow GitHub Pages origin. Browser sends origin without path (e.g. https://martinezworldwide.github.io).
// Normalize FRONTEND_ORIGIN to origin (scheme+host+port) so path in env is ignored.
function allowedOrigin() {
  if (FRONTEND_ORIGIN === '*') return '*';
  try {
    return new URL(FRONTEND_ORIGIN).origin;
  } catch {
    return FRONTEND_ORIGIN;
  }
}
app.use((req, res, next) => {
  const origin = req.headers.origin;
  const allow = allowedOrigin();
  const ok = allow === '*' || (origin && origin === allow);
  if (ok) res.setHeader('Access-Control-Allow-Origin', origin || allow);
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});

app.use(express.json());

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false
});
app.use(limiter);

const FITBIT_API = 'https://api.fitbit.com';
const FITBIT_AUTHORIZE = 'https://www.fitbit.com/oauth2';
const FITBIT_TOKEN_URL = 'https://api.fitbit.com/oauth2/token';
const SCOPES = 'activity profile social';
const CACHE_TTL_MS = 10 * 60 * 1000; // 10 min for profile and leaderboard

// In-memory: public Fitbit token and cached data (one account, from FITBIT_REFRESH_TOKEN)
let publicToken = null;
let publicCache = { profile: null, leaderboard: null };

function getPublicAccessToken() {
  if (!process.env.FITBIT_REFRESH_TOKEN) return Promise.resolve(null);
  if (publicToken && Date.now() < publicToken.expiresAt) return Promise.resolve(publicToken.accessToken);
  const body = new URLSearchParams({
    grant_type: 'refresh_token',
    refresh_token: process.env.FITBIT_REFRESH_TOKEN,
    client_id: process.env.FITBIT_CLIENT_ID
  });
  const authHeader = Buffer.from(
    `${process.env.FITBIT_CLIENT_ID}:${process.env.FITBIT_CLIENT_SECRET}`
  ).toString('base64');
  return axios.post(FITBIT_TOKEN_URL, body, {
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', Authorization: `Basic ${authHeader}` }
  })
    .then((r) => {
      publicToken = {
        accessToken: r.data.access_token,
        refreshToken: r.data.refresh_token || process.env.FITBIT_REFRESH_TOKEN,
        expiresAt: Date.now() + (r.data.expires_in || 28800) * 1000
      };
      return publicToken.accessToken;
    })
    .catch(() => null);
}

// Public API: profile (no login required)
app.get('/api/public/profile', (req, res) => {
  if (publicCache.profile && Date.now() - publicCache.profile.at < CACHE_TTL_MS) {
    return res.json(publicCache.profile.data);
  }
  getPublicAccessToken()
    .then((token) => {
      if (!token) return res.status(503).json({ error: 'Public data not configured. Connect Fitbit once via /auth/fitbit and set FITBIT_REFRESH_TOKEN in Render.' });
      return axios.get(`${FITBIT_API}/1/user/-/profile.json`, { headers: { Authorization: `Bearer ${token}` } });
    })
    .then((r) => {
      if (!r || !r.data) return;
      publicCache.profile = { data: r.data, at: Date.now() };
      res.json(r.data);
    })
    .catch((e) => {
      if (e.response && e.response.status) return res.status(e.response.status).json(e.response.data || { error: 'Fitbit API error' });
      res.status(503).json({ error: 'Could not load profile.' });
    });
});

// Public API: leaderboard (no login required)
app.get('/api/public/leaderboard', (req, res) => {
  if (publicCache.leaderboard && Date.now() - publicCache.leaderboard.at < CACHE_TTL_MS) {
    return res.json(publicCache.leaderboard.data);
  }
  getPublicAccessToken()
    .then((token) => {
      if (!token) return res.status(503).json({ error: 'Public data not configured.' });
      return axios.get(`${FITBIT_API}/1.1/user/-/leaderboard/friends.json`, { headers: { Authorization: `Bearer ${token}` } });
    })
    .then((r) => {
      if (!r || !r.data) return;
      publicCache.leaderboard = { data: r.data, at: Date.now() };
      res.json(r.data);
    })
    .catch((e) => {
      if (e.response && e.response.status) return res.status(e.response.status).json(e.response.data || { error: 'Fitbit API error' });
      res.status(503).json({ error: 'Could not load leaderboard.' });
    });
});

// Public API: steps for date range (no login required)
const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;
function validDate(d) {
  return typeof d === 'string' && DATE_REGEX.test(d) && !isNaN(Date.parse(d));
}
app.get('/api/public/steps', (req, res) => {
  const start = req.query.startDate;
  const end = req.query.endDate;
  if (!validDate(start) || !validDate(end)) {
    return res.status(400).json({ error: 'Invalid startDate or endDate; use yyyy-MM-dd' });
  }
  if (new Date(start) > new Date(end)) {
    return res.status(400).json({ error: 'startDate must be before or equal to endDate' });
  }
  getPublicAccessToken()
    .then((token) => {
      if (!token) return res.status(503).json({ error: 'Public data not configured.' });
      return axios.get(`${FITBIT_API}/1/user/-/activities/steps/date/${start}/${end}.json`, { headers: { Authorization: `Bearer ${token}` } });
    })
    .then((r) => {
      if (!r || !r.data) return;
      res.json(r.data);
    })
    .catch((e) => {
      if (e.response && e.response.status) return res.status(e.response.status).json(e.response.data || { error: 'Fitbit API error' });
      res.status(503).json({ error: 'Could not load steps.' });
    });
});

// One-time setup: OAuth flow; after callback, show refresh token to paste into Render
const crypto = require('crypto');
let setupState = null;
let setupVerifier = null;

function generateCodeVerifier() {
  return crypto.randomBytes(32).toString('base64url');
}
function codeChallenge(verifier) {
  return crypto.createHash('sha256').update(verifier).digest('base64url');
}

app.get('/auth/fitbit', (req, res) => {
  setupVerifier = generateCodeVerifier();
  setupState = crypto.randomBytes(16).toString('hex');
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: process.env.FITBIT_CLIENT_ID,
    redirect_uri: process.env.REDIRECT_URI || `${BASE_URL}/auth/callback`,
    scope: SCOPES,
    code_challenge: codeChallenge(setupVerifier),
    code_challenge_method: 'S256',
    state: setupState
  });
  res.redirect(`${FITBIT_AUTHORIZE}/authorize?${params}`);
});

app.get('/auth/callback', (req, res) => {
  const { code, state } = req.query;
  if (!code || state !== setupState || !setupVerifier) {
    return res.status(400).send('Invalid or expired callback. Start again from /auth/fitbit');
  }
  const redirectUri = process.env.REDIRECT_URI || `${BASE_URL}/auth/callback`;
  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    code,
    code_verifier: setupVerifier,
    client_id: process.env.FITBIT_CLIENT_ID,
    redirect_uri: redirectUri
  });
  const authHeader = Buffer.from(
    `${process.env.FITBIT_CLIENT_ID}:${process.env.FITBIT_CLIENT_SECRET}`
  ).toString('base64');
  axios.post(FITBIT_TOKEN_URL, body, {
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', Authorization: `Basic ${authHeader}` }
  })
    .then((tokenRes) => {
      const refreshToken = tokenRes.data.refresh_token;
      const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Fitbit connected</title></head><body style="font-family:sans-serif;max-width:560px;margin:2rem auto;padding:1rem;">
<h1>Fitbit connected</h1>
<p>To show your profile and leaderboard publicly (no login for visitors), add this to Render:</p>
<ol>
  <li>Open your Render service → <strong>Environment</strong>.</li>
  <li>Add variable: <strong>FITBIT_REFRESH_TOKEN</strong></li>
  <li>Paste this value (copy the whole line):</li>
</ol>
<pre style="background:#f0f0f0;padding:1rem;overflow:auto;word-break:break-all;">${refreshToken}</pre>
<p>Then click <strong>Save</strong> and redeploy the service. After that, your public page will show your data without requiring login.</p>
<p><a href="${FRONTEND_ORIGIN}">Back to site</a></p>
</body></html>`;
      res.send(html);
    })
    .catch((err) => {
      const msg = err.response?.data?.errors?.[0]?.message || 'Token exchange failed';
      res.status(500).send(`Error: ${msg}`);
    });
});

app.get('/health', (req, res) => res.json({ status: 'ok' }));

app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
