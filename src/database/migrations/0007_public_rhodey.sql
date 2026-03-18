CREATE TABLE "login_tokens" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"token" varchar(128) NOT NULL,
	"project_id" uuid NOT NULL,
	"server_id" varchar(255) NOT NULL,
	"redirect_uri" text NOT NULL,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "login_tokens_token_unique" UNIQUE("token")
);
--> statement-breakpoint
ALTER TABLE "login_tokens" ADD CONSTRAINT "login_tokens_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;