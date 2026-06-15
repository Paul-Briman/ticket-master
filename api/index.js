import express from 'express'
import authRouter from '../lib/routes/auth.js'
import ordersRouter from '../lib/routes/orders.js'
import sportsRouter from '../lib/routes/sports.js'
import concertsRouter from '../lib/routes/concerts.js'
import artsRouter from '../lib/routes/arts.js'
import familyRouter from '../lib/routes/family.js'
import adminEventsRouter from '../lib/routes/adminEvents.js'
import adminUsersRouter from '../lib/routes/adminUsers.js'
import eventsRouter from '../lib/routes/events.js'

const app = express()

app.disable('x-powered-by')
// 2 MB is enough for two ~700 KB base64-encoded gift-card photos
// (front + back) plus the rest of the order body. The client-side
// imageCompress util keeps each photo well under 500 KB before
// upload, so this ceiling is the safety margin.
app.use(express.json({ limit: '2mb' }))

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
      'GET  /api/concerts',
      'GET  /api/arts',
      'GET  /api/family',
      'GET  /api/health',
      'GET  /api/providers',
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
  })
})

// Provider configuration introspection — useful for debugging which live
// data sources are wired up.
app.get('/api/providers', (req, res) => {
  res.json({
    'football-data': {
      configured: !!process.env.FOOTBALL_DATA_API_KEY,
      coverage: ['world-cup', 'ucl'],
    },
    sportdb: {
      configured: true, // free key '3' always works
      keyOverridden: !!process.env.SPORTDB_API_KEY,
      coverage: ['nba', 'nfl', 'f1', 'ufc', 'tennis', 'mlb', 'boxing'],
    },
    'curated-concerts': {
      configured: true,
      coverage: ['concerts'],
      mode: 'curated',
    },
    'curated-arts': {
      configured: true,
      coverage: ['arts'],
      mode: 'curated',
    },
    'curated-family': {
      configured: true,
      coverage: ['family'],
      mode: 'curated',
    },
    bandsintown: {
      configured: false,
      appId: process.env.BANDSINTOWN_APP_ID || 'ticketmaster-clone',
      coverage: ['concerts'],
      mode: 'standby — partner approval pending',
    },
  })
})

app.use('/api', authRouter)
app.use('/api', ordersRouter)
app.use('/api/events', eventsRouter)
app.use('/api/sports', sportsRouter)
app.use('/api/concerts', concertsRouter)
app.use('/api/arts', artsRouter)
app.use('/api/family', familyRouter)
app.use('/api/admin/events', adminEventsRouter)
app.use('/api/admin/users', adminUsersRouter)

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
