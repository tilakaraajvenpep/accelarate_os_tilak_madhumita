CREATE TABLE IF NOT EXISTS "cohort_forms" (
	"id" serial PRIMARY KEY NOT NULL,
	"tenant_id" integer NOT NULL,
	"cohort_id" integer NOT NULL,
	"form_id" integer NOT NULL,
	"fill_policy" text DEFAULT 'primary_founder' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "cohort_forms_cohort_id_form_id_unique" UNIQUE("cohort_id","form_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "cohort_form_responses" (
	"id" serial PRIMARY KEY NOT NULL,
	"tenant_id" integer NOT NULL,
	"cohort_id" integer NOT NULL,
	"form_id" integer NOT NULL,
	"company_id" integer NOT NULL,
	"claimed_by_user_id" integer,
	"response_json" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"submitted_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "cohort_form_responses_cohort_id_form_id_company_id_unique" UNIQUE("cohort_id","form_id","company_id")
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "cohort_forms" ADD CONSTRAINT "cohort_forms_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "cohort_forms" ADD CONSTRAINT "cohort_forms_cohort_id_cohorts_id_fk" FOREIGN KEY ("cohort_id") REFERENCES "public"."cohorts"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "cohort_forms" ADD CONSTRAINT "cohort_forms_form_id_form_templates_id_fk" FOREIGN KEY ("form_id") REFERENCES "public"."form_templates"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "cohort_form_responses" ADD CONSTRAINT "cohort_form_responses_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "cohort_form_responses" ADD CONSTRAINT "cohort_form_responses_cohort_id_cohorts_id_fk" FOREIGN KEY ("cohort_id") REFERENCES "public"."cohorts"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "cohort_form_responses" ADD CONSTRAINT "cohort_form_responses_form_id_form_templates_id_fk" FOREIGN KEY ("form_id") REFERENCES "public"."form_templates"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "cohort_form_responses" ADD CONSTRAINT "cohort_form_responses_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "cohort_form_responses" ADD CONSTRAINT "cohort_form_responses_claimed_by_user_id_users_id_fk" FOREIGN KEY ("claimed_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
