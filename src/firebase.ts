import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, onAuthStateChanged, User as FirebaseUser } from 'firebase/auth';
import { getFirestore, doc, getDocFromServer, Timestamp } from 'firebase/firestore';

const env = typeof import.meta !== 'undefined' ? (import.meta as any).env || {} : {};

// Load firebase-applet-config.json when present (AI Studio environment),
// while allowing clean builds in GitHub Actions when firebase-applet-config.json is gitignored.
const localConfigModules =
  typeof import.meta !== 'undefined' && typeof (import.meta as any).glob === 'function'
    ? (import.meta as any).glob('../firebase-applet-config.json', { eager: true })
    : {};
const rawLocalConfig: Record<string, any> =
  (Object.values(localConfigModules)[0] as any)?.default ||
  (Object.values(localConfigModules)[0] as any) ||
  {};

const PROVISIONED_PROJECT_ID = 'quaint-rite-rn50x';
const PROVISIONED_DATABASE_ID = 'ai-studio-pennywisestudent-cccf9e65-15d8-4920-9bb8-91308706b858';

const activeProjectId = (
  env.VITE_FIREBASE_PROJECT_ID ||
  rawLocalConfig.projectId ||
  PROVISIONED_PROJECT_ID
).trim();

const rawEnvDatabaseId = (env.VITE_FIREBASE_FIRESTORE_DATABASE_ID || '').trim();

/**
 * Determine the Firestore Database ID:
 * 1. If VITE_FIREBASE_FIRESTORE_DATABASE_ID is explicitly set to a custom named database (not "(default)"), use it.
 * 2. If connected to the AI Studio provisioned project (`quaint-rite-rn50x`), use its provisioned named database ID.
 * 3. Otherwise (for any standard Firebase project using the default Firestore database), omit the database ID
 *    and call `getFirestore(app)` directly so VITE_FIREBASE_FIRESTORE_DATABASE_ID is not required.
 */
export const resolvedDatabaseId: string | undefined =
  rawEnvDatabaseId && rawEnvDatabaseId !== '(default)'
    ? rawEnvDatabaseId
    : activeProjectId === PROVISIONED_PROJECT_ID
    ? rawLocalConfig.firestoreDatabaseId || PROVISIONED_DATABASE_ID
    : undefined;

export const firebaseConfig = {
  apiKey: (env.VITE_FIREBASE_API_KEY || rawLocalConfig.apiKey || 'AIzaSyDummyKeyForCIBuildOnly00000000000').trim(),
  authDomain: (env.VITE_FIREBASE_AUTH_DOMAIN || rawLocalConfig.authDomain || `${activeProjectId}.firebaseapp.com`).trim(),
  projectId: activeProjectId,
  storageBucket: (env.VITE_FIREBASE_STORAGE_BUCKET || rawLocalConfig.storageBucket || `${activeProjectId}.firebasestorage.app`).trim(),
  messagingSenderId: (env.VITE_FIREBASE_MESSAGING_SENDER_ID || rawLocalConfig.messagingSenderId || '000000000000').trim(),
  appId: (env.VITE_FIREBASE_APP_ID || rawLocalConfig.appId || '1:000000000000:web:0000000000000000000000').trim(),
  firestoreDatabaseId: resolvedDatabaseId || '(default)',
};

export const OWNER_ADMIN_EMAIL = (
  env.VITE_OWNER_ADMIN_EMAIL || 'costcurveexpensetracker@gmail.com'
).toLowerCase();

export const BOOTSTRAPPED_ADMIN_EMAILS = new Set([
  OWNER_ADMIN_EMAIL,
  'costcurveexpensetracker@gmail.com',
  'mohamedarman536@gmail.com',
]);

const app = initializeApp(firebaseConfig);
export const db = resolvedDatabaseId
  ? getFirestore(app, resolvedDatabaseId)
  : getFirestore(app);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });

/**
 * Awaits Firebase Auth state resolution and ensures the current user's ID token
 * is ready before any Firestore document request is issued.
 */
export async function waitForAuthUser(): Promise<FirebaseUser | null> {
  if (typeof (auth as any).authStateReady === 'function') {
    await (auth as any).authStateReady();
  } else {
    await new Promise<void>((resolve) => {
      const unsub = onAuthStateChanged(auth, () => {
        unsub();
        resolve();
      });
    });
  }
  const current = auth.currentUser;
  if (current) {
    try {
      await current.getIdToken();
    } catch {
      // Ignore token pre-fetch errors
    }
  }
  return auth.currentUser;
}

// Validate connection to Firestore on boot
async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error('Please check your Firebase configuration.');
    }
  }
}
if (typeof window !== 'undefined') {
  testConnection();
}

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: boolean | string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function formatFriendlyFirestoreError(error: unknown, fallbackMessage = 'Database operation failed.'): string {
  const rawMessage = error instanceof Error ? error.message : String(error);
  if (rawMessage.includes('Missing or insufficient permissions') || rawMessage.includes('permission-denied')) {
    return 'Unable to access your cloud profile right now due to database permission settings. Please try signing in again.';
  }
  if (rawMessage.includes('the client is offline') || rawMessage.includes('unavailable')) {
    return 'Network connection to Cloud Firestore is currently unavailable. Please check your internet connection.';
  }
  try {
    const parsed = JSON.parse(rawMessage);
    if (parsed && typeof parsed.error === 'string') {
      if (parsed.error.includes('Missing or insufficient permissions')) {
        return 'Unable to access this record due to database permission rules.';
      }
      return parsed.error;
    }
  } catch {
    // Not a JSON error string
  }
  return rawMessage || fallbackMessage;
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo:
        auth.currentUser?.providerData?.map((provider) => ({
          providerId: provider.providerId,
          email: provider.email,
        })) || [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(formatFriendlyFirestoreError(error));
}

export function formatTimestamp(val: unknown): string {
  if (!val) return new Date().toISOString();
  if (val instanceof Timestamp) {
    return val.toDate().toISOString();
  }
  if (typeof val === 'object' && val !== null && 'toDate' in val && typeof (val as any).toDate === 'function') {
    return (val as any).toDate().toISOString();
  }
  if (typeof val === 'string') {
    return val;
  }
  return new Date().toISOString();
}

export const ID_REGEX = /^[a-zA-Z0-9_\-]+$/;

export function sanitizeId(id: string): string {
  const cleaned = id.replace(/[^a-zA-Z0-9_\-]/g, '_').slice(0, 128);
  return cleaned || `id_${Date.now()}`;
}

export function sanitizeString(val: unknown, maxLen: number, fallback = ''): string {
  const str = typeof val === 'string' ? val.trim() : fallback;
  return str.slice(0, maxLen);
}
