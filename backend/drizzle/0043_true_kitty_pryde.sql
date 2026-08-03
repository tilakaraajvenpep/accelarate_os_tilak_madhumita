-- Existing section_forms/section_form_responses rows point at the old simple
-- "forms" table's IDs, which no longer apply once form_id targets
-- form_templates instead — clear them so the new FK can be added cleanly.
DELETE FROM "section_forms" WHERE "form_id" NOT IN (SELECT "id" FROM "form_templates");
--> statement-breakpoint
DELETE FROM "section_form_responses" WHERE "form_id" NOT IN (SELECT "id" FROM "form_templates");
--> statement-breakpoint
ALTER TABLE "section_forms" DROP CONSTRAINT "section_forms_form_id_forms_id_fk";
--> statement-breakpoint
ALTER TABLE "section_form_responses" DROP CONSTRAINT "section_form_responses_form_id_forms_id_fk";
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "section_forms" ADD CONSTRAINT "section_forms_form_id_form_templates_id_fk" FOREIGN KEY ("form_id") REFERENCES "public"."form_templates"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "section_form_responses" ADD CONSTRAINT "section_form_responses_form_id_form_templates_id_fk" FOREIGN KEY ("form_id") REFERENCES "public"."form_templates"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
