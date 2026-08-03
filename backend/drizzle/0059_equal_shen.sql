ALTER TABLE "section_forms" ADD COLUMN "fill_policy" text DEFAULT 'first_claim' NOT NULL;--> statement-breakpoint
ALTER TABLE "section_form_responses" ADD COLUMN "claimed_by_user_id" integer;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "section_form_responses" ADD CONSTRAINT "section_form_responses_claimed_by_user_id_users_id_fk" FOREIGN KEY ("claimed_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
