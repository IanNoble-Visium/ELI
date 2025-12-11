# ELI Unified Dashboard

> **Last Updated:** December 11, 2025 (Context Menu Feature Release)

## Executive Summary – ELI for Peru

**What ELI Does**
ELI is Peru’s national “single pane of glass” for security and intelligence, unifying camera networks, analytics systems, and incident reports across the country into one live dashboard. It allows national and regional leaders to see what is happening now, where it is happening, and how risks are evolving over time.

**Why It Is Useful for Peru**
- Strengthens situational awareness for the National Police, Armed Forces, and civil protection by giving them a shared, real-time picture of incidents and risks across all regions.
- Reduces response time by linking alerts, maps, video evidence, and incident reports in a single, coordinated workflow.
- Supports strategic decision-making by turning millions of individual events into clear trends, hotspots, and risk indicators that can be discussed at the ministerial and national security level.

**Where We Are Going Next**
Over the next phases, ELI will evolve from a unified viewer into a full intelligence platform for Peru by:
- Adding graph-based intelligence to understand how people, vehicles, locations, and events are connected.
- Building a secure evidence pipeline for storing and reviewing video and images at national scale.
- Expanding AI and predictive analytics to highlight anomalies early and anticipate emerging threats.
- Integrating more deeply with existing national programs and command centers, so ELI becomes the common operating picture for Peru’s security institutions.

**Peru's National Surveillance & Intelligence Platform**

A comprehensive, full-stack surveillance dashboard that unifies three separate systems (ELI-DEMO, eli-dashboard, and IREX-DEMO) into a single, cohesive application with real-time webhook processing, advanced analytics, and Peru-themed design.

![ELI Unified Dashboard High-Level Architecture showing system components and integrations](docs/images/ELI-DIAGRAM-HighLevelArchttecture.jpeg)

---

## 🎯 Features

### Core Modules

1. **Executive Dashboard**
   - Real-time KPIs and metrics
   - **Live event ticker** - Scrolling real-time events with clickable image preview
     - Filters for events with Cloudinary images only
     - Click to view event images in modal dialog
     - Pause-on-hover functionality
   - **Trends & Predictions Tab** *(New Dec 2025)*
     - Grafana-style time series visualizations
     - **KPI Projection Cards**: Predicted events, trend direction, peak activity, confidence level
     - **Events Trend & Forecast Chart**: Historical data with predicted future values
     - **Activity Heatmap**: GitHub-style hour/day activity patterns
     - **Alert Distribution Chart**: Stacked bar by severity level
     - **Regional Comparison Chart**: Multi-line comparison across regions
     - **Hourly Distribution Chart**: Bar chart with peak hour highlighting
     - **Anomaly Detection**: Identifies unusual patterns using z-score method
     - Time range selector (24h, 7d, 30d, 90d)
     - Auto-refresh toggle and CSV export
   - Interactive timeline with zoom functionality
   - Event distribution charts (Recharts)
   - Regional activity visualization

2. **Geographic Map**
   - Leaflet integration with OpenStreetMap
   - 3,084 camera markers across 25 Peru regions
   - **Camera marker clustering** - Groups nearby cameras at low zoom (react-leaflet-cluster)
   - **Region boundary overlays** *(New Dec 2025)* - GeoJSON Peru department boundaries with tooltips
   - Real-time event location plotting
   - Interactive camera status (active/inactive/alert)
   - Click-to-view camera details
   - **Fullscreen presentation mode** - Toggle button for clean presentations
   - **Cloudinary image filtering** - Only displays events with valid Cloudinary images
   - **Right-click context menu** *(New Dec 2025)* - Actions for cameras and region boundaries
   - **Mark as High Risk** *(New Dec 2025)* - Flag cameras with pulsing red animation
   - Professional legend and controls

3. **Topology Graph**
   - React-force-graph-2d network visualization
   - 5 layout modes: Force-Directed, Hierarchical, Radial, Grid, Circular
   - Node/edge filtering and search
   - **Image nodes** - Events display Cloudinary images as node thumbnails
   - **Right-click context menu** *(New Dec 2025)* - Context-aware actions on any node
   - **Mark as High Risk** *(New Dec 2025)* - Flag nodes with pulsing red animation
   - **Fullscreen presentation mode** - Toggle button for clean presentations
   - **Memoized rendering** *(New Dec 2025)* - Optimized callbacks prevent unnecessary re-renders
   - Mini-map navigator
   - Zoom controls and fit-to-screen
   - Color-coded entity types

4. **Incident Management** *(Redesigned Dec 2024)*
   - **"Command Center" aesthetic** with dark theme and glassmorphism
   - Real-time incident tracking with **live database fetching**
   - **Dispatch Status Card** showing response units with ETA
   - **Threat Analysis Card** with progress indicators
   - Filtering by status, priority, and region
   - Video evidence integration
   - Notes and tags management (tRPC)
   - Quick navigation to Map, Topology, and POLE Analysis
   - **Context menu integration** *(New Dec 2025)* - Receives prefilled data from Topology/Map
   - **Framer Motion animations** throughout
   - **Empty state handling** when no incidents exist

5. **POLE Analytics** *(Redesigned Dec 2024)*
   - **"Digital Detective Board" aesthetic** with scanline overlay
   - **Real database integration** - fetches from `pole_entities` table via API
   - **Empty state handling** - shows informative message when database is empty (fixes stale data bug)
   - Interactive force-directed graph with **custom node rendering**
   - Node shapes by entity type (circle=person, diamond=object, square=location, triangle=event)
   - **Pulsing indicators** for high-risk entities
   - **Dossier-style detail panel** with entity information
   - Timeline visualization
   - Entity list with search
   - **Context menu integration** *(New Dec 2025)* - Receives prefilled entity data from Topology/Map
   - **Framer Motion animations** throughout
   - **Language toggle** (English/Spanish)

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
- **Live Indicator**: Animated "LIVE" badge with pulsing red dot
- **Relative Timestamps**: "Updated X seconds ago" using date-fns
- **Lazy Loading** *(New Dec 2025)*: React.lazy() for heavy pages (Map, Topology, POLE)
- **Responsive Design**: Mobile-first approach with Tailwind CSS 4
- **Animations**: Framer Motion for smooth transitions
- **Charts**: Recharts for data visualization (including Sparklines)
- **Maps**: Leaflet for geographic visualization with GeoJSON layers
- **Graphs**: react-force-graph-2d with memoized rendering
- **Context Menus**: Custom floating menus with Framer Motion animations
- **Toast Notifications**: Sonner for action feedback

---

## 🖱️ Context Menu System *(New Dec 2025)*

The context menu feature enables rich right-click interactions across the Topology Graph and Geographic Map screens.

### Flow Diagram

```mermaid
flowchart TB
    subgraph "Context Menu Trigger"
        T1["Right-click Node\n(Topology Graph)"] 
        T2["Right-click Camera\n(Geographic Map)"]
        T3["Right-click Region\n(Geographic Map)"]
    end
    
    T1 --> CM[NodeContextMenu Component]
    T2 --> CM
    T3 --> CM
    
    subgraph "Menu Actions"
        CM --> A1[View Details]
        CM --> A2[Create Incident]
        CM --> A3[Add to POLE]
        CM --> A4[View Related Events]
        CM --> A5[View in Topology]
        CM --> A6[Mark as High Risk]
    end
    
    subgraph "Navigation Targets"
        A2 --> |"URL params"| INC[Incident Management]
        A3 --> |"URL params"| POLE[POLE Analytics]
        A4 --> |"channelId"| WH[Webhooks Viewer]
        A5 --> |"highlight"| TOP[Topology Graph]
    end
    
    subgraph "Visual Feedback"
        A6 --> VF1[Pulsing Red Animation]
        A6 --> VF2[HIGH RISK Badge]
        A6 --> VF3[Toast Notification]
    end
    
    INC --> B1[Show Context Banner]
    POLE --> B2[Show Entity Banner]
    
    style CM fill:#8B5CF6,color:#fff
    style A6 fill:#EF4444,color:#fff
    style VF1 fill:#EF4444,color:#fff
```

### Usage

| Screen | Right-Click Target | Available Actions |
|--------|-------------------|-----------|
| Topology Graph | Any node (camera, person, vehicle, location, event) | View Details, Create Incident, Add to POLE, View Events*, Mark as High Risk |
| Geographic Map | Camera markers | View Details, Create Incident, Add to POLE, View Events, View in Topology, Mark as High Risk |
| Geographic Map | Region boundaries | View Details, Create Incident, Add to POLE, View in Topology, Mark as High Risk (all cameras) |

*View Events only available for cameras/locations

### Mark as High Risk Feature

```mermaid
stateDiagram-v2
    [*] --> Normal: Node displayed
    Normal --> HighRisk: Right-click → Mark as High Risk
    HighRisk --> Normal: Right-click → Remove High Risk
    
    note right of HighRisk
        Visual Effects:
        • Pulsing red animation
        • Red node color override
        • ⚠️ icon in popups
        • 🚨 HIGH RISK badge
        • Toast notification
    end note
```

### Integration with Incident/POLE Screens

When a user clicks "Create Incident" or "Add to POLE" from the context menu, they are navigated to the respective screen with URL parameters that prefill the form:

| Parameter | Description | Example |
|-----------|-------------|--------|
| `from` | Source screen | `topology`, `map` |
| `nodeId` | Entity identifier | `camera-123` |
| `nodeType` | Entity type | `camera`, `person`, `vehicle` |
| `nodeName` | Display name | `CAM-LIMA-001` |
| `region` | Geographic region | `Lima` |
| `location` | Coordinates | `-12.0464,-77.0428` |

The target screen displays a context banner showing the source and suggesting appropriate incident type or POLE entity type.

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

## 🗄️ Database Architecture

The application uses a **three-database architecture** with clear separation of concerns:

![Three-database architecture diagram showing PostgreSQL, Neo4j, and InfluxDB data separation](docs/images/ELI-DIAGRAM-DatabaseArchitecture.jpeg)

```mermaid
flowchart TB
    subgraph "Data Flow"
        WH[Webhook Events] --> API[API Layer]
        API --> PG[(PostgreSQL)]
        API --> NEO[(Neo4j)]
        API --> INF[(InfluxDB)]
    end
    
    subgraph "PostgreSQL - Application Data"
        PG --> |App Config| SC[system_config]
        PG --> |Logging| WR[webhook_requests]
        PG --> |Users| US[users]
        PG --> |Dashboard| EV[events]
        PG --> |Dashboard| CH[channels]
        PG --> |Dashboard| SN[snapshots]
        PG --> |Incidents| IN[incidents]
    end
    
    subgraph "Neo4j - Topology Graph"
        NEO --> |Nodes| CAM[Camera]
        NEO --> |Nodes| LOC[Location]
        NEO --> |Nodes| VEH[Vehicle]
        NEO --> |Nodes| PER[Person]
        NEO --> |Nodes| EVT[Event]
        CAM --> |LOCATED_AT| LOC
        EVT --> |TRIGGERED| CAM
        VEH --> |DETECTED| CAM
        PER --> |OBSERVED| CAM
    end
    
    subgraph "InfluxDB - Time Series"
        INF --> |Metrics| CU[cloudinary_usage]
        INF --> |Metrics| IT[image_throttle]
    end
```

### Database Responsibilities

| Database | Purpose | Data Types |
|----------|---------|------------|
| **Neo4j** | Topology Graph | Nodes, relationships, graph traversal, network visualization |
| **InfluxDB** | Time-Series Metrics | Cloudinary usage, throttle stats, historical trends |
| **PostgreSQL** | Application Data | Config, users, webhooks, dashboard metadata, incidents |

---

## 📊 Database Schemas

### Neo4j Graph Schema

![Neo4j graph schema showing node types (Camera, Location, Vehicle, Person, Event) and relationships](docs/images/ELI-DIAGRAM-Neo4JGraphSchema.jpeg)

```mermaid
graph LR
    subgraph "Node Types"
        C((Camera))
        L((Location))
        V((Vehicle))
        P((Person))
        E((Event))
    end
    
    subgraph "Relationships"
        C -->|LOCATED_AT| L
        E -->|TRIGGERED| C
        V -->|DETECTED| C
        P -->|OBSERVED| C
    end
    
    style C fill:#10B981,color:#fff
    style L fill:#8B5CF6,color:#fff
    style V fill:#F59E0B,color:#fff
    style P fill:#3B82F6,color:#fff
    style E fill:#D91023,color:#fff
```

**Node Properties:**

| Node Type | Properties |
|-----------|------------|
| **Camera** | `id`, `name`, `latitude`, `longitude`, `region`, `status`, `eventCount` |
| **Location** | `id`, `name`, `region` |
| **Vehicle** | `id`, `plate`, `name` |
| **Person** | `id`, `faceId`, `name` |
| **Event** | `id`, `eventId`, `type`, `timestamp`, `imageUrl`, `tags`, `objects`, `dominantColors`, `qualityScore`, `caption` |

**Relationship Types:**

| Relationship | From | To | Description |
|--------------|------|-----|-------------|
| `LOCATED_AT` | Camera | Location | Camera is installed at location |
| `TRIGGERED` | Event | Camera | Event was triggered at camera |
| `DETECTED` | Vehicle | Camera | Vehicle detected at camera |
| `OBSERVED` | Person | Camera | Person observed at camera |

---

### InfluxDB Time-Series Schema

```mermaid
flowchart LR
    subgraph "Measurements"
        CU[cloudinary_usage]
        IT[image_throttle]
    end
    
    subgraph "cloudinary_usage Fields"
        CU --> credits[credits: used, limit, percent]
        CU --> storage[storage: bytes, credits]
        CU --> bandwidth[bandwidth: bytes, credits]
        CU --> transforms[transformations: count, credits]
        CU --> resources[resources: count, derived]
    end
    
    subgraph "image_throttle Fields"
        IT --> received[received: count]
        IT --> processed[processed: count]
        IT --> skipped[skipped: count]
    end
```

**Bucket:** `cloudinary_metrics`  
**Retention:** 90 days

---

### PostgreSQL Schema

```mermaid
erDiagram
    users {
        int id PK
        varchar openId
        text name
        varchar email
        varchar loginMethod
        enum role
        timestamp createdAt
        timestamp lastSignedIn
    }
    
    channels {
        varchar id PK
        varchar name
        varchar channelType
        double latitude
        double longitude
        jsonb address
        varchar status
        varchar region
        timestamp createdAt
    }
    
    events {
        varchar id PK
        varchar eventId
        varchar topic
        varchar module
        varchar level
        bigint startTime
        varchar channelId FK
        jsonb params
        timestamp createdAt
    }
    
    snapshots {
        varchar id PK
        varchar eventId FK
        varchar type
        varchar imageUrl
        varchar cloudinaryPublicId
        timestamp createdAt
    }
    
    incidents {
        varchar id PK
        varchar incidentType
        varchar priority
        varchar status
        varchar region
        double latitude
        double longitude
        text description
        jsonb eventIds
        timestamp createdAt
    }
    
    webhook_requests {
        bigint id PK
        varchar endpoint
        varchar method
        jsonb payload
        varchar eventId
        varchar status
        int processingTime
        timestamp createdAt
    }
    
    system_config {
        int id PK
        varchar key
        text value
        text description
        timestamp updatedAt
    }
    
    channels ||--o{ events : "has"
    events ||--o{ snapshots : "has"
```

**PostgreSQL Tables (15 total):**

1. **users** - User authentication and profiles
2. **events** - Surveillance events (dashboard metadata only)
3. **snapshots** - Event snapshots/images with Cloudinary URLs
4. **channels** - Camera/channel information (3,084 cameras)
5. **ai_inference_jobs** - AI processing jobs
6. **ai_detections** - AI detection results
7. **ai_anomalies** - Anomaly detection
8. **ai_baselines** - Baseline data for AI
9. **ai_insights** - AI-generated insights
10. **incidents** - Incident management
11. **incident_notes** - Notes attached to incidents
12. **incident_tags** - Tags for incidents
13. **pole_entities** - People, Objects, Locations, Events
14. **webhook_requests** - Incoming webhook logs
15. **system_config** - System configuration

---

## 🔄 Data Flow Architecture

![Data flow sequence diagram showing event ingestion from IREX through webhook handler to databases](docs/images/ELI-DIAGRAM-DataFlowArchitecture.jpeg)

```mermaid
sequenceDiagram
    participant IREX as IREX System
    participant WH as Webhook Handler
    participant PG as PostgreSQL
    participant NEO as Neo4j
    participant INF as InfluxDB
    participant UI as Dashboard UI
    
    Note over IREX,UI: Event Ingestion Flow
    IREX->>WH: POST /api/webhook/irex
    WH->>PG: Insert event, channel, snapshots
    WH->>NEO: Sync camera node
    WH->>NEO: Sync event node + relationships
    WH-->>IREX: 200 OK
    
    Note over IREX,UI: Topology Query Flow
    UI->>NEO: GET /api/data/topology
    NEO-->>UI: Graph nodes + relationships
    
    Note over IREX,UI: Dashboard Stats Flow
    UI->>PG: GET /api/data/stats
    PG-->>UI: Aggregated counts
    
    Note over IREX,UI: Time-Series Flow
    UI->>INF: GET /api/cloudinary/metrics
    INF-->>UI: Historical usage data
```

### Key Architectural Decisions

1. **Neo4j for Topology**: All graph relationships and network visualization queries use Neo4j exclusively. No PostgreSQL fallback for topology data.

2. **Immediate Sync**: When webhooks are received, data is synced to Neo4j immediately (non-blocking) to ensure topology is always up-to-date.

3. **PostgreSQL for Metadata**: PostgreSQL stores only application configuration, user data, webhook logs, and minimal dashboard metadata for counts/stats.

4. **InfluxDB for Trends**: All time-series data (Cloudinary usage, throttle metrics) is stored in InfluxDB for efficient historical queries.

---

## 🎨 Peru Theme

The application uses Peru's national colors:

- **Primary Red**: `#D91023` (Peru flag red)
- **Background**: `#1F2937` (Dark gray)
- **Foreground**: `#F9FAFB` (White)
- **Accents**: Green (#10B981), Blue (#3B82F6), Orange (#F59E0B), Purple (#8B5CF6)

---

## 🔌 API Endpoints

### Authentication (tRPC)
- `POST /api/trpc/auth.login` - Login with admin/admin
- `POST /api/trpc/auth.logout` - Logout
- `GET /api/trpc/auth.me` - Get current user

### Dashboard (tRPC)
- `GET /api/trpc/dashboard.metrics` - Get KPIs and statistics

### Events (tRPC)
- `GET /api/trpc/events.list` - List events with pagination
- `GET /api/trpc/events.byId` - Get event by ID

### Configuration (tRPC)
- `GET /api/trpc/config.get` - Get system configuration
- `POST /api/trpc/config.set` - Update system configuration

### Database-Integrated REST APIs (Vercel Serverless)

These endpoints query real data from the PostgreSQL/TiDB database:

| Endpoint | Method | Description | Database Tables |
|----------|--------|-------------|-----------------|
| `/api/webhook/irex` | POST | Receives IREX webhook events and persists to database | `events`, `channels`, `snapshots`, `webhook_requests` |
| `/api/webhooks/recent` | GET | Returns recent webhook requests from database | `webhook_requests` |
| `/api/data/cameras` | GET | Returns camera/channel data with statistics | `channels` |
| `/api/data/events` | GET | Returns surveillance events with filtering | `events` |
| `/api/data/stats` | GET | Returns aggregated dashboard statistics | `events`, `channels` |
| `/api/data/incidents` | GET | Returns incident management data | `incidents` |
| `/api/data/pole-entities` | GET | Returns POLE entities with graph data | `pole_entities` |
| `/api/analytics/time-series` | GET | Returns time-aggregated data for analytics visualizations | `events` |
| `/api/analytics/predictions` | GET | Returns forecasts, anomaly detection, trend analysis | `events` |

**Query Parameters:**
- `limit` - Maximum number of records to return
- `region` - Filter by region (e.g., `Lima`, `Cusco`)
- `status` - Filter by status (e.g., `active`, `inactive`, `alert`)
- `level` - Filter by priority level (0-3)
- `topic` - Filter by event topic (e.g., `FaceMatched`, `PlateMatched`)

**Response Format:**
```json
{
  "success": true,
  "count": 150,
  "dbConnected": true,
  "cameras": [...] // or events, incidents, etc.
}
```

---

## 🔗 IREX Webhook Integration

The application receives and persists real-time surveillance events from IREX systems.

### Webhook Endpoint
```
POST /api/webhook/irex
```

### Supported Event Types
- `FaceMatched` - Face recognition matches from KX.Faces module
- `PlateMatched` - License plate matches from KX.PDD module
- `Motion`, `Intrusion`, `Loitering`, `Crowd` - Analytics events

### Payload Structure
```json
{
  "monitor_id": 114,
  "id": "203:1691055920965:4829655691653739",
  "event_id": "4829655691653739",
  "topic": "FaceMatched",
  "module": "KX.Faces",
  "level": 1,
  "start_time": 1685973361368,
  "end_time": 1685973369197,
  "params": { ... },
  "snapshots": [
    { "type": "FULLSCREEN", "path": "/api/v1/media/snapshot/..." },
    { "type": "THUMBNAIL", "path": "/api/v1/media/snapshot/..." }
  ],
  "channel": {
    "id": 274,
    "channel_type": "STREAM",
    "name": "CAM-001",
    "latitude": -12.0464,
    "longitude": -77.0428,
    "address": { "country": "Peru", "region": "Lima", "city": "Lima" },
    "tags": [{ "id": 170, "name": "Face" }]
  }
}
```

### Data Persistence
When a webhook is received, the system:
1. **Upserts the channel** - Creates or updates camera info in `channels` table
2. **Inserts the event** - Stores event details in `events` table
3. **Inserts snapshots** - Stores snapshot paths in `snapshots` table
4. **Logs the request** - Records full payload in `webhook_requests` table

See `Webhooks json description.md` for complete payload documentation.

---

## 📊 Data Sources

The application uses **real database integration** for all surveillance data:

| Component | Data Source | Notes |
|-----------|-------------|-------|
| Real-time Webhooks | `webhook_requests` table | Live IREX events |
| Geographic Map | `channels` table | Camera locations |
| Executive Dashboard | `events` + `channels` tables | Aggregated statistics |
| Event Timeline | `events` table | Historical events |
| Incident Management | `incidents` table | Incident tracking |
| POLE Analytics | `pole_entities` table | Real database integration (Dec 2024) |

**Empty State Handling:**
When no data exists in the database, the UI displays appropriate "No data yet" messages instead of mock data.

---

## 🚢 Deployment

### Vercel Deployment

1. Push code to GitHub
2. Connect repository to Vercel
3. Configure environment variables (automatically provided by Manus)
4. Deploy

### Environment Variables

#### Required for Database Integration

- `DATABASE_URL` - **Required** - MySQL/TiDB connection string for all data storage
  - Format: `mysql://user:password@host:port/database?ssl={"rejectUnauthorized":true}`
  - Used by: Vercel serverless functions (`/api/*`) and tRPC backend
  - Without this, all database-backed endpoints will return empty data with `dbConnected: false`

#### Platform-Provided (Auto-configured)

- `JWT_SECRET` - Session cookie signing secret
- `VITE_APP_ID` - Manus OAuth application ID
- `OAUTH_SERVER_URL` - Manus OAuth backend
- `VITE_OAUTH_PORTAL_URL` - Manus login portal
- `VITE_APP_TITLE` - Application title
- `VITE_APP_LOGO` - Application logo URL

#### External Services (Optional - User-Configured via Settings → Secrets)

**Neo4j Graph Database (Future):**
- `NEO4J_URI` - Connection URI (neo4j+s://...)
- `NEO4J_USERNAME` - Database username
- `NEO4J_PASSWORD` - Database password
- `NEO4J_DATABASE` - Database name

**Cloudinary (Future - Image Storage):**
- `CLOUDINARY_URL` - Full connection URL
- `CLOUDINARY_CLOUD_NAME` - Cloud name
- `CLOUDINARY_API_KEY` - API key
- `CLOUDINARY_API_SECRET` - API secret

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
- react-leaflet-cluster 2.1.0 (marker clustering)
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

### Completed ✅
- [x] Database integration for all API endpoints
- [x] IREX webhook ingestion with snapshot persistence
- [x] Real camera/channel data from database
- [x] Real event data from database
- [x] Aggregated statistics from database
- [x] Empty state handling in frontend
- [x] **POLE Analytics redesign** - "Digital Detective Board" aesthetic (Dec 2024)
- [x] **Incident Management redesign** - "Command Center" aesthetic (Dec 2024)
- [x] **POLE stale data bug fix** - Now fetches from database, shows empty state when purged (Dec 2024)
- [x] **POLE entities API** - New `/api/data/pole-entities` endpoint (Dec 2024)
- [x] **Framer Motion animations** - Smooth transitions on both pages (Dec 2024)
- [x] **Trends & Predictions Tab** - Grafana-style analytics with forecasting (Dec 2024)
- [x] **Analytics Time Series API** - `/api/analytics/time-series` with heatmaps, regional comparisons (Dec 2024)
- [x] **Analytics Predictions API** - `/api/analytics/predictions` with linear regression, anomaly detection (Dec 2024)
- [x] **Live Event Ticker with Images** - Click to view Cloudinary images in modal (Dec 2024)
- [x] **Camera Marker Clustering** - Uses react-leaflet-cluster for grouped markers (Dec 2024)
- [x] **Fullscreen Presentation Mode** - Toggle buttons on Map and Topology pages (Dec 2024)
- [x] **Context Menu System** - Right-click actions on Topology Graph and Geographic Map *(Dec 2025)*
- [x] **Mark as High Risk** - Visual flagging with pulsing red animations *(Dec 2025)*
- [x] **Cross-Screen Integration** - URL params pass context from Graph/Map to Incidents/POLE *(Dec 2025)*
- [x] **Region Boundaries Context Menu** - Right-click on Peru regions in Geographic Map *(Dec 2025)*

### High Priority
- [ ] Test webhook endpoint with real IREX surveillance data
- [ ] Create database seeding script for demo data
- [ ] Connect Neo4j for topology graph real data
- [ ] Connect Cloudinary for snapshot image storage
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
