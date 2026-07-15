ALTER TABLE "platform_settings" ADD COLUMN "ai_credit_rate_cents" integer DEFAULT 100 NOT NULL;
--> statement-breakpoint
ALTER TABLE "tenants" ADD COLUMN "ai_credits_balance" integer DEFAULT 0 NOT NULL;
