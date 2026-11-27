import React, { useMemo, useRef, useState } from 'react';
import {
  ArrowSquareOut,
  Certificate,
  CheckCircle,
  Copy,
  DownloadSimple,
  EnvelopeSimple,
  Eye,
  FileArrowUp,
  FileText,
  Flask,
  HouseLine,
  Leaf,
  MapPinArea,
  PaperPlaneTilt,
  Plant,
  Plus,
  SealCheck,
  ShieldCheck,
  Trash,
  WarningCircle,
  X,
} from '@phosphor-icons/react';
import {
  AreaUnit,
  CoverCropOption,
  Parcel,
  ParcelClaimRecord,
  ParcelCropProfile,
  ParcelDetailTab,
  ParcelDocument,
  ParcelDocumentCategory,
} from '../types/farm';
import {
  buildDefaultCropProfile,
  COVER_CROP_OPTIONS,
  DOCUMENT_CATEGORIES,
  formatBytes,
} from '../data/parcelOwnerStore';
import { DroneRfqRecord } from '../data/droneMarketplace';
import { formatArea } from '../utils/units';

type PortalTab = 'overview' | 'crops' | 'vault' | 'claims';

interface FarmerPortalModalProps {
  parcels: Parcel[];
  unit: AreaUnit;
  cropProfiles: Record<string, ParcelCropProfile>;
  documents: ParcelDocument[];
  claims: Record<string, ParcelClaimRecord>;
  droneRfqs: DroneRfqRecord[];
  authIssueUrl?: string;
  initialTab?: PortalTab;
  onClose: () => void;
  onFocusParcelOnMap: (parcelId: string) => void;
  onOpenParcelDrawer: (parcelId: string, tab: ParcelDetailTab) => void;
  onUpdateCropProfile: (parcelId: string, next: ParcelCropProfile) => void;
  onUploadDocument: (doc: ParcelDocument) => void;
  onDeleteDocument: (docId: string) => void;
  onVerifyClaimPin: (parcelId: string, pinInput: string) => boolean;
  onOpenDroneRfqForParcels: (parcelIds: string[]) => void;
}

export const FarmerPortalModal: React.FC<FarmerPortalModalProps> = ({
  parcels,
  unit,
  cropProfiles,
  documents,
  claims,
  droneRfqs,
  authIssueUrl,
  initialTab = 'overview',
  onClose,
  onFocusParcelOnMap,
  onOpenParcelDrawer,
  onUpdateCropProfile,
  onUploadDocument,
  onDeleteDocument,
  onVerifyClaimPin,
  onOpenDroneRfqForParcels,
}) => {
  const [activeTab, setActiveTab] = useState<PortalTab>(initialTab);
  const [showAllInCrops, setShowAllInCrops] = useState(false);
  const [vaultFilter, setVaultFilter] = useState<'All' | ParcelDocumentCategory>('All');
  const [pinDrafts, setPinDrafts] = useState<Record<string, string>>({});
  const [pinErrors, setPinErrors] = useState<Record<string, string>>({});
  const [previewPostcardId, setPreviewPostcardId] = useState<string | null>(null);

  // Quick vault uploader state
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploadParcelId, setUploadParcelId] = useState<string>(() => parcels[0]?.id || '');
  const [uploadCategory, setUploadCategory] = useState<ParcelDocumentCategory>('Soil Test');
  const [uploadTitle, setUploadTitle] = useState('');
  const [uploadIssuer, setUploadIssuer] = useState('');
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadDataUrl, setUploadDataUrl] = useState<string | undefined>(undefined);
  const [uploadPh, setUploadPh] = useState('');
  const [uploadOm, setUploadOm] = useState('');

  const allClaimList = useMemo(() => Object.values(claims), [claims]);
  const verifiedClaims = useMemo(
    () => allClaimList.filter((c) => c.status === 'verified'),
    [allClaimList]
  );
  const pendingClaims = useMemo(
    () => allClaimList.filter((c) => c.status === 'postcard_mailed'),
    [allClaimList]
  );

  const parcelById = useMemo(() => new Map(parcels.map((p) => [p.id, p])), [parcels]);

  const farmEntityName =
    verifiedClaims[0]?.farmEntityName ||
    pendingClaims[0]?.farmEntityName ||
    'My Farm Management Portal';

  const getCropProfile = (p: Parcel): ParcelCropProfile =>
    cropProfiles[p.id] || buildDefaultCropProfile(p);

  const claimedParcelsResolved = useMemo(() => {
    return allClaimList
      .map((claim) => ({
        claim,
        parcel: parcelById.get(claim.parcelId),
      }))
      .sort((a, b) => (a.claim.status === 'verified' ? -1 : 1) - (b.claim.status === 'verified' ? -1 : 1));
  }, [allClaimList, parcelById]);

  const portfolioStats = useMemo(() => {
    const verifiedAcres = verifiedClaims.reduce((s, c) => s + c.areaAcres, 0);
    const pendingAcres = pendingClaims.reduce((s, c) => s + c.areaAcres, 0);

    const activeSet =
      verifiedClaims.length > 0
        ? verifiedClaims
            .map((c) => parcelById.get(c.parcelId))
            .filter((p): p is Parcel => Boolean(p))
        : parcels.slice(0, 6);

    const coverAcres = activeSet.reduce((s, p) => {
      const cp = getCropProfile(p);
      return cp.coverCrop !== 'None (Stubble / Bare)' ? s + p.areaAcres : s;
    }, 0);
    const totalRefAcres = Math.max(
      1,
      activeSet.reduce((s, p) => s + p.areaAcres, 0)
    );
    const coverPct = Math.round((coverAcres / totalRefAcres) * 100);

    const avgHealth =
      activeSet.length > 0
        ? Math.round(activeSet.reduce((s, p) => s + p.healthPct, 0) / activeSet.length)
        : 0;

    const soilTestsCount = documents.filter((d) => d.category === 'Soil Test').length;
    const certsCount = documents.filter((d) => d.category === 'Certification').length;

    return {
      verifiedAcres,
      pendingAcres,
      coverPct,
      avgHealth,
      soilTestsCount,
      certsCount,
    };
  }, [verifiedClaims, pendingClaims, parcels, parcelById, cropProfiles, documents]);

  const matrixParcels = useMemo(() => {
    if (!showAllInCrops && claimedParcelsResolved.length > 0) {
      return claimedParcelsResolved
        .map((x) => x.parcel)
        .filter((p): p is Parcel => Boolean(p));
    }
    return parcels.slice(0, 18);
  }, [showAllInCrops, claimedParcelsResolved, parcels]);

  const filteredVaultDocs = useMemo(() => {
    if (vaultFilter === 'All') return documents;
    return documents.filter((d) => d.category === vaultFilter);
  }, [documents, vaultFilter]);

  const handlePortalVerifyPin = (parcelId: string) => {
    const code = pinDrafts[parcelId] || '';
    const ok = onVerifyClaimPin(parcelId, code);
    if (!ok) {
      setPinErrors((prev) => ({
        ...prev,
        [parcelId]: 'PIN mismatch — check the 6-digit code printed on your USPS postcard.',
      }));
    } else {
      setPinErrors((prev) => {
        const next = { ...prev };
        delete next[parcelId];
        return next;
      });
      setPinDrafts((prev) => ({ ...prev, [parcelId]: '' }));
    }
  };

  const handleQuickUpload = (e: React.FormEvent) => {
    e.preventDefault();
    const targetParcel = parcelById.get(uploadParcelId) || parcels[0];
    if (!targetParcel) return;
    const title = uploadTitle.trim() || uploadFile?.name || `${uploadCategory} Upload`;
    const fileName =
      uploadFile?.name || `${title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.pdf`;
    onUploadDocument({
      id: `doc-${Date.now()}`,
      parcelId: targetParcel.id,
      parcelName: targetParcel.name,
      category: uploadCategory,
      title,
      fileName,
      fileType: uploadFile?.type || 'application/pdf',
      fileSizeBytes: uploadFile?.size || 54_000,
      uploadedAt: new Date().toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      }),
      issuerOrLab: uploadIssuer.trim() || undefined,
      status: uploadCategory === 'Certification' ? 'Verified' : 'Active',
      soilMetrics:
        uploadCategory === 'Soil Test' && (uploadPh || uploadOm)
          ? {
              ph: uploadPh ? Number(uploadPh) : undefined,
              organicMatterPct: uploadOm ? Number(uploadOm) : undefined,
            }
          : undefined,
      dataUrl: uploadDataUrl,
    });
    setUploadTitle('');
    setUploadIssuer('');
    setUploadFile(null);
    setUploadDataUrl(undefined);
    setUploadPh('');
    setUploadOm('');
    if (fileRef.current) fileRef.current.value = '';
  };

  const tabItems: { id: PortalTab; label: string; count?: number }[] = [
    { id: 'overview', label: 'Farm Dashboard', count: verifiedClaims.length },
    { id: 'crops', label: 'Crop Cover & Rotation' },
    { id: 'vault', label: 'Docs, Certs & Soil Tests', count: documents.length },
    { id: 'claims', label: 'Postcard Claims', count: allClaimList.length },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#090c08]/80 p-3 backdrop-blur-md sm:p-5">
      <div className="glass-panel-dense flex h-full max-h-[880px] w-full max-w-[1220px] flex-col overflow-hidden rounded-[26px] border border-white/14 shadow-[0_32px_90px_rgba(0,0,0,0.75)]">
        {/* Top Portal Header */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 px-5 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-[#d8f274]/35 bg-[#d8f274]/14 text-[#d8f274]">
              <HouseLine size={22} weight="duotone" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-[19px] font-semibold tracking-[-0.02em] text-[#f5f7f1]">
                  {farmEntityName}
                </h2>
                <span className="inline-flex items-center gap-1 rounded-full border border-[#7cd8a0]/40 bg-[#7cd8a0]/14 px-2.5 py-0.5 text-[10.5px] font-semibold text-[#9be8b8]">
                  <SealCheck size={12} weight="fill" />
                  Farmer Owner Portal
                </span>
                {authIssueUrl && (
                  <a
                    href={authIssueUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 rounded-full border border-white/12 bg-white/[0.04] px-2.5 py-0.5 font-mono text-[10px] text-[#dce2d4]/75 transition-colors hover:border-[#d8f274]/45 hover:text-[#d8f274]"
                  >
                    <span>Local Session · Auth Roadmap</span>
                    <ArrowSquareOut size={11} />
                  </a>
                )}
              </div>
              <p className="mt-0.5 text-[11.5px] text-[#dce2d4]/62">
                Manage verified parcels, winter cover crops, multi-year rotations, soil lab assays,
                and USPS tax-roll postcard claims.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {verifiedClaims.length > 0 && (
              <button
                type="button"
                onClick={() => onOpenDroneRfqForParcels(verifiedClaims.map((c) => c.parcelId))}
                className="inline-flex items-center gap-1.5 rounded-full border border-[#5ec8eb]/45 bg-[#5ec8eb]/14 px-3.5 py-2 text-[11.5px] font-semibold text-[#8edcf5] hover:bg-[#5ec8eb]/24"
              >
                <PaperPlaneTilt size={14} weight="fill" />
                Request Drone Spray Bid ({verifiedClaims.length})
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="inline-flex items-center gap-1.5 rounded-full bg-[#d8f274] px-3.5 py-2 text-[11.5px] font-bold text-[#141710] hover:bg-[#e7fc95]"
            >
              <MapPinArea size={14} weight="bold" />
              Back to 3D Map
            </button>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close Farmer Portal"
              className="flex h-9 w-9 items-center justify-center rounded-full border border-white/12 text-[#dce2d4]/75 hover:bg-white/10 hover:text-white"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex flex-wrap items-center gap-1.5 border-b border-white/8 bg-black/20 px-5 py-2.5">
          {tabItems.map((tab) => {
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-[12px] font-semibold transition-all ${
                  active
                    ? 'bg-[#d8f274] text-[#141710] shadow-sm'
                    : 'text-[#dce2d4]/72 hover:bg-white/8 hover:text-white'
                }`}
              >
                <span>{tab.label}</span>
                {tab.count !== undefined && (
                  <span
                    className={`rounded-full px-1.5 py-0.2 font-mono text-[10px] ${
                      active ? 'bg-[#141710]/15 text-[#141710]' : 'bg-white/10 text-[#d8f274]'
                    }`}
                  >
                    {tab.count}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Portal Scrollable Body */}
        <div className="flex-1 overflow-y-auto p-5">
          {/* ===================== TAB 1: FARM DASHBOARD ===================== */}
          {activeTab === 'overview' && (
            <div className="space-y-5">
              {/* KPI Row */}
              <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
                <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-3.5">
                  <div className="text-[10.5px] text-[#dce2d4]/55">Verified Owned Area</div>
                  <div className="mt-1 tabular-nums text-[22px] font-semibold text-[#d8f274]">
                    {formatArea(portfolioStats.verifiedAcres, unit)}
                  </div>
                  <div className="mt-0.5 font-mono text-[10px] text-[#dce2d4]/55">
                    {portfolioStats.pendingAcres > 0
                      ? `+${formatArea(portfolioStats.pendingAcres, unit)} postcard pending`
                      : `${verifiedClaims.length} verified parcel${verifiedClaims.length === 1 ? '' : 's'}`}
                  </div>
                </div>

                <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-3.5">
                  <div className="text-[10.5px] text-[#dce2d4]/55">Ownership Status</div>
                  <div className="mt-1 flex items-baseline gap-2">
                    <span className="tabular-nums text-[22px] font-semibold text-[#9be8b8]">
                      {verifiedClaims.length}
                    </span>
                    <span className="text-[11px] text-[#dce2d4]/55">verified</span>
                  </div>
                  <div className="mt-0.5 font-mono text-[10px] text-[#f0bb66]">
                    {pendingClaims.length} awaiting USPS PIN
                  </div>
                </div>

                <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-3.5">
                  <div className="text-[10.5px] text-[#dce2d4]/55">Cover Crop Coverage</div>
                  <div className="mt-1 tabular-nums text-[22px] font-semibold text-[#8fd469]">
                    {portfolioStats.coverPct}%
                  </div>
                  <div className="mt-0.5 text-[10px] text-[#dce2d4]/55">
                    Winter conservation cover
                  </div>
                </div>

                <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-3.5">
                  <div className="text-[10.5px] text-[#dce2d4]/55">Farm Vault Records</div>
                  <div className="mt-1 tabular-nums text-[22px] font-semibold text-[#5ec8eb]">
                    {documents.length}
                  </div>
                  <div className="mt-0.5 font-mono text-[10px] text-[#dce2d4]/55">
                    {portfolioStats.soilTestsCount} soil labs · {portfolioStats.certsCount} certs
                  </div>
                </div>

                <div className="col-span-2 rounded-2xl border border-white/10 bg-white/[0.03] p-3.5 lg:col-span-1">
                  <div className="text-[10.5px] text-[#dce2d4]/55">Avg Canopy / RFQs</div>
                  <div className="mt-1 tabular-nums text-[22px] font-semibold text-[#f5f7f1]">
                    {portfolioStats.avgHealth}%
                  </div>
                  <div className="mt-0.5 font-mono text-[10px] text-[#dce2d4]/55">
                    {droneRfqs.length} drone spray RFQ{droneRfqs.length === 1 ? '' : 's'}
                  </div>
                </div>
              </div>

              {/* Pending Postcard Verifications Banner */}
              {pendingClaims.length > 0 && (
                <div className="rounded-2xl border border-[#f0bb66]/35 bg-[#f0bb66]/[0.07] p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2 text-[13.5px] font-semibold text-[#f6deb2]">
                      <EnvelopeSimple size={18} weight="fill" />
                      Pending USPS Tax Roll Postcards ({pendingClaims.length})
                    </div>
                    <span className="text-[11px] text-[#dce2d4]/68">
                      Received your postcard? Enter the 6-digit PIN below to activate parcel ownership.
                    </span>
                  </div>
                  <div className="mt-3 grid gap-2.5 md:grid-cols-2">
                    {pendingClaims.map((claim) => (
                      <div
                        key={claim.parcelId}
                        className="rounded-xl border border-white/10 bg-black/35 p-3"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <div className="text-[13px] font-semibold text-[#f5f7f1]">
                              {claim.parcelName}
                            </div>
                            <div className="font-mono text-[10px] text-[#dce2d4]/55">
                              {claim.parno} · Mailed to {claim.taxMailingAddress}
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() =>
                              setPreviewPostcardId((cur) =>
                                cur === claim.parcelId ? null : claim.parcelId
                              )
                            }
                            className="shrink-0 rounded-full border border-[#5ec8eb]/35 bg-[#5ec8eb]/12 px-2.5 py-0.5 text-[10px] font-medium text-[#8edcf5]"
                          >
                            {previewPostcardId === claim.parcelId ? 'Hide PIN' : 'Test PIN'}
                          </button>
                        </div>

                        {previewPostcardId === claim.parcelId && (
                          <div className="mt-2 flex items-center justify-between rounded-lg bg-[#f6f1e4] px-2.5 py-1.5 text-[11px] text-[#192014]">
                            <span>
                              Simulated Postcard PIN:{' '}
                              <strong className="font-mono tracking-wider">
                                {claim.postcardPin}
                              </strong>
                            </span>
                            <button
                              type="button"
                              onClick={() =>
                                setPinDrafts((prev) => ({
                                  ...prev,
                                  [claim.parcelId]: claim.postcardPin,
                                }))
                              }
                              className="rounded-full bg-[#192014] px-2 py-0.5 text-[10px] font-semibold text-[#d8f274]"
                            >
                              Fill PIN
                            </button>
                          </div>
                        )}

                        <div className="mt-2.5 flex gap-2">
                          <input
                            type="text"
                            value={pinDrafts[claim.parcelId] || ''}
                            onChange={(e) =>
                              setPinDrafts((prev) => ({
                                ...prev,
                                [claim.parcelId]: e.target.value,
                              }))
                            }
                            placeholder="Enter 6-digit PIN (e.g. 482-917)"
                            className="flex-1 rounded-xl border border-white/15 bg-black/45 px-3 py-1.5 font-mono text-[12px] text-[#d8f274] placeholder:text-[#dce2d4]/35 focus:border-[#d8f274] focus:outline-none"
                          />
                          <button
                            type="button"
                            onClick={() => handlePortalVerifyPin(claim.parcelId)}
                            className="rounded-xl bg-[#d8f274] px-3.5 py-1.5 text-[11.5px] font-bold text-[#141710] hover:bg-[#e7fc95]"
                          >
                            Verify
                          </button>
                        </div>
                        {pinErrors[claim.parcelId] && (
                          <div className="mt-1.5 flex items-center gap-1 text-[10.5px] text-[#f39378]">
                            <WarningCircle size={13} />
                            {pinErrors[claim.parcelId]}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Claimed Parcels Portfolio OR Onboarding Prompt */}
              {claimedParcelsResolved.length === 0 ? (
                <div className="rounded-3xl border border-[#d8f274]/25 bg-gradient-to-br from-[#d8f274]/[0.07] via-white/[0.02] to-[#5ec8eb]/[0.05] p-6">
                  <div className="max-w-2xl">
                    <div className="inline-flex items-center gap-1.5 rounded-full bg-[#d8f274]/16 px-3 py-1 text-[11px] font-semibold text-[#d8f274]">
                      <ShieldCheck size={14} weight="fill" />
                      Owner Verification Powered by County Tax Assessor Rolls
                    </div>
                    <h3 className="mt-2.5 text-[21px] font-semibold tracking-[-0.02em] text-[#f5f7f1]">
                      Claim your first farm parcel to build your private Farm Management Dashboard
                    </h3>
                    <p className="mt-1.5 text-[12.5px] leading-relaxed text-[#dce2d4]/72">
                      Select any parcel below (or click one on the 3D map) to mail a USPS
                      verification postcard with a 6-digit PIN to the owner&apos;s official County
                      Tax Assessor mailing address. Once verified, track cover crops, multi-year
                      rotations, soil lab reports, certifications, and drone bids in one place.
                    </p>
                  </div>

                  <div className="mt-5 grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
                    {parcels.slice(0, 6).map((p) => {
                      const cp = getCropProfile(p);
                      return (
                        <div
                          key={p.id}
                          className="flex flex-col justify-between rounded-2xl border border-white/10 bg-black/35 p-3.5"
                        >
                          <div>
                            <div className="flex items-center justify-between gap-2">
                              <span className="font-mono text-[10px] text-[#dce2d4]/55">
                                {p.parno}
                              </span>
                              <span className="tabular-nums text-[11.5px] font-semibold text-[#d8f274]">
                                {formatArea(p.areaAcres, unit)}
                              </span>
                            </div>
                            <div className="mt-1 text-[13.5px] font-semibold text-[#f5f7f1]">
                              {p.name}
                            </div>
                            <div className="mt-0.5 truncate text-[11px] text-[#d8f274]/85">
                              Owner: {p.ownerName}
                            </div>
                            <div className="mt-1.5 flex flex-wrap gap-1">
                              <span className="rounded-full bg-white/8 px-2 py-0.5 text-[10px] text-[#dce2d4]/80">
                                {cp.currentCrop}
                              </span>
                              {cp.coverCrop !== 'None (Stubble / Bare)' && (
                                <span className="rounded-full bg-[#8fd469]/16 px-2 py-0.5 text-[10px] text-[#8fd469]">
                                  Cover: {cp.coverCrop}
                                </span>
                              )}
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => onOpenParcelDrawer(p.id, 'claim')}
                            className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-full border border-[#d8f274]/45 bg-[#d8f274]/14 px-3 py-1.5 text-[11.5px] font-semibold text-[#d8f274] hover:bg-[#d8f274] hover:text-[#141710]"
                          >
                            <EnvelopeSimple size={14} weight="bold" />
                            Claim via Tax Roll Postcard
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : (
                <div>
                  <div className="mb-3 flex items-center justify-between">
                    <h3 className="text-[14px] font-semibold text-[#f5f7f1]">
                      My Managed Parcels ({claimedParcelsResolved.length})
                    </h3>
                    <button
                      type="button"
                      onClick={onClose}
                      className="inline-flex items-center gap-1 text-[11.5px] font-medium text-[#d8f274] hover:underline"
                    >
                      <Plus size={13} />
                      Claim another parcel on map
                    </button>
                  </div>
                  <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                    {claimedParcelsResolved.map(({ claim, parcel }) => {
                      const cp = parcel ? getCropProfile(parcel) : null;
                      const pDocs = documents.filter((d) => d.parcelId === claim.parcelId);
                      return (
                        <div
                          key={claim.parcelId}
                          className="flex flex-col justify-between rounded-2xl border border-white/10 bg-white/[0.03] p-4"
                        >
                          <div>
                            <div className="flex items-center justify-between gap-2">
                              {claim.status === 'verified' ? (
                                <span className="inline-flex items-center gap-1 rounded-full border border-[#7cd8a0]/40 bg-[#7cd8a0]/14 px-2 py-0.5 text-[10px] font-semibold text-[#9be8b8]">
                                  <SealCheck size={11} weight="fill" />
                                  Verified Owner
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 rounded-full border border-[#f0bb66]/40 bg-[#f0bb66]/14 px-2 py-0.5 text-[10px] font-semibold text-[#f6deb2]">
                                  <EnvelopeSimple size={11} weight="fill" />
                                  Postcard In Transit
                                </span>
                              )}
                              <span className="font-mono text-[10.5px] text-[#dce2d4]/60">
                                {formatArea(claim.areaAcres, unit)}
                              </span>
                            </div>

                            <h4 className="mt-2 text-[15px] font-semibold text-[#f5f7f1]">
                              {claim.parcelName}
                            </h4>
                            <div className="font-mono text-[10px] text-[#dce2d4]/55">
                              {claim.parno} · {claim.county}
                            </div>

                            <div className="mt-2.5 flex flex-wrap gap-1.5">
                              <span className="rounded-full bg-[#d8f274]/14 px-2.5 py-0.5 text-[10.5px] font-medium text-[#d8f274]">
                                {cp?.currentCrop || claim.crop}
                              </span>
                              <span className="rounded-full bg-[#8fd469]/14 px-2.5 py-0.5 text-[10.5px] text-[#8fd469]">
                                Cover: {cp?.coverCrop || 'None'}
                              </span>
                              <span className="rounded-full bg-[#5ec8eb]/14 px-2.5 py-0.5 text-[10.5px] text-[#8edcf5]">
                                {pDocs.length} doc{pDocs.length === 1 ? '' : 's'}
                              </span>
                            </div>
                          </div>

                          <div className="mt-3.5 grid grid-cols-2 gap-1.5 border-t border-white/8 pt-3 text-[11px]">
                            <button
                              type="button"
                              onClick={() => onOpenParcelDrawer(claim.parcelId, 'crops')}
                              className="flex items-center justify-center gap-1 rounded-xl border border-white/10 bg-white/[0.03] py-1.5 font-medium text-[#dce2d4] hover:border-[#8fd469]/50 hover:text-white"
                            >
                              <Plant size={13} className="text-[#8fd469]" />
                              Crops &amp; Cover
                            </button>
                            <button
                              type="button"
                              onClick={() => onOpenParcelDrawer(claim.parcelId, 'documents')}
                              className="flex items-center justify-center gap-1 rounded-xl border border-white/10 bg-white/[0.03] py-1.5 font-medium text-[#dce2d4] hover:border-[#5ec8eb]/50 hover:text-white"
                            >
                              <FileText size={13} className="text-[#5ec8eb]" />
                              Docs &amp; Soil
                            </button>
                            <button
                              type="button"
                              onClick={() => onFocusParcelOnMap(claim.parcelId)}
                              className="flex items-center justify-center gap-1 rounded-xl border border-white/10 bg-white/[0.03] py-1.5 font-medium text-[#dce2d4] hover:border-[#d8f274]/50 hover:text-[#d8f274]"
                            >
                              <MapPinArea size={13} />
                              Focus Map
                            </button>
                            <button
                              type="button"
                              onClick={() => onOpenDroneRfqForParcels([claim.parcelId])}
                              className="flex items-center justify-center gap-1 rounded-xl border border-white/10 bg-white/[0.03] py-1.5 font-medium text-[#dce2d4] hover:border-[#5ec8eb]/50 hover:text-[#8edcf5]"
                            >
                              <PaperPlaneTilt size={13} className="text-[#5ec8eb]" />
                              Drone Bid
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ===================== TAB 2: CROP COVER & ROTATION MATRIX ===================== */}
          {activeTab === 'crops' && (
            <div className="space-y-3.5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h3 className="text-[15px] font-semibold text-[#f5f7f1]">
                    Multi-Year Crop Cover &amp; Rotation Planner
                  </h3>
                  <p className="text-[11.5px] text-[#dce2d4]/62">
                    Change winter cover crops inline or click any parcel to log historical crops
                    planted.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {claimedParcelsResolved.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setShowAllInCrops((v) => !v)}
                      className="rounded-full border border-white/12 bg-white/[0.04] px-3 py-1.5 text-[11px] font-medium text-[#dce2d4] hover:border-[#d8f274]/45"
                    >
                      {showAllInCrops
                        ? `Showing All Region Parcels (${matrixParcels.length})`
                        : `Showing My Claimed Parcels (${matrixParcels.length}) · Show All`}
                    </button>
                  )}
                </div>
              </div>

              <div className="overflow-x-auto rounded-2xl border border-white/10 bg-white/[0.02]">
                <table className="w-full min-w-[780px] text-left text-[12px]">
                  <thead className="border-b border-white/10 bg-black/30 text-[10.5px] uppercase tracking-wider text-[#dce2d4]/55">
                    <tr>
                      <th className="px-3.5 py-2.5">Parcel / Owner</th>
                      <th className="px-3 py-2.5">Area</th>
                      <th className="px-3 py-2.5">2026 Current</th>
                      <th className="px-3 py-2.5">Active Cover Crop</th>
                      <th className="px-3 py-2.5">2025 Crop</th>
                      <th className="px-3 py-2.5">2024 Crop</th>
                      <th className="px-3 py-2.5">2023 Crop</th>
                      <th className="px-3 py-2.5 text-right">History</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/6">
                    {matrixParcels.map((p) => {
                      const cp = getCropProfile(p);
                      const cropByYear = (yr: number) =>
                        cp.previousCrops.find((c) => c.year === yr && c.season === 'Main Crop')
                          ?.crop ||
                        cp.previousCrops.find((c) => c.year === yr)?.crop ||
                        '—';
                      return (
                        <tr key={p.id} className="hover:bg-white/[0.03]">
                          <td className="px-3.5 py-2.5">
                            <div className="font-semibold text-[#f5f7f1]">{p.name}</div>
                            <div className="truncate text-[10.5px] text-[#dce2d4]/55">
                              {p.ownerName}
                            </div>
                          </td>
                          <td className="px-3 py-2.5 font-mono text-[11px] text-[#dce2d4]/80">
                            {formatArea(p.areaAcres, unit)}
                          </td>
                          <td className="px-3 py-2.5">
                            <span className="rounded-full bg-[#d8f274]/14 px-2.5 py-0.5 text-[11px] font-semibold text-[#d8f274]">
                              {cp.currentCrop}
                            </span>
                          </td>
                          <td className="px-3 py-2.5">
                            <select
                              value={cp.coverCrop}
                              onChange={(e) =>
                                onUpdateCropProfile(p.id, {
                                  ...cp,
                                  coverCrop: e.target.value as CoverCropOption,
                                  updatedAt: 'Updated in Portal',
                                })
                              }
                              className="rounded-lg border border-white/12 bg-[#161914] px-2 py-1 text-[11px] text-[#8fd469] focus:border-[#8fd469] focus:outline-none"
                            >
                              {COVER_CROP_OPTIONS.map((opt) => (
                                <option key={opt.value} value={opt.value}>
                                  {opt.value}
                                </option>
                              ))}
                            </select>
                          </td>
                          <td className="px-3 py-2.5 text-[11.5px] text-[#dce2d4]/82">
                            {cropByYear(2025)}
                          </td>
                          <td className="px-3 py-2.5 text-[11.5px] text-[#dce2d4]/72">
                            {cropByYear(2024)}
                          </td>
                          <td className="px-3 py-2.5 text-[11.5px] text-[#dce2d4]/62">
                            {cropByYear(2023)}
                          </td>
                          <td className="px-3 py-2.5 text-right">
                            <button
                              type="button"
                              onClick={() => onOpenParcelDrawer(p.id, 'crops')}
                              className="rounded-full border border-white/12 px-2.5 py-1 text-[10.5px] font-medium text-[#d8f274] hover:border-[#d8f274]/55 hover:bg-[#d8f274]/12"
                            >
                              Edit ({cp.previousCrops.length})
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ===================== TAB 3: UNIFIED FARM VAULT ===================== */}
          {activeTab === 'vault' && (
            <div className="grid gap-5 lg:grid-cols-12">
              {/* Left: Quick Upload Form */}
              <form
                onSubmit={handleQuickUpload}
                className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 lg:col-span-4"
              >
                <h3 className="flex items-center gap-1.5 text-[14px] font-semibold text-[#f5f7f1]">
                  <FileArrowUp size={17} className="text-[#5ec8eb]" />
                  Upload to Farm Vault
                </h3>
                <p className="mt-0.5 text-[11px] text-[#dce2d4]/60">
                  Attach soil tests, USDA/Cotton Trust certifications, FSA-578 forms, or deeds to
                  any parcel.
                </p>

                <div className="mt-3 space-y-2.5">
                  <div>
                    <label className="text-[10.5px] text-[#dce2d4]/58">Target Parcel</label>
                    <select
                      value={uploadParcelId}
                      onChange={(e) => setUploadParcelId(e.target.value)}
                      className="mt-1 w-full rounded-xl border border-white/12 bg-[#161914] px-3 py-2 text-[12px] text-white focus:border-[#d8f274]/60 focus:outline-none"
                    >
                      {parcels.slice(0, 35).map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name} ({p.parno})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="text-[10.5px] text-[#dce2d4]/58">Document Type</label>
                    <select
                      value={uploadCategory}
                      onChange={(e) =>
                        setUploadCategory(e.target.value as ParcelDocumentCategory)
                      }
                      className="mt-1 w-full rounded-xl border border-white/12 bg-[#161914] px-3 py-2 text-[12px] text-white focus:border-[#d8f274]/60 focus:outline-none"
                    >
                      {DOCUMENT_CATEGORIES.map((c) => (
                        <option key={c.value} value={c.value}>
                          {c.value}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <input
                      ref={fileRef}
                      type="file"
                      accept=".pdf,.png,.jpg,.jpeg,.webp,.csv,.xlsx,.doc,.docx,.txt"
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (!f) return;
                        setUploadFile(f);
                        if (!uploadTitle) {
                          setUploadTitle(f.name.replace(/\.[^/.]+$/, '').replace(/[_-]+/g, ' '));
                        }
                        if (f.size <= 360 * 1024) {
                          const reader = new FileReader();
                          reader.onload = () => {
                            if (typeof reader.result === 'string') setUploadDataUrl(reader.result);
                          };
                          reader.readAsDataURL(f);
                        } else {
                          setUploadDataUrl(URL.createObjectURL(f));
                        }
                      }}
                      className="w-full rounded-xl border border-dashed border-white/20 bg-black/30 p-2 text-[11px] text-[#dce2d4] file:mr-2.5 file:rounded-full file:border-0 file:bg-[#d8f274] file:px-3 file:py-1 file:text-[11px] file:font-semibold file:text-[#141710]"
                    />
                  </div>

                  <input
                    type="text"
                    value={uploadTitle}
                    onChange={(e) => setUploadTitle(e.target.value)}
                    placeholder="Document title (e.g. MSU Soil Lab Fall 2026)"
                    className="w-full rounded-xl border border-white/12 bg-black/30 px-3 py-2 text-[12px] text-white placeholder:text-[#dce2d4]/40 focus:border-[#d8f274]/60 focus:outline-none"
                  />
                  <input
                    type="text"
                    value={uploadIssuer}
                    onChange={(e) => setUploadIssuer(e.target.value)}
                    placeholder="Lab / Certifying Agency (optional)"
                    className="w-full rounded-xl border border-white/12 bg-black/30 px-3 py-2 text-[12px] text-white placeholder:text-[#dce2d4]/40 focus:border-[#d8f274]/60 focus:outline-none"
                  />

                  {uploadCategory === 'Soil Test' && (
                    <div className="grid grid-cols-2 gap-2">
                      <input
                        type="number"
                        step="0.1"
                        value={uploadPh}
                        onChange={(e) => setUploadPh(e.target.value)}
                        placeholder="Soil pH (e.g. 6.6)"
                        className="rounded-xl border border-white/12 bg-black/35 px-2.5 py-1.5 font-mono text-[11.5px] text-white placeholder:text-[#dce2d4]/40"
                      />
                      <input
                        type="number"
                        step="0.1"
                        value={uploadOm}
                        onChange={(e) => setUploadOm(e.target.value)}
                        placeholder="OM % (e.g. 2.5)"
                        className="rounded-xl border border-white/12 bg-black/35 px-2.5 py-1.5 font-mono text-[11.5px] text-white placeholder:text-[#dce2d4]/40"
                      />
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={!uploadFile && !uploadTitle.trim()}
                    className="flex w-full items-center justify-center gap-1.5 rounded-full bg-[#d8f274] px-4 py-2 text-[12px] font-bold text-[#141710] hover:bg-[#e7fc95] disabled:opacity-40"
                  >
                    <Plus size={14} weight="bold" />
                    Upload Document
                  </button>
                </div>
              </form>

              {/* Right: Vault Documents Grid */}
              <div className="space-y-3 lg:col-span-8">
                <div className="flex flex-wrap items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setVaultFilter('All')}
                    className={`rounded-full px-3 py-1 text-[11px] font-semibold ${
                      vaultFilter === 'All'
                        ? 'bg-[#d8f274] text-[#141710]'
                        : 'border border-white/10 bg-white/[0.03] text-[#dce2d4]/75'
                    }`}
                  >
                    All ({documents.length})
                  </button>
                  {DOCUMENT_CATEGORIES.map((c) => {
                    const count = documents.filter((d) => d.category === c.value).length;
                    return (
                      <button
                        key={c.value}
                        type="button"
                        onClick={() => setVaultFilter(c.value)}
                        className={`rounded-full px-3 py-1 text-[11px] font-semibold ${
                          vaultFilter === c.value
                            ? 'bg-[#d8f274] text-[#141710]'
                            : 'border border-white/10 bg-white/[0.03] text-[#dce2d4]/75'
                        }`}
                      >
                        {c.shortLabel} ({count})
                      </button>
                    );
                  })}
                </div>

                {filteredVaultDocs.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-white/12 bg-white/[0.02] p-8 text-center">
                    <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-2xl bg-white/6 text-[#5ec8eb]">
                      <Certificate size={22} />
                    </div>
                    <div className="mt-2.5 text-[14px] font-semibold text-[#f5f7f1]">
                      No documents in this category yet
                    </div>
                    <p className="mt-1 text-[12px] text-[#dce2d4]/58">
                      Upload soil tests, U.S. Cotton Trust Protocol certificates, USDA Organic
                      records, or FSA-578 forms on the left.
                    </p>
                  </div>
                ) : (
                  <div className="grid gap-2.5 sm:grid-cols-2">
                    {filteredVaultDocs.map((doc) => {
                      const cat = DOCUMENT_CATEGORIES.find((c) => c.value === doc.category);
                      return (
                        <div
                          key={doc.id}
                          className="rounded-2xl border border-white/10 bg-white/[0.03] p-3.5"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <span
                              className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold"
                              style={{
                                backgroundColor: `${cat?.accent || '#d8f274'}22`,
                                color: cat?.accent || '#d8f274',
                              }}
                            >
                              {doc.category === 'Soil Test' ? (
                                <Flask size={11} />
                              ) : (
                                <FileText size={11} />
                              )}
                              {doc.category}
                            </span>
                            <div className="flex items-center gap-1">
                              {doc.dataUrl && (
                                <a
                                  href={doc.dataUrl}
                                  download={doc.fileName}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="flex h-7 w-7 items-center justify-center rounded-full border border-white/10 text-[#d8f274] hover:bg-white/10"
                                >
                                  <DownloadSimple size={13} />
                                </a>
                              )}
                              <button
                                type="button"
                                onClick={() => onDeleteDocument(doc.id)}
                                className="flex h-7 w-7 items-center justify-center rounded-full text-[#dce2d4]/45 hover:bg-white/10 hover:text-[#f39378]"
                              >
                                <Trash size={13} />
                              </button>
                            </div>
                          </div>
                          <div className="mt-1.5 text-[13.5px] font-semibold text-[#f5f7f1]">
                            {doc.title}
                          </div>
                          <div className="mt-0.5 text-[11px] text-[#d8f274]/80">
                            {doc.parcelName}
                          </div>
                          <div className="mt-0.5 truncate font-mono text-[10px] text-[#dce2d4]/55">
                            {doc.fileName} · {formatBytes(doc.fileSizeBytes)} · {doc.uploadedAt}
                          </div>
                          {doc.soilMetrics && (
                            <div className="mt-2 flex flex-wrap gap-1">
                              {doc.soilMetrics.ph !== undefined && (
                                <span className="rounded bg-black/40 px-1.5 py-0.5 font-mono text-[10px] text-[#d8f274]">
                                  pH {doc.soilMetrics.ph}
                                </span>
                              )}
                              {doc.soilMetrics.organicMatterPct !== undefined && (
                                <span className="rounded bg-black/40 px-1.5 py-0.5 font-mono text-[10px] text-[#8fd469]">
                                  OM {doc.soilMetrics.organicMatterPct}%
                                </span>
                              )}
                              {doc.soilMetrics.nitrogenLbsAc !== undefined && (
                                <span className="rounded bg-black/40 px-1.5 py-0.5 font-mono text-[10px] text-[#5ec8eb]">
                                  N {doc.soilMetrics.nitrogenLbsAc}
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ===================== TAB 4: POSTCARD CLAIMS LEDGER ===================== */}
          {activeTab === 'claims' && (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h3 className="text-[15px] font-semibold text-[#f5f7f1]">
                    Parcel Ownership Claims &amp; USPS Tax-Roll Postcards
                  </h3>
                  <p className="text-[11.5px] text-[#dce2d4]/62">
                    Every claim is locked to the owner&apos;s official mailing address on the County
                    Tax Assessor roll (7–14 day USPS delivery).
                  </p>
                </div>
                <button
                  type="button"
                  onClick={onClose}
                  className="inline-flex items-center gap-1.5 rounded-full bg-[#d8f274] px-3.5 py-1.5 text-[11.5px] font-bold text-[#141710]"
                >
                  <Plus size={13} weight="bold" />
                  Claim Parcel from Map
                </button>
              </div>

              {allClaimList.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-white/12 bg-white/[0.02] p-8 text-center text-[12.5px] text-[#dce2d4]/62">
                  No ownership claims requested yet. Click any parcel on the map (or select one from
                  the Dashboard tab) to mail a verification postcard to its County Tax Assessor
                  address.
                </div>
              ) : (
                <div className="space-y-3">
                  {allClaimList.map((claim) => (
                    <div
                      key={claim.parcelId}
                      className="rounded-2xl border border-white/10 bg-white/[0.03] p-4"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-[15px] font-semibold text-[#f5f7f1]">
                              {claim.parcelName}
                            </span>
                            {claim.status === 'verified' ? (
                              <span className="inline-flex items-center gap-1 rounded-full bg-[#7cd8a0]/18 px-2.5 py-0.5 text-[10.5px] font-semibold text-[#9be8b8]">
                                <CheckCircle size={12} weight="fill" />
                                Verified ({claim.verifiedAt})
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 rounded-full bg-[#f0bb66]/18 px-2.5 py-0.5 text-[10.5px] font-semibold text-[#f6deb2]">
                                <EnvelopeSimple size={12} weight="fill" />
                                Postcard Mailed · ETA {claim.estimatedArrivalWindow}
                              </span>
                            )}
                          </div>
                          <div className="mt-1 font-mono text-[11px] text-[#dce2d4]/65">
                            PARNO {claim.parno} · {claim.county} · {formatArea(claim.areaAcres, unit)}
                          </div>
                          <div className="mt-1.5 text-[11.5px] text-[#dce2d4]/80">
                            <span className="text-[#dce2d4]/50">Tax Assessor Mailing Address: </span>
                            <span className="font-mono font-medium text-[#f5f7f1]">
                              {claim.taxAssessorOwner} · {claim.taxMailingAddress}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <span className="rounded-lg bg-black/35 px-2.5 py-1 font-mono text-[10.5px] text-[#dce2d4]/70">
                            {claim.trackingNumber}
                          </span>
                          <button
                            type="button"
                            onClick={() => onOpenParcelDrawer(claim.parcelId, 'claim')}
                            className="rounded-full border border-white/12 px-3 py-1 text-[11px] font-medium text-[#d8f274] hover:bg-white/8"
                          >
                            Details
                          </button>
                        </div>
                      </div>

                      {claim.status === 'postcard_mailed' && (
                        <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-white/8 pt-3">
                          <input
                            type="text"
                            value={pinDrafts[claim.parcelId] || ''}
                            onChange={(e) =>
                              setPinDrafts((prev) => ({
                                ...prev,
                                [claim.parcelId]: e.target.value,
                              }))
                            }
                            placeholder="Enter 6-digit PIN"
                            className="w-[180px] rounded-xl border border-white/15 bg-black/40 px-3 py-1.5 text-center font-mono text-[13px] font-bold tracking-widest text-[#d8f274]"
                          />
                          <button
                            type="button"
                            onClick={() => handlePortalVerifyPin(claim.parcelId)}
                            className="rounded-xl bg-[#d8f274] px-3.5 py-1.5 text-[11.5px] font-bold text-[#141710]"
                          >
                            Verify PIN
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              setPreviewPostcardId((cur) =>
                                cur === claim.parcelId ? null : claim.parcelId
                              )
                            }
                            className="inline-flex items-center gap-1 rounded-xl border border-[#5ec8eb]/35 bg-[#5ec8eb]/10 px-3 py-1.5 text-[11px] font-medium text-[#8edcf5]"
                          >
                            <Eye size={13} />
                            {previewPostcardId === claim.parcelId
                              ? `PIN: ${claim.postcardPin}`
                              : 'Reveal Sandbox PIN'}
                          </button>
                          {previewPostcardId === claim.parcelId && (
                            <button
                              type="button"
                              onClick={() =>
                                setPinDrafts((prev) => ({
                                  ...prev,
                                  [claim.parcelId]: claim.postcardPin,
                                }))
                              }
                              className="inline-flex items-center gap-1 rounded-xl bg-white/10 px-2.5 py-1.5 text-[11px] text-[#d8f274]"
                            >
                              <Copy size={12} />
                              Fill
                            </button>
                          )}
                          {pinErrors[claim.parcelId] && (
                            <span className="text-[11px] text-[#f39378]">
                              {pinErrors[claim.parcelId]}
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export const _LeafRef = Leaf;
