export type OrgType = 'university' | 'corporate' | 'vc_backed' | 'government' | 'independent' | 'other'

export type BillingType = 'online' | 'offline'

export type SubscriptionStatus = 'trialing' | 'active' | 'past_due' | 'canceled' | 'expired'

export interface Plan {
  id: number
  name: string
  description: string | null
  cohortsLimit: number | null
  foundersLimit: number | null
  storageLimitGb: number | null
  priceMonthlyCents: number
  isCustom: boolean
  active: boolean
  stripePriceId: string | null
  aiCredits: number
  createdAt: string
  updatedAt: string
}

export interface TenantPlanSummary {
  id: number
  name: string
  foundersLimit: number | null
  priceMonthlyCents: number
}

export interface TenantSubscriptionSummary {
  id: number
  status: SubscriptionStatus
  billingType: BillingType
  currentPeriodEnd: string | null
}

export interface Tenant {
  id: number
  name: string
  slug: string
  orgType: OrgType | null
  website: string | null
  suspended: boolean
  emailServiceEnabled: boolean
  createdAt: string
  plan: TenantPlanSummary | null
  subscription: TenantSubscriptionSummary | null
  foundersUsed: number
}

export interface PlatformStats {
  tenants: number
  mrrCents: number
  activeSubscriptions: number
  totalCompanies: number | null
  avgPlatformScore: number | null
}

export interface CheckoutSessionResult {
  checkoutUrl: string | null
  subscriptionId: number
}

/** A plan as shown to a tenant admin choosing what to subscribe to (signup payment step, billing settings). */
export interface SelfServePlan {
  id: number
  name: string
  description: string | null
  priceMonthlyCents: number
  aiCredits: number
  cohortsLimit: number | null
  foundersLimit: number | null
  storageLimitGb: number | null
  onlineBillingEnabled: boolean
}

export interface TenantDashboardPlan {
  id: number
  name: string
  aiCredits: number
}

export interface TenantDashboardInfo {
  aiCreditsBalance: number
  plan: TenantDashboardPlan | null
  subscriptionStatus: SubscriptionStatus | null
}

export type CouponDiscountType = 'percentage' | 'fixed_amount'
export type CouponAppliesTo = 'purchase' | 'recharge'
export type CouponDurationType = 'once' | 'repeating' | 'forever'

export interface Coupon {
  id: number
  code: string
  discountType: CouponDiscountType
  discountValue: number
  maxDiscountCents: number | null
  appliesTo: CouponAppliesTo
  minPurchaseAmountCents: number | null
  perCustomerLimit: number | null
  totalUsageLimit: number | null
  startAt: string | null
  endAt: string | null
  active: boolean
  durationType: CouponDurationType
  durationInMonths: number | null
  stripeCouponId: string | null
  createdAt: string
  updatedAt: string
}

export interface CouponValidationResult {
  valid: boolean
  discountCents: number
  discountType: CouponDiscountType
  durationType: CouponDurationType
  durationInMonths: number | null
}

export interface CreditPurchase {
  id: number
  tenantId: number
  credits: number
  rateCentsSnapshot: number
  grossAmountCents: number
  discountAmountCents: number
  netAmountCents: number
  couponId: number | null
  method: 'stripe' | 'offline'
  status: 'succeeded' | 'pending' | 'failed'
  note: string | null
  paidAt: string
  createdAt: string
}

export interface RechargeCheckoutResult {
  checkoutUrl: string | null
  creditPurchaseId: number
}

export interface SubscriptionConfirmation {
  id: number
  status: SubscriptionStatus
  billingType: BillingType
  currentPeriodEnd: string | null
  discountAmountCents: number | null
  createdAt: string
  planName: string
  priceMonthlyCents: number
  couponCode: string | null
}

export interface CreditPurchaseConfirmation {
  id: number
  credits: number
  grossAmountCents: number
  discountAmountCents: number
  netAmountCents: number
  method: 'stripe' | 'offline'
  status: 'succeeded' | 'pending' | 'failed'
  paidAt: string
  couponCode: string | null
}
