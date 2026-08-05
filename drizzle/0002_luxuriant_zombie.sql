ALTER TYPE "public"."audience_type" ADD VALUE 'location';--> statement-breakpoint
ALTER TABLE "broadcast_deliveries" ALTER COLUMN "user_id" DROP NOT NULL;