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

3. **Topology Graph** *(ENHANCED)*
   - React-force-graph-2d network visualization
   - **Hybrid Database Architecture** - Neo4j for graph relationships + PostgreSQL for primary data
   - 5 layout modes: Force-Directed, Hierarchical, Radial, Grid, Circular (all functional)
   - **Cloudinary Image Display** - Event nodes render associated snapshot images
   - Node/edge filtering and search
   - Zoom controls and fit-to-screen with proper container sizing
   - Color-coded entity types (Camera, Location, Vehicle, Person, Event)
   - **ResizeObserver** for responsive graph canvas sizing
   - Image preloading with caching for smooth rendering

4. **Incident Management**
   - Real-time alert tracking
   - Filtering by status, priority, and region
   - Video evidence integration
   - Detailed incident reports
   - Officer and unit assignment
   - Peru-specific locations and context
   - **Quick Navigation** - Drill into Map, Topology, and POLE Analytics from incidents
   - **POLE Entity Display** - Related people, objects, and locations per incident
   - **Cross-page linking** - Navigate to related entities across the application

5. **POLE Analytics** *(ENHANCED)*
   - **Interactive Crime Network Graph** - Force-directed visualization using react-force-graph-2d
   - **Multiple Layout Modes** - Force-directed, Hierarchical, Radial layouts
   - **33 Mock Entities** - Realistic crime hierarchy with suspects, victims, witnesses, evidence
   - **37 Relationships** - Connections like "knows", "owns", "witnessed", "suspect_of"
   - **Entity Types** - Different shapes/colors for People (circles), Objects (diamonds), Locations (squares), Events (triangles)
   - **Hover Highlighting** - Dim unconnected nodes when hovering over an entity
   - **Detail Sidebar** - Click any entity to see connections and navigation options
   - **Timeline Tab** - Activity charts over 7 days
   - **Entity List Tab** - Searchable grid view of all entities
   - **Cross-page Navigation** - Jump to Map, Topology, or Incidents from any entity

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
   - CRON job management and monitoring
   - System information

8. **Cloudinary Monitoring Dashboard**
   - Real-time credit usage tracking with visual progress bars
   - Storage, bandwidth, and transformation metrics
   - Historical trends with interactive time-series charts (1H, 12H, 24H, 7D, 30D)
   - Usage projections and exhaustion date forecasting
   - InfluxDB integration for time-series data storage
   - Credit breakdown analysis by category

9. **PostgreSQL Monitoring Dashboard** *(NEW)*
   - Real-time database storage usage with progress bar (512MB Neon free tier limit)
   - Table breakdown with row counts and storage per table
   - Connection monitoring (active vs max connections)
   - Database version and uptime tracking
   - Historical trends with time-series charts
   - Daily growth rate calculations and projections
   - Accessible from main dashboard menu and Settings page

10. **Image Processing Throttle Control**
   - Configurable throttle to prevent exceeding Cloudinary limits during demo
   - Processing ratio slider (10 to 10,000 images per 100K incoming)
   - Maximum per hour hard limit (10 to 1,000 images)
   - Multiple sampling methods: Random, Interval, First N
   - Real-time statistics: processed vs skipped images
   - Hourly processing charts with stacked area visualization
   - Production forecasting for capacity planning
   - Throttle enabled by default for demo safety

11. **Image Analysis System** *(NEW)*
   - **Cloudinary AI Analysis** - Object detection (COCO, LVIS), tagging, OCR, color analysis
   - **Enriched Neo4j Data** - Graph nodes stored with rich metadata (tags, objects, quality score)
   - **Analysis Dashboard** - `/dashboard/analysis` with visualization and filters
   - **Color Histogram** - Visual distribution of dominant colors across all images
   - **Advanced Search** - Filter images by tag, object, color, and quality score
   - **Quality Diagnostics** - Blur detection, noise analysis, and exposure scoring

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
│   │   │   ├── Settings.tsx    # Settings with CRON job management
│   │   ├── CloudinaryMonitoring.tsx  # Usage monitoring & throttle control
│   │   └── PostgreSQLMonitoring.tsx  # Database monitoring dashboard
│   │   ├── components/         # Reusable UI components (shadcn/ui)
│   │   ├── lib/                # Utilities and tRPC client
│   │   ├── App.tsx             # Routes and layout
│   │   └── index.css           # Global styles (Peru theme)
├── api/                         # Vercel Serverless Functions
│   ├── cloudinary/             # Cloudinary monitoring endpoints
│   │   ├── usage.ts            # Usage statistics endpoint
│   │   ├── metrics.ts          # InfluxDB time-series metrics
│   │   ├── throttle.ts         # Image processing throttle config
│   │   └── test-influxdb.ts    # InfluxDB configuration testing
│   ├── postgresql/             # PostgreSQL monitoring endpoints
│   │   ├── usage.ts            # Database size, tables, connections
│   │   └── metrics.ts          # Historical metrics and projections
│   ├── cron/                   # Scheduled job endpoints
│   │   ├── status.ts           # CRON job management API
│   │   ├── record-cloudinary-metrics.ts  # Every 15 min
│   │   └── record-throttle-metrics.ts    # Every 5 min
│   ├── lib/                    # Shared utilities
│   │   ├── db.ts               # Database helpers
│   │   ├── cloudinary.ts       # Cloudinary upload utilities
│   │   ├── influxdb.ts         # InfluxDB client library
│   │   └── neo4j.ts            # Neo4j driver and connection utilities
│   ├── webhook/                # Webhook ingestion
│   │   └── irex.ts             # IREX event processor (with throttle)
│   └── data/                   # Data query endpoints
│       ├── topology.ts         # Hybrid topology API (Neo4j + PostgreSQL)
│       └── topology-neo4j.ts   # Neo4j-specific topology queries
├── server/                      # Backend Express + tRPC
│   ├── auth.ts                 # Hardcoded authentication
│   ├── db.ts                   # Database helpers
│   ├── routers.ts              # tRPC procedures
│   └── _core/                  # Framework plumbing
├── drizzle/                     # Database schema and migrations
│   └── schema.ts               # 13 tables for surveillance data
├── vercel.json                  # Vercel config with CRON jobs
├── package.json
├── README.md
└── TODO.md                      # Development task tracking
```

---

## 🗄️ Database Architecture

The application uses a **three-database architecture** with clear separation of concerns:

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
| **Event** | `id`, `eventId`, `type`, `timestamp`, `imageUrl`, `tags`, `objects`, `dominantColors`, `qualityScore`, `caption`, `moderationStatus`, `phash` |

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

**PostgreSQL Tables (13 total):**

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

1. **Neo4j for Topology**: All graph relationships and network visualization queries use Neo4j exclusively. No topology data is stored in PostgreSQL.

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

### Image Analysis (tRPC)
- `GET /api/trpc/analysis.search` - Search images by tag, object, color
- `GET /api/trpc/analysis.stats` - Get aggregate analysis statistics

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
| `/api/data/topology` | GET | Returns topology graph data (hybrid Neo4j + PostgreSQL) | Neo4j nodes + `snapshots` |

**Cloudinary & Monitoring APIs:**

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/cloudinary/usage` | GET | Returns current Cloudinary account usage (credits, storage, bandwidth) |
| `/api/cloudinary/metrics` | GET | Queries historical usage from InfluxDB with time range filtering |
| `/api/cloudinary/metrics` | POST | Records current Cloudinary usage to InfluxDB |
| `/api/cloudinary/throttle` | GET | Returns current throttle configuration and processing stats |
| `/api/cloudinary/throttle` | POST | Updates throttle settings (enabled, ratio, maxPerHour, samplingMethod) |
| `/api/cloudinary/throttle?action=stats` | GET | Returns detailed processing statistics |
| `/api/cloudinary/test-influxdb` | GET | Tests InfluxDB connection and configuration |
| `/api/cloudinary/test-influxdb?action=write` | GET | Writes test data to InfluxDB |
| `/api/cloudinary/test-influxdb?action=debug` | GET | Returns raw InfluxDB query results for debugging |

**PostgreSQL Monitoring APIs:**

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/postgresql/usage` | GET | Returns current database size, table stats, row counts, connections |
| `/api/postgresql/metrics` | GET | Queries historical PostgreSQL metrics with time range filtering |
| `/api/postgresql/metrics` | POST | Records current PostgreSQL stats for historical tracking |

**CRON Job Management APIs:**

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/cron/status` | GET | Lists all configured CRON jobs with status |
| `/api/cron/status?action=trigger&jobId=xxx` | POST | Manually triggers a specific CRON job |
| `/api/cron/status?action=seed` | POST | Seeds InfluxDB with initial Cloudinary data points |
| `/api/cron/status?action=history&jobId=xxx` | GET | Returns execution history for a job |
| `/api/cron/record-cloudinary-metrics` | GET | CRON: Records Cloudinary usage (every 15 min) |
| `/api/cron/record-throttle-metrics` | GET | CRON: Records throttle statistics (every 5 min) |

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

## ⏰ Scheduled CRON Jobs

The application uses Vercel CRON jobs for automated background tasks:

| Job | Schedule | Description |
|-----|----------|-------------|
| `record-cloudinary-metrics` | Every 15 min | Records Cloudinary usage to InfluxDB for historical tracking |
| `record-throttle-metrics` | Every 5 min | Records image processing statistics (processed/skipped) |

### CRON Job Management

Access via **Settings** → **Scheduled Jobs**:

- **View Status** - See all jobs with enabled/disabled status and dependencies
- **Last Run** - View when each job last executed and its result
- **Next Run** - See scheduled next execution time
- **Run Now** - Manually trigger any job immediately
- **Seed Data** - Populate InfluxDB with initial data points

### Configuration in `vercel.json`:

```json
{
  "crons": [
    {
      "path": "/api/cron/record-cloudinary-metrics",
      "schedule": "*/15 * * * *"
    },
    {
      "path": "/api/cron/record-throttle-metrics",
      "schedule": "*/5 * * * *"
    }
  ]
}
```

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
| POLE Analytics | Simulated data | Clearly labeled as demo |
| Cloudinary Monitoring | Cloudinary API + InfluxDB | Real-time usage + historical |
| Historical Trends | InfluxDB `cloudinary_metrics` bucket | Time-series data |
| Throttle Statistics | In-memory + InfluxDB | Processed vs skipped counts |

**Empty State Handling:**
When no data exists in the database, the UI displays appropriate "No data yet" messages instead of mock data.

**InfluxDB Time-Series Data:**
The `cloudinary_metrics` bucket stores:
- `cloudinary_usage` measurement: credits, storage, bandwidth, transformations, resources
- `image_throttle` measurement: received, processed, skipped, projected counts

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

**Neo4j Graph Database (Topology Graph):**
- `NEO4J_URI` - Connection URI (bolt://localhost:7687 or neo4j+s://...)
- `NEO4J_USER` - Database username
- `NEO4J_PASSWORD` - Database password
- *Note: Neo4j is optional - system falls back to PostgreSQL-only topology if not configured*

**Cloudinary (Image Storage & Monitoring):**
- `CLOUDINARY_URL` - Full connection URL
- `CLOUDINARY_CLOUD_NAME` - Cloud name
- `CLOUDINARY_API_KEY` - API key
- `CLOUDINARY_API_SECRET` - API secret

**InfluxDB (Time-Series Metrics):**
- `INFLUXDB_HOST` - InfluxDB Cloud host URL (e.g., `https://us-east-1-1.aws.cloud2.influxdata.com`)
- `INFLUXDB_TOKEN` - API token with read/write permissions
- `INFLUXDB_ORG` - Organization name
- `INFLUXDB_ORG_ID` - Organization ID

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
- ✅ Neo4j integration (hybrid topology with PostgreSQL fallback)
- ✅ Cloudinary integration (image storage and display on topology nodes)

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
- [x] **Cloudinary Monitoring Dashboard** - Full usage tracking with credits, storage, bandwidth
- [x] **InfluxDB Time-Series Integration** - Historical data storage and querying
- [x] **Historical Trends Charts** - Interactive time-series visualization (1H-30D ranges)
- [x] **Usage Projections & Forecasting** - Credit exhaustion date prediction
- [x] **Image Processing Throttle** - Configurable ratio, max per hour, sampling methods
- [x] **Throttle Statistics & Charts** - Processed vs skipped tracking with hourly visualization
- [x] **Production Forecasting** - Resource requirements for full processing
- [x] **CRON Job Management UI** - View, trigger, and monitor scheduled jobs
- [x] **CRON Job: Record Cloudinary Metrics** - Every 15 minutes to InfluxDB
- [x] **CRON Job: Record Throttle Metrics** - Every 5 minutes to InfluxDB
- [x] **InfluxDB Test Endpoint** - Configuration verification and debugging
- [x] **PostgreSQL Monitoring Dashboard** - Database storage, tables, connections tracking
- [x] **PostgreSQL Usage API** - Real-time database metrics endpoint
- [x] **PostgreSQL Metrics API** - Historical data with projections
- [x] **Settings Page PostgreSQL Stats** - Dynamic database stats display
- [x] **Improved Cloudinary Bulk Delete** - Reliable batch deletion with pagination

### High Priority
- [ ] Test webhook endpoint with real IREX surveillance data
- [ ] Create database seeding script for demo data
- [x] Connect Neo4j for topology graph real data (Hybrid PostgreSQL + Neo4j)
- [ ] Implement actual data purge logic
- [ ] Add WebSocket for true real-time updates
- [ ] Configure Neo4j credentials in production environment

### Medium Priority
- [ ] Add data management tables (CRUD)
- [ ] Implement global search across all entities
- [ ] Add export functionality (PDF, CSV)
- [ ] Implement role-based access control
- [ ] Persist throttle configuration to database (currently in-memory)

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

### Recent Updates (December 9, 2024)
- **Topology Graph Overhaul** - Complete rewrite with hybrid Neo4j + PostgreSQL architecture
  - Neo4j connection utility (`api/lib/neo4j.ts`) with driver management and schema initialization
  - Neo4j topology API (`api/data/topology-neo4j.ts`) with Cypher queries for graph traversal
  - Hybrid data fetching - tries Neo4j first, falls back to PostgreSQL
  - Fixed UI layout overlap - graph no longer covers sidebar controls
  - Implemented all 5 layout algorithms (Force, Hierarchical, Radial, Grid, Circular)
  - Event nodes display Cloudinary images with circular clipping
  - Image preloading with cache for smooth rendering
  - ResizeObserver for responsive canvas sizing
  - Background sync to Neo4j for future queries

### Previous Updates (December 8, 2024)
- **POLE Analytics Graph Visualization** - Interactive crime network graph with react-force-graph-2d
  - 33 entities (people, objects, locations, events) with 37 relationships
  - Multiple layouts (force-directed, hierarchical, radial)
  - Hover highlighting, click-to-select, detail sidebar
  - Cross-page navigation to Map, Topology, Incidents
- **Incident Management Enhancements** - POLE entity display and quick navigation buttons
  - View on Map, View Topology, POLE Analysis navigation
  - Related people, objects, locations displayed per incident
  - Click-through to POLE Analytics for entity details
- **PostgreSQL Monitoring Dashboard** - Full database monitoring with storage, tables, connections
- **PostgreSQL API Endpoints** - `/api/postgresql/usage` and `/api/postgresql/metrics`
- **Settings Page Enhancement** - Dynamic PostgreSQL stats with navigation links
- **Improved Cloudinary Bulk Delete** - Reliable batch deletion using list-then-delete approach
- **Dashboard Menu Update** - PostgreSQL Monitoring added to main dashboard
- **Image Analysis System** - Cloudinary AI integration, Neo4j metadata storage, Analysis Dashboard
- Cloudinary Monitoring Dashboard with usage tracking
- InfluxDB integration for time-series metrics
- Historical trends visualization (1H-30D)
- Image processing throttle for demo protection
- CRON job management UI
- Usage projections and forecasting

---

## 🆘 Support

For issues or questions:
- Submit feedback at https://help.manus.im
- Check the TODO list in `todo.md`
- Review the original repositories for reference

---

**Built with ❤️ for Peru's National Security**
