import { db } from '../lib/db.js'
import { requireAuth, requireAdmin } from '../lib/auth.js'
import { handleError, methodNotAllowed } from '../lib/seed.js'

export default async function handler(req, res) {
  if (req.method !== 'GET') return methodNotAllowed(res, ['GET'])

  try {
    const auth = requireAuth(req)
    requireAdmin(auth)
    const orders = await db.listOrders()
    return res.status(200).json({ orders })
  } catch (err) {
    return handleError(res, err, 'admin-orders')
  }
}
