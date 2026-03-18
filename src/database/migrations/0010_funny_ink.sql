CREATE TABLE "auth_requests" (
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
CREATE TABLE "callback_codes" (
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
ALTER TABLE "authorization_codes" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "login_tokens" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP TABLE "authorization_codes" CASCADE;--> statement-breakpoint
DROP TABLE "login_tokens" CASCADE;--> statement-breakpoint
ALTER TABLE "oauth_states" ADD COLUMN "client_state" text;--> statement-breakpoint
ALTER TABLE "project_servers" ADD COLUMN "scopes" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "auth_requests" ADD CONSTRAINT "auth_requests_client_id_projects_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "callback_codes" ADD CONSTRAINT "callback_codes_client_id_projects_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "callback_codes" ADD CONSTRAINT "callback_codes_member_id_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."members"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_token_unique" UNIQUE("token");