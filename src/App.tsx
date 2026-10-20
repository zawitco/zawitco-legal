import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  PortalDataResponse,
  KPIStatus,
  RecordItemData,
  ShareLinkItem,
} from './types';
import {
  calculateScorecardForElement,
  calculateSubProjectBreakdown,
  calculateHierarchicalBreakdown,
} from './utils/kpiEngine';
import { exportPdfReport, exportExcelReport } from './utils/reportExport';
import { TopBar } from './components/TopBar';
import { KPICardStrip } from './components/KPICardStrip';
import { KPISelectorBar } from './components/KPISelectorBar';
import { SubProjectMatrix } from './components/SubProjectMatrix';
import { DataTable } from './components/DataTable';
import { PinModal } from './components/PinModal';
import { ShareLinkModal } from './components/ShareLinkModal';
import { AdminModal } from './components/AdminModal';
import {
  Layers,
  ShieldAlert,
  Lock,
  Building,
  RefreshCw,
  Users,
  ChevronDown,
  ChevronUp,
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

  // Filters
  const [activeTab, setActiveTab] = useState<string>('ALL');
  const [activeProject, setActiveProject] = useState<string>('ALL');
  const [activeSubProject, setActiveSubProject] = useState<string>('ALL');
  const [activeKpi, setActiveKpi] = useState<string>('AJEER');
  const [selectedStatus, setSelectedStatus] = useState<KPIStatus | 'ALL'>('ALL');
  const [isEmployeeRosterOpen, setIsEmployeeRosterOpen] = useState(false);

  // Modals
  const [isPinModalOpen, setIsPinModalOpen] = useState(false);
  const [pinPurpose, setPinPurpose] = useState<
    'portal_unlock' | 'admin_center' | 'share_link' | 'sync'
  >('portal_unlock');
  const [isAdminModalOpen, setIsAdminModalOpen] = useState(false);
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);

  // Read URL query parameter for token on boot
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const t = params.get('token');
    if (t) {
      setToken(t);
    }
  }, []);

  // Fetch portal data
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

      // 1. Try server API endpoint
      try {
        const res = await fetch(url, { headers });
        if (res.status === 401) {
          const pinData = await res.json().catch(() => ({}));
          if (pinData.requiresPin) {
            setIsPinModalOpen(true);
            setPinPurpose('portal_unlock');
            setLoading(false);
            return;
          }
        }
        if (res.ok) {
          const contentType = res.headers.get('content-type') || '';
          if (contentType.includes('application/json')) {
            data = await res.json();
          }
        }
      } catch (_) {
        // Backend API not reachable (e.g. GitHub Pages static hosting)
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
              const parsed = await staticRes.json();
              if (parsed && Array.isArray(parsed.records)) {
                data = parsed;
                break;
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
        // Check if token matches a project name or client label
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

      // Initialize default active KPI if available
      if (data.kpiElements && data.kpiElements.length > 0) {
        const preferred = data.kpiElements.find(
          (k: string) => /ajeer/i.test(k) || /health/i.test(k)
        );
        setActiveKpi(preferred || data.kpiElements[0]);
      }

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

  // Handle Sync
  const handleSyncNow = async () => {
    if (!adminPin) {
      setPinPurpose('sync');
      setIsPinModalOpen(true);
      return;
    }

    setIsSyncing(true);
    try {
      const res = await fetch('/api/sync', {
        method: 'POST',
        headers: { 'x-admin-pin': adminPin },
      });
      const data = await res.json();
      if (res.ok && data.success) {
        await loadPortalData();
      } else {
        alert(data.error || 'Sync failed.');
      }
    } catch (err: any) {
      alert('Sync network error: ' + err.message);
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
    loadPortalData('');
  };

  // Derive unique project and sub-project lists
  const { allProjects, subProjectsByProject, sheetTabs } = useMemo(() => {
    if (!portalData || !portalData.records) {
      return { allProjects: [], subProjectsByProject: {}, sheetTabs: [] };
    }

    const projectsSet = new Set<string>();
    const subProjMap: Record<string, Set<string>> = {};
    const tabsSet = new Set<string>();

    for (const rec of portalData.records) {
      if (rec.sheet_tab) tabsSet.add(rec.sheet_tab);
      const proj = (rec.data['PROJECT NAME'] || rec.data['PROJECT'] || rec.project_name || 'Unassigned').trim();
      projectsSet.add(proj);

      if (!subProjMap[proj]) subProjMap[proj] = new Set();
      const subProj = (rec.data['SUB PROJECT'] || rec.data['SUB PROJECTS'] || rec.sub_project_name || '').trim();
      if (subProj && subProj !== 'MAIN') {
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
      sheetTabs: portalData.sheetTabs || Array.from(tabsSet),
    };
  }, [portalData]);

  // Filter records by Master Tab, Project, and Sub-Project
  const hierarchyFilteredRecords = useMemo(() => {
    if (!portalData || !portalData.records) return [];

    return portalData.records.filter((rec) => {
      // 1. Tab filter (Master mode)
      if (portalData.mode !== 'client_link' && activeTab !== 'ALL') {
        if (rec.sheet_tab !== activeTab) return false;
      }

      const recProj = (rec.data['PROJECT NAME'] || rec.data['PROJECT'] || rec.project_name || '').trim();
      const recSub = (rec.data['SUB PROJECT'] || rec.data['SUB PROJECTS'] || rec.sub_project_name || '').trim();

      // 2. Project filter
      if (activeProject !== 'ALL') {
        if (recProj !== activeProject) return false;
      }

      // 3. Sub-Project filter
      if (activeSubProject !== 'ALL') {
        if (recSub !== activeSubProject) return false;
      }

      // 4. Strict status filter: only show Employees whose STATUS field is active
      const statusKey = Object.keys(rec.data).find((k) => k.trim().toUpperCase() === 'STATUS');
      if (statusKey) {
        const val = (rec.data[statusKey] || '').trim().toUpperCase();
        if (val && val !== 'ACTIVE') return false;
      }

      return true;
    });
  }, [portalData, activeTab, activeProject, activeSubProject]);

  // Compute KPI Scorecard and Sub-Project matrix
  const scorecard = useMemo(() => {
    return calculateScorecardForElement(hierarchyFilteredRecords, activeKpi);
  }, [hierarchyFilteredRecords, activeKpi]);

  const subProjectBreakdown = useMemo(() => {
    return calculateSubProjectBreakdown(hierarchyFilteredRecords, activeKpi);
  }, [hierarchyFilteredRecords, activeKpi]);

  // Compute Hierarchical Breakdown across projects & sub-projects
  const hierarchicalBreakdown = useMemo(() => {
    if (!portalData || !portalData.records) return [];

    // Filter by Tab (if not in client share link mode)
    const tabFiltered = portalData.records.filter((rec) => {
      if (portalData.mode !== 'client_link' && activeTab !== 'ALL') {
        if (rec.sheet_tab !== activeTab) return false;
      }
      // Strict status filter: active only
      const statusKey = Object.keys(rec.data).find((k) => k.trim().toUpperCase() === 'STATUS');
      if (statusKey) {
        const val = (rec.data[statusKey] || '').trim().toUpperCase();
        if (val && val !== 'ACTIVE') return false;
      }
      return true;
    });

    return calculateHierarchicalBreakdown(tabFiltered, activeKpi);
  }, [portalData, activeTab, activeKpi]);

  // Export handlers
  const handleExportPdf = () => {
    if (!portalData) return;
    exportPdfReport({
      projectName: activeProject === 'ALL' ? 'All_Projects' : activeProject,
      subProjectName: activeSubProject,
      activeKpi,
      records: hierarchyFilteredRecords,
      visibleColumns: portalData.visibleColumns || [],
      scorecard,
      subProjectBreakdown,
      hierarchy: hierarchicalBreakdown,
      lastSyncedAt: portalData.lastSyncedAt,
    });
  };

  const handleExportExcel = () => {
    if (!portalData) return;
    exportExcelReport({
      projectName: activeProject === 'ALL' ? 'All_Projects' : activeProject,
      subProjectName: activeSubProject,
      activeKpi,
      records: hierarchyFilteredRecords,
      visibleColumns: portalData.visibleColumns || [],
      scorecard,
      subProjectBreakdown,
      hierarchy: hierarchicalBreakdown,
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
            Loading Client Portal &amp; KPI Engine
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
            <span>Return to Master Portal</span>
          </a>
        </div>
      </div>
    );
  }

  const isClientMode = portalData?.mode === 'client_link';
  const isAdminLoggedIn = Boolean(adminPin);

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans text-slate-900">
      {/* Top Bar Navigation */}
      <TopBar
        mode={portalData?.mode || 'public'}
        linkMeta={portalData?.linkMeta}
        activeProject={activeProject}
        activeSubProject={activeSubProject}
        lastSyncedAt={portalData?.lastSyncedAt || null}
        isSyncing={isSyncing}
        isAdminLoggedIn={isAdminLoggedIn}
        onSync={handleSyncNow}
        onExportPdf={handleExportPdf}
        onExportExcel={handleExportExcel}
        onOpenShareModal={() => {
          if (!adminPin) {
            setPinPurpose('share_link');
            setIsPinModalOpen(true);
          } else {
            setIsShareModalOpen(true);
          }
        }}
        onOpenAdminModal={() => {
          if (!adminPin) {
            setPinPurpose('admin_center');
            setIsPinModalOpen(true);
          } else {
            setIsAdminModalOpen(true);
          }
        }}
        onOpenPinModal={() => {
          setPinPurpose('admin_center');
          setIsPinModalOpen(true);
        }}
        onAdminLogout={handleAdminLogout}
      />

      {/* Main Viewport Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {/* Header Banner & Breadcrumb Filters */}
        <div className="space-y-4">
          {/* Master View Hierarchy Navigation */}
          {!isClientMode ? (
            <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-[0_1px_2px_rgba(0,0,0,0.03)] space-y-3">
              {/* Sheet Category Tabs */}
              <div className="flex items-center justify-between flex-wrap gap-2 pb-3 border-b border-slate-100">
                <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none">
                  <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider px-1 shrink-0 flex items-center gap-1">
                    <Layers className="w-3.5 h-3.5" /> Source Sheet:
                  </span>
                  <button
                    onClick={() => {
                      setActiveTab('ALL');
                      setActiveProject('ALL');
                      setActiveSubProject('ALL');
                    }}
                    className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors cursor-pointer shrink-0 ${
                      activeTab === 'ALL'
                        ? 'bg-slate-900 text-white font-semibold shadow-xs'
                        : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                    }`}
                  >
                    All Tabs ({portalData?.records.length || 0})
                  </button>
                  {sheetTabs.map((tab) => {
                    const tabCount = (portalData?.records || []).filter(
                      (r) => r.sheet_tab === tab
                    ).length;

                    return (
                      <button
                        key={tab}
                        onClick={() => {
                          setActiveTab(tab);
                          setActiveProject('ALL');
                          setActiveSubProject('ALL');
                        }}
                        className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors cursor-pointer shrink-0 ${
                          activeTab === tab
                            ? 'bg-slate-900 text-white font-semibold shadow-xs'
                            : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                        }`}
                      >
                        <span>{tab}</span>
                        <span className="ml-1.5 font-mono text-[10px] opacity-75 tabular-nums">
                          ({tabCount})
                        </span>
                      </button>
                    );
                  })}
                </div>

                <div className="text-[11px] text-slate-400 font-medium">
                  {portalData?.records.length || 0} total synchronized records
                </div>
              </div>

              {/* Project & Sub-Project Dropdowns */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 pt-1">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1">
                    Select Project
                  </label>
                  <select
                    value={activeProject}
                    onChange={(e) => {
                      setActiveProject(e.target.value);
                      setActiveSubProject('ALL');
                    }}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-900/10 cursor-pointer"
                  >
                    <option value="ALL">All Projects (Combined View)</option>
                    {allProjects.map((p) => (
                      <option key={p} value={p}>
                        {p}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1">
                    Filter Sub-Project / Location
                  </label>
                  <select
                    value={activeSubProject}
                    onChange={(e) => setActiveSubProject(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-900/10 cursor-pointer"
                  >
                    <option value="ALL">All Sub-Projects / Sites</option>
                    {(subProjectsByProject[activeProject] || []).map((sp) => (
                      <option key={sp} value={sp}>
                        {sp}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex items-end">
                  <div className="w-full px-3 py-2 bg-emerald-50/60 border border-emerald-200/80 rounded-lg text-xs text-emerald-900 flex items-center justify-between">
                    <span className="flex items-center gap-1.5 font-semibold">
                      <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                      <span>Active Workforce Only:</span>
                    </span>
                    <strong className="font-mono tabular-nums text-emerald-950 font-bold">
                      {hierarchyFilteredRecords.length} Active Employees
                    </strong>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            /* Client Locked View Header */
            <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-[0_1px_2px_rgba(0,0,0,0.03)] flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                  <span className="text-xs font-semibold text-emerald-800 uppercase tracking-wider">
                    Client Share Access Active
                  </span>
                </div>
                <h1 className="font-display font-bold text-xl text-slate-900">
                  {portalData.linkMeta?.client_label}
                </h1>
                <p className="text-xs text-slate-500 mt-0.5">
                  Project: <strong className="text-slate-800">{activeProject}</strong>
                  {activeSubProject !== 'ALL' && (
                    <>
                      {' '}
                      · Location: <strong className="text-slate-800">{activeSubProject}</strong>
                    </>
                  )}
                </p>
              </div>

              {/* Sub-Project selector if client link allows ALL sub-projects */}
              {portalData.linkMeta?.sub_project_name === 'ALL' &&
                (subProjectsByProject[activeProject] || []).length > 0 && (
                  <div className="w-full md:w-64">
                    <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1">
                      Filter Sub-Project Location:
                    </label>
                    <select
                      value={activeSubProject}
                      onChange={(e) => setActiveSubProject(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-900/10 cursor-pointer"
                    >
                      <option value="ALL">All Sub-Projects</option>
                      {(subProjectsByProject[activeProject] || []).map((sp) => (
                        <option key={sp} value={sp}>
                          {sp}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
            </div>
          )}
        </div>

        {/* Top Interactive KPI Cards */}
        <KPICardStrip
          scorecard={scorecard}
          selectedStatus={selectedStatus}
          onSelectStatus={(status) => setSelectedStatus(status)}
        />

        {/* KPI Element Selector Bar */}
        {portalData?.kpiElements && portalData.kpiElements.length > 0 && (
          <KPISelectorBar
            kpiElements={portalData.kpiElements}
            activeKpi={activeKpi}
            onSelectKpi={(kpi) => setActiveKpi(kpi)}
            filteredRecords={hierarchyFilteredRecords}
          />
        )}

        {/* Sub-Project Compliance Breakdown Matrix */}
        <SubProjectMatrix
          hierarchy={hierarchicalBreakdown}
          activeProject={activeProject}
          activeSubProject={activeSubProject}
          onSelectProject={(proj) => {
            setActiveProject(proj);
            setActiveSubProject('ALL');
          }}
          onSelectSubProject={(proj, sub) => {
            setActiveProject(proj);
            setActiveSubProject(sub);
          }}
          activeKpi={activeKpi}
        />

        {/* Collapsible Detailed Employee Roster */}
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-[0_1px_2px_rgba(0,0,0,0.03)]">
          <div
            onClick={() => setIsEmployeeRosterOpen(!isEmployeeRosterOpen)}
            className="px-5 py-3.5 bg-gradient-to-r from-slate-50 to-slate-100/60 hover:bg-slate-100/90 border-b border-slate-200 flex items-center justify-between cursor-pointer transition-colors"
          >
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-slate-900 text-white flex items-center justify-center shrink-0">
                <Users className="w-4 h-4 text-emerald-400" />
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h4 className="font-display font-bold text-xs uppercase tracking-wider text-slate-900">
                    Detailed Employee Roster (Active Workforce Only)
                  </h4>
                  <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200/80 font-mono tabular-nums">
                    {hierarchyFilteredRecords.length} Active Records
                  </span>
                  {activeProject !== 'ALL' && (
                    <span className="text-[10px] font-medium text-slate-500 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                      Filter: {activeProject} {activeSubProject !== 'ALL' ? `· ${activeSubProject}` : ''}
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Drill-down inspection of approved columns for active personnel. Inactive and terminated employees are excluded.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                className="px-3 py-1.5 rounded-lg bg-white border border-slate-200 hover:border-slate-300 text-xs font-semibold text-slate-700 shadow-xs flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <span>{isEmployeeRosterOpen ? 'Hide Individual Roster' : 'Show Individual Roster'}</span>
                {isEmployeeRosterOpen ? (
                  <ChevronUp className="w-3.5 h-3.5 text-slate-500" />
                ) : (
                  <ChevronDown className="w-3.5 h-3.5 text-slate-500" />
                )}
              </button>
            </div>
          </div>

          {isEmployeeRosterOpen && (
            <div className="p-4 bg-slate-50/50">
              <DataTable
                records={hierarchyFilteredRecords}
                visibleColumns={portalData?.visibleColumns || []}
                activeKpi={activeKpi}
                selectedStatus={selectedStatus}
                onSelectStatus={(status) => setSelectedStatus(status)}
                projectColumn={portalData?.projectColumn || 'PROJECT'}
                subProjectColumn={portalData?.subProjectColumn || 'SUB PROJECTS'}
              />
            </div>
          )}
        </div>
      </main>

      {/* Footer */}
      <footer className="mt-auto border-t border-slate-200 bg-white py-6 text-center text-xs text-slate-400">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-3">
          <span>
            Zawitco Legal · Multi-Project Client Portal &amp; Automated KPI Scorecard Engine
          </span>
          <div className="flex items-center gap-4 text-slate-500">
            <span>Confidential &amp; Proprietary</span>
            <span>·</span>
            <span className="font-mono tabular-nums">
              Database: SQLite (portal_data.db)
            </span>
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
            : 'Admin PIN Verification'
        }
        description={
          pinPurpose === 'portal_unlock'
            ? 'The master portal is currently secured. Enter your 6-digit Admin PIN to view project data.'
            : 'Enter Admin PIN to authenticate administrative operations.'
        }
      />

      <ShareLinkModal
        isOpen={isShareModalOpen}
        onClose={() => setIsShareModalOpen(false)}
        adminPin={adminPin}
        projects={allProjects}
        subProjectsByProject={subProjectsByProject}
        sheetTabs={sheetTabs}
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
    </div>
  );
}
