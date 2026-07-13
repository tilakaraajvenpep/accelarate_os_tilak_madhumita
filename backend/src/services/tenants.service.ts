import { eq, desc, count } from 'drizzle-orm'
import { db } from '../db/client'
import { tenants, subscriptions, plans, users } from '../models'

export async function listTenantsWithSubscription() {
  const [allTenants, allSubs, allPlans, founderCounts] = await Promise.all([
    db.select().from(tenants).orderBy(desc(tenants.createdAt)),
    db.select().from(subscriptions).orderBy(desc(subscriptions.createdAt)),
    db.select().from(plans),
    db
      .select({ tenantId: users.tenantId, count: count() })
      .from(users)
      .where(eq(users.role, 'founder'))
      .groupBy(users.tenantId),
  ])

  const planById = new Map(allPlans.map((p) => [p.id, p]))
  const latestSubByTenant = new Map<number, (typeof allSubs)[number]>()
  for (const sub of allSubs) {
    if (!latestSubByTenant.has(sub.tenantId)) latestSubByTenant.set(sub.tenantId, sub)
  }
  const founderCountByTenant = new Map(
    founderCounts.filter((f) => f.tenantId !== null).map((f) => [f.tenantId as number, Number(f.count)]),
  )

  return allTenants.map((tenant) => {
    const sub = latestSubByTenant.get(tenant.id)
    const plan = sub ? planById.get(sub.planId) : undefined
    return {
      id: tenant.id,
      name: tenant.name,
      orgType: tenant.orgType,
      website: tenant.website,
      suspended: tenant.suspended,
      createdAt: tenant.createdAt,
      plan: plan
        ? { id: plan.id, name: plan.name, foundersLimit: plan.foundersLimit, priceMonthlyCents: plan.priceMonthlyCents }
        : null,
      subscription: sub
        ? {
            id: sub.id,
            status: sub.status,
            billingType: sub.billingType,
            currentPeriodEnd: sub.currentPeriodEnd,
          }
        : null,
      foundersUsed: founderCountByTenant.get(tenant.id) ?? 0,
    }
  })
}

export async function getTenantAdminEmail(tenantId: number): Promise<string | null> {
  const [admin] = await db
    .select({ email: users.email })
    .from(users)
    .where(eq(users.tenantId, tenantId))
    .limit(1)
  return admin?.email ?? null
}

export async function createTenant(data: {
  name: string
  orgType?: string | null
  website?: string | null
}) {
  const [created] = await db
    .insert(tenants)
    .values({
      name: data.name,
      orgType: (data.orgType as (typeof tenants.$inferInsert)['orgType']) ?? null,
      website: data.website ?? null,
    })
    .returning()
  return created
}
