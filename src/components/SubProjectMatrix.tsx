import React, { useState, useMemo } from 'react';
import { ProjectHierarchyGroup } from '../types';
import {
  ChevronDown,
  ChevronRight,
  MapPin,
  Check,
  Building2,
  FolderTree,
  Filter,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  HelpCircle,
  Maximize2,
  Minimize2,
} from 'lucide-react';

interface SubProjectMatrixProps {
  hierarchy: ProjectHierarchyGroup[];
  activeProject: string;
  activeSubProject: string;
  onSelectProject: (project: string) => void;
  onSelectSubProject: (project: string, subProject: string) => void;
  activeKpi: string;
}

export const SubProjectMatrix: React.FC<SubProjectMatrixProps> = ({
  hierarchy,
  activeProject,
  activeSubProject,
  onSelectProject,
  onSelectSubProject,
  activeKpi,
}) => {
  // Track expanded state for each project (default all expanded for high visibility)
  const [expandedProjects, setExpandedProjects] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {};
    for (const group of hierarchy) {
      initial[group.projectName] = true;
    }
    return initial;
  });

  const toggleExpand = (projectName: string) => {
    setExpandedProjects((prev) => ({
      ...prev,
      [projectName]: !prev[projectName],
    }));
  };

  const expandAll = () => {
    const all: Record<string, boolean> = {};
    for (const group of hierarchy) {
      all[group.projectName] = true;
    }
    setExpandedProjects(all);
  };

  const collapseAll = () => {
    const none: Record<string, boolean> = {};
    for (const group of hierarchy) {
      none[group.projectName] = false;
    }
    setExpandedProjects(none);
  };

  // Calculate grand totals across all active projects
  const grandTotals = useMemo(() => {
    let totalWorkforce = 0;
    let totalValid = 0;
    let totalWarning = 0;
    let totalExpired = 0;
    let totalMissing = 0;
    let totalLocations = 0;

    for (const p of hierarchy) {
      totalWorkforce += p.total;
      totalValid += p.valid;
      totalWarning += p.warning;
      totalExpired += p.expired;
      totalMissing += p.missing;
      totalLocations += p.subProjects.length;
    }

    const nonMissing = totalWorkforce - totalMissing;
    const overallCompliance =
      nonMissing > 0
        ? Math.round((totalValid / nonMissing) * 100)
        : totalWorkforce > 0
        ? Math.round((totalValid / totalWorkforce) * 100)
        : 0;

    return {
      totalWorkforce,
      totalValid,
      totalWarning,
      totalExpired,
      totalMissing,
      totalLocations,
      overallCompliance,
    };
  }, [hierarchy]);

  if (!hierarchy || hierarchy.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-slate-200 p-8 text-center text-slate-500 shadow-xs">
        <FolderTree className="w-8 h-8 text-slate-400 mx-auto mb-2" />
        <p className="text-sm font-semibold text-slate-700">No project data available</p>
        <p className="text-xs text-slate-400 mt-1">Synchronize sheets to populate the hierarchical report.</p>
      </div>
    );
  }

  // Get project accent badge styling
  const getProjectBadge = (projectName: string) => {
    const upper = projectName.toUpperCase();
    if (upper.includes('DARK STORE')) {
      return 'bg-amber-50 text-amber-800 border-amber-200/80';
    }
    if (upper.includes('QC')) {
      return 'bg-emerald-50 text-emerald-800 border-emerald-200/80';
    }
    if (upper.includes('DC')) {
      return 'bg-cyan-50 text-cyan-800 border-cyan-200/80';
    }
    if (upper.includes('NINJA')) {
      return 'bg-purple-50 text-purple-800 border-purple-200/80';
    }
    if (upper.includes('PIF')) {
      return 'bg-blue-50 text-blue-800 border-blue-200/80';
    }
    if (upper.includes('9ROUND')) {
      return 'bg-rose-50 text-rose-800 border-rose-200/80';
    }
    if (upper.includes('CHEFZ')) {
      return 'bg-orange-50 text-orange-800 border-orange-200/80';
    }
    if (upper.includes('PILATES')) {
      return 'bg-teal-50 text-teal-800 border-teal-200/80';
    }
    if (upper.includes('SAFOOD')) {
      return 'bg-indigo-50 text-indigo-800 border-indigo-200/80';
    }
    return 'bg-slate-100 text-slate-700 border-slate-200';
  };

  const isFiltered = activeProject !== 'ALL' || activeSubProject !== 'ALL';

  return (
    <div className="bg-white rounded-xl border border-slate-200/90 overflow-hidden shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
      {/* Header bar (CSS: div#root > div > main > div:nth-of-type(4) > div:nth-of-type(1)) */}
      <div className="px-5 py-4 bg-gradient-to-r from-slate-50 via-slate-50/80 to-slate-100/70 border-b border-slate-200 flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-slate-900 text-white flex items-center justify-center shadow-xs shrink-0">
            <Building2 className="w-5 h-5 text-emerald-400" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-display font-bold text-sm text-slate-900 tracking-tight">
                Project &amp; Sub-Project Executive Compliance Report
              </h3>
              <span className="text-[11px] font-semibold text-slate-700 bg-white px-2.5 py-0.5 rounded-full border border-slate-200 shadow-xs font-mono tabular-nums">
                {hierarchy.length} Projects · {grandTotals.totalLocations} Sub-Projects
              </span>
              <span className="text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200/70 font-mono tabular-nums">
                {grandTotals.totalWorkforce} Active Employees
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Aggregated site-level compliance metrics for <strong className="text-slate-800 font-semibold">{activeKpi}</strong>
            </p>
          </div>
        </div>

        {/* Header Right Actions */}
        <div className="flex items-center gap-2 flex-wrap">
          {isFiltered && (
            <button
              onClick={() => {
                onSelectProject('ALL');
                onSelectSubProject('ALL', 'ALL');
              }}
              className="text-xs font-semibold text-blue-600 hover:text-blue-800 hover:bg-blue-50 px-2.5 py-1.5 rounded-lg border border-blue-200 transition-colors cursor-pointer flex items-center gap-1.5"
            >
              <Filter className="w-3.5 h-3.5" />
              <span>Reset Location Filter</span>
            </button>
          )}

          <div className="flex items-center bg-white border border-slate-200 rounded-lg p-0.5 shadow-xs">
            <button
              onClick={expandAll}
              className="px-2.5 py-1 text-xs font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-50 rounded-md transition-colors cursor-pointer flex items-center gap-1"
              title="Expand all projects"
            >
              <Maximize2 className="w-3 h-3" />
              <span className="hidden sm:inline">Expand All</span>
            </button>
            <span className="h-3.5 w-px bg-slate-200 mx-0.5" />
            <button
              onClick={collapseAll}
              className="px-2.5 py-1 text-xs font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-50 rounded-md transition-colors cursor-pointer flex items-center gap-1"
              title="Collapse all projects"
            >
              <Minimize2 className="w-3 h-3" />
              <span className="hidden sm:inline">Collapse All</span>
            </button>
          </div>
        </div>
      </div>

      {/* Hierarchical Grouped Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse text-xs">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50/90 text-slate-600 font-semibold uppercase tracking-wider text-[11px]">
              <th className="py-3 px-4 w-72">Project / Sub-Project Location</th>
              <th className="py-3 px-3 text-center w-28">Sub-Projects</th>
              <th className="py-3 px-3 text-right">Active Workforce</th>
              <th className="py-3 px-3 text-right text-emerald-700">Valid / Issued</th>
              <th className="py-3 px-3 text-right text-amber-700">Expiring Soon</th>
              <th className="py-3 px-3 text-right text-rose-700">Expired</th>
              <th className="py-3 px-3 text-right text-slate-400">Missing</th>
              <th className="py-3 px-4 text-left w-60">Compliance Status</th>
              <th className="py-3 px-3 text-center w-20">Filter</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {hierarchy.map((projectGroup) => {
              const isExpanded = Boolean(expandedProjects[projectGroup.projectName]);
              const isProjectSelected = activeProject === projectGroup.projectName;

              return (
                <React.Fragment key={projectGroup.projectName}>
                  {/* Project Parent Row */}
                  <tr
                    className={`transition-colors border-t border-slate-200/90 ${
                      isProjectSelected
                        ? 'bg-blue-50/90 font-medium'
                        : 'bg-slate-100/70 hover:bg-slate-100 text-slate-800'
                    }`}
                  >
                    {/* Project Title with Expand Button */}
                    <td className="py-3 px-4 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => toggleExpand(projectGroup.projectName)}
                          className="p-1 rounded-md hover:bg-slate-200/80 text-slate-500 hover:text-slate-900 transition-colors cursor-pointer"
                          title={isExpanded ? 'Collapse' : 'Expand'}
                        >
                          {isExpanded ? (
                            <ChevronDown className="w-4 h-4 text-slate-700" />
                          ) : (
                            <ChevronRight className="w-4 h-4 text-slate-700" />
                          )}
                        </button>

                        <span
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold uppercase tracking-wide border shadow-xs ${getProjectBadge(
                            projectGroup.projectName
                          )}`}
                        >
                          <Building2 className="w-3.5 h-3.5" />
                          <span>{projectGroup.projectName}</span>
                        </span>
                      </div>
                    </td>

                    {/* Sub-Projects Count */}
                    <td className="py-3 px-3 text-center whitespace-nowrap">
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-white border border-slate-200 text-slate-600 shadow-xs font-mono">
                        {projectGroup.subProjects.length} {projectGroup.subProjects.length === 1 ? 'Site' : 'Sites'}
                      </span>
                    </td>

                    {/* Active Workforce */}
                    <td className="py-3 px-3 text-right font-mono font-bold text-slate-900 tabular-nums">
                      {projectGroup.total}
                    </td>

                    {/* Valid */}
                    <td className="py-3 px-3 text-right font-mono font-bold text-emerald-700 tabular-nums">
                      {projectGroup.valid}
                    </td>

                    {/* Expiring Soon */}
                    <td className="py-3 px-3 text-right font-mono font-bold text-amber-700 tabular-nums">
                      {projectGroup.warning}
                    </td>

                    {/* Expired */}
                    <td className="py-3 px-3 text-right font-mono font-bold text-rose-700 tabular-nums">
                      {projectGroup.expired}
                    </td>

                    {/* Missing */}
                    <td className="py-3 px-3 text-right font-mono text-slate-400 tabular-nums">
                      {projectGroup.missing}
                    </td>

                    {/* Compliance Progress Bar */}
                    <td className="py-3 px-4">
                      <div className="space-y-1">
                        <div className="flex items-center justify-between text-[11px] font-mono">
                          <span className="font-bold text-slate-800">
                            {projectGroup.compliancePct}%
                          </span>
                          <span className="text-[10px] text-slate-500">
                            {projectGroup.valid}/{projectGroup.total} compliant
                          </span>
                        </div>
                        <div className="w-full bg-slate-200 rounded-full h-2 overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all duration-300 ${
                              projectGroup.compliancePct >= 90
                                ? 'bg-emerald-500'
                                : projectGroup.compliancePct >= 70
                                ? 'bg-amber-500'
                                : 'bg-rose-500'
                            }`}
                            style={{ width: `${Math.min(projectGroup.compliancePct, 100)}%` }}
                          />
                        </div>
                      </div>
                    </td>

                    {/* Action Filter Button */}
                    <td className="py-3 px-3 text-center whitespace-nowrap">
                      <button
                        onClick={() => {
                          if (isProjectSelected && activeSubProject === 'ALL') {
                            onSelectProject('ALL');
                          } else {
                            onSelectProject(projectGroup.projectName);
                            onSelectSubProject(projectGroup.projectName, 'ALL');
                          }
                        }}
                        className={`p-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                          isProjectSelected && activeSubProject === 'ALL'
                            ? 'bg-blue-600 text-white'
                            : 'text-slate-600 hover:bg-slate-200/80 hover:text-slate-900'
                        }`}
                        title={`Filter all ${projectGroup.projectName} data`}
                      >
                        {isProjectSelected && activeSubProject === 'ALL' ? (
                          <Check className="w-3.5 h-3.5" />
                        ) : (
                          <Filter className="w-3.5 h-3.5" />
                        )}
                      </button>
                    </td>
                  </tr>

                  {/* Sub-Project Child Rows */}
                  {isExpanded &&
                    projectGroup.subProjects.map((sub, idx) => {
                      const isSubSelected =
                        activeProject === projectGroup.projectName &&
                        activeSubProject === sub.subProjectName;

                      return (
                        <tr
                          key={`${projectGroup.projectName}-${sub.subProjectName}`}
                          onClick={() => {
                            if (isSubSelected) {
                              onSelectSubProject(projectGroup.projectName, 'ALL');
                            } else {
                              onSelectProject(projectGroup.projectName);
                              onSelectSubProject(projectGroup.projectName, sub.subProjectName);
                            }
                          }}
                          className={`transition-colors cursor-pointer group ${
                            isSubSelected
                              ? 'bg-blue-50/90 font-medium'
                              : idx % 2 === 0
                              ? 'bg-white hover:bg-slate-50'
                              : 'bg-slate-50/40 hover:bg-slate-50'
                          }`}
                        >
                          {/* Indented Sub-Project Name */}
                          <td className="py-2.5 px-4 pl-10 whitespace-nowrap">
                            <div className="flex items-center gap-2">
                              <span className="text-slate-300 font-mono text-[11px] select-none">
                                └─
                              </span>
                              {isSubSelected ? (
                                <span className="w-4 h-4 rounded-full bg-blue-600 text-white flex items-center justify-center text-[10px] shrink-0 shadow-xs">
                                  <Check className="w-2.5 h-2.5" />
                                </span>
                              ) : (
                                <MapPin className="w-3.5 h-3.5 text-slate-400 group-hover:text-blue-600 transition-colors shrink-0" />
                              )}
                              <span className="font-semibold text-slate-900 text-xs truncate max-w-[240px]">
                                {sub.subProjectName}
                              </span>
                            </div>
                          </td>

                          {/* Site Tag */}
                          <td className="py-2.5 px-3 text-center whitespace-nowrap">
                            <span className="text-[10px] text-slate-400 font-mono">
                              #{idx + 1}
                            </span>
                          </td>

                          {/* Workforce */}
                          <td className="py-2.5 px-3 text-right font-mono text-slate-800 tabular-nums">
                            {sub.total}
                          </td>

                          {/* Valid */}
                          <td className="py-2.5 px-3 text-right font-mono text-emerald-700 font-medium tabular-nums">
                            {sub.valid}
                          </td>

                          {/* Expiring Soon */}
                          <td className="py-2.5 px-3 text-right font-mono text-amber-700 font-medium tabular-nums">
                            {sub.warning}
                          </td>

                          {/* Expired */}
                          <td className="py-2.5 px-3 text-right font-mono text-rose-700 font-medium tabular-nums">
                            {sub.expired}
                          </td>

                          {/* Missing */}
                          <td className="py-2.5 px-3 text-right font-mono text-slate-400 tabular-nums">
                            {sub.missing}
                          </td>

                          {/* Compliance Bar */}
                          <td className="py-2.5 px-4">
                            <div className="space-y-1">
                              <div className="flex items-center justify-between text-[10px] font-mono">
                                <span className="font-semibold text-slate-700">
                                  {sub.compliancePct}%
                                </span>
                                <span className="text-slate-400">
                                  {sub.valid}/{sub.total}
                                </span>
                              </div>
                              <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                                <div
                                  className={`h-full rounded-full transition-all duration-300 ${
                                    sub.compliancePct >= 90
                                      ? 'bg-emerald-500'
                                      : sub.compliancePct >= 70
                                      ? 'bg-amber-500'
                                      : 'bg-rose-500'
                                  }`}
                                  style={{ width: `${Math.min(sub.compliancePct, 100)}%` }}
                                />
                              </div>
                            </div>
                          </td>

                          {/* Action Icon */}
                          <td className="py-2.5 px-3 text-center whitespace-nowrap">
                            <span
                              className={`text-[11px] font-semibold transition-colors ${
                                isSubSelected
                                  ? 'text-blue-600 font-bold'
                                  : 'text-slate-400 group-hover:text-blue-600'
                              }`}
                            >
                              {isSubSelected ? 'Active' : 'Select'}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                </React.Fragment>
              );
            })}
          </tbody>

          {/* Grand Totals Summary Row */}
          <tfoot>
            <tr className="border-t-2 border-slate-300 bg-slate-900 text-white font-semibold">
              <td className="py-3 px-4">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-400" />
                  <span className="text-xs uppercase tracking-wider font-bold">
                    Portfolio Grand Total
                  </span>
                </div>
              </td>
              <td className="py-3 px-3 text-center font-mono text-xs text-slate-300">
                {grandTotals.totalLocations} Sites
              </td>
              <td className="py-3 px-3 text-right font-mono text-xs font-bold text-white tabular-nums">
                {grandTotals.totalWorkforce}
              </td>
              <td className="py-3 px-3 text-right font-mono text-xs font-bold text-emerald-400 tabular-nums">
                {grandTotals.totalValid}
              </td>
              <td className="py-3 px-3 text-right font-mono text-xs font-bold text-amber-400 tabular-nums">
                {grandTotals.totalWarning}
              </td>
              <td className="py-3 px-3 text-right font-mono text-xs font-bold text-rose-400 tabular-nums">
                {grandTotals.totalExpired}
              </td>
              <td className="py-3 px-3 text-right font-mono text-xs text-slate-400 tabular-nums">
                {grandTotals.totalMissing}
              </td>
              <td className="py-3 px-4">
                <div className="flex items-center justify-between text-xs font-mono">
                  <span className="font-bold text-emerald-400">
                    {grandTotals.overallCompliance}% Overall
                  </span>
                  <span className="text-[10px] text-slate-300">
                    {grandTotals.totalValid}/{grandTotals.totalWorkforce}
                  </span>
                </div>
              </td>
              <td className="py-3 px-3 text-center">
                <span className="text-[10px] font-mono text-slate-400 uppercase">
                  All
                </span>
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
};
