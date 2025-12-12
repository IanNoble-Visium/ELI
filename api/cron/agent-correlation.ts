/**
 * Correlation Agent CRON Handler
 * 
 * Discovers clusters of related events based on property similarity.
 * Unlike Timeline Agent, Correlation Agent ignores temporal order and
 * focuses on finding groups of events that share similar characteristics.
 * 
 * Use cases:
 * - Same vehicle appearing at multiple locations
 * - Same person (by clothing) at different cameras
 * - Similar incident types (same objects detected)
 * 
 * Execution modes:
 * - CRON: Process multiple batches, find clusters with 5+ nodes
 * - Context: Start from anchor node, find related events
 */
import type { VercelRequest, VercelResponse } from "@vercel/node";
import {
    createAgentRun,
    updateAgentRun,
    logAgentMessage,
    getAgentConfig,
    updateLastProcessedTimestamp,
    checkDuplicateTagging,
    applyAgentTags,
    calculateEventSimilarity,
    generateGroupId,
    isTimeExceeded,
    getRemainingTime,
    type AgentRunContext,
} from "../lib/agent-base.js";
import { isNeo4jConfigured, runQuery } from "../lib/neo4j.js";
import { isGeminiConfigured } from "../lib/gemini.js";
import { recordJobExecution } from "./status.js";

interface CorrelationEvent {
    id: string;
    eventId: string;
    timestamp: number;
    channelId: string;
    channelName?: string;
    region?: string;
    latitude?: number;
    longitude?: number;
    imageUrl?: string;
    geminiTags?: string[];
    geminiObjects?: string[];
    geminiVehicles?: string[];
    geminiLicensePlates?: string[];
    geminiClothingColors?: string[];
    geminiCaption?: string;
}

interface CorrelationCluster {
    events: CorrelationEvent[];
    centroid: CorrelationEvent;  // The most connected event
    avgSimilarity: number;
    sharedProperties: string[];
    uniqueLocations: number;
    uniqueChannels: number;
}

interface SimilarityEdge {
    source: CorrelationEvent;
    target: CorrelationEvent;
    similarity: number;
    sharedProperties: string[];
}

/**
 * Fetch events from Neo4j for processing
 */
async function fetchEventsForProcessing(
    context: AgentRunContext,
    batchIndex: number
): Promise<CorrelationEvent[]> {
    const { config, anchorNodeId } = context;
    const offset = batchIndex * config.batchSize;

    let cypher: string;
    let params: Record<string, any>;

    if (anchorNodeId) {
        // Context mode: fetch events that might be similar to anchor
        cypher = `
      MATCH (anchor:Event {id: $anchorNodeId})
      MATCH (e:Event)
      WHERE e.id <> anchor.id
        AND e.geminiProcessedAt IS NOT NULL
        AND (e.correlationTags IS NULL OR size(e.correlationTags) = 0)
      WITH anchor, e
      ORDER BY e.timestamp DESC
      SKIP $offset
      LIMIT $limit
      RETURN e.id as id,
             e.eventId as eventId,
             e.timestamp as timestamp,
             e.channelId as channelId,
             e.channelName as channelName,
             e.region as region,
             e.latitude as latitude,
             e.longitude as longitude,
             e.imageUrl as imageUrl,
             e.geminiTags as geminiTags,
             e.geminiObjects as geminiObjects,
             e.geminiVehicles as geminiVehicles,
             e.geminiLicensePlates as geminiLicensePlates,
             e.geminiClothingColors as geminiClothingColors,
             e.geminiCaption as geminiCaption
    `;
        params = { anchorNodeId, offset, limit: config.batchSize };
    } else {
        // CRON mode: fetch recent events that haven't been correlation-tagged
        const startTimestamp = config.scanNewEventsOnly && config.lastProcessedTimestamp
            ? config.lastProcessedTimestamp
            : 0;

        cypher = `
      MATCH (e:Event)
      WHERE e.timestamp > $startTimestamp
        AND e.geminiProcessedAt IS NOT NULL
        AND (e.correlationTags IS NULL OR size(e.correlationTags) = 0)
      WITH e
      ORDER BY e.timestamp DESC
      SKIP $offset
      LIMIT $limit
      RETURN e.id as id,
             e.eventId as eventId,
             e.timestamp as timestamp,
             e.channelId as channelId,
             e.channelName as channelName,
             e.region as region,
             e.latitude as latitude,
             e.longitude as longitude,
             e.imageUrl as imageUrl,
             e.geminiTags as geminiTags,
             e.geminiObjects as geminiObjects,
             e.geminiVehicles as geminiVehicles,
             e.geminiLicensePlates as geminiLicensePlates,
             e.geminiClothingColors as geminiClothingColors,
             e.geminiCaption as geminiCaption
    `;
        params = { startTimestamp, offset, limit: config.batchSize };
    }

    return runQuery<CorrelationEvent>(cypher, params);
}

/**
 * Build a similarity graph for all events
 */
function buildSimilarityGraph(
    events: CorrelationEvent[],
    confidenceThreshold: number
): SimilarityEdge[] {
    const edges: SimilarityEdge[] = [];

    for (let i = 0; i < events.length; i++) {
        for (let j = i + 1; j < events.length; j++) {
            const { similarity, sharedProperties } = calculateEventSimilarity(
                {
                    geminiTags: events[i].geminiTags,
                    geminiObjects: events[i].geminiObjects,
                    geminiVehicles: events[i].geminiVehicles,
                    geminiLicensePlates: events[i].geminiLicensePlates,
                    geminiClothingColors: events[i].geminiClothingColors,
                },
                {
                    geminiTags: events[j].geminiTags,
                    geminiObjects: events[j].geminiObjects,
                    geminiVehicles: events[j].geminiVehicles,
                    geminiLicensePlates: events[j].geminiLicensePlates,
                    geminiClothingColors: events[j].geminiClothingColors,
                }
            );

            if (similarity >= confidenceThreshold) {
                edges.push({
                    source: events[i],
                    target: events[j],
                    similarity,
                    sharedProperties,
                });
            }
        }
    }

    return edges;
}

/**
 * Find the largest connected component (cluster) in the similarity graph
 * Using union-find algorithm
 */
function findLargestCluster(
    events: CorrelationEvent[],
    edges: SimilarityEdge[]
): CorrelationCluster | null {
    if (events.length === 0 || edges.length === 0) {
        return null;
    }

    // Build adjacency map and union-find
    const parent = new Map<string, string>();
    const rank = new Map<string, number>();
    const connections = new Map<string, number>(); // Count connections per node

    // Initialize union-find
    for (const event of events) {
        parent.set(event.id, event.id);
        rank.set(event.id, 0);
        connections.set(event.id, 0);
    }

    // Find with path compression
    function find(x: string): string {
        if (parent.get(x) !== x) {
            parent.set(x, find(parent.get(x)!));
        }
        return parent.get(x)!;
    }

    // Union by rank
    function union(x: string, y: string): void {
        const px = find(x);
        const py = find(y);

        if (px === py) return;

        const rx = rank.get(px) || 0;
        const ry = rank.get(py) || 0;

        if (rx < ry) {
            parent.set(px, py);
        } else if (rx > ry) {
            parent.set(py, px);
        } else {
            parent.set(py, px);
            rank.set(px, rx + 1);
        }
    }

    // Process edges
    for (const edge of edges) {
        union(edge.source.id, edge.target.id);
        connections.set(edge.source.id, (connections.get(edge.source.id) || 0) + 1);
        connections.set(edge.target.id, (connections.get(edge.target.id) || 0) + 1);
    }

    // Group events by their root
    const clusters = new Map<string, CorrelationEvent[]>();
    for (const event of events) {
        const root = find(event.id);
        if (!clusters.has(root)) {
            clusters.set(root, []);
        }
        clusters.get(root)!.push(event);
    }

    // Find the largest cluster
    let largestCluster: CorrelationEvent[] = [];
    for (const cluster of clusters.values()) {
        if (cluster.length > largestCluster.length) {
            largestCluster = cluster;
        }
    }

    if (largestCluster.length < 2) {
        return null;
    }

    // Find the centroid (most connected node in the cluster)
    let centroid = largestCluster[0];
    let maxConnections = 0;
    for (const event of largestCluster) {
        const conn = connections.get(event.id) || 0;
        if (conn > maxConnections) {
            maxConnections = conn;
            centroid = event;
        }
    }

    // Calculate cluster statistics
    const clusterEdges = edges.filter(e =>
        largestCluster.some(ev => ev.id === e.source.id) &&
        largestCluster.some(ev => ev.id === e.target.id)
    );

    const avgSimilarity = clusterEdges.length > 0
        ? clusterEdges.reduce((sum, e) => sum + e.similarity, 0) / clusterEdges.length
        : 0;

    const sharedProperties = [...new Set(clusterEdges.flatMap(e => e.sharedProperties))];
    const uniqueLocations = new Set(largestCluster.map(e => e.region).filter(Boolean)).size;
    const uniqueChannels = new Set(largestCluster.map(e => e.channelId).filter(Boolean)).size;

    return {
        events: largestCluster,
        centroid,
        avgSimilarity,
        sharedProperties,
        uniqueLocations,
        uniqueChannels,
    };
}

/**
 * Generate executive summary for a discovered correlation cluster
 */
function generateExecutiveSummary(cluster: CorrelationCluster): string {
    const { events, sharedProperties, uniqueLocations, uniqueChannels, avgSimilarity } = cluster;

    let summary = `Correlation cluster of ${events.length} related events `;
    summary += `across ${uniqueChannels} camera${uniqueChannels > 1 ? 's' : ''} `;

    if (uniqueLocations > 0) {
        summary += `in ${uniqueLocations} location${uniqueLocations > 1 ? 's' : ''}. `;
    } else {
        summary += `. `;
    }

    if (sharedProperties.length > 0) {
        summary += `Shared identifiers: ${sharedProperties.slice(0, 5).join(", ")}. `;
    }

    summary += `Average similarity: ${(avgSimilarity * 100).toFixed(1)}%.`;

    return summary;
}

/**
 * Process a batch of events to discover correlations
 */
async function processBatch(
    context: AgentRunContext,
    events: CorrelationEvent[],
    batchIndex: number
): Promise<CorrelationCluster | null> {
    const { runId, config, runMode } = context;
    const minGroupSize = runMode === "cron" ? config.minGroupSizeCron : config.minGroupSizeContext;

    await logAgentMessage(runId, "info", `Processing batch ${batchIndex + 1} with ${events.length} events`);

    // Build similarity graph
    const edges = buildSimilarityGraph(events, config.confidenceThreshold);
    await logAgentMessage(runId, "debug", `Found ${edges.length} similarity edges above threshold`);

    if (edges.length === 0) {
        return null;
    }

    // Find largest cluster
    const cluster = findLargestCluster(events, edges);

    if (!cluster || cluster.events.length < minGroupSize) {
        await logAgentMessage(runId, "debug",
            `Largest cluster has ${cluster?.events.length || 0} events, below minimum ${minGroupSize}`
        );
        return null;
    }

    await logAgentMessage(runId, "info",
        `Found cluster: ${cluster.events.length} events, avg similarity: ${(cluster.avgSimilarity * 100).toFixed(1)}%`
    );

    return cluster;
}

export default async function handler(
    req: VercelRequest,
    res: VercelResponse
): Promise<void> {
    // Verify authorization
    const authHeader = req.headers.authorization;
    const isVercelCron = authHeader === `Bearer ${process.env.CRON_SECRET}`;
    const isManualTrigger = req.query.manual === "true";
    const anchorNodeId = req.query.anchorNodeId as string | undefined;

    if (!isVercelCron && !isManualTrigger && process.env.NODE_ENV === "production") {
        res.status(401).json({ error: "Unauthorized" });
        return;
    }

    const startTime = Date.now();
    const results: Record<string, any> = {
        timestamp: new Date().toISOString(),
        type: "cron_job",
        job: "agent-correlation",
        manual: isManualTrigger,
        context: anchorNodeId ? "right-click" : "cron",
    };

    try {
        // Check dependencies
        if (!isNeo4jConfigured()) {
            results.status = "skipped";
            results.reason = "Neo4j not configured";
            res.status(200).json(results);
            return;
        }

        if (!isGeminiConfigured()) {
            results.status = "skipped";
            results.reason = "Gemini API not configured (needed for similarity matching)";
            res.status(200).json(results);
            return;
        }

        // Get agent configuration
        const config = await getAgentConfig("correlation");
        results.config = {
            enabled: config.enabled,
            batchSize: config.batchSize,
            confidenceThreshold: config.confidenceThreshold,
            maxExecutionMs: config.maxExecutionMs,
        };

        // Check if agent is enabled (unless forced)
        if (!config.enabled && !isManualTrigger) {
            results.status = "skipped";
            results.reason = "Correlation agent is disabled. Enable in settings or use ?manual=true";
            res.status(200).json(results);
            return;
        }

        // Create agent run
        const runMode = anchorNodeId ? "context" : isManualTrigger ? "manual" : "cron";
        const context = await createAgentRun("correlation", runMode, config, anchorNodeId);
        results.runId = context.runId;

        await logAgentMessage(context.runId, "info", `Correlation agent started in ${runMode} mode`);

        // If context mode, fetch the anchor event first
        let anchorEvent: CorrelationEvent | undefined;
        if (anchorNodeId) {
            const [anchor] = await runQuery<CorrelationEvent>(
                `MATCH (e:Event {id: $id}) RETURN e.id as id, e.eventId as eventId, e.timestamp as timestamp,
         e.channelId as channelId, e.geminiTags as geminiTags, e.geminiObjects as geminiObjects,
         e.geminiVehicles as geminiVehicles, e.geminiLicensePlates as geminiLicensePlates,
         e.geminiClothingColors as geminiClothingColors`,
                { id: anchorNodeId }
            );

            if (!anchor) {
                results.status = "failed";
                results.error = `Anchor node not found: ${anchorNodeId}`;
                await updateAgentRun(context.runId, { status: "failed" });
                res.status(404).json(results);
                return;
            }
            anchorEvent = anchor;
        }

        // Process batches
        let bestCluster: CorrelationCluster | null = null;
        let batchIndex = 0;
        let totalNodesProcessed = 0;
        let latestTimestamp = 0;

        while (!isTimeExceeded(context)) {
            const events = await fetchEventsForProcessing(context, batchIndex);

            if (events.length === 0) {
                await logAgentMessage(context.runId, "info", "No more events to process");
                break;
            }

            totalNodesProcessed += events.length;

            // Track latest timestamp for incremental processing
            const maxTimestamp = Math.max(...events.map(e => e.timestamp));
            if (maxTimestamp > latestTimestamp) {
                latestTimestamp = maxTimestamp;
            }

            // If context mode, include anchor in batch
            if (anchorEvent) {
                events.unshift(anchorEvent);
            }

            const batchBest = await processBatch(context, events, batchIndex);

            if (batchBest) {
                if (!bestCluster || batchBest.events.length > bestCluster.events.length) {
                    bestCluster = batchBest;
                }
            }

            batchIndex++;

            // In context mode, only process one batch
            if (anchorNodeId) break;

            // Check remaining time before next batch
            if (getRemainingTime(context) < 1000) {
                await logAgentMessage(context.runId, "warn", "Less than 1 second remaining, stopping");
                break;
            }
        }

        // Update run stats
        await updateAgentRun(context.runId, {
            nodesProcessed: totalNodesProcessed,
            batchesCompleted: batchIndex,
        });

        // If we found a valid cluster, check for duplicates and apply tags
        if (bestCluster) {
            const nodeIds = bestCluster.events.map(e => e.id);

            // Check for duplicate tagging
            const duplicateCheck = await checkDuplicateTagging("correlation", nodeIds, config.overlapThreshold);

            if (duplicateCheck.isDuplicate) {
                await logAgentMessage(context.runId, "warn",
                    `Discarding cluster: ${duplicateCheck.existingCount} nodes already have correlation tags`
                );

                await updateAgentRun(context.runId, {
                    status: "discarded",
                    nodesMatched: bestCluster.events.length,
                    findings: {
                        reason: "duplicate_overlap",
                        existingCount: duplicateCheck.existingCount,
                        existingRunIds: duplicateCheck.existingRunIds,
                    },
                });

                results.status = "discarded";
                results.reason = `${duplicateCheck.existingCount} nodes already have correlation tags (threshold: ${config.overlapThreshold})`;
                results.duration_ms = Date.now() - startTime;

                recordJobExecution("agent-correlation", "skipped", results.duration_ms, results.reason);
                res.status(200).json(results);
                return;
            }

            // Apply tags
            const groupId = generateGroupId("correlation");
            const taggedCount = await applyAgentTags("correlation", groupId, nodeIds);

            const executiveSummary = generateExecutiveSummary(bestCluster);

            await updateAgentRun(context.runId, {
                status: "completed",
                nodesMatched: bestCluster.events.length,
                nodesTagged: taggedCount,
                groupId,
                groupSize: bestCluster.events.length,
                executiveSummary,
                findings: {
                    cluster: bestCluster.events.map(e => ({
                        id: e.id,
                        timestamp: e.timestamp,
                        channelId: e.channelId,
                        region: e.region,
                    })),
                    centroidId: bestCluster.centroid.id,
                    sharedProperties: bestCluster.sharedProperties,
                    avgSimilarity: bestCluster.avgSimilarity,
                    uniqueLocations: bestCluster.uniqueLocations,
                    uniqueChannels: bestCluster.uniqueChannels,
                },
            });

            // Update last processed timestamp for incremental scanning
            if (latestTimestamp > 0 && config.scanNewEventsOnly) {
                await updateLastProcessedTimestamp("correlation", latestTimestamp);
            }

            await logAgentMessage(context.runId, "info",
                `Correlation cluster discovered: ${groupId} with ${bestCluster.events.length} events`
            );

            results.status = "completed";
            results.groupId = groupId;
            results.clusterSize = bestCluster.events.length;
            results.nodesTagged = taggedCount;
            results.uniqueChannels = bestCluster.uniqueChannels;
            results.executiveSummary = executiveSummary;
        } else {
            await updateAgentRun(context.runId, {
                status: "completed",
                findings: { message: "No correlation cluster meeting minimum size found" },
            });

            results.status = "completed";
            results.findings = "No correlation cluster found meeting minimum requirements";
        }

        results.nodesProcessed = totalNodesProcessed;
        results.batchesCompleted = batchIndex;
        results.duration_ms = Date.now() - startTime;

        recordJobExecution(
            "agent-correlation",
            bestCluster ? "success" : "skipped",
            results.duration_ms,
            bestCluster ? `Found cluster with ${bestCluster.events.length} events` : "No cluster found"
        );

        res.status(200).json(results);

    } catch (error) {
        console.error("[Correlation Agent] Error:", error);
        results.status = "error";
        results.error = error instanceof Error ? error.message : "Unknown error";
        results.duration_ms = Date.now() - startTime;

        recordJobExecution("agent-correlation", "error", results.duration_ms, results.error);
        res.status(500).json(results);
    }
}
