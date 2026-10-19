import React from 'react';
import { RecordItemData } from '../types';
import { calculateScorecardForElement } from '../utils/kpiEngine';

interface KPISelectorBarProps {
  kpiElements: string[];
  activeKpi: string;
  onSelectKpi: (kpi: string) => void;
  filteredRecords: RecordItemData[];
}

export const KPISelectorBar: React.FC<KPISelectorBarProps> = ({
  kpiElements,
  activeKpi,
  onSelectKpi,
  filteredRecords,
}) => {
  // Compute compliance rates for each enabled element
  const elementsWithRates = kpiElements.map((elem) => {
    const summary = calculateScorecardForElement(filteredRecords, elem);
    return {
      name: elem,
      rate: summary.overallCompliancePct,
      valid: summary.validCount,
      total: summary.totalRecords,
    };
  });

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-2 shadow-[0_1px_2px_rgba(0,0,0,0.03)]">
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 scrollbar-none">
        <span className="text-xs font-semibold text-slate-400 px-3 shrink-0 uppercase tracking-wider">
          KPI Metrics:
        </span>

        {elementsWithRates.map((elem) => {
          const isActive = activeKpi === elem.name;
          const rateColor =
            elem.rate >= 80
              ? 'bg-emerald-100 text-emerald-800'
              : elem.rate >= 50
              ? 'bg-amber-100 text-amber-800'
              : 'bg-rose-100 text-rose-800';

          return (
            <button
              key={elem.name}
              onClick={() => onSelectKpi(elem.name)}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all whitespace-nowrap cursor-pointer shrink-0 ${
                isActive
                  ? 'bg-slate-900 text-white shadow-sm'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              <span>{elem.name}</span>
              <span
                className={`font-mono text-[11px] tabular-nums font-bold px-1.5 py-0.5 rounded ${
                  isActive ? 'bg-white/20 text-white' : rateColor
                }`}
              >
                {elem.rate}%
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
};
