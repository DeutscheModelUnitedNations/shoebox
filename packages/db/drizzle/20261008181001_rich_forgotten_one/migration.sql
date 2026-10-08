ALTER TABLE "event_photographer" ADD COLUMN "id" text;--> statement-breakpoint
ALTER TABLE "event_photographer" DROP CONSTRAINT "event_photographer_pkey";--> statement-breakpoint
ALTER TABLE "event_photographer" ADD PRIMARY KEY ("id");--> statement-breakpoint
ALTER TABLE "event_photographer" ADD CONSTRAINT "event_photographer_pair" UNIQUE("event_id","email");