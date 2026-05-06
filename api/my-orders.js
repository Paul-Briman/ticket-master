import { db } from '../lib/db.js'
import { requireAuth } from '../lib/auth.js'
import { handleError, methodNotAllowed } from '../lib/seed.js'

export default async function handler(req, res) {
  if (req.method !== 'GET') return methodNotAllowed(res, ['GET'])

  try {
    const auth = requireAuth(req)
    const orders = await db.findOrdersByEmail(auth.email)
    return res.status(200).json({ orders })
  } catch (err) {
    return handleError(res, err, 'my-orders')
  }
}
