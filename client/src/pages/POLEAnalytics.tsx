import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { useLocation, useSearch } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import {
  ArrowLeft, Users, Car, MapPin, Activity, Camera, Clock, AlertTriangle,
  Network, ZoomIn, ZoomOut, Maximize2, Map, ExternalLink, Search, X,
  Package, Calendar, Database, AlertCircle, Globe, Shield, Radio,
  Eye, Target, FileWarning, Fingerprint, User, RefreshCw, Loader2
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { format, subDays } from "date-fns";
import ForceGraph2D from "react-force-graph-2d";

// Import translation helpers
import {
  type Language,
  getStoredLanguage,
  setStoredLanguage,
  t,
  getEntityType,
  getRiskLevel,
  getStatus,
  getRole,
} from "@/lib/translations";

// =============================================================================
// TYPE DEFINITIONS
// =============================================================================

type POLEEntityType = "person" | "object" | "location" | "event";
type RiskLevel = "high" | "medium" | "low";

interface POLEGraphNode {
  id: string;
  name: string;
  type: POLEEntityType;
  color: string;
  val: number;
  role?: string;
  riskLevel?: RiskLevel;
  region?: string;
  description?: string;
  status?: string;
  priority?: string;
  timestamp?: string;
  coordinates?: { lat: number; lng: number };
  plateNumber?: string;
  dni?: string;
  imageUrl?: string;
  attributes?: any;
  camera?: string;
  x?: number;
  y?: number;
  fx?: number | null;
  fy?: number | null;
}

interface POLEGraphLink {
  source: string;
  target: string;
  type: string;
  label: string;
  value: number;
}

interface POLEStats {
  people: number;
  objects: number;
  locations: number;
  events: number;
  highRisk: number;
  totalLinks: number;
  linkedIncidents?: number;
  linkedEvents?: number;
}

interface POLEApiResponse {
  success: boolean;
  dbConnected: boolean;
  entities: any[];
  stats: POLEStats;
  graphData: {
    nodes: POLEGraphNode[];
    links: POLEGraphLink[];
  };
  message?: string;
}

// =============================================================================
// CONSTANTS
// =============================================================================

const NODE_COLORS: Record<POLEEntityType, string> = {
  person: "#3B82F6",    // Blue
  object: "#F59E0B",    // Orange
  location: "#8B5CF6",  // Purple
  event: "#EF4444",     // Red
};

const RELATIONSHIP_TYPES: Record<string, { label: string; color: string; en: string }> = {
  CONOCE_A: { label: "Conoce a", color: "#3B82F6", en: "Knows" },
  POSEE: { label: "Posee", color: "#F59E0B", en: "Owns" },
  OCURRIO_EN: { label: "Ocurrió en", color: "#8B5CF6", en: "Occurred at" },
  USO_EN: { label: "Usó en", color: "#EF4444", en: "Used in" },
  TESTIGO_DE: { label: "Testigo de", color: "#10B981", en: "Witness of" },
  VICTIMA_DE: { label: "Víctima de", color: "#EA580C", en: "Victim of" },
  SOSPECHOSO_DE: { label: "Sospechoso de", color: "#DC2626", en: "Suspect of" },
  ASOCIADO_CON: { label: "Asociado con", color: "#6B7280", en: "Associated with" },
  UBICADO_EN: { label: "Ubicado en", color: "#0891B2", en: "Located at" },
  RELATED_TO: { label: "Relacionado", color: "#6B7280", en: "Related to" },
};

type LayoutType = "force" | "hierarchical" | "radial";

// =============================================================================
// MAIN COMPONENT
// =============================================================================

export default function POLEAnalytics() {
  const [, setLocation] = useLocation();
  const searchString = useSearch();
  
  // State
  const [selectedNode, setSelectedNode] = useState<POLEGraphNode | null>(null);
  const [hoveredNode, setHoveredNode] = useState<POLEGraphNode | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState("graph");
  const [layout, setLayout] = useState<LayoutType>("force");
  const [searchQuery, setSearchQuery] = useState("");
  const [language, setLanguage] = useState<Language>("en");
  const [dbConnected, setDbConnected] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Data state - starts empty, populated from API
  const [graphData, setGraphData] = useState<{ nodes: POLEGraphNode[]; links: POLEGraphLink[] }>({
    nodes: [],
    links: [],
  });
  const [stats, setStats] = useState<POLEStats>({
    people: 0,
    objects: 0,
    locations: 0,
    events: 0,
    highRisk: 0,
    totalLinks: 0,
  });

  // Refs
  const graphRef = useRef<any>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });

  // =============================================================================
  // DATA FETCHING - Real database data
  // =============================================================================

  const fetchPOLEData = useCallback(async (showRefreshIndicator = false) => {
    try {
      if (showRefreshIndicator) {
        setIsRefreshing(true);
      } else {
        setIsLoading(true);
      }
      setError(null);

      const response = await fetch("/api/data/pole-entities", {
        credentials: "include",
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data: POLEApiResponse = await response.json();

      if (data.success) {
        setDbConnected(data.dbConnected);
        setGraphData(data.graphData || { nodes: [], links: [] });
        setStats(data.stats || {
          people: 0,
          objects: 0,
          locations: 0,
          events: 0,
          highRisk: 0,
          totalLinks: 0,
        });
      } else {
        setError(data.message || "Failed to fetch POLE data");
        setGraphData({ nodes: [], links: [] });
      }
    } catch (err: any) {
      console.error("[POLEAnalytics] Fetch error:", err);
      setError(err.message || "Failed to connect to server");
      setDbConnected(false);
      setGraphData({ nodes: [], links: [] });
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  // Initial data fetch
  useEffect(() => {
    fetchPOLEData();
  }, [fetchPOLEData]);

  // Load language preference
  useEffect(() => {
    setLanguage(getStoredLanguage());
  }, []);

  // Toggle language
  const toggleLanguage = () => {
    const newLang = language === "en" ? "es" : "en";
    setLanguage(newLang);
    setStoredLanguage(newLang);
  };

  // Parse URL parameters for deep linking
  useEffect(() => {
    const params = new URLSearchParams(searchString);
    const incidentId = params.get("incident");
    const personId = params.get("personId");
    const objectId = params.get("objectId");

    const entityId = personId || objectId || incidentId;
    if (entityId && graphData.nodes.length > 0) {
      const node = graphData.nodes.find((n) => n.id === entityId || n.id.includes(entityId));
      if (node) {
        setSelectedNode(node);
        setActiveTab("graph");
      }
    }
  }, [searchString, graphData.nodes]);

  // Track container dimensions
  useEffect(() => {
    if (!containerRef.current) return;

    const updateDimensions = () => {
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        setDimensions({
          width: Math.max(100, rect.width),
          height: Math.max(100, rect.height),
        });
      }
    };

    updateDimensions();
    const resizeObserver = new ResizeObserver(updateDimensions);
    resizeObserver.observe(containerRef.current);
    window.addEventListener("resize", updateDimensions);

    return () => {
      resizeObserver.disconnect();
      window.removeEventListener("resize", updateDimensions);
    };
  }, [activeTab]);

  // =============================================================================
  // GRAPH INTERACTIONS
  // =============================================================================

  const getConnectedNodes = useCallback((nodeId: string) => {
    const connected = new Set<string>();
    connected.add(nodeId);
    graphData.links.forEach((link) => {
      const sourceId = typeof link.source === "string" ? link.source : (link.source as any).id;
      const targetId = typeof link.target === "string" ? link.target : (link.target as any).id;
      if (sourceId === nodeId) connected.add(targetId);
      if (targetId === nodeId) connected.add(sourceId);
    });
    return connected;
  }, [graphData.links]);

  const handleNodeClick = useCallback((node: any) => {
    setSelectedNode(node);
    if (graphRef.current?.centerAt) {
      graphRef.current.centerAt(node.x, node.y, 1000);
      if (graphRef.current.zoom) {
        graphRef.current.zoom(2, 1000);
      }
    }
  }, []);

  const handleNodeHover = useCallback((node: any) => {
    setHoveredNode(node || null);
  }, []);

  const handleZoomIn = () => {
    if (graphRef.current?.zoom) {
      const currentZoom = graphRef.current.zoom();
      graphRef.current.zoom(currentZoom * 1.5, 500);
    }
  };

  const handleZoomOut = () => {
    if (graphRef.current?.zoom) {
      const currentZoom = graphRef.current.zoom();
      graphRef.current.zoom(currentZoom / 1.5, 500);
    }
  };

  const handleZoomToFit = () => {
    graphRef.current?.zoomToFit(500, 50);
  };

  // Apply layout
  useEffect(() => {
    if (!graphRef.current || graphData.nodes.length === 0 || layout === "force") return;

    const centerX = dimensions.width / 2;
    const centerY = dimensions.height / 2;
    const radius = Math.min(dimensions.width, dimensions.height) * 0.35;

    graphData.nodes.forEach((node, index) => {
      if (layout === "hierarchical") {
        const typeOrder: Record<POLEEntityType, number> = {
          event: 0,
          person: 1,
          object: 2,
          location: 3,
        };
        const layer = typeOrder[node.type] ?? 2;
        const nodesInLayer = graphData.nodes.filter((n) => n.type === node.type);
        const indexInLayer = nodesInLayer.indexOf(node);
        const layerWidth = dimensions.width * 0.85;
        const spacing = layerWidth / Math.max(nodesInLayer.length, 1);

        node.fx = (dimensions.width * 0.075) + (indexInLayer + 0.5) * spacing;
        node.fy = 80 + layer * (dimensions.height - 160) / 3;
      } else if (layout === "radial") {
        const typeRadius: Record<POLEEntityType, number> = {
          event: 0.2,
          person: 0.5,
          object: 0.75,
          location: 0.95,
        };
        const nodeRadius = (typeRadius[node.type] ?? 0.5) * radius;
        const nodesOfType = graphData.nodes.filter((n) => n.type === node.type);
        const indexOfType = nodesOfType.indexOf(node);
        const angleStep = (2 * Math.PI) / Math.max(nodesOfType.length, 1);
        const angle = indexOfType * angleStep - Math.PI / 2;

        node.fx = centerX + Math.cos(angle) * nodeRadius;
        node.fy = centerY + Math.sin(angle) * nodeRadius;
      }
    });

    graphRef.current?.refresh?.();
  }, [layout, graphData.nodes, dimensions]);

  // Clear fixed positions when switching to force layout
  useEffect(() => {
    if (layout === "force") {
      graphData.nodes.forEach((node) => {
        node.fx = null;
        node.fy = null;
      });
      graphRef.current?.d3ReheatSimulation?.();
    }
  }, [layout, graphData.nodes]);

  // =============================================================================
  // CUSTOM NODE RENDERING - Digital Detective Board Style
  // =============================================================================

  const nodeCanvasObject = useCallback((node: any, ctx: CanvasRenderingContext2D, globalScale: number) => {
    const x = node.x;
    const y = node.y;
    if (!Number.isFinite(x) || !Number.isFinite(y)) return;

    const label = node.name || "";
    const fontSize = 11 / globalScale;
    const nodeRadius = Math.max(3, node.val || 8);
    const nodeColor = node.color || "#888888";

    const connectedNodes = hoveredNode ? getConnectedNodes(hoveredNode.id) : new Set<string>();
    const isConnected = hoveredNode ? connectedNodes.has(node.id) : true;
    const isSelected = selectedNode?.id === node.id;
    const isHovered = hoveredNode?.id === node.id;
    const isHighRisk = node.riskLevel === "high";

    const alpha = hoveredNode && !isConnected ? 0.2 : 1;

    // Outer glow for selected/hovered/high-risk nodes
    if (isSelected || isHovered || isHighRisk) {
      ctx.beginPath();
      ctx.arc(x, y, nodeRadius + 8, 0, 2 * Math.PI, false);
      ctx.fillStyle = isHighRisk ? "rgba(239, 68, 68, 0.3)" : `${nodeColor}40`;
      ctx.fill();

      // Pulsing ring for high-risk or selected
      if (isHighRisk || isSelected) {
        const pulseRadius = nodeRadius + 12 + Math.sin(Date.now() / 200) * 4;
        ctx.beginPath();
        ctx.arc(x, y, pulseRadius, 0, 2 * Math.PI, false);
        ctx.strokeStyle = isHighRisk ? "rgba(239, 68, 68, 0.6)" : `${nodeColor}60`;
        ctx.lineWidth = 2;
        ctx.stroke();
      }
    }

    // Node shadow
    ctx.globalAlpha = alpha * 0.3;
    ctx.beginPath();
    ctx.arc(x + 1, y + 1, nodeRadius, 0, 2 * Math.PI, false);
    ctx.fillStyle = "rgba(0,0,0,0.5)";
    ctx.fill();
    ctx.globalAlpha = alpha;

    // Draw node based on type
    ctx.beginPath();
    if (node.type === "person") {
      ctx.arc(x, y, nodeRadius, 0, 2 * Math.PI, false);
    } else if (node.type === "object") {
      ctx.moveTo(x, y - nodeRadius);
      ctx.lineTo(x + nodeRadius, y);
      ctx.lineTo(x, y + nodeRadius);
      ctx.lineTo(x - nodeRadius, y);
      ctx.closePath();
    } else if (node.type === "location") {
      ctx.rect(x - nodeRadius, y - nodeRadius, nodeRadius * 2, nodeRadius * 2);
    } else if (node.type === "event") {
      ctx.moveTo(x, y - nodeRadius);
      ctx.lineTo(x + nodeRadius, y + nodeRadius * 0.7);
      ctx.lineTo(x - nodeRadius, y + nodeRadius * 0.7);
      ctx.closePath();
    }

    // Fill with gradient
    try {
      const gradient = ctx.createRadialGradient(
        x - nodeRadius / 3,
        y - nodeRadius / 3,
        0,
        x,
        y,
        nodeRadius
      );
      gradient.addColorStop(0, nodeColor);
      gradient.addColorStop(1, `${nodeColor}CC`);
      ctx.fillStyle = gradient;
    } catch {
      ctx.fillStyle = nodeColor;
    }
    ctx.fill();

    // Border
    ctx.strokeStyle = isSelected ? "#ffffff" : isHighRisk ? "#EF4444" : "#ffffff60";
    ctx.lineWidth = isSelected ? 2.5 : isHighRisk ? 2 : 1;
    ctx.stroke();

    // Draw label
    if (globalScale > 0.5 && label) {
      ctx.font = `${fontSize}px Inter, system-ui, sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";

      const textWidth = ctx.measureText(label).width;
      const padding = 4;
      const textY = y + nodeRadius + fontSize + 4;

      ctx.fillStyle = `rgba(15, 23, 42, ${alpha * 0.95})`;
      ctx.fillRect(
        x - textWidth / 2 - padding,
        textY - fontSize / 2 - padding / 2,
        textWidth + padding * 2,
        fontSize + padding
      );

      ctx.fillStyle = `rgba(249, 250, 251, ${alpha})`;
      ctx.fillText(label, x, textY);
    }

    ctx.globalAlpha = 1;
  }, [hoveredNode, selectedNode, getConnectedNodes]);

  // Link rendering
  const linkColor = useCallback((link: any) => {
    if (!hoveredNode) return "#4B556360";

    const sourceId = typeof link.source === "string" ? link.source : link.source?.id;
    const targetId = typeof link.target === "string" ? link.target : link.target?.id;

    if (sourceId === hoveredNode.id || targetId === hoveredNode.id) {
      const relType = link.type as keyof typeof RELATIONSHIP_TYPES;
      return RELATIONSHIP_TYPES[relType]?.color || "#4B5563";
    }

    return "#4B556320";
  }, [hoveredNode]);

  // =============================================================================
  // HELPER FUNCTIONS
  // =============================================================================

  const getRiskColor = (level: string) => {
    const colors: Record<string, string> = {
      high: "bg-red-500",
      Critical: "bg-red-500",
      medium: "bg-yellow-500",
      High: "bg-orange-500",
      Medium: "bg-yellow-500",
      low: "bg-green-500",
      Low: "bg-blue-500",
    };
    return colors[level] || "bg-gray-500";
  };

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      Open: "bg-red-500",
      open: "bg-red-500",
      Investigating: "bg-yellow-500",
      investigating: "bg-yellow-500",
      Resolved: "bg-green-500",
      resolved: "bg-green-500",
      evidence: "bg-purple-500",
      flagged: "bg-red-500",
      tracked: "bg-blue-500",
      recovered: "bg-green-500",
    };
    return colors[status] || "bg-gray-500";
  };

  const getTypeIcon = (type: POLEEntityType) => {
    switch (type) {
      case "person": return <Users className="w-4 h-4" />;
      case "object": return <Package className="w-4 h-4" />;
      case "location": return <MapPin className="w-4 h-4" />;
      case "event": return <Calendar className="w-4 h-4" />;
    }
  };

  // Filtered nodes for search
  const filteredNodes = searchQuery
    ? graphData.nodes.filter((n) =>
      n.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      n.id.toLowerCase().includes(searchQuery.toLowerCase())
    )
    : graphData.nodes;

  // Check if we have any data
  const hasData = graphData.nodes.length > 0;

  // =============================================================================
  // RENDER
  // =============================================================================

  return (
    <div className="min-h-screen bg-background">
      {/* Scanline overlay for detective board effect */}
      <div className="scanline-overlay pointer-events-none fixed inset-0 z-[100]" />

      {/* Header */}
      <header className="border-b border-border bg-card/80 backdrop-blur-xl sticky top-0 z-50">
        <div className="container flex items-center justify-between h-16">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setLocation("/dashboard")}
              className="hover:bg-primary/10"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              {t("back", language)}
            </Button>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold bg-gradient-to-r from-blue-400 via-purple-400 to-red-400 bg-clip-text text-transparent">
                  {t("poleAnalytics", language)}
                </h1>
                {!dbConnected && (
                  <Badge variant="destructive" className="text-xs animate-pulse">
                    <AlertCircle className="w-3 h-3 mr-1" />
                    Offline
                  </Badge>
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                {t("people", language)}, {t("objects", language)}, {t("locations", language)}, {t("events", language)} • {t("crimeNetworkAnalysis", language)}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {/* Refresh Button */}
            <Button
              variant="outline"
              size="sm"
              onClick={() => fetchPOLEData(true)}
              disabled={isRefreshing}
              className="gap-1.5 text-xs"
            >
              {isRefreshing ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <RefreshCw className="w-3.5 h-3.5" />
              )}
              Refresh
            </Button>
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
            <Badge variant="outline" className="text-xs bg-card/50">
              <Network className="w-3 h-3 mr-1" />
              {stats.people + stats.objects + stats.locations + stats.events} {t("entities", language)}
            </Badge>
            {stats.highRisk > 0 && (
              <Badge variant="outline" className="text-xs border-red-500/50 bg-red-500/10 animate-pulse">
                <AlertTriangle className="w-3 h-3 mr-1 text-red-500" />
                {stats.highRisk} {t("highRisk", language)}
              </Badge>
            )}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex h-[calc(100vh-4rem)]">
        {/* Main Area */}
        <div className="flex-1 flex flex-col">
          {/* Stats Bar - Digital Detective Board Style */}
          <div className="border-b border-border bg-gradient-to-r from-slate-900/50 via-slate-800/50 to-slate-900/50 p-4">
            <div className="grid grid-cols-6 gap-4">
              {[
                { label: t("people", language), value: stats.people, color: NODE_COLORS.person, icon: Users },
                { label: t("objects", language), value: stats.objects, color: NODE_COLORS.object, icon: Package },
                { label: t("locations", language), value: stats.locations, color: NODE_COLORS.location, icon: MapPin },
                { label: t("events", language), value: stats.events, color: NODE_COLORS.event, icon: Calendar },
                { label: t("links", language), value: stats.totalLinks, color: "#6B7280", icon: Network },
              ].map((stat, idx) => (
                <motion.div
                  key={stat.label}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.05 }}
                  className="flex items-center gap-3 p-2 rounded-lg bg-white/5 border border-white/10 hover:border-white/20 transition-colors"
                >
                  <div
                    className="w-10 h-10 rounded-lg flex items-center justify-center"
                    style={{ backgroundColor: `${stat.color}20` }}
                  >
                    <stat.icon className="w-5 h-5" style={{ color: stat.color }} />
                  </div>
                  <div>
                    <div className="text-lg font-bold" style={{ color: stat.color }}>{stat.value}</div>
                    <div className="text-xs text-muted-foreground">{stat.label}</div>
                  </div>
                </motion.div>
              ))}
              <div className="flex items-center gap-2 justify-end">
                <Select value={layout} onValueChange={(v) => setLayout(v as LayoutType)}>
                  <SelectTrigger className="w-[150px] h-9 bg-white/5 border-white/10">
                    <SelectValue placeholder="Layout" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="force">Force-Directed</SelectItem>
                    <SelectItem value="hierarchical">Hierarchical</SelectItem>
                    <SelectItem value="radial">Radial</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          {/* Tabs */}
          <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col">
            <div className="border-b border-border px-4 bg-card/30">
              <TabsList className="h-10 bg-transparent">
                <TabsTrigger value="graph" className="gap-2 data-[state=active]:bg-primary/20">
                  <Network className="w-4 h-4" />
                  {t("relationshipGraph", language)}
                </TabsTrigger>
                <TabsTrigger value="timeline" className="gap-2 data-[state=active]:bg-primary/20">
                  <Activity className="w-4 h-4" />
                  {t("timeline", language)}
                </TabsTrigger>
                <TabsTrigger value="list" className="gap-2 data-[state=active]:bg-primary/20">
                  <Users className="w-4 h-4" />
                  {t("entityList", language)}
                </TabsTrigger>
              </TabsList>
            </div>

            {/* Graph Tab */}
            <TabsContent value="graph" className="flex-1 m-0 relative">
              {isLoading ? (
                <LoadingState language={language} />
              ) : !hasData ? (
                <EmptyState 
                  language={language} 
                  dbConnected={dbConnected}
                  error={error}
                  onRefresh={() => fetchPOLEData(true)}
                />
              ) : (
                <div ref={containerRef} className="absolute inset-0 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
                  {/* Grid pattern overlay */}
                  <div className="absolute inset-0 opacity-10" style={{
                    backgroundImage: `linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px),
                                      linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)`,
                    backgroundSize: '50px 50px'
                  }} />
                  
                  <ForceGraph2D
                    ref={graphRef}
                    graphData={graphData}
                    width={dimensions.width}
                    height={dimensions.height}
                    nodeLabel=""
                    nodeColor="color"
                    nodeVal="val"
                    linkDirectionalParticles={2}
                    linkDirectionalParticleSpeed={0.003}
                    linkDirectionalParticleWidth={2}
                    linkColor={linkColor}
                    linkWidth={(link: any) => {
                      if (!hoveredNode) return 1;
                      const sourceId = typeof link.source === "string" ? link.source : link.source?.id;
                      const targetId = typeof link.target === "string" ? link.target : link.target?.id;
                      if (sourceId === hoveredNode.id || targetId === hoveredNode.id) return 3;
                      return 0.5;
                    }}
                    onNodeClick={handleNodeClick}
                    onNodeHover={handleNodeHover}
                    backgroundColor="transparent"
                    cooldownTicks={layout === "force" ? 100 : 0}
                    warmupTicks={layout === "force" ? 100 : 0}
                    onEngineStop={() => {
                      if (layout === "force") {
                        graphRef.current?.zoomToFit(400, 50);
                      }
                    }}
                    nodeCanvasObject={nodeCanvasObject}
                    nodePointerAreaPaint={(node: any, color: string, ctx: CanvasRenderingContext2D) => {
                      const x = node.x;
                      const y = node.y;
                      if (!Number.isFinite(x) || !Number.isFinite(y)) return;
                      ctx.fillStyle = color;
                      ctx.beginPath();
                      ctx.arc(x, y, node.val || 8, 0, 2 * Math.PI, false);
                      ctx.fill();
                    }}
                  />

                  {/* Zoom Controls */}
                  <div className="absolute bottom-4 right-4 flex flex-col gap-2">
                    <Button variant="outline" size="icon" onClick={handleZoomIn} className="bg-card/80 backdrop-blur border-white/20 hover:bg-white/10">
                      <ZoomIn className="w-4 h-4" />
                    </Button>
                    <Button variant="outline" size="icon" onClick={handleZoomOut} className="bg-card/80 backdrop-blur border-white/20 hover:bg-white/10">
                      <ZoomOut className="w-4 h-4" />
                    </Button>
                    <Button variant="outline" size="icon" onClick={handleZoomToFit} className="bg-card/80 backdrop-blur border-white/20 hover:bg-white/10">
                      <Maximize2 className="w-4 h-4" />
                    </Button>
                  </div>

                  {/* Legend */}
                  <motion.div
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.5 }}
                    className="absolute bottom-4 left-4 bg-slate-900/95 backdrop-blur-xl rounded-lg p-4 border border-white/10 shadow-2xl"
                  >
                    <div className="text-xs font-semibold mb-3 text-white/80 uppercase tracking-wider">{t("legend", language)}</div>
                    <div className="space-y-2">
                      {[
                        { type: "person" as const, shape: "circle" },
                        { type: "object" as const, shape: "diamond" },
                        { type: "location" as const, shape: "square" },
                        { type: "event" as const, shape: "triangle" },
                      ].map(({ type, shape }) => (
                        <div key={type} className="flex items-center gap-2 text-xs">
                          <div
                            className={`w-3 h-3 ${shape === "circle" ? "rounded-full" : shape === "diamond" ? "rotate-45" : ""}`}
                            style={{ backgroundColor: NODE_COLORS[type] }}
                          />
                          <span className="text-white/70">{getEntityType(type, language)}</span>
                        </div>
                      ))}
                    </div>
                  </motion.div>
                </div>
              )}
            </TabsContent>

            {/* Timeline Tab */}
            <TabsContent value="timeline" className="flex-1 m-0 p-6 overflow-auto">
              {!hasData ? (
                <EmptyState 
                  language={language} 
                  dbConnected={dbConnected}
                  error={error}
                  onRefresh={() => fetchPOLEData(true)}
                />
              ) : (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.4 }}
                >
                  <Card className="bg-card/50 backdrop-blur border-white/10">
                    <CardHeader>
                      <CardTitle>{t("activityTimeline", language)}</CardTitle>
                      <CardDescription>{t("activityTimelineDesc", language)}</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="h-[400px] flex items-center justify-center text-muted-foreground">
                        <div className="text-center">
                          <Activity className="w-12 h-12 mx-auto mb-4 opacity-50" />
                          <p>Timeline visualization will appear when events are recorded</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              )}
            </TabsContent>

            {/* Entity List Tab */}
            <TabsContent value="list" className="flex-1 m-0 p-6 overflow-auto">
              {!hasData ? (
                <EmptyState 
                  language={language} 
                  dbConnected={dbConnected}
                  error={error}
                  onRefresh={() => fetchPOLEData(true)}
                />
              ) : (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.3 }}
                  className="space-y-4"
                >
                  {/* Search */}
                  <div className="relative max-w-md">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      placeholder={t("searchEntities", language)}
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-10 bg-white/5 border-white/10"
                    />
                  </div>

                  {/* Entity Grid */}
                  <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {filteredNodes.map((node, index) => (
                      <motion.div
                        key={node.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: index * 0.02 }}
                      >
                        <Card
                          className={`cursor-pointer hover:border-primary/50 transition-all bg-card/50 backdrop-blur border-white/10 ${
                            selectedNode?.id === node.id ? "border-primary ring-1 ring-primary/50" : ""
                          }`}
                          onClick={() => {
                            setSelectedNode(node);
                            setActiveTab("graph");
                          }}
                        >
                          <CardContent className="p-4">
                            <div className="flex items-start justify-between mb-2">
                              <div className="flex items-center gap-2">
                                <div
                                  className="w-3 h-3 rounded-full"
                                  style={{ backgroundColor: NODE_COLORS[node.type] }}
                                />
                                <span className="font-medium truncate max-w-[150px]">{node.name}</span>
                              </div>
                              {node.riskLevel && (
                                <Badge className={`${getRiskColor(node.riskLevel)} text-white text-xs`}>
                                  {node.riskLevel}
                                </Badge>
                              )}
                            </div>
                            <div className="text-xs text-muted-foreground space-y-1">
                              <div className="flex items-center gap-1">
                                {getTypeIcon(node.type)}
                                <span className="capitalize">{getEntityType(node.type, language)}</span>
                              </div>
                              {node.description && (
                                <div className="truncate opacity-70">{node.description}</div>
                              )}
                            </div>
                          </CardContent>
                        </Card>
                      </motion.div>
                    ))}
                  </div>
                </motion.div>
              )}
            </TabsContent>
          </Tabs>
        </div>

        {/* Detail Sidebar - Dossier Style */}
        <AnimatePresence>
          {selectedNode && (
            <DossierPanel
              node={selectedNode}
              language={language}
              graphData={graphData}
              onClose={() => setSelectedNode(null)}
              onNodeSelect={setSelectedNode}
              setLocation={setLocation}
            />
          )}
        </AnimatePresence>
      </div>

      {/* CSS for scanline effect */}
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

function LoadingState({ language }: { language: Language }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="absolute inset-0 flex flex-col items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900"
    >
      <div className="relative w-72 h-72 mb-6">
        <Skeleton className="absolute inset-0 rounded-full opacity-20" />
        <motion.div
          animate={{ scale: [1, 1.2, 1] }}
          transition={{ duration: 1.5, repeat: Infinity }}
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-8 h-8 bg-primary/60 rounded-full"
        />
        {[
          { color: "bg-blue-500/60", pos: "top-1/4 left-1/4", delay: 0.1 },
          { color: "bg-orange-500/60", pos: "top-1/4 right-1/4", delay: 0.2 },
          { color: "bg-purple-500/60", pos: "bottom-1/4 left-1/4", delay: 0.3 },
          { color: "bg-red-500/60", pos: "bottom-1/4 right-1/4", delay: 0.4 },
        ].map((dot, i) => (
          <motion.div
            key={i}
            animate={{ scale: [1, 1.1, 1], opacity: [0.6, 1, 0.6] }}
            transition={{ duration: 1.5, repeat: Infinity, delay: dot.delay }}
            className={`absolute ${dot.pos} w-6 h-6 ${dot.color} rounded-full`}
          />
        ))}
      </div>
      <div className="flex items-center gap-2 text-muted-foreground">
        <Network className="w-5 h-5 animate-pulse" />
        <span className="text-sm font-medium">{t("buildingGraph", language)}</span>
      </div>
    </motion.div>
  );
}

function EmptyState({ 
  language, 
  dbConnected, 
  error,
  onRefresh 
}: { 
  language: Language; 
  dbConnected: boolean;
  error: string | null;
  onRefresh: () => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="absolute inset-0 flex flex-col items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-8"
    >
      <div className="max-w-md text-center">
        <div className="w-24 h-24 mx-auto mb-6 rounded-full bg-white/5 flex items-center justify-center border border-white/10">
          {!dbConnected ? (
            <Database className="w-12 h-12 text-red-400" />
          ) : (
            <Fingerprint className="w-12 h-12 text-blue-400 opacity-50" />
          )}
        </div>
        
        <h3 className="text-xl font-semibold mb-2 text-white">
          {!dbConnected 
            ? "Database Not Connected" 
            : "No Intelligence Data"
          }
        </h3>
        
        <p className="text-muted-foreground mb-6">
          {!dbConnected 
            ? "Unable to connect to the database. Please check your configuration."
            : error 
              ? error
              : "The POLE intelligence database is empty. Data will appear automatically when camera events detect persons, vehicles, or other entities of interest."
          }
        </p>

        <div className="flex flex-col gap-3">
          <Button onClick={onRefresh} variant="outline" className="gap-2">
            <RefreshCw className="w-4 h-4" />
            Refresh Data
          </Button>
          
          {dbConnected && (
            <p className="text-xs text-muted-foreground">
              POLE entities are created from PlateMatched, FaceMatched, and other detection events.
            </p>
          )}
        </div>
      </div>
    </motion.div>
  );
}

function DossierPanel({
  node,
  language,
  graphData,
  onClose,
  onNodeSelect,
  setLocation,
}: {
  node: POLEGraphNode;
  language: Language;
  graphData: { nodes: POLEGraphNode[]; links: POLEGraphLink[] };
  onClose: () => void;
  onNodeSelect: (node: POLEGraphNode) => void;
  setLocation: (path: string) => void;
}) {
  const isHighRisk = node.riskLevel === "high";

  return (
    <motion.div
      initial={{ x: 400, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      exit={{ x: 400, opacity: 0 }}
      transition={{ type: "spring", damping: 24, stiffness: 200 }}
      className="w-96 border-l border-white/10 bg-slate-900/95 backdrop-blur-xl h-full shadow-2xl z-40 flex flex-col"
    >
      {/* Dossier Header with "Mugshot" area */}
      <div className="relative h-40 bg-gradient-to-b from-slate-800 to-slate-900 overflow-hidden">
        {/* Grid pattern */}
        <div className="absolute inset-0 opacity-20" style={{
          backgroundImage: `linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px),
                            linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)`,
          backgroundSize: '20px 20px'
        }} />
        
        {/* Entity icon */}
        <div className="absolute -bottom-8 left-6">
          <div 
            className="w-20 h-20 rounded-xl border-4 border-slate-900 overflow-hidden shadow-lg flex items-center justify-center"
            style={{ backgroundColor: `${NODE_COLORS[node.type]}30` }}
          >
            {node.type === "person" && <User className="w-10 h-10" style={{ color: NODE_COLORS[node.type] }} />}
            {node.type === "object" && <Package className="w-10 h-10" style={{ color: NODE_COLORS[node.type] }} />}
            {node.type === "location" && <MapPin className="w-10 h-10" style={{ color: NODE_COLORS[node.type] }} />}
            {node.type === "event" && <Calendar className="w-10 h-10" style={{ color: NODE_COLORS[node.type] }} />}
          </div>
        </div>

        {/* Risk badge */}
        <div className="absolute top-4 right-4">
          <Badge 
            variant={isHighRisk ? "destructive" : "outline"} 
            className={`text-xs uppercase tracking-widest ${isHighRisk ? "animate-pulse" : ""}`}
          >
            {node.riskLevel || "UNKNOWN"} RISK
          </Badge>
        </div>

        {/* Close button */}
        <Button 
          variant="ghost" 
          size="icon" 
          onClick={onClose}
          className="absolute top-4 left-4 hover:bg-white/10"
        >
          <X className="w-4 h-4" />
        </Button>
      </div>

      {/* Content Body */}
      <div className="mt-10 px-6 pb-6 flex-1 overflow-y-auto">
        <h2 className="text-xl font-bold text-white mb-1">{node.name}</h2>
        <p className="text-sm text-slate-400 font-mono mb-6">ID: {node.id}</p>

        <div className="space-y-4">
          {/* Entity Details */}
          <div className="p-4 rounded-lg bg-white/5 border border-white/10">
            <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">
              {language === "en" ? "Entity Information" : "Información de Entidad"}
            </h4>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <span className="text-xs text-slate-400 block">{t("type", language)}</span>
                <span className="text-sm font-medium text-white capitalize">{getEntityType(node.type, language)}</span>
              </div>
              {node.status && (
                <div>
                  <span className="text-xs text-slate-400 block">{t("status", language)}</span>
                  <span className="text-sm font-medium text-white capitalize">{getStatus(node.status, language)}</span>
                </div>
              )}
              {node.region && (
                <div>
                  <span className="text-xs text-slate-400 block">{t("region", language)}</span>
                  <span className="text-sm font-medium text-white">{node.region}</span>
                </div>
              )}
              {node.role && (
                <div>
                  <span className="text-xs text-slate-400 block">{t("role", language)}</span>
                  <span className="text-sm font-medium text-white capitalize">{getRole(node.role, language)}</span>
                </div>
              )}
            </div>
            {node.description && (
              <div className="mt-3 pt-3 border-t border-white/10">
                <span className="text-xs text-slate-400 block mb-1">{t("description", language)}</span>
                <span className="text-sm text-white/80">{node.description}</span>
              </div>
            )}
          </div>

          {/* Connections */}
          <div>
            <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">
              {t("connections", language)}
            </h4>
            <div className="space-y-2">
              {graphData.links
                .filter((link) => {
                  const sourceId = typeof link.source === "string" ? link.source : (link.source as any).id;
                  const targetId = typeof link.target === "string" ? link.target : (link.target as any).id;
                  return sourceId === node.id || targetId === node.id;
                })
                .slice(0, 6)
                .map((link, idx) => {
                  const sourceId = typeof link.source === "string" ? link.source : (link.source as any).id;
                  const targetId = typeof link.target === "string" ? link.target : (link.target as any).id;
                  const connectedId = sourceId === node.id ? targetId : sourceId;
                  const connectedNode = graphData.nodes.find((n) => n.id === connectedId);
                  const relType = link.type as keyof typeof RELATIONSHIP_TYPES;

                  return (
                    <motion.div
                      key={idx}
                      initial={{ opacity: 0, x: 10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: idx * 0.05 }}
                      className="flex items-center gap-3 p-3 rounded hover:bg-white/5 cursor-pointer transition-colors border border-transparent hover:border-white/10"
                      onClick={() => connectedNode && onNodeSelect(connectedNode)}
                    >
                      <div 
                        className="w-2 h-10 rounded-sm"
                        style={{ backgroundColor: connectedNode ? NODE_COLORS[connectedNode.type] : "#6B7280" }}
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-white truncate">
                          {connectedNode?.name || connectedId}
                        </p>
                        <p className="text-xs text-slate-500">
                          {language === "en" 
                            ? RELATIONSHIP_TYPES[relType]?.en || link.label
                            : RELATIONSHIP_TYPES[relType]?.label || link.label
                          }
                        </p>
                      </div>
                    </motion.div>
                  );
                })}
              {graphData.links.filter((link) => {
                const sourceId = typeof link.source === "string" ? link.source : (link.source as any).id;
                const targetId = typeof link.target === "string" ? link.target : (link.target as any).id;
                return sourceId === node.id || targetId === node.id;
              }).length === 0 && (
                <p className="text-sm text-slate-500 text-center py-4">
                  {language === "en" ? "No connections found" : "Sin conexiones"}
                </p>
              )}
            </div>
          </div>

          {/* Actions */}
          <div className="pt-4 space-y-2">
            {node.type === "location" && node.coordinates && (
              <Button 
                className="w-full bg-blue-600 hover:bg-blue-700 text-white" 
                onClick={() => setLocation(`/dashboard/map?lat=${node.coordinates?.lat}&lng=${node.coordinates?.lng}`)}
              >
                <Map className="w-4 h-4 mr-2" />
                {t("viewOnMap", language)}
              </Button>
            )}
            {node.type === "event" && (
              <Button 
                className="w-full bg-red-600 hover:bg-red-700 text-white" 
                onClick={() => setLocation(`/dashboard/incidents?id=${encodeURIComponent(node.id)}`)}
              >
                <AlertTriangle className="w-4 h-4 mr-2" />
                {t("viewIncident", language)}
              </Button>
            )}
            <Button 
              variant="outline"
              className="w-full border-white/20 hover:bg-white/10" 
              onClick={() => setLocation(`/dashboard/topology?entity=${encodeURIComponent(node.id)}`)}
            >
              <Network className="w-4 h-4 mr-2" />
              {t("viewTopology", language)}
            </Button>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
