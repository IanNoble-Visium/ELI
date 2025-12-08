import { useState, useEffect, useCallback } from "react";
import { useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Activity, Filter, Pause, Play, RefreshCw, Camera, MapPin, Clock, Database, Cloud, Share2, CheckCircle2, XCircle, AlertCircle, Loader2, Image, Eye, TrendingUp, Zap } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { format } from "date-fns";

// Staggered animation variants
const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.05,
      delayChildren: 0.1,
    },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 15, scale: 0.98 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: {
      duration: 0.3,
      ease: [0.25, 0.46, 0.45, 0.94],
    },
  },
};

const cardVariants = {
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

interface WebhookData {
  id: string;
  receivedAt: string;
  processingTime: number;
  status: string;
  eventId: string;
  monitorId?: number;
  topic: string;
  module: string;
  level: number;
  startTime?: number;
  endTime?: number;
  channel: {
    id: number;
    name: string;
    type: string;
    latitude?: number;
    longitude?: number;
    address?: {
      country?: string;
      city?: string;
      street?: string;
    };
  };
  params?: any;
  snapshotsCount: number;
  hasImages: boolean;
  payloadSize: number;
  snapshots?: Array<{
    id: string;
    type?: string;
    path?: string;
    imageUrl?: string;
    cloudinaryPublicId?: string;
  }>;
}

interface ServiceStatus {
  name: string;
  status: "connected" | "disconnected" | "error" | "not_configured";
  latency?: number;
  message?: string;
  lastChecked: string;
}

interface EventStats {
  total: number;
  critical: number;
  high: number;
  faces: number;
  plates: number;
}

interface ThrottleStats {
  totalReceived: number;
  totalProcessed: number;
  totalSkipped: number;
  lastHourReceived: number;
  lastHourProcessed: number;
  lastHourSkipped: number;
  projectedIfNoThrottle: number;
  lastEventAt: string | null;  // ISO timestamp of last webhook event received
}

interface ThrottleConfig {
  enabled: boolean;
  processRatio: number;
  maxPerHour: number;
  samplingMethod: string;
  description: string;
}

interface ThrottleData {
  success: boolean;
  stats?: ThrottleStats;
  config?: ThrottleConfig;
  timestamp?: string;
}

export default function RealtimeWebhooks() {
  const [, setLocation] = useLocation();
  const [isPaused, setIsPaused] = useState(false);
  const [filterLevel, setFilterLevel] = useState("all");
  const [filterTopic, setFilterTopic] = useState("all");
  const [webhooks, setWebhooks] = useState<WebhookData[]>([]);
  const [eventStats, setEventStats] = useState<EventStats>({ total: 0, critical: 0, high: 0, faces: 0, plates: 0 });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastRefresh, setLastRefresh] = useState(new Date());
  const [services, setServices] = useState<ServiceStatus[]>([]);
  const [servicesLoading, setServicesLoading] = useState(true);
  const [selectedEvent, setSelectedEvent] = useState<WebhookData | null>(null);
  const [showImageViewer, setShowImageViewer] = useState(false);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [throttleData, setThrottleData] = useState<ThrottleData | null>(null);

  // Fetch throttle stats to show batch processing progress
  const fetchThrottleStats = useCallback(async () => {
    try {
      const response = await fetch("/api/cloudinary/throttle?action=stats", {
        credentials: "include",
      });
      const data = await response.json();
      if (data.success) {
        setThrottleData(data);
      }
    } catch (error) {
      console.error("[Webhooks] Failed to fetch throttle stats:", error);
    }
  }, []);

  // Fetch events from real database (events have full topic/level data)
  const fetchWebhooks = useCallback(async () => {
    try {
      const response = await fetch("/api/data/events?limit=100", {
        credentials: "include",
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();

      if (data.success) {
        // Transform events to webhook format for compatibility
        const webhookData = (data.events || []).map((event: any) => ({
          id: event.id,
          receivedAt: event.receivedAt,
          processingTime: event.processingTime || 0,
          status: "success",
          eventId: event.eventId,
          monitorId: event.monitorId,
          topic: event.topic || "Unknown",
          module: event.module || "Unknown",
          level: event.level || 1,
          startTime: event.startTime,
          endTime: event.endTime,
          channel: event.channel || {},
          params: event.params || {},
          snapshotsCount: event.snapshotsCount || 0,
          hasImages: event.hasImages || false,
          snapshots: event.snapshots || [],
          payloadSize: 0,
        }));
        setWebhooks(webhookData);
        // Set stats from API response (real database counts)
        if (data.stats) {
          setEventStats(data.stats);
        }
        setError(data.dbConnected === false ? "Database not configured" : null);
      } else {
        setWebhooks([]);
        setError(data.message || "Failed to fetch events");
      }

      setLastRefresh(new Date());
      setIsLoading(false);
    } catch (err) {
      console.error("[Webhooks] Fetch error:", err);
      setWebhooks([]);
      setError("Failed to connect to API");
      setIsLoading(false);
    }
  }, []);

  // Fetch service health status
  const fetchServiceHealth = useCallback(async () => {
    try {
      setServicesLoading(true);
      const response = await fetch("/api/health/services", { credentials: "include" });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      if (data.success && data.services) {
        setServices(data.services);
      }
    } catch (err) {
      console.error("[Services] Health check error:", err);
    } finally {
      setServicesLoading(false);
    }
  }, []);

  // Initial fetch
  useEffect(() => {
    fetchWebhooks();
    fetchServiceHealth();
    fetchThrottleStats();
  }, [fetchWebhooks, fetchServiceHealth, fetchThrottleStats]);

  // Auto-refresh webhooks and throttle stats every 3 seconds when not paused
  useEffect(() => {
    if (!isPaused) {
      const interval = setInterval(() => {
        fetchWebhooks();
        fetchThrottleStats();
      }, 3000);
      return () => clearInterval(interval);
    }
  }, [isPaused, fetchWebhooks, fetchThrottleStats]);

  // Auto-refresh service health every 30 seconds
  useEffect(() => {
    const interval = setInterval(fetchServiceHealth, 30000);
    return () => clearInterval(interval);
  }, [fetchServiceHealth]);

  // Helper function to check if an event has valid images
  const hasValidImages = (webhook: WebhookData): boolean => {
    // Check if event has snapshots with actual image URLs
    if (!webhook.snapshots || webhook.snapshots.length === 0) return false;
    // Check if at least one snapshot has a valid imageUrl
    return webhook.snapshots.some(snap => snap.imageUrl && snap.imageUrl.trim() !== '');
  };

  // Filter webhooks - exclude events without valid images, except critical events (level 3)
  const filteredWebhooks = webhooks.filter((webhook) => {
    const levelMatch = filterLevel === "all" || webhook.level === parseInt(filterLevel);
    const topicMatch = filterTopic === "all" || webhook.topic === filterTopic;
    
    // Critical events (level 3) are always shown regardless of image availability
    const isCritical = webhook.level === 3;
    // Non-critical events must have valid images to be displayed
    const imageCheck = isCritical || hasValidImages(webhook);
    
    return levelMatch && topicMatch && imageCheck;
  });

  // Get level info
  const getLevelInfo = (level: number) => {
    const levels: Record<number, { label: string; color: string }> = {
      0: { label: "Low", color: "bg-blue-500" },
      1: { label: "Normal", color: "bg-green-500" },
      2: { label: "High", color: "bg-orange-500" },
      3: { label: "Critical", color: "bg-red-500" },
    };
    return levels[level] || { label: "Unknown", color: "bg-gray-500" };
  };

  // Get topic color
  const getTopicColor = (topic: string) => {
    const colors: Record<string, string> = {
      FaceMatched: "text-purple-400",
      PlateMatched: "text-blue-400",
      Motion: "text-yellow-400",
      Intrusion: "text-red-400",
      Loitering: "text-orange-400",
    };
    return colors[topic] || "text-gray-400";
  };

  // Use stats from API (actual database counts) instead of counting from limited webhooks
  const stats = eventStats;

  // Unique topics for filter
  const uniqueTopics = Array.from(new Set(webhooks.map(w => w.topic)));

  // Image viewer functions
  const openImageViewer = (webhook: WebhookData, imageIndex: number = 0) => {
    setSelectedEvent(webhook);
    setCurrentImageIndex(imageIndex);
    setShowImageViewer(true);
  };

  const closeImageViewer = () => {
    setShowImageViewer(false);
    setSelectedEvent(null);
    setCurrentImageIndex(0);
  };

  const nextImage = () => {
    if (selectedEvent && selectedEvent.snapshots) {
      setCurrentImageIndex((prev) => 
        prev < selectedEvent.snapshots!.length - 1 ? prev + 1 : 0
      );
    }
  };

  const prevImage = () => {
    if (selectedEvent && selectedEvent.snapshots) {
      setCurrentImageIndex((prev) => 
        prev > 0 ? prev - 1 : selectedEvent.snapshots!.length - 1
      );
    }
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
              <p className="text-xs text-muted-foreground">
                IREX event stream • {webhooks.length} events
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={fetchWebhooks}
              disabled={isLoading}
            >
              <RefreshCw className={`w-4 h-4 mr-2 ${isLoading ? "animate-spin" : ""}`} />
              Refresh
            </Button>
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
          className="w-80 border-r border-border bg-card/50 backdrop-blur p-4 space-y-4 overflow-y-auto"
        >
          {/* Stats */}
          <motion.div
            variants={cardVariants}
            initial="hidden"
            animate="visible"
          >
            <Card className="hover:shadow-lg hover:shadow-primary/5 transition-shadow duration-300">
              <CardHeader className="pb-2">
                <CardTitle className="text-lg flex items-center gap-2">
                  Live Statistics
                  <motion.div
                    className="w-2 h-2 bg-green-500 rounded-full"
                    animate={{ scale: [1, 1.2, 1], opacity: [1, 0.7, 1] }}
                    transition={{ duration: 2, repeat: Infinity }}
                  />
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <motion.div
                  className="grid grid-cols-2 gap-2"
                  variants={containerVariants}
                  initial="hidden"
                  animate="visible"
                >
                  <motion.div
                    className="p-2 bg-muted/50 rounded hover:bg-muted/70 transition-colors cursor-default"
                    variants={itemVariants}
                    whileHover={{ scale: 1.02 }}
                  >
                    <div className="text-2xl font-bold">{stats.total.toLocaleString()}</div>
                    <div className="text-xs text-muted-foreground">Total Events</div>
                  </motion.div>
                  <motion.div
                    className="p-2 bg-red-500/10 rounded hover:bg-red-500/20 transition-colors cursor-default"
                    variants={itemVariants}
                    whileHover={{ scale: 1.02 }}
                  >
                    <div className="text-2xl font-bold text-red-500">{stats.critical.toLocaleString()}</div>
                    <div className="text-xs text-muted-foreground">Critical</div>
                  </motion.div>
                  <motion.div
                    className="p-2 bg-purple-500/10 rounded hover:bg-purple-500/20 transition-colors cursor-default"
                    variants={itemVariants}
                    whileHover={{ scale: 1.02 }}
                  >
                    <div className="text-2xl font-bold text-purple-500">{stats.faces.toLocaleString()}</div>
                    <div className="text-xs text-muted-foreground">Face Matches</div>
                  </motion.div>
                  <motion.div
                    className="p-2 bg-blue-500/10 rounded hover:bg-blue-500/20 transition-colors cursor-default"
                    variants={itemVariants}
                    whileHover={{ scale: 1.02 }}
                  >
                    <div className="text-2xl font-bold text-blue-500">{stats.plates.toLocaleString()}</div>
                    <div className="text-xs text-muted-foreground">Plate Matches</div>
                  </motion.div>
                </motion.div>
              
              <div className="h-px bg-border" />

              {/* Last Event Received - shows when the most recent webhook actually arrived */}
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground flex items-center gap-1.5">
                  <Zap className={`w-3 h-3 ${throttleData?.stats?.lastEventAt ? "text-green-500" : "text-muted-foreground"}`} />
                  Last Event
                </span>
                <div className="text-right">
                  {throttleData?.stats?.lastEventAt ? (
                    <>
                      <span className="text-xs font-mono text-green-500">
                        {new Date(throttleData.stats.lastEventAt).toLocaleString("en-US", {
                          month: "short",
                          day: "2-digit",
                          hour: "2-digit",
                          minute: "2-digit",
                          second: "2-digit",
                          hour12: false,
                        })}
                      </span>
                      <div className="text-[10px] text-muted-foreground/70">
                        {(() => {
                          const diffMs = Date.now() - new Date(throttleData.stats.lastEventAt).getTime();
                          const diffSecs = Math.floor(diffMs / 1000);
                          if (diffSecs < 60) return `${diffSecs}s ago`;
                          const diffMins = Math.floor(diffSecs / 60);
                          if (diffMins < 60) return `${diffMins}m ago`;
                          const diffHours = Math.floor(diffMins / 60);
                          return `${diffHours}h ${diffMins % 60}m ago`;
                        })()}
                      </div>
                    </>
                  ) : (
                    <span className="text-xs font-mono text-muted-foreground italic">
                      Waiting for first event...
                    </span>
                  )}
                </div>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Last Update</span>
                <span className="text-xs font-mono">
                  {format(lastRefresh, "HH:mm:ss")}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full ${isPaused ? "bg-gray-500" : "bg-green-500 animate-pulse"}`} />
                <span className="text-xs text-muted-foreground">
                  {isPaused ? "Paused" : "Live - Refreshing every 3s"}
                </span>
              </div>
            </CardContent>
            </Card>
          </motion.div>

          {/* Batch Processing Progress */}
          {throttleData?.config?.enabled && (
            <motion.div
              variants={cardVariants}
              initial="hidden"
              animate="visible"
              transition={{ delay: 0.05 }}
            >
              <Card className="hover:shadow-lg hover:shadow-cyan-500/5 transition-shadow duration-300 border-cyan-500/20">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <TrendingUp className="w-4 h-4 text-cyan-500" />
                    Batch Processing Progress
                    <motion.div
                      className="w-2 h-2 bg-cyan-500 rounded-full ml-auto"
                      animate={{ scale: [1, 1.3, 1], opacity: [0.7, 1, 0.7] }}
                      transition={{ duration: 1.5, repeat: Infinity }}
                    />
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {(() => {
                    const stats = throttleData?.stats;
                    const config = throttleData?.config;
                    if (!stats || !config) return null;

                    // Calculate progress toward next batch
                    // 10,000 events = 1 full cycle, 25 images processed per cycle
                    const cycleSize = 10000;
                    const imagesPerCycle = Math.round(config.processRatio * cycleSize);
                    const currentInCycle = stats.totalReceived % cycleSize;
                    const progressPercent = (currentInCycle / cycleSize) * 100;
                    const eventsUntilNextBatch = cycleSize - currentInCycle;
                    const skippedInCycle = Math.round(currentInCycle * (1 - config.processRatio));

                    return (
                      <>
                        {/* Current cycle progress */}
                        <div className="space-y-1.5">
                          <div className="flex items-center justify-between text-xs">
                            <span className="text-muted-foreground">Cycle Progress</span>
                            <span className="font-mono text-cyan-500">{progressPercent.toFixed(1)}%</span>
                          </div>
                          <Progress value={progressPercent} className="h-2 bg-cyan-500/10" />
                          <div className="flex items-center justify-between text-xs text-muted-foreground">
                            <span>{currentInCycle.toLocaleString()} / {cycleSize.toLocaleString()}</span>
                            <span>{eventsUntilNextBatch.toLocaleString()} until next batch</span>
                          </div>
                        </div>

                        <div className="h-px bg-border" />

                        {/* Stats grid */}
                        <div className="grid grid-cols-2 gap-2">
                          <div className="p-2 bg-cyan-500/10 rounded">
                            <div className="flex items-center gap-1.5">
                              <Zap className="w-3 h-3 text-cyan-500" />
                              <span className="text-lg font-bold text-cyan-500">
                                {stats.totalReceived.toLocaleString()}
                              </span>
                            </div>
                            <div className="text-xs text-muted-foreground">Total Received</div>
                          </div>
                          <div className="p-2 bg-orange-500/10 rounded">
                            <div className="text-lg font-bold text-orange-500">
                              {stats.totalSkipped.toLocaleString()}
                            </div>
                            <div className="text-xs text-muted-foreground">Skipped</div>
                          </div>
                          <div className="p-2 bg-green-500/10 rounded">
                            <div className="text-lg font-bold text-green-500">
                              {stats.totalProcessed.toLocaleString()}
                            </div>
                            <div className="text-xs text-muted-foreground">Images Saved</div>
                          </div>
                          <div className="p-2 bg-purple-500/10 rounded">
                            <div className="text-lg font-bold text-purple-500">
                              {imagesPerCycle}
                            </div>
                            <div className="text-xs text-muted-foreground">Per 10K Events</div>
                          </div>
                        </div>

                        {/* Last hour stats */}
                        {(stats.lastHourReceived > 0) && (
                          <>
                            <div className="h-px bg-border" />
                            <div className="text-xs space-y-1">
                              <div className="flex justify-between">
                                <span className="text-muted-foreground">Last Hour</span>
                                <span className="font-mono">{stats.lastHourReceived.toLocaleString()} events</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-muted-foreground">Processed</span>
                                <span className="font-mono text-green-500">{stats.lastHourProcessed.toLocaleString()}</span>
                              </div>
                            </div>
                          </>
                        )}

                        <div className="text-xs text-muted-foreground italic">
                          {config.description}
                        </div>

                        {/* Last Event Received Timestamp */}
                        <div className="pt-2 border-t border-border">
                          <div className="flex items-center justify-between text-xs">
                            <span className="text-muted-foreground flex items-center gap-1">
                              <Zap className={`w-3 h-3 ${stats.lastEventAt ? "text-green-500" : "text-muted-foreground"}`} />
                              Last Event Received
                            </span>
                            {stats.lastEventAt ? (
                              <span className="font-mono text-green-500">
                                {new Date(stats.lastEventAt).toLocaleString("en-US", {
                                  month: "short",
                                  day: "2-digit",
                                  hour: "2-digit",
                                  minute: "2-digit",
                                  second: "2-digit",
                                  hour12: false,
                                })}
                              </span>
                            ) : (
                              <span className="font-mono text-muted-foreground italic">
                                Waiting for first event...
                              </span>
                            )}
                          </div>
                          {stats.lastEventAt && (
                            <div className="text-[10px] text-muted-foreground/70 text-right mt-0.5">
                              {(() => {
                                const diffMs = Date.now() - new Date(stats.lastEventAt).getTime();
                                const diffSecs = Math.floor(diffMs / 1000);
                                if (diffSecs < 60) return `${diffSecs}s ago`;
                                const diffMins = Math.floor(diffSecs / 60);
                                if (diffMins < 60) return `${diffMins}m ago`;
                                const diffHours = Math.floor(diffMins / 60);
                                return `${diffHours}h ${diffMins % 60}m ago`;
                              })()}
                            </div>
                          )}
                        </div>
                      </>
                    );
                  })()}
                </CardContent>
              </Card>
            </motion.div>
          )}

          {/* Filters */}
          <motion.div
            variants={cardVariants}
            initial="hidden"
            animate="visible"
            transition={{ delay: 0.1 }}
          >
            <Card className="hover:shadow-lg hover:shadow-primary/5 transition-shadow duration-300">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Filter className="w-4 h-4" />
                  Filters
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Priority Level</label>
                  <Select value={filterLevel} onValueChange={setFilterLevel}>
                    <SelectTrigger className="hover:border-primary/50 transition-colors">
                      <SelectValue placeholder="All Levels" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Levels</SelectItem>
                      <SelectItem value="3">Critical (3)</SelectItem>
                      <SelectItem value="2">High (2)</SelectItem>
                      <SelectItem value="1">Normal (1)</SelectItem>
                      <SelectItem value="0">Low (0)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Event Type</label>
                  <Select value={filterTopic} onValueChange={setFilterTopic}>
                    <SelectTrigger className="hover:border-primary/50 transition-colors">
                      <SelectValue placeholder="All Types" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Types</SelectItem>
                      {uniqueTopics.map(topic => (
                        <SelectItem key={topic} value={topic}>{topic}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full hover:border-primary/50 hover:bg-primary/10 transition-all"
                    onClick={() => {
                      setFilterLevel("all");
                      setFilterTopic("all");
                    }}
                  >
                    Clear Filters
                  </Button>
                </motion.div>
              </CardContent>
            </Card>
          </motion.div>

          {/* Legend */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Priority Legend</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-red-500" />
                <span className="text-xs">Critical (3)</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-orange-500" />
                <span className="text-xs">High (2)</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-green-500" />
                <span className="text-xs">Normal (1)</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-blue-500" />
                <span className="text-xs">Low (0)</span>
              </div>
            </CardContent>
          </Card>

          {/* Connection Status */}
          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Activity className="w-4 h-4" />
                  Service Status
                </CardTitle>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={fetchServiceHealth}
                  disabled={servicesLoading}
                  className="h-6 w-6 p-0"
                >
                  <RefreshCw className={`w-3 h-3 ${servicesLoading ? "animate-spin" : ""}`} />
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-2">
              {servicesLoading && services.length === 0 ? (
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Loader2 className="w-3 h-3 animate-spin" />
                  Checking services...
                </div>
              ) : (
                services.map((service) => {
                  const getStatusIcon = () => {
                    switch (service.status) {
                      case "connected":
                        return <CheckCircle2 className="w-4 h-4 text-green-500" />;
                      case "disconnected":
                        return <XCircle className="w-4 h-4 text-red-500" />;
                      case "error":
                        return <AlertCircle className="w-4 h-4 text-red-500" />;
                      case "not_configured":
                        return <AlertCircle className="w-4 h-4 text-yellow-500" />;
                      default:
                        return <AlertCircle className="w-4 h-4 text-gray-500" />;
                    }
                  };

                  const getServiceIcon = () => {
                    if (service.name.includes("PostgreSQL")) return <Database className="w-3 h-3" />;
                    if (service.name.includes("Cloudinary")) return <Cloud className="w-3 h-3" />;
                    if (service.name.includes("Neo4j")) return <Share2 className="w-3 h-3" />;
                    return <Database className="w-3 h-3" />;
                  };

                  const getStatusColor = () => {
                    switch (service.status) {
                      case "connected": return "bg-green-500/10 border-green-500/20";
                      case "disconnected": return "bg-red-500/10 border-red-500/20";
                      case "error": return "bg-red-500/10 border-red-500/20";
                      case "not_configured": return "bg-yellow-500/10 border-yellow-500/20";
                      default: return "bg-gray-500/10 border-gray-500/20";
                    }
                  };

                  return (
                    <div
                      key={service.name}
                      className={`flex items-center justify-between p-2 rounded border ${getStatusColor()}`}
                    >
                      <div className="flex items-center gap-2">
                        {getServiceIcon()}
                        <span className="text-xs font-medium">{service.name}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        {service.latency && (
                          <span className="text-xs text-muted-foreground">{service.latency}ms</span>
                        )}
                        {getStatusIcon()}
                      </div>
                    </div>
                  );
                })
              )}
              {services.length === 0 && !servicesLoading && (
                <div className="text-xs text-muted-foreground text-center py-2">
                  No service status available
                </div>
              )}
            </CardContent>
          </Card>

          {/* Webhook Endpoint Info */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Webhook Endpoint</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-xs font-mono bg-muted/50 p-2 rounded break-all">
                POST /webhook/irex
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                Configure IREX to send webhooks to this endpoint
              </p>
            </CardContent>
          </Card>
        </motion.div>

        {/* Event Stream */}
        <div className="flex-1 p-6 overflow-y-auto">
          {error && (
            <div className="mb-4 p-4 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400">
              {error}
            </div>
          )}
          
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
                    <p className="text-lg">No webhooks to display</p>
                    <p className="text-sm">Waiting for incoming IREX events...</p>
                  </div>
                </motion.div>
              ) : (
                filteredWebhooks.map((webhook, index) => {
                  const levelInfo = getLevelInfo(webhook.level);
                  return (
                    <motion.div
                      key={webhook.id}
                      initial={{ opacity: 0, x: -20, scale: 0.98 }}
                      animate={{ opacity: 1, x: 0, scale: 1 }}
                      exit={{ opacity: 0, x: 20, scale: 0.98 }}
                      transition={{
                        duration: 0.3,
                        delay: Math.min(index * 0.02, 0.3),
                        ease: [0.25, 0.46, 0.45, 0.94]
                      }}
                      layout
                      whileHover={{
                        x: 4,
                        transition: { duration: 0.2 }
                      }}
                    >
                      <Card className="hover:border-primary/50 hover:shadow-lg hover:shadow-primary/5 transition-all duration-300">
                        <CardContent className="p-4">
                          <div className="flex items-start justify-between">
                            <div className="flex items-start gap-3">
                              <motion.div
                                className={`w-3 h-3 rounded-full mt-1.5 ${levelInfo.color}`}
                                animate={webhook.level === 3 ? {
                                  scale: [1, 1.3, 1],
                                  opacity: [1, 0.7, 1]
                                } : {}}
                                transition={{
                                  duration: 1.5,
                                  repeat: Infinity,
                                  ease: "easeInOut"
                                }}
                              />
                              <div className="space-y-1">
                                <div className="flex items-center gap-2">
                                  <span className={`font-semibold ${getTopicColor(webhook.topic)}`}>
                                    {webhook.topic}
                                  </span>
                                  <Badge variant="outline" className="text-xs">
                                    {webhook.module}
                                  </Badge>
                                </div>

                                <div className="flex items-center gap-4 text-xs text-muted-foreground">
                                  <span className="flex items-center gap-1">
                                    <Camera className="w-3 h-3" />
                                    {webhook.channel.name}
                                  </span>
                                  {webhook.channel.address?.city && (
                                    <span className="flex items-center gap-1">
                                      <MapPin className="w-3 h-3" />
                                      {webhook.channel.address.city}
                                    </span>
                                  )}
                                  <span className="flex items-center gap-1">
                                    <Clock className="w-3 h-3" />
                                    {format(new Date(webhook.receivedAt), "HH:mm:ss")}
                                  </span>
                                </div>

                                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                  <span>Event ID: {webhook.eventId.substring(0, 20)}...</span>
                                  <span>•</span>
                                  <span>{webhook.snapshotsCount} snapshot(s)</span>
                                  <span>•</span>
                                  <span>{(webhook.payloadSize / 1024).toFixed(1)} KB</span>
                                  <span>•</span>
                                  <span>{webhook.processingTime}ms</span>
                                </div>

                                {/* Image Preview */}
                                {webhook.hasImages && webhook.snapshots && webhook.snapshots.length > 0 && (
                                  <div className="mt-2">
                                    <div className="flex items-center gap-2">
                                      <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => openImageViewer(webhook, 0)}
                                        className="h-6 px-2 text-xs hover:border-primary/50 hover:bg-primary/10"
                                      >
                                        <Eye className="w-3 h-3 mr-1" />
                                        View {webhook.snapshotsCount} Image{webhook.snapshotsCount > 1 ? 's' : ''}
                                      </Button>
                                      {webhook.snapshots.slice(0, 3).map((snapshot, index) => (
                                        <div
                                          key={snapshot.id}
                                          className="relative w-8 h-8 rounded cursor-pointer hover:opacity-80 transition-opacity"
                                          onClick={() => openImageViewer(webhook, index)}
                                        >
                                          {snapshot.imageUrl ? (
                                            <img
                                              src={snapshot.imageUrl}
                                              alt={`Snapshot ${index + 1}`}
                                              className="w-full h-full object-cover rounded"
                                            />
                                          ) : (
                                            <div className="w-full h-full bg-muted rounded flex items-center justify-center">
                                              <Image className="w-4 h-4 text-muted-foreground" />
                                            </div>
                                          )}
                                        </div>
                                      ))}
                                      {webhook.snapshots.length > 3 && (
                                        <div className="w-8 h-8 bg-muted rounded flex items-center justify-center text-xs text-muted-foreground">
                                          +{webhook.snapshots.length - 3}
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                )}
                              </div>
                            </div>

                            <motion.div
                              whileHover={{ scale: 1.05 }}
                              transition={{ duration: 0.2 }}
                            >
                              <Badge className={`${levelInfo.color} text-white`}>
                                {levelInfo.label}
                              </Badge>
                            </motion.div>
                          </div>
                        </CardContent>
                      </Card>
                    </motion.div>
                  );
                })
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>

      {/* Image Viewer Modal */}
      <AnimatePresence>
        {showImageViewer && selectedEvent && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4"
            onClick={closeImageViewer}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="relative max-w-6xl max-h-[90vh] bg-background rounded-lg"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="flex items-center justify-between p-4 border-b border-border">
                <div>
                  <h3 className="text-lg font-semibold">{selectedEvent.topic} Event</h3>
                  <p className="text-sm text-muted-foreground">
                    {selectedEvent.channel.name} • {format(new Date(selectedEvent.receivedAt), "MMM dd, HH:mm:ss")}
                  </p>
                </div>
                <Button variant="ghost" size="sm" onClick={closeImageViewer}>
                  ×
                </Button>
              </div>

              {/* Image Display */}
              <div className="relative p-4">
                {selectedEvent.snapshots && selectedEvent.snapshots.length > 0 && (
                  <>
                    <div className="flex items-center justify-center">
                      {selectedEvent.snapshots[currentImageIndex]?.imageUrl ? (
                        <img
                          src={selectedEvent.snapshots[currentImageIndex].imageUrl}
                          alt={`Event snapshot ${currentImageIndex + 1}`}
                          className="max-w-full max-h-[60vh] object-contain rounded"
                        />
                      ) : (
                        <div className="w-96 h-64 bg-muted rounded flex items-center justify-center">
                          <Image className="w-16 h-16 text-muted-foreground" />
                        </div>
                      )}
                    </div>

                    {/* Navigation */}
                    {selectedEvent.snapshots.length > 1 && (
                      <div className="flex items-center justify-between mt-4">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={prevImage}
                          className="hover:border-primary/50 hover:bg-primary/10"
                        >
                          ← Previous
                        </Button>
                        <div className="text-sm text-muted-foreground">
                          {currentImageIndex + 1} / {selectedEvent.snapshots.length}
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={nextImage}
                          className="hover:border-primary/50 hover:bg-primary/10"
                        >
                          Next →
                        </Button>
                      </div>
                    )}

                    {/* Thumbnail Strip */}
                    {selectedEvent.snapshots.length > 1 && (
                      <div className="flex gap-2 mt-4 overflow-x-auto pb-2">
                        {selectedEvent.snapshots.map((snapshot, index) => (
                          <div
                            key={snapshot.id}
                            className={`flex-shrink-0 w-16 h-16 rounded cursor-pointer border-2 transition-all ${
                              index === currentImageIndex
                                ? 'border-primary'
                                : 'border-transparent hover:border-border'
                            }`}
                            onClick={() => setCurrentImageIndex(index)}
                          >
                            {snapshot.imageUrl ? (
                              <img
                                src={snapshot.imageUrl}
                                alt={`Thumbnail ${index + 1}`}
                                className="w-full h-full object-cover rounded"
                              />
                            ) : (
                              <div className="w-full h-full bg-muted rounded flex items-center justify-center">
                                <Image className="w-6 h-6 text-muted-foreground" />
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
