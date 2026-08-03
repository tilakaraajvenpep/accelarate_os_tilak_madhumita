import { eq, and, isNull } from 'drizzle-orm'
import { db } from '../db/client'
import { cohortTasks, cohorts, tenants, companies, companyMembers, users } from '../models'
import { createNotification } from './notifications.service'
import { sendCohortEventReminderEmail } from './ses.service'
import { sendWhatsAppReminder } from './whatsapp.service'

const REMINDER_LEAD_DAYS = 3

function daysFromNowDateString(days: number) {
  const d = new Date()
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

/**
 * Finds every cohort_tasks event exactly REMINDER_LEAD_DAYS away — for
 * tenants with notifications turned on — and fans out an in-app + email +
 * WhatsApp reminder to every member of every company in that event's
 * cohort. Called daily by the cron job in server.ts, but idempotent: each
 * event is only ever processed once (gated on reminderSentAt), so calling
 * this more than once (or re-running a missed day) never double-sends.
 */
export async function sendDueCohortEventReminders() {
  const targetDate = daysFromNowDateString(REMINDER_LEAD_DAYS)

  const dueTasks = await db
    .select({
      id: cohortTasks.id,
      tenantId: cohortTasks.tenantId,
      cohortId: cohortTasks.cohortId,
      title: cohortTasks.title,
      startDate: cohortTasks.startDate,
      cohortName: cohorts.name,
      emailServiceEnabled: tenants.emailServiceEnabled,
    })
    .from(cohortTasks)
    .innerJoin(cohorts, eq(cohortTasks.cohortId, cohorts.id))
    .innerJoin(tenants, eq(cohortTasks.tenantId, tenants.id))
    .where(and(eq(cohortTasks.startDate, targetDate), isNull(cohortTasks.reminderSentAt), eq(tenants.notificationsEnabled, true)))

  let remindersSent = 0

  for (const task of dueTasks) {
    // Guaranteed non-null here — the query above only ever selects rows
    // whose startDate equals targetDate (a real date string), so a
    // placeholder row (null startDate) can never appear in dueTasks.
    const startDate = task.startDate as string

    const recipients = await db
      .select({ userId: users.id, email: users.email, name: users.name })
      .from(companies)
      .innerJoin(companyMembers, eq(companyMembers.companyId, companies.id))
      .innerJoin(users, eq(companyMembers.userId, users.id))
      .where(and(eq(companies.tenantId, task.tenantId), eq(companies.cohortId, task.cohortId)))

    for (const recipient of recipients) {
      try {
        await createNotification({
          tenantId: task.tenantId,
          userId: recipient.userId,
          type: 'cohort_event_reminder',
          title: `Upcoming: ${task.title}`,
          body: `"${task.title}" is scheduled for ${startDate} — just ${REMINDER_LEAD_DAYS} days away.`,
          link: '/calendar',
          cohortTaskId: task.id,
        })
      } catch (err) {
        console.error(`[cohort-reminders] failed to create in-app notification for user ${recipient.userId}:`, err)
      }

      if (task.emailServiceEnabled) {
        try {
          await sendCohortEventReminderEmail({
            to: recipient.email,
            name: recipient.name || recipient.email,
            eventTitle: task.title,
            eventDate: startDate,
            cohortName: task.cohortName,
          })
        } catch (err) {
          console.error(`[cohort-reminders] failed to email user ${recipient.userId}:`, err)
        }
      }

      try {
        await sendWhatsAppReminder({ to: null, eventTitle: task.title, eventDate: startDate })
      } catch (err) {
        console.error(`[cohort-reminders] WhatsApp reminder failed for user ${recipient.userId}:`, err)
      }
    }

    await db.update(cohortTasks).set({ reminderSentAt: new Date() }).where(eq(cohortTasks.id, task.id))
    remindersSent += recipients.length
  }

  return { eventsProcessed: dueTasks.length, remindersSent }
}
