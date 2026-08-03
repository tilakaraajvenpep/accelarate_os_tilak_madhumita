import { Router, Response } from 'express'
import { z } from 'zod'
import { requireAuth, loadUser, type AuthRequest } from '../middleware/auth.middleware'
import { getUserBySub, updateOwnName } from '../services/users.service'
import { and, eq } from 'drizzle-orm'
import { db } from '../db/client'
import { users, companyMembers } from '../models'

const router = Router()

router.get('/me', requireAuth, loadUser, async (req: AuthRequest, res: Response) => {
  const user = req.dbUser!
  res.json({
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    tenantId: user.tenantId,
    interestedInMentoring: user.interestedInMentoring,
    allowedMenus: user.allowedMenus,
    canSetPermissions: user.canSetPermissions,
  })
})

const updateMeSchema = z.object({ name: z.string().trim().min(1) })

router.patch('/me', requireAuth, async (req: AuthRequest, res: Response) => {
  const parsed = updateMeSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() })
    return
  }
  const updated = await updateOwnName(req.user!.sub, parsed.data.name)
  if (!updated) {
    res.status(404).json({ error: 'User not found' })
    return
  }
  res.json({
    id: updated.id,
    email: updated.email,
    name: updated.name,
    role: updated.role,
    tenantId: updated.tenantId,
  })
})

router.patch('/:userId/permissions', requireAuth, loadUser, async (req: AuthRequest, res: Response) => {
  const targetUserId = Number(req.params.userId)
  const currentDbUser = req.dbUser!

  const schema = z.object({
    allowedMenus: z.array(z.string()).nullable(),
    canSetPermissions: z.boolean(),
  })
  const parsed = schema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() })
    return
  }

  // Fetch target user within the same tenant
  const [targetUser] = await db
    .select()
    .from(users)
    .where(and(eq(users.id, targetUserId), eq(users.tenantId, currentDbUser.tenantId!)))
    .limit(1)

  if (!targetUser) {
    res.status(404).json({ error: 'User not found' })
    return
  }

  // Authorization check
  let authorized = false

  if (currentDbUser.role === 'admin') {
    authorized = true
  } else if (currentDbUser.role === 'mentor' && currentDbUser.canSetPermissions && targetUser.role === 'mentor') {
    authorized = true
  } else if (currentDbUser.role === 'founder' && currentDbUser.canSetPermissions && targetUser.role === 'founder') {
    // Check if both users belong to the same company
    const [currentUserCompany] = await db
      .select({ companyId: companyMembers.companyId })
      .from(companyMembers)
      .where(and(eq(companyMembers.userId, currentDbUser.id), eq(companyMembers.tenantId, currentDbUser.tenantId!)))
      .limit(1)

    const [targetUserCompany] = await db
      .select({ companyId: companyMembers.companyId })
      .from(companyMembers)
      .where(and(eq(companyMembers.userId, targetUser.id), eq(companyMembers.tenantId, currentDbUser.tenantId!)))
      .limit(1)

    if (currentUserCompany && targetUserCompany && currentUserCompany.companyId === targetUserCompany.companyId) {
      authorized = true
    }
  }

  if (!authorized) {
    res.status(403).json({ error: "You do not have permission to update this user's menu settings." })
    return
  }

  // Update target user
  const [updated] = await db
    .update(users)
    .set({
      allowedMenus: parsed.data.allowedMenus,
      canSetPermissions: parsed.data.canSetPermissions,
      updatedAt: new Date(),
    })
    .where(eq(users.id, targetUserId))
    .returning()

  res.json({
    id: updated.id,
    allowedMenus: updated.allowedMenus,
    canSetPermissions: updated.canSetPermissions,
  })
})

export default router
