import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import bcrypt from 'bcryptjs'
import { db } from './db.js'
import authRouter from './routes/auth.js'
import ordersRouter from './routes/orders.js'
import adminRouter from './routes/admin.js'

const app = express()
const PORT = process.env.PORT || 4000

const allowedOrigins = (process.env.CORS_ORIGIN || '*')
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean)

app.use(
  cors({
    origin: allowedOrigins.includes('*') ? true : allowedOrigins,
    credentials: false,
  }),
)
app.use(express.json({ limit: '256kb' }))

app.get('/', (_req, res) => {
  res.json({
    name: 'ticket-master-api',
    status: 'ok',
    endpoints: [
      'GET  /health',
      'POST /api/auth/signup',
      'POST /api/auth/verify-otp',
      'POST /api/auth/resend-otp',
      'POST /api/auth/login',
      'POST /api/auth/forgot-password',
      'POST /api/auth/reset-password',
      'POST /api/orders',
      'GET  /api/orders/me',
      'GET  /api/admin/orders',
      'POST /api/admin/confirm-payment',
    ],
  })
})

app.get('/health', (_req, res) => {
  res.json({ ok: true, ts: new Date().toISOString() })
})

app.use('/api/auth', authRouter)
app.use('/api/orders', ordersRouter)
app.use('/api/admin', adminRouter)

app.use((req, res) => {
  res.status(404).json({ error: 'Not found' })
})

// eslint-disable-next-line no-unused-vars
app.use((err, req, res, _next) => {
  console.error('[error]', err)
  const status = err.status || 500
  res.status(status).json({ error: err.message || 'Server error' })
})

async function seedAdmin() {
  const email = (process.env.ADMIN_EMAIL || 'admin@ticket.com').toLowerCase()
  const password = process.env.ADMIN_PASSWORD || '123456'

  const existing = db.findUserByEmail(email)
  if (existing && existing.role === 'admin' && existing.isVerified) return

  const passwordHash = await bcrypt.hash(password, 10)
  db.upsertUser({
    name: existing?.name || 'Admin',
    email,
    passwordHash,
    role: 'admin',
    isVerified: true,
    createdAt: existing?.createdAt || new Date().toISOString(),
    verifiedAt: existing?.verifiedAt || new Date().toISOString(),
  })
  console.log(`[seed] admin user ensured: ${email}`)
}

seedAdmin().then(() => {
  app.listen(PORT, () => {
    console.log(`[api] ticket-master backend listening on http://localhost:${PORT}`)
    if (!process.env.RESEND_API_KEY) {
      console.warn('[api] RESEND_API_KEY not set — emails will be skipped (logged only)')
    }
  })
})
