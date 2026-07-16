CREATE TABLE "library_shares" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" uuid NOT NULL,
	"invitee_email" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DROP TABLE "invites" CASCADE;--> statement-breakpoint
ALTER TABLE "library_shares" ADD CONSTRAINT "library_shares_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "library_shares_owner_idx" ON "library_shares" USING btree ("owner_id");--> statement-breakpoint
CREATE INDEX "library_shares_email_idx" ON "library_shares" USING btree ("invitee_email");--> statement-breakpoint
CREATE UNIQUE INDEX "library_shares_owner_email_uq" ON "library_shares" USING btree ("owner_id","invitee_email");