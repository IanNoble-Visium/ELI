CREATE TYPE "public"."agent_log_level" AS ENUM('debug', 'info', 'warn', 'error');--> statement-breakpoint
CREATE TYPE "public"."agent_run_mode" AS ENUM('cron', 'manual', 'context');--> statement-breakpoint
CREATE TYPE "public"."agent_run_status" AS ENUM('running', 'completed', 'failed', 'discarded');--> statement-breakpoint
CREATE TYPE "public"."agent_type" AS ENUM('timeline', 'correlation', 'anomaly');--> statement-breakpoint
CREATE TABLE "agent_config" (
	"id" integer GENERATED ALWAYS AS IDENTITY (sequence name "agent_config_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"agent_type" "agent_type" NOT NULL,
	"enabled" boolean DEFAULT false NOT NULL,
	"schedule_cron" varchar(50) DEFAULT '0 * * * *' NOT NULL,
	"batch_size" integer DEFAULT 100 NOT NULL,
	"confidence_threshold" double precision DEFAULT 0.9 NOT NULL,
	"min_group_size_cron" integer,
	"min_group_size_context" integer,
	"max_execution_ms" integer DEFAULT 7000 NOT NULL,
	"overlap_threshold" integer DEFAULT 10 NOT NULL,
	"scan_new_events_only" boolean DEFAULT true NOT NULL,
	"last_processed_timestamp" bigint,
	"config" jsonb,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "agent_config_agent_type_unique" UNIQUE("agent_type")
);
--> statement-breakpoint
CREATE TABLE "agent_run_logs" (
	"id" integer GENERATED ALWAYS AS IDENTITY (sequence name "agent_run_logs_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"run_id" varchar(64) NOT NULL,
	"timestamp" timestamp DEFAULT now() NOT NULL,
	"level" "agent_log_level" DEFAULT 'info' NOT NULL,
	"message" text NOT NULL,
	"metadata" jsonb
);
--> statement-breakpoint
CREATE TABLE "agent_runs" (
	"id" varchar(64) PRIMARY KEY NOT NULL,
	"agent_type" "agent_type" NOT NULL,
	"run_mode" "agent_run_mode" NOT NULL,
	"status" "agent_run_status" DEFAULT 'running' NOT NULL,
	"anchor_node_id" varchar(255),
	"anchor_node_type" varchar(50),
	"nodes_processed" integer DEFAULT 0 NOT NULL,
	"nodes_matched" integer DEFAULT 0 NOT NULL,
	"nodes_tagged" integer DEFAULT 0 NOT NULL,
	"batches_completed" integer DEFAULT 0 NOT NULL,
	"processing_time_ms" integer,
	"batch_size" integer DEFAULT 100 NOT NULL,
	"confidence_threshold" double precision DEFAULT 0.9 NOT NULL,
	"min_group_size" integer,
	"max_execution_ms" integer DEFAULT 7000 NOT NULL,
	"group_id" varchar(64),
	"group_size" integer,
	"executive_summary" text,
	"findings" jsonb,
	"started_at" timestamp DEFAULT now() NOT NULL,
	"completed_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "topology_reports" (
	"id" varchar(64) PRIMARY KEY NOT NULL,
	"title" varchar(500),
	"content" text NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"createdByUserId" varchar(255),
	"createdByUserName" text,
	"nodeIds" jsonb NOT NULL,
	"edgeIds" jsonb NOT NULL,
	"nodeCount" integer NOT NULL,
	"edgeCount" integer NOT NULL,
	"flagged" boolean DEFAULT false NOT NULL,
	"flaggedAt" timestamp,
	"shareToken" varchar(64),
	"metadata" jsonb
);
--> statement-breakpoint
CREATE INDEX "idx_agent_logs_run" ON "agent_run_logs" USING btree ("run_id");--> statement-breakpoint
CREATE INDEX "idx_agent_logs_timestamp" ON "agent_run_logs" USING btree ("timestamp");--> statement-breakpoint
CREATE INDEX "idx_agent_runs_type_status" ON "agent_runs" USING btree ("agent_type","status");--> statement-breakpoint
CREATE INDEX "idx_agent_runs_started" ON "agent_runs" USING btree ("started_at");--> statement-breakpoint
CREATE INDEX "idx_agent_runs_group" ON "agent_runs" USING btree ("group_id");--> statement-breakpoint
CREATE INDEX "idx_topology_reports_created" ON "topology_reports" USING btree ("createdAt");--> statement-breakpoint
CREATE INDEX "idx_topology_reports_flagged" ON "topology_reports" USING btree ("flagged");--> statement-breakpoint
CREATE INDEX "idx_topology_reports_share_token" ON "topology_reports" USING btree ("shareToken");