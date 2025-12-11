import { useState, useEffect, useCallback } from "react";
import { useLocation, useSearch } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  ArrowLeft, AlertTriangle, CheckCircle, Clock, Play, Filter, Plus, X,
  MessageSquare, Tag, MapPin, User, Search, Database, Map, Network, Users,
  ExternalLink, Car, Package, Shield, Radio, Navigation, Activity, Eye,
  Target, Siren, Phone, FileText, RefreshCw, Loader2, Zap, TrendingUp
} from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { format } from "date-fns";
import { motion, AnimatePresence } from "framer-motion";

// =============================================================================
// TYPE DEFINITIONS
// =============================================================================

interface IncidentData {
  id: string;
  type: string;
  priority: string;
  status: string;
  location: string;
  region: string;
  description: string;
  assignedOfficer: string;
  assignedUnit: string;
  responseTime: number;
  createdAt: string;
  videoUrl: string;
  hasVideo: boolean;
}

interface Officer {
  id: string;
  name: string;
  rank: string;
  unit: string;
  status: "en_route" | "on_scene" | "patrol" | "available";
  eta?: string;
  avatar?: string;
  distance: string;
}

// =============================================================================
// MAIN COMPONENT
// =============================================================================

export default function IncidentManagement() {
  const [, setLocation] = useLocation();
  const [incidents, setIncidents] = useState<IncidentData[]>([]);
  const [selectedIncident, setSelectedIncident] = useState<IncidentData | null>(null);
  const [noteText, setNoteText] = useState("");
  const [tagText, setTagText] = useState("");
  const [tagColor, setTagColor] = useState("#D91023");
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [dbConnected, setDbConnected] = useState(true);
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterPriority, setFilterPriority] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");

  // Context from other screens (topology/map context menu navigation)
  const [contextSource, setContextSource] = useState<{
    from: string;
    nodeId: string;
    nodeType: string;
    nodeName: string;
    region?: string;
    location?: string;
  } | null>(null);

  // Parse URL search params for context menu navigation
  const searchParams = useSearch();

  useEffect(() => {
    if (searchParams) {
      const params = new URLSearchParams(searchParams);
      const from = params.get("from");
      const nodeId = params.get("nodeId");
      const nodeType = params.get("nodeType");
      const nodeName = params.get("nodeName");

      if (from && nodeId && nodeType && nodeName) {
        setContextSource({
          from,
          nodeId,
          nodeType,
          nodeName,
          region: params.get("region") || undefined,
          location: params.get("location") || undefined,
        });

        // Show toast notification
        toast.info(`Creating incident from ${from === "topology" ? "Topology Graph" : "Geographic Map"}`, {
          description: `Source: ${nodeName} (${nodeType})`,
          duration: 5000,
        });

        // Clear URL params without full navigation
        window.history.replaceState({}, "", window.location.pathname);
      }
    }
  }, [searchParams]);

  // =============================================================================
  // DATA FETCHING
  // =============================================================================

  const fetchIncidents = useCallback(async (showRefreshIndicator = false) => {
    try {
      if (showRefreshIndicator) {
        setIsRefreshing(true);
      } else {
        setIsLoading(true);
      }

      const response = await fetch("/api/data/incidents?limit=100", {
        credentials: "include",
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();

      if (data.success) {
        setIncidents(data.incidents || []);
        setDbConnected(data.dbConnected !== false);
      } else {
        setIncidents([]);
      }
    } catch (err) {
      console.error("[Incidents] Fetch error:", err);
      setIncidents([]);
      setDbConnected(false);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchIncidents();
  }, [fetchIncidents]);

  // =============================================================================
  // TRPC MUTATIONS
  // =============================================================================

  const { data: notes, refetch: refetchNotes } = trpc.incidents.getNotes.useQuery(
    { incidentId: selectedIncident?.id || "" },
    { enabled: !!selectedIncident }
  );
  const { data: tags, refetch: refetchTags } = trpc.incidents.getTags.useQuery(
    { incidentId: selectedIncident?.id || "" },
    { enabled: !!selectedIncident }
  );

  const addNoteMutation = trpc.incidents.addNote.useMutation({
    onSuccess: () => {
      toast.success("Note added successfully");
      setNoteText("");
      refetchNotes();
    },
    onError: (error) => {
      toast.error(`Failed to add note: ${error.message}`);
    },
  });

  const addTagMutation = trpc.incidents.addTag.useMutation({
    onSuccess: () => {
      toast.success("Tag added successfully");
      setTagText("");
      refetchTags();
    },
    onError: (error) => {
      toast.error(`Failed to add tag: ${error.message}`);
    },
  });

  const deleteNoteMutation = trpc.incidents.deleteNote.useMutation({
    onSuccess: () => {
      toast.success("Note deleted");
      refetchNotes();
    },
  });

  const deleteTagMutation = trpc.incidents.deleteTag.useMutation({
    onSuccess: () => {
      toast.success("Tag deleted");
      refetchTags();
    },
  });

  const handleAddNote = () => {
    if (!noteText.trim() || !selectedIncident) return;
    addNoteMutation.mutate({
      incidentId: selectedIncident.id,
      note: noteText,
    });
  };

  const handleAddTag = () => {
    if (!tagText.trim() || !selectedIncident) return;
    addTagMutation.mutate({
      incidentId: selectedIncident.id,
      tag: tagText,
      color: tagColor,
    });
  };

  // =============================================================================
  // FILTERING
  // =============================================================================

  const filteredIncidents = incidents.filter((incident) => {
    const matchesStatus = filterStatus === "all" || incident.status === filterStatus;
    const matchesPriority = filterPriority === "all" || incident.priority === filterPriority;
    const matchesSearch =
      incident.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      incident.type.toLowerCase().includes(searchQuery.toLowerCase()) ||
      incident.location.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesStatus && matchesPriority && matchesSearch;
  });

  // =============================================================================
  // HELPERS
  // =============================================================================

  const getPriorityColor = (priority: string) => {
    const colors: Record<string, string> = {
      critical: "bg-red-500",
      high: "bg-orange-500",
      medium: "bg-yellow-500",
      low: "bg-blue-500",
    };
    return colors[priority] || "bg-gray-500";
  };

  const getPriorityGlow = (priority: string) => {
    const glows: Record<string, string> = {
      critical: "shadow-red-500/50",
      high: "shadow-orange-500/50",
      medium: "shadow-yellow-500/50",
      low: "shadow-blue-500/50",
    };
    return glows[priority] || "";
  };

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      open: "bg-red-500",
      investigating: "bg-yellow-500",
      resolved: "bg-green-500",
      closed: "bg-gray-500",
    };
    return colors[status] || "bg-gray-500";
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "open": return <Siren className="w-4 h-4" />;
      case "investigating": return <Eye className="w-4 h-4" />;
      case "resolved": return <CheckCircle className="w-4 h-4" />;
      default: return <Clock className="w-4 h-4" />;
    }
  };

  const stats = {
    total: incidents.length,
    open: incidents.filter(i => i.status === "open").length,
    investigating: incidents.filter(i => i.status === "investigating").length,
    resolved: incidents.filter(i => i.status === "resolved").length,
    critical: incidents.filter(i => i.priority === "critical").length,
  };

  const hasData = incidents.length > 0;

  // =============================================================================
  // RENDER
  // =============================================================================

  return (
    <div className="min-h-screen bg-background">
      {/* Scanline overlay */}
      <div className="scanline-overlay pointer-events-none fixed inset-0 z-[100]" />

      {/* Header - Command Center Style */}
      <header className="border-b border-border bg-gradient-to-r from-slate-900/90 via-red-950/20 to-slate-900/90 backdrop-blur-xl sticky top-0 z-50">
        <div className="container flex items-center justify-between h-16">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setLocation("/dashboard")}
              className="hover:bg-white/10"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back
            </Button>
            <div>
              <div className="flex items-center gap-2">
                <Siren className="w-5 h-5 text-red-500" />
                <h1 className="text-xl font-bold bg-gradient-to-r from-red-400 to-orange-400 bg-clip-text text-transparent">
                  Command Center
                </h1>
                {stats.critical > 0 && (
                  <Badge variant="destructive" className="animate-pulse">
                    {stats.critical} CRITICAL
                  </Badge>
                )}
              </div>
              <p className="text-xs text-muted-foreground">Real-time incident response & coordination</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => fetchIncidents(true)}
              disabled={isRefreshing}
              className="gap-1.5 text-xs border-white/20"
            >
              {isRefreshing ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <RefreshCw className="w-3.5 h-3.5" />
              )}
              Refresh
            </Button>
            {!dbConnected && (
              <Badge variant="destructive" className="animate-pulse">
                <Database className="w-3 h-3 mr-1" />
                Offline
              </Badge>
            )}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex h-[calc(100vh-4rem)]">
        {/* Sidebar - Incident List */}
        <motion.div
          initial={{ x: -20, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          transition={{ duration: 0.4 }}
          className="w-[420px] border-r border-white/10 bg-gradient-to-b from-slate-900/50 to-slate-950/50 backdrop-blur overflow-y-auto"
        >
          {/* Stats Dashboard */}
          <div className="p-4 border-b border-white/10">
            {/* Context Source Banner */}
            {contextSource && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="mb-3 p-3 bg-gradient-to-r from-blue-500/20 to-purple-500/20 border border-blue-500/30 rounded-lg"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-blue-400" />
                    <div>
                      <p className="text-sm font-medium text-blue-300">
                        Create Incident from {contextSource.from === "topology" ? "Topology Graph" : "Geographic Map"}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Source: {contextSource.nodeName} ({contextSource.nodeType})
                        {contextSource.region && ` • Region: ${contextSource.region}`}
                      </p>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setContextSource(null)}
                    className="h-6 w-6 p-0 hover:bg-white/10"
                  >
                    <X className="w-3 h-3" />
                  </Button>
                </div>
                <div className="mt-2 pt-2 border-t border-white/10">
                  <p className="text-xs text-muted-foreground mb-2">Suggested incident details:</p>
                  <div className="flex flex-wrap gap-1">
                    <Badge variant="outline" className="text-[10px] border-blue-500/30 text-blue-300">
                      Type: {contextSource.nodeType === "camera" ? "Surveillance Alert" : contextSource.nodeType === "person" ? "Person of Interest" : contextSource.nodeType === "vehicle" ? "Vehicle Alert" : "General Alert"}
                    </Badge>
                    {contextSource.region && (
                      <Badge variant="outline" className="text-[10px] border-purple-500/30 text-purple-300">
                        Region: {contextSource.region}
                      </Badge>
                    )}
                    <Badge variant="outline" className="text-[10px] border-orange-500/30 text-orange-300">
                      Priority: High
                    </Badge>
                  </div>
                </div>
              </motion.div>
            )}

            <div className="grid grid-cols-4 gap-2">
              {[
                { label: "Total", value: stats.total, color: "text-white", bg: "bg-white/10" },
                { label: "Critical", value: stats.critical, color: "text-red-400", bg: "bg-red-500/20" },
                { label: "Active", value: stats.investigating, color: "text-yellow-400", bg: "bg-yellow-500/20" },
                { label: "Resolved", value: stats.resolved, color: "text-green-400", bg: "bg-green-500/20" },
              ].map((stat) => (
                <motion.div
                  key={stat.label}
                  whileHover={{ scale: 1.02 }}
                  className={`${stat.bg} rounded-lg p-3 text-center border border-white/10`}
                >
                  <div className={`text-2xl font-bold ${stat.color}`}>{stat.value}</div>
                  <div className="text-[10px] text-muted-foreground uppercase tracking-wider">{stat.label}</div>
                </motion.div>
              ))}
            </div>
          </div>

          {/* Filters */}
          <div className="p-4 space-y-3 border-b border-white/10 bg-white/5">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search incidents..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 bg-white/5 border-white/10"
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger className="bg-white/5 border-white/10">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="open">Open</SelectItem>
                  <SelectItem value="investigating">Investigating</SelectItem>
                  <SelectItem value="resolved">Resolved</SelectItem>
                  <SelectItem value="closed">Closed</SelectItem>
                </SelectContent>
              </Select>
              <Select value={filterPriority} onValueChange={setFilterPriority}>
                <SelectTrigger className="bg-white/5 border-white/10">
                  <SelectValue placeholder="Priority" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Priority</SelectItem>
                  <SelectItem value="critical">Critical</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="low">Low</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Incident List */}
          <div className="p-2 space-y-2">
            {isLoading ? (
              Array.from({ length: 6 }).map((_, i) => (
                <Card key={i} className="bg-white/5 border-white/10">
                  <CardContent className="p-3">
                    <div className="flex items-start justify-between mb-2">
                      <Skeleton className="h-4 w-24" />
                      <div className="flex gap-1">
                        <Skeleton className="h-5 w-14 rounded-full" />
                        <Skeleton className="h-5 w-16 rounded-full" />
                      </div>
                    </div>
                    <Skeleton className="h-4 w-32 mb-2" />
                    <Skeleton className="h-3 w-40" />
                  </CardContent>
                </Card>
              ))
            ) : !hasData ? (
              <div className="text-center py-12 text-muted-foreground">
                <Siren className="w-12 h-12 mx-auto mb-4 opacity-30" />
                <p className="text-sm">No incidents reported</p>
                <p className="text-xs mt-1">Incidents will appear when detected</p>
              </div>
            ) : (
              filteredIncidents.map((incident, index) => (
                <motion.div
                  key={incident.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.02, duration: 0.3 }}
                >
                  <Card
                    className={`cursor-pointer transition-all bg-white/5 border-white/10 hover:bg-white/10 hover:border-white/20 ${selectedIncident?.id === incident.id
                        ? `border-l-4 border-l-${incident.priority === 'critical' ? 'red' : incident.priority === 'high' ? 'orange' : 'yellow'}-500 bg-white/10`
                        : ""
                      } ${incident.priority === 'critical' ? 'shadow-lg ' + getPriorityGlow(incident.priority) : ''}`}
                    onClick={() => setSelectedIncident(incident)}
                  >
                    <CardContent className="p-3">
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex items-center gap-2">
                          {getStatusIcon(incident.status)}
                          <span className="font-mono text-sm font-semibold">{incident.id}</span>
                        </div>
                        <div className="flex gap-1">
                          <Badge className={`${getPriorityColor(incident.priority)} text-white text-[10px] ${incident.priority === 'critical' ? 'animate-pulse' : ''}`}>
                            {incident.priority}
                          </Badge>
                          <Badge className={`${getStatusColor(incident.status)} text-white text-[10px]`}>
                            {incident.status}
                          </Badge>
                        </div>
                      </div>
                      <div className="text-sm font-medium mb-1 text-white/90">{incident.type}</div>
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <MapPin className="w-3 h-3" />
                        <span className="truncate">{incident.location}</span>
                      </div>
                      <div className="flex items-center justify-between mt-2 text-xs text-muted-foreground">
                        <div className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {format(new Date(incident.createdAt), "HH:mm")}
                        </div>
                        <div className="flex items-center gap-1">
                          <Zap className="w-3 h-3 text-yellow-500" />
                          {incident.responseTime}m response
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              ))
            )}
          </div>
        </motion.div>

        {/* Detail Panel - Command Center View */}
        <div className="flex-1 overflow-y-auto bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
          {selectedIncident ? (
            <motion.div
              key={selectedIncident.id}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.4 }}
              className="p-6 space-y-6"
            >
              {/* Incident Header */}
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-3 mb-2">
                    <motion.div
                      animate={selectedIncident.priority === 'critical' ? { scale: [1, 1.1, 1] } : {}}
                      transition={{ duration: 1, repeat: Infinity }}
                    >
                      <Badge className={`${getPriorityColor(selectedIncident.priority)} text-white text-lg px-4 py-1`}>
                        {selectedIncident.priority.toUpperCase()}
                      </Badge>
                    </motion.div>
                    <Badge className={`${getStatusColor(selectedIncident.status)} text-white`}>
                      {selectedIncident.status}
                    </Badge>
                  </div>
                  <h2 className="text-3xl font-bold text-white">{selectedIncident.id}</h2>
                  <p className="text-xl text-muted-foreground">{selectedIncident.type}</p>
                </div>
                <Button variant="outline" size="sm" onClick={() => setSelectedIncident(null)} className="border-white/20">
                  <X className="w-4 h-4" />
                </Button>
              </div>

              {/* Command Grid */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {/* Dispatch Status Card */}
                <DispatchStatusCard incident={selectedIncident} />

                {/* Threat Analysis Card */}
                <ThreatAnalysisCard incident={selectedIncident} />
              </div>

              {/* Incident Details */}
              <div className="grid md:grid-cols-2 gap-4">
                <Card className="bg-white/5 border-white/10 backdrop-blur">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <FileText className="w-4 h-4 text-blue-400" />
                      Incident Details
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <div className="text-xs text-muted-foreground">Location</div>
                        <div className="flex items-center gap-2 mt-1 text-white">
                          <MapPin className="w-4 h-4 text-purple-400" />
                          <span className="text-sm">{selectedIncident.location}</span>
                        </div>
                      </div>
                      <div>
                        <div className="text-xs text-muted-foreground">Region</div>
                        <div className="text-sm text-white mt-1">{selectedIncident.region}</div>
                      </div>
                      <div>
                        <div className="text-xs text-muted-foreground">Created</div>
                        <div className="flex items-center gap-2 mt-1 text-white">
                          <Clock className="w-4 h-4 text-cyan-400" />
                          <span className="text-sm">{format(new Date(selectedIncident.createdAt), "PPpp")}</span>
                        </div>
                      </div>
                      <div>
                        <div className="text-xs text-muted-foreground">Response Time</div>
                        <div className="text-sm text-white mt-1">{selectedIncident.responseTime} minutes</div>
                      </div>
                    </div>
                    <div className="pt-2 border-t border-white/10">
                      <div className="text-xs text-muted-foreground mb-1">Description</div>
                      <div className="text-sm text-white/80">{selectedIncident.description}</div>
                    </div>
                  </CardContent>
                </Card>

                <Card className="bg-white/5 border-white/10 backdrop-blur">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <User className="w-4 h-4 text-green-400" />
                      Assignment
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div>
                      <div className="text-xs text-muted-foreground">Assigned Officer</div>
                      <div className="flex items-center gap-2 mt-1">
                        <Avatar className="h-8 w-8">
                          <AvatarFallback className="bg-green-500/20 text-green-400">
                            {selectedIncident.assignedOfficer?.charAt(0) || "?"}
                          </AvatarFallback>
                        </Avatar>
                        <span className="text-sm text-white">{selectedIncident.assignedOfficer || "Unassigned"}</span>
                      </div>
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground">Assigned Unit</div>
                      <div className="text-sm text-white mt-1">{selectedIncident.assignedUnit || "Unassigned"}</div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Video Evidence */}
              {selectedIncident.hasVideo && (
                <Card className="bg-white/5 border-white/10 backdrop-blur">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <Play className="w-4 h-4 text-red-400" />
                      Video Evidence
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="aspect-video bg-black/50 rounded-lg flex items-center justify-center border border-white/10">
                      <div className="text-center text-muted-foreground">
                        <Play className="w-12 h-12 mx-auto mb-2 opacity-50" />
                        <p className="text-sm">Video Player</p>
                        <p className="text-xs opacity-50">{selectedIncident.videoUrl}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Notes & Tags */}
              <div className="grid md:grid-cols-2 gap-4">
                {/* Notes */}
                <Card className="bg-white/5 border-white/10 backdrop-blur">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <MessageSquare className="w-4 h-4 text-blue-400" />
                      Notes
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex gap-2">
                      <Textarea
                        placeholder="Add a note..."
                        value={noteText}
                        onChange={(e) => setNoteText(e.target.value)}
                        className="min-h-[60px] bg-white/5 border-white/10"
                      />
                      <Button
                        onClick={handleAddNote}
                        disabled={!noteText.trim() || addNoteMutation.isPending}
                        size="sm"
                        className="bg-blue-600 hover:bg-blue-700"
                      >
                        <Plus className="w-4 h-4" />
                      </Button>
                    </div>
                    <div className="space-y-2 max-h-[200px] overflow-y-auto">
                      {notes && notes.length > 0 ? (
                        notes.map((note: any) => (
                          <div key={note.id} className="p-2 rounded bg-white/5 border border-white/10">
                            <div className="flex items-start justify-between">
                              <p className="text-sm text-white/80">{note.note}</p>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => deleteNoteMutation.mutate({ noteId: note.id })}
                                className="h-5 w-5 p-0 hover:bg-red-500/20"
                              >
                                <X className="w-3 h-3" />
                              </Button>
                            </div>
                            <p className="text-[10px] text-muted-foreground mt-1">
                              {format(new Date(note.createdAt), "MMM dd, HH:mm")}
                            </p>
                          </div>
                        ))
                      ) : (
                        <p className="text-xs text-muted-foreground text-center py-4">No notes yet</p>
                      )}
                    </div>
                  </CardContent>
                </Card>

                {/* Tags */}
                <Card className="bg-white/5 border-white/10 backdrop-blur">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <Tag className="w-4 h-4 text-purple-400" />
                      Tags
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex gap-2">
                      <Input
                        placeholder="Tag name..."
                        value={tagText}
                        onChange={(e) => setTagText(e.target.value)}
                        className="bg-white/5 border-white/10"
                      />
                      <Input
                        type="color"
                        value={tagColor}
                        onChange={(e) => setTagColor(e.target.value)}
                        className="w-12 p-1 h-9"
                      />
                      <Button
                        onClick={handleAddTag}
                        disabled={!tagText.trim() || addTagMutation.isPending}
                        size="sm"
                        className="bg-purple-600 hover:bg-purple-700"
                      >
                        <Plus className="w-4 h-4" />
                      </Button>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {tags && tags.length > 0 ? (
                        tags.map((tag: any) => (
                          <Badge
                            key={tag.id}
                            style={{ backgroundColor: tag.color || "#D91023" }}
                            className="text-white px-3 py-1 flex items-center gap-1"
                          >
                            {tag.tag}
                            <button
                              onClick={() => deleteTagMutation.mutate({ tagId: tag.id })}
                              className="ml-1 hover:opacity-70"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </Badge>
                        ))
                      ) : (
                        <p className="text-xs text-muted-foreground text-center py-4 w-full">No tags yet</p>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Quick Navigation */}
              <Card className="bg-gradient-to-r from-primary/10 to-orange-500/10 border-primary/30 backdrop-blur">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <ExternalLink className="w-4 h-4 text-primary" />
                    Quick Navigation
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-3 gap-3">
                    <Button
                      variant="outline"
                      className="h-auto py-4 flex flex-col items-center gap-2 border-white/20 hover:border-blue-500 hover:bg-blue-500/10"
                      onClick={() => setLocation(`/dashboard/map?region=${encodeURIComponent(selectedIncident.region)}`)}
                    >
                      <Map className="w-6 h-6 text-blue-400" />
                      <span className="text-xs">View on Map</span>
                    </Button>
                    <Button
                      variant="outline"
                      className="h-auto py-4 flex flex-col items-center gap-2 border-white/20 hover:border-purple-500 hover:bg-purple-500/10"
                      onClick={() => setLocation(`/dashboard/topology?incident=${encodeURIComponent(selectedIncident.id)}`)}
                    >
                      <Network className="w-6 h-6 text-purple-400" />
                      <span className="text-xs">View Topology</span>
                    </Button>
                    <Button
                      variant="outline"
                      className="h-auto py-4 flex flex-col items-center gap-2 border-white/20 hover:border-green-500 hover:bg-green-500/10"
                      onClick={() => setLocation(`/dashboard/pole?incident=${encodeURIComponent(selectedIncident.id)}`)}
                    >
                      <Users className="w-6 h-6 text-green-400" />
                      <span className="text-xs">POLE Analysis</span>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ) : (
            <div className="h-full flex items-center justify-center">
              <div className="text-center">
                <motion.div
                  animate={{ scale: [1, 1.05, 1], opacity: [0.5, 0.7, 0.5] }}
                  transition={{ duration: 2, repeat: Infinity }}
                >
                  <Target className="w-20 h-20 mx-auto mb-4 text-muted-foreground opacity-30" />
                </motion.div>
                <p className="text-lg text-muted-foreground">Select an incident to view details</p>
                <p className="text-sm text-muted-foreground/50 mt-1">Command center ready for dispatch</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* CSS */}
      <style>{`
        .scanline-overlay {
          background: linear-gradient(
            to bottom,
            rgba(255, 255, 255, 0),
            rgba(255, 255, 255, 0) 50%,
            rgba(0, 0, 0, 0.015) 50%,
            rgba(0, 0, 0, 0.015)
          );
          background-size: 100% 4px;
        }
      `}</style>
    </div>
  );
}

// =============================================================================
// SUB-COMPONENTS
// =============================================================================

function DispatchStatusCard({ incident }: { incident: IncidentData }) {
  // Mock officer data - in production, fetch via tRPC based on incident
  const officers: Officer[] = [
    {
      id: "1",
      name: incident.assignedOfficer || "Unassigned",
      rank: "Lead Officer",
      unit: incident.assignedUnit || "N/A",
      status: "on_scene",
      distance: "0km"
    },
    {
      id: "2",
      name: "Backup Unit",
      rank: "Patrol",
      unit: "PATROL-02",
      status: "en_route",
      eta: "3 min",
      distance: "1.5km"
    },
  ];

  return (
    <Card className="border-l-4 border-l-blue-600 bg-white/5 border-white/10 backdrop-blur">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium flex items-center justify-between">
          <span className="flex items-center gap-2">
            <Shield className="w-4 h-4 text-blue-400" />
            Response Units
          </span>
          <Badge variant="outline" className="animate-pulse border-blue-500 text-blue-400 text-[10px]">
            <Radio className="w-3 h-3 mr-1" />
            LIVE
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {officers.map((officer, i) => (
          <motion.div
            key={officer.id}
            initial={{ x: -20, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            transition={{ delay: i * 0.1 }}
            className="flex items-center justify-between p-2 rounded-lg bg-white/5 border border-white/10"
          >
            <div className="flex items-center gap-3">
              <div className="relative">
                <Avatar className="h-10 w-10 border-2 border-slate-800">
                  <AvatarFallback className="bg-blue-500/20 text-blue-400">
                    {officer.name.charAt(0)}
                  </AvatarFallback>
                </Avatar>
                <span className={`absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-slate-800 ${officer.status === 'on_scene' ? 'bg-green-500' :
                    officer.status === 'en_route' ? 'bg-yellow-500' : 'bg-gray-500'
                  }`} />
              </div>
              <div>
                <p className="text-sm font-semibold text-white">{officer.name}</p>
                <p className="text-xs text-muted-foreground">{officer.unit} • {officer.rank}</p>
              </div>
            </div>
            <div className="text-right">
              <div className="flex items-center gap-1 justify-end text-xs font-mono">
                {officer.status === 'on_scene' ? (
                  <span className="text-green-400 font-bold">ON SCENE</span>
                ) : (
                  <>
                    <Navigation className="w-3 h-3 text-blue-400" />
                    <span className="text-blue-400">{officer.eta}</span>
                  </>
                )}
              </div>
              <p className="text-[10px] text-muted-foreground">{officer.distance} away</p>
            </div>
          </motion.div>
        ))}
      </CardContent>
    </Card>
  );
}

function ThreatAnalysisCard({ incident }: { incident: IncidentData }) {
  const threatLevel = incident.priority === 'critical' ? 95 :
    incident.priority === 'high' ? 75 :
      incident.priority === 'medium' ? 50 : 25;

  return (
    <Card className="border-l-4 border-l-red-600 bg-white/5 border-white/10 backdrop-blur">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <Activity className="w-4 h-4 text-red-400" />
          Threat Analysis
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-1">
          <div className="flex justify-between text-xs">
            <span className="text-muted-foreground">Threat Level</span>
            <span className={`font-mono ${threatLevel > 70 ? 'text-red-400' : threatLevel > 40 ? 'text-yellow-400' : 'text-green-400'}`}>
              {threatLevel}%
            </span>
          </div>
          <Progress
            value={threatLevel}
            className="h-2 bg-white/10"
          />
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div className={`p-2 rounded border text-center ${incident.priority === 'critical' || incident.priority === 'high'
              ? 'bg-red-500/10 border-red-500/20'
              : 'bg-green-500/10 border-green-500/20'
            }`}>
            <div className="text-xs text-muted-foreground">Priority</div>
            <div className={`text-lg font-bold capitalize ${incident.priority === 'critical' ? 'text-red-400' :
                incident.priority === 'high' ? 'text-orange-400' :
                  incident.priority === 'medium' ? 'text-yellow-400' : 'text-green-400'
              }`}>
              {incident.priority}
            </div>
          </div>
          <div className={`p-2 rounded border text-center ${incident.status === 'open'
              ? 'bg-red-500/10 border-red-500/20'
              : incident.status === 'investigating'
                ? 'bg-yellow-500/10 border-yellow-500/20'
                : 'bg-green-500/10 border-green-500/20'
            }`}>
            <div className="text-xs text-muted-foreground">Status</div>
            <div className={`text-lg font-bold capitalize ${incident.status === 'open' ? 'text-red-400' :
                incident.status === 'investigating' ? 'text-yellow-400' : 'text-green-400'
              }`}>
              {incident.status}
            </div>
          </div>
        </div>

        <div className="p-2 rounded bg-white/5 text-xs font-mono border border-white/10">
          <span className="text-blue-400">SYS_LOG:</span>{" "}
          <span className="text-white/70">
            Incident {incident.id} - {incident.type} - Response time: {incident.responseTime}min
          </span>
        </div>
      </CardContent>
    </Card>
  );
}
