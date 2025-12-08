import { useState, useEffect, useCallback } from "react";
import { useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  ArrowLeft,
  Database,
  HardDrive,
  Activity,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  TrendingUp,
  Zap,
  Clock,
  BarChart3,
  LineChart as LineChartIcon,
  AlertTriangle,
  Table2,
  Layers,
  Server,
  Gauge,
  Users,
} from "lucide-react";
import { motion } from "framer-motion";
import { format, addDays } from "date-fns";
import { toast } from "sonner";
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  Cell,
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

interface TableStats {
  name: string;
  rows: number;
  size_bytes: number;
  size_pretty: string;
}

interface PostgreSQLUsage {
  database_size: {
    bytes: number;
    pretty: string;
  };
  tables: TableStats[];
  total_rows: number;
  connections: {
    active: number;
    max: number;
  };
  version: string;
  uptime_seconds: number;
}

interface UsageData {
  success: boolean;
  usage?: PostgreSQLUsage;
  plan?: string;
  region?: string;
  last_updated?: string;
  error?: string;
  configured?: boolean;
}

interface TimeSeriesData {
  timestamp: string;
  value: number;
}

interface MetricsData {
  success: boolean;
  current?: {
    database_size_bytes: number;
    total_rows: number;
    events_count: number;
    snapshots_count: number;
    webhook_requests_count: number;
    ai_jobs_count: number;
  };
  data?: {
    events_count?: TimeSeriesData[];
    snapshots_count?: TimeSeriesData[];
  };
  projections?: {
    storage_days_remaining?: number;
    storage_exhaustion_date?: string;
    daily_rates?: {
      storage_bytes: number;
      rows: number;
      events: number;
      snapshots: number;
    };
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

function formatUptime(seconds: number): string {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
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
            {entry.name}: {typeof entry.value === 'number' ? entry.value.toLocaleString() : entry.value}
          </p>
        ))}
      </div>
    );
  }
  return null;
};

// Color palette for table chart
const TABLE_COLORS = [
  "#22c55e", // green
  "#3b82f6", // blue
  "#a855f7", // purple
  "#f59e0b", // amber
  "#ef4444", // red
  "#06b6d4", // cyan
  "#ec4899", // pink
  "#84cc16", // lime
];

export default function PostgreSQLMonitoring() {
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
      const response = await fetch("/api/postgresql/usage", {
        credentials: "include",
      });
      const data = await response.json();
      setUsageData(data);
      setLastRefresh(new Date());
    } catch (error) {
      console.error("[PostgreSQL] Failed to fetch usage:", error);
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
      const response = await fetch(`/api/postgresql/metrics?range=${range}`, {
        credentials: "include",
      });
      const data = await response.json();
      setMetricsData(data);
    } catch (error) {
      console.error("[PostgreSQL] Failed to fetch metrics:", error);
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

  // Calculate storage percentage (assuming 512MB Neon free tier limit)
  const storageLimit = 512 * 1024 * 1024; // 512MB
  const storageUsed = usageData?.usage?.database_size.bytes || 0;
  const storagePercent = (storageUsed / storageLimit) * 100;

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-green-950/20">
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 -right-32 w-96 h-96 bg-green-500/5 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 -left-32 w-96 h-96 bg-emerald-500/5 rounded-full blur-3xl" />
      </div>

      <header className="border-b border-border/50 bg-card/30 backdrop-blur-xl sticky top-0 z-50">
        <div className="container flex items-center justify-between h-16">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setLocation("/dashboard")}
              className="hover:bg-green-500/10"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back
            </Button>
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-gradient-to-br from-green-500 to-emerald-500 shadow-lg shadow-green-500/20">
                <Database className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold bg-gradient-to-r from-green-400 to-emerald-400 bg-clip-text text-transparent">
                  PostgreSQL Monitoring
                </h1>
                <p className="text-xs text-muted-foreground">
                  Database storage and performance metrics
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
              className="border-green-500/30 hover:bg-green-500/10 hover:border-green-500/50"
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
                  ? "PostgreSQL Not Configured" 
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
                {/* Storage Usage Card */}
                <motion.div variants={itemVariants}>
                  <Card className="border-green-500/20 bg-gradient-to-br from-card to-green-950/20 overflow-hidden">
                    <CardHeader className="pb-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="p-2 rounded-lg bg-green-500/10">
                            <HardDrive className="w-5 h-5 text-green-400" />
                          </div>
                          <div>
                            <CardTitle className="text-lg">Storage Usage</CardTitle>
                            <CardDescription>
                              Plan: <Badge variant="outline" className="ml-1 border-green-500/30 text-green-400">{usageData.plan || "Neon"}</Badge>
                              {usageData.region && (
                                <Badge variant="outline" className="ml-2 border-emerald-500/30 text-emerald-400">{usageData.region}</Badge>
                              )}
                            </CardDescription>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className={`text-3xl font-bold ${getUsageColor(storagePercent)}`}>
                            {usageData.usage.database_size.pretty}
                          </div>
                          <div className="text-sm text-muted-foreground">
                            of {formatBytes(storageLimit)}
                          </div>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2">
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">Usage</span>
                          <span className={getUsageColor(storagePercent)}>
                            {storagePercent.toFixed(2)}%
                          </span>
                        </div>
                        <div className="h-3 bg-muted rounded-full overflow-hidden">
                          <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${Math.min(storagePercent, 100)}%` }}
                            transition={{ duration: 1, ease: "easeOut" }}
                            className={`h-full rounded-full ${getProgressColor(storagePercent)}`}
                          />
                        </div>
                        <div className="flex justify-between text-xs text-muted-foreground pt-1">
                          <span>0%</span>
                          <span>50%</span>
                          <span>100%</span>
                        </div>
                      </div>
                      
                      {metricsData?.projections?.storage_days_remaining !== undefined && 
                       metricsData.projections.storage_days_remaining < 30 && (
                        <motion.div
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          className={`mt-4 p-3 rounded-lg flex items-center gap-3 ${
                            metricsData.projections.storage_days_remaining < 7 
                              ? "bg-red-500/10 border border-red-500/20" 
                              : metricsData.projections.storage_days_remaining < 14
                              ? "bg-orange-500/10 border border-orange-500/20"
                              : "bg-yellow-500/10 border border-yellow-500/20"
                          }`}
                        >
                          <AlertTriangle className={`w-5 h-5 ${
                            metricsData.projections.storage_days_remaining < 7 
                              ? "text-red-500" 
                              : metricsData.projections.storage_days_remaining < 14
                              ? "text-orange-500"
                              : "text-yellow-500"
                          }`} />
                          <div className="flex-1">
                            <p className={`text-sm font-medium ${
                              metricsData.projections.storage_days_remaining < 7 
                                ? "text-red-400" 
                                : metricsData.projections.storage_days_remaining < 14
                                ? "text-orange-400"
                                : "text-yellow-400"
                            }`}>
                              Storage capacity warning
                            </p>
                            <p className="text-xs text-muted-foreground">
                              At current rate, storage will be exhausted in ~{metricsData.projections.storage_days_remaining} days
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
                    <Card className="border-emerald-500/20 hover:border-emerald-500/40 transition-colors group">
                      <CardContent className="pt-6">
                        <div className="flex items-center gap-3 mb-4">
                          <div className="p-2.5 rounded-xl bg-emerald-500/10 group-hover:bg-emerald-500/20 transition-colors">
                            <Table2 className="w-5 h-5 text-emerald-400" />
                          </div>
                          <div className="text-sm text-muted-foreground">Total Rows</div>
                        </div>
                        <div className="text-2xl font-bold text-emerald-400">
                          {formatNumber(usageData.usage.total_rows)}
                        </div>
                        <div className="text-xs text-muted-foreground mt-1">
                          Across all tables
                        </div>
                      </CardContent>
                    </Card>
                  </motion.div>

                  <motion.div variants={itemVariants}>
                    <Card className="border-cyan-500/20 hover:border-cyan-500/40 transition-colors group">
                      <CardContent className="pt-6">
                        <div className="flex items-center gap-3 mb-4">
                          <div className="p-2.5 rounded-xl bg-cyan-500/10 group-hover:bg-cyan-500/20 transition-colors">
                            <Users className="w-5 h-5 text-cyan-400" />
                          </div>
                          <div className="text-sm text-muted-foreground">Connections</div>
                        </div>
                        <div className="text-2xl font-bold text-cyan-400">
                          {usageData.usage.connections.active}
                        </div>
                        <div className="text-xs text-muted-foreground mt-1">
                          of {usageData.usage.connections.max} max
                        </div>
                      </CardContent>
                    </Card>
                  </motion.div>

                  <motion.div variants={itemVariants}>
                    <Card className="border-purple-500/20 hover:border-purple-500/40 transition-colors group">
                      <CardContent className="pt-6">
                        <div className="flex items-center gap-3 mb-4">
                          <div className="p-2.5 rounded-xl bg-purple-500/10 group-hover:bg-purple-500/20 transition-colors">
                            <Layers className="w-5 h-5 text-purple-400" />
                          </div>
                          <div className="text-sm text-muted-foreground">Tables</div>
                        </div>
                        <div className="text-2xl font-bold text-purple-400">
                          {usageData.usage.tables.length}
                        </div>
                        <div className="text-xs text-muted-foreground mt-1">
                          User tables
                        </div>
                      </CardContent>
                    </Card>
                  </motion.div>

                  <motion.div variants={itemVariants}>
                    <Card className="border-amber-500/20 hover:border-amber-500/40 transition-colors group">
                      <CardContent className="pt-6">
                        <div className="flex items-center gap-3 mb-4">
                          <div className="p-2.5 rounded-xl bg-amber-500/10 group-hover:bg-amber-500/20 transition-colors">
                            <Server className="w-5 h-5 text-amber-400" />
                          </div>
                          <div className="text-sm text-muted-foreground">Uptime</div>
                        </div>
                        <div className="text-2xl font-bold text-amber-400">
                          {formatUptime(usageData.usage.uptime_seconds)}
                        </div>
                        <div className="text-xs text-muted-foreground mt-1">
                          {usageData.usage.version}
                        </div>
                      </CardContent>
                    </Card>
                  </motion.div>
                </div>

                {/* Table Breakdown */}
                <motion.div variants={itemVariants}>
                  <Card className="border-green-500/20">
                    <CardHeader>
                      <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-green-500/10">
                          <BarChart3 className="w-5 h-5 text-green-400" />
                        </div>
                        <div>
                          <CardTitle className="text-lg">Table Breakdown</CardTitle>
                          <CardDescription>Storage distribution by table</CardDescription>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="h-64">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart
                            data={usageData.usage.tables.slice(0, 8)}
                            layout="vertical"
                            margin={{ top: 5, right: 30, left: 80, bottom: 5 }}
                          >
                            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
                            <XAxis 
                              type="number" 
                              tickFormatter={(value) => formatBytes(value)}
                              stroke="hsl(var(--muted-foreground))"
                              fontSize={12}
                            />
                            <YAxis 
                              type="category" 
                              dataKey="name" 
                              stroke="hsl(var(--muted-foreground))"
                              fontSize={12}
                              width={70}
                            />
                            <Tooltip
                              content={({ active, payload }) => {
                                if (active && payload && payload.length) {
                                  const data = payload[0].payload;
                                  return (
                                    <div className="bg-card/95 backdrop-blur-sm border border-border rounded-lg p-3 shadow-xl">
                                      <p className="font-medium">{data.name}</p>
                                      <p className="text-sm text-muted-foreground">
                                        Size: {data.size_pretty}
                                      </p>
                                      <p className="text-sm text-muted-foreground">
                                        Rows: {formatNumber(data.rows)}
                                      </p>
                                    </div>
                                  );
                                }
                                return null;
                              }}
                            />
                            <Bar dataKey="size_bytes" radius={[0, 4, 4, 0]}>
                              {usageData.usage.tables.slice(0, 8).map((_, index) => (
                                <Cell key={`cell-${index}`} fill={TABLE_COLORS[index % TABLE_COLORS.length]} />
                              ))}
                            </Bar>
                          </BarChart>
                        </ResponsiveContainer>
                      </div>

                      {/* Table List */}
                      <div className="mt-6 space-y-2">
                        {usageData.usage.tables.map((table, index) => (
                          <div
                            key={table.name}
                            className="flex items-center justify-between p-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors"
                          >
                            <div className="flex items-center gap-3">
                              <div
                                className="w-3 h-3 rounded-full"
                                style={{ backgroundColor: TABLE_COLORS[index % TABLE_COLORS.length] }}
                              />
                              <span className="font-mono text-sm">{table.name}</span>
                            </div>
                            <div className="flex items-center gap-6 text-sm">
                              <span className="text-muted-foreground">
                                {formatNumber(table.rows)} rows
                              </span>
                              <span className="font-medium">{table.size_pretty}</span>
                            </div>
                          </div>
                        ))}
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
                <motion.div variants={itemVariants} className="flex items-center gap-4">
                  <span className="text-sm text-muted-foreground">Time Range:</span>
                  <div className="flex gap-2">
                    {TIME_RANGES.map((range) => (
                      <Button
                        key={range.value}
                        variant={selectedRange === range.value ? "default" : "outline"}
                        size="sm"
                        onClick={() => setSelectedRange(range.value)}
                        className={selectedRange === range.value 
                          ? "bg-green-500 hover:bg-green-600" 
                          : "border-green-500/30 hover:bg-green-500/10"
                        }
                      >
                        {range.label}
                      </Button>
                    ))}
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => fetchMetricsData(selectedRange)}
                    disabled={isMetricsLoading}
                  >
                    <RefreshCw className={`w-4 h-4 ${isMetricsLoading ? "animate-spin" : ""}`} />
                  </Button>
                </motion.div>

                {isMetricsLoading && (
                  <div className="flex items-center justify-center py-12">
                    <RefreshCw className="w-8 h-8 animate-spin text-green-500" />
                  </div>
                )}

                {!isMetricsLoading && metricsData?.success && (
                  <>
                    {/* Daily Rates Summary */}
                    {metricsData.projections?.daily_rates && (
                      <motion.div variants={itemVariants}>
                        <Card className="border-green-500/20">
                          <CardHeader>
                            <div className="flex items-center gap-3">
                              <div className="p-2 rounded-lg bg-green-500/10">
                                <TrendingUp className="w-5 h-5 text-green-400" />
                              </div>
                              <div>
                                <CardTitle className="text-lg">Daily Growth Rates</CardTitle>
                                <CardDescription>Average daily data accumulation</CardDescription>
                              </div>
                            </div>
                          </CardHeader>
                          <CardContent>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                              <div className="p-4 rounded-lg bg-muted/30">
                                <div className="text-sm text-muted-foreground mb-1">Storage Growth</div>
                                <div className="text-xl font-bold text-green-400">
                                  {formatBytes(metricsData.projections.daily_rates.storage_bytes)}/day
                                </div>
                              </div>
                              <div className="p-4 rounded-lg bg-muted/30">
                                <div className="text-sm text-muted-foreground mb-1">New Rows</div>
                                <div className="text-xl font-bold text-emerald-400">
                                  {formatNumber(metricsData.projections.daily_rates.rows)}/day
                                </div>
                              </div>
                              <div className="p-4 rounded-lg bg-muted/30">
                                <div className="text-sm text-muted-foreground mb-1">Events</div>
                                <div className="text-xl font-bold text-cyan-400">
                                  {formatNumber(metricsData.projections.daily_rates.events)}/day
                                </div>
                              </div>
                              <div className="p-4 rounded-lg bg-muted/30">
                                <div className="text-sm text-muted-foreground mb-1">Snapshots</div>
                                <div className="text-xl font-bold text-purple-400">
                                  {formatNumber(metricsData.projections.daily_rates.snapshots)}/day
                                </div>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      </motion.div>
                    )}

                    {/* Events Over Time Chart */}
                    {metricsData.data?.events_count && metricsData.data.events_count.length > 0 && (
                      <motion.div variants={itemVariants}>
                        <Card className="border-green-500/20">
                          <CardHeader>
                            <div className="flex items-center gap-3">
                              <div className="p-2 rounded-lg bg-cyan-500/10">
                                <Activity className="w-5 h-5 text-cyan-400" />
                              </div>
                              <div>
                                <CardTitle className="text-lg">Events Over Time</CardTitle>
                                <CardDescription>Hourly event ingestion rate</CardDescription>
                              </div>
                            </div>
                          </CardHeader>
                          <CardContent>
                            <div className="h-64">
                              <ResponsiveContainer width="100%" height="100%">
                                <AreaChart data={metricsData.data.events_count}>
                                  <defs>
                                    <linearGradient id="eventsGradient" x1="0" y1="0" x2="0" y2="1">
                                      <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.3} />
                                      <stop offset="95%" stopColor="#06b6d4" stopOpacity={0} />
                                    </linearGradient>
                                  </defs>
                                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
                                  <XAxis
                                    dataKey="timestamp"
                                    tickFormatter={(value) => format(new Date(value), "HH:mm")}
                                    stroke="hsl(var(--muted-foreground))"
                                    fontSize={12}
                                  />
                                  <YAxis
                                    stroke="hsl(var(--muted-foreground))"
                                    fontSize={12}
                                  />
                                  <Tooltip content={<CustomTooltip />} />
                                  <Area
                                    type="monotone"
                                    dataKey="value"
                                    name="Events"
                                    stroke="#06b6d4"
                                    fill="url(#eventsGradient)"
                                    strokeWidth={2}
                                  />
                                </AreaChart>
                              </ResponsiveContainer>
                            </div>
                          </CardContent>
                        </Card>
                      </motion.div>
                    )}

                    {/* Current Metrics Summary */}
                    {metricsData.current && (
                      <motion.div variants={itemVariants}>
                        <Card className="border-green-500/20">
                          <CardHeader>
                            <div className="flex items-center gap-3">
                              <div className="p-2 rounded-lg bg-green-500/10">
                                <Database className="w-5 h-5 text-green-400" />
                              </div>
                              <div>
                                <CardTitle className="text-lg">Current Record Counts</CardTitle>
                                <CardDescription>Live database statistics</CardDescription>
                              </div>
                            </div>
                          </CardHeader>
                          <CardContent>
                            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                              <div className="p-4 rounded-lg bg-muted/30 text-center">
                                <div className="text-2xl font-bold text-green-400">
                                  {formatNumber(metricsData.current.events_count)}
                                </div>
                                <div className="text-sm text-muted-foreground">Events</div>
                              </div>
                              <div className="p-4 rounded-lg bg-muted/30 text-center">
                                <div className="text-2xl font-bold text-emerald-400">
                                  {formatNumber(metricsData.current.snapshots_count)}
                                </div>
                                <div className="text-sm text-muted-foreground">Snapshots</div>
                              </div>
                              <div className="p-4 rounded-lg bg-muted/30 text-center">
                                <div className="text-2xl font-bold text-cyan-400">
                                  {formatNumber(metricsData.current.webhook_requests_count)}
                                </div>
                                <div className="text-sm text-muted-foreground">Webhooks</div>
                              </div>
                              <div className="p-4 rounded-lg bg-muted/30 text-center">
                                <div className="text-2xl font-bold text-purple-400">
                                  {formatNumber(metricsData.current.ai_jobs_count)}
                                </div>
                                <div className="text-sm text-muted-foreground">AI Jobs</div>
                              </div>
                              <div className="p-4 rounded-lg bg-muted/30 text-center">
                                <div className="text-2xl font-bold text-amber-400">
                                  {formatNumber(metricsData.current.total_rows)}
                                </div>
                                <div className="text-sm text-muted-foreground">Total Rows</div>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      </motion.div>
                    )}
                  </>
                )}

                {!isMetricsLoading && metricsData && !metricsData.success && (
                  <motion.div variants={itemVariants}>
                    <Card className="border-red-500/20">
                      <CardContent className="pt-6">
                        <div className="flex items-center gap-3 text-red-400">
                          <AlertCircle className="w-5 h-5" />
                          <span>{metricsData.error || "Failed to load metrics"}</span>
                        </div>
                      </CardContent>
                    </Card>
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
