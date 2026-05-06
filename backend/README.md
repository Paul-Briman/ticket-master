# Ticketmaster Backend

Node.js + Express API for the Ticketmaster frontend. Handles auth (signup with OTP verification, login, password reset), order creation, admin payment confirmation, and Resend-powered transactional emails.

## Setup

```bash
cd backend
npm install
cp .env.example .env   # Windows: copy .env.example .env
# fill in JWT_SECRET and RESEND_API_KEY
npm run dev
```

The API listens on `http://localhost:4000` and seeds an admin user from `ADMIN_EMAIL` / `ADMIN_PASSWORD` (defaults to `admin@ticket.com` / `123456`).

Data is persisted to a local `data/` folder as JSON (gitignored). Swap `src/db.js` for a real database later.

## Environment variables

| Var               | Purpose                                                                 |
| ----------------- | ----------------------------------------------------------------------- |
| `PORT`            | API port (default `4000`)                                               |
| `JWT_SECRET`      | Signing secret for JWTs (use a long random string)                      |
| `RESEND_API_KEY`  | Resend API key. If unset, emails are logged but not sent.               |
| `EMAIL_FROM`      | From address. Defaults to `ticketmaster <onboarding@resend.dev>`        |
| `APP_URL`         | Frontend URL used in email CTAs                                         |
| `CORS_ORIGIN`     | Comma-separated allowed origins, or `*`                                 |
| `ADMIN_EMAIL`     | Seed admin email                                                        |
| `ADMIN_PASSWORD`  | Seed admin password                                                     |

## Endpoints

All JSON. Auth-protected routes require `Authorization: Bearer <jwt>`.

### Public

- `POST /api/auth/signup` — `{ name, email, password }` → creates unverified user, sends OTP
- `POST /api/auth/verify-otp` — `{ email, otp }` → verifies, sends welcome email, returns `{ token, user }`
- `POST /api/auth/resend-otp` — `{ email }` → resends signup OTP
- `POST /api/auth/login` — `{ email, password }` → `{ token, user }` (only if verified)
- `POST /api/auth/forgot-password` — `{ email }` → sends reset OTP
- `POST /api/auth/reset-password` — `{ email, otp, newPassword }`

### User (auth required)

- `POST /api/orders` — create a `Pending Payment` order
- `GET  /api/orders/me` — list the logged-in user's orders

### Admin (auth + role=admin)

- `GET  /api/admin/orders` — list every order
- `POST /api/admin/confirm-payment` — `{ orderId }` → marks Paid, sends ticket email

## Email behavior

- **OTP signup** (`Verify your Ticketmaster Account`)
- **Welcome** (`Welcome to Ticketmaster`)
- **Password reset OTP** (`Reset your Ticketmaster password`)
- **Ticket confirmation** (`Your Ticket is Confirmed`) — sent on admin confirm

Resend uses `from: ticketmaster <onboarding@resend.dev>` until a custom domain is verified.

## Security notes

- Passwords are hashed with bcrypt (cost 10).
- OTPs are stored hashed and expire after 10 minutes.
- Auth endpoints rate-limited to 30 requests / 15 min per IP.
- Forgot password returns generic success regardless of account existence to avoid enumeration.
