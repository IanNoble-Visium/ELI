/**
 * Gemini Search API
 * 
 * Provides endpoints for searching events by Gemini AI analysis metadata
 * and retrieving Gemini analysis statistics.
 */
import type { VercelRequest, VercelResponse } from "@vercel/node";

import {
  searchEventsByGemini,
  getGeminiAnalysisStats,
} from "./topology-neo4j.js";

/**
 * GET: Search events by Gemini criteria or get stats
 * 
 * Query parameters:
 * - action: 'search' (default) or 'stats'
 * - hasWeapons: boolean
 * - minPeopleCount: number
 * - maxPeopleCount: number
 * - licensePlate: string (partial match)
 * - vehicleType: string (partial match)
 * - clothingColor: string (partial match)
 * - textContains: string (partial match)
 * - minQualityScore: number (0-100)
 * - maxBlurScore: number (0-100)
 * - tag: string (partial match)
 * - limit: number (default 50)
 */
export default async function handler(
  req: VercelRequest,
  res: VercelResponse
): Promise<void> {
  // Handle CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  try {
    const action = req.query.action as string || 'search';

    if (action === 'stats') {
      const stats = await getGeminiAnalysisStats();
      if (!stats) {
        res.status(200).json({
          error: 'Neo4j not configured or no data available',
          stats: null,
        });
        return;
      }
      res.status(200).json({ stats });
      return;
    }

    // Build search criteria from query parameters
    const criteria: Parameters<typeof searchEventsByGemini>[0] = {};

    if (req.query.hasWeapons === 'true') {
      criteria.hasWeapons = true;
    }

    if (req.query.minPeopleCount) {
      criteria.minPeopleCount = parseInt(req.query.minPeopleCount as string, 10);
    }

    if (req.query.maxPeopleCount) {
      criteria.maxPeopleCount = parseInt(req.query.maxPeopleCount as string, 10);
    }

    if (req.query.licensePlate) {
      criteria.licensePlate = req.query.licensePlate as string;
    }

    if (req.query.vehicleType) {
      criteria.vehicleType = req.query.vehicleType as string;
    }

    if (req.query.clothingColor) {
      criteria.clothingColor = req.query.clothingColor as string;
    }

    if (req.query.textContains) {
      criteria.textContains = req.query.textContains as string;
    }

    if (req.query.minQualityScore) {
      criteria.minQualityScore = parseInt(req.query.minQualityScore as string, 10);
    }

    if (req.query.maxBlurScore) {
      criteria.maxBlurScore = parseInt(req.query.maxBlurScore as string, 10);
    }

    if (req.query.tag) {
      criteria.tag = req.query.tag as string;
    }

    if (req.query.limit) {
      criteria.limit = Math.min(200, parseInt(req.query.limit as string, 10));
    }

    const events = await searchEventsByGemini(criteria);

    res.status(200).json({
      criteria,
      count: events.length,
      events: events.map(e => ({
        id: e.id,
        eventId: e.eventId,
        type: e.type,
        timestamp: e.timestamp,
        imageUrl: e.imageUrl,
        channelId: e.channelId,
        geminiCaption: e.geminiCaption,
        geminiTags: e.geminiTags,
        geminiObjects: e.geminiObjects,
        geminiPeopleCount: e.geminiPeopleCount,
        geminiVehicles: e.geminiVehicles,
        geminiWeapons: e.geminiWeapons,
        geminiClothingColors: e.geminiClothingColors,
        geminiDominantColors: e.geminiDominantColors,
        geminiLicensePlates: e.geminiLicensePlates,
        geminiTextExtracted: e.geminiTextExtracted,
        geminiQualityScore: e.geminiQualityScore,
        geminiBlurScore: e.geminiBlurScore,
      })),
    });

  } catch (error) {
    console.error('[Gemini Search] Error:', error);
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}
