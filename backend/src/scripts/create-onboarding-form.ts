import 'dotenv/config'
import { loadSecrets } from '../config/load-secrets'

async function run() {
  await loadSecrets()

  const { db } = await import('../db/client')
  const { formTemplates, formMappings, platformSettings } = await import('../models')
  const { tenants } = await import('../models/tenant.model')
  const { eq } = await import('drizzle-orm')

  console.log('Seeding custom tenant admin onboarding form...')

  const [settings] = await db.select().from(platformSettings).limit(1)
  if (!settings) {
    console.error('Platform settings not found! Please make sure settings exist first.')
    process.exit(1)
  }

  // Use tenant ID 1 or 22. Let's find an existing tenant ID
  const existingTenants = await db.select().from(tenants)
  if (existingTenants.length === 0) {
    console.error('No tenants exist in the database! Please register at least one tenant first.')
    process.exit(1)
  }
  const tenantId = existingTenants[0].id
  console.log(`Using Tenant ID: ${tenantId} (${existingTenants[0].name})`)

  const schema = [
    {
      id: 'company_name',
      title: 'Business / Brand Name',
      type: 'short_text',
      required: true,
    },
    {
      id: 'uen',
      title: 'UEN (Unique Entity Number)',
      type: 'short_text',
      required: false,
    },
    {
      id: 'industry',
      title: 'Industry',
      type: 'dropdown',
      required: true,
      options: [
        { label: 'Technology', score: 0 },
        { label: 'Healthcare', score: 0 },
        { label: 'Finance', score: 0 },
        { label: 'Retail / E-commerce', score: 0 },
        { label: 'Manufacturing', score: 0 },
        { label: 'Education', score: 0 },
        { label: 'Food & Beverage', score: 0 },
        { label: 'Real Estate', score: 0 },
        { label: 'Professional Services', score: 0 },
        { label: 'Other', score: 0 },
      ],
    },
    {
      id: 'company_size',
      title: 'Company Size',
      type: 'single_choice',
      required: true,
      options: [
        { label: 'Solo', score: 0 },
        { label: '2-10', score: 0 },
        { label: '11-50', score: 0 },
        { label: '50+', score: 0 },
      ],
    },
    {
      id: 'full_name',
      title: 'Full Name',
      type: 'short_text',
      required: true,
    },
    {
      id: 'role_in_business',
      title: 'Role in Business',
      type: 'dropdown',
      required: true,
      options: [
        { label: 'Founder / CEO', score: 0 },
        { label: 'Co-Founder', score: 0 },
        { label: 'CTO', score: 0 },
        { label: 'COO', score: 0 },
        { label: 'CFO', score: 0 },
        { label: 'Other', score: 0 },
      ],
    },
    {
      id: 'email_address',
      title: 'Email Address',
      type: 'short_text',
      required: true,
    },
    {
      id: 'mobile_number',
      title: 'Mobile Number',
      type: 'short_text',
      required: true,
    },
    {
      id: 'whatsapp_consent',
      title: 'WhatsApp Consent',
      type: 'multiple_choice',
      required: false,
      options: [
        { label: 'I consent to receiving program updates via WhatsApp', score: 0 },
      ],
    },
    {
      id: 'email_consent',
      title: 'Email Consent',
      type: 'multiple_choice',
      required: false,
      options: [
        { label: 'I consent to receiving program updates via Email', score: 0 },
      ],
    },
    {
      id: 'platform_scope_ack',
      title: 'Platform Scope Acknowledgement',
      type: 'multiple_choice',
      required: true,
      options: [
        { label: 'I acknowledge that this platform is for tracking and support purposes...', score: 0 },
      ],
    },
    {
      id: 'participation_authority_ack',
      title: 'Participation Authority Declaration',
      type: 'multiple_choice',
      required: true,
      options: [
        { label: 'I declare that I have the authority to participate in this onboarding...', score: 0 },
      ],
    },
  ]

  // Insert template
  const [template] = await db
    .insert(formTemplates)
    .values({
      tenantId,
      title: 'Tenant Admin Onboarding Form',
      description: 'Custom tenant admin onboarding form with Business Identity, Contact, and Legal sections.',
      category: 'onboarding',
      schema: schema as any,
    })
    .returning()

  console.log(`Created form template with ID: ${template.id}`)

  // Create mapping
  await db
    .insert(formMappings)
    .values({
      tenantId,
      templateId: template.id,
      type: 'tenant_admin_onboarding',
      contextId: 'default',
      isActive: true,
    })

  console.log(`Mapped template ${template.id} to tenant_admin_onboarding for Tenant ${tenantId}`)

  // Set platform settings source tenant ID
  await db
    .update(platformSettings)
    .set({ tenantOnboardingSourceTenantId: tenantId, updatedAt: new Date() })
    .where(eq(platformSettings.id, settings.id))

  console.log(`Successfully updated platform settings tenantOnboardingSourceTenantId to ${tenantId}`)
  process.exit(0)
}

run().catch((err) => {
  console.error(err)
  process.exit(1)
})
