import 'dotenv/config'
import { loadSecrets } from '../config/load-secrets'

async function bootstrap() {
  await loadSecrets()
  const { db } = await import('../db/client')
  const { sections, sectionForms, formTemplates } = await import('../models')

  console.log("=== ALL SECTIONS ===")
  const allSections = await db.select().from(sections)
  for (const s of allSections) {
    console.log(`Section: ${s.title} (ID: ${s.id}) | Locked: ${s.locked}`)
    const forms = await db.select().from(sectionForms).where(eq(sectionForms.sectionId, s.id))
    for (const f of forms) {
      const [tmpl] = await db.select().from(formTemplates).where(eq(formTemplates.id, f.formId))
      console.log(`  -> Form: ${tmpl?.title} (ID: ${f.formId})`)
    }
  }
}

import { eq } from 'drizzle-orm'

bootstrap()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('\n❌ Search failed:', err)
    process.exit(1)
  })
