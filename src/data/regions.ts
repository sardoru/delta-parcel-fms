import { RegionConfig, RegionId } from '../types/farm';

export const MS_REGIONS: Record<RegionId, RegionConfig> = {
  macon: {
    id: 'macon',
    shortLabel: 'Macon · Bogue Chitto',
    title: 'Bogue Chitto Gin · Macon, MS',
    countyLabel: 'Noxubee County, MS',
    fips: '28103',
    zip: '39341',
    soilRegionLabel: 'Black Belt NRCS Soil',
    geojsonUrl: '/data/bogue-chitto-macon-parcels.geojson',
    marisLayerId: 2, // MS_East_MDEQPARCELS_2024
    defaultParcelId: 'macon-139--28-001.00',
    weatherLat: 33.2158,
    weatherLng: -88.4661,
    defaultCenter: [-88.461, 33.2135],
    landmark: {
      name: 'Bogue Chitto Gin',
      subtitle: 'Cotton Gin & Module Yard',
      address: '4762 Deerbrook Rd, Macon, MS 39341',
      lng: -88.46609,
      lat: 33.21582,
    },
    soilLegend: [
      { name: 'Brooksville Silty Clay', color: '#7ea674' },
      { name: 'Okolona Silty Clay', color: '#648f78' },
      { name: 'Leeper Silty Clay Loam', color: '#5c8f92' },
      { name: 'Vaiden Clay', color: '#a38d62' },
    ],
  },
  como: {
    id: 'como',
    shortLabel: 'Como · Panola',
    title: 'Como, MS Farm Management',
    countyLabel: 'Panola County, MS',
    fips: '28107',
    zip: '38619',
    soilRegionLabel: 'Panola NRCS Soil',
    geojsonUrl: '/data/como-ms-parcels.geojson',
    marisLayerId: 1, // MS_West_MDEQPARCELS_2024
    defaultParcelId: 'como-1039-3200000-0000100',
    weatherLat: 34.5101,
    weatherLng: -89.9401,
    defaultCenter: [-89.9565, 34.5125],
    soilLegend: [
      { name: 'Memphis Silt Loam', color: '#9bb36e' },
      { name: 'Loring Silt Loam', color: '#a89a67' },
      { name: 'Collins Silt Loam', color: '#6ca67e' },
      { name: 'Falaya Silt Loam', color: '#668f8b' },
    ],
  },
};
