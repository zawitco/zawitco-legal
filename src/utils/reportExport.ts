import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import {
  RecordItemData,
  KPIScorecardSummary,
  SubProjectBreakdownRow,
  ProjectHierarchyGroup,
} from '../types';
import { classifyKPIValue } from './kpiEngine';

interface ExportOptions {
  projectName: string;
  subProjectName: string;
  activeKpi: string;
  records: RecordItemData[];
  visibleColumns: string[];
  scorecard: KPIScorecardSummary;
  subProjectBreakdown: SubProjectBreakdownRow[];
  hierarchy?: ProjectHierarchyGroup[];
  lastSyncedAt: string | null;
}

export function exportPdfReport(options: ExportOptions): void {
  const {
    projectName,
    subProjectName,
    activeKpi,
    records,
    visibleColumns,
    scorecard,
    subProjectBreakdown,
    hierarchy = [],
    lastSyncedAt,
  } = options;

  const doc = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: 'a4',
  });

  const generatedDate = new Date().toLocaleString();
  const lastSyncStr = lastSyncedAt ? new Date(lastSyncedAt).toLocaleString() : 'N/A';

  // 1. Report Header Banner (Executive Dark Navy)
  doc.setFillColor(15, 23, 42); // slate-900
  doc.rect(0, 0, 297, 24, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.text('PROJECT & SUB-PROJECT EXECUTIVE COMPLIANCE REPORT', 14, 11);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(203, 213, 225); // slate-300
  doc.text(
    `Scope: ${projectName.toUpperCase()}  |  Location: ${subProjectName.toUpperCase()}  |  KPI: ${activeKpi}  |  Workforce: ACTIVE EMPLOYEES ONLY  |  ${generatedDate}`,
    14,
    18
  );

  // Top right badge
  doc.text(`Last Synced: ${lastSyncStr}`, 283, 18, { align: 'right' });

  // 2. Section 1 — PRIMARY REPORT: Project & Sub-Project Hierarchical Summary Table
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(15, 23, 42);
  doc.text('1. Project & Sub-Project Executive Compliance Report (Active Workforce)', 14, 32);

  const hierarchyHead = [
    [
      'Project / Sub-Project Location',
      'Type',
      'Active Workforce',
      'Valid / Active',
      'Expiring Soon',
      'Expired',
      'Missing',
      'Compliance Rate',
    ],
  ];

  const hierarchyBody: any[][] = [];

  if (hierarchy.length > 0) {
    for (const proj of hierarchy) {
      // Project Parent Row
      hierarchyBody.push([
        `PROJECT: ${proj.projectName.toUpperCase()}`,
        `${proj.subProjects.length} Sites`,
        `${proj.total}`,
        `${proj.valid}`,
        `${proj.warning}`,
        `${proj.expired}`,
        `${proj.missing}`,
        `${proj.compliancePct}%`,
      ]);

      // Child Sub-Projects
      for (const sub of proj.subProjects) {
        hierarchyBody.push([
          `   • ${sub.subProjectName}`,
          'Sub-Project',
          `${sub.total}`,
          `${sub.valid}`,
          `${sub.warning}`,
          `${sub.expired}`,
          `${sub.missing}`,
          `${sub.compliancePct}%`,
        ]);
      }
    }
  } else {
    for (const sub of subProjectBreakdown) {
      hierarchyBody.push([
        sub.subProjectName,
        'Site',
        `${sub.total}`,
        `${sub.valid}`,
        `${sub.warning}`,
        `${sub.expired}`,
        `${sub.missing}`,
        `${sub.compliancePct}%`,
      ]);
    }
  }

  // Grand Total Summary Row
  const totalW = records.length;
  hierarchyBody.push([
    'PORTFOLIO GRAND TOTAL',
    'All Projects',
    `${scorecard.totalRecords}`,
    `${scorecard.validCount}`,
    `${scorecard.warningCount}`,
    `${scorecard.expiredCount}`,
    `${scorecard.missingCount}`,
    `${scorecard.overallCompliancePct}%`,
  ]);

  autoTable(doc, {
    startY: 35,
    head: hierarchyHead,
    body: hierarchyBody,
    theme: 'grid',
    headStyles: {
      fillColor: [15, 23, 42],
      textColor: [255, 255, 255],
      fontSize: 8.5,
      fontStyle: 'bold',
      halign: 'center',
    },
    bodyStyles: {
      fontSize: 8,
      halign: 'center',
      textColor: [15, 23, 42],
    },
    columnStyles: {
      0: { halign: 'left', cellWidth: 80 },
      7: { fontStyle: 'bold', textColor: [16, 185, 129] },
    },
    didParseCell: (data) => {
      // Format project parent rows distinctly
      const rawRow = data.row.raw as any;
      const rawText = Array.isArray(rawRow)
        ? String(rawRow[0] || '')
        : typeof rawRow === 'object' && rawRow !== null
        ? String((Object.values(rawRow)[0] as string) || '')
        : '';

      if (rawText.startsWith('PROJECT:')) {
        data.cell.styles.fillColor = [241, 245, 249]; // slate-100
        data.cell.styles.fontStyle = 'bold';
        if (data.column.index === 0) {
          data.cell.styles.textColor = [30, 41, 59];
        }
      } else if (rawText.startsWith('PORTFOLIO GRAND TOTAL')) {
        data.cell.styles.fillColor = [15, 23, 42]; // slate-900
        data.cell.styles.textColor = [255, 255, 255];
        data.cell.styles.fontStyle = 'bold';
      }
    },
    margin: { left: 14, right: 14 },
  });

  // 3. Section 2 — KPI Scorecard Summary
  const lastY1 = (doc as any).lastAutoTable ? (doc as any).lastAutoTable.finalY : 90;

  // Add new page if space is tight
  if (lastY1 > 140) {
    doc.addPage();
    doc.setFillColor(15, 23, 42);
    doc.rect(0, 0, 297, 16, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.text('PROJECT COMPLIANCE & KPI SCORECARD (CONTINUED)', 14, 11);
  }

  const currentY = (doc as any).lastAutoTable && lastY1 <= 140 ? lastY1 + 10 : 25;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(15, 23, 42);
  doc.text(`2. Active KPI Scorecard (${activeKpi})`, 14, currentY);

  const scorecardHead = [
    [
      'KPI Element',
      'Total Active',
      'Valid / Active',
      'Expiring Soon',
      'Expired / Critical',
      'Missing / Unset',
      'Compliance Rate',
    ],
  ];

  const scorecardBody = [
    [
      scorecard.kpiName,
      `${scorecard.totalRecords}`,
      `${scorecard.validCount} (${scorecard.validPct}%)`,
      `${scorecard.warningCount} (${scorecard.warningPct}%)`,
      `${scorecard.expiredCount} (${scorecard.expiredPct}%)`,
      `${scorecard.missingCount} (${scorecard.missingPct}%)`,
      `${scorecard.overallCompliancePct}%`,
    ],
  ];

  autoTable(doc, {
    startY: currentY + 3,
    head: scorecardHead,
    body: scorecardBody,
    theme: 'grid',
    headStyles: {
      fillColor: [30, 41, 59],
      textColor: [255, 255, 255],
      fontSize: 8.5,
      fontStyle: 'bold',
      halign: 'center',
    },
    bodyStyles: {
      fontSize: 8.5,
      halign: 'center',
      textColor: [15, 23, 42],
    },
    columnStyles: {
      0: { halign: 'left', fontStyle: 'bold' },
      6: { fontStyle: 'bold', textColor: [16, 185, 129] },
    },
    margin: { left: 14, right: 14 },
  });

  // 4. Section 3 — Detailed Filtered Records Table (On new page)
  doc.addPage();
  doc.setFillColor(15, 23, 42);
  doc.rect(0, 0, 297, 16, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text(`3. Detailed Active Employee Roster (${records.length} Active Records)`, 14, 11);

  const displayCols = visibleColumns.slice(0, 10);
  const tableHead = [displayCols];

  const tableBody = records.map((rec) => {
    return displayCols.map((col) => {
      return rec.data[col] || '';
    });
  });

  autoTable(doc, {
    startY: 22,
    head: tableHead,
    body: tableBody,
    theme: 'grid',
    headStyles: {
      fillColor: [15, 23, 42],
      textColor: [255, 255, 255],
      fontSize: 7.5,
      fontStyle: 'bold',
    },
    bodyStyles: {
      fontSize: 7,
      textColor: [30, 41, 59],
    },
    didParseCell: (data) => {
      if (data.section === 'body' && displayCols[data.column.index] === activeKpi) {
        const cellText = String(data.cell.raw || '');
        const { status } = classifyKPIValue(cellText);
        if (status === 'VALID') {
          data.cell.styles.fillColor = [209, 250, 229];
          data.cell.styles.textColor = [6, 95, 70];
        } else if (status === 'WARNING') {
          data.cell.styles.fillColor = [254, 243, 199];
          data.cell.styles.textColor = [146, 64, 14];
        } else if (status === 'EXPIRED') {
          data.cell.styles.fillColor = [255, 228, 230];
          data.cell.styles.textColor = [159, 18, 57];
        }
      }
    },
    margin: { left: 14, right: 14, bottom: 15 },
    didDrawPage: (data) => {
      const pageNumber = (doc as any).internal.getNumberOfPages();
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(148, 163, 184);
      doc.text(
        `Page ${data.pageNumber} of ${pageNumber}  •  Zawitco Multi-Project Executive Report (Active Workforce)`,
        14,
        202
      );
    },
  });

  const safeProject = projectName.replace(/[^a-zA-Z0-9-_]/g, '_');
  const safeKpi = activeKpi.replace(/[^a-zA-Z0-9-_]/g, '_');
  doc.save(`${safeProject}_${safeKpi}_Executive_Report.pdf`);
}

export function exportExcelReport(options: ExportOptions): void {
  const {
    projectName,
    subProjectName,
    activeKpi,
    records,
    visibleColumns,
    scorecard,
    subProjectBreakdown,
    hierarchy = [],
    lastSyncedAt,
  } = options;

  const wb = XLSX.utils.book_new();

  // 1. PRIMARY SHEET: Project & Sub-Project Hierarchical Report
  const hierarchyData: any[][] = [
    ['PROJECT & SUB-PROJECT EXECUTIVE COMPLIANCE REPORT'],
    ['Scope', projectName],
    ['Location Filter', subProjectName],
    ['Active KPI Element', activeKpi],
    ['Workforce Scope', 'Active Employees Only (STATUS = ACTIVE)'],
    ['Generated Date', new Date().toLocaleString()],
    ['Last Google Sheet Sync', lastSyncedAt ? new Date(lastSyncedAt).toLocaleString() : 'N/A'],
    [],
    [
      'Project / Sub-Project Location',
      'Classification',
      'Active Workforce',
      'Valid / Active',
      'Expiring Soon',
      'Expired',
      'Missing',
      'Compliance Rate %',
    ],
  ];

  if (hierarchy.length > 0) {
    for (const proj of hierarchy) {
      hierarchyData.push([
        `PROJECT: ${proj.projectName.toUpperCase()}`,
        'Project Rollup',
        proj.total,
        proj.valid,
        proj.warning,
        proj.expired,
        proj.missing,
        `${proj.compliancePct}%`,
      ]);

      for (const sub of proj.subProjects) {
        hierarchyData.push([
          `   • ${sub.subProjectName}`,
          'Sub-Project',
          sub.total,
          sub.valid,
          sub.warning,
          sub.expired,
          sub.missing,
          `${sub.compliancePct}%`,
        ]);
      }
    }
  } else {
    for (const sub of subProjectBreakdown) {
      hierarchyData.push([
        sub.subProjectName,
        'Site',
        sub.total,
        sub.valid,
        sub.warning,
        sub.expired,
        sub.missing,
        `${sub.compliancePct}%`,
      ]);
    }
  }

  // Grand total
  hierarchyData.push([
    'PORTFOLIO GRAND TOTAL',
    'Grand Total',
    scorecard.totalRecords,
    scorecard.validCount,
    scorecard.warningCount,
    scorecard.expiredCount,
    scorecard.missingCount,
    `${scorecard.overallCompliancePct}%`,
  ]);

  const wsHierarchy = XLSX.utils.aoa_to_sheet(hierarchyData);
  XLSX.utils.book_append_sheet(wb, wsHierarchy, 'Project_Summary_Report');

  // 2. KPI Scorecard Sheet
  const scorecardData: any[][] = [
    ['KPI SCORECARD METRICS'],
    ['Active KPI', activeKpi],
    [],
    [
      'KPI Element',
      'Total Active',
      'Valid / Active',
      'Valid %',
      'Expiring Soon',
      'Expiring %',
      'Expired',
      'Expired %',
      'Missing',
      'Missing %',
      'Compliance Rate %',
    ],
    [
      scorecard.kpiName,
      scorecard.totalRecords,
      scorecard.validCount,
      `${scorecard.validPct}%`,
      scorecard.warningCount,
      `${scorecard.warningPct}%`,
      scorecard.expiredCount,
      `${scorecard.expiredPct}%`,
      scorecard.missingCount,
      `${scorecard.missingPct}%`,
      `${scorecard.overallCompliancePct}%`,
    ],
  ];

  const wsScorecard = XLSX.utils.aoa_to_sheet(scorecardData);
  XLSX.utils.book_append_sheet(wb, wsScorecard, 'KPI_Scorecard');

  // 3. Filtered Records Sheet (Restricted Strictly to visibleColumns, active only)
  const recordsHeaders = ['Composite ID', 'Sheet Tab', 'Project Name', 'Sub-Project Name', ...visibleColumns];
  const recordsData: any[][] = [recordsHeaders];

  for (const rec of records) {
    const rowVals = [
      rec.composite_id,
      rec.sheet_tab,
      rec.project_name,
      rec.sub_project_name,
      ...visibleColumns.map((col) => rec.data[col] || ''),
    ];
    recordsData.push(rowVals);
  }

  const wsRecords = XLSX.utils.aoa_to_sheet(recordsData);
  XLSX.utils.book_append_sheet(wb, wsRecords, 'Active_Employee_Roster');

  const safeProject = projectName.replace(/[^a-zA-Z0-9-_]/g, '_');
  const safeKpi = activeKpi.replace(/[^a-zA-Z0-9-_]/g, '_');
  XLSX.writeFile(wb, `${safeProject}_${safeKpi}_Executive_Report.xlsx`);
}
