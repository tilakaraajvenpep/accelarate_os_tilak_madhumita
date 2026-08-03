import { Router, Response } from 'express'
import { requireAuth, loadUser, type AuthRequest } from '../middleware/auth.middleware'
import { listNotifications, countUnreadNotifications, markNotificationRead, markAllNotificationsRead } from '../services/notifications.service'

const router = Router()

const gate = [requireAuth, loadUser] as const

function requireTenantId(req: AuthRequest, res: Response): number | null {
  const tenantId = req.dbUser!.tenantId
  if (!tenantId) {
    res.status(400).json({ error: 'No tenant associated with this account' })
    return null
  }
  return tenantId
}

router.get('/tenants/me/notifications', ...gate, async (req: AuthRequest, res: Response) => {
  const tenantId = requireTenantId(req, res)
  if (tenantId === null) return
  res.json(await listNotifications(tenantId, req.dbUser!.id))
})

router.get('/tenants/me/notifications/unread-count', ...gate, async (req: AuthRequest, res: Response) => {
  const tenantId = requireTenantId(req, res)
  if (tenantId === null) return
  res.json({ count: await countUnreadNotifications(tenantId, req.dbUser!.id) })
})

router.patch('/tenants/me/notifications/:id/read', ...gate, async (req: AuthRequest, res: Response) => {
  const tenantId = requireTenantId(req, res)
  if (tenantId === null) return
  const updated = await markNotificationRead(tenantId, req.dbUser!.id, Number(req.params.id))
  if (!updated) {
    res.status(404).json({ error: 'Notification not found' })
    return
  }
  res.json(updated)
})

router.post('/tenants/me/notifications/mark-all-read', ...gate, async (req: AuthRequest, res: Response) => {
  const tenantId = requireTenantId(req, res)
  if (tenantId === null) return
  await markAllNotificationsRead(tenantId, req.dbUser!.id)
  res.json({ message: 'ok' })
})

export default router
