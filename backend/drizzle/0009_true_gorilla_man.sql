CREATE TYPE "public"."coupon_applies_to" AS ENUM('purchase', 'recharge');--> statement-breakpoint
CREATE TYPE "public"."coupon_discount_type" AS ENUM('percentage', 'fixed_amount');--> statement-breakpoint
CREATE TYPE "public"."coupon_duration_type" AS ENUM('once', 'repeating', 'forever');--> statement-breakpoint
CREATE TYPE "public"."credit_purchase_method" AS ENUM('stripe', 'offline');--> statement-breakpoint
CREATE TYPE "public"."credit_purchase_status" AS ENUM('succeeded', 'pending', 'failed');--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "coupons" (
	"id" serial PRIMARY KEY NOT NULL,
	"code" text NOT NULL,
	"discount_type" "coupon_discount_type" NOT NULL,
	"discount_value" integer NOT NULL,
	"max_discount_cents" integer,
	"applies_to" "coupon_applies_to" NOT NULL,
	"min_purchase_amount_cents" integer,
	"per_customer_limit" integer,
	"total_usage_limit" integer,
	"start_at" timestamp,
	"end_at" timestamp,
	"active" boolean DEFAULT true NOT NULL,
	"duration_type" "coupon_duration_type" DEFAULT 'once' NOT NULL,
	"duration_in_months" integer,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "coupons_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "credit_purchases" (
	"id" serial PRIMARY KEY NOT NULL,
	"tenant_id" integer NOT NULL,
	"credits" integer NOT NULL,
	"rate_cents_snapshot" integer NOT NULL,
	"gross_amount_cents" integer NOT NULL,
	"discount_amount_cents" integer DEFAULT 0 NOT NULL,
	"net_amount_cents" integer NOT NULL,
	"coupon_id" integer,
	"method" "credit_purchase_method" NOT NULL,
	"status" "credit_purchase_status" DEFAULT 'succeeded' NOT NULL,
	"stripe_customer_id" text,
	"stripe_checkout_session_id" text,
	"note" text,
	"paid_at" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "coupon_redemptions" (
	"id" serial PRIMARY KEY NOT NULL,
	"coupon_id" integer NOT NULL,
	"tenant_id" integer NOT NULL,
	"applies_to" "coupon_applies_to" NOT NULL,
	"discount_amount_cents" integer NOT NULL,
	"subscription_id" integer,
	"credit_purchase_id" integer,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "subscriptions" ADD COLUMN "coupon_id" integer;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD COLUMN "discount_amount_cents" integer;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD COLUMN "discount_cycles_remaining" integer;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "credit_purchases" ADD CONSTRAINT "credit_purchases_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "credit_purchases" ADD CONSTRAINT "credit_purchases_coupon_id_coupons_id_fk" FOREIGN KEY ("coupon_id") REFERENCES "public"."coupons"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "coupon_redemptions" ADD CONSTRAINT "coupon_redemptions_coupon_id_coupons_id_fk" FOREIGN KEY ("coupon_id") REFERENCES "public"."coupons"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "coupon_redemptions" ADD CONSTRAINT "coupon_redemptions_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "coupon_redemptions" ADD CONSTRAINT "coupon_redemptions_subscription_id_subscriptions_id_fk" FOREIGN KEY ("subscription_id") REFERENCES "public"."subscriptions"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "coupon_redemptions" ADD CONSTRAINT "coupon_redemptions_credit_purchase_id_credit_purchases_id_fk" FOREIGN KEY ("credit_purchase_id") REFERENCES "public"."credit_purchases"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_coupon_id_coupons_id_fk" FOREIGN KEY ("coupon_id") REFERENCES "public"."coupons"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
