import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch, Redirect } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import Landing from "./pages/Landing";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import ExecutiveDashboard from "./pages/ExecutiveDashboard";
import GeographicMap from "./pages/GeographicMap";
import TopologyGraph from "./pages/TopologyGraph";
import IncidentManagement from "./pages/IncidentManagement";
import POLEAnalytics from "./pages/POLEAnalytics";
import RealtimeWebhooks from "./pages/RealtimeWebhooks";
import Settings from "./pages/Settings";
import { useAuth } from "./_core/hooks/useAuth";

/**
 * Protected Route wrapper - redirects to login if not authenticated
 */
function ProtectedRoute({ component: Component }: { component: React.ComponentType }) {
  const { isAuthenticated, loading } = useAuth();
  
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center space-y-4">
          <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }
  
  if (!isAuthenticated) {
    return <Redirect to="/login" />;
  }
  
  return <Component />;
}

function Router() {
  return (
    <Switch>
      <Route path="/" component={Landing} />
      <Route path="/login" component={Login} />
      <Route path="/dashboard">
        {() => <ProtectedRoute component={Dashboard} />}
      </Route>
      <Route path="/dashboard/executive">
        {() => <ProtectedRoute component={ExecutiveDashboard} />}
      </Route>
      <Route path="/dashboard/map">
        {() => <ProtectedRoute component={GeographicMap} />}
      </Route>
      <Route path="/dashboard/topology">
        {() => <ProtectedRoute component={TopologyGraph} />}
      </Route>
      <Route path="/dashboard/incidents">
        {() => <ProtectedRoute component={IncidentManagement} />}
      </Route>
      <Route path="/dashboard/pole">
        {() => <ProtectedRoute component={POLEAnalytics} />}
      </Route>
      <Route path="/dashboard/realtime">
        {() => <ProtectedRoute component={RealtimeWebhooks} />}
      </Route>
      <Route path="/dashboard/settings">
        {() => <ProtectedRoute component={Settings} />}
      </Route>
      <Route path="/404" component={NotFound} />
      {/* Final fallback route */}
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="dark">
        <TooltipProvider>
          <Toaster />
          <Router />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
