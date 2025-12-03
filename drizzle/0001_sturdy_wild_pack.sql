CREATE TABLE `incident_notes` (
	`id` int AUTO_INCREMENT NOT NULL,
	`incident_id` varchar(255) NOT NULL,
	`user_id` int NOT NULL,
	`note` text NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `incident_notes_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `incident_tags` (
	`id` int AUTO_INCREMENT NOT NULL,
	`incident_id` varchar(255) NOT NULL,
	`tag` varchar(100) NOT NULL,
	`color` varchar(50),
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `incident_tags_id` PRIMARY KEY(`id`)
);
