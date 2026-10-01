CREATE TABLE "member_departures" (
	"id" serial PRIMARY KEY NOT NULL,
	"member_id" varchar(255) NOT NULL,
	"server_id" varchar(255) NOT NULL,
	"left_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "member_departures" ADD CONSTRAINT "member_departures_member_id_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."members"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "member_departures" ADD CONSTRAINT "member_departures_server_id_servers_id_fk" FOREIGN KEY ("server_id") REFERENCES "public"."servers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_member_departures_member_id" ON "member_departures" USING btree ("member_id");--> statement-breakpoint
CREATE INDEX "idx_member_departures_server_id" ON "member_departures" USING btree ("server_id");--> statement-breakpoint
CREATE INDEX "idx_member_departures_left_at" ON "member_departures" USING btree ("left_at");