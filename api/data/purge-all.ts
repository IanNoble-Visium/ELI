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
import { drizzle } from "drizzle-orm/neon-http";
import { events, snapshots, webhookRequests, aiInferenceJobs, aiDetections, aiAnomalies, aiInsights, aiBaselines } from "../../drizzle/schema";
import { sql } from "drizzle-orm";
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
 * Purge old images from Cloudinary in batches
 * Based on ELI-DEMO implementation for handling timeouts
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
  let hasMore = true;
  const errors: string[] = [];

  while (hasMore) {
    // Check if we're approaching time limit (leave 20 second buffer)
    const elapsed = Date.now() - startTime;
    if (elapsed > maxTimeMs - 20000) {
      console.log(`[Purge] Cloudinary stopping: approaching time limit (${elapsed}ms elapsed)`);
      break;
    }

    try {
      // Fetch resources in batches of 100
      let cursor: string | undefined;
      const toDelete: string[] = [];
      let fetchBatches = 0;
      const maxFetchBatches = 10; // Fetch up to 1000 images per cycle

      do {
        const listUrl = new URL(`https://api.cloudinary.com/v1_1/${cloudName}/resources/image/upload`);
        listUrl.searchParams.set('max_results', '100');
        if (prefix) listUrl.searchParams.set('prefix', prefix);
        if (cursor) listUrl.searchParams.set('next_cursor', cursor);

        const listResponse = await fetch(listUrl.toString(), {
          method: 'GET',
          headers: {
            Authorization: `Basic ${auth}`,
          },
        });

        if (!listResponse.ok) {
          errors.push(`List failed: ${listResponse.status}`);
          break;
        }

        const listData = await listResponse.json();
        const resources = listData.resources || [];
        
        toDelete.push(...resources.map((r: any) => r.public_id));
        cursor = listData.next_cursor;
        fetchBatches++;

        if (fetchBatches >= maxFetchBatches) break;
      } while (cursor);

      hasMore = !!cursor;

      if (toDelete.length === 0) {
        hasMore = false;
        break;
      }

      // Delete in batches of 100 (Cloudinary API limit)
      for (let i = 0; i < toDelete.length; i += 100) {
        const batch = toDelete.slice(i, i + 100);
        
        const deleteUrl = `https://api.cloudinary.com/v1_1/${cloudName}/resources/image/upload`;
        const deleteResponse = await fetch(deleteUrl, {
          method: 'DELETE',
          headers: {
            Authorization: `Basic ${auth}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            public_ids: batch,
            invalidate: true,
          }),
        });

        if (deleteResponse.ok) {
          const deleteData = await deleteResponse.json();
          const deleted = deleteData.deleted
            ? Object.values(deleteData.deleted).filter((v: any) => v === 'deleted' || v === 'not_found').length
            : 0;
          totalDeleted += deleted;
        } else {
          errors.push(`Delete batch failed: ${deleteResponse.status}`);
        }
      }

      batchesRun++;
      console.log(`[Purge] Cloudinary batch ${batchesRun}: deleted ${toDelete.length}, total ${totalDeleted}, hasMore: ${hasMore}`);

      // Small delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 500));

    } catch (err) {
      errors.push(err instanceof Error ? err.message : 'Unknown error');
      break;
    }
  }

  const timeElapsed = Math.round((Date.now() - startTime) / 1000);
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
      const client = neon(process.env.DATABASE_URL);
      const db = drizzle(client);

      // Delete in order to respect foreign key constraints
      // 1. Delete AI detections (references events)
      await db.delete(aiDetections);
      
      // 2. Delete AI anomalies (references events)
      await db.delete(aiAnomalies);
      
      // 3. Delete AI insights
      await db.delete(aiInsights);
      
      // 4. Delete AI baselines
      await db.delete(aiBaselines);
      
      // 5. Delete AI inference jobs
      await db.delete(aiInferenceJobs);
      
      // 6. Delete snapshots (references events)
      await db.delete(snapshots);
      
      // 7. Delete events
      await db.delete(events);
      
      // 8. Delete webhook requests
      await db.delete(webhookRequests);

      result.database = {
        eventsDeleted: 0, // Neon HTTP doesn't return affected rows
        snapshotsDeleted: 0,
        webhookRequestsDeleted: 0,
        aiJobsDeleted: 0,
      };
      
      console.log("[Purge] Database tables cleared");
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
    const folder = process.env.CLOUDINARY_FOLDER || "irex-events";

    if (includeCloudinary && cloudName && apiKey && apiSecret) {
      result.cloudinary = await purgeCloudinaryImages(
        cloudName,
        apiKey,
        apiSecret,
        folder,
        180 // 3 minutes max for Cloudinary
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
