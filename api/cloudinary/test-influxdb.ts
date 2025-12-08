/**
 * Test endpoint to verify InfluxDB configuration and connection
 */
import type { VercelRequest, VercelResponse } from "@vercel/node";
import {
  isInfluxDBConfigured,
  getInfluxDBStatus,
  ensureBucketExists,
  writeMetricPoint,
  queryMetrics,
  CloudinaryMetricPoint,
} from "../lib/influxdb.js";

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
): Promise<void> {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    res.status(200).end();
    return;
  }

  const results: Record<string, any> = {
    timestamp: new Date().toISOString(),
    environment: {
      INFLUXDB_HOST: process.env.INFLUXDB_HOST ? "✅ Set" : "❌ Missing",
      INFLUXDB_TOKEN: process.env.INFLUXDB_TOKEN ? "✅ Set" : "❌ Missing",
      INFLUXDB_ORG: process.env.INFLUXDB_ORG ? "✅ Set" : "❌ Missing",
      INFLUXDB_ORG_ID: process.env.INFLUXDB_ORG_ID ? "✅ Set" : "❌ Missing",
    },
  };

  // Step 1: Check configuration
  results.configuration = {
    isConfigured: isInfluxDBConfigured(),
    status: getInfluxDBStatus(),
  };

  if (!isInfluxDBConfigured()) {
    results.error = "InfluxDB is not configured. Missing INFLUXDB_TOKEN or INFLUXDB_ORG_ID";
    res.status(200).json(results);
    return;
  }

  // Step 2: Try to ensure bucket exists
  try {
    const bucketResult = await ensureBucketExists();
    results.bucket = {
      step: "ensureBucketExists",
      success: bucketResult.success,
      error: bucketResult.error,
    };
  } catch (error) {
    results.bucket = {
      step: "ensureBucketExists",
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }

  // Step 3: Try to write actual data from Cloudinary
  if (req.query.action === "write" || req.query.action === "full") {
    try {
      // Fetch real data from Cloudinary if configured
      const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
      const apiKey = process.env.CLOUDINARY_API_KEY;
      const apiSecret = process.env.CLOUDINARY_API_SECRET;

      let testMetric: CloudinaryMetricPoint;

      if (cloudName && apiKey && apiSecret) {
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

        if (usageResponse.ok) {
          const usageData = await usageResponse.json();
          
          // Calculate total credits used
          let totalCreditsUsed = usageData.credits?.used || 0;
          if (totalCreditsUsed === 0) {
            totalCreditsUsed = 
              (usageData.storage?.credits_usage || 0) +
              (usageData.bandwidth?.credits_usage || 0) +
              (usageData.transformations?.credits_usage || 0);
          }

          testMetric = {
            timestamp: new Date(),
            credits_used: totalCreditsUsed,
            credits_limit: usageData.credits?.limit || 0,
            credits_percent: usageData.credits?.limit
              ? (totalCreditsUsed / usageData.credits.limit) * 100
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

          results.cloudinary = {
            configured: true,
            dataFetched: true,
          };
        } else {
          throw new Error(`Cloudinary API error: ${usageResponse.status}`);
        }
      } else {
        // Use test data if Cloudinary not configured
        testMetric = {
          timestamp: new Date(),
          credits_used: 0.1,
          credits_limit: 25000,
          credits_percent: 0.0004,
          storage_bytes: 1000000,
          storage_credits: 0.01,
          bandwidth_bytes: 500000,
          bandwidth_credits: 0.005,
          transformations_count: 10,
          transformations_credits: 0.002,
          resources_count: 5,
          derived_resources_count: 2,
        };
        results.cloudinary = {
          configured: false,
          dataFetched: false,
          note: "Using test data",
        };
      }

      const writeResult = await writeMetricPoint(testMetric);
      results.writeTest = {
        step: "writeMetricPoint",
        success: writeResult.success,
        error: writeResult.error,
        data: testMetric,
      };
    } catch (error) {
      results.writeTest = {
        step: "writeMetricPoint",
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  // Step 4: Try to query data
  if (req.query.action === "query" || req.query.action === "full") {
    try {
      const queryResult = await queryMetrics("1h");
      results.queryTest = {
        step: "queryMetrics",
        success: queryResult.success,
        error: queryResult.error,
        dataPoints: {
          credits: queryResult.data?.credits?.length || 0,
          storage: queryResult.data?.storage?.length || 0,
          bandwidth: queryResult.data?.bandwidth?.length || 0,
          transformations: queryResult.data?.transformations?.length || 0,
          resources: queryResult.data?.resources?.length || 0,
        },
        // Include sample data for debugging
        sampleData: {
          credits: queryResult.data?.credits?.slice(0, 3) || [],
          storage: queryResult.data?.storage?.slice(0, 3) || [],
        },
      };
    } catch (error) {
      results.queryTest = {
        step: "queryMetrics",
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  // Step 5: Raw query test for debugging
  if (req.query.action === "debug") {
    try {
      const INFLUXDB_HOST = process.env.INFLUXDB_HOST || "https://us-east-1-1.aws.cloud2.influxdata.com";
      const INFLUXDB_ORG = process.env.INFLUXDB_ORG || "ELI";
      const INFLUXDB_TOKEN = process.env.INFLUXDB_TOKEN;
      const INFLUXDB_BUCKET = "cloudinary_metrics";

      const queryUrl = `${INFLUXDB_HOST}/api/v2/query?org=${INFLUXDB_ORG}`;
      const fluxQuery = `
from(bucket: "${INFLUXDB_BUCKET}")
  |> range(start: -1h)
  |> filter(fn: (r) => r._measurement == "cloudinary_usage")
  |> limit(n: 10)
`;

      const response = await fetch(queryUrl, {
        method: "POST",
        headers: {
          Authorization: `Token ${INFLUXDB_TOKEN}`,
          "Content-Type": "application/vnd.flux",
          Accept: "application/csv",
        },
        body: fluxQuery,
      });

      const csvData = await response.text();
      results.debugQuery = {
        status: response.status,
        ok: response.ok,
        rawCsvLength: csvData.length,
        rawCsvPreview: csvData.substring(0, 2000),
        headers: Object.fromEntries(response.headers.entries()),
      };
    } catch (error) {
      results.debugQuery = {
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  // Summary
  const allSuccess = 
    results.configuration?.isConfigured &&
    results.bucket?.success !== false;

  results.summary = {
    ready: allSuccess,
    message: allSuccess
      ? "InfluxDB is configured and ready. Use ?action=write to test writing, ?action=query to test reading, or ?action=full for both."
      : "InfluxDB has configuration issues. See errors above.",
  };

  res.status(200).json(results);
}

