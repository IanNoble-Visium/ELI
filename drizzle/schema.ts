import { pgTable, pgEnum, index, varchar, doublePrecision, jsonb, text, timestamp, integer, bigint, primaryKey } from "drizzle-orm/pg-core"
import { sql } from "drizzle-orm"

// PostgreSQL enums
export const entityTypeEnum = pgEnum('entity_type', ['person', 'object', 'location', 'event']);
export const userRoleEnum = pgEnum('user_role', ['user', 'admin']);

export const aiAnomalies = pgTable("ai_anomalies", {
	id: bigint({ mode: "number" }).notNull().generatedAlwaysAsIdentity(),
	metric: varchar({ length: 100 }).notNull(),
	entityType: varchar({ length: 100 }),
	entityId: varchar({ length: 255 }),
	value: doublePrecision().notNull(),
	score: doublePrecision().notNull(),
	threshold: doublePrecision(),
	win: jsonb(),
	context: jsonb(),
	ts: bigint({ mode: "number" }).notNull(),
},
(table) => [
	index("idx_ai_anomalies_entity_ts").on(table.entityType, table.entityId, table.ts),
	index("idx_ai_anomalies_metric_ts").on(table.metric, table.ts),
]);

export const aiBaselines = pgTable("ai_baselines", {
	id: bigint({ mode: "number" }).notNull().generatedAlwaysAsIdentity(),
	entityType: varchar({ length: 100 }).notNull(),
	entityId: varchar({ length: 255 }).notNull(),
	features: jsonb().notNull(),
	updatedAt: bigint({ mode: "number" }).notNull(),
});

export const aiDetections = pgTable("ai_detections", {
	id: bigint({ mode: "number" }).notNull().generatedAlwaysAsIdentity(),
	eventId: varchar({ length: 255 }),
	channelId: varchar({ length: 255 }),
	type: varchar({ length: 100 }).notNull(),
	label: varchar({ length: 255 }),
	score: doublePrecision(),
	bbox: jsonb(),
	embedding: text(),
	meta: jsonb(),
	ts: bigint({ mode: "number" }).notNull(),
},
(table) => [
	index("idx_ai_detections_channel_ts").on(table.channelId, table.ts),
	index("idx_ai_detections_event").on(table.eventId),
]);

export const aiInferenceJobs = pgTable("ai_inference_jobs", {
	id: bigint({ mode: "number" }).notNull().generatedAlwaysAsIdentity(),
	sourceType: varchar({ length: 100 }).notNull(),
	sourceId: varchar({ length: 255 }).notNull(),
	status: varchar({ length: 50 }).default('queued').notNull(),
	payload: jsonb(),
	error: text(),
	createdAt: bigint({ mode: "number" }).notNull(),
	updatedAt: bigint({ mode: "number" }).notNull(),
},
(table) => [
	index("idx_ai_jobs_status").on(table.status),
	index("idx_ai_jobs_created").on(table.createdAt),
]);

export const aiInsights = pgTable("ai_insights", {
	id: bigint({ mode: "number" }).notNull().generatedAlwaysAsIdentity(),
	scope: varchar({ length: 100 }).notNull(),
	scopeId: varchar({ length: 255 }),
	summary: text().notNull(),
	recommendations: jsonb(),
	context: jsonb(),
	ts: bigint({ mode: "number" }).notNull(),
},
(table) => [
	index("idx_ai_insights_scope_ts").on(table.scope, table.scopeId, table.ts),
]);

export const channels = pgTable("channels", {
	id: varchar({ length: 255 }).primaryKey().notNull(),
	name: varchar({ length: 500 }),
	channelType: varchar({ length: 100 }),
	latitude: doublePrecision(),
	longitude: doublePrecision(),
	address: jsonb(),
	tags: jsonb(),
	status: varchar({ length: 50 }).default('active'),
	region: varchar({ length: 100 }),
	policeStation: varchar({ length: 255 }),
	createdAt: timestamp({ mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp({ mode: 'string' }).defaultNow().notNull(),
},
(table) => [
	index("idx_channels_region").on(table.region),
	index("idx_channels_status").on(table.status),
]);

export const events = pgTable("events", {
	id: varchar({ length: 255 }).primaryKey().notNull(),
	eventId: varchar({ length: 255 }),
	monitorId: varchar({ length: 255 }),
	topic: varchar({ length: 500 }),
	module: varchar({ length: 100 }),
	level: varchar({ length: 50 }),
	startTime: bigint({ mode: "number" }),
	endTime: bigint({ mode: "number" }),
	latitude: doublePrecision(),
	longitude: doublePrecision(),
	channelId: varchar({ length: 255 }),
	channelType: varchar({ length: 100 }),
	channelName: varchar({ length: 500 }),
	channelAddress: jsonb(),
	params: jsonb(),
	tags: jsonb(),
	createdAt: timestamp({ mode: 'string' }).defaultNow().notNull(),
},
(table) => [
	index("idx_events_start_time").on(table.startTime),
	index("idx_events_topic").on(table.topic),
	index("idx_events_channel").on(table.channelId),
	index("idx_events_level").on(table.level),
]);

export const incidentNotes = pgTable("incident_notes", {
	id: integer().notNull().generatedAlwaysAsIdentity(),
	incidentId: varchar("incident_id", { length: 255 }).notNull(),
	userId: integer("user_id").notNull(),
	note: text().notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow().notNull(),
});

export type IncidentNote = typeof incidentNotes.$inferSelect;
export type InsertIncidentNote = typeof incidentNotes.$inferInsert;

export const incidentTags = pgTable("incident_tags", {
	id: integer().notNull().generatedAlwaysAsIdentity(),
	incidentId: varchar("incident_id", { length: 255 }).notNull(),
	tag: varchar({ length: 100 }).notNull(),
	color: varchar({ length: 50 }),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
});

export type IncidentTag = typeof incidentTags.$inferSelect;
export type InsertIncidentTag = typeof incidentTags.$inferInsert;

export const incidents = pgTable("incidents", {
	id: varchar({ length: 255 }).primaryKey().notNull(),
	incidentType: varchar({ length: 100 }).notNull(),
	priority: varchar({ length: 50 }).notNull(),
	status: varchar({ length: 50 }).default('open').notNull(),
	location: varchar({ length: 500 }),
	region: varchar({ length: 100 }),
	latitude: doublePrecision(),
	longitude: doublePrecision(),
	description: text(),
	videoUrl: text(),
	assignedOfficer: varchar({ length: 255 }),
	assignedUnit: varchar({ length: 255 }),
	responseTime: integer(),
	eventIds: jsonb(),
	metadata: jsonb(),
	createdAt: timestamp({ mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp({ mode: 'string' }).defaultNow().notNull(),
	resolvedAt: timestamp({ mode: 'string' }),
},
(table) => [
	index("idx_incidents_status").on(table.status),
	index("idx_incidents_priority").on(table.priority),
	index("idx_incidents_region").on(table.region),
	index("idx_incidents_created").on(table.createdAt),
]);

export const poleEntities = pgTable("pole_entities", {
	id: varchar({ length: 255 }).primaryKey().notNull(),
	entityType: entityTypeEnum().notNull(),
	name: varchar({ length: 500 }),
	description: text(),
	attributes: jsonb(),
	threatLevel: varchar({ length: 50 }),
	relatedEntities: jsonb(),
	createdAt: timestamp({ mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp({ mode: 'string' }).defaultNow().notNull(),
},
(table) => [
	index("idx_pole_entities_type").on(table.entityType),
	index("idx_pole_entities_threat").on(table.threatLevel),
]);

export const snapshots = pgTable("snapshots", {
	id: varchar({ length: 255 }).primaryKey().notNull(),
	eventId: varchar({ length: 255 }).notNull(),
	type: varchar({ length: 50 }),
	path: varchar({ length: 1000 }),
	imageUrl: varchar({ length: 1000 }),
	cloudinaryPublicId: varchar({ length: 500 }),
	createdAt: timestamp({ mode: 'string' }).defaultNow().notNull(),
},
(table) => [
	index("idx_snapshots_event_id").on(table.eventId),
	index("idx_snapshots_type").on(table.type),
]);

export const systemConfig = pgTable("system_config", {
	id: integer().notNull().generatedAlwaysAsIdentity(),
	key: varchar({ length: 100 }).notNull(),
	value: text().notNull(),
	description: text(),
	updatedAt: timestamp({ mode: 'string' }).defaultNow().notNull(),
});

export const users = pgTable("users", {
	id: integer().notNull().generatedAlwaysAsIdentity(),
	openId: varchar({ length: 64 }).notNull(),
	name: text(),
	email: varchar({ length: 320 }),
	loginMethod: varchar({ length: 64 }),
	role: userRoleEnum().default('user').notNull(),
	createdAt: timestamp({ mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp({ mode: 'string' }).defaultNow().notNull(),
	lastSignedIn: timestamp({ mode: 'string' }).defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

export const webhookRequests = pgTable("webhook_requests", {
	id: bigint({ mode: "number" }).notNull().generatedAlwaysAsIdentity(),
	endpoint: varchar({ length: 255 }).notNull(),
	method: varchar({ length: 10 }).notNull(),
	payload: jsonb(),
	eventId: varchar({ length: 255 }),
	level: varchar({ length: 50 }),
	module: varchar({ length: 100 }),
	status: varchar({ length: 50 }).default('success'),
	error: text(),
	processingTime: integer(),
	createdAt: timestamp({ mode: 'string' }).defaultNow().notNull(),
},
(table) => [
	index("idx_webhook_requests_created").on(table.createdAt),
	index("idx_webhook_requests_level").on(table.level),
	index("idx_webhook_requests_module").on(table.module),
]);
