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

    const inputOtp = String(otp).trim()
    const user = await db.findUserByEmail(email)
    if (!user) return res.status(404).json({ error: 'Account not found' })

    console.log('[reset-password] stored:', user.resetCode, 'entered:', inputOtp)

    if (!user.resetCode || user.resetCode !== inputOtp) {
      return res.status(400).json({ error: 'Invalid code' })
    }
    if (!user.resetExpires || Date.now() > user.resetExpires) {
      return res.status(400).json({ error: 'Code expired. Request a new one.' })
    }

    user.passwordHash = await bcrypt.hash(newPassword, 10)
    user.passwordResetAt = new Date().toISOString()
    delete user.resetCode
    delete user.resetExpires
    await db.upsertUser(user)

    return res.status(200).json({ ok: true, message: 'Password updated. You can now log in.' })
  } catch (err) {
    return handleError(res, err, 'reset-password')
  }
}
