ALTER TABLE "pillars" DROP CONSTRAINT IF EXISTS "pillars_category_id_program_categories_id_fk";
--> statement-breakpoint
ALTER TABLE "sections" DROP CONSTRAINT IF EXISTS "sections_category_id_program_categories_id_fk";
--> statement-breakpoint
ALTER TABLE "pillars" DROP COLUMN IF EXISTS "category_id";--> statement-breakpoint
ALTER TABLE "sections" DROP COLUMN IF EXISTS "category_id";--> statement-breakpoint
ALTER TABLE "program_categories" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP TABLE "program_categories" CASCADE;