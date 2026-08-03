-- Note: cohorts table + companies.cohort_id are created by migration 0020
-- (mature_swordsman, from the Program/Pillar/Section branch) — not repeated
-- here to avoid a redundant/conflicting definition of the same table.
DROP TABLE IF EXISTS "form_questions";
--> statement-breakpoint
ALTER TABLE "form_templates" ALTER COLUMN "category" TYPE text USING "category"::text;
--> statement-breakpoint
ALTER TABLE "form_templates" DROP COLUMN IF EXISTS "structure";
--> statement-breakpoint
ALTER TABLE "form_templates" DROP COLUMN IF EXISTS "allow_multiple_entries";
--> statement-breakpoint
ALTER TABLE "form_templates" DROP COLUMN IF EXISTS "status";
--> statement-breakpoint
ALTER TABLE "form_templates" ADD COLUMN IF NOT EXISTS "schema" jsonb NOT NULL DEFAULT '[]'::jsonb;
--> statement-breakpoint
ALTER TABLE "form_templates" ADD COLUMN IF NOT EXISTS "is_archived" boolean NOT NULL DEFAULT false;
--> statement-breakpoint
ALTER TABLE "form_templates" ADD COLUMN IF NOT EXISTS "is_multiple_entry" boolean NOT NULL DEFAULT false;
--> statement-breakpoint
ALTER TABLE "form_templates" ADD COLUMN IF NOT EXISTS "version" integer NOT NULL DEFAULT 1;
--> statement-breakpoint
DROP TYPE IF EXISTS "public"."question_type";
--> statement-breakpoint
DROP TYPE IF EXISTS "public"."form_structure";
--> statement-breakpoint
DROP TYPE IF EXISTS "public"."form_status";
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "form_mappings" (
	"id" serial PRIMARY KEY NOT NULL,
	"tenant_id" integer NOT NULL,
	"template_id" integer NOT NULL,
	"cohort_id" integer,
	"type" text NOT NULL,
	"context_id" text NOT NULL,
	"section_id" text DEFAULT '' NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "form_mappings" ADD CONSTRAINT "form_mappings_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "form_mappings" ADD CONSTRAINT "form_mappings_template_id_form_templates_id_fk" FOREIGN KEY ("template_id") REFERENCES "public"."form_templates"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "form_mappings" ADD CONSTRAINT "form_mappings_cohort_id_cohorts_id_fk" FOREIGN KEY ("cohort_id") REFERENCES "public"."cohorts"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
