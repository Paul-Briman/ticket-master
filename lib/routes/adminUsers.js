// Admin-only user management endpoints. Lists every signed-up user
// with safe metadata (never the password hash or active OTP) and
// allows admins to delete user accounts subject to two safety rules:
//   1. The seeded primary admin (process.env.ADMIN_EMAIL) is
//      undeletable — keeps an unassailable break-glass account.
//   2. Admins can't delete themselves — prevents accidental lockout
//      mid-operation.

import { Router } from 'express'
import { requireAdmin, requireAuth } from '../auth.js'
import { db } from '../db.js'
import { normalizeEmail } from '../utils.js'
import { handleError } from '../seed.js'

function primaryAdminEmail() {
  return normalizeEmail(process.env.ADMIN_EMAIL || 'admin@ticket.com')
}

const router = Router()

router.use((req, res, next) => {
  try {
    const user = requireAuth(req)
    requireAdmin(user)
    req.adminUser = user
    next()
  } catch (err) {
    return res.status(err.status || 401).json({ error: err.message })
  }
})

// GET /api/admin/users — every registered user, without secrets.
router.get('/', async (req, res) => {
  try {
    const users = await db.listAllUsers()
    const adminEmail = primaryAdminEmail()
    const me = normalizeEmail(req.adminUser?.email || '')
    // Annotate each row so the UI can disable destructive actions on
    // protected accounts without round-tripping back to the server.
    const decorated = users.map((u) => ({
      ...u,
      isPrimaryAdmin: u.email === adminEmail,
      isSelf: u.email === me,
      deletable: u.email !== adminEmail && u.email !== me,
    }))
    return res.status(200).json({ users: decorated, count: decorated.length })
  } catch (err) {
    return handleError(res, err, 'admin-users-list')
  }
})

// DELETE /api/admin/users/:email — hard-delete a user account.
router.delete('/:email', async (req, res) => {
  try {
    const target = normalizeEmail(req.params.email)
    if (!target) return res.status(400).json({ error: 'email is required' })

    if (target === primaryAdminEmail()) {
      return res.status(400).json({
        error: 'The primary admin account cannot be deleted.',
      })
    }
    if (target === normalizeEmail(req.adminUser?.email || '')) {
      return res.status(400).json({
        error: "You can't delete your own admin account.",
      })
    }

    const removed = await db.deleteUser(target)
    if (!removed) return res.status(404).json({ error: 'User not found' })
    console.log('[admin/users] deleted', { target, by: req.adminUser?.email })
    return res.status(200).json({ ok: true })
  } catch (err) {
    return handleError(res, err, 'admin-users-delete')
  }
})

export default router
