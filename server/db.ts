import { and, desc, eq, gte, lte, or, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import {
  users,
  events,
  snapshots,
  channels,
  aiInferenceJobs,
  aiDetections,
  aiAnomalies,
  aiBaselines,
  aiInsights,
  incidents,
  poleEntities,
  webhookRequests,
  systemConfig,
  incidentNotes,
  incidentTags,
  InsertIncidentNote,
  InsertIncidentTag,
} from "../drizzle/schema";
import { ENV } from "./_core/env";

let _db: ReturnType<typeof drizzle> | null = null;

// Lazily create the drizzle instance so local tooling can run without a DB.
export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

export async function upsertUser(user: typeof users.$inferInsert): Promise<void> {
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }

  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }

  try {
    const values: typeof users.$inferInsert = {
      openId: user.openId,
    };
    const updateSet: Record<string, unknown> = {};

    const textFields = ["name", "email", "loginMethod"] as const;
    type TextField = (typeof textFields)[number];

    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };

    textFields.forEach(assignNullable);

    if (user.lastSignedIn !== undefined) {
      values.lastSignedIn = user.lastSignedIn;
      updateSet.lastSignedIn = user.lastSignedIn;
    }
    if (user.role !== undefined) {
      values.role = user.role;
      updateSet.role = user.role;
    } else if (user.openId === ENV.ownerOpenId) {
      values.role = "admin";
      updateSet.role = "admin";
    }

    if (!values.lastSignedIn) {
      values.lastSignedIn = new Date();
    }

    if (Object.keys(updateSet).length === 0) {
      updateSet.lastSignedIn = new Date();
    }

    await db.insert(users).values(values).onDuplicateKeyUpdate({
      set: updateSet,
    });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get user: database not available");
    return undefined;
  }

  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);

  return result.length > 0 ? result[0] : undefined;
}

// ===== Events =====

export async function insertEvent(event: typeof events.$inferInsert) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db.insert(events).values(event).onDuplicateKeyUpdate({
    set: {
      ...event,
      createdAt: sql`createdAt`, // Keep original createdAt
    },
  });
}

export async function getEvents(filters?: {
  startTime?: number;
  endTime?: number;
  level?: string;
  module?: string;
  channelId?: string;
  limit?: number;
  offset?: number;
}) {
  const db = await getDb();
  if (!db) return [];

  let query = db.select().from(events);
  const conditions = [];

  if (filters?.startTime) {
    conditions.push(gte(events.startTime, filters.startTime));
  }
  if (filters?.endTime) {
    conditions.push(lte(events.startTime, filters.endTime));
  }
  if (filters?.level) {
    conditions.push(eq(events.level, filters.level));
  }
  if (filters?.module) {
    conditions.push(eq(events.module, filters.module));
  }
  if (filters?.channelId) {
    conditions.push(eq(events.channelId, filters.channelId));
  }

  if (conditions.length > 0) {
    query = query.where(and(...conditions)) as any;
  }

  query = query.orderBy(desc(events.startTime)) as any;

  if (filters?.limit) {
    query = query.limit(filters.limit) as any;
  }
  if (filters?.offset) {
    query = query.offset(filters.offset) as any;
  }

  return await query;
}

export async function getEventById(id: string) {
  const db = await getDb();
  if (!db) return null;

  const result = await db.select().from(events).where(eq(events.id, id)).limit(1);
  return result[0] || null;
}

// ===== Snapshots =====

export async function insertSnapshot(snapshot: typeof snapshots.$inferInsert) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db.insert(snapshots).values(snapshot).onDuplicateKeyUpdate({
    set: snapshot,
  });
}

export async function getSnapshotsByEventId(eventId: string) {
  const db = await getDb();
  if (!db) return [];

  return await db.select().from(snapshots).where(eq(snapshots.eventId, eventId));
}

// ===== Channels =====

export async function upsertChannel(channel: typeof channels.$inferInsert) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db.insert(channels).values(channel).onDuplicateKeyUpdate({
    set: channel,
  });
}

export async function getChannels(filters?: {
  region?: string;
  status?: string;
  limit?: number;
}) {
  const db = await getDb();
  if (!db) return [];

  let query = db.select().from(channels);
  const conditions = [];

  if (filters?.region) {
    conditions.push(eq(channels.region, filters.region));
  }
  if (filters?.status) {
    conditions.push(eq(channels.status, filters.status));
  }

  if (conditions.length > 0) {
    query = query.where(and(...conditions)) as any;
  }

  if (filters?.limit) {
    query = query.limit(filters.limit) as any;
  }

  return await query;
}

// ===== Webhook Requests =====

export async function insertWebhookRequest(request: typeof webhookRequests.$inferInsert) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const result = await db.insert(webhookRequests).values(request);
  return result;
}

export async function getRecentWebhookRequests(limit: number = 100) {
  const db = await getDb();
  if (!db) return [];

  return await db
    .select()
    .from(webhookRequests)
    .orderBy(desc(webhookRequests.createdAt))
    .limit(limit);
}

// ===== System Config =====

export async function getSystemConfig(key: string) {
  const db = await getDb();
  if (!db) return null;

  const result = await db.select().from(systemConfig).where(eq(systemConfig.key, key)).limit(1);
  return result[0] || null;
}

export async function setSystemConfig(key: string, value: string, description?: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db.insert(systemConfig).values({ key, value, description }).onDuplicateKeyUpdate({
    set: { value, description, updatedAt: new Date() },
  });
}

// ===== Dashboard Metrics =====

export async function getDashboardMetrics(startTime?: number, endTime?: number) {
  const db = await getDb();
  if (!db) return null;

  const conditions = [];
  if (startTime) conditions.push(gte(events.startTime, startTime));
  if (endTime) conditions.push(lte(events.startTime, endTime));

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  const [totalEvents] = await db
    .select({ count: sql<number>`count(*)` })
    .from(events)
    .where(whereClause);

  const [totalChannels] = await db
    .select({ count: sql<number>`count(*)` })
    .from(channels);

  const [activeChannels] = await db
    .select({ count: sql<number>`count(*)` })
    .from(channels)
    .where(eq(channels.status, "active"));

  return {
    totalEvents: totalEvents?.count || 0,
    totalChannels: totalChannels?.count || 0,
    activeChannels: activeChannels?.count || 0,
  };
}

// ===== Incident Notes =====

export async function getIncidentNotes(incidentId: string) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(incidentNotes).where(eq(incidentNotes.incidentId, incidentId)).orderBy(desc(incidentNotes.createdAt));
}

export async function addIncidentNote(note: InsertIncidentNote) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(incidentNotes).values(note);
  return result;
}

export async function deleteIncidentNote(noteId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.delete(incidentNotes).where(eq(incidentNotes.id, noteId));
}

// ===== Incident Tags =====

export async function getIncidentTags(incidentId: string) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(incidentTags).where(eq(incidentTags.incidentId, incidentId));
}

export async function addIncidentTag(tag: InsertIncidentTag) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(incidentTags).values(tag);
  return result;
}

export async function deleteIncidentTag(tagId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.delete(incidentTags).where(eq(incidentTags.id, tagId));
}

export async function getAllTags() {
  const db = await getDb();
  if (!db) return [];
  // Get unique tags
  const tags = await db.select().from(incidentTags);
  const uniqueTags = Array.from(new Set(tags.map(t => t.tag)));
  return uniqueTags;
}
