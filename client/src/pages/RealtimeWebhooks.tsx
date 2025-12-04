import { useState, useEffect, useCallback } from "react";
import { useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Activity, Filter, Pause, Play, RefreshCw, Camera, MapPin, Clock, Database, Cloud, Share2, CheckCircle2, XCircle, AlertCircle, Loader2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { format } from "date-fns";

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
  }, [fetchWebhooks, fetchServiceHealth]);

  // Auto-refresh webhooks every 3 seconds when not paused
  useEffect(() => {
    if (!isPaused) {
      const interval = setInterval(fetchWebhooks, 3000);
      return () => clearInterval(interval);
    }
  }, [isPaused, fetchWebhooks]);

  // Auto-refresh service health every 30 seconds
  useEffect(() => {
    const interval = setInterval(fetchServiceHealth, 30000);
    return () => clearInterval(interval);
  }, [fetchServiceHealth]);

  // Filter webhooks
  const filteredWebhooks = webhooks.filter((webhook) => {
    const levelMatch = filterLevel === "all" || webhook.level === parseInt(filterLevel);
    const topicMatch = filterTopic === "all" || webhook.topic === filterTopic;
    return levelMatch && topicMatch;
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
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-lg">Live Statistics</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <div className="p-2 bg-muted/50 rounded">
                  <div className="text-2xl font-bold">{stats.total}</div>
                  <div className="text-xs text-muted-foreground">Total Events</div>
                </div>
                <div className="p-2 bg-red-500/10 rounded">
                  <div className="text-2xl font-bold text-red-500">{stats.critical}</div>
                  <div className="text-xs text-muted-foreground">Critical</div>
                </div>
                <div className="p-2 bg-purple-500/10 rounded">
                  <div className="text-2xl font-bold text-purple-500">{stats.faces}</div>
                  <div className="text-xs text-muted-foreground">Face Matches</div>
                </div>
                <div className="p-2 bg-blue-500/10 rounded">
                  <div className="text-2xl font-bold text-blue-500">{stats.plates}</div>
                  <div className="text-xs text-muted-foreground">Plate Matches</div>
                </div>
              </div>
              
              <div className="h-px bg-border" />
              
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

          {/* Filters */}
          <Card>
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
                  <SelectTrigger>
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
                  <SelectTrigger>
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
              <Button
                variant="outline"
                size="sm"
                className="w-full"
                onClick={() => {
                  setFilterLevel("all");
                  setFilterTopic("all");
                }}
              >
                Clear Filters
              </Button>
            </CardContent>
          </Card>

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
                      initial={{ opacity: 0, y: -20 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 20 }}
                      transition={{ duration: 0.3, delay: index * 0.02 }}
                      layout
                    >
                      <Card className="hover:border-primary/50 transition-all">
                        <CardContent className="p-4">
                          <div className="flex items-start justify-between">
                            <div className="flex items-start gap-3">
                              <div className={`w-3 h-3 rounded-full mt-1.5 ${levelInfo.color}`} />
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
                              </div>
                            </div>
                            
                            <Badge className={`${levelInfo.color} text-white`}>
                              {levelInfo.label}
                            </Badge>
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
    </div>
  );
}
