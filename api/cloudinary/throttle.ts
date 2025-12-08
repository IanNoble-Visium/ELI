/**
 * Cloudinary Throttle Configuration API
 * 
 * Manages image processing throttle settings to prevent exceeding
 * Cloudinary usage limits during demo/development phases.
 * 
 * Endpoints:
 * - GET: Retrieve current throttle configuration
 * - POST: Update throttle configuration
 * - GET ?action=stats: Get processing statistics
 */
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { isInfluxDBConfigured, writeMetricPoint } from "../lib/influxdb.js";

// Throttle configuration interface
export interface ThrottleConfig {
  enabled: boolean;
  // Ratio: how many images to process per 100,000 incoming
  // Default: 250 per 100,000 = 0.25%
  processRatio: number;
  // Maximum images to process per hour (hard limit)
  maxPerHour: number;
  // Sampling method: 'random' | 'interval' | 'first'
  samplingMethod: 'random' | 'interval' | 'first';
  // Last updated timestamp
  lastUpdated: string;
  // Description for UI
  description: string;
}

// Default configuration - throttle enabled by default for demo safety
const DEFAULT_CONFIG: ThrottleConfig = {
  enabled: true,
  processRatio: 0.0025, // 250 per 100,000 = 0.25%
  maxPerHour: 100,
  samplingMethod: 'random',
  lastUpdated: new Date().toISOString(),
  description: 'Demo mode: Processing ~250 images per 100,000 incoming',
};

// In-memory storage (in production, use database)
// This persists across function invocations in the same instance
let currentConfig: ThrottleConfig = { ...DEFAULT_CONFIG };

// Processing statistics
interface ProcessingStats {
  totalReceived: number;
  totalProcessed: number;
  totalSkipped: number;
  lastHourReceived: number;
  lastHourProcessed: number;
  lastHourSkipped: number;
  projectedIfNoThrottle: number;
  lastEventAt: string | null;  // ISO timestamp of last webhook event received
  hourlyStats: Array<{
    hour: string;
    received: number;
    processed: number;
    skipped: number;
  }>;
}

let processingStats: ProcessingStats = {
  totalReceived: 0,
  totalProcessed: 0,
  totalSkipped: 0,
  lastHourReceived: 0,
  lastHourProcessed: 0,
  lastHourSkipped: 0,
  projectedIfNoThrottle: 0,
  lastEventAt: null,
  hourlyStats: [],
};

// Track hourly buckets for rolling statistics
const hourlyBuckets: Map<string, { received: number; processed: number; skipped: number }> = new Map();

/**
 * Get the current throttle configuration
 */
export function getThrottleConfig(): ThrottleConfig {
  return { ...currentConfig };
}

/**
 * Check if an image should be processed based on throttle settings
 * @param imageIndex - Index of the image in the current batch
 * @param batchSize - Total size of the current batch
 * @returns Whether the image should be processed
 */
export function shouldProcessImage(imageIndex: number, batchSize: number): boolean {
  if (!currentConfig.enabled) {
    return true; // Throttle disabled, process all
  }

  // Check hourly limit
  const currentHour = new Date().toISOString().substring(0, 13);
  const hourBucket = hourlyBuckets.get(currentHour) || { received: 0, processed: 0, skipped: 0 };
  
  if (hourBucket.processed >= currentConfig.maxPerHour) {
    return false; // Hourly limit reached
  }

  // Apply sampling based on method
  switch (currentConfig.samplingMethod) {
    case 'random':
      return Math.random() < currentConfig.processRatio;
    
    case 'interval':
      // Process every Nth image based on ratio
      const interval = Math.max(1, Math.floor(1 / currentConfig.processRatio));
      return imageIndex % interval === 0;
    
    case 'first':
      // Process first N images based on ratio
      const maxInBatch = Math.max(1, Math.ceil(batchSize * currentConfig.processRatio));
      return imageIndex < maxInBatch;
    
    default:
      return Math.random() < currentConfig.processRatio;
  }
}

/**
 * Record an image processing decision
 */
export function recordProcessingDecision(processed: boolean): void {
  const now = new Date();
  const currentHour = now.toISOString().substring(0, 13);

  // Update last event timestamp (this is the actual webhook receive time)
  processingStats.lastEventAt = now.toISOString();

  // Update hourly bucket
  let hourBucket = hourlyBuckets.get(currentHour);
  if (!hourBucket) {
    hourBucket = { received: 0, processed: 0, skipped: 0 };
    hourlyBuckets.set(currentHour, hourBucket);
  }

  hourBucket.received++;
  if (processed) {
    hourBucket.processed++;
  } else {
    hourBucket.skipped++;
  }

  // Update global stats
  processingStats.totalReceived++;
  if (processed) {
    processingStats.totalProcessed++;
  } else {
    processingStats.totalSkipped++;
  }

  // Calculate projected usage if no throttle
  processingStats.projectedIfNoThrottle = processingStats.totalReceived;

  // Update last hour stats
  processingStats.lastHourReceived = hourBucket.received;
  processingStats.lastHourProcessed = hourBucket.processed;
  processingStats.lastHourSkipped = hourBucket.skipped;

  // Clean up old hourly buckets (keep last 24 hours)
  const cutoffHour = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().substring(0, 13);
  for (const [hour] of hourlyBuckets) {
    if (hour < cutoffHour) {
      hourlyBuckets.delete(hour);
    }
  }

  // Update hourly stats array for UI
  processingStats.hourlyStats = Array.from(hourlyBuckets.entries())
    .map(([hour, stats]) => ({ hour, ...stats }))
    .sort((a, b) => a.hour.localeCompare(b.hour))
    .slice(-24);
}

/**
 * Record throttle metrics to InfluxDB
 */
export async function recordThrottleMetrics(): Promise<void> {
  if (!isInfluxDBConfigured()) return;

  try {
    // Write throttle metrics as a separate measurement
    const INFLUXDB_HOST = process.env.INFLUXDB_HOST || "https://us-east-1-1.aws.cloud2.influxdata.com";
    const INFLUXDB_ORG = process.env.INFLUXDB_ORG || "ELI";
    const INFLUXDB_TOKEN = process.env.INFLUXDB_TOKEN;
    const INFLUXDB_BUCKET = "cloudinary_metrics";

    const writeUrl = `${INFLUXDB_HOST}/api/v2/write?org=${INFLUXDB_ORG}&bucket=${INFLUXDB_BUCKET}&precision=ms`;
    const timestamp = Date.now();

    const lines = [
      `image_throttle,type=processing received=${processingStats.lastHourReceived}i,processed=${processingStats.lastHourProcessed}i,skipped=${processingStats.lastHourSkipped}i,projected=${processingStats.projectedIfNoThrottle}i ${timestamp}`,
      `image_throttle,type=totals total_received=${processingStats.totalReceived}i,total_processed=${processingStats.totalProcessed}i,total_skipped=${processingStats.totalSkipped}i ${timestamp}`,
    ].join("\n");

    await fetch(writeUrl, {
      method: "POST",
      headers: {
        Authorization: `Token ${INFLUXDB_TOKEN}`,
        "Content-Type": "text/plain; charset=utf-8",
      },
      body: lines,
    });
  } catch (error) {
    console.error("[Throttle] Failed to record metrics:", error);
  }
}

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
): Promise<void> {
  // Set CORS headers
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  // Disable caching to ensure fresh data on every poll
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
  res.setHeader("Pragma", "no-cache");
  res.setHeader("Expires", "0");

  if (req.method === "OPTIONS") {
    res.status(200).end();
    return;
  }

  const { action } = req.query;

  // GET: Retrieve configuration or stats
  if (req.method === "GET") {
    if (action === "stats") {
      // Return processing statistics
      res.status(200).json({
        success: true,
        stats: processingStats,
        config: currentConfig,
        timestamp: new Date().toISOString(),
      });
      return;
    }

    // Return current configuration
    res.status(200).json({
      success: true,
      config: currentConfig,
      stats: {
        totalReceived: processingStats.totalReceived,
        totalProcessed: processingStats.totalProcessed,
        totalSkipped: processingStats.totalSkipped,
        effectiveRatio: processingStats.totalReceived > 0
          ? processingStats.totalProcessed / processingStats.totalReceived
          : 0,
      },
      timestamp: new Date().toISOString(),
    });
    return;
  }

  // POST: Update configuration
  if (req.method === "POST") {
    try {
      const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body;

      // Validate and update configuration
      if (typeof body.enabled === "boolean") {
        currentConfig.enabled = body.enabled;
      }

      if (typeof body.processRatio === "number") {
        // Clamp ratio between 0 and 1
        currentConfig.processRatio = Math.max(0, Math.min(1, body.processRatio));
      }

      if (typeof body.maxPerHour === "number") {
        currentConfig.maxPerHour = Math.max(1, Math.floor(body.maxPerHour));
      }

      if (body.samplingMethod && ['random', 'interval', 'first'].includes(body.samplingMethod)) {
        currentConfig.samplingMethod = body.samplingMethod;
      }

      currentConfig.lastUpdated = new Date().toISOString();

      // Update description based on settings
      if (currentConfig.enabled) {
        const imagesPerHundredK = Math.round(currentConfig.processRatio * 100000);
        currentConfig.description = `Throttle active: Processing ~${imagesPerHundredK} images per 100,000 incoming (${(currentConfig.processRatio * 100).toFixed(2)}%)`;
      } else {
        currentConfig.description = "Throttle disabled: Processing all images (Production mode)";
      }

      // Record metrics update
      await recordThrottleMetrics();

      console.log("[Throttle] Configuration updated:", currentConfig);

      res.status(200).json({
        success: true,
        config: currentConfig,
        message: "Throttle configuration updated",
      });
      return;

    } catch (error) {
      console.error("[Throttle] Update error:", error);
      res.status(400).json({
        success: false,
        error: error instanceof Error ? error.message : "Invalid request",
      });
      return;
    }
  }

  // POST with action=reset: Reset statistics
  if (req.method === "POST" && action === "reset") {
    processingStats = {
      totalReceived: 0,
      totalProcessed: 0,
      totalSkipped: 0,
      lastHourReceived: 0,
      lastHourProcessed: 0,
      lastHourSkipped: 0,
      projectedIfNoThrottle: 0,
      lastEventAt: null,
      hourlyStats: [],
    };
    hourlyBuckets.clear();

    res.status(200).json({
      success: true,
      message: "Statistics reset",
      stats: processingStats,
    });
    return;
  }

  res.status(405).json({ error: "Method not allowed" });
}

