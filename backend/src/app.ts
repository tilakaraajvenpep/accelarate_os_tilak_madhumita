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
import billingWebhookRouter from './routes/billing-webhook'
import platformRouter from './routes/platform'
import reportsRouter from './routes/reports'
import superAdminsRouter from './routes/super-admins'
import aiProviderConfigsRouter from './routes/ai-provider-configs'

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

app.use(express.json())

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
app.use('/api/platform', platformRouter)
app.use('/api/reports', reportsRouter)
app.use('/api/super-admins', superAdminsRouter)
app.use('/api/ai-provider-configs', aiProviderConfigsRouter)

export default app
