import { db } from '../lib/db.js'
import { signToken } from '../lib/auth.js'
import { normalizeEmail } from '../lib/utils.js'
import { handleError, methodNotAllowed } from '../lib/seed.js'

export default async function handler(req, res) {
  if (req.method !== 'POST') return methodNotAllowed(res, ['POST'])

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
}
