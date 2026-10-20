import React, { useState, useEffect } from 'react';
import {
  X,
  Share2,
  Columns,
  Activity,
  Settings,
  Trash2,
  Copy,
  Check,
  ExternalLink,
  ShieldAlert,
  Save,
  CheckCircle2,
  AlertCircle,
  Plus,
  Lock,
} from 'lucide-react';
import { AdminConfigData, ShareLinkItem, PortalDataResponse } from '../types';

interface AdminModalProps {
  isOpen: boolean;
  onClose: () => void;
  adminPin: string;
  projects: string[];
  subProjectsByProject: Record<string, string[]>;
  portalData?: PortalDataResponse | null;
  onConfigUpdated: () => void;
}

const DEFAULT_SPREADSHEET_ID = '1NqVnp2VLJ0Hgd2-sbYHCtSqmi3udjeFjOHD-wCDGDbA';
const DEFAULT_SHEET_TABS = ['Projects - A', 'Projects - B', 'Projects - C'];
const DEFAULT_PIN = '123456';

export const AdminModal: React.FC<AdminModalProps> = ({
  isOpen,
  onClose,
  adminPin,
  projects,
  subProjectsByProject,
  portalData,
  onConfigUpdated,
}) => {
  const [activeTab, setActiveTab] = useState<'links' | 'columns' | 'kpis' | 'settings'>('links');
  const [config, setConfig] = useState<AdminConfigData | null>(null);
  const [links, setLinks] = useState<ShareLinkItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [toastMessage, setToastMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Form states for Settings tab
  const [spreadsheetId, setSpreadsheetId] = useState(DEFAULT_SPREADSHEET_ID);
  const [sheetTabsStr, setSheetTabsStr] = useState(DEFAULT_SHEET_TABS.join(', '));
  const [newAdminPin, setNewAdminPin] = useState(adminPin || DEFAULT_PIN);
  const [serviceAccountStr, setServiceAccountStr] = useState('');
  const [lockMainPortal, setLockMainPortal] = useState(false);

  // Form states for Column / KPI controllers
  const [visibleCols, setVisibleCols] = useState<string[]>([]);
  const [kpiCols, setKpiCols] = useState<string[]>([]);
  const [projectCol, setProjectCol] = useState('PROJECT');
  const [subProjectCol, setSubProjectCol] = useState('SUB PROJECTS');

  // Form state for creating link inside Links tab
  const [linkProject, setLinkProject] = useState('');
  const [linkSubProject, setLinkSubProject] = useState('ALL');
  const [linkTab, setLinkTab] = useState('ALL');
  const [linkLabel, setLinkLabel] = useState('');
  const [copiedToken, setCopiedToken] = useState<string | null>(null);

  // Derive all unique columns so Column Controller is never 0/0
  const allCols = React.useMemo(() => {
    if (config?.all_columns && config.all_columns.length > 0) {
      return config.all_columns;
    }
    const colsSet = new Set<string>();
    if (portalData?.records) {
      for (const rec of portalData.records.slice(0, 40)) {
        if (rec.data) {
          Object.keys(rec.data).forEach((k) => colsSet.add(k));
        }
      }
    }
    if (portalData?.visibleColumns) {
      portalData.visibleColumns.forEach((c) => colsSet.add(c));
    }
    if (portalData?.kpiElements) {
      portalData.kpiElements.forEach((c) => colsSet.add(c));
    }
    if (colsSet.size > 0) {
      return Array.from(colsSet);
    }
    return [
      'EMPLOYEE NAME', 'ERP ID', 'START WORK', 'SPONSORSHIP', 'MEDICAL TEST',
      'HEALTH CARD NUMBER', 'HEALTH CARD EXPIRY', 'MUQEEM', 'AJEER', 'AJEER EXPIRY',
      'NATIONALITY', 'IQAMA NO', 'PROJECT', 'PROJECT NAME', 'STATUS', 'SUB PROJECT',
      'SUB PROJECTS', 'DESIGNATION', 'IQAMA STATUS', 'BRANCH'
    ];
  }, [config, portalData]);

  useEffect(() => {
    if (isOpen) {
      loadAdminData();
    }
  }, [isOpen, adminPin]);

  const showToast = (type: 'success' | 'error', text: string) => {
    setToastMessage({ type, text });
    setTimeout(() => setToastMessage(null), 3500);
  };

  const loadAdminData = async () => {
    setLoading(true);
    try {
      let cfg: AdminConfigData | null = null;
      let loadedLinks: ShareLinkItem[] = [];

      // 1. Attempt API fetch
      try {
        const configRes = await fetch('/api/admin/config', {
          headers: { 'x-admin-pin': adminPin || DEFAULT_PIN },
        });
        if (configRes.ok) {
          const contentType = configRes.headers.get('content-type') || '';
          if (contentType.includes('application/json')) {
            cfg = await configRes.json();
          }
        }
      } catch (_) {
        // Backend unavailable (e.g. GitHub Pages static host)
      }

      // Check localStorage if API unavailable
      if (!cfg) {
        const savedLocal = localStorage.getItem('portal_admin_config');
        if (savedLocal) {
          try { cfg = JSON.parse(savedLocal); } catch (_) {}
        }
      }

      // Fallback to portalData or safe defaults
      const effectiveSpreadsheetId = cfg?.spreadsheet_id || DEFAULT_SPREADSHEET_ID;
      const effectiveTabs = cfg?.sheet_tabs?.length ? cfg.sheet_tabs : (portalData?.sheetTabs || DEFAULT_SHEET_TABS);
      const effectivePin = cfg?.admin_pin || adminPin || DEFAULT_PIN;
      const effectiveVisible = cfg?.visible_columns?.length
        ? cfg.visible_columns
        : (portalData?.visibleColumns?.length
            ? portalData.visibleColumns
            : [
                'EMPLOYEE NAME', 'ERP ID', 'START WORK', 'MEDICAL TEST',
                'HEALTH CARD NUMBER', 'HEALTH CARD EXPIRY', 'MUQEEM', 'AJEER',
                'AJEER EXPIRY', 'NATIONALITY', 'IQAMA NO', 'PROJECT', 'PROJECT NAME',
                'STATUS', 'SUB PROJECT', 'SUB PROJECTS', 'DESIGNATION', 'IQAMA STATUS', 'BRANCH'
              ]);
      const effectiveKpis = cfg?.kpi_elements?.length
        ? cfg.kpi_elements
        : (portalData?.kpiElements?.length
            ? portalData.kpiElements
            : ['SPONSORSHIP', 'MEDICAL TEST', 'HEALTH CARD NUMBER', 'HEALTH CARD EXPIRY', 'MUQEEM', 'AJEER', 'AJEER EXPIRY', 'STATUS', 'IQAMA STATUS']);
      const effectiveProjectCol = cfg?.project_column || portalData?.projectColumn || 'PROJECT';
      const effectiveSubProjectCol = cfg?.sub_project_column || portalData?.subProjectColumn || 'SUB PROJECTS';
      const effectiveSa = cfg?.service_account_json || localStorage.getItem('admin_service_account_json') || '';

      const effectiveCfg: AdminConfigData = {
        spreadsheet_id: effectiveSpreadsheetId,
        sheet_tabs: effectiveTabs,
        admin_pin: effectivePin,
        lock_main_portal: cfg?.lock_main_portal !== undefined ? Boolean(cfg.lock_main_portal) : Boolean(portalData?.lockMainPortal),
        all_columns: cfg?.all_columns?.length ? cfg.all_columns : allCols,
        visible_columns: effectiveVisible,
        kpi_elements: effectiveKpis,
        project_column: effectiveProjectCol,
        sub_project_column: effectiveSubProjectCol,
        last_synced_at: cfg?.last_synced_at || portalData?.lastSyncedAt || new Date().toISOString(),
        last_sync_count: cfg?.last_sync_count || (portalData?.records ? portalData.records.length : 0),
        service_account_json: effectiveSa,
      };

      setConfig(effectiveCfg);
      setSpreadsheetId(effectiveSpreadsheetId);
      setSheetTabsStr(effectiveTabs.join(', '));
      setNewAdminPin(effectivePin);
      setServiceAccountStr(effectiveSa);
      setLockMainPortal(Boolean(effectiveCfg.lock_main_portal));
      setVisibleCols(effectiveVisible);
      setKpiCols(effectiveKpis);
      setProjectCol(effectiveProjectCol);
      setSubProjectCol(effectiveSubProjectCol);

      if (projects.length > 0 && !linkProject) {
        setLinkProject(projects[0]);
      }

      // 2. Load Share Links
      try {
        const linksRes = await fetch('/api/admin/share-links', {
          headers: { 'x-admin-pin': adminPin || DEFAULT_PIN },
        });
        if (linksRes.ok) {
          const contentType = linksRes.headers.get('content-type') || '';
          if (contentType.includes('application/json')) {
            loadedLinks = await linksRes.json();
          }
        }
      } catch (_) {}

      if (loadedLinks.length === 0) {
        const savedLinks = localStorage.getItem('portal_share_links');
        if (savedLinks) {
          try { loadedLinks = JSON.parse(savedLinks); } catch (_) {}
        }
      }
      setLinks(loadedLinks);
    } catch (e: any) {
      showToast('error', 'Failed to load configuration: ' + e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleResetDefaults = () => {
    setSpreadsheetId(DEFAULT_SPREADSHEET_ID);
    setSheetTabsStr(DEFAULT_SHEET_TABS.join(', '));
    setNewAdminPin(DEFAULT_PIN);
    showToast('success', 'Reset values to default spreadsheet settings.');
  };

  const handleSaveSettings = async () => {
    setSaving(true);
    try {
      const tabsArray = sheetTabsStr
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);

      const payload = {
        spreadsheet_id: spreadsheetId.trim() || DEFAULT_SPREADSHEET_ID,
        sheet_tabs: tabsArray.length > 0 ? tabsArray : DEFAULT_SHEET_TABS,
        admin_pin: newAdminPin.trim() || DEFAULT_PIN,
        lock_main_portal: lockMainPortal,
        visible_columns: visibleCols,
        kpi_elements: kpiCols,
        project_column: projectCol || 'PROJECT',
        sub_project_column: subProjectCol || 'SUB PROJECTS',
        service_account_json: serviceAccountStr,
        all_columns: allCols,
      };

      let savedToServer = false;
      try {
        const res = await fetch('/api/admin/config', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-admin-pin': adminPin || DEFAULT_PIN,
          },
          body: JSON.stringify(payload),
        });
        if (res.ok) {
          savedToServer = true;
        }
      } catch (_) {}

      // Always persist locally
      localStorage.setItem('portal_admin_config', JSON.stringify(payload));
      if (serviceAccountStr) {
        localStorage.setItem('admin_service_account_json', serviceAccountStr);
      }

      showToast(
        'success',
        savedToServer
          ? 'Configuration updated and synchronized with database!'
          : 'Configuration saved successfully!'
      );
      onConfigUpdated();
    } catch (e: any) {
      showToast('error', e.message);
    } finally {
      setSaving(false);
    }
  };

  const handleCreateLink = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!linkProject) {
      showToast('error', 'Please select a Project.');
      return;
    }

    try {
      let createdLink: ShareLinkItem | null = null;
      try {
        const res = await fetch('/api/admin/share-links', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-admin-pin': adminPin || DEFAULT_PIN,
          },
          body: JSON.stringify({
            project_name: linkProject,
            sub_project_name: linkSubProject,
            sheet_tab: linkTab,
            client_label: linkLabel.trim() || `Client Portal - ${linkProject}`,
          }),
        });

        if (res.ok) {
          createdLink = await res.json();
        }
      } catch (_) {}

      if (!createdLink) {
        // Fallback generator for static mode
        const token = 'link_' + Math.random().toString(36).substring(2, 9) + Date.now().toString(36);
        createdLink = {
          token,
          project_name: linkProject,
          sub_project_name: linkSubProject,
          sheet_tab: linkTab,
          client_label: linkLabel.trim() || `Client Portal - ${linkProject}`,
          created_at: new Date().toISOString(),
        };
      }

      const updated = [createdLink, ...links];
      setLinks(updated);
      localStorage.setItem('portal_share_links', JSON.stringify(updated));
      setLinkLabel('');
      showToast('success', `Share link created for ${linkProject}!`);
      onConfigUpdated();
    } catch (e: any) {
      showToast('error', e.message);
    }
  };

  const handleDeleteLink = async (token: string) => {
    if (!confirm('Are you sure you want to revoke and delete this share link?')) return;
    try {
      try {
        await fetch(`/api/admin/share-links/${token}`, {
          method: 'DELETE',
          headers: { 'x-admin-pin': adminPin || DEFAULT_PIN },
        });
      } catch (_) {}

      const updated = links.filter((l) => l.token !== token);
      setLinks(updated);
      localStorage.setItem('portal_share_links', JSON.stringify(updated));
      showToast('success', 'Link revoked.');
      onConfigUpdated();
    } catch (e: any) {
      showToast('error', e.message);
    }
  };

  const handleCopyLink = (token: string) => {
    const basePath = window.location.pathname.endsWith('/')
      ? window.location.pathname
      : window.location.pathname + '/';
    const url = `${window.location.origin}${basePath}?token=${encodeURIComponent(token)}`;
    navigator.clipboard.writeText(url);
    setCopiedToken(token);
    setTimeout(() => setCopiedToken(null), 2500);
  };

  if (!isOpen) return null;

  const currentSubProjects = subProjectsByProject[linkProject] || [];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-4xl w-full h-[88vh] flex flex-col overflow-hidden relative">
        {/* Modal Header */}
        <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-blue-500/20 text-blue-400 flex items-center justify-center">
              <Settings className="w-4 h-4" />
            </div>
            <div>
              <h2 className="font-display font-bold text-base">Admin Control Center</h2>
              <p className="text-xs text-slate-400">
                Manage Project Share Links, Visible Columns, KPI Scorecards, and Google Sheets Sync
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-lg transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center gap-1 px-6 border-b border-slate-200 bg-slate-50/70 shrink-0">
          <button
            onClick={() => setActiveTab('links')}
            className={`flex items-center gap-2 py-3 px-4 text-xs font-semibold border-b-2 transition-colors cursor-pointer ${
              activeTab === 'links'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            <Share2 className="w-3.5 h-3.5" />
            <span>1. Client Share Links</span>
            <span className="font-mono text-[10px] bg-slate-200 text-slate-700 px-1.5 py-0.2 rounded-full">
              {links.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('columns')}
            className={`flex items-center gap-2 py-3 px-4 text-xs font-semibold border-b-2 transition-colors cursor-pointer ${
              activeTab === 'columns'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            <Columns className="w-3.5 h-3.5" />
            <span>2. Column Controller</span>
            <span className="font-mono text-[10px] bg-slate-200 text-slate-700 px-1.5 py-0.2 rounded-full">
              {visibleCols.length}/{allCols.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('kpis')}
            className={`flex items-center gap-2 py-3 px-4 text-xs font-semibold border-b-2 transition-colors cursor-pointer ${
              activeTab === 'kpis'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            <Activity className="w-3.5 h-3.5" />
            <span>3. KPI Scorecards</span>
            <span className="font-mono text-[10px] bg-slate-200 text-slate-700 px-1.5 py-0.2 rounded-full">
              {kpiCols.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('settings')}
            className={`flex items-center gap-2 py-3 px-4 text-xs font-semibold border-b-2 transition-colors cursor-pointer ${
              activeTab === 'settings'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            <Settings className="w-3.5 h-3.5" />
            <span>4. Google Sheet &amp; PIN</span>
          </button>
        </div>

        {/* Toast alert */}
        {toastMessage && (
          <div
            className={`mx-6 mt-3 p-3 rounded-lg text-xs flex items-center gap-2 shrink-0 ${
              toastMessage.type === 'success'
                ? 'bg-emerald-50 border border-emerald-200 text-emerald-800'
                : 'bg-rose-50 border border-rose-200 text-rose-800'
            }`}
          >
            {toastMessage.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 shrink-0" />
            )}
            <span>{toastMessage.text}</span>
          </div>
        )}

        {/* Modal Tab Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="py-20 text-center text-slate-400 text-xs">
              Loading administration details...
            </div>
          ) : (
            <>
              {/* TAB 1: Client Share Links */}
              {activeTab === 'links' && (
                <div className="space-y-6">
                  {/* Create Link Box */}
                  <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/70">
                    <h3 className="font-display font-semibold text-xs text-slate-800 mb-3 flex items-center gap-2">
                      <Plus className="w-4 h-4 text-blue-600" />
                      <span>Create New Token-Based Client Link</span>
                    </h3>
                    <form onSubmit={handleCreateLink} className="grid grid-cols-1 md:grid-cols-4 gap-3">
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                          Project *
                        </label>
                        <select
                          value={linkProject}
                          onChange={(e) => {
                            setLinkProject(e.target.value);
                            setLinkSubProject('ALL');
                          }}
                          className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs"
                        >
                          {projects.map((p) => (
                            <option key={p} value={p}>
                              {p}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                          Sub-Project Scope
                        </label>
                        <select
                          value={linkSubProject}
                          onChange={(e) => setLinkSubProject(e.target.value)}
                          className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs"
                        >
                          <option value="ALL">ALL Sub-Projects</option>
                          {currentSubProjects.map((sp) => (
                            <option key={sp} value={sp}>
                              {sp}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                          Client Label
                        </label>
                        <input
                          type="text"
                          placeholder="e.g., Client Portal - Project Alpha"
                          value={linkLabel}
                          onChange={(e) => setLinkLabel(e.target.value)}
                          className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs"
                        />
                      </div>

                      <div className="flex items-end">
                        <button
                          type="submit"
                          className="w-full py-1.5 px-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold cursor-pointer shadow-sm transition-colors"
                        >
                          Generate Link
                        </button>
                      </div>
                    </form>
                  </div>

                  {/* List of Existing Share Links */}
                  <div>
                    <h3 className="font-display font-semibold text-xs text-slate-700 uppercase tracking-wider mb-2">
                      Active Shareable Client Links ({links.length})
                    </h3>
                    {links.length === 0 ? (
                      <div className="py-8 text-center text-slate-400 text-xs border border-dashed rounded-xl">
                        No share links generated yet. Use the form above to create one.
                      </div>
                    ) : (
                      <div className="border border-slate-200 rounded-xl overflow-hidden">
                        <table className="w-full text-left text-xs">
                          <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold uppercase text-[11px]">
                            <tr>
                              <th className="py-2.5 px-3">Client Label</th>
                              <th className="py-2.5 px-3">Locked Project</th>
                              <th className="py-2.5 px-3">Sub-Project</th>
                              <th className="py-2.5 px-3">Token</th>
                              <th className="py-2.5 px-3 text-right">Actions</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {links.map((link) => {
                              const url = `${window.location.origin}/?token=${link.token}`;
                              const isCopied = copiedToken === link.token;

                              return (
                                <tr key={link.token} className="hover:bg-slate-50/60">
                                  <td className="py-2.5 px-3 font-semibold text-slate-800">
                                    {link.client_label}
                                  </td>
                                  <td className="py-2.5 px-3 text-emerald-700 font-semibold">
                                    {link.project_name}
                                  </td>
                                  <td className="py-2.5 px-3 text-slate-600">
                                    {link.sub_project_name}
                                  </td>
                                  <td className="py-2.5 px-3 font-mono text-[11px] text-slate-500">
                                    {link.token.slice(0, 8)}...
                                  </td>
                                  <td className="py-2.5 px-3 text-right">
                                    <div className="flex items-center justify-end gap-1.5">
                                      <button
                                        onClick={() => handleCopyLink(link.token)}
                                        className="p-1.5 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded transition-colors cursor-pointer"
                                        title="Copy URL"
                                      >
                                        {isCopied ? (
                                          <Check className="w-3.5 h-3.5 text-emerald-600" />
                                        ) : (
                                          <Copy className="w-3.5 h-3.5" />
                                        )}
                                      </button>
                                      <a
                                        href={url}
                                        target="_blank"
                                        rel="noreferrer"
                                        className="p-1.5 text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded transition-colors"
                                        title="Open Link"
                                      >
                                        <ExternalLink className="w-3.5 h-3.5" />
                                      </a>
                                      <button
                                        onClick={() => handleDeleteLink(link.token)}
                                        className="p-1.5 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded transition-colors cursor-pointer"
                                        title="Revoke / Delete Link"
                                      >
                                        <Trash2 className="w-3.5 h-3.5" />
                                      </button>
                                    </div>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* TAB 2: Dashboard & Column Controller */}
              {activeTab === 'columns' && (
                <div className="space-y-6">
                  {/* Column mappings & Portal lock */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 rounded-xl bg-slate-50 border border-slate-200">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Project Column Header
                      </label>
                      <select
                        value={projectCol}
                        onChange={(e) => setProjectCol(e.target.value)}
                        className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs"
                      >
                        {allCols.map((c) => (
                          <option key={c} value={c}>
                            {c}
                          </option>
                        ))}
                      </select>
                      <p className="text-[10px] text-slate-400 mt-1">
                        Source column mapped to Project name.
                      </p>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Sub-Project Column Header
                      </label>
                      <select
                        value={subProjectCol}
                        onChange={(e) => setSubProjectCol(e.target.value)}
                        className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs"
                      >
                        {allCols.map((c) => (
                          <option key={c} value={c}>
                            {c}
                          </option>
                        ))}
                      </select>
                      <p className="text-[10px] text-slate-400 mt-1">
                        Source column mapped to location / sub-project.
                      </p>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Lock Main Portal
                      </label>
                      <div className="flex items-center gap-2 mt-2">
                        <input
                          type="checkbox"
                          id="lockPortalCheck"
                          checked={lockMainPortal}
                          onChange={(e) => setLockMainPortal(e.target.checked)}
                          className="w-4 h-4 rounded text-blue-600 cursor-pointer"
                        />
                        <label htmlFor="lockPortalCheck" className="text-xs text-slate-700 cursor-pointer font-medium">
                          Require Admin PIN on root URL
                        </label>
                      </div>
                      <p className="text-[10px] text-slate-400 mt-1">
                        When checked, non-token visitors must enter Admin PIN.
                      </p>
                    </div>
                  </div>

                  {/* Visible Columns Checklist */}
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <div>
                        <h3 className="font-display font-semibold text-xs text-slate-800 uppercase tracking-wider">
                          Visible Columns in Client Portal &amp; Exports ({visibleCols.length} selected)
                        </h3>
                        <p className="text-xs text-slate-500">
                          Checked columns are exposed in the table view and generated PDF / Excel reports.
                        </p>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => setVisibleCols(allCols)}
                          className="text-xs font-semibold text-blue-600 hover:text-blue-800 cursor-pointer"
                        >
                          Select All
                        </button>
                        <span className="text-slate-300">·</span>
                        <button
                          onClick={() => setVisibleCols([])}
                          className="text-xs font-semibold text-slate-500 hover:text-slate-700 cursor-pointer"
                        >
                          Deselect All
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2.5 max-h-72 overflow-y-auto p-3 border border-slate-200 rounded-xl bg-slate-50/50">
                      {allCols.map((col) => {
                        const isChecked = visibleCols.includes(col);
                        return (
                          <label
                            key={col}
                            className={`flex items-center gap-2 p-2 rounded-lg text-xs cursor-pointer select-none transition-colors ${
                              isChecked
                                ? 'bg-white border border-slate-300 text-slate-900 shadow-xs'
                                : 'text-slate-500 hover:bg-slate-100'
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setVisibleCols([...visibleCols, col]);
                                } else {
                                  setVisibleCols(visibleCols.filter((c) => c !== col));
                                }
                              }}
                              className="w-3.5 h-3.5 rounded text-blue-600"
                            />
                            <span className="truncate" title={col}>
                              {col}
                            </span>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 3: KPI Scorecards Controller */}
              {activeTab === 'kpis' && (
                <div className="space-y-4">
                  <div>
                    <h3 className="font-display font-semibold text-xs text-slate-800 uppercase tracking-wider">
                      Automated KPI Scorecard Elements ({kpiCols.length} active)
                    </h3>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Check which columns appear as top KPI selector pills with automatic 4-bucket
                      compliance calculation (Valid, Expiring Soon, Expired, Missing).
                    </p>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2.5 max-h-80 overflow-y-auto p-3 border border-slate-200 rounded-xl bg-slate-50/50">
                    {allCols.map((col) => {
                      const isChecked = kpiCols.includes(col);
                      return (
                        <label
                          key={col}
                          className={`flex items-center gap-2 p-2 rounded-lg text-xs cursor-pointer select-none transition-colors ${
                            isChecked
                              ? 'bg-emerald-50 border border-emerald-300 text-emerald-950 shadow-xs'
                              : 'text-slate-500 hover:bg-slate-100'
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setKpiCols([...kpiCols, col]);
                              } else {
                                setKpiCols(kpiCols.filter((c) => c !== col));
                              }
                            }}
                            className="w-3.5 h-3.5 rounded text-emerald-600"
                          />
                          <span className="truncate" title={col}>
                            {col}
                          </span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* TAB 4: Google Sheet & Security Settings */}
              {activeTab === 'settings' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-3 rounded-xl bg-blue-50/70 border border-blue-200 text-blue-900 text-xs">
                    <div className="flex items-center gap-2">
                      <Settings className="w-4 h-4 text-blue-600 shrink-0" />
                      <span>
                        Configured for Master Spreadsheet: <strong className="font-mono">{DEFAULT_SPREADSHEET_ID}</strong>
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={handleResetDefaults}
                      className="px-2.5 py-1 text-[11px] font-semibold bg-white border border-blue-300 text-blue-700 hover:bg-blue-100 rounded-md transition-colors cursor-pointer"
                    >
                      Restore Defaults
                    </button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Spreadsheet ID
                      </label>
                      <input
                        type="text"
                        value={spreadsheetId}
                        onChange={(e) => setSpreadsheetId(e.target.value)}
                        placeholder={DEFAULT_SPREADSHEET_ID}
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs font-mono text-slate-800 focus:bg-white focus:ring-2 focus:ring-blue-500/20"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Admin PIN
                      </label>
                      <input
                        type="text"
                        value={newAdminPin}
                        onChange={(e) => setNewAdminPin(e.target.value)}
                        placeholder="123456"
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs font-mono text-slate-800 focus:bg-white focus:ring-2 focus:ring-blue-500/20"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Sheet Tab Names (Comma Separated)
                    </label>
                    <input
                      type="text"
                      value={sheetTabsStr}
                      onChange={(e) => setSheetTabsStr(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs text-slate-800 focus:bg-white focus:ring-2 focus:ring-blue-500/20"
                      placeholder="Projects - A, Projects - B, Projects - C"
                    />
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="block text-xs font-semibold text-slate-700">
                        Google Cloud Service Account JSON
                      </label>
                      <span className="text-[11px] text-slate-400">
                        Optional: Required for live Google Sheets synchronization
                      </span>
                    </div>
                    <textarea
                      rows={6}
                      value={serviceAccountStr}
                      onChange={(e) => setServiceAccountStr(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs font-mono text-slate-800 focus:bg-white focus:ring-2 focus:ring-blue-500/20"
                      placeholder='Paste Google Service Account JSON {"type": "service_account", ...} here to enable live sync...'
                    />
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-3.5 bg-slate-50 border-t border-slate-200 flex items-center justify-between shrink-0">
          <div className="text-xs text-slate-500">
            {config?.last_synced_at && (
              <span>Last Synced: {new Date(config.last_synced_at).toLocaleString()}</span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="py-2 px-4 text-xs font-medium text-slate-700 bg-white border border-slate-300 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
            >
              Close
            </button>
            <button
              onClick={handleSaveSettings}
              disabled={saving}
              className="py-2 px-4 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded-lg transition-colors cursor-pointer flex items-center gap-1.5 shadow-sm"
            >
              <Save className="w-3.5 h-3.5" />
              <span>{saving ? 'Saving...' : 'Save Configuration'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
