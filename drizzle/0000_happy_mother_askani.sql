CREATE TABLE `ai_anomalies` (
	`id` bigint AUTO_INCREMENT NOT NULL,
	`metric` varchar(100) NOT NULL,
	`entityType` varchar(100),
	`entityId` varchar(255),
	`value` double NOT NULL,
	`score` double NOT NULL,
	`threshold` double,
	`win` json,
	`context` json,
	`ts` bigint NOT NULL,
	CONSTRAINT `ai_anomalies_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `ai_baselines` (
	`id` bigint AUTO_INCREMENT NOT NULL,
	`entityType` varchar(100) NOT NULL,
	`entityId` varchar(255) NOT NULL,
	`features` json NOT NULL,
	`updatedAt` bigint NOT NULL,
	CONSTRAINT `ai_baselines_id` PRIMARY KEY(`id`),
	CONSTRAINT `ai_baselines_entity_unique` UNIQUE(`entityType`,`entityId`)
);
--> statement-breakpoint
CREATE TABLE `ai_detections` (
	`id` bigint AUTO_INCREMENT NOT NULL,
	`eventId` varchar(255),
	`channelId` varchar(255),
	`type` varchar(100) NOT NULL,
	`label` varchar(255),
	`score` double,
	`bbox` json,
	`embedding` text,
	`meta` json,
	`ts` bigint NOT NULL,
	CONSTRAINT `ai_detections_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `ai_inference_jobs` (
	`id` bigint AUTO_INCREMENT NOT NULL,
	`sourceType` varchar(100) NOT NULL,
	`sourceId` varchar(255) NOT NULL,
	`status` varchar(50) NOT NULL DEFAULT 'queued',
	`payload` json,
	`error` text,
	`createdAt` bigint NOT NULL,
	`updatedAt` bigint NOT NULL,
	CONSTRAINT `ai_inference_jobs_id` PRIMARY KEY(`id`),
	CONSTRAINT `ai_jobs_source_unique` UNIQUE(`sourceType`,`sourceId`)
);
--> statement-breakpoint
CREATE TABLE `ai_insights` (
	`id` bigint AUTO_INCREMENT NOT NULL,
	`scope` varchar(100) NOT NULL,
	`scopeId` varchar(255),
	`summary` text NOT NULL,
	`recommendations` json,
	`context` json,
	`ts` bigint NOT NULL,
	CONSTRAINT `ai_insights_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `channels` (
	`id` varchar(255) NOT NULL,
	`name` varchar(500),
	`channelType` varchar(100),
	`latitude` double,
	`longitude` double,
	`address` json,
	`tags` json,
	`status` varchar(50) DEFAULT 'active',
	`region` varchar(100),
	`policeStation` varchar(255),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `channels_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `events` (
	`id` varchar(255) NOT NULL,
	`eventId` varchar(255),
	`monitorId` varchar(255),
	`topic` varchar(500),
	`module` varchar(100),
	`level` varchar(50),
	`startTime` bigint,
	`endTime` bigint,
	`latitude` double,
	`longitude` double,
	`channelId` varchar(255),
	`channelType` varchar(100),
	`channelName` varchar(500),
	`channelAddress` json,
	`params` json,
	`tags` json,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `events_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `incidents` (
	`id` varchar(255) NOT NULL,
	`incidentType` varchar(100) NOT NULL,
	`priority` varchar(50) NOT NULL,
	`status` varchar(50) NOT NULL DEFAULT 'open',
	`location` varchar(500),
	`region` varchar(100),
	`latitude` double,
	`longitude` double,
	`description` text,
	`videoUrl` text,
	`assignedOfficer` varchar(255),
	`assignedUnit` varchar(255),
	`responseTime` int,
	`eventIds` json,
	`metadata` json,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()),
	`resolvedAt` timestamp,
	CONSTRAINT `incidents_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `pole_entities` (
	`id` varchar(255) NOT NULL,
	`entityType` enum('person','object','location','event') NOT NULL,
	`name` varchar(500),
	`description` text,
	`attributes` json,
	`threatLevel` varchar(50),
	`relatedEntities` json,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `pole_entities_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `snapshots` (
	`id` varchar(255) NOT NULL,
	`eventId` varchar(255) NOT NULL,
	`type` varchar(50),
	`path` varchar(1000),
	`imageUrl` varchar(1000),
	`cloudinaryPublicId` varchar(500),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `snapshots_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `system_config` (
	`id` int AUTO_INCREMENT NOT NULL,
	`key` varchar(100) NOT NULL,
	`value` text NOT NULL,
	`description` text,
	`updatedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `system_config_id` PRIMARY KEY(`id`),
	CONSTRAINT `system_config_key_unique` UNIQUE(`key`)
);
--> statement-breakpoint
CREATE TABLE `users` (
	`id` int AUTO_INCREMENT NOT NULL,
	`openId` varchar(64) NOT NULL,
	`name` text,
	`email` varchar(320),
	`loginMethod` varchar(64),
	`role` enum('user','admin') NOT NULL DEFAULT 'user',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()),
	`lastSignedIn` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `users_id` PRIMARY KEY(`id`),
	CONSTRAINT `users_openId_unique` UNIQUE(`openId`)
);
--> statement-breakpoint
CREATE TABLE `webhook_requests` (
	`id` bigint AUTO_INCREMENT NOT NULL,
	`endpoint` varchar(255) NOT NULL,
	`method` varchar(10) NOT NULL,
	`payload` json,
	`eventId` varchar(255),
	`level` varchar(50),
	`module` varchar(100),
	`status` varchar(50) DEFAULT 'success',
	`error` text,
	`processingTime` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `webhook_requests_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `idx_ai_anomalies_entity_ts` ON `ai_anomalies` (`entityType`,`entityId`,`ts`);--> statement-breakpoint
CREATE INDEX `idx_ai_anomalies_metric_ts` ON `ai_anomalies` (`metric`,`ts`);--> statement-breakpoint
CREATE INDEX `idx_ai_detections_channel_ts` ON `ai_detections` (`channelId`,`ts`);--> statement-breakpoint
CREATE INDEX `idx_ai_detections_event` ON `ai_detections` (`eventId`);--> statement-breakpoint
CREATE INDEX `idx_ai_jobs_status` ON `ai_inference_jobs` (`status`);--> statement-breakpoint
CREATE INDEX `idx_ai_jobs_created` ON `ai_inference_jobs` (`createdAt`);--> statement-breakpoint
CREATE INDEX `idx_ai_insights_scope_ts` ON `ai_insights` (`scope`,`scopeId`,`ts`);--> statement-breakpoint
CREATE INDEX `idx_channels_region` ON `channels` (`region`);--> statement-breakpoint
CREATE INDEX `idx_channels_status` ON `channels` (`status`);--> statement-breakpoint
CREATE INDEX `idx_events_start_time` ON `events` (`startTime`);--> statement-breakpoint
CREATE INDEX `idx_events_topic` ON `events` (`topic`);--> statement-breakpoint
CREATE INDEX `idx_events_channel` ON `events` (`channelId`);--> statement-breakpoint
CREATE INDEX `idx_events_level` ON `events` (`level`);--> statement-breakpoint
CREATE INDEX `idx_incidents_status` ON `incidents` (`status`);--> statement-breakpoint
CREATE INDEX `idx_incidents_priority` ON `incidents` (`priority`);--> statement-breakpoint
CREATE INDEX `idx_incidents_region` ON `incidents` (`region`);--> statement-breakpoint
CREATE INDEX `idx_incidents_created` ON `incidents` (`createdAt`);--> statement-breakpoint
CREATE INDEX `idx_pole_entities_type` ON `pole_entities` (`entityType`);--> statement-breakpoint
CREATE INDEX `idx_pole_entities_threat` ON `pole_entities` (`threatLevel`);--> statement-breakpoint
CREATE INDEX `idx_snapshots_event_id` ON `snapshots` (`eventId`);--> statement-breakpoint
CREATE INDEX `idx_snapshots_type` ON `snapshots` (`type`);--> statement-breakpoint
CREATE INDEX `idx_webhook_requests_created` ON `webhook_requests` (`createdAt`);--> statement-breakpoint
CREATE INDEX `idx_webhook_requests_level` ON `webhook_requests` (`level`);--> statement-breakpoint
CREATE INDEX `idx_webhook_requests_module` ON `webhook_requests` (`module`);