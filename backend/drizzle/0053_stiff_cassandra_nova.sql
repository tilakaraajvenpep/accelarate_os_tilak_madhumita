CREATE TYPE "public"."pillar_purpose" AS ENUM('learning', 'assessment');--> statement-breakpoint
ALTER TABLE "pillars" ADD COLUMN "purpose" "pillar_purpose" DEFAULT 'learning' NOT NULL;--> statement-breakpoint
ALTER TABLE "pillars" ADD COLUMN "pass_threshold" integer;