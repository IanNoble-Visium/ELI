/**
 * Analytics Time Series API
 * 
 * Provides time-aggregated data for dashboard analytics visualizations.
 * Supports multiple granularities and data types for comprehensive
 * time-series analysis and trend visualization.
 */
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getDb, events, channels, count, and, gte, lte, desc, sql, eq } from "../lib/db.js";
import { queryMetrics, isInfluxDBConfigured, queryMetricsRange } from "../lib/influxdb.js";

// Types for time series data
interface TimeSeriesDataPoint {
    timestamp: string;
    value: number;
}

interface HeatmapDataPoint {
    hour: number;
    day: number;
    value: number;
}

interface EventTypeTrend {
    date: string;
    [eventType: string]: string | number;
}

interface RegionalComparison {
    date: string;
    [region: string]: string | number;
}

interface AlertDistribution {
    date: string;
    critical: number;
    high: number;
    medium: number;
    low: number;
}

interface AnalyticsTimeSeriesResponse {
    success: boolean;
    data?: {
        eventsOverTime: TimeSeriesDataPoint[];
        alertsOverTime: TimeSeriesDataPoint[];
        cameraActivityHeatmap: HeatmapDataPoint[];
        eventTypesTrend: EventTypeTrend[];
        alertDistribution: AlertDistribution[];
        regionalComparison: RegionalComparison[];
        hourlyActivity: TimeSeriesDataPoint[];
        // InfluxDB metrics if available
        influxMetrics?: {
            credits: TimeSeriesDataPoint[];
            storage: TimeSeriesDataPoint[];
            bandwidth: TimeSeriesDataPoint[];
            transformations: TimeSeriesDataPoint[];
            resources: TimeSeriesDataPoint[];
        };
    };
    meta?: {
        timeRange: string;
        granularity: string;
        dataSource: string;
        influxDBConfigured: boolean;
        fromDate: string;
        toDate: string;
    };
    error?: string;
}

export default async function handler(
    req: VercelRequest,
    res: VercelResponse
): Promise<void> {
    // Set CORS headers
    res.setHeader("Access-Control-Allow-Origin", req.headers.origin || "*");
    res.setHeader("Access-Control-Allow-Credentials", "true");
    res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");

    if (req.method === "OPTIONS") {
        res.status(200).end();
        return;
    }

    if (req.method !== "GET") {
        res.status(405).json({ error: "Method not allowed" });
        return;
    }

    try {
        // Parse query parameters
        const timeRange = (req.query.timeRange as string) || "7d";
        const granularity = (req.query.granularity as string) || "auto";
        const fromDate = req.query.from as string;
        const toDate = req.query.to as string;

        // Calculate date range
        const now = new Date();
        let startDate: Date;
        let endDate = now;

        if (fromDate && toDate) {
            startDate = new Date(fromDate);
            endDate = new Date(toDate);
        } else {
            const rangeDays = timeRange === "24h" ? 1 :
                timeRange === "7d" ? 7 :
                    timeRange === "30d" ? 30 :
                        timeRange === "90d" ? 90 : 7;
            startDate = new Date(now.getTime() - rangeDays * 24 * 60 * 60 * 1000);
        }

        // Determine granularity based on range
        const effectiveGranularity = granularity === "auto"
            ? determineGranularity(startDate, endDate)
            : granularity;

        // Get database connection
        const db = await getDb();

        console.log("[Analytics Time Series] Query params:", { timeRange, granularity: effectiveGranularity, from: startDate.toISOString(), to: endDate.toISOString() });
        console.log("[Analytics Time Series] Database connected:", !!db);

        const response: AnalyticsTimeSeriesResponse = {
            success: true,
            data: {
                eventsOverTime: [],
                alertsOverTime: [],
                cameraActivityHeatmap: [],
                eventTypesTrend: [],
                alertDistribution: [],
                regionalComparison: [],
                hourlyActivity: [],
            },
            meta: {
                timeRange,
                granularity: effectiveGranularity,
                dataSource: db ? "PostgreSQL" : "None",
                influxDBConfigured: isInfluxDBConfigured(),
                fromDate: startDate.toISOString(),
                toDate: endDate.toISOString(),
            },
        };

        if (db) {
            // Get events over time
            response.data!.eventsOverTime = await getEventsOverTime(
                db,
                startDate.getTime(),
                endDate.getTime(),
                effectiveGranularity
            );

            // Get alerts over time
            response.data!.alertsOverTime = await getAlertsOverTime(
                db,
                startDate.getTime(),
                endDate.getTime(),
                effectiveGranularity
            );

            // Get camera activity heatmap
            response.data!.cameraActivityHeatmap = await getCameraActivityHeatmap(
                db,
                startDate.getTime(),
                endDate.getTime()
            );

            // Get event types trend
            response.data!.eventTypesTrend = await getEventTypesTrend(
                db,
                startDate.getTime(),
                endDate.getTime(),
                effectiveGranularity
            );

            // Get alert distribution by severity
            response.data!.alertDistribution = await getAlertDistribution(
                db,
                startDate.getTime(),
                endDate.getTime(),
                effectiveGranularity
            );

            // Get regional comparison
            response.data!.regionalComparison = await getRegionalComparison(
                db,
                startDate.getTime(),
                endDate.getTime(),
                effectiveGranularity
            );

            // Get hourly activity pattern
            response.data!.hourlyActivity = await getHourlyActivity(
                db,
                startDate.getTime(),
                endDate.getTime()
            );

            console.log("[Analytics Time Series] Data retrieved:", {
                eventsOverTime: response.data!.eventsOverTime.length,
                alertsOverTime: response.data!.alertsOverTime.length,
                heatmap: response.data!.cameraActivityHeatmap.length,
                alertDistribution: response.data!.alertDistribution.length,
                hourlyActivity: response.data!.hourlyActivity.length,
            });
        }

        // Get InfluxDB metrics if configured
        if (isInfluxDBConfigured()) {
            try {
                const influxRange = timeRange === "24h" ? "24h" :
                    timeRange === "7d" ? "7d" :
                        timeRange === "30d" ? "30d" : "7d";

                const metricsResult = await queryMetrics(influxRange);
                if (metricsResult.success && metricsResult.data) {
                    response.data!.influxMetrics = {
                        credits: metricsResult.data.credits,
                        storage: metricsResult.data.storage,
                        bandwidth: metricsResult.data.bandwidth,
                        transformations: metricsResult.data.transformations,
                        resources: metricsResult.data.resources,
                    };
                    response.meta!.dataSource = db ? "PostgreSQL + InfluxDB" : "InfluxDB";
                }
            } catch (error) {
                console.error("[Analytics] InfluxDB query error:", error);
            }
        }

        res.status(200).json(response);
    } catch (error: any) {
        console.error("[Analytics Time Series API] Error:", error);
        res.status(500).json({
            success: false,
            error: error.message || "Internal server error",
        });
    }
}

// Helper function to determine appropriate granularity
function determineGranularity(startDate: Date, endDate: Date): string {
    const diffMs = endDate.getTime() - startDate.getTime();
    const diffDays = diffMs / (24 * 60 * 60 * 1000);

    if (diffDays <= 1) return "hourly";
    if (diffDays <= 7) return "daily";
    if (diffDays <= 30) return "daily";
    return "weekly";
}

// Get time bucket for aggregation
function getTimeBucket(timestamp: number, granularity: string): string {
    const date = new Date(timestamp);

    switch (granularity) {
        case "hourly":
            return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")} ${String(date.getHours()).padStart(2, "0")}:00`;
        case "daily":
            return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
        case "weekly":
            const weekStart = new Date(date);
            weekStart.setDate(date.getDate() - date.getDay());
            return `${weekStart.getFullYear()}-${String(weekStart.getMonth() + 1).padStart(2, "0")}-${String(weekStart.getDate()).padStart(2, "0")}`;
        default:
            return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
    }
}

// Get events over time
async function getEventsOverTime(
    db: any,
    startTime: number,
    endTime: number,
    granularity: string
): Promise<TimeSeriesDataPoint[]> {
    try {
        const eventRecords = await db
            .select()
            .from(events)
            .where(and(gte(events.startTime, startTime), lte(events.startTime, endTime)))
            .orderBy(events.startTime);

        const buckets = new Map<string, number>();

        for (const event of eventRecords) {
            const bucket = getTimeBucket(event.startTime || Date.now(), granularity);
            buckets.set(bucket, (buckets.get(bucket) || 0) + 1);
        }

        return Array.from(buckets.entries())
            .map(([timestamp, value]) => ({ timestamp, value }))
            .sort((a, b) => a.timestamp.localeCompare(b.timestamp));
    } catch (error) {
        console.error("[Analytics] getEventsOverTime error:", error);
        return [];
    }
}

// Get alerts over time (level >= 2)
async function getAlertsOverTime(
    db: any,
    startTime: number,
    endTime: number,
    granularity: string
): Promise<TimeSeriesDataPoint[]> {
    try {
        const alertRecords = await db
            .select()
            .from(events)
            .where(and(
                gte(events.startTime, startTime),
                lte(events.startTime, endTime),
                gte(events.level, "2")
            ))
            .orderBy(events.startTime);

        const buckets = new Map<string, number>();

        for (const alert of alertRecords) {
            const bucket = getTimeBucket(alert.startTime || Date.now(), granularity);
            buckets.set(bucket, (buckets.get(bucket) || 0) + 1);
        }

        return Array.from(buckets.entries())
            .map(([timestamp, value]) => ({ timestamp, value }))
            .sort((a, b) => a.timestamp.localeCompare(b.timestamp));
    } catch (error) {
        console.error("[Analytics] getAlertsOverTime error:", error);
        return [];
    }
}

// Get camera activity heatmap (hour of day vs day of week)
async function getCameraActivityHeatmap(
    db: any,
    startTime: number,
    endTime: number
): Promise<HeatmapDataPoint[]> {
    try {
        const eventRecords = await db
            .select()
            .from(events)
            .where(and(gte(events.startTime, startTime), lte(events.startTime, endTime)));

        const heatmap = new Map<string, number>();

        for (const event of eventRecords) {
            const date = new Date(event.startTime || Date.now());
            const hour = date.getHours();
            const day = date.getDay(); // 0-6 (Sunday-Saturday)
            const key = `${hour}-${day}`;
            heatmap.set(key, (heatmap.get(key) || 0) + 1);
        }

        const result: HeatmapDataPoint[] = [];
        for (let hour = 0; hour < 24; hour++) {
            for (let day = 0; day < 7; day++) {
                const key = `${hour}-${day}`;
                result.push({
                    hour,
                    day,
                    value: heatmap.get(key) || 0,
                });
            }
        }

        return result;
    } catch (error) {
        console.error("[Analytics] getCameraActivityHeatmap error:", error);
        return [];
    }
}

// Get event types trend over time
async function getEventTypesTrend(
    db: any,
    startTime: number,
    endTime: number,
    granularity: string
): Promise<EventTypeTrend[]> {
    try {
        const eventRecords = await db
            .select()
            .from(events)
            .where(and(gte(events.startTime, startTime), lte(events.startTime, endTime)))
            .orderBy(events.startTime);

        const buckets = new Map<string, Map<string, number>>();
        const eventTypes = new Set<string>();

        for (const event of eventRecords) {
            const bucket = getTimeBucket(event.startTime || Date.now(), granularity);
            const eventType = event.topic || "Unknown";
            eventTypes.add(eventType);

            if (!buckets.has(bucket)) {
                buckets.set(bucket, new Map());
            }
            const typeCounts = buckets.get(bucket)!;
            typeCounts.set(eventType, (typeCounts.get(eventType) || 0) + 1);
        }

        return Array.from(buckets.entries())
            .map(([date, typeCounts]) => {
                const trend: EventTypeTrend = { date };
                for (const type of eventTypes) {
                    trend[type] = typeCounts.get(type) || 0;
                }
                return trend;
            })
            .sort((a, b) => a.date.localeCompare(b.date));
    } catch (error) {
        console.error("[Analytics] getEventTypesTrend error:", error);
        return [];
    }
}

// Get alert distribution by severity over time
async function getAlertDistribution(
    db: any,
    startTime: number,
    endTime: number,
    granularity: string
): Promise<AlertDistribution[]> {
    try {
        const eventRecords = await db
            .select()
            .from(events)
            .where(and(gte(events.startTime, startTime), lte(events.startTime, endTime)))
            .orderBy(events.startTime);

        const buckets = new Map<string, { critical: number; high: number; medium: number; low: number }>();

        for (const event of eventRecords) {
            const bucket = getTimeBucket(event.startTime || Date.now(), granularity);
            const level = parseInt(event.level) || 0;

            if (!buckets.has(bucket)) {
                buckets.set(bucket, { critical: 0, high: 0, medium: 0, low: 0 });
            }
            const counts = buckets.get(bucket)!;

            if (level >= 3) counts.critical++;
            else if (level === 2) counts.high++;
            else if (level === 1) counts.medium++;
            else counts.low++;
        }

        return Array.from(buckets.entries())
            .map(([date, counts]) => ({
                date,
                ...counts,
            }))
            .sort((a, b) => a.date.localeCompare(b.date));
    } catch (error) {
        console.error("[Analytics] getAlertDistribution error:", error);
        return [];
    }
}

// Get regional comparison over time
async function getRegionalComparison(
    db: any,
    startTime: number,
    endTime: number,
    granularity: string
): Promise<RegionalComparison[]> {
    try {
        const eventRecords = await db
            .select()
            .from(events)
            .where(and(gte(events.startTime, startTime), lte(events.startTime, endTime)))
            .orderBy(events.startTime);

        const buckets = new Map<string, Map<string, number>>();
        const regions = new Set<string>();

        for (const event of eventRecords) {
            const bucket = getTimeBucket(event.startTime || Date.now(), granularity);
            const region = event.channelAddress?.city || event.channelAddress?.province || "Unknown";
            regions.add(region);

            if (!buckets.has(bucket)) {
                buckets.set(bucket, new Map());
            }
            const regionCounts = buckets.get(bucket)!;
            regionCounts.set(region, (regionCounts.get(region) || 0) + 1);
        }

        // Get top 5 regions by total events
        const regionTotals = new Map<string, number>();
        for (const typeCounts of buckets.values()) {
            for (const [region, count] of typeCounts.entries()) {
                regionTotals.set(region, (regionTotals.get(region) || 0) + count);
            }
        }
        const topRegions = Array.from(regionTotals.entries())
            .sort((a, b) => b[1] - a[1])
            .slice(0, 5)
            .map(([region]) => region);

        return Array.from(buckets.entries())
            .map(([date, regionCounts]) => {
                const comparison: RegionalComparison = { date };
                for (const region of topRegions) {
                    comparison[region] = regionCounts.get(region) || 0;
                }
                return comparison;
            })
            .sort((a, b) => a.date.localeCompare(b.date));
    } catch (error) {
        console.error("[Analytics] getRegionalComparison error:", error);
        return [];
    }
}

// Get hourly activity pattern (aggregated across all days)
async function getHourlyActivity(
    db: any,
    startTime: number,
    endTime: number
): Promise<TimeSeriesDataPoint[]> {
    try {
        const eventRecords = await db
            .select()
            .from(events)
            .where(and(gte(events.startTime, startTime), lte(events.startTime, endTime)));

        const hourCounts = new Array(24).fill(0);

        for (const event of eventRecords) {
            const date = new Date(event.startTime || Date.now());
            const hour = date.getHours();
            hourCounts[hour]++;
        }

        return hourCounts.map((value, hour) => ({
            timestamp: `${String(hour).padStart(2, "0")}:00`,
            value,
        }));
    } catch (error) {
        console.error("[Analytics] getHourlyActivity error:", error);
        return [];
    }
}
