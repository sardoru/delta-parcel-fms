import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowCounterClockwise,
  ArrowsClockwise,
  Compass,
  Crosshair,
  Drop,
  Engine,
  Eye,
  GasPump,
  Gauge,
  Lamp,
  MapPin,
  MoonStars,
  NavigationArrow,
  Path,
  Play,
  SpeakerHigh,
  SpeakerSlash,
  Stop,
  Sun,
  Trash,
  Warning,
  X,
} from '@phosphor-icons/react';
import { LiveWeather, Parcel } from '../types/farm';
import {
  buildFieldProjection,
  buildHarvestGrid,
  CombineState,
  CombineWaypoint,
  ControlInput,
  createInitialCombineState,
  generateAutoSwathWaypoints,
  getCropDisplayMeta,
  HEADER_WIDTH_M,
  localToLngLat,
  MAX_STEER_RAD,
  MS_TO_MPH,
  stepCombinePhysics,
} from '../utils/combineSim';
import { CombineWindshieldCanvas } from './CombineWindshieldCanvas';

interface CombineCabSimulatorProps {
  parcel: Parcel;
  weather: LiveWeather;
  onExit: (harvestedAcres: number, harvestedUnits: number, unitLabel: string) => void;
}

interface TelemetrySnapshot {
  speedMph: number;
  throttle: number;
  headingDeg: number;
  lat: number;
  lng: number;
  steerDeg: number;
  wheelDeg: number;
  engineRpm: number;
  engineLoadPct: number;
  separatorOn: boolean;
  headerDown: boolean;
  headerHeightIn: number;
  reelRpm: number;
  rotorRpm: number;
  concaveMm: number;
  fanRpm: number;
  grainTankPct: number;
  grainTankUnits: number;
  unloadingAugerOn: boolean;
  fuelPct: number;
  defPct: number;
  coolantF: number;
  shoeLossPct: number;
  rotorLossPct: number;
  liveYieldRate: number;
  moisturePct: number;
  harvestedAcres: number;
  parcelPctDone: number;
  activelyCutting: boolean;
  autopilotOn: boolean;
  activeWaypointIdx: number;
  xteInches: number;
  distToWaypointFt: number;
  autopilotStatus: string;
  workLightsOn: boolean;
  wiperOn: boolean;
  duskMode: boolean;
}

function compassLabel(deg: number): string {
  const dirs = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
  return dirs[Math.round(((deg % 360) + 360) % 360 / 45) % 8];
}

export const CombineCabSimulator: React.FC<CombineCabSimulatorProps> = ({
  parcel,
  weather,
  onExit,
}) => {
  const proj = useMemo(() => buildFieldProjection(parcel), [parcel]);
  const cropMeta = useMemo(() => getCropDisplayMeta(parcel.crop), [parcel.crop]);

  const initialWps = useMemo(() => generateAutoSwathWaypoints(proj, HEADER_WIDTH_M * 1.15, 8), [proj]);
  const [waypoints, setWaypoints] = useState<CombineWaypoint[]>(initialWps);
  const [loopWaypoints, setLoopWaypoints] = useState(false);
  const [showArHud, setShowArHud] = useState(true);
  const [audioEnabled, setAudioEnabled] = useState(false);
  const [ccTab, setCcTab] = useState<'guidance' | 'machine'>('guidance');

  const projRef = useRef(proj);
  projRef.current = proj;
  const gridRef = useRef(buildHarvestGrid(proj, parcel));
  const waypointsRef = useRef<CombineWaypoint[]>(waypoints);
  waypointsRef.current = waypoints;
  const loopRef = useRef(loopWaypoints);
  loopRef.current = loopWaypoints;

  const stateRef = useRef<CombineState>(createInitialCombineState(proj, initialWps, parcel));
  const inputRef = useRef<ControlInput>({
    forward: false,
    reverse: false,
    left: false,
    right: false,
    brake: false,
    manualSteerAxis: null,
  });

  // Web Audio diesel engine + separator synthesizer (optional, click to enable)
  const audioCtxRef = useRef<{
    ctx: AudioContext;
    osc: OscillatorNode;
    subOsc: OscillatorNode;
    gain: GainNode;
    filter: BiquadFilterNode;
  } | null>(null);

  const playChime = useCallback((freq = 780, duration = 0.14) => {
    const a = audioCtxRef.current;
    if (!a) return;
    try {
      const o = a.ctx.createOscillator();
      const g = a.ctx.createGain();
      o.type = 'sine';
      o.frequency.value = freq;
      g.gain.setValueAtTime(0.08, a.ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001, a.ctx.currentTime + duration);
      o.connect(g);
      g.connect(a.ctx.destination);
      o.start();
      o.stop(a.ctx.currentTime + duration);
    } catch {
      // ignore audio errors
    }
  }, []);

  const toggleAudio = useCallback(() => {
    if (audioEnabled) {
      if (audioCtxRef.current) {
        audioCtxRef.current.ctx.close().catch(() => {});
        audioCtxRef.current = null;
      }
      setAudioEnabled(false);
      return;
    }
    try {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const subOsc = ctx.createOscillator();
      const filter = ctx.createBiquadFilter();
      const gain = ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.value = 54;
      subOsc.type = 'triangle';
      subOsc.frequency.value = 27;
      filter.type = 'lowpass';
      filter.frequency.value = 175;
      gain.gain.value = 0.045;
      osc.connect(filter);
      subOsc.connect(filter);
      filter.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      subOsc.start();
      audioCtxRef.current = { ctx, osc, subOsc, gain, filter };
      setAudioEnabled(true);
    } catch {
      setAudioEnabled(false);
    }
  }, [audioEnabled]);

  useEffect(() => {
    return () => {
      if (audioCtxRef.current) {
        audioCtxRef.current.ctx.close().catch(() => {});
        audioCtxRef.current = null;
      }
    };
  }, []);

  const [snap, setSnap] = useState<TelemetrySnapshot>(() => {
    const s = stateRef.current;
    const ll = localToLngLat(proj, s.x, s.z);
    return {
      speedMph: 0,
      throttle: 0,
      headingDeg: ((s.heading * 180) / Math.PI + 360) % 360,
      lat: ll.lat,
      lng: ll.lng,
      steerDeg: 0,
      wheelDeg: 0,
      engineRpm: s.engineRpm,
      engineLoadPct: s.engineLoadPct,
      separatorOn: s.separatorOn,
      headerDown: s.headerDown,
      headerHeightIn: s.headerHeightIn,
      reelRpm: s.reelRpm,
      rotorRpm: s.rotorRpm,
      concaveMm: s.concaveMm,
      fanRpm: s.fanRpm,
      grainTankPct: s.grainTankPct,
      grainTankUnits: s.grainTankUnits,
      unloadingAugerOn: s.unloadingAugerOn,
      fuelPct: s.fuelPct,
      defPct: s.defPct,
      coolantF: s.coolantF,
      shoeLossPct: s.shoeLossPct,
      rotorLossPct: s.rotorLossPct,
      liveYieldRate: s.liveYieldRate,
      moisturePct: s.moisturePct,
      harvestedAcres: s.harvestedAcres,
      parcelPctDone: 0,
      activelyCutting: s.activelyCutting,
      autopilotOn: s.autopilotOn,
      activeWaypointIdx: s.activeWaypointIdx,
      xteInches: s.xteInches,
      distToWaypointFt: s.distToWaypointFt,
      autopilotStatus: s.autopilotStatus,
      workLightsOn: s.workLightsOn,
      wiperOn: s.wiperOn,
      duskMode: s.duskMode,
    };
  });

  // Machine toggle actions
  const toggleSeparator = useCallback(() => {
    const s = stateRef.current;
    s.separatorOn = !s.separatorOn;
    playChime(s.separatorOn ? 640 : 420, 0.12);
  }, [playChime]);

  const toggleHeader = useCallback(() => {
    const s = stateRef.current;
    s.headerDown = !s.headerDown;
    playChime(s.headerDown ? 520 : 680, 0.1);
  }, [playChime]);

  const toggleAutopilot = useCallback(() => {
    const s = stateRef.current;
    if (s.autopilotOn) {
      s.autopilotOn = false;
      s.autopilotStatus = 'STANDBY · MANUAL CONTROL';
      playChime(390, 0.14);
      return;
    }
    let wps = waypointsRef.current;
    if (wps.length === 0) {
      wps = generateAutoSwathWaypoints(projRef.current, HEADER_WIDTH_M * 1.15, 8);
      waypointsRef.current = wps;
      setWaypoints(wps);
      s.activeWaypointIdx = 0;
    } else if (s.activeWaypointIdx >= wps.length) {
      s.activeWaypointIdx = 0;
    }
    s.autopilotOn = true;
    s.autopilotStatus = `RTK LOCKED → ${wps[s.activeWaypointIdx]?.label || 'WP-1'}`;
    playChime(880, 0.16);
  }, [playChime]);

  const handleAutoHarvestQuickStart = useCallback(() => {
    const s = stateRef.current;
    let wps = waypointsRef.current;
    if (wps.length === 0) {
      wps = generateAutoSwathWaypoints(projRef.current, HEADER_WIDTH_M * 1.15, 8);
      waypointsRef.current = wps;
      setWaypoints(wps);
      s.activeWaypointIdx = 0;
    } else if (s.activeWaypointIdx >= wps.length) {
      s.activeWaypointIdx = 0;
    }
    s.separatorOn = true;
    s.headerDown = true;
    s.unloadingAugerOn = false;
    s.autopilotOn = true;
    s.autopilotStatus = `RTK LOCKED → ${wps[s.activeWaypointIdx]?.label || 'WP-1'}`;
    playChime(920, 0.18);
  }, [playChime]);

  const toggleUnload = useCallback(() => {
    const s = stateRef.current;
    s.unloadingAugerOn = !s.unloadingAugerOn;
    playChime(s.unloadingAugerOn ? 720 : 460, 0.12);
  }, [playChime]);

  const toggleLights = useCallback(() => {
    stateRef.current.workLightsOn = !stateRef.current.workLightsOn;
  }, []);

  const toggleDusk = useCallback(() => {
    const s = stateRef.current;
    s.duskMode = !s.duskMode;
    if (s.duskMode) s.workLightsOn = true;
  }, []);

  const toggleWiper = useCallback(() => {
    stateRef.current.wiperOn = !stateRef.current.wiperOn;
  }, []);

  const handleStopAll = useCallback(() => {
    const s = stateRef.current;
    s.autopilotOn = false;
    s.throttle = 0;
    s.speedMs = 0;
    s.autopilotStatus = 'EMERGENCY STOP · PARK';
    playChime(320, 0.2);
  }, [playChime]);

  const handleExitCab = useCallback(() => {
    const s = stateRef.current;
    onExit(
      Number(s.harvestedAcres.toFixed(2)),
      Math.round(s.harvestedAcres * (s.liveYieldRate > 10 ? s.liveYieldRate : cropMeta.baseYield)),
      cropMeta.tankUnit
    );
  }, [onExit, cropMeta]);

  // Keyboard bindings (WASD, Arrows, Space, P, H, E, U, L, M, ESC)
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      const k = e.key.toLowerCase();
      if (k === 'w' || e.key === 'ArrowUp') {
        e.preventDefault();
        inputRef.current.forward = true;
      } else if (k === 's' || e.key === 'ArrowDown') {
        e.preventDefault();
        inputRef.current.reverse = true;
      } else if (k === 'a' || e.key === 'ArrowLeft') {
        e.preventDefault();
        inputRef.current.left = true;
      } else if (k === 'd' || e.key === 'ArrowRight') {
        e.preventDefault();
        inputRef.current.right = true;
      } else if (k === ' ') {
        e.preventDefault();
        inputRef.current.brake = true;
        stateRef.current.autopilotOn = false;
      } else if (k === 'p' && !e.repeat) {
        toggleAutopilot();
      } else if (k === 'h' && !e.repeat) {
        toggleHeader();
      } else if (k === 'e' && !e.repeat) {
        toggleSeparator();
      } else if (k === 'u' && !e.repeat) {
        toggleUnload();
      } else if (k === 'l' && !e.repeat) {
        toggleLights();
      } else if (k === 'm' && !e.repeat) {
        toggleAudio();
      } else if (e.key === 'Escape') {
        handleExitCab();
      }
    };
    const onKeyUp = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase();
      if (k === 'w' || e.key === 'ArrowUp') inputRef.current.forward = false;
      if (k === 's' || e.key === 'ArrowDown') inputRef.current.reverse = false;
      if (k === 'a' || e.key === 'ArrowLeft') inputRef.current.left = false;
      if (k === 'd' || e.key === 'ArrowRight') inputRef.current.right = false;
      if (k === ' ') inputRef.current.brake = false;
    };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
  }, [toggleAutopilot, toggleHeader, toggleSeparator, toggleUnload, toggleLights, toggleAudio, handleExitCab]);

  // Interactive Steering Wheel Drag
  const wheelDragRef = useRef<{ active: boolean; startX: number } | null>(null);
  const handleWheelPointerDown = (e: React.PointerEvent) => {
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    wheelDragRef.current = { active: true, startX: e.clientX };
  };
  const handleWheelPointerMove = (e: React.PointerEvent) => {
    if (!wheelDragRef.current?.active) return;
    const dx = e.clientX - wheelDragRef.current.startX;
    inputRef.current.manualSteerAxis = Math.max(-1, Math.min(1, dx / 72));
  };
  const handleWheelPointerUp = () => {
    wheelDragRef.current = null;
    inputRef.current.manualSteerAxis = null;
  };

  // Interactive CommandCenter Minimap Canvas
  const mapCanvasRef = useRef<HTMLCanvasElement>(null);

  const mapTransformRef = useRef({
    scale: 1,
    offsetX: 0,
    offsetY: 0,
    minX: proj.minX,
    maxZ: proj.maxZ,
  });

  // Clicking anywhere on the CommandCenter parcel map drops a numbered Autopilot Waypoint!
  const handleMinimapClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = mapCanvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const dpr = canvas.width / rect.width;
    const cx = (e.clientX - rect.left) * dpr;
    const cy = (e.clientY - rect.top) * dpr;
    const tf = mapTransformRef.current;
    const wx = tf.minX + (cx - tf.offsetX) / tf.scale;
    const wz = tf.maxZ - (cy - tf.offsetY) / tf.scale;

    setWaypoints((prev) => {
      const nextWp: CombineWaypoint = {
        id: prev.length + 1,
        x: Number(wx.toFixed(1)),
        z: Number(wz.toFixed(1)),
        label: `WP-${prev.length + 1}`,
      };
      const updated = [...prev, nextWp];
      waypointsRef.current = updated;
      if (stateRef.current.activeWaypointIdx >= updated.length - 1 && prev.length === 0) {
        stateRef.current.activeWaypointIdx = 0;
      }
      if (!stateRef.current.autopilotOn) {
        stateRef.current.autopilotStatus = `${updated.length} WAYPOINTS · PRESS P TO ENGAGE`;
      }
      return updated;
    });
    playChime(740, 0.08);
  };

  // Main 60fps Physics + Minimap Render + 15Hz React Telemetry Sync Loop
  useEffect(() => {
    let rafId = 0;
    let lastTime = performance.now();
    let lastUiSync = 0;

    const tick = (now: number) => {
      rafId = requestAnimationFrame(tick);
      const dt = (now - lastTime) / 1000;
      lastTime = now;

      stateRef.current = stepCombinePhysics(
        stateRef.current,
        inputRef.current,
        waypointsRef.current,
        loopRef.current,
        gridRef.current,
        projRef.current,
        parcel,
        dt
      );

      // Update Web Audio engine pitch if audio enabled
      if (audioCtxRef.current) {
        const rpmNorm = (stateRef.current.engineRpm - 900) / 1400;
        const baseFreq = 46 + rpmNorm * 44;
        audioCtxRef.current.osc.frequency.setTargetAtTime(baseFreq, audioCtxRef.current.ctx.currentTime, 0.08);
        audioCtxRef.current.subOsc.frequency.setTargetAtTime(baseFreq * 0.5, audioCtxRef.current.ctx.currentTime, 0.08);
        audioCtxRef.current.filter.frequency.setTargetAtTime(
          140 + (stateRef.current.separatorOn ? 110 : 0) + stateRef.current.engineLoadPct * 1.6,
          audioCtxRef.current.ctx.currentTime,
          0.1
        );
      }

      // Draw CommandCenter Touchscreen Live Parcel & Waypoint Map
      const mc = mapCanvasRef.current;
      if (mc) {
        const mctx = mc.getContext('2d');
        const rect = mc.getBoundingClientRect();
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        const mw = Math.max(180, Math.round(rect.width * dpr));
        const mh = Math.max(140, Math.round(rect.height * dpr));
        if (mc.width !== mw || mc.height !== mh) {
          mc.width = mw;
          mc.height = mh;
        }
        if (mctx) {
          const p = projRef.current;
          const g = gridRef.current;
          const st = stateRef.current;
          const wps = waypointsRef.current;

          mctx.fillStyle = '#0d120e';
          mctx.fillRect(0, 0, mw, mh);

          // Subtle precision-ag coordinate grid
          mctx.strokeStyle = 'rgba(216, 242, 116, 0.06)';
          mctx.lineWidth = 1;
          for (let gx = 0; gx < mw; gx += 26) {
            mctx.beginPath();
            mctx.moveTo(gx, 0);
            mctx.lineTo(gx, mh);
            mctx.stroke();
          }
          for (let gy = 0; gy < mh; gy += 26) {
            mctx.beginPath();
            mctx.moveTo(0, gy);
            mctx.lineTo(mw, gy);
            mctx.stroke();
          }

          const pad = 22 * dpr;
          const scale = Math.min((mw - pad * 2) / p.widthM, (mh - pad * 2) / p.heightM);
          const offsetX = (mw - p.widthM * scale) * 0.5;
          const offsetY = (mh - p.heightM * scale) * 0.5;
          mapTransformRef.current = { scale, offsetX, offsetY, minX: p.minX, maxZ: p.maxZ };

          const toScreen = (wx: number, wz: number) => ({
            x: offsetX + (wx - p.minX) * scale,
            y: offsetY + (p.maxZ - wz) * scale,
          });

          // Parcel polygon fill
          if (p.polygon.length >= 3) {
            mctx.beginPath();
            p.polygon.forEach((pt, idx) => {
              const sp = toScreen(pt.x, pt.z);
              if (idx === 0) mctx.moveTo(sp.x, sp.y);
              else mctx.lineTo(sp.x, sp.y);
            });
            mctx.closePath();
            mctx.fillStyle = 'rgba(66, 86, 48, 0.42)';
            mctx.fill();
            mctx.strokeStyle = 'rgba(216, 242, 116, 0.72)';
            mctx.lineWidth = 1.6 * dpr;
            mctx.stroke();
          }

          // Paint LIVE Harvested Coverage Yield Map!
          const cellPx = Math.max(2, g.cellSizeM * scale);
          for (let r = 0; r < g.rows; r++) {
            const wz = g.minZ + (r + 0.5) * g.cellSizeM;
            for (let c = 0; c < g.cols; c++) {
              const idx = r * g.cols + c;
              if (g.cells[idx] === 2) {
                const wx = g.minX + (c + 0.5) * g.cellSizeM;
                const sp = toScreen(wx, wz);
                const yf = g.yieldMap[idx];
                mctx.fillStyle =
                  yf > 1.04
                    ? 'rgba(130, 232, 118, 0.85)'
                    : yf > 0.9
                    ? 'rgba(216, 242, 116, 0.82)'
                    : 'rgba(240, 187, 102, 0.82)';
                mctx.fillRect(sp.x - cellPx * 0.5, sp.y - cellPx * 0.5, cellPx + 0.6, cellPx + 0.6);
              }
            }
          }

          // Draw Autopilot Waypoint Path
          if (wps.length > 0) {
            mctx.save();
            mctx.strokeStyle = st.autopilotOn ? '#d8f274' : 'rgba(94, 200, 235, 0.85)';
            mctx.lineWidth = 1.8 * dpr;
            mctx.setLineDash([5 * dpr, 4 * dpr]);
            mctx.beginPath();
            wps.forEach((wp, idx) => {
              const sp = toScreen(wp.x, wp.z);
              if (idx === 0) mctx.moveTo(sp.x, sp.y);
              else mctx.lineTo(sp.x, sp.y);
            });
            if (loopRef.current && wps.length >= 2) {
              const sp0 = toScreen(wps[0].x, wps[0].z);
              mctx.lineTo(sp0.x, sp0.y);
            }
            mctx.stroke();
            mctx.setLineDash([]);

            // Line from combine to active waypoint
            if (st.activeWaypointIdx < wps.length) {
              const cur = toScreen(st.x, st.z);
              const tgt = toScreen(wps[st.activeWaypointIdx].x, wps[st.activeWaypointIdx].z);
              mctx.strokeStyle = st.autopilotOn ? '#f2ffaa' : '#f0bb66';
              mctx.lineWidth = 1.6 * dpr;
              mctx.beginPath();
              mctx.moveTo(cur.x, cur.y);
              mctx.lineTo(tgt.x, tgt.y);
              mctx.stroke();
            }

            // Numbered Waypoint Nodes
            wps.forEach((wp, idx) => {
              const sp = toScreen(wp.x, wp.z);
              const isActive = idx === st.activeWaypointIdx;
              const isDone = idx < st.activeWaypointIdx;
              mctx.beginPath();
              mctx.arc(sp.x, sp.y, (isActive ? 6.5 : 4.8) * dpr, 0, Math.PI * 2);
              mctx.fillStyle = isActive ? '#d8f274' : isDone ? '#4d8a5c' : '#18242b';
              mctx.fill();
              mctx.strokeStyle = isActive ? '#ffffff' : '#5ec8eb';
              mctx.lineWidth = 1.3 * dpr;
              mctx.stroke();

              mctx.font = `700 ${Math.round(7.5 * dpr)}px "JetBrains Mono", monospace`;
              mctx.fillStyle = isActive ? '#12160f' : '#e6f5fa';
              mctx.textAlign = 'center';
              mctx.textBaseline = 'middle';
              mctx.fillText(String(idx + 1), sp.x, sp.y + 0.5);
            });
            mctx.restore();
          }

          // Combine Icon + 40-ft Header Bar + Heading Cone
          const cPos = toScreen(st.x, st.z);
          mctx.save();
          mctx.translate(cPos.x, cPos.y);
          mctx.rotate(st.heading);
          // Forward RTK view cone
          mctx.fillStyle = st.autopilotOn ? 'rgba(216, 242, 116, 0.22)' : 'rgba(255, 255, 255, 0.14)';
          mctx.beginPath();
          mctx.moveTo(0, 0);
          mctx.lineTo(-14 * dpr, -28 * dpr);
          mctx.lineTo(14 * dpr, -28 * dpr);
          mctx.closePath();
          mctx.fill();
          // 40-ft front header bar
          const hdrHalfPx = Math.max(8 * dpr, HEADER_WIDTH_M * 0.5 * scale);
          mctx.strokeStyle = st.headerDown ? '#d8f274' : '#f0bb66';
          mctx.lineWidth = 3 * dpr;
          mctx.beginPath();
          mctx.moveTo(-hdrHalfPx, -5 * dpr);
          mctx.lineTo(hdrHalfPx, -5 * dpr);
          mctx.stroke();
          // Combine body
          mctx.fillStyle = '#f5f8ee';
          mctx.strokeStyle = '#182214';
          mctx.lineWidth = 1.5 * dpr;
          mctx.beginPath();
          mctx.moveTo(0, -6 * dpr);
          mctx.lineTo(4.5 * dpr, 5 * dpr);
          mctx.lineTo(-4.5 * dpr, 5 * dpr);
          mctx.closePath();
          mctx.fill();
          mctx.stroke();
          mctx.restore();

          // North arrow badge
          mctx.font = `600 ${Math.round(9 * dpr)}px "JetBrains Mono", monospace`;
          mctx.fillStyle = 'rgba(220, 226, 212, 0.65)';
          mctx.textAlign = 'right';
          mctx.fillText('N ▲', mw - 8 * dpr, 14 * dpr);
        }
      }

      // Sync React HUD telemetry at ~16Hz
      if (now - lastUiSync > 62) {
        lastUiSync = now;
        const s = stateRef.current;
        const ll = localToLngLat(projRef.current, s.x, s.z);
        const pctDone =
          gridRef.current.totalCropCells > 0
            ? (gridRef.current.harvestedCells / gridRef.current.totalCropCells) * 100
            : 0;
        setSnap({
          speedMph: Number((s.speedMs * MS_TO_MPH).toFixed(1)),
          throttle: s.throttle,
          headingDeg: ((s.heading * 180) / Math.PI + 360) % 360,
          lat: ll.lat,
          lng: ll.lng,
          steerDeg: Math.round((s.steerAngle / MAX_STEER_RAD) * 35),
          wheelDeg: s.wheelDeg,
          engineRpm: Math.round(s.engineRpm),
          engineLoadPct: Math.round(s.engineLoadPct),
          separatorOn: s.separatorOn,
          headerDown: s.headerDown,
          headerHeightIn: Math.round(s.headerHeightIn),
          reelRpm: s.reelRpm,
          rotorRpm: s.rotorRpm,
          concaveMm: s.concaveMm,
          fanRpm: s.fanRpm,
          grainTankPct: Math.round(s.grainTankPct),
          grainTankUnits: Math.round(s.grainTankUnits),
          unloadingAugerOn: s.unloadingAugerOn,
          fuelPct: Math.round(s.fuelPct),
          defPct: Math.round(s.defPct),
          coolantF: Math.round(s.coolantF),
          shoeLossPct: Number(s.shoeLossPct.toFixed(1)),
          rotorLossPct: Number(s.rotorLossPct.toFixed(1)),
          liveYieldRate: Math.round(s.liveYieldRate),
          moisturePct: s.moisturePct,
          harvestedAcres: Number(s.harvestedAcres.toFixed(2)),
          parcelPctDone: Number(pctDone.toFixed(1)),
          activelyCutting: s.activelyCutting,
          autopilotOn: s.autopilotOn,
          activeWaypointIdx: s.activeWaypointIdx,
          xteInches: s.xteInches,
          distToWaypointFt: s.distToWaypointFt,
          autopilotStatus: s.autopilotStatus,
          workLightsOn: s.workLightsOn,
          wiperOn: s.wiperOn,
          duskMode: s.duskMode,
        });
      }
    };

    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [parcel]);

  const driveGear =
    snap.speedMph < -0.1 ? 'R1' : snap.speedMph < 0.1 ? 'N' : snap.speedMph < 6.5 ? 'F1' : 'F2';

  return (
    <div className="fixed inset-0 z-50 flex flex-col overflow-hidden bg-[#0a0c0a] text-[#f3f5ef] select-none">
      {/* FULL-SCREEN FIRST-PERSON PANORAMIC COMBINE WINDSHIELD */}
      <div className="absolute inset-0">
        <CombineWindshieldCanvas
          stateRef={stateRef}
          waypointsRef={waypointsRef}
          gridRef={gridRef}
          projRef={projRef}
          parcel={parcel}
          weather={weather}
          showArHud={showArHud}
        />
      </div>

      {/* ─── TOP OVERHEAD CAB ROOF CONSOLE ─── */}
      <div className="pointer-events-none relative z-20 flex flex-wrap items-center justify-between gap-2 px-3 pt-2.5 sm:px-5">
        {/* Left: Cab Identity + Active Real MARIS Parcel */}
        <div className="pointer-events-auto flex items-center gap-2.5 rounded-2xl border border-white/14 bg-[#111510]/88 px-3.5 py-2 shadow-[0_12px_32px_rgba(0,0,0,0.65)] backdrop-blur-xl">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl border border-[#d8f274]/40 bg-[#d8f274]/14 text-[#d8f274]">
            <Compass size={18} weight="duotone" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[13px] font-semibold tracking-tight text-[#f5f8ee]">
                X9 1100 Combine Cab
              </span>
              <span className="rounded-full bg-[#d8f274]/16 px-2 py-0.5 font-mono text-[9.5px] font-semibold text-[#d8f274]">
                RTK ±0.8&quot;
              </span>
            </div>
            <div className="font-mono text-[10.5px] text-[#dce2d4]/68">
              {parcel.name} · {parcel.crop} · {parcel.cultivatedAcres} ac
            </div>
          </div>
        </div>

        {/* Center: Live Heading Tape & RTK GPS Strip */}
        <div className="pointer-events-auto hidden items-center gap-4 rounded-2xl border border-white/12 bg-[#101410]/84 px-4 py-1.5 backdrop-blur-xl lg:flex">
          <div className="flex items-center gap-1.5 font-mono text-[11px]">
            <NavigationArrow size={13} weight="fill" className="text-[#d8f274]" />
            <span className="tabular-nums font-semibold text-[#f3f5ef]">
              {String(Math.round(snap.headingDeg)).padStart(3, '0')}° {compassLabel(snap.headingDeg)}
            </span>
          </div>
          <span className="h-3.5 w-px bg-white/15" />
          <div className="font-mono text-[11px] tabular-nums text-[#dce2d4]/80">
            {snap.lat.toFixed(5)}°N, {Math.abs(snap.lng).toFixed(5)}°W
          </div>
          <span className="h-3.5 w-px bg-white/15" />
          <div className="flex items-center gap-1.5 font-mono text-[10.5px]">
            <span
              className={`h-2 w-2 rounded-full ${
                snap.autopilotOn ? 'animate-pulse bg-[#d8f274]' : 'bg-[#5ec8eb]'
              }`}
            />
            <span className={snap.autopilotOn ? 'font-semibold text-[#d8f274]' : 'text-[#b9e6f6]'}>
              {snap.autopilotStatus}
            </span>
          </div>
        </div>

        {/* Right: Overhead Cab Switches + Exit Cab */}
        <div className="pointer-events-auto flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => setShowArHud((v) => !v)}
            title="Toggle AR Windshield Guidance Overlay"
            className={`flex h-9 items-center gap-1.5 rounded-full border px-3 text-[11px] font-medium backdrop-blur-xl transition-all ${
              showArHud
                ? 'border-[#d8f274]/50 bg-[#1a2216]/88 text-[#d8f274]'
                : 'border-white/14 bg-[#121612]/80 text-[#dce2d4]/70 hover:text-white'
            }`}
          >
            <Eye size={14} />
            <span className="hidden sm:inline">AR HUD</span>
          </button>

          <button
            type="button"
            onClick={toggleDusk}
            title="Toggle Day / Dusk Harvest Lighting"
            className={`flex h-9 items-center gap-1.5 rounded-full border px-3 text-[11px] font-medium backdrop-blur-xl transition-all ${
              snap.duskMode
                ? 'border-[#f0bb66]/55 bg-[#241d12]/88 text-[#f0bb66]'
                : 'border-white/14 bg-[#121612]/80 text-[#dce2d4]/80 hover:text-white'
            }`}
          >
            {snap.duskMode ? <MoonStars size={14} weight="fill" /> : <Sun size={14} weight="fill" />}
            <span className="hidden sm:inline">{snap.duskMode ? 'Dusk' : 'Day'}</span>
          </button>

          <button
            type="button"
            onClick={toggleLights}
            title="Toggle LED Cab Work Lights (L)"
            className={`flex h-9 w-9 items-center justify-center rounded-full border backdrop-blur-xl transition-all ${
              snap.workLightsOn
                ? 'border-[#f4e48a]/70 bg-[#2b2814]/90 text-[#f4e48a] shadow-[0_0_16px_rgba(244,228,138,0.35)]'
                : 'border-white/14 bg-[#121612]/80 text-[#dce2d4]/70 hover:text-white'
            }`}
          >
            <Lamp size={15} weight={snap.workLightsOn ? 'fill' : 'regular'} />
          </button>

          <button
            type="button"
            onClick={toggleWiper}
            title="Toggle Windshield Wiper"
            className={`hidden h-9 items-center gap-1 rounded-full border px-2.5 font-mono text-[10.5px] backdrop-blur-xl transition-all sm:flex ${
              snap.wiperOn
                ? 'border-[#5ec8eb]/60 bg-[#132026]/88 text-[#5ec8eb]'
                : 'border-white/14 bg-[#121612]/80 text-[#dce2d4]/65 hover:text-white'
            }`}
          >
            WIPER
          </button>

          <button
            type="button"
            onClick={toggleAudio}
            title="Toggle Diesel Engine & Cab Audio (M)"
            className={`flex h-9 w-9 items-center justify-center rounded-full border backdrop-blur-xl transition-all ${
              audioEnabled
                ? 'border-[#d8f274]/55 bg-[#1b2416]/90 text-[#d8f274]'
                : 'border-white/14 bg-[#121612]/80 text-[#dce2d4]/70 hover:text-white'
            }`}
          >
            {audioEnabled ? <SpeakerHigh size={15} weight="fill" /> : <SpeakerSlash size={15} />}
          </button>

          <button
            type="button"
            onClick={handleExitCab}
            className="flex h-9 items-center gap-1.5 rounded-full border border-white/20 bg-[#1a1d19]/92 px-3.5 text-[11.5px] font-semibold text-[#f5f7f1] backdrop-blur-xl transition-all hover:border-[#df694a]/70 hover:bg-[#2a1a16]"
          >
            <X size={14} weight="bold" />
            <span>Exit Cab</span>
          </button>
        </div>
      </div>

      {/* ─── RIGHT A-PILLAR VERTICAL CORNERPOST OLED DISPLAY (ICONIC COMBINE INSTRUMENT CLUSTER) ─── */}
      <aside className="pointer-events-auto fixed right-3 top-[64px] z-20 hidden w-[164px] flex-col gap-2 rounded-2xl border border-white/15 bg-[#0c100d]/92 p-2.5 shadow-[0_18px_40px_rgba(0,0,0,0.75)] backdrop-blur-xl xl:flex">
        <div className="flex items-center justify-between border-b border-white/10 pb-1.5">
          <span className="font-mono text-[9.5px] font-semibold uppercase tracking-widest text-[#dce2d4]/55">
            CORNERPOST
          </span>
          <span className="rounded bg-[#d8f274]/18 px-1.5 py-0.5 font-mono text-[10px] font-bold text-[#d8f274]">
            {driveGear}
          </span>
        </div>

        {/* Giant Ground Speed Readout */}
        <div className="rounded-xl bg-black/55 px-2.5 py-2 text-center ring-1 ring-white/8">
          <div className="font-mono text-[32px] font-bold leading-none tabular-nums tracking-tight text-[#f5f8ee]">
            {Math.abs(snap.speedMph).toFixed(1)}
          </div>
          <div className="mt-0.5 font-mono text-[9.5px] uppercase tracking-widest text-[#d8f274]">
            {snap.speedMph < -0.1 ? 'REV MPH' : 'GROUND MPH'}
          </div>
        </div>

        {/* Engine RPM & Load */}
        <div className="space-y-1">
          <div className="flex items-center justify-between font-mono text-[10px]">
            <span className="flex items-center gap-1 text-[#dce2d4]/65">
              <Engine size={12} className="text-[#d8f274]" /> RPM
            </span>
            <span className="tabular-nums font-semibold text-[#f3f5ef]">{snap.engineRpm}</span>
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/10">
            <div
              className={`h-full rounded-full transition-all duration-100 ${
                snap.engineLoadPct > 86
                  ? 'bg-[#df694a]'
                  : snap.engineLoadPct > 68
                  ? 'bg-[#f0bb66]'
                  : 'bg-[#d8f274]'
              }`}
              style={{ width: `${Math.min(100, snap.engineLoadPct)}%` }}
            />
          </div>
          <div className="flex justify-between font-mono text-[9px] text-[#dce2d4]/50">
            <span>LOAD {snap.engineLoadPct}%</span>
            <span>{snap.coolantF}°F</span>
          </div>
        </div>

        {/* Grain Tank / Cotton Basket Fill Bar */}
        <div className="rounded-xl bg-white/[0.03] p-2 ring-1 ring-white/8">
          <div className="flex items-center justify-between font-mono text-[10px]">
            <span className="text-[#dce2d4]/65">
              {parcel.crop === 'Upland Cotton' ? 'BASKET' : 'GRAIN TANK'}
            </span>
            <span
              className={`tabular-nums font-bold ${
                snap.grainTankPct >= 95
                  ? 'animate-pulse text-[#df694a]'
                  : snap.grainTankPct >= 78
                  ? 'text-[#f0bb66]'
                  : 'text-[#d8f274]'
              }`}
            >
              {snap.grainTankPct}%
            </span>
          </div>
          <div className="mt-1.5 h-2.5 w-full overflow-hidden rounded-md bg-black/60">
            <div
              className={`h-full transition-all duration-150 ${
                snap.unloadingAugerOn
                  ? 'animate-pulse bg-[#5ec8eb]'
                  : snap.grainTankPct >= 95
                  ? 'bg-[#df694a]'
                  : snap.grainTankPct >= 78
                  ? 'bg-[#f0bb66]'
                  : 'bg-[#d8f274]'
              }`}
              style={{ width: `${Math.min(100, snap.grainTankPct)}%` }}
            />
          </div>
          <div className="mt-1 flex justify-between font-mono text-[9px] text-[#dce2d4]/55">
            <span>{snap.grainTankUnits.toLocaleString()} {cropMeta.tankUnit}</span>
            {snap.unloadingAugerOn && <span className="text-[#5ec8eb]">UNLOADING</span>}
          </div>
        </div>

        {/* Header Height & Loss Monitor */}
        <div className="grid grid-cols-2 gap-1.5">
          <div className="rounded-lg bg-black/45 p-1.5 text-center ring-1 ring-white/8">
            <div className="font-mono text-[8.5px] text-[#dce2d4]/50">HDR HGT</div>
            <div className="mt-0.5 font-mono text-[14px] font-bold tabular-nums text-[#f3f5ef]">
              {snap.headerHeightIn}&quot;
            </div>
            <div className="mt-1 h-1 w-full rounded-full bg-white/10">
              <div
                className="h-full rounded-full bg-[#5ec8eb]"
                style={{ width: `${Math.min(100, (snap.headerHeightIn / 44) * 100)}%` }}
              />
            </div>
          </div>
          <div className="rounded-lg bg-black/45 p-1.5 text-center ring-1 ring-white/8">
            <div className="font-mono text-[8.5px] text-[#dce2d4]/50">LOSS MON</div>
            <div
              className={`mt-0.5 font-mono text-[14px] font-bold tabular-nums ${
                snap.shoeLossPct > 2.2 ? 'text-[#df694a]' : snap.shoeLossPct > 1.2 ? 'text-[#f0bb66]' : 'text-[#8ee3a4]'
              }`}
            >
              {snap.shoeLossPct}%
            </div>
            <div className="mt-1 flex gap-0.5">
              <div className="h-1 flex-1 rounded-full bg-white/10">
                <div
                  className={`h-full rounded-full ${snap.shoeLossPct > 2 ? 'bg-[#df694a]' : 'bg-[#8ee3a4]'}`}
                  style={{ width: `${Math.min(100, snap.shoeLossPct * 18)}%` }}
                />
              </div>
              <div className="h-1 flex-1 rounded-full bg-white/10">
                <div
                  className={`h-full rounded-full ${snap.rotorLossPct > 2 ? 'bg-[#df694a]' : 'bg-[#d8f274]'}`}
                  style={{ width: `${Math.min(100, snap.rotorLossPct * 18)}%` }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Fuel / DEF & Status Annunciators */}
        <div className="flex items-center justify-between font-mono text-[9.5px] text-[#dce2d4]/70">
          <span className="flex items-center gap-1">
            <GasPump size={11} className="text-[#f0bb66]" /> {snap.fuelPct}%
          </span>
          <span className="flex items-center gap-1">
            <Drop size={11} className="text-[#5ec8eb]" /> DEF {snap.defPct}%
          </span>
        </div>

        <div className="grid grid-cols-4 gap-1 pt-0.5 font-mono text-[8.5px] font-bold">
          <div
            className={`rounded py-1 text-center ${
              snap.separatorOn ? 'bg-[#d8f274]/22 text-[#d8f274]' : 'bg-white/5 text-white/30'
            }`}
          >
            SEP
          </div>
          <div
            className={`rounded py-1 text-center ${
              snap.headerDown ? 'bg-[#63b97a]/22 text-[#8ee3a4]' : 'bg-white/5 text-white/30'
            }`}
          >
            HDR
          </div>
          <div
            className={`rounded py-1 text-center ${
              snap.autopilotOn ? 'bg-[#d8f274] text-[#11150e]' : 'bg-white/5 text-white/30'
            }`}
          >
            AUTO
          </div>
          <div
            className={`rounded py-1 text-center ${
              snap.unloadingAugerOn ? 'bg-[#5ec8eb]/25 text-[#5ec8eb]' : 'bg-white/5 text-white/30'
            }`}
          >
            AUG
          </div>
        </div>
      </aside>

      {/* FULL-TANK WARNING BANNER */}
      {snap.grainTankPct >= 95 && !snap.unloadingAugerOn && (
        <div className="pointer-events-auto fixed left-1/2 top-16 z-30 flex -translate-x-1/2 items-center gap-2.5 rounded-full border border-[#df694a]/70 bg-[#2a130e]/92 px-4 py-1.5 text-[12px] font-semibold text-[#ffd8ce] shadow-xl backdrop-blur-xl">
          <Warning size={16} weight="fill" className="text-[#df694a]" />
          <span>{parcel.crop === 'Upland Cotton' ? 'Cotton Basket Full (100%)' : 'Grain Tank Full (100%)'}</span>
          <button
            type="button"
            onClick={toggleUnload}
            className="rounded-full bg-[#5ec8eb] px-2.5 py-0.5 text-[11px] font-bold text-[#0c1418] hover:bg-[#8be0fb]"
          >
            Unload Auger (U)
          </button>
        </div>
      )}

      {/* ─── LOWER COCKPIT DASHBOARD: SWITCHES + STEERING COLUMN + HYDROHANDLE + COMMANDCENTER 12.8" DISPLAY ─── */}
      <div className="pointer-events-none relative z-20 mt-auto grid grid-cols-1 items-end gap-2.5 px-3 pb-3 sm:px-5 lg:grid-cols-[270px_minmax(280px,1fr)_390px]">
        {/* LEFT COCKPIT POD: MACHINE FUNCTION SWITCHES & LIVE HARVEST METRICS */}
        <div className="pointer-events-auto flex flex-col gap-2 rounded-2xl border border-white/14 bg-[#0f130f]/90 p-3 shadow-[0_18px_40px_rgba(0,0,0,0.72)] backdrop-blur-xl">
          <div className="flex items-center justify-between">
            <span className="font-mono text-[10px] font-semibold uppercase tracking-widest text-[#dce2d4]/55">
              HARVEST CONTROLS
            </span>
            <button
              type="button"
              onClick={handleAutoHarvestQuickStart}
              className="flex items-center gap-1 rounded-full bg-[#d8f274] px-2.5 py-0.5 text-[10.5px] font-bold text-[#13180f] transition-transform hover:scale-[1.02] hover:bg-[#e7fc95]"
            >
              <Play size={10} weight="fill" />
              <span>Auto-Harvest</span>
            </button>
          </div>

          {/* 4 Tactile Backlit Combine Rocker Switches */}
          <div className="grid grid-cols-2 gap-1.5">
            <button
              type="button"
              onClick={toggleSeparator}
              className={`flex flex-col items-start rounded-xl border px-2.5 py-2 text-left transition-all ${
                snap.separatorOn
                  ? 'border-[#d8f274]/55 bg-[#d8f274]/14 text-[#f5f8ee]'
                  : 'border-white/10 bg-white/[0.03] text-[#dce2d4]/60 hover:bg-white/[0.07]'
              }`}
            >
              <div className="flex w-full items-center justify-between">
                <span className="font-mono text-[9.5px] font-semibold">SEPARATOR</span>
                <span className="font-mono text-[9px] text-[#dce2d4]/45">[E]</span>
              </div>
              <span className={`mt-0.5 text-[11.5px] font-bold ${snap.separatorOn ? 'text-[#d8f274]' : ''}`}>
                {snap.separatorOn ? 'ENGAGED' : 'OFF'}
              </span>
            </button>

            <button
              type="button"
              onClick={toggleHeader}
              className={`flex flex-col items-start rounded-xl border px-2.5 py-2 text-left transition-all ${
                snap.headerDown
                  ? 'border-[#63b97a]/60 bg-[#63b97a]/16 text-[#f5f8ee]'
                  : 'border-[#f0bb66]/40 bg-[#f0bb66]/10 text-[#f6deb2]'
              }`}
            >
              <div className="flex w-full items-center justify-between">
                <span className="font-mono text-[9.5px] font-semibold">40FT HEADER</span>
                <span className="font-mono text-[9px] text-[#dce2d4]/45">[H]</span>
              </div>
              <span className={`mt-0.5 text-[11.5px] font-bold ${snap.headerDown ? 'text-[#8ee3a4]' : 'text-[#f0bb66]'}`}>
                {snap.headerDown ? `CUTTING ${snap.headerHeightIn}"` : `RAISED ${snap.headerHeightIn}"`}
              </span>
            </button>

            <button
              type="button"
              onClick={toggleAutopilot}
              className={`flex flex-col items-start rounded-xl border px-2.5 py-2 text-left transition-all ${
                snap.autopilotOn
                  ? 'border-[#d8f274] bg-[#d8f274] text-[#12160e] shadow-[0_0_20px_rgba(216,242,116,0.38)]'
                  : 'border-[#5ec8eb]/35 bg-[#5ec8eb]/10 text-[#c9eefb] hover:bg-[#5ec8eb]/18'
              }`}
            >
              <div className="flex w-full items-center justify-between">
                <span className="font-mono text-[9.5px] font-semibold">AUTOTRAC</span>
                <span className="font-mono text-[9px] opacity-70">[P]</span>
              </div>
              <span className="mt-0.5 text-[11.5px] font-bold">
                {snap.autopilotOn ? 'RTK LOCKED' : 'ENGAGE'}
              </span>
            </button>

            <button
              type="button"
              onClick={toggleUnload}
              className={`flex flex-col items-start rounded-xl border px-2.5 py-2 text-left transition-all ${
                snap.unloadingAugerOn
                  ? 'border-[#5ec8eb] bg-[#5ec8eb]/20 text-[#d8f5ff]'
                  : 'border-white/10 bg-white/[0.03] text-[#dce2d4]/70 hover:bg-white/[0.07]'
              }`}
            >
              <div className="flex w-full items-center justify-between">
                <span className="font-mono text-[9.5px] font-semibold">UNLOAD AUGER</span>
                <span className="font-mono text-[9px] text-[#dce2d4]/45">[U]</span>
              </div>
              <span className={`mt-0.5 text-[11.5px] font-bold ${snap.unloadingAugerOn ? 'text-[#5ec8eb]' : ''}`}>
                {snap.unloadingAugerOn ? `OFFLOAD ${snap.grainTankPct}%` : `TANK ${snap.grainTankPct}%`}
              </span>
            </button>
          </div>

          {/* Live Harvest Yield & Coverage Strip */}
          <div className="grid grid-cols-3 gap-1.5 rounded-xl bg-black/45 p-2 font-mono ring-1 ring-white/8">
            <div>
              <div className="text-[8.5px] text-[#dce2d4]/50">LIVE YIELD</div>
              <div className="text-[12.5px] font-bold tabular-nums text-[#d8f274]">
                {snap.liveYieldRate}
              </div>
              <div className="text-[8.5px] text-[#dce2d4]/45">{cropMeta.unit}</div>
            </div>
            <div>
              <div className="text-[8.5px] text-[#dce2d4]/50">HARVESTED</div>
              <div className="text-[12.5px] font-bold tabular-nums text-[#f3f5ef]">
                {snap.harvestedAcres}
              </div>
              <div className="text-[8.5px] text-[#dce2d4]/45">ac ({snap.parcelPctDone}%)</div>
            </div>
            <div>
              <div className="text-[8.5px] text-[#dce2d4]/50">MOISTURE</div>
              <div className="text-[12.5px] font-bold tabular-nums text-[#5ec8eb]">
                {snap.moisturePct}%
              </div>
              <div className="text-[8.5px] text-[#dce2d4]/45">
                {snap.activelyCutting ? 'CUTTING' : 'IDLE'}
              </div>
            </div>
          </div>
        </div>

        {/* CENTER COCKPIT: INTERACTIVE STEERING WHEEL + HYDROSTATIC THROTTLE LEVER */}
        <div className="pointer-events-auto flex items-end justify-center gap-3">
          {/* Steering Column Pod */}
          <div className="flex flex-col items-center rounded-2xl border border-white/14 bg-[#0f130f]/86 px-4 py-2.5 shadow-[0_18px_42px_rgba(0,0,0,0.72)] backdrop-blur-xl">
            <div className="mb-1 flex w-full items-center justify-between gap-4 font-mono text-[10px]">
              <span className="text-[#dce2d4]/55">
                STEER <strong className="text-[#f5f8ee]">{snap.steerDeg > 0 ? `+${snap.steerDeg}°` : `${snap.steerDeg}°`}</strong>
              </span>
              <span className="tabular-nums font-bold text-[#d8f274]">
                {Math.abs(snap.speedMph).toFixed(1)} MPH · {driveGear}
              </span>
            </div>

            <div className="flex items-center gap-2.5">
              {/* Hold-to-Steer Left Button */}
              <button
                type="button"
                onPointerDown={() => {
                  inputRef.current.left = true;
                }}
                onPointerUp={() => {
                  inputRef.current.left = false;
                }}
                onPointerLeave={() => {
                  inputRef.current.left = false;
                }}
                aria-label="Steer Left"
                className="flex h-11 w-10 items-center justify-center rounded-xl border border-white/14 bg-white/[0.05] font-mono text-[14px] font-bold text-[#eef2e8] active:bg-[#d8f274] active:text-[#11150e]"
              >
                ◀
              </button>

              {/* Interactive Draggable / Auto-Rotating Combine Steering Wheel */}
              <div
                onPointerDown={handleWheelPointerDown}
                onPointerMove={handleWheelPointerMove}
                onPointerUp={handleWheelPointerUp}
                onPointerCancel={handleWheelPointerUp}
                title="Drag left/right to steer or use A / D keys"
                className="relative flex h-[112px] w-[112px] cursor-grab items-center justify-center active:cursor-grabbing"
              >
                <svg
                  viewBox="0 0 120 120"
                  className="h-full w-full drop-shadow-[0_6px_16px_rgba(0,0,0,0.8)]"
                  style={{ transform: `rotate(${snap.wheelDeg}deg)`, transition: 'transform 45ms linear' }}
                >
                  {/* Outer rubberized rim */}
                  <circle cx="60" cy="60" r="49" fill="none" stroke="#1e241e" strokeWidth="13" />
                  <circle cx="60" cy="60" r="49" fill="none" stroke="#353d34" strokeWidth="1.6" />
                  {/* Top center lime alignment band */}
                  <path
                    d="M 54 11 A 49 49 0 0 1 66 11"
                    fill="none"
                    stroke={snap.autopilotOn ? '#d8f274' : '#f0bb66'}
                    strokeWidth="6"
                    strokeLinecap="round"
                  />
                  {/* Three spokes */}
                  <line x1="60" y1="60" x2="18" y2="54" stroke="#282f27" strokeWidth="9" strokeLinecap="round" />
                  <line x1="60" y1="60" x2="102" y2="54" stroke="#282f27" strokeWidth="9" strokeLinecap="round" />
                  <line x1="60" y1="60" x2="60" y2="105" stroke="#282f27" strokeWidth="10" strokeLinecap="round" />
                  {/* Suicide spinner knob (classic combine steering knob!) */}
                  <circle cx="88" cy="24" r="6.5" fill="#141814" stroke="#85927c" strokeWidth="1.5" />
                  {/* Center horn hub */}
                  <circle cx="60" cy="60" r="17" fill="#161b15" stroke="#d8f274" strokeWidth="1.5" strokeOpacity="0.6" />
                  <circle cx="60" cy="60" r="5" fill={snap.autopilotOn ? '#d8f274' : '#6f7c6b'} />
                </svg>
              </div>

              {/* Hold-to-Steer Right Button */}
              <button
                type="button"
                onPointerDown={() => {
                  inputRef.current.right = true;
                }}
                onPointerUp={() => {
                  inputRef.current.right = false;
                }}
                onPointerLeave={() => {
                  inputRef.current.right = false;
                }}
                aria-label="Steer Right"
                className="flex h-11 w-10 items-center justify-center rounded-xl border border-white/14 bg-white/[0.05] font-mono text-[14px] font-bold text-[#eef2e8] active:bg-[#d8f274] active:text-[#11150e]"
              >
                ▶
              </button>
            </div>

            <div className="mt-1 font-mono text-[9.5px] text-[#dce2d4]/50">
              W/S Throttle · A/D Steer · Space Stop · P AutoTrac
            </div>
          </div>

          {/* CommandARM HydroHandle Throttle Lever Pod */}
          <div className="flex flex-col items-center gap-1.5 rounded-2xl border border-white/14 bg-[#0f130f]/90 px-2.5 py-2.5 shadow-[0_18px_40px_rgba(0,0,0,0.72)] backdrop-blur-xl">
            <span className="font-mono text-[9px] font-semibold tracking-wider text-[#dce2d4]/55">
              HYDRO
            </span>
            <div className="flex h-[96px] items-center justify-center">
              <input
                type="range"
                min={-35}
                max={100}
                value={Math.round(snap.throttle * 100)}
                onChange={(e) => {
                  stateRef.current.autopilotOn = false;
                  stateRef.current.throttle = Number(e.target.value) / 100;
                }}
                aria-label="Hydrostatic propulsion throttle lever"
                className="h-2 w-[88px] -rotate-90 cursor-pointer accent-[#d8f274]"
              />
            </div>
            <button
              type="button"
              onClick={handleStopAll}
              title="Full Stop (Space)"
              className="flex items-center gap-1 rounded-lg bg-[#df694a]/22 px-2 py-1 font-mono text-[9.5px] font-bold text-[#ff9d85] ring-1 ring-[#df694a]/50 hover:bg-[#df694a] hover:text-[#170c09]"
            >
              <Stop size={10} weight="fill" />
              <span>STOP</span>
            </button>
          </div>
        </div>

        {/* RIGHT ARMREST: COMMANDCENTER 12.8" TOUCHSCREEN (INTERACTIVE WAYPOINT & AUTOPILOT TERMINAL) */}
        <div className="pointer-events-auto flex flex-col gap-2 rounded-2xl border border-[#d8f274]/25 bg-[#0c110d]/94 p-2.5 shadow-[0_20px_48px_rgba(0,0,0,0.8)] backdrop-blur-xl">
          {/* CommandCenter Header + Tab Switch */}
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5">
              <Crosshair size={14} weight="bold" className="text-[#d8f274]" />
              <span className="font-mono text-[10.5px] font-bold uppercase tracking-wider text-[#f3f5ef]">
                CommandCenter™ G5
              </span>
            </div>
            <div className="flex rounded-full bg-white/[0.06] p-0.5 font-mono text-[9.5px]">
              <button
                type="button"
                onClick={() => setCcTab('guidance')}
                className={`rounded-full px-2 py-0.5 font-semibold transition-colors ${
                  ccTab === 'guidance' ? 'bg-[#d8f274] text-[#13170f]' : 'text-[#dce2d4]/65 hover:text-white'
                }`}
              >
                Waypoints ({waypoints.length})
              </button>
              <button
                type="button"
                onClick={() => setCcTab('machine')}
                className={`rounded-full px-2 py-0.5 font-semibold transition-colors ${
                  ccTab === 'machine' ? 'bg-[#d8f274] text-[#13170f]' : 'text-[#dce2d4]/65 hover:text-white'
                }`}
              >
                Threshing
              </button>
            </div>
          </div>

          {ccTab === 'guidance' ? (
            <>
              {/* Interactive Parcel & Waypoint Touchscreen Canvas */}
              <div className="relative h-[168px] w-full overflow-hidden rounded-xl border border-white/12 bg-[#0a0e0b]">
                <canvas
                  ref={mapCanvasRef}
                  onClick={handleMinimapClick}
                  className="h-full w-full cursor-crosshair block"
                  title="Click anywhere on parcel map to add an Autopilot Waypoint"
                />
                <div className="pointer-events-none absolute left-2 top-1.5 flex items-center gap-1.5 rounded-full bg-black/72 px-2 py-0.5 font-mono text-[9px] text-[#dce2d4]/85 backdrop-blur-md">
                  <MapPin size={10} className="text-[#5ec8eb]" />
                  <span>Click map to drop Waypoint</span>
                </div>
                <div className="pointer-events-none absolute bottom-1.5 left-2 right-2 flex items-center justify-between font-mono text-[9px]">
                  <span className="rounded bg-black/70 px-1.5 py-0.5 text-[#d8f274]">
                    XTE {snap.xteInches >= 0 ? `+${snap.xteInches}` : snap.xteInches}&quot;
                  </span>
                  <span className="rounded bg-black/70 px-1.5 py-0.5 text-[#b8ebfc]">
                    {waypoints.length > 0 && snap.activeWaypointIdx < waypoints.length
                      ? `NEXT ${waypoints[snap.activeWaypointIdx].label} · ${snap.distToWaypointFt} ft`
                      : 'NO ACTIVE WP'}
                  </span>
                </div>
              </div>

              {/* Waypoint Plan Controls */}
              <div className="flex flex-wrap items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => {
                    const auto = generateAutoSwathWaypoints(proj, HEADER_WIDTH_M * 1.15, 8);
                    setWaypoints(auto);
                    waypointsRef.current = auto;
                    stateRef.current.activeWaypointIdx = 0;
                    stateRef.current.autopilotStatus = `AB PLAN · ${auto.length} WAYPOINTS READY`;
                    playChime(760, 0.1);
                  }}
                  className="flex items-center gap-1 rounded-lg border border-[#d8f274]/40 bg-[#d8f274]/12 px-2 py-1 font-mono text-[10px] font-semibold text-[#d8f274] hover:bg-[#d8f274]/22"
                >
                  <Path size={12} />
                  <span>Auto AB Swaths</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setWaypoints((prev) => {
                      const nextWps = prev.slice(0, -1);
                      waypointsRef.current = nextWps;
                      if (stateRef.current.activeWaypointIdx >= nextWps.length) {
                        stateRef.current.activeWaypointIdx = Math.max(0, nextWps.length - 1);
                      }
                      return nextWps;
                    });
                  }}
                  disabled={waypoints.length === 0}
                  title="Remove last waypoint"
                  className="flex items-center gap-1 rounded-lg border border-white/12 bg-white/[0.04] px-2 py-1 font-mono text-[10px] text-[#dce2d4]/80 hover:bg-white/10 disabled:opacity-35"
                >
                  <ArrowCounterClockwise size={11} />
                  <span>Undo</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setWaypoints([]);
                    waypointsRef.current = [];
                    stateRef.current.autopilotOn = false;
                    stateRef.current.activeWaypointIdx = 0;
                    stateRef.current.autopilotStatus = 'CLEARED · CLICK MAP FOR WAYPOINTS';
                  }}
                  disabled={waypoints.length === 0}
                  title="Clear all waypoints"
                  className="flex items-center gap-1 rounded-lg border border-white/12 bg-white/[0.04] px-2 py-1 font-mono text-[10px] text-[#dce2d4]/80 hover:border-[#df694a]/50 hover:text-[#ff9c84] disabled:opacity-35"
                >
                  <Trash size={11} />
                  <span>Clear</span>
                </button>

                <button
                  type="button"
                  onClick={() => setLoopWaypoints((v) => !v)}
                  title="Loop waypoint route continuously"
                  className={`flex items-center gap-1 rounded-lg border px-2 py-1 font-mono text-[10px] font-semibold transition-colors ${
                    loopWaypoints
                      ? 'border-[#5ec8eb]/60 bg-[#5ec8eb]/18 text-[#7fd5f2]'
                      : 'border-white/12 bg-white/[0.04] text-[#dce2d4]/65 hover:text-white'
                  }`}
                >
                  <ArrowsClockwise size={11} />
                  <span>Loop</span>
                </button>

                <button
                  type="button"
                  onClick={toggleAutopilot}
                  className={`ml-auto rounded-lg px-2.5 py-1 font-mono text-[10px] font-bold transition-all ${
                    snap.autopilotOn
                      ? 'bg-[#df694a] text-[#170c09]'
                      : 'bg-[#d8f274] text-[#13170f] hover:bg-[#e7fc95]'
                  }`}
                >
                  {snap.autopilotOn ? 'Disengage' : 'Drive WP'}
                </button>
              </div>
            </>
          ) : (
            /* Machine Threshing & Separation Diagnostics Tab */
            <div className="grid h-[202px] grid-cols-2 gap-2 rounded-xl bg-black/45 p-2.5 font-mono ring-1 ring-white/8">
              <div className="rounded-lg bg-white/[0.03] p-2">
                <div className="text-[9px] text-[#dce2d4]/50">DUAL ROTOR SPEED</div>
                <div className="mt-1 flex items-baseline gap-1">
                  <span className="text-[19px] font-bold tabular-nums text-[#d8f274]">{snap.rotorRpm}</span>
                  <span className="text-[9.5px] text-[#dce2d4]/55">RPM</span>
                </div>
                <div className="mt-1 text-[9px] text-[#8ee3a4]">Optimal 580–680 RPM</div>
              </div>
              <div className="rounded-lg bg-white/[0.03] p-2">
                <div className="text-[9px] text-[#dce2d4]/50">CLEANING FAN</div>
                <div className="mt-1 flex items-baseline gap-1">
                  <span className="text-[19px] font-bold tabular-nums text-[#5ec8eb]">{snap.fanRpm}</span>
                  <span className="text-[9.5px] text-[#dce2d4]/55">RPM</span>
                </div>
                <div className="mt-1 text-[9px] text-[#dce2d4]/55">Chaffer 14mm · Sieve 9mm</div>
              </div>
              <div className="rounded-lg bg-white/[0.03] p-2">
                <div className="text-[9px] text-[#dce2d4]/50">CONCAVE CLEARANCE</div>
                <div className="mt-1 flex items-baseline gap-1">
                  <span className="text-[19px] font-bold tabular-nums text-[#f3f5ef]">{snap.concaveMm}</span>
                  <span className="text-[9.5px] text-[#dce2d4]/55">mm</span>
                </div>
                <div className="mt-1 text-[9px] text-[#dce2d4]/55">Crop: {parcel.crop}</div>
              </div>
              <div className="rounded-lg bg-white/[0.03] p-2">
                <div className="flex items-center justify-between text-[9px] text-[#dce2d4]/50">
                  <span>PICKUP REEL</span>
                  <Gauge size={11} className="text-[#f0bb66]" />
                </div>
                <div className="mt-1 flex items-baseline gap-1">
                  <span className="text-[19px] font-bold tabular-nums text-[#f0bb66]">{snap.reelRpm}</span>
                  <span className="text-[9.5px] text-[#dce2d4]/55">RPM</span>
                </div>
                <div className="mt-1 text-[9px] text-[#dce2d4]/55">Auto-Sync w/ Ground Speed</div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
