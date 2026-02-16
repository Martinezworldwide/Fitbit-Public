# Fitbit High Score

Public Fitbit profile, high score (friends leaderboard), and step challenge. **Frontend:** GitHub Pages. **Backend:** Render. Fitbit API keys stay on the server only.

## What you need

- A [Fitbit developer app](https://dev.fitbit.com/apps) (Server type) with **Redirect URI** set to your Render backend callback URL (see below).
- A [Render](https://render.com) account and a [GitHub](https://github.com) repo for this project.

## 1. Deploy backend to Render

1. Push this repo to GitHub.
2. In [Render Dashboard](https://dashboard.render.com): **New** → **Web Service**.
3. Connect the GitHub repo. Root directory: leave blank. Branch: `main` (or your default).
4. **Build command:** `npm install`
5. **Start command:** `npm start`
6. **Environment** (required):

   | Key | Value |
   |-----|--------|
   | `FITBIT_CLIENT_ID` | Your Fitbit app Client ID |
   | `FITBIT_CLIENT_SECRET` | Your Fitbit app Client Secret |
   | `REDIRECT_URI` | `https://<your-render-service-name>.onrender.com/auth/callback` |
   | `BASE_URL` | `https://<your-render-service-name>.onrender.com` |
   | `FRONTEND_ORIGIN` | Your GitHub Pages URL (e.g. `https://yourusername.github.io/fitbit-high-score`) |
   | `SESSION_SECRET` | A long random string (e.g. from `openssl rand -hex 32`) |

7. Create the service. Note the live URL (e.g. `https://fitbit-high-score-api.onrender.com`).

## 2. Configure Fitbit app

1. Open [Fitbit apps](https://dev.fitbit.com/apps) → your app (or create one, type **Server**).
2. **Redirect URL:** add exactly: `https://<your-render-service-name>.onrender.com/auth/callback`
3. Save.

## 3. Deploy frontend to GitHub Pages

1. In **docs/config.js**, set the API base URL to your Render backend:

   ```js
   window.API_BASE_URL = 'https://<your-render-service-name>.onrender.com';
   ```

2. In the GitHub repo: **Settings** → **Pages** → **Source**: “Deploy from a branch” → Branch **main** (or **master**) → Folder **/docs** → Save.
3. The site will be at `https://<username>.github.io/<repo-name>/` (if repo is `fitbit-high-score`, then `https://<username>.github.io/fitbit-high-score/`).
4. Ensure **FRONTEND_ORIGIN** on Render matches this URL exactly (including trailing slash or not – match what the browser sends as `Origin`; usually no trailing slash).

## 4. Local development

- **Backend:** Copy `env.example` to `.env`, set `FITBIT_*`, `REDIRECT_URI=http://localhost:3000/auth/callback`, `BASE_URL=http://localhost:3000`, `FRONTEND_ORIGIN=http://localhost:3000`, `SESSION_SECRET`. Run `npm start`.
- **Frontend:** In **docs/config.js** set `window.API_BASE_URL = 'http://localhost:3000'`. Open **docs/index.html** in a browser or use a local server (e.g. `npx serve docs`). For Fitbit OAuth locally, add `http://localhost:3000/auth/callback` (or your local URL) as a redirect URI in a separate Fitbit app or the same app if Fitbit allows multiple URIs.

## Security

- Fitbit **client ID and secret** are only used on the backend (Render). The frontend never sees them.
- Backend uses rate limiting and validates date parameters for the steps API.
- Session cookie is `HttpOnly`, `Secure` in production, and `SameSite=None` so GitHub Pages (different origin) can send it to Render.

## Data

All profile, leaderboard, and steps data come from the **Fitbit API** after the user logs in with Fitbit. No mock or placeholder data is used.
