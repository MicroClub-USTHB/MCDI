CREATE TABLE "app_settings" (
	"id" integer PRIMARY KEY DEFAULT 1 NOT NULL,
	"permission_cache_ttl_ms" integer,
	"stats_cache_ttl_ms" integer,
	"member_activity_threshold_days" integer,
	"max_webhooks_per_project" integer,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_by" varchar(255),
	CONSTRAINT "app_settings_single_row" CHECK ("app_settings"."id" = 1)
);
--> statement-breakpoint
ALTER TABLE "members" ADD COLUMN "preferred_name" varchar(255);