ALTER TABLE "login_tokens" ADD COLUMN "state" text;
--> statement-breakpoint
CREATE TABLE "auth_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"request_id" varchar(128) NOT NULL,
	"client_id" uuid NOT NULL,
	"redirect_uri" text NOT NULL,
	"state" text,
	"server_id" varchar(255) NOT NULL,
	"used" boolean DEFAULT false NOT NULL,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "auth_requests_request_id_unique" UNIQUE("request_id")
);
--> statement-breakpoint
ALTER TABLE "auth_requests" ADD CONSTRAINT "auth_requests_client_id_projects_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "auth_requests" ADD CONSTRAINT "auth_requests_server_id_servers_id_fk" FOREIGN KEY ("server_id") REFERENCES "public"."servers"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
CREATE TABLE "callback_codes" (
	"code_hash" varchar(64) PRIMARY KEY NOT NULL,
	"client_id" uuid NOT NULL,
	"redirect_uri" text NOT NULL,
	"member_id" varchar(255) NOT NULL,
	"server_id" varchar(255) NOT NULL,
	"expires_at" timestamp NOT NULL,
	"used" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "callback_codes" ADD CONSTRAINT "callback_codes_client_id_projects_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "callback_codes" ADD CONSTRAINT "callback_codes_member_id_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."members"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "callback_codes" ADD CONSTRAINT "callback_codes_server_id_servers_id_fk" FOREIGN KEY ("server_id") REFERENCES "public"."servers"("id") ON DELETE no action ON UPDATE no action;