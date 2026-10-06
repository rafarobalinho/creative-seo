CREATE TABLE "workspace_llm_key" (
	"organization_id" text PRIMARY KEY NOT NULL,
	"provider" text NOT NULL,
	"encrypted_key" text NOT NULL,
	"key_suffix" text NOT NULL,
	"model" text,
	"updated_by_user_id" text NOT NULL,
	"created_at" text DEFAULT to_char(now() AT TIME ZONE 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') NOT NULL,
	"updated_at" text DEFAULT to_char(now() AT TIME ZONE 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') NOT NULL
);
--> statement-breakpoint
ALTER TABLE "workspace_llm_key" ADD CONSTRAINT "workspace_llm_key_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;