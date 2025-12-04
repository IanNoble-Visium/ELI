import type { VercelRequest, VercelResponse } from "@vercel/node";

// Note: In a real production setup, this would read from a database
// For the serverless demo, we'll return mock data since each function instance
// has its own memory space

// Mock recent webhooks for demo
const generateMockWebhooks = () => {
  const topics = ["FaceMatched", "PlateMatched", "Motion", "Intrusion", "Loitering"];
  const modules = ["KX.Faces", "KX.PDD", "KX.Motion", "KX.Analytics"];
  const levels = [0, 1, 2, 3];
  const cities = ["Lima", "Cusco", "Arequipa", "Trujillo", "Piura"];
  const streets = ["Av. Javier Prado", "Av. Arequipa", "Av. La Marina", "Calle Los Olivos", "Jr. Union"];

  return Array.from({ length: 50 }, (_, i) => {
    const topic = topics[Math.floor(Math.random() * topics.length)];
    const now = Date.now();
    const receivedAt = new Date(now - Math.random() * 3600000).toISOString(); // Last hour
    
    return {
      id: `webhook_${now}_${Math.random().toString(36).substr(2, 9)}`,
      receivedAt,
      processingTime: Math.floor(Math.random() * 100) + 10,
      status: "success",
      
      eventId: `${100 + i}:${now}:${Math.floor(Math.random() * 1000000000)}`,
      monitorId: Math.floor(Math.random() * 200) + 1,
      topic,
      module: modules[Math.floor(Math.random() * modules.length)],
      level: levels[Math.floor(Math.random() * levels.length)],
      startTime: now - Math.floor(Math.random() * 60000),
      endTime: now,
      
      channel: {
        id: Math.floor(Math.random() * 3000) + 1,
        name: `CAM-${String(Math.floor(Math.random() * 999) + 1).padStart(3, "0")}`,
        type: "STREAM",
        latitude: -12.0464 + (Math.random() - 0.5) * 2,
        longitude: -77.0428 + (Math.random() - 0.5) * 2,
        address: {
          country: "Peru",
          city: cities[Math.floor(Math.random() * cities.length)],
          street: streets[Math.floor(Math.random() * streets.length)],
        },
      },
      
      params: topic === "FaceMatched" ? {
        identities: [{
          faces: [{
            id: Math.floor(Math.random() * 10000),
            similarity: 0.8 + Math.random() * 0.2,
            first_name: "Unknown",
            last_name: "Person",
          }],
          list: {
            id: Math.floor(Math.random() * 10),
            name: "Watch List",
            level: levels[Math.floor(Math.random() * levels.length)],
          },
        }],
      } : topic === "PlateMatched" ? {
        identities: [{
          plates: [{
            id: Math.floor(Math.random() * 10000),
            number: `${String.fromCharCode(65 + Math.floor(Math.random() * 26))}${String.fromCharCode(65 + Math.floor(Math.random() * 26))}${String.fromCharCode(65 + Math.floor(Math.random() * 26))}-${Math.floor(Math.random() * 999)}`,
            state: "PE",
          }],
          list: {
            id: Math.floor(Math.random() * 10),
            name: "Vehicle Watch List",
            level: levels[Math.floor(Math.random() * levels.length)],
          },
        }],
      } : {},
      
      snapshotsCount: Math.floor(Math.random() * 3) + 1,
      hasImages: Math.random() > 0.3,
      payloadSize: Math.floor(Math.random() * 50000) + 1000,
    };
  });
};

// Vercel serverless handler
export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Set CORS headers
  const origin = req.headers.origin || "*";
  res.setHeader("Access-Control-Allow-Origin", origin);
  res.setHeader("Access-Control-Allow-Credentials", "true");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, Cookie");

  // Handle preflight
  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  // Only accept GET requests
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const limit = parseInt(req.query.limit as string) || 100;
    const webhooks = generateMockWebhooks().slice(0, limit);

    return res.status(200).json({
      success: true,
      count: webhooks.length,
      webhooks,
    });

  } catch (error: any) {
    console.error("[Webhooks Recent] Error:", error);
    return res.status(500).json({
      success: false,
      error: error.message || "Internal server error",
    });
  }
}

