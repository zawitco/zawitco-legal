import React from 'react';
import {
  FileText,
  FileSpreadsheet,
  RefreshCw,
  Share2,
  Lock,
  Unlock,
  ShieldCheck,
  Building2,
  Calendar,
} from 'lucide-react';
import { LinkMeta } from '../types';

interface TopBarProps {
  mode: 'client_link' | 'admin' | 'public';
  linkMeta?: LinkMeta;
  activeProject: string;
  activeSubProject: string;
  lastSyncedAt: string | null;
  isSyncing: boolean;
  isAdminLoggedIn: boolean;
  onSync: () => void;
  onExportPdf: () => void;
  onExportExcel: () => void;
  onOpenShareModal: () => void;
  onOpenAdminModal: () => void;
  onOpenPinModal: () => void;
  onAdminLogout: () => void;
}

export const TopBar: React.FC<TopBarProps> = ({
  mode,
  linkMeta,
  activeProject,
  activeSubProject,
  lastSyncedAt,
  isSyncing,
  isAdminLoggedIn,
  onSync,
  onExportPdf,
  onExportExcel,
  onOpenShareModal,
  onOpenAdminModal,
  onOpenPinModal,
  onAdminLogout,
}) => {
  const syncTimeFormatted = lastSyncedAt
    ? new Date(lastSyncedAt).toLocaleString(undefined, {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    : 'Not synced';

  return (
    <header className="sticky top-0 z-30 bg-slate-900 border-b border-slate-800 text-white shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
        {/* Zone 1: Brand Wordmark */}
        <div className="flex items-center gap-3 shrink-0">
          <div className="w-9 h-9 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
            <Building2 className="w-5 h-5" />
          </div>
          <div className="flex flex-col">
            <span className="font-display font-bold text-base tracking-tight text-white whitespace-nowrap">
              Zawitco Legal Portal
            </span>
            <span className="text-[11px] text-slate-400 font-normal whitespace-nowrap">
              Multi-Project Compliance &amp; KPI Engine
            </span>
          </div>
        </div>

        {/* Zone 2: Navigation & Contextual Info */}
        <div className="hidden lg:flex items-center gap-3 text-xs text-slate-300">
          {mode === 'client_link' && linkMeta ? (
            <div className="flex items-center gap-2 bg-slate-800/80 px-3 py-1.5 rounded-lg border border-slate-700/60">
              <span className="text-slate-400">Client:</span>
              <span className="font-semibold text-white">{linkMeta.client_label}</span>
              <span className="text-slate-500">·</span>
              <span className="text-slate-400">Project:</span>
              <span className="font-semibold text-emerald-400">{linkMeta.project_name}</span>
              {linkMeta.sub_project_name !== 'ALL' && (
                <>
                  <span className="text-slate-500">·</span>
                  <span className="text-slate-400">Sub:</span>
                  <span className="font-medium text-slate-200">{linkMeta.sub_project_name}</span>
                </>
              )}
            </div>
          ) : (
            <div className="flex items-center gap-2 bg-slate-800/80 px-3 py-1.5 rounded-lg border border-slate-700/60">
              <span className="text-slate-400">Active View:</span>
              <span className="font-semibold text-white">
                {activeProject === 'ALL' ? 'All Projects' : activeProject}
              </span>
              <span className="text-slate-500">·</span>
              <span className="text-slate-400">Sub-Project:</span>
              <span className="text-slate-200 font-medium">
                {activeSubProject === 'ALL' ? 'All Sites' : activeSubProject}
              </span>
            </div>
          )}

          <div className="flex items-center gap-1.5 text-slate-400 bg-slate-800/40 px-2.5 py-1.5 rounded-md">
            <Calendar className="w-3.5 h-3.5 text-slate-400" />
            <span className="tabular-nums">Synced: {syncTimeFormatted}</span>
          </div>
        </div>

        {/* Zone 3: Primary Action Controls */}
        <div className="flex items-center gap-2 shrink-0">
          {/* PDF Report Export */}
          <button
            onClick={onExportPdf}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-200 bg-slate-800 hover:bg-slate-700 active:scale-95 border border-slate-700 rounded-lg transition-colors whitespace-nowrap cursor-pointer"
            title="Download Executive PDF Compliance Report"
          >
            <FileText className="w-3.5 h-3.5 text-rose-400" />
            <span className="hidden sm:inline">PDF Report</span>
          </button>

          {/* Excel Export */}
          <button
            onClick={onExportExcel}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-200 bg-slate-800 hover:bg-slate-700 active:scale-95 border border-slate-700 rounded-lg transition-colors whitespace-nowrap cursor-pointer"
            title="Export Multi-Sheet Excel Workbook"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-400" />
            <span className="hidden sm:inline">Excel (.xlsx)</span>
          </button>

          {/* Master View Exclusive Controls */}
          {mode !== 'client_link' && (
            <>
              {/* Sync Now Button */}
              <button
                onClick={onSync}
                disabled={isSyncing}
                className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-950 bg-emerald-400 hover:bg-emerald-300 disabled:opacity-50 active:scale-95 rounded-lg transition-colors whitespace-nowrap cursor-pointer shadow-sm"
                title="Sync Google Sheets to SQLite"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
                <span>{isSyncing ? 'Syncing...' : 'Sync Now'}</span>
              </button>

              {/* Share Project Link Button */}
              <button
                onClick={onOpenShareModal}
                className="hidden sm:flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-200 bg-slate-800 hover:bg-slate-700 active:scale-95 border border-slate-700 rounded-lg transition-colors whitespace-nowrap cursor-pointer"
                title="Generate Secure Shareable Link for Client"
              >
                <Share2 className="w-3.5 h-3.5 text-blue-400" />
                <span>Share Link</span>
              </button>

              {/* Admin Control Center or PIN Unlock */}
              {isAdminLoggedIn ? (
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={onOpenAdminModal}
                    className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-500 rounded-lg transition-colors whitespace-nowrap cursor-pointer shadow-sm"
                    title="Open Admin Control Center"
                  >
                    <ShieldCheck className="w-3.5 h-3.5" />
                    <span className="hidden md:inline">Control Center</span>
                  </button>
                  <button
                    onClick={onAdminLogout}
                    className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
                    title="Exit Admin Session"
                  >
                    <Unlock className="w-4 h-4 text-emerald-400" />
                  </button>
                </div>
              ) : (
                <button
                  onClick={onOpenPinModal}
                  className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-300 hover:text-white bg-slate-800/80 hover:bg-slate-800 border border-slate-700 rounded-lg transition-colors whitespace-nowrap cursor-pointer"
                  title="Enter Admin PIN to unlock full administrative controls"
                >
                  <Lock className="w-3.5 h-3.5 text-amber-400" />
                  <span className="hidden md:inline">Admin Mode</span>
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </header>
  );
};
