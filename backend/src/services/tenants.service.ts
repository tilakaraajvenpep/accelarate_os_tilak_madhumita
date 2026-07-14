import { eq, and, inArray, desc, count } from 'drizzle-orm'
import { db } from '../db/client'
import { tenants, subscriptions, plans, users, tenantInvites, payments } from '../models'
import { generateUniqueSlug } from '../utils/slug'
import {
  cognitoAdminCreateUser,
  cognitoAdminSetPassword,
  cognitoAdminGetSub,
  cognitoAdminDeleteUser,
} from './auth.service'

const OTP_TTL_MS = 24 * 60 * 60 * 1000

function generateOtpCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString()
}

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
      slug: tenant.slug,
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

/**
 * Creates a tenant + its admin, with the password chosen by the super admin
 * up front (not by the invited admin). The Cognito account is fully active
 * immediately via the Admin APIs — no Cognito-side confirmation step exists
 * for this path. A separate app-level OTP (`tenantInvites`, repurposed here
 * to hold a 6-digit code rather than a link token) gates `users.emailVerified`
 * until the admin proves they own the inbox.
 */
export async function createTenantWithAdmin(data: {
  name: string
  orgType?: string | null
  website?: string | null
  slug?: string
  adminEmail: string
  adminName: string
  adminPassword: string
}) {
  const slug = await generateUniqueSlug(data.slug || data.name)

  try {
    await cognitoAdminCreateUser(data.adminEmail, data.adminName)
  } catch (err: unknown) {
    if (!(err instanceof Error && err.name === 'UsernameExistsException')) throw err
  }
  await cognitoAdminSetPassword(data.adminEmail, data.adminPassword)
  const cognitoSub = await cognitoAdminGetSub(data.adminEmail)

  return db.transaction(async (tx) => {
    const [tenant] = await tx
      .insert(tenants)
      .values({
        name: data.name,
        slug,
        orgType: (data.orgType as (typeof tenants.$inferInsert)['orgType']) ?? null,
        website: data.website ?? null,
      })
      .returning()

    await tx.insert(users).values({
      cognitoSub,
      email: data.adminEmail,
      name: data.adminName,
      role: 'admin',
      tenantId: tenant.id,
      emailVerified: false,
    })

    const [invite] = await tx
      .insert(tenantInvites)
      .values({
        tenantId: tenant.id,
        email: data.adminEmail,
        name: data.adminName,
        token: generateOtpCode(),
        expiresAt: new Date(Date.now() + OTP_TTL_MS),
      })
      .returning()

    return { tenant, invite }
  })
}

/**
 * Permanently removes a tenant and everything tied to it — its subscriptions,
 * payment history, invites, DB user rows, and their Cognito accounts. Cognito
 * deletion is best-effort (logged, not fatal) so a missing/already-removed
 * account doesn't block the rest of the cleanup.
 */
export async function deleteTenant(tenantId: number) {
  const tenantUsers = await db
    .select({ email: users.email, cognitoSub: users.cognitoSub })
    .from(users)
    .where(eq(users.tenantId, tenantId))

  await db.transaction(async (tx) => {
    const subIds = (
      await tx.select({ id: subscriptions.id }).from(subscriptions).where(eq(subscriptions.tenantId, tenantId))
    ).map((s) => s.id)
    if (subIds.length > 0) {
      await tx.delete(payments).where(inArray(payments.subscriptionId, subIds))
    }
    await tx.delete(subscriptions).where(eq(subscriptions.tenantId, tenantId))
    await tx.delete(tenantInvites).where(eq(tenantInvites.tenantId, tenantId))
    await tx.delete(users).where(eq(users.tenantId, tenantId))
    const [deleted] = await tx.delete(tenants).where(eq(tenants.id, tenantId)).returning()
    if (!deleted) throw new Error('Tenant not found')
  })

  for (const u of tenantUsers) {
    if (!u.cognitoSub) continue
    try {
      await cognitoAdminDeleteUser(u.email)
    } catch (err) {
      console.error(`[tenants] failed to delete Cognito user ${u.email}:`, err)
    }
  }
}

export async function getTenantBySlug(slug: string) {
  const [tenant] = await db
    .select({ id: tenants.id, name: tenants.name, slug: tenants.slug })
    .from(tenants)
    .where(eq(tenants.slug, slug))
    .limit(1)
  return tenant ?? null
}

export async function verifyTenantAdminEmail(email: string, code: string) {
  const [row] = await db
    .select({ invite: tenantInvites, tenantName: tenants.name })
    .from(tenantInvites)
    .innerJoin(tenants, eq(tenantInvites.tenantId, tenants.id))
    .where(and(eq(tenantInvites.email, email), eq(tenantInvites.token, code)))
    .orderBy(desc(tenantInvites.id))
    .limit(1)

  if (!row) throw new Error('Invalid verification code')
  if (row.invite.status !== 'pending' || row.invite.expiresAt < new Date()) {
    throw new Error('This verification code has expired or was already used')
  }

  await db.transaction(async (tx) => {
    await tx
      .update(tenantInvites)
      .set({ status: 'accepted', updatedAt: new Date() })
      .where(eq(tenantInvites.id, row.invite.id))
    await tx
      .update(users)
      .set({ emailVerified: true, updatedAt: new Date() })
      .where(and(eq(users.email, email), eq(users.tenantId, row.invite.tenantId)))
  })

  return { tenantName: row.tenantName }
}
