DROP TABLE "member_global_permissions" CASCADE;--> statement-breakpoint
ALTER TABLE "roles" ADD COLUMN "is_global" boolean DEFAULT false NOT NULL;