import express from 'express'
import cors from 'cors'
import authRouter from './routes/auth'
import usersRouter from './routes/users'
import tenantsRouter from './routes/tenants'
import plansRouter from './routes/plans'
import subscriptionsRouter from './routes/subscriptions'
import billingWebhookRouter from './routes/billing-webhook'
import platformRouter from './routes/platform'

const app = express()

app.use(
  cors({
    origin: process.env.FRONTEND_URL || 'http://localhost:5173',
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
app.use('/api/tenants/:tenantId/subscriptions', subscriptionsRouter)
app.use('/api/platform', platformRouter)

export default app
