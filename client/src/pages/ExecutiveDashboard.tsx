import { useState } from "react";
import { useLocation } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { trpc } from "@/lib/trpc";
import { 
  ArrowLeft, 
  Camera, 
  MapPin, 
  AlertTriangle, 
  Activity,
  TrendingUp,
  TrendingDown
} from "lucide-react";
import { BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { motion } from "framer-motion";
import { format, subDays } from "date-fns";

export default function ExecutiveDashboard() {
  const [, setLocation] = useLocation();
  const [timeRange, setTimeRange] = useState("7d");
  
  // Calculate time range
  const getTimeRange = () => {
    const now = Date.now();
    const ranges: Record<string, number> = {
      "24h": now - 24 * 60 * 60 * 1000,
      "7d": now - 7 * 24 * 60 * 60 * 1000,
      "30d": now - 30 * 24 * 60 * 60 * 1000,
      "90d": now - 90 * 24 * 60 * 60 * 1000,
    };
    return { startTime: ranges[timeRange] || ranges["7d"], endTime: now };
  };

  const { startTime, endTime } = getTimeRange();
  
  const { data: metrics, isLoading } = trpc.dashboard.metrics.useQuery({
    startTime,
    endTime,
  });

  // Mock data for charts (will be replaced with real data)
  const eventsByDay = [
    { date: "Mon", events: 45, alerts: 12 },
    { date: "Tue", events: 52, alerts: 8 },
    { date: "Wed", events: 38, alerts: 15 },
    { date: "Thu", events: 61, alerts: 10 },
    { date: "Fri", events: 48, alerts: 18 },
    { date: "Sat", events: 35, alerts: 7 },
    { date: "Sun", events: 42, alerts: 9 },
  ];

  const eventsByType = [
    { name: "Intrusion", value: 35, color: "#D91023" },
    { name: "Loitering", value: 28, color: "#E63946" },
    { name: "Vehicle", value: 22, color: "#F77F00" },
    { name: "Crowd", value: 15, color: "#FCBF49" },
  ];

  const regionActivity = [
    { region: "Lima", events: 156, cameras: 842 },
    { region: "Cusco", events: 89, cameras: 324 },
    { region: "Arequipa", events: 67, cameras: 298 },
    { region: "Trujillo", events: 54, cameras: 215 },
    { region: "Piura", events: 43, cameras: 187 },
  ];

  const kpis = [
    {
      title: "Total Events",
      value: metrics?.totalEvents?.toLocaleString() || "0",
      change: "+12%",
      trend: "up",
      icon: Activity,
      color: "text-primary",
    },
    {
      title: "Active Cameras",
      value: metrics?.activeChannels?.toLocaleString() || "0",
      change: "+5",
      trend: "up",
      icon: Camera,
      color: "text-green-500",
    },
    {
      title: "Total Cameras",
      value: metrics?.totalChannels?.toLocaleString() || "3,084",
      change: "0%",
      trend: "neutral",
      icon: MapPin,
      color: "text-blue-500",
    },
    {
      title: "Critical Alerts",
      value: "23",
      change: "-8%",
      trend: "down",
      icon: AlertTriangle,
      color: "text-orange-500",
    },
  ];

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
              <h1 className="text-xl font-bold">Executive Dashboard</h1>
              <p className="text-xs text-muted-foreground">Real-time analytics and KPIs</p>
            </div>
          </div>
          
          <Select value={timeRange} onValueChange={setTimeRange}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Select time range" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="24h">Last 24 Hours</SelectItem>
              <SelectItem value="7d">Last 7 Days</SelectItem>
              <SelectItem value="30d">Last 30 Days</SelectItem>
              <SelectItem value="90d">Last 90 Days</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </header>

      {/* Main Content */}
      <main className="container py-8 space-y-8">
        {/* KPI Cards */}
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
          {kpis.map((kpi, index) => (
            <motion.div
              key={kpi.title}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1, duration: 0.4 }}
            >
              <Card className="hover:border-primary/50 transition-all">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">{kpi.title}</CardTitle>
                  <kpi.icon className={`w-4 h-4 ${kpi.color}`} />
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold">{kpi.value}</div>
                  <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
                    {kpi.trend === "up" && <TrendingUp className="w-3 h-3 text-green-500" />}
                    {kpi.trend === "down" && <TrendingDown className="w-3 h-3 text-red-500" />}
                    <span className={kpi.trend === "up" ? "text-green-500" : kpi.trend === "down" ? "text-red-500" : ""}>
                      {kpi.change}
                    </span>
                    <span>vs last period</span>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>

        {/* Charts Row 1 */}
        <div className="grid lg:grid-cols-2 gap-6">
          {/* Events Timeline */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4, duration: 0.4 }}
          >
            <Card>
              <CardHeader>
                <CardTitle>Events Timeline</CardTitle>
                <CardDescription>Daily event and alert distribution</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={eventsByDay}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                    <XAxis dataKey="date" stroke="#9CA3AF" />
                    <YAxis stroke="#9CA3AF" />
                    <Tooltip 
                      contentStyle={{ backgroundColor: "#374151", border: "1px solid #4B5563" }}
                      labelStyle={{ color: "#F9FAFB" }}
                    />
                    <Legend />
                    <Line type="monotone" dataKey="events" stroke="#D91023" strokeWidth={2} name="Events" />
                    <Line type="monotone" dataKey="alerts" stroke="#F77F00" strokeWidth={2} name="Alerts" />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </motion.div>

          {/* Events by Type */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5, duration: 0.4 }}
          >
            <Card>
              <CardHeader>
                <CardTitle>Events by Type</CardTitle>
                <CardDescription>Distribution of event categories</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={eventsByType}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                      outerRadius={100}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      {eventsByType.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip 
                      contentStyle={{ backgroundColor: "#374151", border: "1px solid #4B5563" }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </motion.div>
        </div>

        {/* Regional Activity */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6, duration: 0.4 }}
        >
          <Card>
            <CardHeader>
              <CardTitle>Regional Activity</CardTitle>
              <CardDescription>Events and camera distribution by region</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={regionActivity}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                  <XAxis dataKey="region" stroke="#9CA3AF" />
                  <YAxis stroke="#9CA3AF" />
                  <Tooltip 
                    contentStyle={{ backgroundColor: "#374151", border: "1px solid #4B5563" }}
                    labelStyle={{ color: "#F9FAFB" }}
                  />
                  <Legend />
                  <Bar dataKey="events" fill="#D91023" name="Events" />
                  <Bar dataKey="cameras" fill="#4B5563" name="Cameras" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </motion.div>
      </main>
    </div>
  );
}
