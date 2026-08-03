import 'dotenv/config'
import { loadSecrets } from '../config/load-secrets'

async function bootstrap() {
  await loadSecrets()
  const { db } = await import('../db/client')
  const { platformSettings } = await import('../models')

  const [settings] = await db.select().from(platformSettings).limit(1)
  if (settings) {
    await db
      .update(platformSettings)
      .set({ tenantOnboardingSourceTenantId: null, updatedAt: new Date() })
      .where(eq(platformSettings.id, settings.id))
    console.log("Successfully set tenantOnboardingSourceTenantId to null in platform_settings.")
  } else {
    console.log("No platform_settings row found to update.")
  }
}

import { eq } from 'drizzle-orm'

bootstrap()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('\n❌ Update failed:', err)
    process.exit(1)
  })
