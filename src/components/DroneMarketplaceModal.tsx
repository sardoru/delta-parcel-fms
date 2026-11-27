import React, { useMemo, useState } from 'react';
import {
  CheckCircle,
  Crown,
  MapPin,
  PaperPlaneTilt,
  Plus,
  ShieldCheck,
  Sparkle,
  Star,
  Storefront,
  Trash,
  X,
} from '@phosphor-icons/react';
import { AreaUnit, Parcel } from '../types/farm';
import {
  DRONE_TERRITORIES,
  DroneRfqRecord,
  DroneSprayVendor,
  DroneTerritory,
  generateCompetitiveQuotes,
  inferTerritoryForParcel,
  VENDOR_MEMBERSHIP_PLANS,
  VendorTier,
} from '../data/droneMarketplace';
import { formatArea } from '../utils/units';

interface DroneMarketplaceModalProps {
  selectedParcels: Parcel[];
  unit: AreaUnit;
  vendors: DroneSprayVendor[];
  territories: DroneTerritory[];
  rfqs: DroneRfqRecord[];
  initialTab?: 'browse' | 'rfq' | 'vendor';
  onClose: () => void;
  onRemoveSelectedParcel: (parcelId: string) => void;
  onSubmitRfq: (rfq: DroneRfqRecord) => void;
  onAwardQuote: (rfqId: string, vendorId: string) => void;
  onRegisterVendor: (vendor: DroneSprayVendor, claimedTerritoryId?: string) => void;
}

const APPLICATION_TYPES = [
  'Cotton Defoliation & Boll Opener',
  'Fungicide Canopy Pass',
  'Fall Burndown / Herbicide',
  'Targeted Spot Spray (Weed/Insect)',
  'Cover Crop Aerial Seeding',
  'Desiccant / Harvest Aid',
];

export const DroneMarketplaceModal: React.FC<DroneMarketplaceModalProps> = ({
  selectedParcels,
  unit,
  vendors,
  territories,
  rfqs,
  initialTab = 'browse',
  onClose,
  onRemoveSelectedParcel,
  onSubmitRfq,
  onAwardQuote,
  onRegisterVendor,
}) => {
  const defaultTerritoryId = useMemo(
    () => (selectedParcels[0] ? inferTerritoryForParcel(selectedParcels[0]) : DRONE_TERRITORIES[0].id),
    [selectedParcels]
  );

  const [activeTab, setActiveTab] = useState<'browse' | 'rfq' | 'vendor'>(initialTab);
  const [territoryFilter, setTerritoryFilter] = useState<string>(defaultTerritoryId);
  const [selectedVendorIds, setSelectedVendorIds] = useState<string[]>([]);

  // RFQ Form state
  const [applicationType, setApplicationType] = useState(APPLICATION_TYPES[0]);
  const [carrierGpa, setCarrierGpa] = useState('2 GPA (ULV Drone)');
  const [targetWindow, setTargetWindow] = useState('Next 48 Hours (Calm Wind)');
  const [rfqNotes, setRfqNotes] = useState('');
  const [rfqSubmittedBanner, setRfqSubmittedBanner] = useState<string | null>(null);

  // Vendor Signup / Territory Claim state
  const [companyName, setCompanyName] = useState('');
  const [faaCert, setFaaCert] = useState('FAA-137-MS-');
  const [droneFleet, setDroneFleet] = useState('4× DJI Agras T50 (10.6 gal) + Tender Truck');
  const [baseRate, setBaseRate] = useState('13.00');
  const [vendorPhone, setVendorPhone] = useState('');
  const [vendorEmail, setVendorEmail] = useState('');
  const [selectedPlan, setSelectedPlan] = useState<VendorTier>('exclusive');
  const [claimTerritoryId, setClaimTerritoryId] = useState<string>(
    territories.find((t) => !t.claimedByVendorId)?.id || territories[0]?.id || ''
  );
  const [vendorSignupBanner, setVendorSignupBanner] = useState<string | null>(null);

  const totalAcres = useMemo(
    () => Number(selectedParcels.reduce((sum, p) => sum + p.cultivatedAcres, 0).toFixed(1)),
    [selectedParcels]
  );

  const activeTerritory = useMemo(
    () => territories.find((t) => t.id === territoryFilter) || territories[0],
    [territories, territoryFilter]
  );

  const filteredVendors = useMemo(() => {
    const list =
      territoryFilter === 'all'
        ? vendors
        : vendors.filter(
            (v) =>
              v.territoryIds.includes(territoryFilter) ||
              v.exclusiveTerritoryId === territoryFilter ||
              (activeTerritory && v.states.includes(activeTerritory.state))
          );
    const tierOrder: Record<VendorTier, number> = { exclusive: 0, priority: 1, approved: 2 };
    return [...list].sort((a, b) => {
      // Pin exclusive owner of the exact filtered territory at #1!
      const aExactExcl = a.exclusiveTerritoryId === territoryFilter ? -1 : 0;
      const bExactExcl = b.exclusiveTerritoryId === territoryFilter ? -1 : 0;
      if (aExactExcl !== bExactExcl) return aExactExcl - bExactExcl;
      if (tierOrder[a.tier] !== tierOrder[b.tier]) return tierOrder[a.tier] - tierOrder[b.tier];
      return b.rating - a.rating;
    });
  }, [vendors, territoryFilter, activeTerritory]);

  const toggleVendorSelection = (id: string) => {
    setSelectedVendorIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const handleCreateRfq = (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedParcels.length === 0) return;

    const targetVendors =
      selectedVendorIds.length > 0
        ? vendors.filter((v) => selectedVendorIds.includes(v.id))
        : filteredVendors.slice(0, 4);
    const finalVendors = targetVendors.length > 0 ? targetVendors : vendors.slice(0, 3);

    const quotes = generateCompetitiveQuotes(finalVendors, totalAcres, carrierGpa, targetWindow);
    const rfq: DroneRfqRecord = {
      id: `RFQ-${Math.floor(1000 + Math.random() * 9000)}`,
      createdAt: new Date().toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }),
      parcelIds: selectedParcels.map((p) => p.id),
      parcelNames: selectedParcels.map((p) => `${p.name} (${p.cultivatedAcres} ac)`),
      totalAcres,
      applicationType,
      carrierGpa,
      targetWindow,
      notes: rfqNotes.trim() || 'Standard FAA Part 137 drift buffer around adjacent fields & creeks.',
      territoryLabel: activeTerritory?.name || 'Mid-South Cotton Belt',
      quotes,
    };

    onSubmitRfq(rfq);
    setRfqSubmittedBanner(
      `Sent ${rfq.id} for ${selectedParcels.length} parcel${selectedParcels.length > 1 ? 's' : ''} (${formatArea(totalAcres, unit)}) to ${quotes.length} approved drone sprayers — instant quotes received below!`
    );
    setRfqNotes('');
  };

  const handleVendorSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!companyName.trim()) return;
    const claimedTerr = territories.find((t) => t.id === claimTerritoryId);
    const isExclusive = selectedPlan === 'exclusive';
    const newVendor: DroneSprayVendor = {
      id: `vnd-${Date.now()}`,
      companyName: companyName.trim(),
      faaPart137Cert: faaCert.trim() || 'FAA-137-PENDING',
      tier: selectedPlan,
      regionLabel: claimedTerr?.name || 'Regional Territory',
      states: [claimedTerr?.state || 'MS'],
      territoryIds: [claimTerritoryId],
      exclusiveTerritoryId: isExclusive ? claimTerritoryId : undefined,
      droneFleet: droneFleet.trim() || '4× DJI Agras T50',
      swarmCount: 4,
      maxAcresPerDay: 720,
      baseRatePerAcreUsd: Math.max(8, Math.min(35, Number(baseRate) || 13.5)),
      rating: 5.0,
      completedAcres: 0,
      responseSla: isExclusive ? '< 1 hr' : selectedPlan === 'priority' ? '< 2 hrs' : '< 4 hrs',
      services: ['Cotton Defoliant', 'Fungicide', 'Herbicide', 'Cover Seeding'],
      phone: vendorPhone.trim() || '662-555-0194',
      email: vendorEmail.trim() || 'dispatch@newdronevendor.com',
      verifiedDate: 'Just Activated',
    };

    onRegisterVendor(newVendor, isExclusive ? claimTerritoryId : undefined);
    setTerritoryFilter(claimTerritoryId);
    setVendorSignupBanner(
      `${newVendor.companyName} is now live as ${
        isExclusive
          ? `the Exclusive #1 Territory Sponsor for ${claimedTerr?.name}`
          : selectedPlan === 'priority'
          ? 'a Priority Territory Partner'
          : 'an Approved Regional Vendor'
      }!`
    );
    setCompanyName('');
    setActiveTab('browse');
  };

  const claimTerrObj = territories.find((t) => t.id === claimTerritoryId);
  const selectedPlanPrice =
    selectedPlan === 'exclusive'
      ? claimTerrObj?.exclusiveMonthlyUsd || 1250
      : VENDOR_MEMBERSHIP_PLANS.find((p) => p.id === selectedPlan)?.priceMonthlyUsd || 199;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/62 p-3 backdrop-blur-sm sm:p-5">
      <div className="glass-panel-dense flex max-h-[92dvh] w-full max-w-[980px] flex-col overflow-hidden rounded-[26px] border border-white/15 shadow-[0_28px_80px_rgba(0,0,0,0.85)]">
        {/* TOP MODAL HEADER */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 px-5 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-[#5ec8eb]/35 bg-[#5ec8eb]/14 text-[#5ec8eb]">
              <Storefront size={20} weight="duotone" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-[17px] font-semibold tracking-tight text-[#f5f8ee]">
                  Ag-Drone Spraying Marketplace &amp; Bid Exchange
                </h2>
                <span className="rounded-full bg-[#d8f274]/16 px-2 py-0.5 font-mono text-[9.5px] font-semibold text-[#d8f274]">
                  FAA Part 137 Network
                </span>
              </div>
              <p className="text-[11.5px] text-[#dce2d4]/62">
                Selected for quotation:{' '}
                <strong className="text-[#f3f5ef]">
                  {selectedParcels.length} parcel{selectedParcels.length === 1 ? '' : 's'}
                </strong>{' '}
                ({formatArea(totalAcres, unit)} cultivated) · Hold <kbd className="rounded bg-white/10 px-1 font-mono text-[10px]">⌘</kbd> /{' '}
                <kbd className="rounded bg-white/10 px-1 font-mono text-[10px]">Shift</kbd> + Click on map to add parcels
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close Drone Spray Marketplace"
            className="flex h-8 w-8 items-center justify-center rounded-full border border-white/12 text-[#dce2d4]/80 hover:bg-white/10 hover:text-white"
          >
            <X size={16} />
          </button>
        </div>

        {/* NAVIGATION TABS */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/10 bg-black/25 px-5 py-2.5">
          <div className="flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              onClick={() => setActiveTab('browse')}
              className={`rounded-full px-3.5 py-1.5 text-[12px] font-semibold transition-all ${
                activeTab === 'browse'
                  ? 'bg-[#d8f274] text-[#141710]'
                  : 'border border-white/10 bg-white/[0.04] text-[#dce2d4]/75 hover:text-white'
              }`}
            >
              Browse Approved Sprayers ({filteredVendors.length})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('rfq')}
              className={`flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-[12px] font-semibold transition-all ${
                activeTab === 'rfq'
                  ? 'bg-[#5ec8eb] text-[#0c161b]'
                  : 'border border-white/10 bg-white/[0.04] text-[#dce2d4]/75 hover:text-white'
              }`}
            >
              <PaperPlaneTilt size={13} weight="bold" />
              <span>Request Bid / Quotes ({rfqs.length})</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('vendor')}
              className={`flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-[12px] font-semibold transition-all ${
                activeTab === 'vendor'
                  ? 'bg-[#f0bb66] text-[#1a1409]'
                  : 'border border-[#f0bb66]/30 bg-[#f0bb66]/10 text-[#f6deb2] hover:bg-[#f0bb66]/18'
              }`}
            >
              <Crown size={13} weight="fill" />
              <span>Drone Vendor Signup &amp; Claim Territory</span>
            </button>
          </div>

          {activeTab === 'browse' && (
            <select
              value={territoryFilter}
              onChange={(e) => setTerritoryFilter(e.target.value)}
              aria-label="Filter drone vendors by territory"
              className="max-w-[280px] truncate rounded-full border border-white/14 bg-[#141814] px-3 py-1.5 font-mono text-[10.5px] text-[#eef2e8] focus:border-[#d8f274] focus:outline-none"
            >
              <option value="all">All Cotton Belt Territories</option>
              {territories.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          )}
        </div>

        {/* SCROLLABLE BODY */}
        <div className="flex-1 overflow-y-auto p-5">
          {vendorSignupBanner && activeTab === 'browse' && (
            <div className="mb-4 flex items-center justify-between rounded-2xl border border-[#63b97a]/45 bg-[#63b97a]/14 px-4 py-2.5 text-[12px] text-[#c7f5d4]">
              <span className="flex items-center gap-2">
                <CheckCircle size={16} weight="fill" className="text-[#8ee3a4]" />
                {vendorSignupBanner}
              </span>
              <button type="button" onClick={() => setVendorSignupBanner(null)} className="text-white/60 hover:text-white">
                <X size={13} />
              </button>
            </div>
          )}

          {/* ═══ TAB 1: BROWSE APPROVED DRONE SPRAYERS ═══ */}
          {activeTab === 'browse' && (
            <div className="space-y-4">
              {/* Territory Exclusive Banner */}
              {activeTerritory && territoryFilter !== 'all' && (
                <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-2.5 text-[11.5px]">
                  <div className="flex items-center gap-2">
                    <MapPin size={15} className="text-[#f0bb66]" />
                    <span className="font-semibold text-[#f3f5ef]">{activeTerritory.name}</span>
                    <span className="font-mono text-[10.5px] text-[#dce2d4]/55">
                      · ~{activeTerritory.cultivatedAcresEst.toLocaleString()} row-crop ac
                    </span>
                  </div>
                  {activeTerritory.claimedByVendorId ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-[#f0bb66]/16 px-2.5 py-0.5 font-mono text-[10px] font-semibold text-[#f0bb66]">
                      <Crown size={11} weight="fill" /> Exclusive Territory Claimed
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedPlan('exclusive');
                        setClaimTerritoryId(activeTerritory.id);
                        setActiveTab('vendor');
                      }}
                      className="inline-flex items-center gap-1 rounded-full border border-[#f0bb66]/45 bg-[#f0bb66]/14 px-2.5 py-0.5 font-mono text-[10px] font-semibold text-[#f6deb2] hover:bg-[#f0bb66] hover:text-[#181208]"
                    >
                      <Crown size={11} weight="fill" /> Claim Exclusive Territory (${activeTerritory.exclusiveMonthlyUsd}/mo)
                    </button>
                  )}
                </div>
              )}

              {/* Vendor Cards Grid */}
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                {filteredVendors.map((v) => {
                  const isPicked = selectedVendorIds.includes(v.id);
                  const estTotal = Math.round(v.baseRatePerAcreUsd * totalAcres);
                  const isExactExclusive = v.exclusiveTerritoryId === territoryFilter || v.tier === 'exclusive';
                  return (
                    <div
                      key={v.id}
                      className={`flex flex-col justify-between rounded-2xl border p-4 transition-all ${
                        isPicked
                          ? 'border-[#5ec8eb] bg-[#122026]/85'
                          : isExactExclusive
                          ? 'border-[#f0bb66]/45 bg-[#1b1912]/80'
                          : 'border-white/10 bg-white/[0.03] hover:border-white/22'
                      }`}
                    >
                      <div>
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <div className="flex flex-wrap items-center gap-1.5">
                              {v.tier === 'exclusive' ? (
                                <span className="inline-flex items-center gap-1 rounded-full bg-[#f0bb66]/20 px-2 py-0.5 font-mono text-[9.5px] font-bold text-[#f0bb66]">
                                  <Crown size={10} weight="fill" /> EXCLUSIVE TERRITORY
                                </span>
                              ) : v.tier === 'priority' ? (
                                <span className="inline-flex items-center gap-1 rounded-full bg-[#5ec8eb]/18 px-2 py-0.5 font-mono text-[9.5px] font-bold text-[#7fd5f2]">
                                  <Sparkle size={10} weight="fill" /> PRIORITY PARTNER
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 rounded-full bg-[#63b97a]/18 px-2 py-0.5 font-mono text-[9.5px] font-semibold text-[#8ee3a4]">
                                  <ShieldCheck size={10} weight="fill" /> APPROVED VENDOR
                                </span>
                              )}
                              <span className="font-mono text-[9.5px] text-[#dce2d4]/50">{v.faaPart137Cert}</span>
                            </div>
                            <h3 className="mt-1.5 text-[15px] font-semibold text-[#f5f8ee]">{v.companyName}</h3>
                            <div className="text-[11px] text-[#dce2d4]/62">{v.regionLabel}</div>
                          </div>
                          <div className="text-right">
                            <div className="tabular-nums font-mono text-[16px] font-bold text-[#d8f274]">
                              ${v.baseRatePerAcreUsd.toFixed(2)}
                              <span className="text-[10px] font-normal text-[#dce2d4]/55">/ac</span>
                            </div>
                            <div className="flex items-center justify-end gap-0.5 text-[10.5px] text-[#f0bb66]">
                              <Star size={11} weight="fill" />
                              <span className="font-mono font-semibold">{v.rating.toFixed(1)}</span>
                              <span className="text-[#dce2d4]/45">({Math.round(v.completedAcres / 1000)}k ac)</span>
                            </div>
                          </div>
                        </div>

                        <div className="mt-2.5 rounded-xl bg-black/35 px-3 py-2 font-mono text-[10.5px] text-[#dce2d4]/80">
                          <div>{v.droneFleet}</div>
                          <div className="mt-0.5 flex items-center justify-between text-[9.5px] text-[#dce2d4]/52">
                            <span>Capacity: {v.maxAcresPerDay.toLocaleString()} ac/day</span>
                            <span>SLA: {v.responseSla}</span>
                          </div>
                        </div>

                        <div className="mt-2 flex flex-wrap gap-1">
                          {v.services.map((svc) => (
                            <span
                              key={svc}
                              className="rounded-full border border-white/10 bg-white/[0.04] px-2 py-0.5 text-[10px] text-[#dce2d4]/75"
                            >
                              {svc}
                            </span>
                          ))}
                        </div>
                      </div>

                      <div className="mt-3 flex items-center justify-between border-t border-white/8 pt-2.5">
                        <div className="text-[11px] text-[#dce2d4]/65">
                          Est. Quote:{' '}
                          <strong className="font-mono text-[#f5f8ee]">${estTotal.toLocaleString()}</strong>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => toggleVendorSelection(v.id)}
                            className={`rounded-full px-2.5 py-1 text-[11px] font-semibold transition-colors ${
                              isPicked
                                ? 'bg-[#5ec8eb] text-[#0c161b]'
                                : 'border border-white/14 bg-white/[0.05] text-[#e5eae0] hover:border-white/30'
                            }`}
                          >
                            {isPicked ? '✓ Selected' : '+ Add to RFQ'}
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedVendorIds([v.id]);
                              setActiveTab('rfq');
                            }}
                            className="rounded-full bg-[#d8f274] px-3 py-1 text-[11px] font-bold text-[#13170f] hover:bg-[#e7fc95]"
                          >
                            Request Bid
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Sticky Broadcast CTA */}
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#5ec8eb]/30 bg-[#101c22]/85 px-4 py-3">
                <div className="text-[12px] text-[#d5f0fa]">
                  {selectedVendorIds.length > 0 ? (
                    <span>
                      <strong>{selectedVendorIds.length}</strong> drone sprayer{selectedVendorIds.length > 1 ? 's' : ''}{' '}
                      selected for your <strong>{selectedParcels.length}-parcel</strong> ({formatArea(totalAcres, unit)}) bid request.
                    </span>
                  ) : (
                    <span>
                      Broadcast a single multi-parcel bid request to all{' '}
                      <strong>{filteredVendors.length} approved drone sprayers</strong> in this territory.
                    </span>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => setActiveTab('rfq')}
                  className="flex items-center gap-1.5 rounded-full bg-[#5ec8eb] px-4 py-2 text-[12px] font-bold text-[#0b151a] hover:bg-[#82ddfa]"
                >
                  <PaperPlaneTilt size={14} weight="bold" />
                  <span>Configure &amp; Send Bid RFQ</span>
                </button>
              </div>
            </div>
          )}

          {/* ═══ TAB 2: MULTI-PARCEL BID RFQ & COMPETITIVE QUOTES ═══ */}
          {activeTab === 'rfq' && (
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1.05fr_1fr]">
              {/* Left: Multi-Parcel Selection + Bid Specification Form */}
              <form onSubmit={handleCreateRfq} className="space-y-3 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-[14px] font-semibold text-[#f5f8ee]">
                    1. Selected Farm Parcels ({selectedParcels.length})
                  </h3>
                  <span className="rounded-full bg-[#d8f274]/16 px-2.5 py-0.5 font-mono text-[10.5px] font-bold text-[#d8f274]">
                    Total: {formatArea(totalAcres, unit)}
                  </span>
                </div>

                <div className="max-h-[156px] space-y-1.5 overflow-y-auto pr-1">
                  {selectedParcels.map((p) => (
                    <div
                      key={p.id}
                      className="flex items-center justify-between gap-2 rounded-xl border border-white/8 bg-black/35 px-3 py-2 text-[11px]"
                    >
                      <div className="min-w-0">
                        <div className="truncate font-semibold text-[#f3f5ef]">{p.name}</div>
                        <div className="truncate font-mono text-[9.5px] text-[#dce2d4]/60">
                          {p.ownerName} · {p.crop} · {formatArea(p.cultivatedAcres, unit)}
                        </div>
                      </div>
                      {selectedParcels.length > 1 && (
                        <button
                          type="button"
                          onClick={() => onRemoveSelectedParcel(p.id)}
                          title="Remove parcel from bid batch"
                          className="text-[#dce2d4]/45 hover:text-[#df694a]"
                        >
                          <Trash size={13} />
                        </button>
                      )}
                    </div>
                  ))}
                </div>

                <div className="text-[10.5px] text-[#8cd7f0]">
                  Tip: Close modal and hold <strong>⌘ / Ctrl / Shift + Click</strong> on multiple farm parcels on the map to bundle them into one spray quotation!
                </div>

                <div className="grid grid-cols-1 gap-2.5 pt-1 sm:grid-cols-2">
                  <div>
                    <label className="mb-1 block text-[10.5px] text-[#dce2d4]/60">Application Type</label>
                    <select
                      value={applicationType}
                      onChange={(e) => setApplicationType(e.target.value)}
                      className="w-full rounded-xl border border-white/14 bg-[#141814] px-2.5 py-2 text-[12px] text-[#f3f5ef] focus:border-[#d8f274] focus:outline-none"
                    >
                      {APPLICATION_TYPES.map((t) => (
                        <option key={t} value={t}>
                          {t}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="mb-1 block text-[10.5px] text-[#dce2d4]/60">Drone Spray Volume</label>
                    <select
                      value={carrierGpa}
                      onChange={(e) => setCarrierGpa(e.target.value)}
                      className="w-full rounded-xl border border-white/14 bg-[#141814] px-2.5 py-2 text-[12px] text-[#f3f5ef] focus:border-[#d8f274] focus:outline-none"
                    >
                      <option>2 GPA (ULV Drone)</option>
                      <option>3 GPA (Standard Canopy)</option>
                      <option>5 GPA (Heavy Foliage)</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="mb-1 block text-[10.5px] text-[#dce2d4]/60">Target Flight Window</label>
                  <select
                    value={targetWindow}
                    onChange={(e) => setTargetWindow(e.target.value)}
                    className="w-full rounded-xl border border-white/14 bg-[#141814] px-2.5 py-2 text-[12px] text-[#f3f5ef] focus:border-[#d8f274] focus:outline-none"
                  >
                    <option>Next 48 Hours (Calm Wind)</option>
                    <option>This Week (Dawn / Dusk Preferred)</option>
                    <option>Flexible Dry Window (7 Days)</option>
                  </select>
                </div>

                <div>
                  <label className="mb-1 block text-[10.5px] text-[#dce2d4]/60">
                    Field Obstacles / Chemical Mix / Turnrow Notes
                  </label>
                  <textarea
                    rows={2}
                    value={rfqNotes}
                    onChange={(e) => setRfqNotes(e.target.value)}
                    placeholder="e.g., Powerlines along west road, 100ft buffer near creek, farmer supplying chemical..."
                    className="w-full rounded-xl border border-white/14 bg-[#141814] px-3 py-2 text-[12px] text-[#f3f5ef] placeholder:text-[#dce2d4]/35 focus:border-[#d8f274] focus:outline-none"
                  />
                </div>

                <button
                  type="submit"
                  className="flex w-full items-center justify-center gap-2 rounded-full bg-[#d8f274] py-2.5 text-[12.5px] font-bold text-[#141710] shadow-[0_8px_24px_-6px_rgba(216,242,116,0.55)] hover:bg-[#e7fc95]"
                >
                  <PaperPlaneTilt size={15} weight="bold" />
                  <span>
                    Send Bid Request to{' '}
                    {selectedVendorIds.length > 0 ? `${selectedVendorIds.length} Selected` : 'All Territory'} Drone
                    Sprayers
                  </span>
                </button>
              </form>

              {/* Right: Live Incoming Quotations & Active RFQs */}
              <div className="space-y-3">
                <h3 className="text-[14px] font-semibold text-[#f5f8ee]">
                  2. Active Bid Requests &amp; Quotations ({rfqs.length})
                </h3>

                {rfqSubmittedBanner && (
                  <div className="rounded-xl border border-[#63b97a]/45 bg-[#63b97a]/14 p-3 text-[11.5px] text-[#c7f5d4]">
                    {rfqSubmittedBanner}
                  </div>
                )}

                {rfqs.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-white/14 bg-white/[0.02] p-6 text-center text-[12px] text-[#dce2d4]/58">
                    No spray bid requests sent yet. Submit your {selectedParcels.length}-parcel quotation on the left to
                    receive live competitive bids from FAA Part 137 drone companies in this territory.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {rfqs.map((rfq) => (
                      <div key={rfq.id} className="rounded-2xl border border-white/12 bg-white/[0.03] p-3.5">
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-mono text-[11px] font-bold text-[#5ec8eb]">
                            {rfq.id} · {rfq.parcelIds.length} parcel{rfq.parcelIds.length > 1 ? 's' : ''} ·{' '}
                            {formatArea(rfq.totalAcres, unit)}
                          </span>
                          <span className="font-mono text-[10px] text-[#dce2d4]/48">{rfq.createdAt}</span>
                        </div>
                        <div className="mt-1 text-[11.5px] font-medium text-[#f3f5ef]">
                          {rfq.applicationType} · {rfq.carrierGpa}
                        </div>

                        <div className="mt-2.5 space-y-1.5">
                          {rfq.quotes.map((q) => {
                            const isAwarded = rfq.awardedVendorId === q.vendorId;
                            return (
                              <div
                                key={q.vendorId}
                                className={`flex items-center justify-between gap-2 rounded-xl border px-3 py-2 text-[11px] ${
                                  isAwarded
                                    ? 'border-[#63b97a]/60 bg-[#63b97a]/14'
                                    : 'border-white/8 bg-black/35'
                                }`}
                              >
                                <div className="min-w-0">
                                  <div className="flex items-center gap-1.5">
                                    {q.tier === 'exclusive' && <Crown size={11} weight="fill" className="text-[#f0bb66]" />}
                                    <span className="truncate font-semibold text-[#f5f8ee]">{q.vendorName}</span>
                                  </div>
                                  <div className="font-mono text-[9.5px] text-[#dce2d4]/55">
                                    {q.earliestWindow} · ~{q.estimatedFlightHours} flight hrs
                                  </div>
                                </div>
                                <div className="flex shrink-0 items-center gap-2">
                                  <div className="text-right font-mono">
                                    <div className="text-[12px] font-bold text-[#d8f274]">
                                      ${q.totalUsd.toLocaleString()}
                                    </div>
                                    <div className="text-[9px] text-[#dce2d4]/50">${q.ratePerAcreUsd.toFixed(2)}/ac</div>
                                  </div>
                                  {isAwarded ? (
                                    <span className="rounded-full bg-[#63b97a] px-2.5 py-1 font-mono text-[10px] font-bold text-[#0c1710]">
                                      ✓ Awarded
                                    </span>
                                  ) : (
                                    <button
                                      type="button"
                                      disabled={Boolean(rfq.awardedVendorId)}
                                      onClick={() => onAwardQuote(rfq.id, q.vendorId)}
                                      className="rounded-full border border-[#d8f274]/50 bg-[#d8f274]/14 px-2.5 py-1 font-mono text-[10px] font-semibold text-[#d8f274] hover:bg-[#d8f274] hover:text-[#12160f] disabled:opacity-35"
                                    >
                                      Accept Bid
                                    </button>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ═══ TAB 3: DRONE SPRAYER MEMBERSHIP & EXCLUSIVE TERRITORY CLAIM ═══ */}
          {activeTab === 'vendor' && (
            <div className="space-y-4">
              {/* 3 Membership Tiers */}
              <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                {VENDOR_MEMBERSHIP_PLANS.map((plan) => {
                  const active = selectedPlan === plan.id;
                  const price =
                    plan.id === 'exclusive'
                      ? claimTerrObj?.exclusiveMonthlyUsd || plan.priceMonthlyUsd
                      : plan.priceMonthlyUsd;
                  return (
                    <button
                      key={plan.id}
                      type="button"
                      onClick={() => setSelectedPlan(plan.id)}
                      className={`flex flex-col justify-between rounded-2xl border p-4 text-left transition-all ${
                        active
                          ? plan.id === 'exclusive'
                            ? 'border-[#f0bb66] bg-[#211c11]/90 shadow-[0_0_24px_rgba(240,187,102,0.22)]'
                            : 'border-[#d8f274] bg-[#1a2216]/90'
                          : 'border-white/10 bg-white/[0.03] hover:border-white/25'
                      }`}
                    >
                      <div>
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-mono text-[9.5px] font-bold uppercase tracking-wider text-[#f0bb66]">
                            {plan.badge}
                          </span>
                          {active && <CheckCircle size={16} weight="fill" className="text-[#d8f274]" />}
                        </div>
                        <div className="mt-1.5 text-[15px] font-semibold text-[#f5f8ee]">{plan.name}</div>
                        <div className="mt-1 font-mono text-[22px] font-bold text-[#d8f274]">
                          ${price.toLocaleString()}
                          <span className="text-[11px] font-normal text-[#dce2d4]/55">/mo</span>
                        </div>
                        <ul className="mt-2.5 space-y-1.5 text-[11px] text-[#dce2d4]/75">
                          {plan.perks.map((perk) => (
                            <li key={perk} className="flex items-start gap-1.5">
                              <span className="mt-0.5 text-[#d8f274]">✓</span>
                              <span>{perk}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* Territory Availability + Vendor Onboarding Form */}
              <form
                onSubmit={handleVendorSubmit}
                className="grid grid-cols-1 gap-4 rounded-2xl border border-white/12 bg-white/[0.03] p-4 lg:grid-cols-[1.05fr_1fr]"
              >
                <div className="space-y-2.5">
                  <h3 className="text-[13.5px] font-semibold text-[#f5f8ee]">
                    Select Target Territory {selectedPlan === 'exclusive' ? '(Exclusive Lock)' : '(Regional Listing)'}
                  </h3>
                  <div className="max-h-[245px] space-y-1.5 overflow-y-auto pr-1">
                    {territories.map((t) => {
                      const isClaimed = Boolean(t.claimedByVendorId);
                      const disabled = selectedPlan === 'exclusive' && isClaimed;
                      const isSelected = claimTerritoryId === t.id;
                      return (
                        <button
                          key={t.id}
                          type="button"
                          disabled={disabled}
                          onClick={() => setClaimTerritoryId(t.id)}
                          className={`flex w-full items-center justify-between gap-2 rounded-xl border px-3 py-2 text-left text-[11.5px] transition-colors ${
                            isSelected
                              ? 'border-[#f0bb66] bg-[#221d12]'
                              : disabled
                              ? 'cursor-not-allowed border-white/6 bg-black/25 opacity-45'
                              : 'border-white/10 bg-black/30 hover:border-white/25'
                          }`}
                        >
                          <div className="min-w-0">
                            <div className="truncate font-semibold text-[#f3f5ef]">{t.name}</div>
                            <div className="font-mono text-[9.5px] text-[#dce2d4]/55">
                              ~{t.cultivatedAcresEst.toLocaleString()} row-crop ac
                            </div>
                          </div>
                          <div className="shrink-0 text-right font-mono">
                            {isClaimed ? (
                              <span className="rounded-full bg-white/10 px-2 py-0.5 text-[9.5px] text-[#dce2d4]/60">
                                {selectedPlan === 'exclusive' ? 'Claimed' : 'Open (Non-Excl)'}
                              </span>
                            ) : (
                              <span className="text-[10.5px] font-bold text-[#f0bb66]">
                                ${t.exclusiveMonthlyUsd}/mo excl
                              </span>
                            )}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="space-y-2.5">
                  <h3 className="text-[13.5px] font-semibold text-[#f5f8ee]">Drone Company Application</h3>
                  <input
                    required
                    type="text"
                    value={companyName}
                    onChange={(e) => setCompanyName(e.target.value)}
                    placeholder="Company Name (e.g., Golden Triangle AgUAV LLC)"
                    className="w-full rounded-xl border border-white/14 bg-[#141814] px-3 py-2 text-[12px] text-[#f3f5ef] placeholder:text-[#dce2d4]/35 focus:border-[#d8f274] focus:outline-none"
                  />
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      required
                      type="text"
                      value={faaCert}
                      onChange={(e) => setFaaCert(e.target.value)}
                      placeholder="FAA Part 137 Cert #"
                      className="w-full rounded-xl border border-white/14 bg-[#141814] px-3 py-2 font-mono text-[11.5px] text-[#f3f5ef] focus:border-[#d8f274] focus:outline-none"
                    />
                    <input
                      required
                      type="number"
                      step="0.25"
                      min="8"
                      max="35"
                      value={baseRate}
                      onChange={(e) => setBaseRate(e.target.value)}
                      placeholder="Base $/acre"
                      className="w-full rounded-xl border border-white/14 bg-[#141814] px-3 py-2 font-mono text-[11.5px] text-[#f3f5ef] focus:border-[#d8f274] focus:outline-none"
                    />
                  </div>
                  <input
                    type="text"
                    value={droneFleet}
                    onChange={(e) => setDroneFleet(e.target.value)}
                    placeholder="Drone Fleet (e.g., 4× DJI Agras T50 + Tender)"
                    className="w-full rounded-xl border border-white/14 bg-[#141814] px-3 py-2 text-[12px] text-[#f3f5ef] focus:border-[#d8f274] focus:outline-none"
                  />
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      type="text"
                      value={vendorPhone}
                      onChange={(e) => setVendorPhone(e.target.value)}
                      placeholder="Dispatch Phone"
                      className="w-full rounded-xl border border-white/14 bg-[#141814] px-3 py-2 text-[12px] text-[#f3f5ef] focus:border-[#d8f274] focus:outline-none"
                    />
                    <input
                      type="email"
                      value={vendorEmail}
                      onChange={(e) => setVendorEmail(e.target.value)}
                      placeholder="Dispatch Email"
                      className="w-full rounded-xl border border-white/14 bg-[#141814] px-3 py-2 text-[12px] text-[#f3f5ef] focus:border-[#d8f274] focus:outline-none"
                    />
                  </div>
                  <button
                    type="submit"
                    className="mt-1 flex w-full items-center justify-center gap-2 rounded-full bg-[#f0bb66] py-2.5 text-[12.5px] font-bold text-[#181308] shadow-[0_8px_24px_-6px_rgba(240,187,102,0.5)] hover:bg-[#f8cf86]"
                  >
                    <Plus size={15} weight="bold" />
                    <span>
                      Activate {selectedPlan === 'exclusive' ? 'Exclusive Territory' : 'Vendor'} Membership ($
                      {selectedPlanPrice.toLocaleString()}/mo)
                    </span>
                  </button>
                </div>
              </form>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
