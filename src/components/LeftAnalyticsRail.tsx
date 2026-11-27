import React, { useMemo, useState } from 'react';
import {
  CaretDown,
  Drop,
  Sparkle,
  Thermometer,
  TrendUp,
  TrendDown,
} from '@phosphor-icons/react';
import { AreaUnit, Parcel, StressCell, TimeframeKey } from '../types/farm';
import { formatArea, formatTemp } from '../utils/units';

interface LeftAnalyticsRailProps {
  parcels: Parcel[];
  selectedParcel: Parcel;
  unit: AreaUnit;
  hoveredStressCell: StressCell | null;
  onHoverStressCell: (cell: StressCell | null) => void;
  onOpenAIInsights: () => void;
  onOpenParcelDetail: () => void;
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

export const LeftAnalyticsRail: React.FC<LeftAnalyticsRailProps> = ({
  parcels,
  selectedParcel,
  unit,
  hoveredStressCell,
  onHoverStressCell,
  onOpenAIInsights,
  onOpenParcelDetail,
}) => {
  const [scope, setScope] = useState<'parcel' | 'farm'>('parcel');
  const [timeframe, setTimeframe] = useState<TimeframeKey>('7d');
  const [dateIdx, setDateIdx] = useState(0);
  const [hoverTrendIdx, setHoverTrendIdx] = useState<number | null>(null);

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
            onClick={onOpenParcelDetail}
            className="truncate text-left text-[12px] font-medium text-[#dce2d4]/75 transition-colors hover:text-[#d8f274]"
            title="Inspect full Mississippi parcel dossier"
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
              {scope === 'parcel' ? selectedParcel.plss : `Panola Co. · ${parcels.length} plots`}
            </div>
          </div>
        </div>
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

      {/* CARD 3: Health Map (Stress Zones + AI Insights + Humidity/Temp) */}
      <section className="glass-panel flex flex-1 flex-col justify-between rounded-[22px] p-4">
        <div>
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-[14.5px] font-medium tracking-[-0.01em] text-[#f3f5ef]">
              Health Map
            </h2>
            <button
              type="button"
              onClick={() => setDateIdx((i) => (i + 1) % SNAPSHOT_DATES.length)}
              className="flex items-center gap-1.5 rounded-full border border-white/12 bg-white/[0.06] px-3 py-1 text-[11.5px] font-medium text-[#e9eee2] transition-colors hover:border-white/25"
              title="Cycle satellite pass date"
            >
              <span>{SNAPSHOT_DATES[dateIdx]}</span>
              <CaretDown size={11} className="text-[#dce2d4]/70" />
            </button>
          </div>

          <div className="mt-3 flex items-center justify-between">
            <span className="text-[12px] font-medium text-[#dce2d4]/75">Stress Zones</span>
            <span className="rounded-full border border-[#d8f274]/30 bg-[#d8f274]/10 px-2.5 py-0.5 text-[10.5px] font-medium text-[#d8f274]">
              {selectedParcel.statusBadge}
            </span>
          </div>

          {/* 16 x 6 Stress Zone Dot/Cell Matrix */}
          <div
            className="mt-2.5 grid w-full grid-cols-16 gap-[3px] sm:gap-[4px]"
            onMouseLeave={() => onHoverStressCell(null)}
          >
            {displayedStressGrid.map((cell) => {
              const isHovered =
                hoveredStressCell?.row === cell.row && hoveredStressCell?.col === cell.col;
              return (
                <button
                  key={`${cell.row}-${cell.col}`}
                  type="button"
                  onMouseEnter={() => onHoverStressCell(cell)}
                  onFocus={() => onHoverStressCell(cell)}
                  aria-label={`Row ${cell.row + 1} Col ${cell.col + 1}, Moisture ${cell.moisturePct}%, NDVI ${cell.ndvi}`}
                  style={{ backgroundColor: stressColor(cell.severity) }}
                  className={`aspect-square w-full min-w-0 rounded-[3px] transition-transform duration-150 sm:rounded-[3.5px] ${
                    isHovered ? 'z-10 scale-125 ring-2 ring-white' : 'hover:scale-115'
                  }`}
                />
              );
            })}
          </div>

          {/* Live Stress Cell Micro-Readout OR Projection + AI Insights CTA */}
          <div className="mt-3 flex min-h-[38px] items-center justify-between gap-2">
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
