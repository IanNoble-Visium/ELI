/**
 * Analytics Tab Component
 * 
 * Main container for the Trends & Predictions analytics dashboard.
 * Features Grafana-style time series visualizations and predictive analysis.
 */
import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import {
    RefreshCw,
    TrendingUp,
    TrendingDown,
    Activity,
    AlertTriangle,
    Clock,
    Zap,
    Target,
    Download,
    Calendar,
} from "lucide-react";
import { motion } from "framer-motion";
import { EventsTrendChart } from "./EventsTrendChart";
import { ActivityHeatmap } from "./ActivityHeatmap";
import { AlertDistributionChart } from "./AlertDistributionChart";
import { PredictionChart } from "./PredictionChart";
import { RegionalComparisonChart } from "./RegionalComparisonChart";
import { HourlyActivityChart } from "./HourlyActivityChart";

// Animation variants
const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
        opacity: 1,
        transition: {
            staggerChildren: 0.1,
            delayChildren: 0.1,
        },
    },
};

const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: {
        opacity: 1,
        y: 0,
        transition: {
            duration: 0.4,
            ease: [0.25, 0.46, 0.45, 0.94],
        },
    },
};

// Types
interface TimeSeriesData {
    timestamp: string;
    value: number;
}

interface HeatmapData {
    hour: number;
    day: number;
    value: number;
}

interface AlertDistribution {
    date: string;
    critical: number;
    high: number;
    medium: number;
    low: number;
}

interface ForecastPoint {
    timestamp: string;
    predicted: number;
    lower: number;
    upper: number;
}

interface AnomalyPoint {
    timestamp: string;
    actual: number;
    expected: number;
    deviation: number;
    isAnomaly: boolean;
}

interface TrendAnalysis {
    direction: "increasing" | "decreasing" | "stable";
    slope: number;
    percentChange: number;
    confidence: number;
}

interface AnalyticsData {
    eventsOverTime: TimeSeriesData[];
    alertsOverTime: TimeSeriesData[];
    cameraActivityHeatmap: HeatmapData[];
    eventTypesTrend: any[];
    alertDistribution: AlertDistribution[];
    regionalComparison: any[];
    hourlyActivity: TimeSeriesData[];
    influxMetrics?: {
        credits: TimeSeriesData[];
        storage: TimeSeriesData[];
        bandwidth: TimeSeriesData[];
        transformations: TimeSeriesData[];
        resources: TimeSeriesData[];
    };
}

interface PredictionsData {
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
}

export function AnalyticsTab() {
    const [timeRange, setTimeRange] = useState("7d");
    const [analyticsData, setAnalyticsData] = useState<AnalyticsData | null>(null);
    const [predictionsData, setPredictionsData] = useState<PredictionsData | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [autoRefresh, setAutoRefresh] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Fetch analytics data
    const fetchAnalytics = useCallback(async () => {
        try {
            setError(null);
            console.log("[AnalyticsTab] Fetching analytics with timeRange:", timeRange);

            const [analyticsRes, predictionsRes] = await Promise.all([
                fetch(`/api/analytics/time-series?timeRange=${timeRange}`, {
                    credentials: "include",
                }),
                fetch(`/api/analytics/predictions?historicalDays=${timeRange === "24h" ? 7 : timeRange === "7d" ? 14 : 30}`, {
                    credentials: "include",
                }),
            ]);

            console.log("[AnalyticsTab] Analytics response status:", analyticsRes.status);
            console.log("[AnalyticsTab] Predictions response status:", predictionsRes.status);

            if (analyticsRes.ok) {
                const analyticsJson = await analyticsRes.json();
                console.log("[AnalyticsTab] Analytics data:", analyticsJson.success, "points:", analyticsJson.data?.eventsOverTime?.length || 0);
                if (analyticsJson.success && analyticsJson.data) {
                    setAnalyticsData(analyticsJson.data);
                }
            } else {
                console.error("[AnalyticsTab] Analytics API error:", analyticsRes.status, analyticsRes.statusText);
            }

            if (predictionsRes.ok) {
                const predictionsJson = await predictionsRes.json();
                console.log("[AnalyticsTab] Predictions data:", predictionsJson.success, "forecast:", predictionsJson.data?.eventsForecast?.length || 0);
                if (predictionsJson.success && predictionsJson.data) {
                    setPredictionsData(predictionsJson.data);
                }
            } else {
                console.error("[AnalyticsTab] Predictions API error:", predictionsRes.status, predictionsRes.statusText);
            }
        } catch (err) {
            console.error("[AnalyticsTab] Fetch error:", err);
            setError("Failed to load analytics data");
        } finally {
            setIsLoading(false);
            setIsRefreshing(false);
        }
    }, [timeRange]);

    // Initial fetch
    useEffect(() => {
        setIsLoading(true);
        fetchAnalytics();
    }, [fetchAnalytics]);

    // Auto-refresh
    useEffect(() => {
        if (!autoRefresh) return;
        const interval = setInterval(() => {
            setIsRefreshing(true);
            fetchAnalytics();
        }, 60000); // Refresh every minute
        return () => clearInterval(interval);
    }, [autoRefresh, fetchAnalytics]);

    // Manual refresh
    const handleRefresh = () => {
        setIsRefreshing(true);
        fetchAnalytics();
    };

    // Export data as CSV
    const handleExport = () => {
        if (!analyticsData) return;

        const csv = [
            ["Timestamp", "Events", "Alerts"],
            ...analyticsData.eventsOverTime.map((e, i) => [
                e.timestamp,
                e.value,
                analyticsData.alertsOverTime[i]?.value || 0,
            ]),
        ].map(row => row.join(",")).join("\n");

        const blob = new Blob([csv], { type: "text/csv" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `analytics-${timeRange}-${new Date().toISOString().split("T")[0]}.csv`;
        a.click();
        URL.revokeObjectURL(url);
    };

    // Loading skeleton
    if (isLoading) {
        return (
            <div className="space-y-6">
                {/* KPI Cards Skeleton */}
                <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
                    {[1, 2, 3, 4].map((i) => (
                        <Card key={i}>
                            <CardHeader className="pb-2">
                                <Skeleton className="h-4 w-24" />
                            </CardHeader>
                            <CardContent>
                                <Skeleton className="h-8 w-20 mb-2" />
                                <Skeleton className="h-3 w-32" />
                            </CardContent>
                        </Card>
                    ))}
                </div>

                {/* Charts Skeleton */}
                <div className="grid lg:grid-cols-2 gap-6">
                    {[1, 2, 3, 4].map((i) => (
                        <Card key={i}>
                            <CardHeader>
                                <Skeleton className="h-5 w-40" />
                                <Skeleton className="h-4 w-56" />
                            </CardHeader>
                            <CardContent>
                                <Skeleton className="h-[300px] w-full rounded-lg" />
                            </CardContent>
                        </Card>
                    ))}
                </div>
            </div>
        );
    }

    // Error state
    if (error) {
        return (
            <Card className="border-destructive/50">
                <CardContent className="flex flex-col items-center justify-center py-12">
                    <AlertTriangle className="w-12 h-12 text-destructive mb-4" />
                    <h3 className="text-lg font-semibold mb-2">Failed to Load Analytics</h3>
                    <p className="text-muted-foreground mb-4">{error}</p>
                    <Button onClick={handleRefresh}>
                        <RefreshCw className="w-4 h-4 mr-2" />
                        Retry
                    </Button>
                </CardContent>
            </Card>
        );
    }

    const trends = predictionsData?.trends;
    const kpi = predictionsData?.kpiProjections;

    return (
        <motion.div
            className="space-y-6"
            variants={containerVariants}
            initial="hidden"
            animate="visible"
        >
            {/* Header Controls */}
            <div className="flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-2">
                    <Calendar className="w-5 h-5 text-muted-foreground" />
                    <Select value={timeRange} onValueChange={setTimeRange}>
                        <SelectTrigger className="w-[160px]">
                            <SelectValue placeholder="Time range" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="24h">Last 24 Hours</SelectItem>
                            <SelectItem value="7d">Last 7 Days</SelectItem>
                            <SelectItem value="30d">Last 30 Days</SelectItem>
                            <SelectItem value="90d">Last 90 Days</SelectItem>
                        </SelectContent>
                    </Select>
                </div>

                <div className="flex items-center gap-2">
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setAutoRefresh(!autoRefresh)}
                        className={autoRefresh ? "border-green-500/50 text-green-500" : ""}
                    >
                        <RefreshCw className={`w-4 h-4 mr-2 ${autoRefresh ? "animate-spin" : ""}`} />
                        {autoRefresh ? "Auto-refresh ON" : "Auto-refresh"}
                    </Button>

                    <Button variant="outline" size="sm" onClick={handleExport}>
                        <Download className="w-4 h-4 mr-2" />
                        Export
                    </Button>

                    <Button
                        variant="outline"
                        size="sm"
                        onClick={handleRefresh}
                        disabled={isRefreshing}
                    >
                        <RefreshCw className={`w-4 h-4 ${isRefreshing ? "animate-spin" : ""}`} />
                    </Button>
                </div>
            </div>

            {/* KPI Projection Cards */}
            <motion.div
                className="grid md:grid-cols-2 lg:grid-cols-4 gap-4"
                variants={containerVariants}
            >
                {/* Predicted Events */}
                <motion.div variants={itemVariants}>
                    <Card className="hover:border-primary/50 transition-colors">
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">Predicted Events</CardTitle>
                            <Target className="w-4 h-4 text-primary" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">
                                {kpi?.eventsNextPeriod?.toLocaleString() || "—"}
                            </div>
                            <p className="text-xs text-muted-foreground mt-1">
                                Expected in next 24h
                            </p>
                        </CardContent>
                    </Card>
                </motion.div>

                {/* Trend Direction */}
                <motion.div variants={itemVariants}>
                    <Card className="hover:border-primary/50 transition-colors">
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">Trend</CardTitle>
                            {trends?.events.direction === "increasing" ? (
                                <TrendingUp className="w-4 h-4 text-green-500" />
                            ) : trends?.events.direction === "decreasing" ? (
                                <TrendingDown className="w-4 h-4 text-red-500" />
                            ) : (
                                <Activity className="w-4 h-4 text-blue-500" />
                            )}
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">
                                {kpi?.trendDirection || "— Stable"}
                            </div>
                            <p className="text-xs text-muted-foreground mt-1">
                                {trends?.events.percentChange
                                    ? `${trends.events.percentChange > 0 ? "+" : ""}${trends.events.percentChange.toFixed(1)}% change`
                                    : "No significant change"}
                            </p>
                        </CardContent>
                    </Card>
                </motion.div>

                {/* Peak Activity Time */}
                <motion.div variants={itemVariants}>
                    <Card className="hover:border-primary/50 transition-colors">
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">Peak Activity</CardTitle>
                            <Clock className="w-4 h-4 text-orange-500" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">
                                {kpi?.expectedPeakTime || "—"}
                            </div>
                            <p className="text-xs text-muted-foreground mt-1">
                                Expected busiest hour
                            </p>
                        </CardContent>
                    </Card>
                </motion.div>

                {/* Confidence Level */}
                <motion.div variants={itemVariants}>
                    <Card className="hover:border-primary/50 transition-colors">
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">Confidence</CardTitle>
                            <Zap className="w-4 h-4 text-yellow-500" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">
                                {kpi?.confidenceLevel ? `${kpi.confidenceLevel}%` : "—"}
                            </div>
                            <div className="flex items-center gap-2 mt-1">
                                <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                                    <div
                                        className="h-full bg-gradient-to-r from-yellow-500 to-green-500 rounded-full transition-all"
                                        style={{ width: `${kpi?.confidenceLevel || 0}%` }}
                                    />
                                </div>
                                <span className="text-xs text-muted-foreground">R²</span>
                            </div>
                        </CardContent>
                    </Card>
                </motion.div>
            </motion.div>

            {/* Main Charts Grid */}
            <motion.div
                className="grid lg:grid-cols-2 gap-6"
                variants={containerVariants}
            >
                {/* Events Trend with Forecast */}
                <motion.div variants={itemVariants} className="lg:col-span-2">
                    <PredictionChart
                        historicalData={analyticsData?.eventsOverTime || []}
                        forecastData={predictionsData?.eventsForecast || []}
                        anomalies={predictionsData?.anomalies || []}
                        title="Events Trend & Forecast"
                        description="Historical events with predicted future values and anomaly detection"
                    />
                </motion.div>

                {/* Events Over Time */}
                <motion.div variants={itemVariants}>
                    <EventsTrendChart
                        eventsData={analyticsData?.eventsOverTime || []}
                        alertsData={analyticsData?.alertsOverTime || []}
                        title="Events vs Alerts"
                        description="Comparative view of all events and alert-level events"
                    />
                </motion.div>

                {/* Alert Distribution */}
                <motion.div variants={itemVariants}>
                    <AlertDistributionChart
                        data={analyticsData?.alertDistribution || []}
                        title="Alert Severity Distribution"
                        description="Breakdown by severity level over time"
                    />
                </motion.div>

                {/* Activity Heatmap */}
                <motion.div variants={itemVariants}>
                    <ActivityHeatmap
                        data={analyticsData?.cameraActivityHeatmap || []}
                        title="Activity Patterns"
                        description="Camera activity by hour and day of week"
                    />
                </motion.div>

                {/* Hourly Activity */}
                <motion.div variants={itemVariants}>
                    <HourlyActivityChart
                        data={analyticsData?.hourlyActivity || []}
                        peakHours={trends?.peakHours || []}
                        title="Hourly Distribution"
                        description="Activity pattern throughout the day"
                    />
                </motion.div>

                {/* Regional Comparison */}
                <motion.div variants={itemVariants} className="lg:col-span-2">
                    <RegionalComparisonChart
                        data={analyticsData?.regionalComparison || []}
                        title="Regional Activity Comparison"
                        description="Event distribution across different regions over time"
                    />
                </motion.div>
            </motion.div>

            {/* Anomaly Alerts */}
            {predictionsData?.anomalies && predictionsData.anomalies.filter(a => a.isAnomaly).length > 0 && (
                <motion.div variants={itemVariants}>
                    <Card className="border-orange-500/30 bg-orange-500/5">
                        <CardHeader>
                            <div className="flex items-center gap-2">
                                <AlertTriangle className="w-5 h-5 text-orange-500" />
                                <CardTitle>Detected Anomalies</CardTitle>
                            </div>
                            <CardDescription>
                                Unusual patterns detected in the selected time range
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="flex flex-wrap gap-2">
                                {predictionsData.anomalies
                                    .filter(a => a.isAnomaly)
                                    .slice(0, 10)
                                    .map((anomaly, i) => (
                                        <Badge
                                            key={i}
                                            variant="outline"
                                            className="border-orange-500/50 text-orange-400"
                                        >
                                            {anomaly.timestamp}: {anomaly.actual} events
                                            ({anomaly.deviation > 0 ? "+" : ""}{anomaly.deviation.toFixed(1)}σ)
                                        </Badge>
                                    ))}
                            </div>
                        </CardContent>
                    </Card>
                </motion.div>
            )}
        </motion.div>
    );
}

export default AnalyticsTab;
