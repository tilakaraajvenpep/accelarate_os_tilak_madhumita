import { eq, sql, count, sum, desc } from 'drizzle-orm'
import { db } from '../db/client'
import { payments, creditPurchases, subscriptions, plans, tenants, coupons, couponRedemptions } from '../models'

interface MonthlySeriesRow {
  month: string
  method: string
  totalCents: number
}

export async function getRevenueTrend(months: number): Promise<MonthlySeriesRow[]> {
  const rows = await db
    .select({
      month: sql<string>`to_char(date_trunc('month', ${payments.paidAt}), 'YYYY-MM')`,
      method: payments.method,
      totalCents: sum(payments.amountCents).mapWith(Number),
    })
    .from(payments)
    .where(
      sql`${payments.status} = 'succeeded' and ${payments.paidAt} >= date_trunc('month', now()) - (${months} || ' months')::interval`,
    )
    .groupBy(sql`date_trunc('month', ${payments.paidAt})`, payments.method)
    .orderBy(sql`date_trunc('month', ${payments.paidAt})`)
  return rows.map((r) => ({ month: r.month, method: r.method, totalCents: r.totalCents ?? 0 }))
}

export async function getCreditRevenueTrend(months: number): Promise<MonthlySeriesRow[]> {
  const rows = await db
    .select({
      month: sql<string>`to_char(date_trunc('month', ${creditPurchases.paidAt}), 'YYYY-MM')`,
      method: creditPurchases.method,
      totalCents: sum(creditPurchases.netAmountCents).mapWith(Number),
    })
    .from(creditPurchases)
    .where(
      sql`${creditPurchases.status} = 'succeeded' and ${creditPurchases.paidAt} >= date_trunc('month', now()) - (${months} || ' months')::interval`,
    )
    .groupBy(sql`date_trunc('month', ${creditPurchases.paidAt})`, creditPurchases.method)
    .orderBy(sql`date_trunc('month', ${creditPurchases.paidAt})`)
  return rows.map((r) => ({ month: r.month, method: r.method, totalCents: r.totalCents ?? 0 }))
}

export async function getSubscriptionBreakdown() {
  const byStatus = await db
    .select({ status: subscriptions.status, count: count() })
    .from(subscriptions)
    .groupBy(subscriptions.status)

  const byBillingType = await db
    .select({ billingType: subscriptions.billingType, count: count() })
    .from(subscriptions)
    .groupBy(subscriptions.billingType)

  const byPlan = await db
    .select({ planName: plans.name, count: count() })
    .from(subscriptions)
    .innerJoin(plans, eq(subscriptions.planId, plans.id))
    .groupBy(plans.name)
    .orderBy(desc(count()))

  return { byStatus, byBillingType, byPlan }
}

export async function getTenantGrowth(months: number) {
  const rows = await db
    .select({
      month: sql<string>`to_char(date_trunc('month', ${tenants.createdAt}), 'YYYY-MM')`,
      newTenants: count(),
    })
    .from(tenants)
    .where(sql`${tenants.createdAt} >= date_trunc('month', now()) - (${months} || ' months')::interval`)
    .groupBy(sql`date_trunc('month', ${tenants.createdAt})`)
    .orderBy(sql`date_trunc('month', ${tenants.createdAt})`)

  const [{ before }] = await db
    .select({ before: count() })
    .from(tenants)
    .where(sql`${tenants.createdAt} < date_trunc('month', now()) - (${months} || ' months')::interval`)

  let cumulative = before
  return rows.map((r) => {
    cumulative += r.newTenants
    return { month: r.month, newTenants: r.newTenants, cumulativeTotal: cumulative }
  })
}

export async function getCouponPerformance() {
  const rows = await db
    .select({
      id: coupons.id,
      code: coupons.code,
      discountType: coupons.discountType,
      discountValue: coupons.discountValue,
      appliesTo: coupons.appliesTo,
      active: coupons.active,
      redemptions: count(couponRedemptions.id),
      totalDiscountCents: sql<number>`coalesce(sum(${couponRedemptions.discountAmountCents}), 0)`.mapWith(Number),
    })
    .from(coupons)
    .leftJoin(couponRedemptions, eq(couponRedemptions.couponId, coupons.id))
    .groupBy(coupons.id)
    .orderBy(desc(coupons.createdAt))

  const totalDiscountGivenCents = rows.reduce((sum, r) => sum + r.totalDiscountCents, 0)

  return { coupons: rows, totalDiscountGivenCents }
}

export interface TransactionRow {
  type: 'subscription' | 'recharge'
  tenantName: string
  amountCents: number
  method: string
  status: string
  date: string
}

export async function getTransactions(params: { limit: number; offset: number }) {
  const subscriptionRows = await db
    .select({
      tenantName: tenants.name,
      amountCents: payments.amountCents,
      method: payments.method,
      status: payments.status,
      date: payments.paidAt,
    })
    .from(payments)
    .innerJoin(subscriptions, eq(payments.subscriptionId, subscriptions.id))
    .innerJoin(tenants, eq(subscriptions.tenantId, tenants.id))
    .orderBy(desc(payments.paidAt))
    .limit(params.limit + params.offset)

  const rechargeRows = await db
    .select({
      tenantName: tenants.name,
      amountCents: creditPurchases.netAmountCents,
      method: creditPurchases.method,
      status: creditPurchases.status,
      date: creditPurchases.paidAt,
    })
    .from(creditPurchases)
    .innerJoin(tenants, eq(creditPurchases.tenantId, tenants.id))
    .orderBy(desc(creditPurchases.paidAt))
    .limit(params.limit + params.offset)

  const combined: TransactionRow[] = [
    ...subscriptionRows.map((r) => ({ ...r, type: 'subscription' as const, date: r.date.toISOString() })),
    ...rechargeRows.map((r) => ({ ...r, type: 'recharge' as const, date: r.date.toISOString() })),
  ].sort((a, b) => (a.date < b.date ? 1 : -1))

  return combined.slice(params.offset, params.offset + params.limit)
}
