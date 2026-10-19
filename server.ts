import express, { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import path from 'path';
import { fileURLToPath } from 'url';
import { getDb, queryAll, queryOne, executeRun, PortalConfig, ShareLink, RecordItem } from './src/server/db.js';
import { syncGoogleSheetsData } from './src/server/sync.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

app.use(express.json({ limit: '10mb' }));

// Middleware to verify admin PIN for protected routes
async function requireAdminPin(req: Request, res: Response, next: NextFunction) {
  const pinHeader = req.headers['x-admin-pin'];
  if (!pinHeader) {
    res.status(401).json({ error: 'Admin PIN required.' });
    return;
  }
  const config = queryOne<PortalConfig>('SELECT admin_pin FROM portal_config WHERE id = 1');
  if (!config || String(config.admin_pin) !== String(pinHeader)) {
    res.status(403).json({ error: 'Invalid Admin PIN.' });
    return;
  }
  next();
}

// 1. GET /api/portal-data
app.get('/api/portal-data', async (req: Request, res: Response) => {
  try {
    await getDb();
    const config = queryOne<PortalConfig>('SELECT * FROM portal_config WHERE id = 1');
    if (!config) {
      res.status(500).json({ error: 'Portal configuration is missing.' });
      return;
    }

    const token = req.query.token as string | undefined;
    const pinHeader = req.headers['x-admin-pin'] as string | undefined;
    const visibleCols: string[] = JSON.parse(config.visible_columns_json || '[]');
    const allCols: string[] = JSON.parse(config.all_columns_json || '[]');
    const kpiElements: string[] = JSON.parse(config.kpi_elements_json || '[]');
    const sheetTabs: string[] = JSON.parse(config.sheet_tabs_json || '[]');

    // Helper to enforce active employees only
    const isEmployeeActive = (obj: Record<string, string>) => {
      const statusKey = Object.keys(obj).find((k) => k.trim().toUpperCase() === 'STATUS');
      if (!statusKey) return true; // Tab A active workforce
      const val = (obj[statusKey] || '').trim().toUpperCase();
      return val === 'ACTIVE';
    };

    // Ensure STATUS is included in visibleCols if present
    if (!visibleCols.includes('STATUS')) {
      visibleCols.unshift('STATUS');
    }

    // CASE 1: Client Share Link Mode
    if (token) {
      const link = queryOne<ShareLink>('SELECT * FROM client_share_links WHERE token = ?', [token]);
      if (!link) {
        res.status(403).json({ error: 'Invalid or expired client portal link.' });
        return;
      }

      let query = 'SELECT * FROM records WHERE project_name = ?';
      const params: any[] = [link.project_name];

      if (link.sheet_tab && link.sheet_tab !== 'ALL') {
        query += ' AND sheet_tab = ?';
        params.push(link.sheet_tab);
      }

      if (link.sub_project_name && link.sub_project_name !== 'ALL') {
        query += ' AND sub_project_name = ?';
        params.push(link.sub_project_name);
      }

      const rows = queryAll<RecordItem>(query, params);

      // Sanitize columns: keep only visibleCols + project/sub_project/kpi columns
      const allowedCols = new Set([
        ...visibleCols,
        'STATUS',
        'PROJECT NAME',
        'PROJECT',
        'SUB PROJECT',
        'SUB PROJECTS',
        config.project_column,
        config.sub_project_column,
        ...kpiElements,
      ]);

      const sanitizedRecords = rows
        .map((r) => {
          let rowObj: Record<string, string> = {};
          try {
            rowObj = JSON.parse(r.data_json);
          } catch {
            rowObj = {};
          }

          // Strict filter: only show Employees whose STATUS field is active
          if (!isEmployeeActive(rowObj)) {
            return null;
          }

          const filteredObj: Record<string, string> = {};
          for (const key of Object.keys(rowObj)) {
            if (allowedCols.has(key)) {
              filteredObj[key] = rowObj[key];
            }
          }
          if (!filteredObj['STATUS']) {
            filteredObj['STATUS'] = 'ACTIVE';
          }
          filteredObj['PROJECT NAME'] = r.project_name;
          filteredObj['PROJECT'] = r.project_name;
          filteredObj['SUB PROJECT'] = r.sub_project_name;
          filteredObj['SUB PROJECTS'] = r.sub_project_name;

          return {
            composite_id: r.composite_id,
            sheet_tab: r.sheet_tab,
            project_name: r.project_name,
            sub_project_name: r.sub_project_name,
            data: filteredObj,
            updated_at: r.updated_at,
          };
        })
        .filter((r): r is NonNullable<typeof r> => r !== null);

      res.json({
        mode: 'client_link',
        linkMeta: {
          client_label: link.client_label,
          project_name: link.project_name,
          sub_project_name: link.sub_project_name,
          sheet_tab: link.sheet_tab,
        },
        records: sanitizedRecords,
        visibleColumns: visibleCols,
        kpiElements,
        projectColumn: config.project_column,
        subProjectColumn: config.sub_project_column,
        lastSyncedAt: config.last_synced_at,
      });
      return;
    }

    // CASE 2: Admin Mode
    const isAdmin = pinHeader && String(pinHeader) === String(config.admin_pin);
    if (isAdmin) {
      const rows = queryAll<RecordItem>('SELECT * FROM records ORDER BY sheet_tab, composite_id');
      const records = rows
        .map((r) => {
          let rowObj: Record<string, string> = {};
          try {
            rowObj = JSON.parse(r.data_json);
          } catch {
            rowObj = {};
          }

          // Strict filter: only show Employees whose STATUS field is active
          if (!isEmployeeActive(rowObj)) {
            return null;
          }

          if (!rowObj['STATUS']) {
            rowObj['STATUS'] = 'ACTIVE';
          }
          rowObj['PROJECT NAME'] = r.project_name;
          rowObj['PROJECT'] = r.project_name;
          rowObj['SUB PROJECT'] = r.sub_project_name;
          rowObj['SUB PROJECTS'] = r.sub_project_name;

          return {
            composite_id: r.composite_id,
            sheet_tab: r.sheet_tab,
            project_name: r.project_name,
            sub_project_name: r.sub_project_name,
            data: rowObj,
            updated_at: r.updated_at,
          };
        })
        .filter((r): r is NonNullable<typeof r> => r !== null);

      res.json({
        mode: 'admin',
        records,
        visibleColumns: visibleCols,
        allColumns: allCols,
        kpiElements,
        projectColumn: config.project_column,
        subProjectColumn: config.sub_project_column,
        lastSyncedAt: config.last_synced_at,
        lastSyncCount: config.last_sync_count,
        sheetTabs,
        lockMainPortal: Boolean(config.lock_main_portal),
      });
      return;
    }

    // CASE 3: Root URL without token or admin pin
    if (config.lock_main_portal === 1) {
      res.status(401).json({
        requiresPin: true,
        message: 'Master Portal is locked. Enter Admin PIN to access.',
      });
      return;
    }

    // Public / Unlocked root view
    const rows = queryAll<RecordItem>('SELECT * FROM records ORDER BY sheet_tab, composite_id');
    const allowedCols = new Set([
      ...visibleCols,
      'STATUS',
      'PROJECT NAME',
      'PROJECT',
      'SUB PROJECT',
      'SUB PROJECTS',
      config.project_column,
      config.sub_project_column,
      ...kpiElements,
    ]);

    const sanitizedRecords = rows
      .map((r) => {
        let rowObj: Record<string, string> = {};
        try {
          rowObj = JSON.parse(r.data_json);
        } catch {
          rowObj = {};
        }

        // Strict filter: only show Employees whose STATUS field is active
        if (!isEmployeeActive(rowObj)) {
          return null;
        }

        const filteredObj: Record<string, string> = {};
        for (const key of Object.keys(rowObj)) {
          if (allowedCols.has(key)) {
            filteredObj[key] = rowObj[key];
          }
        }
        if (!filteredObj['STATUS']) {
          filteredObj['STATUS'] = 'ACTIVE';
        }
        filteredObj['PROJECT NAME'] = r.project_name;
        filteredObj['PROJECT'] = r.project_name;
        filteredObj['SUB PROJECT'] = r.sub_project_name;
        filteredObj['SUB PROJECTS'] = r.sub_project_name;

        return {
          composite_id: r.composite_id,
          sheet_tab: r.sheet_tab,
          project_name: r.project_name,
          sub_project_name: r.sub_project_name,
          data: filteredObj,
          updated_at: r.updated_at,
        };
      })
      .filter((r): r is NonNullable<typeof r> => r !== null);

    res.json({
      mode: 'public',
      records: sanitizedRecords,
      visibleColumns: visibleCols,
      kpiElements,
      projectColumn: config.project_column,
      subProjectColumn: config.sub_project_column,
      lastSyncedAt: config.last_synced_at,
      sheetTabs,
      lockMainPortal: false,
    });
  } catch (err: any) {
    console.error('Error fetching portal data:', err);
    res.status(500).json({ error: err.message || 'Internal server error' });
  }
});

// 2. Admin Verification
app.post('/api/admin/verify', async (req: Request, res: Response) => {
  try {
    await getDb();
    const { pin } = req.body;
    const config = queryOne<PortalConfig>('SELECT admin_pin FROM portal_config WHERE id = 1');
    if (config && String(config.admin_pin) === String(pin)) {
      res.json({ success: true });
    } else {
      res.status(401).json({ success: false, error: 'Invalid Admin PIN.' });
    }
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 3. POST /api/sync
app.post('/api/sync', requireAdminPin, async (req: Request, res: Response) => {
  try {
    const result = await syncGoogleSheetsData();
    res.json(result);
  } catch (err: any) {
    console.error('Sync failed:', err);
    res.status(500).json({ success: false, error: err.message || 'Sync failed.' });
  }
});

// 4. GET /api/admin/config
app.get('/api/admin/config', requireAdminPin, async (req: Request, res: Response) => {
  try {
    await getDb();
    const config = queryOne<PortalConfig>('SELECT * FROM portal_config WHERE id = 1');
    if (!config) {
      res.status(404).json({ error: 'Config not found' });
      return;
    }
    res.json({
      spreadsheet_id: config.spreadsheet_id,
      sheet_tabs: JSON.parse(config.sheet_tabs_json || '[]'),
      admin_pin: config.admin_pin,
      lock_main_portal: Boolean(config.lock_main_portal),
      all_columns: JSON.parse(config.all_columns_json || '[]'),
      visible_columns: JSON.parse(config.visible_columns_json || '[]'),
      kpi_elements: JSON.parse(config.kpi_elements_json || '[]'),
      project_column: config.project_column,
      sub_project_column: config.sub_project_column,
      last_synced_at: config.last_synced_at,
      last_sync_count: config.last_sync_count,
      service_account_json: config.service_account_json,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 5. POST /api/admin/config
app.post('/api/admin/config', requireAdminPin, async (req: Request, res: Response) => {
  try {
    await getDb();
    const {
      spreadsheet_id,
      sheet_tabs,
      admin_pin,
      lock_main_portal,
      visible_columns,
      kpi_elements,
      project_column,
      sub_project_column,
      service_account_json,
    } = req.body;

    const current = queryOne<PortalConfig>('SELECT * FROM portal_config WHERE id = 1');
    if (!current) {
      res.status(404).json({ error: 'Config not found' });
      return;
    }

    const updatedSpreadsheetId = spreadsheet_id !== undefined ? spreadsheet_id : current.spreadsheet_id;
    const updatedTabs = sheet_tabs !== undefined ? JSON.stringify(sheet_tabs) : current.sheet_tabs_json;
    const updatedPin = admin_pin !== undefined && admin_pin.trim() !== '' ? admin_pin.trim() : current.admin_pin;
    const updatedLock = lock_main_portal !== undefined ? (lock_main_portal ? 1 : 0) : current.lock_main_portal;
    const updatedVisible = visible_columns !== undefined ? JSON.stringify(visible_columns) : current.visible_columns_json;
    const updatedKpis = kpi_elements !== undefined ? JSON.stringify(kpi_elements) : current.kpi_elements_json;
    const updatedProjectCol = project_column !== undefined ? project_column : current.project_column;
    const updatedSubProjectCol = sub_project_column !== undefined ? sub_project_column : current.sub_project_column;
    const updatedSa = service_account_json !== undefined && service_account_json.trim() !== '' ? service_account_json : current.service_account_json;

    executeRun(`
      UPDATE portal_config
      SET spreadsheet_id = ?,
          sheet_tabs_json = ?,
          admin_pin = ?,
          lock_main_portal = ?,
          visible_columns_json = ?,
          kpi_elements_json = ?,
          project_column = ?,
          sub_project_column = ?,
          service_account_json = ?
      WHERE id = 1
    `, [
      updatedSpreadsheetId,
      updatedTabs,
      updatedPin,
      updatedLock,
      updatedVisible,
      updatedKpis,
      updatedProjectCol,
      updatedSubProjectCol,
      updatedSa,
    ]);

    res.json({ success: true, message: 'Configuration saved successfully.' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 6. GET /api/admin/share-links
app.get('/api/admin/share-links', requireAdminPin, async (req: Request, res: Response) => {
  try {
    await getDb();
    const links = queryAll<ShareLink>('SELECT * FROM client_share_links ORDER BY created_at DESC');
    res.json(links);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 7. POST /api/admin/share-links
app.post('/api/admin/share-links', requireAdminPin, async (req: Request, res: Response) => {
  try {
    await getDb();
    const { client_label, sheet_tab, project_name, sub_project_name } = req.body;
    if (!project_name) {
      res.status(400).json({ error: 'project_name is required.' });
      return;
    }

    const token = crypto.randomBytes(12).toString('hex');
    const label = client_label && client_label.trim() ? client_label.trim() : `Client Portal - ${project_name}`;
    const tab = sheet_tab || 'ALL';
    const subProject = sub_project_name || 'ALL';
    const createdAt = new Date().toISOString();

    executeRun(`
      INSERT INTO client_share_links (token, client_label, sheet_tab, project_name, sub_project_name, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `, [token, label, tab, project_name, subProject, createdAt]);

    res.json({
      token,
      client_label: label,
      sheet_tab: tab,
      project_name,
      sub_project_name: subProject,
      created_at: createdAt,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 8. DELETE /api/admin/share-links/:token
app.delete('/api/admin/share-links/:token', requireAdminPin, async (req: Request, res: Response) => {
  try {
    await getDb();
    const { token } = req.params;
    executeRun('DELETE FROM client_share_links WHERE token = ?', [token]);
    res.json({ success: true, token });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Express & Vite integration
async function startServer() {
  await getDb();

  // Check if records is empty; if so, trigger initial sync in background
  try {
    const countRow = queryOne<{ count: number }>('SELECT COUNT(*) as count FROM records');
    if (!countRow || countRow.count === 0) {
      console.log('Initiating initial Google Sheets data sync on boot...');
      syncGoogleSheetsData()
        .then((res) => console.log(`Initial sync completed: ${res.count} records loaded.`))
        .catch((err) => console.error('Initial sync error on startup:', err.message));
    } else {
      console.log(`Database ready with ${countRow.count} existing records.`);
    }
  } catch (e: any) {
    console.error('Error checking initial records:', e.message);
  }

  if (process.env.NODE_ENV === 'production') {
    app.use(express.static(path.join(__dirname, 'dist')));
    app.get('*', (req, res) => {
      res.sendFile(path.join(__dirname, 'dist', 'index.html'));
    });
  } else {
    const { createServer } = await import('vite');
    const vite = await createServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running at http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
