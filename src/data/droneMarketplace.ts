import { Parcel } from '../types/farm';

export type VendorTier = 'approved' | 'priority' | 'exclusive';

export interface DroneTerritory {
  id: string;
  name: string;
  state: string;
  cultivatedAcresEst: number;
  exclusiveMonthlyUsd: number;
  claimedByVendorId?: string;
}

export interface DroneSprayVendor {
  id: string;
  companyName: string;
  faaPart137Cert: string;
  tier: VendorTier;
  regionLabel: string;
  states: string[];
  territoryIds: string[];
  exclusiveTerritoryId?: string;
  droneFleet: string;
  swarmCount: number;
  maxAcresPerDay: number;
  baseRatePerAcreUsd: number;
  rating: number;
  completedAcres: number;
  responseSla: string;
  services: string[];
  phone: string;
  email: string;
  verifiedDate: string;
}

export interface VendorBidQuote {
  vendorId: string;
  vendorName: string;
  tier: VendorTier;
  ratePerAcreUsd: number;
  totalUsd: number;
  estimatedFlightHours: number;
  earliestWindow: string;
  fleetAssigned: string;
  status: 'Quoted' | 'Awarded';
}

export interface DroneRfqRecord {
  id: string;
  createdAt: string;
  parcelIds: string[];
  parcelNames: string[];
  totalAcres: number;
  applicationType: string;
  carrierGpa: string;
  targetWindow: string;
  notes: string;
  territoryLabel: string;
  quotes: VendorBidQuote[];
  awardedVendorId?: string;
}

export const DRONE_TERRITORIES: DroneTerritory[] = [
  {
    id: 'ms-noxubee-blackbelt',
    name: 'Noxubee / Bogue Chitto Black Belt (Macon, MS)',
    state: 'MS',
    cultivatedAcresEst: 118500,
    exclusiveMonthlyUsd: 1250,
    claimedByVendorId: 'vnd-blackbelt-aero',
  },
  {
    id: 'ms-panola-northdelta',
    name: 'Panola / Como North Delta (Como, MS)',
    state: 'MS',
    cultivatedAcresEst: 142000,
    exclusiveMonthlyUsd: 1350,
    claimedByVendorId: 'vnd-delta-swarm',
  },
  {
    id: 'ms-coahoma-leflore',
    name: 'Coahoma / Leflore Central Delta (Clarksdale–Greenwood, MS)',
    state: 'MS',
    cultivatedAcresEst: 315000,
    exclusiveMonthlyUsd: 1850,
  },
  {
    id: 'ms-yazoo-washington',
    name: 'Washington / Yazoo South Delta (Greenville–Yazoo City, MS)',
    state: 'MS',
    cultivatedAcresEst: 288000,
    exclusiveMonthlyUsd: 1750,
  },
  {
    id: 'ar-crittenden-east',
    name: 'Crittenden / Mississippi Co. East AR Delta (West Memphis–Blytheville, AR)',
    state: 'AR',
    cultivatedAcresEst: 342000,
    exclusiveMonthlyUsd: 1900,
    claimedByVendorId: 'vnd-midsouth-agras',
  },
  {
    id: 'ar-lincoln-desha',
    name: 'Lincoln / Desha Southeast AR (Gould–Dumas, AR)',
    state: 'AR',
    cultivatedAcresEst: 196000,
    exclusiveMonthlyUsd: 1450,
  },
  {
    id: 'tx-lubbock-highplains',
    name: 'Lubbock / South Plains Cotton Belt (TX)',
    state: 'TX',
    cultivatedAcresEst: 520000,
    exclusiveMonthlyUsd: 2400,
  },
  {
    id: 'nc-coastal-plain',
    name: 'Albemarle / Coastal Plain Cotton Belt (Edenton–Wilson, NC)',
    state: 'NC',
    cultivatedAcresEst: 164000,
    exclusiveMonthlyUsd: 1350,
  },
];

export const INITIAL_DRONE_VENDORS: DroneSprayVendor[] = [
  {
    id: 'vnd-blackbelt-aero',
    companyName: 'Black Belt Precision UAV LLC',
    faaPart137Cert: 'FAA-137-MS-4821',
    tier: 'exclusive',
    regionLabel: 'Noxubee & East MS Prairie',
    states: ['MS', 'AL'],
    territoryIds: ['ms-noxubee-blackbelt', 'ms-coahoma-leflore'],
    exclusiveTerritoryId: 'ms-noxubee-blackbelt',
    droneFleet: '6× DJI Agras T50 (10.6 gal) + Tender Trailer',
    swarmCount: 6,
    maxAcresPerDay: 960,
    baseRatePerAcreUsd: 13.5,
    rating: 4.9,
    completedAcres: 42800,
    responseSla: '< 2 hrs',
    services: ['Cotton Defoliant', 'Fungicide', 'Spot Herbicide', 'Cover Seeding'],
    phone: '662-726-4418',
    email: 'dispatch@blackbeltuav.com',
    verifiedDate: 'Verified 2026',
  },
  {
    id: 'vnd-delta-swarm',
    companyName: 'Delta Swarm Ag Drones',
    faaPart137Cert: 'FAA-137-MS-7104',
    tier: 'exclusive',
    regionLabel: 'Panola & North MS Delta',
    states: ['MS', 'TN', 'AR'],
    territoryIds: ['ms-panola-northdelta', 'ms-coahoma-leflore', 'ar-crittenden-east'],
    exclusiveTerritoryId: 'ms-panola-northdelta',
    droneFleet: '4× Hylio AG-272 (18 gal) + 4× DJI Agras T50',
    swarmCount: 8,
    maxAcresPerDay: 1240,
    baseRatePerAcreUsd: 12.75,
    rating: 4.8,
    completedAcres: 68400,
    responseSla: '< 90 min',
    services: ['Cotton Defoliant', 'Desiccant', 'Fungicide', 'Insecticide'],
    phone: '662-526-8820',
    email: 'bids@deltaswarmag.com',
    verifiedDate: 'Verified 2026',
  },
  {
    id: 'vnd-midsouth-agras',
    companyName: 'Mid-South Agras Applicators',
    faaPart137Cert: 'FAA-137-AR-3392',
    tier: 'exclusive',
    regionLabel: 'East Arkansas & West Memphis Delta',
    states: ['AR', 'MS', 'TN', 'MO'],
    territoryIds: ['ar-crittenden-east', 'ar-lincoln-desha', 'ms-panola-northdelta'],
    exclusiveTerritoryId: 'ar-crittenden-east',
    droneFleet: '5× DJI Agras T50 + 2× XAG P100 Pro',
    swarmCount: 7,
    maxAcresPerDay: 1080,
    baseRatePerAcreUsd: 12.25,
    rating: 4.9,
    completedAcres: 54120,
    responseSla: '< 2 hrs',
    services: ['Cotton Defoliant', 'Rice & Soy Fungicide', 'Burndown', 'Cover Seeding'],
    phone: '870-735-9140',
    email: 'ops@midsouthagras.com',
    verifiedDate: 'Verified 2026',
  },
  {
    id: 'vnd-prairie-sky',
    companyName: 'Prairie Sky Rotorcraft & UAV',
    faaPart137Cert: 'FAA-137-MS-5910',
    tier: 'priority',
    regionLabel: 'Mississippi & West Alabama',
    states: ['MS', 'AL', 'AR'],
    territoryIds: ['ms-noxubee-blackbelt', 'ms-yazoo-washington', 'ms-coahoma-leflore'],
    droneFleet: '4× DJI Agras T50 (RTK Swath Sync)',
    swarmCount: 4,
    maxAcresPerDay: 680,
    baseRatePerAcreUsd: 14.25,
    rating: 4.7,
    completedAcres: 23900,
    responseSla: '< 4 hrs',
    services: ['Cotton Defoliant', 'Fungicide', 'Wet-Field Rescue', 'Edge Trim'],
    phone: '662-327-1904',
    email: 'quotes@prairieskyuav.com',
    verifiedDate: 'Verified 2026',
  },
  {
    id: 'vnd-yazoo-canopy',
    companyName: 'Yazoo Canopy Drone Services',
    faaPart137Cert: 'FAA-137-MS-6208',
    tier: 'approved',
    regionLabel: 'All Mississippi Delta Counties',
    states: ['MS', 'LA', 'AR'],
    territoryIds: ['ms-yazoo-washington', 'ms-noxubee-blackbelt', 'ms-panola-northdelta', 'ar-lincoln-desha'],
    droneFleet: '3× DJI Agras T40 + 2× Agras T50',
    swarmCount: 5,
    maxAcresPerDay: 720,
    baseRatePerAcreUsd: 11.95,
    rating: 4.6,
    completedAcres: 19450,
    responseSla: '< 6 hrs',
    services: ['Spot Herbicide', 'Cotton Defoliant', 'Fungicide', 'Cover Seeding'],
    phone: '662-746-3312',
    email: 'service@yazoocanopy.com',
    verifiedDate: 'Verified 2026',
  },
  {
    id: 'vnd-caprock-swarm',
    companyName: 'Caprock AgDrone Cooperative',
    faaPart137Cert: 'FAA-137-TX-8841',
    tier: 'priority',
    regionLabel: 'Texas High Plains & Coastal Bend',
    states: ['TX', 'OK', 'NM'],
    territoryIds: ['tx-lubbock-highplains'],
    droneFleet: '6× Hylio AG-272 High-Wind Swarms',
    swarmCount: 6,
    maxAcresPerDay: 1120,
    baseRatePerAcreUsd: 11.5,
    rating: 4.8,
    completedAcres: 77300,
    responseSla: '< 3 hrs',
    services: ['Cotton Defoliant', 'Boll Weevil Spot', 'Herbicide', 'Foliar Feed'],
    phone: '806-744-2910',
    email: 'dispatch@caprockagdrone.com',
    verifiedDate: 'Verified 2026',
  },
  {
    id: 'vnd-carolina-ag-uav',
    companyName: 'Carolina Coastal AgUAV',
    faaPart137Cert: 'FAA-137-NC-2219',
    tier: 'approved',
    regionLabel: 'NC / SC / VA Cotton Belt',
    states: ['NC', 'SC', 'VA', 'GA'],
    territoryIds: ['nc-coastal-plain'],
    droneFleet: '4× DJI Agras T50 (Dual Atomizing)',
    swarmCount: 4,
    maxAcresPerDay: 640,
    baseRatePerAcreUsd: 14.5,
    rating: 4.7,
    completedAcres: 18900,
    responseSla: '< 4 hrs',
    services: ['Cotton Defoliant', 'Fungicide', 'Plant Growth Regulator'],
    phone: '252-482-7703',
    email: 'fly@carolinaaguav.com',
    verifiedDate: 'Verified 2026',
  },
];

export const VENDOR_MEMBERSHIP_PLANS = [
  {
    id: 'approved' as VendorTier,
    name: 'Approved Regional Vendor',
    priceMonthlyUsd: 199,
    badge: 'Verified FAA Part 137',
    perks: [
      'Listed as Approved Vendor across up to 3 territories',
      'Receive multi-parcel farmer bid RFQs with GIS acreage',
      'Direct quote submission & bid award tracking',
    ],
  },
  {
    id: 'priority' as VendorTier,
    name: 'Priority Territory Partner',
    priceMonthlyUsd: 499,
    badge: 'Top-3 Pinned + Instant Alerts',
    perks: [
      'Pinned above standard listings across up to 6 territories',
      'Instant SMS/API dispatch alerts on >150 ac RFQs',
      'Access to parcel NDVI stress & wet-field rescue leads',
    ],
  },
  {
    id: 'exclusive' as VendorTier,
    name: 'Exclusive Territory Claim',
    priceMonthlyUsd: 1250,
    badge: '#1 Exclusive County Sponsor',
    perks: [
      'Exclusive #1 sponsored lock on your claimed county / gin shed',
      'First-look 2-hour bidding window on every RFQ in territory',
      'Featured Exclusive Territory badge & guaranteed top placement',
    ],
  },
];

export function inferTerritoryForParcel(parcel: Parcel): string {
  const cnty = parcel.county.toUpperCase();
  if (cnty.includes('NOXUBEE')) return 'ms-noxubee-blackbelt';
  if (cnty.includes('PANOLA')) return 'ms-panola-northdelta';
  if (cnty.includes('CRITTENDEN') || cnty.includes('MISSISSIPPI COUNTY, AR')) return 'ar-crittenden-east';
  if (cnty.includes('LINCOLN') || cnty.includes('DESHA')) return 'ar-lincoln-desha';
  if (cnty.includes(', AR')) return 'ar-crittenden-east';
  if (cnty.includes(', TX')) return 'tx-lubbock-highplains';
  if (cnty.includes(', NC')) return 'nc-coastal-plain';
  if (cnty.includes('YAZOO') || cnty.includes('WASHINGTON')) return 'ms-yazoo-washington';
  return 'ms-coahoma-leflore';
}

export function generateCompetitiveQuotes(
  vendors: DroneSprayVendor[],
  totalAcres: number,
  carrierGpa: string,
  targetWindow: string
): VendorBidQuote[] {
  const volumeDiscount = totalAcres >= 500 ? 0.91 : totalAcres >= 200 ? 0.95 : 1.0;
  const gpaFactor = carrierGpa.includes('5 GPA') ? 1.14 : carrierGpa.includes('3 GPA') ? 1.06 : 1.0;
  const rushFactor = targetWindow.includes('48') ? 1.05 : 1.0;

  return vendors.map((v, idx) => {
    const rate = Number(
      (v.baseRatePerAcreUsd * volumeDiscount * gpaFactor * rushFactor * (0.97 + (idx % 3) * 0.03)).toFixed(2)
    );
    const totalUsd = Math.round(rate * totalAcres);
    const acresPerHr = Math.max(25, v.maxAcresPerDay / 9);
    const estHours = Number(Math.max(0.5, totalAcres / acresPerHr).toFixed(1));
    const windows = ['Tomorrow 06:30 AM', 'Tomorrow 01:00 PM', 'In 2 Days · Dawn Window', 'This Week · Low Wind'];
    return {
      vendorId: v.id,
      vendorName: v.companyName,
      tier: v.tier,
      ratePerAcreUsd: rate,
      totalUsd,
      estimatedFlightHours: estHours,
      earliestWindow: v.tier === 'exclusive' ? 'Tomorrow 06:15 AM (Priority Slot)' : windows[idx % windows.length],
      fleetAssigned: v.droneFleet,
      status: 'Quoted',
    };
  });
}
