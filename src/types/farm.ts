export type MapLayer = 'satellite' | 'ndvi' | 'soil';
export type AreaUnit = 'ac' | 'ha';
export type TimeframeKey = '7d' | '14d' | '30d';
export type RegionId = 'macon' | 'como';

export interface RegionLandmark {
  name: string;
  subtitle: string;
  address: string;
  lng: number;
  lat: number;
}

export interface RegionConfig {
  id: RegionId;
  shortLabel: string;
  title: string;
  countyLabel: string;
  fips: string;
  zip: string;
  soilRegionLabel: string;
  geojsonUrl: string;
  marisLayerId: 1 | 2;
  defaultParcelId: string;
  weatherLat: number;
  weatherLng: number;
  defaultCenter: [number, number];
  landmark?: RegionLandmark;
  soilLegend: { name: string; color: string }[];
}

export interface LngLat {
  lng: number;
  lat: number;
}

export type GeoGeometry =
  | { type: 'Polygon'; coordinates: number[][][] }
  | { type: 'MultiPolygon'; coordinates: number[][][][] };

export interface StressCell {
  row: number;
  col: number;
  /** 0 = healthy lush lime/green, 1 = severe stress coral/red */
  severity: number;
  moisturePct: number;
  ndvi: number;
  note: string;
}

export interface IrrigationZoneOffset {
  id: string;
  label: string;
  zoneGroup: 'Zone A' | 'Zone B';
  offsetMin: number;
  valveType: string;
  flowGpm: number;
}

export interface FieldLogEntry {
  id: string;
  date: string;
  category: 'Scouting' | 'Irrigation' | 'Application' | 'Harvest' | 'Soil Sample';
  title: string;
  operator: string;
  detail: string;
}

export interface AIInsightItem {
  id: string;
  priority: 'high' | 'medium' | 'positive';
  title: string;
  action: string;
  impact: string;
  msuRef: string;
}

export interface RawMarisProperties {
  parno: string;
  taxmap: string;
  section: string;
  twsp: string;
  range: string;
  siteadd: string;
  szip: string;
  ownname?: string;
  mailadd?: string;
  mailcity?: string;
  mailzip?: string;
  stateCode?: string;
  gisAcres: number;
  taxAcres: number;
  cultAcres: number;
  uncultAcres: number;
  legldesc: string;
  cntyname: string;
  lat: number;
  lng: number;
  taxyear: string;
  landVal: number;
  totVal: number;
}

export type CoverCropOption =
  | 'None (Stubble / Bare)'
  | 'Cereal Rye'
  | 'Crimson Clover'
  | 'Winter Wheat Cover'
  | 'Tillage Radish + Oats'
  | 'Hairy Vetch'
  | 'Austrian Winter Pea'
  | 'Black Oats + Clover Mix';

export type TillagePractice = 'No-Till' | 'Strip-Till' | 'Bedded 38"' | 'Conventional';

export interface CropHistoryEntry {
  id: string;
  year: number;
  season: 'Main Crop' | 'Fall/Winter Cover' | 'Double-Crop';
  crop: string;
  variety?: string;
  yieldNote?: string;
  tillage?: TillagePractice;
}

export interface ParcelCropProfile {
  parcelId: string;
  currentCrop: Parcel['crop'];
  currentVariety?: string;
  coverCrop: CoverCropOption;
  coverCropPlantedDate?: string;
  coverCropTerminationTarget?: string;
  previousCrops: CropHistoryEntry[];
  updatedAt: string;
}

export type ParcelDocumentCategory =
  | 'Soil Test'
  | 'Certification'
  | 'FSA / USDA Form'
  | 'Spray / Drone Record'
  | 'Deed / Tax Roll'
  | 'Other';

export interface SoilTestMetrics {
  ph?: number;
  organicMatterPct?: number;
  nitrogenLbsAc?: number;
  phosphorusPpm?: number;
  potassiumPpm?: number;
  cec?: number;
}

export interface ParcelDocument {
  id: string;
  parcelId: string;
  parcelName: string;
  category: ParcelDocumentCategory;
  title: string;
  fileName: string;
  fileType: string;
  fileSizeBytes: number;
  uploadedAt: string;
  issuerOrLab?: string;
  expiresAt?: string;
  status: 'Verified' | 'Active' | 'Pending Review';
  notes?: string;
  soilMetrics?: SoilTestMetrics;
  dataUrl?: string;
}

export type ParcelClaimStatus = 'unclaimed' | 'postcard_mailed' | 'verified';

export interface ParcelClaimRecord {
  parcelId: string;
  parcelName: string;
  parno: string;
  county: string;
  areaAcres: number;
  crop: string;
  taxAssessorOwner: string;
  taxMailingAddress: string;
  taxAddressSource: 'MARIS Tax Roll Live' | 'County GIS Cadastral' | 'Assessor Parcel Record';
  farmEntityName: string;
  claimantName: string;
  claimantEmail: string;
  claimantPhone: string;
  status: Exclude<ParcelClaimStatus, 'unclaimed'>;
  postcardPin: string;
  trackingNumber: string;
  requestedAt: string;
  estimatedArrivalWindow: string;
  verifiedAt?: string;
}

export type ParcelDetailTab = 'overview' | 'crops' | 'documents' | 'claim';

export interface Parcel {
  id: string;
  name: string;
  parno: string;
  fsaTract: string;
  ownerName: string;
  ownerMailingAddress?: string;
  county: string;
  cityState: string;
  siteAddress: string;
  plss: string;
  legalDesc: string;
  taxYear: string;
  landValueUsd: number;
  source: 'MARIS 2024' | 'MARIS Live' | 'AR GIS Live' | 'TX StratMap' | 'NC OneMap' | 'User Surveyed';
  crop: 'Soybeans' | 'Upland Cotton' | 'Field Corn' | 'Grain Sorghum' | 'Winter Wheat Cover';
  variety: string;
  areaAcres: number;
  cultivatedAcres: number;
  uncultivatedAcres: number;
  healthPct: number;
  healthDeltaPct: number;
  statusBadge: string;
  yieldProjectionPct: number;
  avgHumidityPct: number;
  humidityMin: number;
  humidityMax: number;
  avgTempF: number;
  tempMinF: number;
  tempMaxF: number;
  soilSeries: string;
  soilColor: string;
  soilPh: number;
  soilCec: number;
  drainageClass: string;
  irrigationMethod: string;
  plantingDate: string;
  ndviMean: number;
  center: LngLat;
  bbox: [number, number, number, number]; // [minLng, minLat, maxLng, maxLat]
  geometry: GeoGeometry;
  distanceToLandmarkMiles?: number;
  landmarkName?: string;
  healthTrend: Record<TimeframeKey, { label: string; score: number; ndvi: number; baseline: number }[]>;
  stressGrid: StressCell[];
  irrigationOffsets: IrrigationZoneOffset[];
  liveYieldLbs: number;
  yieldUnitLabel: string;
  yieldBars: number[];
  aiInsights: AIInsightItem[];
  logs: FieldLogEntry[];
}

export interface EquipmentUnit {
  id: string;
  catalogId?: string;
  slot?: 'primary' | 'applicator';
  name: string;
  model: string;
  kind: 'tractor' | 'sprayer' | 'combine' | 'picker' | 'aerial';
  status: 'Online' | 'Working' | 'Idle';
  connectivity: string;
  lastUpdated: string;
  assignedParcelId: string;
  operator: string;
  primaryMetricLabel: string;
  primaryMetricValue: string;
  areaCoveredAcres: number;
  speedMph: number;
  minSpeedMph?: number;
  maxSpeedMph?: number;
  rateAcresPerHr?: number;
  etaHours?: number;
  tankCapacityGal?: number;
  shiftStart: string;
  shiftEnd: string;
  shiftProgress: number;
  activitySteps: number[];
  engineHours: number;
  implementWidthFt: number;
  currentTask: string;
}

export interface DeltaAlert {
  id: string;
  severity: 'warn' | 'info' | 'ok';
  time: string;
  title: string;
  detail: string;
  parcelId?: string;
}

export interface CottonFacility {
  id: string;
  kind: 'gin' | 'warehouse';
  name: string;
  code: string;
  address: string;
  city: string;
  county: string;
  state: string;
  zip: string;
  lat: number;
  lng: number;
  estBales2024?: number | null;
  countyProduction2024?: number | null;
  countyAcres2024?: number | null;
  countyYield2024?: number | null;
  capacityBales?: number | null;
  deliveryPoint?: string;
  detail?: string;
  contact?: string;
  email?: string;
  phone?: string;
  iceLicensed?: boolean;
  coordPrecision?: 'rooftop' | 'facility' | 'city_zip';
  coordSource?: string;
}

export interface LiveWeather {
  tempF: number;
  windMph: number;
  windDir: string;
  humidityPct: number;
  condition: string;
  isLive: boolean;
}
