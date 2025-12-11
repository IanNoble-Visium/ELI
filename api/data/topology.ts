import type { VercelRequest, VercelResponse } from "@vercel/node";
import { isNeo4jConfigured } from "../lib/neo4j.js";
import { getTopologyFromNeo4j } from "./topology-neo4j.js";

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
  source: string;
  target: string;
  value: number;
  type: string;
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
    // Query topology data exclusively from Neo4j
    const neo4jData = await getTopologyFromNeo4j();
    
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

