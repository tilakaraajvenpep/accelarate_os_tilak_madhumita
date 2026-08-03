import { eq, and, isNull } from 'drizzle-orm'
import { db } from '../db/client'
import { companyUnlocks } from '../models'

export async function listCompanyUnlocks(tenantId: number, companyId: number) {
  return db
    .select()
    .from(companyUnlocks)
    .where(and(eq(companyUnlocks.tenantId, tenantId), eq(companyUnlocks.companyId, companyId)))
}

export async function setCompanyUnlock(
  tenantId: number,
  companyId: number,
  pillarId: number | null,
  sectionId: number | null,
  unlocked: boolean
) {
  if (pillarId === null && sectionId === null) {
    throw new Error('Must provide either pillarId or sectionId')
  }

  const conditions = [
    eq(companyUnlocks.tenantId, tenantId),
    eq(companyUnlocks.companyId, companyId),
  ]
  if (pillarId !== null) {
    conditions.push(eq(companyUnlocks.pillarId, pillarId))
  } else {
    conditions.push(isNull(companyUnlocks.pillarId))
  }
  if (sectionId !== null) {
    conditions.push(eq(companyUnlocks.sectionId, sectionId))
  } else {
    conditions.push(isNull(companyUnlocks.sectionId))
  }

  const [existing] = await db
    .select()
    .from(companyUnlocks)
    .where(and(...conditions))
    .limit(1)

  if (unlocked) {
    if (!existing) {
      await db.insert(companyUnlocks).values({
        tenantId,
        companyId,
        pillarId,
        sectionId,
      })
    }
  } else {
    if (existing) {
      await db.delete(companyUnlocks).where(eq(companyUnlocks.id, existing.id))
    }
  }
}
