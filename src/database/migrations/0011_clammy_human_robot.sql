ALTER TABLE "server_sync_logs" ADD COLUMN "target" varchar(50) DEFAULT 'all' NOT NULL;--> statement-breakpoint
ALTER TABLE "server_sync_logs" ADD COLUMN "heartbeat_at" timestamp;