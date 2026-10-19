import React, { useState, useMemo } from 'react';
import { RecordItemData, KPIStatus } from '../types';
import { classifyKPIValue } from '../utils/kpiEngine';
import {
  Search,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  X,
  Filter,
  CheckCircle,
  AlertTriangle,
  XCircle,
  HelpCircle,
} from 'lucide-react';

interface DataTableProps {
  records: RecordItemData[];
  visibleColumns: string[];
  activeKpi: string;
  selectedStatus: KPIStatus | 'ALL';
  onSelectStatus: (status: KPIStatus | 'ALL') => void;
  projectColumn: string;
  subProjectColumn: string;
}

export const DataTable: React.FC<DataTableProps> = ({
  records,
  visibleColumns,
  activeKpi,
  selectedStatus,
  onSelectStatus,
  projectColumn,
  subProjectColumn,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [sortColumn, setSortColumn] = useState<string>('');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  // Filter and sort records
  const filteredAndSortedRecords = useMemo(() => {
    let result = records.filter((r) => {
      // 0. Enforce Active Workforce only
      const statusKey = Object.keys(r.data).find((k) => k.trim().toUpperCase() === 'STATUS');
      if (statusKey) {
        const statusVal = (r.data[statusKey] || '').trim().toUpperCase();
        if (statusVal && statusVal !== 'ACTIVE') return false;
      }

      // 1. Status Filter
      if (selectedStatus !== 'ALL') {
        let val = r.data[activeKpi];
        if (val === undefined) {
          const matchKey = Object.keys(r.data).find(
            (k) => k.toLowerCase() === activeKpi.toLowerCase() || k.toLowerCase().includes(activeKpi.toLowerCase())
          );
          if (matchKey) val = r.data[matchKey];
        }
        const { status } = classifyKPIValue(val);
        if (status !== selectedStatus) return false;
      }

      // 2. Search Filter
      if (searchTerm.trim()) {
        const query = searchTerm.toLowerCase();
        const matchesProject = (r.project_name || '').toLowerCase().includes(query);
        const matchesSubProject = (r.sub_project_name || '').toLowerCase().includes(query);
        const matchesTab = (r.sheet_tab || '').toLowerCase().includes(query);
        const matchesData = visibleColumns.some((col) => {
          const val = r.data[col];
          return val && String(val).toLowerCase().includes(query);
        });

        if (!matchesProject && !matchesSubProject && !matchesTab && !matchesData) {
          return false;
        }
      }

      return true;
    });

    // 3. Sort
    if (sortColumn) {
      result.sort((a, b) => {
        let valA = a.data[sortColumn] || '';
        let valB = b.data[sortColumn] || '';

        // If sorting by project or subproject
        if (sortColumn === 'Project') {
          valA = a.project_name;
          valB = b.project_name;
        } else if (sortColumn === 'Sub-Project') {
          valA = a.sub_project_name;
          valB = b.sub_project_name;
        } else if (sortColumn === 'Tab') {
          valA = a.sheet_tab;
          valB = b.sheet_tab;
        }

        const cmp = valA.localeCompare(valB, undefined, { numeric: true, sensitivity: 'base' });
        return sortDirection === 'asc' ? cmp : -cmp;
      });
    }

    return result;
  }, [records, selectedStatus, activeKpi, searchTerm, sortColumn, sortDirection, visibleColumns]);

  // Pagination slice
  const totalPages = Math.ceil(filteredAndSortedRecords.length / pageSize) || 1;
  const paginatedRecords = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredAndSortedRecords.slice(start, start + pageSize);
  }, [filteredAndSortedRecords, currentPage, pageSize]);

  const handleSort = (column: string) => {
    if (sortColumn === column) {
      if (sortDirection === 'asc') {
        setSortDirection('desc');
      } else {
        setSortColumn('');
      }
    } else {
      setSortColumn(column);
      setSortDirection('asc');
    }
  };

  // Status cell renderer
  const renderCell = (colName: string, val: string) => {
    const isKpiCol = colName === activeKpi;

    if (isKpiCol) {
      const { status, daysRemaining, formattedText } = classifyKPIValue(val);

      if (status === 'VALID') {
        return (
          <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-800 border border-emerald-200/80 text-[11px] font-semibold">
            <CheckCircle className="w-3 h-3 text-emerald-600 shrink-0" />
            <span className="truncate max-w-[130px]">{formattedText}</span>
            {daysRemaining !== undefined && (
              <span className="font-mono text-[10px] text-emerald-600 font-normal">
                ({daysRemaining}d left)
              </span>
            )}
          </div>
        );
      } else if (status === 'WARNING') {
        return (
          <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-amber-50 text-amber-800 border border-amber-200/80 text-[11px] font-semibold">
            <AlertTriangle className="w-3 h-3 text-amber-600 shrink-0" />
            <span className="truncate max-w-[130px]">{formattedText}</span>
            {daysRemaining !== undefined && (
              <span className="font-mono text-[10px] text-amber-700 font-bold">
                ({daysRemaining}d)
              </span>
            )}
          </div>
        );
      } else if (status === 'EXPIRED') {
        return (
          <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-rose-50 text-rose-800 border border-rose-200/80 text-[11px] font-semibold">
            <XCircle className="w-3 h-3 text-rose-600 shrink-0" />
            <span className="truncate max-w-[130px]">{formattedText}</span>
            {daysRemaining !== undefined && (
              <span className="font-mono text-[10px] text-rose-700 font-normal">
                ({Math.abs(daysRemaining)}d ago)
              </span>
            )}
          </div>
        );
      } else {
        return <span className="text-slate-300 font-mono text-xs">-</span>;
      }
    }

    if (colName.toUpperCase() === 'STATUS') {
      const isAct = (val || 'ACTIVE').toUpperCase() === 'ACTIVE';
      return (
        <span
          className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-semibold ${
            isAct
              ? 'bg-emerald-50 text-emerald-800 border border-emerald-200/70'
              : 'bg-slate-100 text-slate-600 border border-slate-200'
          }`}
        >
          {isAct && <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>}
          <span>{val || 'ACTIVE'}</span>
        </span>
      );
    }

    if (!val || val.trim() === '') {
      return <span className="text-slate-300 font-mono text-xs">-</span>;
    }

    // Tabular numerals for IDs, dates, phone numbers
    const isNumOrDate = /^\d+$/.test(val) || /\d{2}[-/]\d{2}[-/]\d{4}/.test(val);

    return (
      <span
        className={`truncate block max-w-[180px] ${
          isNumOrDate ? 'font-mono tabular-nums text-slate-800' : 'text-slate-700'
        }`}
        title={val}
      >
        {val}
      </span>
    );
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-[0_1px_2px_rgba(0,0,0,0.03)] overflow-hidden">
      {/* Search & Filter Bar */}
      <div className="p-4 border-b border-slate-200 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-slate-50/50">
        <div className="flex-1 relative">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search employee name, ERP ID, nationality, project, iqama, or any field..."
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              setCurrentPage(1);
            }}
            className="w-full pl-9 pr-9 py-2 bg-white border border-slate-200 rounded-lg text-xs placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-900"
          />
          {searchTerm && (
            <button
              onClick={() => {
                setSearchTerm('');
                setCurrentPage(1);
              }}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5 cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Status Quick Filter Pills */}
        <div className="flex items-center gap-1 overflow-x-auto pb-1 sm:pb-0 scrollbar-none">
          <span className="text-[11px] font-semibold text-slate-400 px-1 uppercase tracking-wider shrink-0 flex items-center gap-1">
            <Filter className="w-3 h-3" /> Filter:
          </span>
          {(['ALL', 'VALID', 'WARNING', 'EXPIRED', 'MISSING'] as const).map((st) => {
            const isSelected = selectedStatus === st;
            const labels: Record<string, string> = {
              ALL: 'All Statuses',
              VALID: 'Compliant',
              WARNING: 'Expiring',
              EXPIRED: 'Expired',
              MISSING: 'Unset',
            };

            return (
              <button
                key={st}
                onClick={() => {
                  onSelectStatus(st);
                  setCurrentPage(1);
                }}
                className={`px-2.5 py-1 text-xs font-medium rounded-md whitespace-nowrap transition-colors cursor-pointer shrink-0 ${
                  isSelected
                    ? 'bg-slate-900 text-white font-semibold'
                    : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                }`}
              >
                {labels[st]}
              </button>
            );
          })}
        </div>
      </div>

      {/* Main Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse text-xs">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50/80 text-slate-600 font-semibold uppercase tracking-wider text-[11px]">
              <th className="py-2.5 px-3 w-12 text-center text-slate-400">#</th>
              <th
                onClick={() => handleSort('Sub-Project')}
                className="py-2.5 px-3.5 cursor-pointer hover:bg-slate-100/60 select-none whitespace-nowrap"
              >
                <div className="flex items-center gap-1.5">
                  <span>Sub-Project</span>
                  {sortColumn === 'Sub-Project' ? (
                    sortDirection === 'asc' ? <ArrowUp className="w-3 h-3 text-slate-900" /> : <ArrowDown className="w-3 h-3 text-slate-900" />
                  ) : (
                    <ArrowUpDown className="w-3 h-3 text-slate-300" />
                  )}
                </div>
              </th>

              {visibleColumns.map((col) => {
                const isKpi = col === activeKpi;
                return (
                  <th
                    key={col}
                    onClick={() => handleSort(col)}
                    className={`py-2.5 px-3.5 cursor-pointer hover:bg-slate-100/60 select-none whitespace-nowrap ${
                      isKpi ? 'bg-emerald-50/50 text-emerald-950 font-bold border-b-2 border-emerald-600' : ''
                    }`}
                  >
                    <div className="flex items-center gap-1.5">
                      <span>{col}</span>
                      {isKpi && (
                        <span className="text-[9px] bg-emerald-200/80 text-emerald-900 px-1 py-0.2 rounded font-bold uppercase">
                          Active KPI
                        </span>
                      )}
                      {sortColumn === col ? (
                        sortDirection === 'asc' ? <ArrowUp className="w-3 h-3 text-slate-900" /> : <ArrowDown className="w-3 h-3 text-slate-900" />
                      ) : (
                        <ArrowUpDown className="w-3 h-3 text-slate-300" />
                      )}
                    </div>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {paginatedRecords.length === 0 ? (
              <tr>
                <td
                  colSpan={visibleColumns.length + 2}
                  className="py-12 text-center text-slate-400 text-xs"
                >
                  <p className="font-semibold text-slate-600 text-sm mb-1">
                    No matching records found
                  </p>
                  <p className="text-slate-400">
                    Try adjusting your search terms, status filter, or clearing sub-project selection.
                  </p>
                </td>
              </tr>
            ) : (
              paginatedRecords.map((rec, index) => {
                const rowIndex = (currentPage - 1) * pageSize + index + 1;
                return (
                  <tr
                    key={rec.composite_id}
                    className="hover:bg-slate-50/70 transition-colors"
                  >
                    <td className="py-2.5 px-3 text-center font-mono tabular-nums text-slate-400 text-[11px]">
                      {rowIndex}
                    </td>
                    <td className="py-2.5 px-3.5 text-slate-700 font-medium whitespace-nowrap">
                      <span className="truncate max-w-[140px] block" title={rec.sub_project_name}>
                        {rec.sub_project_name}
                      </span>
                    </td>
                    {visibleColumns.map((col) => (
                      <td
                        key={col}
                        className={`py-2 px-3.5 whitespace-nowrap ${
                          col === activeKpi ? 'bg-emerald-50/20' : ''
                        }`}
                      >
                        {renderCell(col, rec.data[col] || '')}
                      </td>
                    ))}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination Footer */}
      <div className="px-4 py-3 border-t border-slate-200 bg-slate-50/60 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-600">
        <div className="flex items-center gap-3">
          <span>
            Showing <strong className="font-mono tabular-nums text-slate-900">{filteredAndSortedRecords.length > 0 ? (currentPage - 1) * pageSize + 1 : 0}</strong> to{' '}
            <strong className="font-mono tabular-nums text-slate-900">
              {Math.min(currentPage * pageSize, filteredAndSortedRecords.length)}
            </strong>{' '}
            of <strong className="font-mono tabular-nums text-slate-900">{filteredAndSortedRecords.length}</strong> entries
          </span>
          <div className="flex items-center gap-1.5">
            <span className="text-slate-400">Rows per page:</span>
            <select
              value={pageSize}
              onChange={(e) => {
                setPageSize(Number(e.target.value));
                setCurrentPage(1);
              }}
              className="px-2 py-1 bg-white border border-slate-200 rounded text-xs focus:outline-none cursor-pointer"
            >
              {[25, 50, 100, 250].map((sz) => (
                <option key={sz} value={sz}>
                  {sz}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex items-center gap-1">
          <button
            onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
            disabled={currentPage === 1}
            className="px-2.5 py-1 rounded border border-slate-200 bg-white hover:bg-slate-100 disabled:opacity-40 disabled:hover:bg-white text-xs font-medium cursor-pointer"
          >
            Previous
          </button>
          <span className="px-2 font-mono tabular-nums text-slate-700">
            Page {currentPage} of {totalPages}
          </span>
          <button
            onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
            disabled={currentPage === totalPages}
            className="px-2.5 py-1 rounded border border-slate-200 bg-white hover:bg-slate-100 disabled:opacity-40 disabled:hover:bg-white text-xs font-medium cursor-pointer"
          >
            Next
          </button>
        </div>
      </div>
    </div>
  );
};
