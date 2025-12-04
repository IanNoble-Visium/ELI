import { useState, useRef, useCallback, useEffect } from "react";
import { useLocation } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, Network, Search, ZoomIn, ZoomOut, Maximize2, RefreshCw, Database, AlertCircle } from "lucide-react";
import ForceGraph2D from "react-force-graph-2d";
import { motion } from "framer-motion";

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
  x?: number;
  y?: number;
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
  lastUpdated?: string;
}

export default function TopologyGraph() {
  const [, setLocation] = useLocation();
  const [graphData, setGraphData] = useState<{ nodes: GraphNode[]; links: GraphLink[] }>({ nodes: [], links: [] });
  const [stats, setStats] = useState({ cameras: 0, locations: 0, vehicles: 0, persons: 0, events: 0, edges: 0 });
  const [layout, setLayout] = useState("force");
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dbConnected, setDbConnected] = useState(false);
  const graphRef = useRef<any>(null);

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
        setError(data.dbConnected ? null : "Database not configured");
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
      const currentZoom = typeof graphRef.current.zoom === 'function' ? graphRef.current.zoom() : 1;
      graphRef.current.zoom(currentZoom * 1.5, 500);
    }
  };

  const handleZoomOut = () => {
    if (graphRef.current && graphRef.current.zoom) {
      const currentZoom = typeof graphRef.current.zoom === 'function' ? graphRef.current.zoom() : 1;
      graphRef.current.zoom(currentZoom / 1.5, 500);
    }
  };

  const handleZoomToFit = () => {
    if (graphRef.current) {
      graphRef.current.zoomToFit(500, 50);
    }
  };

  // Computed stats from real data
  const displayStats = {
    nodes: graphData.nodes.length,
    edges: graphData.links.length,
    cameras: stats.cameras,
    persons: stats.persons,
    vehicles: stats.vehicles,
    locations: stats.locations,
    events: stats.events,
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
            <div className="flex items-center gap-3">
              <div>
                <h1 className="text-xl font-bold">Topology Graph</h1>
                <p className="text-xs text-muted-foreground">Network visualization and relationships</p>
              </div>
              {/* Database connection indicator */}
              <div className={`flex items-center gap-1.5 px-2 py-1 rounded-full text-xs ${
                dbConnected ? "bg-green-500/10 text-green-500" : "bg-red-500/10 text-red-500"
              }`}>
                <Database className="w-3 h-3" />
                {dbConnected ? "Live Data" : "No DB"}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Select value={layout} onValueChange={setLayout}>
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
        {/* Sidebar */}
        <motion.div
          initial={{ x: -20, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          transition={{ duration: 0.4 }}
          className="w-80 border-r border-border bg-card/50 backdrop-blur p-4 space-y-4 overflow-y-auto"
        >
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search nodes..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>

          {/* Error display */}
          {error && (
            <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm flex items-center gap-2">
              <AlertCircle className="w-4 h-4" />
              {error}
            </div>
          )}

          {/* Stats */}
          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">Graph Statistics</CardTitle>
                <Button variant="ghost" size="sm" onClick={fetchTopologyData} disabled={isLoading}>
                  <RefreshCw className={`w-4 h-4 ${isLoading ? "animate-spin" : ""}`} />
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Total Nodes</span>
                <Badge variant="outline">{displayStats.nodes}</Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Total Edges</span>
                <Badge variant="outline">{displayStats.edges}</Badge>
              </div>
              <div className="h-px bg-border my-2" />
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-green-500" />
                  <span className="text-sm">Cameras</span>
                </div>
                <Badge variant="outline">{displayStats.cameras}</Badge>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-blue-500" />
                  <span className="text-sm">Persons</span>
                </div>
                <Badge variant="outline">{displayStats.persons}</Badge>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-orange-500" />
                  <span className="text-sm">Vehicles</span>
                </div>
                <Badge variant="outline">{displayStats.vehicles}</Badge>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-purple-500" />
                  <span className="text-sm">Locations</span>
                </div>
                <Badge variant="outline">{displayStats.locations}</Badge>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-primary" />
                  <span className="text-sm">Events</span>
                </div>
                <Badge variant="outline">{displayStats.events}</Badge>
              </div>
            </CardContent>
          </Card>

          {/* Selected Node Details */}
          {selectedNode && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
            >
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Node Details</CardTitle>
                  <CardDescription>{selectedNode.name}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Type</span>
                    <Badge style={{ backgroundColor: selectedNode.color }}>
                      {selectedNode.type}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">ID</span>
                    <span className="text-xs font-mono">{selectedNode.id}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Connections</span>
                    <Badge variant="outline">
                      {graphData.links.filter(
                        (l: any) => l.source === selectedNode.id || l.target === selectedNode.id
                      ).length}
                    </Badge>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )}

          {/* Controls */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Controls</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <Button variant="outline" size="sm" className="w-full" onClick={handleZoomIn}>
                <ZoomIn className="w-4 h-4 mr-2" />
                Zoom In
              </Button>
              <Button variant="outline" size="sm" className="w-full" onClick={handleZoomOut}>
                <ZoomOut className="w-4 h-4 mr-2" />
                Zoom Out
              </Button>
              <Button variant="outline" size="sm" className="w-full" onClick={handleZoomToFit}>
                <Maximize2 className="w-4 h-4 mr-2" />
                Fit to Screen
              </Button>
            </CardContent>
          </Card>
        </motion.div>

        {/* Graph Canvas */}
        <div className="flex-1 relative bg-card/30">
          {isLoading ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-background/80 backdrop-blur z-10">
              <div className="relative w-72 h-72 mb-6">
                {/* Network skeleton with animated connections */}
                <Skeleton className="absolute inset-0 rounded-full opacity-20" />
                
                {/* Center node */}
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-8 h-8 bg-primary/60 rounded-full animate-pulse" />
                
                {/* Orbiting nodes */}
                <div className="absolute top-1/4 left-1/4 w-6 h-6 bg-green-500/60 rounded-full animate-pulse" style={{ animationDelay: '0.1s' }} />
                <div className="absolute top-1/4 right-1/4 w-6 h-6 bg-blue-500/60 rounded-full animate-pulse" style={{ animationDelay: '0.2s' }} />
                <div className="absolute bottom-1/4 left-1/4 w-6 h-6 bg-orange-500/60 rounded-full animate-pulse" style={{ animationDelay: '0.3s' }} />
                <div className="absolute bottom-1/4 right-1/4 w-6 h-6 bg-purple-500/60 rounded-full animate-pulse" style={{ animationDelay: '0.4s' }} />
                
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
              <p className="text-xs text-muted-foreground mt-2">Analyzing {graphData.nodes.length} entities and {graphData.links.length} relationships</p>
            </div>
          ) : null}
          <ForceGraph2D
            ref={graphRef}
            graphData={graphData}
            nodeLabel="name"
            nodeColor="color"
            nodeVal="val"
            linkDirectionalParticles={2}
            linkDirectionalParticleSpeed={0.005}
            onNodeClick={handleNodeClick}
            backgroundColor="#1F2937"
            linkColor={() => "#4B5563"}
            nodeCanvasObject={(node: any, ctx, globalScale) => {
              const label = node.name;
              const fontSize = 12 / globalScale;
              ctx.font = `${fontSize}px Sans-Serif`;
              ctx.textAlign = "center";
              ctx.textBaseline = "middle";
              ctx.fillStyle = node.color;
              
              // Draw node circle
              ctx.beginPath();
              ctx.arc(node.x, node.y, node.val, 0, 2 * Math.PI, false);
              ctx.fill();
              
              // Draw label
              if (globalScale > 1) {
                ctx.fillStyle = "#F9FAFB";
                ctx.fillText(label, node.x, node.y + node.val + fontSize);
              }
            }}
          />
        </div>
      </div>
    </div>
  );
}
