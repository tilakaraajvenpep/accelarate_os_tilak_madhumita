CREATE TABLE IF NOT EXISTS "super_admin_invites" (
	"id" serial PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"name" text,
	"code_hash" text NOT NULL,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "super_admin_invites_email_unique" UNIQUE("email")
);
--> statement-breakpoint
ALTER TABLE "users" DROP COLUMN "active";