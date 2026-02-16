/**
 * Fitbit High Score – backend for GitHub Pages frontend.
 * Deploy to Render; frontend deploys to GitHub Pages.
 * Handles Fitbit OAuth, session, and API proxy. No API keys in frontend.
 */
require('dotenv').config();
const express = require('express');
const session = require('express-session');
const cookieParser = require('cookie-parser');
const rateLimit = require('express-rate-limit');
const crypto = require('crypto');
const axios = require('axios');

const PORT = process.env.PORT || 3000;
const BASE_URL = process.env.BASE_URL || `http://localhost:${PORT}`;
// GitHub Pages origin for CORS (e.g. https://username.github.io/fitbit-high-score)
const FRONTEND_ORIGIN = process.env.FRONTEND_ORIGIN || 'http://localhost:3000';

const app = express();

// Trust proxy so Render/X-Forwarded-* work
app.set('trust proxy', 1);

// CORS: allow GitHub Pages origin with credentials (cookies)
app.use((req, res, next) => {
  const origin = req.headers.origin;
  const allow = FRONTEND_ORIGIN === '*' ? '*' : (origin === FRONTEND_ORIGIN ? origin : FRONTEND_ORIGIN);
  res.setHeader('Access-Control-Allow-Origin', allow);
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});

app.use(cookieParser());
app.use(express.json());

// Session: cross-site cookie for GitHub Pages -> Render
const isSecure = BASE_URL.startsWith('https');
app.use(session({
  secret: process.env.SESSION_SECRET || 'dev-secret-change-in-production',
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    secure: isSecure,
    sameSite: isSecure ? 'none' : 'lax',
    maxAge: 7 * 24 * 60 * 60 * 1000
  }
}));

// Rate limiting: 100 req/15 min per IP
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false
});
app.use(limiter);

// PKCE helpers
function generateCodeVerifier() {
  return crypto.randomBytes(32).toString('base64url');
}
function codeChallenge(verifier) {
  return crypto.createHash('sha256').update(verifier).digest('base64url');
}

// Fitbit API base
const FITBIT_API = 'https://api.fitbit.com';
const FITBIT_OAUTH = 'https://www.fitbit.com/oauth2';
const SCOPES = 'activity profile social';

// Redirect to Fitbit authorization
app.get('/auth/fitbit', (req, res) => {
  const verifier = generateCodeVerifier();
  req.session.codeVerifier = verifier;
  req.session.save((err) => {
    if (err) return res.status(500).json({ error: 'Session save failed' });
    const challenge = codeChallenge(verifier);
    const state = crypto.randomBytes(16).toString('hex');
    req.session.oauthState = state;
    req.session.save(() => {
      const params = new URLSearchParams({
        response_type: 'code',
        client_id: process.env.FITBIT_CLIENT_ID,
        redirect_uri: process.env.REDIRECT_URI || `${BASE_URL}/auth/callback`,
        scope: SCOPES,
        code_challenge: challenge,
        code_challenge_method: 'S256',
        state
      });
      res.redirect(`${FITBIT_OAUTH}/authorize?${params}`);
    });
  });
});

// OAuth callback: exchange code for tokens, then redirect to frontend
app.get('/auth/callback', (req, res) => {
  const { code, state } = req.query;
  if (!code || state !== req.session.oauthState) {
    return res.redirect(`${FRONTEND_ORIGIN}?error=auth_failed`);
  }
  const verifier = req.session.codeVerifier;
  if (!verifier) return res.redirect(`${FRONTEND_ORIGIN}?error=no_verifier`);

  const redirectUri = process.env.REDIRECT_URI || `${BASE_URL}/auth/callback`;
  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    code,
    code_verifier: verifier,
    client_id: process.env.FITBIT_CLIENT_ID,
    redirect_uri: redirectUri
  });

  const authHeader = Buffer.from(
    `${process.env.FITBIT_CLIENT_ID}:${process.env.FITBIT_CLIENT_SECRET}`
  ).toString('base64');

  axios.post(`${FITBIT_OAUTH}/token`, body, {
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: `Basic ${authHeader}`
    }
  })
    .then((tokenRes) => {
      req.session.fitbit = {
        accessToken: tokenRes.data.access_token,
        refreshToken: tokenRes.data.refresh_token,
        expiresAt: Date.now() + tokenRes.data.expires_in * 1000,
        userId: tokenRes.data.user_id
      };
      delete req.session.codeVerifier;
      delete req.session.oauthState;
      req.session.save((err) => {
        if (err) return res.redirect(`${FRONTEND_ORIGIN}?error=session_failed`);
        res.redirect(`${FRONTEND_ORIGIN}?logged_in=1`);
      });
    })
    .catch((err) => {
      const msg = err.response?.data?.errors?.[0]?.message || 'token_exchange_failed';
      res.redirect(`${FRONTEND_ORIGIN}?error=${encodeURIComponent(msg)}`);
    });
});

// Refresh access token if expired
function ensureToken(req, res, next) {
  const fitbit = req.session?.fitbit;
  if (!fitbit) return res.status(401).json({ error: 'Not authenticated' });
  if (Date.now() < fitbit.expiresAt) return next();
  const body = new URLSearchParams({
    grant_type: 'refresh_token',
    refresh_token: fitbit.refreshToken,
    client_id: process.env.FITBIT_CLIENT_ID
  });
  const authHeader = Buffer.from(
    `${process.env.FITBIT_CLIENT_ID}:${process.env.FITBIT_CLIENT_SECRET}`
  ).toString('base64');
  axios.post(`${FITBIT_OAUTH}/token`, body, {
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: `Basic ${authHeader}`
    }
  })
    .then((r) => {
      req.session.fitbit = {
        ...fitbit,
        accessToken: r.data.access_token,
        refreshToken: r.data.refresh_token || fitbit.refreshToken,
        expiresAt: Date.now() + r.data.expires_in * 1000
      };
      req.session.save(() => next());
    })
    .catch(() => res.status(401).json({ error: 'Token refresh failed' }));
}

// Date validation: yyyy-MM-dd
const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;
function validDate(d) {
  return typeof d === 'string' && DATE_REGEX.test(d) && !isNaN(Date.parse(d));
}

// Proxy: GET /api/profile
app.get('/api/profile', ensureToken, (req, res) => {
  axios.get(`${FITBIT_API}/1/user/-/profile.json`, {
    headers: { Authorization: `Bearer ${req.session.fitbit.accessToken}` }
  })
    .then((r) => res.json(r.data))
    .catch((e) => res.status(e.response?.status || 500).json(e.response?.data || { error: 'Fitbit API error' }));
});

// Proxy: GET /api/leaderboard (friends leaderboard – high score)
app.get('/api/leaderboard', ensureToken, (req, res) => {
  axios.get(`${FITBIT_API}/1.1/user/-/leaderboard/friends.json`, {
    headers: { Authorization: `Bearer ${req.session.fitbit.accessToken}` }
  })
    .then((r) => res.json(r.data))
    .catch((e) => res.status(e.response?.status || 500).json(e.response?.data || { error: 'Fitbit API error' }));
});

// Proxy: GET /api/steps?startDate=yyyy-MM-dd&endDate=yyyy-MM-dd (step challenge date range)
app.get('/api/steps', ensureToken, (req, res) => {
  const start = req.query.startDate;
  const end = req.query.endDate;
  if (!validDate(start) || !validDate(end)) {
    return res.status(400).json({ error: 'Invalid startDate or endDate; use yyyy-MM-dd' });
  }
  if (new Date(start) > new Date(end)) {
    return res.status(400).json({ error: 'startDate must be before or equal to endDate' });
  }
  const url = `${FITBIT_API}/1/user/-/activities/steps/date/${start}/${end}.json`;
  axios.get(url, {
    headers: { Authorization: `Bearer ${req.session.fitbit.accessToken}` }
  })
    .then((r) => res.json(r.data))
    .catch((e) => res.status(e.response?.status || 500).json(e.response?.data || { error: 'Fitbit API error' }));
});

// Logout
app.post('/auth/logout', (req, res) => {
  req.session.destroy(() => res.json({ ok: true }));
});

// Health for Render
app.get('/health', (req, res) => res.json({ status: 'ok' }));

app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
