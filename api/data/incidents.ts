import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getIncidentsList, getDb } from "../lib/db.js";

/**
 * API endpoint to retrieve incidents from the database
 * Returns real incident data from the incidents table
 */

interface IncidentData {
  id: string;
  type: string;
  priority: string;
  status: string;
  location: string;
  region: string;
  description: string;
  assignedOfficer: string;
  assignedUnit: string;
  responseTime: number;
  createdAt: string;
  videoUrl: string;
  hasVideo: boolean;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Set CORS headers
  res.setHeader("Access-Control-Allow-Origin", req.headers.origin || "*");
  res.setHeader("Access-Control-Allow-Credentials", "true");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    // Check if database is available
    const db = await getDb();
    if (!db) {
      return res.status(200).json({
        success: true,
        count: 0,
        incidents: [],
        message: "Database not configured. No incident data available.",
        dbConnected: false,
      });
    }

    // Parse query parameters
    const status = req.query.status as string;
    const priority = req.query.priority as string;
    const region = req.query.region as string;
    const limit = parseInt(req.query.limit as string) || 100;

    // Query real incidents from database
    const incidentRecords = await getIncidentsList({
      status: status && status !== "all" ? status : undefined,
      priority: priority && priority !== "all" ? priority : undefined,
      region: region && region !== "all" ? region : undefined,
      limit,
    });

    // Transform database records to incident format
    const incidents: IncidentData[] = incidentRecords.map((record: any) => ({
      id: record.id,
      type: record.incidentType || "Unknown",
      priority: record.priority || "medium",
      status: record.status || "open",
      location: record.location || `${record.region}, Peru`,
      region: record.region || "Unknown",
      description: record.description || "No description available",
      assignedOfficer: record.assignedOfficer || "Unassigned",
      assignedUnit: record.assignedUnit || "Unassigned",
      responseTime: record.responseTime || 0,
      createdAt: record.createdAt || new Date().toISOString(),
      videoUrl: record.videoUrl || "",
      hasVideo: !!record.videoUrl,
    }));

    return res.status(200).json({
      success: true,
      count: incidents.length,
      incidents,
      dbConnected: true,
    });

  } catch (error: any) {
    console.error("[Incidents API] Error:", error);
    return res.status(500).json({
      success: false,
      error: error.message || "Internal server error",
      incidents: [],
    });
  }
}

