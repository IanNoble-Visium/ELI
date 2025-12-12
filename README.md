# ELI Unified Dashboard

> **Last Updated:** December 12, 2025 (AI Pattern Discovery Agents)

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
   - **Node Details Panel** *(New Dec 2025)* - Slide-out panel with comprehensive node properties
   - **Mark as High Risk** *(New Dec 2025)* - Flag nodes with pulsing red animation
   - **Fullscreen presentation mode** - Toggle button for clean presentations
   - **Memoized rendering** *(New Dec 2025)* - Optimized callbacks prevent unnecessary re-renders
   - **Gemini AI Filters** *(New Dec 2025)* - Filter events by AI-detected properties
   - **Quick Filters** *(New Dec 2025)* - One-click filters for weapons, license plates, multi-person scenes
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

## 🖱️ Context Menu System *(Updated Dec 11)*

The context menu feature enables rich right-click interactions across the Topology Graph and Geographic Map screens, now with **AI-powered auto-creation** of incidents and POLE entities.

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
    
    subgraph "Backend API Processing"
        A2 --> |"POST /api/data/create-incident"| API_INC[Create Incident API]
        A3 --> |"POST /api/data/create-pole-entity"| API_POLE[Create POLE API]
        
        API_INC --> MOCK[Rich Mock Data Generator]
        API_POLE --> MOCK
        
        MOCK --> |"Generating..."| STORIES[Crime Stories & Intelligence]
        STORIES --> |"Persist"| DB[(PostgreSQL)]
    end
    
    subgraph "User Experience"
        DB --> |"Success + ID"| TOAST[Toast Notification]
        TOAST --> |"Auto-Navigate"| VIEW[View New Record]
        
        A1 --> DETAILS[Node Details Panel]
        A4 --> WH[Webhooks Viewer]
        A5 --> TOP[Topology Graph]
    end
    
    subgraph "Visual Feedback"
        A6 --> VF1[Pulsing Red Animation]
        A6 --> VF2[HIGH RISK Badge]
    end
    
    style CM fill:#8B5CF6,color:#fff
    style MOCK fill:#10B981,color:#fff
    style API_INC fill:#3B82F6,color:#fff
    style API_POLE fill:#3B82F6,color:#fff
```

### Usage

| Screen | Right-Click Target | Available Actions |
|--------|-------------------|-----------|
| Topology Graph | Any node (camera, person, vehicle, location, event) | View Details, Create Incident, Add to POLE, View Events*, Mark as High Risk |
| Geographic Map | Camera markers | View Details, Create Incident, Add to POLE, View Events, View in Topology, Mark as High Risk |
| Geographic Map | Region boundaries | View Details, Create Incident, Add to POLE, View in Topology, Mark as High Risk (all cameras) |

*View Events only available for cameras/locations

### ⚡ Auto-Creation with Rich Mock Data

Instead of just opening a form, the "Create Incident" and "Add to POLE" actions now **automatically generate rich, realistic data** based on the selected node type:

1. **Crime Story Generation**: 
   - Uses context-aware templates (e.g., "Suspicious Activity" for cameras, "Plate Match" for vehicles).
   - Generates detailed descriptions with investigation notes.
   - Assigns Peruvian police units (DIRANDRO, DINOES, etc.) and officers.
   
2. **POLE Entity Intelligence**:
   - Creates detailed profiles with aliases (e.g., "El Lobo", "La Sombra").
   - Generates physical attributes and connection notes.
   - Assigns threat levels and relationship links back to the source node.

### 📋 Node Details Panel *(Enhanced Dec 11)*

Selecting **"View Details"** opens a comprehensive slide-out panel on the right side of the screen with:

- **Image Preview**: Full event image with "Open Full" link to Cloudinary
- **AI Scene Description**: Prominently displayed Gemini caption in gradient card
- **Event Details**: ID, Event ID, Channel, Timestamp, Region, Location coordinates
- **Vehicles Detected**: Styled badges with vehicle descriptions (e.g., "dark sedan", "white van")
- **License Plates**: Mono-font display with copy-on-click (grayed out for "obscured")
- **People & Clothing**: People count with clothing color badges
- **Weapons Alert**: Red highlighted section when weapons are detected
- **Extracted Text**: Any OCR text found in the image
- **Scene Environment**: Time of day, weather, lighting, camera perspective in grid layout
- **Dominant Colors**: Color swatches with click-to-copy
- **Image Quality**: Quality and blur scores with color-coded indicators
- **AI Tags & Objects**: Gemini-detected tags and objects as badges
- **Cloudinary Analysis**: Tags, objects, and colors from Cloudinary (if available)
- **All Properties**: Raw property dump for debugging/technical inspection
- **Footer Actions**: Copy JSON button and Open Image button
- **Framer Motion Animations**: Smooth slide-in/slide-out with spring physics

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

## 🤖 Gemini AI Image Analysis *(New Dec 2025)*

ELI integrates Google's Gemini 2.0 Flash model to automatically analyze surveillance images and extract rich metadata for intelligent filtering and search.

### How It Works

```mermaid
flowchart TB
    subgraph "Image Ingestion"
        WH[Webhook Event] --> |"Contains snapshot"| CL[Cloudinary Upload]
        CL --> |"Store URL"| PG[(PostgreSQL)]
    end
    
    subgraph "AI Processing Pipeline"
        CRON[CRON Job] --> |"Every 30 min"| FETCH[Fetch Unprocessed Images]
        FETCH --> |"Batch of 100"| GEMINI[Gemini 2.0 Flash API]
        GEMINI --> |"Analyze image"| RESULT[Structured JSON Response]
    end
    
    subgraph "Metadata Extraction"
        RESULT --> TAGS[Scene Tags]
        RESULT --> OBJECTS[Detected Objects]
        RESULT --> PEOPLE[People Count]
        RESULT --> VEHICLES[Vehicle Types]
        RESULT --> PLATES[License Plates]
        RESULT --> WEAPONS[Weapons Detection]
        RESULT --> COLORS[Clothing Colors]
        RESULT --> TEXT[Text/Signs]
        RESULT --> QUALITY[Quality Score]
    end
    
    subgraph "Storage & Sync"
        TAGS --> PG2[(PostgreSQL)]
        PG2 --> NEO[(Neo4j)]
    end
    
    subgraph "User Interface"
        NEO --> TOP[Topology Graph]
        TOP --> FILTERS[Gemini AI Filters Panel]
        FILTERS --> SEARCH[Quick Filters + Search]
    end
    
    style GEMINI fill:#4285F4,color:#fff
    style FILTERS fill:#FFD700,color:#000
```

### Gemini Analysis Response Structure

The AI extracts the following metadata from each image:

| Field | Type | Description | Example |
|-------|------|-------------|---------|
| `caption` | string | Natural language scene description | "Nighttime urban street with parked vehicles" |
| `tags` | string[] | Scene classification tags | `["outdoor", "night", "urban", "street"]` |
| `objects` | string[] | Detected objects | `["car", "streetlight", "building"]` |
| `peopleCount` | number | Number of people detected | `2` |
| `vehicles` | object[] | Vehicle details with type, color, make | `[{type: "SUV", color: "gray", make: "Mercedes"}]` |
| `licensePlates` | string[] | Detected license plate numbers | `["ABC-123"]` |
| `weapons` | string[] | Detected weapons (if any) | `["handgun"]` |
| `clothingColors` | string[] | Clothing colors of detected people | `["black", "white", "blue"]` |
| `textExtracted` | string[] | Text/signs visible in image | `["STOP", "Main St"]` |
| `qualityScore` | number | Image quality 0-100 | `85` |

### Quick Filters in Topology Graph

The Gemini AI Filters panel provides instant filtering capabilities:

```mermaid
flowchart LR
    subgraph "Filter Categories"
        QF[Quick Filters]
        VT[Vehicle Types]
        CC[Clothing Colors]
    end
    
    subgraph "Quick Filters"
        QF --> W[🛡️ Weapons]
        QF --> LP[🚗 License Plates]
        QF --> MP[👥 2+ People]
    end
    
    subgraph "Vehicle Types"
        VT --> CAR[car]
        VT --> SUV[SUV]
        VT --> VAN[van]
        VT --> TRUCK[truck]
        VT --> MOTO[motorcycle]
    end
    
    subgraph "Clothing Colors"
        CC --> BLK[black]
        CC --> WHT[white]
        CC --> BLU[blue]
        CC --> RED[red]
        CC --> GRY[gray]
    end
    
    subgraph "Search Action"
        W --> SEARCH[🔍 Search Button]
        LP --> SEARCH
        MP --> SEARCH
        CAR --> SEARCH
        BLK --> SEARCH
        SEARCH --> |"Filter graph"| RESULT[Only Matching Nodes Displayed]
    end
    
    style SEARCH fill:#EAB308,color:#000
    style RESULT fill:#22C55E,color:#fff
```

### Filter Behavior

When you click **Search** with filters selected:

1. **Non-matching nodes are hidden** - Only events matching your criteria are displayed
2. **Connected cameras/locations shown** - Related infrastructure nodes remain visible
3. **Matching events highlighted** - Gold color and increased size for easy identification
4. **Auto-zoom** - Graph automatically zooms to fit filtered results
5. **Toast notification** - Shows count of matching events found

Click **Clear** to restore the full graph.

### Settings Configuration

Configure Gemini AI processing in the **Settings** page:

| Setting | Description | Default |
|---------|-------------|---------|
| **Model** | Gemini model to use | `gemini-2.0-flash` |
| **Batch Size** | Images per CRON run | `100` |
| **Enabled** | Toggle AI processing | `false` |
| **Schedule** | Minutes between runs | `30` |

### Available Models

| Model | Description | Rate Limit |
|-------|-------------|------------|
| `gemini-2.0-flash` | Fast multimodal model (recommended) | 15 RPM |
| `gemini-2.0-flash-lite` | Lightweight, lower cost | 30 RPM |
| `gemini-2.5-flash` | Latest with improved capabilities | 15 RPM |
| `gemini-2.5-pro` | Most capable for complex analysis | 2 RPM |

### API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/data/gemini-config` | GET/POST | Get/update Gemini configuration |
| `/api/data/gemini-search` | GET | Search events by AI metadata |
| `/api/data/gemini-models` | GET | List available models for API key |
| `/api/cron/process-gemini-images` | GET | Trigger image processing CRON |
| `/api/data/sync-gemini-neo4j` | POST | Backfill Gemini data from PostgreSQL to Neo4j |

### Gemini Neo4j Sync *(Fixed Dec 11)*

The Gemini AI analysis data is now properly synced to Neo4j Event nodes, enabling Cypher queries on the Topology screen. 

**What was fixed:**
- The `updateNeo4jEventWithGemini()` function was matching on the wrong field (`eventId` instead of `id`)
- Neo4j Event nodes are created with `id = eventDbId` (e.g., `evt_1765448367183_ry79lkofi`)
- The fix ensures Gemini properties are correctly saved to the matching Neo4j node

**Backfill existing data:**
```bash
# Sync processed snapshots to Neo4j (no re-analysis)
curl -X POST "https://eli.visiumtechnologies.com/api/data/sync-gemini-neo4j?limit=100"

# Re-analyze images and sync to Neo4j
curl -X POST "https://eli.visiumtechnologies.com/api/data/sync-gemini-neo4j?reanalyze=true&limit=50"
```

**Verify in Neo4j:**
```cypher
MATCH (e:Event) WHERE e.geminiProcessedAt IS NOT NULL
RETURN e.id, e.geminiCaption, e.geminiVehicles, e.geminiLicensePlates
LIMIT 10
```

### Search Query Parameters

| Parameter | Type | Description | Example |
|-----------|------|-------------|---------|
| `hasWeapons` | boolean | Filter for weapon detection | `true` |
| `licensePlate` | string | Filter by plate number (* for any) | `ABC-123` or `*` |
| `minPeopleCount` | number | Minimum people in scene | `2` |
| `vehicleType` | string | Filter by vehicle type | `SUV` |
| `clothingColor` | string | Filter by clothing color | `black` |
| `limit` | number | Max results to return | `100` |

---

## 🔍 Reverse Image Search *(New Dec 2025)*

The Reverse Image Search feature enables investigators to upload a tip image (screenshot, photo from witness, etc.) and find matching events across the entire surveillance system.

### How It Works

```mermaid
flowchart TB
    subgraph "User Upload"
        UP[Upload Image] --> |"Drag & Drop or Click"| UI[TopologyGraph Sidebar]
        UI --> |"Base64 + MIME Type"| API[/api/data/reverse-image-search]
    end

    subgraph "AI Analysis"
        API --> GEMINI[Gemini 2.0 Flash]
        GEMINI --> |"Extract Features"| FEATURES[Extracted Metadata]
    end

    subgraph "Feature Extraction"
        FEATURES --> VEH[Vehicles: type, make, color]
        FEATURES --> PLATES[License Plates]
        FEATURES --> PEOPLE[People Count]
        FEATURES --> CLOTHING[Clothing Colors]
        FEATURES --> COLORS[Scene Colors]
        FEATURES --> TEXT[Extracted Text]
    end

    subgraph "Matching Engine"
        VEH --> MATCH[Neo4j Event Matching]
        PLATES --> MATCH
        PEOPLE --> MATCH
        CLOTHING --> MATCH
        COLORS --> MATCH
        TEXT --> MATCH
        MATCH --> |"Calculate Scores"| CONF[Confidence Scoring]
    end

    subgraph "Results"
        CONF --> |"Ranked by Confidence"| RESULTS[Match Results]
        RESULTS --> |"Apply Filter"| GRAPH[Filtered Topology Graph]
    end

    style GEMINI fill:#4285F4,color:#fff
    style MATCH fill:#10B981,color:#fff
    style CONF fill:#EAB308,color:#000
```

### Location in UI

The Reverse Image Search panel is located in the **Topology Graph sidebar**, below the "Gemini AI Filters" section. Look for the cyan-colored card with a search icon.

### How to Use

1. **Navigate to Topology Graph** - Open the Topology Graph page from the dashboard
2. **Find the Reverse Image Search panel** - Scroll down in the left sidebar
3. **Upload an image** - Either:
   - Drag and drop an image onto the upload zone
   - Click the upload zone to browse for a file
4. **Wait for analysis** - Gemini AI will analyze the image (usually 2-5 seconds)
5. **Review extracted features** - See what the AI detected in your image
6. **Browse matches** - Scroll through matching events, ranked by confidence
7. **Click a match** - The graph will center on that node
8. **Apply to Graph** - Filter the entire graph to show only matching events

### Supported Image Formats

| Format | Extension | Max Size |
|--------|-----------|----------|
| JPEG | `.jpg`, `.jpeg` | 10 MB |
| PNG | `.png` | 10 MB |
| WebP | `.webp` | 10 MB |

### Confidence Scoring Algorithm

The matching engine calculates a confidence score (0-100%) using weighted feature matching:

| Feature | Weight | Description |
|---------|--------|-------------|
| **License Plates** | 40% | Exact or partial plate number match |
| **Vehicle Attributes** | 25% | Matching type, make, or color |
| **Clothing Colors** | 15% | Any matching clothing colors |
| **People Count** | 10% | Exact or close match (±1 person) |
| **Scene Colors** | 5% | Similar dominant color palette |
| **Extracted Text** | 5% | Partial text/sign matches |

**Confidence Thresholds:**
- 🟢 **80%+** - High confidence match (green badge)
- 🟡 **50-79%** - Medium confidence (yellow badge)
- 🟠 **Below 50%** - Low confidence (orange badge)

### Extracted Metadata

The AI extracts the following from uploaded images:

| Field | Example Values |
|-------|---------------|
| Caption | "Nighttime urban street with parked vehicles" |
| Vehicles | SUV, sedan, pickup, motorcycle |
| License Plates | "ABC-123", "XYZ-789" |
| People Count | 3 |
| Clothing Colors | black, white, blue, red |
| Scene Colors | gray, dark blue, amber |
| Extracted Text | "STOP", "Main St", store signs |

### API Endpoint

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/data/reverse-image-search` | POST | Perform reverse image search |

**Request Body:**
```json
{
  "image": "base64-encoded-image-data",
  "mimeType": "image/jpeg"
}
```

**Response:**
```json
{
  "success": true,
  "analysis": {
    "caption": "A busy street scene with multiple vehicles...",
    "vehicles": [{"type": "SUV", "color": "gray", "make": "Mercedes"}],
    "licensePlates": ["ABC-123"],
    "peopleCount": 2,
    "clothingColors": ["black", "blue"]
  },
  "matches": [
    {
      "id": "evt_123...",
      "eventId": "4829655691653739",
      "channelId": "CAM-001",
      "timestamp": "2025-12-11T10:30:00Z",
      "imageUrl": "https://res.cloudinary.com/...",
      "confidence": 85,
      "matchReasons": ["License plate partial match: ABC", "Vehicle type match: SUV"]
    }
  ],
  "stats": {
    "totalEventsSearched": 1500,
    "matchesFound": 12,
    "processingTimeMs": 2340,
    "model": "gemini-2.0-flash"
  }
}
```

### Use Cases

1. **Tip Follow-up** - Witness provides a phone photo; find where that vehicle/person appears in surveillance
2. **Cross-Reference** - Upload a screenshot from one camera to find the same subject in other locations
3. **Pattern Analysis** - Search for similar scenes or vehicles across the entire network
4. **Suspect Tracking** - Upload a suspect photo to trace their movements through camera network

---

## 🧠 AI Pattern Discovery Agents *(New Dec 2025)*

ELI includes three autonomous AI agents that continuously scan surveillance data to discover patterns ("needles in the haystack") that would be impossible for human operators to detect manually across thousands of cameras.

### System Architecture

```mermaid
flowchart TB
    subgraph "Trigger Sources"
        CRON[⏰ CRON Schedule\n7-second runs]
        CTX[🖱️ Context Menu\nRight-click → Find Timeline/Correlations]
        MAN[👆 Manual Trigger\nDashboard → Run Now]
    end

    subgraph "AI Agent Handlers"
        CRON --> TL[Timeline Agent]
        CRON --> CR[Correlation Agent]
        CRON --> AN[Anomaly Agent]
        CTX --> TL
        CTX --> CR
        MAN --> TL
        MAN --> CR
        MAN --> AN
    end

    subgraph "Core Processing"
        TL --> FETCH[Fetch Events\nfrom Neo4j]
        CR --> FETCH
        AN --> FETCH
        FETCH --> SIM[Similarity Matching\nJaccard Index 90%+]
        SIM --> DUP[Duplicate Detection\n10-node threshold]
        DUP --> TAG[Apply Neo4j Tags\nArray properties]
    end

    subgraph "Persistence"
        TAG --> NEO[(Neo4j\ntimelineTags\ncorrelationTags\nanomalyTags)]
        TAG --> PG[(PostgreSQL\nagent_runs\nagent_run_logs)]
    end

    subgraph "Dashboards"
        PG --> TLD[Timeline Dashboard\n/dashboard/agents/timeline]
        PG --> CRD[Correlation Dashboard\n/dashboard/agents/correlation]
        PG --> AND[Anomaly Dashboard\n/dashboard/agents/anomaly]
    end

    style TL fill:#8B5CF6,color:#fff
    style CR fill:#3B82F6,color:#fff
    style AN fill:#F97316,color:#fff
    style NEO fill:#00A86B,color:#fff
    style PG fill:#336791,color:#fff
```

### The Three Agents

| Agent | Purpose | Output | Dashboard Route |
|-------|---------|--------|-----------------|
| **Timeline** | Discovers temporal sequences of related events | Ordered sequence with timestamps | `/dashboard/agents/timeline` |
| **Correlation** | Finds clusters of similar events (order-independent) | Unordered cluster with centroid | `/dashboard/agents/correlation` |
| **Anomaly** | Detects unusual events (fires, violence, weapons) | Severity-coded group | `/dashboard/agents/anomaly` |

### Timeline Agent

Discovers events that are temporally and semantically related — like the same vehicle appearing at different locations over time.

```mermaid
flowchart LR
    subgraph "Input"
        E1[Event 10:00 AM\nVehicle: Gray SUV]
        E2[Event 10:15 AM\nVehicle: Gray SUV]
        E3[Event 10:45 AM\nVehicle: Gray SUV]
        E4[Event 11:00 AM\nUnrelated]
    end

    subgraph "Similarity Matching"
        E1 --> |"90% match"| G[Group]
        E2 --> |"92% match"| G
        E3 --> |"88% match"| G
        E4 -.-> |"15% match"| X[❌ Excluded]
    end

    subgraph "Output"
        G --> TL[📅 Timeline\n3 events\nGray SUV tracked\nacross 3 cameras]
    end

    style G fill:#8B5CF6,color:#fff
    style TL fill:#22C55E,color:#fff
    style X fill:#EF4444,color:#fff
```

**Key Features:**
- Chronological ordering of discovered events
- Jaccard similarity matching (90% threshold)
- Weighted properties: license plates (40%), vehicles (25%), clothing (15%)
- Executive summary auto-generation
- Neo4j tagging with `timelineTags` array

### Correlation Agent

Finds groups of events that share similar properties, regardless of when they occurred.

```mermaid
flowchart TB
    subgraph "Similarity Graph"
        N1((Event A)) --> |"92%"| N2((Event B))
        N2 --> |"88%"| N3((Event C))
        N1 --> |"90%"| N3
        N4((Event D)) --> |"85%"| N5((Event E))
        N6((Event F))
    end

    subgraph "Union-Find Clustering"
        C1[Cluster 1\n3 nodes\nCentroid: Event B]
        C2[Cluster 2\n2 nodes\nCentroid: Event D]
        C3[Isolated\nEvent F]
    end

    N1 --> C1
    N2 --> C1
    N3 --> C1
    N4 --> C2
    N5 --> C2
    N6 --> C3

    style C1 fill:#3B82F6,color:#fff
    style C2 fill:#3B82F6,color:#fff
    style N2 fill:#14B8A6,color:#fff
```

**Key Features:**
- Union-find algorithm for efficient cluster detection
- Centroid identification (most connected node)
- Order-independent grouping
- Neo4j tagging with `correlationTags` array

### Anomaly Agent

Detects unusual or dangerous events by matching against anomaly keywords in Gemini AI tags.

```mermaid
flowchart TB
    subgraph "Anomaly Detection"
        TAGS[Gemini AI Tags] --> CHECK{Keyword Match?}
        CHECK --> |"fire, smoke, flames"| FIRE[🔥 Fire]
        CHECK --> |"fight, violence, attack"| VIOLENCE[⚔️ Violence]
        CHECK --> |"crash, accident"| ACCIDENT[🚗 Accident]
        CHECK --> |"weapon, gun, knife"| WEAPON[🔫 Weapon]
        CHECK --> |"crowd, gathering"| CROWD[👥 Gathering]
    end

    subgraph "Severity Classification"
        FIRE --> CRIT[🔴 CRITICAL]
        VIOLENCE --> CRIT
        WEAPON --> CRIT
        ACCIDENT --> HIGH[🟠 HIGH]
        CROWD --> HIGH
    end

    subgraph "Grouping"
        CRIT --> |"1-hour window"| GROUP[Anomaly Group\nby Region]
        HIGH --> |"1-hour window"| GROUP
    end

    style CRIT fill:#DC2626,color:#fff
    style HIGH fill:#F97316,color:#fff
```

**Severity Levels:**
| Level | Triggers | Color |
|-------|----------|-------|
| 🔴 **Critical** | fire, weapon, violence | Red |
| 🟠 **High** | accident, emergency, gathering | Orange |
| 🟡 **Medium** | suspicious, unusual, alert | Yellow |

**Key Features:**
- Keyword-based detection from Gemini tags
- Time windowing (1-hour default)
- Geographic segregation by region
- Neo4j tagging with `anomalyTags` array

### Context Menu Integration

Right-click on events, vehicles, or persons in the Topology Graph or Geographic Map to trigger agent discovery:

| Action | Description | Available For |
|--------|-------------|---------------|
| **Find Timeline** | Discover temporal sequence from this event | Events, Vehicles, Persons |
| **Find Correlations** | Find related events with similar properties | Events, Vehicles, Persons |

### Database Schema

```mermaid
erDiagram
    agent_runs {
        uuid id PK
        enum agent_type "timeline, correlation, anomaly"
        enum run_mode "cron, manual, context"
        enum status "pending, running, completed, failed, discarded"
        int nodes_processed
        int nodes_matched
        int nodes_tagged
        int batches_completed
        int processing_time_ms
        string group_id
        int group_size
        text executive_summary
        jsonb findings
        timestamp started_at
        timestamp completed_at
    }

    agent_config {
        enum agent_type PK
        boolean enabled
        int batch_size
        float confidence_threshold
        int min_group_size_cron
        int min_group_size_context
        int max_execution_ms
        int overlap_threshold
        boolean scan_new_events_only
        timestamp last_processed_timestamp
    }

    agent_run_logs {
        uuid id PK
        uuid run_id FK
        enum level "debug, info, warn, error"
        text message
        jsonb data
        timestamp created_at
    }

    agent_runs ||--o{ agent_run_logs : "has logs"
```

### API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/data/agent-config` | GET | Get agent configuration (all or by type) |
| `/api/data/agent-config` | POST | Update agent configuration |
| `/api/data/agent-runs` | GET | Get agent run history (with filters) |
| `/api/cron/agent-timeline` | GET | Trigger Timeline Agent |
| `/api/cron/agent-correlation` | GET | Trigger Correlation Agent |
| `/api/cron/agent-anomaly` | GET | Trigger Anomaly Agent |

**Query Parameters:**
- `?manual=true` - Trigger manual run (bypasses enabled check)
- `?anchorNodeId=<id>` - Context mode: start from specific node

### Settings Configuration

The Settings page includes an "AI Pattern Discovery Agents" section with:

- Agent overview cards for Timeline, Correlation, and Anomaly
- Quick navigation buttons to each agent dashboard
- Configuration documentation

### Execution Constraints

| Constraint | Value | Reason |
|------------|-------|--------|
| Max execution time | 7 seconds | Vercel serverless limit |
| Batch size | 100 events | Balance speed vs. coverage |
| Confidence threshold | 90% | High precision matching |
| Overlap threshold | 10 nodes | Prevent over-tagging |
| Scan mode | New events only | Incremental processing |

### Future Scalability

For billions of images, the architecture is designed to migrate to:
- **Inngest** - Step-based workflows, each step under 10s
- **Trigger.dev** - Durable workflows with job UI
- **Upstash QStash** - Message queue with retries
- **LSH (Locality-Sensitive Hashing)** - Pre-computed similarity for O(1) lookups

---

## Topology Graph Reporting *(New Dec 2025)*

Topology Graph Reporting turns an ad-hoc graph selection into a durable, shareable, executive-grade report.

It enables:

- Multi-select (Shift + drag lasso) across nodes
- AI-generated analysis using Google Gemini
- Issue flagging linked back to selected nodes/edges
- Reports table in Executive Dashboard
- Exports (JSON/CSV) and share links

### Step-by-step: How it works

1. **Select nodes**
   - On the Topology Graph page, hold **Shift** and drag to draw a selection box.
   - Selected nodes are highlighted and a selection card shows counts.

2. **Generate Summary**
   - Click **Generate Summary**.
   - The UI posts `nodeIds` (and optionally `edgeIds`) to `/api/data/topology-reports`.

3. **Backend builds context**
   - The API fetches full node + relationship properties from Neo4j for the selected IDs.
   - A structured prompt is assembled from those properties.

4. **Gemini generates the report**
   - The API calls the Google Generative Language `:generateContent` endpoint using `GEMINI_API_KEY`.
   - Response text is extracted as Markdown.

5. **Persist the report**
   - The report is stored in PostgreSQL (`topology_reports`), including selection IDs and a snapshot of the context in `metadata`.

6. **View, export, and share**
   - Reports appear in the Executive Dashboard “Reports” tab.
   - Reports can be exported as JSON/CSV and shared via `/share/report/:token`.

### End-to-end sequence

```mermaid
sequenceDiagram
    autonumber
    actor U as User
    participant UI as TopologyGraph.tsx
    participant API as /api/data/topology-reports
    participant NEO as Neo4j
    participant GEM as Gemini API
    participant PG as PostgreSQL

    U->>UI: Shift + drag lasso select
    U->>UI: Click Generate Summary
    UI->>API: POST { nodeIds, edgeIds }
    API->>NEO: Fetch nodes + edges context
    API->>GEM: generateContent(prompt)
    GEM-->>API: Markdown report text
    API->>PG: INSERT topology_reports
    PG-->>API: OK
    API-->>UI: { success, report }
    UI-->>U: Render report + actions

    opt Flag as Issue
        U->>UI: Click Flag as Issue
        UI->>API: POST ?action=flag
        API->>NEO: Set flaggedReportId on nodes/edges
        API->>PG: UPDATE topology_reports.flagged
        API-->>UI: OK
    end

    opt Share link
        U->>UI: Create share link
        UI->>API: POST ?action=share
        API->>PG: UPDATE topology_reports.shareToken
        API-->>UI: { shareToken }
        UI-->>U: Copy URL /share/report/:token
    end
```

### Backend flow (data and responsibilities)

```mermaid
flowchart TB
    subgraph UI[Client]
        A[Selection Box\nShift + Drag] --> B[Selected nodeIds/edgeIds]
        B --> C["Generate Summary\nPOST /api/data/topology-reports"]
        C --> D["Render report\n(Streamdown)"]
        D --> E[Export/Share/Flag]
    end

    subgraph API[/api/data/topology-reports]
        F[Validate input + auth] --> G["Fetch Neo4j context\n(getTopologyReportContextFromNeo4j)"]
        G --> H["Build prompt\n(buildReportPrompt)"]
        H --> I["Gemini generateContent\n(GEMINI_API_KEY)"]
        I --> J["Persist report\n(PostgreSQL topology_reports)"]
        J --> K[Return report payload]
    end

    B --> F
    K --> D

    style API fill:#111827,color:#fff
    style UI fill:#0B1220,color:#fff
```

### PostgreSQL schema (reports)

```mermaid
erDiagram
    topology_reports {
        varchar id PK
        varchar title
        text content
        timestamp createdAt
        varchar createdByUserId
        text createdByUserName
        jsonb nodeIds
        jsonb edgeIds
        int nodeCount
        int edgeCount
        boolean flagged
        timestamp flaggedAt
        varchar shareToken
        jsonb metadata
    }
```

### Report lifecycle

```mermaid
stateDiagram-v2
    [*] --> Selected: Nodes selected
    Selected --> Generating: Generate Summary
    Generating --> Saved: Stored in PostgreSQL
    Saved --> Shared: Share token created
    Saved --> Flagged: Flag as Issue
    Shared --> [*]
    Flagged --> [*]
```

### Key files

- **Frontend**
  - `client/src/pages/TopologyGraph.tsx` (selection UI + report actions)
  - `client/src/pages/ExecutiveDashboard.tsx` (reports list)
  - `client/src/pages/SharedReport.tsx` (read-only public view)

- **Backend**
  - `api/data/topology-reports.ts` (generate/flag/share/list/export)
  - `api/data/topology-neo4j.ts` (context fetch + flaggedReportId setter)
  - `api/lib/gemini.ts` (Gemini text generation helper)

- **Database**
  - `drizzle/schema.ts` (`topology_reports` table definition)

### API endpoints

- **Generate report**
  - `POST /api/data/topology-reports`
  - Body: `{ nodeIds: string[], edgeIds?: string[] }`

- **List reports**
  - `GET /api/data/topology-reports`

- **Get report**
  - `GET /api/data/topology-reports?id=<reportId>`
  - `GET /api/data/topology-reports?shareToken=<token>`

- **Export**
  - `GET /api/data/topology-reports?id=<reportId>&format=json`
  - `GET /api/data/topology-reports?id=<reportId>&format=csv`

- **Flag selection**
  - `POST /api/data/topology-reports?action=flag`

- **Create share link**
  - `POST /api/data/topology-reports?action=share`

### Environment variables

- `GEMINI_API_KEY` (required for report generation)
- `DATABASE_URL` (required for report persistence)
- Neo4j connection variables (required for context fetch)

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
- [x] **Gemini AI Image Analysis** - Automatic metadata extraction from surveillance images *(Dec 2025)*
- [x] **Quick Filters** - Filter topology graph by AI-detected properties (weapons, plates, people, vehicles, colors) *(Dec 2025)*
- [x] **Neo4j Gemini Sync** - AI metadata synced to Neo4j Event nodes for graph queries *(Dec 2025)*
- [x] **Reverse Image Search** - Upload an image to find matching surveillance events using Gemini AI *(Dec 2025)*

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
