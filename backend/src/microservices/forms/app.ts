import express from 'express'
import cors from 'cors'
import dotenv from 'dotenv'
import path from 'path'
import { isAllowedOrigin } from '../../utils/host'
import formsRouter from '../../routes/forms'
import formTemplatesRouter from '../../routes/form-templates'
import formMappingsRouter from '../../routes/form-mappings'
import formResponsesRouter from '../../routes/form-responses'
import founderCohortFormsRouter from '../../routes/founder-cohort-forms'
import programFeedbackRouter from '../../routes/program-feedback'

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
  res.json({ status: 'ok', service: 'forms-service', ts: new Date().toISOString() })
})

app.use('/api', formsRouter)
app.use('/api', formTemplatesRouter)
app.use('/api', formMappingsRouter)
app.use('/api', formResponsesRouter)
app.use('/api', founderCohortFormsRouter)
app.use('/api', programFeedbackRouter)

export default app
