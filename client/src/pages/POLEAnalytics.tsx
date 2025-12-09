import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { useLocation, useSearch } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { ArrowLeft, Users, Car, MapPin, Activity, Camera, Clock, AlertTriangle, Network, ZoomIn, ZoomOut, Maximize2, Map, ExternalLink, Search, X, Package, Calendar, Database, AlertCircle, Globe } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { format, subDays } from "date-fns";
import ForceGraph2D from "react-force-graph-2d";

// Import structured POLE data
import {
  graphData as poleGraphData,
  poleIncidents,
  polePeople,
  poleObjects,
  poleLocations,
  poleRelationships,
  NODE_COLORS,
  RELATIONSHIP_TYPES,
  PERU_REGIONS,
  type POLEGraphNode,
  type POLEGraphLink,
  type RiskLevel,
  type POLEEntityType,
} from "@/data/poleData";

// Import translation helpers
import {
  type Language,
  getStoredLanguage,
  setStoredLanguage,
  t,
  getDescription,
  getName,
  getType,
  getRelationshipLabel,
  getRole,
  getRiskLevel,
  getStatus,
  getEntityType,
} from "@/lib/translations";

// Local interface for graph node (extends imported type)
interface POLENode extends POLEGraphNode {
  camera?: string;
}

// Interface for real event data from database
interface RealEventData {
  id: string;
  eventId: string;
  topic: string;
  channelId: string;
  channelName?: string;
  startTime?: string;
  params?: any;
  imageUrl?: string;
  linkedPoleEntities?: string[];
}

// Generate timeline data based on actual incidents
const generateTimelineData = () => {
  try {
    const data = [];
    const now = new Date();
    
    // Safely access POLE data with fallbacks
    const incidents = poleIncidents || [];
    const people = polePeople || [];
    const objects = poleObjects || [];
    
    // Group incidents by day
    const incidentsByDay = new Map<string, number>();
    incidents.forEach(inc => {
      if (inc?.createdAt) {
        const day = format(new Date(inc.createdAt), "MMM dd");
        incidentsByDay.set(day, (incidentsByDay.get(day) || 0) + 1);
      }
    });
    
    for (let i = 6; i >= 0; i--) {
      const date = subDays(now, i);
      const dayKey = format(date, "MMM dd");
      const incidentCount = incidentsByDay.get(dayKey) || 0;
      
      data.push({
        date: dayKey,
        people: people.filter(p => p?.role === "suspect" || p?.role === "witness").length,
        objects: objects.filter(o => o?.status === "evidence" || o?.status === "flagged").length,
        events: incidentCount > 0 ? incidentCount : 0,
      });
    }
    return data;
  } catch (error) {
    console.error("[POLEAnalytics] Error generating timeline data:", error);
    // Return empty data on error
    return [];
  }
};

type LayoutType = "force" | "hierarchical" | "radial";

export default function POLEAnalytics() {
  const [, setLocation] = useLocation();
  const searchString = useSearch();
  const [selectedNode, setSelectedNode] = useState<POLENode | null>(null);
  const [hoveredNode, setHoveredNode] = useState<POLENode | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("graph");
  const [layout, setLayout] = useState<LayoutType>("force");
  const [searchQuery, setSearchQuery] = useState("");
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
  const graphRef = useRef<any>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });
  
  // Use structured POLE data from poleData.ts (memoized to prevent re-renders)
  const graphData = useMemo(() => {
    try {
      // Safely access poleGraphData with fallback
      if (poleGraphData && poleGraphData.nodes && poleGraphData.links) {
        return {
          nodes: poleGraphData.nodes as POLENode[],
          links: poleGraphData.links,
        };
      }
      console.warn("[POLEAnalytics] poleGraphData not available, using empty data");
      return { nodes: [], links: [] };
    } catch (error) {
      console.error("[POLEAnalytics] Error loading graph data:", error);
      return { nodes: [], links: [] };
    }
  }, []);
  const timelineData = useMemo(() => generateTimelineData(), []);
  
  // Parse URL parameters for deep linking
  useEffect(() => {
    const params = new URLSearchParams(searchString);
    const incidentId = params.get("incident");
    const personId = params.get("personId");
    const objectId = params.get("objectId");
    
    // If we have a specific entity to highlight, find and select it
    const entityId = personId || objectId || incidentId;
    if (entityId && graphData.nodes.length > 0) {
      const node = graphData.nodes.find((n) => n.id === entityId || n.id.includes(entityId));
      if (node) {
        setSelectedNode(node);
        // Switch to graph view to show the entity
        setActiveTab("graph");
      }
    }
  }, [searchString, graphData.nodes]);
  
  // Simulate loading
  useEffect(() => {
    const timer = setTimeout(() => {
      setIsLoading(false);
    }, 800);
    return () => clearTimeout(timer);
  }, []);
  
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
  
  // Get connected nodes for hover highlighting
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
  
  // Handle node click
  const handleNodeClick = useCallback((node: any) => {
    setSelectedNode(node);
    if (graphRef.current?.centerAt) {
      graphRef.current.centerAt(node.x, node.y, 1000);
      if (graphRef.current.zoom) {
        graphRef.current.zoom(2, 1000);
      }
    }
  }, []);
  
  // Handle node hover
  const handleNodeHover = useCallback((node: any) => {
    setHoveredNode(node || null);
  }, []);
  
  // Zoom controls
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
        // Arrange by type in layers
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
        // Arrange in concentric circles by type
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
  
  // Custom node rendering
  const nodeCanvasObject = useCallback((node: any, ctx: CanvasRenderingContext2D, globalScale: number) => {
    const x = node.x;
    const y = node.y;
    if (!Number.isFinite(x) || !Number.isFinite(y)) return;
    
    const label = node.name || "";
    const fontSize = 11 / globalScale;
    const nodeRadius = Math.max(3, node.val || 8);
    const nodeColor = node.color || "#888888";
    
    // Check if this node is connected to hovered node
    const connectedNodes = hoveredNode ? getConnectedNodes(hoveredNode.id) : new Set<string>();
    const isConnected = hoveredNode ? connectedNodes.has(node.id) : true;
    const isSelected = selectedNode?.id === node.id;
    const isHovered = hoveredNode?.id === node.id;
    
    // Dim non-connected nodes when hovering
    const alpha = hoveredNode && !isConnected ? 0.2 : 1;
    
    // Draw outer glow for selected or hovered nodes
    if (isSelected || isHovered) {
      ctx.beginPath();
      ctx.arc(x, y, nodeRadius + 6, 0, 2 * Math.PI, false);
      ctx.fillStyle = `${nodeColor}40`;
      ctx.fill();
      
      // Pulsing ring
      const pulseRadius = nodeRadius + 10 + Math.sin(Date.now() / 200) * 3;
      ctx.beginPath();
      ctx.arc(x, y, pulseRadius, 0, 2 * Math.PI, false);
      ctx.strokeStyle = `${nodeColor}60`;
      ctx.lineWidth = 2;
      ctx.stroke();
    }
    
    // Draw node shadow
    ctx.globalAlpha = alpha * 0.3;
    ctx.beginPath();
    ctx.arc(x + 1, y + 1, nodeRadius, 0, 2 * Math.PI, false);
    ctx.fillStyle = "rgba(0,0,0,0.5)";
    ctx.fill();
    ctx.globalAlpha = alpha;
    
    // Draw node based on type
    ctx.beginPath();
    
    // Different shapes for different types
    if (node.type === "person") {
      // Circle for people
      ctx.arc(x, y, nodeRadius, 0, 2 * Math.PI, false);
    } else if (node.type === "object") {
      // Diamond for objects
      ctx.moveTo(x, y - nodeRadius);
      ctx.lineTo(x + nodeRadius, y);
      ctx.lineTo(x, y + nodeRadius);
      ctx.lineTo(x - nodeRadius, y);
      ctx.closePath();
    } else if (node.type === "location") {
      // Square for locations
      ctx.rect(x - nodeRadius, y - nodeRadius, nodeRadius * 2, nodeRadius * 2);
    } else if (node.type === "event") {
      // Triangle for events
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
    ctx.strokeStyle = isSelected ? "#ffffff" : "#ffffff60";
    ctx.lineWidth = isSelected ? 2 : 1;
    ctx.stroke();
    
    // Draw label
    if (globalScale > 0.6 && label) {
      ctx.font = `${fontSize}px Inter, system-ui, sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      
      const textWidth = ctx.measureText(label).width;
      const padding = 4;
      const textY = y + nodeRadius + fontSize + 4;
      
      // Label background
      ctx.fillStyle = `rgba(31, 41, 55, ${alpha * 0.9})`;
      ctx.fillRect(
        x - textWidth / 2 - padding,
        textY - fontSize / 2 - padding / 2,
        textWidth + padding * 2,
        fontSize + padding
      );
      
      // Label text
      ctx.fillStyle = `rgba(249, 250, 251, ${alpha})`;
      ctx.fillText(label, x, textY);
    }
    
    ctx.globalAlpha = 1;
  }, [hoveredNode, selectedNode, getConnectedNodes]);
  
  // Link rendering with hover effects
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
  
  // Stats
  const stats = {
    people: graphData.nodes.filter((n) => n.type === "person").length,
    objects: graphData.nodes.filter((n) => n.type === "object").length,
    locations: graphData.nodes.filter((n) => n.type === "location").length,
    events: graphData.nodes.filter((n) => n.type === "event").length,
    highRisk: graphData.nodes.filter((n) => n.riskLevel === "high").length,
    links: graphData.links.length,
  };
  
  // Filtered nodes for search
  const filteredNodes = searchQuery
    ? graphData.nodes.filter((n) =>
        n.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        n.id.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : graphData.nodes;
  
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
      Investigating: "bg-yellow-500",
      Resolved: "bg-green-500",
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
              <h1 className="text-xl font-bold">{t("poleAnalytics", language)}</h1>
              <p className="text-xs text-muted-foreground">
                {t("people", language)}, {t("objects", language)}, {t("locations", language)}, {t("events", language)} • {t("crimeNetworkAnalysis", language)}
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
            <Badge variant="outline" className="text-xs">
              <Network className="w-3 h-3 mr-1" />
              {stats.people + stats.objects + stats.locations + stats.events} {t("entities", language)}
            </Badge>
            <Badge variant="outline" className="text-xs">
              <AlertTriangle className="w-3 h-3 mr-1 text-red-500" />
              {stats.highRisk} {t("highRisk", language)}
            </Badge>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex h-[calc(100vh-4rem)]">
        {/* Main Area */}
        <div className="flex-1 flex flex-col">
          {/* Stats Bar */}
          <div className="border-b border-border bg-card/30 p-4">
            <div className="grid grid-cols-6 gap-4">
              <motion.div 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className="flex items-center gap-2"
              >
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: NODE_COLORS.person }} />
                <span className="text-sm">{t("people", language)}: {stats.people}</span>
              </motion.div>
              <motion.div 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.15 }}
                className="flex items-center gap-2"
              >
                <div className="w-3 h-3 rotate-45" style={{ backgroundColor: NODE_COLORS.object }} />
                <span className="text-sm">{t("objects", language)}: {stats.objects}</span>
              </motion.div>
              <motion.div 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="flex items-center gap-2"
              >
                <div className="w-3 h-3" style={{ backgroundColor: NODE_COLORS.location }} />
                <span className="text-sm">{t("locations", language)}: {stats.locations}</span>
              </motion.div>
              <motion.div 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.25 }}
                className="flex items-center gap-2"
              >
                <div className="w-0 h-0 border-l-[6px] border-r-[6px] border-b-[10px] border-l-transparent border-r-transparent" style={{ borderBottomColor: NODE_COLORS.event }} />
                <span className="text-sm">{t("events", language)}: {stats.events}</span>
              </motion.div>
              <motion.div 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                className="flex items-center gap-2"
              >
                <span className="text-sm text-muted-foreground">{t("links", language)}: {stats.links}</span>
              </motion.div>
              <div className="flex items-center gap-2 justify-end">
                <Select value={layout} onValueChange={(v) => setLayout(v as LayoutType)}>
                  <SelectTrigger className="w-[150px] h-8">
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
            <div className="border-b border-border px-4">
              <TabsList className="h-10">
                <TabsTrigger value="graph" className="gap-2">
                  <Network className="w-4 h-4" />
                  {t("relationshipGraph", language)}
                </TabsTrigger>
                <TabsTrigger value="timeline" className="gap-2">
                  <Activity className="w-4 h-4" />
                  {t("timeline", language)}
                </TabsTrigger>
                <TabsTrigger value="list" className="gap-2">
                  <Users className="w-4 h-4" />
                  {t("entityList", language)}
                </TabsTrigger>
              </TabsList>
            </div>
            
            <TabsContent value="graph" className="flex-1 m-0 relative">
              {isLoading ? (
                <motion.div 
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="absolute inset-0 flex flex-col items-center justify-center bg-background/80 backdrop-blur z-10"
                >
                  <div className="relative w-72 h-72 mb-6">
                    <Skeleton className="absolute inset-0 rounded-full opacity-20" />
                    <motion.div
                      animate={{ scale: [1, 1.2, 1] }}
                      transition={{ duration: 1.5, repeat: Infinity }}
                      className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-8 h-8 bg-primary/60 rounded-full"
                    />
                    <motion.div
                      animate={{ scale: [1, 1.1, 1], opacity: [0.6, 1, 0.6] }}
                      transition={{ duration: 1.5, repeat: Infinity, delay: 0.1 }}
                      className="absolute top-1/4 left-1/4 w-6 h-6 bg-blue-500/60 rounded-full"
                    />
                    <motion.div
                      animate={{ scale: [1, 1.1, 1], opacity: [0.6, 1, 0.6] }}
                      transition={{ duration: 1.5, repeat: Infinity, delay: 0.2 }}
                      className="absolute top-1/4 right-1/4 w-6 h-6 bg-orange-500/60 rounded-full"
                    />
                    <motion.div
                      animate={{ scale: [1, 1.1, 1], opacity: [0.6, 1, 0.6] }}
                      transition={{ duration: 1.5, repeat: Infinity, delay: 0.3 }}
                      className="absolute bottom-1/4 left-1/4 w-6 h-6 bg-purple-500/60 rounded-full"
                    />
                    <motion.div
                      animate={{ scale: [1, 1.1, 1], opacity: [0.6, 1, 0.6] }}
                      transition={{ duration: 1.5, repeat: Infinity, delay: 0.4 }}
                      className="absolute bottom-1/4 right-1/4 w-6 h-6 bg-red-500/60 rounded-full"
                    />
                  </div>
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Network className="w-5 h-5 animate-pulse" />
                    <span className="text-sm font-medium">{t("buildingGraph", language)}</span>
                  </div>
                </motion.div>
              ) : (
                <div ref={containerRef} className="absolute inset-0 bg-card/30">
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
                    backgroundColor="#1F2937"
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
                    <Button variant="outline" size="icon" onClick={handleZoomIn} className="bg-card/80 backdrop-blur">
                      <ZoomIn className="w-4 h-4" />
                    </Button>
                    <Button variant="outline" size="icon" onClick={handleZoomOut} className="bg-card/80 backdrop-blur">
                      <ZoomOut className="w-4 h-4" />
                    </Button>
                    <Button variant="outline" size="icon" onClick={handleZoomToFit} className="bg-card/80 backdrop-blur">
                      <Maximize2 className="w-4 h-4" />
                    </Button>
                  </div>
                  
                  {/* Legend */}
                  <motion.div 
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.5 }}
                    className="absolute bottom-4 left-4 bg-card/90 backdrop-blur rounded-lg p-3 border border-border"
                  >
                    <div className="text-xs font-semibold mb-2">{t("legend", language)}</div>
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 text-xs">
                        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: NODE_COLORS.person }} />
                        <span>{getEntityType("person", language)}</span>
                      </div>
                      <div className="flex items-center gap-2 text-xs">
                        <div className="w-3 h-3 rotate-45" style={{ backgroundColor: NODE_COLORS.object }} />
                        <span>{getEntityType("object", language)}</span>
                      </div>
                      <div className="flex items-center gap-2 text-xs">
                        <div className="w-3 h-3" style={{ backgroundColor: NODE_COLORS.location }} />
                        <span>{getEntityType("location", language)}</span>
                      </div>
                      <div className="flex items-center gap-2 text-xs">
                        <div className="w-0 h-0 border-l-[5px] border-r-[5px] border-b-[8px] border-l-transparent border-r-transparent" style={{ borderBottomColor: NODE_COLORS.event }} />
                        <span>{getEntityType("event", language)}</span>
                      </div>
                    </div>
                  </motion.div>
                </div>
              )}
            </TabsContent>
            
            <TabsContent value="timeline" className="flex-1 m-0 p-6 overflow-auto">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4 }}
              >
                <Card>
                  <CardHeader>
                    <CardTitle>{t("activityTimeline", language)}</CardTitle>
                    <CardDescription>{t("activityTimelineDesc", language)}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={400}>
                      <LineChart data={timelineData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                        <XAxis dataKey="date" stroke="#9CA3AF" />
                        <YAxis stroke="#9CA3AF" />
                        <Tooltip contentStyle={{ backgroundColor: "#374151", border: "1px solid #4B5563" }} labelStyle={{ color: "#F9FAFB" }} />
                        <Legend />
                        <Line type="monotone" dataKey="people" stroke={NODE_COLORS.person} strokeWidth={2} name={t("people", language)} />
                        <Line type="monotone" dataKey="objects" stroke={NODE_COLORS.object} strokeWidth={2} name={t("objects", language)} />
                        <Line type="monotone" dataKey="events" stroke={NODE_COLORS.event} strokeWidth={2} name={t("events", language)} />
                      </LineChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
              </motion.div>
            </TabsContent>
            
            <TabsContent value="list" className="flex-1 m-0 p-6 overflow-auto">
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
                    className="pl-10"
                  />
                </div>
                
                {/* Entity Grid */}
                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {filteredNodes.map((node) => (
                    <Card
                      key={node.id}
                      className={`cursor-pointer hover:border-primary/50 transition-all ${selectedNode?.id === node.id ? "border-primary" : ""}`}
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
                            <span className="font-medium">{node.name}</span>
                          </div>
                          {node.riskLevel && (
                            <Badge className={`${getRiskColor(node.riskLevel)} text-white text-xs`}>
                              {node.riskLevel}
                            </Badge>
                          )}
                          {node.status && (
                            <Badge className={`${getStatusColor(node.status)} text-white text-xs`}>
                              {node.status}
                            </Badge>
                          )}
                        </div>
                        <div className="text-xs text-muted-foreground space-y-1">
                          <div className="flex items-center gap-1">
                            {getTypeIcon(node.type)}
                            <span className="capitalize">{node.type}</span>
                            {node.role && <span>• {node.role}</span>}
                          </div>
                          {node.region && (
                            <div className="flex items-center gap-1">
                              <MapPin className="w-3 h-3" />
                              {node.region}
                            </div>
                          )}
                          {node.description && (
                            <div className="truncate">{node.description}</div>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </div>
        
        {/* Detail Sidebar */}
        <AnimatePresence>
          {selectedNode && (
            <motion.div
              initial={{ x: 320, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: 320, opacity: 0 }}
              transition={{ type: "spring", damping: 25, stiffness: 200 }}
              className="w-80 border-l border-border bg-card/50 backdrop-blur overflow-y-auto"
            >
              <div className="p-4 space-y-4">
                {/* Header */}
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <div
                        className="w-4 h-4 rounded-full"
                        style={{ backgroundColor: NODE_COLORS[selectedNode.type] }}
                      />
                      <span className="text-xs text-muted-foreground uppercase">{getEntityType(selectedNode.type, language)}</span>
                    </div>
                    <h3 className="text-lg font-bold">{selectedNode.name}</h3>
                    <p className="text-sm text-muted-foreground">{selectedNode.id}</p>
                  </div>
                  <Button variant="ghost" size="icon" onClick={() => setSelectedNode(null)}>
                    <X className="w-4 h-4" />
                  </Button>
                </div>
                
                {/* Badges */}
                <div className="flex flex-wrap gap-2">
                  {selectedNode.riskLevel && (
                    <motion.div
                      animate={selectedNode.riskLevel === "high" ? { scale: [1, 1.05, 1] } : {}}
                      transition={{ duration: 1.5, repeat: Infinity }}
                    >
                      <Badge className={`${getRiskColor(selectedNode.riskLevel)} text-white`}>
                        {getRiskLevel(selectedNode.riskLevel, language)} {language === "en" ? "risk" : "riesgo"}
                      </Badge>
                    </motion.div>
                  )}
                  {selectedNode.status && (
                    <Badge className={`${getStatusColor(selectedNode.status)} text-white`}>
                      {getStatus(selectedNode.status, language)}
                    </Badge>
                  )}
                  {selectedNode.priority && (
                    <Badge variant="outline">{selectedNode.priority}</Badge>
                  )}
                  {selectedNode.role && (
                    <Badge variant="outline">{getRole(selectedNode.role, language)}</Badge>
                  )}
                </div>
                
                {/* Details */}
                <Card>
                  <CardContent className="p-3 space-y-2">
                    {selectedNode.region && (
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">{t("region", language)}</span>
                        <span>{selectedNode.region}</span>
                      </div>
                    )}
                    {selectedNode.camera && (
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">{t("camera", language)}</span>
                        <span className="font-mono text-xs">{selectedNode.camera}</span>
                      </div>
                    )}
                    {selectedNode.timestamp && (
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">{t("time", language)}</span>
                        <span className="text-xs">{selectedNode.timestamp}</span>
                      </div>
                    )}
                    {selectedNode.description && (
                      <div className="text-sm">
                        <span className="text-muted-foreground block mb-1">{t("description", language)}</span>
                        <span>{selectedNode.description}</span>
                      </div>
                    )}
                  </CardContent>
                </Card>
                
                {/* Connections */}
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">{t("connections", language)}</CardTitle>
                  </CardHeader>
                  <CardContent className="p-3 space-y-2">
                    {graphData.links
                      .filter((link) => {
                        const sourceId = typeof link.source === "string" ? link.source : (link.source as any).id;
                        const targetId = typeof link.target === "string" ? link.target : (link.target as any).id;
                        return sourceId === selectedNode.id || targetId === selectedNode.id;
                      })
                      .slice(0, 8)
                      .map((link, idx) => {
                        const sourceId = typeof link.source === "string" ? link.source : (link.source as any).id;
                        const targetId = typeof link.target === "string" ? link.target : (link.target as any).id;
                        const connectedId = sourceId === selectedNode.id ? targetId : sourceId;
                        const connectedNode = graphData.nodes.find((n) => n.id === connectedId);
                        const relType = link.type as keyof typeof RELATIONSHIP_TYPES;
                        // Find the full relationship data to get labelEn
                        const fullRelationship = poleRelationships.find(
                          r => (r.source === sourceId && r.target === targetId) || (r.source === targetId && r.target === sourceId)
                        );
                        const displayLabel = language === "en" 
                          ? (fullRelationship?.labelEn || RELATIONSHIP_TYPES[relType]?.en || link.label)
                          : (link.label || RELATIONSHIP_TYPES[relType]?.label || link.type);
                        
                        return (
                          <motion.div
                            key={idx}
                            initial={{ opacity: 0, x: 10 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: idx * 0.05 }}
                            className="flex items-center justify-between text-sm p-2 rounded hover:bg-muted/50 cursor-pointer transition-colors"
                            onClick={() => connectedNode && setSelectedNode(connectedNode)}
                          >
                            <div className="flex items-center gap-2">
                              <div
                                className="w-2 h-2 rounded-full"
                                style={{ backgroundColor: connectedNode ? NODE_COLORS[connectedNode.type] : "#888" }}
                              />
                              <span className="truncate max-w-[120px]">{connectedNode?.name || connectedId}</span>
                            </div>
                            <Badge
                              variant="outline"
                              className="text-xs"
                              style={{ borderColor: RELATIONSHIP_TYPES[relType]?.color }}
                            >
                              {displayLabel}
                            </Badge>
                          </motion.div>
                        );
                      })}
                  </CardContent>
                </Card>
                
                {/* Navigation Actions */}
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">{t("actions", language)}</CardTitle>
                  </CardHeader>
                  <CardContent className="p-3 space-y-2">
                    {selectedNode.type === "location" && selectedNode.coordinates && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="w-full justify-start hover:border-blue-500 hover:bg-blue-500/10 transition-colors"
                        onClick={() => setLocation(`/dashboard/map?lat=${selectedNode.coordinates?.lat}&lng=${selectedNode.coordinates?.lng}`)}
                      >
                        <Map className="w-4 h-4 mr-2 text-blue-500" />
                        {t("viewOnMap", language)}
                        <ExternalLink className="w-3 h-3 ml-auto" />
                      </Button>
                    )}
                    {selectedNode.region && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="w-full justify-start hover:border-purple-500 hover:bg-purple-500/10 transition-colors"
                        onClick={() => setLocation(`/dashboard/map?region=${encodeURIComponent(selectedNode.region!)}`)}
                      >
                        <MapPin className="w-4 h-4 mr-2 text-purple-500" />
                        {t("viewRegion", language)}
                        <ExternalLink className="w-3 h-3 ml-auto" />
                      </Button>
                    )}
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full justify-start hover:border-green-500 hover:bg-green-500/10 transition-colors"
                      onClick={() => setLocation(`/dashboard/topology?entity=${encodeURIComponent(selectedNode.id)}`)}
                    >
                      <Network className="w-4 h-4 mr-2 text-green-500" />
                      {t("viewTopology", language)}
                      <ExternalLink className="w-3 h-3 ml-auto" />
                    </Button>
                    {selectedNode.type === "event" && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="w-full justify-start hover:border-red-500 hover:bg-red-500/10 transition-colors"
                        onClick={() => setLocation(`/dashboard/incidents?id=${encodeURIComponent(selectedNode.id)}`)}
                      >
                        <AlertTriangle className="w-4 h-4 mr-2 text-red-500" />
                        {t("viewIncident", language)}
                        <ExternalLink className="w-3 h-3 ml-auto" />
                      </Button>
                    )}
                  </CardContent>
                </Card>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
