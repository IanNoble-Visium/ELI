import type { VercelRequest, VercelResponse } from "@vercel/node";

// Global store reference
declare global {
  var recentEventsStore: EventData[] | undefined;
}

interface EventData {
  id: string;
  eventId: string;
  topic: string;
  module: string;
  level: number;
  startTime: number;
  endTime?: number;
  channel: {
    id: string;
    name: string;
    type: string;
    latitude?: number;
    longitude?: number;
    address?: {
      country?: string;
      region?: string;
      city?: string;
      street?: string;
    };
  };
  params?: any;
  snapshotsCount: number;
  hasImages: boolean;
  receivedAt: string;
  processingTime: number;
}

// Initialize store
if (!global.recentEventsStore) {
  global.recentEventsStore = [];
}

// Peru regions with coordinates for generating realistic events
const PERU_REGIONS = [
  { name: "Lima", lat: -12.0464, lng: -77.0428 },
  { name: "Cusco", lat: -13.5320, lng: -71.9675 },
  { name: "Arequipa", lat: -16.4090, lng: -71.5375 },
  { name: "Trujillo", lat: -8.1116, lng: -79.0288 },
  { name: "Piura", lat: -5.1945, lng: -80.6328 },
  { name: "Chiclayo", lat: -6.7714, lng: -79.8409 },
  { name: "Iquitos", lat: -3.7489, lng: -73.2516 },
  { name: "Huancayo", lat: -12.0651, lng: -75.2049 },
];

const EVENT_TOPICS = ["FaceMatched", "PlateMatched", "Motion", "Intrusion", "Loitering", "Crowd"];
const EVENT_MODULES = ["KX.Faces", "KX.PDD", "KX.Motion", "KX.Analytics", "KX.Crowd"];

// Generate events list with real webhook data merged
const getEvents = (limit: number = 100): EventData[] => {
  const realEvents = global.recentEventsStore || [];
  
  // If we have enough real events, use them
  if (realEvents.length >= limit) {
    return realEvents.slice(0, limit);
  }
  
  // Otherwise, generate some realistic baseline events
  const events: EventData[] = [...realEvents];
  const needed = limit - events.length;
  
  for (let i = 0; i < needed; i++) {
    const region = PERU_REGIONS[Math.floor(Math.random() * PERU_REGIONS.length)];
    const topic = EVENT_TOPICS[Math.floor(Math.random() * EVENT_TOPICS.length)];
    const now = Date.now();
    const startTime = now - Math.floor(Math.random() * 7200000); // Last 2 hours
    
    events.push({
      id: `evt_${startTime}_${Math.random().toString(36).substr(2, 9)}`,
      eventId: `${Math.floor(Math.random() * 1000)}:${startTime}:${Math.floor(Math.random() * 1000000000)}`,
      topic,
      module: EVENT_MODULES[Math.floor(Math.random() * EVENT_MODULES.length)],
      level: Math.floor(Math.random() * 4),
      startTime,
      endTime: startTime + Math.floor(Math.random() * 60000),
      channel: {
        id: String(Math.floor(Math.random() * 3000) + 1),
        name: `CAM-${region.name.substring(0, 3).toUpperCase()}-${String(Math.floor(Math.random() * 999) + 1).padStart(4, "0")}`,
        type: "STREAM",
        latitude: region.lat + (Math.random() - 0.5) * 0.2,
        longitude: region.lng + (Math.random() - 0.5) * 0.2,
        address: {
          country: "Peru",
          region: region.name,
          city: region.name,
        },
      },
      params: topic === "FaceMatched" ? {
        identities: [{
          faces: [{ id: Math.floor(Math.random() * 10000), similarity: 0.8 + Math.random() * 0.2 }],
          list: { id: Math.floor(Math.random() * 10), name: "Watch List", level: Math.floor(Math.random() * 4) },
        }],
      } : topic === "PlateMatched" ? {
        identities: [{
          plates: [{ 
            id: Math.floor(Math.random() * 10000), 
            number: `${String.fromCharCode(65 + Math.floor(Math.random() * 26))}${String.fromCharCode(65 + Math.floor(Math.random() * 26))}${String.fromCharCode(65 + Math.floor(Math.random() * 26))}-${Math.floor(Math.random() * 999)}`,
            state: "PE"
          }],
          list: { id: Math.floor(Math.random() * 10), name: "Vehicle List", level: Math.floor(Math.random() * 4) },
        }],
      } : {},
      snapshotsCount: Math.floor(Math.random() * 3) + 1,
      hasImages: Math.random() > 0.3,
      receivedAt: new Date(startTime).toISOString(),
      processingTime: Math.floor(Math.random() * 100) + 10,
    });
  }
  
  // Sort by received time (most recent first)
  return events.sort((a, b) => 
    new Date(b.receivedAt).getTime() - new Date(a.receivedAt).getTime()
  ).slice(0, limit);
};

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
    const limit = parseInt(req.query.limit as string) || 100;
    const level = req.query.level as string;
    const topic = req.query.topic as string;
    const region = req.query.region as string;
    
    let events = getEvents(limit * 2); // Get extra for filtering
    
    // Apply filters
    if (level && level !== "all") {
      events = events.filter(e => e.level === parseInt(level));
    }
    
    if (topic && topic !== "all") {
      events = events.filter(e => e.topic === topic);
    }
    
    if (region && region !== "all") {
      events = events.filter(e => e.channel.address?.city === region || e.channel.address?.region === region);
    }
    
    events = events.slice(0, limit);

    return res.status(200).json({
      success: true,
      count: events.length,
      events,
    });

  } catch (error: any) {
    console.error("[Events API] Error:", error);
    return res.status(500).json({
      success: false,
      error: error.message || "Internal server error",
    });
  }
}

// Export for webhook handler
export function addEvent(eventData: EventData) {
  if (!global.recentEventsStore) {
    global.recentEventsStore = [];
  }
  
  global.recentEventsStore.unshift(eventData);
  
  // Keep last 1000 events
  if (global.recentEventsStore.length > 1000) {
    global.recentEventsStore.pop();
  }
}

