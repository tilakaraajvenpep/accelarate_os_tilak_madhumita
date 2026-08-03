ALTER TABLE "pillars" ADD COLUMN "program_id" integer;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "pillars" ADD CONSTRAINT "pillars_program_id_programs_id_fk" FOREIGN KEY ("program_id") REFERENCES "public"."programs"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
