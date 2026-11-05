import React, { useState, useEffect } from 'react';
import {
  X,
  RefreshCw,
  Upload,
  Download,
  Server,
  Github,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  ExternalLink,
  RotateCcw,
  Database,
  CloudOff,
  Cloud,
} from 'lucide-react';
import {
  isStaticHosting,
  getBackendUrl,
  setBackendUrl,
  testBackendConnection,
  safeApiFetch,
} from '../services/api';
import { PortalDataResponse } from '../types';

interface SyncModalProps {
  isOpen: boolean;
  onClose: () => void;
  adminPin: string;
  portalData: PortalDataResponse | null;
  onDataUpdated: (newData: PortalDataResponse) => void;
  onRequestPin?: () => void;
}

export const SyncModal: React.FC<SyncModalProps> = ({
  isOpen,
  onClose,
  adminPin,
  portalData,
  onDataUpdated,
  onRequestPin,
}) => {
  const [activeTab, setActiveTab] = useState<'import' | 'github_actions' | 'backend' | 'sync'>(
    isStaticHosting() && !getBackendUrl() ? 'import' : 'sync'
  );

  const [backendInput, setBackendInput] = useState(getBackendUrl());
  const [backendTestStatus, setBackendTestStatus] = useState<{
    testing: boolean;
    success?: boolean;
    message?: string;
  }>({ testing: false });

  const [isSyncing, setIsSyncing] = useState(false);
  const [jsonText, setJsonText] = useState('');
  const [showJsonPaste, setShowJsonPaste] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const isStatic = isStaticHosting();
  const currentBackend = getBackendUrl();

  useEffect(() => {
    if (isOpen) {
      setBackendInput(getBackendUrl());
      setFeedback(null);
      if (isStaticHosting() && !getBackendUrl()) {
        setActiveTab('import');
      } else {
        setActiveTab('sync');
      }
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const showNotification = (type: 'success' | 'error', text: string) => {
    setFeedback({ type, text });
    setTimeout(() => setFeedback(null), 5000);
  };

  // 1. Live Backend Sync
  const handleLiveSync = async () => {
    if (!adminPin) {
      if (onRequestPin) {
        onRequestPin();
      } else {
        showNotification('error', 'Please enter your Admin PIN first.');
      }
      return;
    }

    setIsSyncing(true);
    setFeedback(null);

    try {
      const res = await safeApiFetch<{ success: boolean; count?: number; timestamp?: string; error?: string }>(
        '/api/sync',
        {
          method: 'POST',
          headers: {
            'x-admin-pin': adminPin,
          },
        }
      );

      if (res.ok && res.data?.success) {
        showNotification(
          'success',
          `Sync successful! Updated ${res.data.count || 0} active employee records.`
        );
        // Refresh portal data
        const refreshRes = await safeApiFetch<PortalDataResponse>('/api/portal-data', {
          headers: { 'x-admin-pin': adminPin },
        });
        if (refreshRes.ok && refreshRes.data) {
          onDataUpdated(refreshRes.data);
        }
      } else {
        showNotification('error', res.error || 'Sync operation failed.');
      }
    } catch (err: any) {
      showNotification('error', `Sync failed: ${err.message}`);
    } finally {
      setIsSyncing(false);
    }
  };

  // 2. Upload / Import JSON file
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const content = event.target?.result as string;
        const parsed = JSON.parse(content);
        applyImportedData(parsed);
      } catch (err: any) {
        showNotification('error', `Invalid JSON file: ${err.message}`);
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleApplyJsonText = () => {
    if (!jsonText.trim()) return;
    try {
      const parsed = JSON.parse(jsonText.trim());
      applyImportedData(parsed);
      setJsonText('');
      setShowJsonPaste(false);
    } catch (err: any) {
      showNotification('error', `Invalid JSON format: ${err.message}`);
    }
  };

  const applyImportedData = (data: any) => {
    if (!data || !Array.isArray(data.records)) {
      showNotification('error', 'Import failed: JSON must contain a "records" array.');
      return;
    }

    try {
      const normalized: PortalDataResponse = {
        mode: data.mode || 'public',
        records: data.records,
        visibleColumns: data.visibleColumns || portalData?.visibleColumns || [],
        kpiElements: data.kpiElements || portalData?.kpiElements || [],
        projectColumn: data.projectColumn || 'PROJECT',
        subProjectColumn: data.subProjectColumn || 'SUB PROJECTS',
        lastSyncedAt: data.lastSyncedAt || new Date().toISOString(),
        lastSyncCount: data.records.length,
        sheetTabs: data.sheetTabs || portalData?.sheetTabs || ['Projects - A', 'Projects - B', 'Projects - C'],
        lockMainPortal: Boolean(data.lockMainPortal),
      };

      localStorage.setItem('portal_custom_data', JSON.stringify(normalized));
      onDataUpdated(normalized);
      showNotification('success', `Imported ${normalized.records.length} records successfully!`);
    } catch (err: any) {
      showNotification('error', `Failed to apply data: ${err.message}`);
    }
  };

  const handleResetToBundled = () => {
    localStorage.removeItem('portal_custom_data');
    showNotification('success', 'Reset custom data. Loading default bundled snapshot...');
    window.location.reload();
  };

  // 3. Export / Download JSON
  const handleDownloadSnapshot = () => {
    if (!portalData) {
      showNotification('error', 'No data available to export.');
      return;
    }

    const payload = {
      mode: 'public',
      records: portalData.records,
      visibleColumns: portalData.visibleColumns,
      kpiElements: portalData.kpiElements,
      projectColumn: portalData.projectColumn,
      subProjectColumn: portalData.subProjectColumn,
      lastSyncedAt: portalData.lastSyncedAt || new Date().toISOString(),
      sheetTabs: portalData.sheetTabs,
      lockMainPortal: Boolean(portalData.lockMainPortal),
    };

    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `portal-data-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showNotification('success', 'Downloaded portal-data.json snapshot.');
  };

  // 4. Test Backend URL
  const handleTestBackend = async () => {
    if (!backendInput.trim()) {
      setBackendTestStatus({ testing: false, success: false, message: 'Please enter a URL.' });
      return;
    }

    setBackendTestStatus({ testing: true });
    const result = await testBackendConnection(backendInput);
    setBackendTestStatus({
      testing: false,
      success: result.ok,
      message: result.message,
    });
  };

  const handleSaveBackend = () => {
    setBackendUrl(backendInput);
    showNotification(
      'success',
      backendInput.trim()
        ? `Connected to backend: ${backendInput.trim()}`
        : 'Backend URL cleared. Using default mode.'
    );
    // Reload portal data using the new backend
    setTimeout(() => {
      window.location.reload();
    }, 1200);
  };

  const handleClearBackend = () => {
    setBackendInput('');
    setBackendUrl('');
    setBackendTestStatus({ testing: false });
    showNotification('success', 'Backend disconnected. Reverted to static mode.');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 bg-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
              <RefreshCw className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-display font-bold text-base text-white">
                Data Sync &amp; Source Center
              </h3>
              <p className="text-xs text-slate-400">
                Manage Google Sheets sync, static snapshots, or connected backend
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Static Hosting Alert Banner */}
        {isStatic && !currentBackend && (
          <div className="px-6 py-3 bg-amber-50 border-b border-amber-200 text-amber-900 flex items-start gap-2.5 text-xs">
            <CloudOff className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <strong className="font-semibold">GitHub Pages Static Hosting Detected:</strong>
              <p className="text-amber-800 mt-0.5">
                GitHub Pages hosts static files and cannot run the Node.js backend or execute direct Google Cloud API requests. To update data, import a new JSON snapshot, enable automated GitHub Actions sync, or connect an external backend URL.
              </p>
            </div>
          </div>
        )}

        {/* Feedback Banner */}
        {feedback && (
          <div
            className={`px-6 py-2.5 text-xs flex items-center gap-2 border-b ${
              feedback.type === 'success'
                ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                : 'bg-rose-50 text-rose-800 border-rose-200'
            }`}
          >
            {feedback.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            )}
            <span>{feedback.text}</span>
          </div>
        )}

        {/* Tabs */}
        <div className="flex border-b border-slate-200 bg-slate-50 px-6 gap-2 pt-2">
          {(!isStatic || currentBackend) && (
            <button
              onClick={() => setActiveTab('sync')}
              className={`px-4 py-2.5 text-xs font-semibold rounded-t-lg transition-colors flex items-center gap-1.5 cursor-pointer ${
                activeTab === 'sync'
                  ? 'bg-white text-emerald-600 border-t border-x border-slate-200 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Live Server Sync
            </button>
          )}

          <button
            onClick={() => setActiveTab('import')}
            className={`px-4 py-2.5 text-xs font-semibold rounded-t-lg transition-colors flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'import'
                ? 'bg-white text-emerald-600 border-t border-x border-slate-200 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Upload className="w-3.5 h-3.5" />
            Data Import &amp; Export
          </button>

          <button
            onClick={() => setActiveTab('github_actions')}
            className={`px-4 py-2.5 text-xs font-semibold rounded-t-lg transition-colors flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'github_actions'
                ? 'bg-white text-emerald-600 border-t border-x border-slate-200 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Github className="w-3.5 h-3.5" />
            Auto-Sync (GitHub Actions)
          </button>

          <button
            onClick={() => setActiveTab('backend')}
            className={`px-4 py-2.5 text-xs font-semibold rounded-t-lg transition-colors flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'backend'
                ? 'bg-white text-emerald-600 border-t border-x border-slate-200 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Server className="w-3.5 h-3.5" />
            Connected Backend
          </button>
        </div>

        {/* Tab Content */}
        <div className="p-6 overflow-y-auto space-y-5 flex-1">
          {/* TAB 1: Live Server Sync */}
          {activeTab === 'sync' && (
            <div className="space-y-4">
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                      Live Google Sheets Synchronization
                    </h4>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Connects directly to the Google Sheets API using the server service account to fetch all active employee records.
                    </p>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                      Server Active
                    </span>
                  </div>
                </div>

                <div className="mt-4 grid grid-cols-2 gap-3 text-xs">
                  <div className="bg-white p-2.5 rounded-lg border border-slate-200">
                    <span className="text-slate-400 block text-[10px]">CURRENT RECORDS</span>
                    <span className="font-mono font-bold text-slate-900 text-sm">
                      {portalData?.records?.length || 0}
                    </span>
                  </div>
                  <div className="bg-white p-2.5 rounded-lg border border-slate-200">
                    <span className="text-slate-400 block text-[10px]">LAST SYNCED</span>
                    <span className="font-mono text-slate-700 text-xs">
                      {portalData?.lastSyncedAt
                        ? new Date(portalData.lastSyncedAt).toLocaleString()
                        : 'Never'}
                    </span>
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-slate-200 flex items-center justify-between">
                  <span className="text-xs text-slate-500">
                    {adminPin ? 'PIN Authenticated' : 'Admin PIN required to trigger sync'}
                  </span>
                  <button
                    onClick={handleLiveSync}
                    disabled={isSyncing}
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white rounded-lg text-xs font-semibold flex items-center gap-2 cursor-pointer shadow-sm transition-colors"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
                    <span>{isSyncing ? 'Synchronizing Google Sheets...' : 'Trigger Sync Now'}</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: Data Import & Export */}
          {activeTab === 'import' && (
            <div className="space-y-4">
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-800 mb-1">
                  Update Portal Data via File Snapshot
                </h4>
                <p className="text-xs text-slate-500 mb-4">
                  Upload an updated <code className="text-slate-700 font-mono">portal-data.json</code> file to immediately update all KPI scorecards, charts, and employee tables.
                </p>

                <div className="flex flex-col sm:flex-row items-center gap-3">
                  <label className="flex-1 w-full flex items-center justify-center gap-2 px-4 py-3 bg-white border-2 border-dashed border-slate-300 hover:border-emerald-500 rounded-xl cursor-pointer transition-colors text-xs font-semibold text-slate-700 hover:text-emerald-700">
                    <Upload className="w-4 h-4 text-emerald-600" />
                    <span>Select portal-data.json File</span>
                    <input
                      type="file"
                      accept=".json,application/json"
                      onChange={handleFileUpload}
                      className="hidden"
                    />
                  </label>

                  <button
                    type="button"
                    onClick={() => setShowJsonPaste(!showJsonPaste)}
                    className="px-3 py-3 bg-white border border-slate-200 hover:border-slate-300 text-xs font-medium text-slate-700 rounded-xl transition-colors cursor-pointer"
                  >
                    {showJsonPaste ? 'Hide JSON Box' : 'Paste JSON Text'}
                  </button>
                </div>

                {showJsonPaste && (
                  <div className="mt-3 space-y-2">
                    <textarea
                      value={jsonText}
                      onChange={(e) => setJsonText(e.target.value)}
                      placeholder="Paste portal-data.json contents here..."
                      rows={5}
                      className="w-full text-xs font-mono p-3 border border-slate-300 rounded-lg bg-white focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
                    />
                    <div className="flex justify-end">
                      <button
                        onClick={handleApplyJsonText}
                        disabled={!jsonText.trim()}
                        className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white rounded-lg text-xs font-semibold cursor-pointer"
                      >
                        Apply Pasted JSON
                      </button>
                    </div>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="border border-slate-200 rounded-xl p-3.5 bg-white">
                  <h5 className="text-xs font-semibold text-slate-800 flex items-center gap-1.5 mb-1">
                    <Download className="w-3.5 h-3.5 text-blue-600" />
                    Export Current Snapshot
                  </h5>
                  <p className="text-[11px] text-slate-500 mb-3">
                    Download the current active records as a JSON file backup.
                  </p>
                  <button
                    onClick={handleDownloadSnapshot}
                    className="w-full px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold transition-colors cursor-pointer"
                  >
                    Download portal-data.json
                  </button>
                </div>

                <div className="border border-slate-200 rounded-xl p-3.5 bg-white">
                  <h5 className="text-xs font-semibold text-slate-800 flex items-center gap-1.5 mb-1">
                    <RotateCcw className="w-3.5 h-3.5 text-amber-600" />
                    Reset Custom Data
                  </h5>
                  <p className="text-[11px] text-slate-500 mb-3">
                    Clear any uploaded JSON and restore the original bundled records.
                  </p>
                  <button
                    onClick={handleResetToBundled}
                    className="w-full px-3 py-2 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 rounded-lg text-xs font-semibold transition-colors cursor-pointer"
                  >
                    Restore Bundled Snapshot
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: GitHub Actions Automated Sync */}
          {activeTab === 'github_actions' && (
            <div className="space-y-4">
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-6 h-6 rounded bg-slate-900 text-white flex items-center justify-center">
                    <Github className="w-3.5 h-3.5" />
                  </div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                    Automated Sync with GitHub Actions (Recommended)
                  </h4>
                </div>
                <p className="text-xs text-slate-600 mb-4 leading-relaxed">
                  You can keep your GitHub Pages site automatically synchronized with Google Sheets without running your own server. GitHub Actions will execute the sync on schedule and publish the fresh data automatically.
                </p>

                <div className="space-y-3 text-xs">
                  <div className="bg-white p-3 rounded-lg border border-slate-200 space-y-1">
                    <div className="flex items-center gap-2 font-semibold text-slate-900">
                      <span className="w-5 h-5 rounded-full bg-slate-900 text-white text-[11px] flex items-center justify-center font-mono">1</span>
                      <span>Add Repository Secret</span>
                    </div>
                    <p className="text-slate-500 pl-7 text-[11px]">
                      In your GitHub repository, navigate to <strong>Settings → Secrets and variables → Actions</strong>. Click <strong>New repository secret</strong>, name it <code className="bg-slate-100 px-1 py-0.5 rounded text-slate-800 font-mono font-bold">GOOGLE_SERVICE_ACCOUNT_JSON</code>, and paste your Google Cloud service account JSON credentials.
                    </p>
                  </div>

                  <div className="bg-white p-3 rounded-lg border border-slate-200 space-y-1">
                    <div className="flex items-center gap-2 font-semibold text-slate-900">
                      <span className="w-5 h-5 rounded-full bg-slate-900 text-white text-[11px] flex items-center justify-center font-mono">2</span>
                      <span>Trigger Workflow</span>
                    </div>
                    <p className="text-slate-500 pl-7 text-[11px]">
                      Go to the <strong>Actions</strong> tab in GitHub, select <strong>Deploy to GitHub Pages</strong>, and click <strong>Run workflow</strong>. The action will sync the Google Sheet and update your portal live!
                    </p>
                  </div>

                  <div className="bg-white p-3 rounded-lg border border-slate-200 space-y-1">
                    <div className="flex items-center gap-2 font-semibold text-slate-900">
                      <span className="w-5 h-5 rounded-full bg-slate-900 text-white text-[11px] flex items-center justify-center font-mono">3</span>
                      <span>Automatic Scheduling</span>
                    </div>
                    <p className="text-slate-500 pl-7 text-[11px]">
                      The workflow can also run automatically every night or every few hours on a cron schedule to keep your client portal always up to date.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: Connected Backend */}
          {activeTab === 'backend' && (
            <div className="space-y-4">
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-800 mb-1">
                  Connect External Backend API
                </h4>
                <p className="text-xs text-slate-500 mb-4">
                  If you deploy the Node.js backend to a cloud host (Render, Railway, Google Cloud Run, or VPS), enter the backend URL here so your GitHub Pages frontend can communicate directly with it.
                </p>

                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Backend Server URL
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="url"
                        value={backendInput}
                        onChange={(e) => setBackendInput(e.target.value)}
                        placeholder="https://your-portal-api.onrender.com"
                        className="flex-1 text-xs font-mono px-3 py-2 border border-slate-300 rounded-lg bg-white focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
                      />
                      <button
                        onClick={handleTestBackend}
                        disabled={backendTestStatus.testing}
                        className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg text-xs font-semibold cursor-pointer disabled:opacity-50 whitespace-nowrap"
                      >
                        {backendTestStatus.testing ? 'Testing...' : 'Test Connection'}
                      </button>
                    </div>
                  </div>

                  {backendTestStatus.message && (
                    <div
                      className={`p-2.5 rounded-lg text-xs flex items-center gap-2 border ${
                        backendTestStatus.success
                          ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                          : 'bg-rose-50 text-rose-800 border-rose-200'
                      }`}
                    >
                      {backendTestStatus.success ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                      ) : (
                        <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                      )}
                      <span>{backendTestStatus.message}</span>
                    </div>
                  )}

                  <div className="pt-2 flex items-center justify-between">
                    {currentBackend ? (
                      <button
                        onClick={handleClearBackend}
                        className="text-xs text-rose-600 hover:text-rose-700 font-semibold cursor-pointer"
                      >
                        Disconnect Backend
                      </button>
                    ) : (
                      <span className="text-[11px] text-slate-400">No backend connected</span>
                    )}

                    <button
                      onClick={handleSaveBackend}
                      className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-semibold cursor-pointer shadow-sm transition-colors"
                    >
                      Save &amp; Apply Backend
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-slate-200 bg-slate-50 flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs text-slate-500">
            {isStatic && !currentBackend ? (
              <span className="flex items-center gap-1.5 text-amber-700">
                <CloudOff className="w-3.5 h-3.5" />
                Static Hosting Mode
              </span>
            ) : (
              <span className="flex items-center gap-1.5 text-emerald-700 font-medium">
                <Cloud className="w-3.5 h-3.5" />
                Live Server Connected
              </span>
            )}
          </div>
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 rounded-lg text-xs font-semibold cursor-pointer transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
