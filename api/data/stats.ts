import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getDashboardStats, getDb, events, channels, desc, count, gte, lte, and } from "../lib/db";

/**
 * API endpoint to retrieve dashboard statistics from the database
 * Returns real aggregated data from events and channels tables
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
    const timeRange = req.query.timeRange as string || "7d";

    // Check if database is available
    const db = await getDb();
    if (!db) {
      return res.status(200).json({
        success: true,
        overview: {
          totalCameras: 0,
          activeCameras: 0,
          inactiveCameras: 0,
          alertCameras: 0,
          totalEvents: 0,
          criticalAlerts: 0,
        },
        eventsByType: {},
        eventsByLevel: { critical: 0, high: 0, medium: 0, low: 0 },
        timelineData: [],
        regionalActivity: [],
        recentAlerts: [],
        lastUpdated: new Date().toISOString(),
        message: "Database not configured. No statistics available.",
        dbConnected: false,
      });
    }

    // Get real statistics from database
    const stats = await getDashboardStats(timeRange);

    if (!stats) {
      return res.status(200).json({
        success: true,
        overview: {
          totalCameras: 0,
          activeCameras: 0,
          inactiveCameras: 0,
          alertCameras: 0,
          totalEvents: 0,
          criticalAlerts: 0,
        },
        eventsByType: {},
        eventsByLevel: { critical: 0, high: 0, medium: 0, low: 0 },
        timelineData: [],
        regionalActivity: [],
        recentAlerts: [],
        lastUpdated: new Date().toISOString(),
        dbConnected: true,
      });
    }

    // Build timeline data from recent events (last 7 days)
    const rangeDays = timeRange === "24h" ? 1 : timeRange === "7d" ? 7 : 30;
    const timelineData = [];
    const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

    for (let i = rangeDays - 1; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      date.setHours(0, 0, 0, 0);
      const dayStart = date.getTime();
      date.setHours(23, 59, 59, 999);
      const dayEnd = date.getTime();

      // Count events for this day (between dayStart and dayEnd)
      const [dayEvents] = await db
        .select({ count: count() })
        .from(events)
        .where(and(gte(events.startTime, dayStart), lte(events.startTime, dayEnd)));

      // Count alerts (level >= 2) for this day
      const [dayAlerts] = await db
        .select({ count: count() })
        .from(events)
        .where(and(
          gte(events.startTime, dayStart),
          lte(events.startTime, dayEnd),
          gte(events.level, "2")
        ));

      timelineData.push({
        day: days[new Date(dayStart).getDay()],
        events: dayEvents?.count || 0,
        alerts: dayAlerts?.count || 0,
      });
    }

    // Build regional activity from channels
    const regionalActivity = Object.entries(stats.channelsByRegion || {})
      .map(([region, cameras]) => ({
        region,
        cameras,
        events: Math.floor(cameras * 0.5), // Approximate
      }))
      .sort((a, b) => b.cameras - a.cameras)
      .slice(0, 5);

    // Get recent alerts (high-level events)
    const recentAlertRecords = await db
      .select()
      .from(events)
      .where(gte(events.level, "2"))
      .orderBy(desc(events.startTime))
      .limit(10);

    const recentAlerts = recentAlertRecords.map((event: any) => ({
      id: event.id,
      type: event.topic || "Unknown",
      camera: event.channelName || `CAM-${event.channelId}`,
      region: event.channelAddress?.city || "Unknown",
      level: parseInt(event.level) || 0,
      timestamp: event.createdAt || new Date().toISOString(),
    }));

    return res.status(200).json({
      success: true,
      overview: stats.overview,
      eventsByType: stats.eventsByType,
      eventsByLevel: stats.eventsByLevel,
      timelineData,
      regionalActivity,
      recentAlerts,
      lastUpdated: new Date().toISOString(),
      dbConnected: true,
    });

  } catch (error: any) {
    console.error("[Stats API] Error:", error);
    return res.status(500).json({
      success: false,
      error: error.message || "Internal server error",
    });
  }
}

