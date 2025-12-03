import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Activity, Filter, Pause, Play } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { trpc } from "@/lib/trpc";
import { format } from "date-fns";

export default function RealtimeWebhooks() {
  const [, setLocation] = useLocation();
  const [isPaused, setIsPaused] = useState(false);
  const [filterLevel, setFilterLevel] = useState("all");
  const [filterModule, setFilterModule] = useState("all");
  
  // Fetch recent webhooks
  const { data: webhooks, refetch } = trpc.webhook.recent.useQuery({
    limit: 50,
  });

  // Auto-refresh every 3 seconds when not paused
  useEffect(() => {
    if (!isPaused) {
      const interval = setInterval(() => {
        refetch();
      }, 3000);
      return () => clearInterval(interval);
    }
  }, [isPaused, refetch]);

  const filteredWebhooks = webhooks?.filter((webhook) => {
    const matchesLevel = filterLevel === "all" || webhook.level === filterLevel;
    const matchesModule = filterModule === "all" || webhook.module === filterModule;
    return matchesLevel && matchesModule;
  }).map(webhook => ({
    ...webhook,
    timestamp: webhook.createdAt,
    level: webhook.level || "info",
    module: webhook.module || "unknown",
  })) || [];

  const getLevelColor = (level: string) => {
    const colors: Record<string, string> = {
      critical: "bg-red-500",
      high: "bg-orange-500",
      medium: "bg-yellow-500",
      low: "bg-blue-500",
      info: "bg-gray-500",
    };
    return colors[level] || "bg-gray-500";
  };

  const stats = {
    total: webhooks?.length || 0,
    critical: webhooks?.filter(w => w.level === "critical").length || 0,
    high: webhooks?.filter(w => w.level === "high").length || 0,
    lastUpdate: webhooks?.[0]?.createdAt || new Date(),
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
              <h1 className="text-xl font-bold">Real-Time Webhooks</h1>
              <p className="text-xs text-muted-foreground">Live event stream</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant={isPaused ? "default" : "outline"}
              size="sm"
              onClick={() => setIsPaused(!isPaused)}
            >
              {isPaused ? (
                <>
                  <Play className="w-4 h-4 mr-2" />
                  Resume
                </>
              ) : (
                <>
                  <Pause className="w-4 h-4 mr-2" />
                  Pause
                </>
              )}
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex h-[calc(100vh-4rem)]">
        {/* Sidebar */}
        <motion.div
          initial={{ x: -20, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          transition={{ duration: 0.4 }}
          className="w-80 border-r border-border bg-card/50 backdrop-blur p-4 space-y-4"
        >
          {/* Stats */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Live Statistics</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Total Events</span>
                <Badge variant="outline" className="text-lg font-bold">{stats.total}</Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Critical</span>
                <Badge className="bg-red-500 text-white">{stats.critical}</Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">High Priority</span>
                <Badge className="bg-orange-500 text-white">{stats.high}</Badge>
              </div>
              <div className="h-px bg-border my-2" />
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Last Update</span>
                <span className="text-xs font-mono">
                  {format(stats.lastUpdate, "HH:mm:ss")}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full ${isPaused ? "bg-gray-500" : "bg-green-500 animate-pulse"}`} />
                <span className="text-xs text-muted-foreground">
                  {isPaused ? "Paused" : "Live"}
                </span>
              </div>
            </CardContent>
          </Card>

          {/* Filters */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm flex items-center gap-2">
                <Filter className="w-4 h-4" />
                Filters
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Level</label>
                <Select value={filterLevel} onValueChange={setFilterLevel}>
                  <SelectTrigger>
                    <SelectValue placeholder="All Levels" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Levels</SelectItem>
                    <SelectItem value="critical">Critical</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="low">Low</SelectItem>
                    <SelectItem value="info">Info</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Module</label>
                <Select value={filterModule} onValueChange={setFilterModule}>
                  <SelectTrigger>
                    <SelectValue placeholder="All Modules" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Modules</SelectItem>
                    <SelectItem value="detection">Detection</SelectItem>
                    <SelectItem value="tracking">Tracking</SelectItem>
                    <SelectItem value="analytics">Analytics</SelectItem>
                    <SelectItem value="alert">Alert</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="w-full"
                onClick={() => {
                  setFilterLevel("all");
                  setFilterModule("all");
                }}
              >
                Clear Filters
              </Button>
            </CardContent>
          </Card>

          {/* Legend */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Level Legend</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-red-500" />
                <span className="text-xs">Critical</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-orange-500" />
                <span className="text-xs">High</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-yellow-500" />
                <span className="text-xs">Medium</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-blue-500" />
                <span className="text-xs">Low</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-gray-500" />
                <span className="text-xs">Info</span>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Event Stream */}
        <div className="flex-1 p-6 overflow-y-auto">
          <div className="space-y-3">
            <AnimatePresence mode="popLayout">
              {filteredWebhooks.length === 0 ? (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="flex items-center justify-center h-64"
                >
                  <div className="text-center text-muted-foreground">
                    <Activity className="w-16 h-16 mx-auto mb-4 opacity-50" />
                    <p>No webhooks to display</p>
                    <p className="text-sm">Waiting for incoming events...</p>
                  </div>
                </motion.div>
              ) : (
                filteredWebhooks.map((webhook, index) => (
                  <motion.div
                    key={`${webhook.id}-${index}`}
                    initial={{ opacity: 0, x: -20, scale: 0.95 }}
                    animate={{ opacity: 1, x: 0, scale: 1 }}
                    exit={{ opacity: 0, x: 20, scale: 0.95 }}
                    transition={{ duration: 0.3, delay: index * 0.02 }}
                    layout
                  >
                    <Card className="hover:border-primary/50 transition-all">
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex items-center gap-3">
                            <div className={`w-3 h-3 rounded-full ${getLevelColor(webhook.level).replace("bg-", "bg-")}`} />
                            <div>
                              <div className="font-semibold">{webhook.module}</div>
                              <div className="text-xs text-muted-foreground">
                                {format(webhook.timestamp, "PPpp")}
                              </div>
                            </div>
                          </div>
                          <Badge className={`${getLevelColor(webhook.level)} text-white`}>
                            {webhook.level}
                          </Badge>
                        </div>
                        <div className="text-sm text-muted-foreground mt-2">
                          <pre className="whitespace-pre-wrap font-mono text-xs bg-muted/50 p-2 rounded">
                            {JSON.stringify(webhook.payload, null, 2)}
                          </pre>
                        </div>
                      </CardContent>
                    </Card>
                  </motion.div>
                ))
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </div>
  );
}
