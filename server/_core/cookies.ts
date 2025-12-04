import type { CookieOptions, Request as ExpressRequest } from "express";

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "::1"]);

function isIpAddress(host: string) {
  // Basic IPv4 check and IPv6 presence detection.
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(host)) return true;
  return host.includes(":");
}

// Check if request is secure (works with Express or Fetch Request)
function isSecureRequest(req: ExpressRequest | Request): boolean {
  // Express request
  if ("protocol" in req && typeof req.protocol === "string") {
    if (req.protocol === "https") return true;
  }
  
  // Fetch request or Express with x-forwarded-proto header
  const forwardedProto = 
    req instanceof Request 
      ? req.headers.get("x-forwarded-proto")
      : req.headers["x-forwarded-proto"];
      
  if (!forwardedProto) return false;

  const protoList = Array.isArray(forwardedProto)
    ? forwardedProto
    : forwardedProto.split(",");

  return protoList.some(proto => proto.trim().toLowerCase() === "https");
}

// Get hostname from Express or Fetch Request
function getHostname(req: ExpressRequest | Request): string {
  if (req instanceof Request) {
    const host = req.headers.get("host") || req.headers.get("x-forwarded-host") || "";
    return host.split(":")[0]; // Remove port
  }
  return req.hostname || "";
}

export function getSessionCookieOptions(
  req: ExpressRequest | Request
): Pick<CookieOptions, "domain" | "httpOnly" | "path" | "sameSite" | "secure"> {
  const isSecure = isSecureRequest(req);
  const hostname = getHostname(req);
  const isLocalhost = LOCAL_HOSTS.has(hostname);

  // For localhost/development: use "lax" sameSite (works with HTTP)
  // For production (HTTPS): use "none" sameSite with secure flag
  return {
    httpOnly: true,
    path: "/",
    sameSite: isSecure ? "none" : "lax",
    secure: isSecure,
  };
}
