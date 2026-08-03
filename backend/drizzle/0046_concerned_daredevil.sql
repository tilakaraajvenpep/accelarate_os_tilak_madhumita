ALTER TABLE "form_templates" ADD COLUMN "root_template_id" integer;--> statement-breakpoint
ALTER TABLE "form_templates" ADD COLUMN "previous_version_id" integer;--> statement-breakpoint
ALTER TABLE "form_templates" ADD COLUMN "superseded_by_form_id" integer;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "form_templates" ADD CONSTRAINT "form_templates_root_template_id_form_templates_id_fk" FOREIGN KEY ("root_template_id") REFERENCES "public"."form_templates"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "form_templates" ADD CONSTRAINT "form_templates_previous_version_id_form_templates_id_fk" FOREIGN KEY ("previous_version_id") REFERENCES "public"."form_templates"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "form_templates" ADD CONSTRAINT "form_templates_superseded_by_form_id_form_templates_id_fk" FOREIGN KEY ("superseded_by_form_id") REFERENCES "public"."form_templates"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
UPDATE "form_templates" SET "root_template_id" = "id" WHERE "root_template_id" IS NULL;
