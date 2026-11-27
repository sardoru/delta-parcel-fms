import {
  CoverCropOption,
  CropHistoryEntry,
  Parcel,
  ParcelClaimRecord,
  ParcelCropProfile,
  ParcelDocument,
  ParcelDocumentCategory,
  TillagePractice,
} from '../types/farm';

export const PARCEL_CROPS_STORAGE_KEY = 'deltaplot_parcel_crops_v1';
export const PARCEL_DOCS_STORAGE_KEY = 'deltaplot_parcel_docs_v1';
export const PARCEL_CLAIMS_STORAGE_KEY = 'deltaplot_parcel_claims_v1';

export const CASH_CROP_OPTIONS: Parcel['crop'][] = [
  'Upland Cotton',
  'Soybeans',
  'Field Corn',
  'Grain Sorghum',
  'Winter Wheat Cover',
];

export const PREVIOUS_CROP_CHOICES: string[] = [
  'Upland Cotton',
  'Soybeans',
  'Field Corn',
  'Grain Sorghum',
  'Winter Wheat',
  'Rice',
  'Peanuts',
  'Cereal Rye (Cover)',
  'Crimson Clover (Cover)',
  'Tillage Radish + Oats (Cover)',
  'Fallow / CRP',
];

export const COVER_CROP_OPTIONS: {
  value: CoverCropOption;
  badge: string;
  benefit: string;
  color: string;
}[] = [
  {
    value: 'None (Stubble / Bare)',
    badge: 'None',
    benefit: 'Residue stubble only — no winter cover seeded',
    color: '#9ca396',
  },
  {
    value: 'Cereal Rye',
    badge: 'Cereal Rye',
    benefit: 'High-biomass weed suppression & erosion control',
    color: '#8fd469',
  },
  {
    value: 'Crimson Clover',
    badge: 'Crimson Clover',
    benefit: 'Fixes 70–110 lbs N/ac ahead of cotton or corn',
    color: '#d87bb0',
  },
  {
    value: 'Winter Wheat Cover',
    badge: 'Winter Wheat',
    benefit: 'Low-cost root anchoring & spring moisture balance',
    color: '#e6c563',
  },
  {
    value: 'Tillage Radish + Oats',
    badge: 'Radish + Oats',
    benefit: 'Breaks fragipan / compaction; winter-kills cleanly',
    color: '#6ec9b8',
  },
  {
    value: 'Hairy Vetch',
    badge: 'Hairy Vetch',
    benefit: 'Heavy legume nitrogen credit for upland cotton',
    color: '#9c8ce8',
  },
  {
    value: 'Austrian Winter Pea',
    badge: 'Winter Pea',
    benefit: 'Fast spring N release & soil organic matter boost',
    color: '#7cc78a',
  },
  {
    value: 'Black Oats + Clover Mix',
    badge: 'Oats + Clover',
    benefit: 'Balanced C:N ratio & nematode suppression',
    color: '#5ec8eb',
  },
];

export const TILLAGE_OPTIONS: TillagePractice[] = [
  'No-Till',
  'Strip-Till',
  'Bedded 38"',
  'Conventional',
];

export const DOCUMENT_CATEGORIES: {
  value: ParcelDocumentCategory;
  shortLabel: string;
  accent: string;
  examples: string;
}[] = [
  {
    value: 'Soil Test',
    shortLabel: 'Soil Test',
    accent: '#d8f274',
    examples: 'MSU Extension Soil Lab PDF, Waypoint grid CSV, lime/P/K map',
  },
  {
    value: 'Certification',
    shortLabel: 'Certification',
    accent: '#5ec8eb',
    examples: 'U.S. Cotton Trust Protocol, USDA Organic, RegenAg, Carbon Registry',
  },
  {
    value: 'FSA / USDA Form',
    shortLabel: 'FSA / USDA',
    accent: '#f0bb66',
    examples: 'FSA-578 Acreage Report, NRCS EQIP / CSP Contract, HEL Determination',
  },
  {
    value: 'Spray / Drone Record',
    shortLabel: 'Spray Log',
    accent: '#7cd8a0',
    examples: 'FAA Part 137 applicator log, Dicamba / burndown tank-mix sheet',
  },
  {
    value: 'Deed / Tax Roll',
    shortLabel: 'Deed / Tax',
    accent: '#c4a6f2',
    examples: 'Warranty deed, County tax receipt, farm lease / cash-rent agreement',
  },
  {
    value: 'Other',
    shortLabel: 'Other',
    accent: '#dce2d4',
    examples: 'Well permit, tile drainage map, cotton gin bale ticket',
  },
];

function hashSeed(input: string): number {
  let h = 2166136261;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h);
}

/**
 * Deterministic multi-season Cotton Belt baseline crop rotation & cover crop profile
 * so every parcel has realistic prior crops out-of-the-box and can be customized anytime.
 */
export function buildDefaultCropProfile(parcel: Parcel): ParcelCropProfile {
  const seed = hashSeed(parcel.id || parcel.parno);
  const coverChoices: CoverCropOption[] = [
    'Cereal Rye',
    'Crimson Clover',
    'Winter Wheat Cover',
    'Tillage Radish + Oats',
    'None (Stubble / Bare)',
    'Black Oats + Clover Mix',
  ];
  const coverCrop = coverChoices[seed % coverChoices.length];

  const rotations: CropHistoryEntry[][] = [
    [
      {
        id: `${parcel.id}-hist-2025c`,
        year: 2025,
        season: 'Fall/Winter Cover',
        crop: coverCrop === 'None (Stubble / Bare)' ? 'Winter Wheat' : coverCrop,
        tillage: 'No-Till',
        yieldNote: 'Seeded 45 lbs/ac · Terminated Apr 8',
      },
      {
        id: `${parcel.id}-hist-2025`,
        year: 2025,
        season: 'Main Crop',
        crop: parcel.crop === 'Upland Cotton' ? 'Soybeans' : 'Upland Cotton',
        variety: parcel.crop === 'Upland Cotton' ? 'Asgrow AG46X6' : 'Deltapine DP 2127 B3XF',
        tillage: 'Bedded 38"',
        yieldNote: parcel.crop === 'Upland Cotton' ? '61 bu/ac avg' : '1,185 lbs lint/ac',
      },
      {
        id: `${parcel.id}-hist-2024`,
        year: 2024,
        season: 'Main Crop',
        crop: 'Field Corn',
        variety: 'DeKalb DKC67-44 VT2P',
        tillage: 'Strip-Till',
        yieldNote: '198 bu/ac dryland/pivot',
      },
      {
        id: `${parcel.id}-hist-2023`,
        year: 2023,
        season: 'Main Crop',
        crop: 'Upland Cotton',
        variety: 'Stoneville ST 4595B3XF',
        tillage: 'Bedded 38"',
        yieldNote: '1,120 lbs lint/ac',
      },
    ],
    [
      {
        id: `${parcel.id}-hist-2025`,
        year: 2025,
        season: 'Main Crop',
        crop: 'Upland Cotton',
        variety: 'Phytogen PHY 411 W3FE',
        tillage: 'Bedded 38"',
        yieldNote: '1,210 lbs lint/ac',
      },
      {
        id: `${parcel.id}-hist-2024c`,
        year: 2024,
        season: 'Fall/Winter Cover',
        crop: 'Crimson Clover (Cover)',
        tillage: 'No-Till',
        yieldNote: '+85 lbs N/ac credit',
      },
      {
        id: `${parcel.id}-hist-2024`,
        year: 2024,
        season: 'Main Crop',
        crop: 'Soybeans',
        variety: 'Pioneer P48A60X',
        tillage: 'No-Till',
        yieldNote: '58 bu/ac avg',
      },
      {
        id: `${parcel.id}-hist-2023`,
        year: 2023,
        season: 'Main Crop',
        crop: 'Grain Sorghum',
        variety: 'DK S51-01',
        tillage: 'Strip-Till',
        yieldNote: '104 bu/ac',
      },
    ],
  ];

  return {
    parcelId: parcel.id,
    currentCrop: parcel.crop,
    currentVariety: parcel.variety,
    coverCrop,
    coverCropPlantedDate: coverCrop === 'None (Stubble / Bare)' ? undefined : 'Oct 28, 2026',
    coverCropTerminationTarget: coverCrop === 'None (Stubble / Bare)' ? undefined : 'Apr 5, 2027',
    previousCrops: rotations[seed % rotations.length],
    updatedAt: 'MARIS / Farm Baseline',
  };
}

export function loadStoredCropProfiles(): Record<string, ParcelCropProfile> {
  try {
    const raw = localStorage.getItem(PARCEL_CROPS_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

export function saveStoredCropProfiles(profiles: Record<string, ParcelCropProfile>): void {
  try {
    localStorage.setItem(PARCEL_CROPS_STORAGE_KEY, JSON.stringify(profiles));
  } catch {
    // ignore quota error
  }
}

export function loadStoredParcelDocuments(): ParcelDocument[] {
  try {
    const raw = localStorage.getItem(PARCEL_DOCS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveStoredParcelDocuments(docs: ParcelDocument[]): void {
  try {
    localStorage.setItem(PARCEL_DOCS_STORAGE_KEY, JSON.stringify(docs));
  } catch {
    // Retry without embedded dataUrl if quota exceeded
    try {
      const stripped = docs.map((d) => ({ ...d, dataUrl: undefined }));
      localStorage.setItem(PARCEL_DOCS_STORAGE_KEY, JSON.stringify(stripped));
    } catch {
      // ignore
    }
  }
}

export function loadStoredParcelClaims(): Record<string, ParcelClaimRecord> {
  try {
    const raw = localStorage.getItem(PARCEL_CLAIMS_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

export function saveStoredParcelClaims(claims: Record<string, ParcelClaimRecord>): void {
  try {
    localStorage.setItem(PARCEL_CLAIMS_STORAGE_KEY, JSON.stringify(claims));
  } catch {
    // ignore quota error
  }
}

export function generatePostcardPin(): string {
  const a = Math.floor(100 + Math.random() * 900);
  const b = Math.floor(100 + Math.random() * 900);
  return `${a}-${b}`;
}

export function generateUspsTrackingId(): string {
  const num = Math.floor(10000 + Math.random() * 89999);
  return `USPS-DP-${num}`;
}

export function computePostcardArrivalWindow(): string {
  const now = new Date();
  const minDate = new Date(now.getTime() + 7 * 86400_000);
  const maxDate = new Date(now.getTime() + 14 * 86400_000);
  const fmt = (d: Date) =>
    d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  return `${fmt(minDate)} – ${fmt(maxDate)} (7–14 days)`;
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function formatMailingLine(add1?: string, city?: string, zip?: string): string {
  const cleanAdd = String(add1 || '').replace(/\s+/g, ' ').trim();
  const cleanCity = String(city || '').replace(/\s+/g, ' ').trim();
  const cleanZip = String(zip || '').replace(/\s+/g, ' ').trim();
  if (!cleanAdd && !cleanCity) return '';
  const parts = [cleanAdd, [cleanCity, cleanZip].filter(Boolean).join(' ')].filter(Boolean);
  return parts.join(', ');
}

/**
 * Live lookup of the official County Tax Assessor Owner Mailing Address from MS MARIS 2024.
 * Falls back cleanly to cached parcel mailing address or County Assessor tax roll record.
 */
export async function fetchTaxAssessorMailingAddress(parcel: Parcel): Promise<{
  ownerName: string;
  mailingAddress: string;
  source: ParcelClaimRecord['taxAddressSource'];
}> {
  if (parcel.ownerMailingAddress && parcel.ownerMailingAddress.trim().length > 6) {
    return {
      ownerName: parcel.ownerName,
      mailingAddress: parcel.ownerMailingAddress,
      source: 'County GIS Cadastral',
    };
  }

  const isMs =
    parcel.county.includes(', MS') ||
    parcel.cityState.includes(', MS') ||
    parcel.source === 'MARIS 2024' ||
    parcel.source === 'MARIS Live';

  if (isMs && parcel.parno && !parcel.parno.startsWith('CUSTOM')) {
    const layerId = parcel.center.lng < -89.65 ? 1 : 2;
    const escapedParno = parcel.parno.replace(/'/g, "''");
    const params = new URLSearchParams({
      where: `PARNO='${escapedParno}'`,
      outFields: 'PARNO,OWNNAME,MAILADD1,MCITY1,MZIP1,MAILADD2,MCITY2,MZIP2,SITEADD,SCITY,SZIP,CNTYNAME',
      returnGeometry: 'false',
      f: 'json',
    });
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 7000);
      const res = await fetch(
        `https://gis.mississippi.edu/server/rest/services/Cadastral/MS_Parcels_August_2024/MapServer/${layerId}/query?${params.toString()}`,
        { signal: controller.signal }
      );
      clearTimeout(timer);
      if (res.ok) {
        const json = (await res.json()) as {
          features?: { attributes?: Record<string, string | null | undefined> }[];
        };
        const attr = json.features?.[0]?.attributes;
        if (attr) {
          const mail1 = formatMailingLine(
            attr.MAILADD1 ?? undefined,
            attr.MCITY1 ?? undefined,
            attr.MZIP1 ?? undefined
          );
          const mail2 = formatMailingLine(
            attr.MAILADD2 ?? undefined,
            attr.MCITY2 ?? undefined,
            attr.MZIP2 ?? undefined
          );
          const bestMail = mail1 || mail2;
          if (bestMail) {
            return {
              ownerName: parcel.ownerName,
              mailingAddress: bestMail,
              source: 'MARIS Tax Roll Live',
            };
          }
        }
      }
    } catch {
      // fall through to cadastral fallback
    }
  }

  const fallbackAddr =
    parcel.siteAddress && !parcel.siteAddress.startsWith('0 ')
      ? `${parcel.siteAddress}, ${parcel.cityState}`
      : `c/o ${parcel.county.split(',')[0]} Tax Assessor Roll · ${parcel.cityState} (PARNO ${parcel.parno})`;

  return {
    ownerName: parcel.ownerName,
    mailingAddress: fallbackAddr,
    source: 'Assessor Parcel Record',
  };
}
