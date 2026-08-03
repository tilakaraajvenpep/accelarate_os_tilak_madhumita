import 'dotenv/config'
import { loadSecrets } from '../config/load-secrets'

async function bootstrap() {
  await loadSecrets()
  const { db } = await import('../db/client')
  const { tenants, formMappings, formTemplates, platformSettings } = await import('../models')

  const tenantList = await db.select().from(tenants)
  console.log("=== ALL TENANTS ===")
  for (const t of tenantList) {
    console.log(`ID: ${t.id} | Name: ${t.name} | Slug: ${t.slug}`)
  }

  const pSettings = await db.select().from(platformSettings)
  console.log("\n=== PLATFORM SETTINGS ===")
  console.log(JSON.stringify(pSettings, null, 2))

  const allMappings = await db.select().from(formMappings)
  console.log("\n=== ALL MAPPINGS OF TYPE tenant_admin_onboarding ===")
  const filtered = allMappings.filter(m => m.type === 'tenant_admin_onboarding')
  for (const m of filtered) {
    const template = (await db.select().from(formTemplates).where(eq(formTemplates.id, m.templateId)))[0]
    console.log(`Mapping ID: ${m.id} | Tenant ID: ${m.tenantId} | Template ID: ${m.templateId} | Title: ${template?.title} | Category: ${template?.category}`)
    console.log(`Schema: ${JSON.stringify(template?.schema)}`)
  }
}

import { eq } from 'drizzle-orm'

bootstrap()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('\n❌ Dump failed:', err)
    process.exit(1)
  })
