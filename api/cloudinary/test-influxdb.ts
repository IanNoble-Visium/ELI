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

  // Step 3: Try to write a test point
  if (req.query.action === "write" || req.query.action === "full") {
    try {
      const testMetric: CloudinaryMetricPoint = {
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
      };
    } catch (error) {
      results.queryTest = {
        step: "queryMetrics",
        success: false,
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

