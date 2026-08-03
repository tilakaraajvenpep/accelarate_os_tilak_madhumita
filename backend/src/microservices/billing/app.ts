import express from 'express'
import cors from 'cors'
import dotenv from 'dotenv'
import path from 'path'
import { isAllowedOrigin } from '../../utils/host'
import billingWebhookRouter from '../../routes/billing-webhook'
import subscriptionsSelfRouter from '../../routes/subscriptions-self'
import subscriptionsRouter from '../../routes/subscriptions'
import couponsRouter from '../../routes/coupons'
import creditPurchasesRouter from '../../routes/credit-purchases'
import plansRouter from '../../routes/plans'

dotenv.config({ path: path.join(__dirname, '../../../.env') })

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

// Stripe needs the raw body to verify signatures. Must be before general json middleware.
app.use('/webhooks/stripe', express.raw({ type: 'application/json' }), billingWebhookRouter)

app.use(express.json({ limit: '12mb' }))

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: 'billing-service', ts: new Date().toISOString() })
})

app.use('/api', subscriptionsSelfRouter)
app.use('/api/tenants/:tenantId/subscriptions', subscriptionsRouter)
app.use('/api/coupons', couponsRouter)
app.use('/api', creditPurchasesRouter)
app.use('/api/plans', plansRouter)

export default app
