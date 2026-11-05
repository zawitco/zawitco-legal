import React from 'react';
import {
  FileText,
  FileSpreadsheet,
  Building2,
  Calendar,
  ShieldCheck,
  RefreshCw,
  Unlock,
  ChevronDown,
} from 'lucide-react';
import { LinkMeta } from '../types';

interface TopBarProps {
  mode: 'client_link' | 'admin' | 'public';
  linkMeta?: LinkMeta;
  activeProject: string;
  activeSubProject: string;
  projects?: string[];
  onSelectProject?: (proj: string) => void;
  lastSyncedAt: string | null;
  isAdminLoggedIn: boolean;
  onExportPdf: () => void;
  onExportExcel: () => void;
  onOpenAdminModal?: () => void;
  onOpenSyncModal?: () => void;
  onAdminLogout?: () => void;
}

export const TopBar: React.FC<TopBarProps> = ({
  mode,
  linkMeta,
  activeProject,
  activeSubProject,
  projects = [],
  onSelectProject,
  lastSyncedAt,
  isAdminLoggedIn,
  onExportPdf,
  onExportExcel,
  onOpenAdminModal,
  onOpenSyncModal,
  onAdminLogout,
}) => {
  const syncTimeFormatted = lastSyncedAt
    ? new Date(lastSyncedAt).toLocaleString(undefined, {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    : 'Live';

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
              Zawitco Legal
            </span>
            <span className="text-[11px] text-slate-400 font-normal whitespace-nowrap">
              Client Compliance &amp; KPI Portal
            </span>
          </div>
        </div>

        {/* Zone 2: Project Selector & Context (Client Friendly) */}
        <div className="flex items-center gap-3 text-xs">
          {mode === 'client_link' && linkMeta ? (
            <div className="flex items-center gap-2 bg-slate-800/90 px-3 py-1.5 rounded-lg border border-slate-700/70">
              <span className="text-slate-400">Client Scope:</span>
              <span className="font-semibold text-emerald-400">{linkMeta.client_label}</span>
              <span className="text-slate-500">·</span>
              <span className="text-slate-200 font-medium">{linkMeta.project_name}</span>
            </div>
          ) : (
            <div className="flex items-center gap-2 bg-slate-800/90 px-2.5 py-1.5 rounded-lg border border-slate-700/70">
              <span className="text-slate-400 text-[11px] hidden sm:inline">Project:</span>
              {onSelectProject && projects.length > 0 ? (
                <div className="relative flex items-center">
                  <select
                    value={activeProject}
                    onChange={(e) => onSelectProject(e.target.value)}
                    className="bg-transparent text-white font-semibold text-xs pr-6 pl-1 py-0.5 focus:outline-hidden cursor-pointer appearance-none"
                  >
                    <option value="ALL" className="bg-slate-900 text-white">
                      All Projects ({projects.length})
                    </option>
                    {projects.map((p) => (
                      <option key={p} value={p} className="bg-slate-900 text-white">
                        {p}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-0 pointer-events-none" />
                </div>
              ) : (
                <span className="font-semibold text-white">
                  {activeProject === 'ALL' ? 'All Projects' : activeProject}
                </span>
              )}
            </div>
          )}

          <div className="hidden md:flex items-center gap-1.5 text-slate-400 bg-slate-800/40 px-2.5 py-1.5 rounded-md text-[11px]">
            <Calendar className="w-3.5 h-3.5 text-slate-400" />
            <span className="tabular-nums">Updated: {syncTimeFormatted}</span>
          </div>
        </div>

        {/* Zone 3: Primary Action Controls */}
        <div className="flex items-center gap-2 shrink-0">
          {/* PDF Report Export */}
          <button
            onClick={onExportPdf}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-200 bg-slate-800 hover:bg-slate-700 active:scale-95 border border-slate-700 rounded-lg transition-colors whitespace-nowrap cursor-pointer shadow-xs"
            title="Download Executive PDF Compliance Report"
          >
            <FileText className="w-3.5 h-3.5 text-rose-400" />
            <span className="hidden sm:inline">PDF Report</span>
          </button>

          {/* Excel Export */}
          <button
            onClick={onExportExcel}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-200 bg-slate-800 hover:bg-slate-700 active:scale-95 border border-slate-700 rounded-lg transition-colors whitespace-nowrap cursor-pointer shadow-xs"
            title="Export Multi-Sheet Excel Workbook"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-400" />
            <span className="hidden sm:inline">Excel (.xlsx)</span>
          </button>

          {/* Admin Mode Controls (ONLY VISIBLE WHEN ADMIN LOGGED IN) */}
          {isAdminLoggedIn && (
            <div className="flex items-center gap-1.5 pl-2 border-l border-slate-700">
              {onOpenAdminModal && (
                <button
                  onClick={onOpenAdminModal}
                  className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-500 rounded-lg transition-colors cursor-pointer"
                  title="Admin Control Center"
                >
                  <ShieldCheck className="w-3.5 h-3.5" />
                  <span className="hidden md:inline">Admin Center</span>
                </button>
              )}

              {onOpenSyncModal && (
                <button
                  onClick={onOpenSyncModal}
                  className="p-1.5 text-emerald-400 hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
                  title="Sync Data"
                >
                  <RefreshCw className="w-4 h-4" />
                </button>
              )}

              {onAdminLogout && (
                <button
                  onClick={onAdminLogout}
                  className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
                  title="Lock Admin Session"
                >
                  <Unlock className="w-4 h-4 text-emerald-400" />
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
