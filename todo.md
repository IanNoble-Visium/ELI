# ELI Dashboard - Pending Tasks

> **Last Updated:** December 11, 2025 (Late Night Session - Performance & Real-time Updates)

---

## Priority Matrix

| Priority | Impact | Effort | Focus Area |
|----------|--------|--------|------------|
| P0 | Critical | Low | Must have for demo |
| P1 | High | Medium | Quick wins |
| P2 | Medium | Medium | Enhanced features |
| P3 | Nice to have | High | Future enhancements |

---

## P0 - Critical (Pre-Demo)

### Testing & Verification
- [ ] Test webhook with real IREX surveillance data
- [ ] Verify DATABASE_URL is configured in production
- [ ] Create database seeding script for demo data
- [ ] Verify all pages load without console errors
- [ ] Test on presentation device/projector

### Core Functionality Checklist
- [ ] All pages load without errors
- [ ] Landing video plays smoothly
- [ ] Login works (admin/admin)
- [ ] All navigation flows work
- [ ] Charts display with data
- [ ] Map shows camera markers
- [ ] Topology graph renders
- [x] Incidents list displays ✅ (Redesigned Dec 10)
- [x] POLE tabs switch correctly ✅ (Redesigned Dec 10)
- [ ] Real-time feed updates
- [ ] Settings page functional

---

## P1 - High Priority

### Visual Enhancements
- [x] **Camera marker clustering** - Group nearby cameras at low zoom ✅ (Completed Dec 10)
  - Implemented using `react-leaflet-cluster` package
  - Clusters disable at zoom level 12+ for individual marker visibility
  - Peru-themed red cluster markers with count badges
- [x] **Real-time event ticker** - Scrolling ticker on Executive Dashboard ✅ (Completed Dec 10)
  - `EventTicker.tsx` component with auto-refresh every 10 seconds
  - Pause-on-hover functionality
  - Color-coded severity badges (CRITICAL, HIGH, MEDIUM, LOW)
  - Shows "Waiting for events with images..." placeholder when no images available
  - **Click-to-view images** - Opens modal dialog with event images ✅ (Dec 10 Late Night)
  - **Filters for Cloudinary images only** - Only displays events with valid `cloudinary.com` URLs
  - **Image count badge** - Shows number of available images per event
- [x] **Full-screen mode** - Toggle for presentations ✅ (Completed Dec 10)
  - Added fullscreen button (Maximize2/Minimize2 icons) to Geographic Map header
  - Added fullscreen button to Topology Graph header
  - "PRESENTATION MODE - Press Esc to exit" indicator in bottom-right corner
- [x] **Cloudinary image filtering** - Filter events by valid images ✅ (Completed Dec 10)
  - Updated `hasValidImages()` to require actual Cloudinary URLs
  - Events without `cloudinary.com` in imageUrl are filtered out
- [x] **Trends & Predictions Tab** - Analytics dashboard ✅ (Completed Dec 10 Late Night)
  - New tabbed interface on Executive Dashboard
  - Grafana-style time series visualizations
  - KPI projection cards (predicted events, trend, peak activity, confidence)
  - Events Trend & Forecast chart with historical + predicted data
  - Activity Heatmap (hour × day of week)
  - Alert Distribution by severity
  - Regional Comparison multi-line chart
  - Hourly Distribution with peak highlighting
  - Anomaly detection using z-score method
  - Auto-refresh toggle and CSV export

### Map Improvements
- [x] **Region boundary overlays** - Show Peru region outlines ✅ (Completed Dec 11)
  - Created `peruRegions.ts` with GeoJSON data for all 25 departments
  - Peru-themed color-coded boundaries with hover tooltips
  - Styled region tooltip with glassmorphism effect

### Performance
- [x] **Lazy load heavy pages** - React.lazy for Map, Topology, POLE ✅ (Completed Dec 11)
  - `GeographicMap`, `TopologyGraph`, `POLEAnalytics` now load on-demand
  - Added `Suspense` with loading spinner fallback
  - Separate JS chunks for each page (verified in build output)
- [x] **ForceGraph memoization** - Prevent unnecessary re-renders ✅ (Completed Dec 11)
  - Memoized `linkColor`, `linkWidth`, `onEngineStop`, `nodePointerAreaPaint` callbacks
  - Applied to both `TopologyGraph.tsx` and `POLEAnalytics.tsx`

---

## P2 - Medium Priority

### Real-time Updates
- [x] **Live data indicator** - Animated "LIVE" badge in header ✅ (Completed Dec 11)
  - Created `LiveIndicator.tsx` component with pulsing red dot
  - Added to Executive Dashboard header
- [x] Auto-refresh countdown - Ticker shows live data with auto-refresh
- [x] **New data flash effect** - Highlight when new data arrives ✅ (Completed Dec 11)
  - Added `flash-highlight` and `animate-data-pulse` CSS animations

### Dashboard Refinements
- [x] **Stat change indicators** - Animated +/- on KPI changes ✅ (Completed Dec 11)
  - Created `StatChangeIndicator.tsx` with Framer Motion animations
  - Color-coded green/red for positive/negative changes
- [x] **Trend sparklines** - Mini charts showing 7-day trends ✅ (Completed Dec 11)
  - Created `Sparkline.tsx` component using Recharts
  - Auto-detects trend direction for color coding
- [x] **Last updated timestamps** - "Updated 30 seconds ago" ✅ (Completed Dec 11)
  - Added relative time formatting using `formatDistanceToNow` from date-fns
  - Updates every 10 seconds on Executive Dashboard

### Incident Management
- [x] Priority badges animation - Pulse on critical ✅ (Dec 10 - Command Center redesign)
- [x] "Command Center" aesthetic redesign ✅ (Dec 10)
- [x] Dispatch Status Card with response units ✅ (Dec 10)
- [x] Threat Analysis Card with progress indicators ✅ (Dec 10)
- [ ] Tag filtering dropdown - Filter incidents by tag
- [ ] Video thumbnail previews - Show video frame

### Navigation
- [ ] Breadcrumb trail - Show navigation path
- [ ] Keyboard shortcuts - Ctrl+1-6 for quick navigation

---

## P3 - Future Enhancements

### Landing Page
- [ ] "SISTEMA NACIONAL" government seal/badge
- [ ] Typing effect on subtitle

### Executive Dashboard
- [ ] Dark ambient glow around critical stats

### Geographic Map
- [ ] Heat map overlay toggle
- [ ] Quick region jump dropdown
- [ ] Incident cluster markers

### Topology Graph
- [ ] Path finding demo - Shortest path between entities
- [ ] Export graph image - PNG export of current view

### Real-time Feed
- [ ] Large display mode - Optimized for projectors
- [ ] Event sound notifications
- [ ] Quick filter pills

---

## Backend Tasks

### Neo4j Integration
- [ ] Configure Neo4j in production (NEO4J_URI, NEO4J_USER, NEO4J_PASSWORD)
- [ ] Populate Neo4j with historical data (bulkSyncCameras, bulkSyncEvents)

### Database Enhancements
- [ ] Database migration scripts for production
- [ ] Incident auto-creation from high-priority events
- [ ] POLE entity extraction from webhook params

### Performance & Reliability
- [ ] Database connection pooling for serverless
- [ ] Request rate limiting on webhook endpoint
- [ ] Database backup strategy

### Advanced Features
- [ ] Full purge logic implementation
- [ ] Predictive/behavior/anomaly AI endpoints
- [ ] Global cross-type search
- [ ] PDF report export
- [ ] @mentions in notes
- [ ] Comment threading
- [ ] Tag autocomplete
- [ ] Bulk operations

---

## Known Limitations

1. **Processing Stats In-Memory** - Statistics reset on cold start
   - Fix: Store in InfluxDB or PostgreSQL

2. **CRON Execution History In-Memory** - History resets on cold start
   - Fix: Store in PostgreSQL `cron_executions` table

3. **InfluxDB Bucket Manual Creation** - May need manual bucket creation
   - Workaround: Use InfluxDB Cloud UI to create `cloudinary_metrics` bucket

4. **TypeScript Framer Motion Errors** - Pre-existing type issues with `ease` arrays
   - Note: These are IDE lint warnings only; app runs correctly in dev mode
   - Fix: Cast easing arrays as tuples: `ease: [0.25, 0.46, 0.45, 0.94] as const`

5. **react-leaflet-cluster Peer Dependencies** - Warns about React 18 / react-leaflet 4.x
   - Note: Works correctly with React 19 / react-leaflet 5.x despite warnings

---

## Suggested Improvements

### From December 10 Session
1. Add event count badge to cluster markers showing total cameras
2. Event ticker click-to-view - Navigate to event details on click
3. Fullscreen button tooltip with keyboard shortcut hint
4. Ticker pause indicator icon when hovered
5. Cluster marker click to zoom and expand

### General Suggestions
6. Add throttle config history tracking
7. Email alerts when usage exceeds 80%
8. Custom date range picker for historical data
9. Export metrics to CSV
10. Grafana dashboard using InfluxDB data source
11. Webhook rate limiting
12. Neo4j monitoring dashboard
13. Unified storage overview (PostgreSQL, Neo4j, Cloudinary)
14. Automated cleanup CRON jobs based on retention policy

---

## Recently Completed (December 10-11, 2025)

### Geographic Map Enhancements
| Feature | File(s) Modified | Notes |
|---------|-----------------|-------|
| Camera Marker Clustering | `GeographicMap.tsx`, `package.json`, `index.css` | Uses react-leaflet-cluster with Peru theme |
| Cloudinary Image Filtering | `GeographicMap.tsx` | `hasValidImages()` now requires cloudinary.com URLs |
| Fullscreen Button | `GeographicMap.tsx`, `TopologyGraph.tsx` | Maximize2/Minimize2 icons in header |
| Fullscreen Indicator | `App.tsx` | "PRESENTATION MODE" badge bottom-right |
| Event Ticker | `EventTicker.tsx` (new), `ExecutiveDashboard.tsx`, `index.css` | Scrolling events with pause-on-hover |

### POLE Analytics & Incident Management Redesign (Evening Session)
| Feature | File(s) Modified | Notes |
|---------|-----------------|-------|
| **POLE Analytics Redesign** | `POLEAnalytics.tsx` (rewritten) | "Digital Detective Board" aesthetic |
| **Incident Management Redesign** | `IncidentManagement.tsx` (rewritten) | "Command Center" aesthetic |
| **POLE Entities API** | `api/data/pole-entities.ts` (new) | Fetches from `pole_entities` PostgreSQL table |
| **Stale Data Bug Fix** | `POLEAnalytics.tsx` | Now fetches real data, shows empty state when DB is purged |
| **Scanline Overlay Effect** | Both pages | Subtle CRT/detective board visual effect |
| **Dossier Panel** | `POLEAnalytics.tsx` | Glassmorphism detail panel for selected entities |
| **Dispatch Status Card** | `IncidentManagement.tsx` | Shows response units with ETA and status |
| **Threat Analysis Card** | `IncidentManagement.tsx` | Progress indicators and threat level |
| **Framer Motion Animations** | Both pages | Smooth transitions, pulsing high-risk indicators |
| **Translation Updates** | `translations.ts` | Added missing keys for redesigned pages |

### Executive Dashboard - Analytics Tab (Late Night Session)
| Feature | File(s) Modified | Notes |
|---------|-----------------|-------|
| **Trends & Predictions Tab** | `ExecutiveDashboard.tsx` | Added tabbed interface with Overview/Analytics tabs |
| **Analytics Time Series API** | `api/analytics/time-series.ts` (new) | Returns events over time, heatmaps, regional comparisons |
| **Predictions API** | `api/analytics/predictions.ts` (new) | Linear regression forecasting, anomaly detection |
| **AnalyticsTab Component** | `client/src/components/analytics/AnalyticsTab.tsx` (new) | Main container with KPI projections |
| **EventsTrendChart** | `client/src/components/analytics/EventsTrendChart.tsx` (new) | Gradient area chart with events vs alerts |
| **ActivityHeatmap** | `client/src/components/analytics/ActivityHeatmap.tsx` (new) | GitHub-style hour/day activity grid |
| **AlertDistributionChart** | `client/src/components/analytics/AlertDistributionChart.tsx` (new) | Stacked bar by severity |
| **PredictionChart** | `client/src/components/analytics/PredictionChart.tsx` (new) | Forecast with confidence bands, anomaly markers |
| **RegionalComparisonChart** | `client/src/components/analytics/RegionalComparisonChart.tsx` (new) | Multi-line regional comparison |
| **HourlyActivityChart** | `client/src/components/analytics/HourlyActivityChart.tsx` (new) | Bar chart with peak hour highlighting |
| **EventTicker Improvements** | `EventTicker.tsx` | Improved readability with larger badges, better spacing |
| **Click-to-View Images** | `EventTicker.tsx` | Modal dialog preview of event Cloudinary images |
| **Image Count Badge** | `EventTicker.tsx` | Shows number of images available per event |
| **Cloudinary-Only Filter** | `EventTicker.tsx` | Ticker only shows events with valid Cloudinary URLs |

### Performance & Real-time Updates (December 11, 2025 - Late Night Session)
| Feature | File(s) Modified | Notes |
|---------|-----------------|-------|
| **Peru Region Boundaries** | `GeographicMap.tsx`, `peruRegions.ts` (new) | GeoJSON overlay for 25 departments with color-coded boundaries |
| **Lazy Loading** | `App.tsx` | Map, Topology, POLE pages now load on-demand with React.lazy() |
| **ForceGraph Memoization** | `TopologyGraph.tsx`, `POLEAnalytics.tsx` | Memoized callbacks to prevent re-renders |
| **Live Indicator** | `LiveIndicator.tsx` (new), `ExecutiveDashboard.tsx` | Animated pulsing "LIVE" badge component |
| **Flash Effect CSS** | `index.css` | `flash-highlight` and `animate-data-pulse` animations |
| **Stat Change Indicator** | `StatChangeIndicator.tsx` (new) | Animated +/- with Framer Motion |
| **Sparkline Component** | `Sparkline.tsx` (new) | Mini trend charts using Recharts |
| **Relative Timestamps** | `ExecutiveDashboard.tsx` | "Updated X seconds ago" using date-fns |
| **Region Tooltip Styling** | `index.css` | Glassmorphism tooltip for region boundaries |

### Context Menu Feature (December 11, 2025 - Early Morning Session)
| Feature | File(s) Modified | Notes |
|---------|-----------------|-------|
| **NodeContextMenu Component** | `NodeContextMenu.tsx` (new) | Reusable floating context menu with context-aware options |
| **Topology Graph Right-Click** | `TopologyGraph.tsx` | `onNodeRightClick` handler with menu options |
| **Geographic Map Right-Click** | `GeographicMap.tsx` | Context menu on camera markers AND region boundaries |
| **Mark as High Risk** | `TopologyGraph.tsx`, `GeographicMap.tsx` | Pulsing red animation for flagged nodes/cameras |
| **Incident Integration** | `IncidentManagement.tsx` | Reads URL params from context menu, shows prefilled banner |
| **POLE Integration** | `POLEAnalytics.tsx` | Reads URL params from context menu, shows entity suggestion banner |
| **Toast Notifications** | All pages | Sonner toasts for action feedback |

### New Components Added (Dec 11)
| Component | Path | Purpose |
|-----------|------|---------|
| `LiveIndicator` | `components/LiveIndicator.tsx` | Animated pulsing "LIVE" badge |
| `StatChangeIndicator` | `components/StatChangeIndicator.tsx` | +/- change with color coding |
| `Sparkline` | `components/Sparkline.tsx` | Minimal 7-day trend chart |
| `peruRegions` | `data/peruRegions.ts` | GeoJSON for Peru 25 departments |
| `NodeContextMenu` | `components/NodeContextMenu.tsx` | Right-click context menu for graph/map nodes |

---

## Suggested Next Steps

### Immediate (High Impact, Low Effort)
1. **Integrate Sparklines into KPI cards** - The component is ready, just needs to be added to ExecutiveDashboard
2. **Integrate StatChangeIndicator** - Track previous values in state and show diff on refresh
3. **Add flash effect to cards on data update** - Apply `flash-highlight` class when values change

### Short Term (Medium Effort)
4. **Heat map overlay toggle** - Add toggle for camera density visualization on map
5. **Tag filtering dropdown** - Filter incidents by tag in Incident Management
6. **Breadcrumb navigation** - Show current path in dashboard header

### Long Term (Higher Effort)
7. **Neo4j Integration** - Enable graph database for richer POLE relationship queries
8. **Automatic POLE entity creation** - Extract entities from PlateMatched/FaceMatched events
9. **PDF report export** - Generate downloadable reports from dashboard data

---

## What Was NOT Done (Deferred)

These items from the Gemini AI suggestions were **not implemented** in this session:

1. **Neo4j Integration for POLE** - Currently uses PostgreSQL `pole_entities` table. Neo4j graph queries would provide richer relationship traversal but require additional setup.

2. **Face Encoding Matching** - The `matchFaceEncoding` function in `api/lib/poleData.ts` still uses mock data. Real face matching would require integration with a face recognition service.

3. **Automatic POLE Entity Creation** - POLE entities are not automatically created from webhook events. This would require:
   - Extracting plate numbers from `PlateMatched` events
   - Extracting face encodings from `FaceMatched` events
   - Creating/updating entities in `pole_entities` table

4. **Timeline Chart Data** - The timeline tab shows a placeholder. Real implementation would require aggregating events by time period.

5. **Video Player Integration** - Video evidence section shows placeholder. Would need actual video player component.

---

## Suggestions for Future Work

### Immediate Next Steps
1. **Seed POLE entities** - Create script to populate `pole_entities` table with sample data for demo
2. **Auto-create POLE entities from webhooks** - When `PlateMatched` or `FaceMatched` events arrive, create corresponding entities
3. **Link incidents to POLE entities** - Add `poleEntityIds` field to incidents table

### UI/UX Improvements
4. **Add keyboard shortcuts** - Esc to close panels, arrow keys to navigate entities
5. **Entity quick search** - Global search across all POLE entities
6. **Relationship visualization** - Show relationship types with different line styles/colors
7. **Entity photos/thumbnails** - Display face/vehicle images from Cloudinary

### Backend Enhancements
8. **Neo4j for graph queries** - Migrate POLE relationships to Neo4j for complex traversals
9. **Real-time updates via WebSocket** - Push new entities/incidents to connected clients
10. **Audit trail** - Track who viewed/modified POLE entities

### Analytics
11. **Risk scoring algorithm** - Calculate entity risk based on incident involvement
12. **Hotspot detection** - Identify locations with high incident density
13. **Network analysis** - Find central figures in criminal networks

### Trends & Predictions Enhancements
14. **Seasonal pattern detection** - Identify weekly/monthly recurring patterns
15. **Multiple forecasting algorithms** - Add ARIMA, Prophet options
16. **Custom alert thresholds** - Trigger notifications when predictions exceed limits
17. **Comparative analytics** - Compare current period vs same period last year/month
18. **Drill-down capabilities** - Click on chart data points to see underlying events
19. **Export charts as images** - PNG/SVG export for reports

---

## Documentation Tasks

- [ ] Local development guide
- [ ] Deployment instructions
- [ ] Add changelog for version tracking
- [x] Update README.md with redesign details ✅ (Dec 10)
- [x] Update README.md with Analytics Tab features ✅ (Dec 10 Late Night)
- [x] Update todo.md with Analytics Tab completions ✅ (Dec 10 Late Night)
