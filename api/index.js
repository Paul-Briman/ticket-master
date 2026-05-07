import express from 'express'
import authRouter from '../lib/routes/auth.js'
import ordersRouter from '../lib/routes/orders.js'
import sportsRouter from '../lib/routes/sports.js'

const app = express()

app.disable('x-powered-by')
app.use(express.json({ limit: '256kb' }))

// Health & introspection — handy for debugging the deployment.
app.get('/api', (req, res) => {
  res.json({
    name: 'ticket-master-api',
    status: 'ok',
    routes: [
      'POST /api/signup',
      'POST /api/verify-otp',
      'POST /api/resend-otp',
      'POST /api/login',
      'POST /api/google-login',
      'POST /api/forgot-password',
      'POST /api/reset-password',
      'POST /api/create-order',
      'GET  /api/my-orders',
      'GET  /api/admin-orders',
      'POST /api/confirm-payment',
      'GET  /api/sports',
      'GET  /api/sports/:id',
    ],
  })
})

app.get('/api/health', (req, res) => {
  res.json({
    ok: true,
    method: req.method,
    timestamp: new Date().toISOString(),
    kvEnabled: !!(
      process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN
    ),
    resendConfigured: !!process.env.RESEND_API_KEY,
    sportdbConfigured: !!process.env.SPORTDB_API_KEY || true, // free key works
  })
})

// Mount feature routers under /api so the existing flat URL scheme
// (e.g. /api/signup, /api/create-order) keeps working unchanged.
app.use('/api', authRouter)
app.use('/api', ordersRouter)
app.use('/api/sports', sportsRouter)

// 404 — anything starting with /api that no router matched.
app.use((req, res) => {
  res.status(404).json({ error: 'Not found', path: req.url })
})

// eslint-disable-next-line no-unused-vars
app.use((err, req, res, _next) => {
  console.error('[api] unhandled error:', err)
  const status = err.status || 500
  res.status(status).json({ error: err.message || 'Server error' })
})

export default app
