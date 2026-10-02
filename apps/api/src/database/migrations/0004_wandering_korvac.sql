CREATE TABLE IF NOT EXISTS "inbound_webhook_drafts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"webhook_id" uuid NOT NULL,
	"project_id" uuid NOT NULL,
	"data" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"completed_steps" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"status" varchar(16) DEFAULT 'open' NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "inbound_webhook_files" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"webhook_id" uuid NOT NULL,
	"draft_id" uuid,
	"submission_id" uuid,
	"storage_key" text NOT NULL,
	"sha256" varchar(64) NOT NULL,
	"size_bytes" bigint NOT NULL,
	"mime" varchar(255) NOT NULL,
	"original_name" varchar(512),
	"status" varchar(16) DEFAULT 'pending' NOT NULL,
	"expires_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "inbound_webhook_roles" (
	"webhook_id" uuid NOT NULL,
	"role_id" varchar(255) NOT NULL,
	"granted_at" timestamp with time zone DEFAULT now() NOT NULL,
	"granted_by" varchar(255),
	CONSTRAINT "inbound_webhook_roles_webhook_id_role_id_pk" PRIMARY KEY("webhook_id","role_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "inbound_webhook_submissions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"webhook_id" uuid NOT NULL,
	"project_id" uuid NOT NULL,
	"draft_id" uuid,
	"payload" jsonb NOT NULL,
	"ip_address" varchar(45),
	"origin" text,
	"user_agent" text,
	"received_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "inbound_webhooks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"name" varchar(255) NOT NULL,
	"slug" varchar(64) NOT NULL,
	"schema" jsonb NOT NULL,
	"accepted_origins" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"signing_secret_enc" text NOT NULL,
	"require_signature" boolean DEFAULT true NOT NULL,
	"reject_unknown_fields" boolean DEFAULT true NOT NULL,
	"allow_role_inheritance" boolean DEFAULT false NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"submission_count" integer DEFAULT 0 NOT NULL,
	"last_submission_at" timestamp with time zone,
	"created_by" varchar(255),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'inbound_webhook_drafts_webhook_id_inbound_webhooks_id_fk' AND conrelid = 'public.inbound_webhook_drafts'::regclass) THEN
    ALTER TABLE "inbound_webhook_drafts" ADD CONSTRAINT "inbound_webhook_drafts_webhook_id_inbound_webhooks_id_fk" FOREIGN KEY ("webhook_id") REFERENCES "public"."inbound_webhooks"("id") ON DELETE cascade ON UPDATE no action;
  END IF;
END $$;--> statement-breakpoint
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'inbound_webhook_drafts_project_id_projects_id_fk' AND conrelid = 'public.inbound_webhook_drafts'::regclass) THEN
    ALTER TABLE "inbound_webhook_drafts" ADD CONSTRAINT "inbound_webhook_drafts_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;
  END IF;
END $$;--> statement-breakpoint
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'inbound_webhook_files_webhook_id_inbound_webhooks_id_fk' AND conrelid = 'public.inbound_webhook_files'::regclass) THEN
    ALTER TABLE "inbound_webhook_files" ADD CONSTRAINT "inbound_webhook_files_webhook_id_inbound_webhooks_id_fk" FOREIGN KEY ("webhook_id") REFERENCES "public"."inbound_webhooks"("id") ON DELETE cascade ON UPDATE no action;
  END IF;
END $$;--> statement-breakpoint
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'inbound_webhook_files_draft_id_inbound_webhook_drafts_id_fk' AND conrelid = 'public.inbound_webhook_files'::regclass) THEN
    ALTER TABLE "inbound_webhook_files" ADD CONSTRAINT "inbound_webhook_files_draft_id_inbound_webhook_drafts_id_fk" FOREIGN KEY ("draft_id") REFERENCES "public"."inbound_webhook_drafts"("id") ON DELETE set null ON UPDATE no action;
  END IF;
END $$;--> statement-breakpoint
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'inbound_webhook_files_submission_id_inbound_webhook_submissions_id_fk' AND conrelid = 'public.inbound_webhook_files'::regclass) THEN
    ALTER TABLE "inbound_webhook_files" ADD CONSTRAINT "inbound_webhook_files_submission_id_inbound_webhook_submissions_id_fk" FOREIGN KEY ("submission_id") REFERENCES "public"."inbound_webhook_submissions"("id") ON DELETE cascade ON UPDATE no action;
  END IF;
END $$;--> statement-breakpoint
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'inbound_webhook_roles_webhook_id_inbound_webhooks_id_fk' AND conrelid = 'public.inbound_webhook_roles'::regclass) THEN
    ALTER TABLE "inbound_webhook_roles" ADD CONSTRAINT "inbound_webhook_roles_webhook_id_inbound_webhooks_id_fk" FOREIGN KEY ("webhook_id") REFERENCES "public"."inbound_webhooks"("id") ON DELETE cascade ON UPDATE no action;
  END IF;
END $$;--> statement-breakpoint
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'inbound_webhook_roles_role_id_roles_id_fk' AND conrelid = 'public.inbound_webhook_roles'::regclass) THEN
    ALTER TABLE "inbound_webhook_roles" ADD CONSTRAINT "inbound_webhook_roles_role_id_roles_id_fk" FOREIGN KEY ("role_id") REFERENCES "public"."roles"("id") ON DELETE cascade ON UPDATE no action;
  END IF;
END $$;--> statement-breakpoint
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'inbound_webhook_submissions_webhook_id_inbound_webhooks_id_fk' AND conrelid = 'public.inbound_webhook_submissions'::regclass) THEN
    ALTER TABLE "inbound_webhook_submissions" ADD CONSTRAINT "inbound_webhook_submissions_webhook_id_inbound_webhooks_id_fk" FOREIGN KEY ("webhook_id") REFERENCES "public"."inbound_webhooks"("id") ON DELETE cascade ON UPDATE no action;
  END IF;
END $$;--> statement-breakpoint
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'inbound_webhook_submissions_project_id_projects_id_fk' AND conrelid = 'public.inbound_webhook_submissions'::regclass) THEN
    ALTER TABLE "inbound_webhook_submissions" ADD CONSTRAINT "inbound_webhook_submissions_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;
  END IF;
END $$;--> statement-breakpoint
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'inbound_webhook_submissions_draft_id_inbound_webhook_drafts_id_fk' AND conrelid = 'public.inbound_webhook_submissions'::regclass) THEN
    ALTER TABLE "inbound_webhook_submissions" ADD CONSTRAINT "inbound_webhook_submissions_draft_id_inbound_webhook_drafts_id_fk" FOREIGN KEY ("draft_id") REFERENCES "public"."inbound_webhook_drafts"("id") ON DELETE set null ON UPDATE no action;
  END IF;
END $$;--> statement-breakpoint
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'inbound_webhooks_project_id_projects_id_fk' AND conrelid = 'public.inbound_webhooks'::regclass) THEN
    ALTER TABLE "inbound_webhooks" ADD CONSTRAINT "inbound_webhooks_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;
  END IF;
END $$;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_inbound_webhook_drafts_webhook" ON "inbound_webhook_drafts" USING btree ("webhook_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_inbound_webhook_drafts_expiry" ON "inbound_webhook_drafts" USING btree ("status","expires_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_inbound_webhook_files_webhook" ON "inbound_webhook_files" USING btree ("webhook_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_inbound_webhook_files_submission" ON "inbound_webhook_files" USING btree ("submission_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_inbound_webhook_files_sweep" ON "inbound_webhook_files" USING btree ("status","expires_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_inbound_webhook_roles_role" ON "inbound_webhook_roles" USING btree ("role_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_inbound_webhook_submissions_webhook" ON "inbound_webhook_submissions" USING btree ("webhook_id","received_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_inbound_webhook_submissions_project" ON "inbound_webhook_submissions" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_inbound_webhooks_project" ON "inbound_webhooks" USING btree ("project_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "uq_inbound_webhooks_project_slug" ON "inbound_webhooks" USING btree ("project_id","slug");
