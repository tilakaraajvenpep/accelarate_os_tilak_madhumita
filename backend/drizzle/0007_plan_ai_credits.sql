ALTER TABLE "plans" DROP COLUMN "ai_provider_config_id";--> statement-breakpoint
ALTER TABLE "plans" ADD COLUMN "ai_credits" integer DEFAULT 0 NOT NULL;
