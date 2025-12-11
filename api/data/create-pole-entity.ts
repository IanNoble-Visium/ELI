import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getDb, sql } from "../lib/db.js";
import { pgTable, varchar, text, jsonb, timestamp } from "drizzle-orm/pg-core";

// POLE entities table definition
const poleEntities = pgTable("pole_entities", {
    id: varchar({ length: 255 }).primaryKey().notNull(),
    entityType: varchar({ length: 50 }).notNull(),
    name: varchar({ length: 500 }),
    description: text(),
    attributes: jsonb(),
    threatLevel: varchar({ length: 50 }),
    relatedEntities: jsonb(),
    createdAt: timestamp({ mode: 'string' }).defaultNow().notNull(),
    updatedAt: timestamp({ mode: 'string' }).defaultNow().notNull(),
});

// POLE entity templates based on type
const POLE_TEMPLATES: Record<string, {
    aliases: string[];
    descriptions: string[];
    attributes: object[];
    connections: string[];
}> = {
    person: {
        aliases: [
            "El Lobo", "La Sombra", "El Fantasma", "El Jefe", "La Serpiente",
            "El Halcón", "El Tigre", "La Viuda", "El Cóndor", "El Cazador"
        ],
        descriptions: [
            "High-ranking member of transnational criminal organization. Suspected leader of regional operations spanning multiple countries.",
            "Key intermediary between street-level operatives and cartel leadership. Handles financial transactions and logistics.",
            "Former military operative believed to have defected to criminal organization. Weapons training and tactical expertise.",
            "Suspected recruiter for criminal network. Targets vulnerable youth in low-income communities.",
            "Money laundering specialist with connections to legitimate businesses across the country.",
        ],
        attributes: [
            { height: "1.78m", weight: "82kg", eyeColor: "brown", distinguishingMarks: "Scar on left cheek, tattoo on right forearm" },
            { height: "1.65m", weight: "70kg", eyeColor: "black", distinguishingMarks: "Gold tooth, burn marks on hands" },
            { height: "1.82m", weight: "90kg", eyeColor: "brown", distinguishingMarks: "Military tattoos, limp on right leg" },
            { height: "1.70m", weight: "65kg", eyeColor: "brown", distinguishingMarks: "Multiple piercings, neck tattoo" },
            { height: "1.75m", weight: "78kg", eyeColor: "hazel", distinguishingMarks: "Expensive watch, designer clothing" },
        ],
        connections: [
            "Connected to DEV-2024-CARTEL-NORTE network",
            "Financial ties to offshore accounts in Panama",
            "Communications intercepted with known terrorist cell",
            "Family members in government positions",
            "Owns property under shell companies in 5 countries",
        ],
    },
    object: {
        aliases: [
            "Ghost Shipment", "Package Alpha", "El Tesoro", "Carga Especial", "Mercancía Premium"
        ],
        descriptions: [
            "Suspicious shipment intercepted at customs. Contents include dual-use technology with potential military applications.",
            "Seized vehicle containing hidden compartments. Structural modifications suggest professional smuggling operation.",
            "Weapon cache discovered during search. Military-grade equipment including assault rifles and explosives.",
            "Electronic equipment suspected of being used for illegal surveillance and communications interception.",
            "Counterfeit currency operation - high-quality forgeries of US dollars and Euros detected in circulation.",
        ],
        attributes: [
            { weight: "500kg", origin: "Unknown", containerNumber: "MSKU-2847651", flaggedReason: "Radiation signature" },
            { make: "Toyota Land Cruiser", year: "2022", modifications: "Hidden compartments, reinforced frame" },
            { quantity: "47 units", caliber: "7.62mm", serialNumbers: "Filed off", condition: "New" },
            { devices: "15 phones, 3 laptops, 2 servers", encrypted: true, origin: "China" },
            { denomination: "$100 USD", quantity: "$2.5 million", quality: "Near-perfect", paperSource: "Unknown" },
        ],
        connections: [
            "Linked to international arms trafficking ring",
            "Same batch found in 3 other countries",
            "Fingerprints match known cartel operative",
            "Shipping company has history of smuggling",
            "Technology matches equipment used in recent cyberattack",
        ],
    },
    location: {
        aliases: [
            "Safe House Alpha", "La Guarida", "El Escondite", "Punto Cero", "La Bodega"
        ],
        descriptions: [
            "Suspected safe house used by criminal organization. Surveillance shows high-value targets entering and exiting.",
            "Warehouse identified as distribution center for narcotics network. Estimated throughput: 500kg/month.",
            "Luxury residence owned by shell company. Property used for meetings between criminal leadership.",
            "Industrial facility suspected of being used for money laundering. Cash-intensive business with no legitimate revenue.",
            "Underground bunker discovered through thermal imaging. Contains living quarters and communications equipment.",
        ],
        attributes: [
            { sqMeters: 450, floors: 2, security: "Armed guards, CCTV, reinforced doors", lastModified: "2024-06" },
            { sqMeters: 2000, capacity: "Commercial", vehicles: 12, shiftPatterns: "24/7 operation" },
            { value: "$4.5M USD", owners: "Shell company registered in BVI", residents: "Unknown" },
            { revenue: "$50K/month reported", cashDeposits: "$500K/month actual", employees: 3 },
            { depth: "8m underground", area: "200 sqm", features: "Generator, water supply, comms" },
        ],
        connections: [
            "Property deed traces to same network as seized assets",
            "Communications from this location to known cartel leader",
            "Previous tenant arrested for trafficking",
            "Utilities usage inconsistent with reported activity",
            "Neighboring businesses report suspicious activity",
        ],
    },
    event: {
        aliases: [
            "Operation Shadow", "Incident Delta", "Case File 7749", "Alert Omega", "Event Phoenix"
        ],
        descriptions: [
            "Coordinated attack on multiple targets. Evidence suggests months of planning and inside information.",
            "High-speed chase through city center. Suspects evaded capture after crashing into barriers.",
            "Hostage situation resolved with tactical intervention. Suspects neutralized, all hostages recovered safely.",
            "Large-scale drug bust. 2 tons of cocaine seized, 15 suspects arrested across 3 locations.",
            "Assassination attempt on public official. Protected by security detail, suspect in custody.",
        ],
        attributes: [
            { duration: "4 hours", location: "Multiple", casualties: 0, arrests: 8 },
            { vehicles: 3, distance: "25km", damage: "$150K", witnesses: 47 },
            { hostages: 12, duration: "8 hours", negotiator: "Cap. Rodriguez", outcome: "Resolved" },
            { drugs: "2000kg cocaine", street_value: "$80M USD", arrests: 15, weapons: 23 },
            { target: "Official", protection: "Active", suspect: "In custody", motive: "Under investigation" },
        ],
        connections: [
            "Linked to Operation Clean Sweep",
            "Same MO as 5 previous incidents",
            "Weapons traced to international supplier",
            "Communications intercepted 48h before event",
            "Informant provided advance warning",
        ],
    },
};

// Threat levels
const THREAT_LEVELS = ["low", "medium", "high", "critical"];

// Generate a unique POLE entity ID
function generatePoleId(entityType: string): string {
    const prefix = entityType.substring(0, 3).toUpperCase();
    const date = new Date();
    const ts = date.getTime().toString(36).toUpperCase();
    const random = Math.random().toString(36).substring(2, 6).toUpperCase();
    return `${prefix}-${ts}-${random}`;
}

// Get random item from array
function randomItem<T>(arr: T[]): T {
    return arr[Math.floor(Math.random() * arr.length)];
}

// Generate POLE entity data
function generatePoleEntityData(
    sourceType: string,
    sourceName: string,
    sourceId: string,
    coords?: string
) {
    // Map source type to POLE entity type
    const poleTypeMap: Record<string, string> = {
        person: "person",
        vehicle: "object",
        camera: "location",
        location: "location",
        event: "event",
        region: "location",
    };
    const entityType = poleTypeMap[sourceType] || "event";

    const template = POLE_TEMPLATES[entityType] || POLE_TEMPLATES.event;

    const alias = randomItem(template.aliases);
    const description = randomItem(template.descriptions);
    const attributes = randomItem(template.attributes);
    const connection = randomItem(template.connections);

    // Add coordinates if provided
    let locationData = {};
    if (coords) {
        const [lat, lng] = coords.split(',').map(s => parseFloat(s.trim()));
        if (!isNaN(lat) && !isNaN(lng)) {
            locationData = { coordinates: { latitude: lat, longitude: lng } };
        }
    }

    return {
        id: generatePoleId(entityType),
        entityType,
        name: `${sourceName} (${alias})`,
        description: `**Source:** ${sourceName}\n**Source Type:** ${sourceType}\n**Source ID:** ${sourceId}\n\n${description}\n\n**Intelligence Notes:**\n${connection}`,
        attributes: {
            ...attributes,
            ...locationData,
            sourceNodeId: sourceId,
            sourceNodeType: sourceType,
            dateAdded: new Date().toISOString(),
            addedBy: "Topology Graph Context Menu",
        },
        threatLevel: Math.random() > 0.5 ? "high" : Math.random() > 0.3 ? "medium" : "critical",
        relatedEntities: [
            { id: sourceId, type: sourceType, relationship: "source_detection" }
        ],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
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

        const { entityId, entityType, entityName, coords } = req.body;

        if (!entityId || !entityType || !entityName) {
            return res.status(400).json({
                success: false,
                error: "Missing required fields: entityId, entityType, entityName",
            });
        }

        // Generate POLE entity with rich mock data
        const entityData = generatePoleEntityData(entityType, entityName, entityId, coords);

        // Insert into database
        await db.insert(poleEntities).values(entityData);

        console.log(`[Create POLE Entity] Created ${entityData.entityType} entity ${entityData.id} for ${entityName}`);

        return res.status(201).json({
            success: true,
            entity: entityData,
            message: `POLE entity ${entityData.id} created successfully`,
        });

    } catch (error: any) {
        console.error("[Create POLE Entity API] Error:", error);
        return res.status(500).json({
            success: false,
            error: error.message || "Failed to create POLE entity",
        });
    }
}
