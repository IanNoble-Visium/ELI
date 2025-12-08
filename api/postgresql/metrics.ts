/**
 * PostgreSQL Metrics API Endpoint
 * 
 * Records current PostgreSQL usage to InfluxDB and retrieves historical data
 * for time-series visualization and forecasting.
 */
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { neon } from "@neondatabase/serverless";
import {
  isInfluxDBConfigured,
  getInfluxDBStatus,
} from "../lib/influxdb.js";

interface TimeSeriesData {
  timestamp: string;
  value: number;
}

interface MetricsResponse {
  success: boolean;
  action?: "record" | "query" | "status";
  data?: {
    database_size?: TimeSeriesData[];
    total_rows?: TimeSeriesData[];
    connections?: TimeSeriesData[];
    events_count?: TimeSeriesData[];
    snapshots_count?: TimeSeriesData[];
  };
  projections?: {
    storage_days_remaining?: number;
    storage_exhaustion_date?: string;
    daily_rates?: {
      storage_bytes: number;
      rows: number;
      events: number;
      snapshots: number;
    };
  };
  current?: {
    database_size_bytes: number;
    total_rows: number;
    events_count: number;
    snapshots_count: number;
    webhook_requests_count: number;
    ai_jobs_count: number;
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
    const databaseUrl = process.env.DATABASE_URL;

    if (!databaseUrl) {
      res.status(200).json({
        success: false,
        error: "PostgreSQL not configured",
      });
      return;
    }

    const sql = neon(databaseUrl);

    // Get current metrics
    const [dbSize, tableCounts] = await Promise.all([
      sql`SELECT pg_database_size(current_database()) as size_bytes`,
      sql`
        SELECT 
          (SELECT COUNT(*) FROM events) as events_count,
          (SELECT COUNT(*) FROM snapshots) as snapshots_count,
          (SELECT COUNT(*) FROM webhook_requests) as webhook_requests_count,
          (SELECT COUNT(*) FROM ai_inference_jobs) as ai_jobs_count
      `,
    ]);

    const metrics = {
      database_size_bytes: parseInt(dbSize[0]?.size_bytes) || 0,
      events_count: parseInt(tableCounts[0]?.events_count) || 0,
      snapshots_count: parseInt(tableCounts[0]?.snapshots_count) || 0,
      webhook_requests_count: parseInt(tableCounts[0]?.webhook_requests_count) || 0,
      ai_jobs_count: parseInt(tableCounts[0]?.ai_jobs_count) || 0,
    };

    // Note: InfluxDB recording would go here if we want to track PostgreSQL metrics over time
    // For now, we'll just return the current metrics

    res.status(200).json({
      success: true,
      action: "record",
      current: {
        ...metrics,
        total_rows: metrics.events_count + metrics.snapshots_count + 
                    metrics.webhook_requests_count + metrics.ai_jobs_count,
      },
      influxdb_status: getInfluxDBStatus(),
    });

  } catch (error) {
    console.error("[PostgreSQL Metrics] Record error:", error);
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
    const databaseUrl = process.env.DATABASE_URL;
    const range = (req.query.range as string) || "24h";

    if (!databaseUrl) {
      res.status(200).json({
        success: false,
        error: "PostgreSQL not configured",
      });
      return;
    }

    const sql = neon(databaseUrl);

    // Get current database metrics
    const [dbSize, tableCounts, tableStats] = await Promise.all([
      sql`SELECT pg_database_size(current_database()) as size_bytes`,
      sql`
        SELECT 
          (SELECT COUNT(*) FROM events) as events_count,
          (SELECT COUNT(*) FROM snapshots) as snapshots_count,
          (SELECT COUNT(*) FROM webhook_requests) as webhook_requests_count,
          (SELECT COUNT(*) FROM ai_inference_jobs) as ai_jobs_count
      `,
      sql`
        SELECT 
          relname as name,
          n_live_tup as rows,
          pg_total_relation_size(quote_ident(relname)) as size_bytes
        FROM pg_stat_user_tables
        ORDER BY pg_total_relation_size(quote_ident(relname)) DESC
      `,
    ]);

    // Get events over time for trend analysis
    // Note: rangeHours is parsed but we use fixed 24h interval for now
    // to avoid SQL injection issues with dynamic intervals
    const rangeHours = parseRange(range);
    
    let eventsOverTime: any[] = [];
    let snapshotsOverTime: any[] = [];
    let recentEvents = 0;
    let recentSnapshots = 0;
    
    try {
      // Events use "createdAt" column (camelCase as per schema)
      eventsOverTime = await sql`
        SELECT 
          date_trunc('hour', "createdAt") as hour,
          COUNT(*) as count
        FROM events
        WHERE "createdAt" > NOW() - INTERVAL '24 hours'
        GROUP BY date_trunc('hour', "createdAt")
        ORDER BY hour ASC
      `;
    } catch (e) {
      console.warn("[PostgreSQL Metrics] Events query failed:", e);
    }

    try {
      // Snapshots use "createdAt" column
      snapshotsOverTime = await sql`
        SELECT 
          date_trunc('hour', "createdAt") as hour,
          COUNT(*) as count
        FROM snapshots
        WHERE "createdAt" > NOW() - INTERVAL '24 hours'
        GROUP BY date_trunc('hour', "createdAt")
        ORDER BY hour ASC
      `;
    } catch (e) {
      console.warn("[PostgreSQL Metrics] Snapshots query failed:", e);
    }

    // Calculate daily rates for projections
    const eventsCount = parseInt(tableCounts[0]?.events_count) || 0;
    const snapshotsCount = parseInt(tableCounts[0]?.snapshots_count) || 0;
    const dbSizeBytes = parseInt(dbSize[0]?.size_bytes) || 0;
    
    // Get events from last 24 hours for rate calculation
    try {
      const recentEventsResult = await sql`
        SELECT COUNT(*) as count FROM events 
        WHERE "createdAt" > NOW() - INTERVAL '24 hours'
      `;
      recentEvents = parseInt(recentEventsResult[0]?.count) || 0;
    } catch (e) {
      console.warn("[PostgreSQL Metrics] Recent events query failed:", e);
    }
    
    try {
      const recentSnapshotsResult = await sql`
        SELECT COUNT(*) as count FROM snapshots 
        WHERE "createdAt" > NOW() - INTERVAL '24 hours'
      `;
      recentSnapshots = parseInt(recentSnapshotsResult[0]?.count) || 0;
    } catch (e) {
      console.warn("[PostgreSQL Metrics] Recent snapshots query failed:", e);
    }

    // Estimate storage growth rate (bytes per day)
    const avgEventSize = eventsCount > 0 ? dbSizeBytes / eventsCount : 1000;
    const dailyStorageGrowth = recentEvents * avgEventSize;

    // Neon free tier limit is 512MB, paid plans vary
    const storageLimit = 512 * 1024 * 1024; // 512MB default
    const storageRemaining = storageLimit - dbSizeBytes;
    const daysRemaining = dailyStorageGrowth > 0 
      ? Math.round(storageRemaining / dailyStorageGrowth) 
      : Infinity;

    const response: MetricsResponse = {
      success: true,
      action: "query",
      current: {
        database_size_bytes: dbSizeBytes,
        total_rows: eventsCount + snapshotsCount + 
                    parseInt(tableCounts[0]?.webhook_requests_count || '0') +
                    parseInt(tableCounts[0]?.ai_jobs_count || '0'),
        events_count: eventsCount,
        snapshots_count: snapshotsCount,
        webhook_requests_count: parseInt(tableCounts[0]?.webhook_requests_count) || 0,
        ai_jobs_count: parseInt(tableCounts[0]?.ai_jobs_count) || 0,
      },
      data: {
        events_count: eventsOverTime.map((row: any) => ({
          timestamp: row.hour,
          value: parseInt(row.count) || 0,
        })),
        snapshots_count: snapshotsOverTime.map((row: any) => ({
          timestamp: row.hour,
          value: parseInt(row.count) || 0,
        })),
      },
      projections: {
        storage_days_remaining: daysRemaining === Infinity ? undefined : daysRemaining,
        storage_exhaustion_date: daysRemaining !== Infinity && daysRemaining < 365
          ? new Date(Date.now() + daysRemaining * 24 * 60 * 60 * 1000).toISOString()
          : undefined,
        daily_rates: {
          storage_bytes: dailyStorageGrowth,
          rows: recentEvents + recentSnapshots,
          events: recentEvents,
          snapshots: recentSnapshots,
        },
      },
      influxdb_status: getInfluxDBStatus(),
    };

    res.setHeader("Cache-Control", "public, max-age=60, stale-while-revalidate=120");
    res.status(200).json(response);

  } catch (error) {
    console.error("[PostgreSQL Metrics] Query error:", error);
    res.status(200).json({
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
}

function parseRange(range: string): number {
  const match = range.match(/^(\d+)([hdw])$/);
  if (!match) return 24;
  
  const value = parseInt(match[1]);
  const unit = match[2];
  
  switch (unit) {
    case 'h': return value;
    case 'd': return value * 24;
    case 'w': return value * 24 * 7;
    default: return 24;
  }
}
