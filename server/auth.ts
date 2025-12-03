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

// Use environment secret or fallback to a development secret
const cookieSecret = ENV.cookieSecret || "eli-dashboard-dev-secret-change-in-production-2024";
const JWT_SECRET = new TextEncoder().encode(cookieSecret);

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
 */
export async function generateToken(userId: number): Promise<string> {
  const token = await new SignJWT({ userId })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("24h")
    .sign(JWT_SECRET);
  return token;
}

/**
 * Verify JWT token and extract user ID
 */
export async function verifyToken(token: string): Promise<number | null> {
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);
    return payload.userId as number;
  } catch {
    return null;
  }
}
