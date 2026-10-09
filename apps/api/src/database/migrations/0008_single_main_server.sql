DO $$
DECLARE
  main_servers text;
BEGIN
  SELECT string_agg(format('%s (%s)', "id", "name"), ', ' ORDER BY "id")
    INTO main_servers
    FROM "servers"
    WHERE "is_main";
  IF (SELECT count(*) FROM "servers" WHERE "is_main") > 1 THEN
    RAISE EXCEPTION 'Cannot enforce a single main server: more than one server has is_main = true: %. Set is_main = false on all but one of them and run the migration again.', main_servers;
  END IF;
END $$;--> statement-breakpoint
CREATE UNIQUE INDEX "servers_single_main_idx" ON "servers" USING btree ("is_main") WHERE "servers"."is_main";
