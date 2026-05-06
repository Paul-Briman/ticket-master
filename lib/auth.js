import jwt from 'jsonwebtoken'

const SECRET = process.env.JWT_SECRET || 'dev-secret-change-me-please-this-is-not-safe'
const TOKEN_TTL = '7d'

export function signToken(payload) {
  return jwt.sign(payload, SECRET, { expiresIn: TOKEN_TTL })
}

export function verifyToken(token) {
  return jwt.verify(token, SECRET)
}

export class HttpError extends Error {
  constructor(status, message) {
    super(message)
    this.status = status
  }
}

export function requireAuth(req) {
  const header = req.headers?.authorization || ''
  if (!header.startsWith('Bearer ')) {
    throw new HttpError(401, 'Authentication required')
  }
  const token = header.slice(7).trim()
  try {
    return verifyToken(token)
  } catch {
    throw new HttpError(401, 'Invalid or expired token')
  }
}

export function requireAdmin(user) {
  if (!user || user.role !== 'admin') {
    throw new HttpError(403, 'Admin access required')
  }
}
