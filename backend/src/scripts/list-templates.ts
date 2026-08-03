import 'dotenv/config'
import { loadSecrets } from '../config/load-secrets'

async function bootstrap() {
  await loadSecrets()
  const { db } = await import('../db/client')
  const { formTemplates } = await import('../models')

  console.log("=== ALL FORM TEMPLATES ===")
  const allTemplates = await db.select().from(formTemplates)
  for (const t of allTemplates) {
    console.log(`Template: ${t.title} (ID: ${t.id}) | Category: ${t.category}`)
  }
}

bootstrap()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('\n❌ Search failed:', err)
    process.exit(1)
  })
