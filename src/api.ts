import {
  signInWithPopup,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  updatePassword,
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
  OWNER_ADMIN_EMAIL,
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

// Single-flight deduplication and profile cache per UID to prevent concurrent
// getDoc/setDoc race conditions on users/{uid} right after Google Sign-In.
const inflightProfilePromises = new Map<string, Promise<User>>();
const cachedUserProfiles = new Map<string, User>();

export function clearProfileCache() {
  inflightProfilePromises.clear();
  cachedUserProfiles.clear();
}

// Clean up any legacy local storage keys so no stale browser data remains
export function clearLegacyLocalStorage() {
  if (typeof localStorage === 'undefined') return;
  const legacyKeys = [
    'pennywise_student_auth_token',
    'pennywise_active_user_id',
    'pennywise_client_database',
    'pennywise_client_database_v1',
    'pennywise_client_database_v2',
    'pennywise_client_database_v3',
    'pennywise_client_database_v4',
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
  return auth.currentUser ? 'firebase_authenticated' : null;
}

export function clearStoredToken() {
  clearLegacyLocalStorage();
  clearProfileCache();
}

async function requireAuthUserAsync(): Promise<FirebaseUser> {
  if (auth.currentUser) {
    return auth.currentUser;
  }
  const resolved = await waitForAuthUser();
  if (!resolved) {
    throw new Error('Authentication required. Please sign in to continue.');
  }
  return resolved;
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
    emailVerified: fbUser.emailVerified,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

function mapDocToUser(
  uid: string,
  data: Record<string, any>,
  isAdmin: boolean,
  isOwner: boolean,
  emailVerified: boolean
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
    emailVerified,
    createdAt: formatTimestamp(data.createdAt),
    updatedAt: formatTimestamp(data.updatedAt),
  };
}

async function checkAdminStatus(fbUser: FirebaseUser): Promise<{ isAdmin: boolean; isOwner: boolean }> {
  const email = (fbUser.email || '').toLowerCase();
  const isOwner = fbUser.emailVerified && BOOTSTRAPPED_ADMIN_EMAILS.has(email);
  if (isOwner) {
    return { isAdmin: true, isOwner: true };
  }
  if (!fbUser.emailVerified) {
    return { isAdmin: false, isOwner: false };
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

    // If unverified email/password user, return transient profile until verified
    if (!fbUser.emailVerified) {
      const unverifiedProfile = buildFallbackUserFromAuth(fbUser, isAdmin, isOwner, defaults);
      cachedUserProfiles.set(fbUser.uid, unverifiedProfile);
      return unverifiedProfile;
    }

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
      const existingUser = mapDocToUser(uid, snap.data(), isAdmin, isOwner, fbUser.emailVerified);
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
    if (isOwner) {
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
      isOwner,
      fbUser.emailVerified
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

export const api = {
  // --- Authentication ---
  async loginWithGoogle(): Promise<{ user: User; message: string }> {
    clearLegacyLocalStorage();
    clearProfileCache();
    const cred = await signInWithPopup(auth, googleProvider);
    const user = await ensureUserProfileInFirestore(cred.user);
    return {
      user,
      message: `Signed in as ${user.name}`,
    };
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
    if (!cleanEmail || !data.password) {
      throw new Error('Email and password (8+ characters) are required.');
    }
    try {
      const cred = await createUserWithEmailAndPassword(auth, cleanEmail, data.password);
      if (!cred.user.emailVerified) {
        try {
          await sendEmailVerification(cred.user);
        } catch {
          // Ignore verification email rate-limit errors
        }
      }
      const user = await ensureUserProfileInFirestore(cred.user, data);
      return {
        user,
        token: 'firebase_authenticated',
        requiresEmailVerification: !cred.user.emailVerified,
        message: cred.user.emailVerified
          ? `Account created! Welcome to CostCurve, ${user.name}.`
          : 'Account created! Please check your inbox and verify your email address to activate cloud writes.',
      };
    } catch (err: any) {
      if (err?.code === 'auth/operation-not-allowed') {
        throw new Error(
          'Email/Password sign-in is not enabled in the Firebase Console yet. Please click "Continue with Google" above, or enable Email/Password under Firebase Console → Authentication → Sign-in method.'
        );
      }
      if (err?.code === 'auth/email-already-in-use') {
        throw new Error('An account with this email already exists. Please sign in instead.');
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
    try {
      const cred = await signInWithEmailAndPassword(auth, cleanEmail, password);
      const user = await ensureUserProfileInFirestore(cred.user);
      return {
        user,
        token: 'firebase_authenticated',
        message: `Welcome back, ${user.name}!`,
      };
    } catch (err: any) {
      if (err?.code === 'auth/operation-not-allowed') {
        throw new Error(
          'Email/Password sign-in is not enabled in the Firebase Console yet. Please use "Continue with Google" or enable Email/Password in Firebase Console → Authentication → Sign-in method.'
        );
      }
      if (err?.code === 'auth/invalid-credential' || err?.code === 'auth/wrong-password' || err?.code === 'auth/user-not-found') {
        throw new Error('Invalid email or password. Please verify your credentials or sign in with Google.');
      }
      throw new Error(err?.message || 'Sign in failed.');
    }
  },

  async reloadAndVerifyEmail(): Promise<{ user: User; emailVerified: boolean }> {
    const fbUser = await requireAuthUserAsync();
    clearProfileCache();
    await fbUser.reload();
    await fbUser.getIdToken(true);
    const refreshed = auth.currentUser!;
    const user = await ensureUserProfileInFirestore(refreshed);
    return { user, emailVerified: refreshed.emailVerified };
  },

  async resendVerificationEmail(): Promise<{ message: string }> {
    const fbUser = await requireAuthUserAsync();
    await sendEmailVerification(fbUser);
    return { message: `Verification email sent to ${fbUser.email}` };
  },

  async logout(): Promise<void> {
    clearLegacyLocalStorage();
    clearProfileCache();
    await signOut(auth);
  },

  async getMe(forceRefresh = false): Promise<{ user: User }> {
    const fbUser = await requireAuthUserAsync();
    if (forceRefresh) {
      cachedUserProfiles.delete(fbUser.uid);
    }
    const user = await ensureUserProfileInFirestore(fbUser);
    return { user };
  },

  async updateProfile(updates: Partial<User>): Promise<{ user: User; message: string }> {
    const fbUser = await requireAuthUserAsync();
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
    const fbUser = await requireAuthUserAsync();
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
    const fbUser = await requireAuthUserAsync();
    const [meRes, categoriesRes, txRes, budgets, goalsRes, recRes, splitsRes, debtsRes] = await Promise.all([
      this.getMe(),
      this.getCategories(),
      this.getTransactions({ limit: 5000 }),
      fetchUserBudgetsRaw(fbUser.uid),
      this.getGoals(),
      this.getRecurring(),
      this.getSplits(),
      this.getDebts(),
    ]);

    const archive = {
      exportedAt: new Date().toISOString(),
      user: meRes.user,
      customCategories: categoriesRes.categories.filter((c) => c.userId === fbUser.uid),
      transactions: txRes.items,
      budgets,
      savingsGoals: goalsRes.goals,
      recurringPayments: recRes.recurring,
      splitExpenses: splitsRes.splits,
      debts: debtsRes.debts,
    };

    const blob = new Blob([JSON.stringify(archive, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `costcurve-ledger-${fbUser.uid.slice(0, 8)}-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  },

  async deleteAccount(): Promise<{ message: string }> {
    const fbUser = await requireAuthUserAsync();
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
    const fbUser = await requireAuthUserAsync();
    const categories = await fetchUserCategoriesRaw(fbUser.uid);
    return { categories };
  },

  async createCategory(cat: Partial<Category>): Promise<{ category: Category }> {
    const fbUser = await requireAuthUserAsync();
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
    await requireAuthUserAsync();
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
    const fbUser = await requireAuthUserAsync();
    let list = await fetchUserTransactionsRaw(fbUser.uid);

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
    const fbUser = await requireAuthUserAsync();
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
    const fbUser = await requireAuthUserAsync();
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
    await requireAuthUserAsync();
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
    await requireAuthUserAsync();
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
    await requireAuthUserAsync();
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
      message: `Imported ${count} transactions into Cloud Firestore`,
    };
  },

  // --- Budgets ---
  async getBudgets(month?: string): Promise<BudgetResponse> {
    const fbUser = await requireAuthUserAsync();
    const [{ user }, userBudgets, allTxs] = await Promise.all([
      this.getMe(),
      fetchUserBudgetsRaw(fbUser.uid),
      fetchUserTransactionsRaw(fbUser.uid),
    ]);
    return computeBudgetsResponse(user, userBudgets, allTxs, month);
  },

  async setBudget(budget: { categoryId?: string | null; amount: number; month?: string; warningThreshold?: number }): Promise<any> {
    const fbUser = await requireAuthUserAsync();
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
    await requireAuthUserAsync();
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
    const fbUser = await requireAuthUserAsync();
    const path = 'savingsGoals';
    try {
      const q = query(collection(db, path), where('userId', '==', fbUser.uid));
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
    const fbUser = await requireAuthUserAsync();
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
    await requireAuthUserAsync();
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
    await requireAuthUserAsync();
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
    const fbUser = await requireAuthUserAsync();
    const path = 'recurringPayments';
    try {
      const q = query(collection(db, path), where('userId', '==', fbUser.uid));
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
    const fbUser = await requireAuthUserAsync();
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
    const fbUser = await requireAuthUserAsync();
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
    await requireAuthUserAsync();
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
    const fbUser = await requireAuthUserAsync();
    const path = 'splitExpenses';
    try {
      const q = query(collection(db, path), where('userId', '==', fbUser.uid));
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
    const fbUser = await requireAuthUserAsync();
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
    await requireAuthUserAsync();
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
    await requireAuthUserAsync();
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
    const fbUser = await requireAuthUserAsync();
    const path = 'debts';
    try {
      const q = query(collection(db, path), where('userId', '==', fbUser.uid));
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
    const fbUser = await requireAuthUserAsync();
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
    await requireAuthUserAsync();
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
    await requireAuthUserAsync();
    const cleanId = sanitizeId(id);
    const path = `debts/${cleanId}`;
    try {
      await deleteDoc(doc(db, 'debts', cleanId));
      return { message: 'Debt removed' };
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, path);
    }
  },

  // --- Analytics, Insights & Budget Advisor (Computed from authenticated user's Firestore ledger) ---
  async getAnalytics(): Promise<AnalyticsResponse> {
    const fbUser = await requireAuthUserAsync();
    const [{ user }, allTxs, categories] = await Promise.all([
      this.getMe(),
      fetchUserTransactionsRaw(fbUser.uid),
      fetchUserCategoriesRaw(fbUser.uid),
    ]);
    return computeAnalyticsResponse(user, allTxs, categories);
  },

  async getInsights(): Promise<{ insights: FinancialInsight[]; context: any }> {
    const fbUser = await requireAuthUserAsync();
    const [{ user }, allTxs] = await Promise.all([
      this.getMe(),
      fetchUserTransactionsRaw(fbUser.uid),
    ]);
    return computeInsightsResponse(user, allTxs);
  },

  async askAI(question: string): Promise<{ answer: string; deterministicCalculation: string }> {
    const fbUser = await requireAuthUserAsync();
    const [{ user }, allTxs, categories, recRes, goalsRes, debtsRes] = await Promise.all([
      this.getMe(),
      fetchUserTransactionsRaw(fbUser.uid),
      fetchUserCategoriesRaw(fbUser.uid),
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

  // --- Owner / Admin Console Operations (Protected by Firestore `isAdmin()` Rules) ---
  async adminGetPlatformDirectory(): Promise<{
    users: User[];
    admins: AdminRecord[];
  }> {
    await requireAuthUserAsync();
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
      return mapDocToUser(d.id, data, isAdmin, isOwner, true);
    });

    users.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    return { users, admins };
  },

  async adminUpdateUserStatus(targetUserId: string, newStatus: 'active' | 'suspended'): Promise<void> {
    await requireAuthUserAsync();
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
    const fbUser = await requireAuthUserAsync();
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
    await requireAuthUserAsync();
    if (BOOTSTRAPPED_ADMIN_EMAILS.has(targetUser.email.toLowerCase())) {
      throw new Error('Cannot revoke primary platform owner privileges.');
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
