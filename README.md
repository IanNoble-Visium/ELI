# ELI Unified Dashboard

**Peru's National Surveillance & Intelligence Platform**

A comprehensive, full-stack surveillance dashboard that unifies three separate systems (ELI-DEMO, eli-dashboard, and IREX-DEMO) into a single, cohesive application with real-time webhook processing, advanced analytics, and Peru-themed design.

---

## 🎯 Features

### Core Modules

1. **Executive Dashboard**
   - Real-time KPIs and metrics
   - Interactive timeline with zoom functionality
   - Event distribution charts (Recharts)
   - Regional activity visualization
   - Time-range selector (24h, 7d, 30d, 90d)

2. **Geographic Map**
   - Leaflet integration with OpenStreetMap
   - 3,084 camera markers across 25 Peru regions
   - Real-time event location plotting
   - Interactive camera status (active/inactive/alert)
   - Click-to-view camera details
   - Professional legend and controls

3. **Topology Graph**
   - React-force-graph-2d network visualization
   - 5 layout modes: Force-Directed, Hierarchical, Radial, Grid, Circular
   - Node/edge filtering and search
   - Mini-map navigator
   - Zoom controls and fit-to-screen
   - Color-coded entity types

4. **Incident Management**
   - Real-time alert tracking
   - Filtering by status, priority, and region
   - Video evidence integration
   - Detailed incident reports
   - Officer and unit assignment
   - Peru-specific locations and context

5. **POLE Analytics**
   - People, Objects, Locations, Events analysis
   - Timeline visualization
   - Pattern recognition dashboard
   - Entity relationship tracking
   - Intelligence assessment panel
   - Risk level classification

6. **Real-Time Webhook Viewer**
   - Live event stream with auto-refresh (3s)
   - Animated event cards (Framer Motion)
   - Filters by level and module
   - Pause/resume functionality
   - Live statistics counter

7. **Settings & Data Management**
   - Data retention policy configuration (1-30 days)
   - Manual data purge with confirmation
   - Storage statistics (PostgreSQL, Neo4j, Cloudinary)
   - System information

### Technical Features

- **Hardcoded Authentication**: `admin/admin` for demo purposes
- **Peru Theme**: Red (#D91023), white, and dark gray color scheme
- **Serverless Backend**: tRPC API with Express
- **Database**: PostgreSQL (TiDB) with Drizzle ORM
- **Real-time Updates**: Auto-refresh and live data streaming
- **Responsive Design**: Mobile-first approach with Tailwind CSS 4
- **Animations**: Framer Motion for smooth transitions
- **Charts**: Recharts for data visualization
- **Maps**: Leaflet for geographic visualization
- **Graphs**: react-force-graph-2d for network topology

---

## 🚀 Quick Start

### Prerequisites

- Node.js 22.x
- pnpm 10.x
- PostgreSQL/TiDB database (provided by Manus platform)

### Installation

```bash
# Clone the repository
git clone <repository-url>
cd eli-unified-dashboard

# Install dependencies
pnpm install

# Push database schema
pnpm db:push

# Start development server
pnpm dev
```

The application will be available at `http://localhost:3000`

### Default Credentials

- **Username**: `admin`
- **Password**: `admin`

---

## 📁 Project Structure

```
eli-unified-dashboard/
├── client/                      # Frontend React application
│   ├── public/                  # Static assets
│   ├── src/
│   │   ├── pages/              # Page components
│   │   │   ├── Landing.tsx     # Landing page with Peru theme
│   │   │   ├── Login.tsx       # Login page (admin/admin)
│   │   │   ├── Dashboard.tsx   # Main dashboard selector
│   │   │   ├── ExecutiveDashboard.tsx
│   │   │   ├── GeographicMap.tsx
│   │   │   ├── TopologyGraph.tsx
│   │   │   ├── IncidentManagement.tsx
│   │   │   ├── POLEAnalytics.tsx
│   │   │   ├── RealtimeWebhooks.tsx
│   │   │   └── Settings.tsx
│   │   ├── components/         # Reusable UI components (shadcn/ui)
│   │   ├── lib/                # Utilities and tRPC client
│   │   ├── App.tsx             # Routes and layout
│   │   └── index.css           # Global styles (Peru theme)
├── server/                      # Backend Express + tRPC
│   ├── auth.ts                 # Hardcoded authentication
│   ├── db.ts                   # Database helpers
│   ├── routers.ts              # tRPC procedures
│   └── _core/                  # Framework plumbing
├── drizzle/                     # Database schema and migrations
│   └── schema.ts               # 13 tables for surveillance data
├── package.json
└── README.md
```

---

## 🗄️ Database Schema

The application uses 13 tables:

1. **users** - User authentication and profiles
2. **events** - Surveillance events
3. **snapshots** - Event snapshots/images
4. **channels** - Camera/channel information (3,084 cameras)
5. **ai_inference_jobs** - AI processing jobs
6. **ai_detections** - AI detection results
7. **ai_anomalies** - Anomaly detection
8. **ai_baselines** - Baseline data for AI
9. **ai_insights** - AI-generated insights
10. **incidents** - Incident management
11. **pole_entities** - People, Objects, Locations, Events
12. **webhook_requests** - Incoming webhook logs
13. **system_config** - System configuration

---

## 🎨 Peru Theme

The application uses Peru's national colors:

- **Primary Red**: `#D91023` (Peru flag red)
- **Background**: `#1F2937` (Dark gray)
- **Foreground**: `#F9FAFB` (White)
- **Accents**: Green (#10B981), Blue (#3B82F6), Orange (#F59E0B), Purple (#8B5CF6)

---

## 🔌 API Endpoints

### Authentication
- `POST /api/trpc/auth.login` - Login with admin/admin
- `POST /api/trpc/auth.logout` - Logout
- `GET /api/trpc/auth.me` - Get current user

### Dashboard
- `GET /api/trpc/dashboard.metrics` - Get KPIs and statistics

### Events
- `GET /api/trpc/events.list` - List events with pagination
- `GET /api/trpc/events.byId` - Get event by ID

### Webhooks
- `POST /webhook/irex` - Receive IREX webhook events
- `GET /api/trpc/webhook.recent` - Get recent webhook requests

### Configuration
- `GET /api/trpc/config.get` - Get system configuration
- `POST /api/trpc/config.set` - Update system configuration

---

## 🎬 Demo Data

The application includes mock data for demonstration:

- **3,084 cameras** across 25 Peru regions
- **8 major regions**: Lima, Cusco, Arequipa, Trujillo, Piura, Chiclayo, Iquitos, Huancayo
- **Mock incidents** with priorities and statuses
- **POLE entities**: People, Objects, Locations, Events
- **Network graph** with 87 nodes and 80 edges

---

## 🚢 Deployment

### Vercel Deployment

1. Push code to GitHub
2. Connect repository to Vercel
3. Configure environment variables (automatically provided by Manus)
4. Deploy

### Environment Variables

#### Platform-Provided (Auto-configured)

- `DATABASE_URL` - MySQL/TiDB connection string
- `JWT_SECRET` - Session cookie signing secret
- `VITE_APP_ID` - Manus OAuth application ID
- `OAUTH_SERVER_URL` - Manus OAuth backend
- `VITE_OAUTH_PORTAL_URL` - Manus login portal
- `VITE_APP_TITLE` - Application title
- `VITE_APP_LOGO` - Application logo URL

#### External Services (User-Configured via Settings → Secrets)

**PostgreSQL Database:**
- `POSTGRES_URL` - PostgreSQL connection string for primary data storage

**Neo4j Graph Database:**
- `NEO4J_PROJECT_NAME` - Project name
- `NEO4J_ID` - Instance ID
- `NEO4J_URI` - Connection URI (neo4j+s://...)
- `NEO4J_USERNAME` - Database username
- `NEO4J_PASSWORD` - Database password
- `NEO4J_DATABASE` - Database name

**Cloudinary (Image Storage):**
- `CLOUDINARY_URL` - Full connection URL
- `CLOUDINARY_CLOUD_NAME` - Cloud name
- `CLOUDINARY_API_KEY` - API key
- `CLOUDINARY_API_SECRET` - API secret

**Google Services:**
- `GOOGLE_API_KEY` - For Maps and location services

**Recraft (Icon Generation):**
- `RECRAFT_API_KEY` - API key
- `ICON_GENERATION_API` - Set to "recraft"

**Note:** All external service credentials are managed through the Manus platform's Settings → Secrets panel. Never commit credentials to version control.

---

## 🧪 Testing

```bash
# Run tests
pnpm test

# Type checking
pnpm check

# Format code
pnpm format
```

---

## 📦 Dependencies

### Frontend
- React 19.1.1
- Vite 7.1.7
- Tailwind CSS 4.1.14
- Framer Motion 12.23.22
- Recharts 2.15.2
- Leaflet 1.9.4
- react-force-graph-2d 1.29.0
- date-fns 4.1.0
- shadcn/ui components

### Backend
- Express 4.21.2
- tRPC 11.6.0
- Drizzle ORM 0.44.5
- Jose 6.1.0 (JWT)
- Zod 4.1.12 (validation)

---

## 🎯 Key Differences from Original Repos

### From ELI-DEMO
- ✅ Webhook ingestion endpoint (`/webhook/irex`)
- ✅ PostgreSQL event/snapshot storage
- ❌ Neo4j integration (schema ready, not connected)
- ❌ Cloudinary integration (schema ready, not connected)

### From eli-dashboard
- ✅ Executive dashboard with KPIs
- ✅ Geographic map with Leaflet
- ✅ Topology graph with force-directed layout
- ✅ All visualizations ported to React

### From IREX-DEMO
- ✅ Incident management ported to React
- ✅ POLE analytics ported to React
- ✅ Peru-specific mock data (3,084 cameras)
- ✅ 10 alert videos integrated

### New Features
- ✅ Real-time webhook viewer with live updates
- ✅ Data purge configuration panel
- ✅ Hardcoded admin/admin authentication
- ✅ Unified Peru theme across all pages
- ✅ Serverless-ready architecture

---

## 🛠️ Development Tips

### Adding New Pages

1. Create page component in `client/src/pages/`
2. Add route in `client/src/App.tsx`
3. Add navigation link in `client/src/pages/Dashboard.tsx`

### Adding New API Endpoints

1. Add procedure to `server/routers.ts`
2. Add database helper to `server/db.ts` if needed
3. Update schema in `drizzle/schema.ts` if needed
4. Run `pnpm db:push` to apply schema changes

### Customizing Theme

Edit `client/src/index.css` to change colors:

```css
:root {
  --primary: 0 71% 47%; /* Peru red */
  --background: 222 47% 11%; /* Dark gray */
  /* ... */
}
```

---

## 📝 TODO

### High Priority
- [ ] Connect Neo4j for topology graph real data
- [ ] Connect Cloudinary for image storage
- [ ] Implement actual data purge logic
- [ ] Add WebSocket for true real-time updates

### Medium Priority
- [ ] Add data management tables (CRUD)
- [ ] Implement global search across all entities
- [ ] Add export functionality (PDF, CSV)
- [ ] Implement role-based access control

### Low Priority
- [ ] Add identity image carousel
- [ ] Implement advanced filtering
- [ ] Add notification system
- [ ] Create mobile app version

---

## 🤝 Contributing

This is a demo application for the Peru government. For production use, please:

1. Replace hardcoded authentication with proper OAuth
2. Connect Neo4j and Cloudinary services
3. Implement proper data purge logic
4. Add comprehensive error handling
5. Implement proper logging and monitoring

---

## 📄 License

MIT License - See LICENSE file for details

---

## 👥 Credits

**Developed by**: Manus AI  
**For**: Peru National Surveillance Program  
**Based on**: ELI-DEMO, eli-dashboard, IREX-DEMO repositories  
**Demo Date**: December 2024

---

## 🆘 Support

For issues or questions:
- Submit feedback at https://help.manus.im
- Check the TODO list in `todo.md`
- Review the original repositories for reference

---

**Built with ❤️ for Peru's National Security**
