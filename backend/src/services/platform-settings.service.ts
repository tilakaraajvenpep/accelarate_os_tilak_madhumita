import { eq } from 'drizzle-orm'
import { db } from '../db/client'
import { platformSettings } from '../models'
import { resolveOnboardingMapping } from './form-mappings.service'

export async function getPlatformSettings() {
  const [row] = await db.select().from(platformSettings).limit(1)
  if (row) return row
  const [created] = await db.insert(platformSettings).values({}).returning()
  return created
}

export async function setAiCreditRateCents(cents: number) {
  const settings = await getPlatformSettings()
  const [updated] = await db
    .update(platformSettings)
    .set({ aiCreditRateCents: cents, updatedAt: new Date() })
    .where(eq(platformSettings.id, settings.id))
    .returning()
  return updated
}

export async function setAiCreditsPerThousandTokens(value: number) {
  const settings = await getPlatformSettings()
  const [updated] = await db
    .update(platformSettings)
    .set({ aiCreditsPerThousandTokens: value, updatedAt: new Date() })
    .where(eq(platformSettings.id, settings.id))
    .returning()
  return updated
}

export async function getTenantOnboardingSourceTenantId() {
  const settings = await getPlatformSettings()
  return settings.tenantOnboardingSourceTenantId
}

export async function setTenantOnboardingSourceTenantId(tenantId: number | null) {
  const settings = await getPlatformSettings()
  const [updated] = await db
    .update(platformSettings)
    .set({ tenantOnboardingSourceTenantId: tenantId, updatedAt: new Date() })
    .where(eq(platformSettings.id, settings.id))
    .returning()
  return updated.tenantOnboardingSourceTenantId
}

/**
 * Resolves the custom form shown on the public /get-started "organization
 * details" step. Super admin designates one existing tenant as "the source";
 * that tenant's own Forms > Mappings tab (type 'tenant_admin_onboarding',
 * tenant-wide only, same as mentor_onboarding) supplies the actual template.
 * Returns null if no source tenant is set or it has no active mapping —
 * callers should fall back to the hardcoded name/type/website fields.
 */
export async function resolvePublicTenantOnboardingForm() {
  const sourceTenantId = await getTenantOnboardingSourceTenantId()
  if (!sourceTenantId) return null
  const resolved = await resolveOnboardingMapping(sourceTenantId, 'tenant_admin_onboarding', null)
  if (!resolved) return null
  return {
    mappingId: resolved.id,
    templateId: resolved.template.id,
    title: resolved.template.title,
    schema: resolved.template.schema,
    category: resolved.template.category,
    requireConsent: resolved.template.requireConsent,
    consentTermsText: resolved.template.consentTermsText,
  }
}
