import { useState, useEffect, useCallback } from "react";
import { useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  ArrowLeft,
  Cloud,
  HardDrive,
  Activity,
  Image,
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
} from "lucide-react";
import { motion } from "framer-motion";
import { format } from "date-fns";

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

export default function CloudinaryMonitoring() {
  const [, setLocation] = useLocation();
  const [usageData, setUsageData] = useState<UsageData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());
  const [autoRefresh, setAutoRefresh] = useState(true);

  const fetchUsageData = useCallback(async () => {
    try {
      setIsLoading(true);
      const response = await fetch("/api/cloudinary/usage", {
        credentials: "include",
      });
      const data = await response.json();
      setUsageData(data);
      setLastRefresh(new Date());
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

  // Initial fetch
  useEffect(() => {
    fetchUsageData();
  }, [fetchUsageData]);

  // Auto-refresh every 60 seconds
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

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-blue-950/20">
      {/* Decorative background elements */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 -right-32 w-96 h-96 bg-blue-500/5 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 -left-32 w-96 h-96 bg-cyan-500/5 rounded-full blur-3xl" />
      </div>

      {/* Header */}
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

      {/* Main Content */}
      <main className="container py-8 relative">
        {/* Error State */}
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

        {/* Loading Skeleton */}
        {isLoading && !usageData && (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
            {[...Array(8)].map((_, i) => (
              <div key={i} className="h-32 bg-card/50 rounded-xl animate-pulse" />
            ))}
          </div>
        )}

        {/* Usage Data */}
        {usageData?.success && usageData.usage && (
          <motion.div
            variants={containerVariants}
            initial="hidden"
            animate="visible"
            className="space-y-8"
          >
            {/* Plan & Credits Section */}
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
                </CardContent>
              </Card>
            </motion.div>

            {/* Stats Grid */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              {/* Storage */}
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

              {/* Bandwidth */}
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

              {/* Transformations */}
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

              {/* Resources */}
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

            {/* Detailed Breakdown */}
            <div className="grid gap-6 lg:grid-cols-2">
              {/* Credit Breakdown */}
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
                    {/* Storage Credits */}
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="flex items-center gap-2">
                          <HardDrive className="w-4 h-4 text-purple-400" />
                          Storage
                        </span>
                        <span className="font-medium">{usageData.usage.storage.credits_usage.toFixed(3)}</span>
                      </div>
                      <Progress value={(usageData.usage.storage.credits_usage / usageData.usage.credits.used) * 100} className="h-2" />
                    </div>

                    {/* Bandwidth Credits */}
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="flex items-center gap-2">
                          <Activity className="w-4 h-4 text-cyan-400" />
                          Bandwidth
                        </span>
                        <span className="font-medium">{usageData.usage.bandwidth.credits_usage.toFixed(3)}</span>
                      </div>
                      <Progress value={(usageData.usage.bandwidth.credits_usage / usageData.usage.credits.used) * 100} className="h-2" />
                    </div>

                    {/* Transformations Credits */}
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="flex items-center gap-2">
                          <Zap className="w-4 h-4 text-orange-400" />
                          Transformations
                        </span>
                        <span className="font-medium">{usageData.usage.transformations.credits_usage.toFixed(3)}</span>
                      </div>
                      <Progress value={(usageData.usage.transformations.credits_usage / usageData.usage.credits.used) * 100} className="h-2" />
                    </div>
                  </CardContent>
                </Card>
              </motion.div>

              {/* Media Limits & Info */}
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

                    {/* Rate Limit Info */}
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

                    {/* Last Updated */}
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
        )}
      </main>
    </div>
  );
}

