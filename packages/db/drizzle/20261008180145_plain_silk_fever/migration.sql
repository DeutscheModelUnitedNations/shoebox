CREATE TYPE "event_visibility" AS ENUM('PUBLIC', 'HIDDEN');--> statement-breakpoint
ALTER TYPE "media_status" ADD VALUE 'UPLOADING' BEFORE 'PENDING';--> statement-breakpoint
ALTER TYPE "media_status" ADD VALUE 'HELD' BEFORE 'FAILED';--> statement-breakpoint
ALTER TYPE "processing_job_type" ADD VALUE 'ZIP_IMPORT';--> statement-breakpoint
CREATE TABLE "duplicate_candidate" (
	"id" text PRIMARY KEY,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"event_id" text NOT NULL,
	"media_id" text NOT NULL,
	"other_media_id" text NOT NULL,
	"similarity" integer NOT NULL,
	CONSTRAINT "duplicate_pair" UNIQUE("media_id","other_media_id")
);
--> statement-breakpoint
CREATE TABLE "event_photographer" (
	"event_id" text,
	"email" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "event_photographer_pkey" PRIMARY KEY("event_id","email")
);
--> statement-breakpoint
CREATE TABLE "photographer" (
	"email" text PRIMARY KEY,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"invited_by_id" text
);
--> statement-breakpoint
CREATE TABLE "setting" (
	"key" text PRIMARY KEY,
	"value" jsonb NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"updated_by_id" text
);
--> statement-breakpoint
ALTER TABLE "category" ADD COLUMN "hidden" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "event" ADD COLUMN "visibility" "event_visibility" DEFAULT 'PUBLIC'::"event_visibility" NOT NULL;--> statement-breakpoint
ALTER TABLE "media" ADD COLUMN "sha256" text;--> statement-breakpoint
ALTER TABLE "media" ADD COLUMN "phash" text;--> statement-breakpoint
ALTER TABLE "media" ADD COLUMN "uploaded_by_id" text;--> statement-breakpoint
ALTER TABLE "media" ADD COLUMN "upload_batch" text;--> statement-breakpoint
ALTER TABLE "media" ADD COLUMN "deleted_at" timestamp;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "last_seen_at" timestamp;--> statement-breakpoint
CREATE INDEX "duplicate_event_idx" ON "duplicate_candidate" ("event_id");--> statement-breakpoint
ALTER TABLE "duplicate_candidate" ADD CONSTRAINT "duplicate_candidate_event_id_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "event"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "duplicate_candidate" ADD CONSTRAINT "duplicate_candidate_media_id_media_id_fkey" FOREIGN KEY ("media_id") REFERENCES "media"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "duplicate_candidate" ADD CONSTRAINT "duplicate_candidate_other_media_id_media_id_fkey" FOREIGN KEY ("other_media_id") REFERENCES "media"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "event_photographer" ADD CONSTRAINT "event_photographer_event_id_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "event"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "event_photographer" ADD CONSTRAINT "event_photographer_email_photographer_email_fkey" FOREIGN KEY ("email") REFERENCES "photographer"("email") ON DELETE CASCADE ON UPDATE CASCADE;--> statement-breakpoint
ALTER TABLE "media" ADD CONSTRAINT "media_uploaded_by_id_user_id_fkey" FOREIGN KEY ("uploaded_by_id") REFERENCES "user"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "photographer" ADD CONSTRAINT "photographer_invited_by_id_user_id_fkey" FOREIGN KEY ("invited_by_id") REFERENCES "user"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "setting" ADD CONSTRAINT "setting_updated_by_id_user_id_fkey" FOREIGN KEY ("updated_by_id") REFERENCES "user"("id") ON DELETE SET NULL;