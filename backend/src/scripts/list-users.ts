import 'dotenv/config'
import { loadSecrets } from '../config/load-secrets'

async function bootstrap() {
  await loadSecrets()
  const { db } = await import('../db/client')
  const { users, companyMembers, companies } = await import('../models')

  console.log("=== ALL USERS ===")
  const allUsers = await db.select().from(users)
  for (const u of allUsers) {
    // Check company
    const memberRows = await db.select().from(companyMembers).where(eq(companyMembers.userId, u.id))
    const companyNames = []
    for (const m of memberRows) {
      const [comp] = await db.select().from(companies).where(eq(companies.id, m.companyId))
      companyNames.push(comp ? `${comp.name} (ID: ${comp.id})` : `Company ID: ${m.companyId}`)
    }
    console.log(`User: ${u.name} | Email: ${u.email} | Role: ${u.role} | Companies: ${companyNames.join(', ') || 'None'}`)
  }
}

import { eq } from 'drizzle-orm'

bootstrap()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('\n❌ Search failed:', err)
    process.exit(1)
  })
