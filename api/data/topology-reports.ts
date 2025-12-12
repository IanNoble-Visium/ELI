import type { VercelRequest, VercelResponse } from "@vercel/node";
import { nanoid } from "nanoid";
import { jwtVerify } from "jose";

import { invokeLLM } from "../../server/_core/llm.js";
import {
  getDb,
  topologyReports,
  desc,
  eq,
  and,
} from "../lib/db.js";
import {
  getTopologyReportContextFromNeo4j,
  setTopologyFlaggedReportId,
} from "./topology-neo4j.js";

const COOKIE_NAME = "eli_session";
const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || "eli-dashboard-dev-secret-change-in-production-2024"
);

function parseCookies(str: string): Record<string, string | undefined> {
  const result: Record<string, string | undefined> = {};
  if (!str) return result;
  for (const pair of str.split(";")) {
    const idx = pair.indexOf("=");
    if (idx < 0) continue;
    const key = pair.substring(0, idx).trim();
    let val = pair.substring(idx + 1).trim();
    if (val.startsWith('"') && val.endsWith('"')) {
      val = val.slice(1, -1);
    }
    try {
      result[key] = decodeURIComponent(val);
    } catch {
      result[key] = val;
    }
  }
  return result;
}

async function getUserFromRequest(req: VercelRequest): Promise<{ id?: string; openId?: string; name?: string } | null> {
  const cookieHeader = req.headers.cookie || "";
  const cookies = parseCookies(cookieHeader);
  const token = cookies[COOKIE_NAME];
  if (!token) return null;

  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);
    return {
      id: typeof payload.userId === "string" ? payload.userId : undefined,
      openId: typeof payload.openId === "string" ? payload.openId : undefined,
      name: typeof payload.name === "string" ? payload.name : undefined,
    };
  } catch {
    return null;
  }
}

function extractTextContent(content: any): string {
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return content
      .map((p) => {
        if (typeof p === "string") return p;
        if (p && typeof p === "object" && p.type === "text" && typeof p.text === "string") return p.text;
        return "";
      })
      .join("\n")
      .trim();
  }
  return "";
}

function csvEscape(value: unknown): string {
  const str = value == null ? "" : String(value);
  if (/[\n\r\",]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

async function getReportById(db: any, reportId: string) {
  const [report] = await db
    .select()
    .from(topologyReports)
    .where(eq(topologyReports.id, reportId))
    .limit(1);
  return report || null;
}

function buildShareUrl(req: VercelRequest, shareToken: string | null | undefined) {
  if (!shareToken) return null;
  const origin = req.headers.origin || (req.headers.host ? `https://${req.headers.host}` : "");
  if (!origin) return null;
  return `${origin}/share/report/${shareToken}`;
}

function buildReportPrompt(context: {
  nodes: Array<{ id: string; labels: string[]; properties: Record<string, any> }>;
  edges: Array<{ id: string; type: string; source: string; target: string; properties: Record<string, any> }>;
}): string {
  return `You are an executive analyst reviewing a graph selection from a security/topology system.

You are given:
- Selected nodes (with all available properties)
- Selected edges connecting those nodes (with all available properties)

Your task: produce a report in Markdown with the following sections:

# Executive Summary
Provide a concise high-level overview.

# What Is Occurring (Step-by-step)
Explain the sequence/relationships you infer from the graph.

# Timeframes & Temporal Patterns
Identify timestamps, ordering, periodicity, bursts, gaps, correlations.

# Notable Observations
Call out points of interest, key entities, and unusual combinations.

# Risks / Anomalies
Highlight risk factors, anomalies, missing information, or suspicious patterns.

# Potential Next Steps / Predicted Outcomes
Suggest next investigative steps or likely outcomes.

Constraints:
- Use ONLY the provided data. If a detail is unknown, explicitly say it's unknown.
- If properties include timestamps, interpret them (e.g., epoch ms) when possible.

Data (JSON):
${JSON.stringify(context, null, 2)}
`;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader("Access-Control-Allow-Origin", req.headers.origin || "*");
  res.setHeader("Access-Control-Allow-Credentials", "true");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  const db = await getDb();
  if (!db) {
    return res.status(200).json({
      success: true,
      reports: [],
      count: 0,
      message: "Database not configured. No reports available.",
      dbConnected: false,
    });
  }

  if (req.method === "GET") {
    try {
      const id = (req.query.id as string) || "";
      const shareToken = (req.query.shareToken as string) || "";
      const format = (req.query.format as string) || "";

      if (id || shareToken) {
        const where = id ? eq(topologyReports.id, id) : eq(topologyReports.shareToken, shareToken);
        const [report] = await db.select().from(topologyReports).where(where).limit(1);

        if (!report) {
          return res.status(404).json({ success: false, error: "Report not found" });
        }

        if (format === "json") {
          res.setHeader("Content-Type", "application/json");
          res.setHeader("Content-Disposition", `attachment; filename=${report.id}.json`);
          return res.status(200).send(JSON.stringify(report, null, 2));
        }

        if (format === "csv") {
          const csv = [
            ["report_id", report.id],
            ["created_at", report.createdAt],
            ["created_by", report.createdByUserName || report.createdByUserId || ""],
            ["node_count", report.nodeCount],
            ["edge_count", report.edgeCount],
            ["flagged", report.flagged],
            ["title", report.title || ""],
          ]
            .map((row) => `${csvEscape(row[0])},${csvEscape(row[1])}`)
            .join("\n");

          res.setHeader("Content-Type", "text/csv");
          res.setHeader("Content-Disposition", `attachment; filename=${report.id}.csv`);
          return res.status(200).send(csv);
        }

        return res.status(200).json({ success: true, report });
      }

      const limit = Math.min(200, Number.parseInt((req.query.limit as string) || "50", 10));
      const flagged = (req.query.flagged as string) || "";

      const conditions = [] as any[];
      if (flagged === "true") conditions.push(eq(topologyReports.flagged, true));
      if (flagged === "false") conditions.push(eq(topologyReports.flagged, false));

      const reports = conditions.length
        ? await db.select().from(topologyReports).where(and(...conditions)).orderBy(desc(topologyReports.createdAt)).limit(limit)
        : await db.select().from(topologyReports).orderBy(desc(topologyReports.createdAt)).limit(limit);

      return res.status(200).json({
        success: true,
        reports,
        count: reports.length,
        dbConnected: true,
      });
    } catch (error: any) {
      console.error("[Topology Reports API] GET error:", error);
      return res.status(500).json({
        success: false,
        error: error.message || "Internal server error",
      });
    }
  }

  if (req.method === "POST") {
    try {
      const url = new URL(req.url || "", `https://${req.headers.host}`);
      const action = (url.searchParams.get("action") || "").toLowerCase();
      const body = typeof req.body === "string" ? JSON.parse(req.body) : (req.body || {});

      const user = await getUserFromRequest(req);

      if (action === "flag") {
        const reportId = String(body.reportId || "");
        const nodeIds = Array.isArray(body.nodeIds) ? body.nodeIds.map(String) : [];
        const edgeIds = Array.isArray(body.edgeIds) ? body.edgeIds.map(String) : [];

        if (!reportId) {
          return res.status(400).json({ success: false, error: "Missing reportId" });
        }

        await setTopologyFlaggedReportId({ reportId, nodeIds, edgeIds });

        await db
          .update(topologyReports)
          .set({ flagged: true, flaggedAt: new Date().toISOString() })
          .where(eq(topologyReports.id, reportId));

        return res.status(200).json({ success: true, reportId });
      }

      if (action === "share") {
        const reportId = String(body.reportId || "");
        if (!reportId) {
          return res.status(400).json({ success: false, error: "Missing reportId" });
        }

        const token = nanoid(24);
        await db
          .update(topologyReports)
          .set({ shareToken: token })
          .where(eq(topologyReports.id, reportId));

        return res.status(200).json({ success: true, reportId, shareToken: token });
      }

      if (action === "slack") {
        const reportId = String(body.reportId || "");
        if (!reportId) {
          return res.status(400).json({ success: false, error: "Missing reportId" });
        }

        const webhookUrl = process.env.SLACK_WEBHOOK_URL;
        if (!webhookUrl) {
          return res.status(400).json({
            success: false,
            error: "SLACK_WEBHOOK_URL is not configured",
          });
        }

        const report = await getReportById(db, reportId);
        if (!report) {
          return res.status(404).json({ success: false, error: "Report not found" });
        }

        const shareUrl = buildShareUrl(req, report.shareToken);
        const header = `*${report.title || report.id}*`;
        const meta = `Nodes: ${report.nodeCount} • Edges: ${report.edgeCount} • Status: ${report.flagged ? "Flagged" : "Unflagged"}`;
        const linkLine = shareUrl ? `Link: ${shareUrl}` : "";
        const note = typeof body.message === "string" ? body.message : "";

        const text = [header, meta, linkLine, note].filter(Boolean).join("\n");

        const slackResp = await fetch(webhookUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text }),
        });

        if (!slackResp.ok) {
          const errText = await slackResp.text();
          return res.status(500).json({
            success: false,
            error: `Slack webhook error ${slackResp.status}: ${errText}`,
          });
        }

        return res.status(200).json({ success: true, reportId });
      }

      if (action === "email") {
        const reportId = String(body.reportId || "");
        if (!reportId) {
          return res.status(400).json({ success: false, error: "Missing reportId" });
        }

        const from = process.env.EMAIL_FROM;
        if (!from) {
          return res.status(400).json({
            success: false,
            error: "EMAIL_FROM is not configured (email provider integration not set up)",
          });
        }

        return res.status(501).json({
          success: false,
          error: "Email sending is not implemented for this deployment yet",
        });
      }

      // Default action: generate a new report
      const nodeIds = Array.isArray(body.nodeIds) ? body.nodeIds.map(String) : [];
      const edgeIds = Array.isArray(body.edgeIds) ? body.edgeIds.map(String) : [];
      const title = typeof body.title === "string" ? body.title : undefined;

      if (!Array.isArray(nodeIds) || nodeIds.length === 0) {
        return res.status(400).json({ success: false, error: "nodeIds is required" });
      }

      const context = await getTopologyReportContextFromNeo4j({ nodeIds, edgeIds });

      const prompt = buildReportPrompt(context);
      const result = await invokeLLM({
        messages: [
          { role: "system", content: "You produce executive-grade security analysis reports." },
          { role: "user", content: prompt },
        ],
      });

      const content = extractTextContent(result.choices?.[0]?.message?.content);
      if (!content) {
        return res.status(500).json({
          success: false,
          error: "AI analysis returned no content",
        });
      }

      const reportId = `rpt_${Date.now()}_${nanoid(10)}`;

      const insert = {
        id: reportId,
        title: title || `Topology Report (${context.nodes.length} nodes, ${context.edges.length} edges)`,
        content,
        createdByUserId: user?.id || user?.openId || null,
        createdByUserName: user?.name || null,
        nodeIds,
        edgeIds: edgeIds.length > 0 ? edgeIds : context.edges.map((e) => e.id),
        nodeCount: context.nodes.length,
        edgeCount: context.edges.length,
        flagged: false,
        metadata: {
          nodes: context.nodes,
          edges: context.edges,
          llm: {
            model: result.model,
            usage: result.usage || null,
          },
        },
      } as any;

      await db.insert(topologyReports).values(insert);

      return res.status(200).json({
        success: true,
        reportId,
        report: insert,
      });
    } catch (error: any) {
      console.error("[Topology Reports API] POST error:", error);
      return res.status(500).json({
        success: false,
        error: error.message || "Internal server error",
      });
    }
  }

  return res.status(405).json({ success: false, error: "Method not allowed" });
}
