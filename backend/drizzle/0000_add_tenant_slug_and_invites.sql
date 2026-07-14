ALTER TABLE "tenants" ADD COLUMN "slug" text;
--> statement-breakpoint
UPDATE "tenants" SET "slug" = lower(regexp_replace("name", '[^a-zA-Z0-9]+', '-', 'g')) || '-' || "id" WHERE "slug" IS NULL;
--> statement-breakpoint
ALTER TABLE "tenants" ALTER COLUMN "slug" SET NOT NULL;
--> statement-breakpoint
ALTER TABLE "tenants" ADD CONSTRAINT "tenants_slug_unique" UNIQUE("slug");
--> statement-breakpoint
CREATE TYPE "public"."invite_status" AS ENUM('pending', 'accepted', 'expired');
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "tenant_invites" (
	"id" serial PRIMARY KEY NOT NULL,
	"tenant_id" integer NOT NULL,
	"email" text NOT NULL,
	"name" text,
	"role" "role" DEFAULT 'admin' NOT NULL,
	"token" text NOT NULL,
	"status" "invite_status" DEFAULT 'pending' NOT NULL,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "tenant_invites_token_unique" UNIQUE("token")
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "tenant_invites" ADD CONSTRAINT "tenant_invites_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
