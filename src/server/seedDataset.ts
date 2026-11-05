import fs from 'fs';
import path from 'path';
import { initializeApp } from 'firebase/app';
import { getFirestore, writeBatch, doc, setDoc } from 'firebase/firestore';
import cfg from '../../firebase-applet-config.json';

function parseCSVLine(text: string): string[] {
  const result: string[] = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === '"') {
      inQuotes = !inQuotes;
    } else if (c === ',' && !inQuotes) {
      result.push(cur.trim());
      cur = '';
    } else {
      cur += c;
    }
  }
  result.push(cur.trim());
  return result;
}

export async function ingestAndSeedCompleteDatabase() {
  const filePath = path.resolve(process.cwd(), 'public/assets/aistudio/ZAWITCO_ALL_PROJECTS_-_Team__A__4c1ba1fe');
  if (!fs.existsSync(filePath)) {
    throw new Error('Attached Team A file not found at ' + filePath);
  }

  const content = fs.readFileSync(filePath, 'utf8');
  const lines = content.split('\n');

  let headers: string[] = [];
  let subHeaders: string[] = [];
  let currentSection = '';
  const teamARecords: any[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    const parts = parseCSVLine(line);
    const rowStr = line.toUpperCase();

    // Check section divider
    if (
      rowStr.startsWith(',PIF') ||
      rowStr.startsWith(',SGS') ||
      rowStr.startsWith(',NINJA HOSPITALITY') ||
      rowStr.startsWith(',4 POINTS') ||
      rowStr.startsWith(',OM SHRIF') ||
      rowStr.startsWith(',9ROUND') ||
      rowStr.startsWith(',SAFOOD') ||
      rowStr.startsWith(',I PILATES') ||
      rowStr.startsWith(',THE CHEFZ') ||
      rowStr.startsWith(',TERMINATED')
    ) {
      currentSection = parts.find((p) => p.length > 0) || '';
      continue;
    }

    // Header line
    if (parts.includes('EMPLOYEE NAME') && parts.includes('ERP ID')) {
      headers = parts.map((h) => h.trim().toUpperCase());
      continue;
    }

    // Subheader line
    if (parts[0] === '' && (parts.includes('NUMBER') || parts.includes('H.C EXPIRY'))) {
      subHeaders = parts.map((h) => h.trim().toUpperCase());
      continue;
    }

    // Skip terminated or stopped rows
    if (
      currentSection.toUpperCase().includes('TERMINATED') ||
      parts[0] === 'IDLE' ||
      parts[0] === 'LEFT' ||
      parts[0] === 'STOPPED'
    ) {
      continue;
    }

    const nameIdx = headers.indexOf('EMPLOYEE NAME');
    const empName = parts[nameIdx];
    if (!empName || empName === 'EMPLOYEE NAME') continue;

    const rowObj: Record<string, string> = {};
    for (let c = 0; c < headers.length; c++) {
      const h = headers[c];
      if (!h) continue;
      let val = parts[c] || '';
      if (val.startsWith('"') && val.endsWith('"')) {
        val = val.substring(1, val.length - 1);
      }
      rowObj[h] = val.trim();
    }

    // Map subheaders if present
    if (subHeaders.length > 0) {
      for (let c = 0; c < subHeaders.length; c++) {
        const sh = subHeaders[c];
        if (sh === 'H.C EXPIRY') {
          rowObj['HEALTH CARD EXPIRY'] = parts[c] ? parts[c].trim() : '';
        } else if (sh === 'NUMBER' && headers[c] === 'HEALTH CARD') {
          rowObj['HEALTH CARD NUMBER'] = parts[c] ? parts[c].trim() : '';
        }
      }
    }

    // Strict Extraction Rules:
    // Main Project: Exclusively from 'PROJECT NAME' header
    const projNameIdx = headers.indexOf('PROJECT NAME');
    let mainProject = projNameIdx !== -1 && parts[projNameIdx] ? parts[projNameIdx].trim() : '';
    if (!mainProject) {
      mainProject = currentSection.replace(/^,\s*/, '').trim() || 'General';
    }

    // Sub Project: Exclusively from 'SUB PROJECT' or 'SUB PROJECTS' header
    let subProjIdx = headers.indexOf('SUB PROJECT');
    if (subProjIdx === -1) subProjIdx = headers.indexOf('SUB PROJECTS');
    let subProject = subProjIdx !== -1 && parts[subProjIdx] ? parts[subProjIdx].trim() : '';
    if (!subProject) {
      subProject = 'MAIN';
    }

    // Normalize Status & Project names
    rowObj['STATUS'] = 'ACTIVE';
    rowObj['PROJECT NAME'] = mainProject;
    rowObj['PROJECT'] = mainProject;
    rowObj['SUB PROJECT'] = subProject;
    rowObj['SUB PROJECTS'] = subProject;

    const erpId = rowObj['ERP ID'] || ('EMP-' + (teamARecords.length + 1));
    const compositeId = 'Projects - A__' + erpId.replace(/[^a-zA-Z0-9_-]/g, '_');

    teamARecords.push({
      composite_id: compositeId,
      sheet_tab: 'Projects - A',
      project_name: mainProject,
      sub_project_name: subProject,
      data: rowObj,
      updated_at: new Date().toISOString(),
    });
  }

  console.log('Parsed active Team A records:', teamARecords.length);

  // Read existing portal-data.json
  const portalDataPath = path.resolve(process.cwd(), 'public/portal-data.json');
  const portalDataRaw = JSON.parse(fs.readFileSync(portalDataPath, 'utf8'));

  // Retain all Keemart and Ninja records, replacing Projects - A
  const otherRecords = portalDataRaw.records.filter((r: any) => r.sheet_tab !== 'Projects - A');
  const mergedRecords = [...otherRecords, ...teamARecords];

  console.log('Total merged portfolio records:', mergedRecords.length);

  portalDataRaw.records = mergedRecords;
  portalDataRaw.lastSyncedAt = new Date().toISOString();
  portalDataRaw.lastSyncCount = mergedRecords.length;

  // Save to public and docs
  fs.writeFileSync(portalDataPath, JSON.stringify(portalDataRaw, null, 2));
  const docsPath = path.resolve(process.cwd(), 'docs/portal-data.json');
  if (fs.existsSync(path.resolve(process.cwd(), 'docs'))) {
    fs.writeFileSync(docsPath, JSON.stringify(portalDataRaw, null, 2));
  }

  // Commit full database to Cloud Firestore on zawitco-legal
  console.log('Initializing Firebase connection to project:', cfg.projectId);
  const app = initializeApp(cfg);
  const db = getFirestore(app, cfg.firestoreDatabaseId);

  console.log('Committing merged dataset to Cloud Firestore...');
  const BATCH_SIZE = 350;
  for (let i = 0; i < mergedRecords.length; i += BATCH_SIZE) {
    const batch = writeBatch(db);
    const chunk = mergedRecords.slice(i, i + BATCH_SIZE);

    for (const r of chunk) {
      const safeId = r.composite_id.replace(/[^a-zA-Z0-9_-]/g, '_');
      const docRef = doc(db, 'employees', safeId);
      batch.set(
        docRef,
        {
          composite_id: r.composite_id,
          sheet_tab: r.sheet_tab,
          project_name: r.project_name,
          sub_project_name: r.sub_project_name,
          employee_name: r.data['EMPLOYEE NAME'] || 'Unnamed Employee',
          erp_id: r.data['ERP ID'] || '',
          mis: r.data['MIS'] || '',
          ninja_picker_id: r.data['NINJA PICKER ID'] || '',
          status: 'ACTIVE',
          iqama_status: r.data['IQAMA STATUS'] || '',
          data: r.data,
          updated_at: r.updated_at || new Date().toISOString(),
        },
        { merge: true }
      );
    }
    await batch.commit();
    console.log(`Committed chunk ${i + 1} - ${Math.min(i + BATCH_SIZE, mergedRecords.length)}`);
  }

  // Update portal_meta document
  const metaRef = doc(db, 'portal_meta', 'config');
  await setDoc(
    metaRef,
    {
      id: 'config',
      last_synced_at: new Date().toISOString(),
      total_records: mergedRecords.length,
      visible_columns: portalDataRaw.visibleColumns || [],
      sheet_tabs: portalDataRaw.sheetTabs || [],
      updated_at: new Date().toISOString(),
    },
    { merge: true }
  );

  console.log('Full database committed to Cloud Firestore successfully!');
}

if (process.argv[1] && process.argv[1].endsWith('seedDataset.ts')) {
  ingestAndSeedCompleteDatabase()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}
