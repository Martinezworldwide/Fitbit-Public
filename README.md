# Fitbit High Score

Public Fitbit profile, high score (friends leaderboard), and step challenges. **No login for visitors** – data is cached from your Fitbit account. **Frontend:** GitHub Pages. **Backend:** Render. Fitbit credentials stay on the server only.

---

## Your URLs (use these)

| What | URL |
|------|-----|
| **GitHub Pages (frontend)** | `https://martinezworldwide.github.io/Fitbit-Public` |
| **Backend repo** | https://github.com/Martinezworldwide/Fitbit-Public-backend |
| **Frontend repo** | https://github.com/Martinezworldwide/Fitbit-Public |

**Render backend URL** – You get this after you create the Web Service on Render (Step 2). It will look like:  
`https://fitbit-public-backend.onrender.com`  
(or whatever name you give the service). Copy it from the Render dashboard top of the service page.

---

## Step 1: Get Fitbit Client ID and Client Secret

1. Go to **https://dev.fitbit.com/apps** and sign in with your Fitbit account.
2. Click **Register an Application** (or open an existing app).
3. Fill in:
   - **Application Name:** e.g. `Fitbit High Score`
   - **Organization:** e.g. `Personal` or your name
   - **Organization Website:** e.g. `https://martinezworldwide.github.io/Fitbit-Public`
   - **OAuth 2.0 Application Type:** choose **Server**
   - **Redirect URL:** leave blank for now (you set it in Step 3 after you have the Render URL).
4. Click **Register**.
5. On the app page you will see:
   - **OAuth 2.0 Client ID** → this is your **FITBIT_CLIENT_ID**
   - **Client Secret** (click to show) → this is your **FITBIT_CLIENT_SECRET**
6. Copy and save both; you will paste them into Render in Step 2.

---

## Step 2: Deploy backend to Render

1. Go to **https://dashboard.render.com** and sign in (e.g. with GitHub).
2. Click **New +** → **Web Service**.
3. Connect **GitHub** if needed, then select the repo **Martinezworldwide/Fitbit-Public-backend**.
4. Set:
   - **Name:** `fitbit-public-backend` (or any name; this becomes your `.onrender.com` URL).
   - **Root Directory:** leave blank.
   - **Branch:** `main`.
   - **Build Command:** `npm install`
   - **Start Command:** `npm start`
5. Click **Advanced** and add **Environment Variables** (you will add `FITBIT_REFRESH_TOKEN` in Step 4):

   | Key | Value |
   |-----|--------|
   | `FITBIT_CLIENT_ID` | The OAuth 2.0 Client ID from Step 1 |
   | `FITBIT_CLIENT_SECRET` | The Client Secret from Step 1 |
   | `REDIRECT_URI` | `https://<YOUR-SERVICE-NAME>.onrender.com/auth/callback` |
   | `BASE_URL` | `https://<YOUR-SERVICE-NAME>.onrender.com` |
   | `FRONTEND_ORIGIN` | `https://martinezworldwide.github.io/Fitbit-Public` |

   Replace `<YOUR-SERVICE-NAME>` with the **Name** you chose (e.g. `fitbit-public-backend`).

6. Click **Create Web Service**. Wait for the first deploy to finish.
7. At the top of the service page, copy the **URL** (e.g. `https://fitbit-public-backend.onrender.com`). You need it for Step 3, 4, and 5.

---

## Step 3: Set Fitbit redirect URL

1. Go back to **https://dev.fitbit.com/apps** and open your app (the one from Step 1).
2. In **Redirect URL**, enter exactly (use the URL you copied from Render, plus `/auth/callback`):
   ```
   https://<YOUR-SERVICE-NAME>.onrender.com/auth/callback
   ```
   Example: `https://fitbit-public-backend.onrender.com/auth/callback`
3. Click **Save**.

---

## Step 4: Connect your Fitbit (one-time, so data is public)

1. Open in a browser: **`https://<YOUR-SERVICE-NAME>.onrender.com/auth/fitbit`** (use your Render URL).
2. Log in with Fitbit and authorize the app.
3. You will see a page titled **Fitbit connected** with a long **FITBIT_REFRESH_TOKEN** value.
4. Copy that entire token. In **Render** → your service → **Environment** → **Add Environment Variable**:
   - Key: **FITBIT_REFRESH_TOKEN**
   - Value: paste the token you copied
5. Click **Save**, then **Manual Deploy** → **Deploy latest commit** (or push a small change) so the backend restarts with the new token.
6. After that, **https://martinezworldwide.github.io/Fitbit-Public** will show your profile and leaderboard to everyone with no login.

---

## Step 5: Turn on GitHub Pages (frontend)

1. Go to **https://github.com/Martinezworldwide/Fitbit-Public**.
2. Click **Settings**.
3. In the left sidebar, click **Pages** (under "Code and automation").
4. Under **Build and deployment** → **Source**, choose **Deploy from a branch**.
5. **Branch:** `main` → **Folder:** `/docs` → click **Save**.
6. The site will be at: **https://martinezworldwide.github.io/Fitbit-Public**

---

## Step 6: Point frontend at your backend

1. In the repo **Fitbit-Public**, open the file **docs/config.js**.
2. Change the line to use your real Render URL (the one from Step 2):
   ```js
   window.API_BASE_URL = 'https://<YOUR-SERVICE-NAME>.onrender.com';
   ```
   Example: `window.API_BASE_URL = 'https://fitbit-public-backend.onrender.com';`
3. Commit and push the change to `main`. GitHub Pages will update in a minute or two.

---

## Step 7: Match FRONTEND_ORIGIN (if requests fail)

If the frontend cannot load profile or leaderboard (CORS or 403), the backend may be rejecting the request because **FRONTEND_ORIGIN** does not match the browser origin.

1. In **Render** → your service → **Environment**.
2. Set **FRONTEND_ORIGIN** to exactly (no trailing slash):
   ```
   https://martinezworldwide.github.io/Fitbit-Public
   ```
3. Save and redeploy if needed.

---

## Summary checklist

- [ ] Step 1: Fitbit app created; Client ID and Client Secret copied.
- [ ] Step 2: Render Web Service created from **Fitbit-Public-backend**; env vars set (no FITBIT_REFRESH_TOKEN yet); backend URL copied.
- [ ] Step 3: Fitbit app Redirect URL = `https://<your-render-service>.onrender.com/auth/callback`.
- [ ] Step 4: Visited **https://&lt;your-render-service&gt;.onrender.com/auth/fitbit**, completed OAuth, copied refresh token, added **FITBIT_REFRESH_TOKEN** to Render, redeployed.
- [ ] Step 5: GitHub Pages enabled for **Fitbit-Public**, branch `main`, folder `/docs`.
- [ ] Step 6: **docs/config.js** in Fitbit-Public has `window.API_BASE_URL` = your Render URL.
- [ ] Step 7: Render env var **FRONTEND_ORIGIN** = `https://martinezworldwide.github.io/Fitbit-Public`.

---

## Refresh token and longevity

- **Why it was revoked:** Fitbit doesn’t publish an exact refresh-token lifetime. Tokens can be invalidated after inactivity, password change, or if you revoke the app in your Fitbit account. Our backend only uses the token when it needs a new access token (e.g. after a Render restart or after ~8 hours).
- **What we do:** Profile and leaderboard are cached for **24 hours**, so we call Fitbit at most once per day for that data. The refresh token is only used when the in-memory access token is missing or expired (e.g. after a deploy or service spin-down).
- **To reduce revokes:** Avoid revoking the app in Fitbit; avoid redeploying more than needed. On Render free tier, spin-down clears in-memory state so the first request after wake-up uses the refresh token again.

---

## Local development

- **Backend:** Copy `env.example` to `.env`. Set `FITBIT_CLIENT_ID`, `FITBIT_CLIENT_SECRET`, `REDIRECT_URI=http://localhost:3000/auth/callback`, `BASE_URL=http://localhost:3000`, `FRONTEND_ORIGIN=http://localhost:3000`. Get `FITBIT_REFRESH_TOKEN` by visiting `http://localhost:3000/auth/fitbit` once (with Fitbit app redirect URI set to `http://localhost:3000/auth/callback` for local testing) and copying the token from the page into `.env`. Run `npm start`.
- **Frontend:** In **docs/config.js** set `window.API_BASE_URL = 'http://localhost:3000'`. Serve the `docs` folder (e.g. `npx serve docs`) and open the URL shown. For local login, add `http://localhost:3000/auth/callback` in your Fitbit app (if Fitbit allows a second redirect URL; otherwise use a separate Fitbit app for dev).

---

## Security and data

- Fitbit Client ID and Client Secret are only used on the backend (Render). The frontend never sees them.
- All profile, leaderboard, and steps data come from the Fitbit API after the user logs in. No mock data is used.
