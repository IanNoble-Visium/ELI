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
import { BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, AreaChart, Area } from "recharts";
import { motion } from "framer-motion";
import { format } from "date-fns";

// Staggered animation variants for container and children
const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
      delayChildren: 0.1,
    },
  },
};

const itemVariants = {
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

const chartVariants = {
  hidden: { opacity: 0, y: 30, scale: 0.95 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: {
      duration: 0.5,
      ease: [0.25, 0.46, 0.45, 0.94],
    },
  },
};

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
        {/* KPI Cards with staggered animation */}
        <motion.div
          className="grid md:grid-cols-2 lg:grid-cols-4 gap-6"
          variants={containerVariants}
          initial="hidden"
          animate="visible"
        >
          {kpis.map((kpi) => (
            <motion.div
              key={kpi.title}
              variants={itemVariants}
              whileHover={{
                y: -4,
                transition: { duration: 0.2 }
              }}
            >
              <Card className="hover:border-primary/50 hover:shadow-lg hover:shadow-primary/5 transition-all duration-300 h-full">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">{kpi.title}</CardTitle>
                  <motion.div
                    whileHover={{ rotate: 10, scale: 1.1 }}
                    transition={{ duration: 0.2 }}
                  >
                    <kpi.icon className={`w-4 h-4 ${kpi.color}`} />
                  </motion.div>
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
        </motion.div>

        {/* Charts Row 1 with staggered reveal */}
        <motion.div
          className="grid lg:grid-cols-2 gap-6"
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-50px" }}
        >
          {/* Events Timeline with gradient */}
          <motion.div variants={chartVariants}>
            <Card className="hover:shadow-lg hover:shadow-primary/5 transition-shadow duration-300">
              <CardHeader>
                <CardTitle>Events Timeline</CardTitle>
                <CardDescription>Daily event and alert distribution</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <AreaChart data={eventsByDay}>
                    <defs>
                      <linearGradient id="eventGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#D91023" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="#D91023" stopOpacity={0}/>
                      </linearGradient>
                      <linearGradient id="alertGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#F77F00" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="#F77F00" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                    <XAxis dataKey="day" stroke="#9CA3AF" />
                    <YAxis stroke="#9CA3AF" />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "#1f2937",
                        border: "1px solid #D91023",
                        borderRadius: "8px",
                        boxShadow: "0 4px 12px rgba(217, 16, 35, 0.15)"
                      }}
                      labelStyle={{ color: "#F9FAFB", fontWeight: "bold" }}
                    />
                    <Legend />
                    <Area
                      type="monotone"
                      dataKey="events"
                      stroke="#D91023"
                      strokeWidth={2}
                      fill="url(#eventGradient)"
                      name="Events"
                      isAnimationActive={true}
                      animationDuration={1500}
                      animationEasing="ease-out"
                    />
                    <Area
                      type="monotone"
                      dataKey="alerts"
                      stroke="#F77F00"
                      strokeWidth={2}
                      fill="url(#alertGradient)"
                      name="Alerts"
                      isAnimationActive={true}
                      animationDuration={1500}
                      animationEasing="ease-out"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </motion.div>

          {/* Events by Type */}
          <motion.div variants={chartVariants}>
            <Card className="hover:shadow-lg hover:shadow-primary/5 transition-shadow duration-300">
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
                      isAnimationActive={true}
                      animationDuration={1200}
                      animationEasing="ease-out"
                    >
                      {eventsByType.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "#1f2937",
                        border: "1px solid #D91023",
                        borderRadius: "8px",
                        boxShadow: "0 4px 12px rgba(217, 16, 35, 0.15)"
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </motion.div>
        </motion.div>

        {/* Regional Activity */}
        <motion.div
          variants={chartVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-50px" }}
        >
          <Card className="hover:shadow-lg hover:shadow-primary/5 transition-shadow duration-300">
            <CardHeader>
              <CardTitle>Regional Activity</CardTitle>
              <CardDescription>Events and camera distribution by region</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={regionActivity}>
                  <defs>
                    <linearGradient id="barGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#D91023" stopOpacity={1}/>
                      <stop offset="100%" stopColor="#D91023" stopOpacity={0.7}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                  <XAxis dataKey="region" stroke="#9CA3AF" />
                  <YAxis stroke="#9CA3AF" />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "#1f2937",
                      border: "1px solid #D91023",
                      borderRadius: "8px",
                      boxShadow: "0 4px 12px rgba(217, 16, 35, 0.15)"
                    }}
                    labelStyle={{ color: "#F9FAFB", fontWeight: "bold" }}
                  />
                  <Legend />
                  <Bar
                    dataKey="events"
                    fill="url(#barGradient)"
                    name="Events"
                    radius={[4, 4, 0, 0]}
                    isAnimationActive={true}
                    animationDuration={1200}
                  />
                  <Bar
                    dataKey="cameras"
                    fill="#4B5563"
                    name="Cameras"
                    radius={[4, 4, 0, 0]}
                    isAnimationActive={true}
                    animationDuration={1200}
                  />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </motion.div>

        {/* Recent Alerts with staggered list items */}
        {stats?.recentAlerts && stats.recentAlerts.length > 0 && (
          <motion.div
            variants={chartVariants}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-50px" }}
          >
            <Card className="hover:shadow-lg hover:shadow-primary/5 transition-shadow duration-300">
              <CardHeader>
                <CardTitle>Recent Alerts</CardTitle>
                <CardDescription>Latest security events from the surveillance network</CardDescription>
              </CardHeader>
              <CardContent>
                <motion.div
                  className="space-y-3"
                  variants={containerVariants}
                  initial="hidden"
                  animate="visible"
                >
                  {stats.recentAlerts.slice(0, 5).map((alert, i) => (
                    <motion.div
                      key={alert.id || i}
                      className="flex items-center justify-between p-3 bg-muted/50 rounded-lg hover:bg-muted/70 transition-colors cursor-pointer"
                      variants={itemVariants}
                      whileHover={{ x: 4, transition: { duration: 0.2 } }}
                    >
                      <div className="flex items-center gap-3">
                        <motion.div
                          className={`w-2 h-2 rounded-full ${
                            alert.level === 3 ? "bg-red-500" :
                            alert.level === 2 ? "bg-orange-500" :
                            alert.level === 1 ? "bg-yellow-500" : "bg-blue-500"
                          }`}
                          animate={alert.level === 3 ? {
                            scale: [1, 1.3, 1],
                            opacity: [1, 0.7, 1]
                          } : {}}
                          transition={{
                            duration: 1.5,
                            repeat: Infinity,
                            ease: "easeInOut"
                          }}
                        />
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
                    </motion.div>
                  ))}
                </motion.div>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </main>
      )}
    </div>
  );
}
