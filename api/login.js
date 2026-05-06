import bcrypt from 'bcryptjs'
import { db } from '../lib/db.js'
import { signToken } from '../lib/auth.js'
import { normalizeEmail } from '../lib/utils.js'
import { ensureAdminSeeded, handleError, methodNotAllowed } from '../lib/seed.js'

export default async function handler(req, res) {
  if (req.method !== 'POST') return methodNotAllowed(res, ['POST'])

  try {
    await ensureAdminSeeded()

    const { email, password } = req.body || {}
    console.log('[login] EMAIL RAW:', email)

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' })
    }

    const normalizedEmail = normalizeEmail(email)
    const user = await db.findUserByEmail(normalizedEmail)
    console.log('[login] USER FOUND:', !!user, user ? `(verified=${user.isVerified}, role=${user.role})` : '')
    if (!user) return res.status(401).json({ error: 'Invalid credentials' })
    if (!user.isVerified) {
      return res.status(403).json({
        error: 'Account not verified. Check your email for the verification code.',
        unverified: true,
      })
    }

    const ok = await bcrypt.compare(password, user.passwordHash)
    if (!ok) return res.status(401).json({ error: 'Invalid credentials' })

    const token = signToken({
      email: user.email,
      name: user.name,
      role: user.role,
    })
    return res.status(200).json({
      ok: true,
      token,
      user: { name: user.name, email: user.email, role: user.role },
    })
  } catch (err) {
    return handleError(res, err, 'login')
  }
}
