import React, { useMemo } from 'react';
import { ArrowUpRight, Clock } from '@phosphor-icons/react';
import { AreaUnit, EquipmentUnit, Parcel } from '../types/farm';
import { formatArea, formatSpeed, formatYield } from '../utils/units';

interface BottomTelemetryDockProps {
  equipment: EquipmentUnit[];
  selectedParcel: Parcel;
  unit: AreaUnit;
  onSelectEquipment: (eq: EquipmentUnit) => void;
  onAdjustIrrigationZone: (zoneId: string) => void;
  onOpenParcelDetail: () => void;
}

/** Crisp isometric technical schematic matching the wireframe tractor & sprayer in the reference HUD */
const TractorWireframe: React.FC = () => (
  <svg viewBox="0 0 110 52" className="h-[46px] w-[96px]" fill="none">
    {/* Rear large tire */}
    <ellipse cx="34" cy="36" rx="12" ry="12" stroke="rgba(243,245,239,0.68)" strokeWidth="1.3" />
    <ellipse cx="34" cy="36" rx="6" ry="6" stroke="rgba(243,245,239,0.45)" strokeWidth="1.1" />
    <circle cx="34" cy="36" r="2" fill="rgba(216,242,116,0.75)" />
    {/* Front tire */}
    <ellipse cx="77" cy="40" rx="8" ry="8" stroke="rgba(243,245,239,0.68)" strokeWidth="1.3" />
    <ellipse cx="77" cy="40" rx="3.8" ry="3.8" stroke="rgba(243,245,239,0.45)" strokeWidth="1" />
    {/* Cab */}
    <path
      d="M27 25 L32 9 L53 9 L56 23 L27 25 Z"
      stroke="rgba(243,245,239,0.72)"
      strokeWidth="1.2"
      strokeLinejoin="round"
    />
    {/* RTK Dome */}
    <path d="M40 9 L40 5.5 M37 5.5 L43 5.5" stroke="#d8f274" strokeWidth="1.3" strokeLinecap="round" />
    {/* Hood & chassis */}
    <path
      d="M54 20 L84 23 L86 35 L46 35"
      stroke="rgba(243,245,239,0.72)"
      strokeWidth="1.2"
      strokeLinejoin="round"
    />
    {/* Exhaust stack */}
    <path d="M58 20 L58 10 L61 8" stroke="rgba(243,245,239,0.55)" strokeWidth="1.2" strokeLinecap="round" />
    {/* Grille lines */}
    <path d="M74 25 L82 26 M74 28 L82 29" stroke="rgba(243,245,239,0.4)" strokeWidth="1" />
  </svg>
);

const SprayerWireframe: React.FC = () => (
  <svg viewBox="0 0 124 52" className="h-[46px] w-[108px]" fill="none">
    {/* High-clearance boom truss */}
    <path
      d="M8 22 L116 22 M14 18 L110 18 M20 18 L24 22 M34 18 L38 22 M86 18 L90 22 M100 18 L104 22"
      stroke="rgba(243,245,239,0.62)"
      strokeWidth="1.1"
      strokeLinecap="round"
    />
    {/* Tank & Forward Cab */}
    <rect x="44" y="12" width="26" height="14" rx="4" stroke="rgba(243,245,239,0.75)" strokeWidth="1.25" />
    <path d="M70 15 L83 16 L86 26 L70 26 Z" stroke="rgba(243,245,239,0.72)" strokeWidth="1.2" />
    {/* High-clearance legs & narrow row-crop tires */}
    <path d="M46 26 L42 38 M76 26 L80 38" stroke="rgba(243,245,239,0.6)" strokeWidth="1.3" />
    <circle cx="41" cy="40" r="8" stroke="rgba(243,245,239,0.7)" strokeWidth="1.25" />
    <circle cx="41" cy="40" r="3.5" stroke="rgba(243,245,239,0.45)" strokeWidth="1" />
    <circle cx="81" cy="40" r="8" stroke="rgba(243,245,239,0.7)" strokeWidth="1.25" />
    <circle cx="81" cy="40" r="3.5" stroke="rgba(243,245,239,0.45)" strokeWidth="1" />
    {/* Spray mist ticks under boom */}
    <path
      d="M16 25 L16 28 M28 25 L28 28 M96 25 L96 28 M108 25 L108 28"
      stroke="#e6a84c"
      strokeWidth="1.2"
      strokeLinecap="round"
      strokeDasharray="1.5 2"
    />
  </svg>
);

const StepDutyChart: React.FC<{ steps: number[]; accent: string }> = ({ steps, accent }) => {
  const w = 160;
  const h = 36;
  const stepW = w / Math.max(1, steps.length - 1);
  let path = '';
  steps.forEach((v, i) => {
    const x = i * stepW;
    const y = h - 4 - v * (h - 10);
    if (i === 0) {
      path += `M ${x} ${y}`;
    } else {
      const prevY = h - 4 - steps[i - 1] * (h - 10);
      path += ` L ${x} ${prevY} L ${x} ${y}`;
    }
  });

  const lastX = w;
  const lastY = h - 4 - steps[steps.length - 1] * (h - 10);

  return (
    <svg viewBox={`0 0 ${w + 6} ${h}`} className="h-[36px] w-full overflow-visible">
      <line x1={0} y1={h - 4} x2={w} y2={h - 4} stroke="rgba(255,255,255,0.08)" strokeWidth="1" />
      <path d={path} fill="none" stroke={accent} strokeWidth="1.4" strokeOpacity="0.88" />
      <circle cx={lastX} cy={lastY} r="3" fill={accent} />
    </svg>
  );
};

export const BottomTelemetryDock: React.FC<BottomTelemetryDockProps> = ({
  equipment,
  selectedParcel,
  unit,
  onSelectEquipment,
  onAdjustIrrigationZone,
  onOpenParcelDetail,
}) => {
  const avgVariance = useMemo(() => {
    const offsets = selectedParcel.irrigationOffsets;
    if (offsets.length === 0) return 0;
    const sumAbs = offsets.reduce((s, z) => s + Math.abs(z.offsetMin), 0);
    return Number((sumAbs / offsets.length).toFixed(1));
  }, [selectedParcel.irrigationOffsets]);

  const zoneA = selectedParcel.irrigationOffsets.filter((z) => z.zoneGroup === 'Zone A');
  const zoneB = selectedParcel.irrigationOffsets.filter((z) => z.zoneGroup === 'Zone B');

  const yieldFormatted = formatYield(selectedParcel.liveYieldLbs, unit);
  const [yieldLead, yieldTail] = useMemo(() => {
    const parts = yieldFormatted.value.split(',');
    if (parts.length <= 1) return [yieldFormatted.value, ''];
    return [parts.slice(0, -1).join(',') + ',', parts[parts.length - 1]];
  }, [yieldFormatted.value]);

  return (
    <section className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-[minmax(220px,0.92fr)_minmax(220px,0.92fr)_minmax(340px,1.55fr)]">
      {/* Equipment Cards (Tractor T-04 & Sprayer S-01) */}
      {equipment.map((eq) => {
        const isOnline = eq.status === 'Online';
        const accent = isOnline ? '#d8f274' : '#e6a84c';
        return (
          <article
            key={eq.id}
            onClick={() => onSelectEquipment(eq)}
            className="glass-panel group flex cursor-pointer flex-col justify-between rounded-[22px] p-4 transition-all hover:border-white/20"
          >
            {/* Header */}
            <div className="flex items-start justify-between gap-2">
              <div>
                <h3 className="text-[14px] font-medium text-[#f3f5ef]">{eq.name}</h3>
                <div className="font-mono text-[10px] text-[#dce2d4]/48">{eq.lastUpdated}</div>
              </div>
              <button
                type="button"
                aria-label={`Inspect ${eq.name} telemetry`}
                className="flex h-7 w-7 items-center justify-center rounded-full text-[#dce2d4]/65 transition-colors group-hover:bg-white/10 group-hover:text-white"
              >
                <ArrowUpRight size={15} />
              </button>
            </div>

            {/* Technical Wireframe + Status Row */}
            <div className="my-1 flex flex-col items-center">
              {eq.kind === 'tractor' ? <TractorWireframe /> : <SprayerWireframe />}
            </div>

            <div className="mb-1.5 flex items-center justify-between">
              <span
                className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-medium"
                style={{
                  borderColor: isOnline ? 'rgba(216,242,116,0.28)' : 'rgba(230,168,76,0.32)',
                  backgroundColor: isOnline ? 'rgba(216,242,116,0.10)' : 'rgba(230,168,76,0.12)',
                  color: accent,
                }}
              >
                <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: accent }} />
                {eq.status}
              </span>
              <span className="font-mono text-[10px] text-[#dce2d4]/52">{eq.connectivity}</span>
            </div>

            {/* Stepped Activity Timeline + Scrubber */}
            <StepDutyChart steps={eq.activitySteps} accent={accent} />

            <div className="mt-1 flex items-center justify-between font-mono text-[9.5px] text-[#dce2d4]/48">
              <span>{eq.shiftStart}</span>
              <span>{eq.shiftEnd}</span>
            </div>
            <div className="mt-1 h-[3px] w-full overflow-hidden rounded-full bg-white/12">
              <div
                className="h-full rounded-full transition-all duration-300"
                style={{ width: `${Math.round(eq.shiftProgress * 100)}%`, backgroundColor: accent }}
              />
            </div>

            {/* Bottom 3 Metrics */}
            <div className="mt-3 grid grid-cols-3 gap-2 border-t border-white/8 pt-2.5">
              <div>
                <div className="text-[10px] text-[#dce2d4]/50">{eq.primaryMetricLabel}</div>
                <div className="tabular-nums text-[13px] font-semibold text-[#f3f5ef]">
                  {eq.primaryMetricValue}
                </div>
              </div>
              <div>
                <div className="text-[10px] text-[#dce2d4]/50">Area</div>
                <div className="tabular-nums text-[13px] font-semibold text-[#f3f5ef]">
                  {formatArea(eq.areaCoveredAcres, unit)}
                </div>
              </div>
              <div className="text-right">
                <div className="text-[10px] text-[#dce2d4]/50">Speed</div>
                <div className="tabular-nums text-[13px] font-semibold text-[#f3f5ef]">
                  {formatSpeed(eq.speedMph, unit)}
                </div>
              </div>
            </div>
          </article>
        );
      })}

      {/* Right Wide Split Card: Irrigation Offset + Live Yield Volume */}
      <article className="glass-panel flex flex-col justify-between rounded-[22px] p-4 md:col-span-2 xl:col-span-1">
        {/* TOP HALF: Irrigation Offset */}
        <div>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <h3 className="text-[14px] font-medium text-[#f3f5ef]">Irrigation Offset</h3>
              <span className="hidden rounded-full bg-white/[0.06] px-2 py-0.5 text-[10px] text-[#dce2d4]/60 sm:inline">
                Click zone to tune
              </span>
            </div>
            <button
              type="button"
              onClick={onOpenParcelDetail}
              aria-label="Open irrigation and parcel dossier"
              className="flex h-7 w-7 items-center justify-center rounded-full text-[#dce2d4]/65 transition-colors hover:bg-white/10 hover:text-white"
            >
              <ArrowUpRight size={15} />
            </button>
          </div>

          <div className="mt-2.5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            {/* Variance Big Number */}
            <div className="shrink-0">
              <div className="tabular-nums text-[24px] font-semibold leading-none tracking-[-0.02em] text-[#f5f7f1]">
                ± {avgVariance.toFixed(1)}{' '}
                <span className="text-[13px] font-normal text-[#dce2d4]/65">min</span>
              </div>
              <div className="mt-1 text-[11px] text-[#dce2d4]/52">Average variance</div>
            </div>

            {/* Interactive Zone A / Zone B Matrix */}
            <div className="min-w-0 flex-1 overflow-x-auto">
              <table className="w-full border-collapse text-left text-[11px]">
                <thead>
                  <tr className="text-[10px] text-[#dce2d4]/42">
                    <th className="pb-1.5 pr-2 font-normal">Zone</th>
                    <th className="pb-1.5 px-1.5 font-normal">Z1</th>
                    <th className="pb-1.5 px-1.5 font-normal">Z2</th>
                    <th className="pb-1.5 px-1.5 font-normal">Z3</th>
                    <th className="pb-1.5 pl-1.5 font-normal">Z4</th>
                  </tr>
                </thead>
                <tbody className="tabular-nums">
                  {[
                    { name: 'Zone A', rows: zoneA },
                    { name: 'Zone B', rows: zoneB },
                  ].map((grp) => (
                    <tr key={grp.name}>
                      <td className="py-1 pr-2 text-[#dce2d4]/68">{grp.name}</td>
                      {grp.rows.map((z) => {
                        const isDelayed = z.offsetMin > 0;
                        return (
                          <td key={z.id} className="px-1 py-1">
                            <button
                              type="button"
                              onClick={() => onAdjustIrrigationZone(z.id)}
                              title={`${z.zoneGroup} ${z.label} (${z.valveType} · ${z.flowGpm} GPM) - click to calibrate offset`}
                              className={`inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 font-mono text-[10.5px] transition-colors ${
                                isDelayed
                                  ? 'bg-[#e6a84c]/15 text-[#f0bb66] hover:bg-[#e6a84c]/25'
                                  : 'text-[#dce2d4]/80 hover:bg-white/10'
                              }`}
                            >
                              {isDelayed && <Clock size={10} weight="bold" />}
                              <span>
                                {z.offsetMin > 0 ? `+${z.offsetMin}m` : `${z.offsetMin}m`}
                              </span>
                            </button>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* BOTTOM HALF: Live Yield Volume */}
        <div className="mt-3.5 border-t border-white/10 pt-3">
          <div className="flex items-center justify-between">
            <h3 className="text-[14px] font-medium text-[#f3f5ef]">Live Yield Volume</h3>
            <button
              type="button"
              onClick={onOpenParcelDetail}
              aria-label="Inspect harvest volume log"
              className="flex h-7 w-7 items-center justify-center rounded-full text-[#dce2d4]/65 transition-colors hover:bg-white/10 hover:text-white"
            >
              <ArrowUpRight size={15} />
            </button>
          </div>

          <div className="mt-2 flex items-end justify-between gap-4">
            <div className="shrink-0">
              <div className="tabular-nums text-[26px] font-semibold leading-none tracking-[-0.03em] text-[#f5f7f1]">
                {yieldLead}
                <span className="text-[#dce2d4]/50">{yieldTail}</span>
              </div>
              <div className="mt-1.5 text-[11px] text-[#dce2d4]/54">
                {unit === 'ha' ? yieldFormatted.unitText : selectedParcel.yieldUnitLabel}
              </div>
            </div>

            {/* Live Harvest Spectrum Bars (exact visual motif from reference bottom-right) */}
            <div className="flex h-[52px] flex-1 items-end justify-end gap-[4px] border-b border-white/10 pb-1">
              {selectedParcel.yieldBars.map((val, idx) => {
                const isPeak = val >= 70;
                return (
                  <div
                    key={idx}
                    className="relative flex h-full w-[5px] flex-col items-center justify-end"
                    title={`Load interval #${idx + 1}: ${val}% peak rate`}
                  >
                    <div className="absolute inset-y-0 w-[1px] bg-white/[0.06]" />
                    <div
                      className="relative z-10 w-full rounded-t-[2px] transition-all duration-300"
                      style={{
                        height: `${Math.max(14, val)}%`,
                        background: isPeak
                          ? 'linear-gradient(180deg, #e0f682 0%, rgba(216,242,116,0.45) 100%)'
                          : 'rgba(255,255,255,0.16)',
                      }}
                    />
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </article>
    </section>
  );
};
