ALTER TABLE "users" ADD COLUMN "allowed_menus" jsonb;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "can_set_permissions" boolean DEFAULT false NOT NULL;