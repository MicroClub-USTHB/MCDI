CREATE TABLE IF NOT EXISTS "inbound_webhook_settings" (
	"id" integer PRIMARY KEY DEFAULT 1 NOT NULL,
	"default_reader_role_ids" jsonb,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_by" varchar(255),
	CONSTRAINT "inbound_webhook_settings_single_row" CHECK ("inbound_webhook_settings"."id" = 1)
);
