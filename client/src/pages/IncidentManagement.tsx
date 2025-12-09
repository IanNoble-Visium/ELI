import { useState, useEffect, useCallback, useMemo } from "react";
import { useLocation } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, AlertTriangle, CheckCircle, Clock, Play, Filter, Plus, X, MessageSquare, Tag, MapPin, User, Search, Database, Map, Network, Users, ExternalLink, Car, Package, Globe } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { format } from "date-fns";
import { motion, AnimatePresence } from "framer-motion";

// Import structured POLE data
import {
  getIncidentPOLEData,
  polePeople,
  poleObjects,
  poleLocations,
  poleIncidents as poleIncidentsData,
  type POLEPerson as POLEPersonType,
  type POLEObject as POLEObjectType,
  type POLELocation as POLELocationType,
} from "@/data/poleData";

// Import translation helpers
import {
  type Language,
  getStoredLanguage,
  setStoredLanguage,
  t,
  getIncidentType,
  getStatus,
  getPriority,
  getRole,
  getRiskLevel,
  getObjectType,
  getObjectStatus,
  getLocationType,
  getDescription,
  getName,
} from "@/lib/translations";

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

// Interface for POLE data display in incidents
interface IncidentPOLEDisplayData {
  people: Array<{
    id: string;
    name: string;
    role: string;
    riskLevel?: string;
  }>;
  objects: Array<{
    id: string;
    name: string;
    type: string;
    description: string;
    status: string;
    plateNumber?: string;
  }>;
  locations: Array<{
    id: string;
    name: string;
    type: string;
    coordinates?: { lat: number; lng: number };
  }>;
}

/**
 * Get POLE data for an incident - first tries structured data, then falls back to database incident matching
 */
const getIncidentPOLEDisplayData = (incident: IncidentData): IncidentPOLEDisplayData => {
  try {
    // Safely access POLE data with fallbacks
    const incidentsData = poleIncidentsData || [];
    
    // First, try to find matching POLE incident by ID
    const poleIncident = incidentsData.find(p => p?.id === incident.id);
    
    if (poleIncident) {
      // Use structured POLE data
      const poleData = getIncidentPOLEData(poleIncident.id);
      if (poleData) {
        return {
          people: (poleData.people || []).map(p => ({
            id: p.id,
            name: p.name,
            role: p.role,
            riskLevel: p.riskLevel,
          })),
          objects: (poleData.objects || []).map(o => ({
            id: o.id,
            name: o.name,
            type: o.type,
            description: o.description,
            status: o.status,
            plateNumber: o.plateNumber,
          })),
          locations: (poleData.locations || []).map(l => ({
            id: l.id,
            name: l.name,
            type: l.type,
            coordinates: { lat: l.latitude, lng: l.longitude },
          })),
        };
      }
    }
    
    // Try to match by region and type for database incidents
    const matchingPoleIncident = incidentsData.find(
      p => p?.region === incident.region && 
           (p?.type?.toLowerCase().includes(incident.type.toLowerCase().split(' ')[0]) ||
            incident.type.toLowerCase().includes(p?.type?.toLowerCase().split(' ')[0] || ''))
    );
    
    if (matchingPoleIncident) {
      const poleData = getIncidentPOLEData(matchingPoleIncident.id);
      if (poleData) {
        return {
          people: (poleData.people || []).map(p => ({
            id: p.id,
            name: p.name,
            role: p.role,
            riskLevel: p.riskLevel,
          })),
          objects: (poleData.objects || []).map(o => ({
            id: o.id,
            name: o.name,
            type: o.type,
            description: o.description,
            status: o.status,
            plateNumber: o.plateNumber,
          })),
          locations: (poleData.locations || []).map(l => ({
            id: l.id,
            name: l.name,
            type: l.type,
            coordinates: { lat: l.latitude, lng: l.longitude },
          })),
        };
      }
    }
    
    // No matching POLE data - return empty (no mock data fallback)
    return { people: [], objects: [], locations: [] };
  } catch (error) {
    console.error("[IncidentManagement] Error getting POLE data:", error);
    return { people: [], objects: [], locations: [] };
  }
};

export default function IncidentManagement() {
  const [, setLocation] = useLocation();
  const [incidents, setIncidents] = useState<IncidentData[]>([]);
  const [selectedIncident, setSelectedIncident] = useState<any>(null);
  const [noteText, setNoteText] = useState("");
  const [tagText, setTagText] = useState("");
  const [tagColor, setTagColor] = useState("#D91023");
  const [isLoading, setIsLoading] = useState(true);
  const [dbConnected, setDbConnected] = useState(true);
  const [language, setLanguage] = useState<Language>("en");

  // Load language preference from localStorage on mount
  useEffect(() => {
    setLanguage(getStoredLanguage());
  }, []);

  // Toggle language and persist to localStorage
  const toggleLanguage = () => {
    const newLang = language === "en" ? "es" : "en";
    setLanguage(newLang);
    setStoredLanguage(newLang);
  };

  // Fetch incidents from database
  const fetchIncidents = useCallback(async () => {
    try {
      setIsLoading(true);
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
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Initial fetch
  useEffect(() => {
    fetchIncidents();
  }, [fetchIncidents]);

  // Fetch notes and tags for selected incident
  const { data: notes, refetch: refetchNotes } = trpc.incidents.getNotes.useQuery(
    { incidentId: selectedIncident?.id || "" },
    { enabled: !!selectedIncident }
  );
  const { data: tags, refetch: refetchTags } = trpc.incidents.getTags.useQuery(
    { incidentId: selectedIncident?.id || "" },
    { enabled: !!selectedIncident }
  );

  // Mutations
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
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterPriority, setFilterPriority] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");

  const filteredIncidents = incidents.filter((incident) => {
    const matchesStatus = filterStatus === "all" || incident.status === filterStatus;
    const matchesPriority = filterPriority === "all" || incident.priority === filterPriority;
    const matchesSearch = 
      incident.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      incident.type.toLowerCase().includes(searchQuery.toLowerCase()) ||
      incident.location.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesStatus && matchesPriority && matchesSearch;
  });

  const getPriorityColor = (priority: string) => {
    const colors: Record<string, string> = {
      critical: "bg-red-500",
      high: "bg-orange-500",
      medium: "bg-yellow-500",
      low: "bg-blue-500",
    };
    return colors[priority] || "bg-gray-500";
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

  const stats = {
    total: incidents.length,
    open: incidents.filter(i => i.status === "open").length,
    investigating: incidents.filter(i => i.status === "investigating").length,
    resolved: incidents.filter(i => i.status === "resolved").length,
    critical: incidents.filter(i => i.priority === "critical").length,
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
              {t("back", language)}
            </Button>
            <div>
              <h1 className="text-xl font-bold">{t("incidentManagement", language)}</h1>
              <p className="text-xs text-muted-foreground">
                {language === "en" ? "Real-time alerts and response coordination" : "Alertas en tiempo real y coordinación de respuesta"}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {/* Language Toggle */}
            <Button
              variant="outline"
              size="sm"
              onClick={toggleLanguage}
              className="gap-1.5 text-xs"
            >
              <Globe className="w-3.5 h-3.5" />
              {language === "en" ? "EN" : "ES"}
            </Button>
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
          className="w-96 border-r border-border bg-card/50 backdrop-blur overflow-y-auto"
        >
          {/* Stats */}
          <div className="p-4 border-b border-border">
            <div className="grid grid-cols-2 gap-3">
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
                <Card className="hover:border-primary/50 transition-colors">
                  <CardContent className="p-3">
                    <div className="text-2xl font-bold">{stats.total}</div>
                    <div className="text-xs text-muted-foreground">{t("total", language)}</div>
                  </CardContent>
                </Card>
              </motion.div>
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
                <Card className="hover:border-red-500/50 transition-colors">
                  <CardContent className="p-3">
                    <div className="text-2xl font-bold text-red-500">{stats.critical}</div>
                    <div className="text-xs text-muted-foreground">{t("critical", language)}</div>
                  </CardContent>
                </Card>
              </motion.div>
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
                <Card className="hover:border-yellow-500/50 transition-colors">
                  <CardContent className="p-3">
                    <div className="text-2xl font-bold text-yellow-500">{stats.investigating}</div>
                    <div className="text-xs text-muted-foreground">{t("investigating", language)}</div>
                  </CardContent>
                </Card>
              </motion.div>
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}>
                <Card className="hover:border-green-500/50 transition-colors">
                  <CardContent className="p-3">
                    <div className="text-2xl font-bold text-green-500">{stats.resolved}</div>
                    <div className="text-xs text-muted-foreground">{t("resolved", language)}</div>
                  </CardContent>
                </Card>
              </motion.div>
            </div>
          </div>

          {/* Filters */}
          <div className="p-4 space-y-3 border-b border-border">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder={t("searchIncidents", language)}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger>
                  <SelectValue placeholder={language === "en" ? "Status" : "Estado"} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t("allStatus", language)}</SelectItem>
                  <SelectItem value="open">{getStatus("open", language)}</SelectItem>
                  <SelectItem value="investigating">{getStatus("investigating", language)}</SelectItem>
                  <SelectItem value="resolved">{getStatus("resolved", language)}</SelectItem>
                  <SelectItem value="closed">{getStatus("closed", language)}</SelectItem>
                </SelectContent>
              </Select>
              <Select value={filterPriority} onValueChange={setFilterPriority}>
                <SelectTrigger>
                  <SelectValue placeholder={language === "en" ? "Priority" : "Prioridad"} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t("allPriority", language)}</SelectItem>
                  <SelectItem value="critical">{getPriority("critical", language)}</SelectItem>
                  <SelectItem value="high">{getPriority("high", language)}</SelectItem>
                  <SelectItem value="medium">{getPriority("medium", language)}</SelectItem>
                  <SelectItem value="low">{getPriority("low", language)}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Incident List */}
          <div className="p-2 space-y-2">
            {isLoading ? (
              // Loading skeleton for incidents
              Array.from({ length: 8 }).map((_, i) => (
                <Card key={i}>
                  <CardContent className="p-3">
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <Skeleton className="w-4 h-4 rounded" />
                        <Skeleton className="h-4 w-20" />
                      </div>
                      <div className="flex gap-1">
                        <Skeleton className="h-5 w-14 rounded-full" />
                        <Skeleton className="h-5 w-16 rounded-full" />
                      </div>
                    </div>
                    <Skeleton className="h-4 w-28 mb-2" />
                    <Skeleton className="h-3 w-32 mb-1" />
                    <Skeleton className="h-3 w-24" />
                  </CardContent>
                </Card>
              ))
            ) : (
              filteredIncidents.map((incident, index) => (
                <motion.div
                  key={incident.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.03, duration: 0.3 }}
                >
                  <Card
                    className={`cursor-pointer hover:border-primary/50 transition-all ${
                      selectedIncident?.id === incident.id ? "border-primary" : ""
                    }`}
                    onClick={() => setSelectedIncident(incident)}
                  >
                    <CardContent className="p-3">
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <AlertTriangle className={`w-4 h-4 ${getPriorityColor(incident.priority).replace("bg-", "text-")}`} />
                          <span className="font-mono text-sm font-semibold">{incident.id}</span>
                        </div>
                        <div className="flex gap-1">
                          <Badge className={`${getPriorityColor(incident.priority)} text-white text-xs`}>
                            {incident.priority}
                          </Badge>
                          <Badge className={`${getStatusColor(incident.status)} text-white text-xs`}>
                            {incident.status}
                          </Badge>
                        </div>
                      </div>
                      <div className="text-sm font-medium mb-1">{incident.type}</div>
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <MapPin className="w-3 h-3" />
                        {incident.location}
                      </div>
                      <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
                        <Clock className="w-3 h-3" />
                        {format(incident.createdAt, "MMM dd, HH:mm")}
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              ))
            )}
          </div>
        </motion.div>

        {/* Detail Panel */}
        <div className="flex-1 p-6 overflow-y-auto">
          {selectedIncident ? (
            <motion.div
              key={selectedIncident.id}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.4 }}
              className="space-y-6"
            >
              {/* Header */}
              <div>
                <div className="flex items-center gap-3 mb-2">
                  <h2 className="text-3xl font-bold">{selectedIncident.id}</h2>
                  <motion.div
                    animate={selectedIncident.priority === "critical" ? { scale: [1, 1.05, 1] } : {}}
                    transition={{ duration: 1.5, repeat: Infinity }}
                  >
                    <Badge className={`${getPriorityColor(selectedIncident.priority)} text-white`}>
                      {getPriority(selectedIncident.priority, language)}
                    </Badge>
                  </motion.div>
                  <Badge className={`${getStatusColor(selectedIncident.status)} text-white`}>
                    {getStatus(selectedIncident.status, language)}
                  </Badge>
                </div>
                <p className="text-xl text-muted-foreground">{getIncidentType(selectedIncident.type, language)}</p>
              </div>

              {/* Video Player */}
              {selectedIncident.hasVideo && (
                <Card>
                  <CardHeader>
                    <CardTitle>{t("videoEvidence", language)}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="aspect-video bg-black rounded-lg flex items-center justify-center">
                      <div className="text-center text-muted-foreground">
                        <Play className="w-12 h-12 mx-auto mb-2" />
                        <p>{language === "en" ? "Video Player Placeholder" : "Reproductor de Video"}</p>
                        <p className="text-xs">{selectedIncident.videoUrl}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Details */}
              <div className="grid md:grid-cols-2 gap-6">
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1 }}
                >
                  <Card>
                    <CardHeader>
                      <CardTitle>{t("incidentDetails", language)}</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div>
                        <div className="text-sm text-muted-foreground">{t("location", language)}</div>
                        <div className="flex items-center gap-2 mt-1">
                          <MapPin className="w-4 h-4" />
                          <span>{selectedIncident.location}</span>
                        </div>
                      </div>
                      <div>
                        <div className="text-sm text-muted-foreground">{t("created", language)}</div>
                        <div className="flex items-center gap-2 mt-1">
                          <Clock className="w-4 h-4" />
                          <span>{format(selectedIncident.createdAt, "PPpp")}</span>
                        </div>
                      </div>
                      <div>
                        <div className="text-sm text-muted-foreground">{t("responseTime", language)}</div>
                        <div className="mt-1">{selectedIncident.responseTime} {t("minutes", language)}</div>
                      </div>
                      <div>
                        <div className="text-sm text-muted-foreground">{t("description", language)}</div>
                        <div className="mt-1">{selectedIncident.description}</div>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>

                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2 }}
                >
                  <Card>
                    <CardHeader>
                      <CardTitle>{t("assignment", language)}</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div>
                        <div className="text-sm text-muted-foreground">{t("assignedOfficer", language)}</div>
                        <div className="flex items-center gap-2 mt-1">
                          <User className="w-4 h-4" />
                          <span>{selectedIncident.assignedOfficer}</span>
                        </div>
                      </div>
                      <div>
                        <div className="text-sm text-muted-foreground">{t("assignedUnit", language)}</div>
                        <div className="mt-1">{selectedIncident.assignedUnit}</div>
                      </div>
                      <div>
                        <div className="text-sm text-muted-foreground">{language === "en" ? "Region" : "Región"}</div>
                        <div className="mt-1">{selectedIncident.region}</div>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              </div>

              {/* POLE Entity Display */}
              {(() => {
                const poleData = getIncidentPOLEDisplayData(selectedIncident);
                const hasPoleData = poleData.people.length > 0 || poleData.objects.length > 0 || poleData.locations.length > 0;
                
                return (
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.3 }}
                  >
                    <Card>
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                          <Users className="w-5 h-5 text-green-500" />
                          {t("relatedPoleEntities", language)}
                        </CardTitle>
                        <CardDescription>
                          {hasPoleData 
                            ? t("poleEntitiesDescription", language)
                            : t("noPoleData", language)
                          }
                        </CardDescription>
                      </CardHeader>
                      <CardContent>
                        {hasPoleData ? (
                          <>
                            <div className="grid md:grid-cols-3 gap-4">
                              {/* People */}
                              <div className="space-y-2">
                                <h4 className="text-sm font-semibold flex items-center gap-2 text-blue-500">
                                  <User className="w-4 h-4" />
                                  {t("people", language)} ({poleData.people.length})
                                </h4>
                                <div className="space-y-2">
                                  {poleData.people.length > 0 ? poleData.people.map((person) => (
                                    <motion.div
                                      key={person.id}
                                      whileHover={{ scale: 1.02 }}
                                      className="p-2 bg-muted/50 rounded-lg cursor-pointer hover:bg-muted transition-colors"
                                      onClick={() => setLocation(`/dashboard/pole?personId=${encodeURIComponent(person.id)}`)}
                                    >
                                      <div className="flex items-center justify-between">
                                        <span className="text-sm font-medium">{person.name}</span>
                                        <Badge
                                          variant="outline"
                                          className={
                                            person.role === "suspect" ? "border-red-500 text-red-500" :
                                            person.role === "victim" ? "border-orange-500 text-orange-500" :
                                            person.role === "witness" ? "border-blue-500 text-blue-500" :
                                            person.role === "informant" ? "border-cyan-500 text-cyan-500" :
                                            person.role === "officer" ? "border-green-500 text-green-500" :
                                            "border-gray-500 text-gray-500"
                                          }
                                        >
                                          {getRole(person.role, language)}
                                        </Badge>
                                      </div>
                                      <div className="text-xs text-muted-foreground mt-1">{person.id}</div>
                                      {person.riskLevel && (
                                        <Badge
                                          className={`mt-1 text-xs ${
                                            person.riskLevel === "high" ? "bg-red-500" :
                                            person.riskLevel === "medium" ? "bg-yellow-500" :
                                            "bg-green-500"
                                          } text-white`}
                                        >
                                          {getRiskLevel(person.riskLevel, language)} {language === "en" ? "risk" : "riesgo"}
                                        </Badge>
                                      )}
                                    </motion.div>
                                  )) : (
                                    <p className="text-xs text-muted-foreground">{t("noPeopleLinked", language)}</p>
                                  )}
                                </div>
                              </div>

                              {/* Objects */}
                              <div className="space-y-2">
                                <h4 className="text-sm font-semibold flex items-center gap-2 text-orange-500">
                                  <Package className="w-4 h-4" />
                                  {t("objects", language)} ({poleData.objects.length})
                                </h4>
                                <div className="space-y-2">
                                  {poleData.objects.length > 0 ? poleData.objects.map((obj) => (
                                    <motion.div
                                      key={obj.id}
                                      whileHover={{ scale: 1.02 }}
                                      className="p-2 bg-muted/50 rounded-lg cursor-pointer hover:bg-muted transition-colors"
                                      onClick={() => setLocation(`/dashboard/pole?objectId=${encodeURIComponent(obj.id)}`)}
                                    >
                                      <div className="flex items-center justify-between">
                                        <span className="text-sm font-medium">{obj.name || obj.type}</span>
                                        <Badge
                                          variant="outline"
                                          className={
                                            obj.status === "evidence" ? "border-purple-500 text-purple-500" :
                                            obj.status === "recovered" ? "border-green-500 text-green-500" :
                                            obj.status === "flagged" ? "border-red-500 text-red-500" :
                                            obj.status === "tracked" ? "border-blue-500 text-blue-500" :
                                            "border-gray-500 text-gray-500"
                                          }
                                        >
                                          {getObjectStatus(obj.status, language)}
                                        </Badge>
                                      </div>
                                      <div className="text-xs text-muted-foreground mt-1">{obj.description}</div>
                                      {obj.plateNumber && (
                                        <div className="flex items-center gap-1 mt-1">
                                          <Car className="w-3 h-3 text-muted-foreground" />
                                          <span className="text-xs font-mono">{obj.plateNumber}</span>
                                        </div>
                                      )}
                                    </motion.div>
                                  )) : (
                                    <p className="text-xs text-muted-foreground">{t("noObjectsLinked", language)}</p>
                                  )}
                                </div>
                              </div>

                              {/* Locations */}
                              <div className="space-y-2">
                                <h4 className="text-sm font-semibold flex items-center gap-2 text-purple-500">
                                  <MapPin className="w-4 h-4" />
                                  {t("locations", language)} ({poleData.locations.length})
                                </h4>
                                <div className="space-y-2">
                                  {poleData.locations.length > 0 ? poleData.locations.map((loc) => (
                                    <motion.div
                                      key={loc.id}
                                      whileHover={{ scale: 1.02 }}
                                      className="p-2 bg-muted/50 rounded-lg cursor-pointer hover:bg-muted transition-colors"
                                      onClick={() => {
                                        if (loc.coordinates) {
                                          setLocation(`/dashboard/map?lat=${loc.coordinates.lat}&lng=${loc.coordinates.lng}`);
                                        } else {
                                          setLocation(`/dashboard/map?location=${encodeURIComponent(loc.name)}`);
                                        }
                                      }}
                                    >
                                      <div className="flex items-center justify-between">
                                        <span className="text-sm font-medium truncate max-w-[120px]">{loc.name}</span>
                                        <Badge
                                          variant="outline"
                                          className={
                                            loc.type === "crime_scene" ? "border-red-500 text-red-500" :
                                            loc.type === "safehouse" ? "border-orange-500 text-orange-500" :
                                            loc.type === "residence" ? "border-blue-500 text-blue-500" :
                                            loc.type === "business" ? "border-green-500 text-green-500" :
                                            loc.type === "transit" ? "border-cyan-500 text-cyan-500" :
                                            "border-gray-500 text-gray-500"
                                          }
                                        >
                                          {getLocationType(loc.type, language)}
                                        </Badge>
                                      </div>
                                      <div className="text-xs text-muted-foreground mt-1">{loc.id}</div>
                                      {loc.coordinates && (
                                        <div className="text-xs text-muted-foreground">
                                          {loc.coordinates.lat.toFixed(4)}, {loc.coordinates.lng.toFixed(4)}
                                        </div>
                                      )}
                                    </motion.div>
                                  )) : (
                                    <p className="text-xs text-muted-foreground">{t("noLocationsLinked", language)}</p>
                                  )}
                                </div>
                              </div>
                            </div>

                            {/* View All in POLE Analytics button */}
                            <div className="mt-4 pt-4 border-t border-border">
                              <Button
                                variant="outline"
                                className="w-full hover:border-green-500 hover:bg-green-500/10 transition-colors"
                                onClick={() => setLocation(`/dashboard/pole?incident=${encodeURIComponent(selectedIncident.id)}`)}
                              >
                                <Users className="w-4 h-4 mr-2 text-green-500" />
                                {t("viewFullPoleAnalysis", language)}
                                <ExternalLink className="w-4 h-4 ml-2" />
                              </Button>
                            </div>
                          </>
                        ) : (
                          <div className="text-center py-8 text-muted-foreground">
                            <Network className="w-12 h-12 mx-auto mb-3 opacity-50" />
                            <p className="text-sm">{t("noPoleData", language)}</p>
                            <p className="text-xs mt-1">{t("noPoleDataHint", language)}</p>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  </motion.div>
                );
              })()}

              {/* Notes Section */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 }}
              >
                <Card>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <MessageSquare className="w-5 h-5" />
                        <CardTitle>{t("notes", language)}</CardTitle>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {/* Add Note Form */}
                    <div className="flex gap-2">
                      <Textarea
                        placeholder={t("addNote", language)}
                        value={noteText}
                        onChange={(e) => setNoteText(e.target.value)}
                        className="min-h-[80px]"
                      />
                      <Button
                        onClick={handleAddNote}
                        disabled={!noteText.trim() || addNoteMutation.isPending}
                        className="bg-primary hover:bg-primary/90"
                      >
                        <Plus className="w-4 h-4 mr-1" />
                        {t("add", language)}
                      </Button>
                    </div>

                    {/* Notes List */}
                    <div className="space-y-2">
                      {notes && notes.length > 0 ? (
                        notes.map((note: any, idx: number) => (
                          <motion.div
                            key={note.id}
                            initial={{ opacity: 0, x: -10 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: idx * 0.05 }}
                          >
                            <Card className="bg-muted/50">
                              <CardContent className="p-3">
                                <div className="flex items-start justify-between">
                                  <div className="flex-1">
                                    <p className="text-sm">{note.note}</p>
                                    <p className="text-xs text-muted-foreground mt-1">
                                      {format(new Date(note.createdAt), "MMM dd, yyyy HH:mm")}
                                    </p>
                                  </div>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => deleteNoteMutation.mutate({ noteId: note.id })}
                                    className="h-6 w-6 p-0"
                                  >
                                    <X className="w-3 h-3" />
                                  </Button>
                                </div>
                              </CardContent>
                            </Card>
                          </motion.div>
                        ))
                      ) : (
                        <p className="text-sm text-muted-foreground text-center py-4">
                          {t("noNotesYet", language)}
                        </p>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </motion.div>

              {/* Tags Section */}
              {/* Tags Section */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5 }}
              >
                <Card>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Tag className="w-5 h-5" />
                        <CardTitle>{t("tags", language)}</CardTitle>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {/* Add Tag Form */}
                    <div className="flex gap-2">
                      <Input
                        placeholder={t("tagName", language)}
                        value={tagText}
                        onChange={(e) => setTagText(e.target.value)}
                      />
                      <Input
                        type="color"
                        value={tagColor}
                        onChange={(e) => setTagColor(e.target.value)}
                        className="w-20"
                      />
                      <Button
                        onClick={handleAddTag}
                        disabled={!tagText.trim() || addTagMutation.isPending}
                        className="bg-primary hover:bg-primary/90"
                      >
                        <Plus className="w-4 h-4 mr-1" />
                        {t("add", language)}
                      </Button>
                    </div>

                    {/* Tags List */}
                    <div className="flex flex-wrap gap-2">
                      {tags && tags.length > 0 ? (
                        tags.map((tag: any) => (
                          <motion.div
                            key={tag.id}
                            initial={{ scale: 0.8, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            whileHover={{ scale: 1.05 }}
                          >
                            <Badge
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
                          </motion.div>
                        ))
                      ) : (
                        <p className="text-sm text-muted-foreground text-center py-4 w-full">
                          {t("noTagsYet", language)}
                        </p>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </motion.div>

              {/* Quick Navigation - Drill into related pages */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.6 }}
              >
                <Card className="border-primary/30 bg-primary/5">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <ExternalLink className="w-5 h-5 text-primary" />
                      {t("quickNavigation", language)}
                    </CardTitle>
                    <CardDescription>{t("drillIntoViews", language)}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-3 gap-3">
                      <Button
                        variant="outline"
                        className="h-auto py-4 flex flex-col items-center gap-2 hover:border-blue-500 hover:bg-blue-500/10 transition-colors"
                        onClick={() => setLocation(`/dashboard/map?region=${encodeURIComponent(selectedIncident.region)}`)}
                      >
                        <Map className="w-6 h-6 text-blue-500" />
                        <span className="text-xs">{t("viewOnMap", language)}</span>
                      </Button>
                      <Button
                        variant="outline"
                        className="h-auto py-4 flex flex-col items-center gap-2 hover:border-purple-500 hover:bg-purple-500/10 transition-colors"
                        onClick={() => setLocation(`/dashboard/topology?incident=${encodeURIComponent(selectedIncident.id)}`)}
                      >
                        <Network className="w-6 h-6 text-purple-500" />
                        <span className="text-xs">{t("viewTopology", language)}</span>
                      </Button>
                      <Button
                        variant="outline"
                        className="h-auto py-4 flex flex-col items-center gap-2 hover:border-green-500 hover:bg-green-500/10 transition-colors"
                        onClick={() => setLocation(`/dashboard/pole?incident=${encodeURIComponent(selectedIncident.id)}`)}
                      >
                        <Users className="w-6 h-6 text-green-500" />
                        <span className="text-xs">{t("poleAnalysis", language)}</span>
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>

              {/* Actions */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.7 }}
              >
                <Card>
                  <CardHeader>
                    <CardTitle>{t("actions", language)}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex gap-2">
                      <Button variant="outline" className="hover:border-primary hover:bg-primary/10 transition-colors">
                        {t("updateStatus", language)}
                      </Button>
                      <Button variant="outline" className="hover:border-primary hover:bg-primary/10 transition-colors">
                        {t("reassign", language)}
                      </Button>
                      <Button variant="outline" className="hover:border-primary hover:bg-primary/10 transition-colors">
                        {t("exportReport", language)}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            </motion.div>
          ) : (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="h-full flex items-center justify-center text-muted-foreground"
            >
              <div className="text-center">
                <motion.div
                  animate={{ scale: [1, 1.05, 1] }}
                  transition={{ duration: 2, repeat: Infinity }}
                >
                  <AlertTriangle className="w-16 h-16 mx-auto mb-4 opacity-50" />
                </motion.div>
                <p>{t("selectIncident", language)}</p>
              </div>
            </motion.div>
          )}
        </div>
      </div>
    </div>
  );
}
