import { useState, useEffect, useMemo } from "react";
import { useLocation } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft, Users, Car, MapPin, Activity, Camera, Clock, AlertTriangle } from "lucide-react";
import { motion } from "framer-motion";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { format, subDays, subHours } from "date-fns";

// Peru regions with real camera locations (used to assign POLE incidents)
const PERU_REGIONS = [
  { name: "Lima", cameras: 850, lat: -12.0464, lng: -77.0428 },
  { name: "Cusco", cameras: 320, lat: -13.5320, lng: -71.9675 },
  { name: "Arequipa", cameras: 280, lat: -16.4090, lng: -71.5375 },
  { name: "Trujillo", cameras: 240, lat: -8.1116, lng: -79.0288 },
  { name: "Piura", cameras: 200, lat: -5.1945, lng: -80.6328 },
  { name: "Chiclayo", cameras: 180, lat: -6.7714, lng: -79.8409 },
  { name: "Huancayo", cameras: 140, lat: -12.0651, lng: -75.2049 },
];

// Generate realistic POLE mock data assigned to real cameras
const generatePOLEData = () => {
  const now = new Date();
  
  // Generate tracked persons (suspicious individuals on watch lists)
  const people = Array.from({ length: 12 }, (_, i) => {
    const region = PERU_REGIONS[Math.floor(Math.random() * PERU_REGIONS.length)];
    const cameraId = Math.floor(Math.random() * region.cameras) + 1;
    return {
      id: `POI-${String(i + 1).padStart(4, "0")}`,
      name: `Subject ${String.fromCharCode(65 + i)}`, // Person A, B, C, etc.
      appearances: Math.floor(Math.random() * 50) + 5,
      locations: Math.floor(Math.random() * 15) + 1,
      associations: Math.floor(Math.random() * 10),
      riskLevel: ["high", "medium", "low"][Math.floor(Math.random() * 3)] as "high" | "medium" | "low",
      region: region.name,
      lastSeen: format(subHours(now, Math.floor(Math.random() * 72)), "yyyy-MM-dd HH:mm"),
      camera: `CAM-${region.name.substring(0, 3).toUpperCase()}-${String(cameraId).padStart(4, "0")}`,
    };
  });

  // Generate tracked vehicles
  const vehiclePlates = ["ABC-123", "XYZ-789", "DEF-456", "GHI-012", "JKL-345", "MNO-678", "PQR-901", "STU-234"];
  const vehicleTypes = ["Toyota Corolla", "Honda Civic", "Nissan Sentra", "Hyundai Accent", "Kia Rio", "Suzuki Swift"];
  
  const objects = Array.from({ length: 8 }, (_, i) => {
    const region = PERU_REGIONS[Math.floor(Math.random() * PERU_REGIONS.length)];
    const cameraId = Math.floor(Math.random() * region.cameras) + 1;
    return {
      id: `VEH-${String(i + 1).padStart(4, "0")}`,
      type: "Vehicle",
      plate: vehiclePlates[i],
      description: `${vehicleTypes[Math.floor(Math.random() * vehicleTypes.length)]} - ${vehiclePlates[i]}`,
      appearances: Math.floor(Math.random() * 40) + 5,
      locations: Math.floor(Math.random() * 20) + 2,
      region: region.name,
      lastSeen: format(subHours(now, Math.floor(Math.random() * 48)), "yyyy-MM-dd HH:mm"),
      camera: `CAM-${region.name.substring(0, 3).toUpperCase()}-${String(cameraId).padStart(4, "0")}`,
      flagged: Math.random() > 0.7,
    };
  });

  // Generate key locations (based on real camera regions)
  const locations = PERU_REGIONS.slice(0, 6).map((region, i) => ({
    id: `LOC-${String(i + 1).padStart(4, "0")}`,
    name: `${region.name} Central Zone`,
    region: region.name,
    cameras: Math.floor(region.cameras * 0.3), // 30% in central zone
    events: Math.floor(Math.random() * 100) + 20,
    people: Math.floor(Math.random() * 50) + 10,
    vehicles: Math.floor(Math.random() * 30) + 5,
    coordinates: { lat: region.lat, lng: region.lng },
    riskScore: Math.floor(Math.random() * 100),
  }));

  // Generate recent POLE events (assigned to real cameras)
  const eventTypes = ["Intrusion", "Loitering", "Vehicle Match", "Person Match", "Suspicious Activity", "Crowd Formation"];
  const events = Array.from({ length: 15 }, (_, i) => {
    const region = PERU_REGIONS[Math.floor(Math.random() * PERU_REGIONS.length)];
    const cameraId = Math.floor(Math.random() * region.cameras) + 1;
    const eventTime = subHours(now, Math.floor(Math.random() * 48));
    return {
      id: `EVT-${String(i + 1).padStart(4, "0")}`,
      type: eventTypes[Math.floor(Math.random() * eventTypes.length)],
      timestamp: format(eventTime, "yyyy-MM-dd HH:mm"),
      location: region.name,
      camera: `CAM-${region.name.substring(0, 3).toUpperCase()}-${String(cameraId).padStart(4, "0")}`,
      people: Math.floor(Math.random() * 5),
      objects: Math.floor(Math.random() * 3),
      priority: ["Critical", "High", "Medium", "Low"][Math.floor(Math.random() * 4)],
      status: ["Open", "Investigating", "Resolved"][Math.floor(Math.random() * 3)],
    };
  }).sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  return { people, objects, locations, events };
};

// Generate timeline data
const generateTimelineData = () => {
  const data = [];
  const now = new Date();
  for (let i = 6; i >= 0; i--) {
    const date = subDays(now, i);
    data.push({
      date: format(date, "MMM dd"),
      people: Math.floor(Math.random() * 40) + 30,
      objects: Math.floor(Math.random() * 25) + 15,
      events: Math.floor(Math.random() * 60) + 40,
    });
  }
  return data;
};

export default function POLEAnalytics() {
  const [, setLocation] = useLocation();
  const [selectedEntity, setSelectedEntity] = useState<any>(null);
  
  // Generate POLE data (memoized to prevent regeneration on re-renders)
  const poleData = useMemo(() => generatePOLEData(), []);
  const timelineData = useMemo(() => generateTimelineData(), []);

  // Pattern recognition stats
  const patternData = [
    { pattern: "Repeat Offenders", count: poleData.people.filter(p => p.appearances > 20).length, trend: "up" as const },
    { pattern: "Vehicle Associations", count: poleData.objects.filter(o => o.flagged).length, trend: "up" as const },
    { pattern: "High-Risk Zones", count: poleData.locations.filter(l => l.riskScore > 70).length, trend: "stable" as const },
    { pattern: "Active Cases", count: poleData.events.filter(e => e.status !== "Resolved").length, trend: "down" as const },
  ];

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
    };
    return colors[status] || "bg-gray-500";
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
              <h1 className="text-xl font-bold">POLE Analytics</h1>
              <p className="text-xs text-muted-foreground">
                People, Objects, Locations, Events • Demo data on real camera network
              </p>
            </div>
          </div>
          <Badge variant="outline" className="text-xs">
            <AlertTriangle className="w-3 h-3 mr-1" />
            Simulated Crime Data
          </Badge>
        </div>
      </header>

      {/* Main Content */}
      <main className="container py-8 space-y-8">
        {/* Stats Overview */}
        <div className="grid md:grid-cols-4 gap-6">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0, duration: 0.4 }}>
            <Card className="hover:border-primary/50 transition-all">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">People of Interest</CardTitle>
                <Users className="w-4 h-4 text-blue-500" />
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">{poleData.people.length}</div>
                <p className="text-xs text-muted-foreground">
                  {poleData.people.filter(p => p.riskLevel === "high").length} high-risk
                </p>
              </CardContent>
            </Card>
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1, duration: 0.4 }}>
            <Card className="hover:border-primary/50 transition-all">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Tracked Vehicles</CardTitle>
                <Car className="w-4 h-4 text-orange-500" />
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">{poleData.objects.length}</div>
                <p className="text-xs text-muted-foreground">
                  {poleData.objects.filter(o => o.flagged).length} flagged
                </p>
              </CardContent>
            </Card>
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2, duration: 0.4 }}>
            <Card className="hover:border-primary/50 transition-all">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Watch Zones</CardTitle>
                <MapPin className="w-4 h-4 text-purple-500" />
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">{poleData.locations.length}</div>
                <p className="text-xs text-muted-foreground">
                  {poleData.locations.reduce((a, b) => a + b.cameras, 0)} cameras
                </p>
              </CardContent>
            </Card>
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3, duration: 0.4 }}>
            <Card className="hover:border-primary/50 transition-all">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Active Cases</CardTitle>
                <Activity className="w-4 h-4 text-primary" />
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">{poleData.events.filter(e => e.status !== "Resolved").length}</div>
                <p className="text-xs text-muted-foreground">
                  {poleData.events.filter(e => e.priority === "Critical").length} critical
                </p>
              </CardContent>
            </Card>
          </motion.div>
        </div>

        {/* Timeline Chart */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4, duration: 0.4 }}>
          <Card>
            <CardHeader>
              <CardTitle>Activity Timeline</CardTitle>
              <CardDescription>POLE entity activity over the last 7 days</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={timelineData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                  <XAxis dataKey="date" stroke="#9CA3AF" />
                  <YAxis stroke="#9CA3AF" />
                  <Tooltip contentStyle={{ backgroundColor: "#374151", border: "1px solid #4B5563" }} labelStyle={{ color: "#F9FAFB" }} />
                  <Legend />
                  <Line type="monotone" dataKey="people" stroke="#3B82F6" strokeWidth={2} name="People" />
                  <Line type="monotone" dataKey="objects" stroke="#F59E0B" strokeWidth={2} name="Vehicles" />
                  <Line type="monotone" dataKey="events" stroke="#D91023" strokeWidth={2} name="Events" />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </motion.div>

        {/* POLE Tabs */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5, duration: 0.4 }}>
          <Tabs defaultValue="people" className="space-y-4">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="people">People ({poleData.people.length})</TabsTrigger>
              <TabsTrigger value="objects">Vehicles ({poleData.objects.length})</TabsTrigger>
              <TabsTrigger value="locations">Zones ({poleData.locations.length})</TabsTrigger>
              <TabsTrigger value="events">Events ({poleData.events.length})</TabsTrigger>
            </TabsList>

            <TabsContent value="people" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>People of Interest</CardTitle>
                  <CardDescription>Individuals on watch lists detected by surveillance cameras</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {poleData.people.map((person) => (
                      <div
                        key={person.id}
                        className="flex items-center justify-between p-3 border border-border rounded-lg hover:border-primary/50 cursor-pointer transition-all"
                        onClick={() => setSelectedEntity(person)}
                      >
                        <div className="flex items-center gap-3">
                          <div className={`w-2 h-2 rounded-full ${getRiskColor(person.riskLevel)}`} />
                          <div>
                            <div className="font-semibold">{person.name}</div>
                            <div className="text-xs text-muted-foreground flex items-center gap-2">
                              <span>{person.id}</span>
                              <span>•</span>
                              <Camera className="w-3 h-3" />
                              <span>{person.camera}</span>
                              <span>•</span>
                              <span>{person.region}</span>
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-4">
                          <div className="text-sm text-right">
                            <div>{person.appearances} sightings</div>
                            <div className="text-xs text-muted-foreground">{person.locations} locations</div>
                          </div>
                          <Badge className={`${getRiskColor(person.riskLevel)} text-white`}>
                            {person.riskLevel}
                          </Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="objects" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Tracked Vehicles</CardTitle>
                  <CardDescription>Vehicles on watch lists detected by license plate recognition</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {poleData.objects.map((object) => (
                      <div
                        key={object.id}
                        className="flex items-center justify-between p-3 border border-border rounded-lg hover:border-primary/50 cursor-pointer transition-all"
                      >
                        <div className="flex items-center gap-3">
                          {object.flagged && <AlertTriangle className="w-4 h-4 text-red-500" />}
                          <div>
                            <div className="font-semibold">{object.description}</div>
                            <div className="text-xs text-muted-foreground flex items-center gap-2">
                              <span>{object.id}</span>
                              <span>•</span>
                              <Camera className="w-3 h-3" />
                              <span>{object.camera}</span>
                              <span>•</span>
                              <span>{object.region}</span>
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-4">
                          <div className="text-sm text-right">
                            <div>{object.appearances} sightings</div>
                            <div className="text-xs text-muted-foreground">{object.locations} locations</div>
                          </div>
                          {object.flagged && (
                            <Badge className="bg-red-500 text-white">Flagged</Badge>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="locations" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Watch Zones</CardTitle>
                  <CardDescription>High-priority surveillance zones with camera coverage</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {poleData.locations.map((location) => (
                      <div
                        key={location.id}
                        className="flex items-center justify-between p-3 border border-border rounded-lg hover:border-primary/50 cursor-pointer transition-all"
                      >
                        <div>
                          <div className="font-semibold">{location.name}</div>
                          <div className="text-xs text-muted-foreground flex items-center gap-2">
                            <span>{location.id}</span>
                            <span>•</span>
                            <Camera className="w-3 h-3" />
                            <span>{location.cameras} cameras</span>
                            <span>•</span>
                            <span>Risk: {location.riskScore}%</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-4 text-sm">
                          <div className="text-center">
                            <div className="font-semibold">{location.events}</div>
                            <div className="text-xs text-muted-foreground">Events</div>
                          </div>
                          <div className="text-center">
                            <div className="font-semibold">{location.people}</div>
                            <div className="text-xs text-muted-foreground">People</div>
                          </div>
                          <div className="text-center">
                            <div className="font-semibold">{location.vehicles}</div>
                            <div className="text-xs text-muted-foreground">Vehicles</div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="events" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Recent Events</CardTitle>
                  <CardDescription>Latest POLE-related incidents from surveillance network</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {poleData.events.map((event) => (
                      <div
                        key={event.id}
                        className="flex items-center justify-between p-3 border border-border rounded-lg hover:border-primary/50 cursor-pointer transition-all"
                      >
                        <div className="flex items-center gap-3">
                          <div className={`w-2 h-2 rounded-full ${getRiskColor(event.priority)}`} />
                          <div>
                            <div className="font-semibold">{event.type}</div>
                            <div className="text-xs text-muted-foreground flex items-center gap-2">
                              <Camera className="w-3 h-3" />
                              <span>{event.camera}</span>
                              <span>•</span>
                              <span>{event.location}</span>
                              <span>•</span>
                              <Clock className="w-3 h-3" />
                              <span>{event.timestamp}</span>
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <div className="text-sm text-right">
                            <div>{event.people} people, {event.objects} vehicles</div>
                          </div>
                          <Badge className={`${getStatusColor(event.status)} text-white`}>
                            {event.status}
                          </Badge>
                          <Badge variant="outline">{event.priority}</Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </motion.div>

        {/* Pattern Recognition */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.6, duration: 0.4 }}>
          <Card>
            <CardHeader>
              <CardTitle>Pattern Recognition</CardTitle>
              <CardDescription>AI-identified patterns and intelligence insights</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
                {patternData.map((pattern) => (
                  <div key={pattern.pattern} className="p-4 border border-border rounded-lg hover:border-primary/50 transition-all">
                    <div className="text-2xl font-bold mb-1">{pattern.count}</div>
                    <div className="text-sm text-muted-foreground mb-2">{pattern.pattern}</div>
                    <Badge variant={pattern.trend === "up" ? "default" : pattern.trend === "down" ? "destructive" : "secondary"}>
                      {pattern.trend === "up" ? "↑ Increasing" : pattern.trend === "down" ? "↓ Decreasing" : "→ Stable"}
                    </Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </main>
    </div>
  );
}
