import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, MapPin, Camera, AlertTriangle } from "lucide-react";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import { motion } from "framer-motion";
import "leaflet/dist/leaflet.css";
import L from "leaflet";

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

// Custom marker icons
const createCustomIcon = (color: string) => {
  return L.divIcon({
    className: 'custom-marker',
    html: `<div style="background-color: ${color}; width: 12px; height: 12px; border-radius: 50%; border: 2px solid white; box-shadow: 0 2px 4px rgba(0,0,0,0.3);"></div>`,
    iconSize: [12, 12],
    iconAnchor: [6, 6],
  });
};

const activeIcon = createCustomIcon("#10B981"); // Green
const inactiveIcon = createCustomIcon("#6B7280"); // Gray
const alertIcon = createCustomIcon("#D91023"); // Peru Red

// Mock camera data for Peru (will be replaced with real data)
const generateMockCameras = () => {
  const cameras: any[] = [];
  const peruRegions = [
    { name: "Lima", lat: -12.0464, lng: -77.0428, count: 842 },
    { name: "Cusco", lat: -13.5319, lng: -71.9675, count: 324 },
    { name: "Arequipa", lat: -16.4090, lng: -71.5375, count: 298 },
    { name: "Trujillo", lat: -8.1116, lng: -79.0288, count: 215 },
    { name: "Piura", lat: -5.1945, lng: -80.6328, count: 187 },
    { name: "Chiclayo", lat: -6.7714, lng: -79.8411, count: 156 },
    { name: "Iquitos", lat: -3.7437, lng: -73.2516, count: 142 },
    { name: "Huancayo", lat: -12.0653, lng: -75.2049, count: 128 },
  ];

  peruRegions.forEach((region) => {
    for (let i = 0; i < Math.min(region.count, 50); i++) {
      // Show max 50 markers per region for performance
      cameras.push({
        id: `${region.name}-${i}`,
        name: `Camera ${region.name}-${i + 1}`,
        lat: region.lat + (Math.random() - 0.5) * 0.5,
        lng: region.lng + (Math.random() - 0.5) * 0.5,
        region: region.name,
        status: Math.random() > 0.1 ? "active" : "inactive",
        hasAlert: Math.random() > 0.9,
        lastEvent: new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000).toISOString(),
      });
    }
  });

  return cameras;
};

function MapController({ center }: { center: [number, number] }) {
  const map = useMap();
  useEffect(() => {
    map.setView(center, 6);
  }, [center, map]);
  return null;
}

export default function GeographicMap() {
  const [, setLocation] = useLocation();
  const [cameras] = useState(generateMockCameras());
  const [selectedCamera, setSelectedCamera] = useState<any>(null);
  const [mapCenter, setMapCenter] = useState<[number, number]>([-9.19, -75.0152]); // Center of Peru

  const stats = {
    total: 3084,
    active: cameras.filter(c => c.status === "active").length,
    inactive: cameras.filter(c => c.status === "inactive").length,
    alerts: cameras.filter(c => c.hasAlert).length,
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
              <p className="text-xs text-muted-foreground">3,084 cameras across Peru</p>
            </div>
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
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Camera Status</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Camera className="w-4 h-4 text-muted-foreground" />
                  <span className="text-sm">Total Cameras</span>
                </div>
                <Badge variant="outline">{stats.total.toLocaleString()}</Badge>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-green-500" />
                  <span className="text-sm">Active</span>
                </div>
                <Badge variant="outline" className="bg-green-500/10 text-green-500 border-green-500/20">
                  {stats.active}
                </Badge>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-gray-500" />
                  <span className="text-sm">Inactive</span>
                </div>
                <Badge variant="outline" className="bg-gray-500/10 text-gray-500 border-gray-500/20">
                  {stats.inactive}
                </Badge>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-primary" />
                  <span className="text-sm">Alerts</span>
                </div>
                <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20">
                  {stats.alerts}
                </Badge>
              </div>
            </CardContent>
          </Card>

          {selectedCamera && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
            >
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Camera Details</CardTitle>
                  <CardDescription>{selectedCamera.name}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Region</span>
                    <span className="text-sm font-medium">{selectedCamera.region}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Status</span>
                    <Badge variant={selectedCamera.status === "active" ? "default" : "secondary"}>
                      {selectedCamera.status}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Coordinates</span>
                    <span className="text-xs font-mono">
                      {selectedCamera.lat.toFixed(4)}, {selectedCamera.lng.toFixed(4)}
                    </span>
                  </div>
                  {selectedCamera.hasAlert && (
                    <div className="p-2 bg-primary/10 border border-primary/20 rounded-md">
                      <div className="flex items-center gap-2 text-primary">
                        <AlertTriangle className="w-4 h-4" />
                        <span className="text-sm font-medium">Active Alert</span>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </motion.div>
          )}

          <Card>
            <CardHeader>
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
          <MapContainer
            center={mapCenter}
            zoom={6}
            style={{ height: "100%", width: "100%" }}
            className="z-0"
          >
            <MapController center={mapCenter} />
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            {cameras.map((camera) => (
              <Marker
                key={camera.id}
                position={[camera.lat, camera.lng]}
                icon={camera.hasAlert ? alertIcon : camera.status === "active" ? activeIcon : inactiveIcon}
                eventHandlers={{
                  click: () => setSelectedCamera(camera),
                }}
              >
                <Popup>
                  <div className="text-sm">
                    <div className="font-semibold">{camera.name}</div>
                    <div className="text-xs text-gray-600">{camera.region}</div>
                    <div className="text-xs mt-1">
                      Status: <span className={camera.status === "active" ? "text-green-600" : "text-gray-600"}>
                        {camera.status}
                      </span>
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
