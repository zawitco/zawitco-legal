import {
  KPIStatus,
  KPIScorecardSummary,
  SubProjectBreakdownRow,
  RecordItemData,
  ProjectHierarchyGroup,
} from '../types';

const MONTH_MAP: Record<string, number> = {
  jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5,
  jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11,
  january: 0, february: 1, march: 2, april: 3, june: 5,
  july: 6, august: 7, september: 8, october: 9, november: 10, december: 11,
};

export function parseCustomDate(val: string): Date | null {
  if (!val || typeof val !== 'string') return null;
  const s = val.trim();
  if (!s || s === '-' || s.toLowerCase() === 'n/a' || s.toLowerCase() === 'no need') return null;

  // 1. Try DD-MMM-YYYY or DD/MMM/YYYY e.g. "15-Oct-2026", "30-May-2027"
  const mmmMatch = s.match(/^(\d{1,2})[-/\s]+([a-zA-Z]{3,9})[-/\s]+(\d{4})$/);
  if (mmmMatch) {
    const day = parseInt(mmmMatch[1], 10);
    const monthKey = mmmMatch[2].toLowerCase();
    const year = parseInt(mmmMatch[3], 10);
    if (MONTH_MAP[monthKey] !== undefined) {
      const d = new Date(year, MONTH_MAP[monthKey], day);
      if (!isNaN(d.getTime())) return d;
    }
  }

  // 2. Try YYYY-MM-DD or YYYY/MM/DD e.g. "2025-04-04", "1996/09/10"
  const isoMatch = s.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/);
  if (isoMatch) {
    const year = parseInt(isoMatch[1], 10);
    const month = parseInt(isoMatch[2], 10) - 1;
    const day = parseInt(isoMatch[3], 10);
    const d = new Date(year, month, day);
    if (!isNaN(d.getTime())) return d;
  }

  // 3. Try DD/MM/YYYY or DD-MM-YYYY e.g. "21/06/2023", "24-10-1977"
  const dmyMatch = s.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/);
  if (dmyMatch) {
    const day = parseInt(dmyMatch[1], 10);
    const month = parseInt(dmyMatch[2], 10) - 1;
    const year = parseInt(dmyMatch[3], 10);
    const d = new Date(year, month, day);
    if (!isNaN(d.getTime())) return d;
  }

  // Fallback native Date parse if it looks like a date
  if (/\d/.test(s) && (s.includes('-') || s.includes('/') || s.includes(' '))) {
    const parsed = new Date(s);
    if (!isNaN(parsed.getTime()) && parsed.getFullYear() > 1950 && parsed.getFullYear() < 2100) {
      return parsed;
    }
  }

  return null;
}

export function classifyKPIValue(rawVal: any): {
  status: KPIStatus;
  daysRemaining?: number;
  formattedText: string;
} {
  if (rawVal === undefined || rawVal === null) {
    return { status: 'MISSING', formattedText: '-' };
  }

  const s = String(rawVal).trim();
  if (!s || s === '-' || s.toUpperCase() === 'N/A' || s.toUpperCase() === 'NONE' || s.toUpperCase() === 'NULL') {
    return { status: 'MISSING', formattedText: s || '-' };
  }

  // Check if value is a date
  const parsedDate = parseCustomDate(s);
  if (parsedDate) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const diffTime = parsedDate.getTime() - today.getTime();
    const daysRemaining = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (daysRemaining > 30) {
      return { status: 'VALID', daysRemaining, formattedText: s };
    } else if (daysRemaining >= 0 && daysRemaining <= 30) {
      return { status: 'WARNING', daysRemaining, formattedText: s };
    } else {
      return { status: 'EXPIRED', daysRemaining, formattedText: s };
    }
  }

  // Text status matching
  const upper = s.toUpperCase();

  // 1. Explicit Exemptions / Approved
  if (
    upper.includes('NO NEED') ||
    upper.includes('NOT NEEDED') ||
    upper.includes('EXEMPT') ||
    upper === 'VALID' ||
    upper === 'ACTIVE' ||
    upper === 'YES' ||
    upper === 'DONE' ||
    upper === 'COMPLETED' ||
    upper === 'ISSUED' ||
    upper === 'APPROVED' ||
    upper === 'OK' ||
    upper === 'UNDER SPONSOR' ||
    upper === 'PASSED'
  ) {
    return { status: 'VALID', formattedText: s };
  }

  // 2. Negative / Non-Compliant / Not Issued (e.g. "NO AJEER YET", "NO AJEER", "NOT ISSUED")
  if (
    upper === 'NO' ||
    upper.startsWith('NO ') ||
    upper.startsWith('NOT ') ||
    upper === 'EXPIRED' ||
    upper === 'INACTIVE' ||
    upper === 'REJECTED' ||
    upper === 'FAILED' ||
    upper === 'CANCELLED' ||
    upper === 'RUNAWAY' ||
    upper === 'TERMINATED' ||
    upper === 'ESCAPE' ||
    upper === 'WITHOUT'
  ) {
    return { status: 'EXPIRED', formattedText: s };
  }

  // 3. Expiring Soon / Pending
  if (
    upper === 'PENDING' ||
    upper === 'IN PROGRESS' ||
    upper === 'PROCESSING' ||
    upper === 'RENEWAL' ||
    upper === 'EXPIRING SOON' ||
    upper === 'EXPIRING' ||
    upper === 'UNDER PROCESS' ||
    upper === 'SUBMITTED'
  ) {
    return { status: 'WARNING', formattedText: s };
  }

  // If number or ID code (e.g. Iqama 10-digit or Health card code), treat as Valid/Issued
  if (/^\d{4,}$/.test(s)) {
    return { status: 'VALID', formattedText: s };
  }

  // Default to Valid if has text content, else Missing
  return { status: 'VALID', formattedText: s };
}

export function getEmployeeComplianceDetails(data: Record<string, string>): {
  iqama: { status: KPIStatus; text: string; number?: string; expiry?: string; daysRemaining?: number };
  ajeer: { status: KPIStatus; text: string; expiry?: string; daysRemaining?: number };
  health: { status: KPIStatus; text: string; expiry?: string; daysRemaining?: number };
  overallStatus: KPIStatus;
} {
  // 1. Iqama Status
  const iqamaStatusRaw = data['IQAMA STATUS'];
  const iqamaNo = (data['IQAMA NO'] || '').trim();
  let iqama: { status: KPIStatus; text: string; number?: string; expiry?: string; daysRemaining?: number };

  if (iqamaStatusRaw) {
    const classified = classifyKPIValue(iqamaStatusRaw);
    iqama = {
      status: classified.status,
      text: classified.formattedText,
      number: iqamaNo || undefined,
      daysRemaining: classified.daysRemaining,
    };
  } else if (iqamaNo && /^\d{5,}$/.test(iqamaNo)) {
    iqama = { status: 'VALID', text: 'Valid (' + iqamaNo + ')', number: iqamaNo };
  } else if (iqamaNo) {
    const classified = classifyKPIValue(iqamaNo);
    iqama = { status: classified.status, text: classified.formattedText, number: iqamaNo };
  } else {
    iqama = { status: 'MISSING', text: 'Missing Iqama' };
  }

  // 2. Ajeer Status
  const ajeerExp = (data['AJEER EXPIRY'] || '').trim();
  const ajeerRaw = (data['AJEER'] || '').trim();
  let ajeer: { status: KPIStatus; text: string; expiry?: string; daysRemaining?: number };

  if (ajeerExp && ajeerExp !== '-' && ajeerExp.toUpperCase() !== 'NO NEED' && ajeerExp.toUpperCase() !== 'N/A') {
    const classified = classifyKPIValue(ajeerExp);
    ajeer = {
      status: classified.status,
      text: classified.formattedText,
      expiry: ajeerExp,
      daysRemaining: classified.daysRemaining,
    };
  } else if (ajeerRaw) {
    const classified = classifyKPIValue(ajeerRaw);
    ajeer = { status: classified.status, text: classified.formattedText };
  } else {
    ajeer = { status: 'MISSING', text: 'No Ajeer Record' };
  }

  // 3. Health Card & Medical Status
  const hcExp = (data['HEALTH CARD EXPIRY'] || '').trim();
  const hcNum = (data['HEALTH CARD NUMBER'] || '').trim();
  const med = (data['MEDICAL TEST'] || '').trim();
  let health: { status: KPIStatus; text: string; expiry?: string; daysRemaining?: number };

  if (hcExp && hcExp !== '-' && hcExp.toUpperCase() !== 'NO NEED' && hcExp.toUpperCase() !== 'N/A') {
    const classified = classifyKPIValue(hcExp);
    health = {
      status: classified.status,
      text: classified.formattedText,
      expiry: hcExp,
      daysRemaining: classified.daysRemaining,
    };
  } else if (hcNum && /^\d{4,}$/.test(hcNum)) {
    health = { status: 'VALID', text: 'Card #' + hcNum };
  } else if (med) {
    const classified = classifyKPIValue(med);
    health = { status: classified.status, text: classified.formattedText };
  } else {
    health = { status: 'MISSING', text: 'No Health Record' };
  }

  // Compute Overall Status
  let overallStatus: KPIStatus = 'VALID';
  if (iqama.status === 'EXPIRED' || ajeer.status === 'EXPIRED' || health.status === 'EXPIRED') {
    overallStatus = 'EXPIRED';
  } else if (iqama.status === 'WARNING' || ajeer.status === 'WARNING' || health.status === 'WARNING') {
    overallStatus = 'WARNING';
  } else if (iqama.status === 'MISSING' && ajeer.status === 'MISSING' && health.status === 'MISSING') {
    overallStatus = 'MISSING';
  }

  return { iqama, ajeer, health, overallStatus };
}

export function calculateCoreThreeScorecards(records: RecordItemData[]): {
  iqama: {
    title: string;
    total: number;
    valid: number;
    warning: number;
    expired: number;
    missing: number;
    compliancePct: number;
  };
  ajeer: {
    title: string;
    total: number;
    valid: number;
    warning: number;
    expired: number;
    missing: number;
    compliancePct: number;
  };
  health: {
    title: string;
    total: number;
    valid: number;
    warning: number;
    expired: number;
    missing: number;
    compliancePct: number;
  };
} {
  const total = records.length;
  const res = {
    iqama: { title: 'Iqama Compliance', total, valid: 0, warning: 0, expired: 0, missing: 0, compliancePct: 0 },
    ajeer: { title: 'Ajeer Permit', total, valid: 0, warning: 0, expired: 0, missing: 0, compliancePct: 0 },
    health: { title: 'Health Card & Medical', total, valid: 0, warning: 0, expired: 0, missing: 0, compliancePct: 0 },
  };

  if (total === 0) return res;

  for (const rec of records) {
    const c = getEmployeeComplianceDetails(rec.data);
    if (c.iqama.status === 'VALID') res.iqama.valid++;
    else if (c.iqama.status === 'WARNING') res.iqama.warning++;
    else if (c.iqama.status === 'EXPIRED') res.iqama.expired++;
    else res.iqama.missing++;

    if (c.ajeer.status === 'VALID') res.ajeer.valid++;
    else if (c.ajeer.status === 'WARNING') res.ajeer.warning++;
    else if (c.ajeer.status === 'EXPIRED') res.ajeer.expired++;
    else res.ajeer.missing++;

    if (c.health.status === 'VALID') res.health.valid++;
    else if (c.health.status === 'WARNING') res.health.warning++;
    else if (c.health.status === 'EXPIRED') res.health.expired++;
    else res.health.missing++;
  }

  const calcPct = (v: number, m: number) => {
    const nonMissing = total - m;
    return nonMissing > 0 ? Math.round((v / nonMissing) * 100) : total > 0 ? Math.round((v / total) * 100) : 0;
  };

  res.iqama.compliancePct = calcPct(res.iqama.valid, res.iqama.missing);
  res.ajeer.compliancePct = calcPct(res.ajeer.valid, res.ajeer.missing);
  res.health.compliancePct = calcPct(res.health.valid, res.health.missing);

  return res;
}

export function calculateScorecardForElement(
  records: RecordItemData[],
  kpiElement: string
): KPIScorecardSummary {
  const total = records.length;
  if (total === 0) {
    return {
      kpiName: kpiElement,
      totalRecords: 0,
      validCount: 0,
      validPct: 0,
      warningCount: 0,
      warningPct: 0,
      expiredCount: 0,
      expiredPct: 0,
      missingCount: 0,
      missingPct: 0,
      overallCompliancePct: 0,
    };
  }

  let valid = 0;
  let warning = 0;
  let expired = 0;
  let missing = 0;

  for (const rec of records) {
    // If element is a specific column
    let val = rec.data[kpiElement];
    
    // Fallback: search key case-insensitively
    if (val === undefined) {
      const matchKey = Object.keys(rec.data).find(
        (k) => k.toLowerCase() === kpiElement.toLowerCase() || k.toLowerCase().includes(kpiElement.toLowerCase())
      );
      if (matchKey) val = rec.data[matchKey];
    }

    const { status } = classifyKPIValue(val);
    if (status === 'VALID') valid++;
    else if (status === 'WARNING') warning++;
    else if (status === 'EXPIRED') expired++;
    else missing++;
  }

  const validPct = Math.round((valid / total) * 100);
  const warningPct = Math.round((warning / total) * 100);
  const expiredPct = Math.round((expired / total) * 100);
  const missingPct = Math.round((missing / total) * 100);

  // Compliance Rate: Valid records divided by total (or total minus exempt/missing)
  const nonMissingTotal = total - missing;
  const overallCompliancePct = nonMissingTotal > 0
    ? Math.round((valid / nonMissingTotal) * 100)
    : Math.round((valid / total) * 100);

  return {
    kpiName: kpiElement,
    totalRecords: total,
    validCount: valid,
    validPct,
    warningCount: warning,
    warningPct,
    expiredCount: expired,
    expiredPct,
    missingCount: missing,
    missingPct,
    overallCompliancePct,
  };
}

export function calculateSubProjectBreakdown(
  records: RecordItemData[],
  activeKpi: string
): SubProjectBreakdownRow[] {
  // Key by combination of project and sub-project
  const groups: Record<string, { projectName: string; subProjectName: string; records: RecordItemData[] }> = {};

  for (const rec of records) {
    const proj = (rec.data['PROJECT NAME'] || rec.data['PROJECT'] || rec.project_name || 'General').trim();
    let sp = (rec.data['SUB PROJECT'] || rec.data['SUB PROJECTS'] || rec.sub_project_name || 'MAIN').trim();

    // Never allow individual email identifiers to leak as sub-projects
    if (sp.includes('@') || sp.endsWith('.com')) {
      sp = 'MAIN';
    }

    // If sub-project is MAIN, label it by the Project name so it represents the site clearly
    const displayName = sp === 'MAIN' ? proj : sp;
    const groupKey = `${proj}:::${displayName}`;

    if (!groups[groupKey]) {
      groups[groupKey] = {
        projectName: proj,
        subProjectName: displayName,
        records: [],
      };
    }
    groups[groupKey].records.push(rec);
  }

  const rows: SubProjectBreakdownRow[] = [];

  for (const { projectName, subProjectName, records: subRecords } of Object.values(groups)) {
    let valid = 0;
    let warning = 0;
    let expired = 0;
    let missing = 0;

    for (const r of subRecords) {
      if (activeKpi === 'OVERVIEW') {
        valid++;
      } else {
        let val = r.data[activeKpi];
        if (val === undefined) {
          const matchKey = Object.keys(r.data).find(
            (k) => k.toLowerCase() === activeKpi.toLowerCase() || k.toLowerCase().includes(activeKpi.toLowerCase())
          );
          if (matchKey) val = r.data[matchKey];
        }
        const { status } = classifyKPIValue(val);
        if (status === 'VALID') valid++;
        else if (status === 'WARNING') warning++;
        else if (status === 'EXPIRED') expired++;
        else missing++;
      }
    }

    const total = subRecords.length;
    const nonMissing = total - missing;
    const compliancePct = nonMissing > 0
      ? Math.round((valid / nonMissing) * 100)
      : Math.round((valid / total) * 100);

    rows.push({
      projectName,
      subProjectName,
      total,
      valid,
      warning,
      expired,
      missing,
      compliancePct,
    });
  }

  return rows.sort((a, b) => b.total - a.total);
}

export function calculateHierarchicalBreakdown(
  records: RecordItemData[],
  activeKpi: string
): ProjectHierarchyGroup[] {
  // First, group by Project Name
  const projectGroups: Record<string, RecordItemData[]> = {};

  for (const rec of records) {
    // Only active employees
    const statusVal = (rec.data['STATUS'] || 'ACTIVE').trim().toUpperCase();
    if (statusVal && statusVal !== 'ACTIVE') continue;

    const proj = (rec.data['PROJECT NAME'] || rec.data['PROJECT'] || rec.project_name || 'General').trim();
    if (!projectGroups[proj]) {
      projectGroups[proj] = [];
    }
    projectGroups[proj].push(rec);
  }

  const result: ProjectHierarchyGroup[] = [];

  for (const [projName, projRecords] of Object.entries(projectGroups)) {
    // Sub-project breakdown for this project
    const subBreakdown = calculateSubProjectBreakdown(projRecords, activeKpi);

    // Sort sub-projects canonically if known project
    if (projName === 'Keemart Dark Store') {
      const order = ['DS RUH 001', 'DS RUH 002', 'DS OUT OF RIYADH'];
      subBreakdown.sort((a, b) => {
        const idxA = order.indexOf(a.subProjectName);
        const idxB = order.indexOf(b.subProjectName);
        if (idxA !== -1 && idxB !== -1) return idxA - idxB;
        if (idxA !== -1) return -1;
        if (idxB !== -1) return 1;
        return a.subProjectName.localeCompare(b.subProjectName);
      });
    } else if (projName === 'Ninja') {
      const order = [
        'NINJA HEAD OFFICE',
        'NINJA RUH001',
        'NINJA RUH002',
        'NINJA WEST001',
        'NINJA WEST002',
        'NINJA NORTH001',
      ];
      subBreakdown.sort((a, b) => {
        const idxA = order.indexOf(a.subProjectName);
        const idxB = order.indexOf(b.subProjectName);
        if (idxA !== -1 && idxB !== -1) return idxA - idxB;
        if (idxA !== -1) return -1;
        if (idxB !== -1) return 1;
        return a.subProjectName.localeCompare(b.subProjectName);
      });
    }

    // Rollup project totals
    let total = 0;
    let valid = 0;
    let warning = 0;
    let expired = 0;
    let missing = 0;

    for (const sub of subBreakdown) {
      total += sub.total;
      valid += sub.valid;
      warning += sub.warning;
      expired += sub.expired;
      missing += sub.missing;
    }

    const nonMissing = total - missing;
    const compliancePct =
      nonMissing > 0
        ? Math.round((valid / nonMissing) * 100)
        : total > 0
        ? Math.round((valid / total) * 100)
        : 0;

    result.push({
      projectName: projName,
      total,
      valid,
      warning,
      expired,
      missing,
      compliancePct,
      subProjects: subBreakdown,
    });
  }

  // Sort projects: Keemart Dark Store, Keemart QC, Keemart DC, Ninja, PIF, 9ROUND, then others by size
  const projectPriority: Record<string, number> = {
    'Keemart Dark Store': 1,
    'Keemart QC': 2,
    'Keemart DC': 3,
    'Ninja': 4,
    'PIF': 5,
    '9ROUND': 6,
  };

  return result.sort((a, b) => {
    const prioA = projectPriority[a.projectName] || 99;
    const prioB = projectPriority[b.projectName] || 99;
    if (prioA !== prioB) return prioA - prioB;
    return b.total - a.total;
  });
}
