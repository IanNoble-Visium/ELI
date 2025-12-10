/**
 * Analytics Predictions API
 * 
 * Provides predictive analysis capabilities including:
 * - Time series forecasting using linear regression and exponential smoothing
 * - Anomaly detection using statistical deviation analysis
 * - Trend analysis with confidence intervals
 */
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getDb, events, and, gte, lte, desc, count } from "../lib/db.js";
import { calculateUsageRate, isInfluxDBConfigured } from "../lib/influxdb.js";

// Types for predictions
interface ForecastPoint {
    timestamp: string;
    predicted: number;
    lower: number;  // Lower confidence bound
    upper: number;  // Upper confidence bound
}

interface AnomalyPoint {
    timestamp: string;
    actual: number;
    expected: number;
    deviation: number;  // Standard deviations from mean
    isAnomaly: boolean;
}

interface TrendAnalysis {
    direction: "increasing" | "decreasing" | "stable";
    slope: number;
    percentChange: number;
    confidence: number;
}

interface PredictionsResponse {
    success: boolean;
    data?: {
        eventsForecast: ForecastPoint[];
        alertsForecast: ForecastPoint[];
        anomalies: AnomalyPoint[];
        trends: {
            events: TrendAnalysis;
            alerts: TrendAnalysis;
            peakHours: number[];
            predictedNextDayEvents: number;
            predictedNextWeekEvents: number;
        };
        kpiProjections: {
            eventsNextPeriod: number;
            expectedPeakTime: string;
            trendDirection: string;
            confidenceLevel: number;
        };
        // InfluxDB forecasts if available
        influxForecasts?: {
            creditsDepletion?: string;  // Estimated date when credits will deplete
            storageGrowthRate?: number;
            bandwidthTrend?: TrendAnalysis;
        };
    };
    meta?: {
        forecastDays: number;
        historicalDays: number;
        anomalyThreshold: number;
        algorithm: string;
        influxDBConfigured: boolean;
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
        const forecastDays = parseInt(req.query.forecastDays as string) || 7;
        const historicalDays = parseInt(req.query.historicalDays as string) || 30;
        const anomalyThreshold = parseFloat(req.query.anomalyThreshold as string) || 2.0;

        const db = await getDb();

        const response: PredictionsResponse = {
            success: true,
            data: {
                eventsForecast: [],
                alertsForecast: [],
                anomalies: [],
                trends: {
                    events: { direction: "stable", slope: 0, percentChange: 0, confidence: 0 },
                    alerts: { direction: "stable", slope: 0, percentChange: 0, confidence: 0 },
                    peakHours: [],
                    predictedNextDayEvents: 0,
                    predictedNextWeekEvents: 0,
                },
                kpiProjections: {
                    eventsNextPeriod: 0,
                    expectedPeakTime: "Unknown",
                    trendDirection: "Stable",
                    confidenceLevel: 0,
                },
            },
            meta: {
                forecastDays,
                historicalDays,
                anomalyThreshold,
                algorithm: "Linear Regression + Exponential Smoothing",
                influxDBConfigured: isInfluxDBConfigured(),
            },
        };

        if (db) {
            const now = Date.now();
            const startTime = now - historicalDays * 24 * 60 * 60 * 1000;

            // Get historical daily event counts
            const dailyEvents = await getDailyEventCounts(db, startTime, now);
            const dailyAlerts = await getDailyAlertCounts(db, startTime, now);

            // Generate forecasts
            if (dailyEvents.length > 2) {
                response.data!.eventsForecast = generateForecast(dailyEvents, forecastDays);
                response.data!.trends.events = analyzeTrend(dailyEvents);
            }

            if (dailyAlerts.length > 2) {
                response.data!.alertsForecast = generateForecast(dailyAlerts, forecastDays);
                response.data!.trends.alerts = analyzeTrend(dailyAlerts);
            }

            // Detect anomalies
            if (dailyEvents.length > 5) {
                response.data!.anomalies = detectAnomalies(dailyEvents, anomalyThreshold);
            }

            // Get peak hours
            const peakHours = await getPeakHours(db, startTime, now);
            response.data!.trends.peakHours = peakHours;

            // Calculate predictions
            const avgDaily = dailyEvents.reduce((sum, d) => sum + d.value, 0) / dailyEvents.length;
            const trend = response.data!.trends.events;

            response.data!.trends.predictedNextDayEvents = Math.round(
                avgDaily * (1 + trend.percentChange / 100)
            );
            response.data!.trends.predictedNextWeekEvents = Math.round(
                avgDaily * 7 * (1 + (trend.percentChange * 7) / 100)
            );

            // KPI Projections
            response.data!.kpiProjections = {
                eventsNextPeriod: response.data!.trends.predictedNextDayEvents,
                expectedPeakTime: peakHours.length > 0
                    ? `${String(peakHours[0]).padStart(2, "0")}:00 - ${String(peakHours[0] + 1).padStart(2, "0")}:00`
                    : "Unknown",
                trendDirection: trend.direction === "increasing" ? "↑ Increasing" :
                    trend.direction === "decreasing" ? "↓ Decreasing" : "→ Stable",
                confidenceLevel: trend.confidence,
            };
        }

        // Get InfluxDB forecasts if configured
        if (isInfluxDBConfigured()) {
            try {
                const usageRates = await calculateUsageRate(historicalDays);
                if (usageRates.success && usageRates.rates) {
                    // Calculate credits depletion date
                    // This is a simplified calculation
                    const creditsPerDay = usageRates.rates.credits_per_day;
                    if (creditsPerDay > 0) {
                        const daysRemaining = Math.floor(25000 / creditsPerDay); // Assuming 25K monthly limit
                        const depletionDate = new Date();
                        depletionDate.setDate(depletionDate.getDate() + daysRemaining);

                        response.data!.influxForecasts = {
                            creditsDepletion: depletionDate.toISOString(),
                            storageGrowthRate: usageRates.rates.storage_per_day,
                            bandwidthTrend: {
                                direction: usageRates.rates.bandwidth_per_day > 0 ? "increasing" : "stable",
                                slope: usageRates.rates.bandwidth_per_day,
                                percentChange: 0,
                                confidence: 0.7,
                            },
                        };
                    }
                }
            } catch (error) {
                console.error("[Predictions] InfluxDB forecast error:", error);
            }
        }

        res.status(200).json(response);
    } catch (error: any) {
        console.error("[Predictions API] Error:", error);
        res.status(500).json({
            success: false,
            error: error.message || "Internal server error",
        });
    }
}

// Helper to get daily event counts
interface DailyCount {
    date: string;
    value: number;
}

async function getDailyEventCounts(
    db: any,
    startTime: number,
    endTime: number
): Promise<DailyCount[]> {
    try {
        const eventRecords = await db
            .select()
            .from(events)
            .where(and(gte(events.startTime, startTime), lte(events.startTime, endTime)));

        const buckets = new Map<string, number>();

        for (const event of eventRecords) {
            const date = new Date(event.startTime || Date.now());
            const dateKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
            buckets.set(dateKey, (buckets.get(dateKey) || 0) + 1);
        }

        return Array.from(buckets.entries())
            .map(([date, value]) => ({ date, value }))
            .sort((a, b) => a.date.localeCompare(b.date));
    } catch (error) {
        console.error("[Predictions] getDailyEventCounts error:", error);
        return [];
    }
}

async function getDailyAlertCounts(
    db: any,
    startTime: number,
    endTime: number
): Promise<DailyCount[]> {
    try {
        const alertRecords = await db
            .select()
            .from(events)
            .where(and(
                gte(events.startTime, startTime),
                lte(events.startTime, endTime),
                gte(events.level, "2")
            ));

        const buckets = new Map<string, number>();

        for (const alert of alertRecords) {
            const date = new Date(alert.startTime || Date.now());
            const dateKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
            buckets.set(dateKey, (buckets.get(dateKey) || 0) + 1);
        }

        return Array.from(buckets.entries())
            .map(([date, value]) => ({ date, value }))
            .sort((a, b) => a.date.localeCompare(b.date));
    } catch (error) {
        console.error("[Predictions] getDailyAlertCounts error:", error);
        return [];
    }
}

async function getPeakHours(
    db: any,
    startTime: number,
    endTime: number
): Promise<number[]> {
    try {
        const eventRecords = await db
            .select()
            .from(events)
            .where(and(gte(events.startTime, startTime), lte(events.startTime, endTime)));

        const hourCounts = new Array(24).fill(0);

        for (const event of eventRecords) {
            const date = new Date(event.startTime || Date.now());
            hourCounts[date.getHours()]++;
        }

        // Find top 3 peak hours
        const hourIndices = hourCounts
            .map((count, hour) => ({ hour, count }))
            .sort((a, b) => b.count - a.count)
            .slice(0, 3)
            .map(({ hour }) => hour);

        return hourIndices;
    } catch (error) {
        console.error("[Predictions] getPeakHours error:", error);
        return [];
    }
}

// Linear regression for forecasting
function generateForecast(
    historicalData: DailyCount[],
    forecastDays: number
): ForecastPoint[] {
    if (historicalData.length < 2) return [];

    // Prepare data for regression
    const n = historicalData.length;
    const x = Array.from({ length: n }, (_, i) => i);
    const y = historicalData.map((d) => d.value);

    // Calculate linear regression coefficients
    const sumX = x.reduce((a, b) => a + b, 0);
    const sumY = y.reduce((a, b) => a + b, 0);
    const sumXY = x.reduce((sum, xi, i) => sum + xi * y[i], 0);
    const sumX2 = x.reduce((sum, xi) => sum + xi * xi, 0);

    const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
    const intercept = (sumY - slope * sumX) / n;

    // Calculate standard error for confidence intervals
    const predicted = x.map((xi) => slope * xi + intercept);
    const residuals = y.map((yi, i) => yi - predicted[i]);
    const stdError = Math.sqrt(
        residuals.reduce((sum, r) => sum + r * r, 0) / (n - 2)
    );

    // Apply exponential smoothing for seasonal adjustment
    const alpha = 0.3; // Smoothing factor
    let smoothedLast = y[n - 1];
    for (let i = n - 2; i >= 0; i--) {
        smoothedLast = alpha * y[i] + (1 - alpha) * smoothedLast;
    }

    // Generate forecast points
    const forecast: ForecastPoint[] = [];
    const lastDate = new Date(historicalData[n - 1].date);

    for (let i = 1; i <= forecastDays; i++) {
        const futureDate = new Date(lastDate);
        futureDate.setDate(futureDate.getDate() + i);

        const xValue = n + i - 1;
        const linearPrediction = slope * xValue + intercept;

        // Blend linear regression with exponential smoothing
        const blendedPrediction = 0.6 * linearPrediction + 0.4 * smoothedLast;
        const finalPrediction = Math.max(0, Math.round(blendedPrediction));

        // Confidence interval (95%)
        const confidenceMargin = 1.96 * stdError * Math.sqrt(1 + 1 / n + (xValue - sumX / n) ** 2 / (sumX2 - sumX * sumX / n));

        forecast.push({
            timestamp: futureDate.toISOString().split("T")[0],
            predicted: finalPrediction,
            lower: Math.max(0, Math.round(finalPrediction - confidenceMargin)),
            upper: Math.round(finalPrediction + confidenceMargin),
        });
    }

    return forecast;
}

// Analyze trend direction and strength
function analyzeTrend(data: DailyCount[]): TrendAnalysis {
    if (data.length < 2) {
        return { direction: "stable", slope: 0, percentChange: 0, confidence: 0 };
    }

    const n = data.length;
    const x = Array.from({ length: n }, (_, i) => i);
    const y = data.map((d) => d.value);

    // Linear regression
    const sumX = x.reduce((a, b) => a + b, 0);
    const sumY = y.reduce((a, b) => a + b, 0);
    const sumXY = x.reduce((sum, xi, i) => sum + xi * y[i], 0);
    const sumX2 = x.reduce((sum, xi) => sum + xi * xi, 0);

    const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
    const meanY = sumY / n;

    // Calculate R-squared for confidence
    const predicted = x.map((xi) => slope * xi + (sumY - slope * sumX) / n);
    const ssRes = y.reduce((sum, yi, i) => sum + (yi - predicted[i]) ** 2, 0);
    const ssTot = y.reduce((sum, yi) => sum + (yi - meanY) ** 2, 0);
    const rSquared = ssTot > 0 ? 1 - ssRes / ssTot : 0;

    // Calculate percent change
    const firstValue = y[0] || 1;
    const lastValue = y[n - 1];
    const percentChange = ((lastValue - firstValue) / firstValue) * 100;

    // Determine direction
    let direction: "increasing" | "decreasing" | "stable";
    if (slope > 0.5 && percentChange > 5) {
        direction = "increasing";
    } else if (slope < -0.5 && percentChange < -5) {
        direction = "decreasing";
    } else {
        direction = "stable";
    }

    return {
        direction,
        slope: Math.round(slope * 100) / 100,
        percentChange: Math.round(percentChange * 100) / 100,
        confidence: Math.round(Math.abs(rSquared) * 100),
    };
}

// Detect anomalies using z-score method
function detectAnomalies(
    data: DailyCount[],
    threshold: number
): AnomalyPoint[] {
    if (data.length < 5) return [];

    const values = data.map((d) => d.value);
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    const variance = values.reduce((sum, v) => sum + (v - mean) ** 2, 0) / values.length;
    const stdDev = Math.sqrt(variance);

    // Use rolling mean for expected values (moving average)
    const windowSize = Math.min(7, Math.floor(data.length / 3));

    return data.map((point, i) => {
        // Calculate rolling mean
        const start = Math.max(0, i - windowSize + 1);
        const window = values.slice(start, i + 1);
        const expected = window.reduce((a, b) => a + b, 0) / window.length;

        const deviation = stdDev > 0 ? (point.value - mean) / stdDev : 0;
        const isAnomaly = Math.abs(deviation) > threshold;

        return {
            timestamp: point.date,
            actual: point.value,
            expected: Math.round(expected),
            deviation: Math.round(deviation * 100) / 100,
            isAnomaly,
        };
    });
}
