/**
 * Z.ai Vision AI Integration for Image Analysis
 * 
 * Provides image metadata extraction from surveillance camera images
 * using Z.ai's GLM vision models (OpenAI-compatible API).
 * 
 * Migrated from Google Gemini API (Feb 2026) to reduce costs.
 * Z.ai free tiers for Flash models vs. Gemini's $0.10-$2.50 per 1M tokens.
 */

// Z.ai model options
export const GEMINI_MODELS = {
  'glm-4.6v': {
    name: 'GLM-4.6V',
    description: 'Vision-language model, 128K context, images/video/text',
    rpm: 30,
    rpd: 5000,
  },
  'glm-4.7-flash': {
    name: 'GLM-4.7-Flash',
    description: 'Fast flash model, free tier, lightweight',
    rpm: 60,
    rpd: 10000,
  },
} as const;

export type GeminiModelId = keyof typeof GEMINI_MODELS;

// Default configuration
export const GEMINI_DEFAULTS = {
  model: 'glm-4.6v' as GeminiModelId,
  batchSize: 100,
  enabled: false,
  scheduleMinutes: 30,
  delayBetweenRequestsMs: 2100, // Conservative rate limiting
};

// Config keys for system_config table (kept as-is for DB compatibility)
export const GEMINI_CONFIG_KEYS = {
  MODEL: 'gemini_model',
  BATCH_SIZE: 'gemini_batch_size',
  ENABLED: 'gemini_enabled',
  SCHEDULE_MINUTES: 'gemini_schedule_minutes',
  DAILY_REQUESTS_COUNT: 'gemini_daily_requests_count',
  DAILY_REQUESTS_DATE: 'gemini_daily_requests_date',
};

/**
 * Analysis result structure
 * Designed for Neo4j property storage and Cypher querying
 * Property names kept as `gemini*` for backward compatibility with existing data
 */
export interface GeminiAnalysisResult {
  // Scene description
  geminiCaption: string;
  geminiTags: string[];

  // Object detection
  geminiObjects: string[];
  geminiPeopleCount: number;
  geminiVehicles: string[];
  geminiWeapons: string[];

  // Visual attributes
  geminiClothingColors: string[];
  geminiDominantColors: string[];

  // Text and identification
  geminiLicensePlates: string[];
  geminiTextExtracted: string[];

  // Quality metrics
  geminiQualityScore: number;
  geminiBlurScore: number;

  // Scene/Environment metadata
  geminiTimeOfDay: string;
  geminiLightingCondition: string;
  geminiEnvironment: string;
  geminiWeatherCondition: string;
  geminiCameraPerspective: string;

  // Enhanced vehicle details
  geminiVehicleDetails: GeminiVehicleDetail[];

  // Raw detailed objects (for advanced queries)
  geminiDetailedObjects: GeminiDetectedObject[];
}

export interface GeminiVehicleDetail {
  type: string;
  make: string;
  model: string;
  color: string;
  licensePlate: string;
  direction: string;
  emergencyVehicle: boolean;
  emergencyLightsActive: boolean;
  liveryColors: string[];
  textOnVehicle: string[];
}

export interface GeminiDetectedObject {
  id: string;
  type: string;
  description: string;
  location: string;
  attributes: Record<string, string>;
}

/**
 * The surveillance image analysis prompt
 * Optimized for Peru security camera scenarios
 */
export const GEMINI_ANALYSIS_PROMPT = `You are an expert security camera image analyst specializing in surveillance footage. Analyze this image and extract comprehensive metadata for security, investigation, and cross-image correlation purposes.

IMPORTANT: Return ONLY valid JSON with no markdown formatting, no code blocks, no explanations - just the raw JSON object.

Extract ALL of the following information with maximum detail:

## SCENE & ENVIRONMENT
1. **Scene Description**: Detailed natural language description of the scene, activity, and context.
2. **Time of Day**: night, early_morning, morning, afternoon, evening, dusk, dawn
3. **Lighting Condition**: natural_daylight, artificial, low_light, infrared, emergency_lights, mixed, backlit
4. **Environment**: urban_street, highway, residential, commercial, parking_lot, intersection, rural, indoor
5. **Weather Condition**: clear, rainy, foggy, overcast, unknown
6. **Camera Perspective**: overhead, eye_level, low_angle, side_view, front_view, rear_view

## OBJECTS & PEOPLE
7. **Objects Detected**: All significant objects (person, car, motorcycle, truck, bus, dog, bag, etc.)
8. **People Count**: Exact count of visible people
9. **Clothing Colors**: Colors worn by each person
10. **Weapons**: Any weapons detected (gun, knife, bat, etc.)

## VEHICLE DETAILS (Critical for correlation)
For EACH vehicle, extract:
- Type: car, suv, sedan, hatchback, truck, motorcycle, mototaxi, bus, van
- Make: Manufacturer if identifiable (Toyota, Hyundai, Kia, etc.)
- Model: Specific model if identifiable
- Color: Primary body color
- License Plate: Exact text if visible, or "obscured"/"not_visible"
- Direction: approaching, departing, stationary, turning_left, turning_right
- Emergency Vehicle: true/false
- Emergency Lights Active: true/false (if emergency vehicle)
- Livery Colors: Colors of any markings/livery on vehicle
- Text on Vehicle: Any text visible on the vehicle (company names, police text, etc.)

## TEXT & IDENTIFICATION
11. **License Plates**: All visible plate numbers (Peru format: ABC-123 or A1B-234)
12. **Text Extracted**: ALL visible text - signs, vehicle text, storefronts, banners, uniforms

## VISUAL QUALITY
13. **Dominant Colors**: 5 most dominant colors as hex codes
14. **Quality Score**: 0-100 (100 = perfect clarity)
15. **Blur Score**: 0-100 (100 = extremely blurred)

## TAGS
16. **Tags**: Comprehensive categorization tags

Return this exact JSON structure:
{
  "geminiCaption": "Detailed scene description including all activity, vehicles, people, and context",
  "geminiTags": ["night", "police", "emergency_vehicle", "urban", "traffic_stop"],
  "geminiObjects": ["car", "road", "lane_markings"],
  "geminiPeopleCount": 0,
  "geminiVehicles": ["police_car - white/blue Hyundai sedan"],
  "geminiWeapons": [],
  "geminiClothingColors": [],
  "geminiDominantColors": ["#000033", "#0066FF", "#FFFFFF", "#333333", "#FFFF00"],
  "geminiLicensePlates": ["ABC-123"],
  "geminiTextExtracted": ["SERENAZGO", "POLICIA"],
  "geminiQualityScore": 70,
  "geminiBlurScore": 20,
  "geminiTimeOfDay": "night",
  "geminiLightingCondition": "emergency_lights",
  "geminiEnvironment": "urban_street",
  "geminiWeatherCondition": "clear",
  "geminiCameraPerspective": "overhead",
  "geminiVehicleDetails": [
    {
      "type": "sedan",
      "make": "Hyundai",
      "model": "unknown",
      "color": "white",
      "licensePlate": "obscured",
      "direction": "approaching",
      "emergencyVehicle": true,
      "emergencyLightsActive": true,
      "liveryColors": ["white", "dark_blue"],
      "textOnVehicle": ["SERENAZGO"]
    }
  ],
  "geminiDetailedObjects": [
    {
      "id": "vehicle_1",
      "type": "vehicle",
      "description": "Police patrol vehicle with active emergency lights",
      "location": "center",
      "attributes": {
        "color": "white",
        "emergency_status": "active",
        "light_color": "blue"
      }
    }
  ]
}

Be thorough - this data is used to correlate and match vehicles/people across multiple camera feeds. Extract EVERY detail visible.
Remember: Return ONLY the JSON object, nothing else.`;

// Z.ai API constants
const ZAI_API_BASE = 'https://api.z.ai/api/paas/v4';
const ZAI_CHAT_ENDPOINT = `${ZAI_API_BASE}/chat/completions`;

/**
 * Check if Z.ai API is configured
 */
export function isGeminiConfigured(): boolean {
  return !!process.env.ZAI_API_KEY;
}

/**
 * Get Z.ai API key
 */
export function getGeminiApiKey(): string | null {
  return process.env.ZAI_API_KEY || null;
}

/**
 * Extract text content from a Z.ai chat completion response.
 * Handles both string and array content formats.
 */
function extractTextFromResponse(data: any): string | null {
  const content = data?.choices?.[0]?.message?.content;
  if (!content) return null;

  // content can be a plain string or an array of parts
  if (typeof content === 'string') return content;

  if (Array.isArray(content)) {
    return content
      .filter((p: any) => p?.type === 'text')
      .map((p: any) => p.text)
      .filter(Boolean)
      .join('\n');
  }

  return String(content);
}

/**
 * Strip markdown code fences from LLM output
 */
function stripCodeFences(text: string): string {
  let s = text.trim();
  if (s.startsWith('```json')) s = s.slice(7);
  else if (s.startsWith('```')) s = s.slice(3);
  if (s.endsWith('```')) s = s.slice(0, -3);
  return s.trim();
}

export async function generateTextWithGemini(params: {
  prompt: string;
  model?: GeminiModelId;
}): Promise<string> {
  const { prompt, model = 'glm-4.7-flash' as GeminiModelId } = params;
  const apiKey = getGeminiApiKey();
  if (!apiKey) {
    throw new Error('ZAI_API_KEY is not configured');
  }

  const response = await fetch(ZAI_CHAT_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: [
        {
          role: 'user',
          content: prompt,
        },
      ],
      temperature: 0.7,
      max_tokens: 4096,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Z.ai API error ${response.status}: ${errorText}`);
  }

  const data = await response.json();
  const textContent = extractTextFromResponse(data);
  if (!textContent) {
    throw new Error('No text content in Z.ai response');
  }
  return textContent;
}

/**
 * Analyze an image using Z.ai Vision API
 */
export async function analyzeImageWithGemini(
  imageUrl: string,
  model: GeminiModelId = 'glm-4.6v'
): Promise<GeminiAnalysisResult | null> {
  const apiKey = getGeminiApiKey();
  if (!apiKey) {
    console.error('[Z.ai] API key not configured');
    return null;
  }

  // Validate URL
  if (!imageUrl || !imageUrl.startsWith('http')) {
    console.error('[Z.ai] Invalid image URL:', imageUrl);
    return null;
  }

  try {
    // Fetch image and convert to base64
    const imageResponse = await fetch(imageUrl);
    if (!imageResponse.ok) {
      throw new Error(`Failed to fetch image: ${imageResponse.status}`);
    }

    const imageBuffer = await imageResponse.arrayBuffer();
    const base64Image = Buffer.from(imageBuffer).toString('base64');
    const mimeType = imageResponse.headers.get('content-type') || 'image/jpeg';

    // Call Z.ai Vision API (OpenAI-compatible format)
    const response = await fetch(ZAI_CHAT_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [
          {
            role: 'user',
            content: [
              { type: 'text', text: GEMINI_ANALYSIS_PROMPT },
              {
                type: 'image_url',
                image_url: {
                  url: `data:${mimeType};base64,${base64Image}`,
                },
              },
            ],
          },
        ],
        temperature: 0.1,
        top_p: 1,
        max_tokens: 4096,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Z.ai API error ${response.status}: ${errorText}`);
    }

    const data = await response.json();

    // Extract text from response
    const textContent = extractTextFromResponse(data);
    if (!textContent) {
      throw new Error('No text content in Z.ai response');
    }

    // Parse JSON response (handle potential markdown code blocks)
    const jsonStr = stripCodeFences(textContent);
    const result = JSON.parse(jsonStr) as GeminiAnalysisResult;

    // Validate and sanitize result
    return sanitizeGeminiResult(result);
  } catch (error) {
    console.error('[Z.ai] Error analyzing image:', error);
    throw error;
  }
}

/**
 * Sanitize and validate analysis result
 */
function sanitizeGeminiResult(result: any): GeminiAnalysisResult {
  return {
    geminiCaption: typeof result.geminiCaption === 'string' ? result.geminiCaption : '',
    geminiTags: Array.isArray(result.geminiTags) ? result.geminiTags.filter((t: any) => typeof t === 'string') : [],
    geminiObjects: Array.isArray(result.geminiObjects) ? result.geminiObjects.filter((o: any) => typeof o === 'string') : [],
    geminiPeopleCount: typeof result.geminiPeopleCount === 'number' ? Math.max(0, Math.floor(result.geminiPeopleCount)) : 0,
    geminiVehicles: Array.isArray(result.geminiVehicles) ? result.geminiVehicles.filter((v: any) => typeof v === 'string') : [],
    geminiWeapons: Array.isArray(result.geminiWeapons) ? result.geminiWeapons.filter((w: any) => typeof w === 'string') : [],
    geminiClothingColors: Array.isArray(result.geminiClothingColors) ? result.geminiClothingColors.filter((c: any) => typeof c === 'string') : [],
    geminiDominantColors: Array.isArray(result.geminiDominantColors) ? result.geminiDominantColors.filter((c: any) => typeof c === 'string') : [],
    geminiLicensePlates: Array.isArray(result.geminiLicensePlates) ? result.geminiLicensePlates.filter((p: any) => typeof p === 'string') : [],
    geminiTextExtracted: Array.isArray(result.geminiTextExtracted) ? result.geminiTextExtracted.filter((t: any) => typeof t === 'string') : [],
    geminiQualityScore: typeof result.geminiQualityScore === 'number' ? Math.min(100, Math.max(0, result.geminiQualityScore)) : 50,
    geminiBlurScore: typeof result.geminiBlurScore === 'number' ? Math.min(100, Math.max(0, result.geminiBlurScore)) : 50,
    geminiTimeOfDay: typeof result.geminiTimeOfDay === 'string' ? result.geminiTimeOfDay : 'unknown',
    geminiLightingCondition: typeof result.geminiLightingCondition === 'string' ? result.geminiLightingCondition : 'unknown',
    geminiEnvironment: typeof result.geminiEnvironment === 'string' ? result.geminiEnvironment : 'unknown',
    geminiWeatherCondition: typeof result.geminiWeatherCondition === 'string' ? result.geminiWeatherCondition : 'unknown',
    geminiCameraPerspective: typeof result.geminiCameraPerspective === 'string' ? result.geminiCameraPerspective : 'unknown',
    geminiVehicleDetails: Array.isArray(result.geminiVehicleDetails) ? result.geminiVehicleDetails.map(sanitizeVehicleDetail) : [],
    geminiDetailedObjects: Array.isArray(result.geminiDetailedObjects) ? result.geminiDetailedObjects.map(sanitizeDetailedObject) : [],
  };
}

function sanitizeVehicleDetail(v: any): GeminiVehicleDetail {
  return {
    type: typeof v.type === 'string' ? v.type : 'unknown',
    make: typeof v.make === 'string' ? v.make : 'unknown',
    model: typeof v.model === 'string' ? v.model : 'unknown',
    color: typeof v.color === 'string' ? v.color : 'unknown',
    licensePlate: typeof v.licensePlate === 'string' ? v.licensePlate : 'not_visible',
    direction: typeof v.direction === 'string' ? v.direction : 'unknown',
    emergencyVehicle: v.emergencyVehicle === true,
    emergencyLightsActive: v.emergencyLightsActive === true,
    liveryColors: Array.isArray(v.liveryColors) ? v.liveryColors.filter((c: any) => typeof c === 'string') : [],
    textOnVehicle: Array.isArray(v.textOnVehicle) ? v.textOnVehicle.filter((t: any) => typeof t === 'string') : [],
  };
}

function sanitizeDetailedObject(obj: any): GeminiDetectedObject {
  return {
    id: typeof obj.id === 'string' ? obj.id : `obj_${Date.now()}`,
    type: typeof obj.type === 'string' ? obj.type : 'unknown',
    description: typeof obj.description === 'string' ? obj.description : '',
    location: typeof obj.location === 'string' ? obj.location : 'unknown',
    attributes: typeof obj.attributes === 'object' && obj.attributes !== null ? obj.attributes : {},
  };
}

/**
 * Rate limit helper - calculates delay needed between requests
 */
export function calculateRequestDelay(model: GeminiModelId): number {
  const modelConfig = GEMINI_MODELS[model];
  // Calculate ms per request to stay under RPM limit with 10% buffer
  return Math.ceil((60 * 1000) / (modelConfig.rpm * 0.9));
}

/**
 * Check if daily limit is reached
 */
export function isDailyLimitReached(
  currentCount: number,
  model: GeminiModelId
): boolean {
  const modelConfig = GEMINI_MODELS[model];
  return currentCount >= modelConfig.rpd;
}
