CREATE TABLE IF NOT EXISTS "admin_cli_codes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code_hash" varchar(64) NOT NULL,
	"member_id" varchar(255) NOT NULL,
	"code_challenge" varchar(128) NOT NULL,
	"expires_at" timestamp NOT NULL,
	"used" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "admin_cli_codes_code_hash_unique" UNIQUE("code_hash")
);
--> statement-breakpoint
ALTER TABLE "admin_oauth_states" ADD COLUMN IF NOT EXISTS "redirect_uri" text;--> statement-breakpoint
ALTER TABLE "admin_oauth_states" ADD COLUMN IF NOT EXISTS "code_challenge" varchar(128);--> statement-breakpoint
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'admin_cli_codes_member_id_members_id_fk' AND conrelid = 'public.admin_cli_codes'::regclass) THEN
    ALTER TABLE "admin_cli_codes" ADD CONSTRAINT "admin_cli_codes_member_id_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."members"("id") ON DELETE cascade ON UPDATE no action;
  END IF;
END $$;
