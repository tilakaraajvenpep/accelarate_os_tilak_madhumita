ALTER TYPE "public"."ai_provider" ADD VALUE 'manus';--> statement-breakpoint
ALTER TABLE "ai_provider_configs" ALTER COLUMN "model" DROP NOT NULL;