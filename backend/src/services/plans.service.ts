import { eq, inArray } from 'drizzle-orm'
import { db } from '../db/client'
import { plans, planAiProviderConfigs } from '../models'
import { createProductAndPrice } from './stripe.service'

async function attachAiProviderConfigIds<T extends { id: number }>(planRows: T[]): Promise<(T & { aiProviderConfigIds: number[] })[]> {
  if (planRows.length === 0) return []
  const rows = await db
    .select({ planId: planAiProviderConfigs.planId, aiProviderConfigId: planAiProviderConfigs.aiProviderConfigId })
    .from(planAiProviderConfigs)
    .where(inArray(planAiProviderConfigs.planId, planRows.map((p) => p.id)))
    .orderBy(planAiProviderConfigs.sortOrder)

  const idsByPlan = new Map<number, number[]>()
  for (const row of rows) {
    if (!idsByPlan.has(row.planId)) idsByPlan.set(row.planId, [])
    idsByPlan.get(row.planId)!.push(row.aiProviderConfigId)
  }
  return planRows.map((plan) => ({ ...plan, aiProviderConfigIds: idsByPlan.get(plan.id) ?? [] }))
}

export async function getPlanAiProviderConfigIds(planId: number): Promise<number[]> {
  const rows = await db
    .select({ aiProviderConfigId: planAiProviderConfigs.aiProviderConfigId })
    .from(planAiProviderConfigs)
    .where(eq(planAiProviderConfigs.planId, planId))
    .orderBy(planAiProviderConfigs.sortOrder)
  return rows.map((r) => r.aiProviderConfigId)
}

/** Full replace — the order given is the priority order (see plan-ai-provider-config.model.ts's sortOrder). */
export async function setPlanAiProviderConfigIds(planId: number, configIds: number[]): Promise<void> {
  await db.delete(planAiProviderConfigs).where(eq(planAiProviderConfigs.planId, planId))
  if (configIds.length === 0) return
  await db.insert(planAiProviderConfigs).values(configIds.map((aiProviderConfigId, index) => ({ planId, aiProviderConfigId, sortOrder: index })))
}

export async function listPlans() {
  const rows = await db.select().from(plans).orderBy(plans.createdAt)
  return attachAiProviderConfigIds(rows)
}

/** Every active plan the super admin has published — shown to a tenant admin picking what to subscribe to. */
export async function listSelfServePlans() {
  return db.select().from(plans).where(eq(plans.active, true)).orderBy(plans.priceMonthlyCents)
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
  aiCredits?: number
  aiProviderConfigIds?: number[]
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
      aiCredits: data.aiCredits ?? 0,
    })
    .returning()

  if (data.aiProviderConfigIds !== undefined) {
    await setPlanAiProviderConfigIds(created.id, data.aiProviderConfigIds)
  }
  return { ...created, aiProviderConfigIds: data.aiProviderConfigIds ?? [] }
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
      aiCredits: data.aiCredits ?? existing.aiCredits,
      updatedAt: new Date(),
    })
    .where(eq(plans.id, id))
    .returning()

  if (data.aiProviderConfigIds !== undefined) {
    await setPlanAiProviderConfigIds(id, data.aiProviderConfigIds)
  }

  const aiProviderConfigIds = data.aiProviderConfigIds ?? (await getPlanAiProviderConfigIds(id))
  return { ...updated, aiProviderConfigIds }
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
