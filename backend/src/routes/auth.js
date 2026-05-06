import { Router } from 'express'
import bcrypt from 'bcryptjs'
import rateLimit from 'express-rate-limit'
import { db } from '../db.js'
import { signToken } from '../auth.js'
import { sendEmail } from '../email.js'
import { otpEmail } from '../templates/otp.js'
import { welcomeEmail } from '../templates/welcome.js'
import { resetEmail } from '../templates/reset.js'
import { generateOtp, isValidEmail } from '../utils.js'

const router = Router()
const OTP_TTL_MS = 10 * 60 * 1000

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests. Please try again later.' },
})

router.use(authLimiter)

router.post('/signup', async (req, res, next) => {
  try {
    const { name, email, password } = req.body || {}
    if (!name?.trim()) return res.status(400).json({ error: 'Name is required' })
    if (!isValidEmail(email)) return res.status(400).json({ error: 'A valid email is required' })
    if (!password || password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' })
    }

    const existing = db.findUserByEmail(email)
    if (existing && existing.isVerified) {
      return res
        .status(409)
        .json({ error: 'An account with this email already exists' })
    }

    const passwordHash = await bcrypt.hash(password, 10)
    const user = {
      name: name.trim(),
      email: email.trim().toLowerCase(),
      passwordHash,
      role: 'user',
      isVerified: false,
      createdAt: existing?.createdAt || new Date().toISOString(),
    }
    db.upsertUser(user)

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

    res.json({
      ok: true,
      message: 'Verification code sent to your email',
      email: user.email,
    })
  } catch (err) {
    next(err)
  }
})

router.post('/verify-otp', async (req, res, next) => {
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
    res.json({
      ok: true,
      token,
      user: { name: user.name, email: user.email, role: user.role },
    })
  } catch (err) {
    next(err)
  }
})

router.post('/resend-otp', async (req, res, next) => {
  try {
    const { email } = req.body || {}
    if (!isValidEmail(email)) {
      return res.status(400).json({ error: 'A valid email is required' })
    }

    const user = db.findUserByEmail(email)
    if (!user) return res.json({ ok: true, message: 'If an account exists, a code has been sent.' })
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

    res.json({ ok: true, message: 'Verification code sent' })
  } catch (err) {
    next(err)
  }
})

router.post('/login', async (req, res, next) => {
  try {
    const { email, password } = req.body || {}
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' })
    }

    const user = db.findUserByEmail(email)
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
    res.json({
      ok: true,
      token,
      user: { name: user.name, email: user.email, role: user.role },
    })
  } catch (err) {
    next(err)
  }
})

router.post('/forgot-password', async (req, res, next) => {
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

    // Avoid leaking account existence
    res.json({
      ok: true,
      message: 'If an account exists, a reset code has been sent.',
    })
  } catch (err) {
    next(err)
  }
})

router.post('/reset-password', async (req, res, next) => {
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

    res.json({ ok: true, message: 'Password updated. You can now log in.' })
  } catch (err) {
    next(err)
  }
})

export default router
