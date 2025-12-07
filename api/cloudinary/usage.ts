/**
 * Cloudinary Usage Statistics API Endpoint
 * 
 * Fetches account usage data from Cloudinary Admin API
 * Returns storage, bandwidth, transformations, credits, and account info
 */
import type { VercelRequest, VercelResponse } from "@vercel/node";

interface CloudinaryUsageResponse {
  success: boolean;
  usage?: {
    credits: {
      used: number;
      limit: number;
      used_percent: number;
    };
    storage: {
      usage: number;
      usage_mb: number;
      credits_usage: number;
    };
    bandwidth: {
      usage: number;
      usage_mb: number;
      credits_usage: number;
    };
    transformations: {
      usage: number;
      credits_usage: number;
    };
    objects: {
      usage: number;
    };
    resources: number;
    derived_resources: number;
    media_limits: {
      image_max_size_bytes: number;
      video_max_size_bytes: number;
      raw_max_size_bytes: number;
    };
  };
  plan?: string;
  last_updated?: string;
  rate_limit_remaining?: number;
  error?: string;
}

interface CloudinaryError {
  success: false;
  error: string;
  configured: boolean;
}

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
): Promise<void> {
  // Set CORS headers
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (req.method === "OPTIONS") {
    res.status(200).end();
    return;
  }

  if (req.method !== "GET") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
  const apiKey = process.env.CLOUDINARY_API_KEY;
  const apiSecret = process.env.CLOUDINARY_API_SECRET;

  // Check if Cloudinary is configured
  if (!cloudName || !apiKey || !apiSecret) {
    const errorResponse: CloudinaryError = {
      success: false,
      error: "Cloudinary not configured - missing credentials",
      configured: false,
    };
    res.status(200).json(errorResponse);
    return;
  }

  try {
    // Call Cloudinary Admin API for usage statistics
    const auth = Buffer.from(`${apiKey}:${apiSecret}`).toString("base64");
    
    // Fetch usage data
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
      const errorText = await usageResponse.text();
      console.error("[Cloudinary Usage] API error:", usageResponse.status, errorText);
      
      res.status(200).json({
        success: false,
        error: `Cloudinary API error: ${usageResponse.status} ${usageResponse.statusText}`,
        configured: true,
      });
      return;
    }

    const usageData = await usageResponse.json();

    // Log raw response for debugging
    console.log("[Cloudinary Usage] Raw API response:", JSON.stringify(usageData, null, 2));

    // Get rate limit info from headers
    const rateLimitRemaining = usageResponse.headers.get("x-featureratelimit-remaining");

    // Calculate MB values for better readability
    const bytesToMB = (bytes: number) => bytes / (1024 * 1024);

    // Extract credits usage from individual categories
    const storageCredits = usageData.storage?.credits_usage || 0;
    const bandwidthCredits = usageData.bandwidth?.credits_usage || 0;
    const transformationsCredits = usageData.transformations?.credits_usage || 0;
    
    // Calculate total credits used - sum from components if credits.used is 0
    let totalCreditsUsed = usageData.credits?.used || 0;
    if (totalCreditsUsed === 0) {
      totalCreditsUsed = storageCredits + bandwidthCredits + transformationsCredits;
    }
    
    // Get credit limit
    const creditLimit = usageData.credits?.limit || 600;
    
    // Calculate percentage
    const creditsUsedPercent = creditLimit > 0 
      ? (totalCreditsUsed / creditLimit) * 100 
      : 0;

    // Format the response
    const response: CloudinaryUsageResponse = {
      success: true,
      usage: {
        credits: {
          used: totalCreditsUsed,
          limit: creditLimit,
          used_percent: creditsUsedPercent,
        },
        storage: {
          usage: usageData.storage?.usage || 0,
          usage_mb: bytesToMB(usageData.storage?.usage || 0),
          credits_usage: usageData.storage?.credits_usage || 0,
        },
        bandwidth: {
          usage: usageData.bandwidth?.usage || 0,
          usage_mb: bytesToMB(usageData.bandwidth?.usage || 0),
          credits_usage: usageData.bandwidth?.credits_usage || 0,
        },
        transformations: {
          usage: usageData.transformations?.usage || 0,
          credits_usage: usageData.transformations?.credits_usage || 0,
        },
        objects: {
          usage: usageData.objects?.usage || 0,
        },
        resources: usageData.resources || 0,
        derived_resources: usageData.derived_resources || 0,
        media_limits: {
          image_max_size_bytes: usageData.media_limits?.image_max_size_bytes || 0,
          video_max_size_bytes: usageData.media_limits?.video_max_size_bytes || 0,
          raw_max_size_bytes: usageData.media_limits?.raw_max_size_bytes || 0,
        },
      },
      plan: usageData.plan || "Unknown",
      last_updated: usageData.last_updated || new Date().toISOString(),
      rate_limit_remaining: rateLimitRemaining ? parseInt(rateLimitRemaining, 10) : undefined,
    };

    // Cache the response for 60 seconds
    res.setHeader("Cache-Control", "public, max-age=60, stale-while-revalidate=120");
    res.status(200).json(response);

  } catch (error) {
    console.error("[Cloudinary Usage] Error:", error);
    
    res.status(200).json({
      success: false,
      error: error instanceof Error ? error.message : "Unknown error fetching usage data",
      configured: true,
    });
  }
}

