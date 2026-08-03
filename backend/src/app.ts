import express from 'express'
import cors from 'cors'
import { isAllowedOrigin } from './utils/host'
import authRouter from './routes/auth'
import usersRouter from './routes/users'
import tenantsRouter from './routes/tenants'
import plansRouter from './routes/plans'
import subscriptionsRouter from './routes/subscriptions'
import subscriptionsSelfRouter from './routes/subscriptions-self'
import couponsRouter from './routes/coupons'
import creditPurchasesRouter from './routes/credit-purchases'
import companiesRouter from './routes/companies'
import companyMembersRouter from './routes/company-members'
import cohortsRouter from './routes/cohorts'
import cohortTasksRouter from './routes/cohort-tasks'
import formTemplatesRouter from './routes/form-templates'
import formMappingsRouter from './routes/form-mappings'
import pillarsRouter from './routes/pillars'
import formResponsesRouter from './routes/form-responses'
import aiScoringRouter from './routes/ai-scoring'
import aiChatRouter from './routes/ai-chat'
import governanceRouter from './routes/governance'
import programFeedbackRouter from './routes/program-feedback'
import programRouter from './routes/program'
import founderProgramsRouter from './routes/founder-programs'
import founderCohortFormsRouter from './routes/founder-cohort-forms'
import formsRouter from './routes/forms'
import billingWebhookRouter from './routes/billing-webhook'
import platformRouter from './routes/platform'
import reportsRouter from './routes/reports'
import superAdminsRouter from './routes/super-admins'
import aiProviderConfigsRouter from './routes/ai-provider-configs'
import notificationsRouter from './routes/notifications'
import mentorsRouter from './routes/mentors'
import cohortDocumentsRouter from './routes/cohort-documents'
import mentorProgramsRouter from './routes/mentor-programs'
import adminViewAsFounderRouter from './routes/admin-view-as-founder'

const app = express()

const BASE_DOMAIN = process.env.BASE_DOMAIN || 'localhost'

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || isAllowedOrigin(origin, BASE_DOMAIN)) {
        callback(null, true)
      } else {
        callback(new Error('Not allowed by CORS'))
      }
    },
    credentials: true,
  }),
)

// Stripe needs the raw, untouched body to verify webhook signatures — must be
// mounted before the global express.json() below.
app.use('/webhooks/stripe', express.raw({ type: 'application/json' }), billingWebhookRouter)

// Bumped from the 100kb default to fit base64-encoded uploads — the tenant
// logo (tenants.service.ts's setTenantLogo) and cohort/section documents
// (cohort-documents.service.ts, section-form-responses.service.ts) all store
// files inline as data: URLs since this app has no S3/upload infra.
app.use(express.json({ limit: '12mb' }))

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', ts: new Date().toISOString() })
})

app.use('/auth', authRouter)
app.use('/api/users', usersRouter)
app.use('/api/tenants', tenantsRouter)
app.use('/api/plans', plansRouter)
// Must be registered before the :tenantId mount below — otherwise "me" in
// /api/tenants/me/subscriptions/* gets swallowed as a literal :tenantId value
// by the super-admin-only router instead of reaching these self-serve routes.
app.use('/api', subscriptionsSelfRouter)
app.use('/api/tenants/:tenantId/subscriptions', subscriptionsRouter)
app.use('/api/coupons', couponsRouter)
app.use('/api', creditPurchasesRouter)
app.use('/api', companiesRouter)
app.use('/api', companyMembersRouter)
app.use('/api', cohortsRouter)
app.use('/api', cohortTasksRouter)
app.use('/api', formTemplatesRouter)
app.use('/api', formMappingsRouter)
app.use('/api', pillarsRouter)
app.use('/api', formResponsesRouter)
app.use('/api', aiScoringRouter)
app.use('/api', aiChatRouter)
app.use('/api', governanceRouter)
app.use('/api', programFeedbackRouter)
app.use('/api', programRouter)
app.use('/api', founderProgramsRouter)
app.use('/api', founderCohortFormsRouter)
app.use('/api', notificationsRouter)
app.use('/api', mentorsRouter)
app.use('/api', cohortDocumentsRouter)
app.use('/api', mentorProgramsRouter)
app.use('/api', adminViewAsFounderRouter)
app.use('/api', formsRouter)
app.use('/api/platform', platformRouter)
app.use('/api/reports', reportsRouter)
app.use('/api/super-admins', superAdminsRouter)
app.use('/api/ai-provider-configs', aiProviderConfigsRouter)

export default app
