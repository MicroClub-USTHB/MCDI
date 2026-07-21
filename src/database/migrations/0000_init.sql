DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'audit_action_type') THEN
    CREATE TYPE "public"."audit_action_type" AS ENUM('auth', 'project', 'server', 'role', 'webhook', 'member', 'sync', 'permission');
  END IF;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$; --> statement-breakpoint
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'audit_severity') THEN
    CREATE TYPE "public"."audit_severity" AS ENUM('info', 'warning', 'error');
  END IF;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$; --> statement-breakpoint
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'project_server_access_action') THEN
    CREATE TYPE "public"."project_server_access_action" AS ENUM('GRANT', 'UPDATE', 'REVOKE');
  END IF;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$; --> statement-breakpoint
CREATE TABLE IF NOT EXISTS "admin_oauth_states" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"state" varchar(500) NOT NULL,
	"used" varchar(10) DEFAULT 'false' NOT NULL,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "admin_oauth_states_state_unique" UNIQUE("state")
);
 --> statement-breakpoint
CREATE TABLE IF NOT EXISTS "audit_logs" (
	"id" serial PRIMARY KEY NOT NULL,
	"actor_id" varchar(255),
	"actor_name" varchar(255),
	"action_type" "audit_action_type" NOT NULL,
	"action" varchar(100) NOT NULL,
	"entity_type" varchar(50) NOT NULL,
	"entity_id" varchar(255),
	"details" jsonb,
	"ip_address" varchar(45),
	"user_agent" text,
	"severity" "audit_severity" DEFAULT 'info' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
 --> statement-breakpoint
CREATE TABLE IF NOT EXISTS "auth_requests" (
	"request_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"client_id" uuid NOT NULL,
	"redirect_uri" text NOT NULL,
	"server_id" varchar(255) NOT NULL,
	"state" text NOT NULL,
	"expires_at" timestamp NOT NULL,
	"used" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
 --> statement-breakpoint
CREATE TABLE IF NOT EXISTS "callback_codes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code_hash" varchar(64) NOT NULL,
	"client_id" uuid NOT NULL,
	"redirect_uri" text NOT NULL,
	"member_id" varchar(255) NOT NULL,
	"server_id" varchar(255) NOT NULL,
	"expires_at" timestamp NOT NULL,
	"used" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "callback_codes_code_hash_unique" UNIQUE("code_hash")
);
 --> statement-breakpoint
CREATE TABLE IF NOT EXISTS "members" (
	"id" varchar(255) PRIMARY KEY NOT NULL,
	"username" varchar(255) NOT NULL,
	"global_name" varchar(255),
	"display_name" varchar(255),
	"avatar" text,
	"email" varchar(255),
	"is_club_member" boolean DEFAULT false NOT NULL,
	"is_system_admin" boolean DEFAULT false NOT NULL,
	"password_hash" text,
	"joined_at" timestamp,
	"synced_at" timestamp with time zone,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
 --> statement-breakpoint
CREATE TABLE IF NOT EXISTS "oauth_clients" (
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
CREATE TABLE IF NOT EXISTS "oauth_states" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"state" varchar(500) NOT NULL,
	"project_id" uuid NOT NULL,
	"server_id" varchar(255) NOT NULL,
	"redirect_uri" text NOT NULL,
	"client_state" text,
	"used" varchar(10) DEFAULT 'false' NOT NULL,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "oauth_states_state_unique" UNIQUE("state")
);
 --> statement-breakpoint
CREATE TABLE IF NOT EXISTS "permissions" (
	"id" serial PRIMARY KEY NOT NULL,
	"key" varchar(100) NOT NULL,
	"description" text,
	"bitfield" bigint DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "permissions_key_unique" UNIQUE("key")
);
 --> statement-breakpoint
CREATE TABLE IF NOT EXISTS "project_roles" (
	"project_id" uuid NOT NULL,
	"role_id" varchar(255) NOT NULL,
	CONSTRAINT "project_roles_project_id_role_id_pk" PRIMARY KEY("project_id","role_id")
);
 --> statement-breakpoint
CREATE TABLE IF NOT EXISTS "project_scopes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"scope" varchar(50) NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
 --> statement-breakpoint
CREATE TABLE IF NOT EXISTS "project_server_access_audit" (
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
CREATE TABLE IF NOT EXISTS "project_servers" (
	"project_id" uuid NOT NULL,
	"server_id" varchar(255) NOT NULL,
	"operations" jsonb DEFAULT '{"READ":true,"SEND_MESSAGES":false,"MANAGE_WEBHOOKS":false}'::jsonb NOT NULL,
	"scopes" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "project_servers_project_id_server_id_pk" PRIMARY KEY("project_id","server_id")
);
 --> statement-breakpoint
CREATE TABLE IF NOT EXISTS "projects" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(255) NOT NULL,
	"description" text,
	"api_key_hash" varchar(255) NOT NULL,
	"api_key_prefix" varchar(40),
	"api_key_last_used_at" timestamp with time zone,
	"api_key_created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"is_internal" boolean DEFAULT false NOT NULL,
	"webhook_url" text,
	"redirect_uri" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "projects_name_unique" UNIQUE("name"),
	CONSTRAINT "projects_api_key_hash_unique" UNIQUE("api_key_hash")
);
 --> statement-breakpoint
CREATE TABLE IF NOT EXISTS "role_inheritance_rule_targets" (
	"rule_id" integer NOT NULL,
	"target_server_id" varchar(255) NOT NULL,
	CONSTRAINT "role_inheritance_rule_targets_rule_id_target_server_id_pk" PRIMARY KEY("rule_id","target_server_id")
);
 --> statement-breakpoint
CREATE TABLE IF NOT EXISTS "role_inheritance_rules" (
	"id" serial PRIMARY KEY NOT NULL,
	"source_role_id" varchar(255) NOT NULL,
	"target_scope" varchar(20) DEFAULT 'all' NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
 --> statement-breakpoint
CREATE TABLE IF NOT EXISTS "role_permissions" (
	"role_id" varchar(255) NOT NULL,
	"permission_id" integer NOT NULL,
	CONSTRAINT "role_permissions_role_id_permission_id_pk" PRIMARY KEY("role_id","permission_id")
);
 --> statement-breakpoint
CREATE TABLE IF NOT EXISTS "roles" (
	"id" varchar(255) PRIMARY KEY NOT NULL,
	"server_id" varchar(255) NOT NULL,
	"name" varchar(255) NOT NULL,
	"color" integer,
	"hoist" boolean DEFAULT false,
	"position" integer DEFAULT 0,
	"managed" boolean DEFAULT false,
	"mentionable" boolean DEFAULT false,
	"permissions_bits" bigint DEFAULT 0,
	"hierarchy_level" integer,
	"is_global" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
 --> statement-breakpoint
CREATE TABLE IF NOT EXISTS "server_member_roles" (
	"member_id" varchar(255) NOT NULL,
	"role_id" varchar(255) NOT NULL,
	CONSTRAINT "server_member_roles_member_id_role_id_pk" PRIMARY KEY("member_id","role_id")
);
 --> statement-breakpoint
CREATE TABLE IF NOT EXISTS "server_members" (
	"server_id" varchar(255) NOT NULL,
	"member_id" varchar(255) NOT NULL,
	"joined_at" timestamp,
	"is_active" boolean DEFAULT true NOT NULL,
	"last_synced_at" timestamp with time zone,
	CONSTRAINT "server_members_server_id_member_id_pk" PRIMARY KEY("server_id","member_id")
);
 --> statement-breakpoint
CREATE TABLE IF NOT EXISTS "server_sync_logs" (
	"id" serial PRIMARY KEY NOT NULL,
	"server_id" varchar(255) NOT NULL,
	"status" varchar(50) NOT NULL,
	"sync_type" varchar(50) DEFAULT 'full' NOT NULL,
	"target" varchar(50) DEFAULT 'all' NOT NULL,
	"members_synced" integer DEFAULT 0 NOT NULL,
	"roles_synced" integer DEFAULT 0 NOT NULL,
	"message" text,
	"started_at" timestamp NOT NULL,
	"heartbeat_at" timestamp,
	"finished_at" timestamp
);
 --> statement-breakpoint
CREATE TABLE IF NOT EXISTS "servers" (
	"id" varchar(255) PRIMARY KEY NOT NULL,
	"name" varchar(255) NOT NULL,
	"icon" text,
	"is_main" boolean DEFAULT false NOT NULL,
	"type" varchar(50) DEFAULT 'other' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"sync_frequency_hours" integer DEFAULT 1 NOT NULL,
	"default_permission_policy" varchar(50) DEFAULT 'deny_all' NOT NULL,
	"disabled_reason" text,
	"synced_at" timestamp with time zone,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
 --> statement-breakpoint
CREATE TABLE IF NOT EXISTS "sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"member_id" varchar(255) NOT NULL,
	"project_id" uuid,
	"server_id" varchar(255),
	"token" text NOT NULL,
	"refresh_token_hash" varchar(255),
	"client_user_agent" text,
	"client_ip_address" varchar(45),
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "sessions_token_unique" UNIQUE("token"),
	CONSTRAINT "sessions_refresh_token_hash_unique" UNIQUE("refresh_token_hash")
);
 --> statement-breakpoint
CREATE TABLE IF NOT EXISTS "sso_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"member_id" varchar(255) NOT NULL,
	"token_hash" varchar(255) NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"last_used_at" timestamp with time zone,
	CONSTRAINT "sso_sessions_token_hash_unique" UNIQUE("token_hash")
);
 --> statement-breakpoint
CREATE TABLE IF NOT EXISTS "sync_change_details" (
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
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'audit_logs_actor_id_members_id_fk' AND conrelid = 'public.audit_logs'::regclass) THEN
    ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_actor_id_members_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."members"("id") ON DELETE set null ON UPDATE no action;
  END IF;
END $$; --> statement-breakpoint
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'auth_requests_client_id_projects_id_fk' AND conrelid = 'public.auth_requests'::regclass) THEN
    ALTER TABLE "auth_requests" ADD CONSTRAINT "auth_requests_client_id_projects_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;
  END IF;
END $$; --> statement-breakpoint
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'callback_codes_client_id_projects_id_fk' AND conrelid = 'public.callback_codes'::regclass) THEN
    ALTER TABLE "callback_codes" ADD CONSTRAINT "callback_codes_client_id_projects_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;
  END IF;
END $$; --> statement-breakpoint
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'callback_codes_member_id_members_id_fk' AND conrelid = 'public.callback_codes'::regclass) THEN
    ALTER TABLE "callback_codes" ADD CONSTRAINT "callback_codes_member_id_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."members"("id") ON DELETE no action ON UPDATE no action;
  END IF;
END $$; --> statement-breakpoint
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'oauth_states_project_id_projects_id_fk' AND conrelid = 'public.oauth_states'::regclass) THEN
    ALTER TABLE "oauth_states" ADD CONSTRAINT "oauth_states_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;
  END IF;
END $$; --> statement-breakpoint
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'project_roles_project_id_projects_id_fk' AND conrelid = 'public.project_roles'::regclass) THEN
    ALTER TABLE "project_roles" ADD CONSTRAINT "project_roles_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;
  END IF;
END $$; --> statement-breakpoint
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'project_roles_role_id_roles_id_fk' AND conrelid = 'public.project_roles'::regclass) THEN
    ALTER TABLE "project_roles" ADD CONSTRAINT "project_roles_role_id_roles_id_fk" FOREIGN KEY ("role_id") REFERENCES "public"."roles"("id") ON DELETE cascade ON UPDATE no action;
  END IF;
END $$; --> statement-breakpoint
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'project_scopes_project_id_projects_id_fk' AND conrelid = 'public.project_scopes'::regclass) THEN
    ALTER TABLE "project_scopes" ADD CONSTRAINT "project_scopes_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;
  END IF;
END $$; --> statement-breakpoint
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'project_server_access_audit_project_id_projects_id_fk' AND conrelid = 'public.project_server_access_audit'::regclass) THEN
    ALTER TABLE "project_server_access_audit" ADD CONSTRAINT "project_server_access_audit_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;
  END IF;
END $$; --> statement-breakpoint
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'project_server_access_audit_server_id_servers_id_fk' AND conrelid = 'public.project_server_access_audit'::regclass) THEN
    ALTER TABLE "project_server_access_audit" ADD CONSTRAINT "project_server_access_audit_server_id_servers_id_fk" FOREIGN KEY ("server_id") REFERENCES "public"."servers"("id") ON DELETE no action ON UPDATE no action;
  END IF;
END $$; --> statement-breakpoint
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'project_servers_project_id_projects_id_fk' AND conrelid = 'public.project_servers'::regclass) THEN
    ALTER TABLE "project_servers" ADD CONSTRAINT "project_servers_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;
  END IF;
END $$; --> statement-breakpoint
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'project_servers_server_id_servers_id_fk' AND conrelid = 'public.project_servers'::regclass) THEN
    ALTER TABLE "project_servers" ADD CONSTRAINT "project_servers_server_id_servers_id_fk" FOREIGN KEY ("server_id") REFERENCES "public"."servers"("id") ON DELETE no action ON UPDATE no action;
  END IF;
END $$; --> statement-breakpoint
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'role_inheritance_rule_targets_rule_id_role_inheritance_rules_id_fk' AND conrelid = 'public.role_inheritance_rule_targets'::regclass) THEN
    ALTER TABLE "role_inheritance_rule_targets" ADD CONSTRAINT "role_inheritance_rule_targets_rule_id_role_inheritance_rules_id_fk" FOREIGN KEY ("rule_id") REFERENCES "public"."role_inheritance_rules"("id") ON DELETE no action ON UPDATE no action;
  END IF;
END $$; --> statement-breakpoint
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'role_inheritance_rule_targets_target_server_id_servers_id_fk' AND conrelid = 'public.role_inheritance_rule_targets'::regclass) THEN
    ALTER TABLE "role_inheritance_rule_targets" ADD CONSTRAINT "role_inheritance_rule_targets_target_server_id_servers_id_fk" FOREIGN KEY ("target_server_id") REFERENCES "public"."servers"("id") ON DELETE no action ON UPDATE no action;
  END IF;
END $$; --> statement-breakpoint
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'role_inheritance_rules_source_role_id_roles_id_fk' AND conrelid = 'public.role_inheritance_rules'::regclass) THEN
    ALTER TABLE "role_inheritance_rules" ADD CONSTRAINT "role_inheritance_rules_source_role_id_roles_id_fk" FOREIGN KEY ("source_role_id") REFERENCES "public"."roles"("id") ON DELETE no action ON UPDATE no action;
  END IF;
END $$; --> statement-breakpoint
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'role_permissions_role_id_roles_id_fk' AND conrelid = 'public.role_permissions'::regclass) THEN
    ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_role_id_roles_id_fk" FOREIGN KEY ("role_id") REFERENCES "public"."roles"("id") ON DELETE no action ON UPDATE no action;
  END IF;
END $$; --> statement-breakpoint
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'role_permissions_permission_id_permissions_id_fk' AND conrelid = 'public.role_permissions'::regclass) THEN
    ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_permission_id_permissions_id_fk" FOREIGN KEY ("permission_id") REFERENCES "public"."permissions"("id") ON DELETE no action ON UPDATE no action;
  END IF;
END $$; --> statement-breakpoint
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'roles_server_id_servers_id_fk' AND conrelid = 'public.roles'::regclass) THEN
    ALTER TABLE "roles" ADD CONSTRAINT "roles_server_id_servers_id_fk" FOREIGN KEY ("server_id") REFERENCES "public"."servers"("id") ON DELETE no action ON UPDATE no action;
  END IF;
END $$; --> statement-breakpoint
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'server_member_roles_member_id_members_id_fk' AND conrelid = 'public.server_member_roles'::regclass) THEN
    ALTER TABLE "server_member_roles" ADD CONSTRAINT "server_member_roles_member_id_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."members"("id") ON DELETE no action ON UPDATE no action;
  END IF;
END $$; --> statement-breakpoint
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'server_member_roles_role_id_roles_id_fk' AND conrelid = 'public.server_member_roles'::regclass) THEN
    ALTER TABLE "server_member_roles" ADD CONSTRAINT "server_member_roles_role_id_roles_id_fk" FOREIGN KEY ("role_id") REFERENCES "public"."roles"("id") ON DELETE no action ON UPDATE no action;
  END IF;
END $$; --> statement-breakpoint
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'server_members_server_id_servers_id_fk' AND conrelid = 'public.server_members'::regclass) THEN
    ALTER TABLE "server_members" ADD CONSTRAINT "server_members_server_id_servers_id_fk" FOREIGN KEY ("server_id") REFERENCES "public"."servers"("id") ON DELETE no action ON UPDATE no action;
  END IF;
END $$; --> statement-breakpoint
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'server_members_member_id_members_id_fk' AND conrelid = 'public.server_members'::regclass) THEN
    ALTER TABLE "server_members" ADD CONSTRAINT "server_members_member_id_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."members"("id") ON DELETE no action ON UPDATE no action;
  END IF;
END $$; --> statement-breakpoint
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'server_sync_logs_server_id_servers_id_fk' AND conrelid = 'public.server_sync_logs'::regclass) THEN
    ALTER TABLE "server_sync_logs" ADD CONSTRAINT "server_sync_logs_server_id_servers_id_fk" FOREIGN KEY ("server_id") REFERENCES "public"."servers"("id") ON DELETE no action ON UPDATE no action;
  END IF;
END $$; --> statement-breakpoint
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'sessions_member_id_members_id_fk' AND conrelid = 'public.sessions'::regclass) THEN
    ALTER TABLE "sessions" ADD CONSTRAINT "sessions_member_id_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."members"("id") ON DELETE no action ON UPDATE no action;
  END IF;
END $$; --> statement-breakpoint
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'sessions_project_id_projects_id_fk' AND conrelid = 'public.sessions'::regclass) THEN
    ALTER TABLE "sessions" ADD CONSTRAINT "sessions_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;
  END IF;
END $$; --> statement-breakpoint
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'sso_sessions_member_id_members_id_fk' AND conrelid = 'public.sso_sessions'::regclass) THEN
    ALTER TABLE "sso_sessions" ADD CONSTRAINT "sso_sessions_member_id_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."members"("id") ON DELETE cascade ON UPDATE no action;
  END IF;
END $$; --> statement-breakpoint
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'sync_change_details_sync_log_id_server_sync_logs_id_fk' AND conrelid = 'public.sync_change_details'::regclass) THEN
    ALTER TABLE "sync_change_details" ADD CONSTRAINT "sync_change_details_sync_log_id_server_sync_logs_id_fk" FOREIGN KEY ("sync_log_id") REFERENCES "public"."server_sync_logs"("id") ON DELETE cascade ON UPDATE no action;
  END IF;
END $$; --> statement-breakpoint
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'sync_change_details_server_id_servers_id_fk' AND conrelid = 'public.sync_change_details'::regclass) THEN
    ALTER TABLE "sync_change_details" ADD CONSTRAINT "sync_change_details_server_id_servers_id_fk" FOREIGN KEY ("server_id") REFERENCES "public"."servers"("id") ON DELETE no action ON UPDATE no action;
  END IF;
END $$; --> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_audit_logs_actor_id" ON "audit_logs" USING btree ("actor_id"); --> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_audit_logs_action_type" ON "audit_logs" USING btree ("action_type"); --> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_audit_logs_created_at" ON "audit_logs" USING btree ("created_at"); --> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_audit_logs_entity" ON "audit_logs" USING btree ("entity_type","entity_id"); --> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_audit_logs_severity" ON "audit_logs" USING btree ("severity"); --> statement-breakpoint
CREATE INDEX IF NOT EXISTS "project_server_access_audit_project_id_idx" ON "project_server_access_audit" USING btree ("project_id"); --> statement-breakpoint
CREATE INDEX IF NOT EXISTS "project_server_access_audit_server_id_idx" ON "project_server_access_audit" USING btree ("server_id"); --> statement-breakpoint
CREATE INDEX IF NOT EXISTS "project_server_access_audit_changed_at_idx" ON "project_server_access_audit" USING btree ("changed_at"); --> statement-breakpoint
CREATE INDEX IF NOT EXISTS "project_servers_project_id_idx" ON "project_servers" USING btree ("project_id"); --> statement-breakpoint
CREATE INDEX IF NOT EXISTS "project_servers_server_id_idx" ON "project_servers" USING btree ("server_id"); --> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "role_inheritance_rules_source_role_id_uidx" ON "role_inheritance_rules" USING btree ("source_role_id"); --> statement-breakpoint
CREATE INDEX IF NOT EXISTS "role_inheritance_rules_enabled_scope_idx" ON "role_inheritance_rules" USING btree ("enabled","target_scope"); --> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_roles_server_id" ON "roles" USING btree ("server_id"); --> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_server_members_member_id" ON "server_members" USING btree ("member_id"); --> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_sessions_refresh_token" ON "sessions" USING btree ("refresh_token_hash") WHERE "sessions"."refresh_token_hash" IS NOT NULL; --> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_sso_sessions_member_id" ON "sso_sessions" USING btree ("member_id"); --> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_sso_sessions_token_hash" ON "sso_sessions" USING btree ("token_hash"); --> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_sso_sessions_expires_at" ON "sso_sessions" USING btree ("expires_at"); --> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_sync_change_details_sync_log_id" ON "sync_change_details" USING btree ("sync_log_id"); --> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_sync_change_details_server_id" ON "sync_change_details" USING btree ("server_id"); --> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_sync_change_details_entity_type" ON "sync_change_details" USING btree ("entity_type");

-- Seed the Discord permissions catalog (official bitfield values from Discord docs)
-- https://discord.com/developers/docs/topics/permissions
INSERT INTO "permissions" ("key", "description", "bitfield") VALUES
  ('CREATE_INSTANT_INVITE', 'Allows creation of instant invites', 1),
  ('KICK_MEMBERS', 'Allows kicking members', 2),
  ('BAN_MEMBERS', 'Allows banning members', 4),
  ('ADMINISTRATOR', 'Grants all permissions, bypasses channel permission overwrites', 8),
  ('MANAGE_CHANNELS', 'Allows management and editing of channels', 16),
  ('MANAGE_GUILD', 'Allows management and editing of the guild', 32),
  ('ADD_REACTIONS', 'Allows adding reactions to messages', 64),
  ('VIEW_AUDIT_LOG', 'Allows viewing of the audit log', 128),
  ('PRIORITY_SPEAKER', 'Allows using priority speaker in a voice channel', 256),
  ('STREAM', 'Allows the user to go live', 512),
  ('VIEW_CHANNEL', 'Allows viewing channels', 1024),
  ('SEND_MESSAGES', 'Allows sending messages in text channels', 2048),
  ('SEND_TTS_MESSAGES', 'Allows sending /tts messages', 4096),
  ('MANAGE_MESSAGES', 'Allows deletion and pinning of messages', 8192),
  ('EMBED_LINKS', 'Links sent will have embedded content', 16384),
  ('ATTACH_FILES', 'Allows uploading images and files', 32768),
  ('READ_MESSAGE_HISTORY', 'Allows reading message history', 65536),
  ('MENTION_EVERYONE', 'Allows using @everyone, @here, and all role mentions', 131072),
  ('USE_EXTERNAL_EMOJIS', 'Allows using custom emojis from other servers', 262144),
  ('VIEW_GUILD_INSIGHTS', 'Allows viewing guild insights', 524288),
  ('CONNECT', 'Allows connecting to voice channels', 1048576),
  ('SPEAK', 'Allows speaking in voice channels', 2097152),
  ('MUTE_MEMBERS', 'Allows muting members in voice channels', 4194304),
  ('DEAFEN_MEMBERS', 'Allows deafening members in voice channels', 8388608),
  ('MOVE_MEMBERS', 'Allows moving members between voice channels', 16777216),
  ('USE_VAD', 'Allows using voice-activity-detection in voice channels', 33554432),
  ('CHANGE_NICKNAME', 'Allows changing own nickname', 67108864),
  ('MANAGE_NICKNAMES', 'Allows changing other members nicknames', 134217728),
  ('MANAGE_ROLES', 'Allows management and editing of roles', 268435456),
  ('MANAGE_WEBHOOKS', 'Allows management and editing of webhooks', 536870912),
  ('MANAGE_GUILD_EXPRESSIONS', 'Allows management of emojis, stickers, and soundboard sounds', 1073741824),
  ('USE_APPLICATION_COMMANDS', 'Allows using slash commands', 2147483648),
  ('REQUEST_TO_SPEAK', 'Allows requesting to speak in stage channels', 4294967296),
  ('MANAGE_EVENTS', 'Allows management of scheduled events', 8589934592),
  ('MANAGE_THREADS', 'Allows deleting and archiving threads', 17179869184),
  ('CREATE_PUBLIC_THREADS', 'Allows creating public threads', 34359738368),
  ('CREATE_PRIVATE_THREADS', 'Allows creating private threads', 68719476736),
  ('USE_EXTERNAL_STICKERS', 'Allows using stickers from other servers', 137438953472),
  ('SEND_MESSAGES_IN_THREADS', 'Allows sending messages in threads', 274877906944),
  ('USE_EMBEDDED_ACTIVITIES', 'Allows using Activities in voice channels', 549755813888),
  ('MODERATE_MEMBERS', 'Allows timing out members', 1099511627776),
  ('VIEW_CREATOR_MONETIZATION_ANALYTICS', 'Allows viewing role subscription insights', 2199023255552),
  ('USE_SOUNDBOARD', 'Allows using the soundboard in voice channels', 4398046511104),
  ('CREATE_GUILD_EXPRESSIONS', 'Allows creating emojis, stickers, and soundboard sounds', 8796093022208),
  ('CREATE_EVENTS', 'Allows creating scheduled events', 17592186044416),
  ('USE_EXTERNAL_SOUNDS', 'Allows using external sounds in the soundboard', 35184372088832),
  ('SEND_VOICE_MESSAGES', 'Allows sending voice messages', 70368744177664),
  ('SEND_POLLS', 'Allows sending polls', 562949953421312),
  ('USE_EXTERNAL_APPS', 'Allows using external apps in a server', 1125899906842624)
ON CONFLICT ("key") DO NOTHING;
