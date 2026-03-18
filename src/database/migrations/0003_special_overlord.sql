CREATE TYPE "public"."project_server_access_action" AS ENUM('GRANT', 'UPDATE', 'REVOKE');--> statement-breakpoint
CREATE TABLE "authorization_codes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" varchar(255) NOT NULL,
	"user_id" varchar(255) NOT NULL,
	"project_id" uuid,
	"server_id" varchar(255),
	"client_id" varchar(255) NOT NULL,
	"redirect_uri" text NOT NULL,
	"expires_at" timestamp NOT NULL,
	"used" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "authorization_codes_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "oauth_clients" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"client_id" varchar(255) NOT NULL,
	"client_secret" varchar(255) NOT NULL,
	"name" varchar(255) NOT NULL,
	"redirect_uris" text[] NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "oauth_clients_client_id_unique" UNIQUE("client_id")
);
--> statement-breakpoint
CREATE TABLE "oauth_states" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"state" varchar(500) NOT NULL,
	"project_id" uuid NOT NULL,
	"server_id" varchar(255) NOT NULL,
	"redirect_uri" text NOT NULL,
	"api_key" varchar(255) NOT NULL,
	"used" varchar(10) DEFAULT 'false' NOT NULL,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "oauth_states_state_unique" UNIQUE("state")
);
--> statement-breakpoint
CREATE TABLE "project_roles" (
	"project_id" uuid NOT NULL,
	"role_id" varchar(255) NOT NULL,
	CONSTRAINT "project_roles_project_id_role_id_pk" PRIMARY KEY("project_id","role_id")
);
--> statement-breakpoint
CREATE TABLE "project_scopes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"scope" varchar(50) NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
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
CREATE TABLE "role_inheritance_rule_targets" (
	"rule_id" integer NOT NULL,
	"target_server_id" varchar(255) NOT NULL,
	CONSTRAINT "role_inheritance_rule_targets_rule_id_target_server_id_pk" PRIMARY KEY("rule_id","target_server_id")
);
--> statement-breakpoint
CREATE TABLE "role_inheritance_rules" (
	"id" serial PRIMARY KEY NOT NULL,
	"source_role_id" varchar(255) NOT NULL,
	"target_scope" varchar(20) DEFAULT 'all' NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "permissions" DROP CONSTRAINT "permissions_name_unique";--> statement-breakpoint
ALTER TABLE "project_servers" ALTER COLUMN "operations" SET DEFAULT '{"READ":true,"SEND_MESSAGES":false,"MANAGE_WEBHOOKS":false}'::jsonb;--> statement-breakpoint
ALTER TABLE "permissions" ADD COLUMN "key" varchar(100) NOT NULL;--> statement-breakpoint
ALTER TABLE "permissions" ADD COLUMN "bitfield" bigint DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "project_servers" ADD COLUMN "created_at" timestamp DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "project_servers" ADD COLUMN "updated_at" timestamp DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "is_internal" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "redirect_uri" text;--> statement-breakpoint
ALTER TABLE "roles" ADD COLUMN "permissions_bits" bigint DEFAULT 0;--> statement-breakpoint
ALTER TABLE "roles" ADD COLUMN "is_global" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "server_members" ADD COLUMN "is_active" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "server_members" ADD COLUMN "last_synced_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "sessions" ADD COLUMN "project_id" uuid;--> statement-breakpoint
ALTER TABLE "sessions" ADD COLUMN "server_id" varchar(255);--> statement-breakpoint
ALTER TABLE "authorization_codes" ADD CONSTRAINT "authorization_codes_user_id_members_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."members"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "authorization_codes" ADD CONSTRAINT "authorization_codes_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "oauth_states" ADD CONSTRAINT "oauth_states_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_roles" ADD CONSTRAINT "project_roles_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_roles" ADD CONSTRAINT "project_roles_role_id_roles_id_fk" FOREIGN KEY ("role_id") REFERENCES "public"."roles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_scopes" ADD CONSTRAINT "project_scopes_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_server_access_audit" ADD CONSTRAINT "project_server_access_audit_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_server_access_audit" ADD CONSTRAINT "project_server_access_audit_server_id_servers_id_fk" FOREIGN KEY ("server_id") REFERENCES "public"."servers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "role_inheritance_rule_targets" ADD CONSTRAINT "role_inheritance_rule_targets_rule_id_role_inheritance_rules_id_fk" FOREIGN KEY ("rule_id") REFERENCES "public"."role_inheritance_rules"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "role_inheritance_rule_targets" ADD CONSTRAINT "role_inheritance_rule_targets_target_server_id_servers_id_fk" FOREIGN KEY ("target_server_id") REFERENCES "public"."servers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "role_inheritance_rules" ADD CONSTRAINT "role_inheritance_rules_source_role_id_roles_id_fk" FOREIGN KEY ("source_role_id") REFERENCES "public"."roles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "project_server_access_audit_project_id_idx" ON "project_server_access_audit" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "project_server_access_audit_server_id_idx" ON "project_server_access_audit" USING btree ("server_id");--> statement-breakpoint
CREATE INDEX "project_server_access_audit_changed_at_idx" ON "project_server_access_audit" USING btree ("changed_at");--> statement-breakpoint
CREATE UNIQUE INDEX "role_inheritance_rules_source_role_id_uidx" ON "role_inheritance_rules" USING btree ("source_role_id");--> statement-breakpoint
CREATE INDEX "role_inheritance_rules_enabled_scope_idx" ON "role_inheritance_rules" USING btree ("enabled","target_scope");--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "project_servers_project_id_idx" ON "project_servers" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "project_servers_server_id_idx" ON "project_servers" USING btree ("server_id");--> statement-breakpoint
ALTER TABLE "permissions" DROP COLUMN "name";--> statement-breakpoint
ALTER TABLE "permissions" ADD CONSTRAINT "permissions_key_unique" UNIQUE("key");