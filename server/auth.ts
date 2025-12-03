import { SignJWT, jwtVerify } from "jose";
import { ENV } from "./_core/env";

/**
 * Hardcoded credentials for demo purposes
 * Username: admin
 * Password: admin
 */
const DEMO_CREDENTIALS = {
  username: "admin",
  password: "admin",
  user: {
    id: 1,
    openId: "demo-admin",
    name: "Administrator",
    email: "admin@eli-dashboard.pe",
    role: "admin" as const,
    loginMethod: "hardcoded",
  },
};

/**
 * Validate hardcoded credentials
 */
export function validateCredentials(username: string, password: string): boolean {
  return username === DEMO_CREDENTIALS.username && password === DEMO_CREDENTIALS.password;
}

/**
 * Get demo user object
 */
export function getDemoUser() {
  return DEMO_CREDENTIALS.user;
}

/**
 * Generate JWT token for authenticated user
 * Uses the same format as sdk.ts expects: openId, appId, name
 */
export async function generateToken(userId: number): Promise<string> {
  const user = DEMO_CREDENTIALS.user;
  const secretKey = new TextEncoder().encode(ENV.cookieSecret);
  
  const token = await new SignJWT({ 
    openId: user.openId,
    appId: ENV.appId || "eli-dashboard",
    name: user.name,
  })
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setIssuedAt()
    .setExpirationTime("24h")
    .sign(secretKey);
  return token;
}

/**
 * Verify JWT token and extract user ID
 */
export async function verifyToken(token: string): Promise<number | null> {
  try {
    const secretKey = new TextEncoder().encode(ENV.cookieSecret);
    const { payload } = await jwtVerify(token, secretKey);
    // Return 1 for demo user
    return payload.openId === DEMO_CREDENTIALS.user.openId ? 1 : null;
  } catch {
    return null;
  }
}
