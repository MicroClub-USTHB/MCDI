ALTER TABLE "servers" ADD COLUMN "sync_frequency_hours" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "servers" DROP COLUMN "sync_frequency_minutes";