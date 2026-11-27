import React, { useState } from 'react';
import {
  CheckCircle,
  DownloadSimple,
  Drop,
  Leaf,
  MapPin,
  Plus,
  Sparkle,
  Tractor,
  WarningCircle,
  X,
} from '@phosphor-icons/react';
import { AreaUnit, EquipmentUnit, FieldLogEntry, Parcel } from '../types/farm';
import { formatArea, formatSpeed } from '../utils/units';

interface ParcelDetailDrawerProps {
  parcel: Parcel;
  unit: AreaUnit;
  onClose: () => void;
  onAddLog: (parcelId: string, entry: Omit<FieldLogEntry, 'id'>) => void;
}

export const ParcelDetailDrawer: React.FC<ParcelDetailDrawerProps> = ({
  parcel,
  unit,
  onClose,
  onAddLog,
}) => {
  const [logCategory, setLogCategory] = useState<FieldLogEntry['category']>('Scouting');
  const [logTitle, setLogTitle] = useState('');
  const [logDetail, setLogDetail] = useState('');

  const handleSubmitLog = (e: React.FormEvent) => {
    e.preventDefault();
    if (!logTitle.trim()) return;
    onAddLog(parcel.id, {
      date: 'Nov 26 · Now',
      category: logCategory,
      title: logTitle.trim(),
      operator: 'Caleb Vance',
      detail: logDetail.trim() || 'Recorded via DeltaPlot field cockpit.',
    });
    setLogTitle('');
    setLogDetail('');
  };

  const handleExport = () => {
    const blob = new Blob([JSON.stringify(parcel, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${parcel.id}-ms-parcel-report.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/45 backdrop-blur-[3px]">
      <div className="glass-panel-dense flex h-full w-full max-w-[460px] flex-col overflow-hidden border-l border-white/12">
        {/* Header */}
        <div className="flex items-start justify-between border-b border-white/10 p-5">
          <div>
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1 rounded-full bg-[#d8f274]/15 px-2.5 py-0.5 font-mono text-[10.5px] font-medium text-[#d8f274]">
                {parcel.fsaTract}
              </span>
              <span className="text-[11px] text-[#dce2d4]/60">{parcel.county}</span>
            </div>
            <h2 className="mt-1.5 text-[20px] font-semibold tracking-[-0.02em] text-[#f5f7f1]">
              {parcel.name}
            </h2>
            <p className="text-[12px] text-[#dce2d4]/65">
              {parcel.crop} · {parcel.variety}
            </p>
          </div>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={handleExport}
              title="Export parcel JSON dossier"
              className="flex h-8 w-8 items-center justify-center rounded-full border border-white/12 text-[#dce2d4]/80 hover:bg-white/10 hover:text-white"
            >
              <DownloadSimple size={16} />
            </button>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close parcel dossier"
              className="flex h-8 w-8 items-center justify-center rounded-full border border-white/12 text-[#dce2d4]/80 hover:bg-white/10 hover:text-white"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 space-y-5 overflow-y-auto p-5">
          {/* Core Survey & Soil Specs */}
          <div className="grid grid-cols-2 gap-2.5">
            <div className="rounded-2xl border border-white/8 bg-white/[0.03] p-3">
              <div className="text-[10.5px] text-[#dce2d4]/55">Surveyed / Cultivated</div>
              <div className="mt-0.5 tabular-nums text-[18px] font-semibold text-[#f5f7f1]">
                {formatArea(parcel.areaAcres, unit)}
              </div>
              <div className="font-mono text-[10px] text-[#d8f274]">
                {formatArea(parcel.cultivatedAcres, unit)} row-crop
              </div>
            </div>
            <div className="rounded-2xl border border-white/8 bg-white/[0.03] p-3">
              <div className="text-[10.5px] text-[#dce2d4]/55">Canopy Health / NDVI</div>
              <div className="mt-0.5 tabular-nums text-[18px] font-semibold text-[#d8f274]">
                {parcel.healthPct}%{' '}
                <span className="font-mono text-[12px] font-normal text-[#dce2d4]/65">
                  ({parcel.ndviMean.toFixed(2)})
                </span>
              </div>
              <div className="text-[10px] text-[#dce2d4]/50">Planted {parcel.plantingDate}</div>
            </div>
          </div>

          {/* Official Mississippi County MARIS Cadastral Record */}
          <div className="rounded-2xl border border-white/8 bg-white/[0.03] p-3.5">
            <div className="flex items-center justify-between">
              <h3 className="text-[12.5px] font-semibold text-[#f3f5ef]">
                {parcel.county.split(',')[0]} Cadastral Record
              </h3>
              <span className="rounded-full bg-[#d8f274]/14 px-2 py-0.5 font-mono text-[9.5px] text-[#d8f274]">
                {parcel.source}
              </span>
            </div>
            <div className="mt-2.5 space-y-1.5 text-[11.5px]">
              <div className="flex justify-between gap-2">
                <span className="text-[#dce2d4]/55">Registered Owner</span>
                <span className="text-right font-semibold text-[#d8f274]">{parcel.ownerName}</span>
              </div>
              <div className="flex justify-between gap-2">
                <span className="text-[#dce2d4]/55">Parcel ID (PARNO)</span>
                <span className="font-mono text-[#f3f5ef]">{parcel.parno}</span>
              </div>
              <div className="flex justify-between gap-2">
                <span className="text-[#dce2d4]/55">PLSS Survey</span>
                <span className="font-mono text-[#e5eae0]">{parcel.plss}</span>
              </div>
              <div className="flex justify-between gap-2">
                <span className="text-[#dce2d4]/55">Location</span>
                <span className="text-right text-[#e5eae0]">{parcel.siteAddress}</span>
              </div>
              {parcel.distanceToLandmarkMiles !== undefined && parcel.landmarkName && (
                <div className="flex justify-between gap-2">
                  <span className="text-[#dce2d4]/55">Haul to {parcel.landmarkName}</span>
                  <span className="font-mono font-semibold text-[#f0bb66]">
                    {parcel.distanceToLandmarkMiles} mi
                  </span>
                </div>
              )}
              <div className="flex justify-between gap-2">
                <span className="text-[#dce2d4]/55">GPS Centroid</span>
                <span className="font-mono text-[#dce2d4]/80">
                  {parcel.center.lat.toFixed(4)}°N, {Math.abs(parcel.center.lng).toFixed(4)}°W
                </span>
              </div>
              <div className="flex justify-between gap-2">
                <span className="text-[#dce2d4]/55">Legal Description</span>
                <span className="max-w-[235px] text-right text-[#dce2d4]/80">{parcel.legalDesc}</span>
              </div>
              {parcel.landValueUsd > 0 && (
                <div className="flex justify-between gap-2">
                  <span className="text-[#dce2d4]/55">Assessed Land ({parcel.taxYear})</span>
                  <span className="tabular-nums font-medium text-[#d8f274]">
                    ${parcel.landValueUsd.toLocaleString()}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* USDA Soil & Delta Irrigation Card */}
          <div className="rounded-2xl border border-white/8 bg-white/[0.03] p-3.5">
            <h3 className="flex items-center gap-2 text-[12.5px] font-semibold text-[#f3f5ef]">
              <MapPin size={15} className="text-[#d8f274]" />
              Soil & Water Profile (USDA NRCS)
            </h3>
            <div className="mt-2.5 space-y-2 text-[12px]">
              <div className="flex justify-between gap-2">
                <span className="text-[#dce2d4]/55">Soil Series</span>
                <span className="font-medium text-[#f3f5ef]">{parcel.soilSeries}</span>
              </div>
              <div className="flex justify-between gap-2">
                <span className="text-[#dce2d4]/55">Soil pH / CEC</span>
                <span className="font-mono text-[#d8f274]">
                  pH {parcel.soilPh} · {parcel.soilCec} meq/100g
                </span>
              </div>
              <div className="flex justify-between gap-2">
                <span className="text-[#dce2d4]/55">Drainage</span>
                <span className="text-right text-[#e5eae0]">{parcel.drainageClass}</span>
              </div>
              <div className="flex justify-between gap-2">
                <span className="text-[#dce2d4]/55">Irrigation</span>
                <span className="text-right text-[#e5eae0]">{parcel.irrigationMethod}</span>
              </div>
            </div>
          </div>

          {/* Add New Field Activity Form */}
          <form
            onSubmit={handleSubmitLog}
            className="rounded-2xl border border-white/10 bg-white/[0.03] p-3.5"
          >
            <h3 className="text-[12.5px] font-semibold text-[#f3f5ef]">Log Field Activity</h3>
            <div className="mt-2.5 flex gap-2">
              <select
                value={logCategory}
                onChange={(e) => setLogCategory(e.target.value as FieldLogEntry['category'])}
                className="rounded-xl border border-white/12 bg-[#161914] px-2.5 py-1.5 text-[11.5px] text-white focus:border-[#d8f274]/60 focus:outline-none"
              >
                <option value="Scouting">Scouting</option>
                <option value="Irrigation">Irrigation</option>
                <option value="Application">Application</option>
                <option value="Harvest">Harvest</option>
                <option value="Soil Sample">Soil Sample</option>
              </select>
              <input
                type="text"
                value={logTitle}
                onChange={(e) => setLogTitle(e.target.value)}
                placeholder="e.g. Check poly-pipe gate pressure"
                className="flex-1 rounded-xl border border-white/12 bg-black/30 px-3 py-1.5 text-[12px] text-white placeholder:text-[#dce2d4]/40 focus:border-[#d8f274]/60 focus:outline-none"
              />
            </div>
            <textarea
              rows={2}
              value={logDetail}
              onChange={(e) => setLogDetail(e.target.value)}
              placeholder="Field observations, moisture depth, or turnrow notes..."
              className="mt-2 w-full rounded-xl border border-white/12 bg-black/30 px-3 py-1.5 text-[12px] text-white placeholder:text-[#dce2d4]/40 focus:border-[#d8f274]/60 focus:outline-none"
            />
            <div className="mt-2 flex justify-end">
              <button
                type="submit"
                disabled={!logTitle.trim()}
                className="inline-flex items-center gap-1.5 rounded-full bg-[#d8f274] px-3.5 py-1.5 text-[11.5px] font-semibold text-[#141710] disabled:opacity-40"
              >
                <Plus size={13} weight="bold" />
                Add Entry
              </button>
            </div>
          </form>

          {/* Field Operations Timeline */}
          <div>
            <h3 className="mb-2.5 text-[12.5px] font-semibold text-[#f3f5ef]">
              Parcel Operations Log ({parcel.logs.length})
            </h3>
            <div className="space-y-2.5">
              {parcel.logs.map((log) => (
                <div
                  key={log.id}
                  className="rounded-2xl border border-white/8 bg-white/[0.025] p-3"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="rounded-full bg-white/8 px-2 py-0.5 text-[10px] font-medium text-[#d8f274]">
                      {log.category}
                    </span>
                    <span className="font-mono text-[10px] text-[#dce2d4]/50">{log.date}</span>
                  </div>
                  <div className="mt-1.5 text-[13px] font-medium text-[#f3f5ef]">{log.title}</div>
                  <p className="mt-0.5 text-[11.5px] leading-relaxed text-[#dce2d4]/68">
                    {log.detail}
                  </p>
                  <div className="mt-1.5 text-[10.5px] text-[#dce2d4]/45">
                    Operator: {log.operator}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

interface AIInsightsDrawerProps {
  parcel: Parcel;
  onClose: () => void;
  onPromoteToLog: (parcelId: string, title: string, detail: string) => void;
}

export const AIInsightsDrawer: React.FC<AIInsightsDrawerProps> = ({
  parcel,
  onClose,
  onPromoteToLog,
}) => {
  const [scheduledIds, setScheduledIds] = useState<string[]>([]);

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/45 backdrop-blur-[3px]">
      <div className="glass-panel-dense flex h-full w-full max-w-[440px] flex-col overflow-hidden border-l border-white/12">
        <div className="flex items-start justify-between border-b border-white/10 p-5">
          <div>
            <div className="inline-flex items-center gap-1.5 rounded-full bg-[#d8f274]/16 px-2.5 py-0.5 text-[11px] font-semibold text-[#d8f274]">
              <Sparkle size={12} weight="fill" />
              DeltaPlot AI Agronomy
            </div>
            <h2 className="mt-2 text-[19px] font-semibold text-[#f5f7f1]">
              {parcel.name} Prescriptions
            </h2>
            <p className="text-[12px] text-[#dce2d4]/62">
              Calibrated for {parcel.soilSeries} · {parcel.county}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close AI insights"
            className="flex h-8 w-8 items-center justify-center rounded-full border border-white/12 text-[#dce2d4]/80 hover:bg-white/10"
          >
            <X size={16} />
          </button>
        </div>

        <div className="flex-1 space-y-3.5 overflow-y-auto p-5">
          {parcel.aiInsights.map((item) => {
            const isAdded = scheduledIds.includes(item.id);
            return (
              <div
                key={item.id}
                className="rounded-2xl border border-white/10 bg-white/[0.03] p-4"
              >
                <div className="flex items-center justify-between gap-2">
                  <span
                    className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10.5px] font-semibold ${
                      item.priority === 'high'
                        ? 'bg-[#df694a]/20 text-[#f39378]'
                        : item.priority === 'medium'
                        ? 'bg-[#e6a84c]/20 text-[#f0bb66]'
                        : 'bg-[#d8f274]/18 text-[#d8f274]'
                    }`}
                  >
                    {item.priority === 'high' ? (
                      <WarningCircle size={12} weight="fill" />
                    ) : (
                      <Leaf size={12} weight="fill" />
                    )}
                    {item.priority === 'high'
                      ? 'Priority Action'
                      : item.priority === 'medium'
                      ? 'Optimization'
                      : 'Yield Opportunity'}
                  </span>
                </div>

                <h3 className="mt-2 text-[14px] font-semibold text-[#f5f7f1]">{item.title}</h3>
                <p className="mt-1 text-[12px] leading-relaxed text-[#dce2d4]/75">{item.action}</p>

                <div className="mt-3 rounded-xl bg-black/25 px-3 py-2 text-[11.5px]">
                  <div className="font-medium text-[#d8f274]">{item.impact}</div>
                  <div className="mt-0.5 text-[10.5px] text-[#dce2d4]/48">Ref: {item.msuRef}</div>
                </div>

                <div className="mt-3 flex justify-end">
                  <button
                    type="button"
                    disabled={isAdded}
                    onClick={() => {
                      onPromoteToLog(parcel.id, `[AI Plan] ${item.title}`, item.action);
                      setScheduledIds((prev) => [...prev, item.id]);
                    }}
                    className={`inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-[11.5px] font-semibold transition-all ${
                      isAdded
                        ? 'bg-white/10 text-[#d8f274]'
                        : 'bg-[#d8f274] text-[#141710] hover:bg-[#e5fa93]'
                    }`}
                  >
                    {isAdded ? (
                      <>
                        <CheckCircle size={14} weight="fill" />
                        Added to Field Log
                      </>
                    ) : (
                      <>
                        <Plus size={13} weight="bold" />
                        Schedule to Parcel Log
                      </>
                    )}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

interface EquipmentDrawerProps {
  equipment: EquipmentUnit;
  parcels: Parcel[];
  unit: AreaUnit;
  onClose: () => void;
  onReassignParcel: (eqId: string, parcelId: string) => void;
}

export const EquipmentDrawer: React.FC<EquipmentDrawerProps> = ({
  equipment,
  parcels,
  unit,
  onClose,
  onReassignParcel,
}) => {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-[3px]">
      <div className="glass-panel-dense w-full max-w-[420px] rounded-[24px] p-5">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[#d8f274]/15 text-[#d8f274]">
              {equipment.kind === 'tractor' ? <Tractor size={22} /> : <Drop size={22} />}
            </div>
            <div>
              <h3 className="text-[17px] font-semibold text-[#f5f7f1]">{equipment.name}</h3>
              <p className="text-[11.5px] text-[#dce2d4]/62">{equipment.model}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close equipment telemetry"
            className="flex h-8 w-8 items-center justify-center rounded-full border border-white/12 text-[#dce2d4]/80 hover:bg-white/10"
          >
            <X size={15} />
          </button>
        </div>

        <div className="mt-4 grid grid-cols-3 gap-2">
          <div className="rounded-xl bg-white/[0.04] p-2.5">
            <div className="text-[10px] text-[#dce2d4]/55">{equipment.primaryMetricLabel}</div>
            <div className="mt-0.5 tabular-nums text-[15px] font-semibold text-[#d8f274]">
              {equipment.primaryMetricValue}
            </div>
          </div>
          <div className="rounded-xl bg-white/[0.04] p-2.5">
            <div className="text-[10px] text-[#dce2d4]/55">Covered</div>
            <div className="mt-0.5 tabular-nums text-[15px] font-semibold text-[#f5f7f1]">
              {formatArea(equipment.areaCoveredAcres, unit)}
            </div>
          </div>
          <div className="rounded-xl bg-white/[0.04] p-2.5">
            <div className="text-[10px] text-[#dce2d4]/55">Ground Speed</div>
            <div className="mt-0.5 tabular-nums text-[15px] font-semibold text-[#f5f7f1]">
              {formatSpeed(equipment.speedMph, unit)}
            </div>
          </div>
        </div>

        <div className="mt-4 space-y-2 rounded-2xl border border-white/8 bg-white/[0.025] p-3.5 text-[12px]">
          <div className="flex justify-between">
            <span className="text-[#dce2d4]/55">Operator</span>
            <span className="font-medium text-[#f3f5ef]">{equipment.operator}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-[#dce2d4]/55">Active Task</span>
            <span className="text-right text-[#e5eae0]">{equipment.currentTask}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-[#dce2d4]/55">Implement Swath</span>
            <span className="font-mono text-[#f3f5ef]">{equipment.implementWidthFt} ft</span>
          </div>
          <div className="flex justify-between">
            <span className="text-[#dce2d4]/55">Engine Hours</span>
            <span className="font-mono text-[#f3f5ef]">{equipment.engineHours.toLocaleString()} h</span>
          </div>
        </div>

        <div className="mt-4">
          <label className="mb-1.5 block text-[11px] font-medium text-[#dce2d4]/68">
            Dispatch / Reassign to Mississippi Parcel
          </label>
          <select
            value={equipment.assignedParcelId}
            onChange={(e) => onReassignParcel(equipment.id, e.target.value)}
            className="w-full rounded-xl border border-white/15 bg-[#161914] px-3 py-2 text-[12.5px] text-white focus:border-[#d8f274]/60 focus:outline-none"
          >
            {parcels.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} ({p.crop} · {formatArea(p.areaAcres, unit)})
              </option>
            ))}
          </select>
        </div>
      </div>
    </div>
  );
};
