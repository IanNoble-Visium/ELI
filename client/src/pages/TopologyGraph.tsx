import { useState, useRef, useCallback, useEffect, useMemo } from "react";
import { useLocation } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, Network, Search, ZoomIn, ZoomOut, Maximize2, RefreshCw, Database, AlertCircle, Image as ImageIcon } from "lucide-react";
import ForceGraph2D from "react-force-graph-2d";
import { motion } from "framer-motion";

// Staggered animation variants
const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.08,
      delayChildren: 0.1,
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

const itemVariants = {
  hidden: { opacity: 0, x: -10 },
  visible: {
    opacity: 1,
    x: 0,
    transition: { duration: 0.3 },
  },
};

interface GraphNode {
  id: string;
  name: string;
  type: "camera" | "location" | "vehicle" | "person" | "event";
  color: string;
  val: number;
  latitude?: number;
  longitude?: number;
  region?: string;
  eventCount?: number;
  imageUrl?: string; // Cloudinary image URL for events
  x?: number;
  y?: number;
  fx?: number | null; // Fixed x position for custom layouts
  fy?: number | null; // Fixed y position for custom layouts
}

interface GraphLink {
  source: string | GraphNode;
  target: string | GraphNode;
  value: number;
  type: string;
}

interface TopologyData {
  nodes: GraphNode[];
  links: GraphLink[];
  stats: {
    cameras: number;
    locations: number;
    vehicles: number;
    persons: number;
    events: number;
    edges: number;
  };
  dbConnected: boolean;
  neo4jConnected?: boolean;
  lastUpdated?: string;
}

type LayoutType = "force" | "hierarchical" | "radial" | "grid" | "circular";

// Image cache for preloading and reusing images
const imageCache = new Map<string, HTMLImageElement>();

function preloadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    if (imageCache.has(url)) {
      resolve(imageCache.get(url)!);
      return;
    }
    
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      imageCache.set(url, img);
      resolve(img);
    };
    img.onerror = reject;
    img.src = url;
  });
}

export default function TopologyGraph() {
  const [, setLocation] = useLocation();
  const [graphData, setGraphData] = useState<{ nodes: GraphNode[]; links: GraphLink[] }>({ nodes: [], links: [] });
  const [stats, setStats] = useState({ cameras: 0, locations: 0, vehicles: 0, persons: 0, events: 0, edges: 0 });
  const [layout, setLayout] = useState<LayoutType>("force");
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dbConnected, setDbConnected] = useState(false);
  const [neo4jConnected, setNeo4jConnected] = useState(false);
  const graphRef = useRef<any>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });
  const [loadedImages, setLoadedImages] = useState<Set<string>>(new Set());

  // Track container dimensions for proper graph sizing
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

    // Initial measurement
    updateDimensions();

    // Set up ResizeObserver for responsive sizing
    const resizeObserver = new ResizeObserver(updateDimensions);
    resizeObserver.observe(containerRef.current);

    // Also listen to window resize as fallback
    window.addEventListener("resize", updateDimensions);

    return () => {
      resizeObserver.disconnect();
      window.removeEventListener("resize", updateDimensions);
    };
  }, []);

  // Preload images for event nodes
  useEffect(() => {
    const imageNodes = graphData.nodes.filter((n) => n.imageUrl);
    
    imageNodes.forEach((node) => {
      if (node.imageUrl && !loadedImages.has(node.imageUrl)) {
        preloadImage(node.imageUrl)
          .then(() => {
            setLoadedImages((prev) => new Set([...prev, node.imageUrl!]));
          })
          .catch((err) => {
            console.warn(`[TopologyGraph] Failed to preload image for ${node.id}:`, err);
          });
      }
    });
  }, [graphData.nodes, loadedImages]);

  // Fetch real topology data from API
  const fetchTopologyData = useCallback(async () => {
    try {
      setIsLoading(true);
      const response = await fetch("/api/data/topology", { credentials: "include" });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data: TopologyData = await response.json();

      if (data.success) {
        setGraphData({ nodes: data.nodes, links: data.links });
        setStats(data.stats);
        setDbConnected(data.dbConnected);
        setNeo4jConnected(data.neo4jConnected || false);
        // Neo4j is required for topology graph - show specific message
        setError(data.neo4jConnected ? null : "Neo4j not configured - Topology graph requires Neo4j database");
      } else {
        setError("Failed to fetch topology data");
      }
    } catch (err) {
      console.error("[TopologyGraph] Fetch error:", err);
      setError("Failed to connect to API");
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Initial fetch
  useEffect(() => {
    fetchTopologyData();
  }, [fetchTopologyData]);

  // Apply layout algorithm when layout changes
  useEffect(() => {
    if (!graphRef.current || graphData.nodes.length === 0) return;

    applyLayout(layout, graphData.nodes, dimensions);
    
    // Force re-render of graph
    if (graphRef.current) {
      // Restart simulation for force layout, otherwise just refresh
      if (layout === "force") {
        graphRef.current.d3ReheatSimulation?.();
      } else {
        // For fixed layouts, we need to refresh the graph
        graphRef.current.refresh?.();
      }
    }
  }, [layout, graphData.nodes.length, dimensions]);

  // Apply layout algorithm to nodes
  const applyLayout = useCallback((layoutType: LayoutType, nodes: GraphNode[], dims: { width: number; height: number }) => {
    const centerX = dims.width / 2;
    const centerY = dims.height / 2;
    const radius = Math.min(dims.width, dims.height) * 0.35;

    nodes.forEach((node, index) => {
      switch (layoutType) {
        case "force":
          // Clear fixed positions for force-directed layout
          node.fx = null;
          node.fy = null;
          break;

        case "hierarchical": {
          // Arrange nodes by type in horizontal layers
          const typeOrder: Record<string, number> = {
            location: 0,
            camera: 1,
            event: 2,
            person: 3,
            vehicle: 3,
          };
          const layer = typeOrder[node.type] ?? 2;
          const nodesInLayer = nodes.filter((n) => (typeOrder[n.type] ?? 2) === layer);
          const indexInLayer = nodesInLayer.indexOf(node);
          const layerWidth = dims.width * 0.8;
          const spacing = layerWidth / Math.max(nodesInLayer.length, 1);
          
          node.fx = (dims.width * 0.1) + (indexInLayer + 0.5) * spacing;
          node.fy = 80 + layer * (dims.height - 160) / 3;
          break;
        }

        case "radial": {
          // Arrange nodes in concentric circles by type
          const typeRadius: Record<string, number> = {
            location: 0.2,
            camera: 0.5,
            event: 0.75,
            person: 0.9,
            vehicle: 0.9,
          };
          const nodeRadius = (typeRadius[node.type] ?? 0.5) * radius;
          const nodesOfType = nodes.filter((n) => n.type === node.type);
          const indexOfType = nodesOfType.indexOf(node);
          const angleStep = (2 * Math.PI) / Math.max(nodesOfType.length, 1);
          const angle = indexOfType * angleStep - Math.PI / 2;
          
          node.fx = centerX + Math.cos(angle) * nodeRadius;
          node.fy = centerY + Math.sin(angle) * nodeRadius;
          break;
        }

        case "grid": {
          // Arrange nodes in a grid pattern
          const cols = Math.ceil(Math.sqrt(nodes.length));
          const rows = Math.ceil(nodes.length / cols);
          const cellWidth = (dims.width * 0.8) / cols;
          const cellHeight = (dims.height * 0.8) / rows;
          const col = index % cols;
          const row = Math.floor(index / cols);
          
          node.fx = (dims.width * 0.1) + (col + 0.5) * cellWidth;
          node.fy = (dims.height * 0.1) + (row + 0.5) * cellHeight;
          break;
        }

        case "circular": {
          // Arrange all nodes in a single circle
          const angleStep = (2 * Math.PI) / Math.max(nodes.length, 1);
          const angle = index * angleStep - Math.PI / 2;
          
          node.fx = centerX + Math.cos(angle) * radius;
          node.fy = centerY + Math.sin(angle) * radius;
          break;
        }
      }
    });

    // Update graph data to trigger re-render
    setGraphData((prev) => ({
      ...prev,
      nodes: [...nodes],
    }));
  }, []);

  const handleNodeClick = useCallback((node: any) => {
    setSelectedNode(node);
    if (graphRef.current && graphRef.current.centerAt) {
      graphRef.current.centerAt(node.x, node.y, 1000);
      if (graphRef.current.zoom) {
        graphRef.current.zoom(2, 1000);
      }
    }
  }, []);

  const handleZoomIn = () => {
    if (graphRef.current && graphRef.current.zoom) {
      const currentZoom = typeof graphRef.current.zoom === "function" ? graphRef.current.zoom() : 1;
      graphRef.current.zoom(currentZoom * 1.5, 500);
    }
  };

  const handleZoomOut = () => {
    if (graphRef.current && graphRef.current.zoom) {
      const currentZoom = typeof graphRef.current.zoom === "function" ? graphRef.current.zoom() : 1;
      graphRef.current.zoom(currentZoom / 1.5, 500);
    }
  };

  const handleZoomToFit = () => {
    if (graphRef.current) {
      graphRef.current.zoomToFit(500, 50);
    }
  };

  const handleLayoutChange = useCallback((newLayout: string) => {
    setLayout(newLayout as LayoutType);
  }, []);

  // DAG mode for hierarchical layout (used by ForceGraph2D)
  const dagMode = useMemo(() => {
    if (layout === "hierarchical") return "td"; // top-down
    return null;
  }, [layout]);

  // Computed stats from real data
  const displayStats = {
    nodes: graphData.nodes.length,
    edges: graphData.links.length,
    cameras: stats.cameras,
    persons: stats.persons,
    vehicles: stats.vehicles,
    locations: stats.locations,
    events: stats.events,
    withImages: graphData.nodes.filter((n) => n.imageUrl).length,
  };

  // Custom node rendering with image support
  const nodeCanvasObject = useCallback((node: any, ctx: CanvasRenderingContext2D, globalScale: number) => {
    // Validate node coordinates - skip rendering if invalid
    const x = node.x;
    const y = node.y;
    if (!Number.isFinite(x) || !Number.isFinite(y)) {
      return; // Skip rendering nodes with invalid positions
    }

    const label = node.name || "";
    const fontSize = 12 / globalScale;
    const nodeRadius = Math.max(1, node.val || 5);
    const nodeColor = node.color || "#888888";
    const hasImage = node.imageUrl && imageCache.has(node.imageUrl);

    // Draw outer glow for selected or hovered nodes
    if (selectedNode?.id === node.id) {
      ctx.beginPath();
      ctx.arc(x, y, nodeRadius + 4, 0, 2 * Math.PI, false);
      ctx.fillStyle = `${nodeColor}40`;
      ctx.fill();

      // Pulsing ring effect
      const pulseRadius = nodeRadius + 8 + Math.sin(Date.now() / 200) * 3;
      ctx.beginPath();
      ctx.arc(x, y, pulseRadius, 0, 2 * Math.PI, false);
      ctx.strokeStyle = `${nodeColor}60`;
      ctx.lineWidth = 2;
      ctx.stroke();
    }

    // Draw node shadow
    ctx.beginPath();
    ctx.arc(x + 1, y + 1, nodeRadius, 0, 2 * Math.PI, false);
    ctx.fillStyle = "rgba(0,0,0,0.3)";
    ctx.fill();

    // Draw image if available (for event nodes)
    if (hasImage) {
      const img = imageCache.get(node.imageUrl);
      if (img) {
        // Save context state
        ctx.save();

        // Create circular clipping path
        ctx.beginPath();
        ctx.arc(x, y, nodeRadius, 0, 2 * Math.PI, false);
        ctx.clip();

        // Calculate aspect-ratio-preserving dimensions
        const size = nodeRadius * 2;
        const aspectRatio = img.width / img.height;
        let drawWidth = size;
        let drawHeight = size;
        
        if (aspectRatio > 1) {
          drawHeight = size / aspectRatio;
        } else {
          drawWidth = size * aspectRatio;
        }

        // Center the image
        const offsetX = x - drawWidth / 2;
        const offsetY = y - drawHeight / 2;

        // Draw the image
        try {
          ctx.drawImage(img, offsetX, offsetY, drawWidth, drawHeight);
        } catch (e) {
          // Fallback to colored circle if image drawing fails
          ctx.fillStyle = nodeColor;
          ctx.fill();
        }

        // Restore context state
        ctx.restore();

        // Draw border around image
        ctx.beginPath();
        ctx.arc(x, y, nodeRadius, 0, 2 * Math.PI, false);
        ctx.strokeStyle = nodeColor;
        ctx.lineWidth = 2;
        ctx.stroke();

        // Draw image indicator icon
        if (globalScale > 0.6) {
          const iconSize = 6 / globalScale;
          ctx.fillStyle = nodeColor;
          ctx.beginPath();
          ctx.arc(x + nodeRadius - iconSize, y + nodeRadius - iconSize, iconSize, 0, 2 * Math.PI);
          ctx.fill();
          ctx.fillStyle = "#ffffff";
          ctx.font = `${iconSize}px sans-serif`;
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillText("📷", x + nodeRadius - iconSize, y + nodeRadius - iconSize);
        }
      }
    } else {
      // Draw main node circle with gradient (for nodes without images)
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

        ctx.beginPath();
        ctx.arc(x, y, nodeRadius, 0, 2 * Math.PI, false);
        ctx.fillStyle = gradient;
        ctx.fill();
      } catch (e) {
        // Fallback to solid color if gradient fails
        ctx.beginPath();
        ctx.arc(x, y, nodeRadius, 0, 2 * Math.PI, false);
        ctx.fillStyle = nodeColor;
        ctx.fill();
      }

      // Draw node border
      ctx.strokeStyle = "#ffffff40";
      ctx.lineWidth = 1;
      ctx.stroke();
    }

    // Draw label with background
    if (globalScale > 0.8 && label) {
      ctx.font = `${fontSize}px Inter, Sans-Serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";

      const textWidth = ctx.measureText(label).width;
      const padding = 4;
      const textY = y + nodeRadius + fontSize + 2;

      // Label background
      ctx.fillStyle = "rgba(31, 41, 55, 0.85)";
      ctx.fillRect(
        x - textWidth / 2 - padding,
        textY - fontSize / 2 - padding / 2,
        textWidth + padding * 2,
        fontSize + padding
      );

      // Label text
      ctx.fillStyle = "#F9FAFB";
      ctx.fillText(label, x, textY);
    }
  }, [selectedNode, loadedImages]);

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card/50 backdrop-blur sticky top-0 z-50">
        <div className="container flex items-center justify-between h-16">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="sm" onClick={() => setLocation("/dashboard")}>
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back
            </Button>
            <div className="flex items-center gap-3">
              <div>
                <h1 className="text-xl font-bold">Topology Graph</h1>
                <p className="text-xs text-muted-foreground">
                  Network visualization and relationships
                </p>
              </div>
              {/* Neo4j connection indicator - topology graph requires Neo4j */}
              <div className="flex items-center gap-2">
                <div
                  className={`flex items-center gap-1.5 px-2 py-1 rounded-full text-xs ${
                    neo4jConnected
                      ? "bg-purple-500/10 text-purple-500"
                      : "bg-red-500/10 text-red-500"
                  }`}
                >
                  <Network className="w-3 h-3" />
                  {neo4jConnected ? "Neo4j" : "Neo4j Required"}
                </div>
                {neo4jConnected && dbConnected && (
                  <div className="flex items-center gap-1.5 px-2 py-1 rounded-full text-xs bg-green-500/10 text-green-500">
                    <Database className="w-3 h-3" />
                    Live Data
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Select value={layout} onValueChange={handleLayoutChange}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Select layout" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="force">Force-Directed</SelectItem>
                <SelectItem value="hierarchical">Hierarchical</SelectItem>
                <SelectItem value="radial">Radial</SelectItem>
                <SelectItem value="grid">Grid</SelectItem>
                <SelectItem value="circular">Circular</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex h-[calc(100vh-4rem)]">
        {/* Sidebar with staggered animations */}
        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="visible"
          className="w-80 min-w-80 border-r border-border bg-card/50 backdrop-blur p-4 space-y-4 overflow-y-auto z-30 relative flex-shrink-0"
        >
          {/* Search */}
          <motion.div variants={itemVariants} className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search nodes..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 transition-all duration-200 focus:ring-2 focus:ring-primary/30"
            />
          </motion.div>

          {/* Error display */}
          {error && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm flex items-center gap-2"
            >
              <AlertCircle className="w-4 h-4" />
              {error}
            </motion.div>
          )}

          {/* Stats */}
          <motion.div variants={cardVariants}>
            <Card className="hover:shadow-lg hover:shadow-primary/5 transition-shadow duration-300">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg flex items-center gap-2">
                    Graph Statistics
                    <motion.div
                      className="w-2 h-2 bg-primary rounded-full"
                      animate={{ scale: [1, 1.3, 1], opacity: [1, 0.6, 1] }}
                      transition={{ duration: 2, repeat: Infinity }}
                    />
                  </CardTitle>
                  <Button variant="ghost" size="sm" onClick={fetchTopologyData} disabled={isLoading}>
                    <RefreshCw className={`w-4 h-4 ${isLoading ? "animate-spin" : ""}`} />
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <motion.div
                  className="flex items-center justify-between hover:bg-muted/30 p-1 rounded transition-colors"
                  whileHover={{ x: 4 }}
                >
                  <span className="text-sm text-muted-foreground">Total Nodes</span>
                  <Badge variant="outline">{displayStats.nodes}</Badge>
                </motion.div>
                <motion.div
                  className="flex items-center justify-between hover:bg-muted/30 p-1 rounded transition-colors"
                  whileHover={{ x: 4 }}
                >
                  <span className="text-sm text-muted-foreground">Total Edges</span>
                  <Badge variant="outline">{displayStats.edges}</Badge>
                </motion.div>
                <motion.div
                  className="flex items-center justify-between hover:bg-muted/30 p-1 rounded transition-colors"
                  whileHover={{ x: 4 }}
                >
                  <span className="text-sm text-muted-foreground flex items-center gap-1">
                    <ImageIcon className="w-3 h-3" />
                    With Images
                  </span>
                  <Badge variant="outline">{displayStats.withImages}</Badge>
                </motion.div>
                <div className="h-px bg-border my-2" />
                {[
                  { color: "bg-green-500", label: "Cameras", value: displayStats.cameras },
                  { color: "bg-blue-500", label: "Persons", value: displayStats.persons },
                  { color: "bg-orange-500", label: "Vehicles", value: displayStats.vehicles },
                  { color: "bg-purple-500", label: "Locations", value: displayStats.locations },
                  { color: "bg-primary", label: "Events", value: displayStats.events },
                ].map((stat, index) => (
                  <motion.div
                    key={stat.label}
                    className="flex items-center justify-between hover:bg-muted/30 p-1 rounded transition-colors cursor-pointer"
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.3 + index * 0.05 }}
                    whileHover={{ x: 4 }}
                  >
                    <div className="flex items-center gap-2">
                      <motion.div
                        className={`w-3 h-3 rounded-full ${stat.color}`}
                        animate={{ scale: [1, 1.1, 1] }}
                        transition={{ duration: 2, repeat: Infinity, delay: index * 0.2 }}
                      />
                      <span className="text-sm">{stat.label}</span>
                    </div>
                    <Badge variant="outline">{stat.value}</Badge>
                  </motion.div>
                ))}
              </CardContent>
            </Card>
          </motion.div>

          {/* Selected Node Details */}
          {selectedNode && (
            <motion.div
              initial={{ opacity: 0, y: 20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -10, scale: 0.95 }}
              transition={{ duration: 0.3, ease: [0.25, 0.46, 0.45, 0.94] }}
            >
              <Card className="border-primary/30 shadow-lg shadow-primary/10">
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <motion.div
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: selectedNode.color }}
                      animate={{ scale: [1, 1.2, 1] }}
                      transition={{ duration: 1.5, repeat: Infinity }}
                    />
                    Node Details
                  </CardTitle>
                  <CardDescription>{selectedNode.name}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {/* Show image preview if available */}
                  {selectedNode.imageUrl && (
                    <div className="rounded-lg overflow-hidden border border-border">
                      <img
                        src={selectedNode.imageUrl}
                        alt={selectedNode.name}
                        className="w-full h-32 object-cover"
                        crossOrigin="anonymous"
                      />
                    </div>
                  )}
                  <motion.div
                    className="flex items-center justify-between hover:bg-muted/30 p-1 rounded transition-colors"
                    whileHover={{ x: 4 }}
                  >
                    <span className="text-sm text-muted-foreground">Type</span>
                    <Badge style={{ backgroundColor: selectedNode.color }}>
                      {selectedNode.type}
                    </Badge>
                  </motion.div>
                  <motion.div
                    className="flex items-center justify-between hover:bg-muted/30 p-1 rounded transition-colors"
                    whileHover={{ x: 4 }}
                  >
                    <span className="text-sm text-muted-foreground">ID</span>
                    <span className="text-xs font-mono truncate max-w-[140px]">{selectedNode.id}</span>
                  </motion.div>
                  <motion.div
                    className="flex items-center justify-between hover:bg-muted/30 p-1 rounded transition-colors"
                    whileHover={{ x: 4 }}
                  >
                    <span className="text-sm text-muted-foreground">Connections</span>
                    <Badge variant="outline">
                      {graphData.links.filter(
                        (l: any) =>
                          (typeof l.source === "string" ? l.source : l.source?.id) === selectedNode.id ||
                          (typeof l.target === "string" ? l.target : l.target?.id) === selectedNode.id
                      ).length}
                    </Badge>
                  </motion.div>
                  {selectedNode.imageUrl && (
                    <motion.div
                      className="flex items-center justify-between hover:bg-muted/30 p-1 rounded transition-colors"
                      whileHover={{ x: 4 }}
                    >
                      <span className="text-sm text-muted-foreground">Has Image</span>
                      <Badge variant="outline" className="bg-green-500/10 text-green-500">
                        <ImageIcon className="w-3 h-3 mr-1" />
                        Yes
                      </Badge>
                    </motion.div>
                  )}
                </CardContent>
              </Card>
            </motion.div>
          )}

          {/* Controls */}
          <motion.div variants={cardVariants}>
            <Card className="hover:shadow-lg hover:shadow-primary/5 transition-shadow duration-300">
              <CardHeader>
                <CardTitle className="text-sm">Controls</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                  <Button variant="outline" size="sm" className="w-full" onClick={handleZoomIn}>
                    <ZoomIn className="w-4 h-4 mr-2" />
                    Zoom In
                  </Button>
                </motion.div>
                <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                  <Button variant="outline" size="sm" className="w-full" onClick={handleZoomOut}>
                    <ZoomOut className="w-4 h-4 mr-2" />
                    Zoom Out
                  </Button>
                </motion.div>
                <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                  <Button variant="outline" size="sm" className="w-full" onClick={handleZoomToFit}>
                    <Maximize2 className="w-4 h-4 mr-2" />
                    Fit to Screen
                  </Button>
                </motion.div>
              </CardContent>
            </Card>
          </motion.div>
        </motion.div>

        {/* Graph Canvas Container */}
        <div 
          ref={containerRef}
          className="flex-1 relative bg-card/30 overflow-hidden"
          style={{ isolation: "isolate" }}
        >
          {isLoading ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-background/80 backdrop-blur z-10">
              <div className="relative w-72 h-72 mb-6">
                {/* Network skeleton with animated connections */}
                <Skeleton className="absolute inset-0 rounded-full opacity-20" />

                {/* Center node */}
                <div
                  className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-8 h-8 bg-primary/60 rounded-full animate-pulse"
                />

                {/* Orbiting nodes */}
                <div
                  className="absolute top-1/4 left-1/4 w-6 h-6 bg-green-500/60 rounded-full animate-pulse"
                  style={{ animationDelay: "0.1s" }}
                />
                <div
                  className="absolute top-1/4 right-1/4 w-6 h-6 bg-blue-500/60 rounded-full animate-pulse"
                  style={{ animationDelay: "0.2s" }}
                />
                <div
                  className="absolute bottom-1/4 left-1/4 w-6 h-6 bg-orange-500/60 rounded-full animate-pulse"
                  style={{ animationDelay: "0.3s" }}
                />
                <div
                  className="absolute bottom-1/4 right-1/4 w-6 h-6 bg-purple-500/60 rounded-full animate-pulse"
                  style={{ animationDelay: "0.4s" }}
                />

                {/* Connection lines (simulated) */}
                <div className="absolute top-1/2 left-1/4 w-1/4 h-0.5 bg-muted-foreground/30 origin-right rotate-12" />
                <div className="absolute top-1/2 right-1/4 w-1/4 h-0.5 bg-muted-foreground/30 origin-left -rotate-12" />
                <div className="absolute top-1/4 left-1/2 w-0.5 h-1/4 bg-muted-foreground/30" />
                <div className="absolute bottom-1/4 left-1/2 w-0.5 h-1/4 bg-muted-foreground/30" />
              </div>
              <div className="flex items-center gap-2 text-muted-foreground">
                <Network className="w-5 h-5 animate-pulse" />
                <span className="text-sm font-medium">Building intelligence network...</span>
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                Analyzing {graphData.nodes.length} entities and {graphData.links.length} relationships
              </p>
            </div>
          ) : null}
          
          <ForceGraph2D
            ref={graphRef}
            graphData={graphData}
            width={dimensions.width}
            height={dimensions.height}
            nodeLabel="name"
            nodeColor="color"
            nodeVal="val"
            dagMode={dagMode}
            dagLevelDistance={layout === "hierarchical" ? 80 : undefined}
            linkDirectionalParticles={3}
            linkDirectionalParticleSpeed={0.004}
            linkDirectionalParticleWidth={2}
            linkDirectionalParticleColor={(link: any) => {
              // Vary particle color based on link type
              const colors = ["#D91023", "#10B981", "#3B82F6", "#F59E0B"];
              return colors[Math.floor(Math.random() * colors.length)];
            }}
            onNodeClick={handleNodeClick}
            backgroundColor="#1F2937"
            linkColor={() => "#4B556380"}
            linkWidth={1.5}
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
              ctx.arc(x, y, node.val || 5, 0, 2 * Math.PI, false);
              ctx.fill();
            }}
          />
        </div>
      </div>
    </div>
  );
}
