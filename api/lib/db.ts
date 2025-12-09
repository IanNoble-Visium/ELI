/**
 * Database utility for Vercel serverless functions
 * Provides lazy database connection with proper error handling
 * Uses Neon PostgreSQL serverless driver for optimal Vercel performance
 */
import { neon } from "@neondatabase/serverless";
import { drizzle, NeonHttpDatabase } from "drizzle-orm/neon-http";
import { and, desc, eq, gte, lte, sql, count } from "drizzle-orm";
import {
  events,
  channels,
  webhookRequests,
  snapshots,
  incidents,
  systemConfig,
} from "../../drizzle/schema.js";

// Cache the drizzle instance to reuse across requests
let _db: NeonHttpDatabase | null = null;

/**
 * Get or create a database connection
 * Returns null if DATABASE_URL is not configured
 */
export async function getDb(): Promise<NeonHttpDatabase | null> {
  if (_db) return _db;

  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    console.warn("[API DB] DATABASE_URL not configured");
    return null;
  }

  try {
    const client = neon(dbUrl);
    _db = drizzle(client);
    console.log("[API DB] Database connected successfully");
    return _db;
  } catch (error) {
    console.error("[API DB] Failed to connect to database:", error);
    return null;
  }
}

// Re-export commonly used drizzle functions for convenience
export { and, desc, eq, gte, lte, sql, count };

// Re-export schema tables
export { events, channels, webhookRequests, snapshots, incidents, systemConfig };

// ========== Snapshots ==========

export interface SnapshotData {
  type?: string;
  path?: string;
  image?: string; // base64 image data
  imageUrl?: string; // Cloudinary URL (if uploaded)
  cloudinaryPublicId?: string; // Cloudinary public ID (if uploaded)
  analysis?: any; // Cloudinary analysis data
}

export async function insertSnapshots(eventId: string, snapshotsData: SnapshotData[]) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  if (!snapshotsData || snapshotsData.length === 0) return;

  const snapshotRecords = snapshotsData.map((snap, index) => ({
    id: `snap_${eventId}_${index}_${Date.now()}`,
    eventId,
    type: snap.type || "UNKNOWN",
    path: snap.path || null,
    // Use Cloudinary URL if available, otherwise fall back to path
    imageUrl: snap.imageUrl || snap.path || null,
    cloudinaryPublicId: snap.cloudinaryPublicId || null,
  }));

  for (const record of snapshotRecords) {
    await db.insert(snapshots).values(record).onConflictDoUpdate({
      target: snapshots.id,
      set: record,
    });
  }
}

/**
 * Insert a single snapshot with Cloudinary data
 */
export async function insertSnapshot(data: {
  id: string;
  eventId: string;
  type?: string;
  path?: string;
  imageUrl?: string;
  cloudinaryPublicId?: string;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db.insert(snapshots).values({
    id: data.id,
    eventId: data.eventId,
    type: data.type || "UNKNOWN",
    path: data.path || null,
    imageUrl: data.imageUrl || null,
    cloudinaryPublicId: data.cloudinaryPublicId || null,
  }).onConflictDoUpdate({
    target: snapshots.id,
    set: {
      type: data.type || "UNKNOWN",
      path: data.path || null,
      imageUrl: data.imageUrl || null,
      cloudinaryPublicId: data.cloudinaryPublicId || null,
    },
  });
}

// ========== Webhook Requests ==========

export async function insertWebhookRequest(data: {
  endpoint: string;
  method: string;
  payload?: any;
  eventId?: string;
  level?: string;
  module?: string;
  status?: string;
  error?: string;
  processingTime?: number;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db.insert(webhookRequests).values({
    endpoint: data.endpoint,
    method: data.method,
    payload: data.payload || null,
    eventId: data.eventId || null,
    level: data.level || null,
    module: data.module || null,
    status: data.status || "success",
    error: data.error || null,
    processingTime: data.processingTime || null,
  });
}

export async function getRecentWebhooks(limit: number = 100) {
  const db = await getDb();
  if (!db) return [];

  return db
    .select()
    .from(webhookRequests)
    .orderBy(desc(webhookRequests.createdAt))
    .limit(limit);
}

// ========== Events ==========

export async function insertEvent(data: {
  id: string;
  eventId?: string;
  monitorId?: string;
  topic?: string;
  module?: string;
  level?: string;
  startTime?: number;
  endTime?: number;
  latitude?: number;
  longitude?: number;
  channelId?: string;
  channelType?: string;
  channelName?: string;
  channelAddress?: any;
  params?: any;
  tags?: any;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  // Exclude createdAt from the data to avoid overwriting on conflict
  const { id, ...updateData } = data;

  await db.insert(events).values(data).onConflictDoUpdate({
    target: events.id,
    set: updateData, // Don't update id or createdAt on conflict
  });
}

export async function getRecentEvents(options: {
  limit?: number;
  level?: string;
  topic?: string;
  region?: string;
  channelId?: string;
  includeSnapshots?: boolean;
} = {}) {
  const db = await getDb();
  if (!db) return [];

  const { limit = 100, level, topic, region, channelId, includeSnapshots = false } = options;
  const conditions = [];

  if (level && level !== "all") {
    conditions.push(eq(events.level, level));
  }
  if (topic && topic !== "all") {
    conditions.push(eq(events.topic, topic));
  }
  if (channelId) {
    conditions.push(eq(events.channelId, parseInt(channelId)));
  }

  let query = db.select().from(events);

  if (conditions.length > 0) {
    query = query.where(and(...conditions)) as any;
  }

  const eventsList = await query.orderBy(desc(events.startTime)).limit(limit);

  // If snapshots are requested, fetch them for each event
  if (includeSnapshots && eventsList.length > 0) {
    const eventIds = eventsList.map(event => event.id);

    const snapshotsData = await db
      .select()
      .from(snapshots)
      .where(sql`${snapshots.eventId} IN (${sql.join(eventIds.map(id => sql`${id}`), sql`, `)})`);

    // Group snapshots by event ID
    const snapshotsByEvent: Record<string, any[]> = {};
    snapshotsData.forEach(snap => {
      if (!snapshotsByEvent[snap.eventId]) {
        snapshotsByEvent[snap.eventId] = [];
      }
      snapshotsByEvent[snap.eventId].push(snap);
    });

    // Attach snapshots to events
    return eventsList.map(event => {
      const eventSnapshots = snapshotsByEvent[event.id] || [];
      // Only count snapshots that have valid Cloudinary URLs (not local paths)
      const cloudinarySnapshots = eventSnapshots.filter(
        (snap: any) => snap.imageUrl && snap.imageUrl.includes('cloudinary.com')
      );
      return {
        ...event,
        snapshots: eventSnapshots,
        snapshotsCount: eventSnapshots.length,
        // hasImages is true only if there are valid Cloudinary URLs
        hasImages: cloudinarySnapshots.length > 0,
      };
    });
  }

  return eventsList;
}

export async function getEventCounts(): Promise<{
  total: number;
  critical: number;
  high: number;
  faces: number;
  plates: number;
}> {
  const db = await getDb();
  if (!db) return { total: 0, critical: 0, high: 0, faces: 0, plates: 0 };

  try {
    // Get total count
    const [totalResult] = await db.select({ count: count() }).from(events);

    // Get critical (level 3) count
    const [criticalResult] = await db
      .select({ count: count() })
      .from(events)
      .where(eq(events.level, "3"));

    // Get high (level 2) count
    const [highResult] = await db
      .select({ count: count() })
      .from(events)
      .where(eq(events.level, "2"));

    // Get face events count (topic contains 'Face')
    const [facesResult] = await db
      .select({ count: count() })
      .from(events)
      .where(sql`${events.topic} LIKE '%Face%'`);

    // Get plate events count (topic contains 'Plate')
    const [platesResult] = await db
      .select({ count: count() })
      .from(events)
      .where(sql`${events.topic} LIKE '%Plate%'`);

    return {
      total: totalResult?.count || 0,
      critical: criticalResult?.count || 0,
      high: highResult?.count || 0,
      faces: facesResult?.count || 0,
      plates: platesResult?.count || 0,
    };
  } catch (error) {
    console.error("[API DB] Error getting event counts:", error);
    return { total: 0, critical: 0, high: 0, faces: 0, plates: 0 };
  }
}

// ========== Channels ==========

export async function upsertChannel(data: {
  id: string;
  name?: string;
  channelType?: string;
  latitude?: number;
  longitude?: number;
  address?: any;
  tags?: any;
  status?: string;
  region?: string;
  policeStation?: string;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db.insert(channels).values(data).onConflictDoUpdate({
    target: channels.id,
    set: {
      ...data,
      updatedAt: sql`NOW()`,
    },
  });
}

export async function getChannelsList(options: {
  region?: string;
  status?: string;
  limit?: number;
} = {}) {
  const db = await getDb();
  if (!db) return [];

  const { region, status, limit } = options;
  const conditions = [];

  if (region && region !== "all") {
    conditions.push(eq(channels.region, region));
  }
  if (status && status !== "all") {
    conditions.push(eq(channels.status, status));
  }

  let query = db.select().from(channels);

  if (conditions.length > 0) {
    query = query.where(and(...conditions)) as any;
  }

  if (limit) {
    query = query.limit(limit) as any;
  }

  return query;
}

export async function getChannelsWithEventCounts(options: {
  region?: string;
  status?: string;
  limit?: number;
} = {}) {
  const db = await getDb();
  if (!db) return [];

  const { region, status, limit } = options;
  const conditions = [];

  if (region && region !== "all") {
    conditions.push(eq(channels.region, region));
  }
  if (status && status !== "all") {
    conditions.push(eq(channels.status, status));
  }

  // Subquery to get event counts per channel
  const eventCountsSubquery = db
    .select({
      channelId: events.channelId,
      eventCount: count().as("event_count"),
      alertCount: sql<number>`SUM(CASE WHEN ${events.level} >= '2' THEN 1 ELSE 0 END)`.as("alert_count"),
      lastEventTime: sql<number>`MAX(${events.startTime})`.as("last_event_time"),
    })
    .from(events)
    .groupBy(events.channelId)
    .as("event_counts");

  // Main query joining channels with event counts
  let query = db
    .select({
      id: channels.id,
      name: channels.name,
      channelType: channels.channelType,
      latitude: channels.latitude,
      longitude: channels.longitude,
      address: channels.address,
      tags: channels.tags,
      status: channels.status,
      region: channels.region,
      policeStation: channels.policeStation,
      createdAt: channels.createdAt,
      updatedAt: channels.updatedAt,
      eventCount: sql<number>`COALESCE(${eventCountsSubquery.eventCount}, 0)`.as("event_count_result"),
      alertCount: sql<number>`COALESCE(${eventCountsSubquery.alertCount}, 0)`.as("alert_count_result"),
      lastEventTime: sql<number>`COALESCE(${eventCountsSubquery.lastEventTime}, 0)`.as("last_event_time_result"),
    })
    .from(channels)
    .leftJoin(eventCountsSubquery, eq(channels.id, eventCountsSubquery.channelId));

  if (conditions.length > 0) {
    query = query.where(and(...conditions)) as any;
  }

  if (limit) {
    query = query.limit(limit) as any;
  }

  return query;
}

// ========== Statistics ==========

export async function getDashboardStats(timeRange: string = "7d") {
  const db = await getDb();
  if (!db) return null;

  // Calculate time range
  const now = Date.now();
  const rangeDays = timeRange === "24h" ? 1 : timeRange === "7d" ? 7 : 30;
  const startTime = now - rangeDays * 24 * 60 * 60 * 1000;

  try {
    // Total events in time range
    const [eventCountResult] = await db
      .select({ count: count() })
      .from(events)
      .where(gte(events.startTime, startTime));

    // Total channels
    const [channelCountResult] = await db
      .select({ count: count() })
      .from(channels);

    // Active channels
    const [activeChannelResult] = await db
      .select({ count: count() })
      .from(channels)
      .where(eq(channels.status, "active"));

    // Inactive channels
    const [inactiveChannelResult] = await db
      .select({ count: count() })
      .from(channels)
      .where(eq(channels.status, "inactive"));

    // Alert channels
    const [alertChannelResult] = await db
      .select({ count: count() })
      .from(channels)
      .where(eq(channels.status, "alert"));

    // Events by level
    const eventsByLevelResult = await db
      .select({
        level: events.level,
        count: count(),
      })
      .from(events)
      .where(gte(events.startTime, startTime))
      .groupBy(events.level);

    // Events by topic
    const eventsByTopicResult = await db
      .select({
        topic: events.topic,
        count: count(),
      })
      .from(events)
      .where(gte(events.startTime, startTime))
      .groupBy(events.topic);

    // Channels by region
    const channelsByRegionResult = await db
      .select({
        region: channels.region,
        count: count(),
      })
      .from(channels)
      .groupBy(channels.region);

    // Format results
    const eventsByLevel: Record<string, number> = {};
    eventsByLevelResult.forEach(row => {
      if (row.level) eventsByLevel[row.level] = row.count;
    });

    const eventsByType: Record<string, number> = {};
    eventsByTopicResult.forEach(row => {
      if (row.topic) eventsByType[row.topic] = row.count;
    });

    const channelsByRegion: Record<string, number> = {};
    channelsByRegionResult.forEach(row => {
      if (row.region) channelsByRegion[row.region] = row.count;
    });

    return {
      overview: {
        totalEvents: eventCountResult?.count || 0,
        totalCameras: channelCountResult?.count || 0,
        activeCameras: activeChannelResult?.count || 0,
        inactiveCameras: inactiveChannelResult?.count || 0,
        alertCameras: alertChannelResult?.count || 0,
        criticalAlerts: eventsByLevel["3"] || 0,
      },
      eventsByType,
      eventsByLevel: {
        critical: eventsByLevel["3"] || 0,
        high: eventsByLevel["2"] || 0,
        medium: eventsByLevel["1"] || 0,
        low: eventsByLevel["0"] || 0,
      },
      channelsByRegion,
    };
  } catch (error) {
    console.error("[API DB] Error getting dashboard stats:", error);
    return null;
  }
}

// ========== Incidents ==========

export async function getIncidentsList(options: {
  status?: string;
  priority?: string;
  region?: string;
  limit?: number;
} = {}) {
  const db = await getDb();
  if (!db) return [];

  const { status, priority, region, limit = 100 } = options;
  const conditions = [];

  if (status && status !== "all") {
    conditions.push(eq(incidents.status, status));
  }
  if (priority && priority !== "all") {
    conditions.push(eq(incidents.priority, priority));
  }
  if (region && region !== "all") {
    conditions.push(eq(incidents.region, region));
  }

  let query = db.select().from(incidents);

  if (conditions.length > 0) {
    query = query.where(and(...conditions)) as any;
  }

  return query.orderBy(desc(incidents.createdAt)).limit(limit);
}

// ========== System Config ==========

/**
 * Get a system configuration value by key
 */
export async function getSystemConfig(key: string): Promise<string | null> {
  const db = await getDb();
  if (!db) return null;

  try {
    const [result] = await db
      .select({ value: systemConfig.value })
      .from(systemConfig)
      .where(eq(systemConfig.key, key))
      .limit(1);

    return result?.value || null;
  } catch (error) {
    console.error(`[DB] Error getting system config '${key}':`, error);
    return null;
  }
}

/**
 * Set a system configuration value
 */
export async function setSystemConfig(key: string, value: string, description?: string): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;

  try {
    // Try to update first
    const updateResult = await db
      .update(systemConfig)
      .set({
        value,
        description: description || undefined,
        updatedAt: new Date().toISOString()
      })
      .where(eq(systemConfig.key, key));

    // If no rows updated, insert
    // Note: drizzle-orm with neon doesn't return rowCount, so we need to check differently
    // We'll use an upsert pattern by catching the error
    const existing = await getSystemConfig(key);
    if (existing === null) {
      await db.insert(systemConfig).values({
        key,
        value,
        description: description || null,
        updatedAt: new Date().toISOString(),
      });
    }

    return true;
  } catch (error) {
    console.error(`[DB] Error setting system config '${key}':`, error);
    return false;
  }
}
