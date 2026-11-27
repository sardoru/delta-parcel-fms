import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  hydrateMarisFeature,
  INITIAL_ALERTS,
  INITIAL_EQUIPMENT,
} from './data/comoParcels';
import {
  AreaUnit,
  EquipmentUnit,
  FieldLogEntry,
  GeoGeometry,
  LiveWeather,
  LngLat,
  MapLayer,
  Parcel,
  RawMarisProperties,
  StressCell,
} from './types/farm';
import {
  compassFromDegrees,
  computeBbox,
  computeRingCentroid,
  wmoCodeToLabel,
} from './utils/units';
import { ParcelMapStage } from './components/ParcelMapStage';
import { TopHudBar } from './components/TopHudBar';
import { LeftAnalyticsRail } from './components/LeftAnalyticsRail';
import { BottomTelemetryDock } from './components/BottomTelemetryDock';
import {
  AIInsightsDrawer,
  EquipmentDrawer,
  ParcelDetailDrawer,
} from './components/InspectorDrawers';

const CUSTOM_PLOTS_KEY = 'deltaplot_como_custom_v1';

const DEFAULT_COMO_WEATHER: LiveWeather = {
  tempF: 63,
  windMph: 8,
  windDir: 'SSW',
  humidityPct: 64,
  condition: 'Clear Sky',
  isLive: false,
};

function loadCustomParcels(): Parcel[] {
  try {
    const raw = localStorage.getItem(CUSTOM_PLOTS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function App() {
  const [parcels, setParcels] = useState<Parcel[]>([]);
  const [loadingParcels, setLoadingParcels] = useState(true);
  const [equipment, setEquipment] = useState<EquipmentUnit[]>(INITIAL_EQUIPMENT);
  const [selectedParcelId, setSelectedParcelId] = useState<string>('como-1039-3200000-0000100');
  const [activeLayer, setActiveLayer] = useState<MapLayer>('satellite');
  const [unit, setUnit] = useState<AreaUnit>('ac');
  const [hoveredStressCell, setHoveredStressCell] = useState<StressCell | null>(null);
  const [weather, setWeather] = useState<LiveWeather>(DEFAULT_COMO_WEATHER);

  const [isDrawingPlot, setIsDrawingPlot] = useState(false);
  const [isSyncingMaris, setIsSyncingMaris] = useState(false);
  const [marisSyncMessage, setMarisSyncMessage] = useState<string | null>(null);
  const [parcelDetailOpen, setParcelDetailOpen] = useState(false);
  const [aiInsightsOpen, setAiInsightsOpen] = useState(false);
  const [inspectedEquipmentId, setInspectedEquipmentId] = useState<string | null>(null);

  // Load 120 real surveyed 2024 MARIS Como, MS farm parcels + any user-plotted custom parcels
  useEffect(() => {
    let active = true;
    fetch('/data/como-ms-parcels.geojson')
      .then((r) => r.json())
      .then((fc: { features: { properties: RawMarisProperties; geometry: GeoGeometry }[] }) => {
        if (!active) return;
        const hydrated = (fc.features || []).map((f) => hydrateMarisFeature(f, 'MARIS 2024'));
        const custom = loadCustomParcels();
        const combined = [...custom, ...hydrated];
        setParcels(combined);
        if (combined.length > 0 && !combined.some((p) => p.id === 'como-1039-3200000-0000100')) {
          setSelectedParcelId(combined[0].id);
        }
        setLoadingParcels(false);
      })
      .catch(() => {
        if (active) setLoadingParcels(false);
      });
    return () => {
      active = false;
    };
  }, []);

  // Fetch real live weather for Como, MS (34.5101° N, -89.9401° W) from Open-Meteo
  useEffect(() => {
    fetch(
      'https://api.open-meteo.com/v1/forecast?latitude=34.5101&longitude=-89.9401&current=temperature_2m,relative_humidity_2m,weather_code,wind_speed_10m,wind_direction_10m&temperature_unit=fahrenheit&wind_speed_unit=mph'
    )
      .then((r) => r.json())
      .then((data) => {
        const cur = data?.current;
        if (!cur) return;
        setWeather({
          tempF: Math.round(cur.temperature_2m),
          windMph: Math.round(cur.wind_speed_10m),
          windDir: compassFromDegrees(cur.wind_direction_10m || 190),
          humidityPct: Math.round(cur.relative_humidity_2m),
          condition: wmoCodeToLabel(cur.weather_code ?? 0),
          isLive: true,
        });
      })
      .catch(() => {
        // fallback weather already active
      });
  }, []);

  const selectedParcel = useMemo(
    () => parcels.find((p) => p.id === selectedParcelId) ?? parcels[0],
    [parcels, selectedParcelId]
  );

  const inspectedEquipment = useMemo(
    () => equipment.find((e) => e.id === inspectedEquipmentId) ?? null,
    [equipment, inspectedEquipmentId]
  );

  // Live query official Mississippi MARIS 2024 Cadastral ArcGIS Server for the visible viewport!
  const handleSyncMarisBounds = useCallback(
    async (bounds: { west: number; south: number; east: number; north: number }) => {
      setIsSyncingMaris(true);
      setMarisSyncMessage(null);
      try {
        const params = new URLSearchParams({
          geometry: `${bounds.west},${bounds.south},${bounds.east},${bounds.north}`,
          geometryType: 'esriGeometryEnvelope',
          inSR: '4326',
          spatialRel: 'esriSpatialRelIntersects',
          where: 'CULT_AC1 >= 25 OR GISACRES >= 50',
          outFields:
            'PARNO,TAXMAP,SECTION,TWSP,RANGE,SITEADD,SZIP,TAXACRES,GISACRES,CULT_AC1,CULT_AC2,UNCULT_AC1,LEGLDESC,CNTYNAME,LATDEC,LONGDEC,TAXYEAR,LANDVAL,TOTVAL',
          outSR: '4326',
          f: 'geojson',
        });
        const url = `https://gis.mississippi.edu/server/rest/services/Cadastral/MS_Parcels_August_2024/MapServer/1/query?${params.toString()}`;
        const res = await fetch(url);
        const fc = await res.json();
        const incoming: Parcel[] = (fc.features || [])
          .filter(
            (f: { geometry?: { type: string } }) =>
              f.geometry && (f.geometry.type === 'Polygon' || f.geometry.type === 'MultiPolygon')
          )
          .slice(0, 80)
          .map((f: { properties: Record<string, unknown>; geometry: GeoGeometry }) => {
            const p = f.properties;
            const rawProps: RawMarisProperties = {
              parno: String(p.PARNO || '').replace(/\s+/g, ' ').trim(),
              taxmap: String(p.TAXMAP || '').trim(),
              section: String(p.SECTION || '').trim(),
              twsp: String(p.TWSP || '').trim(),
              range: String(p.RANGE || '').trim(),
              siteadd: String(p.SITEADD || '').trim(),
              szip: String(p.SZIP || '38619').trim(),
              gisAcres: Number(Number(p.GISACRES || 0).toFixed(1)),
              taxAcres: Number(Number(p.TAXACRES || 0).toFixed(1)),
              cultAcres: Number((Number(p.CULT_AC1 || 0) + Number(p.CULT_AC2 || 0)).toFixed(1)),
              uncultAcres: Number(Number(p.UNCULT_AC1 || 0).toFixed(1)),
              legldesc: String(p.LEGLDESC || '').replace(/\s+/g, ' ').trim(),
              cntyname: String(p.CNTYNAME || 'PANOLA').trim(),
              lat: Number(p.LATDEC || 34.51),
              lng: Number(p.LONGDEC || -89.94),
              taxyear: String(p.TAXYEAR || '2024').trim(),
              landVal: Number(p.LANDVAL || 0),
              totVal: Number(p.TOTVAL || 0),
            };
            return hydrateMarisFeature({ properties: rawProps, geometry: f.geometry }, 'MARIS Live');
          });

        let addedCount = 0;
        setParcels((prev) => {
          const existingIds = new Set(prev.map((x) => x.id));
          const novel = incoming.filter((x) => !existingIds.has(x.id));
          addedCount = novel.length;
          return novel.length > 0 ? [...prev, ...novel] : prev;
        });

        setMarisSyncMessage(
          addedCount > 0
            ? `Synced +${addedCount} live MARIS parcels`
            : `All ${incoming.length} farm parcels in view already loaded`
        );
      } catch {
        setMarisSyncMessage('MARIS GIS unavailable — showing local 120 Como parcels');
      } finally {
        setIsSyncingMaris(false);
      }
    },
    []
  );

  const handleAdjustIrrigationZone = (zoneId: string) => {
    if (!selectedParcel) return;
    setParcels((prev) =>
      prev.map((parcel) => {
        if (parcel.id !== selectedParcel.id) return parcel;
        return {
          ...parcel,
          irrigationOffsets: parcel.irrigationOffsets.map((z) => {
            if (z.id !== zoneId) return z;
            const next = z.offsetMin <= -2.5 ? 2.0 : Number((z.offsetMin - 0.5).toFixed(1));
            return { ...z, offsetMin: next };
          }),
        };
      })
    );
  };

  const handleAddLog = (parcelId: string, entry: Omit<FieldLogEntry, 'id'>) => {
    setParcels((prev) =>
      prev.map((p) =>
        p.id === parcelId
          ? {
              ...p,
              logs: [{ ...entry, id: `log-${Date.now()}` }, ...p.logs],
            }
          : p
      )
    );
  };

  const handleFinishDrawPlot = (payload: {
    name: string;
    county: string;
    crop: Parcel['crop'];
    soilSeries: string;
    irrigationMethod: string;
    areaAcres: number;
    ring: LngLat[];
    geometry: GeoGeometry;
  }) => {
    if (!selectedParcel) return;
    const centroid = computeRingCentroid(payload.ring);
    const parno = `CUSTOM ${Math.floor(1000 + Math.random() * 8999)}`;
    const newParcel: Parcel = {
      ...selectedParcel,
      id: `como-custom-${Date.now()}`,
      name: payload.name,
      parno,
      fsaTract: `PARNO ${parno}`,
      county: payload.county,
      cityState: 'Como, MS 38619',
      siteAddress: 'Custom Surveyed Sub-Plot · Como, MS',
      plss: 'Sec 32 · T06S · R07W',
      legalDesc: `${payload.areaAcres} AC USER SURVEYED POLYGON`,
      source: 'User Surveyed',
      crop: payload.crop,
      areaAcres: payload.areaAcres,
      cultivatedAcres: payload.areaAcres,
      uncultivatedAcres: 0,
      healthPct: 91,
      healthDeltaPct: 1.4,
      statusBadge: 'Newly Surveyed',
      soilSeries: payload.soilSeries,
      irrigationMethod: payload.irrigationMethod,
      center: centroid,
      bbox: computeBbox(payload.geometry),
      geometry: payload.geometry,
      logs: [
        {
          id: `log-init-${Date.now()}`,
          date: 'Nov 26 · Now',
          category: 'Scouting',
          title: 'Custom Como Parcel Surveyed',
          operator: 'Caleb Vance',
          detail: `Plotted ${payload.areaAcres} geodesic acres (${payload.soilSeries}, ${payload.irrigationMethod}).`,
        },
      ],
    };

    setParcels((prev) => {
      const next = [newParcel, ...prev];
      try {
        const customOnly = next.filter((p) => p.source === 'User Surveyed');
        localStorage.setItem(CUSTOM_PLOTS_KEY, JSON.stringify(customOnly));
      } catch {
        // ignore storage quota
      }
      return next;
    });
    setSelectedParcelId(newParcel.id);
    setIsDrawingPlot(false);
  };

  const handleReassignEquipment = (eqId: string, parcelId: string) => {
    const targetParcel = parcels.find((p) => p.id === parcelId);
    setEquipment((prev) =>
      prev.map((eq) =>
        eq.id === eqId
          ? {
              ...eq,
              assignedParcelId: parcelId,
              currentTask: targetParcel
                ? `Active Field Pass - ${targetParcel.name}`
                : eq.currentTask,
            }
          : eq
      )
    );
    if (targetParcel) {
      setSelectedParcelId(targetParcel.id);
    }
  };

  if (loadingParcels || !selectedParcel) {
    return (
      <div className="flex h-[100dvh] w-full items-center justify-center bg-[#10130f] text-[#dce2d4]">
        <div className="glass-panel rounded-2xl px-6 py-4 text-center">
          <div className="text-[15px] font-semibold text-[#d8f274]">
            Loading Como, MS Cadastral Parcels...
          </div>
          <div className="mt-1 font-mono text-[11px] text-[#dce2d4]/60">
            Panola County · MARIS 2024 Statewide GIS
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative min-h-[100dvh] w-full overflow-x-hidden bg-[#10130f]">
      {/* Real 3D-Tilted MapLibre Satellite Stage with 120+ Official Como, MS Parcels */}
      <ParcelMapStage
        parcels={parcels}
        selectedParcel={selectedParcel}
        activeLayer={activeLayer}
        unit={unit}
        hoveredStressCell={hoveredStressCell}
        isDrawingPlot={isDrawingPlot}
        isSyncingMaris={isSyncingMaris}
        marisSyncMessage={marisSyncMessage}
        onSelectParcel={(id) => {
          setSelectedParcelId(id);
          setHoveredStressCell(null);
        }}
        onChangeLayer={setActiveLayer}
        onOpenParcelDetail={() => setParcelDetailOpen(true)}
        onSyncMarisBounds={handleSyncMarisBounds}
        onFinishDrawPlot={handleFinishDrawPlot}
        onCancelDrawPlot={() => setIsDrawingPlot(false)}
      />

      {/* Floating Precision-Ag Dashboard HUD */}
      <div className="pointer-events-none relative z-10 flex min-h-[100dvh] w-full max-w-full flex-col gap-3 overflow-x-hidden p-3 sm:p-4 lg:h-[100dvh] lg:flex-row lg:overflow-hidden">
        {/* Left Analytics Column */}
        <div className="pointer-events-auto order-2 flex w-full min-w-0 flex-col lg:order-1 lg:h-full lg:w-auto lg:overflow-y-auto lg:pr-0.5">
          <LeftAnalyticsRail
            parcels={parcels}
            selectedParcel={selectedParcel}
            unit={unit}
            hoveredStressCell={hoveredStressCell}
            onHoverStressCell={setHoveredStressCell}
            onOpenAIInsights={() => setAiInsightsOpen(true)}
            onOpenParcelDetail={() => setParcelDetailOpen(true)}
          />
        </div>

        {/* Right Main Space: Top HUD Bar + Open Interactive Map Window + Bottom Telemetry Dock */}
        <div className="order-1 flex w-full min-w-0 max-w-full flex-1 flex-col justify-between gap-3 lg:order-2">
          <TopHudBar
            parcels={parcels}
            equipment={equipment}
            selectedParcel={selectedParcel}
            alerts={INITIAL_ALERTS}
            weather={weather}
            unit={unit}
            onToggleUnit={() => setUnit((u) => (u === 'ac' ? 'ha' : 'ac'))}
            onSelectParcel={(id) => {
              setSelectedParcelId(id);
              setHoveredStressCell(null);
            }}
            onSelectEquipment={(eqId) => setInspectedEquipmentId(eqId)}
            isDrawingPlot={isDrawingPlot}
            onToggleDrawPlot={() => setIsDrawingPlot((v) => !v)}
          />

          {/* Compact Parcel Switcher Strip on small screens */}
          <div className="pointer-events-auto flex gap-1.5 overflow-x-auto pb-1 lg:hidden">
            {parcels.slice(0, 10).map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => setSelectedParcelId(p.id)}
                className={`shrink-0 rounded-full px-3 py-1.5 text-[11.5px] font-medium transition-colors ${
                  p.id === selectedParcel.id
                    ? 'bg-[#d8f274] text-[#141710]'
                    : 'glass-pill text-[#e5eae0]'
                }`}
              >
                {p.name}
              </button>
            ))}
          </div>

          {/* Open Interactive Map Window */}
          <div className="hidden flex-1 lg:block" />

          {/* Bottom Telemetry Dock */}
          <div className="pointer-events-auto">
            <BottomTelemetryDock
              equipment={equipment}
              selectedParcel={selectedParcel}
              unit={unit}
              onSelectEquipment={(eq) => {
                setSelectedParcelId(eq.assignedParcelId);
                setInspectedEquipmentId(eq.id);
              }}
              onAdjustIrrigationZone={handleAdjustIrrigationZone}
              onOpenParcelDetail={() => setParcelDetailOpen(true)}
            />
          </div>
        </div>
      </div>

      {/* Drawers & Modals */}
      {parcelDetailOpen && (
        <ParcelDetailDrawer
          parcel={selectedParcel}
          unit={unit}
          onClose={() => setParcelDetailOpen(false)}
          onAddLog={handleAddLog}
        />
      )}

      {aiInsightsOpen && (
        <AIInsightsDrawer
          parcel={selectedParcel}
          onClose={() => setAiInsightsOpen(false)}
          onPromoteToLog={(parcelId, title, detail) =>
            handleAddLog(parcelId, {
              date: 'Nov 26 · Scheduled',
              category: 'Application',
              title,
              operator: 'Caleb Vance (AI Plan)',
              detail,
            })
          }
        />
      )}

      {inspectedEquipment && (
        <EquipmentDrawer
          equipment={inspectedEquipment}
          parcels={parcels.slice(0, 25)}
          unit={unit}
          onClose={() => setInspectedEquipmentId(null)}
          onReassignParcel={handleReassignEquipment}
        />
      )}
    </div>
  );
}

export default App;
