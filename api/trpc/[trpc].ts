import type { VercelRequest, VercelResponse } from "@vercel/node";
import { parse as parseCookieHeader, serialize } from "cookie";
import { SignJWT, jwtVerify } from "jose";

// Constants
const COOKIE_NAME = "eli_session";
const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || "eli-dashboard-dev-secret-change-in-production-2024"
);

// Demo user credentials
const DEMO_USER = {
  id: "demo-user-001",
  openId: "demo-admin",
  name: "Administrator",
  email: "admin@eli.peru.gob.pe",
  role: "admin",
};

// Check if request is secure
function isSecureRequest(req: VercelRequest): boolean {
  const proto = req.headers["x-forwarded-proto"];
  if (!proto) return false;
  const protoStr = Array.isArray(proto) ? proto[0] : proto;
  return protoStr.includes("https");
}

// Get cookie options
function getCookieOptions(req: VercelRequest) {
  const isSecure = isSecureRequest(req);
  return {
    httpOnly: true,
    path: "/",
    sameSite: isSecure ? ("none" as const) : ("lax" as const),
    secure: isSecure,
  };
}

// Verify session token
async function verifyToken(token: string) {
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);
    return payload;
  } catch {
    return null;
  }
}

// Generate session token
async function generateToken(user: typeof DEMO_USER) {
  return await new SignJWT({
    userId: user.id,
    openId: user.openId,
    appId: process.env.VITE_APP_ID || "",
    name: user.name,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("24h")
    .sign(JWT_SECRET);
}

// Get current user from cookie
async function getCurrentUser(req: VercelRequest) {
  const cookieHeader = req.headers.cookie || "";
  const cookies = parseCookieHeader(cookieHeader);
  const token = cookies[COOKIE_NAME];

  if (!token) return null;

  const payload = await verifyToken(token);
  if (!payload) return null;

  if (payload.openId === "demo-admin") {
    return DEMO_USER;
  }

  return null;
}

// Vercel serverless handler
export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Set CORS headers
  const origin = req.headers.origin || "*";
  res.setHeader("Access-Control-Allow-Origin", origin);
  res.setHeader("Access-Control-Allow-Credentials", "true");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, Cookie");

  // Handle preflight
  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  try {
    const url = new URL(req.url || "", `https://${req.headers.host}`);
    const path = url.pathname.replace("/api/trpc/", "").split("?")[0];
    const cookieOptions = getCookieOptions(req);

    // Parse body for mutations
    let input: any = {};
    if (req.method === "POST" && req.body) {
      const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body;
      // Handle tRPC batch format: { "0": { "json": {...} } }
      if (body && body["0"] && body["0"].json) {
        input = body["0"].json;
      } else if (body && body.json) {
        input = body.json;
      } else {
        input = body;
      }
    }

    // Route: auth.login
    if (path === "auth.login") {
      const { username, password } = input;

      if (username !== "admin" || password !== "admin") {
        return res.status(200).json([{
          error: {
            json: {
              message: "Invalid credentials",
              code: -32001,
              data: { code: "UNAUTHORIZED", httpStatus: 401 }
            }
          }
        }]);
      }

      const token = await generateToken(DEMO_USER);
      const cookie = serialize(COOKIE_NAME, token, {
        ...cookieOptions,
        maxAge: 24 * 60 * 60, // 24 hours in seconds
      });
      res.setHeader("Set-Cookie", cookie);

      return res.status(200).json([{
        result: {
          data: {
            json: {
              success: true,
              user: {
                id: DEMO_USER.id,
                name: DEMO_USER.name,
                role: DEMO_USER.role,
              }
            }
          }
        }
      }]);
    }

    // Route: auth.me
    if (path === "auth.me") {
      const user = await getCurrentUser(req);
      return res.status(200).json([{
        result: {
          data: {
            json: user
          }
        }
      }]);
    }

    // Route: auth.logout
    if (path === "auth.logout") {
      const cookie = serialize(COOKIE_NAME, "", {
        ...cookieOptions,
        maxAge: -1,
      });
      res.setHeader("Set-Cookie", cookie);

      return res.status(200).json([{
        result: {
          data: {
            json: { success: true }
          }
        }
      }]);
    }

    // Route: dashboard.metrics
    if (path === "dashboard.metrics") {
      return res.status(200).json([{
        result: {
          data: {
            json: {
              totalEvents: 0,
              totalChannels: 3084,
              activeChannels: 359,
            }
          }
        }
      }]);
    }

    // Route: config.get
    if (path === "config.get") {
      return res.status(200).json([{
        result: {
          data: {
            json: null
          }
        }
      }]);
    }

    // Route: config.set
    if (path === "config.set") {
      return res.status(200).json([{
        result: {
          data: {
            json: { success: true }
          }
        }
      }]);
    }

    // Route: config.purge
    if (path === "config.purge") {
      return res.status(200).json([{
        result: {
          data: {
            json: {
              success: true,
              deletedEvents: 0,
              deletedSnapshots: 0,
              deletedWebhookRequests: 0,
            }
          }
        }
      }]);
    }

    // Route: webhook.recent
    if (path === "webhook.recent") {
      return res.status(200).json([{
        result: {
          data: {
            json: []
          }
        }
      }]);
    }

    // Route: incidents.*
    if (path.startsWith("incidents.")) {
      return res.status(200).json([{
        result: {
          data: {
            json: path.includes("get") ? [] : { success: true }
          }
        }
      }]);
    }

    // Route: events.*
    if (path.startsWith("events.")) {
      return res.status(200).json([{
        result: {
          data: {
            json: []
          }
        }
      }]);
    }

    // Route: channels.*
    if (path.startsWith("channels.")) {
      return res.status(200).json([{
        result: {
          data: {
            json: []
          }
        }
      }]);
    }

    // Route: snapshots.*
    if (path.startsWith("snapshots.")) {
      return res.status(200).json([{
        result: {
          data: {
            json: []
          }
        }
      }]);
    }

    // Not found
    console.log("[tRPC] Unknown path:", path);
    return res.status(200).json([{
      error: {
        json: {
          message: `Procedure not found: ${path}`,
          code: -32004,
          data: { code: "NOT_FOUND", httpStatus: 404 }
        }
      }
    }]);

  } catch (error: any) {
    console.error("[tRPC Handler Error]", error);
    return res.status(200).json([{
      error: {
        json: {
          message: error.message || "Internal server error",
          code: -32603,
          data: { code: "INTERNAL_SERVER_ERROR", httpStatus: 500 }
        }
      }
    }]);
  }
}
