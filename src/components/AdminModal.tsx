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
import { AdminConfigData, ShareLinkItem } from '../types';

interface AdminModalProps {
  isOpen: boolean;
  onClose: () => void;
  adminPin: string;
  projects: string[];
  subProjectsByProject: Record<string, string[]>;
  onConfigUpdated: () => void;
}

export const AdminModal: React.FC<AdminModalProps> = ({
  isOpen,
  onClose,
  adminPin,
  projects,
  subProjectsByProject,
  onConfigUpdated,
}) => {
  const [activeTab, setActiveTab] = useState<'links' | 'columns' | 'kpis' | 'settings'>('links');
  const [config, setConfig] = useState<AdminConfigData | null>(null);
  const [links, setLinks] = useState<ShareLinkItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [toastMessage, setToastMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Form states for Settings tab
  const [spreadsheetId, setSpreadsheetId] = useState('');
  const [sheetTabsStr, setSheetTabsStr] = useState('');
  const [newAdminPin, setNewAdminPin] = useState('');
  const [serviceAccountStr, setServiceAccountStr] = useState('');
  const [lockMainPortal, setLockMainPortal] = useState(false);

  // Form states for Column / KPI controllers
  const [visibleCols, setVisibleCols] = useState<string[]>([]);
  const [kpiCols, setKpiCols] = useState<string[]>([]);
  const [projectCol, setProjectCol] = useState('');
  const [subProjectCol, setSubProjectCol] = useState('');

  // Form state for creating link inside Links tab
  const [linkProject, setLinkProject] = useState('');
  const [linkSubProject, setLinkSubProject] = useState('ALL');
  const [linkTab, setLinkTab] = useState('ALL');
  const [linkLabel, setLinkLabel] = useState('');
  const [copiedToken, setCopiedToken] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && adminPin) {
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
      // 1. Load Config
      const configRes = await fetch('/api/admin/config', {
        headers: { 'x-admin-pin': adminPin },
      });
      if (configRes.ok) {
        const cfg: AdminConfigData = await configRes.json();
        setConfig(cfg);
        setSpreadsheetId(cfg.spreadsheet_id || '');
        setSheetTabsStr((cfg.sheet_tabs || []).join(', '));
        setNewAdminPin(cfg.admin_pin || '');
        setServiceAccountStr(cfg.service_account_json || '');
        setLockMainPortal(Boolean(cfg.lock_main_portal));
        setVisibleCols(cfg.visible_columns || []);
        setKpiCols(cfg.kpi_elements || []);
        setProjectCol(cfg.project_column || 'PROJECT');
        setSubProjectCol(cfg.sub_project_column || 'SUB PROJECTS');
        if (projects.length > 0 && !linkProject) {
          setLinkProject(projects[0]);
        }
      }

      // 2. Load Share Links
      const linksRes = await fetch('/api/admin/share-links', {
        headers: { 'x-admin-pin': adminPin },
      });
      if (linksRes.ok) {
        const linksData = await linksRes.json();
        setLinks(linksData);
      }
    } catch (e: any) {
      showToast('error', 'Failed to load configuration: ' + e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveSettings = async () => {
    setSaving(true);
    try {
      const tabsArray = sheetTabsStr
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);

      const res = await fetch('/api/admin/config', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-pin': adminPin,
        },
        body: JSON.stringify({
          spreadsheet_id: spreadsheetId,
          sheet_tabs: tabsArray,
          admin_pin: newAdminPin,
          lock_main_portal: lockMainPortal,
          visible_columns: visibleCols,
          kpi_elements: kpiCols,
          project_column: projectCol,
          sub_project_column: subProjectCol,
          service_account_json: serviceAccountStr,
        }),
      });

      if (res.ok) {
        showToast('success', 'Configuration updated successfully.');
        onConfigUpdated();
      } else {
        const err = await res.json();
        showToast('error', err.error || 'Failed to save settings.');
      }
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
      const res = await fetch('/api/admin/share-links', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-pin': adminPin,
        },
        body: JSON.stringify({
          project_name: linkProject,
          sub_project_name: linkSubProject,
          sheet_tab: linkTab,
          client_label: linkLabel.trim() || `Client Portal - ${linkProject}`,
        }),
      });

      if (res.ok) {
        const newLink = await res.json();
        setLinks([newLink, ...links]);
        setLinkLabel('');
        showToast('success', 'Share link created.');
      } else {
        const err = await res.json();
        showToast('error', err.error || 'Failed to create share link.');
      }
    } catch (e: any) {
      showToast('error', e.message);
    }
  };

  const handleDeleteLink = async (token: string) => {
    if (!confirm('Are you sure you want to revoke and delete this share link?')) return;
    try {
      const res = await fetch(`/api/admin/share-links/${token}`, {
        method: 'DELETE',
        headers: { 'x-admin-pin': adminPin },
      });
      if (res.ok) {
        setLinks(links.filter((l) => l.token !== token));
        showToast('success', 'Link revoked.');
      } else {
        showToast('error', 'Failed to revoke link.');
      }
    } catch (e: any) {
      showToast('error', e.message);
    }
  };

  const handleCopyLink = (token: string) => {
    const url = `${window.location.origin}/?token=${token}`;
    navigator.clipboard.writeText(url);
    setCopiedToken(token);
    setTimeout(() => setCopiedToken(null), 2500);
  };

  if (!isOpen) return null;

  const allCols = config?.all_columns || [];
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
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Spreadsheet ID
                      </label>
                      <input
                        type="text"
                        value={spreadsheetId}
                        onChange={(e) => setSpreadsheetId(e.target.value)}
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs font-mono"
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
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs font-mono"
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
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs"
                      placeholder="Projects - A, Projects - B, Projects - C"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Google Cloud Service Account JSON
                    </label>
                    <textarea
                      rows={7}
                      value={serviceAccountStr}
                      onChange={(e) => setServiceAccountStr(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs font-mono"
                      placeholder="Paste Service Account JSON credentials here..."
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
