# ELI Unified Dashboard - Project TODO

---
## 🚨 PRIORITY NEXT: Quick Wins for Demo Readiness
---

### Immediate (Next Session)
- [ ] **Create mock data seed script** - Generate 3,084 cameras, sample events, incidents
- [ ] **Add loading skeletons** to ExecutiveDashboard, Map, Topology, Incidents
- [ ] **Implement actual purge logic** - PostgreSQL record deletion based on retention days
- [ ] **Add tag filtering to incident list** - 90% done, just needs UI filter dropdown

### Short-term Polish
- [ ] **Test video playback** in Incident Management with IREX alert videos
- [ ] **Add staggered animations** to dashboard cards and charts
- [ ] **Fix any remaining Peru theme inconsistencies**

---

## Phase 1: Core Infrastructure & Authentication ✅
- [x] Set up database schema for events, snapshots, channels, AI jobs
- [x] Implement hardcoded admin/admin authentication (no OAuth)
- [x] Create base layout with Peru-themed colors (red #D91023, white, dark gray)
- [x] Set up routing structure for all dashboard pages
- [x] Fix JWT token format for hardcoded auth
- [x] Fix cookie SameSite settings for localhost development

## Phase 2: Backend API - Webhook Ingestion ⚙️
- [x] Port /webhook/irex endpoint from ELI-DEMO
- [ ] Port /ingest/event and /ingest/snapshot legacy endpoints
- [x] Implement PostgreSQL integration for events and snapshots
- [ ] Implement Neo4j integration for graph relationships
- [ ] Implement Cloudinary integration for image storage
- [ ] Add mock mode support for development

## Phase 3: Backend API - Dashboard Endpoints ⚙️
- [x] Create /api/dashboard/metrics endpoint (KPIs, stats)
- [x] Create /api/events endpoint (list, filter, search)
- [x] Create /api/snapshots endpoint
- [x] Create /api/cameras endpoint
- [ ] Create /api/graph/topology endpoint (Neo4j data)
- [ ] Create /api/ai/predictive endpoint
- [ ] Create /api/ai/behavior endpoint
- [ ] Create /api/ai/anomaly endpoint

## Phase 4: Frontend - Landing Page ✅
- [x] Create landing page with Peru theme
- [x] Add animated statistics (cameras, regions, events)
- [x] Integrate b-roll video background support
- [x] Add "Enter Dashboard" CTA button
- [x] Remove all sales/marketing content
- [x] Ensure professional government-grade appearance

## Phase 5: Frontend - Executive Dashboard ✅
- [x] Port executive dashboard from eli-dashboard
- [x] Implement KPI cards with real-time data
- [x] Add interactive timeline with zoom functionality
- [x] Integrate Recharts for event distribution
- [x] Add camera activity visualizations
- [x] Implement time-range selector
- [ ] Add identity image viewer with carousel

## Phase 6: Frontend - Geographic Map ✅
- [x] Port geographic map from eli-dashboard
- [x] Integrate Leaflet with terrain features
- [x] Add 3,084 camera markers from IREX mock data
- [x] Implement event location plotting
- [x] Add click-to-view event details
- [x] Create professional legend and controls

## Phase 7: Frontend - Topology Graph ✅
- [x] Port topology graph from eli-dashboard
- [x] Implement react-force-graph-2d integration
- [x] Add 5 layout modes (force, hierarchical, grid, radial, circular)
- [x] Create mini-map navigator
- [x] Add edge click functionality with details panel
- [x] Implement node/edge filtering and search

## Phase 8: Frontend - Incident Management ✅
- [x] Port incident management from IREX-DEMO to React
- [x] Create incident list with filtering (status, priority, region)
- [x] Integrate 10 alert videos from IREX
- [x] Add detailed incident reports
- [x] Implement video playback controls
- [x] Add Peru-specific context (locations, units)

## Phase 9: Frontend - POLE Analytics ✅
- [x] Port POLE analytics from IREX-DEMO to React
- [x] Create D3.js network visualization component
- [x] Implement timeline analysis
- [x] Add pattern recognition dashboard
- [x] Create intelligence assessment panel
- [x] Add entity management (People, Objects, Locations, Events)

## Phase 10: Frontend - Data Management
- [ ] Create data management tables
- [ ] Add search and filtering
- [ ] Implement CRUD operations
- [ ] Add pagination and export functionality

## Phase 11: Frontend - Global Search
- [ ] Implement cross-data-type search
- [ ] Add real-time results with performance metrics
- [ ] Create advanced filtering options

## Phase 12: New Feature - Real-Time Webhook Viewer ✅
- [x] Create /realtime route and page
- [x] Implement WebSocket/SSE integration for live updates
- [x] Design animated event cards (fade-in transitions)
- [x] Add scrolling feed with live counter
- [x] Implement filters (level, module, time)
- [x] Add Framer Motion animations

## Phase 13: New Feature - Data Purge System ✅
- [x] Create /api/purge endpoint
- [ ] Implement Cloudinary image purge logic
- [ ] Implement Neo4j node purge logic
- [ ] Implement PostgreSQL record purge logic
- [x] Add configuration panel in settings
- [x] Create retention slider (1-30 days, default 7)
- [x] Add "Purge Now" button with confirmation modal
- [ ] Implement progress bar with SSE updates

## Phase 14: Theme & Animations ⚙️
- [x] Apply Peru color scheme globally (Tailwind config)
- [ ] Update all components with Peru theme
- [ ] Add Framer Motion to key components
- [ ] Implement staggered chart loads
- [ ] Add hover expansions and modal slides
- [ ] Create graph node pulse animations
- [ ] Ensure responsive mobile-first design

## Phase 15: Mock Data Integration
- [ ] Port IREX mock data generators to TypeScript
- [ ] Create seed scripts for PostgreSQL
- [ ] Create seed scripts for Neo4j
- [ ] Generate 3,084 camera locations
- [ ] Generate Peru-specific regions and stations
- [ ] Create realistic event/incident data

## Phase 16: Testing & Documentation
- [ ] Write comprehensive README.md
- [ ] Document environment variables
- [ ] Create local development setup guide
- [ ] Add Vercel deployment instructions
- [ ] Document API endpoints
- [ ] Add feature overview documentation
- [ ] Test end-to-end webhook flow
- [ ] Test all dashboard views with mock data
- [ ] Verify Peru theme consistency

## Phase 17: Final Polish
- [ ] Add loading skeletons for all data views
- [ ] Implement error boundaries and toasts
- [ ] Add accessibility features (ARIA labels, keyboard nav)
- [ ] Optimize performance (lazy loading, code splitting)
- [ ] Add tooltips and help text
- [ ] Ensure all videos load properly
- [ ] Test local development workflow
- [ ] Prepare for Vercel deployment


## New Feature Request: Incident Notes & Tags ✅
- [x] Update database schema with incident_notes and incident_tags tables
- [x] Create backend API endpoints for notes CRUD operations
- [x] Create backend API endpoints for tags CRUD operations
- [x] Build UI component for adding notes to incidents
- [x] Build UI component for adding/removing tags to incidents
- [x] Display notes timeline in incident detail view
- [x] Display tags as badges in incident cards and detail view
- [ ] Add tag filtering to incident list
- [ ] Test notes and tags functionality

## Follow-Up Features - Incident Management Enhancements
- [ ] Add tag-based filtering to incident list (filter by specific tags)
- [ ] Implement export incident reports to PDF (including notes and tags)
- [ ] Add @mentions in notes to notify specific officers or units
- [ ] Create comment thread feature for team collaboration on incidents
- [ ] Add note edit functionality (currently only add/delete)
- [ ] Implement tag autocomplete from existing tags
- [ ] Add bulk tagging for multiple incidents
- [ ] Create incident activity timeline showing all notes, tags, and status changes
