CREATE TABLE "admin_oauth_states" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"state" varchar(500) NOT NULL,
	"used" varchar(10) DEFAULT 'false' NOT NULL,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "admin_oauth_states_state_unique" UNIQUE("state")
);
