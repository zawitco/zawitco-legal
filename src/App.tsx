import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  PortalDataResponse,
  KPIStatus,
  RecordItemData,
  CorePillarKey,
} from './types';
import {
  calculateScorecardForElement,
  calculateSubProjectBreakdown,
  calculateHierarchicalBreakdown,
  calculateCoreThreeScorecards,
} from './utils/kpiEngine';
import { exportPdfReport, exportExcelReport } from './utils/reportExport';
import { TopBar } from './components/TopBar';
import { ClientKpiStrip } from './components/ClientKpiStrip';
import { SubProjectOverviewGrid } from './components/SubProjectOverviewGrid';
import { EmployeeComplianceRoster } from './components/EmployeeComplianceRoster';
import { PinModal } from './components/PinModal';
import { ShareLinkModal } from './components/ShareLinkModal';
import { AdminModal } from './components/AdminModal';
import { SyncModal } from './components/SyncModal';
import { isStaticHosting, getBackendUrl, safeApiFetch } from './services/api';
import { subscribeToFirestoreEmployees, subscribeToFirestoreMeta } from './services/firebase';
import {
  ShieldAlert,
  Lock,
  RefreshCw,
  Users,
} from 'lucide-react';

export default function App() {
  const [token, setToken] = useState<string | null>(null);
  const [adminPin, setAdminPin] = useState<string>(() => {
    return sessionStorage.getItem('admin_pin') || '';
  });
  const [portalData, setPortalData] = useState<PortalDataResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Client Core Filters
  const [activeTab, setActiveTab] = useState<string>('ALL');
  const [activeProject, setActiveProject] = useState<string>('ALL');
  const [activeSubProject, setActiveSubProject] = useState<string>('ALL');
  const [activePillar, setActivePillar] = useState<CorePillarKey>('ALL');
  const [selectedStatus, setSelectedStatus] = useState<KPIStatus | 'ALL'>('ALL');

  // Modals
  const [isPinModalOpen, setIsPinModalOpen] = useState(false);
  const [pinPurpose, setPinPurpose] = useState<
    'portal_unlock' | 'admin_center' | 'share_link' | 'sync'
  >('portal_unlock');
  const [isAdminModalOpen, setIsAdminModalOpen] = useState(false);
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [isSyncModalOpen, setIsSyncModalOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);

  const showToast = useCallback((type: 'success' | 'error' | 'info', text: string) => {
    setToastMessage({ type, text });
    setTimeout(() => {
      setToastMessage(null);
    }, 4500);
  }, []);

  // Keyboard shortcut for discrete Admin Access (Ctrl+Shift+A or Cmd+Shift+A)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 'a') {
        e.preventDefault();
        if (!adminPin) {
          setPinPurpose('admin_center');
          setIsPinModalOpen(true);
        } else {
          setIsAdminModalOpen(true);
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [adminPin]);

  // Read URL query parameter for token on boot
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const t = params.get('token');
    if (t) {
      setToken(t);
    }
  }, []);

  // Real-time Cloud Firestore subscription for live multi-device syncing
  useEffect(() => {
    const unsubEmployees = subscribeToFirestoreEmployees((liveRecords) => {
      if (liveRecords && liveRecords.length > 0) {
        setPortalData((prev) => {
          if (!prev) return prev;
          return {
            ...prev,
            records: liveRecords,
            lastSyncCount: liveRecords.length,
          };
        });
      }
    });

    const unsubMeta = subscribeToFirestoreMeta((liveMeta) => {
      setPortalData((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          ...liveMeta,
        };
      });
    });

    return () => {
      unsubEmployees();
      unsubMeta();
    };
  }, []);
  const loadPortalData = useCallback(async (currentPin?: string) => {
    setLoading(true);
    setError(null);

    const pinToUse = currentPin !== undefined ? currentPin : adminPin;
    const params = new URLSearchParams(window.location.search);
    const currentToken = params.get('token');

    let url = '/api/portal-data';
    if (currentToken) {
      url += `?token=${encodeURIComponent(currentToken)}`;
    }

    const headers: Record<string, string> = {};
    if (pinToUse) {
      headers['x-admin-pin'] = pinToUse;
    }

    try {
      let data: any = null;

      // 0. Check custom imported data in localStorage first (if static mode)
      const customDataStr = localStorage.getItem('portal_custom_data');
      if (customDataStr && (!getBackendUrl() && isStaticHosting())) {
        try {
          const parsedCustom = JSON.parse(customDataStr);
          if (parsedCustom && Array.isArray(parsedCustom.records) && parsedCustom.records.length > 0) {
            data = parsedCustom;
          }
        } catch (_) {}
      }

      // 1. Try server API endpoint
      if (!data) {
        try {
          const res = await safeApiFetch<any>(url, { headers });
          if (res.status === 401 && res.data?.requiresPin) {
            setIsPinModalOpen(true);
            setPinPurpose('portal_unlock');
            setLoading(false);
            return;
          }
          if (res.ok && res.data?.records) {
            data = res.data;
          }
        } catch (_) {
          // Backend API not reachable
        }
      }

      // 2. Fallback to static portal-data.json snapshot for GitHub Pages
      if (!data || !data.records) {
        const candidatePaths = [
          './portal-data.json',
          'portal-data.json',
          `${import.meta.env.BASE_URL || './'}portal-data.json`.replace('//', '/'),
          '/zawitco-legal/portal-data.json',
        ];

        for (const candidate of candidatePaths) {
          try {
            const staticRes = await fetch(candidate);
            if (staticRes.ok) {
              const contentType = staticRes.headers.get('content-type') || '';
              if (contentType.includes('application/json')) {
                const parsed = await staticRes.json();
                if (parsed && Array.isArray(parsed.records)) {
                  data = parsed;
                  break;
                }
              }
            }
          } catch (_) {}
        }
      }

      if (!data || !data.records) {
        throw new Error('Failed to load portal records. Please verify internet connection.');
      }

      // If client token provided in static mode, filter client-side
      if (currentToken && data.records) {
        const decodedToken = decodeURIComponent(currentToken).toLowerCase();
        const matched = data.records.filter((r: any) => {
          const p = (r.project_name || '').toLowerCase();
          const sp = (r.sub_project_name || '').toLowerCase();
          return p.includes(decodedToken) || sp.includes(decodedToken) || decodedToken.includes(p);
        });
        if (matched.length > 0) {
          data.records = matched;
          data.mode = 'client_link';
        }
      }

      setPortalData(data);

      // If client share link, lock project
      if (data.mode === 'client_link' && data.linkMeta) {
        setActiveProject(data.linkMeta.project_name);
        if (data.linkMeta.sub_project_name !== 'ALL') {
          setActiveSubProject(data.linkMeta.sub_project_name);
        }
      }
    } catch (err: any) {
      setError(err.message || 'An unexpected error occurred.');
    } finally {
      setLoading(false);
    }
  }, [adminPin]);

  useEffect(() => {
    loadPortalData();
  }, [loadPortalData]);

  // Handle Sync (Internal / Admin)
  const handleSyncNow = async () => {
    if (isStaticHosting() && !getBackendUrl()) {
      setIsSyncModalOpen(true);
      return;
    }

    if (!adminPin) {
      setPinPurpose('sync');
      setIsPinModalOpen(true);
      return;
    }

    setIsSyncing(true);
    try {
      const res = await safeApiFetch<{ success: boolean; count?: number; error?: string }>(
        '/api/sync',
        {
          method: 'POST',
          headers: { 'x-admin-pin': adminPin },
        }
      );

      if (res.ok && res.data?.success) {
        showToast('success', `Sync completed! Updated ${res.data.count || 0} active records.`);
        await loadPortalData();
      } else {
        showToast('error', res.error || 'Sync failed.');
      }
    } catch (err: any) {
      showToast('error', 'Sync network error: ' + err.message);
    } finally {
      setIsSyncing(false);
    }
  };

  // Handle PIN success
  const handlePinSuccess = (pin: string) => {
    setAdminPin(pin);
    sessionStorage.setItem('admin_pin', pin);

    if (pinPurpose === 'portal_unlock') {
      loadPortalData(pin);
    } else if (pinPurpose === 'admin_center') {
      setIsAdminModalOpen(true);
      loadPortalData(pin);
    } else if (pinPurpose === 'share_link') {
      setIsShareModalOpen(true);
    } else if (pinPurpose === 'sync') {
      loadPortalData(pin).then(() => {
        handleSyncNow();
      });
    }
  };

  const handleAdminLogout = () => {
    setAdminPin('');
    sessionStorage.removeItem('admin_pin');
    showToast('info', 'Admin session ended.');
    loadPortalData('');
  };

  // Derive unique project and sub-project lists
  const { allProjects, subProjectsByProject } = useMemo(() => {
    if (!portalData || !portalData.records) {
      return { allProjects: [], subProjectsByProject: {} };
    }

    const projectsSet = new Set<string>();
    const subProjMap: Record<string, Set<string>> = {};

    for (const rec of portalData.records) {
      const proj = (rec.data['PROJECT NAME'] || rec.data['PROJECT'] || rec.project_name || 'General').trim();
      projectsSet.add(proj);

      if (!subProjMap[proj]) subProjMap[proj] = new Set();
      const subProj = (rec.data['SUB PROJECT'] || rec.data['SUB PROJECTS'] || rec.sub_project_name || '').trim();
      if (subProj && subProj !== 'MAIN' && !subProj.includes('@')) {
        subProjMap[proj].add(subProj);
      }
    }

    const subProjectArrays: Record<string, string[]> = {};
    for (const [p, set] of Object.entries(subProjMap)) {
      subProjectArrays[p] = Array.from(set).sort();
    }

    return {
      allProjects: Array.from(projectsSet).sort(),
      subProjectsByProject: subProjectArrays,
    };
  }, [portalData]);

  // Filter records by Project Scope (Sub-project filtering is handled in components)
  const projectFilteredRecords = useMemo(() => {
    if (!portalData || !portalData.records) return [];

    return portalData.records.filter((rec) => {
      const recProj = (rec.data['PROJECT NAME'] || rec.data['PROJECT'] || rec.project_name || '').trim();

      // Project filter
      if (activeProject !== 'ALL') {
        if (recProj !== activeProject) return false;
      }

      // Strict status filter: active employees only
      const statusKey = Object.keys(rec.data).find((k) => k.trim().toUpperCase() === 'STATUS');
      if (statusKey) {
        const val = (rec.data[statusKey] || '').trim().toUpperCase();
        if (val && val !== 'ACTIVE') return false;
      }

      return true;
    });
  }, [portalData, activeProject]);

  // Compute 3 Core Scorecards (Iqama, Ajeer, Health Card)
  const coreScorecards = useMemo(() => {
    return calculateCoreThreeScorecards(projectFilteredRecords);
  }, [projectFilteredRecords]);

  // Compute standard scorecard for PDF/Excel exports
  const activeKpiName =
    activePillar === 'IQAMA'
      ? 'IQAMA STATUS'
      : activePillar === 'AJEER'
      ? 'AJEER EXPIRY'
      : activePillar === 'HEALTH'
      ? 'HEALTH CARD EXPIRY'
      : 'COMPLIANCE';

  const exportScorecard = useMemo(() => {
    return calculateScorecardForElement(projectFilteredRecords, activeKpiName);
  }, [projectFilteredRecords, activeKpiName]);

  const exportSubProjectBreakdown = useMemo(() => {
    return calculateSubProjectBreakdown(projectFilteredRecords, activeKpiName);
  }, [projectFilteredRecords, activeKpiName]);

  const exportHierarchicalBreakdown = useMemo(() => {
    return calculateHierarchicalBreakdown(projectFilteredRecords, activeKpiName);
  }, [projectFilteredRecords, activeKpiName]);

  // Export handlers
  const handleExportPdf = () => {
    if (!portalData) return;
    exportPdfReport({
      projectName: activeProject === 'ALL' ? 'All_Projects' : activeProject,
      subProjectName: activeSubProject,
      activeKpi: activeKpiName,
      records: projectFilteredRecords,
      visibleColumns: portalData.visibleColumns || [],
      scorecard: exportScorecard,
      subProjectBreakdown: exportSubProjectBreakdown,
      hierarchy: exportHierarchicalBreakdown,
      lastSyncedAt: portalData.lastSyncedAt,
    });
  };

  const handleExportExcel = () => {
    if (!portalData) return;
    exportExcelReport({
      projectName: activeProject === 'ALL' ? 'All_Projects' : activeProject,
      subProjectName: activeSubProject,
      activeKpi: activeKpiName,
      records: projectFilteredRecords,
      visibleColumns: portalData.visibleColumns || [],
      scorecard: exportScorecard,
      subProjectBreakdown: exportSubProjectBreakdown,
      hierarchy: exportHierarchicalBreakdown,
      lastSyncedAt: portalData.lastSyncedAt,
    });
  };

  // If loading
  if (loading && !portalData) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="text-center">
          <div className="w-12 h-12 rounded-xl bg-slate-900 text-emerald-400 flex items-center justify-center mx-auto mb-3 animate-spin">
            <RefreshCw className="w-6 h-6" />
          </div>
          <h2 className="font-display font-bold text-slate-800 text-base">
            Loading Client Compliance Portal
          </h2>
          <p className="text-xs text-slate-500 mt-1">Connecting to SQLite database...</p>
        </div>
      </div>
    );
  }

  // If error (e.g. invalid share link)
  if (error && !portalData) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-xl border border-slate-200 p-8 text-center">
          <div className="w-12 h-12 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center mx-auto mb-4 border border-rose-200">
            <ShieldAlert className="w-6 h-6" />
          </div>
          <h2 className="font-display font-bold text-slate-900 text-lg mb-1">
            Access Restricted
          </h2>
          <p className="text-xs text-slate-500 mb-6 leading-relaxed">{error}</p>
          <a
            href="/"
            className="inline-flex items-center gap-2 px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-semibold transition-colors"
          >
            <span>Return to Portal</span>
          </a>
        </div>
      </div>
    );
  }

  const isClientMode = portalData?.mode === 'client_link';
  const isAdminLoggedIn = Boolean(adminPin);

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans text-slate-900">
      {/* Top Bar Navigation (Clean, Client-Centric) */}
      <TopBar
        mode={portalData?.mode || 'public'}
        linkMeta={portalData?.linkMeta}
        activeProject={activeProject}
        activeSubProject={activeSubProject}
        projects={allProjects}
        onSelectProject={(proj) => {
          setActiveProject(proj);
          setActiveSubProject('ALL');
        }}
        lastSyncedAt={portalData?.lastSyncedAt || null}
        isAdminLoggedIn={isAdminLoggedIn}
        onExportPdf={handleExportPdf}
        onExportExcel={handleExportExcel}
        onOpenAdminModal={() => setIsAdminModalOpen(true)}
        onOpenSyncModal={() => setIsSyncModalOpen(true)}
        onAdminLogout={handleAdminLogout}
      />

      {/* Main Viewport Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {/* Scope Context Banner (Client Friendly) */}
        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center justify-center font-bold text-xs">
              ✓
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="font-display font-bold text-sm text-slate-900">
                  {isClientMode
                    ? portalData?.linkMeta?.client_label
                    : activeProject === 'ALL'
                    ? 'All Corporate Client Projects'
                    : `Project: ${activeProject}`}
                </h1>
                <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                  Active Personnel Only
                </span>
              </div>
              <p className="text-[11px] text-slate-500 mt-0.5">
                Monitoring compliance eligibility for active workforce across Iqama, Ajeer, and Health Card.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <div className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs flex items-center gap-2">
              <Users className="w-3.5 h-3.5 text-slate-500" />
              <span className="text-slate-500">Active Workforce:</span>
              <strong className="font-mono text-slate-900 tabular-nums">
                {projectFilteredRecords.length} Employees
              </strong>
            </div>
          </div>
        </div>

        {/* 3 DEDICATED SCORECARDS (Iqama, Ajeer, Health Card) */}
        <ClientKpiStrip
          scorecards={coreScorecards}
          activePillar={activePillar}
          onSelectPillar={(pillar) => setActivePillar(pillar)}
          selectedStatus={selectedStatus}
          onSelectStatus={(status) => setSelectedStatus(status)}
        />

        {/* TOP SECTION: Sub-Project & Work Site Compliance Progress */}
        <SubProjectOverviewGrid
          records={projectFilteredRecords}
          activeProject={activeProject}
          activeSubProject={activeSubProject}
          onSelectSubProject={(subName) => setActiveSubProject(subName)}
          activePillar={activePillar}
        />

        {/* BOTTOM SECTION: Detailed Employee Compliance Status Roster */}
        <EmployeeComplianceRoster
          records={projectFilteredRecords}
          activeProject={activeProject}
          activeSubProject={activeSubProject}
          activePillar={activePillar}
          selectedStatus={selectedStatus}
          onSelectStatus={(status) => setSelectedStatus(status)}
          onClearSubProjectFilter={() => setActiveSubProject('ALL')}
        />
      </main>

      {/* Footer (Clean & Discreet Admin Trigger) */}
      <footer className="mt-auto border-t border-slate-200 bg-white py-6 text-xs text-slate-400">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span>Zawitco Legal · Client Compliance Portal &amp; Automated KPI Engine</span>
            <span>·</span>
            <span className="text-slate-500">Confidential &amp; Proprietary</span>
          </div>

          <div className="flex items-center gap-4">
            {isAdminLoggedIn ? (
              <div className="flex items-center gap-2 text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-md border border-emerald-200 text-[11px] font-medium">
                <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                <span>Admin Authenticated</span>
                <button
                  onClick={handleAdminLogout}
                  className="ml-1 text-emerald-800 hover:text-emerald-950 font-bold underline cursor-pointer"
                >
                  Exit
                </button>
              </div>
            ) : (
              /* Discrete, hidden Staff Admin Trigger */
              <button
                onClick={() => {
                  setPinPurpose('admin_center');
                  setIsPinModalOpen(true);
                }}
                className="text-slate-400 hover:text-slate-600 text-[11px] flex items-center gap-1.5 transition-colors cursor-pointer select-none"
                title="Staff PIN Authentication · Shortcut: Ctrl+Shift+A"
              >
                <Lock className="w-3 h-3 text-slate-400" />
                <span>Staff Access</span>
              </button>
            )}
          </div>
        </div>
      </footer>

      {/* Modals */}
      <PinModal
        isOpen={isPinModalOpen}
        onClose={() => setIsPinModalOpen(false)}
        onSuccess={handlePinSuccess}
        title={
          pinPurpose === 'portal_unlock'
            ? 'Master Portal Locked'
            : 'Staff PIN Authentication'
        }
        description={
          pinPurpose === 'portal_unlock'
            ? 'The master portal is currently secured. Enter your 6-digit Admin PIN to view project data.'
            : 'Enter 6-digit Admin PIN to access administrative management and data synchronization.'
        }
      />

      <ShareLinkModal
        isOpen={isShareModalOpen}
        onClose={() => setIsShareModalOpen(false)}
        adminPin={adminPin}
        projects={allProjects}
        subProjectsByProject={subProjectsByProject}
        sheetTabs={portalData?.sheetTabs || []}
        initialProject={activeProject}
        onRequestPin={() => {
          setIsShareModalOpen(false);
          setPinPurpose('share_link');
          setIsPinModalOpen(true);
        }}
        onLinkCreated={() => {
          loadPortalData();
        }}
      />

      <AdminModal
        isOpen={isAdminModalOpen}
        onClose={() => setIsAdminModalOpen(false)}
        adminPin={adminPin}
        projects={allProjects}
        subProjectsByProject={subProjectsByProject}
        portalData={portalData}
        onConfigUpdated={() => {
          loadPortalData();
        }}
      />

      <SyncModal
        isOpen={isSyncModalOpen}
        onClose={() => setIsSyncModalOpen(false)}
        adminPin={adminPin}
        portalData={portalData}
        onDataUpdated={(newData) => {
          setPortalData(newData);
          showToast('success', `Loaded ${newData.records?.length || 0} records into portal.`);
        }}
        onRequestPin={() => {
          setIsSyncModalOpen(false);
          setPinPurpose('sync');
          setIsPinModalOpen(true);
        }}
      />

      {/* Floating In-App Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 animate-in slide-in-from-bottom duration-200">
          <div
            className={`px-4 py-3 rounded-xl shadow-xl border text-xs font-medium flex items-center gap-3 max-w-md ${
              toastMessage.type === 'success'
                ? 'bg-emerald-950 text-emerald-100 border-emerald-700/80 shadow-emerald-950/20'
                : toastMessage.type === 'error'
                ? 'bg-rose-950 text-rose-100 border-rose-700/80 shadow-rose-950/20'
                : 'bg-slate-900 text-slate-100 border-slate-700 shadow-slate-950/20'
            }`}
          >
            <span>{toastMessage.text}</span>
            <button
              onClick={() => setToastMessage(null)}
              className="ml-auto text-slate-400 hover:text-white p-1 cursor-pointer"
            >
              ×
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
