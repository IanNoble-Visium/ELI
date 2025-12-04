import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getChannelsList, getDb, channels, count, eq } from "../lib/db";

/**
 * API endpoint to retrieve camera/channel data from the database
 * Returns real camera locations from the channels table
 */

interface CameraData {
  id: string;
  name: string;
  type: string;
  latitude: number;
  longitude: number;
  address: {
    country?: string;
    region?: string;
    city?: string;
    district?: string;
    street?: string;
  };
  status: "active" | "inactive" | "alert";
  lastEventTime: string;
  eventCount: number;
  alertCount: number;
  tags?: { id: number; name: string }[];
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
        stats: {
          total: 0,
          active: 0,
          inactive: 0,
          alert: 0,
          byRegion: {},
        },
        cameras: [],
        message: "Database not configured. No camera data available.",
        dbConnected: false,
      });
    }

    // Parse query parameters
    const region = req.query.region as string;
    const status = req.query.status as string;
    const limit = parseInt(req.query.limit as string) || 500;

    // Query real camera data from database
    const channelRecords = await getChannelsList({
      region: region && region !== "all" ? region : undefined,
      status: status && status !== "all" ? status : undefined,
      limit,
    });

    // Transform database records to camera format
    const cameras: CameraData[] = channelRecords.map((record: any) => {
      const address = record.address || {};
      return {
        id: record.id,
        name: record.name || `CAM-${record.id}`,
        type: record.channelType || "STREAM",
        latitude: record.latitude || 0,
        longitude: record.longitude || 0,
        address: {
          country: address.country || "Peru",
          region: record.region || address.region || address.city,
          city: address.city || record.region,
          district: address.district,
          street: address.street,
        },
        status: (record.status as "active" | "inactive" | "alert") || "active",
        lastEventTime: record.updatedAt || new Date().toISOString(),
        eventCount: 0, // Would need to aggregate from events table
        alertCount: record.status === "alert" ? 1 : 0,
        tags: record.tags || [],
      };
    });

    // Calculate statistics from all channels (not just filtered)
    const [totalResult] = await db.select({ count: count() }).from(channels);
    const [activeResult] = await db.select({ count: count() }).from(channels).where(eq(channels.status, "active"));
    const [inactiveResult] = await db.select({ count: count() }).from(channels).where(eq(channels.status, "inactive"));
    const [alertResult] = await db.select({ count: count() }).from(channels).where(eq(channels.status, "alert"));

    // Get counts by region
    const regionCounts = await db
      .select({
        region: channels.region,
        count: count(),
      })
      .from(channels)
      .groupBy(channels.region);

    const byRegion: Record<string, number> = {};
    regionCounts.forEach((row: any) => {
      if (row.region) byRegion[row.region] = row.count;
    });

    const stats = {
      total: totalResult?.count || 0,
      active: activeResult?.count || 0,
      inactive: inactiveResult?.count || 0,
      alert: alertResult?.count || 0,
      byRegion,
    };

    return res.status(200).json({
      success: true,
      count: cameras.length,
      stats,
      cameras,
      dbConnected: true,
    });

  } catch (error: any) {
    console.error("[Cameras API] Error:", error);
    return res.status(500).json({
      success: false,
      error: error.message || "Internal server error",
      cameras: [],
    });
  }
}

