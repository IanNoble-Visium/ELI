/**
 * Agent Configuration API
 * 
 * GET: Retrieve configuration for all agents or a specific agent
 * POST: Update configuration for a specific agent
 * 
 * Query params:
 * - agentType: 'timeline' | 'correlation' | 'anomaly' (optional, returns all if not specified)
 */
import type { VercelRequest, VercelResponse } from "@vercel/node";
import {
    getAgentConfig,
    updateAgentConfig,
    type AgentType,
    type AgentConfigData,
} from "../lib/agent-base.js";

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
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");

    if (req.method === "OPTIONS") {
        res.status(200).end();
        return;
    }

    try {
        if (req.method === "GET") {
            const { agentType } = req.query;

            // If specific agent type requested
            if (agentType && typeof agentType === "string") {
                if (!isValidAgentType(agentType)) {
                    res.status(400).json({
                        error: `Invalid agent type. Must be one of: ${VALID_AGENT_TYPES.join(", ")}`,
                    });
                    return;
                }

                const config = await getAgentConfig(agentType);
                res.status(200).json({
                    agentType,
                    config,
                });
                return;
            }

            // Return all agent configurations
            const allConfigs: Record<AgentType, AgentConfigData> = {
                timeline: await getAgentConfig("timeline"),
                correlation: await getAgentConfig("correlation"),
                anomaly: await getAgentConfig("anomaly"),
            };

            res.status(200).json({
                configs: allConfigs,
                validAgentTypes: VALID_AGENT_TYPES,
            });
            return;
        }

        if (req.method === "POST") {
            const { agentType, ...updates } = req.body;

            if (!agentType || !isValidAgentType(agentType)) {
                res.status(400).json({
                    error: `agentType is required and must be one of: ${VALID_AGENT_TYPES.join(", ")}`,
                });
                return;
            }

            // Validate update fields
            const allowedFields = [
                "enabled",
                "batchSize",
                "confidenceThreshold",
                "minGroupSizeCron",
                "minGroupSizeContext",
                "maxExecutionMs",
                "overlapThreshold",
                "scanNewEventsOnly",
                "config",
            ];

            const validUpdates: Partial<AgentConfigData> = {};
            for (const field of allowedFields) {
                if (field in updates) {
                    (validUpdates as any)[field] = updates[field];
                }
            }

            if (Object.keys(validUpdates).length === 0) {
                res.status(400).json({
                    error: "No valid fields to update",
                    allowedFields,
                });
                return;
            }

            await updateAgentConfig(agentType, validUpdates);

            // Return updated config
            const updatedConfig = await getAgentConfig(agentType);

            res.status(200).json({
                success: true,
                agentType,
                config: updatedConfig,
            });
            return;
        }

        res.status(405).json({ error: "Method not allowed" });
    } catch (error) {
        console.error("[Agent Config API] Error:", error);
        res.status(500).json({
            error: error instanceof Error ? error.message : "Internal server error",
        });
    }
}
