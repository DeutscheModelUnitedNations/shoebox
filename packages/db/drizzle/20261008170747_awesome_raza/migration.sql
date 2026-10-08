CREATE TYPE "date_precision" AS ENUM('DAY', 'MONTH', 'YEAR');--> statement-breakpoint
CREATE TYPE "media_kind" AS ENUM('IMAGE', 'VIDEO');--> statement-breakpoint
CREATE TYPE "media_status" AS ENUM('PENDING', 'READY', 'FAILED');--> statement-breakpoint
CREATE TYPE "media_visibility" AS ENUM('PUBLIC', 'TEAM');--> statement-breakpoint
CREATE TYPE "series_kind" AS ENUM('CONFERENCE', 'ASSOCIATION');--> statement-breakpoint
CREATE TABLE "category" (
	"id" text PRIMARY KEY,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"event_id" text NOT NULL,
	"parent_id" text,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"cover_media_id" text,
	CONSTRAINT "category_parent_slug" UNIQUE NULLS NOT DISTINCT("event_id","parent_id","slug")
);
--> statement-breakpoint
CREATE TABLE "event" (
	"id" text PRIMARY KEY,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"series_id" text NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"edition" text NOT NULL,
	"subtitle" text NOT NULL,
	"location" text NOT NULL,
	"description" text NOT NULL,
	"date_from" date NOT NULL,
	"date_to" date,
	"date_precision" "date_precision" DEFAULT 'DAY'::"date_precision" NOT NULL,
	"photographers" text[] DEFAULT '{}'::text[] NOT NULL,
	"rights" text NOT NULL,
	"cover_media_id" text,
	"hero_media_id" text,
	CONSTRAINT "event_series_slug" UNIQUE("series_id","slug")
);
--> statement-breakpoint
CREATE TABLE "media" (
	"id" text PRIMARY KEY,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"event_id" text NOT NULL,
	"category_id" text,
	"kind" "media_kind" DEFAULT 'IMAGE'::"media_kind" NOT NULL,
	"visibility" "media_visibility" DEFAULT 'PUBLIC'::"media_visibility" NOT NULL,
	"status" "media_status" DEFAULT 'PENDING'::"media_status" NOT NULL,
	"highlight" boolean DEFAULT false NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"title" text DEFAULT '' NOT NULL,
	"alt" text DEFAULT '' NOT NULL,
	"photographer" text DEFAULT '' NOT NULL,
	"taken_at" timestamp,
	"original_key" text NOT NULL,
	"original_filename" text NOT NULL,
	"mime_type" text NOT NULL,
	"bytes" integer,
	"width" integer,
	"height" integer,
	"blurhash" text,
	"derivatives" jsonb DEFAULT '[]' NOT NULL,
	"exif" jsonb,
	"gps" jsonb
);
--> statement-breakpoint
CREATE TABLE "series" (
	"id" text PRIMARY KEY,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"slug" text NOT NULL UNIQUE,
	"name" text NOT NULL,
	"short_name" text NOT NULL,
	"region" text NOT NULL,
	"kind" "series_kind" NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE INDEX "category_event_idx" ON "category" ("event_id");--> statement-breakpoint
CREATE INDEX "media_event_idx" ON "media" ("event_id","status");--> statement-breakpoint
CREATE INDEX "media_category_idx" ON "media" ("category_id");--> statement-breakpoint
ALTER TABLE "category" ADD CONSTRAINT "category_event_id_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "event"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "category" ADD CONSTRAINT "category_parent_id_category_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "category"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "category" ADD CONSTRAINT "category_cover_media_id_media_id_fkey" FOREIGN KEY ("cover_media_id") REFERENCES "media"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "event" ADD CONSTRAINT "event_series_id_series_id_fkey" FOREIGN KEY ("series_id") REFERENCES "series"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "event" ADD CONSTRAINT "event_cover_media_id_media_id_fkey" FOREIGN KEY ("cover_media_id") REFERENCES "media"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "event" ADD CONSTRAINT "event_hero_media_id_media_id_fkey" FOREIGN KEY ("hero_media_id") REFERENCES "media"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "media" ADD CONSTRAINT "media_event_id_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "event"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "media" ADD CONSTRAINT "media_category_id_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "category"("id") ON DELETE SET NULL;