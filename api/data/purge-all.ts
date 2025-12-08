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

    if (!process.env.DATABASE_URL) {
      result.database = {
        eventsDeleted: 0,
        snapshotsDeleted: 0,
        webhookRequestsDeleted: 0,
        aiJobsDeleted: 0,
      };
      console.log("[Purge] Database not configured, skipping");
    } else {
      // Use raw SQL to avoid schema import issues in Vercel serverless
      const sqlClient = neon(process.env.DATABASE_URL);

      // Get counts before deletion for reporting
      let eventsBefore = 0, snapshotsBefore = 0, webhooksBefore = 0;
      try {
        const eventCount = await sqlClient`SELECT COUNT(*) as count FROM events`;
        const snapshotCount = await sqlClient`SELECT COUNT(*) as count FROM snapshots`;
        const webhookCount = await sqlClient`SELECT COUNT(*) as count FROM webhook_requests`;
        eventsBefore = Number(eventCount[0]?.count || 0);
        snapshotsBefore = Number(snapshotCount[0]?.count || 0);
        webhooksBefore = Number(webhookCount[0]?.count || 0);
        console.log(`[Purge] PostgreSQL before: events=${eventsBefore}, snapshots=${snapshotsBefore}, webhooks=${webhooksBefore}`);
      } catch (countErr) {
        console.log("[Purge] Could not get counts before deletion:", countErr);
      }

      // Delete in order to respect foreign key constraints
      // Using raw SQL for maximum compatibility
      const deleteErrors: string[] = [];

      // Delete tables in proper order for foreign key constraints
      // NOTE: Neon uses tagged template literals, must use direct SQL for each table

      // AI tables first (reference events)
      try {
        await sqlClient`DELETE FROM ai_detections`;
        console.log("[Purge] Deleted from ai_detections");
      } catch (err) { console.error("[Purge] ai_detections:", err); deleteErrors.push("ai_detections"); }

      try {
        await sqlClient`DELETE FROM ai_anomalies`;
        console.log("[Purge] Deleted from ai_anomalies");
      } catch (err) { console.error("[Purge] ai_anomalies:", err); deleteErrors.push("ai_anomalies"); }

      try {
        await sqlClient`DELETE FROM ai_insights`;
        console.log("[Purge] Deleted from ai_insights");
      } catch (err) { console.error("[Purge] ai_insights:", err); deleteErrors.push("ai_insights"); }

      try {
        await sqlClient`DELETE FROM ai_baselines`;
        console.log("[Purge] Deleted from ai_baselines");
      } catch (err) { console.error("[Purge] ai_baselines:", err); deleteErrors.push("ai_baselines"); }

      try {
        await sqlClient`DELETE FROM ai_inference_jobs`;
        console.log("[Purge] Deleted from ai_inference_jobs");
      } catch (err) { console.error("[Purge] ai_inference_jobs:", err); deleteErrors.push("ai_inference_jobs"); }

      // Incident-related tables
      try {
        await sqlClient`DELETE FROM incident_notes`;
        console.log("[Purge] Deleted from incident_notes");
      } catch (err) { console.error("[Purge] incident_notes:", err); deleteErrors.push("incident_notes"); }

      try {
        await sqlClient`DELETE FROM incident_tags`;
        console.log("[Purge] Deleted from incident_tags");
      } catch (err) { console.error("[Purge] incident_tags:", err); deleteErrors.push("incident_tags"); }

      try {
        await sqlClient`DELETE FROM incidents`;
        console.log("[Purge] Deleted from incidents");
      } catch (err) { console.error("[Purge] incidents:", err); deleteErrors.push("incidents"); }

      // POLE entities
      try {
        await sqlClient`DELETE FROM pole_entities`;
        console.log("[Purge] Deleted from pole_entities");
      } catch (err) { console.error("[Purge] pole_entities:", err); deleteErrors.push("pole_entities"); }

      // Snapshots reference events, so delete first
      try {
        await sqlClient`DELETE FROM snapshots`;
        console.log("[Purge] Deleted from snapshots");
      } catch (err) { console.error("[Purge] snapshots:", err); deleteErrors.push("snapshots"); }

      // Events reference channels
      try {
        await sqlClient`DELETE FROM events`;
        console.log("[Purge] Deleted from events");
      } catch (err) { console.error("[Purge] events:", err); deleteErrors.push("events"); }

      // Channels can be deleted after events
      try {
        await sqlClient`DELETE FROM channels`;
        console.log("[Purge] Deleted from channels");
      } catch (err) { console.error("[Purge] channels:", err); deleteErrors.push("channels"); }

      // Webhook logs
      try {
        await sqlClient`DELETE FROM webhook_requests`;
        console.log("[Purge] Deleted from webhook_requests");
      } catch (err) { console.error("[Purge] webhook_requests:", err); deleteErrors.push("webhook_requests"); }

      // Get counts after deletion for verification
      let eventsAfter = 0, snapshotsAfter = 0, webhooksAfter = 0;
      try {
        const eventCount = await sqlClient`SELECT COUNT(*) as count FROM events`;
        const snapshotCount = await sqlClient`SELECT COUNT(*) as count FROM snapshots`;
        const webhookCount = await sqlClient`SELECT COUNT(*) as count FROM webhook_requests`;
        eventsAfter = Number(eventCount[0]?.count || 0);
        snapshotsAfter = Number(snapshotCount[0]?.count || 0);
        webhooksAfter = Number(webhookCount[0]?.count || 0);
        console.log(`[Purge] PostgreSQL after: events=${eventsAfter}, snapshots=${snapshotsAfter}, webhooks=${webhooksAfter}`);
      } catch (countErr) {
        console.log("[Purge] Could not get counts after deletion:", countErr);
      }

      result.database = {
        eventsDeleted: eventsBefore - eventsAfter,
        snapshotsDeleted: snapshotsBefore - snapshotsAfter,
        webhookRequestsDeleted: webhooksBefore - webhooksAfter,
        aiJobsDeleted: 0,
      };

      if (deleteErrors.length > 0) {
        console.error(`[Purge] PostgreSQL completed with ${deleteErrors.length} errors`);
      } else {
        console.log(`[Purge] PostgreSQL purge complete: deleted ${result.database.eventsDeleted} events, ${result.database.snapshotsDeleted} snapshots, ${result.database.webhookRequestsDeleted} webhooks`);
      }
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
