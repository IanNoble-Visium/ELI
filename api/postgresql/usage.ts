/**
 * PostgreSQL Usage Statistics API Endpoint
 * 
 * Fetches database usage data from Neon PostgreSQL
 * Returns storage, table sizes, row counts, and connection info
 */
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { neon } from "@neondatabase/serverless";

interface TableStats {
  name: string;
  rows: number;
  size_bytes: number;
  size_pretty: string;
}

interface PostgreSQLUsageResponse {
  success: boolean;
  usage?: {
    database_size: {
      bytes: number;
      pretty: string;
    };
    tables: TableStats[];
    total_rows: number;
    connections: {
      active: number;
      max: number;
    };
    version: string;
    uptime_seconds: number;
  };
  plan?: string;
  region?: string;
  last_updated?: string;
  error?: string;
  configured?: boolean;
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

  const databaseUrl = process.env.DATABASE_URL;

  // Check if PostgreSQL is configured
  if (!databaseUrl) {
    const errorResponse: PostgreSQLUsageResponse = {
      success: false,
      error: "PostgreSQL not configured - missing DATABASE_URL",
      configured: false,
    };
    res.status(200).json(errorResponse);
    return;
  }

  try {
    const sql = neon(databaseUrl);

    // Get database size
    const dbSizeResult = await sql`
      SELECT pg_database_size(current_database()) as size_bytes,
             pg_size_pretty(pg_database_size(current_database())) as size_pretty
    `;

    // Get table statistics
    const tableStatsResult = await sql`
      SELECT 
        relname as name,
        n_live_tup as rows,
        pg_total_relation_size(quote_ident(relname)) as size_bytes,
        pg_size_pretty(pg_total_relation_size(quote_ident(relname))) as size_pretty
      FROM pg_stat_user_tables
      ORDER BY pg_total_relation_size(quote_ident(relname)) DESC
    `;

    // Get total row count
    const totalRowsResult = await sql`
      SELECT SUM(n_live_tup)::bigint as total_rows
      FROM pg_stat_user_tables
    `;

    // Get connection info
    const connectionResult = await sql`
      SELECT 
        (SELECT count(*) FROM pg_stat_activity WHERE state = 'active') as active_connections,
        (SELECT setting::int FROM pg_settings WHERE name = 'max_connections') as max_connections
    `;

    // Get PostgreSQL version
    const versionResult = await sql`SELECT version()`;

    // Get server uptime (approximate based on postmaster start time)
    const uptimeResult = await sql`
      SELECT EXTRACT(EPOCH FROM (now() - pg_postmaster_start_time()))::int as uptime_seconds
    `;

    // Parse results
    const dbSize = dbSizeResult[0];
    const tables: TableStats[] = tableStatsResult.map((row: any) => ({
      name: row.name,
      rows: parseInt(row.rows) || 0,
      size_bytes: parseInt(row.size_bytes) || 0,
      size_pretty: row.size_pretty || '0 bytes',
    }));
    const totalRows = parseInt(totalRowsResult[0]?.total_rows) || 0;
    const connections = connectionResult[0];
    const version = versionResult[0]?.version || 'Unknown';
    const uptimeSeconds = parseInt(uptimeResult[0]?.uptime_seconds) || 0;

    // Extract Neon-specific info from connection string
    let region = 'Unknown';
    let plan = 'Neon';
    try {
      const urlMatch = databaseUrl.match(/@([^.]+)\.([^.]+)\./);
      if (urlMatch) {
        region = urlMatch[2] || 'Unknown';
      }
    } catch (e) {
      // Ignore parsing errors
    }

    const response: PostgreSQLUsageResponse = {
      success: true,
      usage: {
        database_size: {
          bytes: parseInt(dbSize?.size_bytes) || 0,
          pretty: dbSize?.size_pretty || '0 bytes',
        },
        tables,
        total_rows: totalRows,
        connections: {
          active: parseInt(connections?.active_connections) || 0,
          max: parseInt(connections?.max_connections) || 100,
        },
        version: version.split(' ')[0] + ' ' + (version.split(' ')[1] || ''),
        uptime_seconds: uptimeSeconds,
      },
      plan,
      region,
      last_updated: new Date().toISOString(),
    };

    // Cache the response for 60 seconds
    res.setHeader("Cache-Control", "public, max-age=60, stale-while-revalidate=120");
    res.status(200).json(response);

  } catch (error) {
    console.error("[PostgreSQL Usage] Error:", error);
    
    res.status(200).json({
      success: false,
      error: error instanceof Error ? error.message : "Unknown error fetching usage data",
      configured: true,
    });
  }
}
