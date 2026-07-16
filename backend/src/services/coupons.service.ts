import { eq, and, count } from 'drizzle-orm'
import { db } from '../db/client'
import { coupons, couponRedemptions } from '../models'
import type { Coupon } from '../models'
import { normalizeCouponCode, computeDiscountCents } from '../utils/coupon'

type Executor = Parameters<Parameters<typeof db.transaction>[0]>[0] | typeof db

export async function listCoupons() {
  return db.select().from(coupons).orderBy(coupons.createdAt)
}

export async function getCouponById(id: number) {
  const [coupon] = await db.select().from(coupons).where(eq(coupons.id, id)).limit(1)
  return coupon ?? null
}

interface CouponInput {
  code: string
  discountType: Coupon['discountType']
  discountValue: number
  maxDiscountCents?: number | null
  appliesTo: Coupon['appliesTo']
  minPurchaseAmountCents?: number | null
  perCustomerLimit?: number | null
  totalUsageLimit?: number | null
  startAt?: Date | null
  endAt?: Date | null
  durationType?: Coupon['durationType']
  durationInMonths?: number | null
}

function assertValidDuration(durationType: Coupon['durationType'], durationInMonths: number | null | undefined) {
  if (durationType === 'repeating' && !durationInMonths) {
    throw new Error('Duration in months is required for a repeating discount')
  }
}

function assertValidDateRange(startAt: Date | null | undefined, endAt: Date | null | undefined) {
  if (startAt && endAt && endAt <= startAt) {
    throw new Error('End date & time must be after the start date & time')
  }
}

function assertValidMaxDiscount(discountType: Coupon['discountType'], maxDiscountCents: number | null | undefined) {
  if (discountType === 'percentage' && !maxDiscountCents) {
    throw new Error('Maximum discount is required for a percentage coupon')
  }
}

export async function createCoupon(data: CouponInput) {
  const durationType = data.durationType ?? 'once'
  assertValidDuration(durationType, data.durationInMonths)
  assertValidDateRange(data.startAt, data.endAt)
  assertValidMaxDiscount(data.discountType, data.maxDiscountCents)

  try {
    const [created] = await db
      .insert(coupons)
      .values({
        code: normalizeCouponCode(data.code),
        discountType: data.discountType,
        discountValue: data.discountValue,
        maxDiscountCents: data.discountType === 'percentage' ? (data.maxDiscountCents ?? null) : null,
        appliesTo: data.appliesTo,
        minPurchaseAmountCents: data.minPurchaseAmountCents ?? null,
        perCustomerLimit: data.perCustomerLimit ?? null,
        totalUsageLimit: data.totalUsageLimit ?? null,
        startAt: data.startAt ?? null,
        endAt: data.endAt ?? null,
        durationType: data.appliesTo === 'purchase' ? durationType : 'once',
        durationInMonths: data.appliesTo === 'purchase' && durationType === 'repeating' ? data.durationInMonths : null,
      })
      .returning()
    return created
  } catch (err: unknown) {
    if (err && typeof err === 'object' && 'code' in err && (err as { code: string }).code === '23505') {
      throw new Error('A coupon with this code already exists')
    }
    throw err
  }
}

export async function updateCoupon(id: number, data: Partial<CouponInput> & { active?: boolean }) {
  const existing = await getCouponById(id)
  if (!existing) return null

  const redemptionCount = await countRedemptions(db, id)
  const isRedeemed = redemptionCount > 0

  if (isRedeemed) {
    const attemptsMutableChange =
      (data.discountType !== undefined && data.discountType !== existing.discountType) ||
      (data.discountValue !== undefined && data.discountValue !== existing.discountValue) ||
      (data.appliesTo !== undefined && data.appliesTo !== existing.appliesTo) ||
      (data.durationType !== undefined && data.durationType !== existing.durationType) ||
      (data.durationInMonths !== undefined && data.durationInMonths !== existing.durationInMonths)
    if (attemptsMutableChange) {
      throw new Error('This coupon has already been redeemed — discount terms can no longer be changed')
    }
  }

  const durationType = data.durationType ?? existing.durationType
  if (!isRedeemed) assertValidDuration(durationType, data.durationInMonths ?? existing.durationInMonths)

  const nextStartAt = data.startAt !== undefined ? data.startAt : existing.startAt
  const nextEndAt = data.endAt !== undefined ? data.endAt : existing.endAt
  assertValidDateRange(nextStartAt, nextEndAt)

  const nextDiscountType = data.discountType !== undefined ? data.discountType : existing.discountType
  const nextMaxDiscountCents = data.maxDiscountCents !== undefined ? data.maxDiscountCents : existing.maxDiscountCents
  if (!isRedeemed) assertValidMaxDiscount(nextDiscountType, nextMaxDiscountCents)

  const nextAppliesTo = data.appliesTo !== undefined ? data.appliesTo : existing.appliesTo
  const nextDurationInMonths = data.durationInMonths !== undefined ? data.durationInMonths : existing.durationInMonths

  const [updated] = await db
    .update(coupons)
    .set({
      code: data.code !== undefined ? normalizeCouponCode(data.code) : existing.code,
      discountType: nextDiscountType,
      discountValue: data.discountValue !== undefined ? data.discountValue : existing.discountValue,
      maxDiscountCents: nextDiscountType === 'percentage' ? nextMaxDiscountCents : null,
      appliesTo: nextAppliesTo,
      minPurchaseAmountCents: data.minPurchaseAmountCents !== undefined ? data.minPurchaseAmountCents : existing.minPurchaseAmountCents,
      perCustomerLimit: data.perCustomerLimit !== undefined ? data.perCustomerLimit : existing.perCustomerLimit,
      totalUsageLimit: data.totalUsageLimit !== undefined ? data.totalUsageLimit : existing.totalUsageLimit,
      startAt: nextStartAt,
      endAt: nextEndAt,
      durationType: nextAppliesTo === 'purchase' ? durationType : 'once',
      durationInMonths: nextAppliesTo === 'purchase' && durationType === 'repeating' ? nextDurationInMonths : null,
      active: data.active ?? existing.active,
      updatedAt: new Date(),
    })
    .where(eq(coupons.id, id))
    .returning()
  return updated
}

export async function deleteCoupon(id: number) {
  const [deleted] = await db.delete(coupons).where(eq(coupons.id, id)).returning()
  if (!deleted) throw new Error('Coupon not found')
  return deleted
}

async function countRedemptions(executor: Executor, couponId: number, tenantId?: number) {
  const conditions = tenantId
    ? and(eq(couponRedemptions.couponId, couponId), eq(couponRedemptions.tenantId, tenantId))
    : eq(couponRedemptions.couponId, couponId)
  const [row] = await executor.select({ n: count() }).from(couponRedemptions).where(conditions)
  return row?.n ?? 0
}

export interface CouponValidationParams {
  appliesTo: Coupon['appliesTo']
  tenantId: number
  grossAmountCents: number
}

export interface CouponValidationResult {
  coupon: Coupon
  discountCents: number
}

async function runValidation(
  executor: Executor,
  code: string,
  params: CouponValidationParams,
): Promise<CouponValidationResult> {
  const normalized = normalizeCouponCode(code)
  const [coupon] = await executor.select().from(coupons).where(eq(coupons.code, normalized)).limit(1)
  if (!coupon) throw new Error('Coupon not found')
  if (!coupon.active) throw new Error('This coupon is no longer active')
  if (coupon.appliesTo !== params.appliesTo) {
    throw new Error(`This coupon can't be used for ${params.appliesTo === 'purchase' ? 'plan purchases' : 'credit recharges'}`)
  }

  const now = new Date()
  if (coupon.startAt && now < coupon.startAt) throw new Error('This coupon is not active yet')
  if (coupon.endAt && now > coupon.endAt) throw new Error('This coupon has expired')

  if (coupon.minPurchaseAmountCents != null && params.grossAmountCents < coupon.minPurchaseAmountCents) {
    throw new Error(`This coupon requires a minimum amount of $${(coupon.minPurchaseAmountCents / 100).toFixed(2)}`)
  }

  if (coupon.totalUsageLimit != null) {
    const total = await countRedemptions(executor, coupon.id)
    if (total >= coupon.totalUsageLimit) throw new Error('This coupon has reached its usage limit')
  }

  if (coupon.perCustomerLimit != null) {
    const perTenant = await countRedemptions(executor, coupon.id, params.tenantId)
    if (perTenant >= coupon.perCustomerLimit) throw new Error('You have already used this coupon the maximum number of times')
  }

  const discountCents = computeDiscountCents(params.grossAmountCents, coupon)
  return { coupon, discountCents }
}

/** Read-only preview — never redeems. Used by the validate endpoint and as a first check before starting a payment flow. */
export async function validateCouponForRedemption(code: string, params: CouponValidationParams) {
  return runValidation(db, code, params)
}

/**
 * Re-validates inside the caller's transaction and records the redemption.
 * Must be called from within a db.transaction — throws (aborting the whole
 * transaction) if a limit was hit concurrently since the initial preview.
 */
export async function redeemCoupon(
  tx: Executor,
  code: string,
  params: CouponValidationParams & { subscriptionId?: number; creditPurchaseId?: number },
): Promise<CouponValidationResult> {
  const result = await runValidation(tx, code, params)
  await tx.insert(couponRedemptions).values({
    couponId: result.coupon.id,
    tenantId: params.tenantId,
    appliesTo: params.appliesTo,
    discountAmountCents: result.discountCents,
    subscriptionId: params.subscriptionId ?? null,
    creditPurchaseId: params.creditPurchaseId ?? null,
  })
  return result
}
