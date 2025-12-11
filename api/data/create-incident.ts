import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getDb, sql } from "../lib/db.js";
import { pgTable, varchar, text, jsonb, timestamp, doublePrecision, integer } from "drizzle-orm/pg-core";

// Incidents table definition - must match drizzle/schema.ts exactly (camelCase columns)
const incidents = pgTable("incidents", {
    id: varchar({ length: 255 }).primaryKey().notNull(),
    incidentType: varchar({ length: 100 }).notNull(),
    priority: varchar({ length: 50 }).notNull(),
    status: varchar({ length: 50 }).default('open').notNull(),
    location: varchar({ length: 500 }),
    region: varchar({ length: 100 }),
    latitude: doublePrecision(),
    longitude: doublePrecision(),
    description: text(),
    videoUrl: text(),
    assignedOfficer: varchar({ length: 255 }),
    assignedUnit: varchar({ length: 255 }),
    responseTime: integer(),
    eventIds: jsonb(),
    metadata: jsonb(),
    createdAt: timestamp({ mode: 'string' }).defaultNow().notNull(),
    updatedAt: timestamp({ mode: 'string' }).defaultNow().notNull(),
});

// Crime story templates based on node type
const CRIME_STORIES: Record<string, { types: string[]; descriptions: string[]; details: string[] }> = {
    camera: {
        types: [
            "Suspicious Activity",
            "Surveillance Alert",
            "Loitering Detection",
            "Unauthorized Access",
            "Perimeter Breach",
        ],
        descriptions: [
            "Camera detected suspicious individual conducting reconnaissance of the area. Subject observed photographing security measures and entry points.",
            "Surveillance footage shows unauthorized vehicle parked for extended period. Driver observed conducting counter-surveillance activities.",
            "Multiple individuals detected loitering near restricted area. Behavior suggests possible coordinated activity.",
            "Thermal imaging detected human presence in secured zone after hours. Motion patterns indicate deliberate evasion of detection.",
            "Camera captured individual attempting to disable security equipment. Subject fled upon detection.",
        ],
        details: [
            "Intelligence suggests this may be connected to recent wave of commercial burglaries in the district.",
            "Facial recognition flagged subject as person of interest in ongoing narcotics investigation.",
            "Vehicle registration traces to known criminal organization operating in the region.",
            "Incident occurred during known shift change - possible inside information.",
            "Pattern analysis links this to 3 similar incidents in the past 30 days.",
        ],
    },
    person: {
        types: [
            "Person of Interest",
            "Suspect Identification",
            "Witness Located",
            "Missing Person Alert",
            "Wanted Individual",
        ],
        descriptions: [
            "Subject identified as key figure in organized crime network. Known associates include members of transnational trafficking ring.",
            "Individual matched to composite sketch from armed robbery. Victim positively identified subject from photo lineup.",
            "Witness to major narcotics operation located. Subject has agreed to provide testimony in exchange for protection.",
            "High-profile missing person case - subject last seen in this area. Family reports subject was being followed recently.",
            "Wanted fugitive spotted in surveillance footage. Subject has outstanding warrants for fraud, money laundering, and assault.",
        ],
        details: [
            "Subject has known connections to corrupt officials - approach with caution and maintain operational security.",
            "DNA evidence collected at scene matches subject - forensic analysis pending confirmation.",
            "Informant reports subject is planning to flee the country within 48 hours.",
            "Subject may be armed - previous arrest record includes weapons charges.",
            "Financial analysis reveals suspicious transactions totaling over $2 million USD.",
        ],
    },
    vehicle: {
        types: [
            "Vehicle Alert",
            "Plate Recognition Match",
            "Stolen Vehicle",
            "Drug Transport Suspected",
            "Pursuit in Progress",
        ],
        descriptions: [
            "License plate recognized as flagged vehicle in INTERPOL database. Vehicle linked to cross-border smuggling operation.",
            "Stolen vehicle detected - reported stolen 72 hours ago from high-security compound. Inside job suspected.",
            "Vehicle matches description of transport used in recent kidnapping. Witnesses report armed occupants.",
            "Thermal scan indicates concealed compartment modifications consistent with drug trafficking.",
            "High-speed pursuit terminated - vehicle abandoned. Forensic team recovering evidence including weapons and cash.",
        ],
        details: [
            "Vehicle registered to shell company with links to known cartel figures.",
            "GPS tracking shows pattern of trips to remote locations near border.",
            "Previous owner reported vehicle sold under duress - possible extortion case.",
            "Canine unit detected trace narcotics during traffic stop.",
            "Ballistics match vehicle to drive-by shooting incident last month.",
        ],
    },
    location: {
        types: [
            "Location Alert",
            "Crime Scene",
            "Safe House Identified",
            "Drop Point Detection",
            "Suspicious Premises",
        ],
        descriptions: [
            "Location identified as meeting point for criminal network. Surveillance shows regular gatherings of known suspects.",
            "Crime scene established - evidence of significant criminal activity recovered including weapons cache.",
            "Intel confirms location is safe house for trafficking victims. Immediate intervention recommended.",
            "Analysis indicates location is dead drop for classified information. Foreign intelligence service suspected.",
            "Business front suspected of money laundering - cash transactions exceed reported revenue by 1000%.",
        ],
        details: [
            "Undercover operation has this location under 24/7 surveillance.",
            "Property records trace to offshore holdings with no beneficial owner disclosed.",
            "Thermal imaging shows underground modifications not in building permits.",
            "Communication intercepts reference this location using known code words.",
            "Former employee provided detailed floor plans and security protocols.",
        ],
    },
    event: {
        types: [
            "Security Event",
            "Crime in Progress",
            "Post-Incident Report",
            "Intelligence Alert",
            "Emergency Response",
        ],
        descriptions: [
            "Active incident detected - multiple subjects engaged in coordinated criminal activity. Units responding.",
            "Explosion reported at location - preliminary assessment indicates deliberate act. Mass casualty event possible.",
            "Armed robbery completed - suspects fled with significant assets. Pursuit underway by multiple units.",
            "Cyber attack detected on critical infrastructure. Physical security may be compromised.",
            "Hostage situation developing - armed subject has barricaded with multiple civilians.",
        ],
        details: [
            "Incident matches modus operandi of known terrorist cell.",
            "Forensic evidence suggests professional operatives with military training.",
            "Ransom demand received - cryptocurrency payment requested.",
            "Attack timing coincides with major political event - possible connection.",
            "Intercepted communications indicate more attacks planned.",
        ],
    },
    region: {
        types: [
            "Regional Alert",
            "Multi-jurisdictional Crime",
            "Border Security Alert",
            "Gang Activity",
            "Cartel Operation",
        ],
        descriptions: [
            "Region experiencing surge in organized crime activity. Multiple police districts affected.",
            "Cross-jurisdictional criminal enterprise identified. Coordination between agencies initiated.",
            "Border crossing activity increased by 300%. Suspected human trafficking operation.",
            "Gang territorial conflict escalating. Multiple shootings reported in past 48 hours.",
            "Cartel has established presence in region. Local businesses reporting extortion demands.",
        ],
        details: [
            "Intelligence indicates new leadership in regional crime network.",
            "Federal agencies requesting support for major operation planned this week.",
            "Community sources report unusual movement of weapons and personnel.",
            "Local officials may be compromised - internal investigation underway.",
            "Regional governor requesting emergency security measures.",
        ],
    },
};

// Officers for assignment
const OFFICERS = [
    { name: "Cap. María Elena Huamaní", unit: "DIRANDRO-LIMA", rank: "Captain" },
    { name: "Cmdr. José Luis Quispe", unit: "DINOES-CUSCO", rank: "Commander" },
    { name: "Lt. Carlos Alberto Mendoza", unit: "DIVINCRI-LIMA", rank: "Lieutenant" },
    { name: "Sgt. Ana Patricia Torres", unit: "SERENAZGO-MIRAFLORES", rank: "Sergeant" },
    { name: "Insp. Roberto Carlos Vargas", unit: "PNP-AREQUIPA", rank: "Inspector" },
    { name: "Cap. Luis Fernando Castillo", unit: "UDEX-CALLAO", rank: "Captain" },
    { name: "Cmdr. Elena Sofía Rojas", unit: "DIRCOTE-NACIONAL", rank: "Commander" },
];

// Generate a unique incident ID
function generateIncidentId(): string {
    const prefix = "INC";
    const date = new Date();
    const dateStr = `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, '0')}${String(date.getDate()).padStart(2, '0')}`;
    const random = Math.random().toString(36).substring(2, 8).toUpperCase();
    return `${prefix}-${dateStr}-${random}`;
}

// Get random item from array
function randomItem<T>(arr: T[]): T {
    return arr[Math.floor(Math.random() * arr.length)];
}

// Generate incident data based on node type
function generateIncidentData(nodeType: string, nodeName: string, nodeId: string, region?: string, location?: string) {
    const stories = CRIME_STORIES[nodeType] || CRIME_STORIES.event;
    const officer = randomItem(OFFICERS);

    const incidentType = randomItem(stories.types);
    const description = randomItem(stories.descriptions);
    const detail = randomItem(stories.details);

    // Parse coordinates if provided
    let latitude: number | null = null;
    let longitude: number | null = null;
    if (location) {
        const [lat, lng] = location.split(',').map(s => parseFloat(s.trim()));
        if (!isNaN(lat) && !isNaN(lng)) {
            latitude = lat;
            longitude = lng;
        }
    }

    // Generate random response time in minutes (integer)
    const responseTime = Math.floor(Math.random() * 15) + 3;
    const now = new Date().toISOString();

    return {
        id: generateIncidentId(),
        incidentType,
        priority: Math.random() > 0.3 ? "high" : Math.random() > 0.5 ? "critical" : "medium",
        status: "open",
        location: location || `Near ${nodeName}`,
        region: region || "Lima",
        latitude,
        longitude,
        description: `**Source:** ${nodeName} (${nodeType})\n**Node ID:** ${nodeId}\n\n${description}\n\n**Investigation Notes:**\n${detail}`,
        assignedOfficer: officer.name,
        assignedUnit: officer.unit,
        responseTime,
        videoUrl: null,
        eventIds: [nodeId],
        metadata: { sourceType: nodeType, sourceName: nodeName, sourceId: nodeId },
        createdAt: now,
        updatedAt: now,
    };
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
    // CORS headers
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");

    if (req.method === "OPTIONS") {
        return res.status(200).end();
    }

    if (req.method !== "POST") {
        return res.status(405).json({ success: false, error: "Method not allowed" });
    }

    try {
        const db = await getDb();
        if (!db) {
            return res.status(500).json({
                success: false,
                error: "Database not connected",
            });
        }

        const { nodeId, nodeType, nodeName, region, location } = req.body;

        if (!nodeId || !nodeType || !nodeName) {
            return res.status(400).json({
                success: false,
                error: "Missing required fields: nodeId, nodeType, nodeName",
            });
        }

        // Generate incident with rich mock data
        const incidentData = generateIncidentData(nodeType, nodeName, nodeId, region, location);

        // Insert into database
        await db.insert(incidents).values(incidentData);

        console.log(`[Create Incident] Created incident ${incidentData.id} for ${nodeName} (${nodeType})`);

        return res.status(201).json({
            success: true,
            incident: incidentData,
            message: `Incident ${incidentData.id} created successfully`,
        });

    } catch (error: any) {
        console.error("[Create Incident API] Error:", error);
        return res.status(500).json({
            success: false,
            error: error.message || "Failed to create incident",
        });
    }
}
