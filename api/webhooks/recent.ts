import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getRecentWebhooks, getDb } from "../lib/db.js";

/**
 * API endpoint to retrieve recent webhook requests from the database
 * Returns real data from webhook_requests table
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Set CORS headers
  const origin = req.headers.origin || "*";
  res.setHeader("Access-Control-Allow-Origin", origin);
  res.setHeader("Access-Control-Allow-Credentials", "true");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, Cookie");

  // Handle preflight
  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  // Only accept GET requests
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const limit = parseInt(req.query.limit as string) || 100;

    // Check if database is available
    const db = await getDb();
    if (!db) {
      return res.status(200).json({
        success: true,
        count: 0,
        webhooks: [],
        message: "Database not configured. No webhook data available.",
        dbConnected: false,
      });
    }

    // Query real webhook data from database
    const webhookRecords = await getRecentWebhooks(limit);

    // Transform database records to match frontend expected format
    const webhooks = webhookRecords.map((record: any) => {
      const payload = record.payload || {};
      const channel = payload.channel || {};

      return {
        id: `webhook_${record.id}`,
        receivedAt: record.createdAt,
        processingTime: record.processingTime || 0,
        status: record.status || "success",

        eventId: record.eventId || payload.event_id || payload.id,
        monitorId: payload.monitor_id,
        topic: payload.topic || "Unknown",
        module: record.module || payload.module || "Unknown",
        level: parseInt(record.level) || payload.level || 1,
        startTime: payload.start_time,
        endTime: payload.end_time,

        channel: {
          id: channel.id,
          name: channel.name,
          type: channel.channel_type || "STREAM",
          latitude: channel.latitude,
          longitude: channel.longitude,
          address: channel.address || {},
        },

        params: payload.params || {},
        snapshotsCount: payload.snapshots?.length || 0,
        hasImages: payload.snapshots?.some((s: any) => s.image) || false,
        payloadSize: JSON.stringify(payload).length,
      };
    });

    return res.status(200).json({
      success: true,
      count: webhooks.length,
      webhooks,
      dbConnected: true,
    });

  } catch (error: any) {
    console.error("[Webhooks Recent] Error:", error);
    return res.status(500).json({
      success: false,
      error: error.message || "Internal server error",
      webhooks: [],
    });
  }
}






