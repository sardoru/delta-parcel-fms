# DeltaPlot — Como, Mississippi Farm Management System

A parcel-first precision agriculture operations cockpit built for **Mississippi farmers**, grounded in **official 2024 Mississippi MARIS cadastral farmland parcels** around **Como, Mississippi (Panola County, FIPS `28107`)** on a live 3D-tilted satellite map.

![DeltaPlot Como, MS Live Satellite Parcel Dashboard](docs/preview.png)

---

## Overview

DeltaPlot unifies real Mississippi county cadastral boundaries, high-resolution satellite imagery, vegetation vigor diagnostics, USDA NRCS soil series mapping, fleet telemetry, and poly-pipe / pivot irrigation zone calibration inside a single dark-glass spatial HUD.

Out of the box, the application ships with **120 official cultivated farm parcels** around **Como, MS 38619** (totaling **24,087 surveyed GIS acres** and **15,433 cultivated row-crop acres** along Highway 310, US-51, Interstate 55, Compress Rd, Dunlap Rd, Old Panola Rd, Wilborn Creek, and Holston Rd) — and can dynamically query additional Mississippi parcels anywhere in the viewport directly from the live **MARIS 2024 Cadastral ArcGIS REST API**.

---

## Key Features

### 1. Live 3D-Tilted Geospatial Parcel Map (MapLibre GL JS)
- **High-Resolution Satellite Imagery:** Powered by Esri World Imagery with subtle transportation and place reference overlays so growers can orient by real roads (`I-55`, `US-51`, `MS-310`, `W Oak Ave`) without obscuring crop rows.
- **3D Oblique Aerial & 2D Survey Modes:** Launches in a 48° oblique 3D aerial pitch (`3D` toggle switches cleanly to 0° top-down cadastral survey view).
- **Interactive Cadastral Selection:** Click any of the 120+ Panola County farm parcels to smoothly fly to it, illuminate its exact surveyed boundary in luminous chartreuse, and refresh all analytics, weather, irrigation, and dossier panels.
- **Multi-Layer Spectral & Soil Modes:**
  - **Satellite:** Natural-color aerial imagery with glowing active parcel boundary and hover previews.
  - **NDVI:** Parcel-wide vegetation vigor index color overlay (`0.34 – 0.92` scale).
  - **Soil:** Panola County MLRA-134 soil series overlay (**Memphis Silt Loam**, **Loring Silt Loam**, **Collins Silt Loam**, **Falaya Silt Loam**, **Grenada Silt Loam**).
- **Live MARIS GIS Viewport Sync (`Sync MARIS GIS`):** Pan anywhere across Panola, Tate, Quitman, Tunica, DeSoto, Leflore, or neighboring West Mississippi counties and pull live 2024 cultivated farm parcels (`CULT_AC1 >= 25 OR GISACRES >= 50`) straight from `gis.mississippi.edu`.
- **Geodesic Parcel Plotter (`+ Plot Parcel`):** Click 3 or more GPS vertices directly on the satellite map to survey custom sub-fields or management blocks with real spherical-earth geodesic acreage calculation, persisted to `localStorage`.

### 2. Precision Agronomy & Stress Analytics (Left Rail)
- **Segmented Health Arc Gauge & Area KPI:** Toggle seamlessly between **Plot** (active parcel GIS vs. cultivated acreage and PLSS Section-Township-Range) and **Farm** (whole-operation aggregate), plus instant **AC / HA** and **°F / °C** unit conversion.
- **Health Trend Waveform:** Interactive `7 Days`, `14 Days`, and `30 Days` canopy vigor & NDVI time-series chart with hover scrubbing and optimal threshold baseline.
- **Health Map (`Stress Zones`):** 16×6 sub-parcel spatial stress heatmap. Hovering any zone inspects local moisture %, NDVI, and agronomic stress cause (e.g., Loring fragipan moisture deficit or terrace runoff) while simultaneously projecting a pulsing crosshair at that exact sub-zone inside the selected parcel on the map.
- **AI Agronomy Insights (`AI Insights`):** Parcel-specific MSU Extension & USDA-NRCS aligned prescriptions (harvest windows, variable-rate lime recommendations, MLRA-134 loess erosion control, EQIP eligibility) with one-click scheduling into the parcel operations log.

### 3. Live Fleet, Irrigation Offset & Harvest Telemetry (Bottom Dock)
- **Equipment Telemetry Cards (`Tractor T-04` & `Sprayer S-01`):** Isometric technical wireframes, live `Online` / `Working` status, RTK/LTE telemetry badges, stepped shift duty-cycle graphs, fuel/tank/area/speed readouts, and click-to-inspect parcel dispatch reassignment.
- **Interactive Irrigation Offset Calibration:** Live `Zone A` / `Zone B` (`Z1–Z4`) timing offset matrix for poly-pipe, surge valves, and center-pivot spans. Click any zone offset cell to step-calibrate timing (`±0.5 min`) and recalculate average variance in real time.
- **Live Yield Volume:** Real-time harvest mass readout (`lbs` / `kg`) and load-interval pulse spectrum tailored to each parcel's crop.

### 4. Real-Time Como Weather & Panola County Cadastral Dossier
- **Live Como, MS Weather:** Fetches live temperature, wind speed & compass bearing, humidity, and sky condition for Como (`34.5101°N, -89.9401°W`) via Open-Meteo with resilient offline defaults.
- **Parcel Dossier Drawer:** Displays official Panola County assessor records (`PARNO`, `PLSS`, `Legal Description`, `Site Address`, `2024 Assessed Land Value`, `Surveyed vs. Cultivated Acres`), USDA soil pH/CEC/drainage specs, live **Field Activity Logger**, and one-click **JSON Parcel Export**.

---

## Tech Stack

| Layer | Technology |
| --- | --- |
| Framework | React 19 + TypeScript + Vite 6 |
| Styling | Tailwind CSS v4 + Self-hosted `Plus Jakarta Sans` & `JetBrains Mono` (`@fontsource`) |
| Mapping & WebGL | MapLibre GL JS `v4.7.1` |
| Icons | `@phosphor-icons/react` |
| Cadastral GIS Data | Official Mississippi MARIS 2024 Statewide Parcels (`MS_Parcels_August_2024` / Panola County FIPS `28107`) |
| Satellite Imagery | Esri World Imagery + World Transportation / Boundaries & Places |
| Live Weather | Open-Meteo Forecast API (`34.5101°N, -89.9401°W`) |
| Hosting | Vercel (static SPA) |

---

## Project Structure

```text
delta-parcel-fms/
├── docs/
│   └── preview.png                  # Live Como, MS dashboard screenshot
├── public/
│   ├── assets/
│   │   └── farmer-avatar.jpg        # Operator profile portrait
│   └── data/
│       └── como-ms-parcels.geojson  # 120 official 2024 MARIS Como, MS cultivated parcels (142 KB)
├── src/
│   ├── components/
│   │   ├── BottomTelemetryDock.tsx  # Fleet wireframes, irrigation offset tuner, live yield spectrum
│   │   ├── InspectorDrawers.tsx     # Panola cadastral dossier, AI agronomy drawer, equipment dispatch
│   │   ├── LeftAnalyticsRail.tsx    # Segmented health gauge, trend chart, 16x6 stress heatmap
│   │   ├── ParcelMapStage.tsx       # MapLibre GL 3D satellite stage, MARIS sync, geodesic plotter
│   │   └── TopHudBar.tsx            # Live weather pills, parcel/PARNO search, unit toggle, alerts
│   ├── data/
│   │   └── comoParcels.ts           # MARIS feature hydration, Panola MLRA-134 soils, fleet & alerts
│   ├── types/
│   │   └── farm.ts                  # TypeScript domain models (Parcel, Equipment, StressCell, etc.)
│   ├── utils/
│   │   └── units.ts                 # Geodesic area (spherical excess), bbox, AC/HA & °F/°C formatters
│   ├── App.tsx                      # State orchestration, MARIS live fetch, Open-Meteo weather
│   ├── index.css                    # Smoked obsidian glass tokens, fonts, animations
│   └── main.tsx                     # Application entry point
├── vercel.json                      # Vercel Vite SPA deployment configuration
├── vite.config.ts
└── package.json
```

---

## Local Development

### Prerequisites
- Node.js `>= 20`
- npm `>= 10`

### Run Locally
```bash
git clone <your-repo-url>
cd delta-parcel-fms
npm install
npm run dev
```
Open `http://localhost:5173` in your browser.

### Production Build
```bash
npm run build
npm run preview
```

---

## Data Attribution & Sources
- **Cadastral Parcel Polygons & Assessor Metadata:** Mississippi Automated Resource Information System (**MARIS**) / MDEQ / Panola County Tax Assessor (`MS_Parcels_August_2024`).
- **Satellite Base Tiles:** Esri, Maxar, Earthstar Geographics, and the GIS User Community.
- **Weather Telemetry:** [Open-Meteo](https://open-meteo.com/) real-time forecast API.
- **Agronomy & Soil Context:** USDA-NRCS MLRA 134 (Southern Mississippi Valley Silty Uplands — Panola County) & Mississippi State University Extension row-crop management baselines.
