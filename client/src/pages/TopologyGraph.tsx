import { useState, useRef, useCallback, useEffect, useMemo } from "react";
import { useLocation } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ArrowLeft, Network, Search, ZoomIn, ZoomOut, Maximize2, Minimize2, RefreshCw, Database, AlertCircle, Image as ImageIcon, Sparkles, Car, Users, Shield, FileText, Loader2, Upload, X, Target, Clock, MapPin, Flag, Link as LinkIcon, Copy, Play, Pause, Calendar as CalendarIcon, Filter, ChevronDown, ChevronUp } from "lucide-react";
import ForceGraph2D from "react-force-graph-2d";
import { motion } from "framer-motion";
import { toast } from "sonner";
import NodeContextMenu, { type ContextMenuNode, type ContextMenuPosition } from "@/components/NodeContextMenu";
import NodeDetailsPanel from "@/components/NodeDetailsPanel";
import { Streamdown } from "streamdown";
import { Slider } from "@/components/ui/slider";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { addDays, startOfDay } from "date-fns";

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
      ease: [0.25, 0.46, 0.45, 0.94] as [number, number, number, number],
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
  type: "camera" | "location" | "vehicle" | "person" | "event" | "tag";
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
  fx?: number; // Fixed x position for custom layouts
  fy?: number; // Fixed y position for custom layouts
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
  id?: string;
  value: number;
  type: string;
  properties?: Record<string, any>;
}

interface TopologyData {
  success?: boolean;
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

interface TopologyBoundsResponse {
  success?: boolean;
  bounds?: { minTs: number | null; maxTs: number | null; count: number };
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
  const [rawGraphData, setRawGraphData] = useState<{ nodes: GraphNode[]; links: GraphLink[] }>({ nodes: [], links: [] });
  const [stats, setStats] = useState({ cameras: 0, locations: 0, vehicles: 0, persons: 0, events: 0, edges: 0 });
  const [layout, setLayout] = useState<LayoutType>("force");
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);
  const [selectedNodeIds, setSelectedNodeIds] = useState<Set<string>>(new Set());
  const [selectedLinkIds, setSelectedLinkIds] = useState<Set<string>>(new Set());
  const [reportDialogOpen, setReportDialogOpen] = useState(false);
  const [reportLoading, setReportLoading] = useState(false);
  const [activeReport, setActiveReport] = useState<any | null>(null);
  const [activeShareUrl, setActiveShareUrl] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [cameraFilterQuery, setCameraFilterQuery] = useState("");
  const [locationFilterQuery, setLocationFilterQuery] = useState("");
  const [selectedCameraIds, setSelectedCameraIds] = useState<Set<string>>(new Set());
  const [selectedLocationIds, setSelectedLocationIds] = useState<Set<string>>(new Set());
  const [showEventImages, setShowEventImages] = useState(true);
  const [groupByTags, setGroupByTags] = useState(false);
  const [expandedTag, setExpandedTag] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dbConnected, setDbConnected] = useState(false);
  const [neo4jConnected, setNeo4jConnected] = useState(false);
  const graphRef = useRef<any>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });
  const [loadedImages, setLoadedImages] = useState<Set<string>>(new Set());
  const [isFullscreen, setIsFullscreen] = useState(false);

  const [timeBounds, setTimeBounds] = useState<{ minTs: number | null; maxTs: number | null; count: number } | null>(null);
  const [timeMode, setTimeMode] = useState<"window" | "range">("window");
  const [timeWindowMs, setTimeWindowMs] = useState<number>(60 * 60 * 1000);
  const [timeCursorTs, setTimeCursorTs] = useState<number | null>(null);
  const [scrubCursorTs, setScrubCursorTs] = useState<number | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [dateRange, setDateRange] = useState<{ from?: Date; to?: Date } | undefined>(undefined);

  const clamp = useCallback((v: number, min: number, max: number) => Math.max(min, Math.min(max, v)), []);

  const formatTs = useCallback((ts: number) => {
    try {
      return new Date(ts).toLocaleString();
    } catch {
      return String(ts);
    }
  }, []);

  const [selectionBox, setSelectionBox] = useState<{
    active: boolean;
    startX: number;
    startY: number;
    endX: number;
    endY: number;
  } | null>(null);

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
  const [geminiOriginalGraphData, setGeminiOriginalGraphData] = useState<{ nodes: GraphNode[]; links: GraphLink[] } | null>(null);

  // Node type filter state
  const [activeTypeFilter, setActiveTypeFilter] = useState<string | null>(null);
  const [originalGraphData, setOriginalGraphData] = useState<{ nodes: GraphNode[]; links: GraphLink[] } | null>(null);

  // Context menu state
  const [contextMenuNode, setContextMenuNode] = useState<ContextMenuNode | null>(null);
  const [contextMenuPosition, setContextMenuPosition] = useState<ContextMenuPosition | null>(null);
  const [highRiskNodes, setHighRiskNodes] = useState<Set<string>>(new Set());

  // Node details panel state
  const [detailsPanelNode, setDetailsPanelNode] = useState<GraphNode | null>(null);
  const [isDetailsPanelOpen, setIsDetailsPanelOpen] = useState(false);

  // Reverse image search state
  const [reverseSearchImage, setReverseSearchImage] = useState<string | null>(null);
  const [reverseSearchMimeType, setReverseSearchMimeType] = useState<string>("");
  const [reverseSearchLoading, setReverseSearchLoading] = useState(false);
  const [reverseSearchResults, setReverseSearchResults] = useState<any>(null);
  const [reverseSearchError, setReverseSearchError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
            setLoadedImages((prev) => {
              const next = new Set(prev);
              next.add(node.imageUrl!);
              return next;
            });
          })
          .catch((err) => {
            console.warn(`[TopologyGraph] Failed to preload image for ${node.id}:`, err);
          });
      }
    });
  }, [graphData.nodes, loadedImages]);

  const fetchBounds = useCallback(async () => {
    try {
      const response = await fetch("/api/data/topology?action=bounds", { credentials: "include" });
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data: TopologyBoundsResponse = await response.json();
      if (data.success && data.bounds) {
        setTimeBounds(data.bounds);
        if (data.bounds.maxTs != null) {
          setTimeCursorTs((prev) => (prev == null ? data.bounds!.maxTs : prev));
        }
      }
    } catch (err) {
      console.error("[TopologyGraph] Failed to fetch bounds:", err);
    }
  }, []);

  const effectiveTimeRange = useMemo(() => {
    if (timeMode === "range") {
      if (dateRange?.from && dateRange?.to) {
        const start = startOfDay(dateRange.from).getTime();
        const end = addDays(startOfDay(dateRange.to), 1).getTime();
        return { startTs: start, endTs: end };
      }
      if (timeBounds?.minTs != null && timeBounds?.maxTs != null) {
        return { startTs: timeBounds.minTs, endTs: timeBounds.maxTs };
      }
      return { startTs: undefined, endTs: undefined };
    }

    const endTs = timeCursorTs ?? (timeBounds?.maxTs ?? Date.now());
    const startTs = endTs - timeWindowMs;
    return { startTs, endTs };
  }, [dateRange?.from, dateRange?.to, timeBounds?.maxTs, timeBounds?.minTs, timeCursorTs, timeMode, timeWindowMs]);

  const selectedCameraIdsArray = useMemo(() => Array.from(selectedCameraIds), [selectedCameraIds]);
  const selectedLocationIdsArray = useMemo(() => Array.from(selectedLocationIds), [selectedLocationIds]);

  const getNodeId = useCallback((v: any) => {
    if (v == null) return null;
    if (typeof v === "string") return v;
    if (typeof v === "object" && v.id != null) return String(v.id);
    return null;
  }, []);

  const buildTagAggregate = useCallback(
    (input: { nodes: GraphNode[]; links: GraphLink[] }, tagName?: string | null) => {
      const byId = new Map(input.nodes.map((n) => [n.id, n]));

      const eventToCameras = new Map<string, string[]>();
      const eventToLocations = new Map<string, string[]>();

      for (const l of input.links) {
        const s = getNodeId((l as any).source);
        const t = getNodeId((l as any).target);
        if (!s || !t) continue;
        const type = String((l as any).type || "");
        if (type === "TRIGGERED") {
          if (!eventToCameras.has(s)) eventToCameras.set(s, []);
          eventToCameras.get(s)!.push(t);
        }
        if (type === "LOCATED_AT") {
          const sourceNode = byId.get(s);
          if (sourceNode?.type === "event") {
            if (!eventToLocations.has(s)) eventToLocations.set(s, []);
            eventToLocations.get(s)!.push(t);
          }
        }
      }

      const events = input.nodes.filter((n) => n.type === "event");
      const tagsForEvent = (e: GraphNode) => {
        const raw = (e.tags && e.tags.length > 0 ? e.tags : e.geminiTags) ?? [];
        const normalized = raw.map((x) => String(x).trim()).filter(Boolean);
        if (normalized.length === 0) return ["untagged"];
        return normalized;
      };

      const allNonEvents = input.nodes.filter((n) => n.type !== "event");

      if (tagName) {
        const targetTag = String(tagName);
        const includedEventIds = new Set(
          events
            .filter((e) => tagsForEvent(e).includes(targetTag))
            .map((e) => e.id)
        );

        const includeIds = new Set<string>(includedEventIds);
        const links = input.links.filter((l) => {
          const s = getNodeId((l as any).source);
          const t = getNodeId((l as any).target);
          if (!s || !t) return false;
          if (includedEventIds.has(s) || includedEventIds.has(t)) {
            includeIds.add(s);
            includeIds.add(t);
            return true;
          }
          return false;
        });

        const tagId = `tag:${targetTag}`;
        includeIds.add(tagId);
        const nodes: GraphNode[] = [
          {
            id: tagId,
            name: targetTag,
            type: "tag",
            color: "#F59E0B",
            val: Math.max(6, Math.sqrt(includedEventIds.size) + 6),
          },
          ...input.nodes.filter((n) => includeIds.has(n.id)),
        ];

        const tagLinks: GraphLink[] = Array.from(includedEventIds).map((eid) => ({
          id: `tagged:${targetTag}:${eid}`,
          source: tagId,
          target: eid,
          value: 1,
          type: "TAGGED",
        }));

        return {
          nodes,
          links: [...links, ...tagLinks],
        };
      }

      const tagCameraCounts = new Map<string, Map<string, number>>();
      const tagLocationCounts = new Map<string, Map<string, number>>();

      for (const e of events) {
        const tags = tagsForEvent(e);
        const cameraIds = eventToCameras.get(e.id) ?? [];
        const locationIds = eventToLocations.get(e.id) ?? [];

        for (const tag of tags) {
          if (!tagCameraCounts.has(tag)) tagCameraCounts.set(tag, new Map());
          const camCounts = tagCameraCounts.get(tag)!;
          for (const cid of cameraIds) {
            camCounts.set(cid, (camCounts.get(cid) ?? 0) + 1);
          }

          if (!tagLocationCounts.has(tag)) tagLocationCounts.set(tag, new Map());
          const locCounts = tagLocationCounts.get(tag)!;
          for (const lid of locationIds) {
            locCounts.set(lid, (locCounts.get(lid) ?? 0) + 1);
          }
        }
      }

      const tagNodes: GraphNode[] = Array.from(tagCameraCounts.keys())
        .sort((a, b) => a.localeCompare(b))
        .slice(0, 200)
        .map((tag) => {
          const total = Array.from(tagCameraCounts.get(tag)!.values()).reduce((a, b) => a + b, 0);
          return {
            id: `tag:${tag}`,
            name: tag,
            type: "tag",
            color: "#F59E0B",
            val: Math.max(5, Math.sqrt(total) + 4),
            tags: [tag],
          };
        });

      const tagLinks: GraphLink[] = [];
      for (const [tag, camCounts] of tagCameraCounts.entries()) {
        const tagId = `tag:${tag}`;
        for (const [cameraId, count] of camCounts.entries()) {
          tagLinks.push({
            id: `tagcam:${tag}:${cameraId}`,
            source: tagId,
            target: cameraId,
            value: Math.max(1, count),
            type: "TAGGED",
            properties: { count },
          });
        }
      }

      for (const [tag, locCounts] of tagLocationCounts.entries()) {
        const tagId = `tag:${tag}`;
        for (const [locationId, count] of locCounts.entries()) {
          tagLinks.push({
            id: `tagloc:${tag}:${locationId}`,
            source: tagId,
            target: locationId,
            value: Math.max(1, count),
            type: "TAGGED_AT",
            properties: { count },
          });
        }
      }

      const nodes: GraphNode[] = [...allNonEvents, ...tagNodes];
      const nodeIds = new Set(nodes.map((n) => n.id));
      const links: GraphLink[] = [
        ...input.links.filter((l) => {
          const s = getNodeId((l as any).source);
          const t = getNodeId((l as any).target);
          if (!s || !t) return false;
          const sNode = byId.get(s);
          const tNode = byId.get(t);
          if (sNode?.type === "event" || tNode?.type === "event") return false;
          return nodeIds.has(s) && nodeIds.has(t);
        }),
        ...tagLinks.filter((l) => nodeIds.has(String(l.source)) && nodeIds.has(String(l.target))),
      ];

      return { nodes, links };
    },
    [getNodeId]
  );

  const windowLabel = useMemo(() => {
    const startTs = effectiveTimeRange.startTs;
    const endTs = effectiveTimeRange.endTs;
    if (startTs == null || endTs == null) return "";
    return `${formatTs(startTs)} – ${formatTs(endTs)}`;
  }, [effectiveTimeRange.endTs, effectiveTimeRange.startTs, formatTs]);

  const visibleGeminiStats = useMemo<GeminiStats>(() => {
    const events = graphData.nodes.filter((n) => n.type === "event");
    const analyzed = events.filter((e) => e.geminiProcessedAt != null);

    const withWeapons = analyzed.filter((e) => (e.geminiWeapons?.length ?? 0) > 0).length;
    const withLicensePlates = analyzed.filter((e) => (e.geminiLicensePlates?.length ?? 0) > 0).length;
    const withMultiplePeople = analyzed.filter((e) => (e.geminiPeopleCount ?? 0) >= 2).length;

    const vehicleCounts = new Map<string, number>();
    const clothingCounts = new Map<string, number>();

    for (const e of analyzed) {
      for (const v of e.geminiVehicles ?? []) {
        const key = String(v).trim().toLowerCase();
        if (!key) continue;
        vehicleCounts.set(key, (vehicleCounts.get(key) ?? 0) + 1);
      }
      for (const c of e.geminiClothingColors ?? []) {
        const key = String(c).trim().toLowerCase();
        if (!key) continue;
        clothingCounts.set(key, (clothingCounts.get(key) ?? 0) + 1);
      }
    }

    const topVehicleTypes = Array.from(vehicleCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 20)
      .map(([type, count]) => ({ type, count }));

    const topClothingColors = Array.from(clothingCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 30)
      .map(([color, count]) => ({ color, count }));

    return {
      totalProcessed: analyzed.length,
      withWeapons,
      withLicensePlates,
      withMultiplePeople,
      avgQualityScore: 0,
      topVehicleTypes,
      topClothingColors,
    };
  }, [graphData.nodes]);

  useEffect(() => {
    // If current selection becomes invalid for the visible window, clear it so users don't end up with zero-result options.
    const availableVehicleTypes = new Set(visibleGeminiStats.topVehicleTypes.map((v) => v.type));
    const availableClothingColors = new Set(visibleGeminiStats.topClothingColors.map((c) => c.color));

    setGeminiFilters((prev) => {
      const next = { ...prev };

      if (prev.hasWeapons && visibleGeminiStats.withWeapons === 0) next.hasWeapons = false;
      if (prev.hasLicensePlates && visibleGeminiStats.withLicensePlates === 0) next.hasLicensePlates = false;
      if (prev.hasMultiplePeople && visibleGeminiStats.withMultiplePeople === 0) next.hasMultiplePeople = false;

      if (prev.vehicleType && !availableVehicleTypes.has(prev.vehicleType.trim().toLowerCase())) next.vehicleType = "";
      if (prev.clothingColor && !availableClothingColors.has(prev.clothingColor.trim().toLowerCase())) next.clothingColor = "";

      const changed =
        next.hasWeapons !== prev.hasWeapons ||
        next.hasLicensePlates !== prev.hasLicensePlates ||
        next.hasMultiplePeople !== prev.hasMultiplePeople ||
        next.vehicleType !== prev.vehicleType ||
        next.clothingColor !== prev.clothingColor;

      return changed ? next : prev;
    });
  }, [visibleGeminiStats]);

  // Fetch real topology data from API
  const fetchTopologyData = useCallback(async (params?: { startTs?: number; endTs?: number; cameraIds?: string[]; locationIds?: string[] }) => {
    try {
      setIsLoading(true);
      const sp = new URLSearchParams();
      if (params?.startTs != null && Number.isFinite(params.startTs)) sp.set("startTs", String(params.startTs));
      if (params?.endTs != null && Number.isFinite(params.endTs)) sp.set("endTs", String(params.endTs));
      const cameraIds = params?.cameraIds ?? selectedCameraIdsArray;
      const locationIds = params?.locationIds ?? selectedLocationIdsArray;
      if (cameraIds.length > 0) sp.set("cameraIds", cameraIds.join(","));
      if (locationIds.length > 0) sp.set("locationIds", locationIds.join(","));
      const url = sp.toString() ? `/api/data/topology?${sp.toString()}` : "/api/data/topology";
      const response = await fetch(url, { credentials: "include" });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data: TopologyData = await response.json();

      if (data.success) {
        setRawGraphData({ nodes: data.nodes, links: data.links });
        setStats(data.stats);
        setDbConnected(data.dbConnected);
        setNeo4jConnected(data.neo4jConnected || false);
        setOriginalGraphData(null);
        setActiveTypeFilter(null);
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
  }, [selectedCameraIdsArray, selectedLocationIdsArray]);

  const refreshTopologyData = useCallback(() => {
    const startTs = effectiveTimeRange.startTs;
    const endTs = effectiveTimeRange.endTs;
    if (startTs == null || endTs == null) {
      fetchTopologyData({ cameraIds: selectedCameraIdsArray, locationIds: selectedLocationIdsArray });
      return;
    }
    fetchTopologyData({ startTs, endTs, cameraIds: selectedCameraIdsArray, locationIds: selectedLocationIdsArray });
  }, [effectiveTimeRange.endTs, effectiveTimeRange.startTs, fetchTopologyData, selectedCameraIdsArray, selectedLocationIdsArray]);

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
      const active =
        geminiFilters.hasWeapons ||
        geminiFilters.hasLicensePlates ||
        geminiFilters.hasMultiplePeople ||
        !!geminiFilters.vehicleType ||
        !!geminiFilters.clothingColor;

      if (!active) return;

      const baseData = geminiOriginalGraphData ?? graphData;
      const baseEvents = baseData.nodes.filter((n) => n.type === "event");
      if (baseEvents.length === 0) {
        toast.info("No events visible in the current view");
        return;
      }

      if (!geminiOriginalGraphData) {
        setGeminiOriginalGraphData({ nodes: [...graphData.nodes], links: [...graphData.links] });
      }

      const matchVehicleType = geminiFilters.vehicleType.trim().toLowerCase();
      const matchClothingColor = geminiFilters.clothingColor.trim().toLowerCase();

      const eventMatches = (e: GraphNode) => {
        if (e.geminiProcessedAt == null) return false;
        if (geminiFilters.hasWeapons && (e.geminiWeapons?.length ?? 0) === 0) return false;
        if (geminiFilters.hasLicensePlates && (e.geminiLicensePlates?.length ?? 0) === 0) return false;
        if (geminiFilters.hasMultiplePeople && (e.geminiPeopleCount ?? 0) < 2) return false;

        if (matchVehicleType) {
          const vehicles = (e.geminiVehicles ?? []).map((v) => String(v).trim().toLowerCase());
          if (!vehicles.includes(matchVehicleType)) return false;
        }

        if (matchClothingColor) {
          const colors = (e.geminiClothingColors ?? []).map((c) => String(c).trim().toLowerCase());
          if (!colors.includes(matchClothingColor)) return false;
        }

        return true;
      };

      const matchingIds = new Set(baseEvents.filter(eventMatches).map((e) => e.id));
      if (matchingIds.size === 0) {
        toast.info("No matching events found");
        return;
      }

      // Filter to only show matching nodes (and their connected cameras/locations)
      const matchingNodes = baseData.nodes.filter((node) => {
        if (matchingIds.has(node.id)) return true;
        if (node.type === "camera" || node.type === "location") {
          return baseData.links.some((link) => {
            const sourceId = typeof link.source === "string" ? link.source : link.source.id;
            const targetId = typeof link.target === "string" ? link.target : link.target.id;
            return (
              (sourceId === node.id && matchingIds.has(targetId)) ||
              (targetId === node.id && matchingIds.has(sourceId))
            );
          });
        }
        return false;
      });

      const matchingNodeIds = new Set(matchingNodes.map((n) => n.id));
      const matchingLinks = baseData.links.filter((link) => {
        const sourceId = typeof link.source === "string" ? link.source : link.source.id;
        const targetId = typeof link.target === "string" ? link.target : link.target.id;
        return matchingNodeIds.has(sourceId) && matchingNodeIds.has(targetId);
      });

      setGraphData({
        nodes: matchingNodes.map((node) => ({
          ...node,
          color: matchingIds.has(node.id) ? "#FFD700" : node.color,
          val: matchingIds.has(node.id) ? (node.val || 5) * 1.5 : node.val,
        })),
        links: matchingLinks,
      });

      toast.success(`Found ${matchingIds.size} matching events`);
      if (graphRef.current) {
        setTimeout(() => graphRef.current?.zoomToFit(500, 50), 100);
      }
    } catch (err) {
      console.error("[TopologyGraph] Gemini search failed:", err);
      toast.error("Search failed");
    } finally {
      setGeminiSearching(false);
    }
  }, [geminiFilters, geminiOriginalGraphData, graphData]);

  // Clear Gemini filters and reset graph
  const clearGeminiFilters = useCallback(() => {
    setGeminiFilters({
      hasWeapons: false,
      hasLicensePlates: false,
      hasMultiplePeople: false,
      vehicleType: "",
      clothingColor: "",
    });
    if (geminiOriginalGraphData) {
      setGraphData(geminiOriginalGraphData);
      setGeminiOriginalGraphData(null);
      return;
    }
    refreshTopologyData();
  }, [geminiOriginalGraphData, refreshTopologyData]);

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
      "Tags": "tag",
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

  useEffect(() => {
    // Tag-grouping changes the shape of the graph; ensure type filter isn't holding stale snapshots.
    setActiveTypeFilter(null);
    setOriginalGraphData(null);
  }, [groupByTags]);

  // Clear all filters
  const clearAllFilters = useCallback(() => {
    setActiveTypeFilter(null);
    if (originalGraphData) {
      setGraphData(originalGraphData);
      setOriginalGraphData(null);
    }
    clearGeminiFilters();
  }, [originalGraphData, clearGeminiFilters]);

  // Reverse Image Search handlers
  const handleImageUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast.error('Please upload a valid image file');
      return;
    }

    // Validate file size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      toast.error('Image must be smaller than 10MB');
      return;
    }

    const reader = new FileReader();
    reader.onload = async () => {
      const base64 = reader.result as string;
      const base64Data = base64.split(',')[1]; // Remove data:image/...;base64, prefix
      
      setReverseSearchImage(base64);
      setReverseSearchMimeType(file.type);
      setReverseSearchError(null);
      
      // Automatically start the search
      await performReverseSearch(base64Data, file.type);
    };
    reader.onerror = () => {
      toast.error('Failed to read image file');
    };
    reader.readAsDataURL(file);
  }, []);

  const performReverseSearch = useCallback(async (base64Image: string, mimeType: string) => {
    try {
      setReverseSearchLoading(true);
      setReverseSearchError(null);

      toast.loading('Analyzing image with Gemini AI...', { id: 'reverse-search' });

      const response = await fetch('/api/data/reverse-image-search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ image: base64Image, mimeType, limit: 50 }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Search failed');
      }

      setReverseSearchResults(data);
      toast.success(`Found ${data.matches.length} matches!`, { 
        id: 'reverse-search',
        description: `Processed in ${data.stats.processingTimeMs}ms`
      });

    } catch (error) {
      console.error('[Reverse Image Search] Error:', error);
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      setReverseSearchError(errorMsg);
      toast.error('Search failed', { id: 'reverse-search', description: errorMsg });
    } finally {
      setReverseSearchLoading(false);
    }
  }, []);

  const clearReverseSearch = useCallback(() => {
    setReverseSearchImage(null);
    setReverseSearchMimeType('');
    setReverseSearchResults(null);
    setReverseSearchError(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
    // Reset graph if filtered
    if (originalGraphData) {
      setGraphData(originalGraphData);
      setOriginalGraphData(null);
    }
  }, [originalGraphData]);

  const applyMatchesToGraph = useCallback(() => {
    if (!reverseSearchResults?.matches || reverseSearchResults.matches.length === 0) return;

    // Save original data if not already saved
    if (!originalGraphData) {
      setOriginalGraphData({ ...graphData });
    }

    const sourceData = originalGraphData || graphData;
    const matchingIds = new Set(reverseSearchResults.matches.map((m: any) => m.id));

    // Filter to show matching event nodes and their connected cameras/locations
    const matchingNodes = sourceData.nodes.filter(node => {
      if (matchingIds.has(node.id)) return true;
      if (node.type === 'camera' || node.type === 'location') {
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
    const matchingLinks = sourceData.links.filter(link => {
      const sourceId = typeof link.source === 'string' ? link.source : link.source.id;
      const targetId = typeof link.target === 'string' ? link.target : link.target.id;
      return matchingNodeIds.has(sourceId) && matchingNodeIds.has(targetId);
    });

    // Update graph with highlighted matches
    setGraphData({
      nodes: matchingNodes.map(node => ({
        ...node,
        color: matchingIds.has(node.id) ? "#00D9FF" : node.color, // Cyan highlight for matches
        val: matchingIds.has(node.id) ? (node.val || 5) * 1.5 : node.val,
      })),
      links: matchingLinks,
    });

    toast.success(`Filtered to ${reverseSearchResults.matches.length} matches`);
    
    // Zoom to fit
    if (graphRef.current) {
      setTimeout(() => graphRef.current?.zoomToFit(500, 50), 100);
    }
  }, [reverseSearchResults, graphData, originalGraphData]);

  const handleMatchClick = useCallback((match: any) => {
    // Find the node in the graph and select it
    const node = graphData.nodes.find(n => n.id === match.id);
    if (node && graphRef.current) {
      setSelectedNode(node);
      if (node.x && node.y) {
        graphRef.current.centerAt(node.x, node.y, 1000);
        graphRef.current.zoom?.(2, 1000);
      }
      toast.info(`Selected: ${node.name}`);
    }
  }, [graphData.nodes]);

  // Initial fetch
  useEffect(() => {
    fetchBounds();
    fetchGeminiStats();
  }, [fetchBounds, fetchGeminiStats]);

  useEffect(() => {
    const startTs = effectiveTimeRange.startTs;
    const endTs = effectiveTimeRange.endTs;
    if (startTs == null || endTs == null) return;
    fetchTopologyData({ startTs, endTs, cameraIds: selectedCameraIdsArray, locationIds: selectedLocationIdsArray });
  }, [effectiveTimeRange.endTs, effectiveTimeRange.startTs, fetchTopologyData]);

  useEffect(() => {
    if (!groupByTags) {
      setExpandedTag(null);
    }
  }, [groupByTags]);

  useEffect(() => {
    if (!groupByTags) {
      setGraphData(rawGraphData);
      return;
    }
    setGraphData(buildTagAggregate(rawGraphData, expandedTag));
  }, [buildTagAggregate, expandedTag, groupByTags, rawGraphData]);

  const availableCameras = useMemo(() => {
    return graphData.nodes
      .filter((n) => n.type === "camera")
      .map((n) => ({ id: n.id, name: n.name || n.id }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [graphData.nodes]);

  const availableLocations = useMemo(() => {
    return graphData.nodes
      .filter((n) => n.type === "location")
      .map((n) => ({ id: n.id, name: n.name || n.id }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [graphData.nodes]);

  const filteredCameras = useMemo(() => {
    const q = cameraFilterQuery.trim().toLowerCase();
    const base = q ? availableCameras.filter((c) => c.name.toLowerCase().includes(q) || c.id.toLowerCase().includes(q)) : availableCameras;
    return base.slice(0, 50);
  }, [availableCameras, cameraFilterQuery]);

  const filteredLocations = useMemo(() => {
    const q = locationFilterQuery.trim().toLowerCase();
    const base = q ? availableLocations.filter((l) => l.name.toLowerCase().includes(q) || l.id.toLowerCase().includes(q)) : availableLocations;
    return base.slice(0, 50);
  }, [availableLocations, locationFilterQuery]);

  useEffect(() => {
    if (!isPlaying) return;
    const maxTs = timeBounds?.maxTs ?? null;
    if (maxTs == null) return;
    const step = Math.max(60 * 1000, Math.min(15 * 60 * 1000, Math.floor(timeWindowMs / 10)));
    const id = window.setInterval(() => {
      setTimeCursorTs((prev) => {
        const next = (prev ?? maxTs) + step;
        if (next >= maxTs) {
          setIsPlaying(false);
          return maxTs;
        }
        return next;
      });
    }, 900);
    return () => window.clearInterval(id);
  }, [isPlaying, timeBounds?.maxTs, timeWindowMs]);

  const setPreset = useCallback((preset: "1h" | "24h" | "7d" | "30d" | "all") => {
    setIsPlaying(false);
    if (preset === "all") {
      setTimeMode("range");
      if (timeBounds?.minTs != null && timeBounds?.maxTs != null) {
        setDateRange({ from: new Date(timeBounds.minTs), to: new Date(timeBounds.maxTs) });
      } else {
        setDateRange(undefined);
      }
      return;
    }
    setTimeMode("window");
    const now = timeBounds?.maxTs ?? Date.now();
    setTimeCursorTs(now);
    if (preset === "1h") setTimeWindowMs(60 * 60 * 1000);
    if (preset === "24h") setTimeWindowMs(24 * 60 * 60 * 1000);
    if (preset === "7d") setTimeWindowMs(7 * 24 * 60 * 60 * 1000);
    if (preset === "30d") setTimeWindowMs(30 * 24 * 60 * 60 * 1000);
  }, [timeBounds?.maxTs, timeBounds?.minTs]);

  const canUseSlider = timeMode === "window" && timeBounds?.minTs != null && timeBounds?.maxTs != null;
  const sliderMin = timeBounds?.minTs ?? 0;
  const sliderMax = timeBounds?.maxTs ?? 0;
  const sliderValue = useMemo(() => {
    if (!canUseSlider) return [0];
    const v = scrubCursorTs ?? timeCursorTs ?? sliderMax;
    return [clamp(v, sliderMin, sliderMax)];
  }, [canUseSlider, clamp, scrubCursorTs, sliderMax, sliderMin, timeCursorTs]);

  const handleSliderChange = useCallback(
    (value: number[]) => {
      if (!canUseSlider) return;
      setIsPlaying(false);
      const v = value?.[0];
      if (v == null) return;
      setScrubCursorTs(clamp(v, sliderMin, sliderMax));
    },
    [canUseSlider, clamp, sliderMax, sliderMin]
  );

  const handleSliderCommit = useCallback(
    (value: number[]) => {
      if (!canUseSlider) return;
      setIsPlaying(false);
      const v = value?.[0];
      if (v == null) return;
      setScrubCursorTs(null);
      setTimeCursorTs(clamp(v, sliderMin, sliderMax));
    },
    [canUseSlider, clamp, sliderMax, sliderMin]
  );

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
          node.fx = undefined;
          node.fy = undefined;
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

  const clearMultiSelection = useCallback(() => {
    setSelectedNodeIds(new Set());
    setSelectedLinkIds(new Set());
  }, []);

  const selectedNodeIdList = useMemo(() => Array.from(selectedNodeIds), [selectedNodeIds]);
  const selectedLinkIdList = useMemo(() => Array.from(selectedLinkIds), [selectedLinkIds]);

  const handleCopyToClipboard = useCallback(async (text: string, successMessage: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success(successMessage);
    } catch {
      toast.error("Failed to copy to clipboard");
    }
  }, []);

  const generateTopologyReport = useCallback(async (options?: { openDialog?: boolean }) => {
    if (selectedNodeIdList.length === 0) {
      toast.info("Select nodes first (Shift + drag)");
      return null;
    }

    try {
      setReportLoading(true);
      setActiveShareUrl(null);
      const response = await fetch("/api/data/topology-reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          nodeIds: selectedNodeIdList,
          edgeIds: selectedLinkIdList,
        }),
      });

      let data: any = null;
      try {
        data = await response.json();
      } catch {
        const text = await response.text();
        throw new Error(text || `Request failed (${response.status})`);
      }
      if (!response.ok || !data.success) {
        throw new Error(data.error || "Failed to generate report");
      }

      setActiveReport(data.report);
      if (options?.openDialog !== false) {
        setReportDialogOpen(true);
      }
      toast.success("Report generated");
      return data.report as any;
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      toast.error("Report generation failed", { description: msg });
      return null;
    } finally {
      setReportLoading(false);
    }
  }, [selectedLinkIdList, selectedNodeIdList]);

  const flagSelectionAsIssue = useCallback(async () => {
    if (selectedNodeIdList.length === 0) {
      toast.info("Select nodes first (Shift + drag)");
      return;
    }

    try {
      setReportLoading(true);
      const report = activeReport || (await generateTopologyReport({ openDialog: false }));
      const reportId = report?.id;
      if (!reportId) {
        throw new Error("No reportId available");
      }

      const response = await fetch("/api/data/topology-reports?action=flag", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          reportId,
          nodeIds: selectedNodeIdList,
          edgeIds: selectedLinkIdList,
        }),
      });

      let data: any = null;
      try {
        data = await response.json();
      } catch {
        const text = await response.text();
        throw new Error(text || `Request failed (${response.status})`);
      }
      if (!response.ok || !data.success) {
        throw new Error(data.error || "Failed to flag selection");
      }

      setActiveReport((prev: any) => (prev ? { ...prev, flagged: true } : prev));
      toast.success("Flagged as issue");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      toast.error("Flagging failed", { description: msg });
    } finally {
      setReportLoading(false);
    }
  }, [activeReport, generateTopologyReport, selectedLinkIdList, selectedNodeIdList]);

  const createShareLink = useCallback(async () => {
    if (!activeReport?.id) {
      toast.info("Generate a report first");
      return;
    }
    try {
      const response = await fetch("/api/data/topology-reports?action=share", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ reportId: activeReport.id }),
      });

      let data: any = null;
      try {
        data = await response.json();
      } catch {
        const text = await response.text();
        throw new Error(text || `Request failed (${response.status})`);
      }
      if (!response.ok || !data.success) {
        throw new Error(data.error || "Failed to create share link");
      }
      const url = `${window.location.origin}/share/report/${data.shareToken}`;
      setActiveShareUrl(url);
      toast.success("Share link created");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      toast.error("Share link failed", { description: msg });
    }
  }, [activeReport?.id]);

  const getContainerRelativePoint = useCallback((event: MouseEvent | globalThis.MouseEvent) => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return null;
    return {
      x: event.clientX - rect.left,
      y: event.clientY - rect.top,
    };
  }, []);

  const finalizeSelectionBox = useCallback(() => {
    if (!selectionBox || !selectionBox.active) return;
    if (!graphRef.current || !containerRef.current) {
      setSelectionBox(null);
      return;
    }

    const minX = Math.min(selectionBox.startX, selectionBox.endX);
    const maxX = Math.max(selectionBox.startX, selectionBox.endX);
    const minY = Math.min(selectionBox.startY, selectionBox.endY);
    const maxY = Math.max(selectionBox.startY, selectionBox.endY);

    const nextSelectedNodeIds = new Set<string>();
    for (const node of graphData.nodes) {
      const x = node.x;
      const y = node.y;
      if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
      const p = graphRef.current.graph2ScreenCoords(x as number, y as number);
      if (!p) continue;
      if (p.x >= minX && p.x <= maxX && p.y >= minY && p.y <= maxY) {
        nextSelectedNodeIds.add(node.id);
      }
    }

    const nextSelectedLinkIds = new Set<string>();
    for (const link of graphData.links as any[]) {
      const sourceId = typeof link.source === "string" ? link.source : link.source?.id;
      const targetId = typeof link.target === "string" ? link.target : link.target?.id;
      if (!sourceId || !targetId) continue;
      if (!nextSelectedNodeIds.has(sourceId) || !nextSelectedNodeIds.has(targetId)) continue;
      if (link.id != null) {
        nextSelectedLinkIds.add(String(link.id));
      }
    }

    setSelectedNode(null);
    setSelectedNodeIds(nextSelectedNodeIds);
    setSelectedLinkIds(nextSelectedLinkIds);
    setSelectionBox(null);

    setGraphData(prev => ({ ...prev, nodes: [...prev.nodes] }));
  }, [graphData.links, graphData.nodes, selectionBox]);

  const handleNodeClick = useCallback((node: any, event?: MouseEvent) => {
    if (selectionBox?.active) return;
    if (event?.shiftKey) return;

    if (groupByTags && node?.type === "tag") {
      const tagName = typeof node?.name === "string" && node.name.trim().length > 0 ? node.name.trim() : null;
      if (tagName) {
        setExpandedTag(tagName);
        setSelectedNode(null);
        if (graphRef.current && graphRef.current.zoomToFit) {
          setTimeout(() => graphRef.current?.zoomToFit(500, 50), 50);
        }
      }
      return;
    }

    clearMultiSelection();
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
  }, [clearMultiSelection, groupByTags, selectionBox?.active]);

  const handleBackgroundClick = useCallback((event: MouseEvent) => {
    if (selectionBox?.active) return;
    if (event.shiftKey) return;
    clearMultiSelection();
    setSelectedNode(null);
    setContextMenuNode(null);
    setContextMenuPosition(null);
  }, [clearMultiSelection, selectionBox?.active]);

  const handleSelectionMouseDown = useCallback((event: React.MouseEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;
    if (!event.shiftKey) return;
    const p = getContainerRelativePoint(event.nativeEvent);
    if (!p) return;

    event.preventDefault();
    event.stopPropagation();

    setSelectionBox({
      active: true,
      startX: p.x,
      startY: p.y,
      endX: p.x,
      endY: p.y,
    });
  }, [getContainerRelativePoint]);

  const handleSelectionMouseMove = useCallback((event: React.MouseEvent<HTMLDivElement>) => {
    if (!selectionBox?.active) return;
    const p = getContainerRelativePoint(event.nativeEvent);
    if (!p) return;
    event.preventDefault();
    setSelectionBox(prev => prev ? ({ ...prev, endX: p.x, endY: p.y }) : prev);
  }, [getContainerRelativePoint, selectionBox?.active]);

  const handleSelectionMouseUp = useCallback((event: React.MouseEvent<HTMLDivElement>) => {
    if (!selectionBox?.active) return;
    event.preventDefault();
    event.stopPropagation();
    finalizeSelectionBox();
  }, [finalizeSelectionBox, selectionBox?.active]);

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
    // Find the full node data and open the details panel
    const fullNode = graphData.nodes.find(n => n.id === node.id);
    if (fullNode) {
      setDetailsPanelNode(fullNode);
      setIsDetailsPanelOpen(true);
      setSelectedNode(fullNode);
      if (graphRef.current && graphRef.current.centerAt) {
        graphRef.current.centerAt(fullNode.x, fullNode.y, 1000);
        graphRef.current.zoom?.(2, 1000);
      }
    }
  }, [graphData.nodes]);

  // Close details panel
  const handleCloseDetailsPanel = useCallback(() => {
    setIsDetailsPanelOpen(false);
  }, []);

  const handleContextCreateIncident = useCallback(async (node: ContextMenuNode) => {
    toast.loading("Creating incident...", { id: "create-incident" });

    try {
      const response = await fetch("/api/data/create-incident", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nodeId: node.id,
          nodeType: node.type,
          nodeName: node.name,
          region: node.region,
          location: node.latitude && node.longitude ? `${node.latitude},${node.longitude}` : undefined,
        }),
      });

      const data = await response.json();

      if (data.success) {
        toast.success("Incident created!", {
          id: "create-incident",
          description: `${data.incident.incidentType} - ${data.incident.id}`,
        });
        // Navigate to incidents page to see the new incident
        setLocation("/dashboard/incidents");
      } else {
        toast.error("Failed to create incident", {
          id: "create-incident",
          description: data.error,
        });
      }
    } catch (error) {
      console.error("Failed to create incident:", error);
      toast.error("Failed to create incident", {
        id: "create-incident",
        description: "Network error - please try again",
      });
    }
  }, [setLocation]);

  const handleContextAddToPole = useCallback(async (node: ContextMenuNode) => {
    toast.loading("Adding to POLE...", { id: "add-pole" });

    try {
      const response = await fetch("/api/data/create-pole-entity", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          entityId: node.id,
          entityType: node.type,
          entityName: node.name,
          coords: node.latitude && node.longitude ? `${node.latitude},${node.longitude}` : undefined,
        }),
      });

      const data = await response.json();

      if (data.success) {
        toast.success("POLE entity created!", {
          id: "add-pole",
          description: `${data.entity.entityType.toUpperCase()}: ${data.entity.name}`,
        });
        // Navigate to POLE page to see the new entity
        setLocation("/dashboard/pole");
      } else {
        toast.error("Failed to add to POLE", {
          id: "add-pole",
          description: data.error,
        });
      }
    } catch (error) {
      console.error("Failed to add to POLE:", error);
      toast.error("Failed to add to POLE", {
        id: "add-pole",
        description: "Network error - please try again",
      });
    }
  }, [setLocation]);

  const handleContextViewEvents = useCallback((node: ContextMenuNode) => {
    if (node.type === "camera") {
      setLocation(`/dashboard/realtime?channelId=${node.id}`);
    } else {
      setLocation("/dashboard/realtime");
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
    return undefined;
  }, [layout]);

  const linkColor = useCallback((link: any) => {
    const linkId = link?.id != null ? String(link.id) : null;
    if (linkId && selectedLinkIds.has(linkId)) {
      return "#22C55E";
    }
    return "#4B556380";
  }, [selectedLinkIds]);

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
  const displayStats = useMemo(() => {
    const counts = { cameras: 0, locations: 0, vehicles: 0, persons: 0, events: 0, tags: 0 };
    for (const n of graphData.nodes) {
      if (n.type === "camera") counts.cameras += 1;
      else if (n.type === "location") counts.locations += 1;
      else if (n.type === "vehicle") counts.vehicles += 1;
      else if (n.type === "person") counts.persons += 1;
      else if (n.type === "event") counts.events += 1;
      else if (n.type === "tag") counts.tags += 1;
    }
    return {
      nodes: graphData.nodes.length,
      edges: graphData.links.length,
      cameras: counts.cameras,
      persons: counts.persons,
      vehicles: counts.vehicles,
      locations: counts.locations,
      events: counts.events,
      tags: counts.tags,
      withImages: graphData.nodes.filter((n) => n.imageUrl).length,
      selectedNodes: selectedNodeIds.size,
      selectedEdges: selectedLinkIds.size,
    };
  }, [graphData.links.length, graphData.nodes, selectedLinkIds.size, selectedNodeIds.size]);

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
    const isMultiSelected = selectedNodeIds.has(node.id);
    // Override color to red if marked as high risk
    const nodeColor = isHighRisk ? "#EF4444" : (node.color || "#888888");
    const hasImage = showEventImages && node.imageUrl && imageCache.has(node.imageUrl);

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

    if (isMultiSelected) {
      ctx.beginPath();
      ctx.arc(x, y, nodeRadius + 5, 0, 2 * Math.PI, false);
      ctx.fillStyle = "rgba(34, 197, 94, 0.20)";
      ctx.fill();

      const pulseRadius = nodeRadius + 10 + Math.sin(Date.now() / 220) * 3;
      ctx.beginPath();
      ctx.arc(x, y, pulseRadius, 0, 2 * Math.PI, false);
      ctx.strokeStyle = "rgba(34, 197, 94, 0.65)";
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
  }, [selectedNode, loadedImages, highRiskNodes, selectedNodeIds, showEventImages]);

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

          <motion.div variants={cardVariants}>
            <Card className="hover:shadow-lg hover:shadow-primary/5 transition-shadow duration-300">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center justify-between">
                  <span>Time Controls</span>
                  <Badge variant="outline" className="text-[10px]">
                    {timeBounds?.count ?? 0}
                  </Badge>
                </CardTitle>
                <CardDescription className="text-xs">{windowLabel || ""}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" variant={timeMode === "window" && timeWindowMs === 60 * 60 * 1000 ? "default" : "outline"} onClick={() => setPreset("1h")}>
                    Last 1h
                  </Button>
                  <Button size="sm" variant={timeMode === "window" && timeWindowMs === 24 * 60 * 60 * 1000 ? "default" : "outline"} onClick={() => setPreset("24h")}>
                    Last 24h
                  </Button>
                  <Button size="sm" variant={timeMode === "window" && timeWindowMs === 7 * 24 * 60 * 60 * 1000 ? "default" : "outline"} onClick={() => setPreset("7d")}>
                    Last 7d
                  </Button>
                  <Button size="sm" variant={timeMode === "window" && timeWindowMs === 30 * 24 * 60 * 60 * 1000 ? "default" : "outline"} onClick={() => setPreset("30d")}>
                    Last 30d
                  </Button>
                  <Button size="sm" variant={timeMode === "range" ? "default" : "outline"} onClick={() => setPreset("all")}>
                    All
                  </Button>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <Select
                    value={String(timeWindowMs)}
                    onValueChange={(v) => {
                      setIsPlaying(false);
                      setTimeMode("window");
                      setTimeWindowMs(Number.parseInt(v, 10));
                    }}
                    disabled={timeMode !== "window"}
                  >
                    <SelectTrigger className="h-9">
                      <SelectValue placeholder="Window" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={String(15 * 60 * 1000)}>15m window</SelectItem>
                      <SelectItem value={String(30 * 60 * 1000)}>30m window</SelectItem>
                      <SelectItem value={String(60 * 60 * 1000)}>1h window</SelectItem>
                      <SelectItem value={String(6 * 60 * 60 * 1000)}>6h window</SelectItem>
                      <SelectItem value={String(24 * 60 * 60 * 1000)}>24h window</SelectItem>
                    </SelectContent>
                  </Select>

                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-9 justify-start"
                        onClick={() => {
                          setIsPlaying(false);
                          setTimeMode("range");
                        }}
                      >
                        <CalendarIcon className="w-4 h-4 mr-2" />
                        Date Range
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent align="start" className="w-auto p-0">
                      <Calendar
                        mode="range"
                        selected={dateRange as any}
                        onSelect={(range: any) => {
                          setIsPlaying(false);
                          setTimeMode("range");
                          setDateRange(range);
                        }}
                        numberOfMonths={2}
                      />
                    </PopoverContent>
                  </Popover>
                </div>

                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    className="flex-1"
                    disabled={!canUseSlider}
                    onClick={() => {
                      if (!canUseSlider) return;
                      setIsPlaying((prev) => !prev);
                    }}
                  >
                    {isPlaying ? <Pause className="w-4 h-4 mr-2" /> : <Play className="w-4 h-4 mr-2" />}
                    {isPlaying ? "Pause" : "Play"}
                  </Button>
                  <Button size="sm" variant="outline" className="flex-1" onClick={refreshTopologyData}>
                    <RefreshCw className="w-4 h-4 mr-2" />
                    Refresh
                  </Button>
                </div>
              </CardContent>
            </Card>
          </motion.div>

        <Dialog open={reportDialogOpen} onOpenChange={setReportDialogOpen}>
          <DialogContent className="max-w-3xl">
            <DialogHeader>
              <DialogTitle>Topology Report</DialogTitle>
              <DialogDescription>
                {activeReport?.title || ""}
              </DialogDescription>
            </DialogHeader>
            <ScrollArea className="h-[60vh] pr-4">
              {activeReport?.content ? (
                <Streamdown>
                  {activeReport.content}
                </Streamdown>
              ) : (
                <div className="text-sm text-muted-foreground">No report content available.</div>
              )}
            </ScrollArea>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => {
                  const html = `<!doctype html><html><head><meta charset=\"utf-8\" /><title>${activeReport?.id || "report"}</title></head><body><pre style=\"white-space:pre-wrap;font-family:ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace;\">${(activeReport?.content || "").replace(/</g, "&lt;")}</pre></body></html>`;
                  const w = window.open("", "_blank");
                  if (!w) return;
                  w.document.open();
                  w.document.write(html);
                  w.document.close();
                  w.focus();
                  w.print();
                }}
              >
                PDF
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  if (activeReport?.content) {
                    handleCopyToClipboard(activeReport.content, "Report copied");
                  }
                }}
              >
                Copy
              </Button>
              <Button onClick={() => setReportDialogOpen(false)}>Close</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

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
                  <Button variant="ghost" size="sm" onClick={refreshTopologyData} disabled={isLoading}>
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
                {displayStats.selectedNodes > 0 && (
                  <motion.div
                    className="flex items-center justify-between hover:bg-muted/30 p-1 rounded transition-colors"
                    whileHover={{ x: 4 }}
                  >
                    <span className="text-sm text-muted-foreground">Selected Nodes</span>
                    <Badge variant="outline" className="bg-green-500/10 text-green-500 border-green-500/30">
                      {displayStats.selectedNodes}
                    </Badge>
                  </motion.div>
                )}
                {displayStats.selectedEdges > 0 && (
                  <motion.div
                    className="flex items-center justify-between hover:bg-muted/30 p-1 rounded transition-colors"
                    whileHover={{ x: 4 }}
                  >
                    <span className="text-sm text-muted-foreground">Selected Edges</span>
                    <Badge variant="outline" className="bg-green-500/10 text-green-500 border-green-500/30">
                      {displayStats.selectedEdges}
                    </Badge>
                  </motion.div>
                )}
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
                  ...(displayStats.tags > 0 ? [{ color: "bg-yellow-500", label: "Tags", value: displayStats.tags, type: "tag" }] : []),
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

                <div className="h-px bg-border my-2" />

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Filter className="w-4 h-4 text-muted-foreground" />
                    <span className="text-sm font-medium">Filters</span>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 px-2"
                    onClick={() => setFiltersOpen((p) => !p)}
                  >
                    {filtersOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  </Button>
                </div>

                {filtersOpen && (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <label className="flex items-center gap-2 text-xs cursor-pointer">
                        <Checkbox
                          checked={groupByTags}
                          onCheckedChange={(c) => {
                            setGroupByTags(!!c);
                          }}
                        />
                        Group by tags
                      </label>
                      {groupByTags && expandedTag && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 px-3"
                          onClick={() => setExpandedTag(null)}
                        >
                          Back
                        </Button>
                      )}
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="text-xs text-muted-foreground">Selected cameras: {selectedCameraIds.size}</span>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 px-2 text-xs"
                        onClick={() => setSelectedCameraIds(new Set())}
                        disabled={selectedCameraIds.size === 0}
                      >
                        Clear
                      </Button>
                    </div>
                    <Input
                      value={cameraFilterQuery}
                      onChange={(e) => setCameraFilterQuery(e.target.value)}
                      placeholder="Filter cameras..."
                      className="h-8"
                    />
                    <ScrollArea className="h-32 rounded-md border border-border">
                      <div className="p-2 space-y-1">
                        {filteredCameras.map((c) => (
                          <label key={c.id} className="flex items-center gap-2 text-xs cursor-pointer hover:bg-muted/30 rounded px-2 py-1">
                            <Checkbox
                              checked={selectedCameraIds.has(c.id)}
                              onCheckedChange={(checked) => {
                                setSelectedCameraIds((prev) => {
                                  const next = new Set(prev);
                                  if (checked) next.add(c.id);
                                  else next.delete(c.id);
                                  return next;
                                });
                              }}
                            />
                            <span className="truncate" title={c.name}>{c.name}</span>
                          </label>
                        ))}
                        {filteredCameras.length === 0 && (
                          <div className="text-xs text-muted-foreground px-2 py-1">No cameras</div>
                        )}
                      </div>
                    </ScrollArea>

                    <div className="flex items-center justify-between">
                      <span className="text-xs text-muted-foreground">Selected locations: {selectedLocationIds.size}</span>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 px-2 text-xs"
                        onClick={() => setSelectedLocationIds(new Set())}
                        disabled={selectedLocationIds.size === 0}
                      >
                        Clear
                      </Button>
                    </div>
                    <Input
                      value={locationFilterQuery}
                      onChange={(e) => setLocationFilterQuery(e.target.value)}
                      placeholder="Filter locations..."
                      className="h-8"
                    />
                    <ScrollArea className="h-32 rounded-md border border-border">
                      <div className="p-2 space-y-1">
                        {filteredLocations.map((l) => (
                          <label key={l.id} className="flex items-center gap-2 text-xs cursor-pointer hover:bg-muted/30 rounded px-2 py-1">
                            <Checkbox
                              checked={selectedLocationIds.has(l.id)}
                              onCheckedChange={(checked) => {
                                setSelectedLocationIds((prev) => {
                                  const next = new Set(prev);
                                  if (checked) next.add(l.id);
                                  else next.delete(l.id);
                                  return next;
                                });
                              }}
                            />
                            <span className="truncate" title={l.name}>{l.name}</span>
                          </label>
                        ))}
                        {filteredLocations.length === 0 && (
                          <div className="text-xs text-muted-foreground px-2 py-1">No locations</div>
                        )}
                      </div>
                    </ScrollArea>

                    <div className="flex items-center justify-between">
                      <label className="flex items-center gap-2 text-xs cursor-pointer">
                        <Checkbox checked={showEventImages} onCheckedChange={(c) => setShowEventImages(!!c)} />
                        Show event images
                      </label>
                      <Button size="sm" className="h-7 px-3" onClick={refreshTopologyData} disabled={isLoading}>
                        Apply
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </motion.div>

          {displayStats.selectedNodes > 0 && (
            <motion.div variants={cardVariants}>
              <Card className="hover:shadow-lg hover:shadow-primary/5 transition-shadow duration-300 border-green-500/20">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center justify-between">
                    <span className="flex items-center gap-2">
                      <Target className="w-4 h-4 text-green-500" />
                      Selection
                    </span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        clearMultiSelection();
                        setActiveReport(null);
                        setActiveShareUrl(null);
                      }}
                    >
                      Clear
                    </Button>
                  </CardTitle>
                  <CardDescription className="text-xs">
                    {displayStats.selectedNodes} nodes • {displayStats.selectedEdges} edges
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-2">
                  <Button
                    size="sm"
                    className="w-full"
                    onClick={() => generateTopologyReport({ openDialog: true })}
                    disabled={reportLoading}
                  >
                    {reportLoading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <FileText className="w-4 h-4 mr-2" />}
                    Generate Summary
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="w-full"
                    onClick={flagSelectionAsIssue}
                    disabled={reportLoading}
                  >
                    {reportLoading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Flag className="w-4 h-4 mr-2" />}
                    Flag as Issue
                  </Button>

                  {activeReport?.id && (
                    <div className="pt-2 space-y-2">
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          className="flex-1"
                          onClick={() => setReportDialogOpen(true)}
                        >
                          View
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => window.open(`/api/data/topology-reports?id=${activeReport.id}&format=json`, "_blank")}
                        >
                          JSON
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => window.open(`/api/data/topology-reports?id=${activeReport.id}&format=csv`, "_blank")}
                        >
                          CSV
                        </Button>
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        className="w-full"
                        onClick={createShareLink}
                      >
                        <LinkIcon className="w-4 h-4 mr-2" />
                        Create Share Link
                      </Button>
                      {activeShareUrl && (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="w-full justify-between"
                          onClick={() => handleCopyToClipboard(activeShareUrl, "Link copied")}
                        >
                          <span className="truncate max-w-[200px]">{activeShareUrl}</span>
                          <Copy className="w-4 h-4 ml-2" />
                        </Button>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            </motion.div>
          )}

          {/* Selected Node Details */}
          {selectedNode && (
            <motion.div
              initial={{ opacity: 0, y: 20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -10, scale: 0.95 }}
              transition={{ duration: 0.3, ease: [0.25, 0.46, 0.45, 0.94] as [number, number, number, number] }}
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
                      {((selectedNode.objects?.length ?? 0) > 0) && (
                        <div className="space-y-1">
                          <span className="text-xs text-muted-foreground">Detected Objects</span>
                          <div className="flex flex-wrap gap-1">
                            {selectedNode.objects.slice(0, 10).map((obj, i) => (
                              <Badge key={i} variant="secondary" className="text-[10px] h-5 px-1.5 bg-blue-500/10 text-blue-400 border-blue-500/20">
                                {obj}
                              </Badge>
                            ))}
                            {(selectedNode.objects?.length ?? 0) > 10 && (
                              <Badge variant="outline" className="text-[10px] h-5 px-1.5">
                                +{(selectedNode.objects?.length ?? 0) - 10}
                              </Badge>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Tags */}
                      {((selectedNode.tags?.length ?? 0) > 0) && (
                        <div className="space-y-1">
                          <span className="text-xs text-muted-foreground">Tags</span>
                          <div className="flex flex-wrap gap-1">
                            {selectedNode.tags.slice(0, 10).map((tag, i) => (
                              <Badge key={i} variant="outline" className="text-[10px] h-5 px-1.5">
                                {tag}
                              </Badge>
                            ))}
                            {(selectedNode.tags?.length ?? 0) > 10 && (
                              <Badge variant="outline" className="text-[10px] h-5 px-1.5">
                                +{(selectedNode.tags?.length ?? 0) - 10}
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
                {visibleGeminiStats.totalProcessed > 0 && (
                  <div className="grid grid-cols-2 gap-2 text-xs mb-3">
                    <div className="p-2 bg-yellow-500/10 rounded-lg text-center">
                      <div className="font-bold text-yellow-400">{visibleGeminiStats.totalProcessed}</div>
                      <div className="text-muted-foreground">Analyzed</div>
                    </div>
                    <div className="p-2 bg-red-500/10 rounded-lg text-center">
                      <div className="font-bold text-red-400">{visibleGeminiStats.withWeapons}</div>
                      <div className="text-muted-foreground">With Weapons</div>
                    </div>
                    <div className="p-2 bg-blue-500/10 rounded-lg text-center">
                      <div className="font-bold text-blue-400">{visibleGeminiStats.withLicensePlates}</div>
                      <div className="text-muted-foreground">License Plates</div>
                    </div>
                    <div className="p-2 bg-green-500/10 rounded-lg text-center">
                      <div className="font-bold text-green-400">{visibleGeminiStats.withMultiplePeople}</div>
                      <div className="text-muted-foreground">Multi-Person</div>
                    </div>
                  </div>
                )}

                {/* Quick Filters */}
                <div className="space-y-2">
                  <span className="text-xs font-medium text-muted-foreground">Quick Filters</span>
                  <div className="flex flex-wrap gap-1">
                    {(() => {
                      const weaponsDisabled = visibleGeminiStats.withWeapons === 0;
                      const platesDisabled = visibleGeminiStats.withLicensePlates === 0;
                      const multiDisabled = visibleGeminiStats.withMultiplePeople === 0;
                      return (
                        <>
                    <Badge
                      variant={geminiFilters.hasWeapons ? "default" : "outline"}
                      className={`text-[10px] ${weaponsDisabled ? "opacity-40 cursor-not-allowed" : "cursor-pointer"} ${geminiFilters.hasWeapons ? "bg-red-500 hover:bg-red-600" : "hover:bg-red-500/20"}`}
                      onClick={() => {
                        if (weaponsDisabled) return;
                        setGeminiFilters(prev => ({ ...prev, hasWeapons: !prev.hasWeapons }));
                      }}
                    >
                      <Shield className="w-3 h-3 mr-1" />
                      Weapons
                    </Badge>
                    <Badge
                      variant={geminiFilters.hasLicensePlates ? "default" : "outline"}
                      className={`text-[10px] ${platesDisabled ? "opacity-40 cursor-not-allowed" : "cursor-pointer"} ${geminiFilters.hasLicensePlates ? "bg-blue-500 hover:bg-blue-600" : "hover:bg-blue-500/20"}`}
                      onClick={() => {
                        if (platesDisabled) return;
                        setGeminiFilters(prev => ({ ...prev, hasLicensePlates: !prev.hasLicensePlates }));
                      }}
                    >
                      <Car className="w-3 h-3 mr-1" />
                      License Plates
                    </Badge>
                    <Badge
                      variant={geminiFilters.hasMultiplePeople ? "default" : "outline"}
                      className={`text-[10px] ${multiDisabled ? "opacity-40 cursor-not-allowed" : "cursor-pointer"} ${geminiFilters.hasMultiplePeople ? "bg-green-500 hover:bg-green-600" : "hover:bg-green-500/20"}`}
                      onClick={() => {
                        if (multiDisabled) return;
                        setGeminiFilters(prev => ({ ...prev, hasMultiplePeople: !prev.hasMultiplePeople }));
                      }}
                    >
                      <Users className="w-3 h-3 mr-1" />
                      2+ People
                    </Badge>
                        </>
                      );
                    })()}
                  </div>
                </div>

                {/* Vehicle Type Filter */}
                {visibleGeminiStats.topVehicleTypes && visibleGeminiStats.topVehicleTypes.length > 0 && (
                  <div className="space-y-1">
                    <span className="text-xs font-medium text-muted-foreground">Vehicle Types</span>
                    <div className="flex flex-wrap gap-1">
                      {visibleGeminiStats.topVehicleTypes.slice(0, 5).map((v, i) => (
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
                {visibleGeminiStats.topClothingColors && visibleGeminiStats.topClothingColors.length > 0 && (
                  <div className="space-y-1">
                    <span className="text-xs font-medium text-muted-foreground">Clothing Colors</span>
                    <div className="flex flex-wrap gap-1">
                      {visibleGeminiStats.topClothingColors.slice(0, 6).map((c, i) => (
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
                {visibleGeminiStats.totalProcessed === 0 && !geminiLoading && !geminiConfig?.message && (
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

          {/* Reverse Image Search */}
          <motion.div variants={cardVariants}>
            <Card className="hover:shadow-lg hover:shadow-cyan-500/5 transition-shadow duration-300 border-cyan-500/20">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Search className="w-4 h-4 text-cyan-500" />
                    Reverse Image Search
                  </CardTitle>
                  {reverseSearchImage && (
                    <Button variant="ghost" size="sm" onClick={clearReverseSearch}>
                      <X className="w-3 h-3" />
                    </Button>
                  )}
                </div>
                <CardDescription className="text-xs">
                  Upload an image to find matching events
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {/* Upload Area */}
                {!reverseSearchImage && (
                  <div
                    className="border-2 border-dashed border-muted-foreground/30 rounded-lg p-4 text-center cursor-pointer hover:border-cyan-500/50 hover:bg-cyan-500/5 transition-all"
                    onClick={() => fileInputRef.current?.click()}
                    onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
                    onDrop={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      const file = e.dataTransfer.files?.[0];
                      if (file && fileInputRef.current) {
                        const dt = new DataTransfer();
                        dt.items.add(file);
                        fileInputRef.current.files = dt.files;
                        fileInputRef.current.dispatchEvent(new Event('change', { bubbles: true }));
                      }
                    }}
                  >
                    <Upload className="w-8 h-8 mx-auto text-muted-foreground mb-2" />
                    <p className="text-xs text-muted-foreground">
                      Drop an image here or click to upload
                    </p>
                    <p className="text-[10px] text-muted-foreground/70 mt-1">
                      Max 10MB • JPEG, PNG, WebP
                    </p>
                  </div>
                )}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleImageUpload}
                />

                {/* Image Preview */}
                {reverseSearchImage && (
                  <div className="space-y-3">
                    <div className="relative rounded-lg overflow-hidden border border-border">
                      <img
                        src={reverseSearchImage}
                        alt="Uploaded"
                        className="w-full h-24 object-cover"
                      />
                      {reverseSearchLoading && (
                        <div className="absolute inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center">
                          <div className="text-center">
                            <Loader2 className="w-6 h-6 animate-spin text-cyan-500 mx-auto mb-1" />
                            <p className="text-[10px] text-muted-foreground">Analyzing with Gemini AI...</p>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Error Display */}
                    {reverseSearchError && (
                      <div className="p-2 bg-red-500/10 border border-red-500/20 rounded-lg text-xs text-red-400 flex items-center gap-2">
                        <AlertCircle className="w-3 h-3" />
                        {reverseSearchError}
                      </div>
                    )}

                    {/* Extracted Features */}
                    {reverseSearchResults?.analysis && (
                      <div className="space-y-2">
                        <h4 className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                          <Target className="w-3 h-3" />
                          Extracted Features
                        </h4>
                        <div className="text-[10px] space-y-1 bg-muted/30 p-2 rounded-lg">
                          {reverseSearchResults.analysis.caption && (
                            <p className="text-muted-foreground line-clamp-2">{reverseSearchResults.analysis.caption}</p>
                          )}
                          <div className="flex flex-wrap gap-1 pt-1">
                            {reverseSearchResults.analysis.vehicles?.slice(0, 2).map((v: string, i: number) => (
                              <Badge key={i} variant="outline" className="text-[10px] bg-orange-500/10 text-orange-400 border-orange-500/30">
                                <Car className="w-2 h-2 mr-1" />
                                {v.slice(0, 20)}
                              </Badge>
                            ))}
                            {reverseSearchResults.analysis.licensePlates?.slice(0, 2).map((p: string, i: number) => (
                              <Badge key={`plate-${i}`} variant="outline" className="text-[10px] bg-blue-500/10 text-blue-400 border-blue-500/30">
                                {p}
                              </Badge>
                            ))}
                            {reverseSearchResults.analysis.peopleCount > 0 && (
                              <Badge variant="outline" className="text-[10px] bg-green-500/10 text-green-400 border-green-500/30">
                                <Users className="w-2 h-2 mr-1" />
                                {reverseSearchResults.analysis.peopleCount} people
                              </Badge>
                            )}
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Match Results */}
                    {reverseSearchResults?.matches && reverseSearchResults.matches.length > 0 && (
                      <div className="space-y-2">
                        <h4 className="text-xs font-medium text-muted-foreground flex items-center justify-between">
                          <span className="flex items-center gap-1">
                            <Target className="w-3 h-3 text-cyan-500" />
                            Matches Found
                          </span>
                          <Badge variant="outline" className="text-cyan-400 bg-cyan-500/10">
                            {reverseSearchResults.matches.length}
                          </Badge>
                        </h4>
                        <div className="max-h-48 overflow-y-auto space-y-1 pr-1 scrollbar-thin">
                          {reverseSearchResults.matches.slice(0, 10).map((match: any) => (
                            <div
                              key={match.id}
                              className="flex items-center gap-2 p-2 bg-muted/30 rounded-lg hover:bg-muted/50 cursor-pointer transition-colors"
                              onClick={() => handleMatchClick(match)}
                            >
                              {match.imageUrl && (
                                <img
                                  src={match.imageUrl}
                                  alt=""
                                  className="w-10 h-10 rounded object-cover flex-shrink-0"
                                />
                              )}
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center justify-between">
                                  <span className="text-[10px] font-medium truncate">
                                    Event #{match.eventId?.slice(-6) || match.id.slice(-6)}
                                  </span>
                                  <Badge
                                    className={`text-[10px] ${
                                      match.confidence >= 80 ? 'bg-green-500' :
                                      match.confidence >= 50 ? 'bg-yellow-500' :
                                      'bg-orange-500'
                                    } text-black`}
                                  >
                                    {match.confidence}%
                                  </Badge>
                                </div>
                                <div className="flex items-center gap-2 text-[9px] text-muted-foreground mt-0.5">
                                  {match.channelId && (
                                    <span className="flex items-center gap-0.5">
                                      <MapPin className="w-2 h-2" />
                                      {match.channelId.slice(0, 10)}
                                    </span>
                                  )}
                                  {match.timestamp && (
                                    <span className="flex items-center gap-0.5">
                                      <Clock className="w-2 h-2" />
                                      {new Date(match.timestamp).toLocaleDateString()}
                                    </span>
                                  )}
                                </div>
                                {match.matchReasons?.length > 0 && (
                                  <p className="text-[9px] text-cyan-400/80 truncate mt-0.5">
                                    {match.matchReasons[0]}
                                  </p>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>

                        {/* Apply to Graph Button */}
                        <Button
                          size="sm"
                          className="w-full bg-cyan-500 hover:bg-cyan-600 text-black"
                          onClick={applyMatchesToGraph}
                        >
                          <Target className="w-3 h-3 mr-1" />
                          Apply to Graph
                        </Button>
                      </div>
                    )}

                    {/* No matches message */}
                    {reverseSearchResults && reverseSearchResults.matches?.length === 0 && !reverseSearchLoading && (
                      <div className="text-center py-3 text-xs text-muted-foreground">
                        <Search className="w-6 h-6 mx-auto mb-2 opacity-50" />
                        No matching events found.
                        <br />
                        <span className="text-[10px]">Try uploading a different image.</span>
                      </div>
                    )}

                    {/* Stats */}
                    {reverseSearchResults?.stats && (
                      <div className="text-[10px] text-muted-foreground text-center pt-1 border-t border-border">
                        Processed in {reverseSearchResults.stats.processingTimeMs}ms • Model: {reverseSearchResults.stats.model}
                      </div>
                    )}
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
          onMouseDown={handleSelectionMouseDown}
          onMouseMove={handleSelectionMouseMove}
          onMouseUp={handleSelectionMouseUp}
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
            linkDirectionalParticles={graphData.links.length > 5000 ? 0 : 3}
            linkDirectionalParticleSpeed={0.004}
            linkDirectionalParticleWidth={2}
            linkDirectionalParticleColor={linkDirectionalParticleColor}
            onNodeClick={handleNodeClick}
            onNodeRightClick={handleNodeRightClick}
            onBackgroundClick={handleBackgroundClick}
            backgroundColor="#1F2937"
            linkColor={linkColor}
            linkWidth={graphData.links.length > 5000 ? 0.6 : 1.5}
            cooldownTicks={layout === "force" ? 100 : 0}
            warmupTicks={layout === "force" ? 100 : 0}
            onEngineStop={onEngineStop}
            nodeCanvasObject={nodeCanvasObject}
            nodePointerAreaPaint={nodePointerAreaPaint}
            enablePanInteraction={(event: any) => !(selectionBox?.active || event?.shiftKey)}
            enableZoomInteraction={(event: any) => !(selectionBox?.active || event?.shiftKey)}
          />

          <div className="absolute bottom-0 left-0 right-0 z-20 border-t border-border bg-card/80 backdrop-blur px-4 py-3">
            <div className="flex items-center gap-3">
              <Button
                size="sm"
                variant="outline"
                disabled={!canUseSlider}
                onClick={() => {
                  if (!canUseSlider) return;
                  setIsPlaying((prev) => !prev);
                }}
              >
                {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
              </Button>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-1">
                  <div className="text-xs text-muted-foreground truncate">{windowLabel}</div>
                  <div className="text-xs text-muted-foreground">Events: {displayStats.events}</div>
                </div>
                <Slider
                  value={sliderValue}
                  min={sliderMin}
                  max={sliderMax}
                  step={60 * 1000}
                  disabled={!canUseSlider}
                  onValueChange={handleSliderChange}
                  onValueCommit={handleSliderCommit}
                />
              </div>
            </div>
          </div>

          {selectionBox?.active && (
            <div
              className="absolute z-30 border border-cyan-400/80 bg-cyan-400/10 pointer-events-none"
              style={{
                left: Math.min(selectionBox.startX, selectionBox.endX),
                top: Math.min(selectionBox.startY, selectionBox.endY),
                width: Math.abs(selectionBox.endX - selectionBox.startX),
                height: Math.abs(selectionBox.endY - selectionBox.startY),
              }}
            />
          )}

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

        {/* Node Details Panel */}
        <NodeDetailsPanel
          node={detailsPanelNode}
          isOpen={isDetailsPanelOpen}
          onClose={handleCloseDetailsPanel}
        />
      </div>
    </div>
  );
}
