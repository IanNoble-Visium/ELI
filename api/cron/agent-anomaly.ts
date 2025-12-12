/**
 * Anomaly Agent CRON Handler
 * 
 * Detects unusual events or patterns in surveillance data:
 * - Fires, smoke, explosions
 * - Fights, violence, altercations
 * - Crashes, accidents
 * - Unusual gatherings (10+ people)
 * - Weapons detected
 * 
 * Grouping logic:
 * - Events within 1-hour time window
 * - Segregated by geographic region
 * - Minimum 10 nodes per anomaly group
 * - AI-generated summary of the anomaly
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
    generateGroupId,
    isTimeExceeded,
    getRemainingTime,
    type AgentRunContext,
} from "../lib/agent-base.js";
import { isNeo4jConfigured, runQuery } from "../lib/neo4j.js";
import { isGeminiConfigured } from "../lib/gemini.js";
import { recordJobExecution } from "./status.js";

// Anomaly keywords to detect in Gemini tags
const ANOMALY_KEYWORDS = [
    // Fire/smoke
    "fire", "smoke", "flames", "burning", "explosion", "blast",
    // Violence
    "fight", "fighting", "violence", "altercation", "assault", "attack",
    // Accidents
    "crash", "accident", "collision", "wreck", "overturn",
    // Weapons
    "weapon", "gun", "knife", "firearm", "armed",
    // Gatherings
    "crowd", "gathering", "protest", "riot", "mob",
    // Emergency
    "emergency", "ambulance", "police", "rescue",
    // Suspicious
    "suspicious", "unusual", "abnormal", "alert",
];

interface AnomalyEvent {
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
    geminiPeopleCount?: number;
    geminiWeapons?: string[];
    geminiCaption?: string;
    anomalyType?: string;  // The type of anomaly detected
}

interface AnomalyGroup {
    events: AnomalyEvent[];
    region: string;
    startTime: number;
    endTime: number;
    anomalyTypes: string[];
    severity: "critical" | "high" | "medium";
}

/**
 * Get default anomaly config
 */
function getDefaultAnomalyConfig() {
    return {
        timeWindowHours: 1,
        regionRadiusKm: 50,
        minPeopleForGathering: 10,
    };
}

/**
 * Fetch potential anomaly events from Neo4j
 */
async function fetchAnomalyEvents(
    context: AgentRunContext,
    batchIndex: number
): Promise<AnomalyEvent[]> {
    const { config } = context;
    const offset = batchIndex * config.batchSize;

    // Build anomaly keywords pattern for Cypher
    const keywordsPattern = ANOMALY_KEYWORDS.map(k => `'${k}'`).join(", ");
    const anomalyConfig = config.config || getDefaultAnomalyConfig();
    const minPeople = anomalyConfig.minPeopleForGathering || 10;

    const startTimestamp = config.scanNewEventsOnly && config.lastProcessedTimestamp
        ? config.lastProcessedTimestamp
        : 0;

    const cypher = `
    MATCH (e:Event)
    WHERE e.timestamp > $startTimestamp
      AND e.geminiProcessedAt IS NOT NULL
      AND (e.anomalyTags IS NULL OR size(e.anomalyTags) = 0)
      AND (
        // Check for anomaly keywords in tags
        size([t IN coalesce(e.geminiTags, []) WHERE toLower(t) IN [${keywordsPattern}]]) > 0
        OR
        // Check for weapons
        size(coalesce(e.geminiWeapons, [])) > 0
        OR
        // Check for large gatherings
        coalesce(e.geminiPeopleCount, 0) >= $minPeople
      )
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
           e.geminiPeopleCount as geminiPeopleCount,
           e.geminiWeapons as geminiWeapons,
           e.geminiCaption as geminiCaption
  `;

    return runQuery<AnomalyEvent>(cypher, {
        startTimestamp,
        minPeople,
        offset,
        limit: config.batchSize,
    });
}

/**
 * Determine the type of anomaly for an event
 */
function detectAnomalyType(event: AnomalyEvent): string[] {
    const types: string[] = [];
    const tags = (event.geminiTags || []).map(t => t.toLowerCase());

    // Check for fire-related
    if (tags.some(t => ["fire", "smoke", "flames", "burning", "explosion", "blast"].includes(t))) {
        types.push("fire");
    }

    // Check for violence
    if (tags.some(t => ["fight", "fighting", "violence", "altercation", "assault", "attack"].includes(t))) {
        types.push("violence");
    }

    // Check for accidents
    if (tags.some(t => ["crash", "accident", "collision", "wreck", "overturn"].includes(t))) {
        types.push("accident");
    }

    // Check for weapons
    if ((event.geminiWeapons && event.geminiWeapons.length > 0) ||
        tags.some(t => ["weapon", "gun", "knife", "firearm", "armed"].includes(t))) {
        types.push("weapon");
    }

    // Check for gatherings
    if ((event.geminiPeopleCount && event.geminiPeopleCount >= 10) ||
        tags.some(t => ["crowd", "gathering", "protest", "riot", "mob"].includes(t))) {
        types.push("gathering");
    }

    // Check for emergency
    if (tags.some(t => ["emergency", "ambulance", "police", "rescue"].includes(t))) {
        types.push("emergency");
    }

    // Check for suspicious
    if (tags.some(t => ["suspicious", "unusual", "abnormal", "alert"].includes(t))) {
        types.push("suspicious");
    }

    return types.length > 0 ? types : ["unknown"];
}

/**
 * Calculate severity based on anomaly types
 */
function calculateSeverity(anomalyTypes: string[]): "critical" | "high" | "medium" {
    const criticalTypes = ["fire", "weapon", "violence"];
    const highTypes = ["accident", "emergency", "gathering"];

    if (anomalyTypes.some(t => criticalTypes.includes(t))) {
        return "critical";
    }
    if (anomalyTypes.some(t => highTypes.includes(t))) {
        return "high";
    }
    return "medium";
}

/**
 * Group events by region and time window
 */
function groupEventsByRegionAndTime(
    events: AnomalyEvent[],
    timeWindowMs: number
): AnomalyGroup[] {
    const groups: AnomalyGroup[] = [];

    // First, classify each event
    const classifiedEvents = events.map(e => ({
        ...e,
        anomalyType: detectAnomalyType(e).join(", "),
    }));

    // Group by region
    const byRegion = new Map<string, AnomalyEvent[]>();
    for (const event of classifiedEvents) {
        const region = event.region || "Unknown";
        if (!byRegion.has(region)) {
            byRegion.set(region, []);
        }
        byRegion.get(region)!.push(event);
    }

    // For each region, find time-window groups
    for (const [region, regionEvents] of byRegion.entries()) {
        // Sort by timestamp
        regionEvents.sort((a, b) => a.timestamp - b.timestamp);

        let currentGroup: AnomalyEvent[] = [];
        let groupStartTime = 0;

        for (const event of regionEvents) {
            if (currentGroup.length === 0) {
                currentGroup.push(event);
                groupStartTime = event.timestamp;
            } else if (event.timestamp - groupStartTime <= timeWindowMs) {
                // Within time window
                currentGroup.push(event);
            } else {
                // Start new group
                if (currentGroup.length > 0) {
                    const allTypes = [...new Set(currentGroup.flatMap(e => detectAnomalyType(e)))];
                    groups.push({
                        events: currentGroup,
                        region,
                        startTime: groupStartTime,
                        endTime: currentGroup[currentGroup.length - 1].timestamp,
                        anomalyTypes: allTypes,
                        severity: calculateSeverity(allTypes),
                    });
                }
                currentGroup = [event];
                groupStartTime = event.timestamp;
            }
        }

        // Don't forget the last group
        if (currentGroup.length > 0) {
            const allTypes = [...new Set(currentGroup.flatMap(e => detectAnomalyType(e)))];
            groups.push({
                events: currentGroup,
                region,
                startTime: groupStartTime,
                endTime: currentGroup[currentGroup.length - 1].timestamp,
                anomalyTypes: allTypes,
                severity: calculateSeverity(allTypes),
            });
        }
    }

    return groups;
}

/**
 * Generate executive summary for an anomaly group
 */
function generateExecutiveSummary(group: AnomalyGroup): string {
    const { events, region, anomalyTypes, severity, startTime, endTime } = group;

    const startDate = new Date(startTime).toLocaleString();
    const endDate = new Date(endTime).toLocaleString();
    const duration = (endTime - startTime) / 60000; // minutes

    const uniqueChannels = new Set(events.map(e => e.channelId)).size;
    const typeStr = anomalyTypes.join(", ");

    let summary = `${severity.toUpperCase()} ANOMALY: ${events.length} ${typeStr} events detected in ${region}. `;
    summary += `Time span: ${startDate} to ${endDate} (${duration.toFixed(0)} minutes). `;
    summary += `Observed across ${uniqueChannels} camera${uniqueChannels > 1 ? 's' : ''}. `;

    // Add specific details based on type
    if (anomalyTypes.includes("fire")) {
        summary += "Fire/smoke indicators present. ";
    }
    if (anomalyTypes.includes("weapon")) {
        const weaponEvents = events.filter(e => e.geminiWeapons && e.geminiWeapons.length > 0);
        if (weaponEvents.length > 0) {
            summary += `Weapons detected in ${weaponEvents.length} event(s). `;
        }
    }
    if (anomalyTypes.includes("gathering")) {
        const maxPeople = Math.max(...events.map(e => e.geminiPeopleCount || 0));
        summary += `Large gathering with up to ${maxPeople} people observed. `;
    }

    return summary;
}

/**
 * Process batch and find anomaly groups
 */
async function processBatch(
    context: AgentRunContext,
    events: AnomalyEvent[],
    batchIndex: number
): Promise<AnomalyGroup | null> {
    const { runId, config, runMode } = context;
    const minGroupSize = runMode === "cron" ? config.minGroupSizeCron : config.minGroupSizeContext;
    const anomalyConfig = config.config || getDefaultAnomalyConfig();
    const timeWindowMs = (anomalyConfig.timeWindowHours || 1) * 60 * 60 * 1000;

    await logAgentMessage(runId, "info", `Processing batch ${batchIndex + 1} with ${events.length} anomaly candidates`);

    // Group by region and time
    const groups = groupEventsByRegionAndTime(events, timeWindowMs);

    await logAgentMessage(runId, "debug", `Found ${groups.length} potential anomaly groups`);

    // Filter by minimum size
    const validGroups = groups.filter(g => g.events.length >= minGroupSize);

    if (validGroups.length === 0) {
        await logAgentMessage(runId, "debug", `No groups meet minimum size of ${minGroupSize}`);
        return null;
    }

    // Sort by severity (critical > high > medium), then by size
    validGroups.sort((a, b) => {
        const severityOrder = { critical: 0, high: 1, medium: 2 };
        const severityDiff = severityOrder[a.severity] - severityOrder[b.severity];
        if (severityDiff !== 0) return severityDiff;
        return b.events.length - a.events.length;
    });

    const bestGroup = validGroups[0];
    await logAgentMessage(runId, "info",
        `Selected ${bestGroup.severity} anomaly group: ${bestGroup.events.length} events in ${bestGroup.region}`
    );

    return bestGroup;
}

export default async function handler(
    req: VercelRequest,
    res: VercelResponse
): Promise<void> {
    // Verify authorization
    const authHeader = req.headers.authorization;
    const isVercelCron = authHeader === `Bearer ${process.env.CRON_SECRET}`;
    const isManualTrigger = req.query.manual === "true";

    if (!isVercelCron && !isManualTrigger && process.env.NODE_ENV === "production") {
        res.status(401).json({ error: "Unauthorized" });
        return;
    }

    const startTime = Date.now();
    const results: Record<string, any> = {
        timestamp: new Date().toISOString(),
        type: "cron_job",
        job: "agent-anomaly",
        manual: isManualTrigger,
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
            results.reason = "Gemini API not configured (needed for anomaly detection)";
            res.status(200).json(results);
            return;
        }

        // Get agent configuration
        const config = await getAgentConfig("anomaly");
        const anomalyConfig = config.config || getDefaultAnomalyConfig();
        results.config = {
            enabled: config.enabled,
            batchSize: config.batchSize,
            timeWindowHours: anomalyConfig.timeWindowHours,
            maxExecutionMs: config.maxExecutionMs,
        };

        // Check if agent is enabled (unless forced)
        if (!config.enabled && !isManualTrigger) {
            results.status = "skipped";
            results.reason = "Anomaly agent is disabled. Enable in settings or use ?manual=true";
            res.status(200).json(results);
            return;
        }

        // Create agent run
        const runMode = isManualTrigger ? "manual" : "cron";
        const context = await createAgentRun("anomaly", runMode, config);
        results.runId = context.runId;

        await logAgentMessage(context.runId, "info", `Anomaly agent started in ${runMode} mode`);

        // Process batches
        let bestAnomalyGroup: AnomalyGroup | null = null;
        let batchIndex = 0;
        let totalNodesProcessed = 0;
        let latestTimestamp = 0;

        while (!isTimeExceeded(context)) {
            const events = await fetchAnomalyEvents(context, batchIndex);

            if (events.length === 0) {
                await logAgentMessage(context.runId, "info", "No more anomaly candidates to process");
                break;
            }

            totalNodesProcessed += events.length;

            // Track latest timestamp for incremental processing
            const maxTimestamp = Math.max(...events.map(e => e.timestamp));
            if (maxTimestamp > latestTimestamp) {
                latestTimestamp = maxTimestamp;
            }

            const batchBest = await processBatch(context, events, batchIndex);

            if (batchBest) {
                // Prefer higher severity or larger groups
                if (!bestAnomalyGroup) {
                    bestAnomalyGroup = batchBest;
                } else {
                    const severityOrder = { critical: 0, high: 1, medium: 2 };
                    const currentSeverity = severityOrder[bestAnomalyGroup.severity];
                    const newSeverity = severityOrder[batchBest.severity];

                    if (newSeverity < currentSeverity ||
                        (newSeverity === currentSeverity && batchBest.events.length > bestAnomalyGroup.events.length)) {
                        bestAnomalyGroup = batchBest;
                    }
                }
            }

            batchIndex++;

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

        // If we found a valid anomaly group, check for duplicates and apply tags
        if (bestAnomalyGroup) {
            const nodeIds = bestAnomalyGroup.events.map(e => e.id);

            // Check for duplicate tagging
            const duplicateCheck = await checkDuplicateTagging("anomaly", nodeIds, config.overlapThreshold);

            if (duplicateCheck.isDuplicate) {
                await logAgentMessage(context.runId, "warn",
                    `Discarding anomaly group: ${duplicateCheck.existingCount} nodes already have anomaly tags`
                );

                await updateAgentRun(context.runId, {
                    status: "discarded",
                    nodesMatched: bestAnomalyGroup.events.length,
                    findings: {
                        reason: "duplicate_overlap",
                        existingCount: duplicateCheck.existingCount,
                        existingRunIds: duplicateCheck.existingRunIds,
                    },
                });

                results.status = "discarded";
                results.reason = `${duplicateCheck.existingCount} nodes already have anomaly tags (threshold: ${config.overlapThreshold})`;
                results.duration_ms = Date.now() - startTime;

                recordJobExecution("agent-anomaly", "skipped", results.duration_ms, results.reason);
                res.status(200).json(results);
                return;
            }

            // Apply tags
            const groupId = generateGroupId("anomaly");
            const taggedCount = await applyAgentTags("anomaly", groupId, nodeIds);

            const executiveSummary = generateExecutiveSummary(bestAnomalyGroup);

            await updateAgentRun(context.runId, {
                status: "completed",
                nodesMatched: bestAnomalyGroup.events.length,
                nodesTagged: taggedCount,
                groupId,
                groupSize: bestAnomalyGroup.events.length,
                executiveSummary,
                findings: {
                    anomaly: bestAnomalyGroup.events.map(e => ({
                        id: e.id,
                        timestamp: e.timestamp,
                        channelId: e.channelId,
                        region: e.region,
                        anomalyType: detectAnomalyType(e).join(", "),
                    })),
                    region: bestAnomalyGroup.region,
                    severity: bestAnomalyGroup.severity,
                    anomalyTypes: bestAnomalyGroup.anomalyTypes,
                    startTime: bestAnomalyGroup.startTime,
                    endTime: bestAnomalyGroup.endTime,
                },
            });

            // Update last processed timestamp for incremental scanning
            if (latestTimestamp > 0 && config.scanNewEventsOnly) {
                await updateLastProcessedTimestamp("anomaly", latestTimestamp);
            }

            await logAgentMessage(context.runId, "info",
                `Anomaly group discovered: ${groupId} - ${bestAnomalyGroup.severity} ${bestAnomalyGroup.anomalyTypes.join("/")} with ${bestAnomalyGroup.events.length} events`
            );

            results.status = "completed";
            results.groupId = groupId;
            results.anomalySize = bestAnomalyGroup.events.length;
            results.nodesTagged = taggedCount;
            results.severity = bestAnomalyGroup.severity;
            results.region = bestAnomalyGroup.region;
            results.anomalyTypes = bestAnomalyGroup.anomalyTypes;
            results.executiveSummary = executiveSummary;
        } else {
            await updateAgentRun(context.runId, {
                status: "completed",
                findings: { message: "No anomaly group meeting minimum size found" },
            });

            results.status = "completed";
            results.findings = "No anomaly detected meeting minimum requirements";
        }

        results.nodesProcessed = totalNodesProcessed;
        results.batchesCompleted = batchIndex;
        results.duration_ms = Date.now() - startTime;

        recordJobExecution(
            "agent-anomaly",
            bestAnomalyGroup ? "success" : "skipped",
            results.duration_ms,
            bestAnomalyGroup ? `Found ${bestAnomalyGroup.severity} anomaly with ${bestAnomalyGroup.events.length} events` : "No anomaly found"
        );

        res.status(200).json(results);

    } catch (error) {
        console.error("[Anomaly Agent] Error:", error);
        results.status = "error";
        results.error = error instanceof Error ? error.message : "Unknown error";
        results.duration_ms = Date.now() - startTime;

        recordJobExecution("agent-anomaly", "error", results.duration_ms, results.error);
        res.status(500).json(results);
    }
}
