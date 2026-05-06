import bcrypt from 'bcryptjs'
import { db } from '../lib/db.js'
import { signToken } from '../lib/auth.js'
import { sendEmail } from '../lib/email.js'
import { welcomeEmail } from '../lib/templates/welcome.js'
import { handleError, methodNotAllowed } from '../lib/seed.js'

export default async function handler(req, res) {
  if (req.method !== 'POST') return methodNotAllowed(res, ['POST'])

  try {
    const { email, otp } = req.body || {}
    if (!email || !otp) {
      return res.status(400).json({ error: 'Email and OTP are required' })
    }

    const record = db.findOtp(email, 'signup')
    if (!record) return res.status(400).json({ error: 'Invalid or expired code' })
    if (Date.now() > record.expiresAt) {
      db.deleteOtp(email, 'signup')
      return res.status(400).json({ error: 'Code expired. Request a new one.' })
    }

    const ok = await bcrypt.compare(String(otp), record.hash)
    if (!ok) return res.status(400).json({ error: 'Invalid code' })

    const user = db.findUserByEmail(email)
    if (!user) return res.status(404).json({ error: 'Account not found' })

    user.isVerified = true
    user.verifiedAt = new Date().toISOString()
    db.upsertUser(user)
    db.deleteOtp(email, 'signup')

    await sendEmail({
      to: user.email,
      subject: 'Welcome to Ticketmaster',
      html: welcomeEmail({ name: user.name }),
      text: `Welcome to Ticketmaster, ${user.name}! Your account is verified and ready.`,
    })

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
    return handleError(res, err, 'verify-otp')
  }
}
