import bcrypt from 'bcryptjs'
import { db } from '../lib/db.js'
import { handleError, methodNotAllowed } from '../lib/seed.js'

export default async function handler(req, res) {
  if (req.method !== 'POST') return methodNotAllowed(res, ['POST'])

  try {
    const { email, otp, newPassword } = req.body || {}
    if (!email || !otp || !newPassword) {
      return res.status(400).json({ error: 'Email, code, and new password are required' })
    }
    if (newPassword.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' })
    }

    const record = db.findOtp(email, 'reset')
    if (!record) return res.status(400).json({ error: 'Invalid or expired code' })
    if (Date.now() > record.expiresAt) {
      db.deleteOtp(email, 'reset')
      return res.status(400).json({ error: 'Code expired. Request a new one.' })
    }

    const ok = await bcrypt.compare(String(otp), record.hash)
    if (!ok) return res.status(400).json({ error: 'Invalid code' })

    const user = db.findUserByEmail(email)
    if (!user) return res.status(404).json({ error: 'Account not found' })

    user.passwordHash = await bcrypt.hash(newPassword, 10)
    user.passwordResetAt = new Date().toISOString()
    db.upsertUser(user)
    db.deleteOtp(email, 'reset')

    return res.status(200).json({ ok: true, message: 'Password updated. You can now log in.' })
  } catch (err) {
    return handleError(res, err, 'reset-password')
  }
}
