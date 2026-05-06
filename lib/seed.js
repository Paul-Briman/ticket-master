import bcrypt from 'bcryptjs'
import { db } from './db.js'

let _seeded = false

export async function ensureAdminSeeded() {
  if (_seeded) return
  const email = (process.env.ADMIN_EMAIL || 'admin@ticket.com').toLowerCase()
  const existing = await db.findUserByEmail(email)
  if (existing && existing.role === 'admin' && existing.isVerified) {
    _seeded = true
    return
  }
  const password = process.env.ADMIN_PASSWORD || '123456'
  const passwordHash = await bcrypt.hash(password, 10)
  await db.upsertUser({
    name: existing?.name || 'Admin',
    email,
    passwordHash,
    role: 'admin',
    isVerified: true,
    createdAt: existing?.createdAt || new Date().toISOString(),
    verifiedAt: existing?.verifiedAt || new Date().toISOString(),
  })
  _seeded = true
}

export function applyCors(_req, res) {
  res.setHeader('Cache-Control', 'no-store')
}

export function methodNotAllowed(res, allowed) {
  res.setHeader('Allow', allowed.join(', '))
  return res.status(405).json({ error: 'Method not allowed' })
}

export function handleError(res, err, label) {
  console.error(`[${label || 'api'}]`, err)
  const status = err.status || 500
  return res.status(status).json({ error: err.message || 'Server error' })
}
