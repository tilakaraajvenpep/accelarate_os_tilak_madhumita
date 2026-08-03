import express from 'express'
import cors from 'cors'
import dotenv from 'dotenv'
import path from 'path'
import { isAllowedOrigin } from '../../utils/host'
import notificationsRouter from '../../routes/notifications'
import { sendDueCohortEventReminders } from '../../services/cohort-reminders.service'

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
  res.json({ status: 'ok', service: 'notifications-service', ts: new Date().toISOString() })
})

// Trigger endpoint for daily event reminders (can be called by EventBridge / CloudWatch Scheduler)
app.post('/api/notifications/reminders/trigger', async (_req, res) => {
  try {
    const result = await sendDueCohortEventReminders()
    res.json({ success: true, result })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    res.status(500).json({ success: false, error: message })
  }
})

app.use('/api/notifications', notificationsRouter)

export default app
