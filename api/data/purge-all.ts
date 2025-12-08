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
 * Deletes all nodes and relationships
 */
async function purgeNeo4jData(): Promise<{
  nodesDeleted: number;
  relationshipsDeleted: number;
  success: boolean;
  error?: string;
}> {
  if (!isNeo4jConfigured()) {
    return {
      nodesDeleted: 0,
      relationshipsDeleted: 0,
      success: false,
      error: "Neo4j not configured",
    };
  }

  const driver = getDriver();
  if (!driver) {
    return {
      nodesDeleted: 0,
      relationshipsDeleted: 0,
      success: false,
      error: "Failed to get Neo4j driver",
    };
  }

  const session = driver.session();
  
  try {
    // First, count existing nodes and relationships for reporting
    const countResult = await session.run(`
      MATCH (n)
      OPTIONAL MATCH (n)-[r]-()
      RETURN count(DISTINCT n) as nodeCount, count(DISTINCT r) as relCount
    `);
    
    const nodeCount = countResult.records[0]?.get("nodeCount")?.toNumber() || 0;
    const relCount = countResult.records[0]?.get("relCount")?.toNumber() || 0;

    // Delete all relationships first, then all nodes
    // Using DETACH DELETE to remove nodes and their relationships in one go
    // Process in batches to avoid memory issues with large graphs
    let totalNodesDeleted = 0;
    let totalRelsDeleted = 0;
    let hasMore = true;
    const batchSize = 10000;

    while (hasMore) {
      const deleteResult = await session.run(`
        MATCH (n)
        WITH n LIMIT ${batchSize}
        DETACH DELETE n
        RETURN count(*) as deleted
      `);
      
      const deleted = deleteResult.records[0]?.get("deleted")?.toNumber() || 0;
      totalNodesDeleted += deleted;
      
      if (deleted < batchSize) {
        hasMore = false;
      }
    }

    console.log(`[Purge] Neo4j: deleted ${nodeCount} nodes and ${relCount} relationships`);
    
    return {
      nodesDeleted: nodeCount,
      relationshipsDeleted: relCount,
      success: true,
    };
  } catch (error) {
    console.error("[Purge] Neo4j error:", error);
    return {
      nodesDeleted: 0,
      relationshipsDeleted: 0,
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  } finally {
    await session.close();
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

      // Delete in order to respect foreign key constraints
      // Using raw SQL for maximum compatibility
      try {
        // 1. Delete AI detections
        await sqlClient`DELETE FROM ai_detections`;
        
        // 2. Delete AI anomalies
        await sqlClient`DELETE FROM ai_anomalies`;
        
        // 3. Delete AI insights
        await sqlClient`DELETE FROM ai_insights`;
        
        // 4. Delete AI baselines
        await sqlClient`DELETE FROM ai_baselines`;
        
        // 5. Delete AI inference jobs
        await sqlClient`DELETE FROM ai_inference_jobs`;
        
        // 6. Delete snapshots (references events)
        await sqlClient`DELETE FROM snapshots`;
        
        // 7. Delete events
        await sqlClient`DELETE FROM events`;
        
        // 8. Delete webhook requests
        await sqlClient`DELETE FROM webhook_requests`;

        result.database = {
          eventsDeleted: 0, // Neon doesn't return affected rows easily
          snapshotsDeleted: 0,
          webhookRequestsDeleted: 0,
          aiJobsDeleted: 0,
        };
        
        console.log("[Purge] Database tables cleared");
      } catch (dbError) {
        console.error("[Purge] Database error:", dbError);
        // Continue with other phases even if some tables fail
        result.database = {
          eventsDeleted: 0,
          snapshotsDeleted: 0,
          webhookRequestsDeleted: 0,
          aiJobsDeleted: 0,
        };
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
