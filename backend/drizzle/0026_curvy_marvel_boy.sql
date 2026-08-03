ALTER TABLE "public"."form_questions" ALTER COLUMN "type" SET DATA TYPE text;--> statement-breakpoint
DROP TYPE "public"."question_type";--> statement-breakpoint
CREATE TYPE "public"."question_type" AS ENUM('short_text', 'long_text', 'number', 'dropdown', 'single_choice', 'multiple_choice', 'date', 'editable_table');--> statement-breakpoint
ALTER TABLE "public"."form_questions" ALTER COLUMN "type" SET DATA TYPE "public"."question_type" USING "type"::"public"."question_type";