import React from 'react';
import { ShieldCheck, FileCheck, HeartPulse, CheckCircle2, AlertTriangle, AlertCircle, HelpCircle } from 'lucide-react';
import { CorePillarKey } from '../types';

interface ScorecardItem {
  title: string;
  total: number;
  valid: number;
  warning: number;
  expired: number;
  missing: number;
  compliancePct: number;
}

interface ClientKpiStripProps {
  scorecards: {
    iqama: ScorecardItem;
    ajeer: ScorecardItem;
    health: ScorecardItem;
  };
  activePillar: CorePillarKey;
  onSelectPillar: (pillar: CorePillarKey) => void;
  selectedStatus: string;
  onSelectStatus: (status: any) => void;
}

export const ClientKpiStrip: React.FC<ClientKpiStripProps> = ({
  scorecards,
  activePillar,
  onSelectPillar,
  selectedStatus,
  onSelectStatus,
}) => {
  const cards: Array<{
    key: CorePillarKey;
    title: string;
    subtitle: string;
    icon: React.ReactNode;
    data: ScorecardItem;
    badgeColor: string;
  }> = [
    {
      key: 'IQAMA',
      title: 'Iqama Compliance',
      subtitle: 'Residency status & valid legal identity',
      icon: <ShieldCheck className="w-5 h-5 text-blue-600" />,
      data: scorecards.iqama,
      badgeColor: 'text-blue-700 bg-blue-50 border-blue-200',
    },
    {
      key: 'AJEER',
      title: 'Ajeer Work Permit',
      subtitle: 'Subcontracting authorization & validity',
      icon: <FileCheck className="w-5 h-5 text-emerald-600" />,
      data: scorecards.ajeer,
      badgeColor: 'text-emerald-700 bg-emerald-50 border-emerald-200',
    },
    {
      key: 'HEALTH',
      title: 'Health Card & Medical',
      subtitle: 'Baladiya health card & fitness testing',
      icon: <HeartPulse className="w-5 h-5 text-rose-600" />,
      data: scorecards.health,
      badgeColor: 'text-rose-700 bg-rose-50 border-rose-200',
    },
  ];

  return (
    <div className="space-y-3">
      {/* Cards Row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {cards.map((c) => {
          const isSelected = activePillar === c.key;
          const { data } = c;

          return (
            <div
              key={c.key}
              onClick={() => onSelectPillar(activePillar === c.key ? 'ALL' : c.key)}
              className={`bg-white rounded-xl border p-5 transition-all duration-200 cursor-pointer text-left relative overflow-hidden group shadow-xs ${
                isSelected
                  ? 'border-slate-900 ring-2 ring-slate-900/10 shadow-md'
                  : 'border-slate-200/90 hover:border-slate-300 hover:shadow-sm'
              }`}
            >
              {/* Header */}
              <div className="flex items-start justify-between gap-3 mb-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-lg bg-slate-50 border border-slate-200 flex items-center justify-center shrink-0">
                    {c.icon}
                  </div>
                  <div>
                    <h3 className="font-display font-bold text-sm text-slate-900 leading-tight">
                      {c.title}
                    </h3>
                    <p className="text-[11px] text-slate-500 mt-0.5 line-clamp-1">
                      {c.subtitle}
                    </p>
                  </div>
                </div>

                <div className="text-right shrink-0">
                  <div className="flex items-baseline gap-1 justify-end">
                    <span className="font-display font-extrabold text-2xl text-slate-900 tracking-tight font-mono tabular-nums">
                      {data.compliancePct}%
                    </span>
                  </div>
                  <span className="text-[10px] font-medium text-slate-400 uppercase tracking-wider block">
                    Compliance
                  </span>
                </div>
              </div>

              {/* Progress Bar */}
              <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden flex mb-4">
                <div
                  className="bg-emerald-500 h-full transition-all duration-500"
                  style={{ width: `${(data.valid / (data.total || 1)) * 100}%` }}
                  title={`Valid: ${data.valid}`}
                />
                <div
                  className="bg-amber-400 h-full transition-all duration-500"
                  style={{ width: `${(data.warning / (data.total || 1)) * 100}%` }}
                  title={`Expiring Soon: ${data.warning}`}
                />
                <div
                  className="bg-rose-500 h-full transition-all duration-500"
                  style={{ width: `${(data.expired / (data.total || 1)) * 100}%` }}
                  title={`Action Required: ${data.expired}`}
                />
                <div
                  className="bg-slate-300 h-full transition-all duration-500"
                  style={{ width: `${(data.missing / (data.total || 1)) * 100}%` }}
                  title={`Missing / Unrecorded: ${data.missing}`}
                />
              </div>

              {/* Status Breakdown Chips */}
              <div className="grid grid-cols-3 gap-2 pt-1 border-t border-slate-100 text-xs">
                {/* Valid */}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onSelectPillar(c.key);
                    onSelectStatus(selectedStatus === 'VALID' ? 'ALL' : 'VALID');
                  }}
                  className={`p-1.5 rounded-lg text-left transition-colors ${
                    isSelected && selectedStatus === 'VALID'
                      ? 'bg-emerald-50 border border-emerald-300'
                      : 'hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-center gap-1 text-[11px] font-medium text-emerald-700">
                    <CheckCircle2 className="w-3 h-3 shrink-0" />
                    <span>Valid</span>
                  </div>
                  <div className="font-mono font-bold text-sm text-slate-800 tabular-nums mt-0.5">
                    {data.valid}
                  </div>
                </button>

                {/* Expiring Soon */}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onSelectPillar(c.key);
                    onSelectStatus(selectedStatus === 'WARNING' ? 'ALL' : 'WARNING');
                  }}
                  className={`p-1.5 rounded-lg text-left transition-colors ${
                    isSelected && selectedStatus === 'WARNING'
                      ? 'bg-amber-50 border border-amber-300'
                      : 'hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-center gap-1 text-[11px] font-medium text-amber-700">
                    <AlertTriangle className="w-3 h-3 shrink-0" />
                    <span>Expiring</span>
                  </div>
                  <div className="font-mono font-bold text-sm text-slate-800 tabular-nums mt-0.5">
                    {data.warning}
                  </div>
                </button>

                {/* Expired / Action Required */}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onSelectPillar(c.key);
                    onSelectStatus(selectedStatus === 'EXPIRED' ? 'ALL' : 'EXPIRED');
                  }}
                  className={`p-1.5 rounded-lg text-left transition-colors ${
                    isSelected && selectedStatus === 'EXPIRED'
                      ? 'bg-rose-50 border border-rose-300'
                      : 'hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-center gap-1 text-[11px] font-medium text-rose-700">
                    <AlertCircle className="w-3 h-3 shrink-0" />
                    <span>Action Req.</span>
                  </div>
                  <div className="font-mono font-bold text-sm text-slate-800 tabular-nums mt-0.5">
                    {data.expired}
                  </div>
                </button>
              </div>

              {/* Active Selection Indicator */}
              {isSelected && (
                <div className="absolute top-2 right-2 flex items-center gap-1 bg-slate-900 text-white text-[9px] font-semibold px-2 py-0.5 rounded-md">
                  Active Filter
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Quick Active Filter Bar */}
      <div className="flex items-center justify-between text-xs text-slate-500 px-1">
        <div className="flex items-center gap-2">
          <span className="font-medium text-slate-700">Viewing Compliance Metric:</span>
          <span className="font-semibold text-slate-900">
            {activePillar === 'ALL'
              ? 'All Three Pillars (Iqama, Ajeer, Health Card)'
              : activePillar === 'IQAMA'
              ? 'Iqama Compliance Focus'
              : activePillar === 'AJEER'
              ? 'Ajeer Work Permit Focus'
              : 'Health Card & Medical Focus'}
          </span>
          {activePillar !== 'ALL' && (
            <button
              onClick={() => onSelectPillar('ALL')}
              className="text-emerald-700 hover:text-emerald-800 font-semibold underline underline-offset-2 ml-1 cursor-pointer"
            >
              Reset to All
            </button>
          )}
        </div>

        {selectedStatus !== 'ALL' && (
          <div className="flex items-center gap-1.5 bg-slate-100 px-2.5 py-1 rounded-md text-[11px]">
            <span>Filter:</span>
            <strong className="text-slate-900">{selectedStatus}</strong>
            <button
              onClick={() => onSelectStatus('ALL')}
              className="ml-1 text-slate-400 hover:text-slate-700 cursor-pointer font-bold"
            >
              ×
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
