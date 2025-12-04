import type { VercelRequest, VercelResponse } from "@vercel/node";
import {
  insertWebhookRequest,
  insertEvent,
  insertSnapshots,
  upsertChannel,
  getDb
} from "../lib/db.js";

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
    const rawBody = typeof req.body === "string" ? JSON.parse(req.body) : req.body;

    // Log the incoming webhook
    console.log("[Webhook IREX] Received:", JSON.stringify(rawBody, null, 2).substring(0, 500));

    // Handle both array and single object payloads
    // IREX sends an array of events, but we also support single events
    const events = Array.isArray(rawBody) ? rawBody : [rawBody];

    if (events.length === 0) {
      return res.status(400).json({ error: "Empty payload" });
    }

    let processedCount = 0;
    let errorCount = 0;
    const processedEventIds: string[] = [];

    // Try to persist to database
    const db = await getDb();

    for (const body of events) {
      try {
        // Validate required fields for each event
        if (!body.id || !body.channel) {
          console.warn("[Webhook IREX] Skipping event missing id or channel:", body.id);
          errorCount++;
          continue;
        }

        // Extract event and channel data
        eventId = String(body.event_id || body.id);
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

        if (db) {
          // 1. Upsert the channel/camera
          await upsertChannel(channelData);

          // 2. Insert the event
          const eventDbId = `evt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
          await insertEvent({
            id: eventDbId,
            eventId,
            monitorId: String(body.monitor_id || ""),
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

          processedEventIds.push(eventId);
          dbPersisted = true;
        }

        processedCount++;
      } catch (eventError: any) {
        console.error(`[Webhook IREX] Error processing event ${body.id}:`, eventError.message);
        errorCount++;
      }
    }

    // Calculate processing time
    const processingTime = Date.now() - startTime;

    // Log the webhook batch request
    if (db && dbPersisted) {
      try {
        await insertWebhookRequest({
          endpoint: "/api/webhook/irex",
          method: "POST",
          payload: { eventCount: events.length, processedEventIds },
          eventId: processedEventIds[0] || "batch",
          level: "1",
          module: "IREX",
          status: errorCount > 0 ? "partial" : "success",
          processingTime,
        });
        console.log(`[Webhook IREX] Batch persisted: ${processedCount}/${events.length} events in ${processingTime}ms`);
      } catch (logError: any) {
        console.error("[Webhook IREX] Failed to log batch:", logError.message);
      }
    } else if (!db) {
      console.warn("[Webhook IREX] Database not available - webhooks not persisted");
    }

    // Return success response
    return res.status(200).json({
      status: errorCount === 0 ? "success" : "partial",
      eventsReceived: events.length,
      eventsProcessed: processedCount,
      eventsErrored: errorCount,
      processingTime,
      persisted: dbPersisted,
      message: dbPersisted
        ? `Processed ${processedCount}/${events.length} events`
        : "Webhooks received (database unavailable)",
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


