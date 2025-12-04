import type { VercelRequest, VercelResponse } from "@vercel/node";

// In-memory store for recent webhooks (will be replaced with DB in production)
// Note: This will reset on each cold start, but works for demo purposes
const recentWebhooks: any[] = [];
const MAX_WEBHOOKS = 1000;

// Vercel serverless handler for IREX webhooks
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

  try {
    const startTime = Date.now();
    const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body;

    // Log the incoming webhook
    console.log("[Webhook IREX] Received:", JSON.stringify(body, null, 2).substring(0, 500));

    // Validate required fields
    if (!body.id || !body.channel) {
      return res.status(400).json({ 
        error: "Missing required fields: id and channel are required" 
      });
    }

    // Extract key information
    const webhookData = {
      id: `webhook_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      receivedAt: new Date().toISOString(),
      processingTime: 0,
      status: "success",
      
      // Event data
      eventId: body.event_id || body.id,
      monitorId: body.monitor_id,
      topic: body.topic || "Unknown",
      module: body.module || "Unknown",
      level: body.level ?? 1,
      startTime: body.start_time,
      endTime: body.end_time,
      
      // Channel/Camera data
      channel: {
        id: body.channel?.id,
        name: body.channel?.name || body.channel_name,
        type: body.channel?.channel_type || body.channel_type,
        latitude: body.channel?.latitude || body.channel_latitude,
        longitude: body.channel?.longitude || body.channel_longitude,
        address: body.channel?.address || body.channel_address,
        tags: body.channel?.tags,
      },
      
      // Params (identities, attributes, etc.)
      params: body.params || {},
      
      // Snapshots count (don't store full images in memory)
      snapshotsCount: body.snapshots?.length || 0,
      hasImages: body.snapshots?.some((s: any) => s.image) || false,
      
      // Raw payload size
      payloadSize: JSON.stringify(body).length,
    };

    // Calculate processing time
    webhookData.processingTime = Date.now() - startTime;

    // Store in memory (at the beginning for most recent first)
    recentWebhooks.unshift(webhookData);
    
    // Keep only the last MAX_WEBHOOKS entries
    if (recentWebhooks.length > MAX_WEBHOOKS) {
      recentWebhooks.pop();
    }

    console.log(`[Webhook IREX] Processed in ${webhookData.processingTime}ms - Event: ${webhookData.eventId}, Topic: ${webhookData.topic}`);

    // Return success response (matching old API format)
    return res.status(200).json({
      status: "success",
      eventId: webhookData.eventId,
      processingTime: webhookData.processingTime,
      message: "Webhook received and processed successfully",
    });

  } catch (error: any) {
    console.error("[Webhook IREX] Error:", error);
    return res.status(500).json({
      status: "error",
      error: error.message || "Internal server error",
    });
  }
}

// Export the recent webhooks for the API to access
export { recentWebhooks };

