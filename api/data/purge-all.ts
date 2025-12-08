/**
 * Purge All Data API Endpoint
 * 
 * Deletes ALL data from the application for testing/reset purposes:
 * - All events and snapshots from PostgreSQL
 * - All graph data from Neo4j
 * - All images from Cloudinary (batch delete)
 * - All webhook request logs
 * 
 * WARNING: This is a destructive operation that cannot be undone!
 */
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { neon } from "@neondatabase/serverless";
import { getDriver, isNeo4jConfigured } from "../lib/neo4j.js";

interface PurgeResult {
  success: boolean;
  phase?: string;
  database?: {
    eventsDeleted: number;
    snapshotsDeleted: number;
    webhookRequestsDeleted: number;
    aiJobsDeleted: number;
  };
  neo4j?: {
    nodesDeleted: number;
    relationshipsDeleted: number;
    success: boolean;
    error?: string;
  };
  cloudinary?: {
    totalDeleted: number;
    batchesRun: number;
    timeElapsed: number;
    completed: boolean;
    errors?: string[];
  };
  localStorage?: {
    cleared: boolean;
  };
  error?: string;
  duration_ms?: number;
}

/**
 * Purge images from Cloudinary by listing and deleting in batches
 * Uses the reliable list-then-delete approach for consistent results
 */
async function purgeCloudinaryImages(
  cloudName: string,
  apiKey: string,
  apiSecret: string,
  folder: string,
  maxTimeSeconds: number = 240
): Promise<{
  totalDeleted: number;
  batchesRun: number;
  timeElapsed: number;
  completed: boolean;
  errors: string[];
}> {
  const startTime = Date.now();
  const maxTimeMs = maxTimeSeconds * 1000;
  const auth = Buffer.from(`${apiKey}:${apiSecret}`).toString("base64");
  const prefix = folder ? (folder.endsWith('/') ? folder : folder + '/') : '';
  
  let totalDeleted = 0;
  let batchesRun = 0;
  let cursor: string | undefined;
  let hasMore = true;
  const errors: string[] = [];

  console.log(`[Purge] Starting Cloudinary delete with prefix: ${prefix}`);

  while (hasMore) {
    // Check if we're approaching time limit (leave 15 second buffer)
    const elapsed = Date.now() - startTime;
    if (elapsed > maxTimeMs - 15000) {
      console.log(`[Purge] Cloudinary stopping: approaching time limit (${elapsed}ms elapsed, ${totalDeleted} deleted so far)`);
      break;
    }

    try {
      // List resources - get 500 at a time for efficiency
      const listUrl = new URL(`https://api.cloudinary.com/v1_1/${cloudName}/resources/image/upload`);
      listUrl.searchParams.set('max_results', '500');
      if (prefix) listUrl.searchParams.set('prefix', prefix);
      if (cursor) listUrl.searchParams.set('next_cursor', cursor);

      const listResponse = await fetch(listUrl.toString(), {
        method: 'GET',
        headers: { Authorization: `Basic ${auth}` },
      });

      if (!listResponse.ok) {
        const errorText = await listResponse.text();
        console.error(`[Purge] Cloudinary list failed: ${listResponse.status} - ${errorText}`);
        errors.push(`List failed: ${listResponse.status}`);
        break;
      }

      const listData = await listResponse.json();
      const resources = listData.resources || [];
      cursor = listData.next_cursor;
      
      console.log(`[Purge] Listed ${resources.length} resources, cursor: ${cursor ? 'yes' : 'no'}`);

      if (resources.length === 0) {
        hasMore = false;
        console.log(`[Purge] No more resources to delete`);
        break;
      }

      const publicIds = resources.map((r: any) => r.public_id);
      
      // Delete in batches of 100 (Cloudinary API limit)
      for (let i = 0; i < publicIds.length; i += 100) {
        // Check time limit before each batch
        if (Date.now() - startTime > maxTimeMs - 10000) {
          console.log(`[Purge] Time limit approaching during deletion, stopping`);
          hasMore = !!cursor || (i + 100 < publicIds.length);
          break;
        }

        const batch = publicIds.slice(i, i + 100);
        
        const deleteResponse = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/resources/image/upload`, {
          method: 'DELETE',
          headers: {
            Authorization: `Basic ${auth}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ public_ids: batch }),
        });

        if (deleteResponse.ok) {
          const deleteData = await deleteResponse.json();
          const deleted = deleteData.deleted
            ? Object.values(deleteData.deleted).filter((v: any) => v === 'deleted').length
            : batch.length; // Assume all deleted if no detailed response
          totalDeleted += deleted;
        } else {
          const errorText = await deleteResponse.text();
          console.error(`[Purge] Delete batch failed: ${deleteResponse.status} - ${errorText}`);
          errors.push(`Delete failed: ${deleteResponse.status}`);
        }

        // Small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      batchesRun++;
      hasMore = !!cursor;
      
      console.log(`[Purge] Batch ${batchesRun}: processed ${resources.length}, total deleted ${totalDeleted}, hasMore: ${hasMore}`);

    } catch (err) {
      console.error(`[Purge] Cloudinary error:`, err);
      errors.push(err instanceof Error ? err.message : 'Unknown error');
      break;
    }
  }

  const timeElapsed = Math.round((Date.now() - startTime) / 1000);
  console.log(`[Purge] Cloudinary complete: ${totalDeleted} deleted in ${timeElapsed}s, ${batchesRun} batches, completed: ${!hasMore}`);
  
  return {
    totalDeleted,
    batchesRun,
    timeElapsed,
    completed: !hasMore,
    errors,
  };
}

/**
 * Purge all data from Neo4j graph database
 * Deletes all nodes and relationships with timeout handling
 */
async function purgeNeo4jData(): Promise<{
  nodesDeleted: number;
  relationshipsDeleted: number;
  success: boolean;
  error?: string;
}> {
  console.log("[Purge] Starting Neo4j purge...");

  if (!isNeo4jConfigured()) {
    console.log("[Purge] Neo4j not configured, skipping");
    return {
      nodesDeleted: 0,
      relationshipsDeleted: 0,
      success: false,
      error: "Neo4j not configured",
    };
  }

  const driver = getDriver();
  if (!driver) {
    console.log("[Purge] Failed to get Neo4j driver");
    return {
      nodesDeleted: 0,
      relationshipsDeleted: 0,
      success: false,
      error: "Failed to get Neo4j driver",
    };
  }

  let session = null;

  try {
    // Create session with timeout
    session = driver.session({
      defaultAccessMode: "WRITE",
    });

    console.log("[Purge] Neo4j session created, counting nodes...");

    // First, count existing nodes and relationships for reporting
    const countResult = await session.run(`
      MATCH (n)
      OPTIONAL MATCH (n)-[r]-()
      RETURN count(DISTINCT n) as nodeCount, count(DISTINCT r) as relCount
    `);

    const nodeCount = countResult.records[0]?.get("nodeCount")?.toNumber() || 0;
    const relCount = countResult.records[0]?.get("relCount")?.toNumber() || 0;

    console.log(`[Purge] Neo4j found: ${nodeCount} nodes, ${relCount} relationships`);

    if (nodeCount === 0) {
      console.log("[Purge] Neo4j already empty");
      return {
        nodesDeleted: 0,
        relationshipsDeleted: 0,
        success: true,
      };
    }

    // Delete all data in batches to avoid memory issues
    // Using CALL { ... } IN TRANSACTIONS for better memory management
    let totalNodesDeleted = 0;
    let hasMore = true;
    const batchSize = 1000; // Smaller batches for more reliable deletion

    while (hasMore) {
      try {
        const deleteResult = await session.run(`
          MATCH (n)
          WITH n LIMIT ${batchSize}
          DETACH DELETE n
          RETURN count(*) as deleted
        `);

        const deleted = deleteResult.records[0]?.get("deleted")?.toNumber() || 0;
        totalNodesDeleted += deleted;

        console.log(`[Purge] Neo4j batch deleted: ${deleted} nodes (total: ${totalNodesDeleted})`);

        if (deleted < batchSize) {
          hasMore = false;
        }
      } catch (batchErr) {
        console.error("[Purge] Neo4j batch error:", batchErr);
        hasMore = false; // Stop on error
      }
    }

    console.log(`[Purge] Neo4j complete: deleted ${totalNodesDeleted} nodes (expected: ${nodeCount})`);

    return {
      nodesDeleted: totalNodesDeleted,
      relationshipsDeleted: relCount,
      success: true,
    };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : "Unknown error";
    console.error("[Purge] Neo4j error:", errorMsg);
    return {
      nodesDeleted: 0,
      relationshipsDeleted: 0,
      success: false,
      error: errorMsg,
    };
  } finally {
    if (session) {
      try {
        await session.close();
        console.log("[Purge] Neo4j session closed");
      } catch (closeErr) {
        console.error("[Purge] Error closing Neo4j session:", closeErr);
      }
    }
  }
}

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
): Promise<void> {
  // Set CORS headers
  res.setHeader("Access-Control-Allow-Origin", req.headers.origin || "*");
  res.setHeader("Access-Control-Allow-Credentials", "true");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    res.status(200).end();
    return;
  }

  if (req.method !== "POST") {
    res.status(405).json({ success: false, error: "Method not allowed" });
    return;
  }

  const startTime = Date.now();
  const result: PurgeResult = { success: false };

  try {
    const { confirmPhrase, includeCloudinary = true, includeNeo4j = true } = req.body || {};

    // Require confirmation phrase for safety
    if (confirmPhrase !== "DELETE ALL DATA") {
      res.status(400).json({
        success: false,
        error: "Confirmation phrase required. Send { confirmPhrase: 'DELETE ALL DATA' }",
      });
      return;
    }

    // Phase 1: Purge Database
    result.phase = "database";
    console.log("[Purge] ========== STARTING DATABASE PURGE ==========");

    const dbUrl = process.env.DATABASE_URL;
    if (!dbUrl) {
      result.database = {
        eventsDeleted: 0,
        snapshotsDeleted: 0,
        webhookRequestsDeleted: 0,
        aiJobsDeleted: 0,
      };
      console.log("[Purge] DATABASE_URL not configured, skipping PostgreSQL");
    } else {
      console.log("[Purge] DATABASE_URL is set, connecting to Neon...");

      // Use raw SQL to avoid schema import issues in Vercel serverless
      const sql = neon(dbUrl);

      // Test connection first
      try {
        const testResult = await sql`SELECT 1 as connected`;
        console.log("[Purge] Database connection verified:", testResult);
      } catch (connErr) {
        console.error("[Purge] CRITICAL: Database connection failed:", connErr);
        result.database = {
          eventsDeleted: 0,
          snapshotsDeleted: 0,
          webhookRequestsDeleted: 0,
          aiJobsDeleted: 0,
        };
        throw new Error(`Database connection failed: ${connErr}`);
      }

      // Get counts before deletion for reporting
      let eventsBefore = 0, snapshotsBefore = 0, webhooksBefore = 0, channelsBefore = 0;
      try {
        const counts = await sql`
          SELECT
            (SELECT COUNT(*) FROM events) as events,
            (SELECT COUNT(*) FROM snapshots) as snapshots,
            (SELECT COUNT(*) FROM webhook_requests) as webhooks,
            (SELECT COUNT(*) FROM channels) as channels
        `;
        eventsBefore = Number(counts[0]?.events || 0);
        snapshotsBefore = Number(counts[0]?.snapshots || 0);
        webhooksBefore = Number(counts[0]?.webhooks || 0);
        channelsBefore = Number(counts[0]?.channels || 0);
        console.log(`[Purge] BEFORE: events=${eventsBefore}, snapshots=${snapshotsBefore}, webhooks=${webhooksBefore}, channels=${channelsBefore}`);
      } catch (countErr) {
        console.error("[Purge] Error getting counts before deletion:", countErr);
      }

      // Delete data from all tables in proper order (respecting foreign keys)
      // Using explicit DELETE statements for each table since Neon driver
      // parameterizes values, not identifiers (table names)
      console.log("[Purge] Deleting data from all PostgreSQL tables...");

      const deleteErrors: string[] = [];

      // AI tables (reference events) - delete first
      try { console.log("[Purge] Deleting ai_detections..."); await sql`DELETE FROM ai_detections`; console.log("[Purge] ✓ ai_detections"); }
      catch (e: any) { console.error("[Purge] ✗ ai_detections:", e.message); deleteErrors.push("ai_detections"); }

      try { console.log("[Purge] Deleting ai_anomalies..."); await sql`DELETE FROM ai_anomalies`; console.log("[Purge] ✓ ai_anomalies"); }
      catch (e: any) { console.error("[Purge] ✗ ai_anomalies:", e.message); deleteErrors.push("ai_anomalies"); }

      try { console.log("[Purge] Deleting ai_insights..."); await sql`DELETE FROM ai_insights`; console.log("[Purge] ✓ ai_insights"); }
      catch (e: any) { console.error("[Purge] ✗ ai_insights:", e.message); deleteErrors.push("ai_insights"); }

      try { console.log("[Purge] Deleting ai_baselines..."); await sql`DELETE FROM ai_baselines`; console.log("[Purge] ✓ ai_baselines"); }
      catch (e: any) { console.error("[Purge] ✗ ai_baselines:", e.message); deleteErrors.push("ai_baselines"); }

      try { console.log("[Purge] Deleting ai_inference_jobs..."); await sql`DELETE FROM ai_inference_jobs`; console.log("[Purge] ✓ ai_inference_jobs"); }
      catch (e: any) { console.error("[Purge] ✗ ai_inference_jobs:", e.message); deleteErrors.push("ai_inference_jobs"); }

      // Incident tables
      try { console.log("[Purge] Deleting incident_notes..."); await sql`DELETE FROM incident_notes`; console.log("[Purge] ✓ incident_notes"); }
      catch (e: any) { console.error("[Purge] ✗ incident_notes:", e.message); deleteErrors.push("incident_notes"); }

      try { console.log("[Purge] Deleting incident_tags..."); await sql`DELETE FROM incident_tags`; console.log("[Purge] ✓ incident_tags"); }
      catch (e: any) { console.error("[Purge] ✗ incident_tags:", e.message); deleteErrors.push("incident_tags"); }

      try { console.log("[Purge] Deleting incidents..."); await sql`DELETE FROM incidents`; console.log("[Purge] ✓ incidents"); }
      catch (e: any) { console.error("[Purge] ✗ incidents:", e.message); deleteErrors.push("incidents"); }

      // POLE entities
      try { console.log("[Purge] Deleting pole_entities..."); await sql`DELETE FROM pole_entities`; console.log("[Purge] ✓ pole_entities"); }
      catch (e: any) { console.error("[Purge] ✗ pole_entities:", e.message); deleteErrors.push("pole_entities"); }

      // Snapshots (references events)
      try { console.log("[Purge] Deleting snapshots..."); await sql`DELETE FROM snapshots`; console.log("[Purge] ✓ snapshots"); }
      catch (e: any) { console.error("[Purge] ✗ snapshots:", e.message); deleteErrors.push("snapshots"); }

      // Events (references channels)
      try { console.log("[Purge] Deleting events..."); await sql`DELETE FROM events`; console.log("[Purge] ✓ events"); }
      catch (e: any) { console.error("[Purge] ✗ events:", e.message); deleteErrors.push("events"); }

      // Channels
      try { console.log("[Purge] Deleting channels..."); await sql`DELETE FROM channels`; console.log("[Purge] ✓ channels"); }
      catch (e: any) { console.error("[Purge] ✗ channels:", e.message); deleteErrors.push("channels"); }

      // Webhook logs
      try { console.log("[Purge] Deleting webhook_requests..."); await sql`DELETE FROM webhook_requests`; console.log("[Purge] ✓ webhook_requests"); }
      catch (e: any) { console.error("[Purge] ✗ webhook_requests:", e.message); deleteErrors.push("webhook_requests"); }

      // Get counts after deletion for verification
      let eventsAfter = 0, snapshotsAfter = 0, webhooksAfter = 0, channelsAfter = 0;
      try {
        const counts = await sql`
          SELECT
            (SELECT COUNT(*) FROM events) as events,
            (SELECT COUNT(*) FROM snapshots) as snapshots,
            (SELECT COUNT(*) FROM webhook_requests) as webhooks,
            (SELECT COUNT(*) FROM channels) as channels
        `;
        eventsAfter = Number(counts[0]?.events || 0);
        snapshotsAfter = Number(counts[0]?.snapshots || 0);
        webhooksAfter = Number(counts[0]?.webhooks || 0);
        channelsAfter = Number(counts[0]?.channels || 0);
        console.log(`[Purge] AFTER: events=${eventsAfter}, snapshots=${snapshotsAfter}, webhooks=${webhooksAfter}, channels=${channelsAfter}`);
      } catch (countErr) {
        console.error("[Purge] Error getting counts after deletion:", countErr);
      }

      result.database = {
        eventsDeleted: eventsBefore - eventsAfter,
        snapshotsDeleted: snapshotsBefore - snapshotsAfter,
        webhookRequestsDeleted: webhooksBefore - webhooksAfter,
        aiJobsDeleted: 0,
      };

      if (deleteErrors.length > 0) {
        console.error(`[Purge] PostgreSQL completed with ${deleteErrors.length} errors: ${deleteErrors.join(", ")}`);
      }

      if (eventsAfter === 0 && snapshotsAfter === 0 && webhooksAfter === 0) {
        console.log(`[Purge] ✓ PostgreSQL PURGE SUCCESSFUL - all tables cleared`);
      } else {
        console.error(`[Purge] ✗ PostgreSQL PURGE INCOMPLETE - data still remains!`);
      }

      console.log(`[Purge] PostgreSQL summary: deleted ${result.database.eventsDeleted} events, ${result.database.snapshotsDeleted} snapshots, ${result.database.webhookRequestsDeleted} webhooks`);
    }

    // Phase 2: Purge Neo4j
    result.phase = "neo4j";
    
    if (includeNeo4j) {
      result.neo4j = await purgeNeo4jData();
      if (result.neo4j.success) {
        console.log(`[Purge] Neo4j: deleted ${result.neo4j.nodesDeleted} nodes, ${result.neo4j.relationshipsDeleted} relationships`);
      } else {
        console.log(`[Purge] Neo4j: ${result.neo4j.error}`);
      }
    } else {
      result.neo4j = {
        nodesDeleted: 0,
        relationshipsDeleted: 0,
        success: true,
        error: "Skipped by request",
      };
    }

    // Phase 3: Purge Cloudinary
    result.phase = "cloudinary";
    
    const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
    const apiKey = process.env.CLOUDINARY_API_KEY;
    const apiSecret = process.env.CLOUDINARY_API_SECRET;
    const folder = process.env.CLOUDINARY_FOLDER || "eli-events";

    console.log(`[Purge] Cloudinary config: cloudName=${cloudName ? 'set' : 'missing'}, apiKey=${apiKey ? 'set' : 'missing'}, apiSecret=${apiSecret ? 'set' : 'missing'}, folder=${folder}, includeCloudinary=${includeCloudinary}`);

    if (includeCloudinary && cloudName && apiKey && apiSecret) {
      console.log(`[Purge] Starting Cloudinary purge for folder: ${folder}`);
      result.cloudinary = await purgeCloudinaryImages(
        cloudName,
        apiKey,
        apiSecret,
        folder,
        250 // ~4 minutes max for Cloudinary (Vercel Pro allows 300s)
      );
      console.log(`[Purge] Cloudinary: deleted ${result.cloudinary.totalDeleted} images`);
    } else {
      result.cloudinary = {
        totalDeleted: 0,
        batchesRun: 0,
        timeElapsed: 0,
        completed: true,
        errors: includeCloudinary ? ["Cloudinary not configured"] : ["Skipped by request"],
      };
    }

    result.success = true;
    result.phase = "complete";
    result.duration_ms = Date.now() - startTime;

    console.log(`[Purge] Complete in ${result.duration_ms}ms`);
    res.status(200).json(result);

  } catch (error) {
    console.error("[Purge] Error:", error);
    result.error = error instanceof Error ? error.message : "Unknown error";
    result.duration_ms = Date.now() - startTime;
    res.status(500).json(result);
  }
}
