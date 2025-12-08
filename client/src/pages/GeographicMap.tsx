import { useState, useEffect, useCallback } from "react";
import { useLocation } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, MapPin, Camera, AlertTriangle, RefreshCw, Activity, Clock } from "lucide-react";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import { motion } from "framer-motion";
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
      </div>
    </div>
  );
}

