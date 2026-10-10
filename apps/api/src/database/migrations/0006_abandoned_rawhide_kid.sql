ALTER TYPE "public"."audit_action_type" ADD VALUE IF NOT EXISTS 'access';--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "admin_role_access" (
	"role_id" varchar(255) NOT NULL,
	"resource" varchar(32) NOT NULL,
	"level" varchar(16) NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_by" varchar(255),
	CONSTRAINT "admin_role_access_role_id_resource_pk" PRIMARY KEY("role_id","resource"),
	CONSTRAINT "admin_role_access_level_check" CHECK ("admin_role_access"."level" in ('read', 'write', 'manage'))
);--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "admin_member_access" (
	"member_id" varchar(255) NOT NULL,
	"resource" varchar(32) NOT NULL,
	"level" varchar(16) NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_by" varchar(255),
	CONSTRAINT "admin_member_access_member_id_resource_pk" PRIMARY KEY("member_id","resource"),
	CONSTRAINT "admin_member_access_level_check" CHECK ("admin_member_access"."level" in ('none', 'read', 'write', 'manage'))
);--> statement-breakpoint
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'admin_role_access_role_id_roles_id_fk' AND conrelid = 'public.admin_role_access'::regclass) THEN
    ALTER TABLE "admin_role_access" ADD CONSTRAINT "admin_role_access_role_id_roles_id_fk" FOREIGN KEY ("role_id") REFERENCES "public"."roles"("id") ON DELETE cascade ON UPDATE no action;
  END IF;
END $$;--> statement-breakpoint
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'admin_member_access_member_id_members_id_fk' AND conrelid = 'public.admin_member_access'::regclass) THEN
    ALTER TABLE "admin_member_access" ADD CONSTRAINT "admin_member_access_member_id_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."members"("id") ON DELETE cascade ON UPDATE no action;
  END IF;
END $$;
