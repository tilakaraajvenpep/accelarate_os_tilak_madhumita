ALTER TABLE "pillars" DROP COLUMN IF EXISTS "parallel_sort_order";--> statement-breakpoint
ALTER TABLE "programs" DROP COLUMN IF EXISTS "pillar_execution_mode";--> statement-breakpoint
ALTER TABLE "tenants" DROP COLUMN IF EXISTS "program_execution_mode";--> statement-breakpoint
DROP TYPE IF EXISTS "public"."program_execution_mode";