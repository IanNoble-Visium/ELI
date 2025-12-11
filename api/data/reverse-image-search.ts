/**
 * Reverse Image Search API
 * 
 * Analyzes an uploaded image using Gemini AI and finds matching
 * surveillance events based on extracted metadata with confidence scoring.
 */
import type { VercelRequest, VercelResponse } from "@vercel/node";

import {
  isGeminiConfigured,
  getGeminiApiKey,
  GEMINI_MODELS,
  GEMINI_ANALYSIS_PROMPT,
  type GeminiModelId,
  type GeminiAnalysisResult,
} from "../lib/gemini.js";
import { isNeo4jConfigured, readTransaction, toNumber, nodeToObject } from "../lib/neo4j.js";
import { getSystemConfig } from "../lib/db.js";
import { GEMINI_CONFIG_KEYS, GEMINI_DEFAULTS } from "../lib/gemini.js";

/**
 * Match result with confidence score
 */
interface MatchResult {
  id: string;
  eventId: string;
  imageUrl: string;
  channelId: string | null;
  timestamp: number;
  confidence: number;
  matchReasons: string[];
  // Gemini analysis data
  geminiCaption?: string;
  geminiVehicles?: string[];
  geminiLicensePlates?: string[];
  geminiPeopleCount?: number;
  geminiClothingColors?: string[];
  geminiObjects?: string[];
  geminiDominantColors?: string[];
  geminiTextExtracted?: string[];
}

/**
 * Feature weights for confidence scoring
 */
const FEATURE_WEIGHTS = {
  licensePlate: 0.40,      // 40% - Exact plate match is highly significant
  vehicleMatch: 0.25,      // 25% - Vehicle type/make/color
  peopleCount: 0.10,       // 10% - Number of people
  clothingColors: 0.15,    // 15% - Clothing color matches
  dominantColors: 0.05,    // 5% - Scene color palette
  textMatch: 0.05,         // 5% - Extracted text matches
};

/**
 * Analyze uploaded image with Gemini
 */
async function analyzeUploadedImage(
  base64Image: string,
  mimeType: string,
  model: GeminiModelId
): Promise<GeminiAnalysisResult | null> {
  const apiKey = getGeminiApiKey();
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY not configured");
  }

  try {
    const modelConfig = GEMINI_MODELS[model];
    const apiVersion = modelConfig?.apiVersion || 'v1';
    const apiUrl = `https://generativelanguage.googleapis.com/${apiVersion}/models/${model}:generateContent?key=${apiKey}`;
    
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              { text: GEMINI_ANALYSIS_PROMPT },
              {
                inline_data: {
                  mime_type: mimeType,
                  data: base64Image,
                },
              },
            ],
          },
        ],
        generationConfig: {
          temperature: 0.1,
          topK: 32,
          topP: 1,
          maxOutputTokens: 4096,
        },
        safetySettings: [
          { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_NONE' },
          { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_NONE' },
          { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_NONE' },
          { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_NONE' },
        ],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Gemini API error ${response.status}: ${errorText}`);
    }

    const data = await response.json();
    const textContent = data.candidates?.[0]?.content?.parts?.[0]?.text;
    
    if (!textContent) {
      throw new Error('No text content in Gemini response');
    }

    // Parse JSON response
    let jsonStr = textContent.trim();
    if (jsonStr.startsWith('```json')) {
      jsonStr = jsonStr.slice(7);
    } else if (jsonStr.startsWith('```')) {
      jsonStr = jsonStr.slice(3);
    }
    if (jsonStr.endsWith('```')) {
      jsonStr = jsonStr.slice(0, -3);
    }
    jsonStr = jsonStr.trim();

    return JSON.parse(jsonStr) as GeminiAnalysisResult;
  } catch (error) {
    console.error('[Reverse Image Search] Gemini analysis error:', error);
    throw error;
  }
}

/**
 * Calculate string similarity (Levenshtein-based)
 */
function stringSimilarity(str1: string, str2: string): number {
  const s1 = str1.toLowerCase();
  const s2 = str2.toLowerCase();
  
  if (s1 === s2) return 1;
  if (s1.includes(s2) || s2.includes(s1)) return 0.8;
  
  // Simple word overlap for longer strings
  const words1 = s1.split(/\s+/);
  const words2 = s2.split(/\s+/);
  const commonWords = words1.filter(w => words2.includes(w));
  
  if (commonWords.length > 0) {
    return commonWords.length / Math.max(words1.length, words2.length);
  }
  
  return 0;
}

/**
 * Calculate array overlap score
 */
function arrayOverlap(arr1: string[], arr2: string[]): number {
  if (!arr1?.length || !arr2?.length) return 0;
  
  const set1 = new Set(arr1.map(s => s.toLowerCase()));
  const set2 = new Set(arr2.map(s => s.toLowerCase()));
  
  let matches = 0;
  for (const item of set1) {
    for (const item2 of set2) {
      if (item === item2 || item.includes(item2) || item2.includes(item)) {
        matches++;
        break;
      }
    }
  }
  
  return matches / Math.max(set1.size, set2.size);
}

/**
 * Calculate license plate match score
 */
function licensePlateMatch(queryPlates: string[], targetPlates: string[]): number {
  if (!queryPlates?.length || !targetPlates?.length) return 0;
  
  for (const qPlate of queryPlates) {
    const cleanQuery = qPlate.replace(/[^A-Z0-9]/gi, '').toUpperCase();
    if (!cleanQuery || cleanQuery === 'OBSCURED' || cleanQuery === 'NOT_VISIBLE') continue;
    
    for (const tPlate of targetPlates) {
      const cleanTarget = tPlate.replace(/[^A-Z0-9]/gi, '').toUpperCase();
      if (!cleanTarget || cleanTarget === 'OBSCURED' || cleanTarget === 'NOT_VISIBLE') continue;
      
      // Exact match
      if (cleanQuery === cleanTarget) return 1.0;
      
      // Partial match (at least 4 characters)
      if (cleanQuery.length >= 4 && cleanTarget.includes(cleanQuery)) return 0.9;
      if (cleanTarget.length >= 4 && cleanQuery.includes(cleanTarget)) return 0.9;
      
      // First 3 characters match (common plate prefix)
      if (cleanQuery.slice(0, 3) === cleanTarget.slice(0, 3)) return 0.6;
    }
  }
  
  return 0;
}

/**
 * Calculate vehicle match score
 */
function vehicleMatch(queryVehicles: string[], targetVehicles: string[]): number {
  if (!queryVehicles?.length || !targetVehicles?.length) return 0;
  
  let bestScore = 0;
  
  for (const qVehicle of queryVehicles) {
    const qLower = qVehicle.toLowerCase();
    
    for (const tVehicle of targetVehicles) {
      const tLower = tVehicle.toLowerCase();
      let score = 0;
      
      // Check for vehicle type matches
      const vehicleTypes = ['car', 'sedan', 'suv', 'truck', 'motorcycle', 'mototaxi', 'bus', 'van', 'hatchback'];
      for (const type of vehicleTypes) {
        if (qLower.includes(type) && tLower.includes(type)) {
          score += 0.4;
          break;
        }
      }
      
      // Check for color matches
      const colors = ['white', 'black', 'red', 'blue', 'green', 'yellow', 'silver', 'gray', 'grey', 'orange', 'brown'];
      for (const color of colors) {
        if (qLower.includes(color) && tLower.includes(color)) {
          score += 0.3;
          break;
        }
      }
      
      // Check for make matches
      const makes = ['toyota', 'hyundai', 'kia', 'nissan', 'honda', 'ford', 'chevrolet', 'volkswagen', 'mercedes', 'bmw'];
      for (const make of makes) {
        if (qLower.includes(make) && tLower.includes(make)) {
          score += 0.3;
          break;
        }
      }
      
      bestScore = Math.max(bestScore, Math.min(1, score));
    }
  }
  
  return bestScore;
}

/**
 * Calculate confidence score between query image analysis and target event
 */
function calculateConfidence(
  query: GeminiAnalysisResult,
  target: any
): { confidence: number; reasons: string[] } {
  let totalScore = 0;
  let totalWeight = 0;
  const reasons: string[] = [];

  // License plate matching (40%)
  if (query.geminiLicensePlates?.length > 0) {
    const plateScore = licensePlateMatch(
      query.geminiLicensePlates,
      target.geminiLicensePlates || []
    );
    if (plateScore > 0) {
      totalScore += plateScore * FEATURE_WEIGHTS.licensePlate;
      reasons.push(`License plate match (${Math.round(plateScore * 100)}%)`);
    }
    totalWeight += FEATURE_WEIGHTS.licensePlate;
  }

  // Vehicle matching (25%)
  if (query.geminiVehicles?.length > 0) {
    const vehicleScore = vehicleMatch(
      query.geminiVehicles,
      target.geminiVehicles || []
    );
    if (vehicleScore > 0) {
      totalScore += vehicleScore * FEATURE_WEIGHTS.vehicleMatch;
      reasons.push(`Vehicle match (${Math.round(vehicleScore * 100)}%)`);
    }
    totalWeight += FEATURE_WEIGHTS.vehicleMatch;
  }

  // People count matching (10%)
  if (query.geminiPeopleCount > 0) {
    const targetPeople = target.geminiPeopleCount || 0;
    const peopleDiff = Math.abs(query.geminiPeopleCount - targetPeople);
    const peopleScore = peopleDiff === 0 ? 1 : peopleDiff === 1 ? 0.7 : peopleDiff <= 2 ? 0.4 : 0;
    if (peopleScore > 0) {
      totalScore += peopleScore * FEATURE_WEIGHTS.peopleCount;
      reasons.push(`People count: ${targetPeople} (${Math.round(peopleScore * 100)}% match)`);
    }
    totalWeight += FEATURE_WEIGHTS.peopleCount;
  }

  // Clothing color matching (15%)
  if (query.geminiClothingColors?.length > 0) {
    const clothingScore = arrayOverlap(
      query.geminiClothingColors,
      target.geminiClothingColors || []
    );
    if (clothingScore > 0) {
      totalScore += clothingScore * FEATURE_WEIGHTS.clothingColors;
      reasons.push(`Clothing colors match (${Math.round(clothingScore * 100)}%)`);
    }
    totalWeight += FEATURE_WEIGHTS.clothingColors;
  }

  // Dominant colors (5%)
  if (query.geminiDominantColors?.length > 0) {
    const colorScore = arrayOverlap(
      query.geminiDominantColors,
      target.geminiDominantColors || []
    );
    if (colorScore > 0) {
      totalScore += colorScore * FEATURE_WEIGHTS.dominantColors;
      reasons.push(`Scene colors match (${Math.round(colorScore * 100)}%)`);
    }
    totalWeight += FEATURE_WEIGHTS.dominantColors;
  }

  // Text matching (5%)
  if (query.geminiTextExtracted?.length > 0) {
    const textScore = arrayOverlap(
      query.geminiTextExtracted,
      target.geminiTextExtracted || []
    );
    if (textScore > 0) {
      totalScore += textScore * FEATURE_WEIGHTS.textMatch;
      reasons.push(`Text match (${Math.round(textScore * 100)}%)`);
    }
    totalWeight += FEATURE_WEIGHTS.textMatch;
  }

  // Normalize if not all features present
  const confidence = totalWeight > 0 ? (totalScore / totalWeight) * 100 : 0;

  return {
    confidence: Math.round(confidence * 10) / 10, // Round to 1 decimal
    reasons,
  };
}

/**
 * Search Neo4j for matching events
 */
async function findMatchingEvents(
  queryAnalysis: GeminiAnalysisResult,
  limit: number = 50
): Promise<MatchResult[]> {
  if (!isNeo4jConfigured()) {
    throw new Error("Neo4j not configured");
  }

  // Build query conditions based on what we found in the uploaded image
  const conditions: string[] = ["e.geminiProcessedAt IS NOT NULL", "e.imageUrl IS NOT NULL"];
  const params: any = {};

  // Add filter conditions to narrow down candidates
  // We'll calculate detailed confidence scores on the results
  
  // If we have license plates, prioritize those matches
  if (queryAnalysis.geminiLicensePlates?.length > 0) {
    const validPlates = queryAnalysis.geminiLicensePlates.filter(
      p => p && p !== 'obscured' && p !== 'not_visible'
    );
    if (validPlates.length > 0) {
      conditions.push("size(e.geminiLicensePlates) > 0");
    }
  }

  // If we have vehicles, search for events with vehicles
  if (queryAnalysis.geminiVehicles?.length > 0) {
    conditions.push("size(e.geminiVehicles) > 0");
  }

  // If we have people, search for events with people
  if (queryAnalysis.geminiPeopleCount > 0) {
    conditions.push("e.geminiPeopleCount > 0");
  }

  try {
    const results = await readTransaction(async (tx) => {
      const result = await tx.run(
        `
        MATCH (e:Event)
        WHERE ${conditions.join(" AND ")}
        RETURN e
        ORDER BY e.timestamp DESC
        LIMIT 200
        `
      );

      return result.records.map((record: any) => nodeToObject<any>(record.get('e')));
    });

    // Calculate confidence scores for each result
    const scoredResults: MatchResult[] = [];

    for (const event of results) {
      const { confidence, reasons } = calculateConfidence(queryAnalysis, event);
      
      // Only include results with meaningful confidence
      if (confidence >= 10) {
        scoredResults.push({
          id: event.id,
          eventId: event.eventId || event.id,
          imageUrl: event.imageUrl,
          channelId: event.channelId,
          timestamp: toNumber(event.timestamp),
          confidence,
          matchReasons: reasons,
          geminiCaption: event.geminiCaption,
          geminiVehicles: event.geminiVehicles,
          geminiLicensePlates: event.geminiLicensePlates,
          geminiPeopleCount: toNumber(event.geminiPeopleCount),
          geminiClothingColors: event.geminiClothingColors,
          geminiObjects: event.geminiObjects,
          geminiDominantColors: event.geminiDominantColors,
          geminiTextExtracted: event.geminiTextExtracted,
        });
      }
    }

    // Sort by confidence and limit
    scoredResults.sort((a, b) => b.confidence - a.confidence);
    return scoredResults.slice(0, limit);

  } catch (error) {
    console.error('[Reverse Image Search] Neo4j query error:', error);
    throw error;
  }
}

/**
 * POST: Perform reverse image search
 * 
 * Request body:
 * - image: base64 encoded image data
 * - mimeType: image MIME type (e.g., "image/jpeg")
 * - limit: max results (default 50)
 */
export default async function handler(
  req: VercelRequest,
  res: VercelResponse
): Promise<void> {
  // Handle CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const startTime = Date.now();

  try {
    // Validate request body
    const { image, mimeType, limit = 50 } = req.body;

    if (!image) {
      res.status(400).json({ error: 'Missing image data' });
      return;
    }

    if (!mimeType) {
      res.status(400).json({ error: 'Missing mimeType' });
      return;
    }

    // Check Gemini configuration
    if (!isGeminiConfigured()) {
      res.status(503).json({ 
        error: 'Gemini API not configured',
        message: 'GEMINI_API_KEY environment variable is not set'
      });
      return;
    }

    // Check Neo4j configuration
    if (!isNeo4jConfigured()) {
      res.status(503).json({ 
        error: 'Neo4j not configured',
        message: 'Neo4j connection is required for reverse image search'
      });
      return;
    }

    // Get configured model
    const modelStr = await getSystemConfig(GEMINI_CONFIG_KEYS.MODEL);
    const model = (modelStr && modelStr in GEMINI_MODELS ? modelStr : GEMINI_DEFAULTS.model) as GeminiModelId;

    console.log('[Reverse Image Search] Analyzing uploaded image...');

    // Analyze the uploaded image
    const analysis = await analyzeUploadedImage(image, mimeType, model);

    if (!analysis) {
      res.status(500).json({ error: 'Failed to analyze image' });
      return;
    }

    console.log('[Reverse Image Search] Image analyzed, searching for matches...');

    // Find matching events
    const matches = await findMatchingEvents(analysis, limit);

    const duration = Date.now() - startTime;
    console.log(`[Reverse Image Search] Found ${matches.length} matches in ${duration}ms`);

    // Return results
    res.status(200).json({
      success: true,
      analysis: {
        caption: analysis.geminiCaption,
        vehicles: analysis.geminiVehicles,
        licensePlates: analysis.geminiLicensePlates,
        peopleCount: analysis.geminiPeopleCount,
        clothingColors: analysis.geminiClothingColors,
        objects: analysis.geminiObjects,
        dominantColors: analysis.geminiDominantColors,
        textExtracted: analysis.geminiTextExtracted,
        timeOfDay: analysis.geminiTimeOfDay,
        environment: analysis.geminiEnvironment,
      },
      matches,
      stats: {
        totalMatches: matches.length,
        processingTimeMs: duration,
        model,
      },
    });

  } catch (error) {
    console.error('[Reverse Image Search] Error:', error);
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Unknown error',
      processingTimeMs: Date.now() - startTime,
    });
  }
}
