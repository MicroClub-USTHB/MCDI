CREATE TABLE "members" (
	"id" varchar(255) PRIMARY KEY NOT NULL,
	"username" varchar(255) NOT NULL,
	"global_name" varchar(255),
	"display_name" varchar(255),
	"avatar" text,
	"email" varchar(255),
	"is_club_member" boolean DEFAULT false NOT NULL,
	"joined_at" timestamp,
	"synced_at" timestamp with time zone,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "permissions" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(255) NOT NULL,
	"description" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "permissions_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "project_servers" (
	"project_id" uuid NOT NULL,
	"server_id" varchar(255) NOT NULL,
	"operations" jsonb DEFAULT '{"read":true}'::jsonb NOT NULL,
	CONSTRAINT "project_servers_project_id_server_id_pk" PRIMARY KEY("project_id","server_id")
);
--> statement-breakpoint
CREATE TABLE "projects" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(255) NOT NULL,
	"description" text,
	"api_key" varchar(255) NOT NULL,
	"api_key_created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"webhook_url" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "projects_name_unique" UNIQUE("name"),
	CONSTRAINT "projects_api_key_unique" UNIQUE("api_key")
);
--> statement-breakpoint
CREATE TABLE "role_permissions" (
	"role_id" varchar(255) NOT NULL,
	"permission_id" integer NOT NULL,
	CONSTRAINT "role_permissions_role_id_permission_id_pk" PRIMARY KEY("role_id","permission_id")
);
--> statement-breakpoint
CREATE TABLE "roles" (
	"id" varchar(255) PRIMARY KEY NOT NULL,
	"server_id" varchar(255) NOT NULL,
	"name" varchar(255) NOT NULL,
	"color" integer,
	"hoist" boolean DEFAULT false,
	"position" integer DEFAULT 0,
	"managed" boolean DEFAULT false,
	"mentionable" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "server_member_roles" (
	"member_id" varchar(255) NOT NULL,
	"role_id" varchar(255) NOT NULL,
	CONSTRAINT "server_member_roles_member_id_role_id_pk" PRIMARY KEY("member_id","role_id")
);
--> statement-breakpoint
CREATE TABLE "server_members" (
	"server_id" varchar(255) NOT NULL,
	"member_id" varchar(255) NOT NULL,
	"joined_at" timestamp,
	CONSTRAINT "server_members_server_id_member_id_pk" PRIMARY KEY("server_id","member_id")
);
--> statement-breakpoint
CREATE TABLE "server_sync_logs" (
	"id" serial PRIMARY KEY NOT NULL,
	"server_id" varchar(255) NOT NULL,
	"status" varchar(50) NOT NULL,
	"sync_type" varchar(50) DEFAULT 'full' NOT NULL,
	"members_synced" integer DEFAULT 0 NOT NULL,
	"roles_synced" integer DEFAULT 0 NOT NULL,
	"message" text,
	"started_at" timestamp NOT NULL,
	"finished_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "servers" (
	"id" varchar(255) PRIMARY KEY NOT NULL,
	"name" varchar(255) NOT NULL,
	"icon" text,
	"is_main" boolean DEFAULT false NOT NULL,
	"type" varchar(50) DEFAULT 'other' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"sync_frequency_minutes" integer DEFAULT 60 NOT NULL,
	"default_permission_policy" varchar(50) DEFAULT 'deny_all' NOT NULL,
	"disabled_reason" text,
	"synced_at" timestamp with time zone,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"member_id" varchar(255) NOT NULL,
	"token" text NOT NULL,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "project_servers" ADD CONSTRAINT "project_servers_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_servers" ADD CONSTRAINT "project_servers_server_id_servers_id_fk" FOREIGN KEY ("server_id") REFERENCES "public"."servers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_role_id_roles_id_fk" FOREIGN KEY ("role_id") REFERENCES "public"."roles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_permission_id_permissions_id_fk" FOREIGN KEY ("permission_id") REFERENCES "public"."permissions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "roles" ADD CONSTRAINT "roles_server_id_servers_id_fk" FOREIGN KEY ("server_id") REFERENCES "public"."servers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "server_member_roles" ADD CONSTRAINT "server_member_roles_member_id_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."members"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "server_member_roles" ADD CONSTRAINT "server_member_roles_role_id_roles_id_fk" FOREIGN KEY ("role_id") REFERENCES "public"."roles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "server_members" ADD CONSTRAINT "server_members_server_id_servers_id_fk" FOREIGN KEY ("server_id") REFERENCES "public"."servers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "server_members" ADD CONSTRAINT "server_members_member_id_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."members"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "server_sync_logs" ADD CONSTRAINT "server_sync_logs_server_id_servers_id_fk" FOREIGN KEY ("server_id") REFERENCES "public"."servers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_member_id_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."members"("id") ON DELETE no action ON UPDATE no action;

ALTER TABLE "servers" ADD COLUMN IF NOT EXISTS "sync_frequency_minutes" integer NOT NULL DEFAULT 60,
ADD COLUMN IF NOT EXISTS "default_permission_policy" varchar(50) NOT NULL DEFAULT 'deny_all',
ADD COLUMN IF NOT EXISTS "disabled_reason" text;

CREATE UNIQUE INDEX IF NOT EXISTS "servers_one_main"
  ON "servers" ("is_main")
  WHERE "is_main" = true;
