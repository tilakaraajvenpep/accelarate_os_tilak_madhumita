CREATE TABLE IF NOT EXISTS "section_forms" (
	"id" serial PRIMARY KEY NOT NULL,
	"section_id" integer NOT NULL,
	"form_id" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "section_forms_section_id_form_id_unique" UNIQUE("section_id","form_id")
);
--> statement-breakpoint
INSERT INTO "section_forms" ("section_id", "form_id")
SELECT "id", "form_id" FROM "sections" WHERE "form_id" IS NOT NULL
ON CONFLICT DO NOTHING;--> statement-breakpoint
ALTER TABLE "sections" DROP CONSTRAINT "sections_form_id_forms_id_fk";
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "section_forms" ADD CONSTRAINT "section_forms_section_id_sections_id_fk" FOREIGN KEY ("section_id") REFERENCES "public"."sections"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "section_forms" ADD CONSTRAINT "section_forms_form_id_forms_id_fk" FOREIGN KEY ("form_id") REFERENCES "public"."forms"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
ALTER TABLE "sections" DROP COLUMN IF EXISTS "form_id";