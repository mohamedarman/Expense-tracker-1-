import {
  signInWithPopup,
  signInWithRedirect,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  updatePassword,
  updateProfile as updateFirebaseAuthProfile,
  EmailAuthProvider,
  reauthenticateWithCredential,
  sendEmailVerification,
  User as FirebaseUser,
} from 'firebase/auth';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  writeBatch,
  serverTimestamp,
} from 'firebase/firestore';
import {
  auth,
  db,
  googleProvider,
  BOOTSTRAPPED_ADMIN_EMAILS,
  OperationType,
  handleFirestoreError,
  formatTimestamp,
  sanitizeId,
  sanitizeString,
  waitForAuthUser,
} from './firebase.ts';
import {
  User,
  AdminRecord,
  Transaction,
  Category,
  Budget,
  BudgetResponse,
  SavingsGoal,
  RecurringPayment,
  SplitExpense,
  DebtRecord,
  AnalyticsResponse,
  FinancialInsight,
  TransactionKind,
  PaymentMethod,
  AccountWallet,
  RecurringFrequency,
} from './types.ts';
import {
  DEFAULT_SYSTEM_CATEGORIES,
  roundMoney,
  computeBudgetsResponse,
  computeAnalyticsResponse,
  computeInsightsResponse,
  evaluateBudgetAdvisorQuestion,
} from './financialEngine.ts';
import { clientStore } from './clientStore.ts';

// Single-flight deduplication and profile cache per UID to prevent concurrent
// getDoc/setDoc race conditions on users/{uid} right after Google Sign-In.
const inflightProfilePromises = new Map<string, Promise<User>>();
const cachedUserProfiles = new Map<string, User>();

export function clearProfileCache() {
  inflightProfilePromises.clear();
  cachedUserProfiles.clear();
}

// Clean up only legacy pre-v4 demo storage keys while preserving active clientStore v4 accounts
export function clearLegacyLocalStorage() {
  if (typeof localStorage === 'undefined') return;
  const legacyKeys = [
    'pennywise_student_auth_token',
    'pennywise_client_database',
    'pennywise_client_database_v1',
    'pennywise_client_database_v2',
    'pennywise_client_database_v3',
    'pennywise_transactions',
    'pennywise_demo_data',
  ];
  for (const key of legacyKeys) {
    try {
      localStorage.removeItem(key);
    } catch {}
  }
}

export function getStoredToken(): string | null {
  if (auth.currentUser) return 'firebase_authenticated';
  if (clientStore.getCurrentUser()) return 'client_authenticated';
  return null;
}

export function clearStoredToken() {
  clearLegacyLocalStorage();
  clearProfileCache();
  clientStore.setCurrentUserId(null);
}

async function resolveAuthMode(): Promise<
  | { mode: 'firebase'; fbUser: FirebaseUser }
  | { mode: 'local'; localUser: User }
> {
  if (auth.currentUser) {
    return { mode: 'firebase', fbUser: auth.currentUser };
  }
  const localCurrent = clientStore.getCurrentUser();
  if (localCurrent) {
    return { mode: 'local', localUser: localCurrent };
  }
  const resolvedFb = await waitForAuthUser();
  if (resolvedFb) {
    return { mode: 'firebase', fbUser: resolvedFb };
  }
  const localAfterWait = clientStore.getCurrentUser();
  if (localAfterWait) {
    return { mode: 'local', localUser: localAfterWait };
  }
  throw new Error('Authentication required. Please sign in to continue.');
}

const ALLOWED_PAYMENT_METHODS: PaymentMethod[] = [
  'UPI',
  'Cash',
  'Card',
  'Net Banking',
  'Digital Wallet',
  'Other',
];

const ALLOWED_WALLETS: AccountWallet[] = [
  'Primary Bank',
  'Pocket Cash',
  'College ID / Campus Card',
  'Savings',
  'Digital Wallet',
];

const ALLOWED_FREQUENCIES: RecurringFrequency[] = [
  'daily',
  'weekly',
  'monthly',
  'semester',
  'yearly',
];

function buildFallbackUserFromAuth(
  fbUser: FirebaseUser,
  isAdmin: boolean,
  isOwner: boolean,
  defaults?: {
    name?: string;
    collegeName?: string;
    degreeSemester?: string;
    monthlyBudget?: number;
    currency?: string;
  }
): User {
  const parsedBudget =
    defaults?.monthlyBudget !== undefined
      ? Math.min(100000000, Math.max(0, roundMoney(Number(defaults.monthlyBudget))))
      : 15000;

  return {
    id: fbUser.uid,
    name: sanitizeString(
      defaults?.name || fbUser.displayName || fbUser.email?.split('@')[0] || 'Student User',
      100,
      'Student User'
    ),
    email: sanitizeString((fbUser.email || '').toLowerCase(), 254, 'student@college.edu'),
    currency: sanitizeString(defaults?.currency || '₹', 10, '₹'),
    theme: 'dark',
    monthlyBudget: parsedBudget,
    semesterBudget: Math.min(500000000, roundMoney(parsedBudget * 4)),
    semesterEndDate: `${new Date().getFullYear()}-12-31`,
    collegeName: sanitizeString(defaults?.collegeName || 'College / University', 120, 'College / University'),
    degreeSemester: sanitizeString(defaults?.degreeSemester || 'Semester 1', 120, 'Semester 1'),
    status: 'active',
    role: isOwner ? 'owner' : isAdmin ? 'admin' : 'user',
    isAdmin: isOwner || isAdmin,
    emailVerified: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

function mapDocToUser(
  uid: string,
  data: Record<string, any>,
  isAdmin: boolean,
  isOwner: boolean
): User {
  return {
    id: uid,
    name: data.name || 'Student User',
    email: data.email || '',
    currency: data.currency || '₹',
    theme: data.theme === 'light' ? 'light' : 'dark',
    monthlyBudget: typeof data.monthlyBudget === 'number' ? data.monthlyBudget : 15000,
    semesterBudget: typeof data.semesterBudget === 'number' ? data.semesterBudget : 60000,
    semesterEndDate: data.semesterEndDate || `${new Date().getFullYear()}-12-31`,
    collegeName: data.collegeName || 'College / University',
    degreeSemester: data.degreeSemester || 'Semester 1',
    status: data.status === 'suspended' ? 'suspended' : 'active',
    role: isOwner ? 'owner' : isAdmin ? 'admin' : 'user',
    isAdmin: isOwner || isAdmin,
    emailVerified: true,
    createdAt: formatTimestamp(data.createdAt),
    updatedAt: formatTimestamp(data.updatedAt),
  };
}

async function checkAdminStatus(fbUser: FirebaseUser): Promise<{ isAdmin: boolean; isOwner: boolean }> {
  const email = (fbUser.email || '').toLowerCase();
  const isOwner = BOOTSTRAPPED_ADMIN_EMAILS.has(email);
  if (isOwner) {
    return { isAdmin: true, isOwner: true };
  }
  try {
    const adminSnap = await getDoc(doc(db, 'admins', fbUser.uid));
    if (adminSnap.exists()) {
      const role = adminSnap.data()?.role;
      return { isAdmin: true, isOwner: role === 'owner' };
    }
  } catch {
    // Non-admin or offline
  }
  return { isAdmin: false, isOwner: false };
}

/**
 * Safely resolves or initializes `users/{auth.currentUser.uid}` after auth state is ready.
 * Uses single-flight deduplication per UID so concurrent callers (e.g. signInWithPopup
 * and onAuthStateChanged) never race on getDoc/setDoc.
 */
export async function ensureUserProfileInFirestore(
  fbUser: FirebaseUser,
  defaults?: {
    name?: string;
    collegeName?: string;
    degreeSemester?: string;
    monthlyBudget?: number;
    currency?: string;
  }
): Promise<User> {
  if (!defaults && cachedUserProfiles.has(fbUser.uid)) {
    return cachedUserProfiles.get(fbUser.uid)!;
  }

  const existingPromise = inflightProfilePromises.get(fbUser.uid);
  if (existingPromise) {
    return existingPromise;
  }

  const promise = (async (): Promise<User> => {
    // 1. Ensure Firebase Auth token is attached before hitting Firestore
    try {
      await fbUser.getIdToken();
    } catch {
      // Continue if token already cached
    }

    const { isAdmin, isOwner } = await checkAdminStatus(fbUser);
    const uid = sanitizeId(fbUser.uid);
    const userRef = doc(db, 'users', uid);

    // 2. Read users/{uid}, retrying once with a forced token refresh if needed
    let snap = null;
    try {
      snap = await getDoc(userRef);
    } catch (firstErr) {
      try {
        await fbUser.getIdToken(true);
        snap = await getDoc(userRef);
      } catch (retryErr) {
        console.warn('Could not read user document from Firestore, using authenticated session fallback:', retryErr);
        const fallback = buildFallbackUserFromAuth(fbUser, isAdmin, isOwner, defaults);
        cachedUserProfiles.set(fbUser.uid, fallback);
        return fallback;
      }
    }

    if (snap && snap.exists()) {
      const existingUser = mapDocToUser(uid, snap.data(), isAdmin, isOwner);
      cachedUserProfiles.set(fbUser.uid, existingUser);
      return existingUser;
    }

    // 3. First-time sign-in: users/{uid} does not exist yet -> create it safely
    const nowYear = new Date().getFullYear();
    const parsedBudget =
      defaults?.monthlyBudget !== undefined
        ? Math.min(100000000, Math.max(0, roundMoney(Number(defaults.monthlyBudget))))
        : 15000;

    const newProfilePayload = {
      id: uid,
      name: sanitizeString(
        defaults?.name || fbUser.displayName || fbUser.email?.split('@')[0] || 'Student User',
        100,
        'Student User'
      ),
      email: sanitizeString((fbUser.email || '').toLowerCase(), 254, 'student@college.edu'),
      currency: sanitizeString(defaults?.currency || '₹', 10, '₹'),
      theme: 'dark' as const,
      monthlyBudget: parsedBudget,
      semesterBudget: Math.min(500000000, roundMoney(parsedBudget * 4)),
      semesterEndDate: `${nowYear}-12-31`,
      collegeName: sanitizeString(defaults?.collegeName || 'College / University', 120, 'College / University'),
      degreeSemester: sanitizeString(defaults?.degreeSemester || 'Semester 1', 120, 'Semester 1'),
      status: 'active' as const,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };

    try {
      await setDoc(userRef, newProfilePayload);
    } catch (createErr) {
      console.warn('Could not create initial user profile document in Firestore:', createErr);
    }

    // 4. If verified bootstrapped owner, ensure their /admins/{uid} entry exists
    if (isOwner && fbUser.emailVerified) {
      try {
        const adminRef = doc(db, 'admins', uid);
        const adminSnap = await getDoc(adminRef);
        if (!adminSnap.exists()) {
          await setDoc(adminRef, {
            uid,
            email: newProfilePayload.email,
            grantedBy: uid,
            role: 'owner',
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
        }
      } catch {
        // Non-fatal
      }
    }

    const createdUser = mapDocToUser(
      uid,
      {
        ...newProfilePayload,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      isAdmin,
      isOwner
    );
    cachedUserProfiles.set(fbUser.uid, createdUser);
    return createdUser;
  })();

  inflightProfilePromises.set(fbUser.uid, promise);
  try {
    return await promise;
  } finally {
    inflightProfilePromises.delete(fbUser.uid);
  }
}

async function fetchUserTransactionsRaw(uid: string): Promise<Transaction[]> {
  const path = 'transactions';
  try {
    const q = query(collection(db, path), where('userId', '==', uid));
    const snap = await getDocs(q);
    const items: Transaction[] = snap.docs.map((d) => {
      const data = d.data();
      return {
        id: d.id,
        userId: data.userId,
        amount: Number(data.amount) || 0,
        kind: data.kind === 'income' ? 'income' : 'expense',
        categoryId: data.categoryId || 'cat-other-exp',
        categoryName: data.categoryName || 'General Expense',
        description: data.description || 'Expense',
        merchant: data.merchant || '',
        date: data.date || new Date().toISOString().split('T')[0],
        paymentMethod: data.paymentMethod || 'UPI',
        account: data.account || 'Primary Bank',
        notes: data.notes || '',
        recurringId: data.recurringId,
        createdAt: formatTimestamp(data.createdAt),
        updatedAt: formatTimestamp(data.updatedAt),
      };
    });
    items.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    return items;
  } catch (error) {
    console.warn('Error fetching transactions from Firestore:', error);
    return [];
  }
}

async function fetchUserCategoriesRaw(uid: string): Promise<Category[]> {
  const path = 'categories';
  try {
    const q = query(collection(db, path), where('userId', '==', uid));
    const snap = await getDocs(q);
    const custom: Category[] = snap.docs.map((d) => {
      const data = d.data();
      return {
        id: d.id,
        userId: data.userId,
        name: data.name,
        kind: data.kind === 'income' ? 'income' : 'expense',
        color: data.color || '#2dd4bf',
        icon: data.icon || 'Tag',
        isEssential: !!data.isEssential,
        createdAt: formatTimestamp(data.createdAt),
        updatedAt: formatTimestamp(data.updatedAt),
      };
    });
    return [...DEFAULT_SYSTEM_CATEGORIES, ...custom];
  } catch (error) {
    console.warn('Error fetching custom categories from Firestore:', error);
    return [...DEFAULT_SYSTEM_CATEGORIES];
  }
}

async function fetchUserBudgetsRaw(uid: string): Promise<Budget[]> {
  const path = 'budgets';
  try {
    const q = query(collection(db, path), where('userId', '==', uid));
    const snap = await getDocs(q);
    return snap.docs.map((d) => {
      const data = d.data();
      return {
        id: d.id,
        userId: data.userId,
        categoryId: data.categoryId,
        period: data.period || 'monthly',
        month: data.month,
        amount: Number(data.amount) || 0,
        warningThreshold: Number(data.warningThreshold) || 80,
        createdAt: formatTimestamp(data.createdAt),
        updatedAt: formatTimestamp(data.updatedAt),
      };
    });
  } catch (error) {
    console.warn('Error fetching budgets from Firestore:', error);
    return [];
  }
}

function isProviderDisabledOrConfigError(err: any): boolean {
  const code = String(err?.code || '');
  const msg = String(err?.message || '');
  return (
    code === 'auth/operation-not-allowed' ||
    code === 'auth/configuration-not-found' ||
    code === 'auth/api-key-not-valid' ||
    code.startsWith('auth/api-key-not-valid') ||
    msg.includes('PASSWORD_LOGIN_DISABLED') ||
    msg.includes('OPERATION_NOT_ALLOWED') ||
    msg.includes('CONFIGURATION_NOT_FOUND') ||
    msg.includes('api-key-not-valid')
  );
}

export const api = {
  // --- Authentication ---
  async loginWithGoogle(): Promise<{ user: User; message: string }> {
    clearLegacyLocalStorage();
    clearProfileCache();
    clientStore.setCurrentUserId(null);

    try {
      const cred = await signInWithPopup(auth, googleProvider);
      const user = await ensureUserProfileInFirestore(cred.user);
      return {
        user,
        message: `Signed in as ${user.name}`,
      };
    } catch (err: any) {
      const code = String(err?.code || '');
      if (
        code === 'auth/popup-blocked' ||
        code === 'auth/operation-not-supported-in-this-environment'
      ) {
        await signInWithRedirect(auth, googleProvider);
        throw new Error('Redirecting to Google Sign-In...');
      }
      if (code === 'auth/unauthorized-domain') {
        const domain = typeof window !== 'undefined' ? window.location.hostname : 'this domain';
        throw new Error(
          `Google Sign-In popup require "${domain}" to be listed in Firebase Console → Authentication → Settings → Authorized domains. You can sign in using your email & password below right now.`
        );
      }
      throw err;
    }
  },

  async register(data: {
    name: string;
    email: string;
    password?: string;
    collegeName?: string;
    degreeSemester?: string;
    monthlyBudget?: number;
    currency?: string;
  }): Promise<{ user: User; token: string; message: string; requiresEmailVerification?: boolean }> {
    clearLegacyLocalStorage();
    clearProfileCache();
    const cleanEmail = (data.email || '').trim().toLowerCase();
    if (!cleanEmail || !data.password || data.password.length < 6) {
      throw new Error('Please enter a valid email address and a password of at least 6 characters.');
    }

    try {
      const cred = await createUserWithEmailAndPassword(auth, cleanEmail, data.password);
      clientStore.setCurrentUserId(null);
      if (data.name) {
        try {
          await updateFirebaseAuthProfile(cred.user, { displayName: data.name.trim() });
        } catch {}
      }
      const user = await ensureUserProfileInFirestore(cred.user, data);
      return {
        user,
        token: 'firebase_authenticated',
        requiresEmailVerification: false,
        message: `Account created! Welcome to CostCurve, ${user.name}.`,
      };
    } catch (err: any) {
      // If account already exists in Firebase Auth, try signing in directly with the provided password
      if (err?.code === 'auth/email-already-in-use') {
        try {
          const signInCred = await signInWithEmailAndPassword(auth, cleanEmail, data.password);
          clientStore.setCurrentUserId(null);
          const user = await ensureUserProfileInFirestore(signInCred.user, data);
          return {
            user,
            token: 'firebase_authenticated',
            requiresEmailVerification: false,
            message: `Welcome back, ${user.name}!`,
          };
        } catch {
          throw new Error('An account with this email already exists. Please switch to "Sign in" and enter your password.');
        }
      }

      // If Email/Password provider is not enabled yet in Firebase Console (PASSWORD_LOGIN_DISABLED),
      // seamlessly register/authenticate via isolated per-user ClientStore so Email login works immediately.
      if (isProviderDisabledOrConfigError(err)) {
        if (clientStore.hasUserWithEmail(cleanEmail)) {
          const loginRes = clientStore.login(cleanEmail, data.password);
          return {
            user: loginRes.user,
            token: loginRes.token,
            requiresEmailVerification: false,
            message: loginRes.message,
          };
        }
        const localReg = clientStore.register(data);
        return {
          user: localReg.user,
          token: localReg.token,
          requiresEmailVerification: false,
          message: localReg.message,
        };
      }

      if (err?.code === 'auth/invalid-email') {
        throw new Error('Please enter a valid email address.');
      }
      if (err?.code === 'auth/weak-password') {
        throw new Error('Password should be at least 6 characters long.');
      }
      throw new Error(err?.message || 'Registration failed.');
    }
  },

  async login(email: string, password?: string): Promise<{ user: User; token: string; message: string }> {
    clearLegacyLocalStorage();
    clearProfileCache();
    const cleanEmail = (email || '').trim().toLowerCase();
    if (!cleanEmail || !password) {
      throw new Error('Please enter both your email address and password.');
    }
    if (password.length < 6) {
      throw new Error('Password must be at least 6 characters long.');
    }

    try {
      const cred = await signInWithEmailAndPassword(auth, cleanEmail, password);
      clientStore.setCurrentUserId(null);
      const user = await ensureUserProfileInFirestore(cred.user);
      return {
        user,
        token: 'firebase_authenticated',
        message: `Welcome back, ${user.name}!`,
      };
    } catch (err: any) {
      // If user has not registered yet in Firebase Auth, auto-create their account on first email sign-in
      if (err?.code === 'auth/user-not-found') {
        try {
          const newCred = await createUserWithEmailAndPassword(auth, cleanEmail, password);
          clientStore.setCurrentUserId(null);
          const user = await ensureUserProfileInFirestore(newCred.user, {
            name: cleanEmail.split('@')[0],
          });
          return {
            user,
            token: 'firebase_authenticated',
            message: `Welcome to CostCurve, ${user.name}!`,
          };
        } catch (createErr: any) {
          if (!isProviderDisabledOrConfigError(createErr)) {
            throw new Error('Invalid email or password. Please verify your credentials.');
          }
        }
      }

      // If Email/Password provider is disabled in Firebase Console (PASSWORD_LOGIN_DISABLED / auth/operation-not-allowed),
      // seamlessly authenticate or initialize the user's isolated account in ClientStore.
      if (isProviderDisabledOrConfigError(err)) {
        if (clientStore.hasUserWithEmail(cleanEmail)) {
          return clientStore.login(cleanEmail, password);
        }
        return clientStore.register({
          name: cleanEmail.split('@')[0] || 'Student User',
          email: cleanEmail,
          password,
        });
      }

      if (err?.code === 'auth/invalid-credential' || err?.code === 'auth/wrong-password') {
        // Also check if they previously registered in ClientStore
        if (clientStore.hasUserWithEmail(cleanEmail)) {
          return clientStore.login(cleanEmail, password);
        }
        throw new Error('Invalid email or password. Please verify your credentials or create an account.');
      }

      throw new Error(err?.message || 'Sign in failed.');
    }
  },

  async reloadAndVerifyEmail(): Promise<{ user: User; emailVerified: boolean }> {
    const ctx = await resolveAuthMode();
    if (ctx.mode === 'local') {
      return { user: ctx.localUser, emailVerified: true };
    }
    clearProfileCache();
    await ctx.fbUser.reload();
    await ctx.fbUser.getIdToken(true);
    const refreshed = auth.currentUser!;
    const user = await ensureUserProfileInFirestore(refreshed);
    return { user, emailVerified: true };
  },

  async resendVerificationEmail(): Promise<{ message: string }> {
    const ctx = await resolveAuthMode();
    if (ctx.mode === 'local') {
      return { message: `Your account (${ctx.localUser.email}) is already active.` };
    }
    await sendEmailVerification(ctx.fbUser);
    return { message: `Verification email sent to ${ctx.fbUser.email}` };
  },

  async logout(): Promise<void> {
    clearLegacyLocalStorage();
    clearProfileCache();
    clientStore.setCurrentUserId(null);
    try {
      await signOut(auth);
    } catch {}
  },

  async getMe(forceRefresh = false): Promise<{ user: User }> {
    const ctx = await resolveAuthMode();
    if (ctx.mode === 'local') {
      return { user: ctx.localUser };
    }
    if (forceRefresh) {
      cachedUserProfiles.delete(ctx.fbUser.uid);
    }
    const user = await ensureUserProfileInFirestore(ctx.fbUser);
    return { user };
  },

  async updateProfile(updates: Partial<User>): Promise<{ user: User; message: string }> {
    const ctx = await resolveAuthMode();
    if (ctx.mode === 'local') {
      return clientStore.updateProfile(updates);
    }

    const fbUser = ctx.fbUser;
    const uid = sanitizeId(fbUser.uid);
    const userPath = `users/${uid}`;
    const userRef = doc(db, 'users', uid);

    let snap;
    try {
      snap = await getDoc(userRef);
    } catch (error) {
      handleFirestoreError(error, OperationType.GET, userPath);
    }

    if (!snap || !snap.exists()) {
      cachedUserProfiles.delete(fbUser.uid);
      const created = await ensureUserProfileInFirestore(fbUser, updates);
      return { user: created, message: 'Profile saved' };
    }

    const existing = snap.data();
    const payload: Record<string, any> = {
      updatedAt: serverTimestamp(),
    };

    if (updates.name !== undefined) payload.name = sanitizeString(updates.name, 100, existing.name);
    if (updates.currency !== undefined) payload.currency = sanitizeString(updates.currency, 10, existing.currency);
    if (updates.theme !== undefined) payload.theme = updates.theme === 'light' ? 'light' : 'dark';
    if (updates.monthlyBudget !== undefined) {
      payload.monthlyBudget = Math.min(100000000, Math.max(0, roundMoney(Number(updates.monthlyBudget))));
    }
    if (updates.semesterBudget !== undefined) {
      payload.semesterBudget = Math.min(500000000, Math.max(0, roundMoney(Number(updates.semesterBudget))));
    }
    if (updates.semesterEndDate !== undefined) {
      payload.semesterEndDate = sanitizeString(updates.semesterEndDate, 32, existing.semesterEndDate);
    }
    if (updates.collegeName !== undefined) {
      payload.collegeName = sanitizeString(updates.collegeName, 120, '');
    }
    if (updates.degreeSemester !== undefined) {
      payload.degreeSemester = sanitizeString(updates.degreeSemester, 120, '');
    }

    try {
      await updateDoc(userRef, payload);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, userPath);
    }

    const refreshed = await this.getMe(true);
    return { user: refreshed.user, message: 'Profile saved' };
  },

  async changePassword(currentPassword: string, newPassword: string): Promise<{ message: string }> {
    const ctx = await resolveAuthMode();
    if (ctx.mode === 'local') {
      return clientStore.changePassword(currentPassword, newPassword);
    }
    const fbUser = ctx.fbUser;
    if (!fbUser.email) {
      throw new Error('Password update is only available for email/password accounts.');
    }
    const hasPasswordProvider = fbUser.providerData.some((p) => p.providerId === 'password');
    if (!hasPasswordProvider) {
      throw new Error('Your account uses Google Sign-In. Manage your Google security settings in your Google Account.');
    }
    const credential = EmailAuthProvider.credential(fbUser.email, currentPassword);
    await reauthenticateWithCredential(fbUser, credential);
    await updatePassword(fbUser, newPassword);
    return { message: 'Password updated successfully' };
  },

  async exportUserDataArchive(): Promise<void> {
    const [meRes, categoriesRes, txRes, budgetsRes, goalsRes, recRes, splitsRes, debtsRes] = await Promise.all([
      this.getMe(),
      this.getCategories(),
      this.getTransactions({ limit: 5000 }),
      this.getBudgets(),
      this.getGoals(),
      this.getRecurring(),
      this.getSplits(),
      this.getDebts(),
    ]);

    const archive = {
      exportedAt: new Date().toISOString(),
      user: meRes.user,
      customCategories: categoriesRes.categories.filter((c) => c.userId === meRes.user.id),
      transactions: txRes.items,
      budgets: budgetsRes.allBudgets,
      savingsGoals: goalsRes.goals,
      recurringPayments: recRes.recurring,
      splitExpenses: splitsRes.splits,
      debts: debtsRes.debts,
    };

    const blob = new Blob([JSON.stringify(archive, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `costcurve-ledger-${meRes.user.id.slice(0, 8)}-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  },

  async deleteAccount(): Promise<{ message: string }> {
    const ctx = await resolveAuthMode();
    if (ctx.mode === 'local') {
      return clientStore.deleteAccount();
    }

    const fbUser = ctx.fbUser;
    const uid = sanitizeId(fbUser.uid);
    const collectionsToClean = [
      'transactions',
      'categories',
      'budgets',
      'savingsGoals',
      'recurringPayments',
      'splitExpenses',
      'debts',
    ];

    for (const colName of collectionsToClean) {
      try {
        const q = query(collection(db, colName), where('userId', '==', uid));
        const snap = await getDocs(q);
        for (const d of snap.docs) {
          await deleteDoc(doc(db, colName, d.id));
        }
      } catch (error) {
        handleFirestoreError(error, OperationType.DELETE, colName);
      }
    }

    try {
      await deleteDoc(doc(db, 'users', uid));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `users/${uid}`);
    }

    clearProfileCache();
    await signOut(auth);
    return { message: 'Account and all associated cloud records deleted.' };
  },

  // --- Categories ---
  async getCategories(): Promise<{ categories: Category[] }> {
    const ctx = await resolveAuthMode();
    if (ctx.mode === 'local') {
      return { categories: clientStore.getCategories() };
    }
    const categories = await fetchUserCategoriesRaw(ctx.fbUser.uid);
    return { categories };
  },

  async createCategory(cat: Partial<Category>): Promise<{ category: Category }> {
    const ctx = await resolveAuthMode();
    if (ctx.mode === 'local') {
      return { category: clientStore.createCategory(cat) };
    }
    const fbUser = ctx.fbUser;
    const id = sanitizeId(`cat_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`);
    const path = `categories/${id}`;

    const payload = {
      id,
      userId: sanitizeId(fbUser.uid),
      name: sanitizeString(cat.name || 'Custom Category', 80, 'Custom Category'),
      kind: (cat.kind === 'income' ? 'income' : 'expense') as TransactionKind,
      color: sanitizeString(cat.color || '#2dd4bf', 32, '#2dd4bf'),
      icon: sanitizeString(cat.icon || 'Tag', 64, 'Tag'),
      isEssential: !!cat.isEssential,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };

    try {
      await setDoc(doc(db, 'categories', id), payload);
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, path);
    }

    return {
      category: {
        ...payload,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    };
  },

  async deleteCategory(id: string): Promise<{ message: string }> {
    const ctx = await resolveAuthMode();
    if (ctx.mode === 'local') {
      clientStore.deleteCategory(id);
      return { message: 'Category deleted' };
    }
    const cleanId = sanitizeId(id);
    const path = `categories/${cleanId}`;
    try {
      await deleteDoc(doc(db, 'categories', cleanId));
      return { message: 'Category deleted' };
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, path);
    }
  },

  // --- Transactions ---
  async getTransactions(params: Record<string, any> = {}): Promise<{
    items: Transaction[];
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
    summary: { income: number; expense: number; balance: number };
  }> {
    const ctx = await resolveAuthMode();
    if (ctx.mode === 'local') {
      return clientStore.getTransactions(params);
    }
    let list = await fetchUserTransactionsRaw(ctx.fbUser.uid);

    if (params.kind) list = list.filter((t) => t.kind === params.kind);
    if (params.categoryId) list = list.filter((t) => t.categoryId === params.categoryId);
    if (params.search) {
      const q = String(params.search).toLowerCase();
      list = list.filter(
        (t) =>
          t.description.toLowerCase().includes(q) ||
          t.merchant.toLowerCase().includes(q) ||
          t.categoryName.toLowerCase().includes(q)
      );
    }
    if (params.startDate) list = list.filter((t) => t.date >= params.startDate);
    if (params.endDate) list = list.filter((t) => t.date <= params.endDate);

    const totalIncome = list.filter((t) => t.kind === 'income').reduce((acc, t) => acc + t.amount, 0);
    const totalExpense = list.filter((t) => t.kind === 'expense').reduce((acc, t) => acc + t.amount, 0);

    const limit = Math.max(1, Number(params.limit) || 20);
    const page = Math.max(1, Number(params.page) || 1);
    const start = (page - 1) * limit;
    const paginated = list.slice(start, start + limit);

    return {
      items: paginated,
      total: list.length,
      page,
      pageSize: limit,
      totalPages: Math.ceil(list.length / limit) || 1,
      summary: {
        income: roundMoney(totalIncome),
        expense: roundMoney(totalExpense),
        balance: roundMoney(totalIncome - totalExpense),
      },
    };
  },

  async createTransaction(tx: Partial<Transaction>): Promise<{ transaction: Transaction; message: string }> {
    const ctx = await resolveAuthMode();
    if (ctx.mode === 'local') {
      const created = clientStore.createTransaction(tx);
      return { transaction: created, message: 'Transaction recorded' };
    }
    const fbUser = ctx.fbUser;
    const categories = await fetchUserCategoriesRaw(fbUser.uid);
    const matchedCat = categories.find((c) => c.id === tx.categoryId);

    const id = sanitizeId(`tx_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`);
    const path = `transactions/${id}`;
    const kind: TransactionKind = tx.kind === 'income' ? 'income' : 'expense';
    const categoryId = sanitizeId(tx.categoryId || (kind === 'income' ? 'cat-allowance' : 'cat-other-exp'));
    const categoryName = sanitizeString(
      matchedCat ? matchedCat.name : tx.categoryName || (kind === 'income' ? 'Allowance / Pocket Money' : 'Other Expenses'),
      80,
      'General'
    );
    const paymentMethod: PaymentMethod = ALLOWED_PAYMENT_METHODS.includes(tx.paymentMethod as PaymentMethod)
      ? (tx.paymentMethod as PaymentMethod)
      : 'UPI';
    const account: AccountWallet = ALLOWED_WALLETS.includes(tx.account as AccountWallet)
      ? (tx.account as AccountWallet)
      : 'Primary Bank';

    const payload: Record<string, any> = {
      id,
      userId: sanitizeId(fbUser.uid),
      amount: Math.min(100000000, Math.max(0, roundMoney(Math.abs(Number(tx.amount) || 0)))),
      kind,
      categoryId,
      categoryName,
      description: sanitizeString(tx.description || categoryName, 200, categoryName),
      merchant: sanitizeString(tx.merchant || '', 120, ''),
      date: sanitizeString(tx.date || new Date().toISOString().split('T')[0], 32, new Date().toISOString().split('T')[0]),
      paymentMethod,
      account,
      notes: sanitizeString(tx.notes || '', 500, ''),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };

    if (tx.recurringId) {
      payload.recurringId = sanitizeId(tx.recurringId);
    }

    try {
      await setDoc(doc(db, 'transactions', id), payload);
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, path);
    }

    const nowIso = new Date().toISOString();
    return {
      transaction: {
        ...(payload as any),
        createdAt: nowIso,
        updatedAt: nowIso,
      },
      message: 'Transaction recorded in Cloud Firestore',
    };
  },

  async updateTransaction(id: string, updates: Partial<Transaction>): Promise<{ transaction: Transaction; message: string }> {
    const ctx = await resolveAuthMode();
    if (ctx.mode === 'local') {
      const updated = clientStore.updateTransaction(id, updates);
      return { transaction: updated, message: 'Transaction updated' };
    }
    const fbUser = ctx.fbUser;
    const cleanId = sanitizeId(id);
    const path = `transactions/${cleanId}`;
    const txRef = doc(db, 'transactions', cleanId);

    let snap;
    try {
      snap = await getDoc(txRef);
    } catch (error) {
      handleFirestoreError(error, OperationType.GET, path);
    }

    if (!snap || !snap.exists()) {
      throw new Error('Transaction not found.');
    }

    const existing = snap.data();
    const categories = await fetchUserCategoriesRaw(fbUser.uid);
    const newCategoryId = updates.categoryId ? sanitizeId(updates.categoryId) : existing.categoryId;
    const matchedCat = categories.find((c) => c.id === newCategoryId);

    const kind: TransactionKind = updates.kind
      ? updates.kind === 'income'
        ? 'income'
        : 'expense'
      : existing.kind;

    const paymentMethod: PaymentMethod =
      updates.paymentMethod && ALLOWED_PAYMENT_METHODS.includes(updates.paymentMethod)
        ? updates.paymentMethod
        : existing.paymentMethod;

    const account: AccountWallet =
      updates.account && ALLOWED_WALLETS.includes(updates.account)
        ? updates.account
        : existing.account;

    const updatePayload = {
      amount:
        updates.amount !== undefined
          ? Math.min(100000000, Math.max(0, roundMoney(Math.abs(Number(updates.amount)))))
          : existing.amount,
      kind,
      categoryId: newCategoryId,
      categoryName: sanitizeString(
        matchedCat ? matchedCat.name : updates.categoryName || existing.categoryName,
        80,
        existing.categoryName
      ),
      description: sanitizeString(
        updates.description !== undefined ? updates.description : existing.description,
        200,
        existing.description
      ),
      merchant: sanitizeString(
        updates.merchant !== undefined ? updates.merchant : existing.merchant,
        120,
        ''
      ),
      date: sanitizeString(updates.date || existing.date, 32, existing.date),
      paymentMethod,
      account,
      notes: sanitizeString(updates.notes !== undefined ? updates.notes : existing.notes, 500, ''),
      updatedAt: serverTimestamp(),
    };

    try {
      await updateDoc(txRef, updatePayload);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, path);
    }

    return {
      transaction: {
        id: cleanId,
        userId: existing.userId,
        ...updatePayload,
        createdAt: formatTimestamp(existing.createdAt),
        updatedAt: new Date().toISOString(),
      },
      message: 'Transaction updated',
    };
  },

  async deleteTransaction(id: string): Promise<{ message: string }> {
    const ctx = await resolveAuthMode();
    if (ctx.mode === 'local') {
      clientStore.deleteTransaction(id);
      return { message: 'Transaction deleted' };
    }
    const cleanId = sanitizeId(id);
    const path = `transactions/${cleanId}`;
    try {
      await deleteDoc(doc(db, 'transactions', cleanId));
      return { message: 'Transaction deleted' };
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, path);
    }
  },

  async bulkDeleteTransactions(ids: string[]): Promise<{ count: number; message: string }> {
    const ctx = await resolveAuthMode();
    if (ctx.mode === 'local') {
      return clientStore.bulkDeleteTransactions(ids);
    }
    const batch = writeBatch(db);
    let count = 0;
    for (const rawId of ids) {
      const cleanId = sanitizeId(rawId);
      batch.delete(doc(db, 'transactions', cleanId));
      count++;
    }
    try {
      await batch.commit();
      return { count, message: `Deleted ${count} transactions` };
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, 'transactions');
    }
  },

  async importCsv(rows: any[]): Promise<{ imported: number; skippedDuplicates: number; errors: string[]; message: string }> {
    await resolveAuthMode();
    let count = 0;
    const errors: string[] = [];
    for (const row of rows) {
      if (row.amount && Number(row.amount) > 0) {
        try {
          await this.createTransaction(row);
          count++;
        } catch (err: any) {
          errors.push(err.message || 'Row import error');
        }
      }
    }
    return {
      imported: count,
      skippedDuplicates: 0,
      errors,
      message: `Imported ${count} transactions`,
    };
  },

  // --- Budgets ---
  async getBudgets(month?: string): Promise<BudgetResponse> {
    const ctx = await resolveAuthMode();
    if (ctx.mode === 'local') {
      return clientStore.getBudgets(month);
    }
    const [{ user }, userBudgets, allTxs] = await Promise.all([
      this.getMe(),
      fetchUserBudgetsRaw(ctx.fbUser.uid),
      fetchUserTransactionsRaw(ctx.fbUser.uid),
    ]);
    return computeBudgetsResponse(user, userBudgets, allTxs, month);
  },

  async setBudget(budget: { categoryId?: string | null; amount: number; month?: string; warningThreshold?: number }): Promise<any> {
    const ctx = await resolveAuthMode();
    if (ctx.mode === 'local') {
      return clientStore.setBudget(budget);
    }
    const fbUser = ctx.fbUser;
    const now = new Date();
    const month = sanitizeString(
      budget.month || `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`,
      16,
      `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
    );
    const categoryId = sanitizeId(budget.categoryId || 'overall');
    const userBudgets = await fetchUserBudgetsRaw(fbUser.uid);
    const existing = userBudgets.find((b) => b.month === month && b.categoryId === categoryId);

    const amount = Math.min(100000000, Math.max(0, roundMoney(Number(budget.amount) || 0)));
    const warningThreshold = Math.min(100, Math.max(1, Math.round(Number(budget.warningThreshold) || 80)));

    if (existing) {
      const path = `budgets/${existing.id}`;
      try {
        await updateDoc(doc(db, 'budgets', existing.id), {
          amount,
          warningThreshold,
          updatedAt: serverTimestamp(),
        });
        return { ...existing, amount, warningThreshold };
      } catch (error) {
        handleFirestoreError(error, OperationType.UPDATE, path);
      }
    }

    const id = sanitizeId(`bdg_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`);
    const path = `budgets/${id}`;
    const payload = {
      id,
      userId: sanitizeId(fbUser.uid),
      categoryId,
      period: 'monthly' as const,
      month,
      amount,
      warningThreshold,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };

    try {
      await setDoc(doc(db, 'budgets', id), payload);
      return payload;
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, path);
    }
  },

  async deleteBudget(id: string): Promise<any> {
    const ctx = await resolveAuthMode();
    if (ctx.mode === 'local') {
      clientStore.deleteBudget(id);
      return { message: 'Budget deleted' };
    }
    const cleanId = sanitizeId(id);
    const path = `budgets/${cleanId}`;
    try {
      await deleteDoc(doc(db, 'budgets', cleanId));
      return { message: 'Budget deleted' };
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, path);
    }
  },

  // --- Savings Goals ---
  async getGoals(): Promise<{ goals: SavingsGoal[] }> {
    const ctx = await resolveAuthMode();
    if (ctx.mode === 'local') {
      return { goals: clientStore.getGoals() };
    }
    const path = 'savingsGoals';
    try {
      const q = query(collection(db, path), where('userId', '==', ctx.fbUser.uid));
      const snap = await getDocs(q);
      const goals: SavingsGoal[] = snap.docs.map((d) => {
        const data = d.data();
        return {
          id: d.id,
          userId: data.userId,
          title: data.title,
          targetAmount: Number(data.targetAmount) || 0,
          currentAmount: Number(data.currentAmount) || 0,
          targetDate: data.targetDate,
          category: data.category || 'General',
          icon: data.icon || 'Target',
          status: data.status === 'completed' ? 'completed' : 'in_progress',
          createdAt: formatTimestamp(data.createdAt),
          updatedAt: formatTimestamp(data.updatedAt),
        };
      });
      return { goals };
    } catch (error) {
      console.warn('Error fetching savings goals from Firestore:', error);
      return { goals: [] };
    }
  },

  async createGoal(goal: Partial<SavingsGoal>): Promise<{ goal: SavingsGoal }> {
    const ctx = await resolveAuthMode();
    if (ctx.mode === 'local') {
      return { goal: clientStore.createGoal(goal) };
    }
    const fbUser = ctx.fbUser;
    const id = sanitizeId(`gl_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`);
    const path = `savingsGoals/${id}`;
    const targetAmount = Math.min(100000000, Math.max(1, roundMoney(Number(goal.targetAmount) || 5000)));
    const currentAmount = Math.min(100000000, Math.max(0, roundMoney(Number(goal.currentAmount) || 0)));

    const payload = {
      id,
      userId: sanitizeId(fbUser.uid),
      title: sanitizeString(goal.title || 'Savings Goal', 120, 'Savings Goal'),
      targetAmount,
      currentAmount,
      targetDate: sanitizeString(
        goal.targetDate || new Date(Date.now() + 90 * 24 * 3600 * 1000).toISOString().split('T')[0],
        32,
        new Date(Date.now() + 90 * 24 * 3600 * 1000).toISOString().split('T')[0]
      ),
      category: sanitizeString(goal.category || 'General', 80, 'General'),
      icon: sanitizeString(goal.icon || 'Target', 64, 'Target'),
      status: (currentAmount >= targetAmount ? 'completed' : 'in_progress') as 'in_progress' | 'completed',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };

    try {
      await setDoc(doc(db, 'savingsGoals', id), payload);
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, path);
    }

    return {
      goal: {
        ...payload,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    };
  },

  async depositGoal(id: string, amount: number, recordTransaction: boolean): Promise<any> {
    const ctx = await resolveAuthMode();
    if (ctx.mode === 'local') {
      return clientStore.depositGoal(id, amount, recordTransaction);
    }
    const cleanId = sanitizeId(id);
    const path = `savingsGoals/${cleanId}`;
    const goalRef = doc(db, 'savingsGoals', cleanId);

    let snap;
    try {
      snap = await getDoc(goalRef);
    } catch (error) {
      handleFirestoreError(error, OperationType.GET, path);
    }

    if (!snap || !snap.exists()) {
      throw new Error('Savings goal not found.');
    }

    const data = snap.data();
    const newCurrent = Math.min(100000000, Math.max(0, roundMoney(Number(data.currentAmount) + Number(amount))));
    const newStatus = newCurrent >= Number(data.targetAmount) ? 'completed' : 'in_progress';

    try {
      await updateDoc(goalRef, {
        title: data.title,
        targetAmount: data.targetAmount,
        currentAmount: newCurrent,
        targetDate: data.targetDate,
        status: newStatus,
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, path);
    }

    if (recordTransaction && Number(amount) > 0) {
      await this.createTransaction({
        amount: Number(amount),
        kind: 'expense',
        categoryId: 'cat-personal',
        categoryName: 'Personal Care',
        description: `Deposit to savings goal: ${data.title}`,
        merchant: 'Savings Goal',
        date: new Date().toISOString().split('T')[0],
        paymentMethod: 'UPI',
        account: 'Savings',
      });
    }

    return { id: cleanId, currentAmount: newCurrent, status: newStatus };
  },

  async deleteGoal(id: string): Promise<any> {
    const ctx = await resolveAuthMode();
    if (ctx.mode === 'local') {
      clientStore.deleteGoal(id);
      return { message: 'Goal removed' };
    }
    const cleanId = sanitizeId(id);
    const path = `savingsGoals/${cleanId}`;
    try {
      await deleteDoc(doc(db, 'savingsGoals', cleanId));
      return { message: 'Goal removed' };
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, path);
    }
  },

  // --- Recurring Payments ---
  async getRecurring(): Promise<{ recurring: RecurringPayment[] }> {
    const ctx = await resolveAuthMode();
    if (ctx.mode === 'local') {
      return { recurring: clientStore.getRecurring() };
    }
    const path = 'recurringPayments';
    try {
      const q = query(collection(db, path), where('userId', '==', ctx.fbUser.uid));
      const snap = await getDocs(q);
      const recurring: RecurringPayment[] = snap.docs.map((d) => {
        const data = d.data();
        return {
          id: d.id,
          userId: data.userId,
          title: data.title,
          amount: Number(data.amount) || 0,
          kind: data.kind === 'income' ? 'income' : 'expense',
          categoryId: data.categoryId || 'cat-bills',
          frequency: data.frequency || 'monthly',
          nextDueDate: data.nextDueDate,
          paymentMethod: data.paymentMethod || 'UPI',
          status: data.status || 'active',
          autoLog: !!data.autoLog,
          notes: data.notes || '',
          createdAt: formatTimestamp(data.createdAt),
          updatedAt: formatTimestamp(data.updatedAt),
        };
      });
      return { recurring };
    } catch (error) {
      console.warn('Error fetching recurring payments from Firestore:', error);
      return { recurring: [] };
    }
  },

  async createRecurring(rec: Partial<RecurringPayment>): Promise<{ recurring: RecurringPayment }> {
    const ctx = await resolveAuthMode();
    if (ctx.mode === 'local') {
      return { recurring: clientStore.createRecurring(rec) };
    }
    const fbUser = ctx.fbUser;
    const id = sanitizeId(`rec_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`);
    const path = `recurringPayments/${id}`;

    const frequency: RecurringFrequency = ALLOWED_FREQUENCIES.includes(rec.frequency as RecurringFrequency)
      ? (rec.frequency as RecurringFrequency)
      : 'monthly';
    const paymentMethod: PaymentMethod = ALLOWED_PAYMENT_METHODS.includes(rec.paymentMethod as PaymentMethod)
      ? (rec.paymentMethod as PaymentMethod)
      : 'UPI';

    const payload = {
      id,
      userId: sanitizeId(fbUser.uid),
      title: sanitizeString(rec.title || 'Recurring Bill', 120, 'Recurring Bill'),
      amount: Math.min(100000000, Math.max(0, roundMoney(Number(rec.amount) || 0))),
      kind: (rec.kind === 'income' ? 'income' : 'expense') as TransactionKind,
      categoryId: sanitizeId(rec.categoryId || 'cat-bills'),
      frequency,
      nextDueDate: sanitizeString(
        rec.nextDueDate || new Date().toISOString().split('T')[0],
        32,
        new Date().toISOString().split('T')[0]
      ),
      paymentMethod,
      status: (rec.status === 'paused' || rec.status === 'cancelled' ? rec.status : 'active') as
        | 'active'
        | 'paused'
        | 'cancelled',
      autoLog: !!rec.autoLog,
      notes: sanitizeString(rec.notes || '', 500, ''),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };

    try {
      await setDoc(doc(db, 'recurringPayments', id), payload);
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, path);
    }

    return {
      recurring: {
        ...payload,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    };
  },

  async logRecurringTransaction(id: string): Promise<any> {
    const ctx = await resolveAuthMode();
    if (ctx.mode === 'local') {
      return clientStore.logRecurringTransaction(id);
    }
    const fbUser = ctx.fbUser;
    const cleanId = sanitizeId(id);
    const path = `recurringPayments/${cleanId}`;
    let snap;
    try {
      snap = await getDoc(doc(db, 'recurringPayments', cleanId));
    } catch (error) {
      handleFirestoreError(error, OperationType.GET, path);
    }

    if (!snap || !snap.exists()) {
      throw new Error('Recurring commitment not found.');
    }

    const rec = snap.data();
    const categories = await fetchUserCategoriesRaw(fbUser.uid);
    const cat = categories.find((c) => c.id === rec.categoryId);

    const txRes = await this.createTransaction({
      amount: Number(rec.amount) || 0,
      kind: rec.kind === 'income' ? 'income' : 'expense',
      categoryId: rec.categoryId,
      categoryName: cat?.name || 'Bills & Utilities',
      description: `${rec.title} (Recurring Bill)`,
      merchant: rec.title,
      date: new Date().toISOString().split('T')[0],
      paymentMethod: rec.paymentMethod,
      account: 'Primary Bank',
      recurringId: cleanId,
    });

    return { transaction: txRes.transaction, recurring: { id: cleanId, ...rec } };
  },

  async deleteRecurring(id: string): Promise<any> {
    const ctx = await resolveAuthMode();
    if (ctx.mode === 'local') {
      clientStore.deleteRecurring(id);
      return { message: 'Recurring commitment removed' };
    }
    const cleanId = sanitizeId(id);
    const path = `recurringPayments/${cleanId}`;
    try {
      await deleteDoc(doc(db, 'recurringPayments', cleanId));
      return { message: 'Recurring commitment removed' };
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, path);
    }
  },

  // --- Splits & Debts ---
  async getSplits(): Promise<{ splits: SplitExpense[] }> {
    const ctx = await resolveAuthMode();
    if (ctx.mode === 'local') {
      return { splits: clientStore.getSplits() };
    }
    const path = 'splitExpenses';
    try {
      const q = query(collection(db, path), where('userId', '==', ctx.fbUser.uid));
      const snap = await getDocs(q);
      const splits: SplitExpense[] = snap.docs.map((d) => {
        const data = d.data();
        return {
          id: d.id,
          userId: data.userId,
          title: data.title,
          totalAmount: Number(data.totalAmount) || 0,
          userShare: Number(data.userShare) || 0,
          date: data.date,
          paidBy: data.paidBy || 'You',
          status: data.status === 'settled' ? 'settled' : 'pending',
          participants: Array.isArray(data.participants) ? data.participants : [],
          createdAt: formatTimestamp(data.createdAt),
          updatedAt: formatTimestamp(data.updatedAt),
        };
      });
      return { splits };
    } catch (error) {
      console.warn('Error fetching split expenses from Firestore:', error);
      return { splits: [] };
    }
  },

  async createSplit(split: Partial<SplitExpense>): Promise<{ split: SplitExpense }> {
    const ctx = await resolveAuthMode();
    if (ctx.mode === 'local') {
      return { split: clientStore.createSplit(split) };
    }
    const fbUser = ctx.fbUser;
    const id = sanitizeId(`spl_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`);
    const path = `splitExpenses/${id}`;
    const totalAmount = Math.min(100000000, Math.max(0, roundMoney(Number(split.totalAmount) || 0)));
    const rawParticipants = Array.isArray(split.participants) ? split.participants.slice(0, 20) : [];
    const sanitizedParticipants = rawParticipants.map((p) => ({
      name: sanitizeString(p.name || 'Classmate', 80, 'Classmate'),
      amount: Math.max(0, roundMoney(Number(p.amount) || 0)),
      settled: !!p.settled,
    }));

    const userShare = Math.min(
      100000000,
      Math.max(
        0,
        roundMoney(
          split.userShare !== undefined
            ? Number(split.userShare)
            : totalAmount / Math.max(1, sanitizedParticipants.length + 1)
        )
      )
    );

    const payload = {
      id,
      userId: sanitizeId(fbUser.uid),
      title: sanitizeString(split.title || 'Shared Expense', 120, 'Shared Expense'),
      totalAmount,
      userShare,
      date: sanitizeString(
        split.date || new Date().toISOString().split('T')[0],
        32,
        new Date().toISOString().split('T')[0]
      ),
      paidBy: sanitizeString(split.paidBy || 'You', 100, 'You'),
      status: (split.status === 'settled' ? 'settled' : 'pending') as 'pending' | 'settled',
      participants: sanitizedParticipants,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };

    try {
      await setDoc(doc(db, 'splitExpenses', id), payload);
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, path);
    }

    return {
      split: {
        ...payload,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    };
  },

  async updateSplit(id: string, updates: Partial<SplitExpense>): Promise<any> {
    const ctx = await resolveAuthMode();
    if (ctx.mode === 'local') {
      return clientStore.updateSplit(id, updates);
    }
    const cleanId = sanitizeId(id);
    const path = `splitExpenses/${cleanId}`;
    const splitRef = doc(db, 'splitExpenses', cleanId);

    let snap;
    try {
      snap = await getDoc(splitRef);
    } catch (error) {
      handleFirestoreError(error, OperationType.GET, path);
    }

    if (!snap || !snap.exists()) {
      throw new Error('Split record not found.');
    }

    const existing = snap.data();
    const rawParticipants = Array.isArray(updates.participants)
      ? updates.participants.slice(0, 20)
      : existing.participants || [];
    const sanitizedParticipants = rawParticipants.map((p: any) => ({
      name: sanitizeString(p.name || 'Classmate', 80, 'Classmate'),
      amount: Math.max(0, roundMoney(Number(p.amount) || 0)),
      settled: !!p.settled,
    }));

    const status = updates.status === 'settled' ? 'settled' : existing.status;

    try {
      await updateDoc(splitRef, {
        status,
        participants: sanitizedParticipants,
        updatedAt: serverTimestamp(),
      });
      return { id: cleanId, ...existing, status, participants: sanitizedParticipants };
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, path);
    }
  },

  async deleteSplit(id: string): Promise<any> {
    const ctx = await resolveAuthMode();
    if (ctx.mode === 'local') {
      clientStore.deleteSplit(id);
      return { message: 'Split deleted' };
    }
    const cleanId = sanitizeId(id);
    const path = `splitExpenses/${cleanId}`;
    try {
      await deleteDoc(doc(db, 'splitExpenses', cleanId));
      return { message: 'Split deleted' };
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, path);
    }
  },

  async getDebts(): Promise<{ debts: DebtRecord[] }> {
    const ctx = await resolveAuthMode();
    if (ctx.mode === 'local') {
      return { debts: clientStore.getDebts() };
    }
    const path = 'debts';
    try {
      const q = query(collection(db, path), where('userId', '==', ctx.fbUser.uid));
      const snap = await getDocs(q);
      const debts: DebtRecord[] = snap.docs.map((d) => {
        const data = d.data();
        return {
          id: d.id,
          userId: data.userId,
          personName: data.personName,
          type: data.type === 'you_owe' ? 'you_owe' : 'owes_you',
          amount: Number(data.amount) || 0,
          description: data.description,
          dueDate: data.dueDate || '',
          status: data.status === 'settled' ? 'settled' : 'pending',
          createdAt: formatTimestamp(data.createdAt),
          updatedAt: formatTimestamp(data.updatedAt),
        };
      });
      return { debts };
    } catch (error) {
      console.warn('Error fetching debts from Firestore:', error);
      return { debts: [] };
    }
  },

  async createDebt(debt: Partial<DebtRecord>): Promise<{ debt: DebtRecord }> {
    const ctx = await resolveAuthMode();
    if (ctx.mode === 'local') {
      return { debt: clientStore.createDebt(debt) };
    }
    const fbUser = ctx.fbUser;
    const id = sanitizeId(`dbt_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`);
    const path = `debts/${id}`;

    const payload = {
      id,
      userId: sanitizeId(fbUser.uid),
      personName: sanitizeString(debt.personName || 'Classmate', 100, 'Classmate'),
      type: (debt.type === 'you_owe' ? 'you_owe' : 'owes_you') as 'you_owe' | 'owes_you',
      amount: Math.min(100000000, Math.max(0, roundMoney(Number(debt.amount) || 0))),
      description: sanitizeString(debt.description || 'Shared expense', 200, 'Shared expense'),
      dueDate: sanitizeString(debt.dueDate || '', 32, ''),
      status: (debt.status === 'settled' ? 'settled' : 'pending') as 'pending' | 'settled',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };

    try {
      await setDoc(doc(db, 'debts', id), payload);
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, path);
    }

    return {
      debt: {
        ...payload,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    };
  },

  async updateDebt(id: string, updates: Partial<DebtRecord>): Promise<any> {
    const ctx = await resolveAuthMode();
    if (ctx.mode === 'local') {
      return clientStore.updateDebt(id, updates);
    }
    const cleanId = sanitizeId(id);
    const path = `debts/${cleanId}`;
    const debtRef = doc(db, 'debts', cleanId);

    let snap;
    try {
      snap = await getDoc(debtRef);
    } catch (error) {
      handleFirestoreError(error, OperationType.GET, path);
    }

    if (!snap || !snap.exists()) {
      throw new Error('Debt record not found.');
    }

    const existing = snap.data();
    const status = updates.status === 'settled' ? 'settled' : existing.status;
    const amount =
      updates.amount !== undefined
        ? Math.min(100000000, Math.max(0, roundMoney(Number(updates.amount))))
        : existing.amount;
    const description =
      updates.description !== undefined
        ? sanitizeString(updates.description, 200, existing.description)
        : existing.description;
    const dueDate =
      updates.dueDate !== undefined ? sanitizeString(updates.dueDate, 32, '') : existing.dueDate;

    try {
      await updateDoc(debtRef, {
        status,
        amount,
        description,
        dueDate,
        updatedAt: serverTimestamp(),
      });
      return { id: cleanId, ...existing, status, amount, description, dueDate };
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, path);
    }
  },

  async deleteDebt(id: string): Promise<any> {
    const ctx = await resolveAuthMode();
    if (ctx.mode === 'local') {
      clientStore.deleteDebt(id);
      return { message: 'Debt removed' };
    }
    const cleanId = sanitizeId(id);
    const path = `debts/${cleanId}`;
    try {
      await deleteDoc(doc(db, 'debts', cleanId));
      return { message: 'Debt removed' };
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, path);
    }
  },

  // --- Analytics, Insights & Budget Advisor ---
  async getAnalytics(): Promise<AnalyticsResponse> {
    const ctx = await resolveAuthMode();
    if (ctx.mode === 'local') {
      return clientStore.getAnalytics();
    }
    const [{ user }, allTxs, categories] = await Promise.all([
      this.getMe(),
      fetchUserTransactionsRaw(ctx.fbUser.uid),
      fetchUserCategoriesRaw(ctx.fbUser.uid),
    ]);
    return computeAnalyticsResponse(user, allTxs, categories);
  },

  async getInsights(): Promise<{ insights: FinancialInsight[]; context: any }> {
    const ctx = await resolveAuthMode();
    if (ctx.mode === 'local') {
      return clientStore.getInsights();
    }
    const [{ user }, allTxs] = await Promise.all([
      this.getMe(),
      fetchUserTransactionsRaw(ctx.fbUser.uid),
    ]);
    return computeInsightsResponse(user, allTxs);
  },

  async askAI(question: string): Promise<{ answer: string; deterministicCalculation: string }> {
    const ctx = await resolveAuthMode();
    if (ctx.mode === 'local') {
      return clientStore.askAI(question);
    }
    const [{ user }, allTxs, categories, recRes, goalsRes, debtsRes] = await Promise.all([
      this.getMe(),
      fetchUserTransactionsRaw(ctx.fbUser.uid),
      fetchUserCategoriesRaw(ctx.fbUser.uid),
      this.getRecurring(),
      this.getGoals(),
      this.getDebts(),
    ]);
    return evaluateBudgetAdvisorQuestion(
      question,
      user,
      allTxs,
      categories,
      recRes.recurring,
      goalsRes.goals,
      debtsRes.debts
    );
  },

  // --- Owner / Admin Console Operations ---
  async adminGetPlatformDirectory(): Promise<{
    users: User[];
    admins: AdminRecord[];
  }> {
    const ctx = await resolveAuthMode();
    if (ctx.mode === 'local') {
      const localUsers = clientStore.adminGetUsers();
      const localAdmins: AdminRecord[] = localUsers
        .filter((u) => u.isAdmin)
        .map((u) => ({
          uid: u.id,
          email: u.email,
          grantedBy: u.id,
          role: u.role === 'owner' ? 'owner' : 'admin',
          createdAt: u.createdAt,
          updatedAt: u.updatedAt || u.createdAt,
        }));
      return { users: localUsers, admins: localAdmins };
    }

    let usersSnap;
    try {
      usersSnap = await getDocs(collection(db, 'users'));
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, 'users');
    }

    let adminsSnap;
    try {
      adminsSnap = await getDocs(collection(db, 'admins'));
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, 'admins');
    }

    const admins: AdminRecord[] = adminsSnap.docs.map((d) => {
      const data = d.data();
      return {
        uid: d.id,
        email: data.email || '',
        grantedBy: data.grantedBy || '',
        role: data.role === 'owner' ? 'owner' : 'admin',
        createdAt: formatTimestamp(data.createdAt),
        updatedAt: formatTimestamp(data.updatedAt),
      };
    });

    const adminMap = new Map<string, AdminRecord>(admins.map((a) => [a.uid, a]));

    const users: User[] = usersSnap.docs.map((d) => {
      const data = d.data();
      const email = (data.email || '').toLowerCase();
      const isPrimaryOwner = BOOTSTRAPPED_ADMIN_EMAILS.has(email);
      const adminEntry = adminMap.get(d.id);
      const isAdmin = isPrimaryOwner || !!adminEntry;
      const isOwner = isPrimaryOwner || adminEntry?.role === 'owner';
      return mapDocToUser(d.id, data, isAdmin, isOwner);
    });

    users.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    return { users, admins };
  },

  async adminUpdateUserStatus(targetUserId: string, newStatus: 'active' | 'suspended'): Promise<void> {
    const ctx = await resolveAuthMode();
    if (ctx.mode === 'local') {
      clientStore.adminUpdateUserStatus(targetUserId, newStatus);
      return;
    }
    const cleanId = sanitizeId(targetUserId);
    const path = `users/${cleanId}`;
    try {
      await updateDoc(doc(db, 'users', cleanId), {
        status: newStatus,
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, path);
    }
  },

  async adminGrantAdminAccess(targetUser: User): Promise<void> {
    const ctx = await resolveAuthMode();
    if (ctx.mode === 'local') {
      clientStore.adminSetAdminRole(targetUser.id, true);
      return;
    }
    const fbUser = ctx.fbUser;
    const cleanId = sanitizeId(targetUser.id);
    const path = `admins/${cleanId}`;
    try {
      await setDoc(doc(db, 'admins', cleanId), {
        uid: cleanId,
        email: sanitizeString(targetUser.email.toLowerCase(), 254, 'admin@college.edu'),
        grantedBy: sanitizeId(fbUser.uid),
        role: 'admin',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, path);
    }
  },

  async adminRevokeAdminAccess(targetUser: User): Promise<void> {
    const ctx = await resolveAuthMode();
    if (BOOTSTRAPPED_ADMIN_EMAILS.has(targetUser.email.toLowerCase())) {
      throw new Error('Cannot revoke primary platform owner privileges.');
    }
    if (ctx.mode === 'local') {
      clientStore.adminSetAdminRole(targetUser.id, false);
      return;
    }
    const cleanId = sanitizeId(targetUser.id);
    const path = `admins/${cleanId}`;
    try {
      await deleteDoc(doc(db, 'admins', cleanId));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, path);
    }
  },
};
