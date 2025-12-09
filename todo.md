# ELI Dashboard - Pending Tasks

> **Last Updated:** December 9, 2024

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
- [ ] Incidents list displays
- [ ] POLE tabs switch correctly
- [ ] Real-time feed updates
- [ ] Settings page functional

---

## P1 - High Priority

### Visual Enhancements
- [ ] Camera marker clustering - Group nearby cameras at low zoom
- [ ] Real-time event ticker - Scrolling ticker on Executive Dashboard
- [ ] Full-screen mode (F11) - Toggle for presentations

### Map Improvements
- [ ] Region boundary overlays - Show Peru region outlines

### Performance
- [ ] Lazy load heavy pages - React.lazy for Map, Topology, POLE
- [ ] ForceGraph memoization - Prevent unnecessary re-renders

---

## P2 - Medium Priority

### Real-time Updates
- [ ] Live data indicator - Animated "LIVE" badge in header
- [ ] Auto-refresh countdown - Show refresh timer on dashboards
- [ ] New data flash effect - Highlight when new data arrives

### Dashboard Refinements
- [ ] Stat change indicators - Animated +/- on KPI changes
- [ ] Trend sparklines - Mini charts showing 7-day trends
- [ ] Last updated timestamps - "Updated 30 seconds ago"

### Incident Management
- [ ] Tag filtering dropdown - Filter incidents by tag
- [ ] Priority badges animation - Pulse on critical
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

---

## Suggested Improvements

1. Add throttle config history tracking
2. Email alerts when usage exceeds 80%
3. Custom date range picker for historical data
4. Export metrics to CSV
5. Grafana dashboard using InfluxDB data source
6. Webhook rate limiting
7. Neo4j monitoring dashboard
8. Unified storage overview (PostgreSQL, Neo4j, Cloudinary)
9. Automated cleanup CRON jobs based on retention policy

---

## Documentation Tasks

- [ ] Local development guide
- [ ] Deployment instructions
