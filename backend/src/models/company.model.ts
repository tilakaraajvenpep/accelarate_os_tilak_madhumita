import { pgTable, serial, text, integer, boolean, timestamp, pgEnum } from 'drizzle-orm/pg-core'
import { tenants } from './tenant.model'
import { users } from './user.model'
import { cohorts } from './cohort.model'

// 'draft' while the founder is still filling in the onboarding form (Save Draft),
// 'locked' once they hit Final Submit — permanent, no edit UI exists past that point.
export const companyOnboardingStatusEnum = pgEnum('company_onboarding_status', ['draft', 'locked'])

export const companies = pgTable('companies', {
  id: serial('id').primaryKey(),
  tenantId: integer('tenant_id')
    .notNull()
    .references(() => tenants.id),
  // One company per founder, one founder per company — set once, when the
  // invited founder completes their company-details form after signup.
  founderUserId: integer('founder_user_id')
    .notNull()
    .unique()
    .references(() => users.id),
  // Inherited from the founder invite that created this company. Nullable so
  // companies created before this feature existed don't break — new
  // companies always get one (enforced at the app layer, not the DB layer).
  cohortId: integer('cohort_id').references(() => cohorts.id),
  // Nullable — a freshly-created draft row may not have a business name yet;
  // required at the app layer before the profile can be locked.
  name: text('name'),
  location: text('location'),
  establishedYear: integer('established_year'),
  // Always set at draft-creation time from the founder's own account name
  // (collected at the password step) — never blank, unlike the fields above.
  founderName: text('founder_name').notNull(),
  uen: text('uen'),
  industry: text('industry'),
  companySize: text('company_size'),
  roleInBusiness: text('role_in_business'),
  mobileNumber: text('mobile_number'),
  consentWhatsapp: boolean('consent_whatsapp').notNull().default(false),
  consentEmail: boolean('consent_email').notNull().default(false),
  platformScopeAck: boolean('platform_scope_ack').notNull().default(false),
  participationAuthorityAck: boolean('participation_authority_ack').notNull().default(false),
  // Defaults to 'locked' so every pre-existing company (created via the old
  // one-shot flow, before this column existed) is treated as already complete —
  // new draft rows explicitly set 'draft' at insert time.
  status: companyOnboardingStatusEnum('status').notNull().default('locked'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
})

export type Company = typeof companies.$inferSelect
export type NewCompany = typeof companies.$inferInsert
