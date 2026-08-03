import express from 'express'
import cors from 'cors'
import dotenv from 'dotenv'
import path from 'path'
import { isAllowedOrigin } from '../../utils/host'
import cohortsRouter from '../../routes/cohorts'
import cohortTasksRouter from '../../routes/cohort-tasks'
import cohortDocumentsRouter from '../../routes/cohort-documents'

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
  res.json({ status: 'ok', service: 'cohorts-service', ts: new Date().toISOString() })
})

app.use('/api', cohortsRouter)
app.use('/api', cohortTasksRouter)
app.use('/api', cohortDocumentsRouter)

export default app
