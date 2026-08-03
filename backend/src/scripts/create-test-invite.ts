import 'dotenv/config'
import { loadSecrets } from '../config/load-secrets'

async function run() {
  await loadSecrets()

  const { db } = await import('../db/client')
  const { cohorts, tenants } = await import('../models')
  const { createCompanyInvite } = await import('../services/company-invites.service')

  console.log('Finding tenants and cohorts...')

  const existingTenants = await db.select().from(tenants)
  if (existingTenants.length === 0) {
    console.error('No tenants exist!')
    process.exit(1)
  }
  const tenant = existingTenants[0]

  const existingCohorts = await db.select().from(cohorts).where(eq(cohorts.tenantId, tenant.id))
  let cohortId: number
  if (existingCohorts.length === 0) {
    console.log('No cohorts exist, creating a test cohort...')
    const [newCohort] = await db.insert(cohorts).values({
      tenantId: tenant.id,
      name: 'Test Cohort',
      startDate: new Date().toISOString().split('T')[0],
      endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    }).returning()
    cohortId = newCohort.id
  } else {
    cohortId = existingCohorts[0].id
  }

  const testEmail = `test-founder-${Date.now()}@example.com`
  console.log(`Creating company invite for email ${testEmail} under tenant ID ${tenant.id} and cohort ID ${cohortId}...`)

  const invite = await createCompanyInvite({
    tenantId: tenant.id,
    name: 'Test Founder',
    email: testEmail,
    cohortId,
  })

  console.log('=== TEST INVITE URL ===')
  const testUrl = `http://localhost:5173/accept-invite?token=${invite.token}`
  console.log(testUrl)
  console.log('=======================')
  process.exit(0)
}

import { eq } from 'drizzle-orm'

run().catch((err) => {
  console.error(err)
  process.exit(1)
})
