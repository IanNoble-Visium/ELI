import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { trpc } from "@/lib/trpc";
import { 
  LayoutDashboard, 
  Map, 
  Network, 
  AlertTriangle, 
  Users, 
  Activity,
  Settings,
  LogOut,
  Shield
} from "lucide-react";
import { useLocation } from "wouter";
import { motion } from "framer-motion";

// Staggered animation variants
const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.08,
      delayChildren: 0.2,
    },
  },
};

const cardVariants = {
  hidden: { opacity: 0, y: 30, scale: 0.95 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: {
      duration: 0.4,
      ease: [0.25, 0.46, 0.45, 0.94],
    },
  },
};

export default function Dashboard() {
  const { user, logout } = useAuth();
  const [, setLocation] = useLocation();
  
  const logoutMutation = trpc.auth.logout.useMutation({
    onSuccess: () => {
      setLocation("/login");
    },
  });

  const handleLogout = () => {
    logoutMutation.mutate();
  };

  const dashboardSections = [
    {
      icon: LayoutDashboard,
      title: "Executive Dashboard",
      description: "KPIs, metrics, and real-time analytics",
      route: "/dashboard/executive",
      color: "text-primary",
    },
    {
      icon: Map,
      title: "Geographic Map",
      description: "3,084 cameras across 25 regions",
      route: "/dashboard/map",
      color: "text-blue-500",
    },
    {
      icon: Network,
      title: "Topology Graph",
      description: "Network relationships and connections",
      route: "/dashboard/topology",
      color: "text-purple-500",
    },
    {
      icon: AlertTriangle,
      title: "Incident Management",
      description: "Real-time alerts and response coordination",
      route: "/dashboard/incidents",
      color: "text-orange-500",
    },
    {
      icon: Users,
      title: "POLE Analytics",
      description: "People, Objects, Locations, Events analysis",
      route: "/dashboard/pole",
      color: "text-green-500",
    },
    {
      icon: Activity,
      title: "Real-Time Webhooks",
      description: "Live webhook viewer with filters",
      route: "/dashboard/realtime",
      color: "text-red-500",
    },
  ];

  return (
    <div className="min-h-screen bg-background">
      {/* Peru flag accent at top */}
      <div className="fixed top-0 left-0 w-full h-1 bg-gradient-to-r from-primary via-white to-primary z-50" />
      
      {/* Header */}
      <header className="border-b border-border bg-card/80 backdrop-blur-lg sticky top-1 z-40">
        <div className="container flex items-center justify-between h-16">
          <div className="flex items-center gap-3">
            <motion.div 
              className="w-10 h-10 bg-primary/20 rounded-xl flex items-center justify-center ring-2 ring-primary/30"
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: 0.5 }}
            >
              <Shield className="w-5 h-5 text-primary" />
            </motion.div>
            <div>
              <h1 className="text-xl font-bold bg-gradient-to-r from-white to-white/80 bg-clip-text text-transparent">ELI Dashboard</h1>
              <p className="text-xs text-primary/80 font-medium">Peru Surveillance Platform</p>
            </div>
          </div>
          
          <div className="flex items-center gap-4">
            <div className="text-sm text-right">
              <p className="font-medium">{user?.name}</p>
              <p className="text-xs text-muted-foreground">{user?.role}</p>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="hover:border-primary/50 hover:bg-primary/10"
              onClick={() => setLocation("/dashboard/settings")}
            >
              <Settings className="w-4 h-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="hover:border-primary/50 hover:bg-primary/10"
              onClick={handleLogout}
              disabled={logoutMutation.isPending}
            >
              <LogOut className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </header>
      
      {/* Main Content */}
      <main className="container py-8">
        <motion.div 
          className="mb-8"
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <h2 className="text-3xl font-bold mb-2">Welcome back, {user?.name}</h2>
          <p className="text-muted-foreground">
            Select a module to access surveillance and analytics tools
          </p>
        </motion.div>
        
        <motion.div
          className="grid md:grid-cols-2 lg:grid-cols-3 gap-6"
          variants={containerVariants}
          initial="hidden"
          animate="visible"
        >
          {dashboardSections.map((section) => (
            <motion.div
              key={section.route}
              variants={cardVariants}
              whileHover={{
                y: -8,
                scale: 1.02,
                transition: { duration: 0.2 }
              }}
            >
              <Card
                className="cursor-pointer border-border/50 hover:border-primary/60 transition-all duration-300 hover:shadow-xl hover:shadow-primary/20 bg-card/60 backdrop-blur-sm h-full group"
                onClick={() => setLocation(section.route)}
              >
                <CardHeader>
                  <motion.div
                    className="w-14 h-14 bg-primary/10 rounded-xl flex items-center justify-center mb-4 ring-2 ring-primary/20 group-hover:ring-primary/40 group-hover:bg-primary/20 transition-all duration-300"
                    whileHover={{ rotate: 5, scale: 1.1 }}
                    transition={{ duration: 0.2 }}
                  >
                    <section.icon className={`w-7 h-7 ${section.color} drop-shadow-sm`} />
                  </motion.div>
                  <CardTitle className="text-lg">{section.title}</CardTitle>
                  <CardDescription className="text-sm">{section.description}</CardDescription>
                </CardHeader>
                <CardContent>
                  <Button
                    variant="outline"
                    className="w-full group-hover:bg-primary group-hover:text-primary-foreground group-hover:border-primary transition-all duration-300"
                  >
                    Open Module
                  </Button>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </motion.div>
      </main>
    </div>
  );
}
