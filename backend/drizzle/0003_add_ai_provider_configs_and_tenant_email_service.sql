CREATE TABLE IF NOT EXISTS "ai_provider_configs" (
	"id" serial PRIMARY KEY NOT NULL,
	"provider" "ai_provider" NOT NULL,
	"model" text NOT NULL,
	"api_key_ciphertext" text NOT NULL,
	"api_key_last_four" text NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
