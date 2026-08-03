import express from 'express'
import cors from 'cors'
import dotenv from 'dotenv'
import path from 'path'
import { isAllowedOrigin } from '../../utils/host'
import tenantsRouter from '../../routes/tenants'
import superAdminsRouter from '../../routes/super-admins'
import platformRouter from '../../routes/platform'
import reportsRouter from '../../routes/reports'

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

app.use(express.json({ limit: '12mb' }))

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: 'tenant-service', ts: new Date().toISOString() })
})

app.use('/api/tenants', tenantsRouter)
app.use('/api/super-admins', superAdminsRouter)
app.use('/api/platform', platformRouter)
app.use('/api/reports', reportsRouter)

export default app
