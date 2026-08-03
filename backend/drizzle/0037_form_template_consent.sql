ALTER TABLE "form_templates" ADD COLUMN IF NOT EXISTS "require_consent" boolean NOT NULL DEFAULT false;
--> statement-breakpoint
ALTER TABLE "form_templates" ADD COLUMN IF NOT EXISTS "consent_terms_text" text;
