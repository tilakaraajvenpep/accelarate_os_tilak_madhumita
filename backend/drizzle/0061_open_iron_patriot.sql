CREATE TABLE IF NOT EXISTS "plan_ai_provider_configs" (
	"id" serial PRIMARY KEY NOT NULL,
	"plan_id" integer NOT NULL,
	"ai_provider_config_id" integer NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "plan_ai_provider_configs_plan_id_ai_provider_config_id_unique" UNIQUE("plan_id","ai_provider_config_id")
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "plan_ai_provider_configs" ADD CONSTRAINT "plan_ai_provider_configs_plan_id_plans_id_fk" FOREIGN KEY ("plan_id") REFERENCES "public"."plans"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "plan_ai_provider_configs" ADD CONSTRAINT "plan_ai_provider_configs_ai_provider_config_id_ai_provider_configs_id_fk" FOREIGN KEY ("ai_provider_config_id") REFERENCES "public"."ai_provider_configs"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
