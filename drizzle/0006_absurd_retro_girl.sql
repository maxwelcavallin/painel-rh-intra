CREATE TABLE "institutional_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" text NOT NULL,
	"start_date" date NOT NULL,
	"end_date" date NOT NULL,
	"sector" text,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "institutional_events" ADD CONSTRAINT "institutional_events_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "institutional_events_periodo_idx" ON "institutional_events" USING btree ("start_date","end_date");