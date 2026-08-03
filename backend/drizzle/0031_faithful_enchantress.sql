ALTER TABLE "cohort_tasks" ADD COLUMN "start_date" date;--> statement-breakpoint
ALTER TABLE "cohort_tasks" ADD COLUMN "end_date" date;--> statement-breakpoint
UPDATE "cohort_tasks" SET "start_date" = "date" WHERE "start_date" IS NULL;