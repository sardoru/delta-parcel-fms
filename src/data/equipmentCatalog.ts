import { EquipmentUnit, Parcel } from '../types/farm';

export interface MachineTemplate {
  catalogId: string;
  slot: 'primary' | 'applicator';
  shortName: string;
  model: string;
  kind: EquipmentUnit['kind'];
  implementWidthFt: number;
  defaultSpeedMph: number;
  minSpeedMph: number;
  maxSpeedMph: number;
  tankCapacityGal: number;
  primaryMetricLabel: 'Fuel' | 'Tank';
  fieldEfficiency: number;
  operator: string;
  bestForCrops?: Parcel['crop'][];
  taskByCrop: (crop: Parcel['crop'], parcelName: string) => string;
}

export const EQUIPMENT_CATALOG: MachineTemplate[] = [
  // ─── PRIMARY HARVESTER / TRACTOR SLOT ───
  {
    catalogId: 'jd-cp770',
    slot: 'primary',
    shortName: 'Picker CP770',
    model: 'John Deere CP770 · 6-Row 38" Round Module',
    kind: 'picker',
    implementWidthFt: 19,
    defaultSpeedMph: 4.4,
    minSpeedMph: 2.5,
    maxSpeedMph: 6.0,
    tankCapacityGal: 320,
    primaryMetricLabel: 'Fuel',
    fieldEfficiency: 0.82,
    operator: 'Caleb Vance',
    bestForCrops: ['Upland Cotton'],
    taskByCrop: (_crop, name) => `6-Row Round Module Cotton Picking · ${name}`,
  },
  {
    catalogId: 'jd-x9-1100',
    slot: 'primary',
    shortName: 'Combine X9',
    model: 'John Deere X9 1100 · 40ft RD40F Draper',
    kind: 'combine',
    implementWidthFt: 40,
    defaultSpeedMph: 5.4,
    minSpeedMph: 2.5,
    maxSpeedMph: 7.5,
    tankCapacityGal: 330,
    primaryMetricLabel: 'Fuel',
    fieldEfficiency: 0.84,
    operator: 'Caleb Vance',
    bestForCrops: ['Soybeans', 'Field Corn', 'Grain Sorghum', 'Winter Wheat Cover'],
    taskByCrop: (crop, name) => `40ft Draper ${crop} Harvest · ${name}`,
  },
  {
    catalogId: 'jd-8rx-410',
    slot: 'primary',
    shortName: 'Tractor 8RX',
    model: 'John Deere 8RX 410 · 38ft Ripper-Bedder',
    kind: 'tractor',
    implementWidthFt: 38,
    defaultSpeedMph: 6.0,
    minSpeedMph: 3.0,
    maxSpeedMph: 10.0,
    tankCapacityGal: 212,
    primaryMetricLabel: 'Fuel',
    fieldEfficiency: 0.86,
    operator: 'Devon Brooks',
    taskByCrop: (crop, name) => `Stalk Shred & 38" Raised-Bed Prep (${crop}) · ${name}`,
  },
  {
    catalogId: 'case-magnum-380',
    slot: 'primary',
    shortName: 'Magnum 380',
    model: 'Case IH Magnum 380 Rowtrac · 24-Row Planter',
    kind: 'tractor',
    implementWidthFt: 60,
    defaultSpeedMph: 5.8,
    minSpeedMph: 3.0,
    maxSpeedMph: 9.5,
    tankCapacityGal: 178,
    primaryMetricLabel: 'Fuel',
    fieldEfficiency: 0.85,
    operator: 'Travis Cole',
    taskByCrop: (_crop, name) => `Variable-Rate Cover & Seedbed Pass · ${name}`,
  },

  // ─── SPRAYER / APPLICATOR SLOT ───
  {
    catalogId: 'hagie-sts16',
    slot: 'applicator',
    shortName: 'Hagie STS16',
    model: 'Hagie STS16 High-Clearance · 120ft Boom',
    kind: 'sprayer',
    implementWidthFt: 120,
    defaultSpeedMph: 9.8,
    minSpeedMph: 5.0,
    maxSpeedMph: 15.0,
    tankCapacityGal: 1600,
    primaryMetricLabel: 'Tank',
    fieldEfficiency: 0.78,
    operator: 'Marcus Bell',
    bestForCrops: ['Upland Cotton', 'Field Corn'],
    taskByCrop: (crop, name) =>
      crop === 'Upland Cotton'
        ? `Defoliant & Boll Opener (12 GPA) · ${name}`
        : `Late-Season Fungicide & Foliar (15 GPA) · ${name}`,
  },
  {
    catalogId: 'jd-616r',
    slot: 'applicator',
    shortName: 'Sprayer 616R',
    model: 'John Deere 616R · 120ft See & Spray™',
    kind: 'sprayer',
    implementWidthFt: 120,
    defaultSpeedMph: 11.4,
    minSpeedMph: 5.0,
    maxSpeedMph: 16.5,
    tankCapacityGal: 1600,
    primaryMetricLabel: 'Tank',
    fieldEfficiency: 0.81,
    operator: 'Marcus Bell',
    bestForCrops: ['Soybeans', 'Grain Sorghum', 'Winter Wheat Cover'],
    taskByCrop: (crop, name) => `See & Spray™ Targeted Residual (${crop}) · ${name}`,
  },
  {
    catalogId: 'case-patriot-4450',
    slot: 'applicator',
    shortName: 'Patriot 4450',
    model: 'Case IH Patriot 4450 · AIM Command FLEX',
    kind: 'sprayer',
    implementWidthFt: 120,
    defaultSpeedMph: 11.8,
    minSpeedMph: 5.0,
    maxSpeedMph: 16.0,
    tankCapacityGal: 1600,
    primaryMetricLabel: 'Tank',
    fieldEfficiency: 0.8,
    operator: 'Ray Holloway',
    taskByCrop: (_crop, name) => `Pulse-Width Fall Burndown Residual · ${name}`,
  },
  {
    catalogId: 'air-tractor-502b',
    slot: 'applicator',
    shortName: 'Air Tractor 502',
    model: 'Air Tractor AT-502B · 65ft Aerial Swath',
    kind: 'aerial',
    implementWidthFt: 65,
    defaultSpeedMph: 126,
    minSpeedMph: 105,
    maxSpeedMph: 140,
    tankCapacityGal: 500,
    primaryMetricLabel: 'Tank',
    fieldEfficiency: 0.62,
    operator: 'Capt. Eli Vance',
    taskByCrop: (crop, name) =>
      crop === 'Upland Cotton'
        ? `Aerial Defoliant Pass (5 GPA) · ${name}`
        : `Aerial Fungicide / Cover Seed Pass · ${name}`,
  },
];

export interface ParcelEquipmentOverride {
  primaryCatalogId?: string;
  applicatorCatalogId?: string;
  primaryStatus?: EquipmentUnit['status'];
  applicatorStatus?: EquipmentUnit['status'];
  primarySpeedMph?: number;
  applicatorSpeedMph?: number;
}

function hashSeed(str: string): number {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h);
}

/** Real ASABE field capacity formula: acres/hr = (Width_ft * Speed_mph * FieldEfficiency) / 8.25 */
export function computeAcresPerHour(widthFt: number, speedMph: number, efficiency = 0.82): number {
  return Number(((widthFt * speedMph * efficiency) / 8.25).toFixed(1));
}

export function buildEquipmentForParcel(
  parcel: Parcel,
  override?: ParcelEquipmentOverride
): EquipmentUnit[] {
  const seed = hashSeed(`${parcel.id}-${parcel.parno}`);

  const defaultPrimary =
    EQUIPMENT_CATALOG.find(
      (m) => m.slot === 'primary' && m.bestForCrops?.includes(parcel.crop)
    ) || EQUIPMENT_CATALOG[0];

  const defaultApplicator =
    EQUIPMENT_CATALOG.find(
      (m) => m.slot === 'applicator' && m.bestForCrops?.includes(parcel.crop)
    ) || EQUIPMENT_CATALOG[4];

  const primaryTpl =
    EQUIPMENT_CATALOG.find((m) => m.catalogId === override?.primaryCatalogId) || defaultPrimary;
  const appTpl =
    EQUIPMENT_CATALOG.find((m) => m.catalogId === override?.applicatorCatalogId) || defaultApplicator;

  const makeUnit = (
    tpl: MachineTemplate,
    slot: 'primary' | 'applicator',
    statusOverride?: EquipmentUnit['status'],
    speedOverride?: number
  ): EquipmentUnit => {
    const status: EquipmentUnit['status'] =
      statusOverride ?? (slot === 'primary' ? (parcel.healthPct >= 88 ? 'Working' : 'Online') : 'Working');
    const speedMph =
      status === 'Idle'
        ? 0
        : Number((speedOverride ?? tpl.defaultSpeedMph).toFixed(1));

    const rateAcresPerHr =
      speedMph > 0 ? computeAcresPerHour(tpl.implementWidthFt, speedMph, tpl.fieldEfficiency) : 0;

    // Realistic completion progress on this specific parcel
    const baseProgress = slot === 'primary' ? 0.32 + ((seed % 46) / 100) : 0.28 + (((seed >> 3) % 52) / 100);
    const areaCoveredAcres = Number((parcel.cultivatedAcres * baseProgress).toFixed(1));
    const remainingAcres = Math.max(0, parcel.cultivatedAcres - areaCoveredAcres);
    const etaHours = rateAcresPerHr > 0 ? Number((remainingAcres / rateAcresPerHr).toFixed(1)) : 0;

    // Fuel or Spray Tank % derived from remaining work & seed
    const levelPct =
      slot === 'primary'
        ? Math.max(24, Math.min(92, Math.round(88 - baseProgress * 42 + (seed % 9))))
        : Math.max(18, Math.min(88, Math.round(82 - baseProgress * 54 + ((seed >> 2) % 11))));

    const baseCurve =
      slot === 'primary'
        ? [0.34, 0.34, 0.78, 0.78, 0.52, 0.52, 0.88, 0.88, 0.72]
        : [0.74, 0.74, 0.42, 0.42, 0.84, 0.84, 0.46, 0.46, 0.68];

    const speedRatio = tpl.maxSpeedMph > 0 ? Math.min(1, speedMph / tpl.maxSpeedMph) : 0.5;
    const activitySteps =
      status === 'Idle'
        ? [0.35, 0.35, 0.5, 0.5, 0.25, 0.25, 0.08, 0.08, 0.08]
        : baseCurve.map((v, i) =>
            Number(Math.min(0.96, Math.max(0.14, v * (0.65 + speedRatio * 0.45) + ((seed + i) % 5) * 0.015)).toFixed(2))
          );

    const engineHours = Number((840 + (seed % 950) + (slot === 'primary' ? 320 : 0)).toFixed(1));

    return {
      id: `${slot}-${parcel.id}`,
      catalogId: tpl.catalogId,
      slot,
      name: tpl.shortName,
      model: tpl.model,
      kind: tpl.kind,
      status,
      connectivity: tpl.kind === 'aerial' ? 'ADS-B · SAT' : 'RTK · LTE',
      lastUpdated: `${parcel.county.split(',')[0]} · Live`,
      assignedParcelId: parcel.id,
      operator: tpl.operator,
      primaryMetricLabel: tpl.primaryMetricLabel,
      primaryMetricValue: `${levelPct}%`,
      areaCoveredAcres,
      speedMph,
      minSpeedMph: tpl.minSpeedMph,
      maxSpeedMph: tpl.maxSpeedMph,
      rateAcresPerHr,
      etaHours,
      tankCapacityGal: tpl.tankCapacityGal,
      shiftStart: slot === 'primary' ? '06 AM' : '07 AM',
      shiftEnd: slot === 'primary' ? '09 PM' : '06 PM',
      shiftProgress: Number(baseProgress.toFixed(2)),
      activitySteps,
      engineHours,
      implementWidthFt: tpl.implementWidthFt,
      currentTask: tpl.taskByCrop(parcel.crop, parcel.name),
    };
  };

  return [
    makeUnit(primaryTpl, 'primary', override?.primaryStatus, override?.primarySpeedMph),
    makeUnit(appTpl, 'applicator', override?.applicatorStatus, override?.applicatorSpeedMph),
  ];
}
