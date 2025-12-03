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
  LogOut
} from "lucide-react";
import { useLocation } from "wouter";

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
      {/* Header */}
      <header className="border-b border-border bg-card/50 backdrop-blur sticky top-0 z-50">
        <div className="container flex items-center justify-between h-16">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center">
              <LayoutDashboard className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h1 className="text-xl font-bold">ELI Dashboard</h1>
              <p className="text-xs text-muted-foreground">Peru Surveillance Platform</p>
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
              onClick={() => setLocation("/dashboard/settings")}
            >
              <Settings className="w-4 h-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
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
        <div className="mb-8">
          <h2 className="text-3xl font-bold mb-2">Welcome back, {user?.name}</h2>
          <p className="text-muted-foreground">
            Select a module to access surveillance and analytics tools
          </p>
        </div>
        
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {dashboardSections.map((section) => (
            <Card
              key={section.route}
              className="cursor-pointer hover:border-primary/50 transition-all hover:shadow-lg hover:shadow-primary/10"
              onClick={() => setLocation(section.route)}
            >
              <CardHeader>
                <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center mb-4">
                  <section.icon className={`w-6 h-6 ${section.color}`} />
                </div>
                <CardTitle>{section.title}</CardTitle>
                <CardDescription>{section.description}</CardDescription>
              </CardHeader>
              <CardContent>
                <Button variant="outline" className="w-full">
                  Open Module
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </main>
    </div>
  );
}
