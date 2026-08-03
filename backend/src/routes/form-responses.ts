import { Router, Response } from 'express'
import { z } from 'zod'
import { requireAuth, loadUser, requireRole, type AuthRequest } from '../middleware/auth.middleware'
import {
  resolveTemplatesForSection,
  saveResponse,
  getResponse,
  deleteResponse,
  getMappingById,
} from '../services/form-responses.service'
import { getCompanyForUser, isCompanyMember } from '../services/company-members.service'
import { generateExcel, generatePdf, getResponseCompanyId } from '../services/form-export.service'

const router = Router()

async function resolveCompanyId(req: AuthRequest, res: Response): Promise<number | null> {
  const tenantId = req.dbUser!.tenantId
  if (!tenantId) {
    res.status(400).json({ error: 'No tenant associated with this account' })
    return null
  }
  if (req.dbUser!.role === 'founder') {
    const company = await getCompanyForUser(tenantId, req.dbUser!.id)
    if (!company) {
      res.status(404).json({ error: 'No company found for this account' })
      return null
    }
    return company.id
  }
  const companyId = req.query.companyId ? Number(req.query.companyId) : NaN
  if (isNaN(companyId)) {
    res.status(400).json({ error: 'companyId query param is required for this role' })
    return null
  }
  return companyId
}

router.get(
  '/tenants/me/form-responses/resolve',
  requireAuth,
  loadUser,
  requireRole('founder', 'admin', 'mentor'),
  async (req: AuthRequest, res: Response) => {
    const tenantId = req.dbUser!.tenantId!
    const companyId = await resolveCompanyId(req, res)
    if (companyId === null) return
    const type = String(req.query.type ?? '')
    const contextId = String(req.query.contextId ?? '')
    if (!type || !contextId) {
      res.status(400).json({ error: 'type and contextId query params are required' })
      return
    }
    const sectionId = req.query.sectionId !== undefined ? String(req.query.sectionId) : undefined
    const instances = await resolveTemplatesForSection({ tenantId, companyId, type, contextId, sectionId })
    res.json(instances)
  },
)

const saveSchema = z.object({
  templateId: z.number().int(),
  mappingId: z.number().int(),
  responseId: z.number().int().nullable().optional(),
  responseJson: z.record(z.string(), z.unknown()),
  status: z.enum(['draft', 'submitted']),
})

router.post('/tenants/me/form-responses', requireAuth, loadUser, requireRole('founder', 'admin', 'mentor'), async (req: AuthRequest, res: Response) => {
  const tenantId = req.dbUser!.tenantId!
  const companyId = await resolveCompanyId(req, res)
  if (companyId === null) return

  const parsed = saveSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() })
    return
  }

  // Founders can't submit pillar_diagnostic sections D/E — mentor/admin only.
  if (req.dbUser!.role === 'founder') {
    const mapping = await getMappingById(tenantId, parsed.data.mappingId)
    if (mapping?.type === 'pillar_diagnostic' && (mapping.sectionId === 'D' || mapping.sectionId === 'E')) {
      res.status(403).json({ error: 'Unauthorized: Founders cannot submit Pillar Section D or E assessments' })
      return
    }
  }

  try {
    const saved = await saveResponse({
      tenantId,
      companyId,
      userId: req.dbUser!.id,
      templateId: parsed.data.templateId,
      mappingId: parsed.data.mappingId,
      responseId: parsed.data.responseId ?? null,
      responseJson: parsed.data.responseJson,
      status: parsed.data.status,
    })
    res.json(saved)
  } catch (err: unknown) {
    res.status(400).json({ error: err instanceof Error ? err.message : 'Failed to save response' })
  }
})

router.get('/tenants/me/form-responses/:id', requireAuth, loadUser, requireRole('founder', 'admin', 'mentor'), async (req: AuthRequest, res: Response) => {
  const tenantId = req.dbUser!.tenantId!
  const companyId = await resolveCompanyId(req, res)
  if (companyId === null) return
  const response = await getResponse(tenantId, companyId, Number(req.params.id))
  if (!response) {
    res.status(404).json({ error: 'Response not found' })
    return
  }
  res.json(response)
})

router.delete('/tenants/me/form-responses/:id', requireAuth, loadUser, requireRole('founder', 'admin', 'mentor'), async (req: AuthRequest, res: Response) => {
  const tenantId = req.dbUser!.tenantId!
  const companyId = await resolveCompanyId(req, res)
  if (companyId === null) return
  try {
    const deleted = await deleteResponse(tenantId, companyId, Number(req.params.id))
    res.json(deleted)
  } catch (err: unknown) {
    res.status(400).json({ error: err instanceof Error ? err.message : 'Failed to delete response' })
  }
})

async function checkExportOwnership(req: AuthRequest, res: Response, id: number): Promise<boolean> {
  if (req.dbUser!.role === 'admin' || req.dbUser!.role === 'super_admin' || req.dbUser!.role === 'mentor') return true
  const companyId = await getResponseCompanyId(id)
  if (companyId === null) {
    res.status(404).json({ error: 'Response not found' })
    return false
  }
  const isMember = await isCompanyMember(companyId, req.dbUser!.id)
  if (!isMember) {
    res.status(403).json({ error: "Unauthorized: You can only export your own company's data." })
    return false
  }
  return true
}

router.get(
  '/tenants/me/form-responses/:id/export/excel',
  requireAuth,
  loadUser,
  requireRole('founder', 'admin', 'mentor'),
  async (req: AuthRequest, res: Response) => {
    const id = Number(req.params.id)
    if (!(await checkExportOwnership(req, res, id))) return
    try {
      const buffer = await generateExcel(id)
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
      res.setHeader('Content-Disposition', `attachment; filename=form-export-${id}.xlsx`)
      res.send(buffer)
    } catch (err: unknown) {
      res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to export' })
    }
  },
)

router.get(
  '/tenants/me/form-responses/:id/export/pdf',
  requireAuth,
  loadUser,
  requireRole('founder', 'admin', 'mentor'),
  async (req: AuthRequest, res: Response) => {
    const id = Number(req.params.id)
    if (!(await checkExportOwnership(req, res, id))) return
    try {
      const buffer = await generatePdf(id)
      res.setHeader('Content-Type', 'application/pdf')
      res.setHeader('Content-Disposition', `attachment; filename=form-export-${id}.pdf`)
      res.send(buffer)
    } catch (err: unknown) {
      res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to export' })
    }
  },
)

export default router
