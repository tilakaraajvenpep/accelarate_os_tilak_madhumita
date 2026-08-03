CREATE TABLE IF NOT EXISTS "cohort_documents" (
	"id" serial PRIMARY KEY NOT NULL,
	"tenant_id" integer NOT NULL,
	"cohort_id" integer NOT NULL,
	"title" text NOT NULL,
	"file_name" text NOT NULL,
	"file_type" text NOT NULL,
	"file_data" text NOT NULL,
	"file_size" integer NOT NULL,
	"uploaded_by_user_id" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "section_form_responses" ADD COLUMN "document_file_name" text;--> statement-breakpoint
ALTER TABLE "section_form_responses" ADD COLUMN "document_file_type" text;--> statement-breakpoint
ALTER TABLE "section_form_responses" ADD COLUMN "document_file_data" text;--> statement-breakpoint
ALTER TABLE "section_form_responses" ADD COLUMN "document_file_size" integer;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "cohort_documents" ADD CONSTRAINT "cohort_documents_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "cohort_documents" ADD CONSTRAINT "cohort_documents_cohort_id_cohorts_id_fk" FOREIGN KEY ("cohort_id") REFERENCES "public"."cohorts"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "cohort_documents" ADD CONSTRAINT "cohort_documents_uploaded_by_user_id_users_id_fk" FOREIGN KEY ("uploaded_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
