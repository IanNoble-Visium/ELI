/**
 * Cloudinary Metrics API Endpoint
 * 
 * Records current Cloudinary usage to InfluxDB and retrieves historical data
 * for time-series visualization and forecasting.
 */
import type { VercelRequest, VercelResponse } from "@vercel/node";
import {
  writeMetricPoint,
  queryMetrics,
  queryMetricsRange,
  calculateUsageRate,
  isInfluxDBConfigured,
  getInfluxDBStatus,
  ensureBucketExists,
  CloudinaryMetricPoint,
  TimeSeriesData,
} from "../lib/influxdb.js";

interface MetricsResponse {
  success: boolean;
  action?: "record" | "query" | "status";
  data?: {
    credits?: TimeSeriesData[];
    storage?: TimeSeriesData[];
    bandwidth?: TimeSeriesData[];
    transformations?: TimeSeriesData[];
    resources?: TimeSeriesData[];
  };
  projections?: {
    credits_days_remaining?: number;
    credits_exhaustion_date?: string;
    daily_rates?: {
      credits: number;
      storage: number;
      bandwidth: number;
      transformations: number;
      resources: number;
    };
  };
  influxdb_status?: {
    configured: boolean;
    host: string;
    org: string;
  };
  error?: string;
}

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
): Promise<void> {
  // Set CORS headers
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (req.method === "OPTIONS") {
    res.status(200).end();
    return;
  }

  if (req.method === "POST") {
    await handleRecordMetrics(req, res);
    return;
  }

  if (req.method === "GET") {
    await handleQueryMetrics(req, res);
    return;
  }

  res.status(405).json({ error: "Method not allowed" });
}

async function handleRecordMetrics(
  req: VercelRequest,
  res: VercelResponse
): Promise<void> {
  try {
    const bucketResult = await ensureBucketExists();
    if (!bucketResult.success) {
      console.warn("[Metrics] Bucket setup failed:", bucketResult.error);
    }

    const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
    const apiKey = process.env.CLOUDINARY_API_KEY;
    const apiSecret = process.env.CLOUDINARY_API_SECRET;

    if (!cloudName || !apiKey || !apiSecret) {
      res.status(200).json({
        success: false,
        error: "Cloudinary not configured",
      });
      return;
    }

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
      res.status(200).json({
        success: false,
        error: `Cloudinary API error: ${usageResponse.status}`,
      });
      return;
    }

    const usageData = await usageResponse.json();

    const metricPoint: CloudinaryMetricPoint = {
      timestamp: new Date(),
      credits_used: usageData.credits?.used || 0,
      credits_limit: usageData.credits?.limit || 0,
      credits_percent: usageData.credits?.limit 
        ? ((usageData.credits?.used || 0) / usageData.credits.limit) * 100 
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

    const writeResult = await writeMetricPoint(metricPoint);

    if (!writeResult.success) {
      res.status(200).json({
        success: false,
        action: "record",
        error: writeResult.error,
        influxdb_status: getInfluxDBStatus(),
      });
      return;
    }

    res.status(200).json({
      success: true,
      action: "record",
      data: {
        recorded_at: metricPoint.timestamp.toISOString(),
        credits_used: metricPoint.credits_used,
        credits_limit: metricPoint.credits_limit,
      },
      influxdb_status: getInfluxDBStatus(),
    });

  } catch (error) {
    console.error("[Metrics] Record error:", error);
    res.status(200).json({
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
}

async function handleQueryMetrics(
  req: VercelRequest,
  res: VercelResponse
): Promise<void> {
  try {
    const { range, start, end, metric, action } = req.query;

    if (action === "status") {
      const status = getInfluxDBStatus();
      res.status(200).json({
        success: true,
        action: "status",
        influxdb_status: status,
      });
      return;
    }

    if (!isInfluxDBConfigured()) {
      res.status(200).json({
        success: false,
        error: "InfluxDB not configured",
        influxdb_status: getInfluxDBStatus(),
      });
      return;
    }

    let queryResult;

    if (start && end) {
      const startDate = new Date(start as string);
      const endDate = new Date(end as string);
      
      if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
        res.status(400).json({
          success: false,
          error: "Invalid date format. Use ISO 8601 format.",
        });
        return;
      }

      queryResult = await queryMetricsRange(
        startDate,
        endDate,
        metric as string | undefined
      );
    } else {
      const timeRange = (range as string) || "24h";
      const validRanges = ["1h", "12h", "24h", "7d", "30d"];
      
      if (!validRanges.includes(timeRange)) {
        res.status(400).json({
          success: false,
          error: `Invalid range. Use one of: ${validRanges.join(", ")}`,
        });
        return;
      }

      queryResult = await queryMetrics(timeRange, metric as string | undefined);
    }

    if (!queryResult.success) {
      res.status(200).json({
        success: false,
        error: queryResult.error,
        influxdb_status: getInfluxDBStatus(),
      });
      return;
    }

    const ratesResult = await calculateUsageRate(7);
    let projections;

    if (ratesResult.success && ratesResult.rates) {
      const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
      const apiKey = process.env.CLOUDINARY_API_KEY;
      const apiSecret = process.env.CLOUDINARY_API_SECRET;

      if (cloudName && apiKey && apiSecret) {
        const auth = Buffer.from(`${apiKey}:${apiSecret}`).toString("base64");
        const usageResponse = await fetch(
          `https://api.cloudinary.com/v1_1/${cloudName}/usage`,
          {
            method: "GET",
            headers: {
              Authorization: `Basic ${auth}`,
            },
          }
        );

        if (usageResponse.ok) {
          const usageData = await usageResponse.json();
          const creditsRemaining = (usageData.credits?.limit || 0) - (usageData.credits?.used || 0);
          const dailyRate = ratesResult.rates.credits_per_day;

          if (dailyRate > 0) {
            const daysRemaining = creditsRemaining / dailyRate;
            const exhaustionDate = new Date();
            exhaustionDate.setDate(exhaustionDate.getDate() + daysRemaining);

            projections = {
              credits_days_remaining: Math.round(daysRemaining),
              credits_exhaustion_date: exhaustionDate.toISOString(),
              daily_rates: ratesResult.rates,
            };
          }
        }
      }
    }

    res.setHeader("Cache-Control", "public, max-age=300, stale-while-revalidate=600");
    
    res.status(200).json({
      success: true,
      action: "query",
      data: queryResult.data,
      projections,
      influxdb_status: getInfluxDBStatus(),
    } as MetricsResponse);

  } catch (error) {
    console.error("[Metrics] Query error:", error);
    res.status(200).json({
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
}

