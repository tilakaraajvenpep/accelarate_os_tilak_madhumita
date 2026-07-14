import { eq } from 'drizzle-orm'
import { db } from '../db/client'
import { plans } from '../models'
import { createProductAndPrice } from './stripe.service'

export async function listPlans() {
  return db.select().from(plans).orderBy(plans.createdAt)
}

export async function getPlanById(id: number) {
  const [plan] = await db.select().from(plans).where(eq(plans.id, id)).limit(1)
  return plan ?? null
}

interface PlanInput {
  name: string
  description?: string | null
  cohortsLimit?: number | null
  foundersLimit?: number | null
  storageLimitGb?: number | null
  priceMonthlyCents: number
  isCustom?: boolean
  enableOnlineBilling?: boolean
  aiProviderConfigId?: number | null
}

export async function createPlan(data: PlanInput) {
  let stripePriceId: string | null = null
  if (data.enableOnlineBilling && data.priceMonthlyCents > 0) {
    stripePriceId = await createProductAndPrice(data.name, data.priceMonthlyCents)
  }

  const [created] = await db
    .insert(plans)
    .values({
      name: data.name,
      description: data.description ?? null,
      cohortsLimit: data.cohortsLimit ?? null,
      foundersLimit: data.foundersLimit ?? null,
      storageLimitGb: data.storageLimitGb ?? null,
      priceMonthlyCents: data.priceMonthlyCents,
      isCustom: data.isCustom ?? false,
      stripePriceId,
      aiProviderConfigId: data.aiProviderConfigId ?? null,
    })
    .returning()
  return created
}

export async function updatePlan(id: number, data: Partial<PlanInput> & { active?: boolean }) {
  const existing = await getPlanById(id)
  if (!existing) return null

  let stripePriceId = existing.stripePriceId
  const priceChanged = data.priceMonthlyCents !== undefined && data.priceMonthlyCents !== existing.priceMonthlyCents
  if (data.enableOnlineBilling && (!stripePriceId || priceChanged)) {
    stripePriceId = await createProductAndPrice(
      data.name ?? existing.name,
      data.priceMonthlyCents ?? existing.priceMonthlyCents,
    )
  }

  const [updated] = await db
    .update(plans)
    .set({
      name: data.name ?? existing.name,
      description: data.description !== undefined ? data.description : existing.description,
      cohortsLimit: data.cohortsLimit !== undefined ? data.cohortsLimit : existing.cohortsLimit,
      foundersLimit: data.foundersLimit !== undefined ? data.foundersLimit : existing.foundersLimit,
      storageLimitGb: data.storageLimitGb !== undefined ? data.storageLimitGb : existing.storageLimitGb,
      priceMonthlyCents: data.priceMonthlyCents ?? existing.priceMonthlyCents,
      isCustom: data.isCustom ?? existing.isCustom,
      active: data.active ?? existing.active,
      stripePriceId,
      aiProviderConfigId: data.aiProviderConfigId !== undefined ? data.aiProviderConfigId : existing.aiProviderConfigId,
      updatedAt: new Date(),
    })
    .where(eq(plans.id, id))
    .returning()
  return updated
}

export async function deletePlan(id: number) {
  try {
    const [deleted] = await db.delete(plans).where(eq(plans.id, id)).returning()
    if (!deleted) throw new Error('Plan not found')
    return deleted
  } catch (err: unknown) {
    if (err && typeof err === 'object' && 'code' in err && (err as { code: string }).code === '23503') {
      throw new Error('This plan has tenants subscribed to it — cancel or reassign those subscriptions before deleting it.')
    }
    throw err
  }
}
