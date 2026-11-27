import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  hydrateMarisFeature,
  REGION_ALERTS,
  REGION_EQUIPMENT,
} from './data/msParcels';
import { MS_REGIONS } from './data/regions';
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
  RegionId,
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

const CUSTOM_PLOTS_PREFIX = 'deltaplot_ms_custom_v2_';

const DEFAULT_WEATHER: LiveWeather = {
  tempF: 62,
  windMph: 8,
  windDir: 'SSW',
  humidityPct: 64,
  condition: 'Clear Sky',
  isLive: false,
};

function loadCustomParcels(regionId: RegionId): Parcel[] {
  try {
    const raw = localStorage.getItem(`${CUSTOM_PLOTS_PREFIX}${regionId}`);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function App() {
  const [regionId, setRegionId] = useState<RegionId>('macon');
  const region = MS_REGIONS[regionId];

  const [regionCache, setRegionCache] = useState<Partial<Record<RegionId, Parcel[]>>>({});
  const [parcels, setParcels] = useState<Parcel[]>([]);
  const [loadingParcels, setLoadingParcels] = useState(true);
  const [equipmentByRegion, setEquipmentByRegion] =
    useState<Record<RegionId, EquipmentUnit[]>>(REGION_EQUIPMENT);
  const [selectedParcelId, setSelectedParcelId] = useState<string>(MS_REGIONS.macon.defaultParcelId);
  const [activeLayer, setActiveLayer] = useState<MapLayer>('satellite');
  const [unit, setUnit] = useState<AreaUnit>('ac');
  const [hoveredStressCell, setHoveredStressCell] = useState<StressCell | null>(null);
  const [weather, setWeather] = useState<LiveWeather>(DEFAULT_WEATHER);

  const [isDrawingPlot, setIsDrawingPlot] = useState(false);
  const [isSyncingMaris, setIsSyncingMaris] = useState(false);
  const [marisSyncMessage, setMarisSyncMessage] = useState<string | null>(null);
  const [parcelDetailOpen, setParcelDetailOpen] = useState(false);
  const [aiInsightsOpen, setAiInsightsOpen] = useState(false);
  const [inspectedEquipmentId, setInspectedEquipmentId] = useState<string | null>(null);

  const cacheRef = useRef(regionCache);
  cacheRef.current = regionCache;

  // Load 120 official MARIS 2024 parcels for the active Mississippi region (Macon / Como)
  useEffect(() => {
    let active = true;
    const cfg = MS_REGIONS[regionId];
    setMarisSyncMessage(null);
    setHoveredStressCell(null);
    setIsDrawingPlot(false);

    const cached = cacheRef.current[regionId];
    if (cached && cached.length > 0) {
      setParcels(cached);
      setSelectedParcelId(
        cached.some((p) => p.id === cfg.defaultParcelId) ? cfg.defaultParcelId : cached[0].id
      );
      setLoadingParcels(false);
      return;
    }

    setLoadingParcels(true);
    fetch(cfg.geojsonUrl)
      .then((r) => r.json())
      .then((fc: { features: { properties: RawMarisProperties; geometry: GeoGeometry }[] }) => {
        if (!active) return;
        const hydrated = (fc.features || []).map((f) =>
          hydrateMarisFeature(f, regionId, 'MARIS 2024')
        );
        const custom = loadCustomParcels(regionId);
        const combined = [...custom, ...hydrated];
        setRegionCache((prev) => ({ ...prev, [regionId]: combined }));
        setParcels(combined);
        setSelectedParcelId(
          combined.some((p) => p.id === cfg.defaultParcelId)
            ? cfg.defaultParcelId
            : combined[0]?.id ?? ''
        );
        setLoadingParcels(false);
      })
      .catch(() => {
        if (active) setLoadingParcels(false);
      });

    return () => {
      active = false;
    };
  }, [regionId]);

  // Fetch real live weather for the active Mississippi basin (Macon / Como)
  useEffect(() => {
    let active = true;
    fetch(
      `https://api.open-meteo.com/v1/forecast?latitude=${region.weatherLat}&longitude=${region.weatherLng}&current=temperature_2m,relative_humidity_2m,weather_code,wind_speed_10m,wind_direction_10m&temperature_unit=fahrenheit&wind_speed_unit=mph`
    )
      .then((r) => r.json())
      .then((data) => {
        if (!active) return;
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
        // retain default/last weather
      });
    return () => {
      active = false;
    };
  }, [region.weatherLat, region.weatherLng]);

  const equipment = equipmentByRegion[regionId];
  const alerts = REGION_ALERTS[regionId];

  const selectedParcel = useMemo(
    () => parcels.find((p) => p.id === selectedParcelId) ?? parcels[0],
    [parcels, selectedParcelId]
  );

  const inspectedEquipment = useMemo(
    () => equipment.find((e) => e.id === inspectedEquipmentId) ?? null,
    [equipment, inspectedEquipmentId]
  );

  const updateParcels = useCallback(
    (updater: (prev: Parcel[]) => Parcel[]) => {
      setParcels((prev) => {
        const next = updater(prev);
        setRegionCache((c) => ({ ...c, [regionId]: next }));
        return next;
      });
    },
    [regionId]
  );

  // Live query official Mississippi MARIS 2024 Cadastral ArcGIS Server (East Layer 2 for Macon, West Layer 1 for Como)
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
        const url = `https://gis.mississippi.edu/server/rest/services/Cadastral/MS_Parcels_August_2024/MapServer/${region.marisLayerId}/query?${params.toString()}`;
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
              szip: String(p.SZIP || region.zip).trim(),
              gisAcres: Number(Number(p.GISACRES || 0).toFixed(1)),
              taxAcres: Number(Number(p.TAXACRES || 0).toFixed(1)),
              cultAcres: Number((Number(p.CULT_AC1 || 0) + Number(p.CULT_AC2 || 0)).toFixed(1)),
              uncultAcres: Number(Number(p.UNCULT_AC1 || 0).toFixed(1)),
              legldesc: String(p.LEGLDESC || '').replace(/\s+/g, ' ').trim(),
              cntyname: String(p.CNTYNAME || region.countyLabel.split(' ')[0].toUpperCase()).trim(),
              lat: Number(p.LATDEC || region.weatherLat),
              lng: Number(p.LONGDEC || region.weatherLng),
              taxyear: String(p.TAXYEAR || '2024').trim(),
              landVal: Number(p.LANDVAL || 0),
              totVal: Number(p.TOTVAL || 0),
            };
            return hydrateMarisFeature({ properties: rawProps, geometry: f.geometry }, regionId, 'MARIS Live');
          });

        let addedCount = 0;
        updateParcels((prev) => {
          const existingIds = new Set(prev.map((x) => x.id));
          const novel = incoming.filter((x) => !existingIds.has(x.id));
          addedCount = novel.length;
          return novel.length > 0 ? [...prev, ...novel] : prev;
        });

        setMarisSyncMessage(
          addedCount > 0
            ? `Synced +${addedCount} live MARIS parcels`
            : `All ${incoming.length} farm parcels in view loaded`
        );
      } catch {
        setMarisSyncMessage(`MARIS GIS busy — showing 120 ${region.id === 'macon' ? 'Macon' : 'Como'} parcels`);
      } finally {
        setIsSyncingMaris(false);
      }
    },
    [region, regionId, updateParcels]
  );

  const handleAdjustIrrigationZone = (zoneId: string) => {
    if (!selectedParcel) return;
    updateParcels((prev) =>
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
    updateParcels((prev) =>
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
      id: `${regionId}-custom-${Date.now()}`,
      name: payload.name,
      parno,
      fsaTract: `PARNO ${parno}`,
      county: payload.county,
      cityState: regionId === 'macon' ? 'Macon, MS 39341' : 'Como, MS 38619',
      siteAddress: `Custom Surveyed Sub-Plot · ${regionId === 'macon' ? 'Macon, MS' : 'Como, MS'}`,
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
          date: 'Nov 27 · Now',
          category: 'Scouting',
          title: `Custom ${regionId === 'macon' ? 'Macon' : 'Como'} Parcel Surveyed`,
          operator: 'Caleb Vance',
          detail: `Plotted ${payload.areaAcres} geodesic acres (${payload.soilSeries}, ${payload.irrigationMethod}).`,
        },
      ],
    };

    updateParcels((prev) => {
      const next = [newParcel, ...prev];
      try {
        const customOnly = next.filter((p) => p.source === 'User Surveyed');
        localStorage.setItem(`${CUSTOM_PLOTS_PREFIX}${regionId}`, JSON.stringify(customOnly));
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
    setEquipmentByRegion((prev) => ({
      ...prev,
      [regionId]: prev[regionId].map((eq) =>
        eq.id === eqId
          ? {
              ...eq,
              assignedParcelId: parcelId,
              currentTask: targetParcel
                ? `Active Field Pass - ${targetParcel.name}`
                : eq.currentTask,
            }
          : eq
      ),
    }));
    if (targetParcel) {
      setSelectedParcelId(targetParcel.id);
    }
  };

  if (loadingParcels || !selectedParcel) {
    return (
      <div className="flex h-[100dvh] w-full items-center justify-center bg-[#10130f] text-[#dce2d4]">
        <div className="glass-panel rounded-2xl px-6 py-4 text-center">
          <div className="text-[15px] font-semibold text-[#d8f274]">
            Loading {region.title} Parcels...
          </div>
          <div className="mt-1 font-mono text-[11px] text-[#dce2d4]/60">
            {region.countyLabel} · MARIS 2024 Statewide GIS
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative min-h-[100dvh] w-full overflow-x-hidden bg-[#10130f]">
      {/* Real 3D-Tilted MapLibre Satellite Stage with Official MARIS 2024 Parcels */}
      <ParcelMapStage
        region={region}
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
            region={region}
            onChangeRegion={setRegionId}
            parcels={parcels}
            equipment={equipment}
            selectedParcel={selectedParcel}
            alerts={alerts}
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
              date: 'Nov 27 · Scheduled',
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
