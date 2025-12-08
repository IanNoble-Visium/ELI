import { useState, useEffect, useCallback } from "react";
import { useLocation } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { 
  ArrowLeft, 
  Database, 
  Trash2,
  AlertTriangle,
  CheckCircle,
  Cloud,
  RefreshCw,
  ExternalLink,
  Loader2,
  Clock,
  Play,
  History,
  Timer,
  Zap,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Bomb,
  ShieldAlert,
} from "lucide-react";
import { motion } from "framer-motion";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { format, formatDistanceToNow } from "date-fns";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

interface CloudinaryUsageData {
  success: boolean;
  usage?: {
    credits: { used: number; limit: number; used_percent: number };
    storage: { usage: number; usage_mb: number; credits_usage: number };
    bandwidth: { usage: number; usage_mb: number; credits_usage: number };
    transformations: { usage: number; credits_usage: number };
    resources: number;
  };
  plan?: string;
  error?: string;
  configured?: boolean;
}

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

interface CronJobsData {
  success: boolean;
  jobs?: CronJobStatus[];
  influxdb_status?: {
    configured: boolean;
    host: string;
    org: string;
  };
  error?: string;
}

interface PostgreSQLUsageData {
  success: boolean;
  usage?: {
    database_size: { bytes: number; pretty: string };
    tables: Array<{ name: string; rows: number; size_bytes: number; size_pretty: string }>;
    total_rows: number;
    connections: { active: number; max: number };
    version: string;
    uptime_seconds: number;
  };
  plan?: string;
  region?: string;
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

export default function Settings() {
  const [, setLocation] = useLocation();
  const [retentionDays, setRetentionDays] = useState([7]);
  const [cloudinaryData, setCloudinaryData] = useState<CloudinaryUsageData | null>(null);
  const [cloudinaryLoading, setCloudinaryLoading] = useState(true);
  const [postgresData, setPostgresData] = useState<PostgreSQLUsageData | null>(null);
  const [postgresLoading, setPostgresLoading] = useState(true);
  const [cronJobsData, setCronJobsData] = useState<CronJobsData | null>(null);
  const [cronJobsLoading, setCronJobsLoading] = useState(true);
  const [triggeringJob, setTriggeringJob] = useState<string | null>(null);
  const [seedingData, setSeedingData] = useState(false);
  
  // Purge All Data state
  const [isPurgingAll, setIsPurgingAll] = useState(false);
  const [purgeAllProgress, setPurgeAllProgress] = useState<string | null>(null);
  const [showPurgeAllDialog, setShowPurgeAllDialog] = useState(false);
  const [includeCloudinary, setIncludeCloudinary] = useState(true);
  const [includeNeo4j, setIncludeNeo4j] = useState(true);
  
  const { data: config } = trpc.config.get.useQuery({ key: "dataRetentionDays" });

  // Fetch Cloudinary usage data
  const fetchCloudinaryData = useCallback(async () => {
    try {
      setCloudinaryLoading(true);
      const response = await fetch("/api/cloudinary/usage", { credentials: "include" });
      const data = await response.json();
      setCloudinaryData(data);
    } catch (error) {
      console.error("[Settings] Failed to fetch Cloudinary data:", error);
      setCloudinaryData({ success: false, error: "Failed to connect" });
    } finally {
      setCloudinaryLoading(false);
    }
  }, []);

  // Fetch PostgreSQL usage data
  const fetchPostgresData = useCallback(async () => {
    try {
      setPostgresLoading(true);
      const response = await fetch("/api/postgresql/usage", { credentials: "include" });
      const data = await response.json();
      setPostgresData(data);
    } catch (error) {
      console.error("[Settings] Failed to fetch PostgreSQL data:", error);
      setPostgresData({ success: false, error: "Failed to connect" });
    } finally {
      setPostgresLoading(false);
    }
  }, []);

  // Fetch CRON jobs status
  const fetchCronJobs = useCallback(async () => {
    try {
      setCronJobsLoading(true);
      const response = await fetch("/api/cron/status", { credentials: "include" });
      const data = await response.json();
      setCronJobsData(data);
    } catch (error) {
      console.error("[Settings] Failed to fetch CRON jobs:", error);
      setCronJobsData({ success: false, error: "Failed to connect" });
    } finally {
      setCronJobsLoading(false);
    }
  }, []);

  // Trigger a CRON job manually
  const triggerCronJob = useCallback(async (jobId: string) => {
    try {
      setTriggeringJob(jobId);
      const response = await fetch(`/api/cron/status?action=trigger&jobId=${jobId}`, {
        method: "POST",
        credentials: "include",
      });
      const data = await response.json();
      
      if (data.success) {
        toast.success("Job triggered successfully", {
          description: `${jobId} completed in ${data.duration}ms`,
        });
      } else {
        toast.error("Job failed", {
          description: data.error || "Unknown error",
        });
      }
      
      // Refresh job status
      await fetchCronJobs();
    } catch (error) {
      console.error("[Settings] Failed to trigger CRON job:", error);
      toast.error("Failed to trigger job");
    } finally {
      setTriggeringJob(null);
    }
  }, [fetchCronJobs]);

  // Seed InfluxDB with initial data
  const seedInfluxDB = useCallback(async () => {
    try {
      setSeedingData(true);
      const response = await fetch("/api/cron/status?action=seed", {
        method: "POST",
        credentials: "include",
      });
      const data = await response.json();
      
      if (data.success) {
        toast.success("InfluxDB seeded", {
          description: "Historical data points have been recorded",
        });
      } else {
        toast.error("Seeding failed", {
          description: data.error || "Unknown error",
        });
      }
    } catch (error) {
      console.error("[Settings] Failed to seed InfluxDB:", error);
      toast.error("Failed to seed data");
    } finally {
      setSeedingData(false);
    }
  }, []);

  // Purge ALL data from the application
  const purgeAllData = useCallback(async () => {
    try {
      setIsPurgingAll(true);
      setPurgeAllProgress("Initializing purge...");
      
      // Clear local storage first
      setPurgeAllProgress("Clearing local storage...");
      localStorage.clear();
      sessionStorage.clear();
      
      // Call the purge-all API
      setPurgeAllProgress("Purging database records...");
      const response = await fetch("/api/data/purge-all", {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          confirmPhrase: "DELETE ALL DATA",
          includeCloudinary,
          includeNeo4j,
        }),
      });
      
      const data = await response.json();
      
      if (data.success) {
        const parts: string[] = ["Database cleared"];
        if (data.neo4j?.nodesDeleted > 0) {
          parts.push(`${data.neo4j.nodesDeleted} Neo4j nodes`);
        }
        if (data.cloudinary?.totalDeleted > 0) {
          parts.push(`${data.cloudinary.totalDeleted} Cloudinary images`);
        }
        toast.success("All data purged successfully", {
          description: `${parts.join(", ")}. Duration: ${data.duration_ms}ms`,
        });
        
        // Refresh the page data
        await fetchCloudinaryData();
      } else {
        toast.error("Purge failed", {
          description: data.error || "Unknown error occurred",
        });
      }
    } catch (error) {
      console.error("[Settings] Failed to purge all data:", error);
      toast.error("Purge failed", {
        description: error instanceof Error ? error.message : "Unknown error",
      });
    } finally {
      setIsPurgingAll(false);
      setPurgeAllProgress(null);
      setShowPurgeAllDialog(false);
    }
  }, [includeCloudinary, includeNeo4j, fetchCloudinaryData]);

  useEffect(() => {
    fetchCloudinaryData();
    fetchPostgresData();
    fetchCronJobs();
  }, [fetchCloudinaryData, fetchPostgresData, fetchCronJobs]);
  const updateConfigMutation = trpc.config.set.useMutation({
    onSuccess: () => {
      toast.success("Settings saved successfully");
    },
    onError: (error) => {
      toast.error(`Failed to save settings: ${error.message}`);
    },
  });

  const purgeMutation = trpc.config.purge.useMutation({
    onSuccess: (result) => {
      toast.success("Data purge completed", {
        description: `Deleted ${result.deletedEvents} events, ${result.deletedSnapshots} snapshots, ${result.deletedWebhookRequests} webhook logs`,
      });
    },
    onError: (error) => {
      toast.error(`Purge failed: ${error.message}`);
    },
  });

  const handleSaveRetention = () => {
    updateConfigMutation.mutate({
      key: "dataRetentionDays",
      value: retentionDays[0].toString(),
    });
  };

  const handlePurgeData = () => {
    purgeMutation.mutate({ retentionDays: retentionDays[0] });
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card/50 backdrop-blur sticky top-0 z-50">
        <div className="container flex items-center justify-between h-16">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setLocation("/dashboard")}
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back
            </Button>
            <div>
              <h1 className="text-xl font-bold">Settings</h1>
              <p className="text-xs text-muted-foreground">System configuration and data management</p>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container py-8 space-y-8 max-w-4xl">
        {/* Data Retention */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
        >
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Database className="w-5 h-5" />
                Data Retention Policy
              </CardTitle>
              <CardDescription>
                Configure how long data is stored before automatic purge
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label htmlFor="retention-slider" className="text-base">
                    Retention Period
                  </Label>
                  <div className="text-2xl font-bold text-primary">
                    {retentionDays[0]} days
                  </div>
                </div>
                <Slider
                  id="retention-slider"
                  min={1}
                  max={30}
                  step={1}
                  value={retentionDays}
                  onValueChange={setRetentionDays}
                  className="w-full"
                />
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>1 day</span>
                  <span>30 days</span>
                </div>
              </div>

              <div className="p-4 bg-muted/50 rounded-lg space-y-2">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 text-yellow-500 mt-0.5" />
                  <div className="text-sm">
                    <p className="font-medium mb-1">What will be purged:</p>
                    <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                      <li>Events and snapshots older than {retentionDays[0]} days</li>
                      <li>Associated images from Cloudinary</li>
                      <li>Graph relationships from Neo4j</li>
                      <li>Webhook request logs</li>
                    </ul>
                  </div>
                </div>
              </div>

              <div className="flex gap-2">
                <Button
                  onClick={handleSaveRetention}
                  disabled={updateConfigMutation.isPending}
                >
                  <CheckCircle className="w-4 h-4 mr-2" />
                  Save Settings
                </Button>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Manual Purge */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1, duration: 0.4 }}
        >
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Trash2 className="w-5 h-5" />
                Manual Data Purge
              </CardTitle>
              <CardDescription>
                Immediately purge data older than the retention period
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="p-4 bg-destructive/10 border border-destructive/20 rounded-lg">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="w-5 h-5 text-destructive mt-0.5" />
                  <div>
                    <p className="font-medium text-destructive mb-1">Warning: This action cannot be undone</p>
                    <p className="text-sm text-muted-foreground">
                      This will permanently delete all data older than {retentionDays[0]} days from PostgreSQL,
                      Neo4j, and Cloudinary. Make sure you have backups if needed.
                    </p>
                  </div>
                </div>
              </div>

              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="destructive" disabled={purgeMutation.isPending}>
                    <Trash2 className="w-4 h-4 mr-2" />
                    {purgeMutation.isPending ? "Purging..." : "Purge Old Data Now"}
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This will permanently delete all events, snapshots, images, and graph data older than{" "}
                      {retentionDays[0]} days. This action cannot be undone.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={handlePurgeData}
                      className="bg-destructive hover:bg-destructive/90"
                    >
                      Yes, Purge Data
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </CardContent>
          </Card>
        </motion.div>

        {/* Purge ALL Data - Development/Testing Feature */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15, duration: 0.4 }}
        >
          <Card className="border-red-500/30">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-red-500">
                <Bomb className="w-5 h-5" />
                Reset All Data (Development)
              </CardTitle>
              <CardDescription>
                Completely reset the application to its initial state for testing
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-lg">
                <div className="flex items-start gap-2">
                  <ShieldAlert className="w-5 h-5 text-red-500 mt-0.5" />
                  <div>
                    <p className="font-medium text-red-500 mb-1">DANGER: This will delete ALL data</p>
                    <p className="text-sm text-muted-foreground mb-2">
                      This action will permanently delete:
                    </p>
                    <ul className="text-sm text-muted-foreground list-disc list-inside space-y-1">
                      <li>All events and snapshots from PostgreSQL</li>
                      <li>All graph relationships from Neo4j</li>
                      <li>All images from Cloudinary (batch deleted)</li>
                      <li>All webhook request logs</li>
                      <li>All AI inference jobs and detections</li>
                      <li>Local storage and session data</li>
                    </ul>
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="includeNeo4j"
                    checked={includeNeo4j}
                    onCheckedChange={(checked) => setIncludeNeo4j(checked === true)}
                  />
                  <Label htmlFor="includeNeo4j" className="text-sm">
                    Include Neo4j graph data
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="includeCloudinary"
                    checked={includeCloudinary}
                    onCheckedChange={(checked) => setIncludeCloudinary(checked === true)}
                  />
                  <Label htmlFor="includeCloudinary" className="text-sm">
                    Include Cloudinary images (may take several minutes for large datasets)
                  </Label>
                </div>
              </div>

              <AlertDialog open={showPurgeAllDialog} onOpenChange={setShowPurgeAllDialog}>
                <AlertDialogTrigger asChild>
                  <Button 
                    variant="destructive" 
                    disabled={isPurgingAll}
                    className="bg-red-600 hover:bg-red-700"
                  >
                    {isPurgingAll ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        {purgeAllProgress || "Purging..."}
                      </>
                    ) : (
                      <>
                        <Bomb className="w-4 h-4 mr-2" />
                        Purge All Data Now
                      </>
                    )}
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent className="border-red-500/30">
                  <AlertDialogHeader>
                    <AlertDialogTitle className="flex items-center gap-2 text-red-500">
                      <ShieldAlert className="w-5 h-5" />
                      Are you absolutely sure?
                    </AlertDialogTitle>
                    <AlertDialogDescription className="space-y-2">
                      <p>
                        This will <strong>permanently delete ALL data</strong> from the application,
                        including all events, snapshots, graph relationships, images, and logs.
                      </p>
                      <p className="text-red-400">
                        This action cannot be undone. The application will be reset to its initial state.
                      </p>
                      {includeNeo4j && (
                        <p className="text-purple-400">
                          🔗 Neo4j graph data will be deleted.
                        </p>
                      )}
                      {includeCloudinary && (
                        <p className="text-yellow-400">
                          ⚠️ Cloudinary purge is enabled - this may take several minutes for large image libraries.
                        </p>
                      )}
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel disabled={isPurgingAll}>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={purgeAllData}
                      disabled={isPurgingAll}
                      className="bg-red-600 hover:bg-red-700"
                    >
                      {isPurgingAll ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Purging...
                        </>
                      ) : (
                        "Yes, Delete Everything"
                      )}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </CardContent>
          </Card>
        </motion.div>

        {/* Storage Stats */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.4 }}
        >
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Storage Statistics</CardTitle>
                  <CardDescription>Current database and storage usage</CardDescription>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    fetchCloudinaryData();
                    fetchPostgresData();
                  }}
                  disabled={cloudinaryLoading || postgresLoading}
                >
                  <RefreshCw className={`w-4 h-4 ${(cloudinaryLoading || postgresLoading) ? "animate-spin" : ""}`} />
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid md:grid-cols-3 gap-4">
                <div className="p-4 border border-green-500/20 rounded-lg bg-green-500/5">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                    <Database className="w-4 h-4 text-green-400" />
                    PostgreSQL
                  </div>
                  {postgresLoading ? (
                    <div className="flex items-center gap-2">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span className="text-sm text-muted-foreground">Loading...</span>
                    </div>
                  ) : postgresData?.success && postgresData.usage ? (
                    <>
                      <div className="text-2xl font-bold text-green-400">
                        {postgresData.usage.database_size.pretty}
                      </div>
                      <div className="text-xs text-muted-foreground mt-1">
                        {postgresData.usage.total_rows.toLocaleString()} rows • {postgresData.plan}
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="text-lg font-medium text-yellow-500">Not configured</div>
                      <div className="text-xs text-muted-foreground mt-1">
                        {postgresData?.error || "Add DATABASE_URL"}
                      </div>
                    </>
                  )}
                </div>
                <div className="p-4 border border-border rounded-lg">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                    <Database className="w-4 h-4" />
                    Neo4j
                  </div>
                  <div className="text-2xl font-bold">~180 MB</div>
                  <div className="text-xs text-muted-foreground mt-1">Graph Relationships</div>
                </div>
                <div className="p-4 border border-blue-500/20 rounded-lg bg-blue-500/5">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                    <Cloud className="w-4 h-4 text-blue-400" />
                    Cloudinary
                  </div>
                  {cloudinaryLoading ? (
                    <div className="flex items-center gap-2">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span className="text-sm text-muted-foreground">Loading...</span>
                    </div>
                  ) : cloudinaryData?.success && cloudinaryData.usage ? (
                    <>
                      <div className="text-2xl font-bold text-blue-400">
                        {formatBytes(cloudinaryData.usage.storage.usage)}
                      </div>
                      <div className="text-xs text-muted-foreground mt-1">
                        {cloudinaryData.usage.resources.toLocaleString()} images • {cloudinaryData.plan}
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="text-lg font-medium text-yellow-500">Not configured</div>
                      <div className="text-xs text-muted-foreground mt-1">
                        {cloudinaryData?.error || "Add credentials in secrets"}
                      </div>
                    </>
                  )}
                </div>
              </div>
              
              {/* Monitoring Links */}
              <div className="mt-4 pt-4 border-t border-border/50 grid md:grid-cols-2 gap-3">
                {postgresData?.success && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setLocation("/dashboard/postgresql")}
                    className="border-green-500/30 hover:bg-green-500/10"
                  >
                    <Database className="w-4 h-4 mr-2 text-green-400" />
                    View PostgreSQL Metrics
                    <ExternalLink className="w-3 h-3 ml-2" />
                  </Button>
                )}
                {cloudinaryData?.success && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setLocation("/dashboard/cloudinary")}
                    className="border-blue-500/30 hover:bg-blue-500/10"
                  >
                    <Cloud className="w-4 h-4 mr-2 text-blue-400" />
                    View Cloudinary Metrics
                    <ExternalLink className="w-3 h-3 ml-2" />
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* CRON Jobs Management */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3, duration: 0.4 }}
        >
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Clock className="w-5 h-5" />
                    Scheduled Jobs
                  </CardTitle>
                  <CardDescription>
                    Manage and monitor automated tasks
                  </CardDescription>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={fetchCronJobs}
                  disabled={cronJobsLoading}
                >
                  <RefreshCw className={`w-4 h-4 ${cronJobsLoading ? "animate-spin" : ""}`} />
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {cronJobsLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                </div>
              ) : cronJobsData?.success && cronJobsData.jobs ? (
                <>
                  {/* InfluxDB Status */}
                  {cronJobsData.influxdb_status && (
                    <div className={`p-3 rounded-lg flex items-center gap-3 ${
                      cronJobsData.influxdb_status.configured 
                        ? "bg-green-500/10 border border-green-500/20" 
                        : "bg-yellow-500/10 border border-yellow-500/20"
                    }`}>
                      {cronJobsData.influxdb_status.configured ? (
                        <CheckCircle2 className="w-4 h-4 text-green-500" />
                      ) : (
                        <AlertCircle className="w-4 h-4 text-yellow-500" />
                      )}
                      <div className="flex-1">
                        <span className={`text-sm font-medium ${
                          cronJobsData.influxdb_status.configured ? "text-green-400" : "text-yellow-400"
                        }`}>
                          InfluxDB: {cronJobsData.influxdb_status.configured ? "Connected" : "Not Configured"}
                        </span>
                        {cronJobsData.influxdb_status.configured && (
                          <span className="text-xs text-muted-foreground ml-2">
                            {cronJobsData.influxdb_status.org} @ {cronJobsData.influxdb_status.host.replace("https://", "")}
                          </span>
                        )}
                      </div>
                      {cronJobsData.influxdb_status.configured && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={seedInfluxDB}
                          disabled={seedingData}
                          className="border-green-500/30 hover:bg-green-500/10"
                        >
                          {seedingData ? (
                            <Loader2 className="w-3 h-3 animate-spin mr-1" />
                          ) : (
                            <Zap className="w-3 h-3 mr-1" />
                          )}
                          Seed Data
                        </Button>
                      )}
                    </div>
                  )}

                  {/* Job List */}
                  <div className="space-y-3">
                    {cronJobsData.jobs.map((job) => (
                      <div
                        key={job.id}
                        className="p-4 border border-border rounded-lg hover:border-blue-500/30 transition-colors"
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <h4 className="font-medium truncate">{job.name}</h4>
                              {job.enabled && job.dependenciesOk ? (
                                <Badge variant="outline" className="border-green-500/30 text-green-400 text-xs">
                                  Active
                                </Badge>
                              ) : !job.dependenciesOk ? (
                                <Badge variant="outline" className="border-yellow-500/30 text-yellow-400 text-xs">
                                  Missing Config
                                </Badge>
                              ) : (
                                <Badge variant="outline" className="border-gray-500/30 text-gray-400 text-xs">
                                  Disabled
                                </Badge>
                              )}
                            </div>
                            <p className="text-sm text-muted-foreground mb-2">
                              {job.description}
                            </p>
                            <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
                              <div className="flex items-center gap-1">
                                <Timer className="w-3 h-3" />
                                <span>{job.scheduleDescription}</span>
                                <code className="ml-1 px-1 bg-muted/50 rounded">{job.schedule}</code>
                              </div>
                              {job.lastRun && (
                                <div className="flex items-center gap-1">
                                  <History className="w-3 h-3" />
                                  <span>
                                    Last: {formatDistanceToNow(new Date(job.lastRun), { addSuffix: true })}
                                  </span>
                                  {job.lastStatus === "success" && (
                                    <CheckCircle2 className="w-3 h-3 text-green-500" />
                                  )}
                                  {job.lastStatus === "error" && (
                                    <XCircle className="w-3 h-3 text-red-500" />
                                  )}
                                  {job.lastStatus === "skipped" && (
                                    <AlertCircle className="w-3 h-3 text-yellow-500" />
                                  )}
                                </div>
                              )}
                              {job.nextRun && (
                                <div className="flex items-center gap-1">
                                  <Clock className="w-3 h-3" />
                                  <span>
                                    Next: {format(new Date(job.nextRun), "HH:mm:ss")}
                                  </span>
                                </div>
                              )}
                            </div>
                            {job.missingDependencies.length > 0 && (
                              <div className="mt-2 text-xs text-yellow-400">
                                Missing: {job.missingDependencies.join(", ")}
                              </div>
                            )}
                            {job.lastError && (
                              <div className="mt-2 text-xs text-red-400 truncate">
                                Error: {job.lastError}
                              </div>
                            )}
                          </div>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => triggerCronJob(job.id)}
                            disabled={triggeringJob === job.id || !job.dependenciesOk}
                            className="shrink-0"
                          >
                            {triggeringJob === job.id ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <Play className="w-4 h-4" />
                            )}
                            <span className="ml-1 hidden sm:inline">Run Now</span>
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>

                  {cronJobsData.jobs.length === 0 && (
                    <div className="text-center py-8 text-muted-foreground">
                      No scheduled jobs configured
                    </div>
                  )}
                </>
              ) : (
                <div className="text-center py-8">
                  <AlertTriangle className="w-8 h-8 mx-auto text-yellow-500 mb-2" />
                  <p className="text-sm text-muted-foreground">
                    {cronJobsData?.error || "Failed to load CRON jobs"}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>

        {/* System Info */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4, duration: 0.4 }}
        >
          <Card>
            <CardHeader>
              <CardTitle>System Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Version</span>
                <span className="text-sm font-mono">1.0.0</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Environment</span>
                <span className="text-sm font-mono">Production</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Total Cameras</span>
                <span className="text-sm font-mono">3,084</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Regions</span>
                <span className="text-sm font-mono">25</span>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </main>
    </div>
  );
}
