import React from 'react';
import { Building2, Users, ChevronRight, CheckCircle2, AlertTriangle, AlertCircle } from 'lucide-react';
import { RecordItemData, CorePillarKey } from '../types';
import { getEmployeeComplianceDetails } from '../utils/kpiEngine';

export interface SubProjectStats {
  projectName: string;
  subProjectName: string;
  totalEmployees: number;
  iqamaValid: number;
  iqamaCompliancePct: number;
  ajeerValid: number;
  ajeerCompliancePct: number;
  healthValid: number;
  healthCompliancePct: number;
  overallCompliancePct: number;
  records: RecordItemData[];
}

interface SubProjectOverviewGridProps {
  records: RecordItemData[];
  activeProject: string;
  activeSubProject: string;
  onSelectSubProject: (subProjectName: string) => void;
  activePillar: CorePillarKey;
}

export const SubProjectOverviewGrid: React.FC<SubProjectOverviewGridProps> = ({
  records,
  activeProject,
  activeSubProject,
  onSelectSubProject,
  activePillar,
}) => {
  // Aggregate stats by sub-project
  const subProjectStats = React.useMemo(() => {
    const map = new Map<string, { projectName: string; records: RecordItemData[] }>();

    for (const rec of records) {
      const proj = (rec.data['PROJECT NAME'] || rec.data['PROJECT'] || rec.project_name || 'General').trim();
      let sp = (rec.data['SUB PROJECT'] || rec.data['SUB PROJECTS'] || rec.sub_project_name || 'MAIN').trim();
      if (sp.includes('@') || sp.endsWith('.com')) {
        sp = 'MAIN';
      }
      const displayName = sp === 'MAIN' ? proj : sp;

      if (!map.has(displayName)) {
        map.set(displayName, { projectName: proj, records: [] });
      }
      map.get(displayName)!.records.push(rec);
    }

    const list: SubProjectStats[] = [];

    map.forEach(({ projectName, records: spRecords }, spName) => {
      let iqamaValid = 0;
      let ajeerValid = 0;
      let healthValid = 0;
      let totalValidPoints = 0;

      for (const rec of spRecords) {
        const c = getEmployeeComplianceDetails(rec.data);
        if (c.iqama.status === 'VALID') iqamaValid++;
        if (c.ajeer.status === 'VALID') ajeerValid++;
        if (c.health.status === 'VALID') healthValid++;

        if (c.overallStatus === 'VALID') totalValidPoints++;
      }

      const total = spRecords.length || 1;
      const iqamaCompliancePct = Math.round((iqamaValid / total) * 100);
      const ajeerCompliancePct = Math.round((ajeerValid / total) * 100);
      const healthCompliancePct = Math.round((healthValid / total) * 100);
      const overallCompliancePct = Math.round((totalValidPoints / total) * 100);

      list.push({
        projectName,
        subProjectName: spName,
        totalEmployees: spRecords.length,
        iqamaValid,
        iqamaCompliancePct,
        ajeerValid,
        ajeerCompliancePct,
        healthValid,
        healthCompliancePct,
        overallCompliancePct,
        records: spRecords,
      });
    });

    // Sort by employee count descending
    return list.sort((a, b) => b.totalEmployees - a.totalEmployees);
  }, [records]);

  // Overall total across current records
  const totalEmployees = records.length;

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
      {/* Section Header */}
      <div className="px-5 py-3.5 bg-gradient-to-r from-slate-50 to-slate-100/60 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-slate-900 text-white flex items-center justify-center shrink-0">
            <Building2 className="w-4 h-4 text-emerald-400" />
          </div>
          <div>
            <h4 className="font-display font-bold text-xs uppercase tracking-wider text-slate-900">
              Top Section: Sub-Project &amp; Work Site Compliance Progress
            </h4>
            <p className="text-[11px] text-slate-500">
              Select a work site below to filter the detailed employee compliance roster underneath.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          <span className="text-[11px] text-slate-500">
            Total Sites: <strong className="text-slate-800 font-mono">{subProjectStats.length}</strong>
          </span>
          <span className="text-slate-300">·</span>
          <span className="text-[11px] text-slate-500">
            Active Workforce: <strong className="text-slate-800 font-mono">{totalEmployees}</strong>
          </span>
        </div>
      </div>

      {/* Grid of Sub-Project Cards */}
      <div className="p-4 bg-slate-50/50">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {/* Card 0: "All Sites" Master Card */}
          <div
            onClick={() => onSelectSubProject('ALL')}
            className={`p-3.5 rounded-xl border transition-all duration-150 cursor-pointer text-left relative ${
              activeSubProject === 'ALL'
                ? 'bg-slate-900 text-white border-slate-900 shadow-md ring-2 ring-slate-900/10'
                : 'bg-white text-slate-900 border-slate-200 hover:border-slate-300 hover:shadow-xs'
            }`}
          >
            <div className="flex items-center justify-between gap-2 mb-2">
              <span
                className={`font-display font-bold text-xs tracking-tight truncate ${
                  activeSubProject === 'ALL' ? 'text-white' : 'text-slate-900'
                }`}
              >
                All Sub-Projects / Sites
              </span>
              <span
                className={`text-[10px] font-mono px-2 py-0.5 rounded-md font-semibold shrink-0 ${
                  activeSubProject === 'ALL'
                    ? 'bg-slate-800 text-emerald-400 border border-slate-700'
                    : 'bg-slate-100 text-slate-700'
                }`}
              >
                {totalEmployees} Employees
              </span>
            </div>

            <p
              className={`text-[11px] mb-3 line-clamp-1 ${
                activeSubProject === 'ALL' ? 'text-slate-300' : 'text-slate-500'
              }`}
            >
              Complete active workforce overview across all {subProjectStats.length} project sites.
            </p>

            <div className="pt-2 border-t border-slate-200/40 flex items-center justify-between text-[11px]">
              <span className={activeSubProject === 'ALL' ? 'text-slate-300' : 'text-slate-500'}>
                View All Personnel
              </span>
              <ChevronRight
                className={`w-4 h-4 ${
                  activeSubProject === 'ALL' ? 'text-emerald-400' : 'text-slate-400'
                }`}
              />
            </div>
          </div>

          {/* Individual Sub-Project Cards */}
          {subProjectStats.map((sp) => {
            const isSelected = activeSubProject === sp.subProjectName;

            // Pick metric percentage based on activePillar
            let metricPct = sp.overallCompliancePct;
            let metricLabel = 'Overall';
            if (activePillar === 'IQAMA') {
              metricPct = sp.iqamaCompliancePct;
              metricLabel = 'Iqama';
            } else if (activePillar === 'AJEER') {
              metricPct = sp.ajeerCompliancePct;
              metricLabel = 'Ajeer';
            } else if (activePillar === 'HEALTH') {
              metricPct = sp.healthCompliancePct;
              metricLabel = 'Health';
            }

            return (
              <div
                key={sp.subProjectName}
                onClick={() => onSelectSubProject(isSelected ? 'ALL' : sp.subProjectName)}
                className={`p-3.5 rounded-xl border transition-all duration-150 cursor-pointer text-left relative group ${
                  isSelected
                    ? 'bg-emerald-950 text-white border-emerald-900 shadow-md ring-2 ring-emerald-600/30'
                    : 'bg-white text-slate-900 border-slate-200 hover:border-slate-300 hover:shadow-xs'
                }`}
              >
                {/* Header: Title and Headcount */}
                <div className="flex items-center justify-between gap-2 mb-1.5">
                  <h5
                    className={`font-display font-bold text-xs truncate ${
                      isSelected ? 'text-white' : 'text-slate-900 group-hover:text-emerald-700'
                    }`}
                    title={sp.subProjectName}
                  >
                    {sp.subProjectName}
                  </h5>
                  <span
                    className={`text-[10px] font-mono px-2 py-0.5 rounded-md font-semibold shrink-0 ${
                      isSelected
                        ? 'bg-emerald-900 text-emerald-300 border border-emerald-800'
                        : 'bg-slate-100 text-slate-700'
                    }`}
                  >
                    {sp.totalEmployees} Active
                  </span>
                </div>

                {/* Parent project tag */}
                <span
                  className={`text-[10px] block mb-2 truncate ${
                    isSelected ? 'text-emerald-300/80' : 'text-slate-400'
                  }`}
                >
                  Project: {sp.projectName}
                </span>

                {/* Progress bar */}
                <div className="space-y-1 mb-2.5">
                  <div className="flex items-center justify-between text-[10px]">
                    <span className={isSelected ? 'text-emerald-200' : 'text-slate-500'}>
                      {metricLabel} Compliance
                    </span>
                    <span className="font-mono font-bold tabular-nums">
                      {metricPct}%
                    </span>
                  </div>
                  <div className="w-full bg-slate-200/60 rounded-full h-1.5 overflow-hidden">
                    <div
                      className={`h-full transition-all duration-300 ${
                        metricPct >= 80
                          ? 'bg-emerald-500'
                          : metricPct >= 50
                          ? 'bg-amber-400'
                          : 'bg-rose-500'
                      }`}
                      style={{ width: `${metricPct}%` }}
                    />
                  </div>
                </div>

                {/* Mini Pillars Indicator */}
                <div
                  className={`pt-2 border-t grid grid-cols-3 gap-1 text-[9px] font-mono text-center ${
                    isSelected ? 'border-emerald-900/60 text-emerald-200' : 'border-slate-100 text-slate-500'
                  }`}
                >
                  <div>
                    <span className="block opacity-70">Iqama</span>
                    <strong className={isSelected ? 'text-white' : 'text-slate-800'}>
                      {sp.iqamaCompliancePct}%
                    </strong>
                  </div>
                  <div>
                    <span className="block opacity-70">Ajeer</span>
                    <strong className={isSelected ? 'text-white' : 'text-slate-800'}>
                      {sp.ajeerCompliancePct}%
                    </strong>
                  </div>
                  <div>
                    <span className="block opacity-70">Health</span>
                    <strong className={isSelected ? 'text-white' : 'text-slate-800'}>
                      {sp.healthCompliancePct}%
                    </strong>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
