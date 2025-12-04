import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch, Redirect, useLocation } from "wouter";
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
import { motion, AnimatePresence } from "framer-motion";

// Page transition variants for smooth navigation
const pageVariants = {
  initial: {
    opacity: 0,
    y: 10,
  },
  enter: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.3,
      ease: [0.25, 0.46, 0.45, 0.94], // ease-out-quad
    },
  },
  exit: {
    opacity: 0,
    y: -10,
    transition: {
      duration: 0.2,
      ease: [0.55, 0.06, 0.68, 0.19], // ease-in-quad
    },
  },
};

// Wrapper component for animated page transitions
function AnimatedPage({ children }: { children: React.ReactNode }) {
  return (
    <motion.div
      variants={pageVariants}
      initial="initial"
      animate="enter"
      exit="exit"
      style={{ width: "100%", height: "100%" }}
    >
      {children}
    </motion.div>
  );
}

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
  const [location] = useLocation();

  return (
    <AnimatePresence mode="wait">
      <Switch location={location} key={location}>
        <Route path="/">
          {() => <AnimatedPage><Landing /></AnimatedPage>}
        </Route>
        <Route path="/login">
          {() => <AnimatedPage><Login /></AnimatedPage>}
        </Route>
        <Route path="/dashboard">
          {() => <AnimatedPage><ProtectedRoute component={Dashboard} /></AnimatedPage>}
        </Route>
        <Route path="/dashboard/executive">
          {() => <AnimatedPage><ProtectedRoute component={ExecutiveDashboard} /></AnimatedPage>}
        </Route>
        <Route path="/dashboard/map">
          {() => <AnimatedPage><ProtectedRoute component={GeographicMap} /></AnimatedPage>}
        </Route>
        <Route path="/dashboard/topology">
          {() => <AnimatedPage><ProtectedRoute component={TopologyGraph} /></AnimatedPage>}
        </Route>
        <Route path="/dashboard/incidents">
          {() => <AnimatedPage><ProtectedRoute component={IncidentManagement} /></AnimatedPage>}
        </Route>
        <Route path="/dashboard/pole">
          {() => <AnimatedPage><ProtectedRoute component={POLEAnalytics} /></AnimatedPage>}
        </Route>
        <Route path="/dashboard/realtime">
          {() => <AnimatedPage><ProtectedRoute component={RealtimeWebhooks} /></AnimatedPage>}
        </Route>
        <Route path="/dashboard/settings">
          {() => <AnimatedPage><ProtectedRoute component={Settings} /></AnimatedPage>}
        </Route>
        <Route path="/404">
          {() => <AnimatedPage><NotFound /></AnimatedPage>}
        </Route>
        {/* Final fallback route */}
        <Route>
          {() => <AnimatedPage><NotFound /></AnimatedPage>}
        </Route>
      </Switch>
    </AnimatePresence>
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
