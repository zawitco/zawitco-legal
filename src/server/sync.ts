import crypto from 'crypto';
import https from 'https';
import fs from 'fs';
import path from 'path';
import { getDb, persistDb, queryOne, PortalConfig } from './db.js';

function base64url(str: string): string {
  return Buffer.from(str)
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

async function getGoogleAccessToken(serviceAccountJson: string): Promise<string> {
  const sa = JSON.parse(serviceAccountJson);
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: 'RS256', typ: 'JWT' };
  const claim = {
    iss: sa.client_email,
    scope: 'https://www.googleapis.com/auth/spreadsheets.readonly',
    aud: 'https://oauth2.googleapis.com/token',
    exp: now + 3600,
    iat: now,
  };

  const encodedHeader = base64url(JSON.stringify(header));
  const encodedClaim = base64url(JSON.stringify(claim));
  const sign = crypto.createSign('RSA-SHA256');
  sign.update(`${encodedHeader}.${encodedClaim}`);

  const normalizedPrivateKey = sa.private_key.replace(/\\n/g, '\n');
  const signature = sign
    .sign(normalizedPrivateKey, 'base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');

  const assertion = `${encodedHeader}.${encodedClaim}.${signature}`;
  const postData = `grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer&assertion=${assertion}`;

  return new Promise((resolve, reject) => {
    const req = https.request(
      'https://oauth2.googleapis.com/token',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Content-Length': Buffer.byteLength(postData),
        },
      },
      (res) => {
        let body = '';
        res.on('data', (c) => (body += c));
        res.on('end', () => {
          try {
            const data = JSON.parse(body);
            if (data.access_token) {
              resolve(data.access_token);
            } else {
              reject(new Error(`Failed to get access token: ${body}`));
            }
          } catch (e: any) {
            reject(new Error(`Error parsing token response: ${e.message}`));
          }
        });
      }
    );
    req.on('error', reject);
    req.write(postData);
    req.end();
  });
}

async function fetchSheetTabValues(
  spreadsheetId: string,
  tabName: string,
  token: string
): Promise<any[][]> {
  return new Promise((resolve, reject) => {
    const encodedTab = encodeURIComponent(tabName);
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodedTab}`;

    https
      .get(
        url,
        {
          headers: { Authorization: `Bearer ${token}` },
        },
        (res) => {
          let body = '';
          res.on('data', (c) => (body += c));
          res.on('end', () => {
            if (res.statusCode && res.statusCode >= 400) {
              reject(new Error(`Sheets API HTTP ${res.statusCode}: ${body}`));
              return;
            }
            try {
              const data = JSON.parse(body);
              resolve(data.values || []);
            } catch (e: any) {
              reject(new Error(`Failed to parse sheet data: ${e.message}`));
            }
          });
        }
      )
      .on('error', reject);
  });
}

export async function syncGoogleSheetsData(): Promise<{
  success: boolean;
  count: number;
  timestamp: string;
  tabsSynced: string[];
}> {
  const db = await getDb();
  const config = queryOne<PortalConfig>('SELECT * FROM portal_config WHERE id = 1');
  if (!config) {
    throw new Error('Portal configuration not found.');
  }

  const spreadsheetId = process.env.SPREADSHEET_ID || config.spreadsheet_id;
  const sheetTabs: string[] = JSON.parse(config.sheet_tabs_json || '[]');

  let saJson = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  if (!saJson) {
    const saPath = path.resolve(process.cwd(), 'service_account.json');
    if (fs.existsSync(saPath)) {
      try {
        saJson = fs.readFileSync(saPath, 'utf8');
      } catch (_) {}
    }
  }
  if (!saJson) {
    saJson = config.service_account_json;
  }
  if (!saJson || saJson.trim() === '' || saJson === '{}') {
    throw new Error('Google Cloud Service Account credentials are not configured. Please provide GOOGLE_SERVICE_ACCOUNT_JSON or configure via Admin Settings.');
  }

  const token = await getGoogleAccessToken(saJson);

  const discoveredHeaders = new Set<string>();
  const parsedRecords: Array<{
    composite_id: string;
    sheet_tab: string;
    project_name: string;
    sub_project_name: string;
    data_json: string;
  }> = [];

  for (const tab of sheetTabs) {
    const rows = await fetchSheetTabValues(spreadsheetId, tab, token);
    if (!rows || rows.length === 0) continue;

    // Detect header row: look for row containing EMPLOYEE NAME or ERP
    let headerRowIdx = -1;
    for (let r = 0; r < Math.min(6, rows.length); r++) {
      const rowStr = (rows[r] || []).join(' ').toUpperCase();
      if (
        rowStr.includes('EMPLOYEE NAME') ||
        (rowStr.includes('EMPLOYEE') && rowStr.includes('ERP')) ||
        (rowStr.includes('STATUS') && rowStr.includes('START WORK'))
      ) {
        headerRowIdx = r;
        break;
      }
    }

    if (headerRowIdx === -1) {
      headerRowIdx = 2; // fallback
    }

    const rawHeaders: string[] = rows[headerRowIdx] || [];
    const subHeaders: string[] = rows[headerRowIdx + 1] || [];

    // Construct normalized headers
    const headers: string[] = [];
    for (let c = 0; c < rawHeaders.length; c++) {
      let h = (rawHeaders[c] || '').trim();
      const sub = (subHeaders[c] || '').trim();

      if (!h && sub) {
        const prevHeader = headers[c - 1] || '';
        if (prevHeader.toLowerCase().includes('health')) {
          h = 'HEALTH CARD EXPIRY';
        } else {
          h = sub;
        }
      } else if (h.toUpperCase() === 'HEALTH CARD' && sub) {
        h = `HEALTH CARD ${sub}`.trim();
      }

      if (!h) {
        h = `COL_${c + 1}`;
      }

      // Ensure uniqueness
      let finalHeader = h;
      let counter = 1;
      while (headers.includes(finalHeader)) {
        counter++;
        finalHeader = `${h} (${counter})`;
      }

      headers.push(finalHeader);
      discoveredHeaders.add(finalHeader);
    }

    // Data rows start after subheaders
    const hasSubHeaderRow = subHeaders.some(
      (s: any) => typeof s === 'string' && /number|expiry|date|h\.c/i.test(s)
    );
    const dataStartIdx = hasSubHeaderRow ? headerRowIdx + 2 : headerRowIdx + 1;

    // Default project name per tab
    let defaultTabProject = tab;
    if (tab.toLowerCase().includes('projects - b')) {
      defaultTabProject = 'Keemart Dark Store';
    } else if (tab.toLowerCase().includes('projects - c')) {
      defaultTabProject = 'Ninja';
    }

    let currentSectionSubProject = '';
    let currentTabBProject = 'Keemart Dark Store';
    let currentTabAProject = 'PIF';

    if (tab.toLowerCase().includes('projects - b')) {
      currentSectionSubProject = 'DS RUH 001';
    } else if (tab.toLowerCase().includes('projects - c')) {
      currentSectionSubProject = 'NINJA HEAD OFFICE';
    }

    let activeHeaders: string[] = [...headers];

    for (let r = 0; r < rows.length; r++) {
      const row = rows[r];
      if (!row || row.length === 0) continue;

      const rowStr = row.join(' ').toUpperCase();

      // Check if this row is a header row (section divider or repeated headers with PROJECT NAME / SUB PROJECT)
      if (
        (rowStr.includes('EMPLOYEE NAME') && (rowStr.includes('START WORK') || rowStr.includes('STATUS'))) ||
        (rowStr.includes('PROJECT NAME') && rowStr.includes('EMAIL')) ||
        (rowStr.includes('SUB PROJECT') && rowStr.includes('EMAIL'))
      ) {
        const newHdrs: string[] = [];
        for (let c = 0; c < row.length; c++) {
          let h = String(row[c] || '').trim();
          if (!h) h = `COL_${c + 1}`;
          let finalHeader = h;
          let counter = 1;
          while (newHdrs.includes(finalHeader)) {
            counter++;
            finalHeader = `${h} (${counter})`;
          }
          newHdrs.push(finalHeader);
          discoveredHeaders.add(finalHeader);
        }
        activeHeaders = newHdrs;
        continue;
      }

      // Track section titles across the sheet
      if (tab.toLowerCase().includes('projects - b')) {
        if (rowStr.includes('KEEMART QC') || (rowStr.includes('QC') && rowStr.includes('QUALITY'))) {
          currentTabBProject = 'Keemart QC';
          currentSectionSubProject = 'KEEMART QC';
        } else if (rowStr.includes('KEEMART DC') || rowStr.includes('DC WAREHOUSE') || rowStr.includes('DC PRODUCTION')) {
          currentTabBProject = 'Keemart DC';
          currentSectionSubProject = 'KEEMART DC';
        } else if (rowStr.includes('OUT OF RIYADH')) {
          currentTabBProject = 'Keemart Dark Store';
          currentSectionSubProject = 'DS OUT OF RIYADH';
        } else if (rowStr.includes('RUH 002') || rowStr.includes('RUH002')) {
          currentTabBProject = 'Keemart Dark Store';
          currentSectionSubProject = 'DS RUH 002';
        } else if (rowStr.includes('RUH 001') || rowStr.includes('RUH001') || rowStr.includes('DARK STORE')) {
          currentTabBProject = 'Keemart Dark Store';
          currentSectionSubProject = 'DS RUH 001';
        }
      } else if (tab.toLowerCase().includes('projects - c')) {
        if (rowStr.includes('HEAD OFFICE') || rowStr.includes('HEADOFFICE')) {
          currentSectionSubProject = 'NINJA HEAD OFFICE';
        } else if (rowStr.includes('RUH 001') || rowStr.includes('RUH001')) {
          currentSectionSubProject = 'NINJA RUH001';
        } else if (rowStr.includes('RUH 002') || rowStr.includes('RUH002')) {
          currentSectionSubProject = 'NINJA RUH002';
        } else if (rowStr.includes('WEST 001') || rowStr.includes('WEST001')) {
          currentSectionSubProject = 'NINJA WEST001';
        } else if (rowStr.includes('WEST 002') || rowStr.includes('WEST002')) {
          currentSectionSubProject = 'NINJA WEST002';
        } else if (rowStr.includes('NORTH 001') || rowStr.includes('NORTH001')) {
          currentSectionSubProject = 'NINJA NORTH001';
        }
      }

      // Skip short divider/header rows that have fewer than 5 populated cells
      const filledCells = row.filter((c) => String(c || '').trim() !== '');
      if (filledCells.length < 5) {
        if (tab.toLowerCase().includes('projects - a')) {
          if (rowStr.includes('TERMINATED') || rowStr.includes('STOPPED')) {
            currentTabAProject = 'TERMINATED';
          } else if (rowStr.includes('PIF')) {
            currentTabAProject = 'PIF';
          } else if (rowStr.includes('SGS')) {
            currentTabAProject = 'SGS';
          } else if (rowStr.includes('NINJA HOSPITALITY')) {
            currentTabAProject = 'NINJA HOSPITALITY';
          } else if (rowStr.includes('4 POINTS')) {
            currentTabAProject = '4 POINTS';
          } else if (rowStr.includes('OM SHRIF')) {
            currentTabAProject = 'OM SHRIF 2';
          } else if (rowStr.includes('9ROUND')) {
            currentTabAProject = '9ROUND';
          } else if (rowStr.includes('SAFOOD')) {
            currentTabAProject = 'SAFOOD';
          } else if (rowStr.includes('PILATES')) {
            currentTabAProject = 'i PILATES';
          } else if (rowStr.includes('CHEFZ')) {
            currentTabAProject = 'THE CHEFZ';
          } else if (rowStr.includes('DOOS')) {
            currentTabAProject = 'THE DOOS';
          }
        }
        continue;
      }

      if (r < dataStartIdx) continue;

      if (tab.toLowerCase().includes('projects - a') && currentTabAProject === 'TERMINATED') {
        continue;
      }

      // Skip repeated header rows or section divider rows
      if (
        rowStr.includes('EMPLOYEE NAME') ||
        rowStr.includes('START WORK') ||
        rowStr.includes('NINJA - RUH') ||
        rowStr.includes('NINJA - WEST') ||
        rowStr.includes('NINJA - NORTH') ||
        rowStr.includes('DARK STORE - RUH')
      ) {
        continue;
      }

      const rowObj: Record<string, string> = {};
      for (let c = 0; c < activeHeaders.length; c++) {
        rowObj[activeHeaders[c]] = row[c] !== undefined && row[c] !== null ? String(row[c]).trim() : '';
      }

      // Skip rows with no employee name or ERP id
      const nameKey = activeHeaders.find((h) => /^employee\s*name/i.test(h)) || headers.find((h) => /^employee\s*name/i.test(h));
      const erpKey = activeHeaders.find((h) => /^erp\s*id/i.test(h)) || headers.find((h) => /^erp\s*id/i.test(h));
      const nameVal = nameKey ? (rowObj[nameKey] || '').trim() : '';
      const erpVal = erpKey ? (rowObj[erpKey] || '').trim() : '';

      if (!nameVal && !erpVal) {
        continue;
      }

      // Check if employee name itself is a section title
      const upperName = nameVal.toUpperCase();
      if (
        upperName.includes('KEEMART - DARK STORE') ||
        upperName.startsWith('NINJA - ') ||
        upperName === 'RUH 002- KEEMART - DARK STORE' ||
        upperName.includes('HEAD OFFICE')
      ) {
        continue;
      }

      // Status check: strictly active employees only
      const statusKey = Object.keys(rowObj).find((k) => k.trim().toUpperCase() === 'STATUS');
      if (tab.toLowerCase().includes('projects - a')) {
        if (!statusKey || !rowObj[statusKey]) {
          rowObj['STATUS'] = 'ACTIVE';
          discoveredHeaders.add('STATUS');
        }
      }

      const currentStatus = (rowObj[statusKey || 'STATUS'] || '').trim().toUpperCase();
      // Exclude any employee whose status is not active (e.g. TERMINATED, RUN AWAY, INACTIVE, ESCAPE, etc.)
      if (currentStatus && currentStatus !== 'ACTIVE') {
        continue;
      }

      // Find 'PROJECT NAME' header from the master sheet (searching from last column backwards)
      let explicitProjectName = '';
      for (let c = activeHeaders.length - 1; c >= 0; c--) {
        if (/^project\s*name$/i.test(activeHeaders[c]) && row[c]) {
          const val = String(row[c]).trim();
          if (val && !/^project\s*name$/i.test(val)) {
            explicitProjectName = val;
            break;
          }
        }
      }

      // Find 'SUB PROJECT' header from the master sheet (searching from last column backwards)
      let explicitSubProject = '';
      for (let c = activeHeaders.length - 1; c >= 0; c--) {
        if (/^sub[\s_-]*projects?$/i.test(activeHeaders[c]) && row[c]) {
          const val = String(row[c]).trim();
          if (val && !/^sub[\s_-]*projects?$/i.test(val)) {
            explicitSubProject = val;
            break;
          }
        }
      }

      // Dynamically detect or assign project_name and sub_project_name
      let projectName = '';
      let subProjectName = 'MAIN';

      if (tab.toLowerCase().includes('projects - b')) {
        // Tab B: Keemart Dark Store (3 sub projects: DS RUH 001, DS RUH 002, DS OUT OF RIYADH), Keemart QC, Keemart DC
        const subRaw = (explicitSubProject || rowObj['SUB PROJECTS'] || rowObj['SUB PROJECT'] || '').toUpperCase();
        const reasonRaw = (rowObj['REASON OF RUNAWAY / TERMINATION'] || '').toUpperCase();
        const desigRaw = (rowObj['DESIGNATION'] || '').toUpperCase();

        if (
          explicitProjectName.toUpperCase().includes('KEEMART QC') ||
          subRaw.includes('KEEMART QC') ||
          desigRaw.includes('QC') ||
          currentTabBProject === 'Keemart QC'
        ) {
          projectName = 'Keemart QC';
          subProjectName = 'KEEMART QC';
        } else if (
          explicitProjectName.toUpperCase().includes('KEEMART DC') ||
          reasonRaw.includes('KEEMART DC') ||
          desigRaw.includes('DC ') ||
          desigRaw.includes('DC WAREHOUSE') ||
          currentTabBProject === 'Keemart DC'
        ) {
          projectName = 'Keemart DC';
          subProjectName = 'KEEMART DC';
        } else {
          projectName = 'Keemart Dark Store';
          if (subRaw.includes('OUT OF RIYADH') || currentSectionSubProject === 'DS OUT OF RIYADH') {
            subProjectName = 'DS OUT OF RIYADH';
          } else if (subRaw.includes('RUH 002') || subRaw.includes('RUH002') || currentSectionSubProject === 'DS RUH 002') {
            subProjectName = 'DS RUH 002';
          } else {
            subProjectName = 'DS RUH 001';
          }
        }
      } else if (tab.toLowerCase().includes('projects - c')) {
        // Tab C: Ninja (6 sub projects: NINJA HEAD OFFICE, NINJA RUH001, NINJA RUH002, NINJA WEST001, NINJA WEST002, NINJA NORTH001)
        projectName = explicitProjectName || 'Ninja';

        const subRaw = (explicitSubProject || rowObj['SUB PROJECT'] || '').toUpperCase();
        const branchCode = (rowObj['BRANCH'] || '').toUpperCase();

        if (subRaw.includes('HEAD OFFICE') || branchCode === 'H O' || branchCode === 'HO') {
          subProjectName = 'NINJA HEAD OFFICE';
        } else if (subRaw.includes('RUH001') || subRaw.includes('RUH 001')) {
          subProjectName = 'NINJA RUH001';
        } else if (subRaw.includes('RUH002') || subRaw.includes('RUH 002')) {
          subProjectName = 'NINJA RUH002';
        } else if (subRaw.includes('WEST001') || subRaw.includes('WEST 001')) {
          subProjectName = 'NINJA WEST001';
        } else if (subRaw.includes('WEST002') || subRaw.includes('WEST 002')) {
          subProjectName = 'NINJA WEST002';
        } else if (subRaw.includes('NORTH001') || subRaw.includes('NORTH 001')) {
          subProjectName = 'NINJA NORTH001';
        } else if (branchCode.startsWith('RUH')) {
          subProjectName = currentSectionSubProject === 'NINJA RUH002' ? 'NINJA RUH002' : 'NINJA RUH001';
        } else if (branchCode.startsWith('JED') || branchCode.startsWith('MDN') || branchCode.startsWith('MAK')) {
          subProjectName = currentSectionSubProject === 'NINJA WEST002' ? 'NINJA WEST002' : 'NINJA WEST001';
        } else if (branchCode.startsWith('DMM') || branchCode.startsWith('KHB') || branchCode.startsWith('HAS') || branchCode.startsWith('JUB')) {
          subProjectName = 'NINJA NORTH001';
        } else {
          subProjectName = currentSectionSubProject || 'NINJA HEAD OFFICE';
        }
      } else {
        // Tab A: Find 'PROJECT NAME' header from the master sheet (at the last end of data columns)
        if (explicitProjectName) {
          projectName = explicitProjectName;
        } else if (currentTabAProject && currentTabAProject !== 'TERMINATED') {
          projectName = currentTabAProject;
        } else if (config.project_column && rowObj[config.project_column]) {
          projectName = rowObj[config.project_column];
        } else {
          const projectKey = activeHeaders.find((h) => /^project(\s*name)?$/i.test(h));
          projectName = (projectKey && rowObj[projectKey]) ? rowObj[projectKey] : defaultTabProject;
        }
        if (!projectName || projectName === '0' || projectName === '-' || projectName === 'Projects - A') {
          projectName = 'General';
        }

        // Sub project from 'SUB PROJECT' header, or location from 'PROJECT' column
        if (explicitSubProject) {
          subProjectName = explicitSubProject;
        } else {
          const siteCol = activeHeaders.find((h) => /^project$/i.test(h));
          subProjectName = (siteCol && rowObj[siteCol]) ? rowObj[siteCol] : 'MAIN';
        }
        if (!subProjectName || subProjectName === '0' || subProjectName === '-') {
          subProjectName = 'MAIN';
        }
      }

      rowObj['PROJECT'] = projectName;
      rowObj['PROJECT NAME'] = projectName;
      rowObj['SUB PROJECT'] = subProjectName;
      rowObj['SUB PROJECTS'] = subProjectName;

      discoveredHeaders.add('PROJECT NAME');
      discoveredHeaders.add('PROJECT');
      discoveredHeaders.add('SUB PROJECT');
      discoveredHeaders.add('SUB PROJECTS');

      const compositeId = `${tab}__${r}`;
      parsedRecords.push({
        composite_id: compositeId,
        sheet_tab: tab,
        project_name: projectName,
        sub_project_name: subProjectName,
        data_json: JSON.stringify(rowObj),
      });
    }
  }

  // Update portal_config columns
  const allColsArray = Array.from(discoveredHeaders).filter(
    (c) => !c.startsWith('COL_') && !/^TOTAL$/i.test(c) && !/^SL(\s*NO)?$/i.test(c)
  );

  // Default visible columns: clean, high-value columns
  const defaultVisibleKeywords = [
    'EMPLOYEE NAME',
    'ERP ID',
    'STATUS',
    'START WORK',
    'AJEER',
    'AJEER EXPIRY',
    'HEALTH CARD NUMBER',
    'HEALTH CARD EXPIRY',
    'MEDICAL TEST',
    'MUQEEM',
    'NATIONALITY',
    'IQAMA NO',
    'PROJECT NAME',
    'PROJECT',
    'SUB PROJECT',
    'SUB PROJECTS',
    'BRANCH',
    'DESIGNATION',
  ];

  let visibleCols = allColsArray.filter((c) =>
    defaultVisibleKeywords.some((k) => c.toUpperCase() === k || c.toUpperCase().includes(k))
  );
  if (visibleCols.length === 0) {
    visibleCols = allColsArray.slice(0, 15);
  }

  // Auto-detect KPI elements
  const defaultKpis = [
    'AJEER',
    'AJEER EXPIRY',
    'HEALTH CARD NUMBER',
    'HEALTH CARD EXPIRY',
    'MEDICAL TEST',
    'MUQEEM',
    'SPONSORSHIP',
    'IQAMA STATUS',
    'STATUS',
  ];
  const kpiElements = allColsArray.filter((c) =>
    defaultKpis.some((k) => c.toUpperCase() === k || c.toUpperCase().includes(k))
  );

  const timestamp = new Date().toISOString();
  db.run('BEGIN TRANSACTION');
  try {
    const tabPlaceholders = sheetTabs.map(() => '?').join(',');
    const deleteStmt = db.prepare(`DELETE FROM records WHERE sheet_tab IN (${tabPlaceholders})`);
    deleteStmt.run(sheetTabs);
    deleteStmt.free();

    const insertStmt = db.prepare(`
      INSERT OR REPLACE INTO records (
        composite_id, sheet_tab, project_name, sub_project_name, data_json, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?)
    `);

    for (const rec of parsedRecords) {
      insertStmt.run([
        rec.composite_id,
        rec.sheet_tab,
        rec.project_name,
        rec.sub_project_name,
        rec.data_json,
        timestamp,
      ]);
    }
    insertStmt.free();

    const updateCfg = db.prepare(`
      UPDATE portal_config
      SET all_columns_json = ?,
          visible_columns_json = ?,
          kpi_elements_json = ?,
          project_column = ?,
          sub_project_column = ?,
          last_synced_at = ?,
          last_sync_count = ?
      WHERE id = 1
    `);
    updateCfg.run([
      JSON.stringify(allColsArray),
      JSON.stringify(visibleCols),
      JSON.stringify(kpiElements),
      'PROJECT',
      'SUB PROJECTS',
      timestamp,
      parsedRecords.length,
    ]);
    updateCfg.free();

    db.run('COMMIT');
  } catch (err) {
    db.run('ROLLBACK');
    throw err;
  }

  persistDb(db);

  return {
    success: true,
    count: parsedRecords.length,
    timestamp,
    tabsSynced: sheetTabs,
  };
}
