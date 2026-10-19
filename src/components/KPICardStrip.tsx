import React from 'react';
import { KPIStatus, KPIScorecardSummary } from '../types';
import { CheckCircle2, AlertTriangle, XCircle, HelpCircle, Layers } from 'lucide-react';

interface KPICardStripProps {
  scorecard: KPIScorecardSummary;
  selectedStatus: KPIStatus | 'ALL';
  onSelectStatus: (status: KPIStatus | 'ALL') => void;
}

export const KPICardStrip: React.FC<KPICardStripProps> = ({
  scorecard,
  selectedStatus,
  onSelectStatus,
}) => {
  const cards = [
    {
      id: 'ALL' as const,
      label: 'Total Workforce',
      count: scorecard.totalRecords,
      pct: 100,
      subtext: 'All Filtered Entries',
      icon: Layers,
      textColor: 'text-slate-900',
      activeBorder: 'border-slate-900 ring-2 ring-slate-900/10',
      inactiveBorder: 'border-slate-200 hover:border-slate-300',
      badgeBg: 'bg-slate-100 text-slate-700',
    },
    {
      id: 'VALID' as const,
      label: 'Valid / Compliant',
      count: scorecard.validCount,
      pct: scorecard.validPct,
      subtext: '> 30 days or active',
      icon: CheckCircle2,
      textColor: 'text-emerald-700',
      activeBorder: 'border-emerald-600 ring-2 ring-emerald-600/10',
      inactiveBorder: 'border-slate-200 hover:border-emerald-300',
      badgeBg: 'bg-emerald-50 text-emerald-800 border border-emerald-200/60',
    },
    {
      id: 'WARNING' as const,
      label: 'Expiring Soon',
      count: scorecard.warningCount,
      pct: scorecard.warningPct,
      subtext: 'Next 1 to 30 days',
      icon: AlertTriangle,
      textColor: 'text-amber-700',
      activeBorder: 'border-amber-500 ring-2 ring-amber-500/10',
      inactiveBorder: 'border-slate-200 hover:border-amber-300',
      badgeBg: 'bg-amber-50 text-amber-800 border border-amber-200/60',
    },
    {
      id: 'EXPIRED' as const,
      label: 'Expired / Action Req.',
      count: scorecard.expiredCount,
      pct: scorecard.expiredPct,
      subtext: 'Past date or inactive',
      icon: XCircle,
      textColor: 'text-rose-700',
      activeBorder: 'border-rose-500 ring-2 ring-rose-500/10',
      inactiveBorder: 'border-slate-200 hover:border-rose-300',
      badgeBg: 'bg-rose-50 text-rose-800 border border-rose-200/60',
    },
    {
      id: 'MISSING' as const,
      label: 'Missing / Unset',
      count: scorecard.missingCount,
      pct: scorecard.missingPct,
      subtext: 'Pending documentation',
      icon: HelpCircle,
      textColor: 'text-slate-600',
      activeBorder: 'border-slate-500 ring-2 ring-slate-500/10',
      inactiveBorder: 'border-slate-200 hover:border-slate-300',
      badgeBg: 'bg-slate-100 text-slate-600 border border-slate-200/60',
    },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3.5">
      {cards.map((c) => {
        const isSelected = selectedStatus === c.id;
        const Icon = c.icon;

        return (
          <button
            key={c.id}
            onClick={() => onSelectStatus(isSelected && c.id !== 'ALL' ? 'ALL' : c.id)}
            className={`text-left p-4 rounded-xl bg-white border transition-all cursor-pointer relative ${
              isSelected ? `${c.activeBorder} shadow-sm bg-slate-50/40` : `${c.inactiveBorder} shadow-[0_1px_2px_rgba(0,0,0,0.03)]`
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                {c.label}
              </span>
              <Icon className={`w-4 h-4 ${c.textColor}`} />
            </div>

            <div className="flex items-baseline justify-between gap-2 mt-1">
              <span className={`text-2xl font-bold font-mono tabular-nums tracking-tight ${c.textColor}`}>
                {c.count}
              </span>
              <span className={`text-xs font-semibold font-mono tabular-nums px-2 py-0.5 rounded ${c.badgeBg}`}>
                {c.pct}%
              </span>
            </div>

            <div className="mt-2 text-[11px] text-slate-400 font-medium">
              {c.subtext}
            </div>

            {isSelected && (
              <div className="mt-2.5 pt-2 border-t border-slate-100 text-[11px] font-medium text-slate-700 flex items-center justify-between">
                <span>Filtering table below</span>
                <span className="text-slate-400">Click to clear</span>
              </div>
            )}
          </button>
        );
      })}
    </div>
  );
};
