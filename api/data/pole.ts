import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getDb, events, desc } from "../lib/db.js";
import { inArray } from "drizzle-orm";
import {
  matchPlateNumber,
  getPersonById,
  getObjectById,
  getIncidentById,
  getOpenIncidentsForRegion,
  type POLEMatch,
} from "../lib/poleData.js";

/**
 * API endpoint to fetch POLE intelligence data
 * 
 * Endpoints:
 * - GET /api/data/pole - Get all POLE entities and relationships
 * - GET /api/data/pole?plate=ABC-123 - Match a plate number to POLE entities
 * - GET /api/data/pole?personId=P-001 - Get person details
 * - GET /api/data/pole?objectId=O-001 - Get object details
 * - GET /api/data/pole?incidentId=INC-2024-001 - Get incident details
 * - GET /api/data/pole?region=Lima - Get open incidents for a region
 * - GET /api/data/pole?linkedEvents=true - Get events with POLE associations
 */

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
    const { plate, personId, objectId, incidentId, region, linkedEvents } = req.query;

    // Match plate number to POLE entities
    if (plate && typeof plate === "string") {
      const match = matchPlateNumber(plate);
      
      if (match.matchType === "none") {
        return res.status(200).json({
          success: true,
          match: null,
          message: `No POLE entities found for plate: ${plate}`,
        });
      }

      return res.status(200).json({
        success: true,
        match: {
          plateNumber: plate,
          ...match,
          person: match.personId ? getPersonById(match.personId) : null,
          object: match.objectId ? getObjectById(match.objectId) : null,
          incidents: match.incidentIds.map(id => getIncidentById(id)).filter(Boolean),
        },
      });
    }

    // Get person details
    if (personId && typeof personId === "string") {
      const person = getPersonById(personId);
      if (!person) {
        return res.status(404).json({
          success: false,
          error: `Person not found: ${personId}`,
        });
      }
      return res.status(200).json({
        success: true,
        person,
      });
    }

    // Get object details
    if (objectId && typeof objectId === "string") {
      const object = getObjectById(objectId);
      if (!object) {
        return res.status(404).json({
          success: false,
          error: `Object not found: ${objectId}`,
        });
      }
      return res.status(200).json({
        success: true,
        object,
      });
    }

    // Get incident details
    if (incidentId && typeof incidentId === "string") {
      const incident = getIncidentById(incidentId);
      if (!incident) {
        return res.status(404).json({
          success: false,
          error: `Incident not found: ${incidentId}`,
        });
      }
      return res.status(200).json({
        success: true,
        incident,
      });
    }

    // Get open incidents for a region
    if (region && typeof region === "string") {
      const incidents = getOpenIncidentsForRegion(region);
      return res.status(200).json({
        success: true,
        region,
        incidents,
        count: incidents.length,
      });
    }

    // Get events with POLE associations from database
    if (linkedEvents === "true") {
      const db = await getDb();
      if (!db) {
        return res.status(200).json({
          success: true,
          events: [],
          message: "Database not configured",
          dbConnected: false,
        });
      }

      // Query events that have POLE-related topics
      const poleTopics = [
        "PlateMatched",
        "PlateRecognized",
        "FaceMatched",
        "FaceRecognized",
        "PersonIdentified",
        "VehicleDetected",
      ];

      try {
        const result = await db
          .select()
          .from(events)
          .where(inArray(events.topic, poleTopics))
          .orderBy(desc(events.createdAt))
          .limit(100);

        const eventsList = result.map((row) => {
          // Try to extract plate/face from params and match to POLE
          let poleMatch: POLEMatch | null = null;
          if (row.params) {
            const params = typeof row.params === "string" ? JSON.parse(row.params) : row.params;
            
            // Try plate matching
            const plateFields = ["plate", "plateNumber", "plate_number", "licensePlate"];
            for (const field of plateFields) {
              if (params[field]) {
                poleMatch = matchPlateNumber(params[field]);
                if (poleMatch.matchType !== "none") break;
              }
            }
          }

          return {
            id: row.id,
            eventId: row.eventId,
            topic: row.topic,
            channelId: row.channelId,
            channelName: row.channelName,
            startTime: row.startTime,
            createdAt: row.createdAt,
            poleMatch: poleMatch?.matchType !== "none" ? poleMatch : null,
          };
        });

        return res.status(200).json({
          success: true,
          events: eventsList,
          count: eventsList.length,
          dbConnected: true,
        });
      } catch (dbError: any) {
        console.error("[POLE API] Database query error:", dbError);
        return res.status(200).json({
          success: true,
          events: [],
          message: "Database query failed",
          error: dbError.message,
        });
      }
    }

    // Default: Return summary of POLE data availability
    return res.status(200).json({
      success: true,
      message: "POLE Intelligence API",
      endpoints: {
        "?plate=ABC-123": "Match plate number to POLE entities",
        "?personId=P-001": "Get person details",
        "?objectId=O-001": "Get object details",
        "?incidentId=INC-2024-001": "Get incident details",
        "?region=Lima": "Get open incidents for region",
        "?linkedEvents=true": "Get events with POLE associations",
      },
      stats: {
        trackedPlates: 8,
        persons: 6,
        objects: 6,
        incidents: 5,
      },
    });

  } catch (error: any) {
    console.error("[POLE API] Error:", error);
    return res.status(500).json({
      success: false,
      error: error.message || "Internal server error",
    });
  }
}
