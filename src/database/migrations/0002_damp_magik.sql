ALTER TABLE "server_members" ADD COLUMN "is_active" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "server_members" ADD COLUMN "last_synced_at" timestamp with time zone;