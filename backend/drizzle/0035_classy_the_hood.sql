ALTER TABLE "cohort_tasks" ADD COLUMN "program_id" integer;--> statement-breakpoint
ALTER TABLE "programs" ADD COLUMN "show_in_calendar" boolean DEFAULT false NOT NULL;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "cohort_tasks" ADD CONSTRAINT "cohort_tasks_program_id_programs_id_fk" FOREIGN KEY ("program_id") REFERENCES "public"."programs"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
