export type KPIStatus = 'VALID' | 'WARNING' | 'EXPIRED' | 'MISSING';

export interface RecordItemData {
  composite_id: string;
  sheet_tab: string;
  project_name: string;
  sub_project_name: string;
  data: Record<string, string>;
  updated_at: string;
}

export interface LinkMeta {
  client_label: string;
  project_name: string;
  sub_project_name: string;
  sheet_tab: string;
}

export interface PortalDataResponse {
  mode: 'client_link' | 'admin' | 'public';
  requiresPin?: boolean;
  message?: string;
  linkMeta?: LinkMeta;
  records: RecordItemData[];
  visibleColumns: string[];
  allColumns?: string[];
  kpiElements: string[];
  projectColumn: string;
  subProjectColumn: string;
  lastSyncedAt: string | null;
  lastSyncCount?: number;
  sheetTabs?: string[];
  lockMainPortal?: boolean;
}

export interface KPICardData {
  status: KPIStatus | 'ALL';
  label: string;
  count: number;
  percentage: number;
  colorClass: string;
  borderClass: string;
  bgClass: string;
  subtext: string;
}

export interface KPIScorecardSummary {
  kpiName: string;
  totalRecords: number;
  validCount: number;
  validPct: number;
  warningCount: number;
  warningPct: number;
  expiredCount: number;
  expiredPct: number;
  missingCount: number;
  missingPct: number;
  overallCompliancePct: number;
}

export type CorePillarKey = 'IQAMA' | 'AJEER' | 'HEALTH' | 'ALL';

export interface CoreComplianceScorecard {
  key: CorePillarKey;
  title: string;
  subtitle: string;
  totalRecords: number;
  validCount: number;
  validPct: number;
  warningCount: number;
  warningPct: number;
  expiredCount: number;
  expiredPct: number;
  missingCount: number;
  missingPct: number;
  compliancePct: number;
}

export interface EmployeeComplianceDetails {
  iqama: { status: KPIStatus; text: string; number?: string; expiry?: string; daysRemaining?: number };
  ajeer: { status: KPIStatus; text: string; expiry?: string; daysRemaining?: number };
  health: { status: KPIStatus; text: string; expiry?: string; daysRemaining?: number };
  overallStatus: KPIStatus;
}

export interface SubProjectBreakdownRow {
  projectName?: string;
  subProjectName: string;
  total: number;
  valid: number;
  warning: number;
  expired: number;
  missing: number;
  compliancePct: number;
}

export interface ProjectHierarchyGroup {
  projectName: string;
  total: number;
  valid: number;
  warning: number;
  expired: number;
  missing: number;
  compliancePct: number;
  subProjects: SubProjectBreakdownRow[];
}

export interface ShareLinkItem {
  token: string;
  client_label: string;
  sheet_tab: string;
  project_name: string;
  sub_project_name: string;
  created_at: string;
}

export interface AdminConfigData {
  spreadsheet_id: string;
  sheet_tabs: string[];
  admin_pin: string;
  lock_main_portal: boolean;
  all_columns: string[];
  visible_columns: string[];
  kpi_elements: string[];
  project_column: string;
  sub_project_column: string;
  last_synced_at: string | null;
  last_sync_count: number;
  service_account_json?: string;
}
