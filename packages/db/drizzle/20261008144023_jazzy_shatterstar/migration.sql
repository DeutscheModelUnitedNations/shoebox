CREATE TYPE "processing_job_status" AS ENUM('PENDING', 'RUNNING', 'SUCCEEDED', 'FAILED');--> statement-breakpoint
CREATE TYPE "processing_job_type" AS ENUM('PING', 'IMAGE_DERIVATIVES', 'VIDEO_DERIVATIVES');--> statement-breakpoint
CREATE TABLE "processing_job" (
	"id" text PRIMARY KEY,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"type" "processing_job_type" NOT NULL,
	"status" "processing_job_status" DEFAULT 'PENDING'::"processing_job_status" NOT NULL,
	"payload" jsonb DEFAULT '{}' NOT NULL,
	"result" jsonb,
	"attempts" integer DEFAULT 0 NOT NULL,
	"max_attempts" integer DEFAULT 3 NOT NULL,
	"run_at" timestamp DEFAULT now() NOT NULL,
	"locked_at" timestamp,
	"locked_by" text,
	"last_error" text,
	"finished_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "user" (
	"id" text PRIMARY KEY,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"email" text NOT NULL UNIQUE,
	"family_name" text NOT NULL,
	"given_name" text NOT NULL,
	"locale" text,
	"preferred_username" text NOT NULL
);
--> statement-breakpoint
CREATE INDEX "processing_job_claim_idx" ON "processing_job" ("status","run_at");