/**
 * Google Gemini AI Integration for Image Analysis
 * 
 * Provides image metadata extraction from surveillance camera images
 * using Google's Gemini Vision models.
 */

// Gemini model options
export const GEMINI_MODELS = {
  'gemini-1.5-flash': {
    name: 'Gemini 1.5 Flash',
    description: 'Fast and efficient, good for high-volume processing',
    rpm: 15,
    rpd: 1500,
  },
  'gemini-1.5-flash-8b': {
    name: 'Gemini 1.5 Flash 8B',
    description: 'Smaller model, faster responses',
    rpm: 15,
    rpd: 1500,
  },
  'gemini-1.5-pro': {
    name: 'Gemini 1.5 Pro',
    description: 'Most capable, best for complex analysis',
    rpm: 2,
    rpd: 50,
  },
  'gemini-2.0-flash': {
    name: 'Gemini 2.0 Flash',
    description: 'Latest model with improved capabilities',
    rpm: 15,
    rpd: 1500,
  },
} as const;

export type GeminiModelId = keyof typeof GEMINI_MODELS;

// Default configuration
export const GEMINI_DEFAULTS = {
  model: 'gemini-2.0-flash' as GeminiModelId,
  batchSize: 100,
  enabled: false,
  scheduleMinutes: 30,
  delayBetweenRequestsMs: 4100, // ~14.6 RPM to stay under 15 RPM limit
};

// Gemini configuration keys for system_config table
export const GEMINI_CONFIG_KEYS = {
  MODEL: 'gemini_model',
  BATCH_SIZE: 'gemini_batch_size',
  ENABLED: 'gemini_enabled',
  SCHEDULE_MINUTES: 'gemini_schedule_minutes',
  DAILY_REQUESTS_COUNT: 'gemini_daily_requests_count',
  DAILY_REQUESTS_DATE: 'gemini_daily_requests_date',
};

/**
 * Gemini analysis result structure
 * Designed for Neo4j property storage and Cypher querying
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
  
  // Raw detailed objects (for advanced queries)
  geminiDetailedObjects: GeminiDetectedObject[];
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
export const GEMINI_ANALYSIS_PROMPT = `You are an expert security camera image analyst specializing in surveillance footage from Peru. Analyze this image and extract detailed metadata for security and investigative purposes.

IMPORTANT: Return ONLY valid JSON with no markdown formatting, no code blocks, no explanations - just the raw JSON object.

Extract the following information:

1. **Scene Description**: A detailed natural language description of what's happening in the image.

2. **Tags**: Descriptive tags for categorization (e.g., "daytime", "street", "traffic", "residential", "commercial", "night_vision", "motion_blur").

3. **Objects Detected**: List all significant objects visible (person, car, motorcycle, bicycle, truck, bus, dog, bag, backpack, phone, etc.).

4. **People Count**: Exact count of people visible in the image.

5. **Vehicles**: Types of vehicles detected with details (car, motorcycle, mototaxi, bus, truck, bicycle, etc.).

6. **Weapons**: Any weapons detected (gun, knife, bat, etc.). If none, return empty array.

7. **Clothing Colors**: Colors of clothing worn by people in the image.

8. **Dominant Colors**: The 3-5 most dominant colors in the image as hex codes.

9. **License Plates**: Any visible license plate numbers. Peru plates typically follow formats like ABC-123 or A1B-234. Extract exactly as visible.

10. **Text Extracted**: Any visible text from signs, shirts, storefronts, banners, etc.

11. **Quality Score**: Rate image quality from 0-100 (100 = perfect clarity).

12. **Blur Score**: Rate blur level from 0-100 (100 = extremely blurred, 0 = sharp).

13. **Detailed Objects**: For each significant object, provide structured details including location in frame and attributes.

Return this exact JSON structure:
{
  "geminiCaption": "string - detailed scene description",
  "geminiTags": ["array", "of", "tags"],
  "geminiObjects": ["person", "car", "etc"],
  "geminiPeopleCount": 0,
  "geminiVehicles": ["car - dark grey SUV", "motorcycle - red"],
  "geminiWeapons": [],
  "geminiClothingColors": ["blue", "white", "black"],
  "geminiDominantColors": ["#808080", "#2F4F4F", "#000000"],
  "geminiLicensePlates": ["ABC-123"],
  "geminiTextExtracted": ["STOP", "Calle Lima"],
  "geminiQualityScore": 75,
  "geminiBlurScore": 15,
  "geminiDetailedObjects": [
    {
      "id": "vehicle_1",
      "type": "vehicle",
      "description": "Dark grey compact SUV, possibly Daihatsu Terios",
      "location": "center",
      "attributes": {
        "color": "dark grey",
        "license_plate": "D2D-035",
        "country": "Peru"
      }
    }
  ]
}

Remember: Return ONLY the JSON object, nothing else.`;

/**
 * Check if Gemini API is configured
 */
export function isGeminiConfigured(): boolean {
  return !!process.env.GEMINI_API_KEY;
}

/**
 * Get Gemini API key
 */
export function getGeminiApiKey(): string | null {
  return process.env.GEMINI_API_KEY || null;
}

/**
 * Analyze an image using Gemini Vision API
 */
export async function analyzeImageWithGemini(
  imageUrl: string,
  model: GeminiModelId = 'gemini-2.0-flash'
): Promise<GeminiAnalysisResult | null> {
  const apiKey = getGeminiApiKey();
  if (!apiKey) {
    console.error('[Gemini] API key not configured');
    return null;
  }

  // Validate URL
  if (!imageUrl || !imageUrl.startsWith('http')) {
    console.error('[Gemini] Invalid image URL:', imageUrl);
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

    // Call Gemini API (use v1 for stable models like gemini-1.5-flash)
    const apiUrl = `https://generativelanguage.googleapis.com/v1/models/${model}:generateContent?key=${apiKey}`;
    
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
    
    // Extract text from response
    const textContent = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!textContent) {
      throw new Error('No text content in Gemini response');
    }

    // Parse JSON response (handle potential markdown code blocks)
    let jsonStr = textContent.trim();
    
    // Remove markdown code blocks if present
    if (jsonStr.startsWith('```json')) {
      jsonStr = jsonStr.slice(7);
    } else if (jsonStr.startsWith('```')) {
      jsonStr = jsonStr.slice(3);
    }
    if (jsonStr.endsWith('```')) {
      jsonStr = jsonStr.slice(0, -3);
    }
    jsonStr = jsonStr.trim();

    const result = JSON.parse(jsonStr) as GeminiAnalysisResult;
    
    // Validate and sanitize result
    return sanitizeGeminiResult(result);
  } catch (error) {
    console.error('[Gemini] Error analyzing image:', error);
    throw error;
  }
}

/**
 * Sanitize and validate Gemini result
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
    geminiDetailedObjects: Array.isArray(result.geminiDetailedObjects) ? result.geminiDetailedObjects.map(sanitizeDetailedObject) : [],
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
