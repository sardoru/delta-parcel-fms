import {
  AIInsightItem,
  DeltaAlert,
  EquipmentUnit,
  GeoGeometry,
  IrrigationZoneOffset,
  Parcel,
  RawMarisProperties,
  RegionId,
  StressCell,
  TimeframeKey,
} from '../types/farm';
import { computeBbox } from '../utils/units';
import { MS_REGIONS } from './regions';

function hashString(input: string): number {
  let h = 2166136261;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h);
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

interface SoilDef {
  series: string;
  color: string;
  ph: number;
  cec: number;
  drainage: string;
  irrigation: string;
}

const REGION_SOILS: Record<RegionId, SoilDef[]> = {
  como: [
    {
      series: 'Memphis Silt Loam',
      color: '#9bb36e',
      ph: 6.4,
      cec: 14.8,
      drainage: 'Well Drained (Loess Upland Terrace)',
      irrigation: 'Center Pivot + Furrow Assisted',
    },
    {
      series: 'Loring Silt Loam',
      color: '#a89a67',
      ph: 6.1,
      cec: 16.2,
      drainage: 'Moderately Well Drained (Fragipan 28")',
      irrigation: 'Furrow Poly-Pipe + Surge Valve',
    },
    {
      series: 'Collins Silt Loam',
      color: '#6ca67e',
      ph: 6.6,
      cec: 19.4,
      drainage: 'Moderately Well Drained (Creek First-Bottom)',
      irrigation: 'Furrow Poly-Pipe + Tailwater Return',
    },
    {
      series: 'Falaya Silt Loam',
      color: '#668f8b',
      ph: 6.2,
      cec: 20.8,
      drainage: 'Somewhat Poorly Drained (Bottomland)',
      irrigation: 'Surface-Ditched Furrow Poly-Pipe',
    },
    {
      series: 'Grenada Silt Loam',
      color: '#8e9668',
      ph: 5.9,
      cec: 15.5,
      drainage: 'Moderately Well Drained (Fragipan 24")',
      irrigation: 'Variable-Rate Center Pivot',
    },
  ],
  macon: [
    {
      series: 'Brooksville Silty Clay',
      color: '#7ea674',
      ph: 6.8,
      cec: 34.2,
      drainage: 'Somewhat Poorly Drained (Black Belt Chalk)',
      irrigation: 'Center Pivot + Surface Waterway',
    },
    {
      series: 'Okolona Silty Clay',
      color: '#648f78',
      ph: 7.3,
      cec: 38.6,
      drainage: 'Moderately Well Drained (Selma Chalk Prairie)',
      irrigation: 'Rainfed Raised-Bed 38" + Pivot',
    },
    {
      series: 'Leeper Silty Clay Loam',
      color: '#5c8f92',
      ph: 7.1,
      cec: 29.4,
      drainage: 'Somewhat Poorly Drained (Bogue Chitto Bottom)',
      irrigation: 'Furrow Poly-Pipe + Tailwater Return',
    },
    {
      series: 'Vaiden Clay',
      color: '#a38d62',
      ph: 5.8,
      cec: 32.1,
      drainage: 'Somewhat Poorly Drained (Acid Blackland)',
      irrigation: 'Surface-Ditched Bedded Furrow',
    },
    {
      series: 'Kipling Silt Loam',
      color: '#8fa06b',
      ph: 6.2,
      cec: 24.5,
      drainage: 'Somewhat Poorly Drained (Prairie Terrace)',
      irrigation: 'Center Pivot + Surge Poly-Pipe',
    },
  ],
};

const REGION_CROPS: {
  crop: Parcel['crop'];
  variety: string;
  plantingDate: string;
  unitLabel: string;
  yieldPerAcreLbs: number;
}[] = [
  {
    crop: 'Upland Cotton',
    variety: 'Deltapine DP 2127 B3XF',
    plantingDate: 'Apr 24, 2026',
    unitLabel: 'lbs seed cotton harvested',
    yieldPerAcreLbs: 3040,
  },
  {
    crop: 'Soybeans',
    variety: 'Asgrow AG46X6 (MG 4.6)',
    plantingDate: 'Apr 15, 2026',
    unitLabel: 'lbs soybeans harvested',
    yieldPerAcreLbs: 3480,
  },
  {
    crop: 'Field Corn',
    variety: 'DeKalb DKC67-44 VT2P',
    plantingDate: 'Mar 27, 2026',
    unitLabel: 'lbs shelled corn harvested',
    yieldPerAcreLbs: 11100,
  },
  {
    crop: 'Grain Sorghum',
    variety: 'Pioneer 84P80',
    plantingDate: 'Apr 21, 2026',
    unitLabel: 'lbs milo harvested',
    yieldPerAcreLbs: 5600,
  },
  {
    crop: 'Winter Wheat Cover',
    variety: 'Cereal Rye + Crimson Clover',
    plantingDate: 'Oct 18, 2026',
    unitLabel: 'lbs cover biomass est.',
    yieldPerAcreLbs: 1900,
  },
];

const FEATURED_NAMES: Record<
  RegionId,
  Record<string, { name: string; cropIdx: number; soilIdx: number; health: number; delta: number }>
> = {
  como: {
    '1039 3200000 0000100': { name: 'West Como Sec 32 Tract', cropIdx: 0, soilIdx: 0, health: 92, delta: 2.0 },
    '1083 0500000 0000200': { name: 'Old Panola West 320', cropIdx: 1, soilIdx: 2, health: 89, delta: 1.5 },
    '1083 0500000 0000100': { name: 'Old Panola East 320', cropIdx: 2, soilIdx: 1, health: 86, delta: -1.2 },
    '1038 2800000 0000200': { name: 'Compress Rd North Tract', cropIdx: 1, soilIdx: 0, health: 94, delta: 2.4 },
    '1082 0900000 0000100': { name: 'Hwy 51 South Bottom', cropIdx: 0, soilIdx: 2, health: 91, delta: 1.8 },
    '1081 1100000 0000100': { name: 'I-55 East Sec 11 Farm', cropIdx: 2, soilIdx: 1, health: 84, delta: -1.8 },
    '1029 3100000 0000100': { name: 'Hwy 310 East Plantation', cropIdx: 0, soilIdx: 0, health: 93, delta: 2.1 },
    '1037 2500000 0000200': { name: 'Wilborn Creek Bottom', cropIdx: 1, soilIdx: 2, health: 95, delta: 2.9 },
  },
  macon: {
    '139 -28-001.00': { name: 'Bogue Chitto Creek Sec 28', cropIdx: 0, soilIdx: 2, health: 93, delta: 2.3 },
    '154 -21-001.02': { name: 'Hwy 388 North Gin Block', cropIdx: 0, soilIdx: 0, health: 91, delta: 1.7 },
    '138 -29-002.01': { name: 'Mickens-Clay Rd West 316', cropIdx: 1, soilIdx: 1, health: 89, delta: 1.2 },
    '139 -34-001.00': { name: 'Deerbrook Creek Sec 34', cropIdx: 0, soilIdx: 2, health: 94, delta: 2.6 },
    '138 -32-003.00': { name: 'Deerbrook South Prairie', cropIdx: 2, soilIdx: 0, health: 86, delta: -1.4 },
    '153 -17-003.01': { name: 'Cliftonville Ridge Sec 17', cropIdx: 1, soilIdx: 1, health: 90, delta: 1.4 },
    '153 -18-001.01': { name: 'Brooksville Prairie Sec 18', cropIdx: 0, soilIdx: 0, health: 88, delta: 0.9 },
    '138 -31-001.00': { name: 'Macon North Sec 31 Tract', cropIdx: 2, soilIdx: 3, health: 83, delta: -2.0 },
    '168 -07-001.00': { name: 'Union Bluff Rd Block 515', cropIdx: 0, soilIdx: 1, health: 92, delta: 1.9 },
    '170 -11-001.00': { name: 'Prairie Point Sec 11', cropIdx: 1, soilIdx: 0, health: 91, delta: 1.5 },
    '185 -01-001.00': { name: 'Lee Rd Big Prairie 850', cropIdx: 0, soilIdx: 2, health: 95, delta: 2.8 },
    '167 -11-001.00': { name: 'Pilgrim Rest Sec 11', cropIdx: 2, soilIdx: 4, health: 87, delta: 0.6 },
  },
};

function deriveParcelLabel(p: RawMarisProperties, regionId: RegionId): string {
  const featured = FEATURED_NAMES[regionId][p.parno];
  if (featured) return featured.name;

  if (p.siteadd && p.siteadd !== '0' && !p.siteadd.startsWith('0 ') && p.siteadd.length > 4) {
    const cleanRoad = p.siteadd
      .replace(/^\d+\s+/, '')
      .toLowerCase()
      .replace(/\b\w/g, (c) => c.toUpperCase());
    return `${cleanRoad} · Sec ${p.section || '01'}`;
  }

  if (regionId === 'macon') {
    if (p.legldesc.includes('BOGUE CHITTO')) return `Bogue Chitto Bottom · Sec ${p.section}`;
    if (p.siteadd.includes('DEERBROOK')) return `Deerbrook Rd · Sec ${p.section}`;
    if (p.legldesc.includes('CREEK')) return `Creek Prairie · Sec ${p.section}`;
    const dir = p.lat > 33.23 ? 'North Prairie' : p.lat < 33.19 ? 'South Deerbrook' : p.lng > -88.45 ? 'East Gin Block' : 'West Gin Block';
    return `${dir} · Sec ${p.section || '00'} ${p.twsp || '16N'}`;
  }

  if (p.legldesc.includes('WILBORN')) return `Wilborn Creek · Sec ${p.section}`;
  if (p.legldesc.includes('I-55')) return `I-55 Corridor · Sec ${p.section}`;
  if (p.legldesc.includes('HWY 51')) return `US-51 Tract · Sec ${p.section}`;
  if (p.legldesc.includes('HWY 310')) return `MS-310 Tract · Sec ${p.section}`;
  const dir =
    p.lng < -89.96 ? 'West Como' : p.lng > -89.91 ? 'East Como' : p.lat > 34.525 ? 'North Como' : 'South Como';
  return `${dir} · Sec ${p.section || '00'} T${p.twsp || '06'}S`;
}

function buildStressGrid(seed: number, healthPct: number, soilSeries: string, regionId: RegionId): StressCell[] {
  const hotspotRow = 1 + (seed % 4);
  const hotspotCol = 4 + (seed % 9);
  const intensity = Math.max(0.35, Math.min(0.96, (104 - healthPct) / 24));
  const cells: StressCell[] = [];

  for (let r = 0; r < 6; r++) {
    for (let c = 0; c < 16; c++) {
      const dist = Math.hypot((r - hotspotRow) * 1.45, (c - hotspotCol) * 0.85);
      const pull = Math.max(0, 1 - dist / 4.7) * intensity;
      const wave =
        Math.sin((c + seed * 0.37) * 0.65) * 0.08 +
        Math.cos((r * 2.1 + seed * 0.21) * 0.9) * 0.06 +
        ((r * 17 + c * 31 + seed) % 11) * 0.013;
      const severity = Math.min(1, Math.max(0.04, pull + wave + 0.06));
      const moisturePct = Math.round(Math.max(18, Math.min(76, 63 - severity * 37)));
      const ndvi = Number(Math.max(0.34, Math.min(0.93, 0.9 - severity * 0.43)).toFixed(2));
      const note =
        severity > 0.68
          ? regionId === 'macon'
            ? `${soilSeries.split(' ')[0]} shrink-swell clay crack / low moisture pocket`
            : `${soilSeries.split(' ')[0]} fragipan / slope moisture deficit`
          : severity > 0.42
          ? 'Moderate runoff wash along headland turnrow'
          : regionId === 'macon'
          ? 'Uniform Black Belt prairie boll maturity & vigor'
          : 'Uniform Panola silt loam stand & canopy vigor';

      cells.push({ row: r, col: c, severity, moisturePct, ndvi, note });
    }
  }
  return cells;
}

function buildTrends(
  base: number,
  delta: number
): Record<TimeframeKey, { label: string; score: number; ndvi: number; baseline: number }[]> {
  const days7 = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const curve7 = [-2.8, -1.5, -2.1, 2.3, -0.5, -1.4, delta];
  const d7 = days7.map((label, i) => {
    const score = Math.min(98, Math.max(64, Math.round((base + curve7[i]) * 10) / 10));
    return { label, score, ndvi: Number((score / 111).toFixed(2)), baseline: Math.round(base - 1.5) };
  });

  const d14 = Array.from({ length: 14 }, (_, i) => {
    const drift = Math.sin(i * 0.72) * 2.9 + (i / 13) * delta;
    const score = Math.min(98, Math.max(62, Math.round((base - 1.2 + drift) * 10) / 10));
    return { label: `Nov ${13 + i}`, score, ndvi: Number((score / 111).toFixed(2)), baseline: Math.round(base - 1.5) };
  });

  const d30 = ['W1', 'W2', 'W3', 'W4', 'W5', 'W6', 'Now'].map((label, i) => {
    const drift = Math.cos(i * 0.9) * 2.6 + (i / 6) * delta * 1.2;
    const score = Math.min(98, Math.max(62, Math.round((base - 1.6 + drift) * 10) / 10));
    return { label, score, ndvi: Number((score / 111).toFixed(2)), baseline: Math.round(base - 1.5) };
  });

  return { '7d': d7, '14d': d14, '30d': d30 };
}

function buildIrrigationOffsets(seed: number, method: string): IrrigationZoneOffset[] {
  const vals = [-2, 1, 1.5, -1, -1, -2, 2, -2.5];
  const isPivot = method.includes('Pivot');
  return vals.map((baseOffset, i) => {
    const shift = ((seed + i * 3) % 5) * 0.5 - 1.0;
    const offsetMin = Number(Math.max(-2.5, Math.min(3.0, baseOffset + (seed % 3 === 0 ? 0 : shift))).toFixed(1));
    return {
      id: `irr-${seed}-${i}`,
      label: `Z${(i % 4) + 1}`,
      zoneGroup: i < 4 ? 'Zone A' : 'Zone B',
      offsetMin,
      valveType: isPivot ? `Pivot Span ${i + 1}` : i % 2 === 0 ? '15" Poly-Pipe' : 'Surge Valve',
      flowGpm: isPivot ? 860 + i * 35 : 1180 + ((seed + i) % 5) * 75,
    };
  });
}

function buildInsights(
  regionId: RegionId,
  name: string,
  crop: Parcel['crop'],
  soilSeries: string,
  soilPh: number,
  cultAcres: number,
  distToGin?: number
): AIInsightItem[] {
  if (regionId === 'macon') {
    return [
      {
        id: `ai-1-${name}`,
        priority: 'positive',
        title: `Bogue Chitto Gin Haul Priority (${distToGin ?? 1.2} mi)`,
        action: `Stage ${crop === 'Upland Cotton' ? 'round modules on Deerbrook Rd turnrow for 12-min turnaround to Bogue Chitto Gin' : `${Math.round(cultAcres)} cultivated acres for dry harvest pass before Noxubee clay softens`}.`,
        impact: `+$${Math.round(cultAcres * 26).toLocaleString()} lint grade & haul efficiency`,
        msuRef: 'MSU Black Belt Branch Experiment Station (Brooksville)',
      },
      {
        id: `ai-2-${name}`,
        priority: soilPh < 6.2 ? 'high' : 'medium',
        title:
          soilPh < 6.2
            ? `Acid Vaiden Clay Lime Prescription (pH ${soilPh})`
            : `Black Belt ${soilSeries} Fall Bedding Window`,
        action:
          soilPh < 6.2
            ? `Apply 1.5 tons/ac calcitic lime across acidic prairie knolls to counter Vaiden subsoil acidity before winter rain.`
            : `Hip 38-inch stale seedbeds while ${soilSeries} moisture is below 35% to avoid spring buckshot compaction.`,
        impact: soilPh < 6.2 ? '+11% spring nutrient uptake' : '+7.4% early-April stand uniformity',
        msuRef: 'USDA-NRCS Noxubee County Blackland Prairie Guide',
      },
    ];
  }

  return [
    {
      id: `ai-1-${name}`,
      priority: 'positive',
      title: `Panola County ${crop} Harvest & Residue Plan`,
      action: `Prioritize dry-weather pass across ${Math.round(cultAcres)} cultivated acres on ${soilSeries} before Sardis basin front moves in.`,
      impact: `+$${Math.round(cultAcres * 24).toLocaleString()} grade & timeliness preservation`,
      msuRef: 'MSU Extension North MS / Panola Row-Crop Bulletin',
    },
    {
      id: `ai-2-${name}`,
      priority: soilPh < 6.2 ? 'high' : 'medium',
      title:
        soilPh < 6.2
          ? `Variable-Rate Ag Lime Advised (pH ${soilPh})`
          : `Loess Erosion Control on ${soilSeries}`,
      action:
        soilPh < 6.2
          ? `Broadcast 1.25 tons/ac calcitic lime across ridgetop benches to lift pH toward 6.5 before spring burndown.`
          : `Maintain no-till cover residue and grassed waterways across sloping Como loess terraces to prevent rill wash.`,
      impact: soilPh < 6.2 ? '+9% spring phosphorus availability' : 'Eligible for $44/ac MS NRCS EQIP Practice 340',
      msuRef: 'USDA-NRCS Panola County MLRA 134 Conservation Guide',
    },
  ];
}

export function hydrateMarisFeature(
  feature: { properties: RawMarisProperties; geometry: GeoGeometry },
  regionId: RegionId,
  source: Parcel['source'] = 'MARIS 2024'
): Parcel {
  const cfg = MS_REGIONS[regionId];
  const p = feature.properties;
  const seed = hashString(`${regionId}-${p.parno || `${p.lat}-${p.lng}`}`);
  const featured = FEATURED_NAMES[regionId][p.parno];

  const soils = REGION_SOILS[regionId];
  // Near Bogue Chitto Gin, weight Upland Cotton & Soybeans higher so it reflects real gin-shed cropping
  const defaultCropIdx = regionId === 'macon' ? [0, 0, 1, 2, 0, 1, 3, 4][seed % 8] : seed % REGION_CROPS.length;
  const cropObj = REGION_CROPS[featured ? featured.cropIdx : defaultCropIdx];
  const soilObj = soils[featured ? featured.soilIdx : (seed >> 2) % soils.length];

  const healthPct = featured ? featured.health : 80 + (seed % 17);
  const healthDeltaPct = featured ? featured.delta : Number((((seed % 52) - 16) / 10).toFixed(1));
  const areaAcres = Number(Math.max(1, p.gisAcres || p.taxAcres || 40).toFixed(1));
  const cultivatedAcres = Number(
    Math.min(areaAcres, p.cultAcres > 0 ? p.cultAcres : areaAcres * 0.82).toFixed(1)
  );
  const uncultivatedAcres = Number(Math.max(0, areaAcres - cultivatedAcres).toFixed(1));

  const name = deriveParcelLabel(p, regionId);
  const twspFormatted = p.twsp?.includes('N') || p.twsp?.includes('S') ? `T${p.twsp}` : `T${p.twsp || '06'}S`;
  const rngFormatted = p.range?.includes('E') || p.range?.includes('W') ? `R${p.range}` : `R${p.range || '07'}W`;
  const plss = `Sec ${p.section || '00'} · ${twspFormatted} · ${rngFormatted}`;
  const ndviMean = Number(Math.min(0.92, Math.max(0.64, healthPct / 110)).toFixed(2));
  const statusBadge =
    healthPct >= 91
      ? 'Good for Harvest'
      : healthPct >= 86
      ? 'Good for Planting'
      : healthPct >= 82
      ? 'Monitor Moisture'
      : 'Check Clay Drain';

  const distToGin = cfg.landmark
    ? haversineMiles(p.lat, p.lng, cfg.landmark.lat, cfg.landmark.lng)
    : undefined;

  const liveYieldLbs = Math.round(cultivatedAcres * cropObj.yieldPerAcreLbs * 0.085);
  const peakIdx = 16 + (seed % 5);
  const yieldBars = Array.from({ length: 24 }, (_, idx) => {
    if (idx === peakIdx) return 93;
    if (idx === peakIdx + 1) return 85;
    return 18 + ((seed + idx * 13) % 24);
  });

  const cityLabel = regionId === 'macon' ? `Macon, MS ${p.szip || '39341'}` : `Como, MS ${p.szip || '38619'}`;
  const cleanSite =
    p.siteadd && p.siteadd !== '0' && !p.siteadd.startsWith('0 ')
      ? `${p.siteadd}, ${regionId === 'macon' ? 'Macon, MS' : 'Como, MS'}`
      : p.siteadd?.startsWith('0 ')
      ? `${p.siteadd.slice(2)}, ${regionId === 'macon' ? 'Macon, MS' : 'Como, MS'}`
      : `Rural Route · ${plss}`;

  return {
    id: `${regionId}-${p.parno.replace(/\s+/g, '-')}`,
    name,
    parno: p.parno,
    fsaTract: `PARNO ${p.parno}`,
    county: `${p.cntyname ? p.cntyname[0] + p.cntyname.slice(1).toLowerCase() : cfg.countyLabel.split(' ')[0]} County, MS`,
    cityState: cityLabel,
    siteAddress: cleanSite,
    plss,
    legalDesc: p.legldesc || `${areaAcres} AC ${plss}`,
    taxYear: p.taxyear || '2024',
    landValueUsd: p.landVal || 0,
    source,
    crop: cropObj.crop,
    variety: cropObj.variety,
    areaAcres,
    cultivatedAcres,
    uncultivatedAcres,
    healthPct,
    healthDeltaPct,
    statusBadge,
    yieldProjectionPct: Math.max(5, Math.min(16, Math.round((healthPct - 76) * 0.74))),
    avgHumidityPct: 62 + (seed % 11),
    humidityMin: 40 + (seed % 8),
    humidityMax: 80 + (seed % 9),
    avgTempF: regionId === 'macon' ? 64 + (seed % 5) : 61 + (seed % 5),
    tempMinF: regionId === 'macon' ? 46 + (seed % 5) : 44 + (seed % 5),
    tempMaxF: regionId === 'macon' ? 71 + (seed % 5) : 68 + (seed % 5),
    soilSeries: soilObj.series,
    soilColor: soilObj.color,
    soilPh: soilObj.ph,
    soilCec: soilObj.cec,
    drainageClass: soilObj.drainage,
    irrigationMethod: soilObj.irrigation,
    plantingDate: cropObj.plantingDate,
    ndviMean,
    center: { lng: p.lng, lat: p.lat },
    bbox: computeBbox(feature.geometry),
    geometry: feature.geometry,
    distanceToLandmarkMiles: distToGin,
    landmarkName: cfg.landmark?.name,
    healthTrend: buildTrends(healthPct, healthDeltaPct),
    stressGrid: buildStressGrid(seed, healthPct, soilObj.series, regionId),
    irrigationOffsets: buildIrrigationOffsets(seed, soilObj.irrigation),
    liveYieldLbs,
    yieldUnitLabel: cropObj.unitLabel,
    yieldBars,
    aiInsights: buildInsights(regionId, name, cropObj.crop, soilObj.series, soilObj.ph, cultivatedAcres, distToGin),
    logs: [
      {
        id: `log-1-${p.parno}`,
        date: 'Nov 26 · 08:20',
        category: 'Scouting',
        title: `MARIS Cadastral Boundary Synced (${cultivatedAcres} cult. ac)`,
        operator: 'Caleb Vance',
        detail: `Verified ${plss} (${p.legldesc || `${cfg.countyLabel} Assessor 2024`}).${distToGin !== undefined ? ` ${distToGin} mi haul to Bogue Chitto Gin.` : ''}`,
      },
      {
        id: `log-2-${p.parno}`,
        date: 'Nov 21 · 14:15',
        category: 'Soil Sample',
        title: `${soilObj.series} Grid Analysis — pH ${soilObj.ph}`,
        operator: 'Hannah Brooks (CCA)',
        detail: `CEC ${soilObj.cec} meq/100g. Drainage: ${soilObj.drainage}.`,
      },
    ],
  };
}

export const REGION_EQUIPMENT: Record<RegionId, EquipmentUnit[]> = {
  macon: [
    {
      id: 'tractor-t04',
      name: 'Tractor T-04',
      model: 'John Deere 8R 340 · RTK AutoTrac',
      kind: 'tractor',
      status: 'Online',
      connectivity: 'GPS · LTE',
      lastUpdated: '27.11.2026, 08:14',
      assignedParcelId: 'macon-139--28-001.00',
      operator: 'Caleb Vance',
      primaryMetricLabel: 'Fuel',
      primaryMetricValue: '68%',
      areaCoveredAcres: 74.5,
      speedMph: 5.8,
      shiftStart: '06 AM',
      shiftEnd: '11 PM',
      shiftProgress: 0.64,
      activitySteps: [0.36, 0.36, 0.82, 0.82, 0.50, 0.50, 0.88, 0.88, 0.66],
      engineHours: 1512.4,
      implementWidthFt: 38,
      currentTask: 'Module Staging & Stalk Shredding - Bogue Chitto Sec 28',
    },
    {
      id: 'sprayer-s01',
      name: 'Sprayer S-01',
      model: 'Hagie STS16 · 120ft Boom',
      kind: 'sprayer',
      status: 'Working',
      connectivity: 'GPS · LTE',
      lastUpdated: '27.11.2026, 08:12',
      assignedParcelId: 'macon-154--21-001.02',
      operator: 'Marcus Bell',
      primaryMetricLabel: 'Tank',
      primaryMetricValue: '46%',
      areaCoveredAcres: 52.2,
      speedMph: 8.6,
      shiftStart: '07 AM',
      shiftEnd: '05 PM',
      shiftProgress: 0.52,
      activitySteps: [0.78, 0.78, 0.44, 0.44, 0.80, 0.80, 0.38, 0.38, 0.62],
      engineHours: 938.2,
      implementWidthFt: 120,
      currentTask: 'Fall Burndown Residual - Hwy 388 North Gin Block',
    },
  ],
  como: [
    {
      id: 'tractor-t04',
      name: 'Tractor T-04',
      model: 'John Deere 8R 340 · RTK AutoTrac',
      kind: 'tractor',
      status: 'Online',
      connectivity: 'GPS · LTE',
      lastUpdated: '26.11.2026, 09:42',
      assignedParcelId: 'como-1039-3200000-0000100',
      operator: 'Caleb Vance',
      primaryMetricLabel: 'Fuel',
      primaryMetricValue: '64%',
      areaCoveredAcres: 62.4,
      speedMph: 5.6,
      shiftStart: '06 AM',
      shiftEnd: '11 PM',
      shiftProgress: 0.62,
      activitySteps: [0.32, 0.32, 0.78, 0.78, 0.45, 0.45, 0.85, 0.85, 0.62],
      engineHours: 1482.6,
      implementWidthFt: 38,
      currentTask: 'Stalk Shredding & Terrace Subsoiling - West Como Sec 32',
    },
    {
      id: 'sprayer-s01',
      name: 'Sprayer S-01',
      model: 'Hagie STS16 · 120ft Boom',
      kind: 'sprayer',
      status: 'Working',
      connectivity: 'GPS · LTE',
      lastUpdated: '26.11.2026, 09:40',
      assignedParcelId: 'como-1083-0500000-0000200',
      operator: 'Marcus Bell',
      primaryMetricLabel: 'Tank',
      primaryMetricValue: '41%',
      areaCoveredAcres: 44.8,
      speedMph: 8.4,
      shiftStart: '07 AM',
      shiftEnd: '05 PM',
      shiftProgress: 0.48,
      activitySteps: [0.82, 0.82, 0.42, 0.42, 0.76, 0.76, 0.36, 0.36, 0.58],
      engineHours: 916.4,
      implementWidthFt: 120,
      currentTask: 'Fall Burndown Residual - Old Panola West 320',
    },
  ],
};

export const REGION_ALERTS: Record<RegionId, DeltaAlert[]> = {
  macon: [
    {
      id: 'm-al-1',
      severity: 'ok',
      time: '8m ago',
      title: 'Bogue Chitto Gin Yard Open · 0.5 mi Haul',
      detail: '4762 Deerbrook Rd module scale active; Sec 28 & Hwy 388 round modules queued for ginning.',
      parcelId: 'macon-139--28-001.00',
    },
    {
      id: 'm-al-2',
      severity: 'warn',
      time: '24m ago',
      title: 'Macon North Sec 31 · Vaiden Clay pH 5.8',
      detail: 'Acid Black Belt clay bench showing -2.0% vigor; schedule fall calcitic lime broadcast.',
      parcelId: 'macon-138--31-001.00',
    },
    {
      id: 'm-al-3',
      severity: 'info',
      time: '52m ago',
      title: 'MARIS 2024 Noxubee County GIS Synced',
      detail: '120 cultivated Black Belt parcels (25,197 crop acres) loaded around Bogue Chitto Gin.',
      parcelId: 'macon-154--21-001.02',
    },
  ],
  como: [
    {
      id: 'al-1',
      severity: 'warn',
      time: '14m ago',
      title: 'I-55 East Sec 11 · Fragipan Moisture Dip',
      detail: 'Loring silt loam bench showing -1.8% vigor drop; check Zone B2 poly-pipe advance.',
      parcelId: 'como-1081-1100000-0000100',
    },
    {
      id: 'al-2',
      severity: 'info',
      time: '36m ago',
      title: 'Sprayer S-01 Tender Refill — Old Panola Rd',
      detail: 'Tank at 41% (656 gal); nurse truck ETA 18 min at Sec 05 west turnrow.',
      parcelId: 'como-1083-0500000-0000200',
    },
    {
      id: 'al-3',
      severity: 'ok',
      time: '1h ago',
      title: 'MARIS 2024 Panola County Cadastral Synced',
      detail: '120 cultivated Como, MS (38619) farm parcels verified against MDEQ statewide GIS.',
      parcelId: 'como-1039-3200000-0000100',
    },
  ],
};
