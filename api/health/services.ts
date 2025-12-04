import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getDb } from "../lib/db.js";
import neo4j from "neo4j-driver";

/**
 * API endpoint to check connection status of external services
 * Returns health status for PostgreSQL (Neon), Cloudinary, and Neo4j
 */

interface ServiceStatus {
  name: string;
  status: "connected" | "disconnected" | "error" | "not_configured";
  latency?: number;
  message?: string;
  lastChecked: string;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Set CORS headers
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const services: ServiceStatus[] = [];
  const now = new Date().toISOString();

  // Check PostgreSQL (Neon) connection
  const postgresStatus = await checkPostgres(now);
  services.push(postgresStatus);

  // Check Cloudinary connection
  const cloudinaryStatus = await checkCloudinary(now);
  services.push(cloudinaryStatus);

  // Check Neo4j connection
  const neo4jStatus = await checkNeo4j(now);
  services.push(neo4jStatus);

  // Calculate overall health
  const allConnected = services.every(s => s.status === "connected");
  const anyError = services.some(s => s.status === "error");
  const overallStatus = allConnected ? "healthy" : anyError ? "degraded" : "partial";

  return res.status(200).json({
    success: true,
    status: overallStatus,
    services,
    lastChecked: now,
  });
}

async function checkPostgres(now: string): Promise<ServiceStatus> {
  const startTime = Date.now();
  
  try {
    const dbUrl = process.env.DATABASE_URL;
    if (!dbUrl) {
      return {
        name: "PostgreSQL (Neon)",
        status: "not_configured",
        message: "DATABASE_URL not set",
        lastChecked: now,
      };
    }

    const db = await getDb();
    if (!db) {
      return {
        name: "PostgreSQL (Neon)",
        status: "disconnected",
        message: "Failed to establish connection",
        lastChecked: now,
      };
    }

    // Simple query to verify connection
    await db.execute("SELECT 1");
    const latency = Date.now() - startTime;

    return {
      name: "PostgreSQL (Neon)",
      status: "connected",
      latency,
      message: "Connection healthy",
      lastChecked: now,
    };
  } catch (error) {
    return {
      name: "PostgreSQL (Neon)",
      status: "error",
      latency: Date.now() - startTime,
      message: error instanceof Error ? error.message : "Unknown error",
      lastChecked: now,
    };
  }
}

async function checkCloudinary(now: string): Promise<ServiceStatus> {
  const startTime = Date.now();
  
  try {
    const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
    const apiKey = process.env.CLOUDINARY_API_KEY;
    const apiSecret = process.env.CLOUDINARY_API_SECRET;

    if (!cloudName || !apiKey || !apiSecret) {
      return {
        name: "Cloudinary",
        status: "not_configured",
        message: "Cloudinary credentials not set",
        lastChecked: now,
      };
    }

    // Ping Cloudinary API to check connection
    const auth = Buffer.from(`${apiKey}:${apiSecret}`).toString("base64");
    const response = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/ping`, {
      method: "GET",
      headers: { Authorization: `Basic ${auth}` },
    });

    const latency = Date.now() - startTime;

    if (response.ok) {
      return {
        name: "Cloudinary",
        status: "connected",
        latency,
        message: "Connection healthy",
        lastChecked: now,
      };
    } else {
      return {
        name: "Cloudinary",
        status: "error",
        latency,
        message: `HTTP ${response.status}: ${response.statusText}`,
        lastChecked: now,
      };
    }
  } catch (error) {
    return {
      name: "Cloudinary",
      status: "error",
      latency: Date.now() - startTime,
      message: error instanceof Error ? error.message : "Unknown error",
      lastChecked: now,
    };
  }
}

async function checkNeo4j(now: string): Promise<ServiceStatus> {
  const startTime = Date.now();
  let driver: neo4j.Driver | null = null;

  try {
    const neo4jUri = process.env.NEO4J_URI;
    const neo4jUser = process.env.NEO4J_USERNAME || process.env.NEO4J_USER;
    const neo4jPassword = process.env.NEO4J_PASSWORD;

    if (!neo4jUri || !neo4jUser || !neo4jPassword) {
      return {
        name: "Neo4j",
        status: "not_configured",
        message: "Neo4j credentials not set",
        lastChecked: now,
      };
    }

    // Create Neo4j driver and verify connectivity
    driver = neo4j.driver(
      neo4jUri,
      neo4j.auth.basic(neo4jUser, neo4jPassword)
    );

    // Verify connectivity with a simple query
    const session = driver.session();
    try {
      await session.run("RETURN 1");
      const latency = Date.now() - startTime;

      return {
        name: "Neo4j",
        status: "connected",
        latency,
        message: "Connection healthy",
        lastChecked: now,
      };
    } finally {
      await session.close();
    }
  } catch (error) {
    return {
      name: "Neo4j",
      status: "error",
      latency: Date.now() - startTime,
      message: error instanceof Error ? error.message : "Unknown error",
      lastChecked: now,
    };
  } finally {
    if (driver) {
      await driver.close();
    }
  }
}

