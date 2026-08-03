import { pgTable, serial, integer, text, timestamp } from 'drizzle-orm/pg-core'
import { tenants } from './tenant.model'
import { users } from './user.model'
import { cohortTasks } from './cohort-task.model'

// Freeform, not a strict enum — new notification types can be added without
// a migration each time. 'form_updated' fires when a form template gets
// forked to a new version; 'cohort_event_reminder' fires from the cohort
// calendar reminder pipeline.
export type NotificationType = 'form_updated' | 'cohort_event_reminder'

export const notifications = pgTable('notifications', {
  id: serial('id').primaryKey(),
  tenantId: integer('tenant_id')
    .notNull()
    .references(() => tenants.id),
  userId: integer('user_id')
    .notNull()
    .references(() => users.id),
  type: text('type').notNull(),
  title: text('title').notNull(),
  body: text('body'),
  // Optional relative link the notification can navigate to when clicked.
  link: text('link'),
  // Set only for cohort_event_reminder notifications — lets deleteTenant
  // (and any cohort-task cleanup) cascade without an orphan check.
  cohortTaskId: integer('cohort_task_id').references(() => cohortTasks.id),
  readAt: timestamp('read_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
})

export type Notification = typeof notifications.$inferSelect
export type NewNotification = typeof notifications.$inferInsert
