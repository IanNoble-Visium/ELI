/**
 * Vercel Cron Job: Record Cloudinary Metrics
 * 
 * Runs every 15 minutes to record current Cloudinary usage to InfluxDB
 * for historical tracking and trend analysis.
 * 
 * Configure in vercel.json:
 * {
 *   "crons": [{
 *     "path": "/api/cron/record-cloudinary-metrics",
 *     "schedule": "*/15 * * * *"
 *   }]
 * }
 */
import type { VercelRequest, VercelResponse } from "@vercel/node";
import {
  isInfluxDBConfigured,
  writeMetricPoint,
  ensureBucketExists,
  CloudinaryMetricPoint,
} from "../lib/influxdb.js";

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
): Promise<void> {
  // Verify cron job authorization (Vercel adds this header for cron requests)
  const authHeader = req.headers.authorization;
  const isVercelCron = authHeader === `Bearer ${process.env.CRON_SECRET}`;
  const isManualTrigger = req.query.manual === "true" && process.env.NODE_ENV !== "production";

  // Allow manual triggers in development or authenticated cron requests
  if (!isVercelCron && !isManualTrigger && process.env.NODE_ENV === "production") {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const startTime = Date.now();
  const results: Record<string, any> = {
    timestamp: new Date().toISOString(),
    type: "cron_job",
    job: "record-cloudinary-metrics",
  };

  try {
    // Check if InfluxDB is configured
    if (!isInfluxDBConfigured()) {
      results.status = "skipped";
      results.reason = "InfluxDB not configured";
      res.status(200).json(results);
      return;
    }

    // Ensure bucket exists
    const bucketResult = await ensureBucketExists();
    if (!bucketResult.success) {
      results.status = "error";
      results.error = `Bucket setup failed: ${bucketResult.error}`;
      res.status(200).json(results);
      return;
    }

    // Check Cloudinary configuration
    const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
    const apiKey = process.env.CLOUDINARY_API_KEY;
    const apiSecret = process.env.CLOUDINARY_API_SECRET;

    if (!cloudName || !apiKey || !apiSecret) {
      results.status = "skipped";
      results.reason = "Cloudinary not configured";
      res.status(200).json(results);
      return;
    }

    // Fetch current usage from Cloudinary
    const auth = Buffer.from(`${apiKey}:${apiSecret}`).toString("base64");
    const usageResponse = await fetch(
      `https://api.cloudinary.com/v1_1/${cloudName}/usage`,
      {
        method: "GET",
        headers: {
          Authorization: `Basic ${auth}`,
          "Content-Type": "application/json",
        },
      }
    );

    if (!usageResponse.ok) {
      results.status = "error";
      results.error = `Cloudinary API error: ${usageResponse.status}`;
      res.status(200).json(results);
      return;
    }

    const usageData = await usageResponse.json();

    // Calculate total credits used
    let totalCreditsUsed = usageData.credits?.used || 0;
    if (totalCreditsUsed === 0) {
      totalCreditsUsed = 
        (usageData.storage?.credits_usage || 0) +
        (usageData.bandwidth?.credits_usage || 0) +
        (usageData.transformations?.credits_usage || 0);
    }

    // Create metric point
    const metricPoint: CloudinaryMetricPoint = {
      timestamp: new Date(),
      credits_used: totalCreditsUsed,
      credits_limit: usageData.credits?.limit || 0,
      credits_percent: usageData.credits?.limit
        ? (totalCreditsUsed / usageData.credits.limit) * 100
        : 0,
      storage_bytes: usageData.storage?.usage || 0,
      storage_credits: usageData.storage?.credits_usage || 0,
      bandwidth_bytes: usageData.bandwidth?.usage || 0,
      bandwidth_credits: usageData.bandwidth?.credits_usage || 0,
      transformations_count: usageData.transformations?.usage || 0,
      transformations_credits: usageData.transformations?.credits_usage || 0,
      resources_count: usageData.resources || 0,
      derived_resources_count: usageData.derived_resources || 0,
    };

    // Write to InfluxDB
    const writeResult = await writeMetricPoint(metricPoint);

    if (!writeResult.success) {
      results.status = "error";
      results.error = `Write failed: ${writeResult.error}`;
      res.status(200).json(results);
      return;
    }

    // Success
    results.status = "success";
    results.metrics = {
      credits_used: metricPoint.credits_used,
      credits_limit: metricPoint.credits_limit,
      storage_bytes: metricPoint.storage_bytes,
      resources_count: metricPoint.resources_count,
    };
    results.duration_ms = Date.now() - startTime;

    console.log(`[Cron] Recorded Cloudinary metrics: ${metricPoint.credits_used} credits used`);
    res.status(200).json(results);

  } catch (error) {
    console.error("[Cron] Error recording metrics:", error);
    results.status = "error";
    results.error = error instanceof Error ? error.message : "Unknown error";
    results.duration_ms = Date.now() - startTime;
    res.status(500).json(results);
  }
}

