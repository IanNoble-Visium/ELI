/**
 * Vercel Cron Job: Record Throttle Metrics
 * 
 * Runs every 5 minutes to record image processing throttle metrics to InfluxDB
 * for tracking processed vs skipped images over time.
 */
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { recordThrottleMetrics, getThrottleConfig } from "../cloudinary/throttle.js";
import { recordJobExecution } from "./status.js";

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
): Promise<void> {
  // Verify cron job authorization
  const authHeader = req.headers.authorization;
  const isVercelCron = authHeader === `Bearer ${process.env.CRON_SECRET}`;
  const isManualTrigger = req.query.manual === "true" && process.env.NODE_ENV !== "production";

  if (!isVercelCron && !isManualTrigger && process.env.NODE_ENV === "production") {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const startTime = Date.now();
  const results: Record<string, any> = {
    timestamp: new Date().toISOString(),
    type: "cron_job",
    job: "record-throttle-metrics",
  };

  try {
    const config = getThrottleConfig();
    
    // Record throttle metrics to InfluxDB
    await recordThrottleMetrics();

    results.status = "success";
    results.config = {
      enabled: config.enabled,
      processRatio: config.processRatio,
      description: config.description,
    };
    results.duration_ms = Date.now() - startTime;

    // Record execution for monitoring
    recordJobExecution(
      "record-throttle-metrics",
      "success",
      results.duration_ms,
      `Recorded throttle metrics (${config.enabled ? 'enabled' : 'disabled'})`
    );

    console.log(`[Cron] Recorded throttle metrics: ${config.description}`);
    res.status(200).json(results);

  } catch (error) {
    console.error("[Cron] Error recording throttle metrics:", error);
    results.status = "error";
    results.error = error instanceof Error ? error.message : "Unknown error";
    results.duration_ms = Date.now() - startTime;

    recordJobExecution(
      "record-throttle-metrics",
      "error",
      results.duration_ms,
      results.error
    );

    res.status(500).json(results);
  }
}


