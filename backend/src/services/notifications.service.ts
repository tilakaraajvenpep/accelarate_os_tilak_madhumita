import { eq, and, isNull, desc, count } from 'drizzle-orm'
import { db } from '../db/client'
import { notifications } from '../models'
import type { NotificationType } from '../models'

export async function createNotification(params: {
  tenantId: number
  userId: number
  type: NotificationType
  title: string
  body?: string | null
  link?: string | null
  cohortTaskId?: number | null
}) {
  const [created] = await db
    .insert(notifications)
    .values({
      tenantId: params.tenantId,
      userId: params.userId,
      type: params.type,
      title: params.title,
      body: params.body ?? null,
      link: params.link ?? null,
      cohortTaskId: params.cohortTaskId ?? null,
    })
    .returning()
  return created
}

export async function listNotifications(tenantId: number, userId: number, limit = 30) {
  return db
    .select()
    .from(notifications)
    .where(and(eq(notifications.tenantId, tenantId), eq(notifications.userId, userId)))
    .orderBy(desc(notifications.createdAt))
    .limit(limit)
}

export async function countUnreadNotifications(tenantId: number, userId: number) {
  const [row] = await db
    .select({ value: count() })
    .from(notifications)
    .where(and(eq(notifications.tenantId, tenantId), eq(notifications.userId, userId), isNull(notifications.readAt)))
  return Number(row?.value ?? 0)
}

export async function markNotificationRead(tenantId: number, userId: number, id: number) {
  const [updated] = await db
    .update(notifications)
    .set({ readAt: new Date() })
    .where(and(eq(notifications.id, id), eq(notifications.tenantId, tenantId), eq(notifications.userId, userId)))
    .returning()
  return updated ?? null
}

export async function markAllNotificationsRead(tenantId: number, userId: number) {
  await db
    .update(notifications)
    .set({ readAt: new Date() })
    .where(and(eq(notifications.tenantId, tenantId), eq(notifications.userId, userId), isNull(notifications.readAt)))
}
