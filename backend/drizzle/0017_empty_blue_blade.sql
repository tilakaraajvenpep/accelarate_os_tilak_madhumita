ALTER TABLE "pillars" ADD COLUMN "sort_order" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "programs" ADD COLUMN "sort_order" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
WITH ranked AS (
  SELECT id, ROW_NUMBER() OVER (PARTITION BY tenant_id ORDER BY created_at DESC) - 1 AS rn
  FROM programs
)
UPDATE programs SET sort_order = ranked.rn FROM ranked WHERE programs.id = ranked.id;--> statement-breakpoint
WITH ranked AS (
  SELECT id, ROW_NUMBER() OVER (PARTITION BY program_id ORDER BY title ASC) - 1 AS rn
  FROM pillars
)
UPDATE pillars SET sort_order = ranked.rn FROM ranked WHERE pillars.id = ranked.id;