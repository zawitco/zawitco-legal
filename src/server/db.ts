import initSqlJs, { Database as SqlJsDatabase } from 'sql.js';
import fs from 'fs';
import path from 'path';

const DB_PATH = path.resolve(process.cwd(), 'portal_data.db');

export interface PortalConfig {
  id: number;
  spreadsheet_id: string;
  sheet_tabs_json: string;
  service_account_json: string;
  admin_pin: string;
  lock_main_portal: number;
  all_columns_json: string;
  visible_columns_json: string;
  kpi_elements_json: string;
  project_column: string;
  sub_project_column: string;
  last_synced_at: string | null;
  last_sync_count: number;
}

export interface ShareLink {
  token: string;
  client_label: string;
  sheet_tab: string;
  project_name: string;
  sub_project_name: string;
  created_at: string;
}

export interface RecordItem {
  composite_id: string;
  sheet_tab: string;
  project_name: string;
  sub_project_name: string;
  data_json: string;
  updated_at: string;
}

let dbInstance: SqlJsDatabase | null = null;

function getDefaultServiceAccount() {
  if (process.env.GOOGLE_SERVICE_ACCOUNT_JSON) {
    try {
      return JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON);
    } catch (_) {}
  }
  const saPath = path.resolve(process.cwd(), 'service_account.json');
  if (fs.existsSync(saPath)) {
    try {
      return JSON.parse(fs.readFileSync(saPath, 'utf8'));
    } catch (_) {}
  }
  return {
    type: "service_account",
    project_id: process.env.GOOGLE_PROJECT_ID || "zawitco-legal-511622",
    private_key_id: process.env.GOOGLE_PRIVATE_KEY_ID || "",
    private_key: (process.env.GOOGLE_PRIVATE_KEY || "").replace(/\\n/g, '\n'),
    client_email: process.env.GOOGLE_CLIENT_EMAIL || "",
    client_id: "",
    auth_uri: "https://accounts.google.com/o/oauth2/auth",
    token_uri: "https://oauth2.googleapis.com/token",
    auth_provider_x509_cert_url: "https://www.googleapis.com/oauth2/v1/certs",
    client_x509_cert_url: "",
    universe_domain: "googleapis.com"
  };
}

export async function getDb(): Promise<SqlJsDatabase> {
  if (dbInstance) return dbInstance;

  const SQL = await initSqlJs();
  let db: SqlJsDatabase;

  if (fs.existsSync(DB_PATH)) {
    const filebuffer = fs.readFileSync(DB_PATH);
    db = new SQL.Database(filebuffer);
  } else {
    db = new SQL.Database();
  }

  // Initialize tables
  db.run(`
    CREATE TABLE IF NOT EXISTS records (
      composite_id TEXT PRIMARY KEY,
      sheet_tab TEXT,
      project_name TEXT,
      sub_project_name TEXT,
      data_json TEXT,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS portal_config (
      id INTEGER PRIMARY KEY,
      spreadsheet_id TEXT,
      sheet_tabs_json TEXT,
      service_account_json TEXT,
      admin_pin TEXT,
      lock_main_portal INTEGER DEFAULT 0,
      all_columns_json TEXT,
      visible_columns_json TEXT,
      kpi_elements_json TEXT,
      project_column TEXT,
      sub_project_column TEXT,
      last_synced_at TEXT,
      last_sync_count INTEGER
    );

    CREATE TABLE IF NOT EXISTS client_share_links (
      token TEXT PRIMARY KEY,
      client_label TEXT,
      sheet_tab TEXT,
      project_name TEXT NOT NULL,
      sub_project_name TEXT DEFAULT 'ALL',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // Check if portal_config has default row
  const res = db.exec("SELECT * FROM portal_config WHERE id = 1");
  if (!res || res.length === 0 || res[0].values.length === 0) {
    const defaultTabs = JSON.stringify(["Projects - A", "Projects - B", "Projects - C"]);
    const defaultSa = JSON.stringify(getDefaultServiceAccount());
    const stmt = db.prepare(`
      INSERT INTO portal_config (
        id, spreadsheet_id, sheet_tabs_json, service_account_json, admin_pin,
        lock_main_portal, all_columns_json, visible_columns_json, kpi_elements_json,
        project_column, sub_project_column, last_synced_at, last_sync_count
      ) VALUES (1, ?, ?, ?, ?, 0, '[]', '[]', '["Ajeer", "Health Card", "Medical Test", "Sponsorship", "Muqeem"]', 'PROJECT', 'SUB PROJECTS', NULL, 0)
    `);
    stmt.run([
      "1NqVnp2VLJ0Hgd2-sbYHCtSqmi3udjeFjOHD-wCDGDbA",
      defaultTabs,
      defaultSa,
      "123456"
    ]);
    stmt.free();
    persistDb(db);
  }

  dbInstance = db;
  return db;
}

export function persistDb(db?: SqlJsDatabase) {
  const targetDb = db || dbInstance;
  if (!targetDb) return;
  const data = targetDb.export();
  const buffer = Buffer.from(data);
  fs.writeFileSync(DB_PATH, buffer);
}

export function queryAll<T = any>(sql: string, params: any[] = []): T[] {
  if (!dbInstance) throw new Error("Database not initialized");
  const stmt = dbInstance.prepare(sql);
  stmt.bind(params);
  const rows: T[] = [];
  while (stmt.step()) {
    rows.push(stmt.getAsObject() as T);
  }
  stmt.free();
  return rows;
}

export function queryOne<T = any>(sql: string, params: any[] = []): T | null {
  const rows = queryAll<T>(sql, params);
  return rows.length > 0 ? rows[0] : null;
}

export function executeRun(sql: string, params: any[] = []): void {
  if (!dbInstance) throw new Error("Database not initialized");
  if (params.length === 0) {
    dbInstance.run(sql);
  } else {
    const stmt = dbInstance.prepare(sql);
    stmt.run(params);
    stmt.free();
  }
  persistDb();
}
