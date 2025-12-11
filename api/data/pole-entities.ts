import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getDb, desc, eq, count, sql } from "../lib/db.js";
import { pgTable, varchar, text, jsonb, timestamp, index } from "drizzle-orm/pg-core";

// Local table definition matching the actual database schema (camelCase column names)
const poleEntities = pgTable("pole_entities", {
  id: varchar({ length: 255 }).primaryKey().notNull(),
  entityType: varchar({ length: 50 }).notNull(),
  name: varchar({ length: 500 }),
  description: text(),
  attributes: jsonb(),
  threatLevel: varchar({ length: 50 }),
  relatedEntities: jsonb(),
  createdAt: timestamp({ mode: 'string' }).defaultNow().notNull(),
  updatedAt: timestamp({ mode: 'string' }).defaultNow().notNull(),
});

// Import incidents table for linking
const incidents = pgTable("incidents", {
  id: varchar({ length: 255 }).primaryKey().notNull(),
  incidentType: varchar("incident_type", { length: 100 }).notNull(),
  priority: varchar({ length: 50 }).notNull(),
  status: varchar({ length: 50 }).default('open').notNull(),
  location: varchar({ length: 500 }),
  region: varchar({ length: 100 }),
  latitude: varchar({ length: 50 }),
  longitude: varchar({ length: 50 }),
  description: text(),
  createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
});

// Import events table for linking
const events = pgTable("events", {
  id: varchar({ length: 255 }).primaryKey().notNull(),
  topic: varchar({ length: 500 }),
  channelId: varchar("channel_id", { length: 255 }),
  channelName: varchar("channel_name", { length: 500 }),
  startTime: varchar("start_time", { length: 50 }),
  params: jsonb(),
  createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
});

/**
 * API endpoint to fetch POLE entities from the database
 * 
 * This replaces the hardcoded mock data with real database queries.
 * Returns empty arrays when no data exists (after database purge).
 * 
 * Endpoints:
 * - GET /api/data/pole-entities - Get all POLE entities with stats
 * - GET /api/data/pole-entities?type=person - Filter by entity type
 * - GET /api/data/pole-entities?id=P-001 - Get specific entity
 * - GET /api/data/pole-entities?stats=true - Get only statistics
 */

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Set CORS headers
  res.setHeader("Access-Control-Allow-Origin", req.headers.origin || "*");
  res.setHeader("Access-Control-Allow-Credentials", "true");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const db = await getDb();

    // If database is not configured, return empty data
    if (!db) {
      return res.status(200).json({
        success: true,
        dbConnected: false,
        message: "Database not configured",
        entities: [],
        stats: {
          people: 0,
          objects: 0,
          locations: 0,
          events: 0,
          highRisk: 0,
          totalLinks: 0,
        },
        graphData: {
          nodes: [],
          links: [],
        },
      });
    }

    const { type, id, stats: statsOnly, limit = "500" } = req.query;

    // If requesting stats only
    if (statsOnly === "true") {
      const statsResult = await getEntityStats(db);
      return res.status(200).json({
        success: true,
        dbConnected: true,
        stats: statsResult,
      });
    }

    // If requesting a specific entity
    if (id && typeof id === "string") {
      const entity = await db
        .select()
        .from(poleEntities)
        .where(eq(poleEntities.id, id))
        .limit(1);

      if (entity.length === 0) {
        return res.status(404).json({
          success: false,
          error: `Entity not found: ${id}`,
        });
      }

      return res.status(200).json({
        success: true,
        dbConnected: true,
        entity: entity[0],
      });
    }

    // Build query for entities
    let query = db.select().from(poleEntities);

    // Filter by type if specified
    if (type && typeof type === "string") {
      query = query.where(eq(poleEntities.entityType, type)) as any;
    }

    // Execute query with limit
    const entitiesList = await query
      .orderBy(desc(poleEntities.createdAt))
      .limit(parseInt(limit as string));

    // Get statistics
    const statsResult = await getEntityStats(db);

    // Generate graph data from entities
    const graphData = generateGraphData(entitiesList);

    // Get related incidents count
    const [incidentCountResult] = await db
      .select({ count: count() })
      .from(incidents);

    // Get related events count (POLE-relevant topics)
    const poleTopics = ['PlateMatched', 'FaceMatched', 'PersonDetected', 'VehicleDetected'];
    const [eventCountResult] = await db
      .select({ count: count() })
      .from(events)
      .where(sql`${events.topic} = ANY(${poleTopics})`);

    return res.status(200).json({
      success: true,
      dbConnected: true,
      entities: entitiesList,
      stats: {
        ...statsResult,
        linkedIncidents: incidentCountResult?.count || 0,
        linkedEvents: eventCountResult?.count || 0,
      },
      graphData,
      message: entitiesList.length === 0
        ? "No POLE entities found in database. Data will appear when events are processed."
        : undefined,
    });

  } catch (error: any) {
    console.error("[POLE Entities API] Error:", error);
    return res.status(500).json({
      success: false,
      error: error.message || "Internal server error",
      entities: [],
      stats: {
        people: 0,
        objects: 0,
        locations: 0,
        events: 0,
        highRisk: 0,
        totalLinks: 0,
      },
      graphData: {
        nodes: [],
        links: [],
      },
    });
  }
}

/**
 * Get entity statistics from database
 */
async function getEntityStats(db: any) {
  try {
    // Count by entity type
    const typeCountsResult = await db
      .select({
        entityType: poleEntities.entityType,
        count: count(),
      })
      .from(poleEntities)
      .groupBy(poleEntities.entityType);

    // Count high risk entities
    const [highRiskResult] = await db
      .select({ count: count() })
      .from(poleEntities)
      .where(eq(poleEntities.threatLevel, "high"));

    // Build stats object
    const stats: Record<string, number> = {
      people: 0,
      objects: 0,
      locations: 0,
      events: 0,
      highRisk: highRiskResult?.count || 0,
      totalLinks: 0,
    };

    typeCountsResult.forEach((row: any) => {
      if (row.entityType === "person") stats.people = row.count;
      else if (row.entityType === "object") stats.objects = row.count;
      else if (row.entityType === "location") stats.locations = row.count;
      else if (row.entityType === "event") stats.events = row.count;
    });

    // Count total relationships
    const allEntities = await db.select().from(poleEntities);
    let totalLinks = 0;
    allEntities.forEach((entity: any) => {
      if (entity.relatedEntities && Array.isArray(entity.relatedEntities)) {
        totalLinks += entity.relatedEntities.length;
      }
    });
    stats.totalLinks = totalLinks;

    return stats;
  } catch (error) {
    console.error("[POLE Entities API] Error getting stats:", error);
    return {
      people: 0,
      objects: 0,
      locations: 0,
      events: 0,
      highRisk: 0,
      totalLinks: 0,
    };
  }
}

/**
 * Generate graph data for visualization
 */
function generateGraphData(entities: any[]) {
  const NODE_COLORS: Record<string, string> = {
    person: "#3B82F6",    // Blue
    object: "#F59E0B",    // Orange
    location: "#8B5CF6",  // Purple
    event: "#EF4444",     // Red
  };

  const nodes = entities.map((entity) => ({
    id: entity.id,
    name: entity.name || entity.id,
    type: entity.entityType,
    color: NODE_COLORS[entity.entityType] || "#6B7280",
    val: entity.threatLevel === "high" ? 12 : entity.threatLevel === "medium" ? 9 : 6,
    riskLevel: entity.threatLevel,
    description: entity.description,
    attributes: entity.attributes,
  }));

  // Generate links from relatedEntities
  const links: any[] = [];
  const nodeIds = new Set(entities.map(e => e.id));

  entities.forEach((entity) => {
    if (entity.relatedEntities && Array.isArray(entity.relatedEntities)) {
      entity.relatedEntities.forEach((rel: any) => {
        // Only add link if target exists in our node set
        if (rel.targetId && nodeIds.has(rel.targetId)) {
          links.push({
            source: entity.id,
            target: rel.targetId,
            type: rel.type || "RELATED_TO",
            label: rel.label || "Related",
            value: rel.strength || 3,
          });
        }
      });
    }
  });

  return { nodes, links };
}
