import { syncGoogleSheetsData } from '../src/server/sync.js';
import { getDb } from '../src/server/db.js';

async function main() {
  console.log('🔄 Initiating Google Sheets synchronization...');
  await getDb();
  const res = await syncGoogleSheetsData();
  console.log(`✅ Google Sheets sync completed successfully!`);
  console.log(`📊 Records processed: ${res.count}`);
  console.log(`🕒 Timestamp: ${res.timestamp}`);
  console.log(`📁 Updated: public/portal-data.json and docs/portal-data.json`);
}

main().catch((err) => {
  console.error('❌ Sync failed:', err);
  process.exit(1);
});
