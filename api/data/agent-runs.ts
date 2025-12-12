/**
 * Agent Runs API
 * 
 * GET: Retrieve agent run history
 * - Query params: agentType, status, limit
 * 
 * GET with runId: Get specific run details with logs
 */
import type { VercelRequest, VercelResponse } from "@vercel/node";
import {
    getRecentRuns,
    getRunLogs,
    type AgentType,
} from "../lib/agent-base.js";
import { getDb, agentRuns, eq, and, desc } from "../lib/db.js";

const VALID_AGENT_TYPES: AgentType[] = ["timeline", "correlation", "anomaly"];

function isValidAgentType(type: string): type is AgentType {
    return VALID_AGENT_TYPES.includes(type as AgentType);
}

export default async function handler(
    req: VercelRequest,
    res: VercelResponse
): Promise<void> {
    // CORS headers
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");

    if (req.method === "OPTIONS") {
        res.status(200).end();
        return;
    }

    if (req.method !== "GET") {
        res.status(405).json({ error: "Method not allowed" });
        return;
    }

    try {
        const { agentType, runId, status, limit = "20", includeLogs } = req.query;

        // If runId is provided, get specific run with logs
        if (runId && typeof runId === "string") {
            const db = await getDb();
            if (!db) {
                res.status(503).json({ error: "Database not available" });
                return;
            }

            const [run] = await db
                .select()
                .from(agentRuns)
                .where(eq(agentRuns.id, runId))
                .limit(1);

            if (!run) {
                res.status(404).json({ error: "Run not found" });
                return;
            }

            // Get logs if requested
            let logs: any[] = [];
            if (includeLogs === "true") {
                logs = await getRunLogs(runId);
            }

            res.status(200).json({
                run,
                logs,
            });
            return;
        }

        // List runs with optional filtering
        const parsedLimit = Math.min(parseInt(limit as string, 10) || 20, 100);

        if (agentType && typeof agentType === "string") {
            if (!isValidAgentType(agentType)) {
                res.status(400).json({
                    error: `Invalid agent type. Must be one of: ${VALID_AGENT_TYPES.join(", ")}`,
                });
                return;
            }

            const runs = await getRecentRuns(agentType, parsedLimit);

            res.status(200).json({
                agentType,
                runs,
                total: runs.length,
            });
            return;
        }

        // Get runs for all agent types
        const db = await getDb();
        if (!db) {
            res.status(503).json({ error: "Database not available" });
            return;
        }

        let query = db.select().from(agentRuns);

        // Filter by status if provided
        if (status && typeof status === "string") {
            query = query.where(eq(agentRuns.status, status as any)) as any;
        }

        const runs = await query
            .orderBy(desc(agentRuns.startedAt))
            .limit(parsedLimit);

        // Group by agent type
        const runsByType: Record<AgentType, typeof runs> = {
            timeline: [],
            correlation: [],
            anomaly: [],
        };

        runs.forEach((run) => {
            if (run.agentType in runsByType) {
                runsByType[run.agentType as AgentType].push(run);
            }
        });

        // Calculate stats
        const stats = {
            total: runs.length,
            byType: {
                timeline: runsByType.timeline.length,
                correlation: runsByType.correlation.length,
                anomaly: runsByType.anomaly.length,
            },
            byStatus: {
                running: runs.filter((r) => r.status === "running").length,
                completed: runs.filter((r) => r.status === "completed").length,
                failed: runs.filter((r) => r.status === "failed").length,
                discarded: runs.filter((r) => r.status === "discarded").length,
            },
        };

        res.status(200).json({
            runs,
            runsByType,
            stats,
        });
    } catch (error) {
        console.error("[Agent Runs API] Error:", error);
        res.status(500).json({
            error: error instanceof Error ? error.message : "Internal server error",
        });
    }
}
