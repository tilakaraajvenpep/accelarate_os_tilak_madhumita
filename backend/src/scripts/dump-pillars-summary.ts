import 'dotenv/config'
import { loadSecrets } from '../config/load-secrets'

async function bootstrap() {
  await loadSecrets()
  const { db } = await import('../db/client')
  const { companies, cohorts, programs, pillars, sections, pillarSections, sectionForms, sectionFormResponses, sectionCompletions, pillarChecklistResponses } = await import('../models')
  const { eq, and } = await import('drizzle-orm')

  console.log("=== DB DUMP START ===")
  const allCompanies = await db.select().from(companies)
  for (const company of allCompanies) {
    console.log(`\nCompany: ${company.name} (ID: ${company.id}) | Cohort ID: ${company.cohortId}`)
    if (!company.cohortId) continue

    const [cohort] = await db.select().from(cohorts).where(eq(cohorts.id, company.cohortId))
    console.log(`Cohort: ${cohort?.name ?? 'Unknown'}`)

    // Find pillars
    const allPillars = await db.select().from(pillars).orderBy(pillars.sortOrder)
    for (const p of allPillars) {
      console.log(`  Pillar: ${p.title} (ID: ${p.id}) | Purpose: ${p.purpose} | Locked: ${p.locked} | Mandatory: ${p.mandatory}`)

      // Find sections for this pillar
      const links = await db.select().from(pillarSections).where(eq(pillarSections.pillarId, p.id)).orderBy(pillarSections.sortOrder)
      const secIds = links.map(l => l.sectionId)

      let totalSections = secIds.length
      let completedSectionsCount = 0

      for (const link of links) {
        const [sec] = await db.select().from(sections).where(eq(sections.id, link.sectionId))
        if (!sec) continue

        // Check if section is manually completed
        const [manual] = await db.select().from(sectionCompletions).where(
          and(
            eq(sectionCompletions.companyId, company.id),
            eq(sectionCompletions.sectionId, sec.id)
          )
        )

        // Check forms
        const forms = await db.select().from(sectionForms).where(eq(sectionForms.sectionId, sec.id))
        let allFormsSubmitted = true
        let hasForms = forms.length > 0

        const formDetails = []
        for (const f of forms) {
          const [resp] = await db.select().from(sectionFormResponses).where(
            and(
              eq(sectionFormResponses.companyId, company.id),
              eq(sectionFormResponses.sectionId, sec.id),
              eq(sectionFormResponses.formId, f.formId)
            )
          ).orderBy(sectionFormResponses.branchNumber) // check branches

          const submitted = resp?.status === 'submitted'
          if (!submitted) {
            allFormsSubmitted = false
          }
          formDetails.push({ formId: f.formId, status: resp?.status ?? 'none' })
        }

        const isSecCompleted = hasForms ? (forms.length > 0 && allFormsSubmitted) : !!manual
        if (isSecCompleted) {
          completedSectionsCount++
        }

        console.log(`    Section: ${sec.title} (ID: ${sec.id}) | Locked: ${sec.locked} | Has Forms: ${hasForms} | Forms: ${JSON.stringify(formDetails)} | Manual: ${!!manual} | Completed: ${isSecCompleted}`)
      }

      console.log(`    => Sections progress: ${completedSectionsCount}/${totalSections}`)
    }
  }
}

bootstrap()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('\n❌ Dump failed:', err)
    process.exit(1)
  })
