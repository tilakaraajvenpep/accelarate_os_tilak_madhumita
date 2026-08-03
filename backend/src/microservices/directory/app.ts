import express from 'express'
import cors from 'cors'
import dotenv from 'dotenv'
import path from 'path'
import { isAllowedOrigin } from '../../utils/host'
import companiesRouter from '../../routes/companies'
import companyMembersRouter from '../../routes/company-members'
import mentorsRouter from '../../routes/mentors'
import adminViewAsFounderRouter from '../../routes/admin-view-as-founder'

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
  res.json({ status: 'ok', service: 'directory-service', ts: new Date().toISOString() })
})

app.use('/api', companiesRouter)
app.use('/api', companyMembersRouter)
app.use('/api', mentorsRouter)
app.use('/api', adminViewAsFounderRouter)

export default app
