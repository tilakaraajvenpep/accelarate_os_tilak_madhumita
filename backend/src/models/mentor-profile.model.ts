import { pgTable, serial, integer, text, jsonb, timestamp } from 'drizzle-orm/pg-core'
import { tenants } from './tenant.model'
import { users } from './user.model'

/** One row per mentor — the profile info collected right after they accept their invite. */
export const mentorProfiles = pgTable('mentor_profiles', {
  id: serial('id').primaryKey(),
  tenantId: integer('tenant_id').notNull().references(() => tenants.id),
  userId: integer('user_id').notNull().unique().references(() => users.id),
  specialization: text('specialization'),
  // Full response to a tenant-mapped "mentor onboarding" Assessment Form, if
  // one is configured (see form-mappings type='mentor_onboarding') — specialization
  // above is best-effort extracted from this when such a form is used.
  onboardingResponseJson: jsonb('onboarding_response_json'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
})

export type MentorProfile = typeof mentorProfiles.$inferSelect
export type NewMentorProfile = typeof mentorProfiles.$inferInsert
