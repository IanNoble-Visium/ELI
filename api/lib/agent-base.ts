/**
 * Agent Base Utilities
 * 
 * Shared infrastructure for Timeline, Correlation, and Anomaly agents.
 * Provides:
 * - Run ID generation
 * - Configuration management
 * - Logging utilities
 * - Duplicate detection
 * - Similarity calculation (Jaccard index)
 * - Neo4j tagging helpers
 */

import { nanoid } from "nanoid";
import {
    getDb,
    agentRuns,
    agentConfig,
    agentRunLogs,
    eq,
    and,
    desc,
    type AgentRun,
    type InsertAgentRun,
    type AgentConfig,
    type AgentRunLog,
    type InsertAgentRunLog,
} from "./db.js";
import { writeTransaction, runQuery, isNeo4jConfigured } from "./neo4j.js";

// ============================================================================
// Types
// ============================================================================

export type AgentType = "timeline" | "correlation" | "anomaly";
export type RunMode = "cron" | "manual" | "context";
export type RunStatus = "running" | "completed" | "failed" | "discarded";
export type LogLevel = "debug" | "info" | "warn" | "error";

export interface AgentRunContext {
    runId: string;
    agentType: AgentType;
    runMode: RunMode;
    config: AgentConfigData;
    startTime: number;
    anchorNodeId?: string;
    anchorNodeType?: string;
}

export interface AgentConfigData {
    enabled: boolean;
    batchSize: number;
    confidenceThreshold: number;
    minGroupSizeCron: number;
    minGroupSizeContext: number;
    maxExecutionMs: number;
    overlapThreshold: number;
    scanNewEventsOnly: boolean;
    lastProcessedTimestamp: number | null;
    config: Record<string, any> | null;
}

export interface SimilarityResult {
    nodeId: string;
    similarity: number;
    sharedProperties: string[];
}

// ============================================================================
// Run ID Generation
// ============================================================================

/**
 * Generate a unique run ID for an agent execution
 * Format: {agentType}_run_{nanoid}
 */
export function generateRunId(agentType: AgentType): string {
    return `${agentType}_run_${nanoid(12)}`;
}

/**
 * Generate a unique group ID for tagging nodes
 * Format: {agentType}_group_{nanoid}
 */
export function generateGroupId(agentType: AgentType): string {
    return `${agentType}_group_${nanoid(12)}`;
}

// ============================================================================
// Configuration Management
// ============================================================================

const DEFAULT_CONFIGS: Record<AgentType, AgentConfigData> = {
    timeline: {
        enabled: false,
        batchSize: 100,
        confidenceThreshold: 0.90,
        minGroupSizeCron: 10,  // Need 10+ nodes for CRON-discovered timelines
        minGroupSizeContext: 5,  // Only 5+ for right-click triggered
        maxExecutionMs: 7000,
        overlapThreshold: 10,
        scanNewEventsOnly: true,
        lastProcessedTimestamp: null,
        config: null,
    },
    correlation: {
        enabled: false,
        batchSize: 100,
        confidenceThreshold: 0.90,
        minGroupSizeCron: 5,
        minGroupSizeContext: 5,
        maxExecutionMs: 7000,
        overlapThreshold: 10,
        scanNewEventsOnly: true,
        lastProcessedTimestamp: null,
        config: null,
    },
    anomaly: {
        enabled: false,
        batchSize: 100,
        confidenceThreshold: 0.90,
        minGroupSizeCron: 10,  // Need 10+ anomalies per group
        minGroupSizeContext: 10,
        maxExecutionMs: 7000,
        overlapThreshold: 10,
        scanNewEventsOnly: true,
        lastProcessedTimestamp: null,
        config: {
            timeWindowHours: 1,  // Group anomalies within 1-hour window
            regionRadiusKm: 50,  // Same region = within 50km
        },
    },
};

/**
 * Get configuration for an agent type
 * Returns from database if exists, otherwise returns defaults
 */
export async function getAgentConfig(agentType: AgentType): Promise<AgentConfigData> {
    const db = await getDb();
    if (!db) {
        console.warn("[Agent] Database not available, using defaults");
        return DEFAULT_CONFIGS[agentType];
    }

    try {
        const result = await db
            .select()
            .from(agentConfig)
            .where(eq(agentConfig.agentType, agentType))
            .limit(1);

        if (result.length === 0) {
            return DEFAULT_CONFIGS[agentType];
        }

        const row = result[0];
        return {
            enabled: row.enabled,
            batchSize: row.batchSize,
            confidenceThreshold: row.confidenceThreshold,
            minGroupSizeCron: row.minGroupSizeCron ?? DEFAULT_CONFIGS[agentType].minGroupSizeCron,
            minGroupSizeContext: row.minGroupSizeContext ?? DEFAULT_CONFIGS[agentType].minGroupSizeContext,
            maxExecutionMs: row.maxExecutionMs,
            overlapThreshold: row.overlapThreshold,
            scanNewEventsOnly: row.scanNewEventsOnly,
            lastProcessedTimestamp: row.lastProcessedTimestamp,
            config: row.config as Record<string, any> | null,
        };
    } catch (error) {
        console.error("[Agent] Error fetching config:", error);
        return DEFAULT_CONFIGS[agentType];
    }
}

/**
 * Update configuration for an agent type
 */
export async function updateAgentConfig(
    agentType: AgentType,
    updates: Partial<AgentConfigData>
): Promise<void> {
    const db = await getDb();
    if (!db) {
        console.warn("[Agent] Database not available, cannot update config");
        return;
    }

    try {
        // Check if config exists
        const existing = await db
            .select()
            .from(agentConfig)
            .where(eq(agentConfig.agentType, agentType))
            .limit(1);

        if (existing.length === 0) {
            // Insert new config
            await db.insert(agentConfig).values({
                agentType,
                enabled: updates.enabled ?? DEFAULT_CONFIGS[agentType].enabled,
                batchSize: updates.batchSize ?? DEFAULT_CONFIGS[agentType].batchSize,
                confidenceThreshold: updates.confidenceThreshold ?? DEFAULT_CONFIGS[agentType].confidenceThreshold,
                minGroupSizeCron: updates.minGroupSizeCron ?? DEFAULT_CONFIGS[agentType].minGroupSizeCron,
                minGroupSizeContext: updates.minGroupSizeContext ?? DEFAULT_CONFIGS[agentType].minGroupSizeContext,
                maxExecutionMs: updates.maxExecutionMs ?? DEFAULT_CONFIGS[agentType].maxExecutionMs,
                overlapThreshold: updates.overlapThreshold ?? DEFAULT_CONFIGS[agentType].overlapThreshold,
                scanNewEventsOnly: updates.scanNewEventsOnly ?? DEFAULT_CONFIGS[agentType].scanNewEventsOnly,
                lastProcessedTimestamp: updates.lastProcessedTimestamp ?? null,
                config: updates.config ?? DEFAULT_CONFIGS[agentType].config,
            });
        } else {
            // Update existing config
            await db
                .update(agentConfig)
                .set({
                    ...updates,
                    updatedAt: new Date().toISOString(),
                })
                .where(eq(agentConfig.agentType, agentType));
        }
    } catch (error) {
        console.error("[Agent] Error updating config:", error);
    }
}

/**
 * Update the last processed timestamp after a successful run
 */
export async function updateLastProcessedTimestamp(
    agentType: AgentType,
    timestamp: number
): Promise<void> {
    await updateAgentConfig(agentType, { lastProcessedTimestamp: timestamp });
}

// ============================================================================
// Run Management
// ============================================================================

/**
 * Create a new agent run record
 */
export async function createAgentRun(
    agentType: AgentType,
    runMode: RunMode,
    config: AgentConfigData,
    anchorNodeId?: string,
    anchorNodeType?: string
): Promise<AgentRunContext> {
    const runId = generateRunId(agentType);
    const startTime = Date.now();

    const db = await getDb();
    if (db) {
        try {
            await db.insert(agentRuns).values({
                id: runId,
                agentType,
                runMode,
                status: "running",
                anchorNodeId,
                anchorNodeType,
                batchSize: config.batchSize,
                confidenceThreshold: config.confidenceThreshold,
                minGroupSize: runMode === "cron" ? config.minGroupSizeCron : config.minGroupSizeContext,
                maxExecutionMs: config.maxExecutionMs,
            });
        } catch (error) {
            console.error("[Agent] Error creating run record:", error);
        }
    }

    return {
        runId,
        agentType,
        runMode,
        config,
        startTime,
        anchorNodeId,
        anchorNodeType,
    };
}

/**
 * Update an agent run with results
 */
export async function updateAgentRun(
    runId: string,
    updates: {
        status?: RunStatus;
        nodesProcessed?: number;
        nodesMatched?: number;
        nodesTagged?: number;
        batchesCompleted?: number;
        groupId?: string;
        groupSize?: number;
        executiveSummary?: string;
        findings?: any;
    }
): Promise<void> {
    const db = await getDb();
    if (!db) return;

    try {
        await db.update(agentRuns).set({
            ...updates,
            processingTimeMs: Date.now() - (await getRunStartTime(runId)),
            completedAt: updates.status && updates.status !== "running" ? new Date().toISOString() : undefined,
        }).where(eq(agentRuns.id, runId));
    } catch (error) {
        console.error("[Agent] Error updating run:", error);
    }
}

async function getRunStartTime(runId: string): Promise<number> {
    const db = await getDb();
    if (!db) return Date.now();

    try {
        const result = await db
            .select({ startedAt: agentRuns.startedAt })
            .from(agentRuns)
            .where(eq(agentRuns.id, runId))
            .limit(1);

        if (result.length > 0 && result[0].startedAt) {
            return new Date(result[0].startedAt).getTime();
        }
    } catch (error) {
        console.error("[Agent] Error getting run start time:", error);
    }
    return Date.now();
}

/**
 * Get recent runs for an agent type
 */
export async function getRecentRuns(
    agentType: AgentType,
    limit: number = 10
): Promise<AgentRun[]> {
    const db = await getDb();
    if (!db) return [];

    try {
        return await db
            .select()
            .from(agentRuns)
            .where(eq(agentRuns.agentType, agentType))
            .orderBy(desc(agentRuns.startedAt))
            .limit(limit);
    } catch (error) {
        console.error("[Agent] Error fetching recent runs:", error);
        return [];
    }
}

// ============================================================================
// Logging Utilities
// ============================================================================

/**
 * Log a message for an agent run
 */
export async function logAgentMessage(
    runId: string,
    level: LogLevel,
    message: string,
    metadata?: Record<string, any>
): Promise<void> {
    // Always log to console
    const prefix = `[Agent:${runId}]`;
    switch (level) {
        case "debug":
            console.debug(prefix, message, metadata || "");
            break;
        case "info":
            console.log(prefix, message, metadata || "");
            break;
        case "warn":
            console.warn(prefix, message, metadata || "");
            break;
        case "error":
            console.error(prefix, message, metadata || "");
            break;
    }

    // Also store in database
    const db = await getDb();
    if (!db) return;

    try {
        await db.insert(agentRunLogs).values({
            runId,
            level,
            message,
            metadata,
        });
    } catch (error) {
        console.error("[Agent] Error storing log:", error);
    }
}

/**
 * Get logs for an agent run
 */
export async function getRunLogs(
    runId: string,
    limit: number = 100
): Promise<AgentRunLog[]> {
    const db = await getDb();
    if (!db) return [];

    try {
        return await db
            .select()
            .from(agentRunLogs)
            .where(eq(agentRunLogs.runId, runId))
            .orderBy(agentRunLogs.timestamp)
            .limit(limit);
    } catch (error) {
        console.error("[Agent] Error fetching logs:", error);
        return [];
    }
}

// ============================================================================
// Similarity Calculation (Jaccard Index)
// ============================================================================

/**
 * Calculate Jaccard similarity between two sets
 * Returns value between 0 and 1
 */
export function calculateJaccardSimilarity(setA: string[], setB: string[]): number {
    if (setA.length === 0 && setB.length === 0) return 0;

    const a = new Set(setA.map(s => s.toLowerCase()));
    const b = new Set(setB.map(s => s.toLowerCase()));

    const intersection = new Set([...a].filter(x => b.has(x)));
    const union = new Set([...a, ...b]);

    return intersection.size / union.size;
}

/**
 * Calculate weighted similarity between two event nodes
 * Uses multiple property types with different weights
 */
export function calculateEventSimilarity(
    event1: {
        geminiTags?: string[];
        geminiObjects?: string[];
        geminiVehicles?: string[];
        geminiLicensePlates?: string[];
        geminiClothingColors?: string[];
    },
    event2: {
        geminiTags?: string[];
        geminiObjects?: string[];
        geminiVehicles?: string[];
        geminiLicensePlates?: string[];
        geminiClothingColors?: string[];
    }
): { similarity: number; sharedProperties: string[] } {
    const weights = {
        licensePlates: 0.40,  // Highest weight - strong identifier
        vehicles: 0.25,
        tags: 0.15,
        objects: 0.10,
        clothingColors: 0.10,
    };

    const shared: string[] = [];
    let totalSimilarity = 0;

    // License plates (exact match is very significant)
    const plates1 = event1.geminiLicensePlates || [];
    const plates2 = event2.geminiLicensePlates || [];
    const plateSim = calculateJaccardSimilarity(plates1, plates2);
    totalSimilarity += plateSim * weights.licensePlates;
    if (plateSim > 0) {
        const sharedPlates = plates1.filter(p => plates2.map(x => x.toLowerCase()).includes(p.toLowerCase()));
        shared.push(...sharedPlates.map(p => `plate:${p}`));
    }

    // Vehicles
    const vehicles1 = event1.geminiVehicles || [];
    const vehicles2 = event2.geminiVehicles || [];
    const vehicleSim = calculateJaccardSimilarity(vehicles1, vehicles2);
    totalSimilarity += vehicleSim * weights.vehicles;
    if (vehicleSim > 0) {
        const sharedVehicles = vehicles1.filter(v => vehicles2.map(x => x.toLowerCase()).includes(v.toLowerCase()));
        shared.push(...sharedVehicles.map(v => `vehicle:${v}`));
    }

    // Tags
    const tags1 = event1.geminiTags || [];
    const tags2 = event2.geminiTags || [];
    const tagSim = calculateJaccardSimilarity(tags1, tags2);
    totalSimilarity += tagSim * weights.tags;

    // Objects
    const objects1 = event1.geminiObjects || [];
    const objects2 = event2.geminiObjects || [];
    const objectSim = calculateJaccardSimilarity(objects1, objects2);
    totalSimilarity += objectSim * weights.objects;

    // Clothing colors
    const colors1 = event1.geminiClothingColors || [];
    const colors2 = event2.geminiClothingColors || [];
    const colorSim = calculateJaccardSimilarity(colors1, colors2);
    totalSimilarity += colorSim * weights.clothingColors;

    return { similarity: totalSimilarity, sharedProperties: shared };
}

// ============================================================================
// Duplicate Detection
// ============================================================================

/**
 * Check if a candidate group of nodes already has too many existing tags
 * Returns true if the group should be discarded (too much overlap)
 */
export async function checkDuplicateTagging(
    agentType: AgentType,
    nodeIds: string[],
    overlapThreshold: number
): Promise<{ isDuplicate: boolean; existingCount: number; existingRunIds: string[] }> {
    if (!isNeo4jConfigured() || nodeIds.length === 0) {
        return { isDuplicate: false, existingCount: 0, existingRunIds: [] };
    }

    // Determine which tag property to check based on agent type
    const tagProperty = getTagPropertyName(agentType);

    try {
        // Query Neo4j to count nodes that already have tags from this agent type
        const result = await runQuery<{ nodeId: string; tags: string[] }>(
            `
      MATCH (e:Event)
      WHERE e.id IN $nodeIds AND e.${tagProperty} IS NOT NULL AND size(e.${tagProperty}) > 0
      RETURN e.id as nodeId, e.${tagProperty} as tags
      `,
            { nodeIds }
        );

        const existingCount = result.length;
        const existingRunIds = [...new Set(result.flatMap(r => r.tags || []))];

        return {
            isDuplicate: existingCount >= overlapThreshold,
            existingCount,
            existingRunIds,
        };
    } catch (error) {
        console.error("[Agent] Error checking duplicate tagging:", error);
        return { isDuplicate: false, existingCount: 0, existingRunIds: [] };
    }
}

// ============================================================================
// Neo4j Tagging Helpers
// ============================================================================

/**
 * Get the Neo4j property name for agent tags
 */
export function getTagPropertyName(agentType: AgentType): string {
    switch (agentType) {
        case "timeline":
            return "timelineTags";
        case "correlation":
            return "correlationTags";
        case "anomaly":
            return "anomalyTags";
    }
}

/**
 * Apply agent tags to a set of nodes in Neo4j
 * Tags are additive (appended to existing array)
 */
export async function applyAgentTags(
    agentType: AgentType,
    groupId: string,
    nodeIds: string[],
    metadata?: Record<string, any>
): Promise<number> {
    if (!isNeo4jConfigured() || nodeIds.length === 0) {
        console.warn("[Agent] Neo4j not configured or no nodes to tag");
        return 0;
    }

    const tagProperty = getTagPropertyName(agentType);

    try {
        const result = await writeTransaction(async (tx) => {
            // Use COALESCE to handle null arrays and append the new tag
            const queryResult = await tx.run(
                `
        MATCH (e:Event)
        WHERE e.id IN $nodeIds
        SET e.${tagProperty} = COALESCE(e.${tagProperty}, []) + $groupId
        SET e.agentMetadata = COALESCE(e.agentMetadata, '{}')
        RETURN count(e) as taggedCount
        `,
                { nodeIds, groupId }
            );

            return queryResult.records[0]?.get("taggedCount")?.toNumber() || 0;
        });

        console.log(`[Agent] Tagged ${result} nodes with ${groupId}`);
        return result;
    } catch (error) {
        console.error("[Agent] Error applying tags:", error);
        return 0;
    }
}

/**
 * Get all nodes tagged with a specific group ID
 */
export async function getTaggedNodes(groupId: string): Promise<string[]> {
    if (!isNeo4jConfigured()) return [];

    try {
        const result = await runQuery<{ nodeId: string }>(
            `
      MATCH (e:Event)
      WHERE $groupId IN e.timelineTags 
         OR $groupId IN e.correlationTags 
         OR $groupId IN e.anomalyTags
      RETURN e.id as nodeId
      `,
            { groupId }
        );

        return result.map(r => r.nodeId);
    } catch (error) {
        console.error("[Agent] Error fetching tagged nodes:", error);
        return [];
    }
}

// ============================================================================
// Execution Time Management
// ============================================================================

/**
 * Check if execution time limit has been exceeded
 */
export function isTimeExceeded(context: AgentRunContext): boolean {
    const elapsed = Date.now() - context.startTime;
    return elapsed >= context.config.maxExecutionMs;
}

/**
 * Get remaining execution time in milliseconds
 */
export function getRemainingTime(context: AgentRunContext): number {
    const elapsed = Date.now() - context.startTime;
    return Math.max(0, context.config.maxExecutionMs - elapsed);
}

// ============================================================================
// Neo4j Index Initialization
// ============================================================================

/**
 * Create Neo4j indexes for agent tag properties
 * Should be called on application startup
 */
export async function initializeAgentIndexes(): Promise<void> {
    if (!isNeo4jConfigured()) {
        console.log("[Agent] Neo4j not configured, skipping index initialization");
        return;
    }

    try {
        await writeTransaction(async (tx) => {
            // Create indexes for agent tag properties
            await tx.run(`CREATE INDEX event_timeline_tags IF NOT EXISTS FOR (e:Event) ON (e.timelineTags)`);
            await tx.run(`CREATE INDEX event_correlation_tags IF NOT EXISTS FOR (e:Event) ON (e.correlationTags)`);
            await tx.run(`CREATE INDEX event_anomaly_tags IF NOT EXISTS FOR (e:Event) ON (e.anomalyTags)`);
            console.log("[Agent] Neo4j indexes created successfully");
        });
    } catch (error) {
        console.error("[Agent] Error creating Neo4j indexes:", error);
    }
}
