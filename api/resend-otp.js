import bcrypt from 'bcryptjs'
import { db } from '../lib/db.js'
import { sendEmail } from '../lib/email.js'
import { otpEmail } from '../lib/templates/otp.js'
import { generateOtp, isValidEmail } from '../lib/utils.js'
import { handleError, methodNotAllowed } from '../lib/seed.js'

const OTP_TTL_MS = 10 * 60 * 1000

export default async function handler(req, res) {
  if (req.method !== 'POST') return methodNotAllowed(res, ['POST'])

  try {
    const { email } = req.body || {}
    if (!isValidEmail(email)) {
      return res.status(400).json({ error: 'A valid email is required' })
    }

    const user = db.findUserByEmail(email)
    if (!user) {
      return res.status(200).json({ ok: true, message: 'If an account exists, a code has been sent.' })
    }
    if (user.isVerified) {
      return res.status(400).json({ error: 'Account is already verified' })
    }

    const otp = generateOtp()
    const otpHash = await bcrypt.hash(otp, 10)
    db.upsertOtp({
      email: user.email,
      purpose: 'signup',
      hash: otpHash,
      expiresAt: Date.now() + OTP_TTL_MS,
    })

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
