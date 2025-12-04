import { useState, useEffect, useCallback } from "react";
import { useLocation } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  ArrowLeft, 
  Camera, 
  MapPin, 
  AlertTriangle, 
  Activity,
  TrendingUp,
  TrendingDown,
  RefreshCw
} from "lucide-react";
import { BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { motion } from "framer-motion";
import { format } from "date-fns";

// Loading skeleton component
function ExecutiveDashboardSkeleton() {
  return (
    <div className="min-h-screen bg-background">
      {/* Header Skeleton */}
      <header className="border-b border-border bg-card/50 backdrop-blur sticky top-0 z-50">
        <div className="container flex items-center justify-between h-16">
          <div className="flex items-center gap-4">
            <Skeleton className="h-8 w-20" />
            <div>
              <Skeleton className="h-5 w-40" />
              <Skeleton className="h-3 w-32 mt-1" />
            </div>
          </div>
          <Skeleton className="h-9 w-40" />
        </div>
      </header>

      <main className="container py-8 space-y-8">
        {/* KPI Cards Skeleton */}
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-4 w-4 rounded" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-8 w-20 mb-2" />
                <Skeleton className="h-3 w-28" />
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Charts Row Skeleton */}
        <div className="grid lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <Skeleton className="h-5 w-32" />
              <Skeleton className="h-4 w-48" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-[300px] w-full" />
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <Skeleton className="h-5 w-32" />
              <Skeleton className="h-4 w-48" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-[300px] w-full" />
            </CardContent>
          </Card>
        </div>

        {/* Regional Activity Skeleton */}
        <Card>
          <CardHeader>
            <Skeleton className="h-5 w-36" />
            <Skeleton className="h-4 w-56" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-[300px] w-full" />
          </CardContent>
        </Card>
      </main>
    </div>
  );
}

interface DashboardStats {
  overview: {
    totalCameras: number;
    activeCameras: number;
    inactiveCameras: number;
    alertCameras: number;
    totalEvents: number;
    criticalAlerts: number;
  };
  eventsByType: Record<string, number>;
  eventsByLevel: {
    critical: number;
    high: number;
    medium: number;
    low: number;
  };
  timelineData: { day: string; events: number; alerts: number }[];
  regionalActivity: { region: string; cameras: number; events: number }[];
  recentAlerts: any[];
  lastUpdated: string;
}

export default function ExecutiveDashboard() {
  const [, setLocation] = useLocation();
  const [timeRange, setTimeRange] = useState("7d");
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState(new Date());

  // Fetch real statistics
  const fetchStats = useCallback(async () => {
    try {
      setIsLoading(true);
      const response = await fetch(`/api/data/stats?timeRange=${timeRange}`, {
        credentials: "include",
      });
      
      if (!response.ok) throw new Error("Failed to fetch stats");
      
      const data = await response.json();
      
      if (data.success !== false) {
        setStats(data);
      }
      
      setLastRefresh(new Date());
    } catch (error) {
      console.error("[Dashboard] Fetch error:", error);
    } finally {
      setIsLoading(false);
    }
  }, [timeRange]);

  // Initial fetch and auto-refresh
  useEffect(() => {
    fetchStats();
    const interval = setInterval(fetchStats, 30000); // Refresh every 30 seconds
    return () => clearInterval(interval);
  }, [fetchStats]);

  // Prepare chart data
  const eventsByType = stats ? Object.entries(stats.eventsByType).map(([name, value], i) => ({
    name,
    value,
    color: ["#D91023", "#E63946", "#F77F00", "#FCBF49"][i % 4],
  })) : [];

  const eventsByDay = stats?.timelineData || [];
  const regionActivity = stats?.regionalActivity || [];

  // KPI calculations
  const kpis = [
    {
      title: "Total Events",
      value: stats?.overview.totalEvents?.toLocaleString() || "0",
      change: "+12%",
      trend: "up" as const,
      icon: Activity,
      color: "text-primary",
    },
    {
      title: "Active Cameras",
      value: stats?.overview.activeCameras?.toLocaleString() || "0",
      change: `${Math.round((stats?.overview.activeCameras || 0) / (stats?.overview.totalCameras || 1) * 100)}%`,
      trend: "up" as const,
      icon: Camera,
      color: "text-green-500",
    },
    {
      title: "Total Cameras",
      value: stats?.overview.totalCameras?.toLocaleString() || "3,015",
      change: "Deployed",
      trend: "neutral" as const,
      icon: MapPin,
      color: "text-blue-500",
    },
    {
      title: "Critical Alerts",
      value: stats?.overview.criticalAlerts?.toLocaleString() || "0",
      change: stats?.overview.alertCameras ? `${stats.overview.alertCameras} cameras` : "0 cameras",
      trend: (stats?.overview.criticalAlerts || 0) > 10 ? "up" as const : "down" as const,
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
              <p className="text-xs text-muted-foreground">
                Real-time analytics • Last updated: {format(lastRefresh, "HH:mm:ss")}
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
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
            
            <Button
              variant="outline"
              size="sm"
              onClick={fetchStats}
              disabled={isLoading}
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? "animate-spin" : ""}`} />
            </Button>
          </div>
        </div>
      </header>

      {/* Show skeleton while loading */}
      {isLoading && !stats ? (
        <main className="container py-8 space-y-8">
          {/* KPI Cards Skeleton */}
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {[1, 2, 3, 4].map((i) => (
              <Card key={i}>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-4 w-4 rounded" />
                </CardHeader>
                <CardContent>
                  <Skeleton className="h-8 w-20 mb-2" />
                  <Skeleton className="h-3 w-28" />
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Charts Skeleton */}
          <div className="grid lg:grid-cols-2 gap-6">
            {[1, 2].map((i) => (
              <Card key={i}>
                <CardHeader>
                  <Skeleton className="h-5 w-32" />
                  <Skeleton className="h-4 w-48 mt-1" />
                </CardHeader>
                <CardContent>
                  <Skeleton className="h-[300px] w-full rounded-lg" />
                </CardContent>
              </Card>
            ))}
          </div>

          <Card>
            <CardHeader>
              <Skeleton className="h-5 w-36" />
              <Skeleton className="h-4 w-56 mt-1" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-[300px] w-full rounded-lg" />
            </CardContent>
          </Card>
        </main>
      ) : (
      /* Main Content */
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
                    {kpi.trend !== "neutral" && <span>vs last period</span>}
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
                    <XAxis dataKey="day" stroke="#9CA3AF" />
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

        {/* Recent Alerts */}
        {stats?.recentAlerts && stats.recentAlerts.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.7, duration: 0.4 }}
          >
            <Card>
              <CardHeader>
                <CardTitle>Recent Alerts</CardTitle>
                <CardDescription>Latest security events from the surveillance network</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {stats.recentAlerts.slice(0, 5).map((alert, i) => (
                    <div key={alert.id || i} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                      <div className="flex items-center gap-3">
                        <div className={`w-2 h-2 rounded-full ${
                          alert.level === 3 ? "bg-red-500" :
                          alert.level === 2 ? "bg-orange-500" :
                          alert.level === 1 ? "bg-yellow-500" : "bg-blue-500"
                        }`} />
                        <div>
                          <div className="font-medium text-sm">{alert.type}</div>
                          <div className="text-xs text-muted-foreground">
                            {alert.camera} • {alert.region}
                          </div>
                        </div>
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {format(new Date(alert.timestamp), "HH:mm:ss")}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </main>
      )}
    </div>
  );
}
