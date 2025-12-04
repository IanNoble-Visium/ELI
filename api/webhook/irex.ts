import type { VercelRequest, VercelResponse } from "@vercel/node";
import {
  insertWebhookRequest,
  insertEvent,
  insertSnapshots,
  upsertChannel,
  getDb
} from "../lib/db";

// Vercel serverless handler for IREX webhooks
// Persists all incoming webhooks to PostgreSQL/TiDB database
export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Set CORS headers
  const origin = req.headers.origin || "*";
  res.setHeader("Access-Control-Allow-Origin", origin);
  res.setHeader("Access-Control-Allow-Credentials", "true");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  // Handle preflight
  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  // Only accept POST requests
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const startTime = Date.now();
  let eventId: string | undefined;
  let dbPersisted = false;

  try {
    const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body;

    // Log the incoming webhook
    console.log("[Webhook IREX] Received:", JSON.stringify(body, null, 2).substring(0, 500));

    // Validate required fields
    if (!body.id || !body.channel) {
      return res.status(400).json({
        error: "Missing required fields: id and channel are required"
      });
    }

    // Extract event and channel data
    eventId = body.event_id || body.id;
    const topic = body.topic || "Unknown";
    const module = body.module || "Unknown";
    const level = String(body.level ?? 1);

    const channelData = {
      id: String(body.channel?.id || body.channel_id || `ch_${Date.now()}`),
      name: body.channel?.name || body.channel_name,
      channelType: body.channel?.channel_type || body.channel_type || "STREAM",
      latitude: body.channel?.latitude || body.channel_latitude,
      longitude: body.channel?.longitude || body.channel_longitude,
      address: body.channel?.address || body.channel_address,
      tags: body.channel?.tags,
      status: "active",
      region: body.channel?.address?.city || body.channel?.address?.region || null,
    };

    // Calculate processing time
    const processingTime = Date.now() - startTime;

    // Try to persist to database
    const db = await getDb();
    if (db) {
      try {
        // 1. Upsert the channel/camera
        await upsertChannel(channelData);

        // 2. Insert the event
        const eventDbId = `evt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        await insertEvent({
          id: eventDbId,
          eventId,
          monitorId: body.monitor_id,
          topic,
          module,
          level,
          startTime: body.start_time,
          endTime: body.end_time,
          latitude: channelData.latitude,
          longitude: channelData.longitude,
          channelId: channelData.id,
          channelType: channelData.channelType,
          channelName: channelData.name,
          channelAddress: channelData.address,
          params: body.params || null,
          tags: body.channel?.tags || null,
        });

        // 3. Insert snapshots if present
        if (body.snapshots && Array.isArray(body.snapshots) && body.snapshots.length > 0) {
          await insertSnapshots(eventDbId, body.snapshots);
        }

        // 4. Insert webhook request log
        await insertWebhookRequest({
          endpoint: "/api/webhook/irex",
          method: "POST",
          payload: body,
          eventId,
          level,
          module,
          status: "success",
          processingTime,
        });

        dbPersisted = true;
        console.log(`[Webhook IREX] Persisted to DB in ${processingTime}ms - Event: ${eventId}, Topic: ${topic}`);
      } catch (dbError: any) {
        console.error("[Webhook IREX] Database error (continuing):", dbError.message);
        // Still return success to the caller - don't fail the webhook due to DB issues
      }
    } else {
      console.warn("[Webhook IREX] Database not available - webhook not persisted");
    }

    // Return success response
    return res.status(200).json({
      status: "success",
      eventId,
      processingTime,
      persisted: dbPersisted,
      message: dbPersisted
        ? "Webhook received and persisted to database"
        : "Webhook received (database unavailable)",
    });

  } catch (error: any) {
    console.error("[Webhook IREX] Error:", error);

    // Try to log the error to database
    const db = await getDb();
    if (db) {
      try {
        await insertWebhookRequest({
          endpoint: "/api/webhook/irex",
          method: "POST",
          payload: null,
          eventId,
          status: "error",
          error: error.message,
          processingTime: Date.now() - startTime,
        });
      } catch (logError) {
        console.error("[Webhook IREX] Failed to log error:", logError);
      }
    }

    return res.status(500).json({
      status: "error",
      error: error.message || "Internal server error",
    });
  }
}

