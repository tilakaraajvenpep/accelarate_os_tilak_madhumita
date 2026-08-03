export interface MonthlySeriesPoint {
  month: string
  method: string
  totalCents: number
}

export interface SubscriptionBreakdown {
  byStatus: { status: string; count: number }[]
  byBillingType: { billingType: string; count: number }[]
  byPlan: { planName: string; count: number }[]
}

export interface TenantGrowthPoint {
  month: string
  newTenants: number
  cumulativeTotal: number
}

export interface CouponPerformanceRow {
  id: number
  code: string
  discountType: 'percentage' | 'fixed_amount'
  discountValue: number
  appliesTo: 'purchase' | 'recharge'
  active: boolean
  redemptions: number
  totalDiscountCents: number
}

export interface CouponPerformance {
  coupons: CouponPerformanceRow[]
  totalDiscountGivenCents: number
}

export interface TransactionRow {
  type: 'subscription' | 'recharge'
  tenantName: string
  amountCents: number
  method: string
  status: string
  date: string
}
