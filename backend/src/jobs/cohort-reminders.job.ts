import cron from 'node-cron'
import { sendDueCohortEventReminders } from '../services/cohort-reminders.service'

/** Runs once a day at 08:00 server time — checks for cohort events exactly 3 days out (per tenant) and sends reminders. Idempotent, so a missed/duplicate run is harmless. */
export function scheduleCohortReminderJob() {
  cron.schedule('0 8 * * *', async () => {
    try {
      const result = await sendDueCohortEventReminders()
      console.log(`[cohort-reminders] processed ${result.eventsProcessed} event(s), sent ${result.remindersSent} reminder(s)`)
    } catch (err) {
      console.error('[cohort-reminders] job failed:', err)
    }
  })
}
