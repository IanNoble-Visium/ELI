import { useState } from "react";
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
  CheckCircle
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

export default function Settings() {
  const [, setLocation] = useLocation();
  const [retentionDays, setRetentionDays] = useState([7]);
  
  const { data: config } = trpc.config.get.useQuery({ key: "dataRetentionDays" });
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
              <CardTitle>Storage Statistics</CardTitle>
              <CardDescription>Current database and storage usage</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid md:grid-cols-3 gap-4">
                <div className="p-4 border border-border rounded-lg">
                  <div className="text-sm text-muted-foreground mb-1">PostgreSQL</div>
                  <div className="text-2xl font-bold">~250 MB</div>
                  <div className="text-xs text-muted-foreground mt-1">Events & Snapshots</div>
                </div>
                <div className="p-4 border border-border rounded-lg">
                  <div className="text-sm text-muted-foreground mb-1">Neo4j</div>
                  <div className="text-2xl font-bold">~180 MB</div>
                  <div className="text-xs text-muted-foreground mt-1">Graph Relationships</div>
                </div>
                <div className="p-4 border border-border rounded-lg">
                  <div className="text-sm text-muted-foreground mb-1">Cloudinary</div>
                  <div className="text-2xl font-bold">~2.4 GB</div>
                  <div className="text-xs text-muted-foreground mt-1">Images & Videos</div>
                </div>
              </div>
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
