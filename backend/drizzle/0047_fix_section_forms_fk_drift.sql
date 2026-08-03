-- The migration ledger on this shared dev DB drifted from this checkout's
-- migration history (another checkout applied its own differently-numbered
-- migrations against the same DB at some point). Migration 0043 was supposed
-- to delete section_forms rows still pointing at the legacy "forms" table and
-- repoint the FK at "form_templates", but it never actually ran here — this
-- finishes that same fix idempotently.
DELETE FROM "section_forms" WHERE "form_id" NOT IN (SELECT "id" FROM "form_templates");
--> statement-breakpoint
ALTER TABLE "section_forms" DROP CONSTRAINT IF EXISTS "section_forms_form_id_forms_id_fk";
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "section_forms" ADD CONSTRAINT "section_forms_form_id_form_templates_id_fk" FOREIGN KEY ("form_id") REFERENCES "public"."form_templates"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
