ALTER TABLE "cohort_tasks" ADD COLUMN "pillar_id" integer;--> statement-breakpoint
ALTER TABLE "cohort_tasks" ADD COLUMN "section_id" integer;--> statement-breakpoint
ALTER TABLE "pillars" ADD COLUMN "parallel_sort_order" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "pillars" ADD COLUMN "show_in_calendar" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "pillars" ADD COLUMN "locked" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "sections" ADD COLUMN "show_in_calendar" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "sections" ADD COLUMN "locked" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "programs" ADD COLUMN "pillar_execution_mode" "program_execution_mode" DEFAULT 'sequential' NOT NULL;--> statement-breakpoint
ALTER TABLE "programs" ADD COLUMN "locked" boolean DEFAULT false NOT NULL;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "cohort_tasks" ADD CONSTRAINT "cohort_tasks_pillar_id_pillars_id_fk" FOREIGN KEY ("pillar_id") REFERENCES "public"."pillars"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "cohort_tasks" ADD CONSTRAINT "cohort_tasks_section_id_sections_id_fk" FOREIGN KEY ("section_id") REFERENCES "public"."sections"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
ALTER TABLE "tenants" DROP COLUMN IF EXISTS "program_execution_mode";
