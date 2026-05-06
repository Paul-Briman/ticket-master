import { db } from '../lib/db.js'
import { sendEmail } from '../lib/email.js'
import { otpEmail } from '../lib/templates/otp.js'
import { generateOtp, isValidEmail, normalizeEmail } from '../lib/utils.js'
import { handleError, methodNotAllowed } from '../lib/seed.js'

const OTP_TTL_MS = 10 * 60 * 1000

export default async function handler(req, res) {
  if (req.method !== 'POST') return methodNotAllowed(res, ['POST'])

  try {
    const { email } = req.body || {}
    console.log('[resend-otp] EMAIL RAW:', email)

    if (!isValidEmail(email)) {
      return res.status(400).json({ error: 'A valid email is required' })
    }

    const normalizedEmail = normalizeEmail(email)
    const user = await db.findUserByEmail(normalizedEmail)
    console.log('[resend-otp] USER FOUND:', !!user)

    if (!user) {
      return res.status(404).json({ error: 'No account found for this email. Please sign up first.' })
    }
    if (user.isVerified) {
      return res.status(400).json({ error: 'Account is already verified' })
    }

    const otp = generateOtp()
    user.otpCode = otp
    user.otpExpires = Date.now() + OTP_TTL_MS
    await db.upsertUser(user)
    console.log('[resend-otp] new OTP for', user.email, ':', otp)

    await sendEmail({
      to: user.email,
      subject: 'Verify your Ticketmaster Account',
      html: otpEmail({ name: user.name, otp, expiresInMinutes: 10 }),
      text: `Your Ticketmaster verification code is ${otp}. It expires in 10 minutes.`,
    })

    return res.status(200).json({ ok: true, message: 'Verification code sent' })
  } catch (err) {
    return handleError(res, err, 'resend-otp')
  }
}
