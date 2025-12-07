import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getRecentEvents, getEventCounts, getDb } from "../lib/db.js";

/**
 * API endpoint to retrieve surveillance events from the database
 * Returns real events from the events table
 */

interface EventData {
  id: string;
  eventId: string;
  topic: string;
  module: string;
  level: number;
  startTime: number;
  endTime?: number;
  channel: {
    id: string;
    name: string;
    type: string;
    latitude?: number;
    longitude?: number;
    address?: {
      country?: string;
      region?: string;
      city?: string;
      street?: string;
    };
  };
  params?: any;
  snapshotsCount: number;
  hasImages: boolean;
  receivedAt: string;
  processingTime: number;
}

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
    // Check if database is available
    const db = await getDb();
    if (!db) {
      return res.status(200).json({
        success: true,
        count: 0,
        events: [],
        message: "Database not configured. No event data available.",
        dbConnected: false,
      });
    }

    // Parse query parameters
    const limit = parseInt(req.query.limit as string) || 100;
    const level = req.query.level as string;
    const topic = req.query.topic as string;
    const region = req.query.region as string;

    // Query real events from database
    const eventRecords = await getRecentEvents({
      limit: limit * 2, // Get extra for filtering
      level: level && level !== "all" ? level : undefined,
      topic: topic && topic !== "all" ? topic : undefined,
    });

    // Transform database records to event format
    let events: EventData[] = eventRecords.map((record: any) => {
      const address = record.channelAddress || {};
      return {
        id: record.id,
        eventId: record.eventId || record.id,
        topic: record.topic || "Unknown",
        module: record.module || "Unknown",
        level: parseInt(record.level) || 0,
        startTime: record.startTime || Date.now(),
        endTime: record.endTime,
        channel: {
          id: record.channelId || "",
          name: record.channelName || `CAM-${record.channelId}`,
          type: record.channelType || "STREAM",
          latitude: record.latitude,
          longitude: record.longitude,
          address: {
            country: address.country || "Peru",
            region: address.region || address.city,
            city: address.city,
            street: address.street,
          },
        },
        params: record.params || {},
        snapshotsCount: 0, // Would need to count from snapshots table
        hasImages: false,
        receivedAt: record.createdAt || new Date().toISOString(),
        processingTime: 0,
      };
    });

    // Apply region filter (can't easily do in DB query due to JSON field)
    if (region && region !== "all") {
      events = events.filter(e =>
        e.channel.address?.city === region ||
        e.channel.address?.region === region
      );
    }

    // Limit results
    events = events.slice(0, limit);

    // Get total counts from database (not limited)
    const stats = await getEventCounts();

    return res.status(200).json({
      success: true,
      count: events.length,
      totalCount: stats.total,
      stats: {
        total: stats.total,
        critical: stats.critical,
        high: stats.high,
        faces: stats.faces,
        plates: stats.plates,
      },
      events,
      dbConnected: true,
    });

  } catch (error: any) {
    console.error("[Events API] Error:", error);
    return res.status(500).json({
      success: false,
      error: error.message || "Internal server error",
      events: [],
    });
  }
}





