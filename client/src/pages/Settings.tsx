import { useState, useEffect, useCallback } from "react";
import { useLocation } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Label } from "@/components/ui/label";
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
} from "lucide-react";
import { motion } from "framer-motion";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
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

  useEffect(() => {
    fetchCloudinaryData();
  }, [fetchCloudinaryData]);
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
                  onClick={fetchCloudinaryData}
                  disabled={cloudinaryLoading}
                >
                  <RefreshCw className={`w-4 h-4 ${cloudinaryLoading ? "animate-spin" : ""}`} />
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid md:grid-cols-3 gap-4">
                <div className="p-4 border border-border rounded-lg">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                    <Database className="w-4 h-4" />
                    PostgreSQL
                  </div>
                  <div className="text-2xl font-bold">~250 MB</div>
                  <div className="text-xs text-muted-foreground mt-1">Events & Snapshots</div>
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
              
              {/* Cloudinary Details Link */}
              {cloudinaryData?.success && (
                <div className="mt-4 pt-4 border-t border-border/50">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setLocation("/dashboard/cloudinary")}
                    className="w-full border-blue-500/30 hover:bg-blue-500/10"
                  >
                    <Cloud className="w-4 h-4 mr-2 text-blue-400" />
                    View Detailed Cloudinary Metrics
                    <ExternalLink className="w-3 h-3 ml-2" />
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>

        {/* System Info */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3, duration: 0.4 }}
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
