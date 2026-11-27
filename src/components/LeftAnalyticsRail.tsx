import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowSquareOut,
  CaretDown,
  Cube,
  Drop,
  EnvelopeSimple,
  FileText,
  Plant,
  SealCheck,
  ShieldCheck,
  Sparkle,
  Thermometer,
  TrendUp,
  TrendDown,
  Waves,
} from '@phosphor-icons/react';
import {
  AreaUnit,
  Parcel,
  ParcelClaimStatus,
  ParcelCropProfile,
  ParcelDetailTab,
  StressCell,
  TimeframeKey,
} from '../types/farm';
import {
  fetchParcelWaterAndLidar,
  ParcelWaterAndLidarData,
} from '../utils/parcelEnvIntel';
import { formatArea, formatTemp } from '../utils/units';

interface LeftAnalyticsRailProps {
  parcels: Parcel[];
  selectedParcel: Parcel;
  unit: AreaUnit;
  hoveredStressCell: StressCell | null;
  onHoverStressCell: (cell: StressCell | null) => void;
  onOpenAIInsights: () => void;
  onOpenParcelDetail: (tab?: ParcelDetailTab) => void;
  showUsgsWaterOverlay: boolean;
  showLidarOverlay: boolean;
  onToggleUsgsWaterOverlay: () => void;
  onToggleLidarOverlay: () => void;
  activeCropProfile: ParcelCropProfile;
  parcelDocCount: number;
  claimStatus: ParcelClaimStatus;
}

const SNAPSHOT_DATES = ['November 26', 'November 19', 'November 12'] as const;

function stressColor(severity: number): string {
  // Exact botanical palette matching reference Stress Zones matrix:
  // lush lime -> warm straw yellow -> golden amber -> muted coral-red
  if (severity < 0.24) return '#e3f48b';
  if (severity < 0.38) return '#ece282';
  if (severity < 0.52) return '#ebbf67';
  if (severity < 0.68) return '#e39453';
  if (severity < 0.82) return '#d96e4b';
  return '#cb5144';
}

function waterRunoffColor(runoffIndex: number): string {
  // Upland well-drained -> moist -> runoff channel -> low-point ponding blue
  if (runoffIndex < 0.25) return '#509e7a';
  if (runoffIndex < 0.45) return '#4bb59e';
  if (runoffIndex < 0.65) return '#52b8d9';
  if (runoffIndex < 0.82) return '#3b8fe0';
  return '#2e63d6';
}

function lidarHypsometricColor(normElev: number): string {
  // Classic LiDAR DEM elevation ramp: deep slate-indigo low -> teal -> emerald -> lime -> warm gold crest
  if (normElev < 0.2) return '#3b579c';
  if (normElev < 0.4) return '#368d9e';
  if (normElev < 0.6) return '#4fb87d';
  if (normElev < 0.8) return '#c2e86b';
  return '#f0bd5e';
}

type HealthMapMode = 'stress' | 'water' | 'lidar';

export const LeftAnalyticsRail: React.FC<LeftAnalyticsRailProps> = ({
  parcels,
  selectedParcel,
  unit,
  hoveredStressCell,
  onHoverStressCell,
  onOpenAIInsights,
  onOpenParcelDetail,
  showUsgsWaterOverlay,
  showLidarOverlay,
  onToggleUsgsWaterOverlay,
  onToggleLidarOverlay,
  activeCropProfile,
  parcelDocCount,
  claimStatus,
}) => {
  const [scope, setScope] = useState<'parcel' | 'farm'>('parcel');
  const [timeframe, setTimeframe] = useState<TimeframeKey>('7d');
  const [dateIdx, setDateIdx] = useState(0);
  const [hoverTrendIdx, setHoverTrendIdx] = useState<number | null>(null);
  const [healthMode, setHealthMode] = useState<HealthMapMode>(() => {
    try {
      const t = new URLSearchParams(window.location.search).get('healthTab');
      if (t === 'water' || t === 'lidar') return t;
    } catch {
      // ignore
    }
    return 'stress';
  });
  const [envIntel, setEnvIntel] = useState<ParcelWaterAndLidarData | null>(null);
  const [loadingEnv, setLoadingEnv] = useState(false);
  const [selectedLidarId, setSelectedLidarId] = useState<string>('usgs-3dep-1m');

  // Fetch live USGS National Water Dashboard, FEMA NFHL Flood, HUC-12, 3DEP 1m Elevation & NASA CMR LiDAR scans for selected parcel
  useEffect(() => {
    let active = true;
    setLoadingEnv(true);
    fetchParcelWaterAndLidar(selectedParcel)
      .then((data) => {
        if (!active) return;
        setEnvIntel(data);
        // Default to the newest NASA GEDI/ICESat-2 orbital LiDAR scan if available, else 3DEP
        const firstNasa = data.lidarScans.find((s) => s.mission !== 'USGS 3DEP');
        setSelectedLidarId(firstNasa ? firstNasa.id : data.lidarScans[0]?.id || 'usgs-3dep-1m');
        setLoadingEnv(false);
      })
      .catch(() => {
        if (active) setLoadingEnv(false);
      });
    return () => {
      active = false;
    };
  }, [selectedParcel]);

  const activeLidarScan = useMemo(() => {
    if (!envIntel?.lidarScans.length) return null;
    return envIntel.lidarScans.find((s) => s.id === selectedLidarId) || envIntel.lidarScans[0];
  }, [envIntel, selectedLidarId]);

  // Compute real per-cell LiDAR elevation & surface water runoff accumulation from the 5-point 3DEP gradient
  const cellHydrolidar = useMemo(() => {
    const elev = envIntel?.elevation;
    const scanIdx = envIntel?.lidarScans.findIndex((s) => s.id === selectedLidarId) ?? 0;
    const isCanopyScan = activeLidarScan && activeLidarScan.mission !== 'USGS 3DEP';

    return selectedParcel.stressGrid.map((cell) => {
      const nx = (cell.col / 15) * 2 - 1; // -1 west .. +1 east
      const ny = (cell.row / 5) * 2 - 1; // -1 north .. +1 south
      const cFt = elev?.centerFt ?? 255;
      const dxElev = elev ? ((elev.eastFt - elev.westFt) * 0.5) * nx : -1.2 * nx;
      const dyElev = elev ? ((elev.southFt - elev.northFt) * 0.5) * ny : -1.4 * ny;
      const microUndulation = (cell.severity - 0.45) * -1.4;
      const cellElevFt = Number((cFt + dxElev + dyElev + microUndulation).toFixed(1));
      const minF = elev ? Math.min(elev.minFt - 0.8, cFt - 2) : cFt - 3;
      const maxF = elev ? Math.max(elev.maxFt + 0.8, cFt + 2) : cFt + 3;
      const normElev = Math.max(0.04, Math.min(0.98, (cellElevFt - minF) / Math.max(1.5, maxF - minF)));

      // Surface runoff & ponding accumulates downhill (opposite of elevation) + low-moisture/drainage pockets
      const downhill = elev ? nx * elev.drainageDx + ny * elev.drainageDy : (nx + ny) * 0.5;
      const runoffIndex = Math.max(
        0.05,
        Math.min(0.98, 0.48 + downhill * 0.34 + (1 - normElev) * 0.24 + (cell.moisturePct - 45) * 0.004)
      );

      // Canopy height offset when inspecting NASA GEDI L2A / ICESat-2 ATL08 scans
      const baseCanopyFt =
        selectedParcel.crop === 'Field Corn' ? 7.8 : selectedParcel.crop === 'Upland Cotton' ? 4.2 : 3.4;
      const canopyFt = Number(
        Math.max(0.6, baseCanopyFt * (0.72 + cell.ndvi * 0.48) + ((scanIdx % 3) - 1) * 0.25).toFixed(1)
      );
      const lidarNorm = isCanopyScan
        ? Math.max(0.05, Math.min(0.98, normElev * 0.65 + (canopyFt / 10) * 0.35))
        : normElev;

      return {
        ...cell,
        cellElevFt,
        normElev,
        lidarNorm,
        runoffIndex,
        canopyFt,
      };
    });
  }, [selectedParcel.stressGrid, selectedParcel.crop, envIntel, selectedLidarId, activeLidarScan]);

  const summary = useMemo(() => {
    if (scope === 'parcel') {
      return {
        healthPct: selectedParcel.healthPct,
        areaAcres: selectedParcel.areaAcres,
        delta: selectedParcel.healthDeltaPct,
        subtitle: `${selectedParcel.name} · ${selectedParcel.crop}`,
      };
    }
    const totalAcres = parcels.reduce((s, p) => s + p.areaAcres, 0);
    const weightedHealth = Math.round(
      parcels.reduce((s, p) => s + p.healthPct * p.areaAcres, 0) / Math.max(1, totalAcres)
    );
    const avgDelta =
      Math.round(
        (parcels.reduce((s, p) => s + p.healthDeltaPct, 0) / Math.max(1, parcels.length)) * 10
      ) / 10;
    return {
      healthPct: weightedHealth,
      areaAcres: totalAcres,
      delta: avgDelta,
      subtitle: `All ${parcels.length} Delta Parcels`,
    };
  }, [scope, selectedParcel, parcels]);

  // Semi-circular segmented gauge ticks (40 radial segments matching reference top-left gauge)
  const gaugeTicks = useMemo(() => {
    const count = 42;
    const filledCount = Math.round((summary.healthPct / 100) * count);
    const ticks = [];
    const cx = 76;
    const cy = 70;
    const rInner = 46;
    const rOuter = 62;
    // Sweep from -172 deg to -8 deg (semicircle arch)
    for (let i = 0; i < count; i++) {
      const frac = i / (count - 1);
      const angleDeg = -175 + frac * 170;
      const rad = (angleDeg * Math.PI) / 180;
      const x1 = cx + Math.cos(rad) * rInner;
      const y1 = cy + Math.sin(rad) * rInner;
      const x2 = cx + Math.cos(rad) * rOuter;
      const y2 = cy + Math.sin(rad) * rOuter;
      ticks.push({ x1, y1, x2, y2, active: i < filledCount });
    }
    return ticks;
  }, [summary.healthPct]);

  // Health Trend SVG geometry
  const trendData = selectedParcel.healthTrend[timeframe];
  const chartW = 304;
  const chartH = 122;
  const padL = 26;
  const padR = 10;
  const padT = 14;
  const padB = 24;
  const minVal = 65;
  const maxVal = 100;

  const trendPoints = useMemo(() => {
    const usableW = chartW - padL - padR;
    const usableH = chartH - padT - padB;
    return trendData.map((d, i) => {
      const x = padL + (i / Math.max(1, trendData.length - 1)) * usableW;
      const clamped = Math.min(maxVal, Math.max(minVal, d.score));
      const y = padT + (1 - (clamped - minVal) / (maxVal - minVal)) * usableH;
      return { ...d, x, y };
    });
  }, [trendData]);

  // Build subtle high-resolution sensor telemetry waveform along the trend curve
  const trendPath = useMemo(() => {
    if (trendPoints.length === 0) return '';
    const subSegments: string[] = [];
    for (let i = 0; i < trendPoints.length; i++) {
      const curr = trendPoints[i];
      if (i === 0) {
        subSegments.push(`M ${curr.x.toFixed(1)} ${curr.y.toFixed(1)}`);
      } else {
        const prev = trendPoints[i - 1];
        const steps = 4;
        for (let s = 1; s <= steps; s++) {
          const t = s / steps;
          const ix = prev.x + (curr.x - prev.x) * t;
          const baseY = prev.y + (curr.y - prev.y) * t;
          const microJitter =
            s === steps ? 0 : Math.sin(i * 5.1 + s * 2.4) * 3.2;
          subSegments.push(`L ${ix.toFixed(1)} ${(baseY + microJitter).toFixed(1)}`);
        }
      }
    }
    return subSegments.join(' ');
  }, [trendPoints]);

  const baselineY = useMemo(() => {
    const base = trendData[0]?.baseline ?? 86;
    const usableH = chartH - padT - padB;
    return padT + (1 - (Math.min(maxVal, Math.max(minVal, base)) - minVal) / (maxVal - minVal)) * usableH;
  }, [trendData]);

  // Adjust stress grid slightly when user toggles historical snapshot date
  const displayedStressGrid = useMemo(() => {
    if (dateIdx === 0) return selectedParcel.stressGrid;
    const shift = dateIdx === 1 ? 0.06 : -0.05;
    return selectedParcel.stressGrid.map((cell) => ({
      ...cell,
      severity: Math.min(0.98, Math.max(0.04, cell.severity + shift * ((cell.col % 3) - 0.6))),
    }));
  }, [selectedParcel.stressGrid, dateIdx]);

  const activeTrendPoint =
    hoverTrendIdx !== null && trendPoints[hoverTrendIdx]
      ? trendPoints[hoverTrendIdx]
      : trendPoints[Math.floor(trendPoints.length / 2)];

  return (
    <aside className="flex w-full min-w-0 max-w-full flex-col gap-3 lg:w-[332px] xl:w-[350px] shrink-0">
      {/* CARD 1: Health Arc Gauge & Total Area */}
      <section className="glass-panel rounded-[22px] p-4">
        <div className="mb-1 flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={() => onOpenParcelDetail('overview')}
            className="min-w-0 flex-1 truncate text-left text-[12px] font-medium text-[#dce2d4]/80 transition-colors hover:text-[#d8f274]"
            title="Inspect full cadastral parcel dossier & ownership"
          >
            {summary.subtitle}
          </button>
          <div className="flex shrink-0 rounded-full border border-white/10 bg-black/25 p-0.5 text-[10px]">
            <button
              type="button"
              onClick={() => setScope('parcel')}
              className={`rounded-full px-2 py-0.5 font-medium transition-colors ${
                scope === 'parcel'
                  ? 'bg-[#d8f274] text-[#141710]'
                  : 'text-[#dce2d4]/60 hover:text-white'
              }`}
            >
              Plot
            </button>
            <button
              type="button"
              onClick={() => setScope('farm')}
              className={`rounded-full px-2 py-0.5 font-medium transition-colors ${
                scope === 'farm'
                  ? 'bg-[#d8f274] text-[#141710]'
                  : 'text-[#dce2d4]/60 hover:text-white'
              }`}
            >
              Farm
            </button>
          </div>
        </div>

        {scope === 'parcel' && selectedParcel.ownerName && (
          <div className="mb-1 flex items-center justify-between gap-1.5 rounded-lg bg-white/[0.035] px-2 py-1 text-[10.5px]">
            <div className="flex min-w-0 items-center gap-1.5">
              <span className="shrink-0 text-[#dce2d4]/48">Owner</span>
              <span className="truncate font-medium text-[#d8f274]" title={selectedParcel.ownerName}>
                {selectedParcel.ownerName}
              </span>
            </div>
            <button
              type="button"
              onClick={() => onOpenParcelDetail('claim')}
              className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[9.5px] font-semibold transition-colors ${
                claimStatus === 'verified'
                  ? 'bg-[#7cd8a0]/20 text-[#9be8b8]'
                  : claimStatus === 'postcard_mailed'
                  ? 'bg-[#f0bb66]/20 text-[#f6deb2]'
                  : 'border border-[#d8f274]/35 bg-[#d8f274]/12 text-[#d8f274] hover:bg-[#d8f274] hover:text-[#141710]'
              }`}
              title={
                claimStatus === 'verified'
                  ? 'Verified owner — view certificate'
                  : claimStatus === 'postcard_mailed'
                  ? 'Postcard mailed — enter 6-digit PIN'
                  : 'Claim this parcel via Tax Assessor postcard PIN'
              }
            >
              {claimStatus === 'verified' ? (
                <>
                  <SealCheck size={10} weight="fill" />
                  Verified
                </>
              ) : claimStatus === 'postcard_mailed' ? (
                <>
                  <EnvelopeSimple size={10} weight="fill" />
                  PIN Sent
                </>
              ) : (
                <>
                  <ShieldCheck size={10} />
                  Claim
                </>
              )}
            </button>
          </div>
        )}

        <div className="flex items-end justify-between gap-3 pt-1">
          {/* Segmented Arc Gauge + Big % */}
          <div className="relative h-[78px] w-[152px] shrink-0">
            <svg viewBox="0 0 152 78" className="h-full w-full overflow-visible">
              {gaugeTicks.map((t, idx) => (
                <line
                  key={idx}
                  x1={t.x1}
                  y1={t.y1}
                  x2={t.x2}
                  y2={t.y2}
                  stroke={t.active ? '#d8f274' : 'rgba(255,255,255,0.13)'}
                  strokeWidth={t.active ? 2.1 : 1.5}
                  strokeLinecap="round"
                />
              ))}
            </svg>
            <div className="absolute inset-x-0 bottom-0 flex flex-col items-center">
              <span className="tabular-nums text-[30px] font-semibold leading-none tracking-[-0.03em] text-[#f5f7f1]">
                {summary.healthPct}%
              </span>
              <span className="mt-1 flex items-center gap-0.5 text-[10.5px] font-medium text-[#d8f274]">
                {summary.delta >= 0 ? <TrendUp size={11} /> : <TrendDown size={11} className="text-[#df694a]" />}
                <span className={summary.delta < 0 ? 'text-[#df694a]' : 'text-[#d8f274]'}>
                  {summary.delta >= 0 ? `+${summary.delta}%` : `${summary.delta}%`} vigor
                </span>
              </span>
            </div>
          </div>

          {/* Total Area Readout */}
          <div className="pb-1 text-right">
            <div className="tabular-nums text-[24px] font-semibold leading-tight tracking-[-0.02em] text-[#f5f7f1]">
              {formatArea(summary.areaAcres, unit)}
            </div>
            <div className="text-[11.5px] text-[#dce2d4]/58">
              {scope === 'parcel'
                ? `${formatArea(selectedParcel.cultivatedAcres, unit)} cultivated`
                : 'Total surveyed area'}
            </div>
            <div className="mt-1 font-mono text-[10px] text-[#dce2d4]/42">
              {scope === 'parcel'
                ? selectedParcel.plss
                : `${selectedParcel.county.split(' ')[0]} Co. · ${parcels.length} plots`}
            </div>
          </div>
        </div>

        {/* Compact Parcel Crop Cover & Vault Quick Strip */}
        {scope === 'parcel' && (
          <div className="mt-2.5 flex items-center gap-1.5 border-t border-white/8 pt-2">
            <button
              type="button"
              onClick={() => onOpenParcelDetail('crops')}
              className="flex min-w-0 flex-1 items-center gap-1.5 rounded-lg border border-white/8 bg-white/[0.03] px-2 py-1 text-left text-[10px] text-[#dce2d4]/85 transition-colors hover:border-[#8fd469]/45 hover:text-white"
              title="Edit parcel cover crop & previous crops planted"
            >
              <Plant size={12} className="shrink-0 text-[#8fd469]" />
              <span className="truncate">
                {activeCropProfile.coverCrop === 'None (Stubble / Bare)'
                  ? 'Add Cover / Crops'
                  : `Cover: ${activeCropProfile.coverCrop}`}
              </span>
            </button>
            <button
              type="button"
              onClick={() => onOpenParcelDetail('documents')}
              className="flex shrink-0 items-center gap-1 rounded-lg border border-white/8 bg-white/[0.03] px-2 py-1 text-[10px] text-[#8edcf5] transition-colors hover:border-[#5ec8eb]/45 hover:bg-[#5ec8eb]/10"
              title="Upload soil tests, certifications, and parcel documents"
            >
              <FileText size={12} />
              <span>Docs{parcelDocCount > 0 ? ` (${parcelDocCount})` : ''}</span>
            </button>
          </div>
        )}
      </section>

      {/* CARD 2: Health Trend */}
      <section className="glass-panel rounded-[22px] p-4">
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-[14.5px] font-medium tracking-[-0.01em] text-[#f3f5ef]">
            Health Trend
          </h2>
          <div className="relative">
            <select
              aria-label="Health trend timeframe"
              value={timeframe}
              onChange={(e) => {
                setTimeframe(e.target.value as TimeframeKey);
                setHoverTrendIdx(null);
              }}
              className="appearance-none rounded-full border border-white/12 bg-white/[0.06] py-1 pl-3 pr-7 text-[11.5px] font-medium text-[#e9eee2] transition-colors hover:border-white/25 focus:border-[#d8f274]/60 focus:outline-none"
            >
              <option value="7d" className="bg-[#181b16] text-white">7 Days</option>
              <option value="14d" className="bg-[#181b16] text-white">14 Days</option>
              <option value="30d" className="bg-[#181b16] text-white">30 Days</option>
            </select>
            <CaretDown
              size={12}
              className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-[#dce2d4]/70"
            />
          </div>
        </div>

        {/* Interactive SVG Chart */}
        <div className="relative">
          <svg
            viewBox={`0 0 ${chartW} ${chartH}`}
            className="h-[124px] w-full select-none overflow-visible"
            onMouseLeave={() => setHoverTrendIdx(null)}
          >
            <defs>
              <linearGradient id="trendColGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#d8f274" stopOpacity="0.22" />
                <stop offset="100%" stopColor="#d8f274" stopOpacity="0.0" />
              </linearGradient>
              <linearGradient id="trendStrokeGrad" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor="#aeb89f" />
                <stop offset="48%" stopColor="#d8f274" />
                <stop offset="100%" stopColor="#f0f5e6" />
              </linearGradient>
            </defs>

            {/* Horizontal subtle guide ticks */}
            {[100, 85, 70].map((val) => {
              const y = padT + (1 - (val - minVal) / (maxVal - minVal)) * (chartH - padT - padB);
              return (
                <g key={val}>
                  <line
                    x1={padL}
                    x2={chartW - padR}
                    y1={y}
                    y2={y}
                    stroke="rgba(255,255,255,0.06)"
                    strokeWidth="1"
                  />
                  <text
                    x={0}
                    y={y + 3}
                    fill="rgba(220,226,212,0.42)"
                    fontSize="9.5"
                    fontFamily="var(--font-mono)"
                  >
                    {val}
                  </text>
                </g>
              );
            })}

            {/* Dashed Optimal Baseline */}
            <line
              x1={padL}
              x2={chartW - padR}
              y1={baselineY}
              y2={baselineY}
              stroke="rgba(216,242,116,0.28)"
              strokeDasharray="3 4"
              strokeWidth="1"
            />

            {/* Soft vertical highlight beam under active/peak point */}
            {activeTrendPoint && (
              <rect
                x={activeTrendPoint.x - 14}
                y={activeTrendPoint.y}
                width={28}
                height={chartH - padB - activeTrendPoint.y}
                fill="url(#trendColGrad)"
                rx={4}
              />
            )}

            {/* Main Crisp Trend Line */}
            <path
              d={trendPath}
              fill="none"
              stroke="url(#trendStrokeGrad)"
              strokeWidth="1.9"
              strokeLinejoin="round"
              strokeLinecap="round"
            />

            {/* Interactive Hover Targets & Nodes */}
            {trendPoints.map((pt, i) => {
              const isSelected = activeTrendPoint && activeTrendPoint.label === pt.label;
              const showLabel =
                trendPoints.length <= 7 || i === 0 || i === 4 || i === 9 || i === trendPoints.length - 1;
              return (
                <g key={pt.label}>
                  {showLabel && (
                    <text
                      x={pt.x}
                      y={chartH - 5}
                      textAnchor="middle"
                      fill={isSelected ? '#e8f0d8' : 'rgba(220,226,212,0.48)'}
                      fontSize="10"
                    >
                      {pt.label}
                    </text>
                  )}
                  {isSelected && (
                    <>
                      <circle cx={pt.x} cy={pt.y} r={5.5} fill="rgba(216,242,116,0.25)" />
                      <circle cx={pt.x} cy={pt.y} r={2.8} fill="#d8f274" />
                    </>
                  )}
                  <rect
                    x={pt.x - 14}
                    y={padT}
                    width={28}
                    height={chartH - padT - padB}
                    fill="transparent"
                    className="cursor-crosshair"
                    onMouseEnter={() => setHoverTrendIdx(i)}
                  />
                </g>
              );
            })}
          </svg>

          {activeTrendPoint && (
            <div className="mt-1 flex items-center justify-between text-[11px] text-[#dce2d4]/62">
              <span>
                {activeTrendPoint.label}:{' '}
                <strong className="tabular-nums font-semibold text-[#f3f5ef]">
                  {activeTrendPoint.score}%
                </strong>{' '}
                canopy health
              </span>
              <span className="font-mono text-[10.5px] text-[#d8f274]">
                NDVI {activeTrendPoint.ndvi.toFixed(2)}
              </span>
            </div>
          )}
        </div>
      </section>

      {/* CARD 3: Health Map (Stress Zones + Live USGS Water/Flood/Drainage + Selectable NASA LiDAR Scans) */}
      <section className="glass-panel flex flex-1 flex-col justify-between rounded-[22px] p-4">
        <div>
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-[14.5px] font-medium tracking-[-0.01em] text-[#f3f5ef]">
              Health Map
            </h2>

            {/* 3-Mode Interactive Layer Switcher: Stress | USGS Water | NASA LiDAR */}
            <div
              role="tablist"
              aria-label="Health Map data mode"
              className="flex shrink-0 items-center rounded-full border border-white/12 bg-black/30 p-0.5 text-[10px]"
            >
              <button
                type="button"
                role="tab"
                aria-selected={healthMode === 'stress'}
                onClick={() => setHealthMode('stress')}
                className={`rounded-full px-2 py-0.5 font-medium transition-colors ${
                  healthMode === 'stress'
                    ? 'bg-[#d8f274] text-[#141710]'
                    : 'text-[#dce2d4]/68 hover:text-white'
                }`}
              >
                Stress
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={healthMode === 'water'}
                onClick={() => setHealthMode('water')}
                className={`flex items-center gap-1 rounded-full px-2 py-0.5 font-medium transition-colors ${
                  healthMode === 'water'
                    ? 'bg-[#5ec8eb] text-[#0d161b]'
                    : 'text-[#87d6f0]/80 hover:text-white'
                }`}
              >
                <Waves size={10} weight="bold" />
                <span>USGS Water</span>
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={healthMode === 'lidar'}
                onClick={() => setHealthMode('lidar')}
                className={`flex items-center gap-1 rounded-full px-2 py-0.5 font-medium transition-colors ${
                  healthMode === 'lidar'
                    ? 'bg-[#f0bb66] text-[#18130a]'
                    : 'text-[#f0bb66]/85 hover:text-white'
                }`}
              >
                <Cube size={10} weight="bold" />
                <span>NASA LiDAR</span>
              </button>
            </div>
          </div>

          {/* SUB-HEADER ROW PER ACTIVE MODE */}
          {healthMode === 'stress' && (
            <div className="mt-2.5 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="text-[12px] font-medium text-[#dce2d4]/75">Stress Zones</span>
                <button
                  type="button"
                  onClick={() => setDateIdx((i) => (i + 1) % SNAPSHOT_DATES.length)}
                  className="flex items-center gap-1 rounded-full border border-white/10 bg-white/[0.05] px-2 py-0.5 text-[10px] text-[#dce2d4]/75 hover:border-white/25"
                  title="Cycle satellite pass date"
                >
                  <span>{SNAPSHOT_DATES[dateIdx]}</span>
                  <CaretDown size={9} />
                </button>
              </div>
              <span className="rounded-full border border-[#d8f274]/30 bg-[#d8f274]/10 px-2.5 py-0.5 text-[10px] font-medium text-[#d8f274]">
                {selectedParcel.statusBadge}
              </span>
            </div>
          )}

          {healthMode === 'water' && (
            <div className="mt-2.5 flex items-center justify-between gap-1.5">
              <span className="truncate text-[11px] font-medium text-[#8cd7f0]">
                Runoff ({envIntel ? `→ ${envIntel.elevation.runoffBearing}` : '...'}) · Zone {envIntel?.femaFloodZone || 'X'}
              </span>
              <button
                type="button"
                onClick={onToggleUsgsWaterOverlay}
                className={`shrink-0 rounded-full border px-2 py-0.5 font-mono text-[9.5px] font-semibold transition-all ${
                  showUsgsWaterOverlay
                    ? 'border-[#5ec8eb] bg-[#5ec8eb] text-[#0c161b]'
                    : 'border-[#5ec8eb]/45 bg-[#5ec8eb]/12 text-[#8cd7f0] hover:bg-[#5ec8eb]/25'
                }`}
              >
                {showUsgsWaterOverlay ? '✓ Map Overlay ON' : '+ Overlay on Map'}
              </button>
            </div>
          )}

          {healthMode === 'lidar' && (
            <div className="mt-2.5 flex items-center justify-between gap-1.5">
              <div className="relative min-w-0 flex-1">
                <select
                  aria-label="Select NASA or USGS LiDAR scan for this parcel"
                  value={selectedLidarId}
                  onChange={(e) => setSelectedLidarId(e.target.value)}
                  className="w-full appearance-none truncate rounded-full border border-[#f0bb66]/35 bg-[#1b1913]/90 py-1 pl-2.5 pr-6 font-mono text-[10px] font-medium text-[#f6deb2] focus:border-[#f0bb66] focus:outline-none"
                >
                  {(envIntel?.lidarScans || [
                    { id: 'usgs-3dep-1m', label: 'Loading NASA GEDI / ICESat-2 scans...' },
                  ]).map((s) => (
                    <option key={s.id} value={s.id} className="bg-[#181b16] text-[#f3f5ef]">
                      {s.label}
                    </option>
                  ))}
                </select>
                <CaretDown
                  size={10}
                  className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-[#f0bb66]"
                />
              </div>
              <button
                type="button"
                onClick={onToggleLidarOverlay}
                className={`shrink-0 rounded-full border px-2 py-0.5 font-mono text-[9.5px] font-semibold transition-all ${
                  showLidarOverlay
                    ? 'border-[#f0bb66] bg-[#f0bb66] text-[#181308]'
                    : 'border-[#f0bb66]/45 bg-[#f0bb66]/12 text-[#f6deb2] hover:bg-[#f0bb66]/25'
                }`}
              >
                {showLidarOverlay ? '✓ On Map' : '+ On Map'}
              </button>
            </div>
          )}

          {/* 16 x 6 INTERACTIVE MATRIX (Adapts Live to Stress / USGS Water Runoff / NASA LiDAR Elevation) */}
          <div
            className="mt-2 grid w-full grid-cols-16 gap-[3px] sm:gap-[3.5px]"
            onMouseLeave={() => onHoverStressCell(null)}
          >
            {displayedStressGrid.map((cell, idx) => {
              const hydro = cellHydrolidar[idx];
              const isHovered =
                hoveredStressCell?.row === cell.row && hoveredStressCell?.col === cell.col;
              const bgColor =
                healthMode === 'water'
                  ? waterRunoffColor(hydro?.runoffIndex ?? 0.4)
                  : healthMode === 'lidar'
                  ? lidarHypsometricColor(hydro?.lidarNorm ?? 0.5)
                  : stressColor(cell.severity);
              return (
                <button
                  key={`${cell.row}-${cell.col}`}
                  type="button"
                  onMouseEnter={() => onHoverStressCell(cell)}
                  onFocus={() => onHoverStressCell(cell)}
                  aria-label={`Row ${cell.row + 1} Col ${cell.col + 1}, Moisture ${cell.moisturePct}%, Elev ${hydro?.cellElevFt ?? 250} ft`}
                  style={{ backgroundColor: bgColor }}
                  className={`aspect-square w-full min-w-0 rounded-[3px] transition-transform duration-150 sm:rounded-[3.5px] ${
                    isHovered ? 'z-10 scale-125 ring-2 ring-white' : 'hover:scale-115'
                  }`}
                />
              );
            })}
          </div>

          {/* LIVE DETAILS SECTION PER MODE */}
          {healthMode === 'stress' && (
            <div className="mt-2.5 flex min-h-[38px] items-center justify-between gap-2">
              {hoveredStressCell ? (
                <div className="min-w-0 flex-1 text-[11px] leading-snug">
                  <div className="font-mono text-[10.5px] text-[#d8f274]">
                    R{hoveredStressCell.row + 1}·C{hoveredStressCell.col + 1} · Moist{' '}
                    {hoveredStressCell.moisturePct}% · NDVI {hoveredStressCell.ndvi}
                  </div>
                  <div className="truncate text-[#dce2d4]/72">{hoveredStressCell.note}</div>
                </div>
              ) : (
                <p className="text-[11.5px] leading-snug text-[#dce2d4]/68">
                  <strong className="tabular-nums font-semibold text-[#f3f5ef]">
                    +{selectedParcel.yieldProjectionPct}%
                  </strong>{' '}
                  yield increase based on projection
                </p>
              )}

              <button
                type="button"
                onClick={onOpenAIInsights}
                className="flex shrink-0 items-center gap-1.5 rounded-full bg-[#d8f274] px-3.5 py-1.5 text-[11.5px] font-semibold text-[#151811] shadow-[0_6px_18px_-4px_rgba(216,242,116,0.5)] transition-all hover:bg-[#e4f991] active:scale-[0.97]"
              >
                <Sparkle size={13} weight="fill" />
                <span>AI Insights</span>
              </button>
            </div>
          )}

          {healthMode === 'water' && (
            <div className="mt-2.5 space-y-1.5 rounded-xl border border-[#5ec8eb]/20 bg-[#0e171b]/75 p-2.5 text-[10.5px]">
              {hoveredStressCell ? (
                (() => {
                  const hCell = cellHydrolidar.find(
                    (c) => c.row === hoveredStressCell.row && c.col === hoveredStressCell.col
                  );
                  return (
                    <div className="flex items-center justify-between font-mono text-[10px] text-[#8cd7f0]">
                      <span>
                        Cell R{hoveredStressCell.row + 1}·C{hoveredStressCell.col + 1} · {hCell?.cellElevFt} ft
                      </span>
                      <span>
                        Runoff {Math.round((hCell?.runoffIndex ?? 0.5) * 100)}% ·{' '}
                        {(hCell?.runoffIndex ?? 0.5) > 0.72 ? 'Low Ponding Zone' : 'Draining'}
                      </span>
                    </div>
                  );
                })()
              ) : (
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate font-medium text-[#eef6f8]">
                    {envIntel ? `HUC-12: ${envIntel.watershedName}` : 'Querying USGS Water Dashboard...'}
                  </span>
                  <a
                    href={envIntel?.nearestGauge?.gaugeUrl || 'https://dashboard.waterdata.usgs.gov/app/nwd/en/'}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex shrink-0 items-center gap-1 font-mono text-[9.5px] font-semibold text-[#5ec8eb] hover:underline"
                  >
                    <span>USGS NWD</span>
                    <ArrowSquareOut size={11} />
                  </a>
                </div>
              )}

              <div className="grid grid-cols-3 gap-1.5 font-mono">
                <div className="rounded-lg bg-white/[0.04] px-2 py-1">
                  <div className="text-[8.5px] text-[#dce2d4]/50">DISCHARGE</div>
                  <div className="tabular-nums text-[11.5px] font-bold text-[#5ec8eb]">
                    {envIntel?.nearestGauge?.dischargeCfs != null
                      ? `${Math.round(envIntel.nearestGauge.dischargeCfs).toLocaleString()} cfs`
                      : loadingEnv
                      ? '...'
                      : 'N/A'}
                  </div>
                </div>
                <div className="rounded-lg bg-white/[0.04] px-2 py-1">
                  <div className="text-[8.5px] text-[#dce2d4]/50">STAGE / SLOPE</div>
                  <div className="tabular-nums text-[11.5px] font-bold text-[#eef2e8]">
                    {envIntel?.nearestGauge?.gageHeightFt != null
                      ? `${envIntel.nearestGauge.gageHeightFt.toFixed(1)} ft`
                      : envIntel
                      ? `${envIntel.elevation.slopePct}%`
                      : '...'}
                  </div>
                </div>
                <div className="rounded-lg bg-white/[0.04] px-2 py-1">
                  <div className="text-[8.5px] text-[#dce2d4]/50">RUNOFF</div>
                  <div className="tabular-nums text-[11.5px] font-bold text-[#d8f274]">
                    {envIntel ? `${envIntel.elevation.runoffBearing} · Δ${envIntel.elevation.reliefFt}ft` : '...'}
                  </div>
                </div>
              </div>

              {envIntel?.nearestGauge && (
                <div className="flex items-center justify-between gap-2 text-[9.5px] text-[#dce2d4]/62">
                  <span className="truncate" title={envIntel.nearestGauge.siteName}>
                    Gauge ({envIntel.nearestGauge.distanceMiles} mi): {envIntel.nearestGauge.siteName}
                  </span>
                  <span className="shrink-0 font-mono text-[#8ee3a4]">{envIntel.nearestGauge.floodStatus}</span>
                </div>
              )}
            </div>
          )}

          {healthMode === 'lidar' && (
            <div className="mt-2.5 space-y-1.5 rounded-xl border border-[#f0bb66]/22 bg-[#19160e]/78 p-2.5 text-[10.5px]">
              {hoveredStressCell ? (
                (() => {
                  const lCell = cellHydrolidar.find(
                    (c) => c.row === hoveredStressCell.row && c.col === hoveredStressCell.col
                  );
                  return (
                    <div className="flex items-center justify-between font-mono text-[10px] text-[#f6deb2]">
                      <span>
                        R{hoveredStressCell.row + 1}·C{hoveredStressCell.col + 1} · Elev {lCell?.cellElevFt} ft
                      </span>
                      <span>Canopy {lCell?.canopyFt} ft</span>
                    </div>
                  );
                })()
              ) : (
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate font-medium text-[#f6deb2]">
                    {activeLidarScan ? `${activeLidarScan.mission} · ${activeLidarScan.product}` : 'Querying NASA CMR...'}
                  </span>
                  <a
                    href={activeLidarScan?.browseUrl || 'https://search.earthdata.nasa.gov/'}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex shrink-0 items-center gap-1 font-mono text-[9.5px] font-semibold text-[#f0bb66] hover:underline"
                  >
                    <span>Earthdata</span>
                    <ArrowSquareOut size={11} />
                  </a>
                </div>
              )}

              <div className="grid grid-cols-3 gap-1.5 font-mono">
                <div className="rounded-lg bg-white/[0.04] px-2 py-1">
                  <div className="text-[8.5px] text-[#dce2d4]/50">ELEVATION</div>
                  <div className="tabular-nums text-[11.5px] font-bold text-[#f0bb66]">
                    {envIntel ? `${envIntel.elevation.centerFt} ft` : '...'}
                  </div>
                </div>
                <div className="rounded-lg bg-white/[0.04] px-2 py-1">
                  <div className="text-[8.5px] text-[#dce2d4]/50">RELIEF / SLOPE</div>
                  <div className="tabular-nums text-[11.5px] font-bold text-[#eef2e8]">
                    {envIntel ? `Δ${envIntel.elevation.reliefFt}ft · ${envIntel.elevation.slopePct}%` : '...'}
                  </div>
                </div>
                <div className="rounded-lg bg-white/[0.04] px-2 py-1">
                  <div className="text-[8.5px] text-[#dce2d4]/50">SENSOR</div>
                  <div className="truncate text-[10.5px] font-bold text-[#d8f274]">
                    {activeLidarScan?.resolutionLabel.split(' ')[0] || '1m'}
                  </div>
                </div>
              </div>

              {activeLidarScan && (
                <div className="flex items-center justify-between gap-2 font-mono text-[9px] text-[#dce2d4]/58">
                  <span className="truncate" title={activeLidarScan.granuleTitle}>
                    ID: {activeLidarScan.granuleTitle}
                  </span>
                  <span className="shrink-0 text-[#f0bb66]/85">{activeLidarScan.dateDisplay}</span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Bottom Microclimate Tiles: Avg. Humidity & Avg. Temperature */}
        <div className="mt-3.5 grid grid-cols-2 gap-2.5 border-t border-white/10 pt-3">
          <div className="flex items-center gap-2.5 rounded-2xl bg-white/[0.03] px-2.5 py-2">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/[0.05]">
              <Drop size={15} weight="duotone" className="text-[#dce2d4]/80" />
            </div>
            <div className="min-w-0">
              <div className="text-[10.5px] text-[#dce2d4]/58">Avg. Humidity</div>
              <div className="tabular-nums text-[16px] font-semibold leading-tight text-[#f5f7f1]">
                {selectedParcel.avgHumidityPct}%
              </div>
              <div className="tabular-nums text-[9.5px] text-[#dce2d4]/45">
                Max {selectedParcel.humidityMax}% · Min {selectedParcel.humidityMin}%
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2.5 rounded-2xl bg-white/[0.03] px-2.5 py-2">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/[0.05]">
              <Thermometer size={15} weight="duotone" className="text-[#dce2d4]/80" />
            </div>
            <div className="min-w-0">
              <div className="text-[10.5px] text-[#dce2d4]/58">Avg. Temperature</div>
              <div className="tabular-nums text-[16px] font-semibold leading-tight text-[#f5f7f1]">
                {formatTemp(selectedParcel.avgTempF, unit)}
              </div>
              <div className="tabular-nums text-[9.5px] text-[#dce2d4]/45">
                Max {formatTemp(selectedParcel.tempMaxF, unit)} · Min{' '}
                {formatTemp(selectedParcel.tempMinF, unit)}
              </div>
            </div>
          </div>
        </div>
      </section>
    </aside>
  );
};
