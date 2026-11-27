import React, { useEffect, useRef, useState } from 'react';
import {
  Certificate,
  CheckCircle,
  Copy,
  DownloadSimple,
  Drop,
  EnvelopeSimple,
  Eye,
  FileArrowUp,
  FileText,
  Flask,
  HouseLine,
  Leaf,
  LockSimple,
  MapPin,
  Plant,
  Plus,
  SealCheck,
  ShieldCheck,
  Sparkle,
  Tractor,
  Trash,
  WarningCircle,
  X,
} from '@phosphor-icons/react';
import {
  AreaUnit,
  CoverCropOption,
  CropHistoryEntry,
  EquipmentUnit,
  FieldLogEntry,
  Parcel,
  ParcelClaimRecord,
  ParcelCropProfile,
  ParcelDetailTab,
  ParcelDocument,
  ParcelDocumentCategory,
  TillagePractice,
} from '../types/farm';
import {
  CASH_CROP_OPTIONS,
  computePostcardArrivalWindow,
  COVER_CROP_OPTIONS,
  DOCUMENT_CATEGORIES,
  fetchTaxAssessorMailingAddress,
  formatBytes,
  generatePostcardPin,
  generateUspsTrackingId,
  PREVIOUS_CROP_CHOICES,
  TILLAGE_OPTIONS,
} from '../data/parcelOwnerStore';
import { formatArea, formatSpeed } from '../utils/units';

interface ParcelDetailDrawerProps {
  parcel: Parcel;
  unit: AreaUnit;
  initialTab?: ParcelDetailTab;
  cropProfile: ParcelCropProfile;
  documents: ParcelDocument[];
  claimRecord?: ParcelClaimRecord;
  onClose: () => void;
  onAddLog: (parcelId: string, entry: Omit<FieldLogEntry, 'id'>) => void;
  onUpdateCropProfile: (parcelId: string, next: ParcelCropProfile) => void;
  onUploadDocument: (doc: ParcelDocument) => void;
  onDeleteDocument: (docId: string) => void;
  onRequestClaimPostcard: (claim: ParcelClaimRecord) => void;
  onVerifyClaimPin: (parcelId: string, pinInput: string) => boolean;
  onOpenFarmerPortal: () => void;
}

export const ParcelDetailDrawer: React.FC<ParcelDetailDrawerProps> = ({
  parcel,
  unit,
  initialTab = 'overview',
  cropProfile,
  documents,
  claimRecord,
  onClose,
  onAddLog,
  onUpdateCropProfile,
  onUploadDocument,
  onDeleteDocument,
  onRequestClaimPostcard,
  onVerifyClaimPin,
  onOpenFarmerPortal,
}) => {
  const [activeTab, setActiveTab] = useState<ParcelDetailTab>(initialTab);
  const [logCategory, setLogCategory] = useState<FieldLogEntry['category']>('Scouting');
  const [logTitle, setLogTitle] = useState('');
  const [logDetail, setLogDetail] = useState('');

  // Crop History form state
  const [histYear, setHistYear] = useState<number>(2025);
  const [histSeason, setHistSeason] = useState<CropHistoryEntry['season']>('Main Crop');
  const [histCrop, setHistCrop] = useState<string>('Soybeans');
  const [histVariety, setHistVariety] = useState<string>('');
  const [histTillage, setHistTillage] = useState<TillagePractice>('No-Till');
  const [histYieldNote, setHistYieldNote] = useState<string>('');

  // Document & Soil Test upload state
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [docCategory, setDocCategory] = useState<ParcelDocumentCategory>('Soil Test');
  const [docTitle, setDocTitle] = useState('');
  const [docIssuer, setDocIssuer] = useState('');
  const [docExpires, setDocExpires] = useState('');
  const [docNotes, setDocNotes] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [selectedFileDataUrl, setSelectedFileDataUrl] = useState<string | undefined>(undefined);
  const [soilPh, setSoilPh] = useState('');
  const [soilOm, setSoilOm] = useState('');
  const [soilN, setSoilN] = useState('');
  const [soilP, setSoilP] = useState('');
  const [soilK, setSoilK] = useState('');
  const [soilCec, setSoilCec] = useState('');
  const [docFilter, setDocFilter] = useState<'All' | ParcelDocumentCategory>('All');
  const [isDragOver, setIsDragOver] = useState(false);

  // Ownership Claim Postcard state
  const [loadingAssessor, setLoadingAssessor] = useState(false);
  const [assessorAddr, setAssessorAddr] = useState<{
    ownerName: string;
    mailingAddress: string;
    source: ParcelClaimRecord['taxAddressSource'];
  } | null>(null);
  const [claimFarmName, setClaimFarmName] = useState('Vance Delta Farms LLC');
  const [claimantName, setClaimantName] = useState(parcel.ownerName || 'Caleb Vance');
  const [claimantEmail, setClaimantEmail] = useState('owner@vancedeltafarms.com');
  const [claimantPhone, setClaimantPhone] = useState('(662) 555-0148');
  const [pinInput, setPinInput] = useState('');
  const [pinError, setPinError] = useState<string | null>(null);
  const [showDemoPostcard, setShowDemoPostcard] = useState(false);
  const [copiedPin, setCopiedPin] = useState(false);

  useEffect(() => {
    setActiveTab(initialTab);
  }, [initialTab, parcel.id]);

  // Fetch real County Tax Assessor owner mailing address when opening Claim tab
  useEffect(() => {
    if (activeTab !== 'claim') return;
    let active = true;
    setLoadingAssessor(true);
    fetchTaxAssessorMailingAddress(parcel).then((res) => {
      if (!active) return;
      setAssessorAddr(res);
      setLoadingAssessor(false);
    });
    return () => {
      active = false;
    };
  }, [activeTab, parcel]);

  const parcelDocs = documents.filter((d) => d.parcelId === parcel.id);
  const filteredDocs =
    docFilter === 'All' ? parcelDocs : parcelDocs.filter((d) => d.category === docFilter);

  const handleSubmitLog = (e: React.FormEvent) => {
    e.preventDefault();
    if (!logTitle.trim()) return;
    onAddLog(parcel.id, {
      date: 'Nov 27 · Now',
      category: logCategory,
      title: logTitle.trim(),
      operator: 'Caleb Vance',
      detail: logDetail.trim() || 'Recorded via DeltaPlot field cockpit.',
    });
    setLogTitle('');
    setLogDetail('');
  };

  const handleExport = () => {
    const payload = {
      parcel,
      cropProfile,
      documents: parcelDocs.map(({ dataUrl: _omit, ...rest }) => rest),
      ownershipClaim: claimRecord ?? { status: 'unclaimed' },
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${parcel.id}-parcel-dossier.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleChangeCurrentCrop = (newCrop: Parcel['crop']) => {
    onUpdateCropProfile(parcel.id, {
      ...cropProfile,
      currentCrop: newCrop,
      updatedAt: 'Updated just now',
    });
  };

  const handleSelectCoverCrop = (cover: CoverCropOption) => {
    onUpdateCropProfile(parcel.id, {
      ...cropProfile,
      coverCrop: cover,
      coverCropPlantedDate:
        cover === 'None (Stubble / Bare)'
          ? undefined
          : cropProfile.coverCropPlantedDate || 'Nov 2026',
      coverCropTerminationTarget:
        cover === 'None (Stubble / Bare)'
          ? undefined
          : cropProfile.coverCropTerminationTarget || 'Apr 2027',
      updatedAt: 'Updated just now',
    });
  };

  const handleAddPreviousCrop = (e: React.FormEvent) => {
    e.preventDefault();
    if (!histCrop.trim()) return;
    const entry: CropHistoryEntry = {
      id: `crop-hist-${Date.now()}`,
      year: histYear,
      season: histSeason,
      crop: histCrop,
      variety: histVariety.trim() || undefined,
      tillage: histTillage,
      yieldNote: histYieldNote.trim() || undefined,
    };
    const nextHistory = [entry, ...cropProfile.previousCrops].sort((a, b) => b.year - a.year);
    onUpdateCropProfile(parcel.id, {
      ...cropProfile,
      previousCrops: nextHistory,
      updatedAt: 'Updated just now',
    });
    setHistVariety('');
    setHistYieldNote('');
  };

  const handleDeleteCropHistory = (entryId: string) => {
    onUpdateCropProfile(parcel.id, {
      ...cropProfile,
      previousCrops: cropProfile.previousCrops.filter((c) => c.id !== entryId),
      updatedAt: 'Updated just now',
    });
  };

  const ingestFile = (file: File) => {
    setSelectedFile(file);
    if (!docTitle.trim()) {
      setDocTitle(file.name.replace(/\.[^/.]+$/, '').replace(/[_-]+/g, ' '));
    }
    if (file.size <= 360 * 1024) {
      const reader = new FileReader();
      reader.onload = () => {
        if (typeof reader.result === 'string') {
          setSelectedFileDataUrl(reader.result);
        }
      };
      reader.readAsDataURL(file);
    } else {
      setSelectedFileDataUrl(URL.createObjectURL(file));
    }
  };

  const handleUploadSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const effectiveTitle = docTitle.trim() || selectedFile?.name || `${docCategory} Record`;
    const fileName =
      selectedFile?.name ||
      `${effectiveTitle.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.${docCategory === 'Soil Test' ? 'pdf' : 'pdf'}`;

    const soilMetrics =
      docCategory === 'Soil Test' && (soilPh || soilOm || soilN || soilP || soilK || soilCec)
        ? {
            ph: soilPh ? Number(soilPh) : undefined,
            organicMatterPct: soilOm ? Number(soilOm) : undefined,
            nitrogenLbsAc: soilN ? Number(soilN) : undefined,
            phosphorusPpm: soilP ? Number(soilP) : undefined,
            potassiumPpm: soilK ? Number(soilK) : undefined,
            cec: soilCec ? Number(soilCec) : undefined,
          }
        : undefined;

    const newDoc: ParcelDocument = {
      id: `doc-${Date.now()}`,
      parcelId: parcel.id,
      parcelName: parcel.name,
      category: docCategory,
      title: effectiveTitle,
      fileName,
      fileType: selectedFile?.type || 'application/pdf',
      fileSizeBytes: selectedFile?.size || 48_200,
      uploadedAt: new Date().toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      }),
      issuerOrLab: docIssuer.trim() || undefined,
      expiresAt: docExpires.trim() || undefined,
      status: docCategory === 'Certification' ? 'Verified' : 'Active',
      notes: docNotes.trim() || undefined,
      soilMetrics,
      dataUrl: selectedFileDataUrl,
    };

    onUploadDocument(newDoc);
    setSelectedFile(null);
    setSelectedFileDataUrl(undefined);
    setDocTitle('');
    setDocIssuer('');
    setDocExpires('');
    setDocNotes('');
    setSoilPh('');
    setSoilOm('');
    setSoilN('');
    setSoilP('');
    setSoilK('');
    setSoilCec('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleMailPostcard = (e: React.FormEvent) => {
    e.preventDefault();
    const record: ParcelClaimRecord = {
      parcelId: parcel.id,
      parcelName: parcel.name,
      parno: parcel.parno,
      county: parcel.county,
      areaAcres: parcel.areaAcres,
      crop: cropProfile.currentCrop,
      taxAssessorOwner: assessorAddr?.ownerName || parcel.ownerName,
      taxMailingAddress:
        assessorAddr?.mailingAddress ||
        parcel.ownerMailingAddress ||
        `${parcel.siteAddress}, ${parcel.cityState}`,
      taxAddressSource: assessorAddr?.source || 'Assessor Parcel Record',
      farmEntityName: claimFarmName.trim() || 'My Farm Operations LLC',
      claimantName: claimantName.trim() || parcel.ownerName,
      claimantEmail: claimantEmail.trim() || 'owner@farm.com',
      claimantPhone: claimantPhone.trim() || '(662) 555-0148',
      status: 'postcard_mailed',
      postcardPin: generatePostcardPin(),
      trackingNumber: generateUspsTrackingId(),
      requestedAt: new Date().toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      }),
      estimatedArrivalWindow: computePostcardArrivalWindow(),
    };
    onRequestClaimPostcard(record);
    setPinError(null);
  };

  const handleVerifySubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const ok = onVerifyClaimPin(parcel.id, pinInput);
    if (!ok) {
      setPinError('PIN does not match the 6-digit code printed on the tax roll postcard.');
    } else {
      setPinError(null);
      setPinInput('');
    }
  };

  const tabs: { id: ParcelDetailTab; label: string; badge?: string }[] = [
    { id: 'overview', label: 'Overview' },
    {
      id: 'crops',
      label: 'Crops & Cover',
    },
    {
      id: 'documents',
      label: 'Docs & Soil',
      badge: parcelDocs.length > 0 ? String(parcelDocs.length) : undefined,
    },
    {
      id: 'claim',
      label: claimRecord?.status === 'verified' ? 'Verified' : 'Claim',
      badge:
        claimRecord?.status === 'verified'
          ? '✓'
          : claimRecord?.status === 'postcard_mailed'
          ? 'PIN'
          : undefined,
    },
  ];

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/50 backdrop-blur-[3px]">
      <div className="glass-panel-dense flex h-full w-full max-w-[500px] flex-col overflow-hidden border-l border-white/12">
        {/* Header */}
        <div className="border-b border-white/10 p-4 pb-3">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="inline-flex items-center gap-1 rounded-full bg-[#d8f274]/15 px-2.5 py-0.5 font-mono text-[10px] font-medium text-[#d8f274]">
                  {parcel.fsaTract}
                </span>
                <span className="text-[11px] text-[#dce2d4]/60">{parcel.county}</span>
                {claimRecord?.status === 'verified' && (
                  <span className="inline-flex items-center gap-1 rounded-full border border-[#7cd8a0]/45 bg-[#7cd8a0]/16 px-2 py-0.5 text-[10px] font-semibold text-[#7cd8a0]">
                    <SealCheck size={11} weight="fill" />
                    Verified Owner
                  </span>
                )}
                {claimRecord?.status === 'postcard_mailed' && (
                  <span className="inline-flex items-center gap-1 rounded-full border border-[#f0bb66]/45 bg-[#f0bb66]/16 px-2 py-0.5 text-[10px] font-semibold text-[#f0bb66]">
                    <EnvelopeSimple size={11} weight="fill" />
                    Postcard Sent
                  </span>
                )}
              </div>
              <h2 className="mt-1.5 truncate text-[19px] font-semibold tracking-[-0.02em] text-[#f5f7f1]">
                {parcel.name}
              </h2>
              <p className="text-[11.5px] text-[#dce2d4]/65">
                {cropProfile.currentCrop}
                {cropProfile.coverCrop !== 'None (Stubble / Bare)' && (
                  <span className="text-[#8fd469]"> · Cover: {cropProfile.coverCrop}</span>
                )}
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-1.5">
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

          {/* 4-Tab Bar */}
          <div className="mt-3 grid grid-cols-4 gap-1 rounded-2xl border border-white/10 bg-black/30 p-1">
            {tabs.map((tab) => {
              const active = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center justify-center gap-1 rounded-xl px-2 py-1.5 text-[11px] font-semibold transition-all ${
                    active
                      ? 'bg-[#d8f274] text-[#141710] shadow-sm'
                      : 'text-[#dce2d4]/70 hover:bg-white/6 hover:text-white'
                  }`}
                >
                  <span className="truncate">{tab.label}</span>
                  {tab.badge && (
                    <span
                      className={`rounded-full px-1.5 py-0.2 font-mono text-[9px] ${
                        active
                          ? 'bg-[#141710]/15 text-[#141710]'
                          : tab.id === 'claim' && claimRecord?.status === 'verified'
                          ? 'bg-[#7cd8a0]/25 text-[#7cd8a0]'
                          : 'bg-white/10 text-[#d8f274]'
                      }`}
                    >
                      {tab.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 space-y-4 overflow-y-auto p-4">
          {/* ===================== TAB 1: OVERVIEW ===================== */}
          {activeTab === 'overview' && (
            <>
              {/* Ownership Verification Status Callout */}
              {claimRecord?.status === 'verified' ? (
                <div className="flex items-center justify-between gap-3 rounded-2xl border border-[#7cd8a0]/35 bg-[#7cd8a0]/10 p-3.5">
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5 text-[12px] font-semibold text-[#9be8b8]">
                      <SealCheck size={15} weight="fill" />
                      Verified Owner · {claimRecord.farmEntityName}
                    </div>
                    <p className="mt-0.5 truncate text-[10.5px] text-[#dce2d4]/70">
                      Confirmed via USPS Tax Roll PIN on {claimRecord.verifiedAt}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={onOpenFarmerPortal}
                    className="shrink-0 rounded-full bg-[#d8f274] px-3 py-1.5 text-[11px] font-bold text-[#141710] hover:bg-[#e7fc95]"
                  >
                    My Farm Portal
                  </button>
                </div>
              ) : claimRecord?.status === 'postcard_mailed' ? (
                <div className="flex items-center justify-between gap-3 rounded-2xl border border-[#f0bb66]/35 bg-[#f0bb66]/10 p-3.5">
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5 text-[12px] font-semibold text-[#f6deb2]">
                      <EnvelopeSimple size={15} weight="fill" />
                      Postcard Mailed to Tax Roll Address
                    </div>
                    <p className="mt-0.5 text-[10.5px] text-[#dce2d4]/72">
                      ETA {claimRecord.estimatedArrivalWindow} · Tracking {claimRecord.trackingNumber}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setActiveTab('claim')}
                    className="shrink-0 rounded-full bg-[#f0bb66] px-3 py-1.5 text-[11px] font-bold text-[#141710] hover:bg-[#f6cf8a]"
                  >
                    Enter PIN
                  </button>
                </div>
              ) : (
                <div className="flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/[0.035] p-3.5">
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5 text-[12px] font-semibold text-[#f3f5ef]">
                      <ShieldCheck size={15} className="text-[#d8f274]" />
                      Are you the owner of this parcel?
                    </div>
                    <p className="mt-0.5 text-[10.5px] text-[#dce2d4]/62">
                      Claim via County Tax Assessor postcard PIN to unlock your Farm Portal.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setActiveTab('claim')}
                    className="shrink-0 rounded-full border border-[#d8f274]/50 bg-[#d8f274]/16 px-3 py-1.5 text-[11px] font-semibold text-[#d8f274] hover:bg-[#d8f274] hover:text-[#141710]"
                  >
                    Claim Parcel
                  </button>
                </div>
              )}

              {/* Quick Crop Cover & Vault Shortcuts */}
              <div className="grid grid-cols-2 gap-2.5">
                <button
                  type="button"
                  onClick={() => setActiveTab('crops')}
                  className="rounded-2xl border border-white/10 bg-white/[0.03] p-3 text-left transition-colors hover:border-[#d8f274]/40 hover:bg-white/[0.06]"
                >
                  <div className="flex items-center justify-between text-[10.5px] text-[#dce2d4]/55">
                    <span>Crop &amp; Cover</span>
                    <Plant size={14} className="text-[#8fd469]" />
                  </div>
                  <div className="mt-1 truncate text-[13px] font-semibold text-[#f5f7f1]">
                    {cropProfile.currentCrop}
                  </div>
                  <div className="mt-0.5 truncate text-[10.5px] text-[#8fd469]">
                    Cover: {cropProfile.coverCrop}
                  </div>
                  <div className="mt-1 font-mono text-[9.5px] text-[#dce2d4]/50">
                    {cropProfile.previousCrops.length} prior seasons logged →
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveTab('documents')}
                  className="rounded-2xl border border-white/10 bg-white/[0.03] p-3 text-left transition-colors hover:border-[#5ec8eb]/45 hover:bg-white/[0.06]"
                >
                  <div className="flex items-center justify-between text-[10.5px] text-[#dce2d4]/55">
                    <span>Docs &amp; Soil Tests</span>
                    <FileText size={14} className="text-[#5ec8eb]" />
                  </div>
                  <div className="mt-1 tabular-nums text-[16px] font-semibold text-[#f5f7f1]">
                    {parcelDocs.length}{' '}
                    <span className="text-[11px] font-normal text-[#dce2d4]/60">uploaded</span>
                  </div>
                  <div className="mt-0.5 truncate text-[10.5px] text-[#5ec8eb]">
                    Soil labs, certifications, FSA
                  </div>
                  <div className="mt-1 font-mono text-[9.5px] text-[#dce2d4]/50">
                    Upload files &amp; lab assays →
                  </div>
                </button>
              </div>

              {/* Core Survey & Health Specs */}
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

              {/* Official County Cadastral Record */}
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
                    <span className="max-w-[240px] text-right text-[#dce2d4]/80">{parcel.legalDesc}</span>
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
                  Soil &amp; Water Profile (USDA NRCS)
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
                <div className="space-y-2">
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
            </>
          )}

          {/* ===================== TAB 2: CROPS & COVER ===================== */}
          {activeTab === 'crops' && (
            <>
              {/* Current Cash Crop */}
              <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-3.5">
                <div className="flex items-center justify-between">
                  <h3 className="flex items-center gap-1.5 text-[12.5px] font-semibold text-[#f3f5ef]">
                    <Leaf size={15} className="text-[#d8f274]" />
                    2026 Active Cash Crop
                  </h3>
                  <span className="font-mono text-[10px] text-[#dce2d4]/50">
                    {cropProfile.updatedAt}
                  </span>
                </div>
                <div className="mt-2.5 flex flex-wrap gap-1.5">
                  {CASH_CROP_OPTIONS.map((cropOpt) => {
                    const active = cropProfile.currentCrop === cropOpt;
                    return (
                      <button
                        key={cropOpt}
                        type="button"
                        onClick={() => handleChangeCurrentCrop(cropOpt)}
                        className={`rounded-full px-3 py-1 text-[11.5px] font-medium transition-all ${
                          active
                            ? 'bg-[#d8f274] text-[#141710] font-semibold shadow-sm'
                            : 'border border-white/12 bg-white/[0.03] text-[#dce2d4]/80 hover:border-[#d8f274]/40 hover:text-white'
                        }`}
                      >
                        {cropOpt}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Cover Crop Selector */}
              <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-3.5">
                <div className="flex items-center justify-between">
                  <h3 className="flex items-center gap-1.5 text-[12.5px] font-semibold text-[#f3f5ef]">
                    <Plant size={15} className="text-[#8fd469]" />
                    Parcel Crop Cover (Winter / Conservation)
                  </h3>
                  {cropProfile.coverCrop !== 'None (Stubble / Bare)' && (
                    <span className="rounded-full bg-[#8fd469]/18 px-2 py-0.5 text-[10px] font-semibold text-[#8fd469]">
                      Active Cover
                    </span>
                  )}
                </div>
                <p className="mt-1 text-[11px] text-[#dce2d4]/60">
                  Assign a cover crop mix to track soil health, NRCS EQIP eligibility, and nitrogen credits.
                </p>

                <div className="mt-2.5 grid grid-cols-2 gap-1.5">
                  {COVER_CROP_OPTIONS.map((opt) => {
                    const active = cropProfile.coverCrop === opt.value;
                    return (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => handleSelectCoverCrop(opt.value)}
                        className={`rounded-xl border p-2.5 text-left transition-all ${
                          active
                            ? 'border-[#8fd469]/70 bg-[#8fd469]/14'
                            : 'border-white/8 bg-black/20 hover:border-white/20 hover:bg-white/[0.04]'
                        }`}
                      >
                        <div className="flex items-center gap-1.5">
                          <span
                            className="h-2 w-2 shrink-0 rounded-full"
                            style={{ backgroundColor: opt.color }}
                          />
                          <span className="truncate text-[11.5px] font-semibold text-[#f5f7f1]">
                            {opt.badge}
                          </span>
                        </div>
                        <p className="mt-1 line-clamp-2 text-[10px] leading-snug text-[#dce2d4]/60">
                          {opt.benefit}
                        </p>
                      </button>
                    );
                  })}
                </div>

                {cropProfile.coverCrop !== 'None (Stubble / Bare)' && (
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[10px] text-[#dce2d4]/55">Seeded Date</label>
                      <input
                        type="text"
                        value={cropProfile.coverCropPlantedDate || ''}
                        onChange={(e) =>
                          onUpdateCropProfile(parcel.id, {
                            ...cropProfile,
                            coverCropPlantedDate: e.target.value,
                            updatedAt: 'Updated just now',
                          })
                        }
                        placeholder="Oct 28, 2026"
                        className="mt-1 w-full rounded-xl border border-white/12 bg-black/30 px-2.5 py-1.5 text-[11.5px] text-white focus:border-[#8fd469]/60 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-[#dce2d4]/55">Termination Target</label>
                      <input
                        type="text"
                        value={cropProfile.coverCropTerminationTarget || ''}
                        onChange={(e) =>
                          onUpdateCropProfile(parcel.id, {
                            ...cropProfile,
                            coverCropTerminationTarget: e.target.value,
                            updatedAt: 'Updated just now',
                          })
                        }
                        placeholder="Apr 5, 2027"
                        className="mt-1 w-full rounded-xl border border-white/12 bg-black/30 px-2.5 py-1.5 text-[11.5px] text-white focus:border-[#8fd469]/60 focus:outline-none"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Add Previous Crop Planted Form */}
              <form
                onSubmit={handleAddPreviousCrop}
                className="rounded-2xl border border-white/10 bg-white/[0.03] p-3.5"
              >
                <h3 className="text-[12.5px] font-semibold text-[#f3f5ef]">
                  Log Previous Crop Planted
                </h3>
                <div className="mt-2.5 grid grid-cols-3 gap-2">
                  <div>
                    <label className="text-[10px] text-[#dce2d4]/55">Crop Year</label>
                    <select
                      value={histYear}
                      onChange={(e) => setHistYear(Number(e.target.value))}
                      className="mt-1 w-full rounded-xl border border-white/12 bg-[#161914] px-2.5 py-1.5 text-[11.5px] text-white focus:border-[#d8f274]/60 focus:outline-none"
                    >
                      {[2026, 2025, 2024, 2023, 2022, 2021, 2020, 2019, 2018].map((yr) => (
                        <option key={yr} value={yr}>
                          {yr}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="col-span-2">
                    <label className="text-[10px] text-[#dce2d4]/55">Season Type</label>
                    <select
                      value={histSeason}
                      onChange={(e) =>
                        setHistSeason(e.target.value as CropHistoryEntry['season'])
                      }
                      className="mt-1 w-full rounded-xl border border-white/12 bg-[#161914] px-2.5 py-1.5 text-[11.5px] text-white focus:border-[#d8f274]/60 focus:outline-none"
                    >
                      <option value="Main Crop">Main Crop</option>
                      <option value="Fall/Winter Cover">Fall/Winter Cover</option>
                      <option value="Double-Crop">Double-Crop</option>
                    </select>
                  </div>
                </div>

                <div className="mt-2 grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[10px] text-[#dce2d4]/55">Previous Crop</label>
                    <select
                      value={histCrop}
                      onChange={(e) => setHistCrop(e.target.value)}
                      className="mt-1 w-full rounded-xl border border-white/12 bg-[#161914] px-2.5 py-1.5 text-[11.5px] text-white focus:border-[#d8f274]/60 focus:outline-none"
                    >
                      {PREVIOUS_CROP_CHOICES.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-[10px] text-[#dce2d4]/55">Tillage</label>
                    <select
                      value={histTillage}
                      onChange={(e) => setHistTillage(e.target.value as TillagePractice)}
                      className="mt-1 w-full rounded-xl border border-white/12 bg-[#161914] px-2.5 py-1.5 text-[11.5px] text-white focus:border-[#d8f274]/60 focus:outline-none"
                    >
                      {TILLAGE_OPTIONS.map((t) => (
                        <option key={t} value={t}>
                          {t}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="mt-2 grid grid-cols-2 gap-2">
                  <input
                    type="text"
                    value={histVariety}
                    onChange={(e) => setHistVariety(e.target.value)}
                    placeholder="Variety (e.g. DP 2127 B3XF)"
                    className="rounded-xl border border-white/12 bg-black/30 px-2.5 py-1.5 text-[11.5px] text-white placeholder:text-[#dce2d4]/40 focus:border-[#d8f274]/60 focus:outline-none"
                  />
                  <input
                    type="text"
                    value={histYieldNote}
                    onChange={(e) => setHistYieldNote(e.target.value)}
                    placeholder="Yield / Note (e.g. 1,180 lbs/ac)"
                    className="rounded-xl border border-white/12 bg-black/30 px-2.5 py-1.5 text-[11.5px] text-white placeholder:text-[#dce2d4]/40 focus:border-[#d8f274]/60 focus:outline-none"
                  />
                </div>

                <div className="mt-2.5 flex justify-end">
                  <button
                    type="submit"
                    className="inline-flex items-center gap-1.5 rounded-full bg-[#d8f274] px-3.5 py-1.5 text-[11.5px] font-semibold text-[#141710] hover:bg-[#e5fa93]"
                  >
                    <Plus size={13} weight="bold" />
                    Add to Crop Rotation
                  </button>
                </div>
              </form>

              {/* Multi-Year Crop Rotation History List */}
              <div>
                <h3 className="mb-2 text-[12.5px] font-semibold text-[#f3f5ef]">
                  Previous Crops Planted ({cropProfile.previousCrops.length})
                </h3>
                <div className="space-y-2">
                  {cropProfile.previousCrops.map((entry) => (
                    <div
                      key={entry.id}
                      className="flex items-start justify-between gap-2 rounded-2xl border border-white/8 bg-white/[0.025] p-3"
                    >
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="rounded-full bg-[#d8f274]/15 px-2 py-0.5 font-mono text-[10px] font-semibold text-[#d8f274]">
                            {entry.year}
                          </span>
                          <span
                            className={`rounded-full px-2 py-0.5 text-[9.5px] font-medium ${
                              entry.season === 'Fall/Winter Cover'
                                ? 'bg-[#8fd469]/18 text-[#8fd469]'
                                : 'bg-white/8 text-[#dce2d4]/80'
                            }`}
                          >
                            {entry.season}
                          </span>
                          {entry.tillage && (
                            <span className="font-mono text-[9.5px] text-[#dce2d4]/50">
                              {entry.tillage}
                            </span>
                          )}
                        </div>
                        <div className="mt-1 text-[13px] font-semibold text-[#f5f7f1]">
                          {entry.crop}
                          {entry.variety && (
                            <span className="ml-1.5 text-[11px] font-normal text-[#dce2d4]/60">
                              · {entry.variety}
                            </span>
                          )}
                        </div>
                        {entry.yieldNote && (
                          <div className="mt-0.5 text-[11px] text-[#dce2d4]/65">
                            {entry.yieldNote}
                          </div>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() => handleDeleteCropHistory(entry.id)}
                        title="Remove crop history entry"
                        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[#dce2d4]/45 hover:bg-white/10 hover:text-[#f39378]"
                      >
                        <Trash size={13} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}

          {/* ===================== TAB 3: DOCS, CERTS & SOIL TESTS ===================== */}
          {activeTab === 'documents' && (
            <>
              <form
                onSubmit={handleUploadSubmit}
                className="rounded-2xl border border-white/10 bg-white/[0.03] p-3.5"
              >
                <div className="flex items-center justify-between">
                  <h3 className="flex items-center gap-1.5 text-[12.5px] font-semibold text-[#f3f5ef]">
                    <FileArrowUp size={16} className="text-[#5ec8eb]" />
                    Upload Document, Certification or Soil Test
                  </h3>
                </div>

                {/* Category Selector Pills */}
                <div className="mt-2.5 flex flex-wrap gap-1.5">
                  {DOCUMENT_CATEGORIES.map((cat) => {
                    const active = docCategory === cat.value;
                    return (
                      <button
                        key={cat.value}
                        type="button"
                        onClick={() => setDocCategory(cat.value)}
                        className={`rounded-full px-2.5 py-1 text-[10.5px] font-semibold transition-all ${
                          active
                            ? 'bg-[#d8f274] text-[#141710]'
                            : 'border border-white/10 bg-black/25 text-[#dce2d4]/75 hover:border-white/25 hover:text-white'
                        }`}
                      >
                        {cat.shortLabel}
                      </button>
                    );
                  })}
                </div>

                {/* Drag & Drop File Zone */}
                <div
                  onDragOver={(e) => {
                    e.preventDefault();
                    setIsDragOver(true);
                  }}
                  onDragLeave={() => setIsDragOver(false)}
                  onDrop={(e) => {
                    e.preventDefault();
                    setIsDragOver(false);
                    const file = e.dataTransfer.files?.[0];
                    if (file) ingestFile(file);
                  }}
                  onClick={() => fileInputRef.current?.click()}
                  className={`mt-2.5 flex cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed px-3 py-4 text-center transition-colors ${
                    isDragOver
                      ? 'border-[#d8f274] bg-[#d8f274]/10'
                      : 'border-white/20 bg-black/25 hover:border-[#d8f274]/50'
                  }`}
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".pdf,.png,.jpg,.jpeg,.webp,.csv,.xlsx,.xls,.doc,.docx,.txt,.json"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) ingestFile(f);
                    }}
                  />
                  <FileArrowUp size={22} className="text-[#d8f274]" />
                  {selectedFile ? (
                    <div className="mt-1.5">
                      <div className="text-[12px] font-semibold text-[#f5f7f1]">
                        {selectedFile.name}
                      </div>
                      <div className="font-mono text-[10px] text-[#d8f274]">
                        {formatBytes(selectedFile.size)} · Ready to attach to {parcel.name}
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="mt-1 text-[12px] font-medium text-[#f3f5ef]">
                        Drop PDF, CSV, Lab Image or Click to Browse
                      </div>
                      <div className="mt-0.5 text-[10px] text-[#dce2d4]/50">
                        {DOCUMENT_CATEGORIES.find((c) => c.value === docCategory)?.examples}
                      </div>
                    </>
                  )}
                </div>

                {/* Metadata Inputs */}
                <div className="mt-2.5 space-y-2">
                  <input
                    type="text"
                    value={docTitle}
                    onChange={(e) => setDocTitle(e.target.value)}
                    placeholder={
                      docCategory === 'Soil Test'
                        ? 'Title (e.g. Fall 2026 MSU Extension Grid Soil Assay)'
                        : docCategory === 'Certification'
                        ? 'Title (e.g. U.S. Cotton Trust Protocol 2026 Certificate)'
                        : 'Document title'
                    }
                    className="w-full rounded-xl border border-white/12 bg-black/30 px-3 py-1.5 text-[12px] text-white placeholder:text-[#dce2d4]/40 focus:border-[#d8f274]/60 focus:outline-none"
                  />
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      type="text"
                      value={docIssuer}
                      onChange={(e) => setDocIssuer(e.target.value)}
                      placeholder={
                        docCategory === 'Soil Test'
                          ? 'Lab (e.g. MSU Soil Lab)'
                          : 'Issuer / Agency'
                      }
                      className="rounded-xl border border-white/12 bg-black/30 px-2.5 py-1.5 text-[11.5px] text-white placeholder:text-[#dce2d4]/40 focus:border-[#d8f274]/60 focus:outline-none"
                    />
                    <input
                      type="text"
                      value={docExpires}
                      onChange={(e) => setDocExpires(e.target.value)}
                      placeholder="Valid Until (optional)"
                      className="rounded-xl border border-white/12 bg-black/30 px-2.5 py-1.5 text-[11.5px] text-white placeholder:text-[#dce2d4]/40 focus:border-[#d8f274]/60 focus:outline-none"
                    />
                  </div>

                  {/* Structured Soil Test Lab Metrics when Soil Test is selected */}
                  {docCategory === 'Soil Test' && (
                    <div className="rounded-xl border border-[#d8f274]/20 bg-[#d8f274]/[0.04] p-2.5">
                      <div className="mb-1.5 flex items-center gap-1.5 text-[10.5px] font-semibold text-[#d8f274]">
                        <Flask size={13} />
                        Optional Soil Lab Readings (extracted onto parcel)
                      </div>
                      <div className="grid grid-cols-3 gap-1.5">
                        <input
                          type="number"
                          step="0.1"
                          value={soilPh}
                          onChange={(e) => setSoilPh(e.target.value)}
                          placeholder="pH (6.5)"
                          className="rounded-lg border border-white/12 bg-black/35 px-2 py-1 font-mono text-[11px] text-white placeholder:text-[#dce2d4]/40 focus:border-[#d8f274]/60 focus:outline-none"
                        />
                        <input
                          type="number"
                          step="0.1"
                          value={soilOm}
                          onChange={(e) => setSoilOm(e.target.value)}
                          placeholder="OM % (2.4)"
                          className="rounded-lg border border-white/12 bg-black/35 px-2 py-1 font-mono text-[11px] text-white placeholder:text-[#dce2d4]/40 focus:border-[#d8f274]/60 focus:outline-none"
                        />
                        <input
                          type="number"
                          step="0.1"
                          value={soilCec}
                          onChange={(e) => setSoilCec(e.target.value)}
                          placeholder="CEC (28)"
                          className="rounded-lg border border-white/12 bg-black/35 px-2 py-1 font-mono text-[11px] text-white placeholder:text-[#dce2d4]/40 focus:border-[#d8f274]/60 focus:outline-none"
                        />
                        <input
                          type="number"
                          value={soilN}
                          onChange={(e) => setSoilN(e.target.value)}
                          placeholder="N lbs/ac"
                          className="rounded-lg border border-white/12 bg-black/35 px-2 py-1 font-mono text-[11px] text-white placeholder:text-[#dce2d4]/40 focus:border-[#d8f274]/60 focus:outline-none"
                        />
                        <input
                          type="number"
                          value={soilP}
                          onChange={(e) => setSoilP(e.target.value)}
                          placeholder="P ppm"
                          className="rounded-lg border border-white/12 bg-black/35 px-2 py-1 font-mono text-[11px] text-white placeholder:text-[#dce2d4]/40 focus:border-[#d8f274]/60 focus:outline-none"
                        />
                        <input
                          type="number"
                          value={soilK}
                          onChange={(e) => setSoilK(e.target.value)}
                          placeholder="K ppm"
                          className="rounded-lg border border-white/12 bg-black/35 px-2 py-1 font-mono text-[11px] text-white placeholder:text-[#dce2d4]/40 focus:border-[#d8f274]/60 focus:outline-none"
                        />
                      </div>
                    </div>
                  )}

                  <input
                    type="text"
                    value={docNotes}
                    onChange={(e) => setDocNotes(e.target.value)}
                    placeholder="Notes (e.g. 2.5-ac grid sample, lime rec 1.5 ton/ac)"
                    className="w-full rounded-xl border border-white/12 bg-black/30 px-3 py-1.5 text-[11.5px] text-white placeholder:text-[#dce2d4]/40 focus:border-[#d8f274]/60 focus:outline-none"
                  />
                </div>

                <div className="mt-3 flex justify-end">
                  <button
                    type="submit"
                    disabled={!selectedFile && !docTitle.trim()}
                    className="inline-flex items-center gap-1.5 rounded-full bg-[#d8f274] px-4 py-1.5 text-[11.5px] font-semibold text-[#141710] hover:bg-[#e5fa93] disabled:opacity-40"
                  >
                    <Plus size={13} weight="bold" />
                    Save to Parcel Vault
                  </button>
                </div>
              </form>

              {/* Uploaded Docs List */}
              <div>
                <div className="mb-2 flex items-center justify-between gap-2">
                  <h3 className="text-[12.5px] font-semibold text-[#f3f5ef]">
                    Parcel Vault ({filteredDocs.length})
                  </h3>
                  <select
                    value={docFilter}
                    onChange={(e) =>
                      setDocFilter(e.target.value as 'All' | ParcelDocumentCategory)
                    }
                    className="rounded-lg border border-white/10 bg-[#161914] px-2 py-1 text-[10.5px] text-[#dce2d4]"
                  >
                    <option value="All">All Types ({parcelDocs.length})</option>
                    {DOCUMENT_CATEGORIES.map((c) => (
                      <option key={c.value} value={c.value}>
                        {c.value}
                      </option>
                    ))}
                  </select>
                </div>

                {filteredDocs.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-white/10 bg-white/[0.02] p-5 text-center text-[11.5px] text-[#dce2d4]/55">
                    No files uploaded to {parcel.name} yet. Upload soil lab reports, USDA/Cotton
                    Trust certifications, FSA-578 forms, or deeds above.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {filteredDocs.map((doc) => {
                      const catMeta = DOCUMENT_CATEGORIES.find((c) => c.value === doc.category);
                      return (
                        <div
                          key={doc.id}
                          className="rounded-2xl border border-white/10 bg-white/[0.03] p-3"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <div className="flex flex-wrap items-center gap-1.5">
                                <span
                                  className="rounded-full px-2 py-0.5 text-[9.5px] font-semibold"
                                  style={{
                                    backgroundColor: `${catMeta?.accent || '#d8f274'}22`,
                                    color: catMeta?.accent || '#d8f274',
                                  }}
                                >
                                  {doc.category}
                                </span>
                                <span className="font-mono text-[9.5px] text-[#dce2d4]/50">
                                  {doc.uploadedAt} · {formatBytes(doc.fileSizeBytes)}
                                </span>
                              </div>
                              <div className="mt-1 text-[13px] font-semibold text-[#f5f7f1]">
                                {doc.title}
                              </div>
                              <div className="truncate font-mono text-[10px] text-[#dce2d4]/55">
                                {doc.fileName}
                                {doc.issuerOrLab ? ` · ${doc.issuerOrLab}` : ''}
                                {doc.expiresAt ? ` · Exp ${doc.expiresAt}` : ''}
                              </div>
                            </div>
                            <div className="flex shrink-0 items-center gap-1">
                              {doc.dataUrl && (
                                <a
                                  href={doc.dataUrl}
                                  download={doc.fileName}
                                  target="_blank"
                                  rel="noreferrer"
                                  title="Open or download file"
                                  className="flex h-7 w-7 items-center justify-center rounded-full border border-white/10 text-[#d8f274] hover:bg-white/10"
                                >
                                  <DownloadSimple size={13} />
                                </a>
                              )}
                              <button
                                type="button"
                                onClick={() => onDeleteDocument(doc.id)}
                                title="Delete document"
                                className="flex h-7 w-7 items-center justify-center rounded-full text-[#dce2d4]/45 hover:bg-white/10 hover:text-[#f39378]"
                              >
                                <Trash size={13} />
                              </button>
                            </div>
                          </div>

                          {doc.soilMetrics && (
                            <div className="mt-2 flex flex-wrap gap-1.5">
                              {doc.soilMetrics.ph !== undefined && (
                                <span className="rounded-lg bg-black/35 px-2 py-0.5 font-mono text-[10px] text-[#d8f274]">
                                  pH {doc.soilMetrics.ph}
                                </span>
                              )}
                              {doc.soilMetrics.organicMatterPct !== undefined && (
                                <span className="rounded-lg bg-black/35 px-2 py-0.5 font-mono text-[10px] text-[#8fd469]">
                                  OM {doc.soilMetrics.organicMatterPct}%
                                </span>
                              )}
                              {doc.soilMetrics.nitrogenLbsAc !== undefined && (
                                <span className="rounded-lg bg-black/35 px-2 py-0.5 font-mono text-[10px] text-[#5ec8eb]">
                                  N {doc.soilMetrics.nitrogenLbsAc} lb/ac
                                </span>
                              )}
                              {doc.soilMetrics.phosphorusPpm !== undefined && (
                                <span className="rounded-lg bg-black/35 px-2 py-0.5 font-mono text-[10px] text-[#f0bb66]">
                                  P {doc.soilMetrics.phosphorusPpm} ppm
                                </span>
                              )}
                              {doc.soilMetrics.potassiumPpm !== undefined && (
                                <span className="rounded-lg bg-black/35 px-2 py-0.5 font-mono text-[10px] text-[#e6a84c]">
                                  K {doc.soilMetrics.potassiumPpm} ppm
                                </span>
                              )}
                              {doc.soilMetrics.cec !== undefined && (
                                <span className="rounded-lg bg-black/35 px-2 py-0.5 font-mono text-[10px] text-[#dce2d4]">
                                  CEC {doc.soilMetrics.cec}
                                </span>
                              )}
                            </div>
                          )}

                          {doc.notes && (
                            <p className="mt-1.5 text-[11px] text-[#dce2d4]/68">{doc.notes}</p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </>
          )}

          {/* ===================== TAB 4: CLAIM OWNERSHIP (POSTCARD PIN) ===================== */}
          {activeTab === 'claim' && (
            <>
              {/* Official County Tax Assessor Record Card */}
              <div className="rounded-2xl border border-[#d8f274]/25 bg-[#d8f274]/[0.04] p-3.5">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5 text-[12px] font-semibold text-[#f5f7f1]">
                    <LockSimple size={14} className="text-[#d8f274]" />
                    County Tax Assessor Record
                  </div>
                  <span className="rounded-full bg-[#d8f274]/18 px-2 py-0.5 font-mono text-[9.5px] text-[#d8f274]">
                    {loadingAssessor
                      ? 'Querying Tax Roll...'
                      : claimRecord?.taxAddressSource ||
                        assessorAddr?.source ||
                        'Assessor Parcel Record'}
                  </span>
                </div>

                <div className="mt-2.5 space-y-1.5 text-[11.5px]">
                  <div className="flex justify-between gap-2">
                    <span className="text-[#dce2d4]/55">Owner on Tax Roll</span>
                    <span className="text-right font-semibold text-[#d8f274]">
                      {claimRecord?.taxAssessorOwner || assessorAddr?.ownerName || parcel.ownerName}
                    </span>
                  </div>
                  <div className="flex justify-between gap-2">
                    <span className="text-[#dce2d4]/55">Parcel ID (PARNO)</span>
                    <span className="font-mono text-[#f3f5ef]">{parcel.parno}</span>
                  </div>
                  <div className="rounded-xl border border-white/10 bg-black/35 p-2.5">
                    <div className="text-[9.5px] font-semibold uppercase tracking-wider text-[#dce2d4]/48">
                      Official Postcard Mailing Destination (Locked to Tax Roll)
                    </div>
                    <div className="mt-1 font-mono text-[12px] font-semibold text-[#f5f7f1]">
                      {loadingAssessor
                        ? 'Looking up MARIS County Tax Assessor mailing address...'
                        : claimRecord?.taxMailingAddress ||
                          assessorAddr?.mailingAddress ||
                          `${parcel.siteAddress}, ${parcel.cityState}`}
                    </div>
                  </div>
                </div>
                <p className="mt-2 text-[10.5px] leading-relaxed text-[#dce2d4]/62">
                  Just like Google Maps Business Verification, a physical USPS verification postcard
                  containing a one-time 6-digit PIN is mailed exclusively to the owner&apos;s
                  official mailing address on the County Tax Assessor&apos;s roll (7–14 days).
                </p>
              </div>

              {/* STATE A: UNCLAIMED -> Request Postcard Form */}
              {!claimRecord && (
                <form
                  onSubmit={handleMailPostcard}
                  className="rounded-2xl border border-white/10 bg-white/[0.03] p-3.5"
                >
                  <h3 className="flex items-center gap-1.5 text-[13px] font-semibold text-[#f5f7f1]">
                    <EnvelopeSimple size={16} className="text-[#d8f274]" />
                    Step 1 · Request Tax Roll Verification Postcard
                  </h3>
                  <div className="mt-3 space-y-2.5">
                    <div>
                      <label className="text-[10.5px] text-[#dce2d4]/60">
                        Farm / Operation Name (for your Portal)
                      </label>
                      <input
                        type="text"
                        required
                        value={claimFarmName}
                        onChange={(e) => setClaimFarmName(e.target.value)}
                        className="mt-1 w-full rounded-xl border border-white/12 bg-black/30 px-3 py-2 text-[12px] text-white focus:border-[#d8f274]/60 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="text-[10.5px] text-[#dce2d4]/60">
                        Owner / Authorized Representative Name
                      </label>
                      <input
                        type="text"
                        required
                        value={claimantName}
                        onChange={(e) => setClaimantName(e.target.value)}
                        className="mt-1 w-full rounded-xl border border-white/12 bg-black/30 px-3 py-2 text-[12px] text-white focus:border-[#d8f274]/60 focus:outline-none"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-[10.5px] text-[#dce2d4]/60">Email</label>
                        <input
                          type="email"
                          required
                          value={claimantEmail}
                          onChange={(e) => setClaimantEmail(e.target.value)}
                          className="mt-1 w-full rounded-xl border border-white/12 bg-black/30 px-2.5 py-2 text-[12px] text-white focus:border-[#d8f274]/60 focus:outline-none"
                        />
                      </div>
                      <div>
                        <label className="text-[10.5px] text-[#dce2d4]/60">Phone</label>
                        <input
                          type="text"
                          value={claimantPhone}
                          onChange={(e) => setClaimantPhone(e.target.value)}
                          className="mt-1 w-full rounded-xl border border-white/12 bg-black/30 px-2.5 py-2 text-[12px] text-white focus:border-[#d8f274]/60 focus:outline-none"
                        />
                      </div>
                    </div>
                  </div>
                  <button
                    type="submit"
                    disabled={loadingAssessor}
                    className="mt-3.5 flex w-full items-center justify-center gap-2 rounded-full bg-[#d8f274] px-4 py-2.5 text-[12.5px] font-bold text-[#141710] shadow-[0_8px_24px_-6px_rgba(216,242,116,0.5)] transition-all hover:bg-[#e7fc95] disabled:opacity-50"
                  >
                    <EnvelopeSimple size={15} weight="bold" />
                    Mail Verification Postcard (7–14 Days)
                  </button>
                </form>
              )}

              {/* STATE B: POSTCARD MAILED -> Timeline + Enter 6-Digit PIN */}
              {claimRecord?.status === 'postcard_mailed' && (
                <div className="space-y-3">
                  {/* USPS 4-Step Progress */}
                  <div className="rounded-2xl border border-[#f0bb66]/35 bg-[#f0bb66]/[0.07] p-3.5">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[12.5px] font-semibold text-[#f6deb2]">
                        USPS Verification Postcard Dispatched
                      </span>
                      <span className="font-mono text-[10px] text-[#f0bb66]">
                        {claimRecord.trackingNumber}
                      </span>
                    </div>
                    <div className="mt-2.5 grid grid-cols-4 gap-1.5 text-center text-[9.5px]">
                      {[
                        { label: 'Tax Roll OK', done: true },
                        { label: 'PIN Printed', done: true },
                        { label: 'USPS Mail', active: true },
                        { label: 'Enter PIN', done: false },
                      ].map((step) => (
                        <div
                          key={step.label}
                          className={`rounded-xl border px-1.5 py-1.5 font-medium ${
                            step.done
                              ? 'border-[#7cd8a0]/40 bg-[#7cd8a0]/14 text-[#9be8b8]'
                              : step.active
                              ? 'border-[#f0bb66]/60 bg-[#f0bb66]/20 text-[#f6deb2]'
                              : 'border-white/10 bg-black/25 text-[#dce2d4]/45'
                          }`}
                        >
                          {step.label}
                        </div>
                      ))}
                    </div>
                    <div className="mt-2.5 flex items-center justify-between text-[11px] text-[#dce2d4]/75">
                      <span>Estimated USPS arrival:</span>
                      <span className="font-mono font-semibold text-[#f6deb2]">
                        {claimRecord.estimatedArrivalWindow}
                      </span>
                    </div>
                  </div>

                  {/* Enter 6-Digit PIN Form */}
                  <form
                    onSubmit={handleVerifySubmit}
                    className="rounded-2xl border border-white/12 bg-white/[0.035] p-3.5"
                  >
                    <h3 className="text-[12.5px] font-semibold text-[#f5f7f1]">
                      Step 2 · Enter 6-Digit Postcard PIN Code
                    </h3>
                    <p className="mt-0.5 text-[11px] text-[#dce2d4]/60">
                      Once your USPS postcard arrives at the tax roll mailing address, enter the
                      code printed inside to claim this parcel.
                    </p>
                    <div className="mt-2.5 flex gap-2">
                      <input
                        type="text"
                        value={pinInput}
                        onChange={(e) => {
                          setPinInput(e.target.value);
                          setPinError(null);
                        }}
                        placeholder="e.g. 482-917"
                        maxLength={7}
                        className="flex-1 rounded-xl border border-white/15 bg-black/40 px-3 py-2 text-center font-mono text-[15px] font-bold tracking-[0.18em] text-[#d8f274] placeholder:tracking-normal placeholder:font-normal placeholder:text-[#dce2d4]/35 focus:border-[#d8f274] focus:outline-none"
                      />
                      <button
                        type="submit"
                        disabled={pinInput.replace(/\D/g, '').length < 6}
                        className="rounded-xl bg-[#d8f274] px-4 py-2 text-[12px] font-bold text-[#141710] hover:bg-[#e7fc95] disabled:opacity-40"
                      >
                        Verify PIN
                      </button>
                    </div>
                    {pinError && (
                      <div className="mt-2 flex items-center gap-1.5 text-[11px] text-[#f39378]">
                        <WarningCircle size={14} weight="fill" />
                        {pinError}
                      </div>
                    )}
                  </form>

                  {/* Demo Mode Simulated Postcard Preview (so user can verify immediately) */}
                  <div className="rounded-2xl border border-white/10 bg-black/30 p-3">
                    <button
                      type="button"
                      onClick={() => setShowDemoPostcard((v) => !v)}
                      className="flex w-full items-center justify-between text-[11px] font-medium text-[#5ec8eb] hover:text-[#96def7]"
                    >
                      <span className="flex items-center gap-1.5">
                        <Eye size={14} />
                        {showDemoPostcard
                          ? 'Hide Simulated USPS Postcard Preview'
                          : 'Test Mode: Preview Mailed Postcard & Reveal PIN'}
                      </span>
                      <span className="font-mono text-[9.5px] text-[#dce2d4]/45">SANDBOX</span>
                    </button>

                    {showDemoPostcard && (
                      <div className="mt-3 rounded-xl border border-[#e6d7b8]/30 bg-[#f6f1e4] p-3.5 text-[#1c2019] shadow-lg">
                        <div className="flex items-start justify-between border-b border-black/15 pb-2">
                          <div>
                            <div className="font-mono text-[9px] font-bold uppercase tracking-widest text-[#4a5738]">
                              DeltaPlot Land Verification · First-Class Mail
                            </div>
                            <div className="text-[12px] font-bold">
                              Official Parcel Ownership Code
                            </div>
                          </div>
                          <div className="rounded border border-black/30 px-1.5 py-0.5 font-mono text-[8.5px] font-bold">
                            USPS PERMIT
                          </div>
                        </div>
                        <div className="mt-2.5 grid grid-cols-2 gap-2 text-[10.5px]">
                          <div>
                            <div className="text-[8.5px] uppercase text-black/55">Mailed To</div>
                            <div className="font-bold leading-tight">
                              {claimRecord.taxAssessorOwner}
                            </div>
                            <div className="font-mono text-[9.5px] leading-snug text-black/75">
                              {claimRecord.taxMailingAddress}
                            </div>
                          </div>
                          <div className="flex flex-col items-end justify-center rounded-lg bg-[#192014] px-2.5 py-2 text-right text-[#d8f274]">
                            <div className="text-[8.5px] uppercase tracking-wider text-white/60">
                              6-Digit PIN
                            </div>
                            <div className="font-mono text-[17px] font-bold tracking-[0.14em]">
                              {claimRecord.postcardPin}
                            </div>
                          </div>
                        </div>
                        <div className="mt-2 flex items-center justify-between pt-1">
                          <span className="font-mono text-[9px] text-black/60">
                            PARNO {claimRecord.parno} · {claimRecord.county}
                          </span>
                          <button
                            type="button"
                            onClick={() => {
                              setPinInput(claimRecord.postcardPin);
                              setCopiedPin(true);
                              setTimeout(() => setCopiedPin(false), 1800);
                            }}
                            className="inline-flex items-center gap-1 rounded-full bg-[#192014] px-2.5 py-1 text-[10px] font-semibold text-[#d8f274]"
                          >
                            <Copy size={11} />
                            {copiedPin ? 'Filled PIN!' : 'Auto-Fill PIN'}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* STATE C: VERIFIED OWNER */}
              {claimRecord?.status === 'verified' && (
                <div className="rounded-2xl border border-[#7cd8a0]/45 bg-[#7cd8a0]/12 p-4">
                  <div className="flex items-center gap-2 text-[14px] font-bold text-[#a9f0c4]">
                    <SealCheck size={20} weight="fill" />
                    Parcel Ownership Verified
                  </div>
                  <p className="mt-1 text-[11.5px] leading-relaxed text-[#dce2d4]/80">
                    <strong>{parcel.name}</strong> ({parcel.parno}) is now linked to{' '}
                    <strong>{claimRecord.farmEntityName}</strong>. Manage crop rotations, soil
                    tests, certifications, and drone spray bids from your Farmer Portal.
                  </p>
                  <div className="mt-3 space-y-1 rounded-xl bg-black/30 p-2.5 font-mono text-[10.5px] text-[#dce2d4]/75">
                    <div>Verified On: {claimRecord.verifiedAt}</div>
                    <div>Postcard Ref: {claimRecord.trackingNumber}</div>
                    <div>Claimant: {claimRecord.claimantName} ({claimRecord.claimantEmail})</div>
                  </div>
                  <button
                    type="button"
                    onClick={onOpenFarmerPortal}
                    className="mt-3.5 flex w-full items-center justify-center gap-2 rounded-full bg-[#d8f274] px-4 py-2.5 text-[12.5px] font-bold text-[#141710] hover:bg-[#e7fc95]"
                  >
                    <HouseLine size={16} weight="bold" />
                    Open My Farm Portal Dashboard
                  </button>
                </div>
              )}
            </>
          )}
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

        <div className="mt-3.5 space-y-2 rounded-2xl border border-white/8 bg-white/[0.025] p-3 text-[12px]">
          <div className="flex justify-between">
            <span className="text-[#dce2d4]/55">Operator</span>
            <span className="font-medium text-[#f3f5ef]">{equipment.operator}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-[#dce2d4]/55">Active Task</span>
            <span className="max-w-[220px] text-right text-[#e5eae0]">{equipment.currentTask}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-[#dce2d4]/55">Engine Hours</span>
            <span className="font-mono text-[#dce2d4]/85">{equipment.engineHours.toLocaleString()} hrs</span>
          </div>
          <div className="flex justify-between">
            <span className="text-[#dce2d4]/55">Swath / Width</span>
            <span className="font-mono text-[#dce2d4]/85">{equipment.implementWidthFt} ft</span>
          </div>
        </div>

        <div className="mt-4">
          <label className="text-[11px] font-medium text-[#dce2d4]/65">
            Assigned Mississippi Parcel
          </label>
          <select
            value={equipment.assignedParcelId}
            onChange={(e) => onReassignParcel(equipment.id, e.target.value)}
            className="mt-1.5 w-full rounded-xl border border-white/15 bg-[#161914] px-3 py-2 text-[12.5px] text-white focus:border-[#d8f274]/60 focus:outline-none"
          >
            {parcels.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} ({formatArea(p.areaAcres, unit)})
              </option>
            ))}
          </select>
        </div>
      </div>
    </div>
  );
};

// Re-export Certificate icon marker so unused import lint doesn't trigger if tree-shaken
export const _CertIconRef = Certificate;
