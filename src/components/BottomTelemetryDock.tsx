import React, { useMemo } from 'react';
import {
  ArrowUpRight,
  CaretDown,
  CaretUp,
  Clock,
  Crown,
  Minus,
  PaperPlaneTilt,
  Plus,
  Storefront,
  X,
} from '@phosphor-icons/react';
import { AreaUnit, EquipmentUnit, Parcel } from '../types/farm';
import { EQUIPMENT_CATALOG } from '../data/equipmentCatalog';
import { formatArea, formatSpeed, formatYield } from '../utils/units';

interface BottomTelemetryDockProps {
  equipment: EquipmentUnit[];
  selectedParcel: Parcel;
  selectedParcels: Parcel[];
  unit: AreaUnit;
  collapsed: boolean;
  onToggleCollapse: () => void;
  onClearMultiSelect: () => void;
  onOpenDroneMarketplace: (tab?: 'browse' | 'rfq' | 'vendor') => void;
  onSelectEquipment: (eq: EquipmentUnit) => void;
  onChangeEquipmentModel: (slot: 'primary' | 'applicator', catalogId: string) => void;
  onToggleEquipmentStatus: (slot: 'primary' | 'applicator') => void;
  onAdjustEquipmentSpeed: (slot: 'primary' | 'applicator', deltaMph: number) => void;
  onAdjustIrrigationZone: (zoneId: string) => void;
  onOpenParcelDetail: () => void;
}

const TractorWireframe: React.FC = () => (
  <svg viewBox="0 0 116 52" className="h-[44px] w-[98px]" fill="none">
    <ellipse cx="34" cy="36" rx="12" ry="12" stroke="rgba(243,245,239,0.72)" strokeWidth="1.3" />
    <ellipse cx="34" cy="36" rx="6" ry="6" stroke="rgba(243,245,239,0.45)" strokeWidth="1.1" />
    <circle cx="34" cy="36" r="2" fill="rgba(216,242,116,0.85)" />
    <ellipse cx="79" cy="40" rx="8" ry="8" stroke="rgba(243,245,239,0.72)" strokeWidth="1.3" />
    <ellipse cx="79" cy="40" rx="3.8" ry="3.8" stroke="rgba(243,245,239,0.45)" strokeWidth="1" />
    <path d="M27 25 L32 9 L53 9 L56 23 L27 25 Z" stroke="rgba(243,245,239,0.76)" strokeWidth="1.2" strokeLinejoin="round" />
    <path d="M40 9 L40 5.5 M37 5.5 L43 5.5" stroke="#d8f274" strokeWidth="1.3" strokeLinecap="round" />
    <path d="M54 20 L86 23 L88 35 L46 35" stroke="rgba(243,245,239,0.76)" strokeWidth="1.2" strokeLinejoin="round" />
    <path d="M58 20 L58 10 L61 8" stroke="rgba(243,245,239,0.55)" strokeWidth="1.2" strokeLinecap="round" />
  </svg>
);

const CottonPickerWireframe: React.FC = () => (
  <svg viewBox="0 0 124 52" className="h-[44px] w-[106px]" fill="none">
    {/* Round module builder rear */}
    <rect x="20" y="13" width="38" height="20" rx="4" stroke="rgba(243,245,239,0.75)" strokeWidth="1.25" />
    <circle cx="38" cy="23" r="6.5" stroke="#d8f274" strokeWidth="1.2" strokeDasharray="2.5 2" />
    {/* Forward cab */}
    <path d="M58 14 L76 14 L81 26 L58 26 Z" stroke="rgba(243,245,239,0.8)" strokeWidth="1.2" />
    <path d="M65 14 L65 10 M62 10 L68 10" stroke="#d8f274" strokeWidth="1.3" strokeLinecap="round" />
    {/* 6-row picking units front */}
    <path d="M81 24 L103 33 L103 40 L80 40 L80 28" stroke="rgba(243,245,239,0.75)" strokeWidth="1.2" strokeLinejoin="round" />
    <path d="M88 34 L101 34 M88 37 L101 37" stroke="#f0bb66" strokeWidth="1.1" />
    {/* Drive & steer tires */}
    <circle cx="67" cy="39" r="9.5" stroke="rgba(243,245,239,0.76)" strokeWidth="1.3" />
    <circle cx="67" cy="39" r="4" stroke="rgba(243,245,239,0.45)" strokeWidth="1" />
    <circle cx="29" cy="41" r="7" stroke="rgba(243,245,239,0.7)" strokeWidth="1.25" />
  </svg>
);

const CombineWireframe: React.FC = () => (
  <svg viewBox="0 0 128 52" className="h-[44px] w-[110px]" fill="none">
    {/* Unload auger */}
    <path d="M36 13 L12 8" stroke="#d8f274" strokeWidth="1.3" strokeLinecap="round" />
    {/* Grain tank & body */}
    <path d="M24 20 L34 11 L62 11 L68 20 L68 34 L24 34 Z" stroke="rgba(243,245,239,0.75)" strokeWidth="1.2" strokeLinejoin="round" />
    {/* Panoramic cab */}
    <path d="M68 14 L83 14 L87 26 L68 26 Z" stroke="rgba(243,245,239,0.8)" strokeWidth="1.2" />
    <path d="M75 14 L75 10 M72 10 L78 10" stroke="#d8f274" strokeWidth="1.3" strokeLinecap="round" />
    {/* Feederhouse & 40ft draper reel */}
    <path d="M84 26 L100 35 L112 35 L112 41 L92 41 L82 32" stroke="rgba(243,245,239,0.75)" strokeWidth="1.2" />
    <circle cx="107" cy="33" r="5" stroke="#f0bb66" strokeWidth="1.2" strokeDasharray="2 1.8" />
    {/* Front tracks + rear steer tire */}
    <rect x="61" y="34" width="22" height="10" rx="5" stroke="rgba(243,245,239,0.78)" strokeWidth="1.3" />
    <circle cx="33" cy="40" r="6.5" stroke="rgba(243,245,239,0.7)" strokeWidth="1.25" />
  </svg>
);

const SprayerWireframe: React.FC = () => (
  <svg viewBox="0 0 124 52" className="h-[44px] w-[108px]" fill="none">
    <path
      d="M8 22 L116 22 M14 18 L110 18 M20 18 L24 22 M34 18 L38 22 M86 18 L90 22 M100 18 L104 22"
      stroke="rgba(243,245,239,0.68)"
      strokeWidth="1.15"
      strokeLinecap="round"
    />
    <rect x="44" y="12" width="26" height="14" rx="4" stroke="rgba(243,245,239,0.78)" strokeWidth="1.25" />
    <path d="M70 15 L83 16 L86 26 L70 26 Z" stroke="rgba(243,245,239,0.75)" strokeWidth="1.2" />
    <path d="M46 26 L42 38 M76 26 L80 38" stroke="rgba(243,245,239,0.65)" strokeWidth="1.3" />
    <circle cx="41" cy="40" r="8" stroke="rgba(243,245,239,0.74)" strokeWidth="1.25" />
    <circle cx="41" cy="40" r="3.5" stroke="rgba(243,245,239,0.45)" strokeWidth="1" />
    <circle cx="81" cy="40" r="8" stroke="rgba(243,245,239,0.74)" strokeWidth="1.25" />
    <circle cx="81" cy="40" r="3.5" stroke="rgba(243,245,239,0.45)" strokeWidth="1" />
    <path
      d="M16 25 L16 30 M28 25 L28 30 M96 25 L96 30 M108 25 L108 30"
      stroke="#e6a84c"
      strokeWidth="1.25"
      strokeLinecap="round"
      strokeDasharray="1.5 2"
    />
  </svg>
);

const AerialAircraftWireframe: React.FC = () => (
  <svg viewBox="0 0 124 52" className="h-[44px] w-[108px]" fill="none">
    {/* Wings */}
    <path d="M12 24 L112 24 L106 28 L18 28 Z" stroke="rgba(243,245,239,0.78)" strokeWidth="1.2" />
    {/* Fuselage & cockpit */}
    <ellipse cx="62" cy="24" rx="10" ry="7" stroke="rgba(243,245,239,0.8)" strokeWidth="1.25" />
    <path d="M62 17 L62 8 M54 12 L70 12" stroke="rgba(243,245,239,0.6)" strokeWidth="1.2" strokeLinecap="round" />
    {/* Landing gear */}
    <path d="M54 30 L48 39 M70 30 L76 39" stroke="rgba(243,245,239,0.6)" strokeWidth="1.2" />
    <circle cx="48" cy="40" r="2.5" stroke="rgba(243,245,239,0.75)" strokeWidth="1.2" />
    <circle cx="76" cy="40" r="2.5" stroke="rgba(243,245,239,0.75)" strokeWidth="1.2" />
    {/* Spray mist plume */}
    <path d="M22 30 L22 36 M36 30 L36 36 M88 30 L88 36 M102 30 L102 36" stroke="#5ec8eb" strokeWidth="1.3" strokeDasharray="1.5 2" />
  </svg>
);

function renderMachineWireframe(kind: EquipmentUnit['kind']) {
  switch (kind) {
    case 'picker':
      return <CottonPickerWireframe />;
    case 'combine':
      return <CombineWireframe />;
    case 'sprayer':
      return <SprayerWireframe />;
    case 'aerial':
      return <AerialAircraftWireframe />;
    default:
      return <TractorWireframe />;
  }
}

const StepDutyChart: React.FC<{ steps: number[]; accent: string }> = ({ steps, accent }) => {
  const w = 160;
  const h = 32;
  const stepW = w / Math.max(1, steps.length - 1);
  let path = '';
  steps.forEach((v, i) => {
    const x = i * stepW;
    const y = h - 4 - v * (h - 9);
    if (i === 0) {
      path += `M ${x} ${y}`;
    } else {
      const prevY = h - 4 - steps[i - 1] * (h - 9);
      path += ` L ${x} ${prevY} L ${x} ${y}`;
    }
  });

  const lastX = w;
  const lastY = h - 4 - steps[steps.length - 1] * (h - 9);

  return (
    <svg viewBox={`0 0 ${w + 6} ${h}`} className="h-[32px] w-full overflow-visible">
      <line x1={0} y1={h - 4} x2={w} y2={h - 4} stroke="rgba(255,255,255,0.08)" strokeWidth="1" />
      <path d={path} fill="none" stroke={accent} strokeWidth="1.4" strokeOpacity="0.9" />
      <circle cx={lastX} cy={lastY} r="3" fill={accent} />
    </svg>
  );
};

export const BottomTelemetryDock: React.FC<BottomTelemetryDockProps> = ({
  equipment,
  selectedParcel,
  selectedParcels,
  unit,
  collapsed,
  onToggleCollapse,
  onClearMultiSelect,
  onOpenDroneMarketplace,
  onSelectEquipment,
  onChangeEquipmentModel,
  onToggleEquipmentStatus,
  onAdjustEquipmentSpeed,
  onAdjustIrrigationZone,
  onOpenParcelDetail,
}) => {
  const multiAcres = useMemo(
    () => Number(selectedParcels.reduce((s, p) => s + p.cultivatedAcres, 0).toFixed(1)),
    [selectedParcels]
  );
  const isMulti = selectedParcels.length > 1;
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
    <div className="flex flex-col gap-2">
      {/* Slim Floating Control Strip: Multi-Parcel Drone Spray Bids + Collapse / Hide Bottom Dock */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-1.5">
          {/* Multi-Parcel Selection Pill */}
          <div
            className={`glass-pill flex items-center gap-2 rounded-full px-3 py-1.5 text-[11px] transition-all ${
              isMulti
                ? 'border-[#5ec8eb]/60 bg-[#102028]/92 text-[#c8f0fc]'
                : 'text-[#dce2d4]/78'
            }`}
          >
            <span
              className={`h-2 w-2 rounded-full ${
                isMulti ? 'animate-pulse bg-[#5ec8eb]' : 'bg-[#d8f274]'
              }`}
            />
            <span className="font-medium">
              {isMulti ? (
                <>
                  <strong className="font-mono text-[#5ec8eb]">{selectedParcels.length} Parcels</strong> ·{' '}
                  {formatArea(multiAcres, unit)} selected
                </>
              ) : (
                <span className="hidden sm:inline">
                  Hold <kbd className="rounded bg-white/10 px-1 font-mono text-[9.5px]">⌘</kbd> /{' '}
                  <kbd className="rounded bg-white/10 px-1 font-mono text-[9.5px]">Shift</kbd> + Click map to
                  multi-select parcels
                </span>
              )}
            </span>
            {isMulti && (
              <button
                type="button"
                onClick={onClearMultiSelect}
                title="Clear multi-parcel selection"
                className="ml-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-white/10 text-[#dce2d4] hover:bg-white/25"
              >
                <X size={10} weight="bold" />
              </button>
            )}
          </div>

          {/* Open Drone Spray Marketplace / Request Bids CTA */}
          <button
            type="button"
            onClick={() => onOpenDroneMarketplace(isMulti ? 'rfq' : 'browse')}
            className={`flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-[11.5px] font-semibold transition-all active:scale-[0.98] ${
              isMulti
                ? 'bg-[#5ec8eb] text-[#0c161b] shadow-[0_8px_22px_-4px_rgba(94,200,235,0.6)] hover:bg-[#82ddfa]'
                : 'glass-pill border-[#5ec8eb]/40 bg-[#112027]/88 text-[#8cd7f0] hover:border-[#5ec8eb] hover:text-white'
            }`}
          >
            {isMulti ? <PaperPlaneTilt size={13} weight="bold" /> : <Storefront size={13} weight="duotone" />}
            <span>
              {isMulti
                ? `Request Drone Spray Bids (${selectedParcels.length})`
                : 'Drone Spray Marketplace'}
            </span>
          </button>

          {/* Direct Drone Vendor Territory Membership Portal Trigger */}
          <button
            type="button"
            onClick={() => onOpenDroneMarketplace('vendor')}
            className="glass-pill hidden items-center gap-1 rounded-full border-[#f0bb66]/30 bg-[#1d1911]/85 px-2.5 py-1.5 text-[10.5px] font-medium text-[#f6deb2] transition-colors hover:border-[#f0bb66]/70 hover:text-white md:flex"
            title="Drone spraying companies: join as Approved Vendor or Claim Exclusive Territory"
          >
            <Crown size={12} weight="fill" className="text-[#f0bb66]" />
            <span>Claim Territory</span>
          </button>
        </div>

        {/* Collapsible / Hideable Bottom Fleet & Yield Dock Toggle */}
        <button
          type="button"
          onClick={onToggleCollapse}
          aria-expanded={!collapsed}
          title={collapsed ? 'Expand Fleet, Irrigation & Yield Telemetry Dock' : 'Collapse & hide bottom telemetry dock'}
          className="glass-pill flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] font-medium text-[#e9eee2] transition-colors hover:border-[#d8f274]/50 hover:text-[#d8f274]"
        >
          {collapsed ? <CaretUp size={13} weight="bold" /> : <CaretDown size={13} weight="bold" />}
          <span>{collapsed ? 'Show Fleet & Yield Dock' : 'Hide Dock'}</span>
        </button>
      </div>

      {!collapsed && (
      <section className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-[minmax(250px,1.02fr)_minmax(250px,1.02fr)_minmax(340px,1.42fr)]">
      {/* Live Changeable Equipment Cards (Primary Harvester/Tractor & Sprayer/Applicator) */}
      {equipment.map((eq, cardIdx) => {
        const slot: 'primary' | 'applicator' = eq.slot || (cardIdx === 0 ? 'primary' : 'applicator');
        const options = EQUIPMENT_CATALOG.filter((m) => m.slot === slot);
        const isIdle = eq.status === 'Idle';
        const accent = isIdle
          ? '#9ba396'
          : slot === 'primary'
          ? '#d8f274'
          : eq.kind === 'aerial'
          ? '#5ec8eb'
          : '#e6a84c';
        const speedStep = eq.kind === 'aerial' ? 5 : 0.5;

        return (
          <article
            key={slot}
            className="glass-panel group flex flex-col justify-between rounded-[22px] p-3.5 transition-all hover:border-white/22"
          >
            {/* Header with Inline Machine Switcher Dropdown + Inspect Action */}
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <select
                    value={eq.catalogId || options[0]?.catalogId}
                    onChange={(e) => onChangeEquipmentModel(slot, e.target.value)}
                    aria-label={`Change ${slot === 'primary' ? 'harvester or tractor' : 'sprayer or applicator'} model`}
                    className="max-w-full cursor-pointer truncate rounded-lg border border-white/12 bg-white/[0.06] px-2 py-0.5 text-[13px] font-semibold text-[#f3f5ef] transition-colors hover:border-[#d8f274]/50 focus:border-[#d8f274] focus:outline-none"
                  >
                    {options.map((opt) => (
                      <option key={opt.catalogId} value={opt.catalogId} className="bg-[#161a15] text-[#f3f5ef]">
                        {opt.shortName} ({opt.implementWidthFt}ft)
                      </option>
                    ))}
                  </select>
                </div>
                <div className="mt-1 truncate font-mono text-[9.5px] text-[#dce2d4]/58" title={eq.currentTask}>
                  {selectedParcel.name} · {selectedParcel.crop}
                </div>
              </div>

              <div className="flex shrink-0 items-center gap-1">
                <button
                  type="button"
                  onClick={() => onSelectEquipment(eq)}
                  aria-label={`Inspect ${eq.name} telemetry`}
                  className="flex h-7 w-7 items-center justify-center rounded-full text-[#dce2d4]/65 transition-colors hover:bg-white/10 hover:text-white"
                >
                  <ArrowUpRight size={15} />
                </button>
              </div>
            </div>

            {/* Dynamic Machine Wireframe Schematic */}
            <div className="my-1 flex items-center justify-between gap-2 px-1">
              {renderMachineWireframe(eq.kind)}
              <div className="text-right font-mono text-[9.5px] leading-snug text-[#dce2d4]/65">
                <div className="font-semibold text-[#eef2e8]">
                  {eq.rateAcresPerHr ? `${eq.rateAcresPerHr} ac/hr` : 'Standby'}
                </div>
                <div className="text-[#dce2d4]/48">
                  {eq.etaHours ? `ETA ${eq.etaHours}h left` : 'Paused'}
                </div>
                <div className="text-[#dce2d4]/42">{eq.implementWidthFt}ft swath</div>
              </div>
            </div>

            {/* Interactive Status Toggle Pill + Connectivity */}
            <div className="mb-1 flex items-center justify-between">
              <button
                type="button"
                onClick={() => onToggleEquipmentStatus(slot)}
                title="Click to toggle machine status (Working / Online / Idle)"
                className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-medium transition-all hover:brightness-115 active:scale-[0.97]"
                style={{
                  borderColor: `${accent}55`,
                  backgroundColor: `${accent}1c`,
                  color: accent,
                }}
              >
                <span
                  className={`h-1.5 w-1.5 rounded-full ${eq.status === 'Working' ? 'animate-pulse' : ''}`}
                  style={{ backgroundColor: accent }}
                />
                {eq.status}
              </button>
              <span className="font-mono text-[9.5px] text-[#dce2d4]/52">
                {eq.operator.split(' ')[0]} · {eq.connectivity}
              </span>
            </div>

            {/* Live Stepped Activity Timeline + Parcel Coverage Progress */}
            <StepDutyChart steps={eq.activitySteps} accent={accent} />

            <div className="mt-0.5 flex items-center justify-between font-mono text-[9px] text-[#dce2d4]/48">
              <span>{eq.shiftStart}</span>
              <span className="text-[#dce2d4]/62">{Math.round(eq.shiftProgress * 100)}% of parcel</span>
              <span>{eq.shiftEnd}</span>
            </div>
            <div className="mt-1 h-[3px] w-full overflow-hidden rounded-full bg-white/12">
              <div
                className="h-full rounded-full transition-all duration-300"
                style={{ width: `${Math.round(eq.shiftProgress * 100)}%`, backgroundColor: accent }}
              />
            </div>

            {/* Bottom 3 Live Metrics + Interactive Speed Control */}
            <div className="mt-2.5 grid grid-cols-[1fr_1fr_1.25fr] items-end gap-1.5 border-t border-white/8 pt-2">
              <div>
                <div className="text-[9.5px] text-[#dce2d4]/50">{eq.primaryMetricLabel}</div>
                <div className="tabular-nums text-[12.5px] font-semibold text-[#f3f5ef]">
                  {eq.primaryMetricValue}
                </div>
              </div>
              <div>
                <div className="text-[9.5px] text-[#dce2d4]/50">Covered</div>
                <div className="tabular-nums text-[12.5px] font-semibold text-[#f3f5ef]">
                  {formatArea(eq.areaCoveredAcres, unit)}
                </div>
              </div>
              <div className="text-right">
                <div className="text-[9.5px] text-[#dce2d4]/50">Ground Speed</div>
                <div className="mt-0.5 flex items-center justify-end gap-1">
                  <button
                    type="button"
                    onClick={() => onAdjustEquipmentSpeed(slot, -speedStep)}
                    aria-label={`Decrease ${eq.name} speed`}
                    className="flex h-4.5 w-4.5 items-center justify-center rounded border border-white/15 bg-white/[0.05] text-[#dce2d4]/80 hover:border-[#d8f274]/60 hover:text-white"
                  >
                    <Minus size={9} weight="bold" />
                  </button>
                  <span className="min-w-[52px] text-center tabular-nums text-[12px] font-semibold text-[#f3f5ef]">
                    {formatSpeed(eq.speedMph, unit)}
                  </span>
                  <button
                    type="button"
                    onClick={() => onAdjustEquipmentSpeed(slot, speedStep)}
                    aria-label={`Increase ${eq.name} speed`}
                    className="flex h-4.5 w-4.5 items-center justify-center rounded border border-white/15 bg-white/[0.05] text-[#dce2d4]/80 hover:border-[#d8f274]/60 hover:text-white"
                  >
                    <Plus size={9} weight="bold" />
                  </button>
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
            <div className="shrink-0">
              <div className="tabular-nums text-[24px] font-semibold leading-none tracking-[-0.02em] text-[#f5f7f1]">
                ± {avgVariance.toFixed(1)}{' '}
                <span className="text-[13px] font-normal text-[#dce2d4]/65">min</span>
              </div>
              <div className="mt-1 text-[11px] text-[#dce2d4]/52">Average variance</div>
            </div>

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
      )}
    </div>
  );
};
