CREATE TYPE "public"."notification_type" AS ENUM('password_reset', 'vacation_request', 'vacation_decision', 'vacation_expiring', 'vacation_receipt', 'vacation_payment', 'form_new', 'form_reminder');--> statement-breakpoint
ALTER TYPE "public"."decision" ADD VALUE 'cancelled';--> statement-breakpoint
CREATE TABLE "notification_settings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"type" "notification_type" NOT NULL,
	"channel" "channel" NOT NULL,
	"enabled" boolean DEFAULT false NOT NULL,
	"updated_by" uuid,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "vacation_requests" ADD COLUMN "abono_pecuniario" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "vacation_requests" ADD COLUMN "abono_days" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "vacation_requests" ADD COLUMN "advance_13th" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "vacation_requests" ADD COLUMN "payment_due_date" date;--> statement-breakpoint
ALTER TABLE "vacation_requests" ADD COLUMN "paid_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "vacation_requests" ADD COLUMN "paid_by" uuid;--> statement-breakpoint
ALTER TABLE "vacation_requests" ADD COLUMN "receipt_signed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "vacation_requests" ADD COLUMN "receipt_registered_by" uuid;--> statement-breakpoint
ALTER TABLE "vacation_requests" ADD COLUMN "reported_to_senior_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "vacation_requests" ADD COLUMN "cancelled_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "vacation_requests" ADD COLUMN "cancelled_by" uuid;--> statement-breakpoint
ALTER TABLE "vacation_requests" ADD COLUMN "cancel_reason" text;--> statement-breakpoint
ALTER TABLE "notification_settings" ADD CONSTRAINT "notification_settings_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "notification_settings_unique" ON "notification_settings" USING btree ("type","channel");