CREATE TABLE IF NOT EXISTS "mentor_profiles" (
	"id" serial PRIMARY KEY NOT NULL,
	"tenant_id" integer NOT NULL,
	"user_id" integer NOT NULL,
	"specialization" text,
	"onboarding_response_json" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "mentor_profiles_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "cohort_pillar_mentors" (
	"id" serial PRIMARY KEY NOT NULL,
	"tenant_id" integer NOT NULL,
	"cohort_id" integer NOT NULL,
	"pillar_id" integer NOT NULL,
	"mentor_user_id" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "cohort_pillar_mentors_cohort_id_pillar_id_unique" UNIQUE("cohort_id","pillar_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "tenant_onboarding_responses" (
	"id" serial PRIMARY KEY NOT NULL,
	"tenant_id" integer NOT NULL,
	"response_json" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "tenant_onboarding_responses_tenant_id_unique" UNIQUE("tenant_id")
);
--> statement-breakpoint
-- IF NOT EXISTS guards below: this shared dev DB's migration ledger drifted
-- from this checkout's history (a differently-numbered branch applied these
-- same columns here already) — same situation 0047 already handles, fixed
-- the same idempotent way.
ALTER TABLE "tenants" ADD COLUMN IF NOT EXISTS "logo_url" text;--> statement-breakpoint
ALTER TABLE "tenants" ADD COLUMN IF NOT EXISTS "notifications_enabled" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "interested_in_mentoring" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "cohort_tasks" ADD COLUMN IF NOT EXISTS "reminder_sent_at" timestamp;--> statement-breakpoint
ALTER TABLE "platform_settings" ADD COLUMN IF NOT EXISTS "tenant_onboarding_source_tenant_id" integer;--> statement-breakpoint
ALTER TABLE "notifications" ADD COLUMN IF NOT EXISTS "cohort_task_id" integer;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "mentor_profiles" ADD CONSTRAINT "mentor_profiles_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "mentor_profiles" ADD CONSTRAINT "mentor_profiles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "cohort_pillar_mentors" ADD CONSTRAINT "cohort_pillar_mentors_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "cohort_pillar_mentors" ADD CONSTRAINT "cohort_pillar_mentors_cohort_id_cohorts_id_fk" FOREIGN KEY ("cohort_id") REFERENCES "public"."cohorts"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "cohort_pillar_mentors" ADD CONSTRAINT "cohort_pillar_mentors_pillar_id_pillars_id_fk" FOREIGN KEY ("pillar_id") REFERENCES "public"."pillars"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "cohort_pillar_mentors" ADD CONSTRAINT "cohort_pillar_mentors_mentor_user_id_users_id_fk" FOREIGN KEY ("mentor_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "tenant_onboarding_responses" ADD CONSTRAINT "tenant_onboarding_responses_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "platform_settings" ADD CONSTRAINT "platform_settings_tenant_onboarding_source_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_onboarding_source_tenant_id") REFERENCES "public"."tenants"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "notifications" ADD CONSTRAINT "notifications_cohort_task_id_cohort_tasks_id_fk" FOREIGN KEY ("cohort_task_id") REFERENCES "public"."cohort_tasks"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
