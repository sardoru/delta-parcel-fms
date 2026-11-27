import React, { useEffect, useRef } from 'react';
import { LiveWeather, Parcel } from '../types/farm';
import {
  CombineState,
  CombineWaypoint,
  FieldProjection,
  getCropDisplayMeta,
  HarvestGrid,
  HEADER_WIDTH_M,
  sampleGridCell,
} from '../utils/combineSim';

interface CombineWindshieldCanvasProps {
  stateRef: React.MutableRefObject<CombineState>;
  waypointsRef: React.MutableRefObject<CombineWaypoint[]>;
  gridRef: React.MutableRefObject<HarvestGrid>;
  projRef: React.MutableRefObject<FieldProjection>;
  parcel: Parcel;
  weather: LiveWeather;
  showArHud: boolean;
}

interface DustParticle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  alpha: number;
  life: number;
}

export const CombineWindshieldCanvas: React.FC<CombineWindshieldCanvasProps> = ({
  stateRef,
  waypointsRef,
  gridRef,
  projRef,
  parcel,
  weather,
  showArHud,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const particlesRef = useRef<DustParticle[]>([]);
  const showArRef = useRef(showArHud);
  showArRef.current = showArHud;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const cropMeta = getCropDisplayMeta(parcel.crop);
    let rafId = 0;

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const rect = canvas.getBoundingClientRect();
      const w = Math.max(320, Math.round(rect.width * dpr));
      const h = Math.max(240, Math.round(rect.height * dpr));
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
      }
    };
    resize();
    window.addEventListener('resize', resize);

    const drawFrame = () => {
      rafId = requestAnimationFrame(drawFrame);
      resize();
      const W = canvas.width;
      const H = canvas.height;
      const st = stateRef.current;
      const grid = gridRef.current;
      const waypoints = waypointsRef.current;
      const proj = projRef.current;
      const dusk = st.duskMode;

      // Subtle authentic cab suspension micro-vibration from diesel engine + threshing separator
      const vibAmp = (st.separatorOn ? 1.0 : 0.35) + Math.abs(st.speedMs) * 0.25;
      const tNow = performance.now() * 0.001;
      const shakeY = Math.sin(tNow * 34) * vibAmp * 0.45 + Math.cos(tNow * 19) * vibAmp * 0.35;
      const horizonY = H * 0.405 + shakeY;

      const sinH = Math.sin(st.heading);
      const cosH = Math.cos(st.heading);
      const rightX = cosH;
      const rightZ = -sinH;

      // 3D perspective camera parameters (elevated combine cab eye height = 3.45m)
      const camHeight = 3.45;
      const focal = W * 0.62;

      const projectWorld = (wx: number, wz: number, wy = 0): { sx: number; sy: number; depth: number } | null => {
        const dx = wx - st.x;
        const dz = wz - st.z;
        const forward = dx * sinH + dz * cosH;
        if (forward < 1.8) return null;
        const lateral = dx * rightX + dz * rightZ;
        const sx = W * 0.5 + (lateral / forward) * focal;
        const sy = horizonY + ((camHeight - wy) / forward) * focal;
        return { sx, sy, depth: forward };
      };

      // ─── 1. SKY & ATMOSPHERE ───
      const skyGrad = ctx.createLinearGradient(0, 0, 0, horizonY);
      if (dusk) {
        skyGrad.addColorStop(0, '#070b14');
        skyGrad.addColorStop(0.55, '#171f31');
        skyGrad.addColorStop(0.84, '#44322e');
        skyGrad.addColorStop(1, '#8c5334');
      } else {
        skyGrad.addColorStop(0, '#2e5d86');
        skyGrad.addColorStop(0.48, '#6695b8');
        skyGrad.addColorStop(0.82, '#b9ccba');
        skyGrad.addColorStop(1, '#dfd8ba');
      }
      ctx.fillStyle = skyGrad;
      ctx.fillRect(0, 0, W, horizonY + 4);

      // Sun / Golden hour glow positioned relative to heading
      const sunBearing = 1.05; // ENE / morning harvest sun
      let sunRel = sunBearing - st.heading;
      while (sunRel > Math.PI) sunRel -= Math.PI * 2;
      while (sunRel < -Math.PI) sunRel += Math.PI * 2;
      if (Math.abs(sunRel) < 1.2) {
        const sunX = W * 0.5 + (sunRel / 0.85) * W * 0.55;
        const sunY = horizonY - H * (dusk ? 0.05 : 0.19);
        const sunGlow = ctx.createRadialGradient(sunX, sunY, 4, sunX, sunY, W * 0.22);
        if (dusk) {
          sunGlow.addColorStop(0, 'rgba(255, 168, 92, 0.72)');
          sunGlow.addColorStop(0.3, 'rgba(235, 118, 62, 0.25)');
          sunGlow.addColorStop(1, 'rgba(235, 118, 62, 0)');
        } else {
          sunGlow.addColorStop(0, 'rgba(255, 248, 214, 0.88)');
          sunGlow.addColorStop(0.25, 'rgba(255, 232, 168, 0.28)');
          sunGlow.addColorStop(1, 'rgba(255, 232, 168, 0)');
        }
        ctx.fillStyle = sunGlow;
        ctx.fillRect(0, 0, W, horizonY + 10);
      }

      // Soft cirrus/cumulus cloud wisps scrolling smoothly with heading
      ctx.save();
      const cloudOffset = ((-st.heading / (Math.PI * 2)) * W * 3.2) % W;
      ctx.fillStyle = dusk ? 'rgba(180, 128, 108, 0.10)' : 'rgba(255, 255, 250, 0.28)';
      for (let i = -1; i < 6; i++) {
        const cx = ((i * W * 0.28 + cloudOffset) % (W * 1.6)) - W * 0.2;
        const cy = horizonY * (0.28 + ((i * 37) % 10) * 0.045);
        ctx.beginPath();
        ctx.ellipse(cx, cy, W * 0.11, H * 0.022, 0, 0, Math.PI * 2);
        ctx.ellipse(cx + W * 0.05, cy - H * 0.01, W * 0.08, H * 0.018, 0, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();

      // ─── 2. DISTANT DELTA TREELINE & COTTON GIN SILO SILHOUETTES ───
      ctx.save();
      const treeShift = -st.heading * focal * 0.55;
      ctx.fillStyle = dusk ? '#121818' : '#2e412c';
      ctx.beginPath();
      ctx.moveTo(0, horizonY + 2);
      for (let sx = 0; sx <= W + 24; sx += 18) {
        const ang = (sx - treeShift) * 0.012;
        const treeH =
          H * 0.016 +
          Math.abs(Math.sin(ang * 1.7) * Math.cos(ang * 0.63)) * H * 0.028 +
          Math.sin(ang * 4.1) * H * 0.006;
        ctx.lineTo(sx, horizonY - treeH);
      }
      ctx.lineTo(W, horizonY + 2);
      ctx.closePath();
      ctx.fill();

      // Distant Cotton Gin / Grain Silo landmark on the north-east horizon
      const ginRel = (0.35 - st.heading + Math.PI * 3) % (Math.PI * 2) - Math.PI;
      if (Math.abs(ginRel) < 0.95) {
        const gx = W * 0.5 + Math.tan(ginRel) * focal * 0.72;
        const gy = horizonY;
        ctx.fillStyle = dusk ? '#1c2427' : '#85918a';
        ctx.fillRect(gx - 22, gy - 16, 26, 16);
        ctx.fillRect(gx + 6, gy - 26, 8, 26);
        ctx.fillRect(gx + 16, gy - 26, 8, 26);
        // Red aircraft obstruction beacon on top of silo!
        if (dusk || Math.sin(tNow * 3) > 0.2) {
          ctx.fillStyle = '#ff5738';
          ctx.beginPath();
          ctx.arc(gx + 10, gy - 28, 2.2, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      ctx.restore();

      // ─── 3. GROUND BASEPLANE ───
      const groundGrad = ctx.createLinearGradient(0, horizonY, 0, H);
      if (dusk) {
        groundGrad.addColorStop(0, '#181a15');
        groundGrad.addColorStop(0.35, '#1b1914');
        groundGrad.addColorStop(1, '#12100c');
      } else {
        groundGrad.addColorStop(0, '#5a5c3c');
        groundGrad.addColorStop(0.28, '#4d4732');
        groundGrad.addColorStop(1, cropMeta.soilColor);
      }
      ctx.fillStyle = groundGrad;
      ctx.fillRect(0, horizonY, W, H - horizonY);

      // ─── 4. REAL 3D CONTINUOUS PERSPECTIVE CROP ROWS & LIVE HARVESTED SWATHS ───
      // First paint smooth perspective soil/stubble/standing crop field surface from HarvestGrid
      const depthSteps = 44;
      const minDepth = 4.0;
      const maxDepth = 185;
      const horizonBlendColor = dusk ? [24, 26, 21] : [132, 134, 102];

      for (let dIdx = depthSteps - 1; dIdx >= 0; dIdx--) {
        const t0 = dIdx / depthSteps;
        const t1 = (dIdx + 1) / depthSteps;
        const dNear = minDepth * Math.pow(maxDepth / minDepth, t0);
        const dFar = minDepth * Math.pow(maxDepth / minDepth, t1);
        const dMid = (dNear + dFar) * 0.5;

        const yNear = horizonY + (camHeight / dNear) * focal;
        const yFar = horizonY + (camHeight / dFar) * focal;
        const bandH = Math.max(1.5, yNear - yFar + 1.5);
        if (yFar > H) continue;

        const halfWidthWorld = (W * 0.58 * dMid) / focal;
        const colsAcross = Math.max(26, Math.min(54, Math.round(28 + (1 - t0) * 26)));
        const stepLat = (halfWidthWorld * 2) / colsAcross;

        const fog = Math.pow(Math.min(1, dMid / maxDepth), 1.35);
        const lightBoost =
          dusk && st.workLightsOn && dMid < 65
            ? Math.max(0, 1 - dMid / 65) * 0.78
            : 0;

        for (let ci = 0; ci < colsAcross; ci++) {
          const latL = -halfWidthWorld + ci * stepLat;
          const latR = latL + stepLat;
          const latMid = (latL + latR) * 0.5;

          const wx = st.x + sinH * dMid + rightX * latMid;
          const wz = st.z + cosH * dMid + rightZ * latMid;
          const sample = sampleGridCell(grid, wx, wz);

          const sxL = W * 0.5 + (latL / dMid) * focal;
          const sxR = W * 0.5 + (latR / dMid) * focal;
          const segW = Math.max(1.6, sxR - sxL + 1.2);

          // Base ground/canopy fill with smooth atmospheric horizon blend
          let r = 68, g = 60, b = 42;
          if (sample.state === 1) {
            // Standing crop canopy base
            if (parcel.crop === 'Upland Cotton') {
              r = 86; g = 75; b = 56;
            } else if (parcel.crop === 'Field Corn') {
              r = 148; g = 122; b = 62;
            } else if (parcel.crop === 'Grain Sorghum') {
              r = 132; g = 76; b = 46;
            } else {
              r = 142; g = 118; b = 66;
            }
          } else if (sample.state === 2) {
            // Freshly harvested golden stubble
            r = 116; g = 96; b = 62;
          } else {
            // Grassy headland / turnrow
            r = 66; g = 80; b = 50;
          }

          if (dusk) {
            const lum = 0.24 + lightBoost * 0.62;
            r *= lum; g *= lum; b *= lum;
          }

          // Blend smoothly into atmospheric haze toward horizon
          r = Math.round(r * (1 - fog * 0.68) + horizonBlendColor[0] * fog * 0.68);
          g = Math.round(g * (1 - fog * 0.68) + horizonBlendColor[1] * fog * 0.68);
          b = Math.round(b * (1 - fog * 0.68) + horizonBlendColor[2] * fog * 0.68);

          ctx.fillStyle = `rgb(${r},${g},${b})`;
          ctx.fillRect(sxL, yFar, segW, bandH);
        }
      }

      // Draw crisp continuous 3D converging crop furrow lines + organic cotton bolls / grain heads!
      ctx.save();
      const rowSpacingM = 1.65; // realistic 38-inch / 1.65m visual row spacing
      const rowsNorthSouth = proj.heightM >= proj.widthM;
      const baseAxis = rowsNorthSouth ? st.x : st.z;
      const firstRowIdx = Math.floor((baseAxis - 55) / rowSpacingM);
      const lastRowIdx = Math.ceil((baseAxis + 55) / rowSpacingM);

      for (let ri = firstRowIdx; ri <= lastRowIdx; ri++) {
        const rowFixed = ri * rowSpacingM;
        const alongCenter = rowsNorthSouth ? st.z : st.x;
        const pNear = rowsNorthSouth
          ? projectWorld(rowFixed, alongCenter + Math.sign(cosH || 1) * 4.5, 0)
          : projectWorld(alongCenter + Math.sign(sinH || 1) * 4.5, rowFixed, 0);

        // Draw furrow line in short segments sampled against HarvestGrid
        const dirAlong = rowsNorthSouth ? (cosH >= 0 ? 1 : -1) : (sinH >= 0 ? 1 : -1);
        for (let s = 0; s < 14; s++) {
          const d0 = 4.2 + s * 9.5;
          const d1 = d0 + 9.5;
          const x0 = rowsNorthSouth ? rowFixed : alongCenter + dirAlong * d0;
          const z0 = rowsNorthSouth ? alongCenter + dirAlong * d0 : rowFixed;
          const x1 = rowsNorthSouth ? rowFixed : alongCenter + dirAlong * d1;
          const z1 = rowsNorthSouth ? alongCenter + dirAlong * d1 : rowFixed;

          const q0 = projectWorld(x0, z0, 0.08);
          const q1 = projectWorld(x1, z1, 0.08);
          if (!q0 || !q1 || q0.depth > 145 || q1.depth > 145) continue;
          if (q0.sx < -40 && q1.sx < -40) continue;
          if (q0.sx > W + 40 && q1.sx > W + 40) continue;

          const cell = sampleGridCell(grid, (x0 + x1) * 0.5, (z0 + z1) * 0.5);
          const alpha = Math.max(0.08, 1 - q0.depth / 145);
          const lightMult = dusk ? (st.workLightsOn && q0.depth < 62 ? 0.78 : 0.25) : 1;

          if (cell.state === 1) {
            // Dark furrow trench between raised crop beds
            ctx.strokeStyle = `rgba(38, 30, 20, ${0.42 * alpha * lightMult})`;
            ctx.lineWidth = Math.max(1, (0.28 / q0.depth) * focal);
            ctx.beginPath();
            ctx.moveTo(q0.sx, q0.sy);
            ctx.lineTo(q1.sx, q1.sy);
            ctx.stroke();

            // Organic crop tufts along the standing row ridge (white cotton bolls or golden stalks!)
            if (q0.depth < 64) {
              const tuftCount = q0.depth < 22 ? 4 : 2;
              for (let k = 0; k < tuftCount; k++) {
                const f = (k + 0.35 + ((ri * 17 + s * 7 + k * 13) % 5) * 0.08) / tuftCount;
                const tx = x0 + (x1 - x0) * f;
                const tz = z0 + (z1 - z0) * f;
                const pt = projectWorld(tx, tz, parcel.crop === 'Field Corn' ? 0.85 : 0.45);
                if (!pt || pt.sx < -20 || pt.sx > W + 20) continue;
                const rad = Math.max(1.2, Math.min(7.5, (0.24 / pt.depth) * focal));
                if (parcel.crop === 'Upland Cotton') {
                  // Soft fluffy white cotton boll tufts on stalks!
                  ctx.fillStyle = `rgba(244, 241, 232, ${0.86 * alpha * lightMult})`;
                  ctx.beginPath();
                  ctx.arc(pt.sx, pt.sy, rad, 0, Math.PI * 2);
                  ctx.arc(pt.sx + rad * 0.7, pt.sy + rad * 0.2, rad * 0.75, 0, Math.PI * 2);
                  ctx.fill();
                } else {
                  ctx.fillStyle = parcel.crop === 'Grain Sorghum'
                    ? `rgba(188, 96, 52, ${0.82 * alpha * lightMult})`
                    : `rgba(222, 192, 98, ${0.82 * alpha * lightMult})`;
                  ctx.beginPath();
                  ctx.ellipse(pt.sx, pt.sy, rad * 0.65, rad * 1.45, 0, 0, Math.PI * 2);
                  ctx.fill();
                }
              }
            }
          } else if (cell.state === 2) {
            // Cleanly cut bright stubble furrow lines!
            ctx.strokeStyle = `rgba(196, 168, 108, ${0.46 * alpha * lightMult})`;
            ctx.lineWidth = Math.max(1, (0.22 / q0.depth) * focal);
            ctx.beginPath();
            ctx.moveTo(q0.sx, q0.sy);
            ctx.lineTo(q1.sx, q1.sy);
            ctx.stroke();
          }
        }
        void pNear;
      }
      ctx.restore();

      // ─── 5. PROJECTED PARCEL BOUNDARY LINES ON GROUND ───
      if (proj.polygon.length >= 3) {
        ctx.save();
        ctx.strokeStyle = dusk ? 'rgba(216, 242, 116, 0.55)' : 'rgba(216, 242, 116, 0.65)';
        ctx.lineWidth = 2;
        ctx.setLineDash([8, 6]);
        for (let i = 0; i < proj.polygon.length - 1; i++) {
          const a = proj.polygon[i];
          const b = proj.polygon[i + 1];
          // Subdivide long parcel edges so perspective projection clips cleanly
          const segs = 12;
          let started = false;
          ctx.beginPath();
          for (let s = 0; s <= segs; s++) {
            const t = s / segs;
            const p = projectWorld(a.x + (b.x - a.x) * t, a.z + (b.z - a.z) * t, 0.15);
            if (p && p.depth < 240) {
              if (!started) {
                ctx.moveTo(p.sx, p.sy);
                started = true;
              } else {
                ctx.lineTo(p.sx, p.sy);
              }
            } else {
              started = false;
            }
          }
          ctx.stroke();
        }
        ctx.restore();
      }

      // ─── 6. AR WINDSHIELD RTK AUTOTRAC GUIDANCE LINE & 3D WAYPOINT BEACONS ───
      if (showArRef.current && waypoints.length > 0) {
        ctx.save();
        // Projected route path ribbon
        for (let i = Math.max(0, st.activeWaypointIdx - 1); i < waypoints.length - 1; i++) {
          const a = waypoints[i];
          const b = waypoints[i + 1];
          const isActiveSeg = i === st.activeWaypointIdx - 1;
          ctx.strokeStyle = isActiveSeg
            ? st.autopilotOn
              ? 'rgba(216, 242, 116, 0.92)'
              : 'rgba(94, 200, 235, 0.85)'
            : 'rgba(216, 242, 116, 0.38)';
          ctx.lineWidth = isActiveSeg ? 4 : 2;
          ctx.setLineDash(isActiveSeg ? [] : [10, 8]);
          ctx.beginPath();
          let started = false;
          for (let s = 0; s <= 18; s++) {
            const t = s / 18;
            const p = projectWorld(a.x + (b.x - a.x) * t, a.z + (b.z - a.z) * t, 0.18);
            if (p && p.depth < 220) {
              if (!started) {
                ctx.moveTo(p.sx, p.sy);
                started = true;
              } else {
                ctx.lineTo(p.sx, p.sy);
              }
            } else {
              started = false;
            }
          }
          ctx.stroke();
        }

        // Direct live AR RTK guidance ribbon from combine nose toward active waypoint (capped smoothly to 180m ahead)
        if (st.activeWaypointIdx < waypoints.length) {
          const targetWp = waypoints[st.activeWaypointIdx];
          const dxWp = targetWp.x - st.x;
          const dzWp = targetWp.z - st.z;
          const distWp = Math.hypot(dxWp, dzWp);
          const drawDist = Math.min(distWp, 180);
          if (drawDist > 4) {
            const ux = dxWp / distWp;
            const uz = dzWp / distWp;
            // Subtle swath corridor edge lines (40-ft header width!)
            const swHalf = HEADER_WIDTH_M * 0.5;
            const perpX = uz;
            const perpZ = -ux;
            for (const side of [-1, 1]) {
              ctx.strokeStyle = st.autopilotOn ? 'rgba(216, 242, 116, 0.36)' : 'rgba(94, 200, 235, 0.26)';
              ctx.lineWidth = 1.6;
              ctx.setLineDash([6, 8]);
              ctx.beginPath();
              let started = false;
              for (let d = 6; d <= Math.min(drawDist, 120); d += 6) {
                const p = projectWorld(st.x + ux * d + perpX * swHalf * side, st.z + uz * d + perpZ * swHalf * side, 0.12);
                if (p) {
                  if (!started) { ctx.moveTo(p.sx, p.sy); started = true; }
                  else ctx.lineTo(p.sx, p.sy);
                }
              }
              ctx.stroke();
            }

            // Center glowing RTK AutoTrac line
            ctx.strokeStyle = st.autopilotOn ? 'rgba(216, 242, 116, 0.95)' : 'rgba(240, 187, 102, 0.85)';
            ctx.lineWidth = 4;
            ctx.setLineDash([14, 9]);
            ctx.beginPath();
            let started = false;
            for (let d = 5; d <= drawDist; d += 6) {
              const p = projectWorld(st.x + ux * d, st.z + uz * d, 0.16);
              if (p) {
                if (!started) { ctx.moveTo(p.sx, p.sy); started = true; }
                else ctx.lineTo(p.sx, p.sy);
              }
            }
            ctx.stroke();
            ctx.setLineDash([]);
          }
        }

        // Floating 3D Waypoint Pillars & Labels
        for (let i = 0; i < waypoints.length; i++) {
          const wp = waypoints[i];
          const base = projectWorld(wp.x, wp.z, 0.1);
          const top = projectWorld(wp.x, wp.z, 3.6);
          if (!base || !top || base.depth > 210) continue;
          const isCurrent = i === st.activeWaypointIdx;
          const isPast = i < st.activeWaypointIdx;

          // Vertical holographic beacon stem
          ctx.strokeStyle = isCurrent
            ? '#d8f274'
            : isPast
            ? 'rgba(142, 227, 164, 0.35)'
            : 'rgba(94, 200, 235, 0.72)';
          ctx.lineWidth = isCurrent ? 2.6 : 1.5;
          ctx.beginPath();
          ctx.moveTo(base.sx, base.sy);
          ctx.lineTo(top.sx, top.sy);
          ctx.stroke();

          // Ground target ring
          const ringRx = Math.max(4, Math.min(28, (2.2 / base.depth) * focal));
          ctx.beginPath();
          ctx.ellipse(base.sx, base.sy, ringRx, ringRx * 0.28, 0, 0, Math.PI * 2);
          ctx.stroke();

          // Floating waypoint tag
          if (isCurrent || base.depth < 120) {
            const label = isCurrent ? `${wp.label} · ${Math.round(base.depth * 3.28)} ft` : wp.label;
            ctx.font = `600 ${Math.max(10, Math.round(W * 0.0085))}px "JetBrains Mono", monospace`;
            const tw = ctx.measureText(label).width + 14;
            const th = 22;
            ctx.fillStyle = isCurrent ? 'rgba(20, 24, 16, 0.88)' : 'rgba(14, 18, 22, 0.76)';
            ctx.strokeStyle = isCurrent ? '#d8f274' : 'rgba(94, 200, 235, 0.65)';
            ctx.lineWidth = 1.2;
            ctx.beginPath();
            ctx.roundRect(top.sx - tw / 2, top.sy - th - 4, tw, th, 99);
            ctx.fill();
            ctx.stroke();
            ctx.fillStyle = isCurrent ? '#d8f274' : '#c6eefb';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(label, top.sx, top.sy - th / 2 - 4);
          }
        }
        ctx.restore();
      }

      // ─── 7. LED WORK LIGHT BEAMS (DUSK / NIGHT HARVEST) ───
      if (st.workLightsOn) {
        ctx.save();
        const beamGrad = ctx.createRadialGradient(W * 0.5, H * 0.88, W * 0.04, W * 0.5, horizonY + H * 0.22, W * 0.58);
        beamGrad.addColorStop(0, dusk ? 'rgba(248, 255, 230, 0.28)' : 'rgba(255, 252, 220, 0.08)');
        beamGrad.addColorStop(0.55, dusk ? 'rgba(225, 240, 200, 0.11)' : 'rgba(255, 252, 220, 0.02)');
        beamGrad.addColorStop(1, 'rgba(225, 240, 200, 0)');
        ctx.fillStyle = beamGrad;
        ctx.beginPath();
        ctx.moveTo(W * 0.06, H * 0.88);
        ctx.lineTo(W * 0.24, horizonY + H * 0.04);
        ctx.lineTo(W * 0.76, horizonY + H * 0.04);
        ctx.lineTo(W * 0.94, H * 0.88);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      }

      // ─── 8. ANIMATED 40-FT DRAPER / COTTON HEADER IN FOREGROUND ───
      ctx.save();
      // Header lifts vertically on windshield as headerHeightIn rises from 7" to 42"
      const liftNorm = Math.max(0, Math.min(1, (st.headerHeightIn - 6) / 36));
      const headerBaseY = H * (0.725 - liftNorm * 0.085) + shakeY * 1.4;
      const hdrLeft = W * 0.075;
      const hdrRight = W * 0.925;
      const hdrW = hdrRight - hdrLeft;
      const hdrCenter = W * 0.5;

      // Feederhouse throat (center dark steel housing)
      ctx.fillStyle = '#1b1f1a';
      ctx.beginPath();
      ctx.moveTo(hdrCenter - W * 0.075, H);
      ctx.lineTo(hdrCenter - W * 0.055, headerBaseY - H * 0.03);
      ctx.lineTo(hdrCenter + W * 0.055, headerBaseY - H * 0.03);
      ctx.lineTo(hdrCenter + W * 0.075, H);
      ctx.closePath();
      ctx.fill();

      // Main Header Frame Backboard (John Deere / DeltaPlot olive-green & charcoal steel)
      const frameGrad = ctx.createLinearGradient(0, headerBaseY - 38, 0, headerBaseY + 26);
      frameGrad.addColorStop(0, '#365425');
      frameGrad.addColorStop(0.45, '#253a1a');
      frameGrad.addColorStop(1, '#141a12');
      ctx.fillStyle = frameGrad;
      ctx.beginPath();
      ctx.moveTo(hdrLeft + W * 0.03, headerBaseY - H * 0.042);
      ctx.lineTo(hdrRight - W * 0.03, headerBaseY - H * 0.042);
      ctx.lineTo(hdrRight, headerBaseY + H * 0.032);
      ctx.lineTo(hdrLeft, headerBaseY + H * 0.032);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = 'rgba(216, 242, 116, 0.35)';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // Yellow safety stripe across top header beam
      ctx.fillStyle = '#e5be3b';
      ctx.fillRect(hdrLeft + W * 0.036, headerBaseY - H * 0.042, hdrW - W * 0.072, 4);

      // Left & Right Crop Snouts / Dividers
      ctx.fillStyle = '#d4aa2e';
      ctx.beginPath();
      ctx.moveTo(hdrLeft, headerBaseY + H * 0.032);
      ctx.lineTo(hdrLeft - W * 0.025, headerBaseY - H * 0.01);
      ctx.lineTo(hdrLeft + W * 0.03, headerBaseY - H * 0.042);
      ctx.closePath();
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(hdrRight, headerBaseY + H * 0.032);
      ctx.lineTo(hdrRight + W * 0.025, headerBaseY - H * 0.01);
      ctx.lineTo(hdrRight - W * 0.03, headerBaseY - H * 0.042);
      ctx.closePath();
      ctx.fill();

      // Draper conveyor belt crop stream flowing toward center feederhouse
      if (st.activelyCutting) {
        const flowOffset = (tNow * 140) % 28;
        ctx.strokeStyle = cropMeta.topColor;
        ctx.globalAlpha = 0.72;
        ctx.lineWidth = 3;
        for (let x = hdrLeft + W * 0.05; x < hdrCenter - W * 0.05; x += 28) {
          ctx.beginPath();
          ctx.moveTo(x + flowOffset, headerBaseY + 6);
          ctx.lineTo(x + flowOffset + 14, headerBaseY + 6);
          ctx.stroke();
        }
        for (let x = hdrRight - W * 0.05; x > hdrCenter + W * 0.05; x -= 28) {
          ctx.beginPath();
          ctx.moveTo(x - flowOffset, headerBaseY + 6);
          ctx.lineTo(x - flowOffset - 14, headerBaseY + 6);
          ctx.stroke();
        }
        ctx.globalAlpha = 1;
      }

      // Spinning 6-bar Pickup Reel + Tines (3D cylindrical rotation!)
      const reelCenterY = headerBaseY - H * 0.068;
      const reelRadiusY = H * 0.042;
      const reelLeft = hdrLeft + W * 0.025;
      const reelRight = hdrRight - W * 0.025;

      // Reel support arms
      ctx.strokeStyle = '#2d372c';
      ctx.lineWidth = 6;
      ctx.beginPath();
      ctx.moveTo(reelLeft + 10, headerBaseY - H * 0.03);
      ctx.lineTo(reelLeft, reelCenterY);
      ctx.moveTo(reelRight - 10, headerBaseY - H * 0.03);
      ctx.lineTo(reelRight, reelCenterY);
      ctx.stroke();

      // Central reel axle tube
      ctx.strokeStyle = '#20261e';
      ctx.lineWidth = 7;
      ctx.beginPath();
      ctx.moveTo(reelLeft, reelCenterY);
      ctx.lineTo(reelRight, reelCenterY);
      ctx.stroke();

      // 6 rotating reel bat bars with steel pickup tines
      for (let b = 0; b < 6; b++) {
        const ang = st.reelPhase + (b / 6) * Math.PI * 2;
        const barY = reelCenterY + Math.sin(ang) * reelRadiusY;
        const frontness = Math.cos(ang); // >0 = closer to windshield
        ctx.strokeStyle = frontness > 0 ? '#e6c54a' : '#857432';
        ctx.lineWidth = frontness > 0 ? 3.2 : 1.8;
        ctx.beginPath();
        ctx.moveTo(reelLeft, barY);
        ctx.lineTo(reelRight, barY);
        ctx.stroke();

        // Pickup tines hanging down from front bars
        if (frontness > -0.2) {
          ctx.strokeStyle = frontness > 0 ? 'rgba(25,28,24,0.85)' : 'rgba(25,28,24,0.45)';
          ctx.lineWidth = 1.4;
          const tineLen = 10 + frontness * 6;
          for (let tx = reelLeft + 16; tx < reelRight - 12; tx += 22) {
            ctx.beginPath();
            ctx.moveTo(tx, barY);
            ctx.lineTo(tx, barY + tineLen);
            ctx.stroke();
          }
        }
      }

      // Header width indicator pill right on the header hood
      ctx.font = '600 10px "JetBrains Mono", monospace';
      ctx.fillStyle = 'rgba(216, 242, 116, 0.78)';
      ctx.textAlign = 'center';
      ctx.fillText(
        `RD40F · ${Math.round(HEADER_WIDTH_M * 3.28084)}FT · HDR ${Math.round(st.headerHeightIn)}"`,
        hdrCenter,
        headerBaseY - H * 0.015
      );
      ctx.restore();

      // ─── 9. LIVE HARVEST CHAFF & DUST PLUME PARTICLES ───
      const particles = particlesRef.current;
      if (st.activelyCutting && particles.length < 75) {
        for (let k = 0; k < 3; k++) {
          particles.push({
            x: hdrLeft + Math.random() * hdrW,
            y: headerBaseY - H * 0.02 + Math.random() * 14,
            vx: (Math.random() - 0.5) * 1.4 + (weather.windMph * 0.05),
            vy: -0.9 - Math.random() * 1.8,
            size: 2.5 + Math.random() * 6,
            alpha: 0.32 + Math.random() * 0.28,
            life: 1,
          });
        }
      }
      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.x += p.vx;
        p.y += p.vy;
        p.size += 0.14;
        p.life -= 0.022;
        if (p.life <= 0) {
          particles.splice(i, 1);
          continue;
        }
        ctx.fillStyle =
          parcel.crop === 'Upland Cotton'
            ? `rgba(242, 238, 224, ${p.alpha * p.life})`
            : `rgba(215, 192, 138, ${p.alpha * p.life})`;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
      }

      // ─── 10. PANORAMIC COMBINE CAB INTERIOR FRAME (A-PILLARS, ROOF VISOR, WIPER) ───
      ctx.save();
      // Animated windshield wiper blade
      if (st.wiperOn) {
        const pivotX = W * 0.5;
        const pivotY = H * 0.04;
        const sweepAng = Math.PI * 0.5 + Math.sin(st.wiperPhase) * 0.82;
        const len = H * 0.44;
        ctx.strokeStyle = 'rgba(20, 22, 20, 0.88)';
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.moveTo(pivotX, pivotY);
        ctx.lineTo(pivotX + Math.cos(sweepAng) * len, pivotY + Math.sin(sweepAng) * len);
        ctx.stroke();
      }

      // Subtle curved tinted glass reflection at top edge
      const glassGrad = ctx.createLinearGradient(0, 0, 0, H * 0.18);
      glassGrad.addColorStop(0, 'rgba(10, 14, 12, 0.65)');
      glassGrad.addColorStop(0.5, 'rgba(16, 22, 18, 0.18)');
      glassGrad.addColorStop(1, 'rgba(16, 22, 18, 0)');
      ctx.fillStyle = glassGrad;
      ctx.fillRect(0, 0, W, H * 0.18);

      // Left curved matte A-pillar
      const pillarGradL = ctx.createLinearGradient(0, 0, W * 0.055, 0);
      pillarGradL.addColorStop(0, '#0d0f0d');
      pillarGradL.addColorStop(0.7, '#1a1e1a');
      pillarGradL.addColorStop(1, '#262b26');
      ctx.fillStyle = pillarGradL;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(W * 0.048, 0);
      ctx.quadraticCurveTo(W * 0.032, H * 0.45, W * 0.058, H);
      ctx.lineTo(0, H);
      ctx.closePath();
      ctx.fill();

      // Right curved matte A-pillar (houses the Cornerpost OLED display!)
      const pillarGradR = ctx.createLinearGradient(W, 0, W * 0.945, 0);
      pillarGradR.addColorStop(0, '#0d0f0d');
      pillarGradR.addColorStop(0.7, '#1a1e1a');
      pillarGradR.addColorStop(1, '#262b26');
      ctx.fillStyle = pillarGradR;
      ctx.beginPath();
      ctx.moveTo(W, 0);
      ctx.lineTo(W * 0.952, 0);
      ctx.quadraticCurveTo(W * 0.968, H * 0.45, W * 0.942, H);
      ctx.lineTo(W, H);
      ctx.closePath();
      ctx.fill();

      // Bottom dashboard cowl shelf
      const dashGrad = ctx.createLinearGradient(0, H * 0.87, 0, H);
      dashGrad.addColorStop(0, 'rgba(14, 17, 14, 0.0)');
      dashGrad.addColorStop(0.32, 'rgba(14, 17, 14, 0.82)');
      dashGrad.addColorStop(1, 'rgba(10, 12, 10, 0.98)');
      ctx.fillStyle = dashGrad;
      ctx.fillRect(0, H * 0.85, W, H * 0.15);

      // Subtle amber roof beacon glow reflection on top edge when separator/lights active
      if (st.separatorOn || st.workLightsOn) {
        const pulse = Math.max(0, Math.sin(st.beaconPhase));
        if (pulse > 0.2) {
          const bGrad = ctx.createRadialGradient(W * 0.5, 0, 10, W * 0.5, 0, W * 0.35);
          bGrad.addColorStop(0, `rgba(240, 175, 56, ${pulse * 0.14})`);
          bGrad.addColorStop(1, 'rgba(240, 175, 56, 0)');
          ctx.fillStyle = bGrad;
          ctx.fillRect(0, 0, W, H * 0.22);
        }
      }
      ctx.restore();
    };

    rafId = requestAnimationFrame(drawFrame);
    return () => {
      cancelAnimationFrame(rafId);
      window.removeEventListener('resize', resize);
    };
  }, [parcel, weather.windMph, stateRef, waypointsRef, gridRef, projRef]);

  return (
    <canvas
      ref={canvasRef}
      className="h-full w-full block select-none"
      aria-label="First-person combine harvester panoramic cab windshield view"
    />
  );
};
