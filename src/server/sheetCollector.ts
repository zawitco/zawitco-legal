import { syncGoogleSheetsData } from './sync.js';

let collectorInterval: NodeJS.Timeout | null = null;
let isCollecting = false;

/**
 * Perform a single automated pull from Google Sheet and push updates to Firestore
 */
export async function runCollectorPull(): Promise<{ success: boolean; count?: number; error?: string }> {
  if (isCollecting) {
    console.log('[SheetCollector] A pull is already in progress. Skipping duplicate run.');
    return { success: false, error: 'A sync run is already in progress.' };
  }

  isCollecting = true;
  try {
    console.log('[SheetCollector] Starting automated Google Sheet pull...');
    const result = await syncGoogleSheetsData();
    console.log(`[SheetCollector] Pull completed successfully! Collected & synced ${result.count} records directly to Cloud Firestore.`);
    return { success: true, count: result.count };
  } catch (err: any) {
    // If Service Account is unconfigured or transient network glitch, log without crashing
    console.warn('[SheetCollector] Automated pull notice:', err.message || err);
    return { success: false, error: err.message || 'Pull failed' };
  } finally {
    isCollecting = false;
  }
}

/**
 * Start the autonomous scheduled pull worker
 * Default cadence: Every 15 minutes (900,000 ms)
 */
export function startSheetCollector(intervalMs: number = 15 * 60 * 1000) {
  if (collectorInterval) {
    clearInterval(collectorInterval);
  }

  console.log(`[SheetCollector] Autonomous pull worker registered (Interval: ${Math.round(intervalMs / 60000)} minutes).`);

  // Initial pull 8 seconds after server boots up
  setTimeout(() => {
    runCollectorPull().catch(() => {});
  }, 8000);

  // Recurring cadence
  collectorInterval = setInterval(() => {
    runCollectorPull().catch(() => {});
  }, intervalMs);
}

/**
 * Stop the background pull worker
 */
export function stopSheetCollector() {
  if (collectorInterval) {
    clearInterval(collectorInterval);
    collectorInterval = null;
    console.log('[SheetCollector] Background worker stopped.');
  }
}
