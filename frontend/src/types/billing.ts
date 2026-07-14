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
  aiProviderConfigId: number | null
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
