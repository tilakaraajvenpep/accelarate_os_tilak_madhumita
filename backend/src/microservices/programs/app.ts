import express from 'express'
import cors from 'cors'
import dotenv from 'dotenv'
import path from 'path'
import { isAllowedOrigin } from '../../utils/host'
import programRouter from '../../routes/program'
import founderProgramsRouter from '../../routes/founder-programs'
import mentorProgramsRouter from '../../routes/mentor-programs'
import pillarsRouter from '../../routes/pillars'

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
  res.json({ status: 'ok', service: 'programs-service', ts: new Date().toISOString() })
})

app.use('/api', programRouter)
app.use('/api', founderProgramsRouter)
app.use('/api', mentorProgramsRouter)
app.use('/api', pillarsRouter)

export default app
