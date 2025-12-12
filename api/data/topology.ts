import type { VercelRequest, VercelResponse } from "@vercel/node";
import { isNeo4jConfigured } from "../lib/neo4j.js";
import { getEventTimestampBoundsFromNeo4j, getTopologyFromNeo4j } from "./topology-neo4j.js";

/**
 * API endpoint to retrieve topology graph data from Neo4j
 * 
 * Database Architecture:
 * - Neo4j: ALL topology data (nodes, relationships, graph structure)
 * - InfluxDB: ALL time-series data (metrics, performance, historical)
 * - PostgreSQL: App config, webhooks, users, dashboard metadata only
 * 
 * Topology data is synced to Neo4j immediately on webhook receipt.
 * This endpoint queries Neo4j exclusively for graph visualization.
 */

interface GraphNode {
  id: string;
  name: string;
  type: "camera" | "location" | "vehicle" | "person" | "event";
  color: string;
  val: number;
  latitude?: number;
  longitude?: number;
  region?: string;
  eventCount?: number;
  imageUrl?: string;
  tags?: string[];
  objects?: string[];
  dominantColors?: string[];
  qualityScore?: number;
  channelId?: string;
  eventId?: string;
  timestamp?: number;
  // Gemini AI analysis properties
  geminiCaption?: string;
  geminiTags?: string[];
  geminiObjects?: string[];
  geminiPeopleCount?: number;
  geminiVehicles?: string[];
  geminiWeapons?: string[];
  geminiClothingColors?: string[];
  geminiLicensePlates?: string[];
  geminiTextExtracted?: string[];
  geminiQualityScore?: number;
  geminiBlurScore?: number;
  geminiTimeOfDay?: string;
  geminiLightingCondition?: string;
  geminiEnvironment?: string;
  geminiWeatherCondition?: string;
  geminiCameraPerspective?: string;
  geminiDominantColors?: string[];
  geminiProcessedAt?: number;
}

interface GraphLink {
  id?: string;
  source: string;
  target: string;
  value: number;
  type: string;
  properties?: Record<string, any>;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Set CORS headers
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const actionRaw = Array.isArray(req.query.action) ? req.query.action[0] : req.query.action;
  const action = actionRaw != null ? String(actionRaw) : null;

  const neo4jAvailable = isNeo4jConfigured();

  // Neo4j is required for topology data
  if (!neo4jAvailable) {
    return res.status(200).json({
      success: true,
      nodes: [],
      links: [],
      stats: { cameras: 0, locations: 0, vehicles: 0, persons: 0, events: 0, edges: 0 },
      message: "Neo4j not configured. Topology data requires Neo4j database.",
      dbConnected: false,
      neo4jConnected: false,
      dataSource: "none",
    });
  }

  try {
    if (action === "bounds") {
      const bounds = await getEventTimestampBoundsFromNeo4j();
      return res.status(200).json({
        success: true,
        bounds: bounds ?? { minTs: null, maxTs: null, count: 0 },
        dbConnected: true,
        neo4jConnected: true,
        dataSource: "neo4j",
        lastUpdated: new Date().toISOString(),
      });
    }

    const startTsRaw = Array.isArray(req.query.startTs) ? req.query.startTs[0] : req.query.startTs;
    const endTsRaw = Array.isArray(req.query.endTs) ? req.query.endTs[0] : req.query.endTs;
    const cameraIdsRaw = Array.isArray(req.query.cameraIds) ? req.query.cameraIds[0] : req.query.cameraIds;
    const locationIdsRaw = Array.isArray(req.query.locationIds) ? req.query.locationIds[0] : req.query.locationIds;
    const maxEventsRaw = Array.isArray(req.query.maxEvents) ? req.query.maxEvents[0] : req.query.maxEvents;

    const startTs = startTsRaw != null ? Number.parseInt(String(startTsRaw), 10) : undefined;
    const endTs = endTsRaw != null ? Number.parseInt(String(endTsRaw), 10) : undefined;
    const cameraIds =
      cameraIdsRaw != null
        ? String(cameraIdsRaw)
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean)
        : undefined;
    const locationIds =
      locationIdsRaw != null
        ? String(locationIdsRaw)
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean)
        : undefined;
    const maxEventsParsed = maxEventsRaw != null ? Number.parseInt(String(maxEventsRaw), 10) : undefined;
    const maxEvents =
      maxEventsParsed != null && Number.isFinite(maxEventsParsed)
        ? Math.max(1, Math.min(20000, maxEventsParsed))
        : undefined;

    // Query topology data exclusively from Neo4j
    const neo4jData = await getTopologyFromNeo4j({
      startTs: Number.isFinite(startTs as number) ? (startTs as number) : undefined,
      endTs: Number.isFinite(endTs as number) ? (endTs as number) : undefined,
      cameraIds: cameraIds && cameraIds.length > 0 ? cameraIds : undefined,
      locationIds: locationIds && locationIds.length > 0 ? locationIds : undefined,
      maxEvents,
    });
    
    if (neo4jData && neo4jData.nodes.length > 0) {
      console.log(`[Topology API] Neo4j data: ${neo4jData.nodes.length} nodes, ${neo4jData.links.length} links`);
      return res.status(200).json({
        success: true,
        ...neo4jData,
        dbConnected: true,
        neo4jConnected: true,
        dataSource: "neo4j",
        lastUpdated: new Date().toISOString(),
      });
    }

    // Neo4j is configured but has no data yet
    return res.status(200).json({
      success: true,
      nodes: [],
      links: [],
      stats: { cameras: 0, locations: 0, vehicles: 0, persons: 0, events: 0, edges: 0 },
      message: "Neo4j connected but no topology data available. Data will populate as events are received.",
      dbConnected: true,
      neo4jConnected: true,
      dataSource: "neo4j",
      lastUpdated: new Date().toISOString(),
    });
  } catch (error) {
    console.error("[Topology API] Neo4j query error:", error);
    return res.status(500).json({
      success: false,
      nodes: [],
      links: [],
      stats: { cameras: 0, locations: 0, vehicles: 0, persons: 0, events: 0, edges: 0 },
      error: "Failed to fetch topology data from Neo4j",
      message: error instanceof Error ? error.message : "Unknown error",
      dbConnected: false,
      neo4jConnected: false,
    });
  }
}

// NOTE: PostgreSQL topology generation has been removed.
// All topology data is now stored and queried exclusively from Neo4j.
// Data is synced to Neo4j immediately on webhook receipt (see api/webhook/irex.ts).
// PostgreSQL retains only: app config, webhooks, users, dashboard metadata.

