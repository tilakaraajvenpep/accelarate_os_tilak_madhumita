CREATE TYPE "public"."company_onboarding_status" AS ENUM('draft', 'locked');--> statement-breakpoint
ALTER TABLE "companies" ALTER COLUMN "name" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "companies" ADD COLUMN "uen" text;--> statement-breakpoint
ALTER TABLE "companies" ADD COLUMN "industry" text;--> statement-breakpoint
ALTER TABLE "companies" ADD COLUMN "company_size" text;--> statement-breakpoint
ALTER TABLE "companies" ADD COLUMN "role_in_business" text;--> statement-breakpoint
ALTER TABLE "companies" ADD COLUMN "mobile_number" text;--> statement-breakpoint
ALTER TABLE "companies" ADD COLUMN "consent_whatsapp" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "companies" ADD COLUMN "consent_email" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "companies" ADD COLUMN "platform_scope_ack" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "companies" ADD COLUMN "participation_authority_ack" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "companies" ADD COLUMN "status" "company_onboarding_status" DEFAULT 'locked' NOT NULL;