import type { VercelRequest, VercelResponse } from "@vercel/node";
import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import { parse as parseCookieHeader, serialize } from "cookie";
import { SignJWT, jwtVerify } from "jose";
import { appRouter } from "../../server/routers";
import { COOKIE_NAME } from "../../shared/const";
import * as db from "../../server/db";
import type { User } from "../../drizzle/schema";

// Load environment variables
import "dotenv/config";

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || "eli-dashboard-dev-secret-change-in-production-2024"
);

// Create context for Vercel fetch adapter
async function createFetchContext(req: Request): Promise<{
  req: Request;
  res: {
    cookie: (name: string, value: string, options: any) => void;
    clearCookie: (name: string, options: any) => void;
  };
  user: User | null;
  setCookies: string[];
}> {
  let user: User | null = null;
  const setCookies: string[] = [];
  
  try {
    const cookieHeader = req.headers.get("cookie") || "";
    const cookies = parseCookieHeader(cookieHeader);
    const token = cookies[COOKIE_NAME];
    
    if (token) {
      const { payload } = await jwtVerify(token, JWT_SECRET);
      const openId = payload.openId as string;
      
      // Check for demo admin
      if (openId === "demo-admin") {
        user = {
          id: "demo-user-001",
          openId: "demo-admin",
          name: "Administrator",
          email: "admin@eli.peru.gob.pe",
          role: "admin",
          loginMethod: "password",
          lastSignedIn: new Date(),
        } as User;
      } else {
        user = (await db.getUserByOpenId(openId)) || null;
      }
    }
  } catch (error) {
    console.error("[Auth] Error verifying token:", error);
    user = null;
  }
  
  return {
    req,
    res: {
      cookie: (name: string, value: string, options: any) => {
        setCookies.push(serialize(name, value, {
          httpOnly: options.httpOnly ?? true,
          path: options.path ?? "/",
          sameSite: options.sameSite ?? "lax",
          secure: options.secure ?? process.env.NODE_ENV === "production",
          maxAge: options.maxAge ? options.maxAge / 1000 : undefined,
        }));
      },
      clearCookie: (name: string, options: any) => {
        setCookies.push(serialize(name, "", {
          httpOnly: true,
          path: options.path ?? "/",
          sameSite: options.sameSite ?? "lax",
          secure: options.secure ?? process.env.NODE_ENV === "production",
          maxAge: -1,
        }));
      },
    },
    user,
    setCookies,
  };
}

// Vercel serverless handler
export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Handle CORS for preflight requests
  if (req.method === "OPTIONS") {
    res.setHeader("Access-Control-Allow-Origin", req.headers.origin || "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, Cookie");
    res.setHeader("Access-Control-Allow-Credentials", "true");
    return res.status(200).end();
  }

  // Convert Vercel request to Fetch API request
  const protocol = req.headers["x-forwarded-proto"] || "https";
  const host = req.headers["x-forwarded-host"] || req.headers.host;
  const url = `${protocol}://${host}${req.url}`;
  
  const headers = new Headers();
  for (const [key, value] of Object.entries(req.headers)) {
    if (value) {
      headers.set(key, Array.isArray(value) ? value.join(", ") : value);
    }
  }

  const fetchRequest = new Request(url, {
    method: req.method,
    headers,
    body: req.method !== "GET" && req.method !== "HEAD" ? JSON.stringify(req.body) : undefined,
  });

  // Create context that will track cookies
  const ctx = await createFetchContext(fetchRequest);

  try {
    const response = await fetchRequestHandler({
      endpoint: "/api/trpc",
      req: fetchRequest,
      router: appRouter,
      createContext: () => ctx as any,
      onError: ({ error, path }) => {
        console.error(`[tRPC Error] ${path}:`, error);
      },
    });

    // Set CORS headers
    res.setHeader("Access-Control-Allow-Origin", req.headers.origin || "*");
    res.setHeader("Access-Control-Allow-Credentials", "true");

    // Set cookies from context
    if (ctx.setCookies.length > 0) {
      res.setHeader("Set-Cookie", ctx.setCookies);
    }

    // Copy response headers
    response.headers.forEach((value, key) => {
      if (key.toLowerCase() !== "set-cookie") {
        res.setHeader(key, value);
      }
    });

    // Send response
    const body = await response.text();
    res.status(response.status).send(body);
  } catch (error: any) {
    console.error("[Handler Error]", error);
    res.status(500).json({ error: "Internal server error" });
  }
}
