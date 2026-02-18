CREATE TABLE "member_global_permissions" (
	"member_id" varchar(255) NOT NULL,
	"permission_id" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "member_global_permissions_member_id_permission_id_pk" PRIMARY KEY("member_id","permission_id")
);
--> statement-breakpoint
CREATE TABLE "role_inheritance_rule_targets" (
	"rule_id" integer NOT NULL,
	"target_server_id" varchar(255) NOT NULL,
	CONSTRAINT "role_inheritance_rule_targets_rule_id_target_server_id_pk" PRIMARY KEY("rule_id","target_server_id")
);
--> statement-breakpoint
CREATE TABLE "role_inheritance_rules" (
	"id" serial PRIMARY KEY NOT NULL,
	"source_role_id" varchar(255) NOT NULL,
	"target_scope" varchar(20) DEFAULT 'all' NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "member_global_permissions" ADD CONSTRAINT "member_global_permissions_member_id_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."members"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "member_global_permissions" ADD CONSTRAINT "member_global_permissions_permission_id_permissions_id_fk" FOREIGN KEY ("permission_id") REFERENCES "public"."permissions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "role_inheritance_rule_targets" ADD CONSTRAINT "role_inheritance_rule_targets_rule_id_role_inheritance_rules_id_fk" FOREIGN KEY ("rule_id") REFERENCES "public"."role_inheritance_rules"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "role_inheritance_rule_targets" ADD CONSTRAINT "role_inheritance_rule_targets_target_server_id_servers_id_fk" FOREIGN KEY ("target_server_id") REFERENCES "public"."servers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "role_inheritance_rules" ADD CONSTRAINT "role_inheritance_rules_source_role_id_roles_id_fk" FOREIGN KEY ("source_role_id") REFERENCES "public"."roles"("id") ON DELETE no action ON UPDATE no action;