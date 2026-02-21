CREATE INDEX "member_global_permissions_permission_id_idx" ON "member_global_permissions" USING btree ("permission_id");--> statement-breakpoint
CREATE UNIQUE INDEX "role_inheritance_rules_source_role_id_uidx" ON "role_inheritance_rules" USING btree ("source_role_id");--> statement-breakpoint
CREATE INDEX "role_inheritance_rules_enabled_scope_idx" ON "role_inheritance_rules" USING btree ("enabled","target_scope");--> statement-breakpoint
CREATE INDEX "role_permissions_permission_id_idx" ON "role_permissions" USING btree ("permission_id");--> statement-breakpoint
CREATE INDEX "roles_server_id_idx" ON "roles" USING btree ("server_id");--> statement-breakpoint
CREATE INDEX "server_member_roles_role_id_idx" ON "server_member_roles" USING btree ("role_id");--> statement-breakpoint
CREATE INDEX "server_members_member_id_idx" ON "server_members" USING btree ("member_id");