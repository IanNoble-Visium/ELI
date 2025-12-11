CREATE TYPE "public"."entity_type" AS ENUM('person', 'object', 'location', 'event');--> statement-breakpoint
CREATE TYPE "public"."user_role" AS ENUM('user', 'admin');--> statement-breakpoint
CREATE TABLE "ai_anomalies" (
	"id" bigint GENERATED ALWAYS AS IDENTITY (sequence name "ai_anomalies_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"metric" varchar(100) NOT NULL,
	"entityType" varchar(100),
	"entityId" varchar(255),
	"value" double precision NOT NULL,
	"score" double precision NOT NULL,
	"threshold" double precision,
	"win" jsonb,
	"context" jsonb,
	"ts" bigint NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ai_baselines" (
	"id" bigint GENERATED ALWAYS AS IDENTITY (sequence name "ai_baselines_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"entityType" varchar(100) NOT NULL,
	"entityId" varchar(255) NOT NULL,
	"features" jsonb NOT NULL,
	"updatedAt" bigint NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ai_detections" (
	"id" bigint GENERATED ALWAYS AS IDENTITY (sequence name "ai_detections_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"eventId" varchar(255),
	"channelId" varchar(255),
	"type" varchar(100) NOT NULL,
	"label" varchar(255),
	"score" double precision,
	"bbox" jsonb,
	"embedding" text,
	"meta" jsonb,
	"ts" bigint NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ai_inference_jobs" (
	"id" bigint GENERATED ALWAYS AS IDENTITY (sequence name "ai_inference_jobs_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"sourceType" varchar(100) NOT NULL,
	"sourceId" varchar(255) NOT NULL,
	"status" varchar(50) DEFAULT 'queued' NOT NULL,
	"payload" jsonb,
	"error" text,
	"createdAt" bigint NOT NULL,
	"updatedAt" bigint NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ai_insights" (
	"id" bigint GENERATED ALWAYS AS IDENTITY (sequence name "ai_insights_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"scope" varchar(100) NOT NULL,
	"scopeId" varchar(255),
	"summary" text NOT NULL,
	"recommendations" jsonb,
	"context" jsonb,
	"ts" bigint NOT NULL
);
--> statement-breakpoint
CREATE TABLE "channels" (
	"id" varchar(255) PRIMARY KEY NOT NULL,
	"name" varchar(500),
	"channelType" varchar(100),
	"latitude" double precision,
	"longitude" double precision,
	"address" jsonb,
	"tags" jsonb,
	"status" varchar(50) DEFAULT 'active',
	"region" varchar(100),
	"policeStation" varchar(255),
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "events" (
	"id" varchar(255) PRIMARY KEY NOT NULL,
	"eventId" varchar(255),
	"monitorId" varchar(255),
	"topic" varchar(500),
	"module" varchar(100),
	"level" varchar(50),
	"startTime" bigint,
	"endTime" bigint,
	"latitude" double precision,
	"longitude" double precision,
	"channelId" varchar(255),
	"channelType" varchar(100),
	"channelName" varchar(500),
	"channelAddress" jsonb,
	"params" jsonb,
	"tags" jsonb,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "incident_notes" (
	"id" integer GENERATED ALWAYS AS IDENTITY (sequence name "incident_notes_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"incident_id" varchar(255) NOT NULL,
	"user_id" integer NOT NULL,
	"note" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "incident_tags" (
	"id" integer GENERATED ALWAYS AS IDENTITY (sequence name "incident_tags_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"incident_id" varchar(255) NOT NULL,
	"tag" varchar(100) NOT NULL,
	"color" varchar(50),
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "incidents" (
	"id" varchar(255) PRIMARY KEY NOT NULL,
	"incidentType" varchar(100) NOT NULL,
	"priority" varchar(50) NOT NULL,
	"status" varchar(50) DEFAULT 'open' NOT NULL,
	"location" varchar(500),
	"region" varchar(100),
	"latitude" double precision,
	"longitude" double precision,
	"description" text,
	"videoUrl" text,
	"assignedOfficer" varchar(255),
	"assignedUnit" varchar(255),
	"responseTime" integer,
	"eventIds" jsonb,
	"metadata" jsonb,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	"resolvedAt" timestamp
);
--> statement-breakpoint
CREATE TABLE "pole_entities" (
	"id" varchar(255) PRIMARY KEY NOT NULL,
	"entityType" "entity_type" NOT NULL,
	"name" varchar(500),
	"description" text,
	"attributes" jsonb,
	"threatLevel" varchar(50),
	"relatedEntities" jsonb,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "snapshots" (
	"id" varchar(255) PRIMARY KEY NOT NULL,
	"eventId" varchar(255) NOT NULL,
	"type" varchar(50),
	"path" varchar(1000),
	"imageUrl" varchar(1000),
	"cloudinaryPublicId" varchar(500),
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"gemini_processed" boolean DEFAULT false NOT NULL,
	"gemini_processed_at" timestamp,
	"gemini_model_used" varchar(100),
	"gemini_error" text
);
--> statement-breakpoint
CREATE TABLE "system_config" (
	"id" integer GENERATED ALWAYS AS IDENTITY (sequence name "system_config_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"key" varchar(100) NOT NULL,
	"value" text NOT NULL,
	"description" text,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" integer GENERATED ALWAYS AS IDENTITY (sequence name "users_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"openId" varchar(64) NOT NULL,
	"name" text,
	"email" varchar(320),
	"loginMethod" varchar(64),
	"role" "user_role" DEFAULT 'user' NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	"lastSignedIn" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "webhook_requests" (
	"id" bigint GENERATED ALWAYS AS IDENTITY (sequence name "webhook_requests_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"endpoint" varchar(255) NOT NULL,
	"method" varchar(10) NOT NULL,
	"payload" jsonb,
	"eventId" varchar(255),
	"level" varchar(50),
	"module" varchar(100),
	"status" varchar(50) DEFAULT 'success',
	"error" text,
	"processingTime" integer,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "idx_ai_anomalies_entity_ts" ON "ai_anomalies" USING btree ("entityType","entityId","ts");--> statement-breakpoint
CREATE INDEX "idx_ai_anomalies_metric_ts" ON "ai_anomalies" USING btree ("metric","ts");--> statement-breakpoint
CREATE INDEX "idx_ai_detections_channel_ts" ON "ai_detections" USING btree ("channelId","ts");--> statement-breakpoint
CREATE INDEX "idx_ai_detections_event" ON "ai_detections" USING btree ("eventId");--> statement-breakpoint
CREATE INDEX "idx_ai_jobs_status" ON "ai_inference_jobs" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_ai_jobs_created" ON "ai_inference_jobs" USING btree ("createdAt");--> statement-breakpoint
CREATE INDEX "idx_ai_insights_scope_ts" ON "ai_insights" USING btree ("scope","scopeId","ts");--> statement-breakpoint
CREATE INDEX "idx_channels_region" ON "channels" USING btree ("region");--> statement-breakpoint
CREATE INDEX "idx_channels_status" ON "channels" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_events_start_time" ON "events" USING btree ("startTime");--> statement-breakpoint
CREATE INDEX "idx_events_topic" ON "events" USING btree ("topic");--> statement-breakpoint
CREATE INDEX "idx_events_channel" ON "events" USING btree ("channelId");--> statement-breakpoint
CREATE INDEX "idx_events_level" ON "events" USING btree ("level");--> statement-breakpoint
CREATE INDEX "idx_incidents_status" ON "incidents" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_incidents_priority" ON "incidents" USING btree ("priority");--> statement-breakpoint
CREATE INDEX "idx_incidents_region" ON "incidents" USING btree ("region");--> statement-breakpoint
CREATE INDEX "idx_incidents_created" ON "incidents" USING btree ("createdAt");--> statement-breakpoint
CREATE INDEX "idx_pole_entities_type" ON "pole_entities" USING btree ("entityType");--> statement-breakpoint
CREATE INDEX "idx_pole_entities_threat" ON "pole_entities" USING btree ("threatLevel");--> statement-breakpoint
CREATE INDEX "idx_snapshots_event_id" ON "snapshots" USING btree ("eventId");--> statement-breakpoint
CREATE INDEX "idx_snapshots_type" ON "snapshots" USING btree ("type");--> statement-breakpoint
CREATE INDEX "idx_snapshots_gemini_processed" ON "snapshots" USING btree ("gemini_processed");--> statement-breakpoint
CREATE INDEX "idx_webhook_requests_created" ON "webhook_requests" USING btree ("createdAt");--> statement-breakpoint
CREATE INDEX "idx_webhook_requests_level" ON "webhook_requests" USING btree ("level");--> statement-breakpoint
CREATE INDEX "idx_webhook_requests_module" ON "webhook_requests" USING btree ("module");