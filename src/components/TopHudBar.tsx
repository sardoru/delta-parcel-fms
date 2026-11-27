import React, { useMemo, useRef, useState, useEffect } from 'react';
import {
  Bell,
  CloudSun,
  Drop,
  MagnifyingGlass,
  Plus,
  WarningCircle,
  CheckCircle,
  Info,
  WifiHigh,
  Wind,
  X,
  MapPinArea,
  Tractor,
} from '@phosphor-icons/react';
import { AreaUnit, DeltaAlert, EquipmentUnit, LiveWeather, Parcel } from '../types/farm';
import { formatArea, formatTemp, formatWind } from '../utils/units';

interface TopHudBarProps {
  parcels: Parcel[];
  equipment: EquipmentUnit[];
  selectedParcel: Parcel;
  alerts: DeltaAlert[];
  weather: LiveWeather;
  unit: AreaUnit;
  onToggleUnit: () => void;
  onSelectParcel: (parcelId: string) => void;
  onSelectEquipment: (eqId: string) => void;
  isDrawingPlot: boolean;
  onToggleDrawPlot: () => void;
}

export const TopHudBar: React.FC<TopHudBarProps> = ({
  parcels,
  equipment,
  selectedParcel,
  alerts,
  weather,
  unit,
  onToggleUnit,
  onSelectParcel,
  onSelectEquipment,
  isDrawingPlot,
  onToggleDrawPlot,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [alertsOpen, setAlertsOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);
  const alertsRef = useRef<HTMLDivElement>(null);
  const profileRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setSearchOpen(false);
      }
      if (alertsRef.current && !alertsRef.current.contains(e.target as Node)) {
        setAlertsOpen(false);
      }
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) {
        setProfileOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const searchResults = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return { parcels: parcels.slice(0, 8), equipment };
    return {
      parcels: parcels
        .filter(
          (p) =>
            p.name.toLowerCase().includes(q) ||
            p.parno.toLowerCase().includes(q) ||
            p.plss.toLowerCase().includes(q) ||
            p.siteAddress.toLowerCase().includes(q) ||
            p.crop.toLowerCase().includes(q) ||
            p.county.toLowerCase().includes(q) ||
            p.soilSeries.toLowerCase().includes(q)
        )
        .slice(0, 10),
      equipment: equipment.filter(
        (eq) =>
          eq.name.toLowerCase().includes(q) ||
          eq.model.toLowerCase().includes(q) ||
          eq.operator.toLowerCase().includes(q)
      ),
    };
  }, [searchQuery, parcels, equipment]);

  return (
    <header className="pointer-events-none flex flex-col gap-2.5 lg:flex-row lg:items-start lg:justify-between">
      {/* Left: Brand Title + Weather Pills */}
      <div className="pointer-events-auto flex min-w-0 flex-col gap-2">
        <div className="flex items-center gap-2.5">
          <h1 className="truncate text-[20px] font-semibold tracking-[-0.025em] text-[#f5f7f1] drop-shadow-[0_2px_10px_rgba(0,0,0,0.6)] sm:text-[23px]">
            Como, MS Farm Management
          </h1>
          <span className="hidden shrink-0 items-center rounded-full border border-white/15 bg-black/40 px-2.5 py-0.5 text-[10.5px] font-medium text-[#d8f274] backdrop-blur-md 2xl:inline-flex">
            Panola County · MARIS 2024
          </span>
        </div>

        {/* Live Como Weather Pills Row */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="glass-pill flex items-center gap-2 rounded-full px-3 py-1.5">
            <CloudSun size={17} weight="duotone" className="text-[#f0c75e]" />
            <div className="leading-tight">
              <div className="tabular-nums text-[12px] font-semibold text-[#f3f5ef]">
                {formatTemp(weather.tempF, unit)}
              </div>
              <div className="text-[10px] text-[#dce2d4]/65">{weather.condition}</div>
            </div>
          </div>

          <div className="glass-pill flex items-center gap-2 rounded-full px-3 py-1.5">
            <Wind size={16} weight="regular" className="text-[#d8f274]" />
            <div className="leading-tight">
              <div className="tabular-nums text-[12px] font-semibold text-[#f3f5ef]">
                {formatWind(weather.windMph, unit)}
              </div>
              <div className="text-[10px] text-[#dce2d4]/65">{weather.windDir}</div>
            </div>
          </div>

          <div className="glass-pill flex items-center gap-2 rounded-full px-3 py-1.5">
            <Drop size={16} weight="duotone" className="text-[#8ac7db]" />
            <div className="leading-tight">
              <div className="tabular-nums text-[12px] font-semibold text-[#f3f5ef]">
                {weather.humidityPct}%
              </div>
              <div className="text-[10px] text-[#dce2d4]/65">Humidity</div>
            </div>
          </div>
        </div>
      </div>

      {/* Right: Search, New Plot, Unit Toggle, Status, Notifications, Farmer Avatar */}
      <div className="pointer-events-auto flex shrink-0 flex-wrap items-center gap-2 lg:flex-nowrap">
        {/* Search Input Pill */}
        <div ref={searchRef} className="relative flex-1 sm:flex-initial">
          <div className="glass-pill flex h-10 w-full items-center gap-2 rounded-full px-3.5 transition-all focus-within:border-[#d8f274]/50 focus-within:bg-[#191d16]/90 sm:w-[195px] xl:w-[225px]">
            <input
              type="text"
              value={searchQuery}
              onFocus={() => setSearchOpen(true)}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setSearchOpen(true);
              }}
              placeholder="Search Como parcels, PARNO..."
              aria-label="Search Mississippi farm parcels and equipment"
              className="w-full bg-transparent text-[13px] text-[#f3f5ef] placeholder:text-[#dce2d4]/55 focus:outline-none"
            />
            {searchQuery ? (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="text-[#dce2d4]/60 hover:text-white"
                aria-label="Clear search"
              >
                <X size={14} />
              </button>
            ) : (
              <MagnifyingGlass size={16} className="shrink-0 text-[#dce2d4]/70" />
            )}
          </div>

          {searchOpen && (
            <div className="glass-panel-dense absolute right-0 top-12 z-50 w-[300px] overflow-hidden rounded-2xl p-2">
              <div className="px-2.5 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-[#dce2d4]/45">
                Mississippi Parcels ({searchResults.parcels.length})
              </div>
              {searchResults.parcels.length === 0 ? (
                <div className="px-2.5 py-3 text-[12px] text-[#dce2d4]/50">
                  No matching parcels found.
                </div>
              ) : (
                <div className="flex flex-col gap-0.5">
                  {searchResults.parcels.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => {
                        onSelectParcel(p.id);
                        setSearchOpen(false);
                        setSearchQuery('');
                      }}
                      className={`flex w-full items-center justify-between rounded-xl px-2.5 py-2 text-left transition-colors ${
                        p.id === selectedParcel.id
                          ? 'bg-[#d8f274]/15 text-[#f3f5ef]'
                          : 'hover:bg-white/7 text-[#e6ebe0]'
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <MapPinArea size={15} className="text-[#d8f274]" />
                        <div>
                          <div className="text-[12.5px] font-medium leading-tight">{p.name}</div>
                          <div className="text-[10.5px] text-[#dce2d4]/55">
                            {p.crop} · {formatArea(p.areaAcres, unit)}
                          </div>
                        </div>
                      </div>
                      <span className="tabular-nums text-[11.5px] font-semibold text-[#d8f274]">
                        {p.healthPct}%
                      </span>
                    </button>
                  ))}
                </div>
              )}

              {searchResults.equipment.length > 0 && (
                <>
                  <div className="mt-1.5 border-t border-white/8 px-2.5 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-wider text-[#dce2d4]/45">
                    Active Fleet
                  </div>
                  {searchResults.equipment.map((eq) => (
                    <button
                      key={eq.id}
                      type="button"
                      onClick={() => {
                        onSelectEquipment(eq.id);
                        setSearchOpen(false);
                        setSearchQuery('');
                      }}
                      className="flex w-full items-center justify-between rounded-xl px-2.5 py-1.5 text-left hover:bg-white/7"
                    >
                      <div className="flex items-center gap-2.5">
                        <Tractor size={15} className="text-[#e6a84c]" />
                        <div>
                          <div className="text-[12px] font-medium text-[#f3f5ef]">{eq.name}</div>
                          <div className="text-[10px] text-[#dce2d4]/55">{eq.model}</div>
                        </div>
                      </div>
                      <span className="text-[10.5px] text-[#dce2d4]/70">{eq.status}</span>
                    </button>
                  ))}
                </>
              )}
            </div>
          )}
        </div>

        {/* Add Parcel Plot Trigger */}
        <button
          type="button"
          onClick={onToggleDrawPlot}
          title="Survey and plot a new Mississippi farm parcel on the map"
          className={`flex h-10 items-center gap-1.5 rounded-full px-3.5 text-[12px] font-semibold transition-all active:scale-[0.98] ${
            isDrawingPlot
              ? 'bg-[#d8f274] text-[#141710] shadow-[0_8px_24px_-6px_rgba(216,242,116,0.55)]'
              : 'glass-pill text-[#f3f5ef] hover:border-[#d8f274]/45 hover:text-[#d8f274]'
          }`}
        >
          {isDrawingPlot ? <X size={14} weight="bold" /> : <Plus size={14} weight="bold" />}
          <span className="hidden sm:inline">{isDrawingPlot ? 'Cancel Plot' : 'Plot Parcel'}</span>
        </button>

        {/* Unit Toggle (ac/°F vs ha/°C) */}
        <button
          type="button"
          onClick={onToggleUnit}
          title="Switch between US Mississippi units (ac, °F, mph) and Metric (ha, °C, km/h)"
          className="glass-pill hidden h-10 items-center rounded-full px-3 font-mono text-[11px] font-medium text-[#e7ece0] transition-colors hover:border-[#d8f274]/40 md:flex"
        >
          <span className={unit === 'ac' ? 'text-[#d8f274] font-semibold' : 'text-[#dce2d4]/45'}>
            AC
          </span>
          <span className="mx-1 text-white/25">/</span>
          <span className={unit === 'ha' ? 'text-[#d8f274] font-semibold' : 'text-[#dce2d4]/45'}>
            HA
          </span>
        </button>

        {/* RTK / LTE Telemetry Indicator */}
        <div
          title="RTK Base Station Greenwood · 1.2cm Fix · LTE Strong"
          className="glass-pill hidden h-10 w-10 items-center justify-center rounded-full text-[#dce2d4]/80 lg:flex"
        >
          <WifiHigh size={17} weight="regular" className="text-[#d8f274]" />
        </div>

        {/* Notifications Bell */}
        <div ref={alertsRef} className="relative">
          <button
            type="button"
            onClick={() => setAlertsOpen((v) => !v)}
            aria-label="Delta farm alerts"
            className="glass-pill relative flex h-10 w-10 items-center justify-center rounded-full text-[#e8ede2] transition-colors hover:border-white/25"
          >
            <Bell size={17} weight="regular" />
            <span className="absolute right-2.5 top-2.5 h-1.5 w-1.5 rounded-full bg-[#e6a84c]" />
          </button>

          {alertsOpen && (
            <div className="glass-panel-dense absolute right-0 top-12 z-50 w-[320px] rounded-2xl p-3">
              <div className="mb-2 flex items-center justify-between px-1">
                <span className="text-[13px] font-semibold text-[#f3f5ef]">Delta Field Alerts</span>
                <span className="rounded-full bg-white/8 px-2 py-0.5 font-mono text-[10px] text-[#dce2d4]/70">
                  {alerts.length} active
                </span>
              </div>
              <div className="flex flex-col gap-1.5">
                {alerts.map((al) => (
                  <button
                    key={al.id}
                    type="button"
                    onClick={() => {
                      if (al.parcelId) onSelectParcel(al.parcelId);
                      setAlertsOpen(false);
                    }}
                    className="flex items-start gap-2.5 rounded-xl bg-white/[0.03] p-2.5 text-left transition-colors hover:bg-white/[0.07]"
                  >
                    {al.severity === 'warn' && (
                      <WarningCircle size={17} weight="fill" className="mt-0.5 shrink-0 text-[#e6a84c]" />
                    )}
                    {al.severity === 'info' && (
                      <Info size={17} weight="fill" className="mt-0.5 shrink-0 text-[#8ac7db]" />
                    )}
                    {al.severity === 'ok' && (
                      <CheckCircle size={17} weight="fill" className="mt-0.5 shrink-0 text-[#d8f274]" />
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <span className="truncate text-[12px] font-semibold text-[#f3f5ef]">
                          {al.title}
                        </span>
                        <span className="shrink-0 text-[10px] text-[#dce2d4]/45">{al.time}</span>
                      </div>
                      <p className="mt-0.5 text-[11px] leading-snug text-[#dce2d4]/68">
                        {al.detail}
                      </p>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Farmer Profile Avatar */}
        <div ref={profileRef} className="relative">
          <button
            type="button"
            onClick={() => setProfileOpen((v) => !v)}
            aria-label="Farm operator profile"
            className="h-10 w-10 overflow-hidden rounded-full border border-white/25 bg-[#20241c] shadow-lg transition-transform hover:scale-[1.03]"
          >
            <img
              src="/assets/farmer-avatar.jpg"
              alt="Caleb Vance - Vance Delta Farms"
              className="h-full w-full object-cover"
            />
          </button>

          {profileOpen && (
            <div className="glass-panel-dense absolute right-0 top-12 z-50 w-[260px] rounded-2xl p-3.5">
              <div className="flex items-center gap-3">
                <img
                  src="/assets/farmer-avatar.jpg"
                  alt="Caleb Vance"
                  className="h-11 w-11 rounded-full border border-white/20 object-cover"
                />
                <div>
                  <div className="text-[13.5px] font-semibold text-[#f3f5ef]">Caleb Vance</div>
                  <div className="text-[11px] text-[#dce2d4]/60">Vance Delta Farms LLC</div>
                </div>
              </div>
              <div className="mt-3 space-y-1.5 border-t border-white/10 pt-2.5 text-[11.5px] text-[#dce2d4]/75">
                <div className="flex justify-between">
                  <span className="text-[#dce2d4]/50">HQ Basin</span>
                  <span>Como, MS 38619</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#dce2d4]/50">County GIS</span>
                  <span className="font-mono text-[#d8f274]">Panola (FIPS 28107)</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#dce2d4]/50">Loaded Parcels</span>
                  <span className="tabular-nums font-medium">{parcels.length} plots</span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
