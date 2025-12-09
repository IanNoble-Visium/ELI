# ELI Unified Dashboard

**Peru's National Surveillance & Intelligence Platform**

A comprehensive, full-stack surveillance dashboard that unifies three separate systems (ELI-DEMO, eli-dashboard, and IREX-DEMO) into a single, cohesive application with real-time webhook processing, advanced analytics, and Peru-themed design.

---

## Features

### Core Modules

| Module | Description |
|--------|-------------|
| **Executive Dashboard** | Real-time KPIs, charts, and time-range selectors |
| **Geographic Map** | Leaflet map with 3,084 camera markers across 25 Peru regions |
| **Topology Graph** | Neo4j + PostgreSQL hybrid graph visualization with 5 layout modes |
| **Incident Management** | Alert tracking, POLE entity display, cross-page navigation |
| **POLE Analytics** | Interactive crime network graph with entity relationships |
| **Real-Time Webhooks** | Live event stream with filtering and pause controls |
| **Settings** | Data retention, CRON jobs, storage statistics |
| **Cloudinary Monitoring** | Credit usage, throttle control, InfluxDB trends |
| **PostgreSQL Monitoring** | Database storage, table breakdown, connection stats |
| **Image Analysis** | Cloudinary AI analysis with search and quality filters |

### Technical Stack

| Technology | Usage |
|------------|-------|
| React 19 + Vite | Frontend framework |
| Tailwind CSS 4 | Styling with Peru theme (#D91023) |
| tRPC + Express | Backend API |
| Drizzle ORM | PostgreSQL database layer |
| Neo4j | Graph database for topology |
| InfluxDB | Time-series metrics |
| Cloudinary | Image storage and AI analysis |
| Framer Motion | Animations and transitions |
| Recharts | Data visualization |
| Leaflet | Geographic mapping |
| react-force-graph-2d | Network topology |

---

## Quick Start

### Prerequisites

- Node.js 22.x
- pnpm 10.x
- PostgreSQL database

### Installation

```bash
pnpm install
pnpm db:push
pnpm dev
```

**Default Credentials:** `admin` / `admin`

---

## Project Structure

```
eli-unified-dashboard/
├── client/src/
│   ├── pages/                 # React page components
│   ├── components/            # Reusable UI components (shadcn/ui)
│   ├── lib/                   # Utilities and tRPC client
│   └── App.tsx                # Routes and layout
├── api/
│   ├── cloudinary/            # Cloudinary monitoring endpoints
│   ├── postgresql/            # PostgreSQL monitoring endpoints
│   ├── cron/                  # Scheduled job endpoints
│   ├── lib/                   # Shared utilities (db, neo4j, influxdb)
│   ├── data/                  # Data query endpoints
│   └── webhook/               # Webhook ingestion
├── server/
│   ├── routers.ts             # tRPC procedures
│   ├── db.ts                  # Database helpers
│   └── auth.ts                # Authentication
├── drizzle/
│   └── schema.ts              # Database schema (15 tables)
└── vercel.json                # CRON job configuration
```

---

## Database Architecture

The application uses a **three-database architecture**:

| Database | Purpose | Data Types |
|----------|---------|------------|
| **PostgreSQL** | Application data | Users, events, channels, incidents, config |
| **Neo4j** | Topology graph | Nodes, relationships, graph traversal |
| **InfluxDB** | Time-series | Cloudinary usage, throttle metrics |

### PostgreSQL Schema (15 tables)

| Table | Description |
|-------|-------------|
| `users` | User authentication and profiles |
| `channels` | Camera/channel information |
| `events` | Surveillance events |
| `snapshots` | Event images with Cloudinary URLs |
| `incidents` | Incident management |
| `incident_notes` | Notes attached to incidents |
| `incident_tags` | Tags for incidents |
| `pole_entities` | POLE entities (People, Objects, Locations, Events) |
| `webhook_requests` | Incoming webhook logs |
| `system_config` | System configuration (throttle settings, etc.) |
| `ai_anomalies` | AI anomaly detection results |
| `ai_baselines` | AI baseline data |
| `ai_detections` | AI detection results |
| `ai_inference_jobs` | AI processing job queue |
| `ai_insights` | AI-generated insights |

### Neo4j Graph Schema

**Node Types:**
- `Camera` - Surveillance cameras with location data
- `Location` - Geographic locations/regions
- `Vehicle` - Detected vehicles with plate numbers
- `Person` - Detected persons with face IDs
- `Event` - Events with Cloudinary image URLs and AI analysis metadata

**Relationships:**
- `Camera` → `LOCATED_AT` → `Location`
- `Event` → `TRIGGERED` → `Camera`
- `Vehicle` → `DETECTED` → `Camera`
- `Person` → `OBSERVED` → `Camera`

### InfluxDB Measurements

**Bucket:** `cloudinary_metrics` (90-day retention)

| Measurement | Fields |
|-------------|--------|
| `cloudinary_usage` | credits, storage, bandwidth, transformations |
| `image_throttle` | received, processed, skipped counts |

---

## API Endpoints

### tRPC Routes

| Route | Description |
|-------|-------------|
| `auth.login` | Login with admin/admin |
| `auth.logout` | Logout |
| `auth.me` | Get current user |
| `dashboard.metrics` | Dashboard KPIs and statistics |
| `events.list` | List events with filters |
| `events.byId` | Get event by ID |
| `channels.list` | List cameras/channels |
| `incidents.*` | Incident notes and tags CRUD |
| `config.get/set` | System configuration |
| `analysis.search/stats` | Image analysis queries |

### REST Endpoints (Vercel Serverless)

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/webhook/irex` | POST | IREX webhook ingestion |
| `/api/webhooks/recent` | GET | Recent webhook requests |
| `/api/data/cameras` | GET | Camera data |
| `/api/data/events` | GET | Event data |
| `/api/data/stats` | GET | Dashboard statistics |
| `/api/data/incidents` | GET | Incident data |
| `/api/data/topology` | GET | Topology graph (Neo4j + PostgreSQL) |
| `/api/cloudinary/usage` | GET | Cloudinary usage |
| `/api/cloudinary/metrics` | GET/POST | InfluxDB metrics |
| `/api/cloudinary/throttle` | GET/POST | Throttle configuration |
| `/api/postgresql/usage` | GET | Database metrics |
| `/api/postgresql/metrics` | GET/POST | Historical metrics |
| `/api/cron/status` | GET/POST | CRON job management |

---

## Environment Variables

### Required

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | PostgreSQL connection string |

### Optional (External Services)

| Variable | Service |
|----------|---------|
| `NEO4J_URI`, `NEO4J_USER`, `NEO4J_PASSWORD` | Neo4j (falls back to PostgreSQL if not set) |
| `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET` | Cloudinary |
| `INFLUXDB_HOST`, `INFLUXDB_TOKEN`, `INFLUXDB_ORG` | InfluxDB |

---

## CRON Jobs

| Job | Schedule | Description |
|-----|----------|-------------|
| `record-cloudinary-metrics` | */15 * * * * | Record Cloudinary usage to InfluxDB |
| `record-throttle-metrics` | */5 * * * * | Record throttle statistics |

Manage via **Settings** → **Scheduled Jobs**.

---

## IREX Webhook Integration

**Endpoint:** `POST /api/webhook/irex`

**Supported Events:** `FaceMatched`, `PlateMatched`, `Motion`, `Intrusion`, `Loitering`, `Crowd`

**Payload:**
```json
{
  "id": "event-id",
  "topic": "FaceMatched",
  "module": "KX.Faces",
  "level": 1,
  "start_time": 1685973361368,
  "channel": {
    "id": 274,
    "name": "CAM-001",
    "latitude": -12.0464,
    "longitude": -77.0428
  },
  "snapshots": [
    { "type": "FULLSCREEN", "path": "/api/v1/media/snapshot/..." }
  ]
}
```

---

## Development

### Adding Pages

1. Create component in `client/src/pages/`
2. Add route in `client/src/App.tsx`
3. Add navigation in `Dashboard.tsx`

### Adding API Endpoints

1. Add procedure to `server/routers.ts`
2. Add database helper to `server/db.ts`
3. Update schema in `drizzle/schema.ts`
4. Run `pnpm db:push`

### Commands

```bash
pnpm dev          # Start development server
pnpm build        # Build for production
pnpm test         # Run tests
pnpm check        # TypeScript type checking
pnpm format       # Format code with Prettier
pnpm db:push      # Push database schema changes
```

---

## Deployment

1. Push code to GitHub
2. Connect repository to Vercel
3. Configure environment variables
4. Deploy

---

## Theme

Peru's national colors:
- **Primary Red:** `#D91023`
- **Background:** `#1F2937`
- **Foreground:** `#F9FAFB`

---

## Credits

**Developed by:** Manus AI  
**For:** Peru National Surveillance Program  
**Based on:** ELI-DEMO, eli-dashboard, IREX-DEMO  
**Last Updated:** December 2024

---

## Support

- Submit feedback at https://help.manus.im
- Check pending tasks in `todo.md`

---

**Built with ❤️ for Peru's National Security**
