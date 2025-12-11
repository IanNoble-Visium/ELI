/**
 * Vercel Cron Job: Process Images with Gemini AI
 * 
 * Batch processes unprocessed surveillance images using Google Gemini Vision API
 * to extract detailed metadata for Neo4j storage and advanced querying.
 * 
 * Rate Limits (Free Tier):
 * - Gemini 1.5 Flash: 15 RPM, 1,500 requests/day
 * - Gemini 1.5 Pro: 2 RPM, 50 requests/day
 * 
 * Configure in vercel.json:
 * {
 *   "crons": [{
 *     "path": "/api/cron/process-gemini-images",
 *     "schedule": "0 * * * *"
 *   }]
 * }
 */
import type { VercelRequest, VercelResponse } from "@vercel/node";

import {
  isGeminiConfigured,
  analyzeImageWithGemini,
  GEMINI_DEFAULTS,
  GEMINI_CONFIG_KEYS,
  GEMINI_MODELS,
  calculateRequestDelay,
  isDailyLimitReached,
  type GeminiModelId,
  type GeminiAnalysisResult,
} from "../lib/gemini.js";
import { getDb, snapshots, eq, and, sql, getSystemConfig, setSystemConfig } from "../lib/db.js";
import { isNeo4jConfigured, writeTransaction } from "../lib/neo4j.js";
import { recordJobExecution } from "./status.js";

interface ProcessingResult {
  snapshotId: string;
  eventId: string;
  success: boolean;
  error?: string;
  analysis?: GeminiAnalysisResult;
}

/**
 * Get Gemini configuration from system_config
 */
async function getGeminiConfig(): Promise<{
  model: GeminiModelId;
  batchSize: number;
  enabled: boolean;
}> {
  const [modelStr, batchSizeStr, enabledStr] = await Promise.all([
    getSystemConfig(GEMINI_CONFIG_KEYS.MODEL),
    getSystemConfig(GEMINI_CONFIG_KEYS.BATCH_SIZE),
    getSystemConfig(GEMINI_CONFIG_KEYS.ENABLED),
  ]);

  const model = (modelStr && modelStr in GEMINI_MODELS ? modelStr : GEMINI_DEFAULTS.model) as GeminiModelId;
  const batchSize = batchSizeStr ? parseInt(batchSizeStr, 10) : GEMINI_DEFAULTS.batchSize;
  const enabled = enabledStr === 'true';

  return { model, batchSize, enabled };
}

/**
 * Get and update daily request counter
 */
async function getDailyRequestCount(): Promise<number> {
  const today = new Date().toISOString().split('T')[0];
  const [countStr, dateStr] = await Promise.all([
    getSystemConfig(GEMINI_CONFIG_KEYS.DAILY_REQUESTS_COUNT),
    getSystemConfig(GEMINI_CONFIG_KEYS.DAILY_REQUESTS_DATE),
  ]);

  // Reset counter if it's a new day
  if (dateStr !== today) {
    await Promise.all([
      setSystemConfig(GEMINI_CONFIG_KEYS.DAILY_REQUESTS_COUNT, '0'),
      setSystemConfig(GEMINI_CONFIG_KEYS.DAILY_REQUESTS_DATE, today),
    ]);
    return 0;
  }

  return countStr ? parseInt(countStr, 10) : 0;
}

async function incrementDailyRequestCount(increment: number = 1): Promise<void> {
  const currentCount = await getDailyRequestCount();
  await setSystemConfig(
    GEMINI_CONFIG_KEYS.DAILY_REQUESTS_COUNT,
    String(currentCount + increment)
  );
}

/**
 * Get unprocessed snapshots with valid Cloudinary URLs
 */
async function getUnprocessedSnapshots(limit: number): Promise<Array<{
  id: string;
  eventId: string;
  imageUrl: string;
}>> {
  const db = await getDb();
  if (!db) return [];

  const results = await db
    .select({
      id: snapshots.id,
      eventId: snapshots.eventId,
      imageUrl: snapshots.imageUrl,
    })
    .from(snapshots)
    .where(
      and(
        eq(snapshots.geminiProcessed, false),
        sql`${snapshots.imageUrl} IS NOT NULL`,
        sql`${snapshots.imageUrl} LIKE '%cloudinary.com%'`
      )
    )
    .limit(limit);

  return results.filter(r => r.imageUrl) as Array<{
    id: string;
    eventId: string;
    imageUrl: string;
  }>;
}

/**
 * Update snapshot with Gemini processing result
 */
async function updateSnapshotGeminiStatus(
  snapshotId: string,
  success: boolean,
  model: string,
  error?: string
): Promise<void> {
  const db = await getDb();
  if (!db) return;

  await db
    .update(snapshots)
    .set({
      geminiProcessed: true,
      geminiProcessedAt: new Date().toISOString(),
      geminiModelUsed: model,
      geminiError: error || null,
    })
    .where(eq(snapshots.id, snapshotId));
}

/**
 * Update Neo4j Event node with Gemini analysis data
 */
async function updateNeo4jEventWithGemini(
  eventId: string,
  analysis: GeminiAnalysisResult
): Promise<void> {
  if (!isNeo4jConfigured()) return;

  await writeTransaction(async (tx) => {
    // Primary match: by id field (snapshot.eventId = Neo4j Event.id = eventDbId like "evt_...")
    // This is the correct match since syncEvent creates nodes with id = eventDbId
    const result = await tx.run(
      `
      MATCH (e:Event {id: $eventId})
      SET e.geminiCaption = $geminiCaption,
          e.geminiTags = $geminiTags,
          e.geminiObjects = $geminiObjects,
          e.geminiPeopleCount = $geminiPeopleCount,
          e.geminiVehicles = $geminiVehicles,
          e.geminiWeapons = $geminiWeapons,
          e.geminiClothingColors = $geminiClothingColors,
          e.geminiDominantColors = $geminiDominantColors,
          e.geminiLicensePlates = $geminiLicensePlates,
          e.geminiTextExtracted = $geminiTextExtracted,
          e.geminiQualityScore = $geminiQualityScore,
          e.geminiBlurScore = $geminiBlurScore,
          e.geminiTimeOfDay = $geminiTimeOfDay,
          e.geminiLightingCondition = $geminiLightingCondition,
          e.geminiEnvironment = $geminiEnvironment,
          e.geminiWeatherCondition = $geminiWeatherCondition,
          e.geminiCameraPerspective = $geminiCameraPerspective,
          e.geminiVehicleDetails = $geminiVehicleDetails,
          e.geminiProcessedAt = timestamp()
      RETURN e.id as matchedId
      `,
      {
        eventId,
        geminiCaption: analysis.geminiCaption,
        geminiTags: analysis.geminiTags,
        geminiObjects: analysis.geminiObjects,
        geminiPeopleCount: analysis.geminiPeopleCount,
        geminiVehicles: analysis.geminiVehicles,
        geminiWeapons: analysis.geminiWeapons,
        geminiClothingColors: analysis.geminiClothingColors,
        geminiDominantColors: analysis.geminiDominantColors,
        geminiLicensePlates: analysis.geminiLicensePlates,
        geminiTextExtracted: analysis.geminiTextExtracted,
        geminiQualityScore: analysis.geminiQualityScore,
        geminiBlurScore: analysis.geminiBlurScore,
        geminiTimeOfDay: analysis.geminiTimeOfDay,
        geminiLightingCondition: analysis.geminiLightingCondition,
        geminiEnvironment: analysis.geminiEnvironment,
        geminiWeatherCondition: analysis.geminiWeatherCondition,
        geminiCameraPerspective: analysis.geminiCameraPerspective,
        geminiVehicleDetails: JSON.stringify(analysis.geminiVehicleDetails),
      }
    );

    // Log if primary match succeeded
    if (result.records.length > 0) {
      console.log(`[Gemini->Neo4j] Updated Event node: ${result.records[0].get('matchedId')}`);
    } else {
      // Fallback: try matching by eventId property (for legacy nodes)
      const fallbackResult = await tx.run(
        `
        MATCH (e:Event {eventId: $eventId})
        SET e.geminiCaption = $geminiCaption,
            e.geminiTags = $geminiTags,
            e.geminiObjects = $geminiObjects,
            e.geminiPeopleCount = $geminiPeopleCount,
            e.geminiVehicles = $geminiVehicles,
            e.geminiWeapons = $geminiWeapons,
            e.geminiClothingColors = $geminiClothingColors,
            e.geminiDominantColors = $geminiDominantColors,
            e.geminiLicensePlates = $geminiLicensePlates,
            e.geminiTextExtracted = $geminiTextExtracted,
            e.geminiQualityScore = $geminiQualityScore,
            e.geminiBlurScore = $geminiBlurScore,
            e.geminiTimeOfDay = $geminiTimeOfDay,
            e.geminiLightingCondition = $geminiLightingCondition,
            e.geminiEnvironment = $geminiEnvironment,
            e.geminiWeatherCondition = $geminiWeatherCondition,
            e.geminiCameraPerspective = $geminiCameraPerspective,
            e.geminiVehicleDetails = $geminiVehicleDetails,
            e.geminiProcessedAt = timestamp()
        RETURN e.id as matchedId
        `,
        {
          eventId,
          geminiCaption: analysis.geminiCaption,
          geminiTags: analysis.geminiTags,
          geminiObjects: analysis.geminiObjects,
          geminiPeopleCount: analysis.geminiPeopleCount,
          geminiVehicles: analysis.geminiVehicles,
          geminiWeapons: analysis.geminiWeapons,
          geminiClothingColors: analysis.geminiClothingColors,
          geminiDominantColors: analysis.geminiDominantColors,
          geminiLicensePlates: analysis.geminiLicensePlates,
          geminiTextExtracted: analysis.geminiTextExtracted,
          geminiQualityScore: analysis.geminiQualityScore,
          geminiBlurScore: analysis.geminiBlurScore,
          geminiTimeOfDay: analysis.geminiTimeOfDay,
          geminiLightingCondition: analysis.geminiLightingCondition,
          geminiEnvironment: analysis.geminiEnvironment,
          geminiWeatherCondition: analysis.geminiWeatherCondition,
          geminiCameraPerspective: analysis.geminiCameraPerspective,
          geminiVehicleDetails: JSON.stringify(analysis.geminiVehicleDetails),
        }
      );

      if (fallbackResult.records.length > 0) {
        console.log(`[Gemini->Neo4j] Updated Event node (fallback): ${fallbackResult.records[0].get('matchedId')}`);
      } else {
        console.warn(`[Gemini->Neo4j] No Event node found for eventId: ${eventId}`);
      }
    }
  });
}

/**
 * Process a single image with retry logic
 */
async function processImage(
  snapshot: { id: string; eventId: string; imageUrl: string },
  model: GeminiModelId,
  retries: number = 2
): Promise<ProcessingResult> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const analysis = await analyzeImageWithGemini(snapshot.imageUrl, model);
      
      if (!analysis) {
        throw new Error('No analysis result returned');
      }

      // Update Neo4j
      await updateNeo4jEventWithGemini(snapshot.eventId, analysis);

      // Update PostgreSQL
      await updateSnapshotGeminiStatus(snapshot.id, true, model);

      return {
        snapshotId: snapshot.id,
        eventId: snapshot.eventId,
        success: true,
        analysis,
      };
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      
      // Don't retry on certain errors
      if (lastError.message.includes('429') || lastError.message.includes('quota')) {
        break; // Rate limit hit, stop retrying
      }
      
      if (attempt < retries) {
        // Wait before retry (exponential backoff)
        await sleep(1000 * Math.pow(2, attempt));
      }
    }
  }

  // Mark as processed with error
  await updateSnapshotGeminiStatus(
    snapshot.id,
    false,
    model,
    lastError?.message || 'Unknown error'
  );

  return {
    snapshotId: snapshot.id,
    eventId: snapshot.eventId,
    success: false,
    error: lastError?.message || 'Unknown error',
  };
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
): Promise<void> {
  // Verify cron job authorization
  const authHeader = req.headers.authorization;
  const isVercelCron = authHeader === `Bearer ${process.env.CRON_SECRET}`;
  const isManualTrigger = req.query.manual === "true";
  const forceRun = req.query.force === "true";

  // Allow manual triggers or authenticated cron requests
  if (!isVercelCron && !isManualTrigger && process.env.NODE_ENV === "production") {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const startTime = Date.now();
  const results: Record<string, any> = {
    timestamp: new Date().toISOString(),
    type: "cron_job",
    job: "process-gemini-images",
    manual: isManualTrigger,
  };

  try {
    // Check if Gemini is configured
    if (!isGeminiConfigured()) {
      results.status = "skipped";
      results.reason = "GEMINI_API_KEY not configured";
      res.status(200).json(results);
      return;
    }

    // Get configuration
    const config = await getGeminiConfig();
    results.config = {
      model: config.model,
      batchSize: config.batchSize,
      enabled: config.enabled,
    };

    // Check if processing is enabled (unless forced)
    if (!config.enabled && !forceRun) {
      results.status = "skipped";
      results.reason = "Gemini processing is disabled. Enable in admin settings or use ?force=true";
      res.status(200).json(results);
      return;
    }

    // Check daily limit
    const dailyCount = await getDailyRequestCount();
    const modelConfig = GEMINI_MODELS[config.model];
    
    if (isDailyLimitReached(dailyCount, config.model)) {
      results.status = "skipped";
      results.reason = `Daily limit reached (${dailyCount}/${modelConfig.rpd})`;
      res.status(200).json(results);
      return;
    }

    // Calculate how many images we can process
    const remainingDaily = modelConfig.rpd - dailyCount;
    const effectiveBatchSize = Math.min(config.batchSize, remainingDaily);

    // Get unprocessed snapshots
    const unprocessedSnapshots = await getUnprocessedSnapshots(effectiveBatchSize);
    
    if (unprocessedSnapshots.length === 0) {
      results.status = "completed";
      results.reason = "No unprocessed images found";
      results.duration_ms = Date.now() - startTime;
      res.status(200).json(results);
      return;
    }

    results.totalToProcess = unprocessedSnapshots.length;
    results.dailyCountBefore = dailyCount;

    // Process images with rate limiting
    const processingResults: ProcessingResult[] = [];
    const delayMs = calculateRequestDelay(config.model);
    let successCount = 0;
    let errorCount = 0;

    console.log(`[Gemini Cron] Starting batch processing: ${unprocessedSnapshots.length} images with ${config.model}`);

    for (let i = 0; i < unprocessedSnapshots.length; i++) {
      const snapshot = unprocessedSnapshots[i];
      
      // Check if we've hit rate limits
      const currentDailyCount = await getDailyRequestCount();
      if (isDailyLimitReached(currentDailyCount, config.model)) {
        console.log(`[Gemini Cron] Daily limit reached, stopping batch`);
        break;
      }

      // Process image
      const result = await processImage(snapshot, config.model);
      processingResults.push(result);

      if (result.success) {
        successCount++;
        await incrementDailyRequestCount();
        console.log(`[Gemini Cron] Processed ${i + 1}/${unprocessedSnapshots.length}: ${snapshot.id} - SUCCESS`);
      } else {
        errorCount++;
        console.log(`[Gemini Cron] Processed ${i + 1}/${unprocessedSnapshots.length}: ${snapshot.id} - ERROR: ${result.error}`);
      }

      // Rate limit delay (skip on last iteration)
      if (i < unprocessedSnapshots.length - 1) {
        await sleep(delayMs);
      }
    }

    // Compile results
    results.status = "completed";
    results.processed = processingResults.length;
    results.success = successCount;
    results.errors = errorCount;
    results.dailyCountAfter = await getDailyRequestCount();
    results.duration_ms = Date.now() - startTime;

    // Include error details for failed items
    const failedItems = processingResults.filter(r => !r.success);
    if (failedItems.length > 0) {
      results.failedItems = failedItems.map(f => ({
        snapshotId: f.snapshotId,
        error: f.error,
      }));
    }

    // Record execution for monitoring
    recordJobExecution(
      "process-gemini-images",
      errorCount === processingResults.length ? "error" : "success",
      results.duration_ms,
      `Processed ${successCount}/${processingResults.length} images with ${config.model}`,
      {
        model: config.model,
        processed: processingResults.length,
        success: successCount,
        errors: errorCount,
      }
    );

    console.log(`[Gemini Cron] Batch complete: ${successCount} success, ${errorCount} errors in ${results.duration_ms}ms`);
    res.status(200).json(results);

  } catch (error) {
    console.error("[Gemini Cron] Error:", error);
    results.status = "error";
    results.error = error instanceof Error ? error.message : "Unknown error";
    results.duration_ms = Date.now() - startTime;

    recordJobExecution(
      "process-gemini-images",
      "error",
      results.duration_ms,
      results.error
    );

    res.status(500).json(results);
  }
}
