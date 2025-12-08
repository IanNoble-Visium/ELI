import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getDb, getChannelsList, getRecentEvents, sql } from "../lib/db.js";
import { snapshots } from "../../drizzle/schema.js";
import { isNeo4jConfigured } from "../lib/neo4j.js";
import {
  getTopologyFromNeo4j,
  bulkSyncCameras,
  bulkSyncEvents,
  TopologyNode,
  TopologyLink,
} from "./topology-neo4j.js";

/**
 * API endpoint to retrieve topology graph data from the database
 * Uses hybrid approach:
 * - Neo4j: Graph relationships (when configured)
 * - PostgreSQL: Primary data storage, fallback for topology
 * 
 * Returns nodes with Cloudinary image URLs for events that have snapshots
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
  imageUrl?: string; // Cloudinary image URL
}

interface GraphLink {
  source: string;
  target: string;
  value: number;
  type: string;
}

interface TopologyResponse {
  success: boolean;
  nodes: GraphNode[];
  links: GraphLink[];
  stats: {
    cameras: number;
    locations: number;
    vehicles: number;
    persons: number;
    events: number;
    edges: number;
  };
  dbConnected: boolean;
  neo4jConnected: boolean;
  lastUpdated?: string;
  message?: string;
  error?: string;
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

  try {
    const db = await getDb();
    if (!db) {
      return res.status(200).json({
        success: true,
        nodes: [],
        links: [],
        stats: { cameras: 0, locations: 0, vehicles: 0, persons: 0, events: 0, edges: 0 },
        message: "Database not configured. No topology data available.",
        dbConnected: false,
        neo4jConnected: false,
      } as TopologyResponse);
    }

    // Try Neo4j first if available
    if (neo4jAvailable) {
      try {
        const neo4jData = await getTopologyFromNeo4j();
        if (neo4jData && neo4jData.nodes.length > 0) {
          return res.status(200).json({
            success: true,
            nodes: neo4jData.nodes,
            links: neo4jData.links,
            stats: neo4jData.stats,
            dbConnected: true,
            neo4jConnected: true,
            lastUpdated: new Date().toISOString(),
          } as TopologyResponse);
        }
      } catch (neo4jError) {
        console.warn("[Topology API] Neo4j query failed, falling back to PostgreSQL:", neo4jError);
      }
    }

    // Fallback to PostgreSQL-based topology generation
    const topologyData = await generateTopologyFromPostgres(db);

    // Sync to Neo4j in background if available (for future queries)
    if (neo4jAvailable && topologyData.nodes.length > 0) {
      syncToNeo4jBackground(topologyData.channelsList, topologyData.eventsWithImages);
    }

    return res.status(200).json({
      success: true,
      nodes: topologyData.nodes,
      links: topologyData.links,
      stats: topologyData.stats,
      dbConnected: true,
      neo4jConnected: neo4jAvailable,
      lastUpdated: new Date().toISOString(),
    } as TopologyResponse);
  } catch (error) {
    console.error("[Topology API] Error:", error);
    return res.status(500).json({
      success: false,
      nodes: [],
      links: [],
      stats: { cameras: 0, locations: 0, vehicles: 0, persons: 0, events: 0, edges: 0 },
      error: "Failed to fetch topology data",
      message: error instanceof Error ? error.message : "Unknown error",
      dbConnected: false,
      neo4jConnected: false,
    } as TopologyResponse);
  }
}

/**
 * Generate topology data from PostgreSQL
 * Includes event images from snapshots table
 */
async function generateTopologyFromPostgres(db: any): Promise<{
  nodes: GraphNode[];
  links: GraphLink[];
  stats: {
    cameras: number;
    locations: number;
    vehicles: number;
    persons: number;
    events: number;
    edges: number;
  };
  channelsList: any[];
  eventsWithImages: any[];
}> {
  // Fetch cameras/channels
  const channelsList = await getChannelsList({ limit: 200 });

  // Fetch recent events WITH snapshots/images
  const eventsList = await getRecentEvents({ limit: 500, includeSnapshots: true });

  // Get all snapshots with image URLs for quick lookup
  const snapshotsData = await db
    .select({
      eventId: snapshots.eventId,
      imageUrl: snapshots.imageUrl,
    })
    .from(snapshots)
    .where(sql`${snapshots.imageUrl} IS NOT NULL`);

  // Create a map of eventId -> imageUrl
  const eventImageMap = new Map<string, string>();
  snapshotsData.forEach((snap: any) => {
    if (snap.imageUrl && !eventImageMap.has(snap.eventId)) {
      eventImageMap.set(snap.eventId, snap.imageUrl);
    }
  });

  const nodes: GraphNode[] = [];
  const links: GraphLink[] = [];
  const locationMap = new Map<string, string>(); // region -> nodeId
  const vehicleMap = new Map<string, string>(); // plate -> nodeId
  const personMap = new Map<string, string>(); // faceId -> nodeId
  const eventNodeMap = new Map<string, string>(); // eventId -> nodeId

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

  // Process events to create vehicle/person/event nodes and links
  const eventsWithImages: any[] = [];
  
  eventsList.forEach((event: any) => {
    const params = event.params as any;
    const cameraNodeId = `camera-${event.channelId}`;

    // Check if camera node exists
    const cameraExists = nodes.some((n) => n.id === cameraNodeId);
    if (!cameraExists) return;

    // Check if this event has an image
    const imageUrl = eventImageMap.get(event.id) || 
                     (event.snapshots && event.snapshots[0]?.imageUrl);

    // Create event node if it has an image
    if (imageUrl) {
      const eventNodeId = `event-${event.id}`;
      if (!eventNodeMap.has(event.id)) {
        eventNodeMap.set(event.id, eventNodeId);
        nodes.push({
          id: eventNodeId,
          name: event.topic || "Event",
          type: "event",
          color: "#D91023", // Peru Red
          val: 10,
          imageUrl, // Include Cloudinary image URL
        });

        // Link event to camera
        links.push({
          source: eventNodeId,
          target: cameraNodeId,
          value: 3,
          type: "triggered",
        });

        eventsWithImages.push({
          ...event,
          imageUrl,
        });
      }
    }

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
    cameras: nodes.filter((n) => n.type === "camera").length,
    locations: nodes.filter((n) => n.type === "location").length,
    vehicles: nodes.filter((n) => n.type === "vehicle").length,
    persons: nodes.filter((n) => n.type === "person").length,
    events: nodes.filter((n) => n.type === "event").length,
    edges: links.length,
  };

  return {
    nodes,
    links,
    stats,
    channelsList,
    eventsWithImages,
  };
}

/**
 * Sync PostgreSQL data to Neo4j in background
 * This runs asynchronously and doesn't block the response
 */
function syncToNeo4jBackground(channelsList: any[], eventsWithImages: any[]) {
  // Run sync in background (don't await)
  Promise.resolve().then(async () => {
    try {
      // Sync cameras
      await bulkSyncCameras(
        channelsList.map((c) => ({
          id: c.id,
          name: c.name,
          latitude: c.latitude,
          longitude: c.longitude,
          region: c.region,
          status: c.status,
        }))
      );

      // Sync events with images
      await bulkSyncEvents(
        eventsWithImages.map((e) => ({
          id: e.id,
          eventId: e.eventId,
          topic: e.topic,
          channelId: e.channelId,
          startTime: e.startTime,
          params: e.params,
          imageUrl: e.imageUrl,
        }))
      );
    } catch (error) {
      console.error("[Topology API] Background Neo4j sync failed:", error);
    }
  });
}
