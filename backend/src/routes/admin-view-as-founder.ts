import { Router, Response } from 'express'
import { eq, and } from 'drizzle-orm'
import { db } from '../db/client'
import { companies, cohorts } from '../models'
import { requireAuth, loadUser, requireRole, type AuthRequest } from '../middleware/auth.middleware'
import { listAssignedProgramsForCompany, getAssignedProgramDetailForCompany, getPillarsSummaryForCompany } from '../services/founder-programs.service'
import { getFormForSection, getSectionFormResponse } from '../services/section-form-responses.service'
import { listCohortDocuments, getCohortDocument } from '../services/cohort-documents.service'
import { listCohortTasks } from '../services/cohort-tasks.service'
import { listCompanyMembers } from '../services/company-members.service'

const router = Router()

const gate = [requireAuth, loadUser, requireRole('admin')] as const

async function resolveCompany(tenantId: number, companyId: number) {
  const [company] = await db
    .select({ id: companies.id, name: companies.name, founderName: companies.founderName, cohortId: companies.cohortId })
    .from(companies)
    .where(and(eq(companies.id, companyId), eq(companies.tenantId, tenantId)))
    .limit(1)
  return company ?? null
}

function tenantOf(req: AuthRequest, res: Response): number | null {
  const tenantId = req.dbUser!.tenantId
  if (!tenantId) {
    res.status(400).json({ error: 'No tenant associated with this account' })
    return null
  }
  return tenantId
}

// ── Read-only mirror of the founder's own pages, for a tenant admin to review a specific company's experience ──

router.get('/tenants/me/companies/:id/view-as', ...gate, async (req: AuthRequest, res: Response) => {
  const tenantId = tenantOf(req, res)
  if (tenantId === null) return
  const company = await resolveCompany(tenantId, Number(req.params.id))
  if (!company) { res.status(404).json({ error: 'Company not found' }); return }
  res.json(company)
})

router.get('/tenants/me/companies/:id/view-as/programs', ...gate, async (req: AuthRequest, res: Response) => {
  const tenantId = tenantOf(req, res)
  if (tenantId === null) return
  const company = await resolveCompany(tenantId, Number(req.params.id))
  if (!company) { res.status(404).json({ error: 'Company not found' }); return }
  if (!company.cohortId) { res.json([]); return }
  res.json(await listAssignedProgramsForCompany(tenantId, company.cohortId, company.id))
})

router.get('/tenants/me/companies/:id/view-as/pillars-summary', ...gate, async (req: AuthRequest, res: Response) => {
  const tenantId = tenantOf(req, res)
  if (tenantId === null) return
  const company = await resolveCompany(tenantId, Number(req.params.id))
  if (!company) { res.status(404).json({ error: 'Company not found' }); return }
  if (!company.cohortId) { res.json([]); return }
  res.json(await getPillarsSummaryForCompany(tenantId, company.cohortId, company.id))
})

router.get('/tenants/me/companies/:id/view-as/programs/:programId', ...gate, async (req: AuthRequest, res: Response) => {
  const tenantId = tenantOf(req, res)
  if (tenantId === null) return
  const company = await resolveCompany(tenantId, Number(req.params.id))
  if (!company || !company.cohortId) { res.status(404).json({ error: 'Program not found' }); return }
  const detail = await getAssignedProgramDetailForCompany(tenantId, company.cohortId, company.id, Number(req.params.programId))
  if (!detail) { res.status(404).json({ error: 'Program not found' }); return }
  res.json(detail)
})

router.get('/tenants/me/companies/:id/view-as/team', ...gate, async (req: AuthRequest, res: Response) => {
  const tenantId = tenantOf(req, res)
  if (tenantId === null) return
  const company = await resolveCompany(tenantId, Number(req.params.id))
  if (!company) { res.status(404).json({ error: 'Company not found' }); return }
  res.json(await listCompanyMembers(company.id))
})

router.get('/tenants/me/companies/:id/view-as/documents', ...gate, async (req: AuthRequest, res: Response) => {
  const tenantId = tenantOf(req, res)
  if (tenantId === null) return
  const company = await resolveCompany(tenantId, Number(req.params.id))
  if (!company) { res.status(404).json({ error: 'Company not found' }); return }
  if (!company.cohortId) { res.json([]); return }
  res.json(await listCohortDocuments(tenantId, company.cohortId))
})

router.get('/tenants/me/companies/:id/view-as/documents/:docId', ...gate, async (req: AuthRequest, res: Response) => {
  const tenantId = tenantOf(req, res)
  if (tenantId === null) return
  const company = await resolveCompany(tenantId, Number(req.params.id))
  if (!company) { res.status(404).json({ error: 'Company not found' }); return }
  const doc = await getCohortDocument(tenantId, Number(req.params.docId))
  if (!doc || doc.cohortId !== company.cohortId) { res.status(404).json({ error: 'Document not found' }); return }
  res.json(doc)
})

router.get('/tenants/me/companies/:id/view-as/calendar', ...gate, async (req: AuthRequest, res: Response) => {
  const tenantId = tenantOf(req, res)
  if (tenantId === null) return
  const company = await resolveCompany(tenantId, Number(req.params.id))
  if (!company || !company.cohortId) { res.json({ cohortId: null, cohortName: null, tasks: [] }); return }

  const tasks = await listCohortTasks(tenantId, company.cohortId)
  const companyTasks = tasks.filter((t) => t.companyId === null || t.companyId === company.id)

  const [cohort] = await db.select({ name: cohorts.name }).from(cohorts).where(and(eq(cohorts.id, company.cohortId), eq(cohorts.tenantId, tenantId))).limit(1)

  res.json({ cohortId: company.cohortId, cohortName: cohort?.name ?? 'Cohort Calendar', tasks: companyTasks })
})

router.get(
  '/tenants/me/companies/:id/view-as/programs/:programId/sections/:sectionId/forms/:formId',
  ...gate,
  async (req: AuthRequest, res: Response) => {
    const tenantId = tenantOf(req, res)
    if (tenantId === null) return
    const company = await resolveCompany(tenantId, Number(req.params.id))
    if (!company || !company.cohortId) { res.status(404).json({ error: 'Program not found' }); return }

    const detail = await getAssignedProgramDetailForCompany(tenantId, company.cohortId, company.id, Number(req.params.programId))
    if (!detail) { res.status(404).json({ error: 'Program not found' }); return }
    const section = detail.pillars.flatMap((p) => p.sections).find((s) => s.id === Number(req.params.sectionId))
    if (!section) { res.status(404).json({ error: 'Section not found' }); return }

    const form = await getFormForSection(tenantId, Number(req.params.sectionId), Number(req.params.formId))
    if (!form) { res.status(404).json({ error: 'Form not found' }); return }

    const response = await getSectionFormResponse(tenantId, company.id, Number(req.params.sectionId), Number(req.params.formId))
    res.json({
      form: {
        id: form.id,
        name: form.title,
        schema: form.schema,
        category: form.category,
        requireConsent: form.requireConsent,
        consentTermsText: form.consentTermsText,
      },
      response: response
        ? {
            responseJson: response.responseJson,
            status: response.status,
            document: response.documentFileName
              ? { fileName: response.documentFileName, fileType: response.documentFileType, fileData: response.documentFileData, fileSize: response.documentFileSize }
              : null,
          }
        : null,
    })
  },
)

export default router
