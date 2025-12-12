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
 * - GET ?action=maintenance: Get maintenance mode status
 * - POST ?action=maintenance: Toggle maintenance mode (body: { enabled: boolean })
 */
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getDb, events, snapshots, sql, count, gte, desc, getSystemConfig, setSystemConfig } from "../lib/db.js";
import { isInfluxDBConfigured, writeMetricPoint } from "../lib/influxdb.js";

// Config key for database storage
const THROTTLE_CONFIG_KEY = "cloudinary_throttle_config";
const MAINTENANCE_MODE_KEY = "maintenance_mode";

// Throttle configuration interface
export interface ThrottleConfig {
  enabled: boolean;
  // Ratio: how many images to process per 10,000 incoming
  // Default: 25 per 10,000 = 0.25%
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

// Default configuration - throttle enabled with 5% processing ratio
// This balances API costs with useful AI analysis coverage:
// - 5% = 500 images per 10,000 incoming events
// - With ~1000 events/hour, this means ~50 Gemini API calls/hour
// - At $0.0001875 per image (Gemini 2.0 Flash), this costs ~$0.01/hour
const DEFAULT_CONFIG: ThrottleConfig = {
  enabled: true,
  processRatio: 0.05, // 500 per 10,000 = 5% (increased from 0.25% for better AI coverage)
  maxPerHour: 200, // Increased limit to match higher ratio
  samplingMethod: 'random',
  lastUpdated: new Date().toISOString(),
  description: 'Processing ~500 images per 10,000 incoming (5%)',
};

// ========== Maintenance Mode ==========
// Used to pause webhook processing during database purge operations

interface MaintenanceMode {
  enabled: boolean;
  reason: string;
  enabledAt: string | null;
  enabledBy: string;
}

const DEFAULT_MAINTENANCE_MODE: MaintenanceMode = {
  enabled: false,
  reason: '',
  enabledAt: null,
  enabledBy: '',
};

// In-memory maintenance mode state
let maintenanceMode: MaintenanceMode = { ...DEFAULT_MAINTENANCE_MODE };
let maintenanceModeLoadedFromDb = false;

/**
 * Load maintenance mode state from database
 */
export async function loadMaintenanceModeFromDb(): Promise<MaintenanceMode> {
  try {
    const modeJson = await getSystemConfig(MAINTENANCE_MODE_KEY);
    if (modeJson) {
      const dbMode = JSON.parse(modeJson) as MaintenanceMode;
      maintenanceMode = { ...DEFAULT_MAINTENANCE_MODE, ...dbMode };
      maintenanceModeLoadedFromDb = true;
      console.log(`[Maintenance] Loaded from DB: enabled=${maintenanceMode.enabled}, reason=${maintenanceMode.reason}`);
    } else {
      console.log(`[Maintenance] No config in DB, maintenance mode disabled`);
    }
  } catch (error) {
    console.error("[Maintenance] Error loading from DB:", error);
  }
  return { ...maintenanceMode };
}

/**
 * Enable maintenance mode (used by purge-all)
 */
export async function enableMaintenanceMode(reason: string, enabledBy: string = 'system'): Promise<boolean> {
  try {
    maintenanceMode = {
      enabled: true,
      reason,
      enabledAt: new Date().toISOString(),
      enabledBy,
    };
    const success = await setSystemConfig(
      MAINTENANCE_MODE_KEY,
      JSON.stringify(maintenanceMode),
      "Maintenance mode configuration"
    );
    if (success) {
      console.log(`[Maintenance] ENABLED: ${reason} (by ${enabledBy})`);
    }
    return success;
  } catch (error) {
    console.error("[Maintenance] Failed to enable:", error);
    return false;
  }
}

/**
 * Disable maintenance mode (used by purge-all)
 */
export async function disableMaintenanceMode(disabledBy: string = 'system'): Promise<boolean> {
  try {
    const previousReason = maintenanceMode.reason;
    maintenanceMode = { ...DEFAULT_MAINTENANCE_MODE };
    const success = await setSystemConfig(
      MAINTENANCE_MODE_KEY,
      JSON.stringify(maintenanceMode),
      "Maintenance mode configuration"
    );
    if (success) {
      console.log(`[Maintenance] DISABLED (was: ${previousReason}, by ${disabledBy})`);
    }
    return success;
  } catch (error) {
    console.error("[Maintenance] Failed to disable:", error);
    return false;
  }
}

/**
 * Check if maintenance mode is active
 * MUST call loadMaintenanceModeFromDb() first in webhook handlers!
 */
export function isMaintenanceModeActive(): boolean {
  if (!maintenanceModeLoadedFromDb) {
    console.warn(`[Maintenance] WARNING: State not loaded from DB! Using in-memory: enabled=${maintenanceMode.enabled}`);
  }
  return maintenanceMode.enabled;
}

/**
 * Get current maintenance mode state
 */
export function getMaintenanceMode(): MaintenanceMode {
  return { ...maintenanceMode };
}

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

// Flag to track if config has been loaded from DB in this invocation
let configLoadedFromDb = false;

/**
 * Load throttle configuration from database
 * MUST be called at the start of webhook processing to ensure config is fresh
 */
export async function loadThrottleConfigFromDb(): Promise<ThrottleConfig> {
  try {
    const configJson = await getSystemConfig(THROTTLE_CONFIG_KEY);
    if (configJson) {
      const dbConfig = JSON.parse(configJson) as ThrottleConfig;
      // Merge with defaults to handle any missing fields
      currentConfig = {
        ...DEFAULT_CONFIG,
        ...dbConfig,
      };
      configLoadedFromDb = true;
      console.log(`[Throttle] Loaded config from DB: enabled=${currentConfig.enabled}, ratio=${currentConfig.processRatio}`);
    } else {
      // No config in DB, use defaults
      console.log(`[Throttle] No config in DB, using defaults: enabled=${DEFAULT_CONFIG.enabled}`);
    }
  } catch (error) {
    console.error("[Throttle] Error loading config from DB:", error);
    // Keep using current/default config
  }
  return { ...currentConfig };
}

/**
 * Save throttle configuration to database
 */
export async function saveThrottleConfigToDb(config: ThrottleConfig): Promise<boolean> {
  try {
    const configJson = JSON.stringify(config);
    const success = await setSystemConfig(
      THROTTLE_CONFIG_KEY,
      configJson,
      "Cloudinary image processing throttle configuration"
    );
    if (success) {
      currentConfig = { ...config };
      console.log(`[Throttle] Saved config to DB: enabled=${config.enabled}, ratio=${config.processRatio}`);
    }
    return success;
  } catch (error) {
    console.error("[Throttle] Error saving config to DB:", error);
    return false;
  }
}

/**
 * Get the current throttle configuration (sync - uses cached value)
 * Call loadThrottleConfigFromDb() first in webhook handlers!
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
  // CRITICAL: Log if config wasn't loaded from DB (debugging)
  if (!configLoadedFromDb) {
    console.warn(`[Throttle] WARNING: Config not loaded from DB! Using in-memory: enabled=${currentConfig.enabled}`);
  }

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
    // Always load config from DB to show current persisted state
    await loadThrottleConfigFromDb();

    if (action === "stats") {
      // Fetch REAL stats from database instead of unreliable in-memory state
      // (Vercel serverless functions don't share memory across invocations)
      try {
        const db = await getDb();

        if (db) {
          // Get total events received (all events in database)
          const [eventCountResult] = await db.select({ count: count() }).from(events);
          const totalReceived = eventCountResult?.count || 0;

          // Get snapshots with cloudinary URLs (processed/uploaded images)
          const [processedResult] = await db
            .select({ count: count() })
            .from(snapshots)
            .where(sql`${snapshots.imageUrl} IS NOT NULL AND ${snapshots.imageUrl} LIKE 'https://res.cloudinary.com%'`);
          const totalProcessed = processedResult?.count || 0;

          // Get all snapshots count
          const [totalSnapshotsResult] = await db.select({ count: count() }).from(snapshots);
          const totalSnapshots = totalSnapshotsResult?.count || 0;

          // Skipped = total snapshots - processed
          const totalSkipped = Math.max(0, totalSnapshots - totalProcessed);

          // Get last hour stats
          const oneHourAgo = Date.now() - 60 * 60 * 1000;
          const [lastHourEventsResult] = await db
            .select({ count: count() })
            .from(events)
            .where(gte(events.startTime, oneHourAgo));
          const lastHourReceived = lastHourEventsResult?.count || 0;

          // Get the most recent event to show "Last Event Received" timestamp
          const [lastEvent] = await db
            .select({ startTime: events.startTime, createdAt: events.createdAt })
            .from(events)
            .orderBy(desc(events.createdAt))
            .limit(1);

          const lastEventAt = lastEvent?.createdAt || lastEvent?.startTime
            ? new Date(lastEvent?.createdAt || lastEvent?.startTime || 0).toISOString()
            : null;

          // Calculate last hour processed (approximate based on ratio)
          const lastHourProcessed = Math.round(lastHourReceived * currentConfig.processRatio);
          const lastHourSkipped = lastHourReceived - lastHourProcessed;

          const dbStats = {
            totalReceived,
            totalProcessed,
            totalSkipped,
            lastHourReceived,
            lastHourProcessed,
            lastHourSkipped,
            projectedIfNoThrottle: totalReceived,
            lastEventAt,
            hourlyStats: [], // Could be populated from database if needed
          };

          console.log(`[Throttle Stats] DB: received=${totalReceived}, processed=${totalProcessed}, skipped=${totalSkipped}, lastEventAt=${lastEventAt}`);

          res.status(200).json({
            success: true,
            stats: dbStats,
            config: currentConfig,
            timestamp: new Date().toISOString(),
          });
          return;
        }
      } catch (dbError) {
        console.error("[Throttle Stats] Database error:", dbError);
        // Fall through to return in-memory stats
      }

      // Fallback to in-memory stats if database unavailable
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

      // Build updated config
      const updatedConfig: ThrottleConfig = { ...currentConfig };

      // Validate and update configuration
      if (typeof body.enabled === "boolean") {
        updatedConfig.enabled = body.enabled;
      }

      if (typeof body.processRatio === "number") {
        // Clamp ratio between 0 and 1
        updatedConfig.processRatio = Math.max(0, Math.min(1, body.processRatio));
      }

      if (typeof body.maxPerHour === "number") {
        updatedConfig.maxPerHour = Math.max(1, Math.floor(body.maxPerHour));
      }

      if (body.samplingMethod && ['random', 'interval', 'first'].includes(body.samplingMethod)) {
        updatedConfig.samplingMethod = body.samplingMethod;
      }

      updatedConfig.lastUpdated = new Date().toISOString();

      // Update description based on settings
      if (updatedConfig.enabled) {
        const imagesPerTenK = Math.round(updatedConfig.processRatio * 10000);
        updatedConfig.description = `Throttle active: Processing ~${imagesPerTenK} images per 10,000 incoming (${(updatedConfig.processRatio * 100).toFixed(2)}%)`;
      } else {
        updatedConfig.description = "Throttle disabled: Processing all images (Production mode)";
      }

      // CRITICAL: Save config to DATABASE so ALL serverless instances use it
      const saveSuccess = await saveThrottleConfigToDb(updatedConfig);
      if (!saveSuccess) {
        console.warn("[Throttle] Failed to save config to database, only in-memory updated");
      }

      // Also update in-memory for this instance
      currentConfig = { ...updatedConfig };

      // Record metrics update
      await recordThrottleMetrics();

      console.log("[Throttle] Configuration updated and saved to DB:", currentConfig);

      res.status(200).json({
        success: true,
        config: currentConfig,
        message: saveSuccess
          ? "Throttle configuration saved to database"
          : "Throttle configuration updated (in-memory only - DB save failed)",
        persistedToDb: saveSuccess,
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

  // GET with action=maintenance: Get maintenance mode status
  if (req.method === "GET" && action === "maintenance") {
    await loadMaintenanceModeFromDb();
    res.status(200).json({
      success: true,
      maintenance: getMaintenanceMode(),
      timestamp: new Date().toISOString(),
    });
    return;
  }

  // POST with action=maintenance: Toggle maintenance mode
  if (req.method === "POST" && action === "maintenance") {
    try {
      const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body;
      const { enabled, reason } = body;

      if (typeof enabled !== "boolean") {
        res.status(400).json({
          success: false,
          error: "Missing required field: enabled (boolean)",
        });
        return;
      }

      let success: boolean;
      if (enabled) {
        success = await enableMaintenanceMode(
          reason || "Manual maintenance mode",
          "api"
        );
      } else {
        success = await disableMaintenanceMode("api");
      }

      res.status(200).json({
        success,
        maintenance: getMaintenanceMode(),
        message: success
          ? `Maintenance mode ${enabled ? "enabled" : "disabled"}`
          : "Failed to update maintenance mode",
      });
      return;
    } catch (error) {
      console.error("[Maintenance] Toggle error:", error);
      res.status(400).json({
        success: false,
        error: error instanceof Error ? error.message : "Invalid request",
      });
      return;
    }
  }

  res.status(405).json({ error: "Method not allowed" });
}



