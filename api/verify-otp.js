import { db } from '../lib/db.js'
import { signToken } from '../lib/auth.js'
import { sendEmail } from '../lib/email.js'
import { welcomeEmail } from '../lib/templates/welcome.js'
import { normalizeEmail } from '../lib/utils.js'
import { handleError, methodNotAllowed } from '../lib/seed.js'

export default async function handler(req, res) {
  if (req.method !== 'POST') return methodNotAllowed(res, ['POST'])

  try {
    const { email, otp } = req.body || {}
    console.log('[verify-otp] EMAIL RAW:', email, '| otp present:', !!otp)

    if (!email) {
      return res.status(400).json({ error: 'Email required for verification' })
    }
    if (!otp) {
      return res.status(400).json({ error: 'OTP code is required' })
    }

    const normalizedEmail = normalizeEmail(email)
    const inputOtp = String(otp).trim()
    console.log('[verify-otp] LOOKING FOR USER:', normalizedEmail)

    const user = await db.findUserByEmail(normalizedEmail)
    console.log('[verify-otp] USER FOUND:', !!user, user ? `(verified=${user.isVerified})` : '')

    if (!user) {
      const allEmails = await db.getAllUserEmails()
      console.log('[verify-otp] ALL USER EMAILS:', allEmails)
      return res.status(404).json({ error: 'Account not found' })
    }
    if (user.isVerified) {
      return res.status(400).json({ error: 'Account is already verified' })
    }

    console.log('[verify-otp] stored:', user.otpCode, 'entered:', inputOtp)

    if (!user.otpCode || user.otpCode !== inputOtp) {
      return res.status(400).json({ error: 'Invalid OTP' })
    }
    if (!user.otpExpires || Date.now() > user.otpExpires) {
      return res.status(400).json({ error: 'OTP expired. Request a new one.' })
    }

    user.isVerified = true
    user.verifiedAt = new Date().toISOString()
    delete user.otpCode
    delete user.otpExpires
    await db.upsertUser(user)
    console.log('[verify-otp] USER VERIFIED:', user.email)

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
