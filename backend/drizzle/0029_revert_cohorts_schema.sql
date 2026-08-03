-- An earlier migration on a parallel branch (this session, before the two
-- branches were merged) altered the live cohorts.start_date/end_date columns
-- from date NOT NULL to timestamp nullable, not realizing the table was
-- already owned by the Program/Pillar/Cohort feature on another branch. This
-- reverts that mutation back to the original, canonical schema.
ALTER TABLE "cohorts" ALTER COLUMN "start_date" TYPE date USING "start_date"::date;
--> statement-breakpoint
ALTER TABLE "cohorts" ALTER COLUMN "end_date" TYPE date USING "end_date"::date;
--> statement-breakpoint
ALTER TABLE "cohorts" ALTER COLUMN "start_date" SET NOT NULL;
--> statement-breakpoint
ALTER TABLE "cohorts" ALTER COLUMN "end_date" SET NOT NULL;
