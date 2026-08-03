import { pgTable, serial, text, timestamp, pgEnum, boolean, integer } from 'drizzle-orm/pg-core'

export const orgTypeEnum = pgEnum('org_type', [
  'university',
  'corporate',
  'vc_backed',
  'government',
  'independent',
  'other',
  'technology',
  'healthcare',
  'finance',
  'retail_ecommerce',
  'manufacturing',
  'education',
  'food_beverage',
  'real_estate',
  'professional_services',
])

export const tenants = pgTable('tenants', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  // Doubles as the DNS subdomain label ({slug}.example.com) — see utils/slug.ts.
  slug: text('slug').notNull().unique(),
  orgType: orgTypeEnum('org_type'),
  website: text('website'),
  // Firm logo shown in place of the fallback initial-letter avatar (sidebar
  // brand chip, superadmin tenant lists) and as the tenant subdomain's
  // browser favicon. Stored as a data: URL (base64) — small images only,
  // no S3/upload infra in this app.
  logoUrl: text('logo_url'),
  // Hex color (e.g. "#3b82f6") applied as the --primary CSS variable
  // site-wide for this tenant's subdomain — lets each tenant re-skin the
  // accent color without a separate theming system.
  brandColor: text('brand_color'),
  // Hex color (e.g. "#0f172a") applied as the --background/--page CSS
  // variables site-wide for this tenant's subdomain — same "flat override,
  // both light and dark mode" approach as brandColor above.
  backgroundColor: text('background_color'),
  suspended: boolean('suspended').notNull().default(false),
  emailServiceEnabled: boolean('email_service_enabled').notNull().default(true),
  // Tenant-admin self-service toggle for the cohort-event reminder pipeline
  // (in-app + email + WhatsApp) — see cohort-reminders.service.ts.
  notificationsEnabled: boolean('notifications_enabled').notNull().default(true),
  aiCreditsBalance: integer('ai_credits_balance').notNull().default(0),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
})

export type Tenant = typeof tenants.$inferSelect
export type NewTenant = typeof tenants.$inferInsert
