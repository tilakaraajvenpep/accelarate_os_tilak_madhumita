ALTER TABLE "tenants" DROP COLUMN IF EXISTS "program_skip_enabled";--> statement-breakpoint
ALTER TABLE "tenants" DROP COLUMN IF EXISTS "program_skip_limit";--> statement-breakpoint
ALTER TABLE "tenants" DROP COLUMN IF EXISTS "pillar_skip_enabled";--> statement-breakpoint
ALTER TABLE "tenants" DROP COLUMN IF EXISTS "pillar_skip_limit";--> statement-breakpoint
ALTER TABLE "tenants" DROP COLUMN IF EXISTS "section_skip_enabled";--> statement-breakpoint
ALTER TABLE "tenants" DROP COLUMN IF EXISTS "section_skip_limit";--> statement-breakpoint
ALTER TABLE "public"."tenants" ALTER COLUMN "program_execution_mode" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "public"."tenants" ALTER COLUMN "program_execution_mode" SET DATA TYPE text;--> statement-breakpoint
UPDATE "tenants" SET "program_execution_mode" = 'parallel' WHERE "program_execution_mode" = 'flexible';--> statement-breakpoint
DROP TYPE "public"."program_execution_mode";--> statement-breakpoint
CREATE TYPE "public"."program_execution_mode" AS ENUM('sequential', 'parallel');--> statement-breakpoint
ALTER TABLE "public"."tenants" ALTER COLUMN "program_execution_mode" SET DATA TYPE "public"."program_execution_mode" USING "program_execution_mode"::"public"."program_execution_mode";--> statement-breakpoint
ALTER TABLE "public"."tenants" ALTER COLUMN "program_execution_mode" SET DEFAULT 'sequential'::"public"."program_execution_mode";