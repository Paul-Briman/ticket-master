import { Router } from 'express'
import bcrypt from 'bcryptjs'
import { db } from '../db.js'
import { signToken } from '../auth.js'
import { sendEmail } from '../email.js'
import { otpEmail } from '../templates/otp.js'
import { welcomeEmail } from '../templates/welcome.js'
import { resetEmail } from '../templates/reset.js'
import {
  generateOtp,
  isValidEmail,
  normalizeEmail,
} from '../utils.js'
import { ensureAdminSeeded, handleError } from '../seed.js'

const OTP_TTL_MS = 10 * 60 * 1000

const router = Router()

router.post('/signup', async (req, res) => {
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
})

router.post('/verify-otp', async (req, res) => {
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
})

router.post('/resend-otp', async (req, res) => {
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
})

router.post('/login', async (req, res) => {
  try {
    await ensureAdminSeeded()

    const { email, password } = req.body || {}
    console.log('[login] EMAIL RAW:', email)

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' })
    }

    const normalizedEmail = normalizeEmail(email)
    const user = await db.findUserByEmail(normalizedEmail)
    console.log(
      '[login] USER FOUND:',
      !!user,
      user ? `(verified=${user.isVerified}, role=${user.role})` : '',
    )

    if (user && !user.passwordHash && user.provider === 'google') {
      return res.status(403).json({
        error: 'This account uses Google sign-in. Click "Continue with Google" instead.',
      })
    }

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
})

router.post('/google-login', async (req, res) => {
  try {
    const { accessToken } = req.body || {}
    if (!accessToken) {
      return res.status(400).json({ error: 'Google access token is required' })
    }

    const r = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
      headers: { Authorization: `Bearer ${accessToken}` },
    })
    if (!r.ok) {
      const text = await r.text().catch(() => '')
      console.warn('[google-login] userinfo failed', r.status, text.slice(0, 200))
      return res.status(401).json({ error: 'Invalid Google token' })
    }
    const profile = await r.json()
    if (!profile.email) {
      return res.status(400).json({ error: 'Google account did not return an email' })
    }

    const email = normalizeEmail(profile.email)
    console.log('[google-login] EMAIL:', email)

    const existing = await db.findUserByEmail(email)

    let user
    if (existing) {
      user = {
        ...existing,
        email,
        isVerified: true,
        verifiedAt: existing.verifiedAt || new Date().toISOString(),
        provider: existing.provider || 'google',
        picture: existing.picture || profile.picture || null,
      }
      delete user.otpCode
      delete user.otpExpires
    } else {
      user = {
        name: profile.name || email.split('@')[0],
        email,
        passwordHash: null,
        role: 'user',
        isVerified: true,
        provider: 'google',
        picture: profile.picture || null,
        createdAt: new Date().toISOString(),
        verifiedAt: new Date().toISOString(),
      }
    }
    await db.upsertUser(user)
    console.log(
      '[google-login] user authenticated:',
      user.email,
      '(new:', !existing, ')',
    )

    const token = signToken({
      email: user.email,
      name: user.name,
      role: user.role,
    })
    return res.status(200).json({
      ok: true,
      token,
      user: {
        name: user.name,
        email: user.email,
        role: user.role,
        picture: user.picture,
      },
    })
  } catch (err) {
    return handleError(res, err, 'google-login')
  }
})

router.post('/forgot-password', async (req, res) => {
  try {
    const { email } = req.body || {}
    console.log('[forgot-password] EMAIL RAW:', email)

    if (!isValidEmail(email)) {
      return res.status(400).json({ error: 'A valid email is required' })
    }

    const normalizedEmail = normalizeEmail(email)
    const user = await db.findUserByEmail(normalizedEmail)
    console.log('[forgot-password] USER FOUND:', !!user)
    if (user) {
      const otp = generateOtp()
      user.resetCode = otp
      user.resetExpires = Date.now() + OTP_TTL_MS
      await db.upsertUser(user)

      console.log(`[forgot-password] reset code for ${user.email}: ${otp}`)

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
})

router.post('/reset-password', async (req, res) => {
  try {
    const { email, otp, newPassword } = req.body || {}
    if (!email || !otp || !newPassword) {
      return res.status(400).json({ error: 'Email, code, and new password are required' })
    }
    if (newPassword.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' })
    }

    const inputOtp = String(otp).trim()
    const normalizedEmail = normalizeEmail(email)
    console.log('[reset-password] LOOKING FOR USER:', normalizedEmail)

    const user = await db.findUserByEmail(normalizedEmail)
    console.log('[reset-password] USER FOUND:', !!user)
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
})

export default router
