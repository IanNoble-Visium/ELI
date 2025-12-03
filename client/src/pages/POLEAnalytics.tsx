import { useState } from "react";
import { useLocation } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft, Users, Car, MapPin, Activity, Network } from "lucide-react";
import { motion } from "framer-motion";
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";

// Mock POLE data
const mockPOLEData = {
  people: [
    { id: "P001", name: "Person A", appearances: 45, locations: 12, associations: 8, riskLevel: "high" },
    { id: "P002", name: "Person B", appearances: 32, locations: 8, associations: 5, riskLevel: "medium" },
    { id: "P003", name: "Person C", appearances: 28, locations: 15, associations: 12, riskLevel: "low" },
    { id: "P004", name: "Person D", appearances: 67, locations: 20, associations: 15, riskLevel: "high" },
    { id: "P005", name: "Person E", appearances: 19, locations: 6, associations: 3, riskLevel: "low" },
  ],
  objects: [
    { id: "O001", type: "Vehicle", description: "Toyota Corolla - ABC123", appearances: 34, locations: 18 },
    { id: "O002", type: "Vehicle", description: "Honda Civic - XYZ789", appearances: 28, locations: 12 },
    { id: "O003", type: "Weapon", description: "Firearm", appearances: 5, locations: 3 },
    { id: "O004", type: "Vehicle", description: "Motorcycle - DEF456", appearances: 42, locations: 25 },
  ],
  locations: [
    { id: "L001", name: "Lima Central Plaza", events: 156, people: 89, vehicles: 45 },
    { id: "L002", name: "Cusco Market District", events: 98, people: 67, vehicles: 32 },
    { id: "L003", name: "Arequipa Station", events: 134, people: 102, vehicles: 56 },
    { id: "L004", name: "Trujillo Port", events: 87, people: 54, vehicles: 38 },
  ],
  events: [
    { id: "E001", type: "Intrusion", timestamp: "2024-12-01 14:30", location: "Lima Central Plaza", people: 3, objects: 1 },
    { id: "E002", type: "Loitering", timestamp: "2024-12-01 16:45", location: "Cusco Market District", people: 2, objects: 0 },
    { id: "E003", type: "Vehicle Theft", timestamp: "2024-12-02 09:15", location: "Arequipa Station", people: 2, objects: 2 },
  ],
};

const timelineData = [
  { date: "Dec 1", people: 45, objects: 23, events: 67 },
  { date: "Dec 2", people: 52, objects: 28, events: 74 },
  { date: "Dec 3", people: 38, objects: 19, events: 58 },
  { date: "Dec 4", people: 61, objects: 32, events: 82 },
  { date: "Dec 5", people: 48, objects: 25, events: 69 },
  { date: "Dec 6", people: 55, objects: 30, events: 78 },
  { date: "Dec 7", people: 42, objects: 21, events: 64 },
];

const patternData = [
  { pattern: "Repeat Offenders", count: 23, trend: "up" },
  { pattern: "Vehicle Associations", count: 45, trend: "up" },
  { pattern: "Location Clusters", count: 12, trend: "down" },
  { pattern: "Time Patterns", count: 8, trend: "stable" },
];

export default function POLEAnalytics() {
  const [, setLocation] = useLocation();
  const [selectedEntity, setSelectedEntity] = useState<any>(null);

  const getRiskColor = (level: string) => {
    const colors: Record<string, string> = {
      high: "bg-red-500",
      medium: "bg-yellow-500",
      low: "bg-green-500",
    };
    return colors[level] || "bg-gray-500";
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
              <p className="text-xs text-muted-foreground">People, Objects, Locations, Events analysis</p>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container py-8 space-y-8">
        {/* Stats Overview */}
        <div className="grid md:grid-cols-4 gap-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0, duration: 0.4 }}
          >
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">People</CardTitle>
                <Users className="w-4 h-4 text-blue-500" />
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">{mockPOLEData.people.length}</div>
                <p className="text-xs text-muted-foreground">Tracked individuals</p>
              </CardContent>
            </Card>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1, duration: 0.4 }}
          >
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Objects</CardTitle>
                <Car className="w-4 h-4 text-orange-500" />
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">{mockPOLEData.objects.length}</div>
                <p className="text-xs text-muted-foreground">Tracked objects</p>
              </CardContent>
            </Card>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2, duration: 0.4 }}
          >
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Locations</CardTitle>
                <MapPin className="w-4 h-4 text-purple-500" />
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">{mockPOLEData.locations.length}</div>
                <p className="text-xs text-muted-foreground">Key locations</p>
              </CardContent>
            </Card>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3, duration: 0.4 }}
          >
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Events</CardTitle>
                <Activity className="w-4 h-4 text-primary" />
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">{mockPOLEData.events.length}</div>
                <p className="text-xs text-muted-foreground">Recent events</p>
              </CardContent>
            </Card>
          </motion.div>
        </div>

        {/* Timeline Chart */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4, duration: 0.4 }}
        >
          <Card>
            <CardHeader>
              <CardTitle>Activity Timeline</CardTitle>
              <CardDescription>POLE entity activity over time</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={timelineData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                  <XAxis dataKey="date" stroke="#9CA3AF" />
                  <YAxis stroke="#9CA3AF" />
                  <Tooltip 
                    contentStyle={{ backgroundColor: "#374151", border: "1px solid #4B5563" }}
                    labelStyle={{ color: "#F9FAFB" }}
                  />
                  <Legend />
                  <Line type="monotone" dataKey="people" stroke="#3B82F6" strokeWidth={2} name="People" />
                  <Line type="monotone" dataKey="objects" stroke="#F59E0B" strokeWidth={2} name="Objects" />
                  <Line type="monotone" dataKey="events" stroke="#D91023" strokeWidth={2} name="Events" />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </motion.div>

        {/* POLE Tabs */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5, duration: 0.4 }}
        >
          <Tabs defaultValue="people" className="space-y-4">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="people">People</TabsTrigger>
              <TabsTrigger value="objects">Objects</TabsTrigger>
              <TabsTrigger value="locations">Locations</TabsTrigger>
              <TabsTrigger value="events">Events</TabsTrigger>
            </TabsList>

            <TabsContent value="people" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Tracked People</CardTitle>
                  <CardDescription>Individuals identified in surveillance footage</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {mockPOLEData.people.map((person) => (
                      <div
                        key={person.id}
                        className="flex items-center justify-between p-3 border border-border rounded-lg hover:border-primary/50 cursor-pointer transition-all"
                        onClick={() => setSelectedEntity(person)}
                      >
                        <div>
                          <div className="font-semibold">{person.name}</div>
                          <div className="text-sm text-muted-foreground">ID: {person.id}</div>
                        </div>
                        <div className="flex items-center gap-4">
                          <div className="text-sm">
                            <span className="text-muted-foreground">Appearances:</span> {person.appearances}
                          </div>
                          <div className="text-sm">
                            <span className="text-muted-foreground">Locations:</span> {person.locations}
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
                  <CardTitle>Tracked Objects</CardTitle>
                  <CardDescription>Vehicles and items of interest</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {mockPOLEData.objects.map((object) => (
                      <div
                        key={object.id}
                        className="flex items-center justify-between p-3 border border-border rounded-lg hover:border-primary/50 cursor-pointer transition-all"
                      >
                        <div>
                          <div className="font-semibold">{object.description}</div>
                          <div className="text-sm text-muted-foreground">
                            {object.type} • ID: {object.id}
                          </div>
                        </div>
                        <div className="flex items-center gap-4">
                          <div className="text-sm">
                            <span className="text-muted-foreground">Appearances:</span> {object.appearances}
                          </div>
                          <div className="text-sm">
                            <span className="text-muted-foreground">Locations:</span> {object.locations}
                          </div>
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
                  <CardTitle>Key Locations</CardTitle>
                  <CardDescription>High-activity surveillance zones</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {mockPOLEData.locations.map((location) => (
                      <div
                        key={location.id}
                        className="flex items-center justify-between p-3 border border-border rounded-lg hover:border-primary/50 cursor-pointer transition-all"
                      >
                        <div>
                          <div className="font-semibold">{location.name}</div>
                          <div className="text-sm text-muted-foreground">ID: {location.id}</div>
                        </div>
                        <div className="flex items-center gap-4">
                          <div className="text-sm">
                            <span className="text-muted-foreground">Events:</span> {location.events}
                          </div>
                          <div className="text-sm">
                            <span className="text-muted-foreground">People:</span> {location.people}
                          </div>
                          <div className="text-sm">
                            <span className="text-muted-foreground">Vehicles:</span> {location.vehicles}
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
                  <CardDescription>Latest POLE-related incidents</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {mockPOLEData.events.map((event) => (
                      <div
                        key={event.id}
                        className="flex items-center justify-between p-3 border border-border rounded-lg hover:border-primary/50 cursor-pointer transition-all"
                      >
                        <div>
                          <div className="font-semibold">{event.type}</div>
                          <div className="text-sm text-muted-foreground">
                            {event.location} • {event.timestamp}
                          </div>
                        </div>
                        <div className="flex items-center gap-4">
                          <div className="text-sm">
                            <span className="text-muted-foreground">People:</span> {event.people}
                          </div>
                          <div className="text-sm">
                            <span className="text-muted-foreground">Objects:</span> {event.objects}
                          </div>
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
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6, duration: 0.4 }}
        >
          <Card>
            <CardHeader>
              <CardTitle>Pattern Recognition</CardTitle>
              <CardDescription>Identified patterns and trends</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
                {patternData.map((pattern) => (
                  <div key={pattern.pattern} className="p-4 border border-border rounded-lg">
                    <div className="text-2xl font-bold mb-1">{pattern.count}</div>
                    <div className="text-sm text-muted-foreground mb-2">{pattern.pattern}</div>
                    <Badge variant={pattern.trend === "up" ? "default" : pattern.trend === "down" ? "destructive" : "secondary"}>
                      {pattern.trend}
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
