ALTER TABLE "projects" RENAME COLUMN "api_key" TO "api_key_hash";--> statement-breakpoint
ALTER TABLE "projects" DROP CONSTRAINT "projects_api_key_unique";--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "api_key_prefix" varchar(40);--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "api_key_last_used_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "is_active" boolean DEFAULT true NOT NULL;--> statement-breakpoint
CREATE INDEX "idx_roles_server_id" ON "roles" USING btree ("server_id");--> statement-breakpoint
CREATE INDEX "idx_server_members_member_id" ON "server_members" USING btree ("member_id");--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_api_key_hash_unique" UNIQUE("api_key_hash");