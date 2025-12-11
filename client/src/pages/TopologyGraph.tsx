import { useState, useRef, useCallback, useEffect, useMemo } from "react";
import { useLocation } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, Network, Search, ZoomIn, ZoomOut, Maximize2, Minimize2, RefreshCw, Database, AlertCircle, Image as ImageIcon, Sparkles, Car, Users, Shield, FileText, Loader2 } from "lucide-react";
import ForceGraph2D from "react-force-graph-2d";
import { motion } from "framer-motion";
import { toast } from "sonner";
import NodeContextMenu, { type ContextMenuNode, type ContextMenuPosition } from "@/components/NodeContextMenu";

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
  tags?: string[];
  objects?: string[];
  dominantColors?: string[];
  qualityScore?: number;
  moderationStatus?: string;
  caption?: string;
  // Gemini AI analysis properties
  geminiCaption?: string;
  geminiTags?: string[];
  geminiObjects?: string[];
  geminiPeopleCount?: number;
  geminiVehicles?: string[];
  geminiWeapons?: string[];
  geminiClothingColors?: string[];
  geminiLicensePlates?: string[];
  geminiTextExtracted?: string[];
  geminiQualityScore?: number;
  geminiProcessedAt?: number;
  x?: number;
  y?: number;
  fx?: number | null; // Fixed x position for custom layouts
  fy?: number | null; // Fixed y position for custom layouts
}

interface GeminiStats {
  totalProcessed: number;
  withWeapons: number;
  withLicensePlates: number;
  withMultiplePeople: number;
  avgQualityScore: number;
  topVehicleTypes: Array<{ type: string; count: number }>;
  topClothingColors: Array<{ color: string; count: number }>;
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
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Gemini AI filter state
  const [geminiStats, setGeminiStats] = useState<GeminiStats | null>(null);
  const [geminiLoading, setGeminiLoading] = useState(false);
  const [geminiFilters, setGeminiFilters] = useState({
    hasWeapons: false,
    hasLicensePlates: false,
    hasMultiplePeople: false,
    vehicleType: "",
    clothingColor: "",
  });
  const [geminiSearching, setGeminiSearching] = useState(false);

  // Node type filter state
  const [activeTypeFilter, setActiveTypeFilter] = useState<string | null>(null);
  const [originalGraphData, setOriginalGraphData] = useState<{ nodes: GraphNode[]; links: GraphLink[] } | null>(null);

  // Context menu state
  const [contextMenuNode, setContextMenuNode] = useState<ContextMenuNode | null>(null);
  const [contextMenuPosition, setContextMenuPosition] = useState<ContextMenuPosition | null>(null);
  const [highRiskNodes, setHighRiskNodes] = useState<Set<string>>(new Set());

  // Fullscreen toggle handler
  const toggleFullscreen = useCallback(() => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().then(() => {
        setIsFullscreen(true);
      }).catch((err) => {
        console.error('Failed to enter fullscreen:', err);
      });
    } else {
      document.exitFullscreen().then(() => {
        setIsFullscreen(false);
      }).catch((err) => {
        console.error('Failed to exit fullscreen:', err);
      });
    }
  }, []);

  // Listen for fullscreen changes (e.g., user presses Escape)
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

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

  // Gemini config status
  const [geminiConfig, setGeminiConfig] = useState<{ apiKeyConfigured: boolean; enabled: boolean; message?: string } | null>(null);

  // Fetch Gemini AI stats
  const fetchGeminiStats = useCallback(async () => {
    try {
      setGeminiLoading(true);
      const response = await fetch("/api/data/gemini-search?action=stats", { credentials: "include" });
      const data = await response.json();
      if (data.stats) {
        setGeminiStats(data.stats);
      }
      if (data.config) {
        setGeminiConfig(data.config);
      }
      if (data.message) {
        setGeminiConfig(prev => ({ ...prev, apiKeyConfigured: prev?.apiKeyConfigured ?? false, enabled: prev?.enabled ?? false, message: data.message }));
      }
    } catch (err) {
      console.error("[TopologyGraph] Failed to fetch Gemini stats:", err);
    } finally {
      setGeminiLoading(false);
    }
  }, []);

  // Search events by Gemini criteria
  const searchByGemini = useCallback(async () => {
    try {
      setGeminiSearching(true);
      const params = new URLSearchParams();

      if (geminiFilters.hasWeapons) params.append("hasWeapons", "true");
      if (geminiFilters.hasLicensePlates) params.append("licensePlate", "*");
      if (geminiFilters.hasMultiplePeople) params.append("minPeopleCount", "2");
      if (geminiFilters.vehicleType) params.append("vehicleType", geminiFilters.vehicleType);
      if (geminiFilters.clothingColor) params.append("clothingColor", geminiFilters.clothingColor);
      params.append("limit", "100");

      const response = await fetch(`/api/data/gemini-search?${params.toString()}`, { credentials: "include" });
      const data = await response.json();

      if (data.events && data.events.length > 0) {
        // Save original data if not already saved
        if (!originalGraphData) {
          setOriginalGraphData({ ...graphData });
        }

        const sourceData = originalGraphData || graphData;
        const matchingIds = new Set(data.events.map((e: any) => e.id));
        
        // Filter to only show matching nodes (and their connected cameras/locations)
        const matchingNodes = sourceData.nodes.filter(node => {
          // Always show matching event nodes
          if (matchingIds.has(node.id)) return true;
          // Show cameras and locations that are connected to matching events
          if (node.type === 'camera' || node.type === 'location') {
            // Check if this node is connected to any matching event
            return sourceData.links.some(link => {
              const sourceId = typeof link.source === 'string' ? link.source : link.source.id;
              const targetId = typeof link.target === 'string' ? link.target : link.target.id;
              return (sourceId === node.id && matchingIds.has(targetId)) ||
                     (targetId === node.id && matchingIds.has(sourceId));
            });
          }
          return false;
        });

        const matchingNodeIds = new Set(matchingNodes.map(n => n.id));
        
        // Filter links to only include those between visible nodes
        const matchingLinks = sourceData.links.filter(link => {
          const sourceId = typeof link.source === 'string' ? link.source : link.source.id;
          const targetId = typeof link.target === 'string' ? link.target : link.target.id;
          return matchingNodeIds.has(sourceId) && matchingNodeIds.has(targetId);
        });

        // Update graph with filtered data and highlight matching events
        setGraphData({
          nodes: matchingNodes.map(node => ({
            ...node,
            // Highlight matching event nodes with gold color
            color: matchingIds.has(node.id) ? "#FFD700" : node.color,
            val: matchingIds.has(node.id) ? (node.val || 5) * 1.5 : node.val,
          })),
          links: matchingLinks,
        });

        toast.success(`Found ${data.events.length} matching events`);

        // Zoom to fit the matching nodes
        if (graphRef.current) {
          setTimeout(() => graphRef.current?.zoomToFit(500, 50), 100);
        }
      } else {
        toast.info("No matching events found");
      }
    } catch (err) {
      console.error("[TopologyGraph] Gemini search failed:", err);
      toast.error("Search failed");
    } finally {
      setGeminiSearching(false);
    }
  }, [geminiFilters, graphData, originalGraphData]);

  // Clear Gemini filters and reset graph
  const clearGeminiFilters = useCallback(() => {
    setGeminiFilters({
      hasWeapons: false,
      hasLicensePlates: false,
      hasMultiplePeople: false,
      vehicleType: "",
      clothingColor: "",
    });
    // Refresh topology data to reset node colors/sizes
    fetchTopologyData();
  }, [fetchTopologyData]);

  // Filter graph by node type
  const filterByType = useCallback((type: string | null) => {
    if (type === activeTypeFilter) {
      // Clear filter - restore original data
      setActiveTypeFilter(null);
      if (originalGraphData) {
        setGraphData(originalGraphData);
      }
      return;
    }

    // Save original data if not already saved
    if (!originalGraphData) {
      setOriginalGraphData({ ...graphData });
    }

    const sourceData = originalGraphData || graphData;
    setActiveTypeFilter(type);

    if (!type) {
      setGraphData(sourceData);
      return;
    }

    // Filter nodes by type
    const typeMap: Record<string, string> = {
      "Cameras": "camera",
      "Persons": "person",
      "Vehicles": "vehicle",
      "Locations": "location",
      "Events": "event",
    };
    const nodeType = typeMap[type] || type.toLowerCase();

    const filteredNodes = sourceData.nodes.filter(n => n.type === nodeType);
    const filteredNodeIds = new Set(filteredNodes.map(n => n.id));

    // Keep links where both source and target are in filtered nodes
    const filteredLinks = sourceData.links.filter(l => {
      const sourceId = typeof l.source === 'string' ? l.source : l.source?.id;
      const targetId = typeof l.target === 'string' ? l.target : l.target?.id;
      return filteredNodeIds.has(sourceId) || filteredNodeIds.has(targetId);
    });

    setGraphData({
      nodes: filteredNodes,
      links: filteredLinks,
    });

    // Zoom to fit filtered nodes
    setTimeout(() => {
      if (graphRef.current) {
        graphRef.current.zoomToFit(500, 50);
      }
    }, 100);
  }, [activeTypeFilter, graphData, originalGraphData]);

  // Clear all filters
  const clearAllFilters = useCallback(() => {
    setActiveTypeFilter(null);
    if (originalGraphData) {
      setGraphData(originalGraphData);
      setOriginalGraphData(null);
    }
    clearGeminiFilters();
  }, [originalGraphData, clearGeminiFilters]);

  // Initial fetch
  useEffect(() => {
    fetchTopologyData();
    fetchGeminiStats();
  }, [fetchTopologyData, fetchGeminiStats]);

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
    // Close context menu on regular click
    setContextMenuNode(null);
    setContextMenuPosition(null);
    if (graphRef.current && graphRef.current.centerAt) {
      graphRef.current.centerAt(node.x, node.y, 1000);
      if (graphRef.current.zoom) {
        graphRef.current.zoom(2, 1000);
      }
    }
  }, []);

  // Handle right-click on node for context menu
  const handleNodeRightClick = useCallback((node: any, event: MouseEvent) => {
    event.preventDefault();
    setContextMenuNode({
      id: node.id,
      name: node.name || node.id,
      type: node.type || "event",
      latitude: node.latitude,
      longitude: node.longitude,
      region: node.region,
      imageUrl: node.imageUrl,
    });
    setContextMenuPosition({ x: event.clientX, y: event.clientY });
  }, []);

  // Close context menu
  const handleCloseContextMenu = useCallback(() => {
    setContextMenuNode(null);
    setContextMenuPosition(null);
  }, []);

  // Context menu action handlers
  const handleContextViewDetails = useCallback((node: ContextMenuNode) => {
    // Find the full node data and select it
    const fullNode = graphData.nodes.find(n => n.id === node.id);
    if (fullNode) {
      setSelectedNode(fullNode);
      if (graphRef.current && graphRef.current.centerAt) {
        graphRef.current.centerAt(fullNode.x, fullNode.y, 1000);
        graphRef.current.zoom?.(2, 1000);
      }
    }
  }, [graphData.nodes]);

  const handleContextCreateIncident = useCallback((node: ContextMenuNode) => {
    const params = new URLSearchParams({
      from: "topology",
      nodeId: node.id,
      nodeType: node.type,
      nodeName: node.name,
      ...(node.region && { region: node.region }),
      ...(node.latitude && node.longitude && { location: `${node.latitude},${node.longitude}` }),
    });
    setLocation(`/incidents?${params.toString()}`);
    toast.success("Creating incident...", {
      description: `Source: ${node.name} (${node.type})`,
    });
  }, [setLocation]);

  const handleContextAddToPole = useCallback((node: ContextMenuNode) => {
    // Map node type to POLE entity type
    const poleTypeMap: Record<string, string> = {
      person: "person",
      vehicle: "object",
      camera: "location",
      location: "location",
      event: "event",
    };
    const entityType = poleTypeMap[node.type] || "event";

    const params = new URLSearchParams({
      from: "topology",
      entityId: node.id,
      entityType: entityType,
      entityName: node.name,
    });
    setLocation(`/pole?${params.toString()}`);
    toast.success("Adding to POLE...", {
      description: `Entity: ${node.name} as ${entityType}`,
    });
  }, [setLocation]);

  const handleContextViewEvents = useCallback((node: ContextMenuNode) => {
    if (node.type === "camera") {
      setLocation(`/webhooks?channelId=${node.id}`);
    } else {
      setLocation("/webhooks");
    }
    toast.info("Viewing related events...");
  }, [setLocation]);

  const handleContextMarkHighRisk = useCallback((node: ContextMenuNode) => {
    setHighRiskNodes(prev => {
      const newSet = new Set(prev);
      if (newSet.has(node.id)) {
        newSet.delete(node.id);
        toast.info(`Removed high-risk flag from ${node.name}`);
      } else {
        newSet.add(node.id);
        toast.warning(`Marked ${node.name} as HIGH RISK`, {
          description: "This entity is now flagged for priority attention.",
        });
      }
      return newSet;
    });
    // Force graph refresh to show the visual change
    setGraphData(prev => ({ ...prev, nodes: [...prev.nodes] }));
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

  // Memoized callbacks for ForceGraph2D to prevent unnecessary re-renders
  const linkColor = useCallback(() => "#4B556380", []);

  const linkDirectionalParticleColor = useCallback(() => {
    const colors = ["#D91023", "#10B981", "#3B82F6", "#F59E0B"];
    return colors[Math.floor(Math.random() * colors.length)];
  }, []);

  const onEngineStop = useCallback(() => {
    if (layout === "force") {
      graphRef.current?.zoomToFit(400, 50);
    }
  }, [layout]);

  const nodePointerAreaPaint = useCallback((node: any, color: string, ctx: CanvasRenderingContext2D) => {
    const x = Number.isFinite(node.x) ? node.x : 0;
    const y = Number.isFinite(node.y) ? node.y : 0;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(x, y, node.val || 5, 0, 2 * Math.PI, false);
    ctx.fill();
  }, []);

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
    const isHighRisk = highRiskNodes.has(node.id);
    // Override color to red if marked as high risk
    const nodeColor = isHighRisk ? "#EF4444" : (node.color || "#888888");
    const hasImage = node.imageUrl && imageCache.has(node.imageUrl);

    // Draw high-risk pulsing animation
    if (isHighRisk) {
      // Outer danger glow
      const dangerPulse = nodeRadius + 6 + Math.sin(Date.now() / 150) * 4;
      ctx.beginPath();
      ctx.arc(x, y, dangerPulse, 0, 2 * Math.PI, false);
      ctx.strokeStyle = "rgba(239, 68, 68, 0.6)";
      ctx.lineWidth = 3;
      ctx.stroke();

      // Inner danger glow
      ctx.beginPath();
      ctx.arc(x, y, nodeRadius + 3, 0, 2 * Math.PI, false);
      ctx.fillStyle = "rgba(239, 68, 68, 0.3)";
      ctx.fill();
    }

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
  }, [selectedNode, loadedImages, highRiskNodes]);

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
                  className={`flex items-center gap-1.5 px-2 py-1 rounded-full text-xs ${neo4jConnected
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

            <Button
              variant="outline"
              size="sm"
              onClick={toggleFullscreen}
              title={isFullscreen ? "Exit Fullscreen" : "Enter Fullscreen"}
            >
              {isFullscreen ? (
                <Minimize2 className="w-4 h-4" />
              ) : (
                <Maximize2 className="w-4 h-4" />
              )}
            </Button>
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
                {/* Active Filter Indicator */}
                {activeTypeFilter && (
                  <div className="flex items-center justify-between p-2 bg-primary/10 rounded-lg border border-primary/30">
                    <span className="text-xs text-primary font-medium">Filtering: {activeTypeFilter}</span>
                    <Button variant="ghost" size="sm" className="h-5 px-2 text-xs" onClick={() => filterByType(null)}>
                      Clear
                    </Button>
                  </div>
                )}
                <div className="h-px bg-border my-2" />
                {[
                  { color: "bg-green-500", label: "Cameras", value: displayStats.cameras, type: "camera" },
                  { color: "bg-blue-500", label: "Persons", value: displayStats.persons, type: "person" },
                  { color: "bg-orange-500", label: "Vehicles", value: displayStats.vehicles, type: "vehicle" },
                  { color: "bg-purple-500", label: "Locations", value: displayStats.locations, type: "location" },
                  { color: "bg-primary", label: "Events", value: displayStats.events, type: "event" },
                ].map((stat, index) => (
                  <motion.div
                    key={stat.label}
                    className={`flex items-center justify-between p-1.5 rounded transition-colors cursor-pointer ${activeTypeFilter === stat.label
                        ? "bg-primary/20 border border-primary/40"
                        : "hover:bg-muted/30"
                      }`}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.3 + index * 0.05 }}
                    whileHover={{ x: 4 }}
                    onClick={() => filterByType(stat.label)}
                  >
                    <div className="flex items-center gap-2">
                      <motion.div
                        className={`w-3 h-3 rounded-full ${stat.color}`}
                        animate={{ scale: activeTypeFilter === stat.label ? [1, 1.3, 1] : [1, 1.1, 1] }}
                        transition={{ duration: activeTypeFilter === stat.label ? 1 : 2, repeat: Infinity, delay: index * 0.2 }}
                      />
                      <span className={`text-sm ${activeTypeFilter === stat.label ? "font-medium" : ""}`}>{stat.label}</span>
                    </div>
                    <Badge variant={activeTypeFilter === stat.label ? "default" : "outline"}>{stat.value}</Badge>
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
                  {/* Analysis Properties Viewer */}
                  {(selectedNode.tags?.length > 0 || selectedNode.objects?.length > 0 || selectedNode.dominantColors?.length > 0) && (
                    <div className="pt-2 border-t border-border mt-2 space-y-3">
                      <h4 className="text-xs font-semibold uppercase text-muted-foreground tracking-wider mb-2">Analysis Data</h4>

                      {/* Dominant Colors */}
                      {selectedNode.dominantColors && selectedNode.dominantColors.length > 0 && (
                        <div className="space-y-1">
                          <span className="text-xs text-muted-foreground">Dominant Colors</span>
                          <div className="flex flex-wrap gap-1">
                            {selectedNode.dominantColors.map((color, i) => (
                              <div
                                key={i}
                                className="w-5 h-5 rounded-full border border-border shadow-sm"
                                style={{ backgroundColor: color }}
                                title={color}
                              />
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Objects */}
                      {selectedNode.objects && selectedNode.objects.length > 0 && (
                        <div className="space-y-1">
                          <span className="text-xs text-muted-foreground">Detected Objects</span>
                          <div className="flex flex-wrap gap-1">
                            {selectedNode.objects.slice(0, 10).map((obj, i) => (
                              <Badge key={i} variant="secondary" className="text-[10px] h-5 px-1.5 bg-blue-500/10 text-blue-400 border-blue-500/20">
                                {obj}
                              </Badge>
                            ))}
                            {selectedNode.objects.length > 10 && (
                              <Badge variant="outline" className="text-[10px] h-5 px-1.5">
                                +{selectedNode.objects.length - 10}
                              </Badge>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Tags */}
                      {selectedNode.tags && selectedNode.tags.length > 0 && (
                        <div className="space-y-1">
                          <span className="text-xs text-muted-foreground">Tags</span>
                          <div className="flex flex-wrap gap-1">
                            {selectedNode.tags.slice(0, 10).map((tag, i) => (
                              <Badge key={i} variant="outline" className="text-[10px] h-5 px-1.5">
                                {tag}
                              </Badge>
                            ))}
                            {selectedNode.tags.length > 10 && (
                              <Badge variant="outline" className="text-[10px] h-5 px-1.5">
                                +{selectedNode.tags.length - 10}
                              </Badge>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Quality Score */}
                      {selectedNode.qualityScore !== undefined && selectedNode.qualityScore !== null && (
                        <div className="flex items-center justify-between hover:bg-muted/30 p-1 rounded transition-colors">
                          <span className="text-xs text-muted-foreground">Quality Score</span>
                          <div className="flex items-center gap-2">
                            <div className="w-16 h-1.5 bg-secondary rounded-full overflow-hidden">
                              <div
                                className={`h-full ${selectedNode.qualityScore > 0.7 ? 'bg-green-500' : selectedNode.qualityScore > 0.4 ? 'bg-yellow-500' : 'bg-red-500'}`}
                                style={{ width: `${selectedNode.qualityScore * 100}%` }}
                              />
                            </div>
                            <span className="text-xs font-mono">{(selectedNode.qualityScore * 100).toFixed(0)}%</span>
                          </div>
                        </div>
                      )}
                    </div>
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

          {/* Gemini AI Filters */}
          <motion.div variants={cardVariants}>
            <Card className="hover:shadow-lg hover:shadow-yellow-500/5 transition-shadow duration-300 border-yellow-500/20">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-yellow-500" />
                    Gemini AI Filters
                  </CardTitle>
                  <Button variant="ghost" size="sm" onClick={fetchGeminiStats} disabled={geminiLoading}>
                    <RefreshCw className={`w-3 h-3 ${geminiLoading ? "animate-spin" : ""}`} />
                  </Button>
                </div>
                <CardDescription className="text-xs">
                  Filter events by AI-detected properties
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {/* Stats Summary */}
                {geminiStats && (
                  <div className="grid grid-cols-2 gap-2 text-xs mb-3">
                    <div className="p-2 bg-yellow-500/10 rounded-lg text-center">
                      <div className="font-bold text-yellow-400">{geminiStats.totalProcessed}</div>
                      <div className="text-muted-foreground">Analyzed</div>
                    </div>
                    <div className="p-2 bg-red-500/10 rounded-lg text-center">
                      <div className="font-bold text-red-400">{geminiStats.withWeapons}</div>
                      <div className="text-muted-foreground">With Weapons</div>
                    </div>
                    <div className="p-2 bg-blue-500/10 rounded-lg text-center">
                      <div className="font-bold text-blue-400">{geminiStats.withLicensePlates}</div>
                      <div className="text-muted-foreground">License Plates</div>
                    </div>
                    <div className="p-2 bg-green-500/10 rounded-lg text-center">
                      <div className="font-bold text-green-400">{geminiStats.withMultiplePeople}</div>
                      <div className="text-muted-foreground">Multi-Person</div>
                    </div>
                  </div>
                )}

                {/* Quick Filters */}
                <div className="space-y-2">
                  <span className="text-xs font-medium text-muted-foreground">Quick Filters</span>
                  <div className="flex flex-wrap gap-1">
                    <Badge
                      variant={geminiFilters.hasWeapons ? "default" : "outline"}
                      className={`cursor-pointer text-[10px] ${geminiFilters.hasWeapons ? "bg-red-500 hover:bg-red-600" : "hover:bg-red-500/20"}`}
                      onClick={() => setGeminiFilters(prev => ({ ...prev, hasWeapons: !prev.hasWeapons }))}
                    >
                      <Shield className="w-3 h-3 mr-1" />
                      Weapons
                    </Badge>
                    <Badge
                      variant={geminiFilters.hasLicensePlates ? "default" : "outline"}
                      className={`cursor-pointer text-[10px] ${geminiFilters.hasLicensePlates ? "bg-blue-500 hover:bg-blue-600" : "hover:bg-blue-500/20"}`}
                      onClick={() => setGeminiFilters(prev => ({ ...prev, hasLicensePlates: !prev.hasLicensePlates }))}
                    >
                      <Car className="w-3 h-3 mr-1" />
                      License Plates
                    </Badge>
                    <Badge
                      variant={geminiFilters.hasMultiplePeople ? "default" : "outline"}
                      className={`cursor-pointer text-[10px] ${geminiFilters.hasMultiplePeople ? "bg-green-500 hover:bg-green-600" : "hover:bg-green-500/20"}`}
                      onClick={() => setGeminiFilters(prev => ({ ...prev, hasMultiplePeople: !prev.hasMultiplePeople }))}
                    >
                      <Users className="w-3 h-3 mr-1" />
                      2+ People
                    </Badge>
                  </div>
                </div>

                {/* Vehicle Type Filter */}
                {geminiStats?.topVehicleTypes && geminiStats.topVehicleTypes.length > 0 && (
                  <div className="space-y-1">
                    <span className="text-xs font-medium text-muted-foreground">Vehicle Types</span>
                    <div className="flex flex-wrap gap-1">
                      {geminiStats.topVehicleTypes.slice(0, 5).map((v, i) => (
                        <Badge
                          key={i}
                          variant={geminiFilters.vehicleType === v.type ? "default" : "outline"}
                          className={`cursor-pointer text-[10px] ${geminiFilters.vehicleType === v.type ? "bg-orange-500" : "hover:bg-orange-500/20"}`}
                          onClick={() => setGeminiFilters(prev => ({
                            ...prev,
                            vehicleType: prev.vehicleType === v.type ? "" : v.type
                          }))}
                        >
                          {v.type} ({v.count})
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}

                {/* Clothing Colors Filter */}
                {geminiStats?.topClothingColors && geminiStats.topClothingColors.length > 0 && (
                  <div className="space-y-1">
                    <span className="text-xs font-medium text-muted-foreground">Clothing Colors</span>
                    <div className="flex flex-wrap gap-1">
                      {geminiStats.topClothingColors.slice(0, 6).map((c, i) => (
                        <Badge
                          key={i}
                          variant={geminiFilters.clothingColor === c.color ? "default" : "outline"}
                          className={`cursor-pointer text-[10px] capitalize ${geminiFilters.clothingColor === c.color ? "bg-purple-500" : "hover:bg-purple-500/20"}`}
                          onClick={() => setGeminiFilters(prev => ({
                            ...prev,
                            clothingColor: prev.clothingColor === c.color ? "" : c.color
                          }))}
                        >
                          {c.color} ({c.count})
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}

                {/* Action Buttons */}
                <div className="flex gap-2 pt-2">
                  <Button
                    size="sm"
                    className="flex-1 bg-yellow-500 hover:bg-yellow-600 text-black"
                    onClick={searchByGemini}
                    disabled={geminiSearching || (!geminiFilters.hasWeapons && !geminiFilters.hasLicensePlates && !geminiFilters.hasMultiplePeople && !geminiFilters.vehicleType && !geminiFilters.clothingColor)}
                  >
                    {geminiSearching ? (
                      <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                    ) : (
                      <Search className="w-3 h-3 mr-1" />
                    )}
                    Search
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={clearGeminiFilters}
                  >
                    Clear
                  </Button>
                </div>

                {/* Configuration/Status message */}
                {geminiConfig?.message && (
                  <div className="p-2 bg-yellow-500/10 border border-yellow-500/20 rounded-lg text-xs text-yellow-400">
                    <AlertCircle className="w-3 h-3 inline mr-1" />
                    {geminiConfig.message}
                  </div>
                )}

                {/* No data message */}
                {!geminiStats?.totalProcessed && !geminiLoading && !geminiConfig?.message && (
                  <div className="text-center py-2 text-xs text-muted-foreground">
                    <Sparkles className="w-4 h-4 mx-auto mb-1 opacity-50" />
                    No Gemini analysis data yet.
                    <br />
                    Run the CRON job in Settings.
                  </div>
                )}
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
            linkDirectionalParticleColor={linkDirectionalParticleColor}
            onNodeClick={handleNodeClick}
            onNodeRightClick={handleNodeRightClick}
            backgroundColor="#1F2937"
            linkColor={linkColor}
            linkWidth={1.5}
            cooldownTicks={layout === "force" ? 100 : 0}
            warmupTicks={layout === "force" ? 100 : 0}
            onEngineStop={onEngineStop}
            nodeCanvasObject={nodeCanvasObject}
            nodePointerAreaPaint={nodePointerAreaPaint}
          />

          {/* Context Menu */}
          <NodeContextMenu
            node={contextMenuNode}
            position={contextMenuPosition}
            onClose={handleCloseContextMenu}
            onViewDetails={handleContextViewDetails}
            onCreateIncident={handleContextCreateIncident}
            onAddToPole={handleContextAddToPole}
            onViewRelatedEvents={handleContextViewEvents}
            onMarkAsHighRisk={handleContextMarkHighRisk}
          />
        </div>
      </div>
    </div>
  );
}
