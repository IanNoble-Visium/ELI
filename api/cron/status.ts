/**
 * CRON Job Status and Management API
 * 
 * Provides endpoints for:
 * - Listing all configured CRON jobs
 * - Viewing job status and history
 * - Manually triggering jobs
 * - Getting execution logs
 */
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { isInfluxDBConfigured, getInfluxDBStatus } from "../lib/influxdb.js";

// Define all registered CRON jobs
const CRON_JOBS = [
  {
    id: "record-cloudinary-metrics",
    name: "Record Cloudinary Metrics",
    description: "Fetches current Cloudinary usage and stores it in InfluxDB for historical tracking",
    path: "/api/cron/record-cloudinary-metrics",
    schedule: "*/15 * * * *",
    scheduleDescription: "Every 15 minutes",
    enabled: true,
    dependencies: ["CLOUDINARY_CLOUD_NAME", "CLOUDINARY_API_KEY", "CLOUDINARY_API_SECRET", "INFLUXDB_TOKEN", "INFLUXDB_ORG_ID"],
  },
  {
    id: "record-throttle-metrics",
    name: "Record Throttle Metrics",
    description: "Records image processing throttle statistics (processed vs skipped) to InfluxDB",
    path: "/api/cron/record-throttle-metrics",
    schedule: "*/5 * * * *",
    scheduleDescription: "Every 5 minutes",
    enabled: true,
    dependencies: ["INFLUXDB_TOKEN", "INFLUXDB_ORG_ID"],
  },
  {
    id: "process-gemini-images",
    name: "Gemini AI Image Analysis",
    description: "Analyzes surveillance images using Google Gemini AI to extract metadata (objects, people, vehicles, license plates, etc.)",
    path: "/api/cron/process-gemini-images",
    schedule: "0 * * * *",
    scheduleDescription: "Every hour",
    enabled: true,
    dependencies: ["GEMINI_API_KEY", "DATABASE_URL"],
  },
  // AI Agent CRON Jobs
  {
    id: "agent-timeline",
    name: "Timeline Agent",
    description: "Discovers temporal sequences of related events to build entity timelines across cameras",
    path: "/api/cron/agent-timeline",
    schedule: "0 * * * *",
    scheduleDescription: "Every hour",
    enabled: false,  // Disabled until implemented
    dependencies: ["GEMINI_API_KEY", "DATABASE_URL", "NEO4J_URI"],
  },
  {
    id: "agent-correlation",
    name: "Correlation Agent",
    description: "Finds groups of related events based on property similarity (order-independent)",
    path: "/api/cron/agent-correlation",
    schedule: "0 * * * *",
    scheduleDescription: "Every hour",
    enabled: false,  // Disabled until implemented
    dependencies: ["GEMINI_API_KEY", "DATABASE_URL", "NEO4J_URI"],
  },
  {
    id: "agent-anomaly",
    name: "Anomaly Agent",
    description: "Detects unusual events or patterns (fires, fights, crashes, unusual gatherings) within time/region windows",
    path: "/api/cron/agent-anomaly",
    schedule: "0 * * * *",
    scheduleDescription: "Every hour",
    enabled: false,  // Disabled until implemented
    dependencies: ["GEMINI_API_KEY", "DATABASE_URL", "NEO4J_URI"],
  },
];

interface CronJobStatus {
  id: string;
  name: string;
  description: string;
  path: string;
  schedule: string;
  scheduleDescription: string;
  enabled: boolean;
  dependenciesOk: boolean;
  missingDependencies: string[];
  lastRun?: string;
  lastStatus?: "success" | "error" | "skipped";
  lastError?: string;
  lastDuration?: number;
  nextRun?: string;
}

interface CronJobExecution {
  id: string;
  jobId: string;
  timestamp: string;
  status: "success" | "error" | "skipped";
  duration: number;
  message?: string;
  data?: Record<string, any>;
}

// In-memory storage for job execution history (in production, use a database)
const jobExecutionHistory: Map<string, CronJobExecution[]> = new Map();
const lastJobStatus: Map<string, { timestamp: string; status: string; error?: string; duration?: number }> = new Map();

// Export functions for other modules to record job executions
export function recordJobExecution(
  jobId: string,
  status: "success" | "error" | "skipped",
  duration: number,
  message?: string,
  data?: Record<string, any>
) {
  const execution: CronJobExecution = {
    id: `${jobId}_${Date.now()}`,
    jobId,
    timestamp: new Date().toISOString(),
    status,
    duration,
    message,
    data,
  };

  // Store in history (keep last 100 executions per job)
  const history = jobExecutionHistory.get(jobId) || [];
  history.unshift(execution);
  if (history.length > 100) history.pop();
  jobExecutionHistory.set(jobId, history);

  // Update last status
  lastJobStatus.set(jobId, {
    timestamp: execution.timestamp,
    status,
    error: status === "error" ? message : undefined,
    duration,
  });
}

function checkDependencies(dependencies: string[]): { ok: boolean; missing: string[] } {
  const missing = dependencies.filter(dep => !process.env[dep]);
  return { ok: missing.length === 0, missing };
}

function calculateNextRun(schedule: string): string | undefined {
  // Parse cron schedule and calculate next run time
  // This is a simplified version - for production, use a proper cron parser
  try {
    const parts = schedule.split(" ");
    if (parts.length !== 5) return undefined;

    const now = new Date();
    const [minute, hour, dayOfMonth, month, dayOfWeek] = parts;

    // Handle */N patterns for minutes
    if (minute.startsWith("*/")) {
      const interval = parseInt(minute.substring(2), 10);
      const currentMinute = now.getMinutes();
      const nextMinute = Math.ceil((currentMinute + 1) / interval) * interval;

      const nextRun = new Date(now);
      if (nextMinute >= 60) {
        nextRun.setHours(nextRun.getHours() + 1);
        nextRun.setMinutes(nextMinute - 60);
      } else {
        nextRun.setMinutes(nextMinute);
      }
      nextRun.setSeconds(0);
      nextRun.setMilliseconds(0);

      return nextRun.toISOString();
    }

    return undefined;
  } catch {
    return undefined;
  }
}

function getJobStatus(job: typeof CRON_JOBS[0]): CronJobStatus {
  const depsCheck = checkDependencies(job.dependencies);
  const lastStatus = lastJobStatus.get(job.id);

  return {
    ...job,
    dependenciesOk: depsCheck.ok,
    missingDependencies: depsCheck.missing,
    lastRun: lastStatus?.timestamp,
    lastStatus: lastStatus?.status as any,
    lastError: lastStatus?.error,
    lastDuration: lastStatus?.duration,
    nextRun: job.enabled && depsCheck.ok ? calculateNextRun(job.schedule) : undefined,
  };
}

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
): Promise<void> {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (req.method === "OPTIONS") {
    res.status(200).end();
    return;
  }

  const { action, jobId } = req.query;

  try {
    // GET /api/cron/status - List all jobs with status
    if (req.method === "GET" && !action) {
      const jobs = CRON_JOBS.map(getJobStatus);

      res.status(200).json({
        success: true,
        jobs,
        influxdb_status: getInfluxDBStatus(),
        timestamp: new Date().toISOString(),
      });
      return;
    }

    // GET /api/cron/status?action=history&jobId=xxx - Get job execution history
    if (req.method === "GET" && action === "history" && jobId) {
      const history = jobExecutionHistory.get(jobId as string) || [];

      res.status(200).json({
        success: true,
        jobId,
        history,
        total: history.length,
      });
      return;
    }

    // POST /api/cron/status?action=trigger&jobId=xxx - Manually trigger a job
    if (req.method === "POST" && action === "trigger" && jobId) {
      const job = CRON_JOBS.find(j => j.id === jobId);

      if (!job) {
        res.status(404).json({
          success: false,
          error: `Job not found: ${jobId}`,
        });
        return;
      }

      // Check dependencies
      const depsCheck = checkDependencies(job.dependencies);
      if (!depsCheck.ok) {
        res.status(400).json({
          success: false,
          error: `Missing dependencies: ${depsCheck.missing.join(", ")}`,
        });
        return;
      }

      // Trigger the job by calling its endpoint
      const startTime = Date.now();
      try {
        // For server-side calls, we need to use the full URL or internal fetch
        // In Vercel, we can call the handler directly or use internal routing
        const protocol = req.headers["x-forwarded-proto"] || "https";
        const host = req.headers.host;
        const jobUrl = `${protocol}://${host}${job.path}?manual=true`;

        const jobResponse = await fetch(jobUrl, {
          method: "GET", // Cron endpoints typically respond to GET
          headers: {
            "Content-Type": "application/json",
          },
        });

        const duration = Date.now() - startTime;
        const jobResult = await jobResponse.json();

        // Record the execution
        recordJobExecution(
          job.id,
          jobResult.status === "success" ? "success" : jobResult.status === "skipped" ? "skipped" : "error",
          duration,
          jobResult.error || jobResult.reason,
          jobResult.metrics
        );

        res.status(200).json({
          success: true,
          jobId: job.id,
          triggered: true,
          result: jobResult,
          duration,
        });

      } catch (error) {
        const duration = Date.now() - startTime;
        const errorMessage = error instanceof Error ? error.message : "Unknown error";

        recordJobExecution(job.id, "error", duration, errorMessage);

        res.status(200).json({
          success: false,
          jobId: job.id,
          triggered: true,
          error: errorMessage,
          duration,
        });
      }
      return;
    }

    // POST /api/cron/status?action=seed - Seed InfluxDB with sample data points
    if (req.method === "POST" && action === "seed") {
      if (!isInfluxDBConfigured()) {
        res.status(400).json({
          success: false,
          error: "InfluxDB not configured",
        });
        return;
      }

      // Import and call the metrics recording
      const protocol = req.headers["x-forwarded-proto"] || "https";
      const host = req.headers.host;

      // Record multiple data points with slight time offsets to create history
      const results = [];
      const intervals = [0, 5, 10, 15, 20, 25, 30]; // Minutes ago

      for (const minutesAgo of intervals) {
        const seedUrl = `${protocol}://${host}/api/cloudinary/metrics`;
        try {
          const seedResponse = await fetch(seedUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
          });
          const seedResult = await seedResponse.json();
          results.push({ minutesAgo, success: seedResult.success });
        } catch (error) {
          results.push({ minutesAgo, success: false, error: (error as Error).message });
        }
      }

      res.status(200).json({
        success: true,
        action: "seed",
        message: "Seeded InfluxDB with data points",
        results,
      });
      return;
    }

    res.status(400).json({
      success: false,
      error: "Invalid action or missing parameters",
      availableActions: ["history", "trigger", "seed"],
    });

  } catch (error) {
    console.error("[CRON Status] Error:", error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
}

