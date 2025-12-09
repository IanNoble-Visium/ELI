import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getDb, getChannelsList, getRecentEvents, count, sql } from "../lib/db.js";
import { events, channels } from "../../drizzle/schema.js";
import { isNeo4jConfigured } from "../lib/neo4j.js";
import { getTopologyFromNeo4j } from "./topology-neo4j.js";

/**
 * API endpoint to retrieve topology graph data from the database
 * Uses Neo4j when configured (includes image URLs), falls back to PostgreSQL
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

  try {
    const neo4jConnected = isNeo4jConfigured();

    // Try Neo4j first if configured (has image URLs and analysis data)
    if (neo4jConnected) {
      try {
        const neo4jData = await getTopologyFromNeo4j();
        if (neo4jData && neo4jData.nodes.length > 0) {
          console.log(`[Topology API] Using Neo4j data: ${neo4jData.nodes.length} nodes, ${neo4jData.links.length} links`);
          return res.status(200).json({
            success: true,
            ...neo4jData,
            dbConnected: true,
            neo4jConnected: true,
            dataSource: "neo4j",
            lastUpdated: new Date().toISOString(),
          });
        }
      } catch (neo4jError) {
        console.warn("[Topology API] Neo4j query failed, falling back to PostgreSQL:", neo4jError);
      }
    }

    // Fall back to PostgreSQL
    const db = await getDb();

    if (!db) {
      return res.status(200).json({
        success: true,
        nodes: [],
        links: [],
        stats: { cameras: 0, locations: 0, vehicles: 0, persons: 0, events: 0, edges: 0 },
        message: "Database not configured. No topology data available.",
        dbConnected: false,
        neo4jConnected,
        dataSource: "none",
      });
    }

    console.log("[Topology API] Using PostgreSQL fallback data");

    // Fetch cameras/channels
    const channelsList = await getChannelsList({ limit: 200 });

    // Fetch recent events
    const eventsList = await getRecentEvents({ limit: 500 });

    const nodes: GraphNode[] = [];
    const links: GraphLink[] = [];
    const locationMap = new Map<string, string>(); // region -> nodeId
    const vehicleMap = new Map<string, string>(); // plate -> nodeId
    const personMap = new Map<string, string>(); // faceId -> nodeId

    // Create camera nodes
    channelsList.forEach((channel: any) => {
      const eventCount = eventsList.filter((e: any) => e.channelId === channel.id).length;
      nodes.push({
        id: `camera-${channel.id}`,
        name: channel.name || `Camera ${channel.id}`,
        type: "camera",
        color: "#10B981", // Green
        val: Math.max(5, Math.min(15, 5 + eventCount)),
        latitude: channel.latitude,
        longitude: channel.longitude,
        region: channel.region,
        eventCount,
      });

      // Create location nodes for unique regions
      const region = channel.region || (channel.address as any)?.city || "Unknown";
      if (region && !locationMap.has(region)) {
        const locationId = `location-${region.replace(/\s+/g, "-").toLowerCase()}`;
        locationMap.set(region, locationId);
        nodes.push({
          id: locationId,
          name: region,
          type: "location",
          color: "#8B5CF6", // Purple
          val: 12,
          region,
        });
      }

      // Link camera to its location
      if (region && locationMap.has(region)) {
        links.push({
          source: `camera-${channel.id}`,
          target: locationMap.get(region)!,
          value: 2,
          type: "located_at",
        });
      }
    });

    // Process events to create vehicle/person nodes and links
    eventsList.forEach((event: any) => {
      const params = event.params as any;
      const cameraNodeId = `camera-${event.channelId}`;

      // Check if camera node exists
      const cameraExists = nodes.some(n => n.id === cameraNodeId);
      if (!cameraExists) return;

      // Extract plate from PlateMatched/PlateNotMatched events
      if (event.topic?.includes("Plate") && params?.plate?.value) {
        const plate = params.plate.value.toUpperCase();
        if (!vehicleMap.has(plate)) {
          const vehicleId = `vehicle-${plate}`;
          vehicleMap.set(plate, vehicleId);
          nodes.push({
            id: vehicleId,
            name: `Vehicle: ${plate}`,
            type: "vehicle",
            color: "#F59E0B", // Orange
            val: 8,
          });
        }
        // Link vehicle to camera
        links.push({
          source: vehicleMap.get(plate)!,
          target: cameraNodeId,
          value: 3,
          type: "detected",
        });
      }

      // Extract face from FaceMatched/FaceNotMatched events
      if (event.topic?.includes("Face") && params?.face) {
        const faceId = params.face.id?.toString() || `face-${event.id}`;
        if (!personMap.has(faceId)) {
          const personNodeId = `person-${faceId}`;
          personMap.set(faceId, personNodeId);
          nodes.push({
            id: personNodeId,
            name: `Person ${personMap.size}`,
            type: "person",
            color: "#3B82F6", // Blue
            val: 7,
          });
        }
        // Link person to camera
        links.push({
          source: personMap.get(faceId)!,
          target: cameraNodeId,
          value: 3,
          type: "observed",
        });
      }
    });

    // Calculate stats
    const stats = {
      cameras: nodes.filter(n => n.type === "camera").length,
      locations: nodes.filter(n => n.type === "location").length,
      vehicles: nodes.filter(n => n.type === "vehicle").length,
      persons: nodes.filter(n => n.type === "person").length,
      events: eventsList.length,
      edges: links.length,
    };

    return res.status(200).json({
      success: true,
      nodes,
      links,
      stats,
      dbConnected: true,
      neo4jConnected,
      dataSource: "postgresql",
      lastUpdated: new Date().toISOString(),
    });
  } catch (error) {
    console.error("[Topology API] Error:", error);
    return res.status(500).json({
      success: false,
      error: "Failed to fetch topology data",
      message: error instanceof Error ? error.message : "Unknown error",
    });
  }
}

