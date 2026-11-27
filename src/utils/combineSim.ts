import { GeoGeometry, LngLat, Parcel } from '../types/farm';

export interface Vec2 {
  x: number; // East meters relative to parcel center
  z: number; // North meters relative to parcel center
}

export interface CombineWaypoint {
  id: number;
  x: number;
  z: number;
  label: string;
}

export interface FieldProjection {
  originLat: number;
  originLng: number;
  metersPerDegLat: number;
  metersPerDegLng: number;
  polygon: Vec2[];
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
  widthM: number;
  heightM: number;
}

export interface HarvestGrid {
  cellSizeM: number;
  cols: number;
  rows: number;
  minX: number;
  minZ: number;
  /** 0 = outside parcel, 1 = standing crop, 2 = harvested stubble */
  cells: Uint8Array;
  /** Yield multiplier 0.72..1.24 derived from parcel stressGrid */
  yieldMap: Float32Array;
  totalCropCells: number;
  harvestedCells: number;
}

export interface CombineState {
  x: number;
  z: number;
  /** Radians: 0 = North (+Z), +PI/2 = East (+X) */
  heading: number;
  /** Ground speed in m/s (negative = reverse) */
  speedMs: number;
  /** Commanded hydrostatic lever in [-0.35, 1.0] */
  throttle: number;
  /** Rear-wheel steering angle in radians [-0.62, +0.62] (positive turns right) */
  steerAngle: number;
  /** Steering wheel visual rotation in degrees [-540, +540] */
  wheelDeg: number;
  engineRpm: number;
  engineLoadPct: number;
  separatorOn: boolean;
  headerDown: boolean;
  /** Physical header height in inches (4 = cutting, 44 = raised transport) */
  headerHeightIn: number;
  reelPhase: number;
  reelRpm: number;
  rotorRpm: number;
  concaveMm: number;
  fanRpm: number;
  grainTankPct: number;
  grainTankUnits: number; // bu or lbs depending on crop
  unloadingAugerOn: boolean;
  fuelPct: number;
  defPct: number;
  coolantF: number;
  shoeLossPct: number;
  rotorLossPct: number;
  liveYieldRate: number; // bu/ac or lbs/ac
  moisturePct: number;
  harvestedAcres: number;
  inCrop: boolean;
  activelyCutting: boolean;
  autopilotOn: boolean;
  activeWaypointIdx: number;
  xteInches: number;
  distToWaypointFt: number;
  autopilotStatus: string;
  workLightsOn: boolean;
  beaconPhase: number;
  wiperOn: boolean;
  wiperPhase: number;
  duskMode: boolean;
}

export const HEADER_WIDTH_M = 12.2; // 40-ft draper / cotton header
export const WHEELBASE_M = 3.85;
export const MAX_STEER_RAD = 0.62;
export const MS_TO_MPH = 2.236936;
export const M_TO_FT = 3.28084;
export const SQM_TO_ACRES = 1 / 4046.8564224;

export function extractOuterRing(geometry: GeoGeometry): number[][] {
  if (geometry.type === 'Polygon') {
    return geometry.coordinates[0] || [];
  }
  // MultiPolygon: pick largest ring by vertex count / span
  let best: number[][] = [];
  for (const poly of geometry.coordinates) {
    const ring = poly[0] || [];
    if (ring.length > best.length) best = ring;
  }
  return best;
}

export function buildFieldProjection(parcel: Parcel): FieldProjection {
  const originLat = parcel.center.lat;
  const originLng = parcel.center.lng;
  const metersPerDegLat = 111132.92;
  const metersPerDegLng = 111319.49 * Math.cos((originLat * Math.PI) / 180);

  const ring = extractOuterRing(parcel.geometry);
  const polygon: Vec2[] = ring.map(([lng, lat]) => ({
    x: (lng - originLng) * metersPerDegLng,
    z: (lat - originLat) * metersPerDegLat,
  }));

  let minX = Infinity;
  let maxX = -Infinity;
  let minZ = Infinity;
  let maxZ = -Infinity;
  for (const pt of polygon) {
    if (pt.x < minX) minX = pt.x;
    if (pt.x > maxX) maxX = pt.x;
    if (pt.z < minZ) minZ = pt.z;
    if (pt.z > maxZ) maxZ = pt.z;
  }

  if (!Number.isFinite(minX) || polygon.length < 3) {
    minX = -220;
    maxX = 220;
    minZ = -180;
    maxZ = 180;
  }

  return {
    originLat,
    originLng,
    metersPerDegLat,
    metersPerDegLng,
    polygon,
    minX,
    maxX,
    minZ,
    maxZ,
    widthM: Math.max(40, maxX - minX),
    heightM: Math.max(40, maxZ - minZ),
  };
}

export function localToLngLat(proj: FieldProjection, x: number, z: number): LngLat {
  return {
    lng: proj.originLng + x / proj.metersPerDegLng,
    lat: proj.originLat + z / proj.metersPerDegLat,
  };
}

export function pointInPolygon(x: number, z: number, poly: Vec2[]): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const xi = poly[i].x;
    const zi = poly[i].z;
    const xj = poly[j].x;
    const zj = poly[j].z;
    const intersect = zi > z !== zj > z && x < ((xj - xi) * (z - zi)) / (zj - zi + 1e-9) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

export function buildHarvestGrid(proj: FieldProjection, parcel: Parcel): HarvestGrid {
  const pad = 28;
  const minX = proj.minX - pad;
  const minZ = proj.minZ - pad;
  const spanX = proj.widthM + pad * 2;
  const spanZ = proj.heightM + pad * 2;
  // Adaptive cell size so huge 600-ac parcels stay super snappy at 60fps
  const cellSizeM = Math.max(4, Math.min(10, Math.ceil(Math.max(spanX, spanZ) / 140)));
  const cols = Math.ceil(spanX / cellSizeM);
  const rows = Math.ceil(spanZ / cellSizeM);
  const cells = new Uint8Array(cols * rows);
  const yieldMap = new Float32Array(cols * rows);

  let totalCropCells = 0;
  for (let r = 0; r < rows; r++) {
    const wz = minZ + (r + 0.5) * cellSizeM;
    const ny = Math.max(0, Math.min(0.999, (wz - proj.minZ) / proj.heightM));
    const stressRow = Math.min(6, Math.floor((1 - ny) * 7));
    for (let c = 0; c < cols; c++) {
      const wx = minX + (c + 0.5) * cellSizeM;
      const idx = r * cols + c;
      if (pointInPolygon(wx, wz, proj.polygon)) {
        cells[idx] = 1;
        totalCropCells++;
        const nx = Math.max(0, Math.min(0.999, (wx - proj.minX) / proj.widthM));
        const stressCol = Math.min(13, Math.floor(nx * 14));
        const sc = parcel.stressGrid[stressRow * 14 + stressCol];
        const sev = sc ? sc.severity : 0.25;
        // Healthier zones yield higher
        yieldMap[idx] = 1.18 - sev * 0.42;
      } else {
        cells[idx] = 0;
        yieldMap[idx] = 0;
      }
    }
  }

  return {
    cellSizeM,
    cols,
    rows,
    minX,
    minZ,
    cells,
    yieldMap,
    totalCropCells,
    harvestedCells: 0,
  };
}

export function sampleGridCell(grid: HarvestGrid, x: number, z: number): { state: number; yieldFactor: number } {
  const c = Math.floor((x - grid.minX) / grid.cellSizeM);
  const r = Math.floor((z - grid.minZ) / grid.cellSizeM);
  if (c < 0 || c >= grid.cols || r < 0 || r >= grid.rows) {
    return { state: 0, yieldFactor: 0 };
  }
  const idx = r * grid.cols + c;
  return { state: grid.cells[idx], yieldFactor: grid.yieldMap[idx] };
}

/** Generate clean parallel AutoTrac AB swath waypoints clipped inside the real parcel polygon */
export function generateAutoSwathWaypoints(
  proj: FieldProjection,
  swathSpacingM = HEADER_WIDTH_M * 1.15,
  maxPasses = 8
): CombineWaypoint[] {
  const waypoints: CombineWaypoint[] = [];
  const inset = 14;
  // Choose pass orientation along the longer axis of the parcel
  const alongNorthSouth = proj.heightM >= proj.widthM;

  if (alongNorthSouth) {
    const startX = proj.minX + inset;
    const endX = proj.maxX - inset;
    const totalSpan = Math.max(12, endX - startX);
    const step = Math.max(swathSpacingM, totalSpan / maxPasses);
    let passIdx = 0;
    for (let x = startX + step * 0.35; x <= endX - 6 && passIdx < maxPasses; x += step) {
      // Scan along Z to find entry & exit inside polygon
      let zMin = Infinity;
      let zMax = -Infinity;
      const samples = 48;
      for (let i = 0; i <= samples; i++) {
        const z = proj.minZ + (i / samples) * proj.heightM;
        if (pointInPolygon(x, z, proj.polygon)) {
          if (z < zMin) zMin = z;
          if (z > zMax) zMax = z;
        }
      }
      if (zMax - zMin < 32) continue;
      const zA = zMin + inset;
      const zB = zMax - inset;
      if (passIdx % 2 === 0) {
        waypoints.push({ id: waypoints.length + 1, x, z: zA, label: `WP-${waypoints.length + 1}` });
        waypoints.push({ id: waypoints.length + 1, x, z: zB, label: `WP-${waypoints.length + 1}` });
      } else {
        waypoints.push({ id: waypoints.length + 1, x, z: zB, label: `WP-${waypoints.length + 1}` });
        waypoints.push({ id: waypoints.length + 1, x, z: zA, label: `WP-${waypoints.length + 1}` });
      }
      passIdx++;
    }
  } else {
    const startZ = proj.minZ + inset;
    const endZ = proj.maxZ - inset;
    const totalSpan = Math.max(12, endZ - startZ);
    const step = Math.max(swathSpacingM, totalSpan / maxPasses);
    let passIdx = 0;
    for (let z = startZ + step * 0.35; z <= endZ - 6 && passIdx < maxPasses; z += step) {
      let xMin = Infinity;
      let xMax = -Infinity;
      const samples = 48;
      for (let i = 0; i <= samples; i++) {
        const x = proj.minX + (i / samples) * proj.widthM;
        if (pointInPolygon(x, z, proj.polygon)) {
          if (x < xMin) xMin = x;
          if (x > xMax) xMax = x;
        }
      }
      if (xMax - xMin < 32) continue;
      const xA = xMin + inset;
      const xB = xMax - inset;
      if (passIdx % 2 === 0) {
        waypoints.push({ id: waypoints.length + 1, x: xA, z, label: `WP-${waypoints.length + 1}` });
        waypoints.push({ id: waypoints.length + 1, x: xB, z, label: `WP-${waypoints.length + 1}` });
      } else {
        waypoints.push({ id: waypoints.length + 1, x: xB, z, label: `WP-${waypoints.length + 1}` });
        waypoints.push({ id: waypoints.length + 1, x: xA, z, label: `WP-${waypoints.length + 1}` });
      }
      passIdx++;
    }
  }

  return waypoints;
}

export function createInitialCombineState(proj: FieldProjection, initialWaypoints: CombineWaypoint[], parcel: Parcel): CombineState {
  // Spawn at WP-1 aimed at WP-2 (or parcel south-west edge aimed north)
  let x = 0;
  let z = 0;
  let heading = 0;
  if (initialWaypoints.length >= 2) {
    x = initialWaypoints[0].x;
    z = initialWaypoints[0].z;
    heading = Math.atan2(initialWaypoints[1].x - x, initialWaypoints[1].z - z);
  } else if (pointInPolygon(0, 0, proj.polygon)) {
    x = 0;
    z = 0;
    heading = 0;
  } else {
    x = (proj.minX + proj.maxX) * 0.5;
    z = (proj.minZ + proj.maxZ) * 0.5;
  }

  const baseMoisture =
    parcel.crop === 'Upland Cotton' ? 8.6 :
    parcel.crop === 'Soybeans' ? 12.8 :
    parcel.crop === 'Field Corn' ? 15.4 : 13.5;

  return {
    x,
    z,
    heading,
    speedMs: 0,
    throttle: 0,
    steerAngle: 0,
    wheelDeg: 0,
    engineRpm: 1120,
    engineLoadPct: 24,
    separatorOn: true,
    headerDown: true,
    headerHeightIn: 8,
    reelPhase: 0,
    reelRpm: 24,
    rotorRpm: 620,
    concaveMm: parcel.crop === 'Upland Cotton' ? 16 : parcel.crop === 'Field Corn' ? 24 : 14,
    fanRpm: 940,
    grainTankPct: 14,
    grainTankUnits: parcel.crop === 'Upland Cotton' ? 2450 : 62,
    unloadingAugerOn: false,
    fuelPct: 84,
    defPct: 76,
    coolantF: 186,
    shoeLossPct: 0.4,
    rotorLossPct: 0.3,
    liveYieldRate: 0,
    moisturePct: baseMoisture,
    harvestedAcres: 0,
    inCrop: true,
    activelyCutting: false,
    autopilotOn: false,
    activeWaypointIdx: initialWaypoints.length >= 2 ? 1 : 0,
    xteInches: 0,
    distToWaypointFt: 0,
    autopilotStatus: initialWaypoints.length >= 2 ? 'READY · AB PLAN LOADED' : 'STANDBY · DROP WAYPOINTS',
    workLightsOn: false,
    beaconPhase: 0,
    wiperOn: false,
    wiperPhase: 0,
    duskMode: false,
  };
}

export interface ControlInput {
  forward: boolean;
  reverse: boolean;
  left: boolean;
  right: boolean;
  brake: boolean;
  /** Optional direct steering override from mouse/touch wheel drag [-1..+1] */
  manualSteerAxis: number | null;
}

function normalizeAngle(rad: number): number {
  let a = rad;
  while (a > Math.PI) a -= Math.PI * 2;
  while (a < -Math.PI) a += Math.PI * 2;
  return a;
}

export function getCropDisplayMeta(crop: Parcel['crop']): {
  unit: string;
  baseYield: number;
  tankCapacity: number;
  tankUnit: string;
  stalkColor: string;
  topColor: string;
  stubbleColor: string;
  soilColor: string;
} {
  switch (crop) {
    case 'Upland Cotton':
      return {
        unit: 'lbs/ac',
        baseYield: 1185,
        tankCapacity: 17500, // lbs seed cotton module basket
        tankUnit: 'lbs',
        stalkColor: '#4a3d2d',
        topColor: '#f3f1e8', // white fluffy cotton bolls!
        stubbleColor: '#69553e',
        soilColor: '#3f3428',
      };
    case 'Field Corn':
      return {
        unit: 'bu/ac',
        baseYield: 204,
        tankCapacity: 460,
        tankUnit: 'bu',
        stalkColor: '#9c7d3c',
        topColor: '#d9b95b',
        stubbleColor: '#7a6335',
        soilColor: '#3c3224',
      };
    case 'Soybeans':
      return {
        unit: 'bu/ac',
        baseYield: 64,
        tankCapacity: 460,
        tankUnit: 'bu',
        stalkColor: '#7d6839',
        topColor: '#bfa054',
        stubbleColor: '#6d5b34',
        soilColor: '#3e3326',
      };
    case 'Grain Sorghum':
      return {
        unit: 'bu/ac',
        baseYield: 112,
        tankCapacity: 460,
        tankUnit: 'bu',
        stalkColor: '#7c6538',
        topColor: '#b55c32',
        stubbleColor: '#695634',
        soilColor: '#3c3125',
      };
    default:
      return {
        unit: 'bu/ac',
        baseYield: 74,
        tankCapacity: 460,
        tankUnit: 'bu',
        stalkColor: '#a68944',
        topColor: '#e2c56b',
        stubbleColor: '#856d39',
        soilColor: '#3d3326',
      };
  }
}

export function stepCombinePhysics(
  st: CombineState,
  input: ControlInput,
  waypoints: CombineWaypoint[],
  loopWaypoints: boolean,
  grid: HarvestGrid,
  proj: FieldProjection,
  parcel: Parcel,
  dt: number
): CombineState {
  const clampedDt = Math.min(0.05, Math.max(0.001, dt));
  const next = { ...st };
  const cropMeta = getCropDisplayMeta(parcel.crop);

  // 1. Check for manual steering override (auto-disengages AutoTrac like real combine!)
  const manualSteerInput =
    input.manualSteerAxis !== null
      ? input.manualSteerAxis
      : (input.right ? 1 : 0) - (input.left ? 1 : 0);

  if (next.autopilotOn && Math.abs(manualSteerInput) > 0.08) {
    next.autopilotOn = false;
    next.autopilotStatus = 'DISENGAGED · MANUAL OVERRIDE';
  }

  // 2. Autopilot (RTK Pure-Pursuit Waypoint Controller) vs Manual Control
  let targetSteer = next.steerAngle;
  if (next.autopilotOn && waypoints.length > 0) {
    if (next.activeWaypointIdx >= waypoints.length) {
      if (loopWaypoints) {
        next.activeWaypointIdx = 0;
      } else {
        next.autopilotOn = false;
        next.throttle = 0;
        next.autopilotStatus = 'ROUTE COMPLETE · HEADLAND STOP';
      }
    }

    if (next.autopilotOn) {
      const wp = waypoints[next.activeWaypointIdx];
      const prevWp =
        next.activeWaypointIdx > 0
          ? waypoints[next.activeWaypointIdx - 1]
          : { x: next.x, z: next.z };

      const dx = wp.x - next.x;
      const dz = wp.z - next.z;
      const distM = Math.hypot(dx, dz);
      next.distToWaypointFt = Math.round(distM * M_TO_FT);

      // Compute perpendicular Cross-Track Error (XTE) against current AB segment
      const segDx = wp.x - prevWp.x;
      const segDz = wp.z - prevWp.z;
      const segLen = Math.hypot(segDx, segDz);
      if (segLen > 1) {
        const crossM = ((next.x - prevWp.x) * segDz - (next.z - prevWp.z) * segDx) / segLen;
        next.xteInches = Number((crossM * 39.3701).toFixed(1));
      } else {
        next.xteInches = 0;
      }

      // Advance waypoint upon arrival
      if (distM < 6.8) {
        if (next.activeWaypointIdx + 1 < waypoints.length) {
          next.activeWaypointIdx += 1;
        } else if (loopWaypoints) {
          next.activeWaypointIdx = 0;
        } else {
          next.autopilotOn = false;
          next.throttle = 0;
          next.autopilotStatus = 'ROUTE COMPLETE · ALL WAYPOINTS DONE';
        }
      }

      if (next.autopilotOn) {
        const curWp = waypoints[next.activeWaypointIdx];
        const desiredHeading = Math.atan2(curWp.x - next.x, curWp.z - next.z);
        const headingErr = normalizeAngle(desiredHeading - next.heading);

        // Smooth proportional steering with slight cross-track damping
        targetSteer = Math.max(-MAX_STEER_RAD, Math.min(MAX_STEER_RAD, headingErr * 1.15));

        // Automatic headland cornering speed modulation
        const turnFactor = Math.min(1, Math.abs(headingErr) / 0.85);
        const autoCruiseThrottle = next.grainTankPct >= 99.5
          ? 0
          : next.headerDown
          ? 0.56 - turnFactor * 0.24
          : 0.72 - turnFactor * 0.25;

        next.throttle += (autoCruiseThrottle - next.throttle) * Math.min(1, clampedDt * 3.5);
        next.autopilotStatus =
          next.grainTankPct >= 99.5
            ? 'PAUSED · GRAIN TANK FULL (UNLOAD)'
            : turnFactor > 0.45
            ? `HEADLAND TURN → ${curWp.label}`
            : `RTK LOCKED → ${curWp.label}`;
      }
    }
  } else {
    // Manual hydrostatic throttle & steering
    if (input.brake) {
      next.throttle *= Math.max(0, 1 - clampedDt * 8);
      if (Math.abs(next.throttle) < 0.02) next.throttle = 0;
    } else {
      if (input.forward) next.throttle = Math.min(1, next.throttle + clampedDt * 0.72);
      if (input.reverse) next.throttle = Math.max(-0.35, next.throttle - clampedDt * 0.72);
    }

    if (Math.abs(manualSteerInput) > 0.01) {
      targetSteer = manualSteerInput * MAX_STEER_RAD;
    } else {
      // Gentle self-centering when steering released
      targetSteer = next.steerAngle * Math.max(0, 1 - clampedDt * 3.8);
    }

    // Still compute distance to active waypoint if user has waypoints loaded
    if (waypoints.length > 0 && next.activeWaypointIdx < waypoints.length) {
      const wp = waypoints[next.activeWaypointIdx];
      next.distToWaypointFt = Math.round(Math.hypot(wp.x - next.x, wp.z - next.z) * M_TO_FT);
      const prevWp = next.activeWaypointIdx > 0 ? waypoints[next.activeWaypointIdx - 1] : null;
      if (prevWp) {
        const segDx = wp.x - prevWp.x;
        const segDz = wp.z - prevWp.z;
        const segLen = Math.hypot(segDx, segDz);
        if (segLen > 1) {
          const crossM = ((next.x - prevWp.x) * segDz - (next.z - prevWp.z) * segDx) / segLen;
          next.xteInches = Number((crossM * 39.3701).toFixed(1));
        }
      }
    } else {
      next.distToWaypointFt = 0;
      next.xteInches = 0;
    }
  }

  // Smooth steering actuator
  next.steerAngle += (targetSteer - next.steerAngle) * Math.min(1, clampedDt * 5.2);
  next.wheelDeg = (next.steerAngle / MAX_STEER_RAD) * 420;

  // 3. Hydrostatic speed physics (harvest max ~8.5 mph, transport ~14 mph)
  const maxForwardMs = next.headerDown ? 3.9 : 6.2;
  const maxReverseMs = 2.4;
  const targetSpeedMs =
    next.throttle >= 0 ? next.throttle * maxForwardMs : next.throttle * maxReverseMs;
  next.speedMs += (targetSpeedMs - next.speedMs) * Math.min(1, clampedDt * 2.8);
  if (Math.abs(next.speedMs) < 0.015 && Math.abs(next.throttle) < 0.02) next.speedMs = 0;

  // 4. Kinematic bicycle model update
  const angularVel = (next.speedMs / WHEELBASE_M) * Math.tan(next.steerAngle);
  next.heading = normalizeAngle(next.heading + angularVel * clampedDt);
  next.x += Math.sin(next.heading) * next.speedMs * clampedDt;
  next.z += Math.cos(next.heading) * next.speedMs * clampedDt;

  // Soft keep-inside-world boundary (+90m margin around parcel)
  const boundPad = 95;
  next.x = Math.max(proj.minX - boundPad, Math.min(proj.maxX + boundPad, next.x));
  next.z = Math.max(proj.minZ - boundPad, Math.min(proj.maxZ + boundPad, next.z));

  // 5. Header hydraulics & reel animation
  const targetHeaderIn = next.headerDown ? 7 : 42;
  next.headerHeightIn += (targetHeaderIn - next.headerHeightIn) * Math.min(1, clampedDt * 4.5);

  const speedMph = Math.abs(next.speedMs * MS_TO_MPH);
  const canCut = next.separatorOn && next.headerHeightIn < 15 && next.speedMs > 0.25 && next.grainTankPct < 100;
  next.reelRpm = next.separatorOn && next.headerDown ? Math.round(18 + speedMph * 4.6) : 0;
  next.reelPhase = (next.reelPhase + (next.reelRpm / 60) * Math.PI * 2 * clampedDt) % (Math.PI * 2);

  // 6. Sweep 40-ft front header across HarvestGrid!
  const headerForwardOffset = 4.6;
  const hxCenter = next.x + Math.sin(next.heading) * headerForwardOffset;
  const hzCenter = next.z + Math.cos(next.heading) * headerForwardOffset;
  const rightX = Math.cos(next.heading);
  const rightZ = -Math.sin(next.heading);

  next.inCrop = pointInPolygon(hxCenter, hzCenter, proj.polygon);

  let newlyCutCells = 0;
  let yieldFactorSum = 0;
  if (canCut) {
    const halfW = HEADER_WIDTH_M * 0.5;
    const steps = 11;
    for (let s = 0; s <= steps; s++) {
      const lateral = -halfW + (s / steps) * HEADER_WIDTH_M;
      const sx = hxCenter + rightX * lateral;
      const sz = hzCenter + rightZ * lateral;
      const c = Math.floor((sx - grid.minX) / grid.cellSizeM);
      const r = Math.floor((sz - grid.minZ) / grid.cellSizeM);
      if (c >= 0 && c < grid.cols && r >= 0 && r < grid.rows) {
        const idx = r * grid.cols + c;
        if (grid.cells[idx] === 1) {
          grid.cells[idx] = 2;
          grid.harvestedCells++;
          newlyCutCells++;
          yieldFactorSum += grid.yieldMap[idx];
        }
      }
    }
  }

  const centerSample = sampleGridCell(grid, hxCenter, hzCenter);
  next.activelyCutting = canCut && (newlyCutCells > 0 || centerSample.state === 1);

  if (newlyCutCells > 0) {
    const addedSqM = newlyCutCells * grid.cellSizeM * grid.cellSizeM;
    const addedAcres = addedSqM * SQM_TO_ACRES;
    const avgYieldFactor = yieldFactorSum / newlyCutCells;
    const instYield = cropMeta.baseYield * avgYieldFactor;
    next.harvestedAcres += addedAcres;
    next.liveYieldRate += (instYield - next.liveYieldRate) * 0.28;
    const addedUnits = addedAcres * instYield;
    next.grainTankUnits = Math.min(cropMeta.tankCapacity, next.grainTankUnits + addedUnits);
    next.grainTankPct = Math.min(100, (next.grainTankUnits / cropMeta.tankCapacity) * 100);
  } else if (!next.activelyCutting) {
    next.liveYieldRate += (0 - next.liveYieldRate) * Math.min(1, clampedDt * 2.5);
  }

  // 7. Unloading Auger live offload
  if (next.unloadingAugerOn) {
    if (next.grainTankUnits > 0) {
      const unloadRateUnitsPerSec = cropMeta.tankCapacity * 0.085; // ~12 sec full unload
      next.grainTankUnits = Math.max(0, next.grainTankUnits - unloadRateUnitsPerSec * clampedDt);
      next.grainTankPct = (next.grainTankUnits / cropMeta.tankCapacity) * 100;
    } else {
      next.unloadingAugerOn = false;
    }
  }

  // 8. Engine RPM, Load, Loss Monitor, Fuel, Coolant, Beacon, Wiper
  const targetRpm = next.separatorOn
    ? 2080 + (next.activelyCutting ? 85 : 0) + speedMph * 8
    : 1080 + speedMph * 65;
  next.engineRpm += (targetRpm - next.engineRpm) * Math.min(1, clampedDt * 4);

  const targetLoad =
    18 +
    (next.separatorOn ? 24 : 0) +
    (next.activelyCutting ? 30 + speedMph * 4.2 : speedMph * 3.5) +
    (next.unloadingAugerOn ? 14 : 0);
  next.engineLoadPct += (Math.min(100, targetLoad) - next.engineLoadPct) * Math.min(1, clampedDt * 3.5);

  const overspeedPenalty = next.activelyCutting && speedMph > 5.8 ? (speedMph - 5.8) * 1.45 : 0;
  const targetShoeLoss = next.activelyCutting ? 0.55 + overspeedPenalty : 0.15;
  const targetRotorLoss = next.activelyCutting ? 0.42 + overspeedPenalty * 0.85 : 0.1;
  next.shoeLossPct += (Math.min(9.9, targetShoeLoss) - next.shoeLossPct) * Math.min(1, clampedDt * 3);
  next.rotorLossPct += (Math.min(9.9, targetRotorLoss) - next.rotorLossPct) * Math.min(1, clampedDt * 3);

  next.rotorRpm = next.separatorOn ? Math.round(615 + (next.activelyCutting ? 25 : 0)) : 0;
  next.fanRpm = next.separatorOn ? 945 : 0;
  next.fuelPct = Math.max(12, next.fuelPct - (next.engineLoadPct / 100) * 0.0045 * clampedDt);
  next.coolantF = 184 + (next.engineLoadPct / 100) * 18;
  next.beaconPhase = (next.beaconPhase + clampedDt * 4.2) % (Math.PI * 2);
  if (next.wiperOn) {
    next.wiperPhase = (next.wiperPhase + clampedDt * 2.4) % (Math.PI * 2);
  }

  return next;
}
