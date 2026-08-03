CREATE TYPE "public"."form_category" AS ENUM('pillar_diagram', 'weekly', 'milestone');--> statement-breakpoint
CREATE TYPE "public"."form_status" AS ENUM('draft', 'active', 'archived');--> statement-breakpoint
CREATE TYPE "public"."form_structure" AS ENUM('basic', 'conditional', 'grid_matrix', 'financial_spreadsheet');--> statement-breakpoint
CREATE TYPE "public"."question_type" AS ENUM('short_text', 'long_text', 'number', 'single_choice', 'multiple_choice', 'date', 'file_upload');--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "form_templates" (
	"id" serial PRIMARY KEY NOT NULL,
	"tenant_id" integer NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"category" "form_category" NOT NULL,
	"structure" "form_structure" NOT NULL,
	"allow_multiple_entries" boolean DEFAULT false NOT NULL,
	"status" "form_status" DEFAULT 'draft' NOT NULL,
	"created_by" integer,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "form_questions" (
	"id" serial PRIMARY KEY NOT NULL,
	"form_template_id" integer NOT NULL,
	"order" integer DEFAULT 0 NOT NULL,
	"title" text NOT NULL,
	"type" "question_type" NOT NULL,
	"required" boolean DEFAULT false NOT NULL,
	"options" jsonb,
	"help_text" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "form_templates" ADD CONSTRAINT "form_templates_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "form_templates" ADD CONSTRAINT "form_templates_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "form_questions" ADD CONSTRAINT "form_questions_form_template_id_form_templates_id_fk" FOREIGN KEY ("form_template_id") REFERENCES "public"."form_templates"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
