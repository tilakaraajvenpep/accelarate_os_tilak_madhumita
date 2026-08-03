import { Router, Response } from 'express'
import { z } from 'zod'
import { requireAuth, loadUser, requireRole, type AuthRequest } from '../middleware/auth.middleware'
import { getCompanyForUser } from '../services/company-members.service'
import { listCohortFormsForCompany, getCohortFormForFounder, saveCohortFormResponse } from '../services/cohort-form-responses.service'

const router = Router()

const gate = [requireAuth, loadUser, requireRole('founder')] as const

async function resolveCompany(req: AuthRequest, res: Response) {
  const tenantId = req.dbUser!.tenantId
  if (!tenantId) { res.status(400).json({ error: 'No tenant associated with this account' }); return null }

  const company = await getCompanyForUser(tenantId, req.dbUser!.id)
  if (!company) { res.status(404).json({ error: 'No company found for this account' }); return null }
  if (!company.cohortId) { return { tenantId, cohortId: null, companyId: company.id } }

  return { tenantId, cohortId: company.cohortId, companyId: company.id }
}

router.get('/tenants/me/founder/cohort-forms', ...gate, async (req: AuthRequest, res: Response) => {
  const resolved = await resolveCompany(req, res)
  if (!resolved) return
  if (!resolved.cohortId) { res.json([]); return }
  res.json(await listCohortFormsForCompany(resolved.tenantId, resolved.cohortId, resolved.companyId, req.dbUser!.id))
})

router.get('/tenants/me/founder/cohort-forms/:formId', ...gate, async (req: AuthRequest, res: Response) => {
  const resolved = await resolveCompany(req, res)
  if (!resolved) return
  if (!resolved.cohortId) { res.status(404).json({ error: 'Form not found' }); return }

  const result = await getCohortFormForFounder(resolved.tenantId, resolved.cohortId, Number(req.params.formId), resolved.companyId, req.dbUser!.id)
  if (!result) { res.status(404).json({ error: 'Form not found' }); return }
  if (result.locked) { res.status(403).json({ error: 'locked', claimedByName: result.claimedByName }); return }
  res.json(result)
})

const saveResponseSchema = z.object({
  responseJson: z.record(z.string(), z.unknown()),
  status: z.enum(['draft', 'submitted']),
})

router.put('/tenants/me/founder/cohort-forms/:formId/response', ...gate, async (req: AuthRequest, res: Response) => {
  const resolved = await resolveCompany(req, res)
  if (!resolved) return
  if (!resolved.cohortId) { res.status(404).json({ error: 'Form not found' }); return }

  const parsed = saveResponseSchema.safeParse(req.body)
  if (!parsed.success) { res.status(400).json({ error: parsed.error.flatten() }); return }

  try {
    const saved = await saveCohortFormResponse({
      tenantId: resolved.tenantId,
      cohortId: resolved.cohortId,
      formId: Number(req.params.formId),
      companyId: resolved.companyId,
      userId: req.dbUser!.id,
      responseJson: parsed.data.responseJson,
      status: parsed.data.status,
    })
    res.json(saved)
  } catch (err: unknown) {
    res.status(400).json({ error: err instanceof Error ? err.message : 'Failed to save form response' })
  }
})

export default router
