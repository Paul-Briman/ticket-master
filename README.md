# Ticketmaster

Light-themed ticket marketplace inspired by Ticketmaster. Vercel-ready monorepo: React + Vite frontend in `client/`, Vercel serverless functions in `api/`, shared backend code in `lib/`.

## Project layout

```
.
├── api/                Vercel serverless functions (one file per endpoint)
│   ├── signup.js
│   ├── verify-otp.js
│   ├── resend-otp.js
│   ├── login.js
│   ├── forgot-password.js
│   ├── reset-password.js
│   ├── create-order.js
│   ├── my-orders.js
│   ├── admin-orders.js
│   └── confirm-payment.js
├── client/             React + Vite frontend
│   ├── src/
│   ├── index.html
│   ├── vite.config.js
│   └── package.json
├── lib/                Shared backend code (used by api/* functions)
│   ├── db.js           File-backed JSON store (uses /tmp on Vercel)
│   ├── auth.js         JWT + auth helpers
│   ├── email.js        Resend wrapper
│   ├── seed.js         Admin seed + handler helpers
│   ├── utils.js
│   └── templates/      Branded HTML emails
├── package.json        Root — backend deps for serverless functions
├── vercel.json         Build + SPA rewrites
└── .env                Local secrets (gitignored)
```

## Local development

```bash
# 1. Install once
npm install                 # backend deps for /api/
cd client && npm install    # frontend deps
cd ..

# 2. Run via Vercel CLI (handles both API + Vite together)
npm run dev                 # alias for `vercel dev`
```

Vercel CLI runs the React app on `http://localhost:3000` and serves `/api/*` from the same origin — no CORS or proxy headaches.

> Don't have the CLI? `npm install -g vercel`. Or run `npm run client:dev` for just the Vite app — but API calls will fail without functions running.

## Deployment

Push to GitHub. Vercel:

1. runs `npm install` (root → backend deps)
2. runs `cd client && npm install && npm run build` (frontend → `client/dist`)
3. detects `api/*.js` and deploys each as a serverless function

Set these env vars in the Vercel dashboard:

- `JWT_SECRET` — long random string
- `RESEND_API_KEY` — your Resend key
- `EMAIL_FROM` — `ticketmaster <onboarding@resend.dev>` (default)
- `APP_URL` — your production URL
- `ADMIN_EMAIL` / `ADMIN_PASSWORD` — seeded admin credentials

## API surface

Public:
- `POST /api/signup` `{ name, email, password }` — sends OTP
- `POST /api/verify-otp` `{ email, otp }` — verifies + welcome email + JWT
- `POST /api/resend-otp` `{ email }`
- `POST /api/login` `{ email, password }` — returns JWT (verified accounts only)
- `POST /api/forgot-password` `{ email }` — sends reset OTP
- `POST /api/reset-password` `{ email, otp, newPassword }`

Authed (`Authorization: Bearer <jwt>`):
- `POST /api/create-order` — creates `Pending Payment` order
- `GET  /api/my-orders` — current user's orders

Admin (role=admin):
- `GET  /api/admin-orders` — every order
- `POST /api/confirm-payment` `{ orderId }` — flips to `Paid` and sends ticket email

## Storage

`lib/db.js` auto-detects how to persist:

- **Vercel KV** (recommended for production): if `KV_REST_API_URL` and `KV_REST_API_TOKEN` are set, all reads/writes go through Vercel KV (Upstash Redis). Shared across all serverless instances → no more "Invalid OTP" surprises across cold starts.
- **File fallback**: otherwise, JSON files in `data/` (local) or `/tmp/tm-data` (Vercel). Fast, but `/tmp` is per-instance and ephemeral.

### Enable Vercel KV (one-time setup)

1. In your Vercel project: **Storage** → **Create Database** → **Marketplace Database Providers** → pick **Upstash for Redis** (or any Redis-compatible KV).
2. Click **Connect to Project** for `ticket-master`.
3. Vercel auto-injects `KV_REST_API_URL`, `KV_REST_API_TOKEN`, `KV_REST_API_READ_ONLY_TOKEN`, and `KV_URL` into your project's env.
4. Redeploy (push any commit, or click **Redeploy**).

`lib/db.js` will pick up the env vars automatically — no code changes needed.

## Google Sign-In (optional)

The login and signup pages render a "Continue with Google" button when `VITE_GOOGLE_CLIENT_ID` is set. Without it, both pages still work via email + password.

### One-time Google setup

1. Open the Google Cloud Console: https://console.cloud.google.com/apis/credentials
2. Configure the **OAuth consent screen** (External, fill in basic app info, add your email).
3. Create credentials → **OAuth client ID** → **Web application**.
4. **Authorized JavaScript origins** — add:
   - `http://localhost:5173`
   - `http://localhost:3000`
   - your production URL (e.g. `https://ticket-master-henna.vercel.app`)
5. Copy the resulting Client ID.
6. Add it as **`VITE_GOOGLE_CLIENT_ID`** to your Vercel project env vars (and `.env` locally).
7. Redeploy.

Google sign-in users are auto-created on first login, marked verified, and skip the OTP step. Existing email users who Google-in get auto-verified and have any pending OTP cleared.

## Email behavior

All emails use the layout in `lib/templates/layout.js`:

- Blue `ticketmaster®` header pill
- White body, blue accents
- Footer

Templates: `otp.js`, `welcome.js`, `reset.js`, `ticket.js` (branded digital pass with QR + Download CTA).

If `RESEND_API_KEY` is missing, emails are **logged**, not sent — handy for local dev.
