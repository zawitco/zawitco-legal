import React, { useState, useMemo } from 'react';
import {
  Users,
  Search,
  Filter,
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  HelpCircle,
  ShieldCheck,
  FileCheck,
  HeartPulse,
  ChevronLeft,
  ChevronRight,
  Download,
} from 'lucide-react';
import { RecordItemData, CorePillarKey, KPIStatus } from '../types';
import { getEmployeeComplianceDetails } from '../utils/kpiEngine';

interface EmployeeComplianceRosterProps {
  records: RecordItemData[];
  activeProject: string;
  activeSubProject: string;
  activePillar: CorePillarKey;
  selectedStatus: KPIStatus | 'ALL';
  onSelectStatus: (status: KPIStatus | 'ALL') => void;
  onClearSubProjectFilter?: () => void;
}

export const EmployeeComplianceRoster: React.FC<EmployeeComplianceRosterProps> = ({
  records,
  activeProject,
  activeSubProject,
  activePillar,
  selectedStatus,
  onSelectStatus,
  onClearSubProjectFilter,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState<number>(50);

  // Filter records based on sub-project, search, and status
  const filteredEmployees = useMemo(() => {
    return records.filter((rec) => {
      // 1. Sub-Project filter (if not ALL)
      if (activeSubProject !== 'ALL') {
        const proj = (rec.data['PROJECT NAME'] || rec.data['PROJECT'] || rec.project_name || 'General').trim();
        let sp = (rec.data['SUB PROJECT'] || rec.data['SUB PROJECTS'] || rec.sub_project_name || 'MAIN').trim();
        if (sp.includes('@') || sp.endsWith('.com')) {
          sp = 'MAIN';
        }
        const displayName = sp === 'MAIN' ? proj : sp;
        if (displayName !== activeSubProject) {
          return false;
        }
      }

      const compliance = getEmployeeComplianceDetails(rec.data);

      // 2. Status filter
      if (selectedStatus !== 'ALL') {
        // If an active pillar is focused, match against that pillar's status
        if (activePillar === 'IQAMA') {
          if (compliance.iqama.status !== selectedStatus) return false;
        } else if (activePillar === 'AJEER') {
          if (compliance.ajeer.status !== selectedStatus) return false;
        } else if (activePillar === 'HEALTH') {
          if (compliance.health.status !== selectedStatus) return false;
        } else {
          // Check overall status
          if (compliance.overallStatus !== selectedStatus) return false;
        }
      }

      // 3. Search query filter
      if (searchTerm.trim()) {
        const q = searchTerm.toLowerCase();
        const name = (rec.data['EMPLOYEE NAME'] || '').toLowerCase();
        const erp = (rec.data['ERP ID'] || '').toLowerCase();
        const desig = (rec.data['DESIGNATION'] || '').toLowerCase();
        const iqamaNo = (rec.data['IQAMA NO'] || '').toLowerCase();
        const site = (rec.data['SUB PROJECT'] || rec.data['SUB PROJECTS'] || '').toLowerCase();
        const mis = (rec.data['MIS'] || rec.data['MIS ID'] || rec.data['MIS NO'] || '').toLowerCase();
        const picker = (rec.data['NINJA PICKER ID'] || rec.data['PICKER ID'] || '').toLowerCase();

        return (
          name.includes(q) ||
          erp.includes(q) ||
          desig.includes(q) ||
          iqamaNo.includes(q) ||
          site.includes(q) ||
          mis.includes(q) ||
          picker.includes(q)
        );
      }

      return true;
    });
  }, [records, activeSubProject, selectedStatus, activePillar, searchTerm]);

  // Determine dynamic column header according to active project context
  const isKeemartView =
    activeProject.toLowerCase().includes('keemart') ||
    activeSubProject.toUpperCase().startsWith('DS ') ||
    activeSubProject.toUpperCase().startsWith('KEEMART');

  const isNinjaView =
    activeProject.toLowerCase().includes('ninja') ||
    activeSubProject.toUpperCase().startsWith('NINJA');

  const idColumnTitle = isKeemartView
    ? 'MIS'
    : isNinjaView
    ? 'NINJA PICKER ID'
    : 'MIS / PICKER ID';

  // Reset page when filters change
  React.useEffect(() => {
    setCurrentPage(1);
  }, [activeSubProject, selectedStatus, activePillar, searchTerm]);

  // Pagination slice
  const totalEmployees = filteredEmployees.length;
  const totalPages = Math.ceil(totalEmployees / pageSize) || 1;
  const paginatedEmployees = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredEmployees.slice(start, start + pageSize);
  }, [filteredEmployees, currentPage, pageSize]);

  // Helper badge renderer
  const renderStatusBadge = (status: KPIStatus, text: string, subtitle?: string) => {
    if (status === 'VALID') {
      return (
        <div className="flex flex-col items-start">
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
            <CheckCircle2 className="w-3 h-3 text-emerald-600 shrink-0" />
            <span className="truncate max-w-[120px]">{text}</span>
          </span>
          {subtitle && (
            <span className="text-[10px] text-slate-400 mt-0.5 font-mono tabular-nums">
              {subtitle}
            </span>
          )}
        </div>
      );
    }
    if (status === 'WARNING') {
      return (
        <div className="flex flex-col items-start">
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-amber-50 text-amber-800 border border-amber-200">
            <AlertTriangle className="w-3 h-3 text-amber-600 shrink-0" />
            <span className="truncate max-w-[120px]">{text}</span>
          </span>
          {subtitle && (
            <span className="text-[10px] text-amber-600 font-semibold mt-0.5 font-mono tabular-nums">
              {subtitle}
            </span>
          )}
        </div>
      );
    }
    if (status === 'EXPIRED') {
      return (
        <div className="flex flex-col items-start">
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-rose-50 text-rose-700 border border-rose-200">
            <AlertCircle className="w-3 h-3 text-rose-600 shrink-0" />
            <span className="truncate max-w-[120px]">{text}</span>
          </span>
          {subtitle && (
            <span className="text-[10px] text-rose-600 font-semibold mt-0.5 font-mono tabular-nums">
              {subtitle}
            </span>
          )}
        </div>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-slate-100 text-slate-500">
        <HelpCircle className="w-3 h-3 text-slate-400 shrink-0" />
        <span className="truncate max-w-[120px]">{text || 'Missing'}</span>
      </span>
    );
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
      {/* Header bar */}
      <div className="px-5 py-3.5 bg-gradient-to-r from-slate-50 to-slate-100/60 border-b border-slate-200 flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-slate-900 text-white flex items-center justify-center shrink-0">
            <Users className="w-4 h-4 text-emerald-400" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h4 className="font-display font-bold text-xs uppercase tracking-wider text-slate-900">
                Bottom Section: Detailed Employee Compliance Roster
              </h4>
              <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200 font-mono tabular-nums">
                {totalEmployees} Matching Employees
              </span>
              {activeSubProject !== 'ALL' && (
                <span className="text-[10px] font-semibold text-blue-700 bg-blue-50 px-2 py-0.5 rounded-md border border-blue-200 flex items-center gap-1">
                  <span>Site: {activeSubProject}</span>
                  {onClearSubProjectFilter && (
                    <button
                      onClick={onClearSubProjectFilter}
                      className="ml-1 text-blue-400 hover:text-blue-800 cursor-pointer"
                      title="Clear site filter"
                    >
                      ×
                    </button>
                  )}
                </span>
              )}
            </div>
            <p className="text-[11px] text-slate-500 mt-0.5">
              Clear, individual employee compliance audit for Iqama, Ajeer, and Health Card.
            </p>
          </div>
        </div>

        {/* Search & Filter Toolbar */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Search box */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search name, ERP, role..."
              className="pl-8 pr-3 py-1.5 text-xs bg-white border border-slate-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 w-48 sm:w-60"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs cursor-pointer"
              >
                ×
              </button>
            )}
          </div>

          {/* Status Quick Filters */}
          <div className="flex items-center gap-1 bg-slate-100 p-0.5 rounded-lg border border-slate-200 text-xs">
            <button
              onClick={() => onSelectStatus('ALL')}
              className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition-colors cursor-pointer ${
                selectedStatus === 'ALL'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              All
            </button>
            <button
              onClick={() => onSelectStatus('VALID')}
              className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition-colors cursor-pointer ${
                selectedStatus === 'VALID'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'text-emerald-700 hover:bg-emerald-50'
              }`}
            >
              Valid
            </button>
            <button
              onClick={() => onSelectStatus('WARNING')}
              className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition-colors cursor-pointer ${
                selectedStatus === 'WARNING'
                  ? 'bg-amber-600 text-white shadow-xs'
                  : 'text-amber-800 hover:bg-amber-50'
              }`}
            >
              Expiring Soon
            </button>
            <button
              onClick={() => onSelectStatus('EXPIRED')}
              className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition-colors cursor-pointer ${
                selectedStatus === 'EXPIRED'
                  ? 'bg-rose-600 text-white shadow-xs'
                  : 'text-rose-700 hover:bg-rose-50'
              }`}
            >
              Action Req.
            </button>
          </div>
        </div>
      </div>

      {/* Table View */}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
              <th className="py-3 px-3 w-10 text-center font-mono">#</th>
              <th className="py-3 px-3 min-w-[170px]">Employee Name</th>
              <th className="py-3 px-3 font-mono min-w-[110px] text-slate-800 bg-slate-100/70 font-bold">
                {idColumnTitle}
              </th>
              <th className="py-3 px-3 font-mono">ERP ID</th>
              <th className="py-3 px-3">Designation / Role</th>
              <th className="py-3 px-3">Site / Sub-Project</th>
              <th className={`py-3 px-3 min-w-[140px] ${activePillar === 'IQAMA' ? 'bg-blue-50/70 font-bold text-blue-900' : ''}`}>
                <div className="flex items-center gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5 text-blue-600" />
                  <span>Iqama Status</span>
                </div>
              </th>
              <th className={`py-3 px-3 min-w-[140px] ${activePillar === 'AJEER' ? 'bg-emerald-50/70 font-bold text-emerald-900' : ''}`}>
                <div className="flex items-center gap-1.5">
                  <FileCheck className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Ajeer Permit</span>
                </div>
              </th>
              <th className={`py-3 px-3 min-w-[140px] ${activePillar === 'HEALTH' ? 'bg-rose-50/70 font-bold text-rose-900' : ''}`}>
                <div className="flex items-center gap-1.5">
                  <HeartPulse className="w-3.5 h-3.5 text-rose-600" />
                  <span>Health Card</span>
                </div>
              </th>
              <th className="py-3 px-3 text-center">Overall</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {paginatedEmployees.length === 0 ? (
              <tr>
                <td colSpan={10} className="py-12 text-center text-slate-400">
                  <Users className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                  <p className="font-semibold text-slate-600 text-sm">No employees match your search.</p>
                  <p className="text-xs text-slate-400 mt-1">Try adjusting the search query or status filter.</p>
                </td>
              </tr>
            ) : (
              paginatedEmployees.map((rec, idx) => {
                const rowNum = (currentPage - 1) * pageSize + idx + 1;
                const name = rec.data['EMPLOYEE NAME'] || 'Unnamed Employee';
                const erp = rec.data['ERP ID'] || '-';
                const desig = rec.data['DESIGNATION'] || 'Active Personnel';
                const subProject = (rec.data['SUB PROJECT'] || rec.data['SUB PROJECTS'] || rec.sub_project_name || 'MAIN').trim();
                const compliance = getEmployeeComplianceDetails(rec.data);

                // Row-level MIS or Ninja Picker ID resolution
                const rowProj = (rec.data['PROJECT NAME'] || rec.data['PROJECT'] || rec.project_name || '').trim();
                const isRowKeemart = /keemart/i.test(rowProj) || /keemart/i.test(subProject) || /^DS /i.test(subProject);
                const isRowNinja = /ninja/i.test(rowProj) || /^ninja/i.test(subProject);

                const misVal = (rec.data['MIS'] || rec.data['MIS ID'] || rec.data['MIS NO'] || rec.data['MIS NUMBER'] || '').trim();
                const pickerVal = (rec.data['NINJA PICKER ID'] || rec.data['PICKER ID'] || rec.data['NINJA ID'] || rec.data['PICKER'] || '').trim();

                let dynamicId = '-';
                if (isRowKeemart || isKeemartView) {
                  dynamicId = misVal || '-';
                } else if (isRowNinja || isNinjaView) {
                  dynamicId = pickerVal || '-';
                } else {
                  dynamicId = misVal || pickerVal || '-';
                }

                return (
                  <tr
                    key={rec.composite_id || idx}
                    className="hover:bg-slate-50/80 transition-colors"
                  >
                    <td className="py-2.5 px-3 text-center font-mono text-slate-400 text-[11px] tabular-nums">
                      {rowNum}
                    </td>

                    <td className="py-2.5 px-3">
                      <div className="font-semibold text-slate-900 leading-tight">
                        {name}
                      </div>
                      {rec.data['NATIONALITY'] && (
                        <div className="text-[10px] text-slate-400 mt-0.5">
                          {rec.data['NATIONALITY']}
                        </div>
                      )}
                    </td>

                    {/* Dynamic MIS / Ninja Picker ID Column directly beside Employee Name */}
                    <td className="py-2.5 px-3 font-mono text-[11px] tabular-nums bg-slate-50/40">
                      {dynamicId !== '-' ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded font-semibold bg-slate-100 text-slate-800 border border-slate-200">
                          {dynamicId}
                        </span>
                      ) : (
                        <span className="text-slate-300">-</span>
                      )}
                    </td>

                    <td className="py-2.5 px-3 font-mono text-slate-700 tabular-nums">
                      {erp}
                    </td>

                    <td className="py-2.5 px-3 text-slate-600 text-[11px] truncate max-w-[140px]" title={desig}>
                      {desig}
                    </td>

                    <td className="py-2.5 px-3 text-slate-600 text-[11px]">
                      <span className="bg-slate-100 text-slate-700 px-2 py-0.5 rounded font-medium">
                        {subProject}
                      </span>
                    </td>

                    {/* Iqama Status */}
                    <td className={`py-2.5 px-3 ${activePillar === 'IQAMA' ? 'bg-blue-50/30' : ''}`}>
                      {renderStatusBadge(
                        compliance.iqama.status,
                        compliance.iqama.text,
                        compliance.iqama.number && compliance.iqama.number !== compliance.iqama.text
                          ? compliance.iqama.number
                          : undefined
                      )}
                    </td>

                    {/* Ajeer Status */}
                    <td className={`py-2.5 px-3 ${activePillar === 'AJEER' ? 'bg-emerald-50/30' : ''}`}>
                      {renderStatusBadge(
                        compliance.ajeer.status,
                        compliance.ajeer.text,
                        compliance.ajeer.daysRemaining !== undefined
                          ? compliance.ajeer.daysRemaining > 0
                            ? `Expires in ${compliance.ajeer.daysRemaining} days`
                            : `Expired ${Math.abs(compliance.ajeer.daysRemaining)} days ago`
                          : undefined
                      )}
                    </td>

                    {/* Health Card Status */}
                    <td className={`py-2.5 px-3 ${activePillar === 'HEALTH' ? 'bg-rose-50/30' : ''}`}>
                      {renderStatusBadge(
                        compliance.health.status,
                        compliance.health.text,
                        compliance.health.daysRemaining !== undefined
                          ? compliance.health.daysRemaining > 0
                            ? `Expires in ${compliance.health.daysRemaining} days`
                            : `Expired ${Math.abs(compliance.health.daysRemaining)} days ago`
                          : undefined
                      )}
                    </td>

                    {/* Overall Status */}
                    <td className="py-2.5 px-3 text-center">
                      {compliance.overallStatus === 'VALID' ? (
                        <span className="inline-block w-2.5 h-2.5 rounded-full bg-emerald-500" title="All Requirements Valid" />
                      ) : compliance.overallStatus === 'WARNING' ? (
                        <span className="inline-block w-2.5 h-2.5 rounded-full bg-amber-500" title="Expiring Soon" />
                      ) : (
                        <span className="inline-block w-2.5 h-2.5 rounded-full bg-rose-500" title="Action Required" />
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination Footer */}
      {totalEmployees > 0 && (
        <div className="px-5 py-3 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-500">
          <div className="flex items-center gap-2">
            <span>Showing</span>
            <span className="font-semibold text-slate-800 font-mono tabular-nums">
              {(currentPage - 1) * pageSize + 1}
            </span>
            <span>to</span>
            <span className="font-semibold text-slate-800 font-mono tabular-nums">
              {Math.min(currentPage * pageSize, totalEmployees)}
            </span>
            <span>of</span>
            <span className="font-semibold text-slate-800 font-mono tabular-nums">
              {totalEmployees}
            </span>
            <span>employees</span>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5">
              <span>Per page:</span>
              <select
                value={pageSize}
                onChange={(e) => {
                  setPageSize(Number(e.target.value));
                  setCurrentPage(1);
                }}
                className="bg-white border border-slate-300 rounded px-2 py-1 text-xs text-slate-700 font-mono"
              >
                <option value={25}>25</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
                <option value={250}>250</option>
              </select>
            </div>

            <div className="flex items-center gap-1">
              <button
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage <= 1}
                className="p-1 rounded border border-slate-300 bg-white hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                title="Previous page"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>

              <span className="font-mono text-xs px-2 font-semibold text-slate-800">
                {currentPage} / {totalPages}
              </span>

              <button
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage >= totalPages}
                className="p-1 rounded border border-slate-300 bg-white hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                title="Next page"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
