CREATE TYPE "public"."ai_recommendation" AS ENUM('approve', 'reject', 'review');--> statement-breakpoint
CREATE TYPE "public"."audience_type" AS ENUM('all', 'sector', 'role', 'user');--> statement-breakpoint
CREATE TYPE "public"."channel" AS ENUM('discord', 'whatsapp', 'email');--> statement-breakpoint
CREATE TYPE "public"."decision" AS ENUM('pending', 'approved', 'rejected');--> statement-breakpoint
CREATE TYPE "public"."delivery_status" AS ENUM('pending', 'sent', 'failed', 'skipped');--> statement-breakpoint
CREATE TYPE "public"."employment_status" AS ENUM('ativo', 'afastado', 'ferias', 'desligado');--> statement-breakpoint
CREATE TYPE "public"."employment_type" AS ENUM('clt', 'pj', 'estagio', 'aprendiz', 'socio');--> statement-breakpoint
CREATE TYPE "public"."role" AS ENUM('user', 'gestor', 'admin');--> statement-breakpoint
CREATE TABLE "broadcast_deliveries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"broadcast_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"channel" "channel" NOT NULL,
	"status" "delivery_status" DEFAULT 'pending' NOT NULL,
	"error_message" text,
	"sent_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "broadcasts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" text NOT NULL,
	"body" text NOT NULL,
	"audience_type" "audience_type" DEFAULT 'all' NOT NULL,
	"audience_value" text,
	"channels" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "form_responses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"form_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"answers" jsonb NOT NULL,
	"responded_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "forms" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"questions" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"audience_type" "audience_type" DEFAULT 'all' NOT NULL,
	"audience_value" text,
	"reminder_after_hours" integer DEFAULT 48 NOT NULL,
	"last_reminder_at" timestamp with time zone,
	"closed_at" timestamp with time zone,
	"created_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"title" text NOT NULL,
	"body" text NOT NULL,
	"link" text,
	"read_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "password_reset_codes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"code_hash" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"consumed_at" timestamp with time zone,
	"attempts" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"password_hash" text,
	"role" "role" DEFAULT 'user' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"sector" text,
	"position" text,
	"manager_id" uuid,
	"admission_date" date,
	"employment_type" "employment_type",
	"employment_status" "employment_status" DEFAULT 'ativo' NOT NULL,
	"phone" text,
	"discord_handle" text,
	"personal_email" text,
	"zip_code" text,
	"address_street" text,
	"address_number" text,
	"address_complement" text,
	"neighborhood" text,
	"city" text,
	"state" text,
	"is_curitiba_metro" boolean DEFAULT false NOT NULL,
	"birth_date" date,
	"gender" text,
	"rg" text,
	"cpf" text,
	"father_name" text,
	"mother_name" text,
	"birthplace" text,
	"education_level" text,
	"course_name" text,
	"institution" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "vacation_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"start_date" date NOT NULL,
	"end_date" date NOT NULL,
	"days" integer NOT NULL,
	"notes" text,
	"status" "decision" DEFAULT 'pending' NOT NULL,
	"rh_approval" "decision" DEFAULT 'pending' NOT NULL,
	"rh_approved_by" uuid,
	"rh_approved_at" timestamp with time zone,
	"rh_note" text,
	"manager_approval" "decision" DEFAULT 'pending' NOT NULL,
	"manager_approved_by" uuid,
	"manager_approved_at" timestamp with time zone,
	"manager_note" text,
	"ai_recommendation" "ai_recommendation",
	"ai_reasoning" text,
	"ai_conflicts" jsonb DEFAULT '[]'::jsonb,
	"ai_warnings" jsonb DEFAULT '[]'::jsonb,
	"ai_facts" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "broadcast_deliveries" ADD CONSTRAINT "broadcast_deliveries_broadcast_id_broadcasts_id_fk" FOREIGN KEY ("broadcast_id") REFERENCES "public"."broadcasts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "broadcast_deliveries" ADD CONSTRAINT "broadcast_deliveries_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "broadcasts" ADD CONSTRAINT "broadcasts_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "form_responses" ADD CONSTRAINT "form_responses_form_id_forms_id_fk" FOREIGN KEY ("form_id") REFERENCES "public"."forms"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "form_responses" ADD CONSTRAINT "form_responses_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "forms" ADD CONSTRAINT "forms_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "password_reset_codes" ADD CONSTRAINT "password_reset_codes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vacation_requests" ADD CONSTRAINT "vacation_requests_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "broadcast_deliveries_broadcast_idx" ON "broadcast_deliveries" USING btree ("broadcast_id");--> statement-breakpoint
CREATE UNIQUE INDEX "form_responses_unique" ON "form_responses" USING btree ("form_id","user_id");--> statement-breakpoint
CREATE INDEX "notifications_user_idx" ON "notifications" USING btree ("user_id","read_at");--> statement-breakpoint
CREATE INDEX "password_reset_user_idx" ON "password_reset_codes" USING btree ("user_id","expires_at");--> statement-breakpoint
CREATE UNIQUE INDEX "users_email_unique" ON "users" USING btree ("email");--> statement-breakpoint
CREATE INDEX "users_manager_idx" ON "users" USING btree ("manager_id");--> statement-breakpoint
CREATE INDEX "users_sector_idx" ON "users" USING btree ("sector");--> statement-breakpoint
CREATE INDEX "vacation_user_idx" ON "vacation_requests" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "vacation_status_idx" ON "vacation_requests" USING btree ("status");--> statement-breakpoint
CREATE INDEX "vacation_range_idx" ON "vacation_requests" USING btree ("start_date","end_date");