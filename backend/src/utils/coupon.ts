import type { Coupon } from '../models'

export function normalizeCouponCode(code: string): string {
  return code.trim().toUpperCase()
}

export function computeDiscountCents(grossCents: number, coupon: Coupon): number {
  if (coupon.discountType === 'fixed_amount') {
    return Math.min(coupon.discountValue, grossCents)
  }
  const raw = Math.round((grossCents * coupon.discountValue) / 100)
  const capped = coupon.maxDiscountCents != null ? Math.min(raw, coupon.maxDiscountCents) : raw
  return Math.min(capped, grossCents)
}

/** Purchase-only — recharges are always one-off. null = unlimited/forever. */
export function cyclesFromDuration(durationType: Coupon['durationType'], durationInMonths: number | null): number | null {
  if (durationType === 'once') return 1
  if (durationType === 'forever') return null
  return durationInMonths
}
