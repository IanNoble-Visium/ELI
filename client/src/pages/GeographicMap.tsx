import { useState, useEffect, useCallback } from "react";
import { useLocation } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, MapPin, Camera, AlertTriangle, RefreshCw, Activity, Clock, Eye, X, ChevronLeft, ChevronRight, Image, List } from "lucide-react";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import { motion, AnimatePresence } from "framer-motion";
import { format } from "date-fns";
import "leaflet/dist/leaflet.css";
import L from "leaflet";

// Staggered animation variants
const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
      delayChildren: 0.2,
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

// Fix for default marker icons in Leaflet
import icon from "leaflet/dist/images/marker-icon.png";
import iconShadow from "leaflet/dist/images/marker-shadow.png";

const DefaultIcon = L.icon({
  iconUrl: icon,
  shadowUrl: iconShadow,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
});

L.Marker.prototype.options.icon = DefaultIcon;

// Custom marker icons with animations
const createCustomIcon = (color: string, isAlert: boolean = false) => {
  const pulseAnimation = isAlert ? `
    @keyframes pulse-ring {
      0% { transform: scale(1); opacity: 1; }
      100% { transform: scale(2.5); opacity: 0; }
    }
  ` : '';

  const pulseRing = isAlert ? `
    <div style="
      position: absolute;
      width: 16px;
      height: 16px;
      border-radius: 50%;
      background-color: ${color};
      opacity: 0.4;
      animation: pulse-ring 1.5s ease-out infinite;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
    "></div>
  ` : '';

  return L.divIcon({
    className: 'custom-marker',
    html: `
      <style>${pulseAnimation}</style>
      <div style="position: relative; width: 16px; height: 16px;">
        ${pulseRing}
        <div style="
          position: absolute;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          background-color: ${color};
          width: 12px;
          height: 12px;
          border-radius: 50%;
          border: 2px solid white;
          box-shadow: 0 2px 8px rgba(0,0,0,0.4);
          transition: all 0.3s ease;
        "></div>
      </div>
    `,
    iconSize: [16, 16],
    iconAnchor: [8, 8],
  });
};

// Create larger hover icon
const createHoverIcon = (color: string) => {
  return L.divIcon({
    className: 'custom-marker-hover',
    html: `
      <div style="
        background-color: ${color};
        width: 18px;
        height: 18px;
        border-radius: 50%;
        border: 3px solid white;
        box-shadow: 0 4px 12px rgba(0,0,0,0.5), 0 0 20px ${color}40;
        transition: all 0.3s ease;
      "></div>
    `,
    iconSize: [18, 18],
    iconAnchor: [9, 9],
  });
};

const activeIcon = createCustomIcon("#10B981"); // Green
const inactiveIcon = createCustomIcon("#6B7280"); // Gray
const alertIcon = createCustomIcon("#D91023", true); // Peru Red with pulse

const activeHoverIcon = createHoverIcon("#10B981");
const inactiveHoverIcon = createHoverIcon("#6B7280");
const alertHoverIcon = createHoverIcon("#D91023");

interface CameraData {
  id: string;
  name: string;
  type: string;
  latitude: number;
  longitude: number;
  address: {
    country?: string;
    region?: string;
    city?: string;
    district?: string;
    street?: string;
  };
  status: "active" | "inactive" | "alert";
  lastEventTime: string;
  eventCount: number;
  alertCount: number;
  tags?: { id: number; name: string }[];
}

interface CameraStats {
  total: number;
  active: number;
  inactive: number;
  alert: number;
  byRegion: Record<string, number>;
}

// Event data interface for drill-down
interface EventSnapshot {
  id: string;
  type: string;
  path?: string;
  imageUrl?: string;
  cloudinaryPublicId?: string;
}

interface CameraEvent {
  id: string;
  eventId: string;
  topic: string;
  module: string;
  level: number;
  startTime: number;
  endTime?: number;
  receivedAt: string;
  snapshots?: EventSnapshot[];
  snapshotsCount: number;
  hasImages: boolean;
}

function MapController({ center, zoom }: { center: [number, number]; zoom: number }) {
  const map = useMap();
  useEffect(() => {
    map.setView(center, zoom);
  }, [center, zoom, map]);
  return null;
}

export default function GeographicMap() {
  const [, setLocation] = useLocation();
  const [cameras, setCameras] = useState<CameraData[]>([]);
  const [stats, setStats] = useState<CameraStats>({ total: 0, active: 0, inactive: 0, alert: 0, byRegion: {} });
  const [selectedCamera, setSelectedCamera] = useState<CameraData | null>(null);
  const [selectedRegion, setSelectedRegion] = useState("all");
  const [isLoading, setIsLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState(new Date());
  const [mapCenter, setMapCenter] = useState<[number, number]>([-9.19, -75.0152]); // Center of Peru
  const [mapZoom, setMapZoom] = useState(6);

  // Drill-down state
  const [showEventPanel, setShowEventPanel] = useState(false);
  const [cameraEvents, setCameraEvents] = useState<CameraEvent[]>([]);
  const [isLoadingEvents, setIsLoadingEvents] = useState(false);
  const [selectedEventForViewer, setSelectedEventForViewer] = useState<CameraEvent | null>(null);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);

  // Fetch real camera data
  const fetchCameras = useCallback(async () => {
    try {
      setIsLoading(true);
      const params = new URLSearchParams();
      if (selectedRegion !== "all") params.append("region", selectedRegion);
      params.append("limit", "500"); // Limit for performance
      
      const response = await fetch(`/api/data/cameras?${params}`, {
        credentials: "include",
      });
      
      if (!response.ok) throw new Error("Failed to fetch cameras");
      
      const data = await response.json();
      
      if (data.success) {
        setCameras(data.cameras);
        setStats(data.stats);
      }
      
      setLastRefresh(new Date());
    } catch (error) {
      console.error("[Map] Fetch error:", error);
      // Keep existing data on error
    } finally {
      setIsLoading(false);
    }
  }, [selectedRegion]);

  // Initial fetch
  useEffect(() => {
    fetchCameras();
  }, [fetchCameras]);

  // Get unique regions for filter
  const regions = Object.keys(stats.byRegion).sort();

  // Handle region selection
  const handleRegionChange = (region: string) => {
    setSelectedRegion(region);
    
    // Center map on selected region
    const regionCenters: Record<string, [number, number]> = {
      "Lima": [-12.0464, -77.0428],
      "Cusco": [-13.5320, -71.9675],
      "Arequipa": [-16.4090, -71.5375],
      "Trujillo": [-8.1116, -79.0288],
      "Piura": [-5.1945, -80.6328],
      "Chiclayo": [-6.7714, -79.8409],
      "Iquitos": [-3.7489, -73.2516],
      "Huancayo": [-12.0651, -75.2049],
      "Tacna": [-18.0146, -70.2536],
      "Puno": [-15.8402, -70.0219],
    };
    
    if (region !== "all" && regionCenters[region]) {
      setMapCenter(regionCenters[region]);
      setMapZoom(10);
    } else {
      setMapCenter([-9.19, -75.0152]);
      setMapZoom(6);
    }
  };

  // Helper function to check if an event has valid images
  const hasValidImages = (event: CameraEvent): boolean => {
    if (!event.snapshots || event.snapshots.length === 0) return false;
    return event.snapshots.some(snap => snap.imageUrl && snap.imageUrl.trim() !== '');
  };

  // Fetch events for a specific camera
  const fetchCameraEvents = useCallback(async (cameraId: string) => {
    try {
      setIsLoadingEvents(true);
      const response = await fetch(`/api/data/events?channelId=${cameraId}&limit=50`, {
        credentials: "include",
      });
      
      if (!response.ok) throw new Error("Failed to fetch events");
      
      const data = await response.json();
      
      if (data.success) {
        // Filter events: show only events with valid images, except critical events (level 3)
        const filteredEvents = (data.events || []).filter((event: CameraEvent) => {
          const isCritical = event.level === 3;
          return isCritical || hasValidImages(event);
        });
        setCameraEvents(filteredEvents);
      }
    } catch (error) {
      console.error("[Map] Fetch events error:", error);
      setCameraEvents([]);
    } finally {
      setIsLoadingEvents(false);
    }
  }, []);

  // Handle drill-down to camera events
  const handleViewEvents = (camera: CameraData) => {
    setSelectedCamera(camera);
    setShowEventPanel(true);
    fetchCameraEvents(camera.id);
  };

  // Close event panel
  const closeEventPanel = () => {
    setShowEventPanel(false);
    setCameraEvents([]);
    setSelectedEventForViewer(null);
  };

  // Open image viewer for an event
  const openImageViewer = (event: CameraEvent, imageIndex: number = 0) => {
    setSelectedEventForViewer(event);
    setCurrentImageIndex(imageIndex);
  };

  // Close image viewer
  const closeImageViewer = () => {
    setSelectedEventForViewer(null);
    setCurrentImageIndex(0);
  };

  // Navigate images
  const nextImage = () => {
    if (selectedEventForViewer?.snapshots) {
      setCurrentImageIndex((prev) => 
        prev < selectedEventForViewer.snapshots!.length - 1 ? prev + 1 : 0
      );
    }
  };

  const prevImage = () => {
    if (selectedEventForViewer?.snapshots) {
      setCurrentImageIndex((prev) => 
        prev > 0 ? prev - 1 : selectedEventForViewer.snapshots!.length - 1
      );
    }
  };

  // Get level info for event badges
  const getLevelInfo = (level: number) => {
    switch (level) {
      case 3: return { label: "Critical", color: "bg-red-600" };
      case 2: return { label: "High", color: "bg-orange-500" };
      case 1: return { label: "Medium", color: "bg-yellow-500" };
      default: return { label: "Low", color: "bg-blue-500" };
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
              Back
            </Button>
            <div>
              <h1 className="text-xl font-bold">Geographic Map</h1>
              <p className="text-xs text-muted-foreground">
                {stats.total.toLocaleString()} cameras across Peru • Real-time surveillance network
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <Select value={selectedRegion} onValueChange={handleRegionChange}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="All Regions" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Regions</SelectItem>
                {regions.map(region => (
                  <SelectItem key={region} value={region}>
                    {region} ({stats.byRegion[region]})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            
            <Button
              variant="outline"
              size="sm"
              onClick={fetchCameras}
              disabled={isLoading}
            >
              <RefreshCw className={`w-4 h-4 mr-2 ${isLoading ? "animate-spin" : ""}`} />
              Refresh
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
          className="w-80 border-r border-border bg-card/50 backdrop-blur p-4 space-y-4 overflow-y-auto"
        >
          <motion.div variants={cardVariants}>
            <Card className="hover:shadow-lg hover:shadow-primary/5 transition-shadow duration-300">
              <CardHeader className="pb-2">
                <CardTitle className="text-lg flex items-center gap-2">
                  Camera Status
                  <motion.div
                    className="w-2 h-2 bg-green-500 rounded-full"
                    animate={{ scale: [1, 1.2, 1], opacity: [1, 0.7, 1] }}
                    transition={{ duration: 2, repeat: Infinity }}
                  />
                </CardTitle>
                <CardDescription className="text-xs">
                  Last updated: {format(lastRefresh, "HH:mm:ss")}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <motion.div
                  className="flex items-center justify-between hover:bg-muted/30 p-1 rounded transition-colors"
                  whileHover={{ x: 4 }}
                >
                  <div className="flex items-center gap-2">
                    <Camera className="w-4 h-4 text-muted-foreground" />
                    <span className="text-sm">Total Cameras</span>
                  </div>
                  <Badge variant="outline" className="font-bold">{stats.total.toLocaleString()}</Badge>
                </motion.div>
                <motion.div
                  className="flex items-center justify-between hover:bg-muted/30 p-1 rounded transition-colors"
                  whileHover={{ x: 4 }}
                >
                  <div className="flex items-center gap-2">
                    <motion.div
                      className="w-3 h-3 rounded-full bg-green-500"
                      animate={{ scale: [1, 1.1, 1] }}
                      transition={{ duration: 2, repeat: Infinity }}
                    />
                    <span className="text-sm">Active</span>
                  </div>
                  <Badge variant="outline" className="bg-green-500/10 text-green-500 border-green-500/20">
                    {stats.active.toLocaleString()}
                  </Badge>
                </motion.div>
                <motion.div
                  className="flex items-center justify-between hover:bg-muted/30 p-1 rounded transition-colors"
                  whileHover={{ x: 4 }}
                >
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-gray-500" />
                    <span className="text-sm">Inactive</span>
                  </div>
                  <Badge variant="outline" className="bg-gray-500/10 text-gray-500 border-gray-500/20">
                    {stats.inactive.toLocaleString()}
                  </Badge>
                </motion.div>
                <motion.div
                  className="flex items-center justify-between hover:bg-muted/30 p-1 rounded transition-colors"
                  whileHover={{ x: 4 }}
                >
                  <div className="flex items-center gap-2">
                    <motion.div
                      animate={{ scale: [1, 1.2, 1] }}
                      transition={{ duration: 1, repeat: Infinity }}
                    >
                      <AlertTriangle className="w-4 h-4 text-primary" />
                    </motion.div>
                    <span className="text-sm">Alerts</span>
                  </div>
                  <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20">
                    {stats.alert.toLocaleString()}
                  </Badge>
                </motion.div>
              </CardContent>
            </Card>
          </motion.div>

          {/* Region Distribution */}
          <motion.div variants={cardVariants}>
            <Card className="hover:shadow-lg hover:shadow-primary/5 transition-shadow duration-300">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Regional Distribution</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {Object.entries(stats.byRegion)
                  .sort((a, b) => b[1] - a[1])
                  .slice(0, 8)
                  .map(([region, count], index) => (
                    <motion.div
                      key={region}
                      className="flex items-center justify-between text-sm hover:bg-muted/30 p-1 rounded transition-colors cursor-pointer"
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: index * 0.05 }}
                      whileHover={{ x: 4 }}
                    >
                      <span className="text-muted-foreground">{region}</span>
                      <span className="font-mono">{count}</span>
                    </motion.div>
                  ))}
              </CardContent>
            </Card>
          </motion.div>

          {selectedCamera && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
            >
              <Card className="border-primary/50">
                <CardHeader className="pb-2">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Camera className="w-4 h-4" />
                    Camera Details
                  </CardTitle>
                  <CardDescription>{selectedCamera.name}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">ID</span>
                    <span className="text-sm font-mono">{selectedCamera.id}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Region</span>
                    <span className="text-sm font-medium">{selectedCamera.address.region || selectedCamera.address.city}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Status</span>
                    <Badge variant={selectedCamera.status === "active" ? "default" : selectedCamera.status === "alert" ? "destructive" : "secondary"}>
                      {selectedCamera.status}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Coordinates</span>
                    <span className="text-xs font-mono">
                      {selectedCamera.latitude.toFixed(4)}, {selectedCamera.longitude.toFixed(4)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground flex items-center gap-1">
                      <Activity className="w-3 h-3" /> Events
                    </span>
                    <span className="text-sm font-medium">{selectedCamera.eventCount}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground flex items-center gap-1">
                      <Clock className="w-3 h-3" /> Last Event
                    </span>
                    <span className="text-xs font-mono">
                      {(() => {
                        try {
                          const date = new Date(selectedCamera.lastEventTime);
                          if (isNaN(date.getTime())) return "N/A";
                          return format(date, "MM/dd HH:mm");
                        } catch {
                          return "N/A";
                        }
                      })()}
                    </span>
                  </div>
                  {selectedCamera.status === "alert" && (
                    <div className="p-2 bg-primary/10 border border-primary/20 rounded-md">
                      <div className="flex items-center gap-2 text-primary">
                        <AlertTriangle className="w-4 h-4" />
                        <span className="text-sm font-medium">{selectedCamera.alertCount} Active Alert(s)</span>
                      </div>
                    </div>
                  )}
                  {selectedCamera.address.street && (
                    <div className="flex items-start gap-2 pt-2 border-t border-border">
                      <MapPin className="w-4 h-4 text-muted-foreground mt-0.5" />
                      <div className="text-xs text-muted-foreground">
                        {selectedCamera.address.street}
                        {selectedCamera.address.district && `, ${selectedCamera.address.district}`}
                        {selectedCamera.address.city && `, ${selectedCamera.address.city}`}
                      </div>
                    </div>
                  )}
                  
                  {/* Drill-down button */}
                  {selectedCamera.eventCount > 0 && (
                    <Button
                      className="w-full mt-3"
                      onClick={() => handleViewEvents(selectedCamera)}
                    >
                      <List className="w-4 h-4 mr-2" />
                      View {selectedCamera.eventCount} Event{selectedCamera.eventCount !== 1 ? 's' : ''}
                    </Button>
                  )}
                </CardContent>
              </Card>
            </motion.div>
          )}

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Legend</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-green-500 border-2 border-white" />
                <span className="text-xs">Active Camera</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-gray-500 border-2 border-white" />
                <span className="text-xs">Inactive Camera</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-primary border-2 border-white" />
                <span className="text-xs">Alert Active</span>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Map */}
        <div className="flex-1 relative">
          {isLoading && cameras.length === 0 ? (
            <div className="absolute inset-0 bg-background/80 backdrop-blur z-10 flex flex-col items-center justify-center">
              <div className="relative w-64 h-64 mb-6">
                {/* Map skeleton with animated elements */}
                <Skeleton className="absolute inset-0 rounded-lg" />
                <div className="absolute inset-4 border-2 border-dashed border-muted-foreground/20 rounded-lg" />
                {/* Animated pulsing dots representing camera locations */}
                <div className="absolute top-1/4 left-1/3 w-3 h-3 bg-primary/50 rounded-full animate-pulse" />
                <div className="absolute top-1/2 left-1/2 w-3 h-3 bg-green-500/50 rounded-full animate-pulse" style={{ animationDelay: '0.2s' }} />
                <div className="absolute top-2/3 left-1/4 w-3 h-3 bg-green-500/50 rounded-full animate-pulse" style={{ animationDelay: '0.4s' }} />
                <div className="absolute top-1/3 right-1/4 w-3 h-3 bg-green-500/50 rounded-full animate-pulse" style={{ animationDelay: '0.6s' }} />
              </div>
              <div className="flex items-center gap-2 text-muted-foreground">
                <RefreshCw className="w-5 h-5 animate-spin" />
                <span className="text-sm font-medium">Loading surveillance network...</span>
              </div>
              <p className="text-xs text-muted-foreground mt-2">Fetching {stats.total.toLocaleString()} camera locations</p>
            </div>
          ) : isLoading && (
            <div className="absolute top-4 left-1/2 -translate-x-1/2 z-10 bg-card/90 backdrop-blur px-4 py-2 rounded-full flex items-center gap-2">
              <RefreshCw className="w-4 h-4 animate-spin" />
              <span className="text-sm">Refreshing cameras...</span>
            </div>
          )}
          <MapContainer
            center={mapCenter}
            zoom={mapZoom}
            style={{ height: "100%", width: "100%" }}
            className="z-0"
          >
            <MapController center={mapCenter} zoom={mapZoom} />
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            {cameras.map((camera) => (
              <Marker
                key={camera.id}
                position={[camera.latitude, camera.longitude]}
                icon={camera.status === "alert" ? alertIcon : camera.status === "active" ? activeIcon : inactiveIcon}
                eventHandlers={{
                  click: () => setSelectedCamera(camera),
                }}
              >
                <Popup>
                  <div className="text-sm min-w-[150px]">
                    <div className="font-semibold">{camera.name}</div>
                    <div className="text-xs text-gray-600">{camera.address.region || camera.address.city}</div>
                    <div className="text-xs mt-1">
                      Status: <span className={
                        camera.status === "active" ? "text-green-600" : 
                        camera.status === "alert" ? "text-red-600" : "text-gray-600"
                      }>
                        {camera.status}
                      </span>
                    </div>
                    <div className="text-xs text-gray-500 mt-1">
                      Events: {camera.eventCount}
                    </div>
                  </div>
                </Popup>
              </Marker>
            ))}
          </MapContainer>
        </div>

        {/* Event Panel Slide-out */}
        <AnimatePresence>
          {showEventPanel && selectedCamera && (
            <motion.div
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 200 }}
              className="absolute top-0 right-0 h-full w-[450px] bg-card border-l border-border shadow-2xl z-30 overflow-hidden flex flex-col"
            >
              {/* Panel Header */}
              <div className="p-4 border-b border-border bg-card/95 backdrop-blur">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={closeEventPanel}
                      className="hover:bg-muted"
                    >
                      <ArrowLeft className="w-4 h-4" />
                    </Button>
                    <div>
                      <h3 className="font-semibold text-lg">Camera Events</h3>
                      <p className="text-sm text-muted-foreground truncate max-w-[280px]">
                        {selectedCamera.name}
                      </p>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={closeEventPanel}
                    className="hover:bg-muted"
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>
                <div className="flex items-center gap-2 mt-3">
                  <Badge variant="outline" className="text-xs">
                    <MapPin className="w-3 h-3 mr-1" />
                    {selectedCamera.address.region || selectedCamera.address.city}
                  </Badge>
                  <Badge variant="outline" className="text-xs">
                    <Activity className="w-3 h-3 mr-1" />
                    {cameraEvents.length} events loaded
                  </Badge>
                </div>
              </div>

              {/* Events List */}
              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {isLoadingEvents ? (
                  <div className="flex flex-col items-center justify-center py-12">
                    <RefreshCw className="w-8 h-8 animate-spin text-muted-foreground mb-3" />
                    <p className="text-sm text-muted-foreground">Loading events...</p>
                  </div>
                ) : cameraEvents.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 text-center">
                    <Camera className="w-12 h-12 text-muted-foreground/50 mb-3" />
                    <p className="text-sm text-muted-foreground">No events found for this camera</p>
                  </div>
                ) : (
                  cameraEvents.map((event, index) => {
                    const levelInfo = getLevelInfo(event.level);
                    return (
                      <motion.div
                        key={event.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: index * 0.03 }}
                      >
                        <Card className="hover:shadow-md transition-shadow">
                          <CardContent className="p-3">
                            {/* Event Header */}
                            <div className="flex items-start justify-between mb-2">
                              <div className="flex items-center gap-2">
                                <Badge className={`${levelInfo.color} text-white text-xs`}>
                                  {levelInfo.label}
                                </Badge>
                                <span className="text-sm font-medium">{event.topic}</span>
                              </div>
                              <span className="text-xs text-muted-foreground">
                                {(() => {
                                  try {
                                    const date = new Date(event.startTime);
                                    if (isNaN(date.getTime())) return "N/A";
                                    return format(date, "MM/dd HH:mm:ss");
                                  } catch {
                                    return "N/A";
                                  }
                                })()}
                              </span>
                            </div>

                            {/* Event Details */}
                            <div className="text-xs text-muted-foreground mb-2">
                              <span>Module: {event.module}</span>
                              <span className="mx-2">•</span>
                              <span>ID: {event.eventId.substring(0, 12)}...</span>
                            </div>

                            {/* Image Thumbnails */}
                            {event.hasImages && event.snapshots && event.snapshots.length > 0 && (
                              <div className="mt-2">
                                <div className="flex items-center gap-2">
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => openImageViewer(event, 0)}
                                    className="h-7 px-2 text-xs"
                                  >
                                    <Eye className="w-3 h-3 mr-1" />
                                    View {event.snapshotsCount} Image{event.snapshotsCount > 1 ? 's' : ''}
                                  </Button>
                                </div>
                                <div className="flex gap-1 mt-2 overflow-x-auto pb-1">
                                  {event.snapshots.slice(0, 4).map((snapshot, idx) => (
                                    <div
                                      key={snapshot.id}
                                      className="flex-shrink-0 w-16 h-12 rounded cursor-pointer hover:opacity-80 transition-opacity border border-border overflow-hidden"
                                      onClick={() => openImageViewer(event, idx)}
                                    >
                                      {snapshot.imageUrl ? (
                                        <img
                                          src={snapshot.imageUrl}
                                          alt={`Snapshot ${idx + 1}`}
                                          className="w-full h-full object-cover"
                                        />
                                      ) : (
                                        <div className="w-full h-full bg-muted flex items-center justify-center">
                                          <Image className="w-4 h-4 text-muted-foreground" />
                                        </div>
                                      )}
                                    </div>
                                  ))}
                                  {event.snapshots.length > 4 && (
                                    <div
                                      className="flex-shrink-0 w-16 h-12 rounded bg-muted flex items-center justify-center text-xs text-muted-foreground cursor-pointer hover:bg-muted/80"
                                      onClick={() => openImageViewer(event, 4)}
                                    >
                                      +{event.snapshots.length - 4}
                                    </div>
                                  )}
                                </div>
                              </div>
                            )}

                            {/* No images indicator */}
                            {!event.hasImages && (
                              <div className="flex items-center gap-1 text-xs text-muted-foreground mt-2">
                                <Image className="w-3 h-3" />
                                <span>No images</span>
                              </div>
                            )}
                          </CardContent>
                        </Card>
                      </motion.div>
                    );
                  })
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Image Viewer Modal */}
        <AnimatePresence>
          {selectedEventForViewer && selectedEventForViewer.snapshots && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4"
              onClick={closeImageViewer}
            >
              <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.9, opacity: 0 }}
                className="relative max-w-5xl max-h-[90vh] bg-background rounded-lg overflow-hidden"
                onClick={(e) => e.stopPropagation()}
              >
                {/* Modal Header */}
                <div className="flex items-center justify-between p-4 border-b border-border">
                  <div>
                    <h3 className="text-lg font-semibold">{selectedEventForViewer.topic} Event</h3>
                    <p className="text-sm text-muted-foreground">
                      {selectedCamera?.name} • {(() => {
                        try {
                          const date = new Date(selectedEventForViewer.startTime);
                          if (isNaN(date.getTime())) return "N/A";
                          return format(date, "MMM dd, HH:mm:ss");
                        } catch {
                          return "N/A";
                        }
                      })()}
                    </p>
                  </div>
                  <Button variant="ghost" size="icon" onClick={closeImageViewer}>
                    <X className="w-5 h-5" />
                  </Button>
                </div>

                {/* Image Display */}
                <div className="relative p-4">
                  <div className="flex items-center justify-center min-h-[400px]">
                    {selectedEventForViewer.snapshots[currentImageIndex]?.imageUrl ? (
                      <img
                        src={selectedEventForViewer.snapshots[currentImageIndex].imageUrl}
                        alt={`Event snapshot ${currentImageIndex + 1}`}
                        className="max-w-full max-h-[60vh] object-contain rounded"
                      />
                    ) : (
                      <div className="w-96 h-64 bg-muted rounded flex items-center justify-center">
                        <Image className="w-16 h-16 text-muted-foreground" />
                      </div>
                    )}
                  </div>

                  {/* Navigation Arrows */}
                  {selectedEventForViewer.snapshots.length > 1 && (
                    <>
                      <Button
                        variant="outline"
                        size="icon"
                        className="absolute left-6 top-1/2 -translate-y-1/2"
                        onClick={prevImage}
                      >
                        <ChevronLeft className="w-5 h-5" />
                      </Button>
                      <Button
                        variant="outline"
                        size="icon"
                        className="absolute right-6 top-1/2 -translate-y-1/2"
                        onClick={nextImage}
                      >
                        <ChevronRight className="w-5 h-5" />
                      </Button>
                    </>
                  )}
                </div>

                {/* Thumbnail Strip */}
                {selectedEventForViewer.snapshots.length > 1 && (
                  <div className="p-4 border-t border-border">
                    <div className="flex items-center justify-center gap-2">
                      <span className="text-sm text-muted-foreground mr-2">
                        {currentImageIndex + 1} / {selectedEventForViewer.snapshots.length}
                      </span>
                      <div className="flex gap-2 overflow-x-auto max-w-[600px] pb-1">
                        {selectedEventForViewer.snapshots.map((snapshot, index) => (
                          <div
                            key={snapshot.id}
                            className={`flex-shrink-0 w-16 h-12 rounded cursor-pointer border-2 transition-all overflow-hidden ${
                              index === currentImageIndex
                                ? 'border-primary'
                                : 'border-transparent hover:border-border'
                            }`}
                            onClick={() => setCurrentImageIndex(index)}
                          >
                            {snapshot.imageUrl ? (
                              <img
                                src={snapshot.imageUrl}
                                alt={`Thumbnail ${index + 1}`}
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <div className="w-full h-full bg-muted flex items-center justify-center">
                                <Image className="w-4 h-4 text-muted-foreground" />
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

