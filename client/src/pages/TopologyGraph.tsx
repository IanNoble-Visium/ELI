import { useState, useRef, useCallback, useEffect } from "react";
import { useLocation } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, Network, Search, ZoomIn, ZoomOut, Maximize2 } from "lucide-react";
import ForceGraph2D from "react-force-graph-2d";
import { motion } from "framer-motion";

// Mock graph data (will be replaced with Neo4j data)
const generateMockGraphData = () => {
  const nodes: any[] = [];
  const links: any[] = [];

  // Create nodes for different entity types
  const entityTypes = [
    { type: "camera", count: 30, color: "#10B981" },
    { type: "person", count: 15, color: "#3B82F6" },
    { type: "vehicle", count: 12, color: "#F59E0B" },
    { type: "location", count: 10, color: "#8B5CF6" },
    { type: "event", count: 20, color: "#D91023" },
  ];

  let nodeId = 0;
  entityTypes.forEach((entityType) => {
    for (let i = 0; i < entityType.count; i++) {
      nodes.push({
        id: `${entityType.type}-${nodeId}`,
        name: `${entityType.type.charAt(0).toUpperCase() + entityType.type.slice(1)} ${i + 1}`,
        type: entityType.type,
        color: entityType.color,
        val: Math.random() * 10 + 5,
      });
      nodeId++;
    }
  });

  // Create random links
  for (let i = 0; i < 80; i++) {
    const source = nodes[Math.floor(Math.random() * nodes.length)];
    const target = nodes[Math.floor(Math.random() * nodes.length)];
    if (source.id !== target.id) {
      links.push({
        source: source.id,
        target: target.id,
        value: Math.random() * 5 + 1,
        type: ["observed", "detected", "associated", "located_at"][Math.floor(Math.random() * 4)],
      });
    }
  }

  return { nodes, links };
};

export default function TopologyGraph() {
  const [, setLocation] = useLocation();
  const [graphData] = useState(generateMockGraphData());
  const [layout, setLayout] = useState("force");
  const [selectedNode, setSelectedNode] = useState<any>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const graphRef = useRef<any>(null);

  // Simulate loading for graph initialization
  useEffect(() => {
    const timer = setTimeout(() => {
      setIsLoading(false);
    }, 1000);
    return () => clearTimeout(timer);
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

  const stats = {
    nodes: graphData.nodes.length,
    edges: graphData.links.length,
    cameras: graphData.nodes.filter(n => n.type === "camera").length,
    persons: graphData.nodes.filter(n => n.type === "person").length,
    vehicles: graphData.nodes.filter(n => n.type === "vehicle").length,
    locations: graphData.nodes.filter(n => n.type === "location").length,
    events: graphData.nodes.filter(n => n.type === "event").length,
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
              <h1 className="text-xl font-bold">Topology Graph</h1>
              <p className="text-xs text-muted-foreground">Network visualization and relationships</p>
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

          {/* Stats */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Graph Statistics</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Total Nodes</span>
                <Badge variant="outline">{stats.nodes}</Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Total Edges</span>
                <Badge variant="outline">{stats.edges}</Badge>
              </div>
              <div className="h-px bg-border my-2" />
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-green-500" />
                  <span className="text-sm">Cameras</span>
                </div>
                <Badge variant="outline">{stats.cameras}</Badge>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-blue-500" />
                  <span className="text-sm">Persons</span>
                </div>
                <Badge variant="outline">{stats.persons}</Badge>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-orange-500" />
                  <span className="text-sm">Vehicles</span>
                </div>
                <Badge variant="outline">{stats.vehicles}</Badge>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-purple-500" />
                  <span className="text-sm">Locations</span>
                </div>
                <Badge variant="outline">{stats.locations}</Badge>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-primary" />
                  <span className="text-sm">Events</span>
                </div>
                <Badge variant="outline">{stats.events}</Badge>
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
