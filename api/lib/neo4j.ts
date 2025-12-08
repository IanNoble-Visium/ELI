/**
 * Neo4j Database Utility for Topology Graph
 * 
 * Provides Neo4j connection and query utilities for graph-based topology data.
 * Used alongside PostgreSQL for hybrid data storage:
 * - Neo4j: Graph relationships and topology queries
 * - PostgreSQL: Primary data storage (events, channels, etc.)
 */
import neo4j, { Driver, Session, Result } from "neo4j-driver";

// Cache the driver instance
let _driver: Driver | null = null;

/**
 * Neo4j configuration from environment variables
 */
interface Neo4jConfig {
  uri: string;
  user: string;
  password: string;
}

/**
 * Get Neo4j configuration from environment variables
 * Returns null if not configured
 */
export function getNeo4jConfig(): Neo4jConfig | null {
  const uri = process.env.NEO4J_URI;
  const user = process.env.NEO4J_USER;
  const password = process.env.NEO4J_PASSWORD;

  if (!uri || !user || !password) {
    return null;
  }

  return { uri, user, password };
}

/**
 * Check if Neo4j is configured
 */
export function isNeo4jConfigured(): boolean {
  return getNeo4jConfig() !== null;
}

/**
 * Get or create a Neo4j driver instance
 * Returns null if not configured
 */
export function getDriver(): Driver | null {
  if (_driver) return _driver;

  const config = getNeo4jConfig();
  if (!config) {
    console.warn("[Neo4j] NEO4J_URI, NEO4J_USER, or NEO4J_PASSWORD not configured");
    return null;
  }

  try {
    _driver = neo4j.driver(
      config.uri,
      neo4j.auth.basic(config.user, config.password),
      {
        maxConnectionPoolSize: 50,
        connectionAcquisitionTimeout: 30000,
        connectionTimeout: 30000,
      }
    );
    console.log("[Neo4j] Driver created successfully");
    return _driver;
  } catch (error) {
    console.error("[Neo4j] Failed to create driver:", error);
    return null;
  }
}

/**
 * Get a new Neo4j session
 * Returns null if driver is not available
 */
export function getSession(): Session | null {
  const driver = getDriver();
  if (!driver) return null;

  return driver.session();
}

/**
 * Close the Neo4j driver (call on server shutdown)
 */
export async function closeDriver(): Promise<void> {
  if (_driver) {
    await _driver.close();
    _driver = null;
    console.log("[Neo4j] Driver closed");
  }
}

/**
 * Execute a Cypher query with automatic session management
 */
export async function runQuery<T = any>(
  cypher: string,
  params: Record<string, any> = {}
): Promise<T[]> {
  const session = getSession();
  if (!session) {
    throw new Error("Neo4j session not available");
  }

  try {
    const result: Result = await session.run(cypher, params);
    return result.records.map((record) => record.toObject() as T);
  } finally {
    await session.close();
  }
}

/**
 * Execute a write transaction (for creating/updating data)
 */
export async function writeTransaction<T = any>(
  work: (tx: any) => Promise<any>
): Promise<T> {
  const session = getSession();
  if (!session) {
    throw new Error("Neo4j session not available");
  }

  try {
    return await session.executeWrite(work);
  } finally {
    await session.close();
  }
}

/**
 * Execute a read transaction (for querying data)
 */
export async function readTransaction<T = any>(
  work: (tx: any) => Promise<any>
): Promise<T> {
  const session = getSession();
  if (!session) {
    throw new Error("Neo4j session not available");
  }

  try {
    return await session.executeRead(work);
  } finally {
    await session.close();
  }
}

// ========== Schema Initialization ==========

/**
 * Initialize Neo4j schema with constraints and indexes
 * Call this on application startup
 */
export async function initializeSchema(): Promise<void> {
  const driver = getDriver();
  if (!driver) {
    console.warn("[Neo4j] Cannot initialize schema - driver not available");
    return;
  }

  const session = driver.session();
  try {
    // Create constraints for unique node IDs
    const constraints = [
      "CREATE CONSTRAINT camera_id IF NOT EXISTS FOR (c:Camera) REQUIRE c.id IS UNIQUE",
      "CREATE CONSTRAINT location_id IF NOT EXISTS FOR (l:Location) REQUIRE l.id IS UNIQUE",
      "CREATE CONSTRAINT person_id IF NOT EXISTS FOR (p:Person) REQUIRE p.id IS UNIQUE",
      "CREATE CONSTRAINT vehicle_id IF NOT EXISTS FOR (v:Vehicle) REQUIRE v.id IS UNIQUE",
      "CREATE CONSTRAINT event_id IF NOT EXISTS FOR (e:Event) REQUIRE e.id IS UNIQUE",
    ];

    // Create indexes for frequently queried properties
    const indexes = [
      "CREATE INDEX camera_name IF NOT EXISTS FOR (c:Camera) ON (c.name)",
      "CREATE INDEX camera_region IF NOT EXISTS FOR (c:Camera) ON (c.region)",
      "CREATE INDEX location_name IF NOT EXISTS FOR (l:Location) ON (l.name)",
      "CREATE INDEX event_timestamp IF NOT EXISTS FOR (e:Event) ON (e.timestamp)",
      "CREATE INDEX event_type IF NOT EXISTS FOR (e:Event) ON (e.type)",
      "CREATE INDEX vehicle_plate IF NOT EXISTS FOR (v:Vehicle) ON (v.plate)",
    ];

    for (const constraint of constraints) {
      try {
        await session.run(constraint);
      } catch (error: any) {
        // Ignore if constraint already exists
        if (!error.message?.includes("already exists")) {
          console.error("[Neo4j] Error creating constraint:", error);
        }
      }
    }

    for (const index of indexes) {
      try {
        await session.run(index);
      } catch (error: any) {
        // Ignore if index already exists
        if (!error.message?.includes("already exists")) {
          console.error("[Neo4j] Error creating index:", error);
        }
      }
    }

    console.log("[Neo4j] Schema initialized successfully");
  } finally {
    await session.close();
  }
}

// ========== Node Types ==========

export interface Neo4jCamera {
  id: string;
  name: string;
  latitude?: number;
  longitude?: number;
  region?: string;
  status?: string;
  eventCount?: number;
}

export interface Neo4jLocation {
  id: string;
  name: string;
  region?: string;
}

export interface Neo4jPerson {
  id: string;
  name: string;
  faceId?: string;
}

export interface Neo4jVehicle {
  id: string;
  plate: string;
  name?: string;
}

export interface Neo4jEvent {
  id: string;
  eventId: string;
  type: string;
  timestamp: number;
  imageUrl?: string;
  channelId?: string;
}

// ========== Relationship Types ==========

export type RelationshipType =
  | "LOCATED_AT"      // Camera -> Location
  | "DETECTED"        // Camera -> Vehicle/Person (detected at camera)
  | "OBSERVED"        // Person -> Camera (person observed at camera)
  | "TRIGGERED"       // Event -> Camera (event triggered at camera)
  | "CAPTURED_IMAGE"; // Event -> has image

export interface Neo4jRelationship {
  type: RelationshipType;
  source: string;
  target: string;
  properties?: Record<string, any>;
}

// ========== Utility Functions ==========

/**
 * Convert Neo4j Integer to JavaScript number
 */
export function toNumber(value: any): number {
  if (value === null || value === undefined) return 0;
  if (typeof value === "number") return value;
  if (value.toNumber) return value.toNumber();
  return parseInt(value.toString(), 10);
}

/**
 * Convert Neo4j node properties to plain object
 */
export function nodeToObject<T>(node: any): T {
  if (!node || !node.properties) return {} as T;
  
  const result: any = { ...node.properties };
  
  // Convert any Neo4j integers to JavaScript numbers
  for (const key in result) {
    if (result[key]?.toNumber) {
      result[key] = result[key].toNumber();
    }
  }
  
  return result as T;
}

