/**
 * Timeline Agent CRON Handler
 * 
 * Discovers temporal sequences of related events across cameras to build
 * entity timelines. Uses Gemini-extracted metadata to find similar events
 * and arranges them chronologically.
 * 
 * Execution modes:
 * - CRON: Process multiple batches, find timelines with 10+ nodes
 * - Context: Start from anchor node, find single timeline with 5+ nodes
 * 
 * Configure in vercel.json or trigger manually via /api/cron/status
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

interface TimelineEvent {
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

interface TimelineCandidate {
    events: TimelineEvent[];
    anchorEvent: TimelineEvent;
    avgSimilarity: number;
    sharedProperties: string[];
}

/**
 * Fetch events from Neo4j for processing
 */
async function fetchEventsForProcessing(
    context: AgentRunContext,
    batchIndex: number
): Promise<TimelineEvent[]> {
    const { config, anchorNodeId } = context;
    const offset = batchIndex * config.batchSize;

    // Build query based on mode
    let cypher: string;
    let params: Record<string, any>;

    if (anchorNodeId) {
        // Context mode: fetch events near the anchor node
        cypher = `
      MATCH (anchor:Event {id: $anchorNodeId})
      MATCH (e:Event)
      WHERE e.id <> anchor.id
        AND e.geminiProcessedAt IS NOT NULL
        AND (e.timelineTags IS NULL OR size(e.timelineTags) = 0)
      WITH anchor, e
      ORDER BY abs(e.timestamp - anchor.timestamp)
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
        // CRON mode: fetch recent events that haven't been tagged
        const startTimestamp = config.scanNewEventsOnly && config.lastProcessedTimestamp
            ? config.lastProcessedTimestamp
            : 0;

        cypher = `
      MATCH (e:Event)
      WHERE e.timestamp > $startTimestamp
        AND e.geminiProcessedAt IS NOT NULL
        AND (e.timelineTags IS NULL OR size(e.timelineTags) = 0)
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

    return runQuery<TimelineEvent>(cypher, params);
}

/**
 * Find events similar to a source event
 */
function findSimilarEvents(
    sourceEvent: TimelineEvent,
    allEvents: TimelineEvent[],
    confidenceThreshold: number
): { event: TimelineEvent; similarity: number; sharedProperties: string[] }[] {
    const matches: { event: TimelineEvent; similarity: number; sharedProperties: string[] }[] = [];

    for (const event of allEvents) {
        if (event.id === sourceEvent.id) continue;

        const { similarity, sharedProperties } = calculateEventSimilarity(
            {
                geminiTags: sourceEvent.geminiTags,
                geminiObjects: sourceEvent.geminiObjects,
                geminiVehicles: sourceEvent.geminiVehicles,
                geminiLicensePlates: sourceEvent.geminiLicensePlates,
                geminiClothingColors: sourceEvent.geminiClothingColors,
            },
            {
                geminiTags: event.geminiTags,
                geminiObjects: event.geminiObjects,
                geminiVehicles: event.geminiVehicles,
                geminiLicensePlates: event.geminiLicensePlates,
                geminiClothingColors: event.geminiClothingColors,
            }
        );

        if (similarity >= confidenceThreshold) {
            matches.push({ event, similarity, sharedProperties });
        }
    }

    return matches;
}

/**
 * Build a timeline from a source event by finding similar events and ordering chronologically
 */
function buildTimeline(
    sourceEvent: TimelineEvent,
    allEvents: TimelineEvent[],
    confidenceThreshold: number
): TimelineCandidate {
    // Find all similar events
    const similarEvents = findSimilarEvents(sourceEvent, allEvents, confidenceThreshold);

    // Sort by timestamp to create chronological sequence
    const timelineEvents = [sourceEvent, ...similarEvents.map(s => s.event)]
        .sort((a, b) => a.timestamp - b.timestamp);

    // Calculate average similarity
    const avgSimilarity = similarEvents.length > 0
        ? similarEvents.reduce((sum, s) => sum + s.similarity, 0) / similarEvents.length
        : 0;

    // Collect all shared properties
    const allSharedProperties = [...new Set(similarEvents.flatMap(s => s.sharedProperties))];

    return {
        events: timelineEvents,
        anchorEvent: sourceEvent,
        avgSimilarity,
        sharedProperties: allSharedProperties,
    };
}

/**
 * Generate executive summary for a discovered timeline
 */
function generateExecutiveSummary(timeline: TimelineCandidate): string {
    const { events, sharedProperties } = timeline;
    const startTime = new Date(events[0].timestamp).toLocaleString();
    const endTime = new Date(events[events.length - 1].timestamp).toLocaleString();

    // Extract unique locations
    const locations = [...new Set(events.map(e => e.region || e.channelName).filter(Boolean))];

    // Extract unique channels
    const channels = [...new Set(events.map(e => e.channelId).filter(Boolean))];

    // Build summary
    let summary = `Timeline of ${events.length} related events spanning from ${startTime} to ${endTime}. `;

    if (sharedProperties.length > 0) {
        summary += `Common identifiers: ${sharedProperties.slice(0, 5).join(", ")}. `;
    }

    if (locations.length > 0) {
        summary += `Locations involved: ${locations.slice(0, 5).join(", ")}. `;
    }

    if (channels.length > 1) {
        summary += `Appears across ${channels.length} different cameras.`;
    }

    return summary;
}

/**
 * Process a batch of events to discover timelines
 */
async function processBatch(
    context: AgentRunContext,
    events: TimelineEvent[],
    batchIndex: number
): Promise<TimelineCandidate | null> {
    const { runId, config, runMode } = context;
    const minGroupSize = runMode === "cron" ? config.minGroupSizeCron : config.minGroupSizeContext;

    await logAgentMessage(runId, "info", `Processing batch ${batchIndex + 1} with ${events.length} events`);

    let bestTimeline: TimelineCandidate | null = null;

    // Try to build a timeline starting from each event
    for (const event of events) {
        if (isTimeExceeded(context)) {
            await logAgentMessage(runId, "warn", "Time limit reached, stopping batch processing");
            break;
        }

        const timeline = buildTimeline(event, events, config.confidenceThreshold);

        // Check if this timeline meets minimum size
        if (timeline.events.length >= minGroupSize) {
            // Check if this is better than current best
            if (!bestTimeline || timeline.events.length > bestTimeline.events.length) {
                bestTimeline = timeline;
                await logAgentMessage(runId, "debug",
                    `Found timeline candidate: ${timeline.events.length} events, avg similarity: ${(timeline.avgSimilarity * 100).toFixed(1)}%`
                );
            }
        }
    }

    return bestTimeline;
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
        job: "agent-timeline",
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
        const config = await getAgentConfig("timeline");
        results.config = {
            enabled: config.enabled,
            batchSize: config.batchSize,
            confidenceThreshold: config.confidenceThreshold,
            maxExecutionMs: config.maxExecutionMs,
        };

        // Check if agent is enabled (unless forced)
        if (!config.enabled && !isManualTrigger) {
            results.status = "skipped";
            results.reason = "Timeline agent is disabled. Enable in settings or use ?manual=true";
            res.status(200).json(results);
            return;
        }

        // Create agent run
        const runMode = anchorNodeId ? "context" : isManualTrigger ? "manual" : "cron";
        const context = await createAgentRun("timeline", runMode, config, anchorNodeId);
        results.runId = context.runId;

        await logAgentMessage(context.runId, "info", `Timeline agent started in ${runMode} mode`);

        // If context mode, fetch the anchor event first
        let anchorEvent: TimelineEvent | undefined;
        if (anchorNodeId) {
            const [anchor] = await runQuery<TimelineEvent>(
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
        let bestTimeline: TimelineCandidate | null = null;
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
                if (!bestTimeline || batchBest.events.length > bestTimeline.events.length) {
                    bestTimeline = batchBest;
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

        // If we found a valid timeline, check for duplicates and apply tags
        if (bestTimeline) {
            const nodeIds = bestTimeline.events.map(e => e.id);

            // Check for duplicate tagging
            const duplicateCheck = await checkDuplicateTagging("timeline", nodeIds, config.overlapThreshold);

            if (duplicateCheck.isDuplicate) {
                await logAgentMessage(context.runId, "warn",
                    `Discarding timeline: ${duplicateCheck.existingCount} nodes already have timeline tags`
                );

                await updateAgentRun(context.runId, {
                    status: "discarded",
                    nodesMatched: bestTimeline.events.length,
                    findings: {
                        reason: "duplicate_overlap",
                        existingCount: duplicateCheck.existingCount,
                        existingRunIds: duplicateCheck.existingRunIds,
                    },
                });

                results.status = "discarded";
                results.reason = `${duplicateCheck.existingCount} nodes already have timeline tags (threshold: ${config.overlapThreshold})`;
                results.duration_ms = Date.now() - startTime;

                recordJobExecution("agent-timeline", "skipped", results.duration_ms, results.reason);
                res.status(200).json(results);
                return;
            }

            // Apply tags
            const groupId = generateGroupId("timeline");
            const taggedCount = await applyAgentTags("timeline", groupId, nodeIds);

            const executiveSummary = generateExecutiveSummary(bestTimeline);

            await updateAgentRun(context.runId, {
                status: "completed",
                nodesMatched: bestTimeline.events.length,
                nodesTagged: taggedCount,
                groupId,
                groupSize: bestTimeline.events.length,
                executiveSummary,
                findings: {
                    timeline: bestTimeline.events.map(e => ({
                        id: e.id,
                        timestamp: e.timestamp,
                        channelId: e.channelId,
                        region: e.region,
                    })),
                    sharedProperties: bestTimeline.sharedProperties,
                    avgSimilarity: bestTimeline.avgSimilarity,
                },
            });

            // Update last processed timestamp for incremental scanning
            if (latestTimestamp > 0 && config.scanNewEventsOnly) {
                await updateLastProcessedTimestamp("timeline", latestTimestamp);
            }

            await logAgentMessage(context.runId, "info",
                `Timeline discovered: ${groupId} with ${bestTimeline.events.length} events`
            );

            results.status = "completed";
            results.groupId = groupId;
            results.timelineSize = bestTimeline.events.length;
            results.nodesTagged = taggedCount;
            results.executiveSummary = executiveSummary;
        } else {
            await updateAgentRun(context.runId, {
                status: "completed",
                findings: { message: "No timeline meeting minimum size found" },
            });

            results.status = "completed";
            results.findings = "No timeline found meeting minimum requirements";
        }

        results.nodesProcessed = totalNodesProcessed;
        results.batchesCompleted = batchIndex;
        results.duration_ms = Date.now() - startTime;

        recordJobExecution(
            "agent-timeline",
            bestTimeline ? "success" : "skipped",
            results.duration_ms,
            bestTimeline ? `Found timeline with ${bestTimeline.events.length} events` : "No timeline found"
        );

        res.status(200).json(results);

    } catch (error) {
        console.error("[Timeline Agent] Error:", error);
        results.status = "error";
        results.error = error instanceof Error ? error.message : "Unknown error";
        results.duration_ms = Date.now() - startTime;

        recordJobExecution("agent-timeline", "error", results.duration_ms, results.error);
        res.status(500).json(results);
    }
}
