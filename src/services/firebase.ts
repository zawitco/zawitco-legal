import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import {
  getFirestore,
  Firestore,
  collection,
  doc,
  setDoc,
  getDocFromServer,
  onSnapshot,
  writeBatch,
  query,
  limit,
} from 'firebase/firestore';
import type { RecordItemData, PortalDataResponse } from '../types';
import firebaseConfigJson from '../../firebase-applet-config.json';

let app: FirebaseApp | null = null;
let db: Firestore | null = null;
let isConnected = false;

export function getFirebaseApp(): FirebaseApp | null {
  if (app) return app;
  try {
    if (firebaseConfigJson && firebaseConfigJson.projectId && firebaseConfigJson.apiKey) {
      if (!getApps().length) {
        app = initializeApp(firebaseConfigJson);
      } else {
        app = getApp();
      }
      return app;
    }
  } catch (err) {
    console.warn('Firebase initialization skipped or failed:', err);
  }
  return null;
}

export function getFirestoreDb(): Firestore | null {
  if (db) return db;
  const currentApp = getFirebaseApp();
  if (!currentApp) return null;
  try {
    const databaseId = firebaseConfigJson.firestoreDatabaseId && firebaseConfigJson.firestoreDatabaseId !== '(default)'
      ? firebaseConfigJson.firestoreDatabaseId
      : undefined;
    
    db = databaseId ? getFirestore(currentApp, databaseId) : getFirestore(currentApp);
    return db;
  } catch (err) {
    console.warn('Firestore database initialization failed:', err);
    return null;
  }
}

/**
 * Validate connection to Firestore on app startup as mandated by Firebase directives
 */
export async function testFirestoreConnection(): Promise<boolean> {
  const firestore = getFirestoreDb();
  if (!firestore) return false;
  try {
    await getDocFromServer(doc(firestore, 'portal_meta', 'ping'));
    isConnected = true;
    return true;
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.warn('Firestore client is offline. Checking fallback.');
      isConnected = false;
      return false;
    }
    // Permission denied or not found is still a reachable connection
    isConnected = true;
    return true;
  }
}

// Initial connection test
testFirestoreConnection().catch(() => {});

export function isFirebaseReady(): boolean {
  return !!getFirestoreDb();
}

/**
 * Real-time listener for employee records from Cloud Firestore
 */
export function subscribeToFirestoreEmployees(
  onUpdate: (records: RecordItemData[]) => void,
  onError?: (err: Error) => void
): () => void {
  const firestore = getFirestoreDb();
  if (!firestore) {
    return () => {};
  }

  try {
    const colRef = collection(firestore, 'employees');
    // Subscribe to employees collection
    const unsubscribe = onSnapshot(
      colRef,
      (snapshot) => {
        if (snapshot.empty) {
          // If Firestore is still unpopulated, let caller fall back to local/cached data
          return;
        }
        const records: RecordItemData[] = [];
        snapshot.forEach((docSnap) => {
          const item = docSnap.data();
          if (item) {
            records.push({
              composite_id: item.composite_id || docSnap.id,
              sheet_tab: item.sheet_tab || 'Projects - B',
              project_name: item.project_name || 'Keemart Dark Store',
              sub_project_name: item.sub_project_name || 'DS RUH 001',
              data: item.data || {},
              updated_at: item.updated_at || new Date().toISOString(),
            });
          }
        });

        if (records.length > 0) {
          onUpdate(records);
        }
      },
      (error) => {
        console.warn('Firestore employees snapshot listener error:', error);
        if (onError) onError(error);
      }
    );

    return unsubscribe;
  } catch (err) {
    console.warn('Failed to subscribe to Firestore employees:', err);
    return () => {};
  }
}

/**
 * Real-time listener for portal metadata
 */
export function subscribeToFirestoreMeta(
  onUpdate: (meta: Partial<PortalDataResponse>) => void
): () => void {
  const firestore = getFirestoreDb();
  if (!firestore) return () => {};

  try {
    const docRef = doc(firestore, 'portal_meta', 'config');
    const unsubscribe = onSnapshot(
      docRef,
      (snapshot) => {
        if (snapshot.exists()) {
          const data = snapshot.data();
          onUpdate({
            lastSyncedAt: data.last_synced_at || null,
            visibleColumns: data.visible_columns || undefined,
            sheetTabs: data.sheet_tabs || undefined,
          });
        }
      },
      (error) => {
        console.warn('Firestore portal_meta snapshot error:', error);
      }
    );

    return unsubscribe;
  } catch (err) {
    console.warn('Failed to subscribe to Firestore meta:', err);
    return () => {};
  }
}

/**
 * Push an array of records to Firestore in batches
 */
export async function pushRecordsToFirestore(
  records: RecordItemData[],
  metadata?: { lastSyncedAt?: string; visibleColumns?: string[]; sheetTabs?: string[] }
): Promise<number> {
  const firestore = getFirestoreDb();
  if (!firestore) {
    throw new Error('Firebase Firestore is not initialized.');
  }

  // Write in batches of up to 400 documents
  const BATCH_SIZE = 400;
  let savedCount = 0;

  for (let i = 0; i < records.length; i += BATCH_SIZE) {
    const batch = writeBatch(firestore);
    const chunk = records.slice(i, i + BATCH_SIZE);

    for (const rec of chunk) {
      // Clean document ID
      const safeId = rec.composite_id.replace(/[^a-zA-Z0-9_-]/g, '_');
      const docRef = doc(firestore, 'employees', safeId);
      
      const misVal = rec.data['MIS'] || rec.data['MIS ID'] || rec.data['MIS NO'] || '';
      const pickerVal = rec.data['NINJA PICKER ID'] || rec.data['PICKER ID'] || '';

      batch.set(
        docRef,
        {
          composite_id: rec.composite_id,
          sheet_tab: rec.sheet_tab,
          project_name: rec.project_name,
          sub_project_name: rec.sub_project_name,
          employee_name: rec.data['EMPLOYEE NAME'] || 'Unnamed Employee',
          erp_id: rec.data['ERP ID'] || '',
          mis: misVal,
          ninja_picker_id: pickerVal,
          status: rec.data['STATUS'] || 'ACTIVE',
          iqama_status: rec.data['IQAMA STATUS'] || '',
          data: rec.data,
          updated_at: rec.updated_at || new Date().toISOString(),
        },
        { merge: true }
      );
      savedCount++;
    }

    await batch.commit();
  }

  // Update metadata document
  if (metadata) {
    const metaRef = doc(firestore, 'portal_meta', 'config');
    await setDoc(
      metaRef,
      {
        id: 'config',
        last_synced_at: metadata.lastSyncedAt || new Date().toISOString(),
        total_records: records.length,
        visible_columns: metadata.visibleColumns || [],
        sheet_tabs: metadata.sheetTabs || [],
        updated_at: new Date().toISOString(),
      },
      { merge: true }
    );
  }

  return savedCount;
}

/**
 * Add or update a single employee in Cloud Firestore
 */
export async function saveSingleEmployeeToFirestore(record: RecordItemData): Promise<void> {
  const firestore = getFirestoreDb();
  if (!firestore) return;

  const safeId = record.composite_id.replace(/[^a-zA-Z0-9_-]/g, '_');
  const docRef = doc(firestore, 'employees', safeId);
  const misVal = record.data['MIS'] || record.data['MIS ID'] || record.data['MIS NO'] || '';
  const pickerVal = record.data['NINJA PICKER ID'] || record.data['PICKER ID'] || '';

  await setDoc(
    docRef,
    {
      composite_id: record.composite_id,
      sheet_tab: record.sheet_tab,
      project_name: record.project_name,
      sub_project_name: record.sub_project_name,
      employee_name: record.data['EMPLOYEE NAME'] || 'Unnamed Employee',
      erp_id: record.data['ERP ID'] || '',
      mis: misVal,
      ninja_picker_id: pickerVal,
      status: record.data['STATUS'] || 'ACTIVE',
      iqama_status: record.data['IQAMA STATUS'] || '',
      data: record.data,
      updated_at: record.updated_at || new Date().toISOString(),
    },
    { merge: true }
  );
}
