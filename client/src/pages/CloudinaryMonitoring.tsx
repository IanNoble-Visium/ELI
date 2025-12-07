import { useState, useEffect, useCallback } from "react";
import { useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  ArrowLeft,
  Cloud,
  HardDrive,
  Activity,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  TrendingUp,
  Database,
  Zap,
  FileImage,
  Gauge,
  Clock,
  BarChart3,
  LineChart as LineChartIcon,
  AlertTriangle,
  Calendar,
} from "lucide-react";
import { motion } from "framer-motion";
import { format, addDays } from "date-fns";
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";

// Animation variants
const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.08,
      delayChildren: 0.1,
    },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20, scale: 0.95 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: {
      duration: 0.4,
      ease: [0.25, 0.46, 0.45, 0.94],
    },
  },
};

interface CloudinaryUsage {
  credits: {
    used: number;
    limit: number;
    used_percent: number;
  };
  storage: {
    usage: number;
    usage_mb: number;
    credits_usage: number;
  };
  bandwidth: {
    usage: number;
    usage_mb: number;
    credits_usage: number;
  };
  transformations: {
    usage: number;
    credits_usage: number;
  };
  objects: {
    usage: number;
  };
  resources: number;
  derived_resources: number;
  media_limits: {
    image_max_size_bytes: number;
    video_max_size_bytes: number;
    raw_max_size_bytes: number;
  };
}

interface UsageData {
  success: boolean;
  usage?: CloudinaryUsage;
  plan?: string;
  last_updated?: string;
  rate_limit_remaining?: number;
  error?: string;
  configured?: boolean;
}

interface TimeSeriesData {
  timestamp: string;
  value: number;
}

interface MetricsData {
  success: boolean;
  data?: {
    credits?: TimeSeriesData[];
    storage?: TimeSeriesData[];
    bandwidth?: TimeSeriesData[];
    transformations?: TimeSeriesData[];
    resources?: TimeSeriesData[];
  };
  projections?: {
    credits_days_remaining?: number;
    credits_exhaustion_date?: string;
    daily_rates?: {
      credits: number;
      storage: number;
      bandwidth: number;
      transformations: number;
      resources: number;
    };
  };
  influxdb_status?: {
    configured: boolean;
    host: string;
    org: string;
  };
  error?: string;
}

const TIME_RANGES = [
  { label: "1H", value: "1h" },
  { label: "12H", value: "12h" },
  { label: "24H", value: "24h" },
  { label: "7D", value: "7d" },
  { label: "30D", value: "30d" },
];

function formatBytes(bytes: number, decimals = 2): string {
  if (bytes === 0) return "0 Bytes";
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ["Bytes", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + " " + sizes[i];
}

function formatNumber(num: number): string {
  if (num >= 1000000) return (num / 1000000).toFixed(2) + "M";
  if (num >= 1000) return (num / 1000).toFixed(1) + "K";
  return num.toLocaleString();
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-card/95 backdrop-blur-sm border border-border rounded-lg p-3 shadow-xl">
        <p className="text-xs text-muted-foreground mb-1">
          {format(new Date(label), "PPpp")}
        </p>
        {payload.map((entry: any, index: number) => (
          <p key={index} className="text-sm font-medium" style={{ color: entry.color }}>
            {entry.name}: {typeof entry.value === 'number' ? entry.value.toFixed(3) : entry.value}
          </p>
        ))}
      </div>
    );
  }
  return null;
};

export default function CloudinaryMonitoring() {
  const [, setLocation] = useLocation();
  const [activeTab, setActiveTab] = useState("current");
  const [usageData, setUsageData] = useState<UsageData | null>(null);
  const [metricsData, setMetricsData] = useState<MetricsData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isMetricsLoading, setIsMetricsLoading] = useState(false);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [selectedRange, setSelectedRange] = useState("24h");

  const fetchUsageData = useCallback(async () => {
    try {
      setIsLoading(true);
      const response = await fetch("/api/cloudinary/usage", {
        credentials: "include",
      });
      const data = await response.json();
      setUsageData(data);
      setLastRefresh(new Date());
      
      // Also record metrics to InfluxDB
      try {
        await fetch("/api/cloudinary/metrics", {
          method: "POST",
          credentials: "include",
        });
      } catch (e) {
        console.warn("[Cloudinary] Failed to record metrics:", e);
      }
    } catch (error) {
      console.error("[Cloudinary] Failed to fetch usage:", error);
      setUsageData({
        success: false,
        error: "Failed to connect to API",
      });
    } finally {
      setIsLoading(false);
    }
  }, []);

  const fetchMetricsData = useCallback(async (range: string) => {
    try {
      setIsMetricsLoading(true);
      const response = await fetch(`/api/cloudinary/metrics?range=${range}`, {
        credentials: "include",
      });
      const data = await response.json();
      setMetricsData(data);
    } catch (error) {
      console.error("[Cloudinary] Failed to fetch metrics:", error);
      setMetricsData({
        success: false,
        error: "Failed to fetch historical data",
      });
    } finally {
      setIsMetricsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchUsageData();
  }, [fetchUsageData]);

  useEffect(() => {
    if (activeTab === "historical") {
      fetchMetricsData(selectedRange);
    }
  }, [activeTab, selectedRange, fetchMetricsData]);

  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(fetchUsageData, 60000);
    return () => clearInterval(interval);
  }, [autoRefresh, fetchUsageData]);

  const getUsageColor = (percent: number): string => {
    if (percent >= 90) return "text-red-500";
    if (percent >= 70) return "text-orange-500";
    if (percent >= 50) return "text-yellow-500";
    return "text-green-500";
  };

  const getProgressColor = (percent: number): string => {
    if (percent >= 90) return "bg-red-500";
    if (percent >= 70) return "bg-orange-500";
    if (percent >= 50) return "bg-yellow-500";
    return "bg-green-500";
  };

  const calculateProjections = () => {
    if (!usageData?.usage) return null;
    
    const { credits } = usageData.usage;
    if (metricsData?.projections) {
      return metricsData.projections;
    }
    
    const currentDayOfMonth = new Date().getDate();
    const dailyRate = credits.used / currentDayOfMonth || 0;
    const creditsRemaining = credits.limit - credits.used;
    const daysRemaining = dailyRate > 0 ? creditsRemaining / dailyRate : Infinity;
    
    return {
      credits_days_remaining: Math.round(daysRemaining),
      credits_exhaustion_date: dailyRate > 0 
        ? addDays(new Date(), daysRemaining).toISOString() 
        : null,
      daily_rates: {
        credits: dailyRate,
        storage: usageData.usage.storage.credits_usage / currentDayOfMonth,
        bandwidth: usageData.usage.bandwidth.credits_usage / currentDayOfMonth,
        transformations: usageData.usage.transformations.credits_usage / currentDayOfMonth,
        resources: usageData.usage.resources / currentDayOfMonth,
      },
    };
  };

  const projections = calculateProjections();

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-blue-950/20">
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 -right-32 w-96 h-96 bg-blue-500/5 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 -left-32 w-96 h-96 bg-cyan-500/5 rounded-full blur-3xl" />
      </div>

      <header className="border-b border-border/50 bg-card/30 backdrop-blur-xl sticky top-0 z-50">
        <div className="container flex items-center justify-between h-16">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setLocation("/dashboard")}
              className="hover:bg-blue-500/10"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back
            </Button>
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-gradient-to-br from-blue-500 to-cyan-500 shadow-lg shadow-blue-500/20">
                <Cloud className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent">
                  Cloudinary Monitoring
                </h1>
                <p className="text-xs text-muted-foreground">
                  Media storage and delivery metrics
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Clock className="w-3 h-3" />
              <span>Updated {format(lastRefresh, "HH:mm:ss")}</span>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={fetchUsageData}
              disabled={isLoading}
              className="border-blue-500/30 hover:bg-blue-500/10 hover:border-blue-500/50"
            >
              <RefreshCw className={`w-4 h-4 mr-2 ${isLoading ? "animate-spin" : ""}`} />
              Refresh
            </Button>
          </div>
        </div>
      </header>

      <main className="container py-8 relative">
        {usageData && !usageData.success && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-6 p-4 bg-red-500/10 border border-red-500/20 rounded-xl flex items-center gap-3"
          >
            <AlertCircle className="w-5 h-5 text-red-500" />
            <div>
              <p className="font-medium text-red-400">
                {usageData.configured === false 
                  ? "Cloudinary Not Configured" 
                  : "Error Loading Data"}
              </p>
              <p className="text-sm text-muted-foreground">{usageData.error}</p>
            </div>
          </motion.div>
        )}

        {isLoading && !usageData && (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
            {[...Array(8)].map((_, i) => (
              <div key={i} className="h-32 bg-card/50 rounded-xl animate-pulse" />
            ))}
          </div>
        )}

        {usageData?.success && usageData.usage && (
          <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
            <TabsList className="grid w-full max-w-md grid-cols-2 bg-card/50">
              <TabsTrigger value="current" className="gap-2">
                <Gauge className="w-4 h-4" />
                Current Usage
              </TabsTrigger>
              <TabsTrigger value="historical" className="gap-2">
                <LineChartIcon className="w-4 h-4" />
                Historical Trends
              </TabsTrigger>
            </TabsList>

            <TabsContent value="current">
              <motion.div
                variants={containerVariants}
                initial="hidden"
                animate="visible"
                className="space-y-8"
              >
                {/* Credit Usage Card */}
                <motion.div variants={itemVariants}>
                  <Card className="border-blue-500/20 bg-gradient-to-br from-card to-blue-950/20 overflow-hidden">
                    <CardHeader className="pb-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="p-2 rounded-lg bg-blue-500/10">
                            <Gauge className="w-5 h-5 text-blue-400" />
                          </div>
                          <div>
                            <CardTitle className="text-lg">Credit Usage</CardTitle>
                            <CardDescription>
                              Plan: <Badge variant="outline" className="ml-1 border-blue-500/30 text-blue-400">{usageData.plan}</Badge>
                            </CardDescription>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className={`text-3xl font-bold ${getUsageColor(usageData.usage.credits.used_percent)}`}>
                            {usageData.usage.credits.used.toFixed(2)}
                          </div>
                          <div className="text-sm text-muted-foreground">
                            of {usageData.usage.credits.limit} credits
                          </div>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2">
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">Usage</span>
                          <span className={getUsageColor(usageData.usage.credits.used_percent)}>
                            {usageData.usage.credits.used_percent.toFixed(2)}%
                          </span>
                        </div>
                        <div className="h-3 bg-muted rounded-full overflow-hidden">
                          <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${Math.min(usageData.usage.credits.used_percent, 100)}%` }}
                            transition={{ duration: 1, ease: "easeOut" }}
                            className={`h-full rounded-full ${getProgressColor(usageData.usage.credits.used_percent)}`}
                          />
                        </div>
                        <div className="flex justify-between text-xs text-muted-foreground pt-1">
                          <span>0%</span>
                          <span>50%</span>
                          <span>100%</span>
                        </div>
                      </div>
                      
                      {projections && projections.credits_days_remaining !== undefined && projections.credits_days_remaining < 30 && projections.credits_days_remaining !== Infinity && (
                        <motion.div
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          className={`mt-4 p-3 rounded-lg flex items-center gap-3 ${
                            projections.credits_days_remaining < 7 
                              ? "bg-red-500/10 border border-red-500/20" 
                              : projections.credits_days_remaining < 14
                              ? "bg-orange-500/10 border border-orange-500/20"
                              : "bg-yellow-500/10 border border-yellow-500/20"
                          }`}
                        >
                          <AlertTriangle className={`w-5 h-5 ${
                            projections.credits_days_remaining < 7 
                              ? "text-red-500" 
                              : projections.credits_days_remaining < 14
                              ? "text-orange-500"
                              : "text-yellow-500"
                          }`} />
                          <div className="flex-1">
                            <p className={`text-sm font-medium ${
                              projections.credits_days_remaining < 7 
                                ? "text-red-400" 
                                : projections.credits_days_remaining < 14
                                ? "text-orange-400"
                                : "text-yellow-400"
                            }`}>
                              {projections.credits_days_remaining < 7 
                                ? "Critical: Credits running low!"
                                : projections.credits_days_remaining < 14
                                ? "Warning: Credits declining"
                                : "Notice: Monitor credit usage"}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              At current rate, credits will be exhausted in ~{projections.credits_days_remaining} days
                              {projections.credits_exhaustion_date && (
                                <span> ({format(new Date(projections.credits_exhaustion_date), "PPP")})</span>
                              )}
                            </p>
                          </div>
                        </motion.div>
                      )}
                    </CardContent>
                  </Card>
                </motion.div>

                {/* Stats Grid */}
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                  <motion.div variants={itemVariants}>
                    <Card className="border-purple-500/20 hover:border-purple-500/40 transition-colors group">
                      <CardContent className="pt-6">
                        <div className="flex items-center gap-3 mb-4">
                          <div className="p-2.5 rounded-xl bg-purple-500/10 group-hover:bg-purple-500/20 transition-colors">
                            <HardDrive className="w-5 h-5 text-purple-400" />
                          </div>
                          <div className="text-sm text-muted-foreground">Storage</div>
                        </div>
                        <div className="text-2xl font-bold text-purple-400">
                          {formatBytes(usageData.usage.storage.usage)}
                        </div>
                        <div className="text-xs text-muted-foreground mt-1">
                          {usageData.usage.storage.credits_usage.toFixed(3)} credits used
                        </div>
                      </CardContent>
                    </Card>
                  </motion.div>

                  <motion.div variants={itemVariants}>
                    <Card className="border-cyan-500/20 hover:border-cyan-500/40 transition-colors group">
                      <CardContent className="pt-6">
                        <div className="flex items-center gap-3 mb-4">
                          <div className="p-2.5 rounded-xl bg-cyan-500/10 group-hover:bg-cyan-500/20 transition-colors">
                            <Activity className="w-5 h-5 text-cyan-400" />
                          </div>
                          <div className="text-sm text-muted-foreground">Bandwidth</div>
                        </div>
                        <div className="text-2xl font-bold text-cyan-400">
                          {formatBytes(usageData.usage.bandwidth.usage)}
                        </div>
                        <div className="text-xs text-muted-foreground mt-1">
                          {usageData.usage.bandwidth.credits_usage.toFixed(3)} credits used
                        </div>
                      </CardContent>
                    </Card>
                  </motion.div>

                  <motion.div variants={itemVariants}>
                    <Card className="border-orange-500/20 hover:border-orange-500/40 transition-colors group">
                      <CardContent className="pt-6">
                        <div className="flex items-center gap-3 mb-4">
                          <div className="p-2.5 rounded-xl bg-orange-500/10 group-hover:bg-orange-500/20 transition-colors">
                            <Zap className="w-5 h-5 text-orange-400" />
                          </div>
                          <div className="text-sm text-muted-foreground">Transformations</div>
                        </div>
                        <div className="text-2xl font-bold text-orange-400">
                          {formatNumber(usageData.usage.transformations.usage)}
                        </div>
                        <div className="text-xs text-muted-foreground mt-1">
                          {usageData.usage.transformations.credits_usage.toFixed(3)} credits used
                        </div>
                      </CardContent>
                    </Card>
                  </motion.div>

                  <motion.div variants={itemVariants}>
                    <Card className="border-green-500/20 hover:border-green-500/40 transition-colors group">
                      <CardContent className="pt-6">
                        <div className="flex items-center gap-3 mb-4">
                          <div className="p-2.5 rounded-xl bg-green-500/10 group-hover:bg-green-500/20 transition-colors">
                            <FileImage className="w-5 h-5 text-green-400" />
                          </div>
                          <div className="text-sm text-muted-foreground">Total Resources</div>
                        </div>
                        <div className="text-2xl font-bold text-green-400">
                          {formatNumber(usageData.usage.resources)}
                        </div>
                        <div className="text-xs text-muted-foreground mt-1">
                          {formatNumber(usageData.usage.derived_resources)} derived
                        </div>
                      </CardContent>
                    </Card>
                  </motion.div>
                </div>

                {/* Credit Breakdown */}
                <div className="grid gap-6 lg:grid-cols-2">
                  <motion.div variants={itemVariants}>
                    <Card className="h-full">
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2 text-base">
                          <BarChart3 className="w-4 h-4 text-blue-400" />
                          Credit Breakdown
                        </CardTitle>
                        <CardDescription>
                          How your credits are being used
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div className="space-y-2">
                          <div className="flex justify-between text-sm">
                            <span className="flex items-center gap-2">
                              <HardDrive className="w-4 h-4 text-purple-400" />
                              Storage
                            </span>
                            <span className="font-medium">{usageData.usage.storage.credits_usage.toFixed(3)}</span>
                          </div>
                          <Progress 
                            value={usageData.usage.credits.used > 0 
                              ? (usageData.usage.storage.credits_usage / usageData.usage.credits.used) * 100 
                              : 0} 
                            className="h-2" 
                          />
                        </div>

                        <div className="space-y-2">
                          <div className="flex justify-between text-sm">
                            <span className="flex items-center gap-2">
                              <Activity className="w-4 h-4 text-cyan-400" />
                              Bandwidth
                            </span>
                            <span className="font-medium">{usageData.usage.bandwidth.credits_usage.toFixed(3)}</span>
                          </div>
                          <Progress 
                            value={usageData.usage.credits.used > 0 
                              ? (usageData.usage.bandwidth.credits_usage / usageData.usage.credits.used) * 100 
                              : 0} 
                            className="h-2" 
                          />
                        </div>

                        <div className="space-y-2">
                          <div className="flex justify-between text-sm">
                            <span className="flex items-center gap-2">
                              <Zap className="w-4 h-4 text-orange-400" />
                              Transformations
                            </span>
                            <span className="font-medium">{usageData.usage.transformations.credits_usage.toFixed(3)}</span>
                          </div>
                          <Progress 
                            value={usageData.usage.credits.used > 0 
                              ? (usageData.usage.transformations.credits_usage / usageData.usage.credits.used) * 100 
                              : 0} 
                            className="h-2" 
                          />
                        </div>
                        
                        <div className="pt-4 border-t border-border/50">
                          <div className="flex justify-between text-sm font-medium">
                            <span>Total Credits Used</span>
                            <span className="text-blue-400">
                              {usageData.usage.credits.used.toFixed(3)} / {usageData.usage.credits.limit}
                            </span>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </motion.div>

                  <motion.div variants={itemVariants}>
                    <Card className="h-full">
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2 text-base">
                          <Database className="w-4 h-4 text-green-400" />
                          Account Information
                        </CardTitle>
                        <CardDescription>
                          Plan limits and configuration
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                          <div className="p-3 rounded-lg bg-muted/30">
                            <div className="text-xs text-muted-foreground mb-1">Max Image Size</div>
                            <div className="font-medium">
                              {formatBytes(usageData.usage.media_limits.image_max_size_bytes)}
                            </div>
                          </div>
                          <div className="p-3 rounded-lg bg-muted/30">
                            <div className="text-xs text-muted-foreground mb-1">Max Video Size</div>
                            <div className="font-medium">
                              {formatBytes(usageData.usage.media_limits.video_max_size_bytes)}
                            </div>
                          </div>
                          <div className="p-3 rounded-lg bg-muted/30">
                            <div className="text-xs text-muted-foreground mb-1">Max Raw Size</div>
                            <div className="font-medium">
                              {formatBytes(usageData.usage.media_limits.raw_max_size_bytes)}
                            </div>
                          </div>
                          <div className="p-3 rounded-lg bg-muted/30">
                            <div className="text-xs text-muted-foreground mb-1">Total Objects</div>
                            <div className="font-medium">
                              {formatNumber(usageData.usage.objects.usage)}
                            </div>
                          </div>
                        </div>

                        {usageData.rate_limit_remaining !== undefined && (
                          <div className="pt-2 border-t border-border/50">
                            <div className="flex items-center justify-between text-sm">
                              <span className="text-muted-foreground">API Rate Limit Remaining</span>
                              <Badge variant={usageData.rate_limit_remaining > 100 ? "default" : "destructive"}>
                                {usageData.rate_limit_remaining} requests
                              </Badge>
                            </div>
                          </div>
                        )}

                        {usageData.last_updated && (
                          <div className="pt-2 border-t border-border/50">
                            <div className="flex items-center justify-between text-sm">
                              <span className="text-muted-foreground">Data Last Updated</span>
                              <span className="font-mono text-xs">
                                {format(new Date(usageData.last_updated), "PPpp")}
                              </span>
                            </div>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  </motion.div>
                </div>

                {/* Status Banner */}
                <motion.div variants={itemVariants}>
                  <Card className="border-green-500/20 bg-green-500/5">
                    <CardContent className="py-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <CheckCircle2 className="w-5 h-5 text-green-500" />
                          <div>
                            <div className="font-medium text-green-400">Cloudinary Connected</div>
                            <div className="text-sm text-muted-foreground">
                              Folder: <code className="text-xs bg-muted/50 px-1.5 py-0.5 rounded">eli-events</code>
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className={`w-2 h-2 rounded-full ${autoRefresh ? "bg-green-500 animate-pulse" : "bg-gray-500"}`} />
                          <span className="text-xs text-muted-foreground">
                            {autoRefresh ? "Auto-refresh enabled" : "Auto-refresh disabled"}
                          </span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              </motion.div>
            </TabsContent>

            <TabsContent value="historical">
              <motion.div
                variants={containerVariants}
                initial="hidden"
                animate="visible"
                className="space-y-6"
              >
                {/* Time Range Selector */}
                <motion.div variants={itemVariants} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-muted-foreground" />
                    <span className="text-sm text-muted-foreground">Time Range:</span>
                  </div>
                  <div className="flex gap-1">
                    {TIME_RANGES.map((range) => (
                      <Button
                        key={range.value}
                        variant={selectedRange === range.value ? "default" : "outline"}
                        size="sm"
                        onClick={() => setSelectedRange(range.value)}
                        className={selectedRange === range.value 
                          ? "bg-blue-500 hover:bg-blue-600" 
                          : "border-blue-500/30 hover:bg-blue-500/10"}
                      >
                        {range.label}
                      </Button>
                    ))}
                  </div>
                </motion.div>

                {metricsData && !metricsData.influxdb_status?.configured && (
                  <motion.div
                    variants={itemVariants}
                    className="p-4 bg-yellow-500/10 border border-yellow-500/20 rounded-xl flex items-center gap-3"
                  >
                    <AlertTriangle className="w-5 h-5 text-yellow-500" />
                    <div>
                      <p className="font-medium text-yellow-400">InfluxDB Not Configured</p>
                      <p className="text-sm text-muted-foreground">
                        Historical data tracking requires InfluxDB. Add INFLUXDB_TOKEN and INFLUXDB_ORG_ID to your environment.
                      </p>
                    </div>
                  </motion.div>
                )}

                {isMetricsLoading && (
                  <div className="flex items-center justify-center py-12">
                    <RefreshCw className="w-6 h-6 animate-spin text-blue-400" />
                  </div>
                )}

                {!isMetricsLoading && metricsData?.success && (
                  <div className="space-y-6">
                    {/* Credits Usage Chart */}
                    <motion.div variants={itemVariants}>
                      <Card>
                        <CardHeader>
                          <CardTitle className="flex items-center gap-2 text-base">
                            <TrendingUp className="w-4 h-4 text-blue-400" />
                            Credits Usage Over Time
                          </CardTitle>
                          <CardDescription>
                            Track credit consumption trends and projections
                          </CardDescription>
                        </CardHeader>
                        <CardContent>
                          <div className="h-[300px]">
                            <ResponsiveContainer width="100%" height="100%">
                              <AreaChart
                                data={metricsData.data?.credits || []}
                                margin={{ top: 10, right: 30, left: 0, bottom: 0 }}
                              >
                                <defs>
                                  <linearGradient id="colorCredits" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
                                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                                  </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                                <XAxis 
                                  dataKey="timestamp" 
                                  tickFormatter={(value) => format(new Date(value), "MM/dd HH:mm")}
                                  stroke="#666"
                                  fontSize={12}
                                />
                                <YAxis stroke="#666" fontSize={12} />
                                <Tooltip content={<CustomTooltip />} />
                                <ReferenceLine 
                                  y={usageData.usage.credits.limit} 
                                  stroke="#ef4444" 
                                  strokeDasharray="5 5"
                                  label={{ value: "Limit", fill: "#ef4444", fontSize: 12 }}
                                />
                                <Area
                                  type="monotone"
                                  dataKey="value"
                                  name="Credits"
                                  stroke="#3b82f6"
                                  fillOpacity={1}
                                  fill="url(#colorCredits)"
                                  strokeWidth={2}
                                />
                              </AreaChart>
                            </ResponsiveContainer>
                          </div>
                        </CardContent>
                      </Card>
                    </motion.div>

                    {/* Storage & Bandwidth Charts */}
                    <div className="grid gap-6 lg:grid-cols-2">
                      <motion.div variants={itemVariants}>
                        <Card>
                          <CardHeader className="pb-2">
                            <CardTitle className="flex items-center gap-2 text-base">
                              <HardDrive className="w-4 h-4 text-purple-400" />
                              Storage Usage
                            </CardTitle>
                          </CardHeader>
                          <CardContent>
                            <div className="h-[200px]">
                              <ResponsiveContainer width="100%" height="100%">
                                <LineChart
                                  data={metricsData.data?.storage || []}
                                  margin={{ top: 5, right: 20, left: 0, bottom: 5 }}
                                >
                                  <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                                  <XAxis 
                                    dataKey="timestamp" 
                                    tickFormatter={(value) => format(new Date(value), "MM/dd")}
                                    stroke="#666"
                                    fontSize={10}
                                  />
                                  <YAxis 
                                    stroke="#666" 
                                    fontSize={10}
                                    tickFormatter={(value) => formatBytes(value)}
                                  />
                                  <Tooltip content={<CustomTooltip />} />
                                  <Line
                                    type="monotone"
                                    dataKey="value"
                                    name="Storage"
                                    stroke="#a855f7"
                                    strokeWidth={2}
                                    dot={false}
                                  />
                                </LineChart>
                              </ResponsiveContainer>
                            </div>
                          </CardContent>
                        </Card>
                      </motion.div>

                      <motion.div variants={itemVariants}>
                        <Card>
                          <CardHeader className="pb-2">
                            <CardTitle className="flex items-center gap-2 text-base">
                              <Activity className="w-4 h-4 text-cyan-400" />
                              Bandwidth Usage
                            </CardTitle>
                          </CardHeader>
                          <CardContent>
                            <div className="h-[200px]">
                              <ResponsiveContainer width="100%" height="100%">
                                <LineChart
                                  data={metricsData.data?.bandwidth || []}
                                  margin={{ top: 5, right: 20, left: 0, bottom: 5 }}
                                >
                                  <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                                  <XAxis 
                                    dataKey="timestamp" 
                                    tickFormatter={(value) => format(new Date(value), "MM/dd")}
                                    stroke="#666"
                                    fontSize={10}
                                  />
                                  <YAxis 
                                    stroke="#666" 
                                    fontSize={10}
                                    tickFormatter={(value) => formatBytes(value)}
                                  />
                                  <Tooltip content={<CustomTooltip />} />
                                  <Line
                                    type="monotone"
                                    dataKey="value"
                                    name="Bandwidth"
                                    stroke="#06b6d4"
                                    strokeWidth={2}
                                    dot={false}
                                  />
                                </LineChart>
                              </ResponsiveContainer>
                            </div>
                          </CardContent>
                        </Card>
                      </motion.div>
                    </div>

                    {/* Projections Card */}
                    {projections && (
                      <motion.div variants={itemVariants}>
                        <Card className="border-blue-500/20 bg-gradient-to-br from-card to-blue-950/10">
                          <CardHeader>
                            <CardTitle className="flex items-center gap-2 text-base">
                              <TrendingUp className="w-4 h-4 text-blue-400" />
                              Usage Projections
                            </CardTitle>
                            <CardDescription>
                              Estimated usage based on current trends
                            </CardDescription>
                          </CardHeader>
                          <CardContent>
                            <div className="grid gap-4 md:grid-cols-3">
                              <div className="p-4 rounded-lg bg-muted/30">
                                <div className="text-xs text-muted-foreground mb-1">Credits Exhaustion</div>
                                <div className="text-lg font-bold text-blue-400">
                                  {projections.credits_days_remaining === Infinity 
                                    ? "N/A" 
                                    : `~${projections.credits_days_remaining} days`}
                                </div>
                                {projections.credits_exhaustion_date && (
                                  <div className="text-xs text-muted-foreground mt-1">
                                    {format(new Date(projections.credits_exhaustion_date), "PPP")}
                                  </div>
                                )}
                              </div>
                              <div className="p-4 rounded-lg bg-muted/30">
                                <div className="text-xs text-muted-foreground mb-1">Daily Credit Rate</div>
                                <div className="text-lg font-bold text-purple-400">
                                  {projections.daily_rates?.credits.toFixed(3) || "0"} / day
                                </div>
                              </div>
                              <div className="p-4 rounded-lg bg-muted/30">
                                <div className="text-xs text-muted-foreground mb-1">Daily Storage Rate</div>
                                <div className="text-lg font-bold text-cyan-400">
                                  {formatBytes(projections.daily_rates?.storage || 0)} / day
                                </div>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      </motion.div>
                    )}
                  </div>
                )}

                {!isMetricsLoading && metricsData?.success && 
                  (!metricsData.data?.credits?.length && !metricsData.data?.storage?.length) && (
                  <motion.div 
                    variants={itemVariants}
                    className="text-center py-12"
                  >
                    <LineChartIcon className="w-12 h-12 mx-auto text-muted-foreground/50 mb-4" />
                    <p className="text-muted-foreground">No historical data available yet</p>
                    <p className="text-sm text-muted-foreground mt-1">
                      Data will be recorded automatically as usage occurs
                    </p>
                  </motion.div>
                )}
              </motion.div>
            </TabsContent>
          </Tabs>
        )}
      </main>
    </div>
  );
}
