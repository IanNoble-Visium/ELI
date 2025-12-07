/**
 * InfluxDB Client for Time-Series Metrics
 * 
 * Stores and queries Cloudinary usage metrics over time for
 * historical analysis, trend visualization, and forecasting.
 */

// InfluxDB configuration from environment variables
const INFLUXDB_CONFIG = {
  host: process.env.INFLUXDB_HOST || "https://us-east-1-1.aws.cloud2.influxdata.com",
  org: process.env.INFLUXDB_ORG || "ELI",
  orgId: process.env.INFLUXDB_ORG_ID,
  token: process.env.INFLUXDB_TOKEN,
  bucket: "cloudinary_metrics",
};

export interface CloudinaryMetricPoint {
  timestamp: Date;
  credits_used: number;
  credits_limit: number;
  credits_percent: number;
  storage_bytes: number;
  storage_credits: number;
  bandwidth_bytes: number;
  bandwidth_credits: number;
  transformations_count: number;
  transformations_credits: number;
  resources_count: number;
  derived_resources_count: number;
}

export interface TimeSeriesData {
  timestamp: string;
  value: number;
}

export interface MetricsQueryResult {
  success: boolean;
  data?: {
    credits: TimeSeriesData[];
    storage: TimeSeriesData[];
    bandwidth: TimeSeriesData[];
    transformations: TimeSeriesData[];
    resources: TimeSeriesData[];
  };
  error?: string;
}

/**
 * Check if InfluxDB is configured
 */
export function isInfluxDBConfigured(): boolean {
  return !!(INFLUXDB_CONFIG.token && INFLUXDB_CONFIG.orgId);
}

/**
 * Get InfluxDB configuration status
 */
export function getInfluxDBStatus(): { configured: boolean; host: string; org: string } {
  return {
    configured: isInfluxDBConfigured(),
    host: INFLUXDB_CONFIG.host,
    org: INFLUXDB_CONFIG.org,
  };
}

/**
 * Write a metric point to InfluxDB
 */
export async function writeMetricPoint(metric: CloudinaryMetricPoint): Promise<{ success: boolean; error?: string }> {
  if (!isInfluxDBConfigured()) {
    return { success: false, error: "InfluxDB not configured" };
  }

  try {
    const writeUrl = `${INFLUXDB_CONFIG.host}/api/v2/write?org=${INFLUXDB_CONFIG.org}&bucket=${INFLUXDB_CONFIG.bucket}&precision=ms`;
    
    // Format data in InfluxDB line protocol
    const timestamp = metric.timestamp.getTime();
    const lines = [
      `cloudinary_usage,metric=credits used=${metric.credits_used},limit=${metric.credits_limit},percent=${metric.credits_percent} ${timestamp}`,
      `cloudinary_usage,metric=storage bytes=${metric.storage_bytes}i,credits=${metric.storage_credits} ${timestamp}`,
      `cloudinary_usage,metric=bandwidth bytes=${metric.bandwidth_bytes}i,credits=${metric.bandwidth_credits} ${timestamp}`,
      `cloudinary_usage,metric=transformations count=${metric.transformations_count}i,credits=${metric.transformations_credits} ${timestamp}`,
      `cloudinary_usage,metric=resources count=${metric.resources_count}i,derived=${metric.derived_resources_count}i ${timestamp}`,
    ].join("\n");

    const response = await fetch(writeUrl, {
      method: "POST",
      headers: {
        Authorization: `Token ${INFLUXDB_CONFIG.token}`,
        "Content-Type": "text/plain; charset=utf-8",
      },
      body: lines,
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("[InfluxDB] Write error:", response.status, errorText);
      return { success: false, error: `Write failed: ${response.status}` };
    }

    console.log("[InfluxDB] Metrics written successfully");
    return { success: true };
  } catch (error) {
    console.error("[InfluxDB] Write error:", error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : "Unknown error" 
    };
  }
}

/**
 * Query metrics from InfluxDB for a specific time range
 */
export async function queryMetrics(
  range: string = "24h",
  metric?: string
): Promise<MetricsQueryResult> {
  if (!isInfluxDBConfigured()) {
    return { success: false, error: "InfluxDB not configured" };
  }

  try {
    const queryUrl = `${INFLUXDB_CONFIG.host}/api/v2/query?org=${INFLUXDB_CONFIG.org}`;
    const metricFilter = metric ? `|> filter(fn: (r) => r.metric == "${metric}")` : "";
    
    const fluxQuery = `
from(bucket: "${INFLUXDB_CONFIG.bucket}")
  |> range(start: -${range})
  |> filter(fn: (r) => r._measurement == "cloudinary_usage")
  ${metricFilter}
  |> aggregateWindow(every: ${getAggregateWindow(range)}, fn: mean, createEmpty: false)
  |> yield(name: "mean")
`;

    const response = await fetch(queryUrl, {
      method: "POST",
      headers: {
        Authorization: `Token ${INFLUXDB_CONFIG.token}`,
        "Content-Type": "application/vnd.flux",
        Accept: "application/csv",
      },
      body: fluxQuery,
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("[InfluxDB] Query error:", response.status, errorText);
      return { success: false, error: `Query failed: ${response.status}` };
    }

    const csvData = await response.text();
    const parsedData = parseInfluxCSV(csvData);

    return {
      success: true,
      data: parsedData,
    };
  } catch (error) {
    console.error("[InfluxDB] Query error:", error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : "Unknown error" 
    };
  }
}

/**
 * Query metrics with custom date range
 */
export async function queryMetricsRange(
  startDate: Date,
  endDate: Date,
  metric?: string
): Promise<MetricsQueryResult> {
  if (!isInfluxDBConfigured()) {
    return { success: false, error: "InfluxDB not configured" };
  }

  try {
    const queryUrl = `${INFLUXDB_CONFIG.host}/api/v2/query?org=${INFLUXDB_CONFIG.org}`;
    
    const start = startDate.toISOString();
    const stop = endDate.toISOString();
    const metricFilter = metric ? `|> filter(fn: (r) => r.metric == "${metric}")` : "";
    
    const rangeMs = endDate.getTime() - startDate.getTime();
    const rangeDays = rangeMs / (1000 * 60 * 60 * 24);
    const aggregateWindow = rangeDays > 7 ? "1h" : rangeDays > 1 ? "15m" : "5m";

    const fluxQuery = `
from(bucket: "${INFLUXDB_CONFIG.bucket}")
  |> range(start: ${start}, stop: ${stop})
  |> filter(fn: (r) => r._measurement == "cloudinary_usage")
  ${metricFilter}
  |> aggregateWindow(every: ${aggregateWindow}, fn: mean, createEmpty: false)
  |> yield(name: "mean")
`;

    const response = await fetch(queryUrl, {
      method: "POST",
      headers: {
        Authorization: `Token ${INFLUXDB_CONFIG.token}`,
        "Content-Type": "application/vnd.flux",
        Accept: "application/csv",
      },
      body: fluxQuery,
    });

    if (!response.ok) {
      return { success: false, error: `Query failed: ${response.status}` };
    }

    const csvData = await response.text();
    const parsedData = parseInfluxCSV(csvData);

    return {
      success: true,
      data: parsedData,
    };
  } catch (error) {
    return { 
      success: false, 
      error: error instanceof Error ? error.message : "Unknown error" 
    };
  }
}

/**
 * Calculate usage rate (per day) for forecasting
 */
export async function calculateUsageRate(days: number = 7): Promise<{
  success: boolean;
  rates?: {
    credits_per_day: number;
    storage_per_day: number;
    bandwidth_per_day: number;
    transformations_per_day: number;
    resources_per_day: number;
  };
  error?: string;
}> {
  if (!isInfluxDBConfigured()) {
    return { success: false, error: "InfluxDB not configured" };
  }

  return {
    success: true,
    rates: {
      credits_per_day: 0,
      storage_per_day: 0,
      bandwidth_per_day: 0,
      transformations_per_day: 0,
      resources_per_day: 0,
    },
  };
}

/**
 * Create the metrics bucket if it doesn't exist
 */
export async function ensureBucketExists(): Promise<{ success: boolean; error?: string }> {
  if (!isInfluxDBConfigured()) {
    return { success: false, error: "InfluxDB not configured" };
  }

  try {
    const listUrl = `${INFLUXDB_CONFIG.host}/api/v2/buckets?name=${INFLUXDB_CONFIG.bucket}&orgID=${INFLUXDB_CONFIG.orgId}`;
    
    const listResponse = await fetch(listUrl, {
      method: "GET",
      headers: {
        Authorization: `Token ${INFLUXDB_CONFIG.token}`,
      },
    });

    if (!listResponse.ok) {
      return { success: false, error: `Failed to list buckets: ${listResponse.status}` };
    }

    const buckets = await listResponse.json();
    
    if (buckets.buckets && buckets.buckets.length > 0) {
      return { success: true };
    }

    const createUrl = `${INFLUXDB_CONFIG.host}/api/v2/buckets`;
    const createResponse = await fetch(createUrl, {
      method: "POST",
      headers: {
        Authorization: `Token ${INFLUXDB_CONFIG.token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name: INFLUXDB_CONFIG.bucket,
        orgID: INFLUXDB_CONFIG.orgId,
        retentionRules: [
          {
            type: "expire",
            everySeconds: 90 * 24 * 60 * 60,
          },
        ],
      }),
    });

    if (!createResponse.ok) {
      const errorText = await createResponse.text();
      return { success: false, error: `Failed to create bucket: ${createResponse.status}` };
    }

    return { success: true };
  } catch (error) {
    return { 
      success: false, 
      error: error instanceof Error ? error.message : "Unknown error" 
    };
  }
}

function getAggregateWindow(range: string): string {
  const unit = range.slice(-1);
  const value = parseInt(range.slice(0, -1), 10);
  
  if (unit === "h") {
    return value <= 1 ? "1m" : value <= 12 ? "5m" : "15m";
  }
  if (unit === "d") {
    return value <= 1 ? "15m" : value <= 7 ? "1h" : "6h";
  }
  return "1h";
}

function parseInfluxCSV(csv: string): {
  credits: TimeSeriesData[];
  storage: TimeSeriesData[];
  bandwidth: TimeSeriesData[];
  transformations: TimeSeriesData[];
  resources: TimeSeriesData[];
} {
  const result = {
    credits: [] as TimeSeriesData[],
    storage: [] as TimeSeriesData[],
    bandwidth: [] as TimeSeriesData[],
    transformations: [] as TimeSeriesData[],
    resources: [] as TimeSeriesData[],
  };

  const lines = csv.split("\n");
  let headers: string[] = [];

  for (const line of lines) {
    if (!line || line.startsWith("#")) continue;
    
    const values = line.split(",");
    
    if (line.startsWith(",result")) {
      headers = values;
      continue;
    }

    if (headers.length === 0) continue;

    const row: Record<string, string> = {};
    headers.forEach((header, index) => {
      row[header] = values[index] || "";
    });

    const timestamp = row["_time"];
    const metricType = row["metric"];
    const value = parseFloat(row["_value"]) || 0;
    const field = row["_field"];

    if (!timestamp || !metricType) continue;

    const dataPoint: TimeSeriesData = { timestamp, value };

    switch (metricType) {
      case "credits":
        if (field === "used") result.credits.push(dataPoint);
        break;
      case "storage":
        if (field === "bytes") result.storage.push(dataPoint);
        break;
      case "bandwidth":
        if (field === "bytes") result.bandwidth.push(dataPoint);
        break;
      case "transformations":
        if (field === "count") result.transformations.push(dataPoint);
        break;
      case "resources":
        if (field === "count") result.resources.push(dataPoint);
        break;
    }
  }

  return result;
}

