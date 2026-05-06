import bcrypt from 'bcryptjs'
import { db } from '../lib/db.js'
import { sendEmail } from '../lib/email.js'
import { resetEmail } from '../lib/templates/reset.js'
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
    if (user) {
      const otp = generateOtp()
      const otpHash = await bcrypt.hash(otp, 10)
      db.upsertOtp({
        email: user.email,
        purpose: 'reset',
        hash: otpHash,
        expiresAt: Date.now() + OTP_TTL_MS,
      })
      await sendEmail({
        to: user.email,
        subject: 'Reset your Ticketmaster password',
        html: resetEmail({ name: user.name, otp, expiresInMinutes: 10 }),
        text: `Your Ticketmaster reset code is ${otp}. It expires in 10 minutes.`,
      })
    }

    return res.status(200).json({
      ok: true,
      message: 'If an account exists, a reset code has been sent.',
    })
  } catch (err) {
    return handleError(res, err, 'forgot-password')
  }
}
