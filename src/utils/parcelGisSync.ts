import { GeoGeometry, Parcel, RawMarisProperties, RegionId } from '../types/farm';
import { hydrateMarisFeature } from '../data/msParcels';
import { computeGeodesicAcres, computeRingCentroid } from './units';

export interface ParcelSyncBounds {
  west: number;
  south: number;
  east: number;
  north: number;
}

export interface ParcelSyncOptions {
  stateHint?: string;
  regionId: RegionId;
  landmarkName?: string;
  landmarkLat?: number;
  landmarkLng?: number;
  overrideMsLayerId?: 1 | 2;
}

export interface ParcelSyncResult {
  parcels: Parcel[];
  providerLabel: string;
  message: string;
}

function haversineMiles(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 3958.8;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return Number((2 * R * Math.asin(Math.sqrt(a))).toFixed(2));
}

export function formatOwnerName(raw: string | undefined | null): string {
  const cleaned = String(raw || '').replace(/\s+/g, ' ').trim();
  if (!cleaned || cleaned === '0' || cleaned.toUpperCase() === 'UNKNOWN') {
    return 'County Record Unlisted';
  }
  const upperWords = new Set(['LLC', 'LLP', 'LP', 'INC', 'CO', 'ETAL', 'ETUX', 'II', 'III', 'IV', 'JR', 'SR', 'TRUST', 'FARMS', 'FARM', 'GIN']);
  return cleaned
    .toLowerCase()
    .split(' ')
    .map((w) => {
      const up = w.toUpperCase().replace(/[^A-Z]/g, '');
      if (upperWords.has(up) && up.length <= 4) return w.toUpperCase();
      return w.charAt(0).toUpperCase() + w.slice(1);
    })
    .join(' ');
}

function computeGeoCentroidAndAcres(geom: GeoGeometry): { lat: number; lng: number; acres: number } {
  const ring = geom.type === 'Polygon' ? geom.coordinates[0] || [] : geom.coordinates[0]?.[0] || [];
  const pts = ring.map(([lng, lat]) => ({ lng, lat }));
  const center = pts.length >= 3 ? computeRingCentroid(pts) : { lng: 0, lat: 0 };
  const acres = pts.length >= 3 ? computeGeodesicAcres(pts) : 0;
  return { lat: center.lat, lng: center.lng, acres };
}

function inferStateFromCoords(lat: number, lng: number): string {
  // Mississippi rough envelope
  if (lat >= 30.15 && lat <= 35.01 && lng >= -91.66 && lng <= -88.09) {
    // Exclude West-of-River Arkansas Delta bulge
    if (lat > 34.4 && lng < -90.55) return 'AR';
    if (lat > 33.4 && lng < -91.15) return 'AR';
    return 'MS';
  }
  // Arkansas envelope
  if (lat >= 33.0 && lat <= 36.5 && lng >= -94.62 && lng <= -89.64) return 'AR';
  // North Carolina envelope
  if (lat >= 33.84 && lat <= 36.59 && lng >= -84.32 && lng <= -75.46) return 'NC';
  // Texas envelope
  if (lat >= 25.8 && lat <= 36.5 && lng >= -106.65 && lng <= -93.5) return 'TX';
  // Memphis TN border zone
  if (lat >= 34.95 && lat <= 35.4 && lng >= -90.2 && lng <= -89.65) return 'TN';
  return 'OTHER';
}

async function fetchJsonTimeout(url: string, timeoutMs = 15000): Promise<Record<string, unknown> | null> {
  const c = new AbortController();
  const timer = setTimeout(() => c.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: c.signal });
    if (!res.ok) return null;
    return (await res.json()) as Record<string, unknown>;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

async function queryMsMaris(bounds: ParcelSyncBounds, layerId: 1 | 2, minAcres: number): Promise<
  { properties: RawMarisProperties; geometry: GeoGeometry }[]
> {
  const params = new URLSearchParams({
    geometry: `${bounds.west},${bounds.south},${bounds.east},${bounds.north}`,
    geometryType: 'esriGeometryEnvelope',
    inSR: '4326',
    spatialRel: 'esriSpatialRelIntersects',
    where: `CULT_AC1 >= ${minAcres} OR GISACRES >= ${minAcres}`,
    outFields:
      'PARNO,OWNNAME,TAXMAP,SECTION,TWSP,RANGE,SITEADD,SZIP,TAXACRES,GISACRES,CULT_AC1,CULT_AC2,UNCULT_AC1,LEGLDESC,CNTYNAME,LATDEC,LONGDEC,TAXYEAR,LANDVAL,TOTVAL',
    outSR: '4326',
    f: 'geojson',
  });
  const url = `https://gis.mississippi.edu/server/rest/services/Cadastral/MS_Parcels_August_2024/MapServer/${layerId}/query?${params.toString()}`;
  const fc = await fetchJsonTimeout(url);
  const feats = (fc?.features as { properties: Record<string, unknown>; geometry: GeoGeometry }[]) || [];
  return feats
    .filter((f) => f.geometry && (f.geometry.type === 'Polygon' || f.geometry.type === 'MultiPolygon'))
    .slice(0, 90)
    .map((f) => {
      const p = f.properties || {};
      const geo = computeGeoCentroidAndAcres(f.geometry);
      const gisAcres = Number(p.GISACRES || geo.acres || 0);
      const cult = Number(p.CULT_AC1 || 0) + Number(p.CULT_AC2 || 0);
      return {
        properties: {
          parno: String(p.PARNO || `MS-${Math.round(geo.lat * 10000)}`).replace(/\s+/g, ' ').trim(),
          taxmap: String(p.TAXMAP || '').trim(),
          section: String(p.SECTION || '').trim(),
          twsp: String(p.TWSP || '').trim(),
          range: String(p.RANGE || '').trim(),
          siteadd: String(p.SITEADD || '').trim(),
          szip: String(p.SZIP || '').trim(),
          ownname: String(p.OWNNAME || '').trim(),
          stateCode: 'MS',
          gisAcres: Number(gisAcres.toFixed(1)),
          taxAcres: Number(Number(p.TAXACRES || gisAcres).toFixed(1)),
          cultAcres: Number(cult.toFixed(1)),
          uncultAcres: Number(Number(p.UNCULT_AC1 || 0).toFixed(1)),
          legldesc: String(p.LEGLDESC || '').replace(/\s+/g, ' ').trim(),
          cntyname: String(p.CNTYNAME || 'MISSISSIPPI').trim(),
          lat: Number(p.LATDEC || geo.lat),
          lng: Number(p.LONGDEC || geo.lng),
          taxyear: String(p.TAXYEAR || '2024').trim(),
          landVal: Number(p.LANDVAL || 0),
          totVal: Number(p.TOTVAL || 0),
        },
        geometry: f.geometry,
      };
    });
}

async function queryArkansasGis(bounds: ParcelSyncBounds, minAcres: number): Promise<
  { properties: RawMarisProperties; geometry: GeoGeometry }[]
> {
  const params = new URLSearchParams({
    geometry: `${bounds.west},${bounds.south},${bounds.east},${bounds.north}`,
    geometryType: 'esriGeometryEnvelope',
    inSR: '4326',
    spatialRel: 'esriSpatialRelIntersects',
    where: `taxarea >= ${minAcres}`,
    outFields:
      'parcelid,ownername,adrlabel,adrcity,adrzip5,taxarea,parcellgl,parceltype,county,section,township,range,landvalue,totalvalue',
    outSR: '4326',
    resultRecordCount: '90',
    f: 'geojson',
  });
  const url = `https://gis.arkansas.gov/arcgis/rest/services/FEATURESERVICES/Planning_Cadastre/FeatureServer/6/query?${params.toString()}`;
  const fc = await fetchJsonTimeout(url);
  const feats = (fc?.features as { properties: Record<string, unknown>; geometry: GeoGeometry }[]) || [];
  return feats
    .filter((f) => f.geometry && (f.geometry.type === 'Polygon' || f.geometry.type === 'MultiPolygon'))
    .map((f) => {
      const p = f.properties || {};
      const geo = computeGeoCentroidAndAcres(f.geometry);
      const acres = Number(p.taxarea || geo.acres || 40);
      return {
        properties: {
          parno: String(p.parcelid || `AR-${Math.round(geo.lat * 10000)}`).trim(),
          taxmap: String(p.parceltype || 'AG').trim(),
          section: String(p.section || '').trim(),
          twsp: p.township ? `${String(p.township).trim()}N` : '',
          range: p.range ? `${String(p.range).trim()}E` : '',
          siteadd: String(p.adrlabel || '').replace(/\s+/g, ' ').trim(),
          szip: String(p.adrzip5 || '').trim(),
          ownname: String(p.ownername || '').trim(),
          stateCode: 'AR',
          gisAcres: Number(acres.toFixed(1)),
          taxAcres: Number(acres.toFixed(1)),
          cultAcres: Number((acres * 0.88).toFixed(1)),
          uncultAcres: Number((acres * 0.12).toFixed(1)),
          legldesc: String(p.parcellgl || '').replace(/\s+/g, ' ').trim(),
          cntyname: String(p.county || 'ARKANSAS').toUpperCase().trim(),
          lat: geo.lat,
          lng: geo.lng,
          taxyear: '2025',
          landVal: Number(p.landvalue || 0),
          totVal: Number(p.totalvalue || 0),
        },
        geometry: f.geometry,
      };
    })
    .filter((x) => x.properties.gisAcres >= minAcres * 0.6);
}

async function queryNorthCarolinaGis(bounds: ParcelSyncBounds, minAcres: number): Promise<
  { properties: RawMarisProperties; geometry: GeoGeometry }[]
> {
  const params = new URLSearchParams({
    geometry: `${bounds.west},${bounds.south},${bounds.east},${bounds.north}`,
    geometryType: 'esriGeometryEnvelope',
    inSR: '4326',
    spatialRel: 'esriSpatialRelIntersects',
    outFields: 'parno,ownname,siteadd,scity,szip,gisacres,cntyname,landval,parval',
    outSR: '4326',
    resultRecordCount: '120',
    f: 'geojson',
  });
  const url = `https://services.nconemap.gov/secure/rest/services/NC1Map_Parcels/MapServer/1/query?${params.toString()}`;
  const fc = await fetchJsonTimeout(url);
  const feats = (fc?.features as { properties: Record<string, unknown>; geometry: GeoGeometry }[]) || [];
  return feats
    .filter((f) => f.geometry && (f.geometry.type === 'Polygon' || f.geometry.type === 'MultiPolygon'))
    .map((f) => {
      const p = f.properties || {};
      const geo = computeGeoCentroidAndAcres(f.geometry);
      const acres = Number(p.gisacres || 0) > 1 ? Number(p.gisacres) : geo.acres;
      return {
        properties: {
          parno: String(p.parno || `NC-${Math.round(geo.lat * 10000)}`).trim(),
          taxmap: 'NC',
          section: '',
          twsp: '',
          range: '',
          siteadd: String(p.siteadd || '').trim(),
          szip: String(p.szip || '').trim(),
          ownname: String(p.ownname || '').trim(),
          stateCode: 'NC',
          gisAcres: Number(acres.toFixed(1)),
          taxAcres: Number(acres.toFixed(1)),
          cultAcres: Number((acres * 0.84).toFixed(1)),
          uncultAcres: Number((acres * 0.16).toFixed(1)),
          legldesc: `${String(p.cntyname || 'NC').toUpperCase()} COUNTY CADASTRAL TRACT`,
          cntyname: String(p.cntyname || 'NORTH CAROLINA').toUpperCase().trim(),
          lat: geo.lat,
          lng: geo.lng,
          taxyear: '2025',
          landVal: Number(p.landval || 0),
          totVal: Number(p.parval || 0),
        },
        geometry: f.geometry,
      };
    })
    .filter((x) => x.properties.gisAcres >= minAcres)
    .slice(0, 80);
}

async function queryTexasStratMap(bounds: ParcelSyncBounds, minAcres: number): Promise<
  { properties: RawMarisProperties; geometry: GeoGeometry }[]
> {
  const params = new URLSearchParams({
    geometry: `${bounds.west},${bounds.south},${bounds.east},${bounds.north}`,
    geometryType: 'esriGeometryEnvelope',
    inSR: '4326',
    spatialRel: 'esriSpatialRelIntersects',
    outFields: 'prop_id,owner_name,situs_addr,situs_city,situs_zip,gis_area,legal_area,legal_desc,county,land_value,mkt_value,tax_year',
    outSR: '4326',
    resultRecordCount: '120',
    f: 'geojson',
  });
  const url = `https://feature.geographic.texas.gov/arcgis/rest/services/Parcels/stratmap_land_parcels_48_most_recent/MapServer/0/query?${params.toString()}`;
  const fc = await fetchJsonTimeout(url);
  const feats = (fc?.features as { properties: Record<string, unknown>; geometry: GeoGeometry }[]) || [];
  return feats
    .filter((f) => f.geometry && (f.geometry.type === 'Polygon' || f.geometry.type === 'MultiPolygon'))
    .map((f) => {
      const p = f.properties || {};
      const geo = computeGeoCentroidAndAcres(f.geometry);
      const rawAcre = Number(p.legal_area || p.gis_area || 0);
      const acres = rawAcre > 1 && rawAcre < 50000 ? rawAcre : geo.acres;
      return {
        properties: {
          parno: String(p.prop_id || `TX-${Math.round(geo.lat * 10000)}`).trim(),
          taxmap: 'TX',
          section: '',
          twsp: '',
          range: '',
          siteadd: String(p.situs_addr || '').trim(),
          szip: String(p.situs_zip || '').trim(),
          ownname: String(p.owner_name || '').trim(),
          stateCode: 'TX',
          gisAcres: Number(acres.toFixed(1)),
          taxAcres: Number(acres.toFixed(1)),
          cultAcres: Number((acres * 0.86).toFixed(1)),
          uncultAcres: Number((acres * 0.14).toFixed(1)),
          legldesc: String(p.legal_desc || 'TEXAS CADASTRAL TRACT').replace(/\s+/g, ' ').trim(),
          cntyname: String(p.county || 'TEXAS').toUpperCase().trim(),
          lat: geo.lat,
          lng: geo.lng,
          taxyear: String(p.tax_year || '2025').trim(),
          landVal: Number(p.land_value || 0),
          totVal: Number(p.mkt_value || 0),
        },
        geometry: f.geometry,
      };
    })
    .filter((x) => x.properties.gisAcres >= minAcres)
    .slice(0, 80);
}

export async function fetchRealParcelsInBounds(
  bounds: ParcelSyncBounds,
  opts: ParcelSyncOptions
): Promise<ParcelSyncResult> {
  const centerLat = (bounds.south + bounds.north) * 0.5;
  const centerLng = (bounds.west + bounds.east) * 0.5;
  const state = (opts.stateHint || inferStateFromCoords(centerLat, centerLng)).toUpperCase();

  let rawFeatures: { properties: RawMarisProperties; geometry: GeoGeometry }[] = [];
  let sourceTag: Parcel['source'] = 'MARIS Live';
  let providerLabel = 'MS MARIS 2024';

  const hydrateList = (
    feats: { properties: RawMarisProperties; geometry: GeoGeometry }[],
    src: Parcel['source']
  ): Parcel[] =>
    feats.map((f) => {
      const hydrated = hydrateMarisFeature(f, opts.regionId, src);
      if (opts.landmarkName && Number.isFinite(opts.landmarkLat) && Number.isFinite(opts.landmarkLng)) {
        hydrated.distanceToLandmarkMiles = haversineMiles(
          hydrated.center.lat,
          hydrated.center.lng,
          opts.landmarkLat!,
          opts.landmarkLng!
        );
        hydrated.landmarkName = opts.landmarkName;
      }
      return hydrated;
    });

  if (state === 'MS') {
    const primaryLayer: 1 | 2 = opts.overrideMsLayerId ?? (centerLng < -89.65 ? 1 : 2);
    rawFeatures = await queryMsMaris(bounds, primaryLayer, 15);
    // If near the West/East MS split longitude (-89.65), also check the adjacent layer
    if (rawFeatures.length < 10 && Math.abs(centerLng - -89.65) < 0.25) {
      const altLayer: 1 | 2 = primaryLayer === 1 ? 2 : 1;
      const extra = await queryMsMaris(bounds, altLayer, 15);
      rawFeatures = [...rawFeatures, ...extra];
    }
    // Retry with lower acreage threshold if none >= 15 ac (e.g., dense town edge)
    if (rawFeatures.length === 0) {
      rawFeatures = await queryMsMaris(bounds, primaryLayer, 5);
    }
    sourceTag = 'MARIS Live';
    providerLabel = 'MS MARIS 2024 Cadastral';
  } else if (state === 'AR') {
    rawFeatures = await queryArkansasGis(bounds, 20);
    if (rawFeatures.length === 0) rawFeatures = await queryArkansasGis(bounds, 5);
    sourceTag = 'AR GIS Live';
    providerLabel = 'Arkansas GIS Cadastral';
  } else if (state === 'NC') {
    rawFeatures = await queryNorthCarolinaGis(bounds, 15);
    if (rawFeatures.length === 0) rawFeatures = await queryNorthCarolinaGis(bounds, 4);
    sourceTag = 'NC OneMap';
    providerLabel = 'NC OneMap Cadastral';
  } else if (state === 'TX') {
    rawFeatures = await queryTexasStratMap(bounds, 15);
    if (rawFeatures.length === 0) rawFeatures = await queryTexasStratMap(bounds, 4);
    sourceTag = 'TX StratMap';
    providerLabel = 'Texas StratMap Cadastral';
  } else if (state === 'TN' && centerLat < 35.35 && centerLng < -89.5) {
    // Memphis metro warehouses sit right on the AR / MS border — load nearest Crittenden AR or DeSoto MS farm parcels!
    const arBox: ParcelSyncBounds = {
      west: Math.min(bounds.west, -90.26),
      south: bounds.south - 0.03,
      east: bounds.east + 0.02,
      north: bounds.north + 0.03,
    };
    rawFeatures = await queryArkansasGis(arBox, 25);
    if (rawFeatures.length > 0) {
      sourceTag = 'AR GIS Live';
      providerLabel = 'Nearest Mid-South AR GIS';
    } else {
      const msBox: ParcelSyncBounds = {
        west: bounds.west - 0.04,
        south: Math.min(bounds.south, 34.92),
        east: bounds.east + 0.04,
        north: 35.0,
      };
      rawFeatures = await queryMsMaris(msBox, 1, 20);
      sourceTag = 'MARIS Live';
      providerLabel = 'Nearest DeSoto MS MARIS';
    }
  } else {
    return {
      parcels: [],
      providerLabel: `${state} GIS`,
      message: `${state} does not expose a public CORS statewide parcel API — live cadastral parcel sync is active across MS (MARIS), AR (AR GIS), TX (StratMap), and NC (OneMap).`,
    };
  }

  // Deduplicate by PARNO & sort nearest to center/facility
  const seen = new Set<string>();
  const uniqueRaw = rawFeatures.filter((f) => {
    const k = `${f.properties.stateCode}-${f.properties.parno}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });

  const hydrated = hydrateList(uniqueRaw, sourceTag).sort((a, b) => {
    const da = haversineMiles(centerLat, centerLng, a.center.lat, a.center.lng);
    const db = haversineMiles(centerLat, centerLng, b.center.lat, b.center.lng);
    return da - db;
  });

  if (hydrated.length === 0) {
    return {
      parcels: [],
      providerLabel,
      message: `No farm parcels >= 5 ac found inside this exact zoom box on ${providerLabel} — zoom out slightly or pan over farmland and click Sync again.`,
    };
  }

  return {
    parcels: hydrated,
    providerLabel,
    message: `Synced ${hydrated.length} real ${providerLabel} farm parcels${opts.landmarkName ? ` near ${opts.landmarkName}` : ''} with county ownership`,
  };
}
