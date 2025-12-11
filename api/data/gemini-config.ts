/**
 * Gemini Configuration API
 * 
 * Provides endpoints for managing Gemini AI image processing settings
 * and triggering manual processing runs.
 */
import type { VercelRequest, VercelResponse } from "@vercel/node";

import {
  isGeminiConfigured,
  GEMINI_MODELS,
  GEMINI_DEFAULTS,
  GEMINI_CONFIG_KEYS,
  type GeminiModelId,
} from "../lib/gemini.js";
import { getDb, snapshots, eq, and, sql, getSystemConfig, setSystemConfig, count } from "../lib/db.js";

export interface GeminiConfigResponse {
  configured: boolean;
  enabled: boolean;
  model: GeminiModelId;
  modelInfo: {
    name: string;
    description: string;
    rpm: number;
    rpd: number;
  };
  batchSize: number;
  scheduleMinutes: number;
  dailyRequestsCount: number;
  dailyRequestsDate: string;
  availableModels: Array<{
    id: string;
    name: string;
    description: string;
    rpm: number;
    rpd: number;
  }>;
  stats: {
    totalSnapshots: number;
    processedSnapshots: number;
    unprocessedSnapshots: number;
    errorSnapshots: number;
  };
}

/**
 * Get Gemini processing statistics
 */
async function getGeminiStats(): Promise<GeminiConfigResponse['stats']> {
  const db = await getDb();
  if (!db) {
    return {
      totalSnapshots: 0,
      processedSnapshots: 0,
      unprocessedSnapshots: 0,
      errorSnapshots: 0,
    };
  }

  try {
    // Total snapshots with Cloudinary URLs
    const [totalResult] = await db
      .select({ count: count() })
      .from(snapshots)
      .where(sql`${snapshots.imageUrl} LIKE '%cloudinary.com%'`);

    // Processed snapshots
    const [processedResult] = await db
      .select({ count: count() })
      .from(snapshots)
      .where(
        and(
          eq(snapshots.geminiProcessed, true),
          sql`${snapshots.geminiError} IS NULL`
        )
      );

    // Unprocessed snapshots
    const [unprocessedResult] = await db
      .select({ count: count() })
      .from(snapshots)
      .where(
        and(
          eq(snapshots.geminiProcessed, false),
          sql`${snapshots.imageUrl} LIKE '%cloudinary.com%'`
        )
      );

    // Error snapshots
    const [errorResult] = await db
      .select({ count: count() })
      .from(snapshots)
      .where(
        and(
          eq(snapshots.geminiProcessed, true),
          sql`${snapshots.geminiError} IS NOT NULL`
        )
      );

    return {
      totalSnapshots: totalResult?.count || 0,
      processedSnapshots: processedResult?.count || 0,
      unprocessedSnapshots: unprocessedResult?.count || 0,
      errorSnapshots: errorResult?.count || 0,
    };
  } catch (error) {
    console.error('[Gemini Config] Error getting stats:', error);
    return {
      totalSnapshots: 0,
      processedSnapshots: 0,
      unprocessedSnapshots: 0,
      errorSnapshots: 0,
    };
  }
}

/**
 * GET: Retrieve current Gemini configuration
 * POST: Update Gemini configuration
 */
export default async function handler(
  req: VercelRequest,
  res: VercelResponse
): Promise<void> {
  // Handle CORS for browser requests
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  try {
    if (req.method === 'GET') {
      await handleGet(req, res);
    } else if (req.method === 'POST') {
      await handlePost(req, res);
    } else {
      res.status(405).json({ error: 'Method not allowed' });
    }
  } catch (error) {
    console.error('[Gemini Config] Error:', error);
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

async function handleGet(
  req: VercelRequest,
  res: VercelResponse
): Promise<void> {
  // Get current configuration
  const [modelStr, batchSizeStr, enabledStr, scheduleStr, dailyCountStr, dailyDateStr] = await Promise.all([
    getSystemConfig(GEMINI_CONFIG_KEYS.MODEL),
    getSystemConfig(GEMINI_CONFIG_KEYS.BATCH_SIZE),
    getSystemConfig(GEMINI_CONFIG_KEYS.ENABLED),
    getSystemConfig(GEMINI_CONFIG_KEYS.SCHEDULE_MINUTES),
    getSystemConfig(GEMINI_CONFIG_KEYS.DAILY_REQUESTS_COUNT),
    getSystemConfig(GEMINI_CONFIG_KEYS.DAILY_REQUESTS_DATE),
  ]);

  const model = (modelStr && modelStr in GEMINI_MODELS ? modelStr : GEMINI_DEFAULTS.model) as GeminiModelId;
  const modelInfo = GEMINI_MODELS[model];

  const today = new Date().toISOString().split('T')[0];
  const dailyCount = dailyDateStr === today ? parseInt(dailyCountStr || '0', 10) : 0;

  const stats = await getGeminiStats();

  const response: GeminiConfigResponse = {
    configured: isGeminiConfigured(),
    enabled: enabledStr === 'true',
    model,
    modelInfo: {
      name: modelInfo.name,
      description: modelInfo.description,
      rpm: modelInfo.rpm,
      rpd: modelInfo.rpd,
    },
    batchSize: batchSizeStr ? parseInt(batchSizeStr, 10) : GEMINI_DEFAULTS.batchSize,
    scheduleMinutes: scheduleStr ? parseInt(scheduleStr, 10) : GEMINI_DEFAULTS.scheduleMinutes,
    dailyRequestsCount: dailyCount,
    dailyRequestsDate: dailyDateStr || today,
    availableModels: Object.entries(GEMINI_MODELS).map(([id, info]) => ({
      id,
      name: info.name,
      description: info.description,
      rpm: info.rpm,
      rpd: info.rpd,
    })),
    stats,
  };

  res.status(200).json(response);
}

async function handlePost(
  req: VercelRequest,
  res: VercelResponse
): Promise<void> {
  const body = req.body || {};
  const updates: string[] = [];

  // Update model
  if (body.model !== undefined) {
    if (body.model in GEMINI_MODELS) {
      await setSystemConfig(GEMINI_CONFIG_KEYS.MODEL, body.model, 'Gemini model to use for image analysis');
      updates.push(`model: ${body.model}`);
    } else {
      res.status(400).json({ error: `Invalid model: ${body.model}` });
      return;
    }
  }

  // Update batch size
  if (body.batchSize !== undefined) {
    const batchSize = parseInt(body.batchSize, 10);
    if (batchSize >= 1 && batchSize <= 500) {
      await setSystemConfig(GEMINI_CONFIG_KEYS.BATCH_SIZE, String(batchSize), 'Number of images to process per batch');
      updates.push(`batchSize: ${batchSize}`);
    } else {
      res.status(400).json({ error: 'Batch size must be between 1 and 500' });
      return;
    }
  }

  // Update enabled status
  if (body.enabled !== undefined) {
    const enabled = body.enabled === true || body.enabled === 'true';
    await setSystemConfig(GEMINI_CONFIG_KEYS.ENABLED, String(enabled), 'Whether automatic Gemini processing is enabled');
    updates.push(`enabled: ${enabled}`);
  }

  // Update schedule
  if (body.scheduleMinutes !== undefined) {
    const scheduleMinutes = parseInt(body.scheduleMinutes, 10);
    if (scheduleMinutes >= 5 && scheduleMinutes <= 1440) {
      await setSystemConfig(GEMINI_CONFIG_KEYS.SCHEDULE_MINUTES, String(scheduleMinutes), 'Minutes between processing runs');
      updates.push(`scheduleMinutes: ${scheduleMinutes}`);
    } else {
      res.status(400).json({ error: 'Schedule must be between 5 and 1440 minutes' });
      return;
    }
  }

  // Reset daily counter if requested
  if (body.resetDailyCounter === true) {
    await setSystemConfig(GEMINI_CONFIG_KEYS.DAILY_REQUESTS_COUNT, '0');
    await setSystemConfig(GEMINI_CONFIG_KEYS.DAILY_REQUESTS_DATE, new Date().toISOString().split('T')[0]);
    updates.push('dailyCounter: reset');
  }

  // Reset error snapshots if requested (mark them as unprocessed for retry)
  if (body.retryErrors === true) {
    const db = await getDb();
    if (db) {
      await db
        .update(snapshots)
        .set({
          geminiProcessed: false,
          geminiError: null,
        })
        .where(sql`${snapshots.geminiError} IS NOT NULL`);
      updates.push('errorSnapshots: reset for retry');
    }
  }

  if (updates.length === 0) {
    res.status(400).json({ error: 'No valid updates provided' });
    return;
  }

  console.log(`[Gemini Config] Updated: ${updates.join(', ')}`);

  res.status(200).json({
    success: true,
    updates,
    message: `Configuration updated: ${updates.join(', ')}`,
  });
}
