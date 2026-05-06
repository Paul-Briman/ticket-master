import bcrypt from 'bcryptjs'
import { db } from '../lib/db.js'
import { sendEmail } from '../lib/email.js'
import { otpEmail } from '../lib/templates/otp.js'
import { generateOtp, isValidEmail, normalizeEmail } from '../lib/utils.js'
import { handleError, methodNotAllowed } from '../lib/seed.js'

const OTP_TTL_MS = 10 * 60 * 1000

export default async function handler(req, res) {
  if (req.method !== 'POST') return methodNotAllowed(res, ['POST'])

  try {
    const { name, email, password } = req.body || {}
    console.log('[signup] EMAIL RAW:', email, '| storage:', db.isKv ? 'KV' : 'file')

    if (!name?.trim()) return res.status(400).json({ error: 'Name is required' })
    if (!isValidEmail(email)) return res.status(400).json({ error: 'A valid email is required' })
    if (!password || password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' })
    }

    const normalizedEmail = normalizeEmail(email)
    console.log('[signup] LOOKING FOR USER:', normalizedEmail)

    const existing = await db.findUserByEmail(normalizedEmail)
    console.log('[signup] EXISTING USER FOUND:', !!existing, existing?.isVerified ? '(verified)' : '')

    if (existing && existing.isVerified) {
      return res.status(409).json({ error: 'An account with this email already exists' })
    }

    const passwordHash = await bcrypt.hash(password, 10)
    const otp = generateOtp()

    const user = {
      name: name.trim(),
      email: normalizedEmail,
      passwordHash,
      role: 'user',
      isVerified: false,
      otpCode: otp,
      otpExpires: Date.now() + OTP_TTL_MS,
      createdAt: existing?.createdAt || new Date().toISOString(),
    }
    await db.upsertUser(user)
    console.log('[signup] USER STORED:', user.email, '| OTP:', otp)

    await sendEmail({
      to: user.email,
      subject: 'Verify your Ticketmaster Account',
      html: otpEmail({ name: user.name, otp, expiresInMinutes: 10 }),
      text: `Your Ticketmaster verification code is ${otp}. It expires in 10 minutes.`,
    })

    return res.status(200).json({
      ok: true,
      message: 'Verification code sent to your email',
      email: user.email,
    })
  } catch (err) {
    return handleError(res, err, 'signup')
  }
}
