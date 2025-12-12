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
import IncidentManagement from "./pages/IncidentManagement";
import RealtimeWebhooks from "./pages/RealtimeWebhooks";
import Settings from "./pages/Settings";
import CloudinaryMonitoring from "./pages/CloudinaryMonitoring";
import PostgreSQLMonitoring from "./pages/PostgreSQLMonitoring";
import ImageAnalysisDashboard from "./pages/ImageAnalysisDashboard";
import { useAuth } from "./_core/hooks/useAuth";
import { motion, AnimatePresence } from "framer-motion";
import { useEffect, useState, lazy, Suspense } from "react";

// Lazy load heavy pages for better performance
const GeographicMap = lazy(() => import("./pages/GeographicMap"));
const TopologyGraph = lazy(() => import("./pages/TopologyGraph"));
const POLEAnalytics = lazy(() => import("./pages/POLEAnalytics"));
const SharedReport = lazy(() => import("./pages/SharedReport"));

// Lazy load agent dashboards
const TimelineAgentDashboard = lazy(() => import("./pages/TimelineAgentDashboard"));
const CorrelationAgentDashboard = lazy(() => import("./pages/CorrelationAgentDashboard"));

// Loading fallback component for lazy-loaded pages
function PageLoadingFallback() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="text-center space-y-4">
        <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
        <p className="text-muted-foreground">Loading page...</p>
      </div>
    </div>
  );
}

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
      ease: [0.25, 0.46, 0.45, 0.94] as [number, number, number, number], // ease-out-quad
    },
  },
  exit: {
    opacity: 0,
    y: -10,
    transition: {
      duration: 0.2,
      ease: [0.55, 0.06, 0.68, 0.19] as [number, number, number, number], // ease-in-quad
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
          {() => (
            <Suspense fallback={<PageLoadingFallback />}>
              <AnimatedPage><ProtectedRoute component={GeographicMap} /></AnimatedPage>
            </Suspense>
          )}
        </Route>
        <Route path="/dashboard/topology">
          {() => (
            <Suspense fallback={<PageLoadingFallback />}>
              <AnimatedPage><ProtectedRoute component={TopologyGraph} /></AnimatedPage>
            </Suspense>
          )}
        </Route>
        <Route path="/dashboard/incidents">
          {() => <AnimatedPage><ProtectedRoute component={IncidentManagement} /></AnimatedPage>}
        </Route>
        <Route path="/dashboard/pole">
          {() => (
            <Suspense fallback={<PageLoadingFallback />}>
              <AnimatedPage><ProtectedRoute component={POLEAnalytics} /></AnimatedPage>
            </Suspense>
          )}
        </Route>
        <Route path="/dashboard/realtime">
          {() => <AnimatedPage><ProtectedRoute component={RealtimeWebhooks} /></AnimatedPage>}
        </Route>
        <Route path="/dashboard/settings">
          {() => <AnimatedPage><ProtectedRoute component={Settings} /></AnimatedPage>}
        </Route>
        <Route path="/dashboard/cloudinary">
          {() => <AnimatedPage><ProtectedRoute component={CloudinaryMonitoring} /></AnimatedPage>}
        </Route>
        <Route path="/dashboard/postgresql">
          {() => <AnimatedPage><ProtectedRoute component={PostgreSQLMonitoring} /></AnimatedPage>}
        </Route>
        <Route path="/dashboard/analysis">
          {() => <AnimatedPage><ProtectedRoute component={ImageAnalysisDashboard} /></AnimatedPage>}
        </Route>
        <Route path="/dashboard/agents/timeline">
          {() => (
            <Suspense fallback={<PageLoadingFallback />}>
              <AnimatedPage><ProtectedRoute component={TimelineAgentDashboard} /></AnimatedPage>
            </Suspense>
          )}
        </Route>
        <Route path="/dashboard/agents/correlation">
          {() => (
            <Suspense fallback={<PageLoadingFallback />}>
              <AnimatedPage><ProtectedRoute component={CorrelationAgentDashboard} /></AnimatedPage>
            </Suspense>
          )}
        </Route>
        <Route path="/share/report/:token">
          {() => (
            <Suspense fallback={<PageLoadingFallback />}>
              <AnimatedPage><SharedReport /></AnimatedPage>
            </Suspense>
          )}
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
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Track fullscreen state for visual indicator
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="dark">
        <TooltipProvider>
          <Toaster />
          <Router />
          {/* Fullscreen indicator */}
          {isFullscreen && (
            <div className="fixed bottom-4 right-4 z-50 bg-primary/90 text-primary-foreground px-3 py-1.5 rounded-full text-xs font-medium flex items-center gap-2 animate-pulse">
              <span className="w-2 h-2 bg-white rounded-full" />
              PRESENTATION MODE - Press Esc to exit
            </div>
          )}
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
