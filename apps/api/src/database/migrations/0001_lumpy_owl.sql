CREATE TABLE IF NOT EXISTS "webhooks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"discord_webhook_id" varchar(255) NOT NULL,
	"project_id" uuid NOT NULL,
	"server_id" varchar(255) NOT NULL,
	"channel_id" varchar(255) NOT NULL,
	"name" varchar(80) NOT NULL,
	"avatar" text,
	"encrypted_token" text NOT NULL,
	"usage_count" integer DEFAULT 0 NOT NULL,
	"last_used_at" timestamp with time zone,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "webhooks_discord_webhook_id_unique" UNIQUE("discord_webhook_id")
);
 --> statement-breakpoint
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'webhooks_project_id_projects_id_fk' AND conrelid = 'public.webhooks'::regclass) THEN
    ALTER TABLE "webhooks" ADD CONSTRAINT "webhooks_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;
  END IF;
END $$; --> statement-breakpoint
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'webhooks_server_id_servers_id_fk' AND conrelid = 'public.webhooks'::regclass) THEN
    ALTER TABLE "webhooks" ADD CONSTRAINT "webhooks_server_id_servers_id_fk" FOREIGN KEY ("server_id") REFERENCES "public"."servers"("id") ON DELETE cascade ON UPDATE no action;
  END IF;
END $$; --> statement-breakpoint
CREATE INDEX IF NOT EXISTS "webhooks_project_id_idx" ON "webhooks" USING btree ("project_id"); --> statement-breakpoint
CREATE INDEX IF NOT EXISTS "webhooks_server_id_idx" ON "webhooks" USING btree ("server_id"); --> statement-breakpoint
CREATE INDEX IF NOT EXISTS "webhooks_channel_id_idx" ON "webhooks" USING btree ("channel_id");
