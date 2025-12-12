/**
 * Neo4j Topology API
 * 
 * Provides Cypher queries for topology graph data from Neo4j.
 * Used for graph relationships and network visualization.
 */
import neo4j from "neo4j-driver";
import {
  runQuery,
  writeTransaction,
  readTransaction,
  isNeo4jConfigured,
  toNumber,
  nodeToObject,
  Neo4jCamera,
  Neo4jLocation,
  Neo4jPerson,
  Neo4jVehicle,
  Neo4jEvent,
} from "../lib/neo4j.js";

// ========== Graph Node/Link Types for Frontend ==========

export interface TopologyNode {
  id: string;
  name: string;
  type: "camera" | "location" | "vehicle" | "person" | "event";
  color: string;
  val: number;
  latitude?: number;
  longitude?: number;
  region?: string;
  eventCount?: number;
  imageUrl?: string; // Cloudinary image URL for events
  tags?: string[];
  objects?: string[];
  dominantColors?: string[];
  qualityScore?: number;
  moderationStatus?: string;
  caption?: string;
  channelId?: string;
  eventId?: string;
  timestamp?: number;
  // Gemini AI analysis properties
  geminiCaption?: string;
  geminiTags?: string[];
  geminiObjects?: string[];
  geminiPeopleCount?: number;
  geminiVehicles?: string[];
  geminiWeapons?: string[];
  geminiClothingColors?: string[];
  geminiLicensePlates?: string[];
  geminiTextExtracted?: string[];
  geminiQualityScore?: number;
  geminiBlurScore?: number;
  geminiTimeOfDay?: string;
  geminiLightingCondition?: string;
  geminiEnvironment?: string;
  geminiWeatherCondition?: string;
  geminiCameraPerspective?: string;
  geminiDominantColors?: string[];
  geminiProcessedAt?: number;
}

export async function getTopologyReportContextFromNeo4j(params: {
  nodeIds: string[];
  edgeIds?: string[];
}): Promise<{
  nodes: Array<{ id: string; labels: string[]; properties: Record<string, any> }>;
  edges: Array<{ id: string; type: string; source: string; target: string; properties: Record<string, any> }>;
}> {
  const { nodeIds, edgeIds } = params;
  if (!isNeo4jConfigured()) return { nodes: [], edges: [] };
  if (!Array.isArray(nodeIds) || nodeIds.length === 0) return { nodes: [], edges: [] };

  const safeNodeIds = nodeIds.filter((id) => typeof id === "string" && id.length > 0);
  const safeEdgeIds = (edgeIds || [])
    .filter((id) => typeof id === "string" && id.length > 0)
    .map((id) => Number.parseInt(id, 10))
    .filter((n) => Number.isFinite(n));

  return readTransaction(async (tx) => {
    const nodesResult = await tx.run(
      `
      MATCH (n)
      WHERE n.id IN $nodeIds
      RETURN n, labels(n) as labels
      `,
      { nodeIds: safeNodeIds }
    );

    const nodeRows = nodesResult.records.map((record: any) => {
      const node = record.get("n");
      const labels = (record.get("labels") || []) as string[];
      const props = nodeToObject<Record<string, any>>(node);
      return {
        id: props.id || "",
        labels,
        properties: props,
      };
    });

    let edgesResult: any;
    if (safeEdgeIds.length > 0) {
      edgesResult = await tx.run(
        `
        MATCH (a)-[r]->(b)
        WHERE id(r) IN $edgeIds
        RETURN id(r) as id, type(r) as type, a.id as source, b.id as target, properties(r) as properties
        `,
        { edgeIds: safeEdgeIds.map((n) => neo4j.int(n)) }
      );
    } else {
      // Fallback: compute edges connecting selected nodes
      edgesResult = await tx.run(
        `
        MATCH (a)-[r]-(b)
        WHERE a.id IN $nodeIds AND b.id IN $nodeIds
        RETURN DISTINCT id(r) as id, type(r) as type, a.id as source, b.id as target, properties(r) as properties
        `,
        { nodeIds: safeNodeIds }
      );
    }

    const edgeRows = edgesResult.records.map((record: any) => {
      const id = toNumber(record.get("id"));
      const type = record.get("type") as string;
      const source = record.get("source") as string;
      const target = record.get("target") as string;
      const properties = (record.get("properties") || {}) as Record<string, any>;
      return {
        id: String(id),
        type,
        source,
        target,
        properties,
      };
    });

    return {
      nodes: nodeRows.filter((n: any) => n.id),
      edges: edgeRows,
    };
  });
}

export async function setTopologyFlaggedReportId(params: {
  reportId: string;
  nodeIds: string[];
  edgeIds?: string[];
}): Promise<void> {
  const { reportId, nodeIds, edgeIds } = params;
  if (!isNeo4jConfigured()) return;
  if (!reportId) return;

  const safeNodeIds = (nodeIds || []).filter((id) => typeof id === "string" && id.length > 0);
  const safeEdgeIds = (edgeIds || [])
    .filter((id) => typeof id === "string" && id.length > 0)
    .map((id) => Number.parseInt(id, 10))
    .filter((n) => Number.isFinite(n));

  await writeTransaction(async (tx) => {
    if (safeNodeIds.length > 0) {
      await tx.run(
        `
        MATCH (n)
        WHERE n.id IN $nodeIds
        SET n.flaggedReportId = $reportId,
            n.flaggedAt = timestamp()
        `,
        { nodeIds: safeNodeIds, reportId }
      );
    }

    if (safeEdgeIds.length > 0) {
      await tx.run(
        `
        MATCH ()-[r]-()
        WHERE id(r) IN $edgeIds
        SET r.flaggedReportId = $reportId,
            r.flaggedAt = timestamp()
        `,
        { edgeIds: safeEdgeIds.map((n) => neo4j.int(n)), reportId }
      );
    }
  });
}

export interface TopologyLink {
  id: string;
  source: string;
  target: string;
  value: number;
  type: string;
  properties?: Record<string, any>;
}

export interface TopologyStats {
  cameras: number;
  locations: number;
  vehicles: number;
  persons: number;
  events: number;
  edges: number;
}

export interface TopologyData {
  nodes: TopologyNode[];
  links: TopologyLink[];
  stats: TopologyStats;
}

export async function getEventTimestampBoundsFromNeo4j(): Promise<
  { minTs: number | null; maxTs: number | null; count: number } | null
> {
  if (!isNeo4jConfigured()) return null;

  try {
    const result = await runQuery<any>(
      `
      MATCH (e:Event)
      WHERE e.timestamp IS NOT NULL
      RETURN min(e.timestamp) as minTs, max(e.timestamp) as maxTs, count(e) as count
      `
    );

    const row = result?.[0];
    if (!row) return { minTs: null, maxTs: null, count: 0 };

    return {
      minTs: row.minTs != null ? toNumber(row.minTs) : null,
      maxTs: row.maxTs != null ? toNumber(row.maxTs) : null,
      count: row.count != null ? toNumber(row.count) : 0,
    };
  } catch (error) {
    console.error("[Neo4j Topology] Error fetching timestamp bounds:", error);
    return null;
  }
}

// ========== Node Colors ==========

const NODE_COLORS = {
  camera: "#10B981",   // Green
  location: "#8B5CF6", // Purple
  vehicle: "#F59E0B",  // Orange
  person: "#3B82F6",   // Blue
  event: "#D91023",    // Red (Peru primary color)
};

// ========== Sync Functions (PostgreSQL -> Neo4j) ==========

/**
 * Sync a camera from PostgreSQL to Neo4j
 */
export async function syncCamera(camera: {
  id: string;
  name?: string;
  latitude?: number;
  longitude?: number;
  region?: string;
  status?: string;
}): Promise<void> {
  if (!isNeo4jConfigured()) return;

  await writeTransaction(async (tx) => {
    await tx.run(
      `
      MERGE (c:Camera {id: $id})
      SET c.name = $name,
          c.latitude = $latitude,
          c.longitude = $longitude,
          c.region = $region,
          c.status = $status,
          c.updatedAt = timestamp()
      `,
      {
        id: camera.id,
        name: camera.name || `Camera ${camera.id}`,
        latitude: camera.latitude || null,
        longitude: camera.longitude || null,
        region: camera.region || null,
        status: camera.status || "active",
      }
    );

    // Create location node and relationship if region exists
    if (camera.region) {
      const locationId = `location-${camera.region.replace(/\s+/g, "-").toLowerCase()}`;
      await tx.run(
        `
        MERGE (l:Location {id: $locationId})
        SET l.name = $region
        WITH l
        MATCH (c:Camera {id: $cameraId})
        MERGE (c)-[:LOCATED_AT]->(l)
        `,
        {
          locationId,
          region: camera.region,
          cameraId: camera.id,
        }
      );
    }
  });
}

/**
 * Sync an event from PostgreSQL to Neo4j
 */
export async function syncEvent(event: {
  id: string;
  eventId?: string;
  topic?: string;
  channelId?: string;
  startTime?: number;
  params?: any;
  imageUrl?: string;
  analysis?: any;
}): Promise<void> {
  if (!isNeo4jConfigured()) return;

  await writeTransaction(async (tx) => {
    // Create event node
    await tx.run(
      `
      MERGE (e:Event {id: $id})
      SET e.eventId = $eventId,
          e.type = $type,
          e.timestamp = $timestamp,
          e.imageUrl = $imageUrl,
          e.channelId = $channelId,
          e.tags = $tags,
          e.objects = $objects,
          e.dominantColors = $dominantColors,
          e.qualityScore = $qualityScore,
          e.caption = $caption,
          e.moderationStatus = $moderationStatus,
          e.phash = $phash
      `,
      {
        id: event.id,
        eventId: event.eventId || event.id,
        type: event.topic || "Unknown",
        timestamp: event.startTime || Date.now(),
        imageUrl: event.imageUrl || null,
        channelId: event.channelId || null,
        tags: event.analysis?.tags ?
          Object.values(event.analysis.tags).flat().map((t: any) => t.tag) :
          (event.params?.tags || []),
        objects: event.analysis?.detection?.object_detection?.data?.coco ?
          event.analysis.detection.object_detection.data.coco.map((o: any) => o.tag) :
          (event.params?.objects || []),
        dominantColors: event.analysis?.colors?.predominant?.google ?
          event.analysis.colors.predominant.google.map((c: any) => c[0]) :
          (event.params?.colors || []),
        qualityScore: event.analysis?.quality_analysis?.focus || event.params?.qualityScore || null,
        caption: event.params?.caption || null,
        moderationStatus: event.analysis?.moderation?.status || event.params?.moderation || null,
        phash: event.analysis?.phash || event.params?.phash || null
      }
    );

    // Link event to camera
    if (event.channelId) {
      await tx.run(
        `
        MATCH (e:Event {id: $eventId})
        MATCH (c:Camera {id: $channelId})
        MERGE (e)-[:TRIGGERED]->(c)
        `,
        {
          eventId: event.id,
          channelId: event.channelId,
        }
      );
    }

    // Extract and create vehicle if plate detected
    const params = event.params as any;
    if (event.topic?.includes("Plate") && params?.plate?.value) {
      const plate = params.plate.value.toUpperCase();
      const vehicleId = `vehicle-${plate}`;

      await tx.run(
        `
        MERGE (v:Vehicle {id: $vehicleId})
        SET v.plate = $plate,
            v.name = $name
        WITH v
        MATCH (c:Camera {id: $channelId})
        MERGE (v)-[:DETECTED {timestamp: $timestamp}]->(c)
        `,
        {
          vehicleId,
          plate,
          name: `Vehicle: ${plate}`,
          channelId: event.channelId,
          timestamp: event.startTime || Date.now(),
        }
      );
    }

    // Extract and create person if face detected
    if (event.topic?.includes("Face") && params?.face) {
      const faceId = params.face.id?.toString() || `face-${event.id}`;
      const personId = `person-${faceId}`;

      await tx.run(
        `
        MERGE (p:Person {id: $personId})
        SET p.faceId = $faceId,
            p.name = $name
        WITH p
        MATCH (c:Camera {id: $channelId})
        MERGE (p)-[:OBSERVED {timestamp: $timestamp}]->(c)
        `,
        {
          personId,
          faceId,
          name: `Person ${faceId}`,
          channelId: event.channelId,
          timestamp: event.startTime || Date.now(),
        }
      );
    }
  });
}

/**
 * Update event with image URL
 */
export async function updateEventImage(eventId: string, imageUrl: string): Promise<void> {
  if (!isNeo4jConfigured()) return;

  await runQuery(
    `
    MATCH (e:Event {id: $eventId})
    SET e.imageUrl = $imageUrl
    `,
    { eventId, imageUrl }
  );
}

// ========== Query Functions ==========

/**
 * Get all topology data from Neo4j for graph visualization
 */
export async function getTopologyFromNeo4j(params?: {
  startTs?: number;
  endTs?: number;
  cameraIds?: string[];
  locationIds?: string[];
  maxEvents?: number;
}): Promise<TopologyData | null> {
  if (!isNeo4jConfigured()) return null;

  try {
    const startTs = params?.startTs;
    const endTs = params?.endTs;
    const cameraIdsFilter = params?.cameraIds && params.cameraIds.length > 0 ? params.cameraIds : null;
    const locationIdsFilter = params?.locationIds && params.locationIds.length > 0 ? params.locationIds : null;
    const maxEvents = params?.maxEvents != null ? Math.max(1, Math.min(20000, params.maxEvents)) : null;

    const nodes: TopologyNode[] = [];
    const links: TopologyLink[] = [];
    const nodeIds = new Set<string>();

    const inWindowPredicate = `
      e.timestamp IS NOT NULL
      AND ($startTs IS NULL OR e.timestamp >= $startTs)
      AND ($endTs IS NULL OR e.timestamp < $endTs)
    `;

    const relInWindowPredicate = `
      r.timestamp IS NOT NULL
      AND ($startTs IS NULL OR r.timestamp >= $startTs)
      AND ($endTs IS NULL OR r.timestamp < $endTs)
    `;

    // Fetch all nodes with their relationships
    const result = await readTransaction(async (tx) => {
      // Get cameras
      const camerasResult = await tx.run(
        `
        MATCH (c:Camera)
        WHERE ($cameraIds IS NULL OR c.id IN $cameraIds)
        OPTIONAL MATCH (c)<-[:TRIGGERED]-(e:Event)
        WHERE ${inWindowPredicate}
        RETURN c, count(e) as eventCount
        `,
        { startTs: startTs ?? null, endTs: endTs ?? null, cameraIds: cameraIdsFilter }
      );

      // Get locations
      const locationsResult = await tx.run(
        `
        MATCH (l:Location)
        WHERE ($locationIds IS NULL OR l.id IN $locationIds)
        RETURN l
        `,
        { locationIds: locationIdsFilter }
      );

      // Get vehicles
      const vehiclesResult = await tx.run(
        `
        MATCH (v:Vehicle)-[r:DETECTED]->(c:Camera)
        WHERE ($cameraIds IS NULL OR c.id IN $cameraIds)
          AND ${relInWindowPredicate}
        RETURN DISTINCT v
        `,
        { startTs: startTs ?? null, endTs: endTs ?? null, cameraIds: cameraIdsFilter }
      );

      // Get persons
      const personsResult = await tx.run(
        `
        MATCH (p:Person)-[r:OBSERVED]->(c:Camera)
        WHERE ($cameraIds IS NULL OR c.id IN $cameraIds)
          AND ${relInWindowPredicate}
        RETURN DISTINCT p
        `,
        { startTs: startTs ?? null, endTs: endTs ?? null, cameraIds: cameraIdsFilter }
      );

      // Get events within window, optionally filtered by cameraIds/locationIds.
      // Location filtering: prefer camera->LOCATED_AT if present, otherwise fall back to (e)-[:LOCATED_AT]->(l).
      const eventsResult = await tx.run(
        `
        MATCH (e:Event)-[:TRIGGERED]->(c:Camera)
        OPTIONAL MATCH (c)-[:LOCATED_AT]->(cl:Location)
        OPTIONAL MATCH (e)-[:LOCATED_AT]->(el:Location)
        WITH e, c, coalesce(cl, el) as loc
        WHERE ${inWindowPredicate}
          AND ($cameraIds IS NULL OR c.id IN $cameraIds)
          AND (
            $locationIds IS NULL
            OR (loc IS NOT NULL AND loc.id IN $locationIds)
          )
        RETURN e
        ORDER BY e.timestamp DESC
        ${maxEvents ? "LIMIT toInteger($maxEvents)" : ""}
        `,
        {
          startTs: startTs ?? null,
          endTs: endTs ?? null,
          cameraIds: cameraIdsFilter,
          locationIds: locationIdsFilter,
          maxEvents: maxEvents ?? undefined,
        }
      );

      const eventIds = eventsResult.records.map((r: any) => nodeToObject<Neo4jEvent>(r.get("e")).id).filter(Boolean);

      const triggeredResult =
        eventIds.length > 0
          ? await tx.run(
              `
              MATCH (e:Event)-[r:TRIGGERED]->(c:Camera)
              WHERE e.id IN $eventIds
              RETURN id(r) as id, e.id as source, c.id as target, type(r) as type, properties(r) as properties
              `,
              { eventIds }
            )
          : { records: [] };

      const cameraIdsForEdges = (cameraIdsFilter ?? []).length > 0 ? (cameraIdsFilter as string[]) : null;
      const locatedAtResult = await tx.run(
        `
        MATCH (c:Camera)-[r:LOCATED_AT]->(l:Location)
        WHERE ($cameraIdsForEdges IS NULL OR c.id IN $cameraIdsForEdges)
          AND ($locationIds IS NULL OR l.id IN $locationIds)
        RETURN id(r) as id, c.id as source, l.id as target, type(r) as type, properties(r) as properties
        `,
        { cameraIdsForEdges, locationIds: locationIdsFilter }
      );

      const eventLocatedAtResult =
        eventIds.length > 0
          ? await tx.run(
              `
              MATCH (e:Event)-[r:LOCATED_AT]->(l:Location)
              WHERE e.id IN $eventIds
                AND ($locationIds IS NULL OR l.id IN $locationIds)
              RETURN id(r) as id, e.id as source, l.id as target, type(r) as type, properties(r) as properties
              `,
              { eventIds, locationIds: locationIdsFilter }
            )
          : { records: [] };

      const detectedResult = await tx.run(
        `
        MATCH (v:Vehicle)-[r:DETECTED]->(c:Camera)
        WHERE ($cameraIds IS NULL OR c.id IN $cameraIds)
          AND ${relInWindowPredicate}
        RETURN id(r) as id, v.id as source, c.id as target, type(r) as type, properties(r) as properties
        `,
        { startTs: startTs ?? null, endTs: endTs ?? null, cameraIds: cameraIdsFilter }
      );

      const observedResult = await tx.run(
        `
        MATCH (p:Person)-[r:OBSERVED]->(c:Camera)
        WHERE ($cameraIds IS NULL OR c.id IN $cameraIds)
          AND ${relInWindowPredicate}
        RETURN id(r) as id, p.id as source, c.id as target, type(r) as type, properties(r) as properties
        `,
        { startTs: startTs ?? null, endTs: endTs ?? null, cameraIds: cameraIdsFilter }
      );

      return {
        cameras: camerasResult.records,
        locations: locationsResult.records,
        vehicles: vehiclesResult.records,
        persons: personsResult.records,
        events: eventsResult.records,
        relationships: [
          ...triggeredResult.records,
          ...locatedAtResult.records,
          ...eventLocatedAtResult.records,
          ...detectedResult.records,
          ...observedResult.records,
        ],
      };
    });

    // Process cameras
    for (const record of result.cameras) {
      const camera = nodeToObject<Neo4jCamera>(record.get("c"));
      const eventCount = toNumber(record.get("eventCount"));

      if (!nodeIds.has(camera.id)) {
        nodeIds.add(camera.id);
        nodes.push({
          id: camera.id,
          name: camera.name || `Camera ${camera.id}`,
          type: "camera",
          color: NODE_COLORS.camera,
          val: Math.max(5, Math.min(15, 5 + eventCount)),
          latitude: camera.latitude,
          longitude: camera.longitude,
          region: camera.region,
          eventCount,
        });
      }
    }

    // Process locations
    for (const record of result.locations) {
      const location = nodeToObject<Neo4jLocation>(record.get("l"));

      if (!nodeIds.has(location.id)) {
        nodeIds.add(location.id);
        nodes.push({
          id: location.id,
          name: location.name || location.id,
          type: "location",
          color: NODE_COLORS.location,
          val: 12,
          region: location.region,
        });
      }
    }

    // Process vehicles
    for (const record of result.vehicles) {
      const vehicle = nodeToObject<Neo4jVehicle>(record.get("v"));

      if (!nodeIds.has(vehicle.id)) {
        nodeIds.add(vehicle.id);
        nodes.push({
          id: vehicle.id,
          name: vehicle.name || `Vehicle: ${vehicle.plate}`,
          type: "vehicle",
          color: NODE_COLORS.vehicle,
          val: 8,
        });
      }
    }

    // Process persons
    for (const record of result.persons) {
      const person = nodeToObject<Neo4jPerson>(record.get("p"));

      if (!nodeIds.has(person.id)) {
        nodeIds.add(person.id);
        nodes.push({
          id: person.id,
          name: person.name || `Person ${person.id}`,
          type: "person",
          color: NODE_COLORS.person,
          val: 7,
        });
      }
    }

    // Process events
    for (const record of result.events) {
      const event = nodeToObject<Neo4jEvent>(record.get("e"));

      if (event.timestamp == null) continue;

      if (!nodeIds.has(event.id)) {
        nodeIds.add(event.id);
        nodes.push({
          id: event.id,
          name: event.type || "Event",
          type: "event",
          color: NODE_COLORS.event,
          val: 10,
          imageUrl: event.imageUrl,
          tags: event.tags,
          objects: event.objects,
          dominantColors: event.dominantColors,
          qualityScore: event.qualityScore,
          moderationStatus: event.moderationStatus,
          caption: event.caption,
          channelId: event.channelId,
          eventId: event.eventId,
          timestamp: event.timestamp,
          // Gemini AI analysis properties
          geminiCaption: event.geminiCaption,
          geminiTags: event.geminiTags,
          geminiObjects: event.geminiObjects,
          geminiPeopleCount: event.geminiPeopleCount,
          geminiVehicles: event.geminiVehicles,
          geminiWeapons: event.geminiWeapons,
          geminiClothingColors: event.geminiClothingColors,
          geminiLicensePlates: event.geminiLicensePlates,
          geminiTextExtracted: event.geminiTextExtracted,
          geminiQualityScore: event.geminiQualityScore,
          geminiBlurScore: event.geminiBlurScore,
          geminiTimeOfDay: event.geminiTimeOfDay,
          geminiLightingCondition: event.geminiLightingCondition,
          geminiEnvironment: event.geminiEnvironment,
          geminiWeatherCondition: event.geminiWeatherCondition,
          geminiCameraPerspective: event.geminiCameraPerspective,
          geminiDominantColors: event.geminiDominantColors,
          geminiProcessedAt: event.geminiProcessedAt,
        });
      }
    }

    // Process relationships
    for (const record of result.relationships) {
      const id = toNumber(record.get("id"));
      const source = record.get("source");
      const target = record.get("target");
      const type = record.get("type");
      const properties = record.get("properties") || undefined;

      // Only add links where both nodes exist
      if (nodeIds.has(source) && nodeIds.has(target)) {
        links.push({
          id: String(id),
          source,
          target,
          value: type === "LOCATED_AT" ? 2 : 3,
          type: type.toLowerCase(),
          properties,
        });
      }
    }

    // Calculate stats
    const stats: TopologyStats = {
      cameras: nodes.filter((n) => n.type === "camera").length,
      locations: nodes.filter((n) => n.type === "location").length,
      vehicles: nodes.filter((n) => n.type === "vehicle").length,
      persons: nodes.filter((n) => n.type === "person").length,
      events: nodes.filter((n) => n.type === "event").length,
      edges: links.length,
    };

    return { nodes, links, stats };
  } catch (error) {
    console.error("[Neo4j Topology] Error fetching topology:", error);
    return null;
  }
}

/**
 * Get connected nodes for a specific node (1-hop neighbors)
 */
export async function getConnectedNodes(nodeId: string): Promise<TopologyNode[]> {
  if (!isNeo4jConfigured()) return [];

  try {
    const result = await runQuery<any>(
      `
      MATCH (n {id: $nodeId})-[r]-(connected)
      RETURN connected, labels(connected) as labels
      `,
      { nodeId }
    );

    return result.map((record) => {
      const node = nodeToObject<any>(record.connected);
      const labels = record.labels as string[];
      const type = labels[0]?.toLowerCase() as TopologyNode["type"];

      return {
        id: node.id,
        name: node.name || node.id,
        type: type || "camera",
        color: NODE_COLORS[type] || NODE_COLORS.camera,
        val: 8,
        imageUrl: node.imageUrl,
      };
    });
  } catch (error) {
    console.error("[Neo4j Topology] Error getting connected nodes:", error);
    return [];
  }
}

/**
 * Find shortest path between two nodes
 */
export async function findShortestPath(
  startNodeId: string,
  endNodeId: string
): Promise<{ nodes: string[]; length: number } | null> {
  if (!isNeo4jConfigured()) return null;

  try {
    const result = await runQuery<any>(
      `
      MATCH path = shortestPath((start {id: $startId})-[*]-(end {id: $endId}))
      RETURN [n IN nodes(path) | n.id] as nodeIds, length(path) as pathLength
      `,
      { startId: startNodeId, endId: endNodeId }
    );

    if (result.length === 0) return null;

    return {
      nodes: result[0].nodeIds,
      length: toNumber(result[0].pathLength),
    };
  } catch (error) {
    console.error("[Neo4j Topology] Error finding shortest path:", error);
    return null;
  }
}

/**
 * Get events with images for a specific camera
 */
export async function getCameraEventsWithImages(
  cameraId: string,
  limit: number = 10
): Promise<Neo4jEvent[]> {
  if (!isNeo4jConfigured()) return [];

  try {
    const result = await runQuery<any>(
      `
      MATCH (e:Event)-[:TRIGGERED]->(c:Camera {id: $cameraId})
      WHERE e.imageUrl IS NOT NULL
      RETURN e
      ORDER BY e.timestamp DESC
      LIMIT $limit
      `,
      { cameraId, limit }
    );

    return result.map((record) => nodeToObject<Neo4jEvent>(record.e));
  } catch (error) {
    console.error("[Neo4j Topology] Error getting camera events:", error);
    return [];
  }
}

/**
 * Bulk sync cameras from PostgreSQL data
 */
export async function bulkSyncCameras(
  cameras: Array<{
    id: string;
    name?: string;
    latitude?: number;
    longitude?: number;
    region?: string;
    status?: string;
  }>
): Promise<void> {
  if (!isNeo4jConfigured() || cameras.length === 0) return;

  await writeTransaction(async (tx) => {
    // Batch create/update cameras
    await tx.run(
      `
      UNWIND $cameras as camera
      MERGE (c:Camera {id: camera.id})
      SET c.name = camera.name,
          c.latitude = camera.latitude,
          c.longitude = camera.longitude,
          c.region = camera.region,
          c.status = camera.status,
          c.updatedAt = timestamp()
      `,
      {
        cameras: cameras.map((c) => ({
          id: c.id,
          name: c.name || `Camera ${c.id}`,
          latitude: c.latitude || null,
          longitude: c.longitude || null,
          region: c.region || null,
          status: c.status || "active",
        })),
      }
    );

    // Create location nodes for unique regions
    const regionSet = new Set(cameras.map((c) => c.region).filter(Boolean));
    const regions = Array.from(regionSet);
    if (regions.length > 0) {
      await tx.run(
        `
        UNWIND $regions as region
        WITH region, 'location-' + replace(toLower(region), ' ', '-') as locationId
        MERGE (l:Location {id: locationId})
        SET l.name = region
        `,
        { regions }
      );

      // Create LOCATED_AT relationships
      await tx.run(
        `
        UNWIND $cameras as camera
        WITH camera
        WHERE camera.region IS NOT NULL
        MATCH (c:Camera {id: camera.id})
        MATCH (l:Location {id: 'location-' + replace(toLower(camera.region), ' ', '-')})
        MERGE (c)-[:LOCATED_AT]->(l)
        `,
        {
          cameras: cameras
            .filter((c) => c.region)
            .map((c) => ({ id: c.id, region: c.region })),
        }
      );
    }
  });

  console.log(`[Neo4j Topology] Synced ${cameras.length} cameras`);
}

/**
 * Bulk sync events from PostgreSQL data
 */
export async function bulkSyncEvents(
  events: Array<{
    id: string;
    eventId?: string;
    topic?: string;
    channelId?: string;
    startTime?: number;
    params?: any;
    imageUrl?: string;
  }>
): Promise<void> {
  if (!isNeo4jConfigured() || events.length === 0) return;

  // Filter events that have images
  const eventsWithImages = events.filter((e) => e.imageUrl);

  if (eventsWithImages.length === 0) return;

  await writeTransaction(async (tx) => {
    // Create event nodes
    await tx.run(
      `
      UNWIND $events as event
      MERGE (e:Event {id: event.id})
      SET e.eventId = event.eventId,
          e.type = event.type,
          e.timestamp = event.timestamp,
          e.imageUrl = event.imageUrl,
          e.channelId = event.channelId
      `,
      {
        events: eventsWithImages.map((e) => ({
          id: e.id,
          eventId: e.eventId || e.id,
          type: e.topic || "Unknown",
          timestamp: e.startTime || Date.now(),
          imageUrl: e.imageUrl,
          channelId: e.channelId || null,
        })),
      }
    );

    // Create TRIGGERED relationships to cameras
    const eventsWithChannels = eventsWithImages.filter((e) => e.channelId);
    if (eventsWithChannels.length > 0) {
      await tx.run(
        `
        UNWIND $events as event
        MATCH (e:Event {id: event.id})
        MATCH (c:Camera {id: event.channelId})
        MERGE (e)-[:TRIGGERED]->(c)
        `,
        {
          events: eventsWithChannels.map((e) => ({
            id: e.id,
            channelId: e.channelId,
          })),
        }
      );
    }
  });

  console.log(`[Neo4j Topology] Synced ${eventsWithImages.length} events with images`);
}

/**
 * Search images based on analysis criteria
 */
export async function searchImages(criteria: {
  tag?: string;
  object?: string;
  color?: string;
  minQuality?: number;
  limit?: number;
}): Promise<Neo4jEvent[]> {
  if (!isNeo4jConfigured()) return [];

  const limit = criteria.limit || 50;
  const conditions: string[] = ["e.imageUrl IS NOT NULL"];
  const params: any = { limit };

  if (criteria.tag) {
    conditions.push("any(tag IN e.tags WHERE toLower(tag) CONTAINS toLower($tag))");
    params.tag = criteria.tag;
  }

  if (criteria.object) {
    conditions.push("any(obj IN e.objects WHERE toLower(obj) CONTAINS toLower($object))");
    params.object = criteria.object;
  }

  if (criteria.color) {
    conditions.push("any(col IN e.dominantColors WHERE toLower(col) CONTAINS toLower($color))");
    params.color = criteria.color;
  }

  if (criteria.minQuality) {
    conditions.push("e.qualityScore >= $minQuality");
    params.minQuality = criteria.minQuality;
  }

  try {
    const result = await runQuery<any>(
      `
      MATCH (e:Event)
      WHERE ${conditions.join(" AND ")}
      RETURN e
      ORDER BY e.timestamp DESC
      LIMIT $limit
      `,
      params
    );

    return result.map((record) => nodeToObject<Neo4jEvent>(record.e));
  } catch (error) {
    console.error("[Neo4j Analysis] Error searching images:", error);
    return [];
  }
}

/**
 * Search events by Gemini AI analysis criteria
 */
export async function searchEventsByGemini(criteria: {
  hasWeapons?: boolean;
  minPeopleCount?: number;
  maxPeopleCount?: number;
  licensePlate?: string;
  vehicleType?: string;
  clothingColor?: string;
  textContains?: string;
  minQualityScore?: number;
  maxBlurScore?: number;
  tag?: string;
  limit?: number;
}): Promise<Neo4jEvent[]> {
  if (!isNeo4jConfigured()) return [];

  // Ensure limit is an integer (Neo4j requires integer for LIMIT)
  const limit = Math.floor(criteria.limit || 50);
  const conditions: string[] = ["e.geminiProcessedAt IS NOT NULL"];
  const params: any = { limit: neo4j.int(limit) };

  if (criteria.hasWeapons === true) {
    conditions.push("size(e.geminiWeapons) > 0");
  }

  if (criteria.minPeopleCount !== undefined) {
    conditions.push("e.geminiPeopleCount >= $minPeopleCount");
    params.minPeopleCount = criteria.minPeopleCount;
  }

  if (criteria.maxPeopleCount !== undefined) {
    conditions.push("e.geminiPeopleCount <= $maxPeopleCount");
    params.maxPeopleCount = criteria.maxPeopleCount;
  }

  if (criteria.licensePlate) {
    conditions.push("any(plate IN e.geminiLicensePlates WHERE toUpper(plate) CONTAINS toUpper($licensePlate))");
    params.licensePlate = criteria.licensePlate;
  }

  if (criteria.vehicleType) {
    conditions.push("any(v IN e.geminiVehicles WHERE toLower(v) CONTAINS toLower($vehicleType))");
    params.vehicleType = criteria.vehicleType;
  }

  if (criteria.clothingColor) {
    conditions.push("any(c IN e.geminiClothingColors WHERE toLower(c) CONTAINS toLower($clothingColor))");
    params.clothingColor = criteria.clothingColor;
  }

  if (criteria.textContains) {
    conditions.push("any(t IN e.geminiTextExtracted WHERE toLower(t) CONTAINS toLower($textContains))");
    params.textContains = criteria.textContains;
  }

  if (criteria.minQualityScore !== undefined) {
    conditions.push("e.geminiQualityScore >= $minQualityScore");
    params.minQualityScore = criteria.minQualityScore;
  }

  if (criteria.maxBlurScore !== undefined) {
    conditions.push("e.geminiBlurScore <= $maxBlurScore");
    params.maxBlurScore = criteria.maxBlurScore;
  }

  if (criteria.tag) {
    conditions.push("any(tag IN e.geminiTags WHERE toLower(tag) CONTAINS toLower($tag))");
    params.tag = criteria.tag;
  }

  try {
    const result = await runQuery<any>(
      `
      MATCH (e:Event)
      WHERE ${conditions.join(" AND ")}
      RETURN e
      ORDER BY e.timestamp DESC
      LIMIT $limit
      `,
      params
    );

    return result.map((record) => nodeToObject<Neo4jEvent>(record.e));
  } catch (error) {
    console.error("[Neo4j Gemini Search] Error:", error);
    return [];
  }
}

/**
 * Get Gemini analysis statistics
 */
export async function getGeminiAnalysisStats(): Promise<{
  totalProcessed: number;
  withWeapons: number;
  withLicensePlates: number;
  withMultiplePeople: number;
  avgQualityScore: number;
  topVehicleTypes: Array<{ type: string; count: number }>;
  topClothingColors: Array<{ color: string; count: number }>;
} | null> {
  if (!isNeo4jConfigured()) return null;

  try {
    return await readTransaction(async (tx) => {
      // Total processed
      const totalResult = await tx.run(`
        MATCH (e:Event) WHERE e.geminiProcessedAt IS NOT NULL
        RETURN count(e) as total
      `);
      const totalProcessed = toNumber(totalResult.records[0]?.get("total") || 0);

      // With weapons
      const weaponsResult = await tx.run(`
        MATCH (e:Event) WHERE e.geminiProcessedAt IS NOT NULL AND size(e.geminiWeapons) > 0
        RETURN count(e) as count
      `);
      const withWeapons = toNumber(weaponsResult.records[0]?.get("count") || 0);

      // With license plates
      const platesResult = await tx.run(`
        MATCH (e:Event) WHERE e.geminiProcessedAt IS NOT NULL AND size(e.geminiLicensePlates) > 0
        RETURN count(e) as count
      `);
      const withLicensePlates = toNumber(platesResult.records[0]?.get("count") || 0);

      // With multiple people
      const peopleResult = await tx.run(`
        MATCH (e:Event) WHERE e.geminiProcessedAt IS NOT NULL AND e.geminiPeopleCount > 1
        RETURN count(e) as count
      `);
      const withMultiplePeople = toNumber(peopleResult.records[0]?.get("count") || 0);

      // Average quality score
      const qualityResult = await tx.run(`
        MATCH (e:Event) WHERE e.geminiProcessedAt IS NOT NULL AND e.geminiQualityScore IS NOT NULL
        RETURN avg(e.geminiQualityScore) as avgQuality
      `);
      const avgQualityScore = qualityResult.records[0]?.get("avgQuality") || 0;

      // Top vehicle types
      const vehiclesResult = await tx.run(`
        MATCH (e:Event) WHERE e.geminiProcessedAt IS NOT NULL
        UNWIND e.geminiVehicles as vehicle
        WITH split(vehicle, ' - ')[0] as vehicleType
        RETURN vehicleType as type, count(*) as count
        ORDER BY count DESC
        LIMIT 10
      `);
      const topVehicleTypes = vehiclesResult.records.map((r: any) => ({
        type: r.get("type"),
        count: toNumber(r.get("count")),
      }));

      // Top clothing colors
      const colorsResult = await tx.run(`
        MATCH (e:Event) WHERE e.geminiProcessedAt IS NOT NULL
        UNWIND e.geminiClothingColors as color
        RETURN toLower(color) as color, count(*) as count
        ORDER BY count DESC
        LIMIT 10
      `);
      const topClothingColors = colorsResult.records.map((r: any) => ({
        color: r.get("color"),
        count: toNumber(r.get("count")),
      }));

      return {
        totalProcessed,
        withWeapons,
        withLicensePlates,
        withMultiplePeople,
        avgQualityScore: typeof avgQualityScore === 'number' ? avgQualityScore : 0,
        topVehicleTypes,
        topClothingColors,
      };
    });
  } catch (error) {
    console.error("[Neo4j Gemini Stats] Error:", error);
    return null;
  }
}

/**
 * Get statistics for image analysis dashboard
 */
export async function getImageAnalysisStats(): Promise<{
  totalImages: number;
  topTags: Array<{ tag: string; count: number }>;
  topObjects: Array<{ object: string; count: number }>;
  colorDistribution: Array<{ color: string; count: number }>;
} | null> {
  if (!isNeo4jConfigured()) return null;

  try {
    return await readTransaction(async (tx) => {
      // Total images
      const totalResult = await tx.run(`
        MATCH (e:Event) WHERE e.imageUrl IS NOT NULL
        RETURN count(e) as total
      `);
      const totalImages = toNumber(totalResult.records[0].get("total"));

      // Top tags
      const tagsResult = await tx.run(`
        MATCH (e:Event) WHERE e.imageUrl IS NOT NULL
        UNWIND e.tags as tag
        RETURN tag, count(*) as count
        ORDER BY count DESC
        LIMIT 10
      `);
      const topTags = tagsResult.records.map((r: any) => ({
        tag: r.get("tag"),
        count: toNumber(r.get("count")),
      }));

      // Top objects
      const objectsResult = await tx.run(`
        MATCH (e:Event) WHERE e.imageUrl IS NOT NULL
        UNWIND e.objects as obj
        RETURN obj, count(*) as count
        ORDER BY count DESC
        LIMIT 10
      `);
      const topObjects = objectsResult.records.map((r: any) => ({
        object: r.get("obj"),
        count: toNumber(r.get("count")),
      }));

      // Color distribution (simplified)
      const colorsResult = await tx.run(`
        MATCH (e:Event) WHERE e.imageUrl IS NOT NULL
        UNWIND e.dominantColors as color
        RETURN color, count(*) as count
        ORDER BY count DESC
        LIMIT 10
      `);
      const colorDistribution = colorsResult.records.map((r: any) => ({
        color: r.get("color"),
        count: toNumber(r.get("count")),
      }));

      return {
        totalImages,
        topTags,
        topObjects,
        colorDistribution,
      };
    });
  } catch (error) {
    console.error("[Neo4j Analysis] Error getting stats:", error);
    return null;
  }
}

