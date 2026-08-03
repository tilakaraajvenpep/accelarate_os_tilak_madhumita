import { Router, Response } from 'express'
import { z } from 'zod'
import { eq } from 'drizzle-orm'
import { requireAuth, loadUser, requireRole, type AuthRequest } from '../middleware/auth.middleware'
import { db } from '../db/client'
import { tenants } from '../models'
import { sendFormUpdatedNotice } from '../services/ses.service'
import { createNotification } from '../services/notifications.service'
import {
  listFormTemplates,
  createFormTemplate,
  getFormTemplateById,
  updateFormTemplate,
  duplicateFormTemplate,
  setFormTemplateArchived,
  deleteFormTemplate,
  previewVersionImpact,
  createNewVersion,
  listFormTemplateResponses,
} from '../services/form-templates.service'

const router = Router()

const optionSchema = z.object({ label: z.string().min(1), score: z.number().int() })

const columnSchema = z.object({
  id: z.string(),
  label: z.string(),
  type: z.enum(['text', 'number', 'select', 'label', 'radio', 'checkbox', 'date']),
  options: z.array(optionSchema).optional(),
  format: z.enum(['currency', 'number', 'text']).optional(),
  currencySymbol: z.string().optional(),
})

const rowSchema = z
  .object({
    id: z.string(),
    isDefaultRow: z.boolean().optional(),
    isFormulaRow: z.boolean().optional(),
    isSectionHeader: z.boolean().optional(),
    sectionLabel: z.string().optional(),
    sectionLevel: z.union([z.literal(1), z.literal(2), z.literal(3)]).optional(),
    sectionAllowAddRows: z.boolean().optional(),
    sectionEnableSummary: z.boolean().optional(),
    sectionSummaryLabel: z.string().optional(),
    sectionSummaryFormula: z.string().optional(),
    sectionSummaryVariable: z.string().optional(),
    _userAdded: z.boolean().optional(),
    _cellConfigs: z
      .record(
        z.object({
          type: z.literal('select').optional(),
          options: z.array(optionSchema).optional(),
          hideCurrency: z.boolean().optional(),
        }),
      )
      .optional(),
  })
  .passthrough()

const summaryRowSchema = z.object({
  enabled: z.boolean(),
  label: z.string().optional(),
  labelColSpan: z.number().int().optional(),
  valueColId: z.string().optional(),
  formula: z.string().optional(),
})

const questionSchema = z.object({
  id: z.string(),
  title: z.string().min(1),
  type: z.enum([
    'short_text',
    'long_text',
    'number',
    'dropdown',
    'single_choice',
    'multiple_choice',
    'date',
    'editable_table',
  ]),
  required: z.boolean().optional(),
  helpText: z.string().nullable().optional(),
  options: z.array(optionSchema).nullable().optional(),
  columns: z.array(columnSchema).optional(),
  defaultRows: z.array(rowSchema).optional(),
  allowAddRows: z.boolean().optional(),
  summaryRow: summaryRowSchema.optional(),
})

const createSchema = z.object({
  title: z.string().min(1),
  description: z.string().nullable().optional(),
  category: z.string().min(1),
  isMultipleEntry: z.boolean().optional(),
  requireConsent: z.boolean().optional(),
  consentTermsText: z.string().nullable().optional(),
  schema: z.array(questionSchema),
})

const updateSchema = createSchema.partial()

const patchSchema = updateSchema.extend({ confirmNewVersion: z.boolean().optional() })

const impactPreviewSchema = z.object({ schema: z.array(questionSchema) })

const archiveSchema = z.object({ isArchived: z.boolean() })

function requireTenantId(req: AuthRequest, res: Response): number | null {
  const tenantId = req.dbUser!.tenantId
  if (!tenantId) {
    res.status(400).json({ error: 'No tenant associated with this account' })
    return null
  }
  return tenantId
}

router.get(
  '/tenants/me/form-templates',
  requireAuth,
  loadUser,
  requireRole('admin'),
  async (req: AuthRequest, res: Response) => {
    const tenantId = requireTenantId(req, res)
    if (tenantId === null) return
    const templates = await listFormTemplates(tenantId)
    res.json(templates)
  },
)

router.post(
  '/tenants/me/form-templates',
  requireAuth,
  loadUser,
  requireRole('admin'),
  async (req: AuthRequest, res: Response) => {
    const tenantId = requireTenantId(req, res)
    if (tenantId === null) return
    const parsed = createSchema.safeParse(req.body)
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.flatten() })
      return
    }
    try {
      const template = await createFormTemplate({
        tenantId,
        createdBy: req.dbUser!.id,
        title: parsed.data.title,
        description: parsed.data.description,
        category: parsed.data.category,
        isMultipleEntry: parsed.data.isMultipleEntry,
        requireConsent: parsed.data.requireConsent,
        consentTermsText: parsed.data.consentTermsText,
        schema: parsed.data.schema,
      })
      res.json(template)
    } catch (err: unknown) {
      res.status(400).json({ error: err instanceof Error ? err.message : 'Failed to create form template' })
    }
  },
)

router.get(
  '/tenants/me/form-templates/:id',
  requireAuth,
  loadUser,
  requireRole('admin'),
  async (req: AuthRequest, res: Response) => {
    const tenantId = requireTenantId(req, res)
    if (tenantId === null) return
    const template = await getFormTemplateById(tenantId, Number(req.params.id))
    if (!template) {
      res.status(404).json({ error: 'Form template not found' })
      return
    }
    res.json(template)
  },
)

router.post(
  '/tenants/me/form-templates/:id/impact-preview',
  requireAuth,
  loadUser,
  requireRole('admin'),
  async (req: AuthRequest, res: Response) => {
    const tenantId = requireTenantId(req, res)
    if (tenantId === null) return
    const parsed = impactPreviewSchema.safeParse(req.body)
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.flatten() })
      return
    }
    try {
      const impact = await previewVersionImpact(tenantId, Number(req.params.id), parsed.data.schema)
      res.json(impact)
    } catch (err: unknown) {
      res.status(400).json({ error: err instanceof Error ? err.message : 'Failed to preview impact' })
    }
  },
)

router.patch(
  '/tenants/me/form-templates/:id',
  requireAuth,
  loadUser,
  requireRole('admin'),
  async (req: AuthRequest, res: Response) => {
    const tenantId = requireTenantId(req, res)
    if (tenantId === null) return
    const parsed = patchSchema.safeParse(req.body)
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.flatten() })
      return
    }
    const { confirmNewVersion, ...fields } = parsed.data
    const id = Number(req.params.id)

    try {
      if (fields.schema) {
        const impact = await previewVersionImpact(tenantId, id, fields.schema)
        if (impact.willFork) {
          if (!confirmNewVersion) {
            res.status(409).json({ requiresConfirmation: true, ...impact })
            return
          }

          const { template, notifyTargets } = await createNewVersion(tenantId, id, { ...fields, schema: fields.schema }, req.dbUser!.id)

          const [tenant] = await db.select().from(tenants).where(eq(tenants.id, tenantId)).limit(1)
          for (const target of notifyTargets) {
            await createNotification({
              tenantId,
              userId: target.userId,
              type: 'form_updated',
              title: `"${template.title}" was updated`,
              body: `${tenant?.name ?? 'Your program'} updated the questions on this form since you last submitted it — please fill it in again.`,
            })
            if (tenant?.emailServiceEnabled) {
              try {
                await sendFormUpdatedNotice({ to: target.email!, founderName: target.name ?? 'there', formTitle: template.title, tenantName: tenant.name })
              } catch (err) {
                console.error('[form-templates] failed to send refill notice to', target.email, err)
              }
            }
          }

          res.json({ ...template, forkedVersion: true })
          return
        }
      }

      const updated = await updateFormTemplate(tenantId, id, fields)
      if (!updated) {
        res.status(404).json({ error: 'Form template not found' })
        return
      }
      res.json(updated)
    } catch (err: unknown) {
      res.status(400).json({ error: err instanceof Error ? err.message : 'Failed to update form template' })
    }
  },
)

router.get(
  '/tenants/me/form-templates/:id/responses',
  requireAuth,
  loadUser,
  requireRole('admin'),
  async (req: AuthRequest, res: Response) => {
    const tenantId = requireTenantId(req, res)
    if (tenantId === null) return
    const result = await listFormTemplateResponses(tenantId, Number(req.params.id))
    if (!result) {
      res.status(404).json({ error: 'Form template not found' })
      return
    }
    res.json(result)
  },
)

router.post(
  '/tenants/me/form-templates/:id/duplicate',
  requireAuth,
  loadUser,
  requireRole('admin'),
  async (req: AuthRequest, res: Response) => {
    const tenantId = requireTenantId(req, res)
    if (tenantId === null) return
    try {
      const copy = await duplicateFormTemplate(tenantId, Number(req.params.id), req.dbUser!.id)
      res.json(copy)
    } catch (err: unknown) {
      res.status(400).json({ error: err instanceof Error ? err.message : 'Failed to duplicate form template' })
    }
  },
)

router.patch(
  '/tenants/me/form-templates/:id/status',
  requireAuth,
  loadUser,
  requireRole('admin'),
  async (req: AuthRequest, res: Response) => {
    const tenantId = requireTenantId(req, res)
    if (tenantId === null) return
    const parsed = archiveSchema.safeParse(req.body)
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.flatten() })
      return
    }
    const updated = await setFormTemplateArchived(tenantId, Number(req.params.id), parsed.data.isArchived)
    if (!updated) {
      res.status(404).json({ error: 'Form template not found' })
      return
    }
    res.json(updated)
  },
)

router.delete(
  '/tenants/me/form-templates/:id',
  requireAuth,
  loadUser,
  requireRole('admin'),
  async (req: AuthRequest, res: Response) => {
    const tenantId = requireTenantId(req, res)
    if (tenantId === null) return
    try {
      await deleteFormTemplate(tenantId, Number(req.params.id))
      res.json({ message: 'Form template deleted' })
    } catch (err: unknown) {
      res.status(400).json({ error: err instanceof Error ? err.message : 'Failed to delete form template' })
    }
  },
)

export default router
