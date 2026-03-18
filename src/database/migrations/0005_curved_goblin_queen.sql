CREATE TABLE "sync_change_details" (
	"id" serial PRIMARY KEY NOT NULL,
	"sync_log_id" integer NOT NULL,
	"server_id" varchar(255) NOT NULL,
	"entity_type" varchar(50) NOT NULL,
	"entity_id" varchar(255) NOT NULL,
	"action" varchar(50) NOT NULL,
	"description" text,
	"details" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "sync_change_details" ADD CONSTRAINT "sync_change_details_sync_log_id_server_sync_logs_id_fk" FOREIGN KEY ("sync_log_id") REFERENCES "public"."server_sync_logs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sync_change_details" ADD CONSTRAINT "sync_change_details_server_id_servers_id_fk" FOREIGN KEY ("server_id") REFERENCES "public"."servers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_sync_change_details_sync_log_id" ON "sync_change_details" USING btree ("sync_log_id");--> statement-breakpoint
CREATE INDEX "idx_sync_change_details_server_id" ON "sync_change_details" USING btree ("server_id");--> statement-breakpoint
CREATE INDEX "idx_sync_change_details_entity_type" ON "sync_change_details" USING btree ("entity_type");