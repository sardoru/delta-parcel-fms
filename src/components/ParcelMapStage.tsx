import React, { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import {
  Map as MapLibreMap,
  GeoJSONSource,
  MapLayerMouseEvent,
  MapMouseEvent,
} from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import {
  ArrowsClockwise,
  CaretRight,
  Check,
  Compass,
  CornersOut,
  Cube,
  Factory,
  Leaf,
  Minus,
  Plus,
  Trash,
} from '@phosphor-icons/react';
import { AreaUnit, GeoGeometry, LngLat, MapLayer, Parcel, RegionConfig, StressCell } from '../types/farm';
import { computeGeodesicAcres, formatArea } from '../utils/units';

interface ParcelMapStageProps {
  region: RegionConfig;
  parcels: Parcel[];
  selectedParcel: Parcel;
  activeLayer: MapLayer;
  unit: AreaUnit;
  hoveredStressCell: StressCell | null;
  isDrawingPlot: boolean;
  isSyncingMaris: boolean;
  marisSyncMessage: string | null;
  onSelectParcel: (parcelId: string) => void;
  onChangeLayer: (layer: MapLayer) => void;
  onOpenParcelDetail: () => void;
  onSyncMarisBounds: (bounds: { west: number; south: number; east: number; north: number }) => void;
  onFinishDrawPlot: (payload: {
    name: string;
    county: string;
    crop: Parcel['crop'];
    soilSeries: string;
    irrigationMethod: string;
    areaAcres: number;
    ring: LngLat[];
    geometry: GeoGeometry;
  }) => void;
  onCancelDrawPlot: () => void;
}

function ndviFillColor(ndvi: number): string {
  if (ndvi >= 0.85) return '#2fb968';
  if (ndvi >= 0.79) return '#89db58';
  if (ndvi >= 0.74) return '#d8f274';
  if (ndvi >= 0.69) return '#e6a84c';
  return '#d9694a';
}

export const ParcelMapStage: React.FC<ParcelMapStageProps> = ({
  region,
  parcels,
  selectedParcel,
  activeLayer,
  unit,
  hoveredStressCell,
  isDrawingPlot,
  isSyncingMaris,
  marisSyncMessage,
  onSelectParcel,
  onChangeLayer,
  onOpenParcelDetail,
  onSyncMarisBounds,
  onFinishDrawPlot,
  onCancelDrawPlot,
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const mapReadyRef = useRef(false);
  const calloutRef = useRef<HTMLDivElement>(null);
  const landmarkRef = useRef<HTMLDivElement>(null);
  const stressMarkerRef = useRef<HTMLDivElement>(null);

  const regionRef = useRef(region);
  regionRef.current = region;
  const selectedParcelRef = useRef(selectedParcel);
  selectedParcelRef.current = selectedParcel;
  const hoveredStressRef = useRef(hoveredStressCell);
  hoveredStressRef.current = hoveredStressCell;
  const isDrawingRef = useRef(isDrawingPlot);
  isDrawingRef.current = isDrawingPlot;

  const [is3D, setIs3D] = useState(true);
  const [hoveredParcelInfo, setHoveredParcelInfo] = useState<{
    name: string;
    parno: string;
    acres: number;
    health: number;
    x: number;
    y: number;
  } | null>(null);

  // Interactive geodesic parcel plotter state
  const [draftPoints, setDraftPoints] = useState<LngLat[]>([]);
  const [draftName, setDraftName] = useState(
    region.id === 'macon' ? 'Deerbrook Cotton Sub-Plot' : 'Como South 80 Plot'
  );
  const [draftCrop, setDraftCrop] = useState<Parcel['crop']>(
    region.id === 'macon' ? 'Upland Cotton' : 'Soybeans'
  );
  const [draftSoil, setDraftSoil] = useState(region.soilLegend[0]?.name || 'Brooksville Silty Clay');
  const [draftIrrigation, setDraftIrrigation] = useState('Furrow Poly-Pipe');

  useEffect(() => {
    setDraftName(region.id === 'macon' ? 'Deerbrook Cotton Sub-Plot' : 'Como South 80 Plot');
    setDraftSoil(region.soilLegend[0]?.name || 'Brooksville Silty Clay');
  }, [region]);

  useEffect(() => {
    if (!isDrawingPlot) setDraftPoints([]);
  }, [isDrawingPlot]);

  const draftAcres = useMemo(() => computeGeodesicAcres(draftPoints), [draftPoints]);

  // Project active parcel GPS beacon, Bogue Chitto Gin landmark, & hovered Stress Zone target cleanly
  const updateProjectedOverlays = useCallback(() => {
    const map = mapRef.current;
    if (!map) return;

    if (calloutRef.current) {
      const p = selectedParcelRef.current;
      const pt = map.project([p.center.lng, p.center.lat]);
      calloutRef.current.style.transform = `translate3d(${pt.x - 22}px, ${pt.y - 22}px, 0)`;
      calloutRef.current.style.opacity = isDrawingRef.current ? '0' : '1';
    }

    if (landmarkRef.current) {
      const lm = regionRef.current.landmark;
      if (!lm || isDrawingRef.current) {
        landmarkRef.current.style.opacity = '0';
      } else {
        const pt = map.project([lm.lng, lm.lat]);
        landmarkRef.current.style.transform = `translate3d(${pt.x - 14}px, ${pt.y - 14}px, 0)`;
        landmarkRef.current.style.opacity = '1';
      }
    }

    if (stressMarkerRef.current) {
      const cell = hoveredStressRef.current;
      if (!cell) {
        stressMarkerRef.current.style.opacity = '0';
      } else {
        const [minLng, minLat, maxLng, maxLat] = selectedParcelRef.current.bbox;
        const lng = minLng + ((cell.col + 0.5) / 16) * (maxLng - minLng);
        const lat = maxLat - ((cell.row + 0.5) / 6) * (maxLat - minLat);
        const pt = map.project([lng, lat]);
        stressMarkerRef.current.style.transform = `translate3d(${pt.x - 16}px, ${pt.y - 16}px, 0)`;
        stressMarkerRef.current.style.opacity = '1';
      }
    }
  }, []);

  // Build MapLibre GeoJSON FeatureCollection for all Como parcels
  const parcelsGeoJson = useMemo(
    () => ({
      type: 'FeatureCollection' as const,
      features: parcels.map((p, idx) => ({
        type: 'Feature' as const,
        id: idx + 1,
        properties: {
          id: p.id,
          name: p.name,
          parno: p.parno,
          areaAcres: p.areaAcres,
          healthPct: p.healthPct,
          ndviColor: ndviFillColor(p.ndviMean),
          soilColor: p.soilColor,
          isSelected: p.id === selectedParcel.id ? 1 : 0,
        },
        geometry: p.geometry,
      })),
    }),
    [parcels, selectedParcel.id]
  );

  const parcelsGeoJsonRef = useRef(parcelsGeoJson);
  parcelsGeoJsonRef.current = parcelsGeoJson;

  // Draft polygon GeoJSON for geodesic plotting mode
  const draftGeoJson = useMemo(() => {
    const features: GeoJSON.Feature[] = [];
    if (draftPoints.length >= 3) {
      const ring = [...draftPoints.map((pt) => [pt.lng, pt.lat]), [draftPoints[0].lng, draftPoints[0].lat]];
      features.push({
        type: 'Feature',
        properties: { kind: 'poly' },
        geometry: { type: 'Polygon', coordinates: [ring] },
      });
    } else if (draftPoints.length === 2) {
      features.push({
        type: 'Feature',
        properties: { kind: 'line' },
        geometry: {
          type: 'LineString',
          coordinates: draftPoints.map((pt) => [pt.lng, pt.lat]),
        },
      });
    }
    draftPoints.forEach((pt, idx) => {
      features.push({
        type: 'Feature',
        properties: { kind: 'vertex', idx },
        geometry: { type: 'Point', coordinates: [pt.lng, pt.lat] },
      });
    });
    return { type: 'FeatureCollection' as const, features };
  }, [draftPoints]);

  // Initialize MapLibre GL JS with Esri World Imagery + Como, MS tilted 3D oblique camera
  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;

    const isDesktop = window.innerWidth >= 1024;
    const map = new MapLibreMap({
      container: mapContainerRef.current,
      style: {
        version: 8,
        sources: {
          'esri-imagery': {
            type: 'raster',
            tiles: [
              'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
            ],
            tileSize: 256,
            maxzoom: 18,
            attribution: 'Esri, Maxar, Earthstar Geographics · MARIS MS Parcels 2024',
          },
          'esri-labels': {
            type: 'raster',
            tiles: [
              'https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}',
            ],
            tileSize: 256,
            maxzoom: 18,
          },
          'esri-roads': {
            type: 'raster',
            tiles: [
              'https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Transportation/MapServer/tile/{z}/{y}/{x}',
            ],
            tileSize: 256,
            maxzoom: 18,
          },
          'como-parcels': {
            type: 'geojson',
            data: parcelsGeoJsonRef.current as unknown as GeoJSON.FeatureCollection,
          },
          'draft-parcel': {
            type: 'geojson',
            data: draftGeoJson as unknown as GeoJSON.FeatureCollection,
          },
        },
        layers: [
          {
            id: 'satellite-base',
            type: 'raster',
            source: 'esri-imagery',
            paint: {
              'raster-brightness-max': 0.92,
              'raster-contrast': 0.14,
              'raster-saturation': 0.12,
            },
          },
          {
            id: 'reference-roads',
            type: 'raster',
            source: 'esri-roads',
            paint: {
              'raster-opacity': 0.30,
            },
          },
          {
            id: 'reference-places',
            type: 'raster',
            source: 'esri-labels',
            paint: {
              'raster-opacity': 0.65,
            },
          },
          {
            id: 'parcels-fill',
            type: 'fill',
            source: 'como-parcels',
            paint: {
              'fill-color': [
                'case',
                ['==', ['get', 'isSelected'], 1],
                '#d8f274',
                'rgba(255, 255, 255, 0.04)',
              ],
              'fill-opacity': [
                'case',
                ['==', ['get', 'isSelected'], 1],
                0.24,
                0.08,
              ],
            },
          },
          {
            id: 'parcels-outline',
            type: 'line',
            source: 'como-parcels',
            paint: {
              'line-color': 'rgba(244, 248, 236, 0.44)',
              'line-width': 1.25,
            },
          },
          {
            id: 'parcel-selected-glow',
            type: 'line',
            source: 'como-parcels',
            filter: ['==', ['get', 'isSelected'], 1],
            paint: {
              'line-color': '#d8f274',
              'line-width': 14,
              'line-blur': 10,
              'line-opacity': 0.75,
            },
          },
          {
            id: 'parcel-selected-line',
            type: 'line',
            source: 'como-parcels',
            filter: ['==', ['get', 'isSelected'], 1],
            paint: {
              'line-color': '#f2ffaa',
              'line-width': 3.2,
            },
          },
          {
            id: 'draft-fill',
            type: 'fill',
            source: 'draft-parcel',
            filter: ['==', ['get', 'kind'], 'poly'],
            paint: {
              'fill-color': '#d8f274',
              'fill-opacity': 0.28,
            },
          },
          {
            id: 'draft-line',
            type: 'line',
            source: 'draft-parcel',
            paint: {
              'line-color': '#e8fa9b',
              'line-width': 2.4,
              'line-dasharray': [3, 2],
            },
          },
          {
            id: 'draft-vertices',
            type: 'circle',
            source: 'draft-parcel',
            filter: ['==', ['get', 'kind'], 'vertex'],
            paint: {
              'circle-radius': 5.5,
              'circle-color': '#d8f274',
              'circle-stroke-color': '#141710',
              'circle-stroke-width': 2,
            },
          },
        ],
      },
      center: [selectedParcelRef.current.center.lng, selectedParcelRef.current.center.lat],
      zoom: 13.15,
      pitch: 48,
      bearing: -14,
      maxPitch: 62,
      attributionControl: false,
    });

    mapRef.current = map;

    map.on('style.load', () => {
      mapReadyRef.current = true;
      map.jumpTo({
        center: [selectedParcelRef.current.center.lng, selectedParcelRef.current.center.lat],
        zoom: 13.25,
        pitch: 48,
        bearing: -14,
        padding: isDesktop
          ? { left: 365, right: 90, top: 88, bottom: 265 }
          : { left: 16, right: 16, top: 90, bottom: 180 },
      });
      const src = map.getSource('como-parcels') as GeoJSONSource | undefined;
      if (src) {
        src.setData(parcelsGeoJsonRef.current as unknown as GeoJSON.FeatureCollection);
      }
      updateProjectedOverlays();
    });

    map.on('move', updateProjectedOverlays);
    map.on('pitch', updateProjectedOverlays);
    map.on('zoom', updateProjectedOverlays);
    map.on('resize', updateProjectedOverlays);
    map.on('idle', updateProjectedOverlays);

    map.on('mousemove', 'parcels-fill', (e: MapLayerMouseEvent) => {
      if (isDrawingRef.current) {
        map.getCanvas().style.cursor = 'crosshair';
        setHoveredParcelInfo(null);
        return;
      }
      map.getCanvas().style.cursor = 'pointer';
      const feat = e.features?.[0];
      if (feat?.properties) {
        const props = feat.properties;
        if (props.id === selectedParcelRef.current.id) {
          setHoveredParcelInfo(null);
        } else {
          setHoveredParcelInfo({
            name: String(props.name || ''),
            parno: String(props.parno || ''),
            acres: Number(props.areaAcres || 0),
            health: Number(props.healthPct || 88),
            x: e.point.x,
            y: e.point.y,
          });
        }
      }
    });

    map.on('mouseleave', 'parcels-fill', () => {
      map.getCanvas().style.cursor = isDrawingRef.current ? 'crosshair' : 'grab';
      setHoveredParcelInfo(null);
    });

    map.on('click', (e: MapMouseEvent) => {
      if (isDrawingRef.current) {
        setDraftPoints((prev) => [
          ...prev,
          { lng: Number(e.lngLat.lng.toFixed(5)), lat: Number(e.lngLat.lat.toFixed(5)) },
        ]);
        return;
      }
      const features = map.queryRenderedFeatures(e.point, { layers: ['parcels-fill'] });
      const clickedId = features[0]?.properties?.id;
      if (clickedId) {
        onSelectParcel(String(clickedId));
      }
    });

    return () => {
      mapReadyRef.current = false;
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // Update GeoJSON data whenever parcels or selectedParcel changes
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReadyRef.current) return;
    const src = map.getSource('como-parcels') as GeoJSONSource | undefined;
    if (src) {
      src.setData(parcelsGeoJson as unknown as GeoJSON.FeatureCollection);
    }
    updateProjectedOverlays();
  }, [parcelsGeoJson, updateProjectedOverlays]);

  // Update draft polygon GeoJSON when plotting corners
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReadyRef.current) return;
    const src = map.getSource('draft-parcel') as GeoJSONSource | undefined;
    if (src) {
      src.setData(draftGeoJson as unknown as GeoJSON.FeatureCollection);
    }
    map.getCanvas().style.cursor = isDrawingPlot ? 'crosshair' : 'grab';
    updateProjectedOverlays();
  }, [draftGeoJson, isDrawingPlot, updateProjectedOverlays]);

  // Smoothly fly camera to selected parcel when user picks a different Como parcel
  const lastFlownIdRef = useRef<string>(selectedParcel.id);
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReadyRef.current) return;
    if (lastFlownIdRef.current === selectedParcel.id) return;
    lastFlownIdRef.current = selectedParcel.id;

    const isDesktop = window.innerWidth >= 1024;
    const targetZoom = selectedParcel.areaAcres > 450 ? 13.15 : selectedParcel.areaAcres > 180 ? 13.75 : 14.3;
    map.flyTo({
      center: [selectedParcel.center.lng, selectedParcel.center.lat],
      zoom: targetZoom,
      pitch: is3D ? 48 : 0,
      bearing: is3D ? -14 : 0,
      padding: isDesktop
        ? { left: 365, right: 90, top: 88, bottom: 265 }
        : { left: 16, right: 16, top: 90, bottom: 180 },
      duration: 950,
      essential: true,
    });
  }, [selectedParcel, is3D]);

  // Update visual styling when toggling Satellite / NDVI / Soil layers
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReadyRef.current) return;

    if (activeLayer === 'ndvi') {
      map.setPaintProperty('satellite-base', 'raster-saturation', -0.62);
      map.setPaintProperty('satellite-base', 'raster-brightness-max', 0.65);
      map.setPaintProperty('parcels-fill', 'fill-color', ['get', 'ndviColor']);
      map.setPaintProperty('parcels-fill', 'fill-opacity', [
        'case',
        ['==', ['get', 'isSelected'], 1],
        0.72,
        0.52,
      ]);
      map.setPaintProperty('parcels-outline', 'line-color', 'rgba(255, 255, 255, 0.5)');
    } else if (activeLayer === 'soil') {
      map.setPaintProperty('satellite-base', 'raster-saturation', -0.55);
      map.setPaintProperty('satellite-base', 'raster-brightness-max', 0.72);
      map.setPaintProperty('parcels-fill', 'fill-color', ['get', 'soilColor']);
      map.setPaintProperty('parcels-fill', 'fill-opacity', [
        'case',
        ['==', ['get', 'isSelected'], 1],
        0.72,
        0.54,
      ]);
      map.setPaintProperty('parcels-outline', 'line-color', 'rgba(255, 245, 224, 0.52)');
    } else {
      map.setPaintProperty('satellite-base', 'raster-saturation', 0.12);
      map.setPaintProperty('satellite-base', 'raster-brightness-max', 0.92);
      map.setPaintProperty('parcels-fill', 'fill-color', [
        'case',
        ['==', ['get', 'isSelected'], 1],
        '#d8f274',
        'rgba(255, 255, 255, 0.04)',
      ]);
      map.setPaintProperty('parcels-fill', 'fill-opacity', [
        'case',
        ['==', ['get', 'isSelected'], 1],
        0.22,
        0.08,
      ]);
      map.setPaintProperty('parcels-outline', 'line-color', 'rgba(244, 248, 236, 0.34)');
    }
  }, [activeLayer]);

  // Update stress zone target overlay immediately on hover
  useEffect(() => {
    updateProjectedOverlays();
  }, [hoveredStressCell, updateProjectedOverlays]);

  const handleToggle3D = () => {
    const map = mapRef.current;
    const next = !is3D;
    setIs3D(next);
    if (map) {
      map.easeTo({ pitch: next ? 48 : 0, bearing: next ? -14 : 0, duration: 550 });
    }
  };

  const handleResetView = () => {
    const map = mapRef.current;
    if (!map) return;
    const isDesktop = window.innerWidth >= 1024;
    map.flyTo({
      center: [selectedParcel.center.lng, selectedParcel.center.lat],
      zoom: 13.35,
      pitch: is3D ? 48 : 0,
      bearing: is3D ? -14 : 0,
      padding: isDesktop
        ? { left: 365, right: 90, top: 88, bottom: 265 }
        : { left: 16, right: 16, top: 90, bottom: 180 },
      duration: 750,
    });
  };

  const handleTriggerMarisSync = () => {
    const map = mapRef.current;
    if (!map) return;
    const b = map.getBounds();
    onSyncMarisBounds({
      west: Number(b.getWest().toFixed(4)),
      south: Number(b.getSouth().toFixed(4)),
      east: Number(b.getEast().toFixed(4)),
      north: Number(b.getNorth().toFixed(4)),
    });
  };

  const handleSaveDraft = (e: React.FormEvent) => {
    e.preventDefault();
    if (draftPoints.length < 3 || !draftName.trim()) return;
    const closed = [...draftPoints.map((pt) => [pt.lng, pt.lat]), [draftPoints[0].lng, draftPoints[0].lat]];
    onFinishDrawPlot({
      name: draftName.trim(),
      county: region.countyLabel,
      crop: draftCrop,
      soilSeries: draftSoil,
      irrigationMethod: draftIrrigation,
      areaAcres: draftAcres,
      ring: draftPoints,
      geometry: { type: 'Polygon', coordinates: [closed] },
    });
    setDraftPoints([]);
  };

  return (
    <div className="fixed inset-0 z-0 overflow-hidden bg-[#10130f]">
      {/* Live MapLibre GL JS Satellite Stage */}
      <div ref={mapContainerRef} className="h-full w-full" />

      {/* Atmospheric vignette to seamlessly seat floating obsidian glass HUD */}
      <div
        className="pointer-events-none fixed inset-0 z-[1]"
        style={{
          background:
            'radial-gradient(ellipse at 58% 42%, rgba(16,19,15,0.0) 32%, rgba(11,14,10,0.56) 100%)',
        }}
      />

      {/* Projected Stress Zone Target Pulse inside Selected Como Parcel */}
      <div
        ref={stressMarkerRef}
        style={{ opacity: 0 }}
        className="pointer-events-none fixed left-0 top-0 z-[5] flex h-8 w-8 items-center justify-center transition-opacity duration-150"
      >
        <span className="absolute inset-0 rounded-full border-2 border-[#f0bb66] bg-[#e6a84c]/25" />
        <span className="h-2.5 w-2.5 rounded-full bg-[#f0bb66]" />
      </div>

      {/* Hover Preview Tooltip for Neighboring Como Parcels */}
      {hoveredParcelInfo && !isDrawingPlot && (
        <div
          className="glass-panel-dense pointer-events-none fixed z-[8] rounded-xl px-3 py-1.5"
          style={{
            left: hoveredParcelInfo.x + 14,
            top: hoveredParcelInfo.y - 18,
          }}
        >
          <div className="text-[12px] font-semibold text-[#f5f7f1]">{hoveredParcelInfo.name}</div>
          <div className="flex items-center gap-2 font-mono text-[10px] text-[#d8f274]">
            <span>{formatArea(hoveredParcelInfo.acres, unit)}</span>
            <span className="text-white/35">·</span>
            <span>{hoveredParcelInfo.health}% Health</span>
            <span className="text-white/35">·</span>
            <span className="text-[#dce2d4]/65">Click to inspect</span>
          </div>
        </div>
      )}

      {/* Projected Bogue Chitto Gin Landmark Marker (Macon, MS) */}
      <div
        ref={landmarkRef}
        style={{ opacity: 0 }}
        className="pointer-events-auto fixed left-0 top-0 z-[6] flex items-center gap-2 transition-opacity duration-150"
      >
        {region.landmark && (
          <>
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-[#e6a84c]/70 bg-[#1a1812]/92 text-[#f0bb66] shadow-[0_0_18px_rgba(230,168,76,0.55)]">
              <Factory size={14} weight="fill" />
            </div>
            <div className="glass-panel-dense rounded-xl border-[#e6a84c]/35 px-2.5 py-1">
              <div className="whitespace-nowrap text-[11px] font-semibold leading-tight text-[#f6deb2]">
                {region.landmark.name}
              </div>
              <div className="whitespace-nowrap font-mono text-[9.5px] text-[#dce2d4]/68">
                4762 Deerbrook Rd
              </div>
            </div>
          </>
        )}
      </div>

      {/* Projected Active Parcel GPS Beacon + Floating Callout Card */}
      <div
        ref={calloutRef}
        className="pointer-events-auto fixed left-0 top-0 z-[7] flex items-center gap-2.5 transition-opacity duration-150"
      >
        <div className="relative flex h-11 w-11 shrink-0 items-center justify-center">
          <span className="animate-pulse-ring absolute inset-0 rounded-full border border-[#e6f99a]/65 bg-[#d8f274]/22" />
          <span className="absolute inset-2 rounded-full bg-white/25 backdrop-blur-sm" />
          <span className="relative flex h-4.5 w-4.5 items-center justify-center rounded-full bg-[#f5f8ee] shadow-[0_0_16px_rgba(216,242,116,0.9)]">
            <span className="h-2 w-2 rounded-full bg-[#3f5920]" />
          </span>
        </div>

        <button
          type="button"
          onClick={onOpenParcelDetail}
          className="glass-panel-dense group flex items-center gap-2.5 rounded-2xl px-3 py-2 text-left transition-all hover:border-[#d8f274]/55 hover:bg-[#1b2017]/95"
        >
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-[#d8f274]/30 bg-[#d8f274]/14 text-[#d8f274]">
            <Leaf size={14} weight="duotone" />
          </div>
          <div className="min-w-0 pr-0.5">
            <div className="whitespace-nowrap text-[12.5px] font-semibold leading-tight text-[#f5f7f1]">
              {selectedParcel.name}
            </div>
            <div className="mt-0.5 flex items-center gap-1.5 whitespace-nowrap text-[10.5px]">
              <span className="tabular-nums text-[#dce2d4]/75">
                {selectedParcel.healthPct}% Health
              </span>
              <span
                className={`tabular-nums font-semibold ${
                  selectedParcel.healthDeltaPct >= 0 ? 'text-[#d8f274]' : 'text-[#e6a84c]'
                }`}
              >
                {selectedParcel.healthDeltaPct >= 0
                  ? `+${selectedParcel.healthDeltaPct}%`
                  : `${selectedParcel.healthDeltaPct}%`}
              </span>
              {selectedParcel.distanceToLandmarkMiles !== undefined && (
                <>
                  <span className="text-white/30">·</span>
                  <span className="font-mono text-[10px] text-[#f0bb66]">
                    {selectedParcel.distanceToLandmarkMiles} mi to Gin
                  </span>
                </>
              )}
            </div>
          </div>
          <CaretRight
            size={14}
            className="shrink-0 text-[#dce2d4]/55 transition-transform group-hover:translate-x-0.5 group-hover:text-[#d8f274]"
          />
        </button>
      </div>

      {/* Right-Side Layer Switcher Pills (Satellite / NDVI / Soil + Live MARIS Sync) */}
      <div className="pointer-events-auto fixed right-4 top-[76px] z-20 hidden flex-col items-end gap-2 sm:flex">
        {(
          [
            {
              id: 'satellite',
              label: 'Satellite',
              swatch: 'radial-gradient(circle at 35% 35%, #689448 0%, #2d4c25 65%, #192917 100%)',
            },
            {
              id: 'ndvi',
              label: 'NDVI',
              swatch: 'linear-gradient(135deg, #2fb968 0%, #d8f274 55%, #df694a 100%)',
            },
            {
              id: 'soil',
              label: 'Soil',
              swatch: 'radial-gradient(circle at 35% 35%, #9e7552 0%, #634832 65%, #3b2a1e 100%)',
            },
          ] as const
        ).map((item) => {
          const active = activeLayer === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onChangeLayer(item.id)}
              className={`glass-pill flex w-[124px] items-center gap-2.5 rounded-full py-1.5 pl-1.5 pr-4 text-[12px] font-medium transition-all ${
                active
                  ? 'border-[#d8f274]/60 bg-[#1e231a]/90 text-[#f5f7f1] shadow-[0_8px_24px_-6px_rgba(0,0,0,0.7)]'
                  : 'text-[#dce2d4]/75 hover:border-white/25 hover:text-white'
              }`}
            >
              <span
                className={`h-7 w-7 shrink-0 rounded-full border ${
                  active ? 'border-[#d8f274]' : 'border-white/25'
                }`}
                style={{ background: item.swatch }}
              />
              <span>{item.label}</span>
            </button>
          );
        })}

        {/* Live MARIS Statewide GIS Pull Button */}
        <button
          type="button"
          onClick={handleTriggerMarisSync}
          disabled={isSyncingMaris}
          title="Query live Mississippi MARIS 2024 cadastral parcels for the current map view"
          className="glass-pill mt-1 flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] font-medium text-[#d8f274] transition-colors hover:border-[#d8f274]/55 hover:bg-[#1f241b]/95 disabled:opacity-60"
        >
          <ArrowsClockwise size={13} className={isSyncingMaris ? 'animate-spin' : ''} />
          <span>{isSyncingMaris ? 'Syncing GIS...' : 'Sync MARIS GIS'}</span>
        </button>

        {marisSyncMessage && (
          <div className="glass-panel max-w-[175px] rounded-xl px-2.5 py-1.5 text-right text-[10px] leading-snug text-[#dce2d4]/85">
            {marisSyncMessage}
          </div>
        )}

        {/* Active Layer Legend Pill for NDVI / Soil */}
        {activeLayer !== 'satellite' && (
          <div className="glass-panel mt-0.5 w-[156px] rounded-2xl p-2.5 text-[10px]">
            <div className="font-semibold text-[#f3f5ef]">
              {activeLayer === 'ndvi' ? 'NDVI Vigor Scale' : region.soilRegionLabel}
            </div>
            {activeLayer === 'ndvi' ? (
              <>
                <div
                  className="mt-1.5 h-2 w-full rounded-full"
                  style={{
                    background:
                      'linear-gradient(90deg, #d9694a 0%, #e6a84c 42%, #d8f274 72%, #2fb968 100%)',
                  }}
                />
                <div className="mt-1 flex justify-between font-mono text-[9.5px] text-[#dce2d4]/60">
                  <span>0.34</span>
                  <span>0.92</span>
                </div>
              </>
            ) : (
              <div className="mt-1.5 space-y-1 text-[9.5px] text-[#dce2d4]/75">
                {region.soilLegend.map((item) => (
                  <div key={item.name} className="flex items-center gap-1.5">
                    <span
                      className="h-2 w-2 shrink-0 rounded-full"
                      style={{ backgroundColor: item.color }}
                    />
                    <span className="truncate">{item.name}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Bottom-Right Vertical Map Zoom/3D/Compass Controls Capsule */}
      <div className="pointer-events-auto fixed bottom-[292px] right-4 z-20 hidden flex-col items-center gap-1 rounded-full border border-white/12 bg-[#171a15]/82 p-1.5 backdrop-blur-xl xl:flex">
        <button
          type="button"
          onClick={handleToggle3D}
          title={is3D ? 'Switch to 2D Top-Down Survey View' : 'Switch to 3D Oblique Aerial View'}
          className={`flex h-8 w-8 items-center justify-center rounded-full text-[10px] font-bold transition-colors ${
            is3D ? 'bg-[#d8f274]/18 text-[#d8f274]' : 'text-[#dce2d4]/80 hover:bg-white/10'
          }`}
        >
          {is3D ? '3D' : <Cube size={15} />}
        </button>
        <button
          type="button"
          onClick={handleResetView}
          title="Recenter on active Como parcel"
          aria-label="Reset map view"
          className="flex h-8 w-8 items-center justify-center rounded-full text-[#dce2d4]/80 transition-colors hover:bg-white/10 hover:text-[#d8f274]"
        >
          <Compass size={16} />
        </button>
        <div className="h-[1px] w-4 bg-white/12" />
        <button
          type="button"
          onClick={() => mapRef.current?.zoomIn({ duration: 250 })}
          title="Zoom in"
          aria-label="Zoom in"
          className="flex h-8 w-8 items-center justify-center rounded-full text-[#dce2d4]/80 transition-colors hover:bg-white/10 hover:text-white"
        >
          <Plus size={15} />
        </button>
        <button
          type="button"
          onClick={() => mapRef.current?.zoomOut({ duration: 250 })}
          title="Zoom out"
          aria-label="Zoom out"
          className="flex h-8 w-8 items-center justify-center rounded-full text-[#dce2d4]/80 transition-colors hover:bg-white/10 hover:text-white"
        >
          <Minus size={15} />
        </button>
        <div className="h-[1px] w-4 bg-white/12" />
        <button
          type="button"
          onClick={() => {
            if (!document.fullscreenElement) {
              document.documentElement.requestFullscreen?.().catch(() => {});
            } else {
              document.exitFullscreen?.().catch(() => {});
            }
          }}
          title="Toggle fullscreen"
          aria-label="Toggle fullscreen"
          className="flex h-8 w-8 items-center justify-center rounded-full text-[#dce2d4]/80 transition-colors hover:bg-white/10 hover:text-white"
        >
          <CornersOut size={15} />
        </button>
      </div>

      {/* Geodesic Sub-Plot / New Parcel Survey Bar */}
      {isDrawingPlot && (
        <div className="pointer-events-auto fixed left-1/2 top-24 z-30 w-[92vw] max-w-[520px] -translate-x-1/2">
          <form onSubmit={handleSaveDraft} className="glass-panel-dense rounded-2xl p-4">
            <div className="flex items-center justify-between gap-2">
              <div>
                <h3 className="text-[14px] font-semibold text-[#d8f274]">
                  Survey Custom {region.id === 'macon' ? 'Macon, MS' : 'Como, MS'} Field Plot
                </h3>
                <p className="text-[11.5px] text-[#dce2d4]/68">
                  Click 3+ GPS corners directly on the satellite map ({draftPoints.length} vertices
                  {draftPoints.length >= 3 ? ` · ${formatArea(draftAcres, unit)} geodesic` : ''}).
                </p>
              </div>
              {draftPoints.length > 0 && (
                <button
                  type="button"
                  onClick={() => setDraftPoints([])}
                  className="flex items-center gap-1 rounded-full border border-white/12 px-2.5 py-1 text-[11px] text-[#dce2d4]/75 hover:bg-white/10"
                >
                  <Trash size={12} />
                  Clear
                </button>
              )}
            </div>

            <div className="mt-3 grid grid-cols-1 gap-2.5 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-[10.5px] font-medium text-[#dce2d4]/65">
                  Plot Name
                </label>
                <input
                  type="text"
                  required
                  value={draftName}
                  onChange={(e) => setDraftName(e.target.value)}
                  className="w-full rounded-xl border border-white/12 bg-black/30 px-3 py-1.5 text-[12.5px] text-white focus:border-[#d8f274]/60 focus:outline-none"
                />
              </div>

              <div>
                <label className="mb-1 block text-[10.5px] font-medium text-[#dce2d4]/65">
                  Primary Crop
                </label>
                <select
                  value={draftCrop}
                  onChange={(e) => setDraftCrop(e.target.value as Parcel['crop'])}
                  className="w-full rounded-xl border border-white/12 bg-[#161914] px-3 py-1.5 text-[12.5px] text-white focus:border-[#d8f274]/60 focus:outline-none"
                >
                  <option value="Soybeans">Soybeans</option>
                  <option value="Upland Cotton">Upland Cotton</option>
                  <option value="Field Corn">Field Corn</option>
                  <option value="Grain Sorghum">Grain Sorghum</option>
                  <option value="Winter Wheat Cover">Winter Wheat Cover</option>
                </select>
              </div>

              <div>
                <label className="mb-1 block text-[10.5px] font-medium text-[#dce2d4]/65">
                  {region.soilRegionLabel}
                </label>
                <select
                  value={draftSoil}
                  onChange={(e) => setDraftSoil(e.target.value)}
                  className="w-full rounded-xl border border-white/12 bg-[#161914] px-3 py-1.5 text-[12px] text-white focus:border-[#d8f274]/60 focus:outline-none"
                >
                  {region.soilLegend.map((s) => (
                    <option key={s.name} value={s.name}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-1 block text-[10.5px] font-medium text-[#dce2d4]/65">
                  Irrigation System
                </label>
                <select
                  value={draftIrrigation}
                  onChange={(e) => setDraftIrrigation(e.target.value)}
                  className="w-full rounded-xl border border-white/12 bg-[#161914] px-3 py-1.5 text-[12px] text-white focus:border-[#d8f274]/60 focus:outline-none"
                >
                  <option value="Furrow Poly-Pipe">Furrow Poly-Pipe</option>
                  <option value="Center Pivot">Center Pivot</option>
                  <option value="Surface-Ditched Furrow">Surface-Ditched Furrow</option>
                  <option value="Rainfed Loess Upland">Rainfed Loess Upland</option>
                </select>
              </div>
            </div>

            <div className="mt-3.5 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={onCancelDrawPlot}
                className="rounded-full border border-white/14 px-3.5 py-1.5 text-[12px] font-medium text-[#dce2d4]/80 hover:bg-white/8"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={draftPoints.length < 3}
                className="flex items-center gap-1.5 rounded-full bg-[#d8f274] px-4 py-1.5 text-[12px] font-semibold text-[#141710] transition-opacity disabled:cursor-not-allowed disabled:opacity-40"
              >
                <Check size={14} weight="bold" />
                Save Como Parcel
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
