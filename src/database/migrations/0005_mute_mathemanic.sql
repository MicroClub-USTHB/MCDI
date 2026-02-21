CREATE TYPE "public"."project_server_access_action" AS ENUM('GRANT', 'UPDATE', 'REVOKE');--> statement-breakpoint
CREATE TABLE "project_server_access_audit" (
	"id" serial PRIMARY KEY NOT NULL,
	"project_id" uuid NOT NULL,
	"server_id" varchar(255) NOT NULL,
	"action" "project_server_access_action" NOT NULL,
	"operations_before" jsonb,
	"operations_after" jsonb,
	"changed_by" varchar(255) NOT NULL,
	"changed_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "project_servers" ALTER COLUMN "operations" SET DEFAULT '{"READ":true,"SEND_MESSAGES":false,"MANAGE_WEBHOOKS":false}'::jsonb;--> statement-breakpoint
ALTER TABLE "project_servers" ADD COLUMN "created_at" timestamp DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "project_servers" ADD COLUMN "updated_at" timestamp DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "project_server_access_audit" ADD CONSTRAINT "project_server_access_audit_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_server_access_audit" ADD CONSTRAINT "project_server_access_audit_server_id_servers_id_fk" FOREIGN KEY ("server_id") REFERENCES "public"."servers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "project_server_access_audit_project_id_idx" ON "project_server_access_audit" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "project_server_access_audit_server_id_idx" ON "project_server_access_audit" USING btree ("server_id");--> statement-breakpoint
CREATE INDEX "project_server_access_audit_changed_at_idx" ON "project_server_access_audit" USING btree ("changed_at");--> statement-breakpoint
CREATE INDEX "project_servers_project_id_idx" ON "project_servers" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "project_servers_server_id_idx" ON "project_servers" USING btree ("server_id");