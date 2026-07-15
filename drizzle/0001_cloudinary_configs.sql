CREATE TABLE "cloudinary_configs" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"cloud_name" text NOT NULL,
	"api_key" text NOT NULL,
	"api_secret_encrypted" text NOT NULL,
	"folder" text DEFAULT 'vault' NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "cloudinary_configs" ADD CONSTRAINT "cloudinary_configs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;