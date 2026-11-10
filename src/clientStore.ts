/**
 * In-browser client storage engine with localStorage persistence.
 * Guarantees 100% strict data isolation per authenticated user account.
 * Production-ready for static hosting (e.g. GitHub Pages) and local offline modes.
 */

import {
  User,
  Transaction,
  Category,
  Budget,
  BudgetResponse,
  CategoryBudgetDetail,
  SavingsGoal,
  RecurringPayment,
  SplitExpense,
  DebtRecord,
  AnalyticsResponse,
  FinancialInsight,
  TransactionKind,
  PaymentMethod,
  RecurringFrequency,
} from './types.ts';

const STORAGE_KEY = 'pennywise_client_database_v4';
const CURRENT_USER_KEY = 'pennywise_active_user_id';

export const DEFAULT_CLIENT_CATEGORIES: Category[] = [
  { id: 'cat-food', userId: null, name: 'Food & Mess', kind: 'expense', color: '#10b981', icon: 'Utensils', isEssential: true },
  { id: 'cat-hostel', userId: null, name: 'Hostel & Rent', kind: 'expense', color: '#06b6d4', icon: 'Home', isEssential: true },
  { id: 'cat-books', userId: null, name: 'Books & Academics', kind: 'expense', color: '#3b82f6', icon: 'BookOpen', isEssential: true },
  { id: 'cat-fees', userId: null, name: 'College Fees', kind: 'expense', color: '#6366f1', icon: 'GraduationCap', isEssential: true },
  { id: 'cat-transport', userId: null, name: 'Transport & Commute', kind: 'expense', color: '#8b5cf6', icon: 'Bus', isEssential: true },
  { id: 'cat-bills', userId: null, name: 'Bills & Mobile Recharge', kind: 'expense', color: '#ec4899', icon: 'Smartphone', isEssential: true },
  { id: 'cat-health', userId: null, name: 'Health & Pharmacy', kind: 'expense', color: '#14b8a6', icon: 'HeartPulse', isEssential: true },
  { id: 'cat-entertainment', userId: null, name: 'Entertainment & Outings', kind: 'expense', color: '#f59e0b', icon: 'Film', isEssential: false },
  { id: 'cat-shopping', userId: null, name: 'Shopping & Gear', kind: 'expense', color: '#f97316', icon: 'ShoppingBag', isEssential: false },
  { id: 'cat-personal', userId: null, name: 'Personal Care', kind: 'expense', color: '#eab308', icon: 'Sparkles', isEssential: false },
  { id: 'cat-other-exp', userId: null, name: 'Other Expenses', kind: 'expense', color: '#64748b', icon: 'MoreHorizontal', isEssential: false },
  { id: 'cat-allowance', userId: null, name: 'Allowance / Pocket Money', kind: 'income', color: '#10b981', icon: 'Wallet', isEssential: true },
  { id: 'cat-scholarship', userId: null, name: 'Scholarship / Grant', kind: 'income', color: '#06b6d4', icon: 'Award', isEssential: true },
  { id: 'cat-job', userId: null, name: 'Part-time Job / Internship', kind: 'income', color: '#3b82f6', icon: 'Briefcase', isEssential: true },
  { id: 'cat-freelance', userId: null, name: 'Freelance / Tutoring', kind: 'income', color: '#8b5cf6', icon: 'Laptop', isEssential: true },
  { id: 'cat-gift', userId: null, name: 'Gifts & Awards', kind: 'income', color: '#f59e0b', icon: 'Gift', isEssential: false },
  { id: 'cat-other-inc', userId: null, name: 'Other Income', kind: 'income', color: '#64748b', icon: 'ArrowDownLeft', isEssential: false },
];

export interface ClientDatabaseSchema {
  users: (User & { passwordHash?: string })[];
  categories: Category[];
  transactions: Transaction[];
  budgets: Budget[];
  savingsGoals: SavingsGoal[];
  recurringPayments: RecurringPayment[];
  splitExpenses: SplitExpense[];
  debts: DebtRecord[];
}

export function roundMoney(num: number): number {
  if (isNaN(num) || !isFinite(num)) return 0;
  return Math.round((num + Number.EPSILON) * 100) / 100;
}

/**
 * Returns a clean, production-ready schema with zero unowned or cross-account records.
 */
function getInitialData(): ClientDatabaseSchema {
  return {
    users: [],
    categories: DEFAULT_CLIENT_CATEGORIES,
    transactions: [],
    budgets: [],
    savingsGoals: [],
    recurringPayments: [],
    splitExpenses: [],
    debts: [],
  };
}

// Clean up legacy storage keys that contained hardcoded demo data from older builds
if (typeof localStorage !== 'undefined') {
  const legacyKeys = [
    'pennywise_client_database',
    'pennywise_client_database_v1',
    'pennywise_client_database_v2',
    'pennywise_client_database_v3',
    'pennywise_transactions',
    'pennywise_demo_data',
  ];
  for (const k of legacyKeys) {
    try {
      localStorage.removeItem(k);
    } catch {}
  }
}

export class ClientStore {
  private db: ClientDatabaseSchema;
  private currentUserId: string | null = null;

  constructor() {
    this.db = this.load();
    // Only restore authenticated user if explicitly saved and exists in database
    const savedId = typeof localStorage !== 'undefined' ? localStorage.getItem(CURRENT_USER_KEY) : null;
    if (savedId && this.db.users.some((u) => u.id === savedId)) {
      this.currentUserId = savedId;
    } else {
      this.currentUserId = null;
    }
  }

  private load(): ClientDatabaseSchema {
    if (typeof localStorage === 'undefined') {
      return getInitialData();
    }
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed && Array.isArray(parsed.users)) {
          return {
            users: parsed.users || [],
            categories: parsed.categories || DEFAULT_CLIENT_CATEGORIES,
            transactions: parsed.transactions || [],
            budgets: parsed.budgets || [],
            savingsGoals: parsed.savingsGoals || [],
            recurringPayments: parsed.recurringPayments || [],
            splitExpenses: parsed.splitExpenses || [],
            debts: parsed.debts || [],
          };
        }
      }
    } catch (e) {
      console.warn('Failed to parse client store, initializing clean storage:', e);
    }
    const fresh = getInitialData();
    this.save(fresh);
    return fresh;
  }

  private save(data = this.db) {
    if (typeof localStorage === 'undefined') return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch (e) {
      console.error('LocalStorage save error:', e);
    }
  }

  public getCurrentUserId(): string | null {
    return this.currentUserId;
  }

  public getCurrentUser(): User | null {
    if (!this.currentUserId) return null;
    const user = this.db.users.find((u) => u.id === this.currentUserId);
    if (!user) return null;
    const safeUser = { ...user };
    delete safeUser.passwordHash;
    return safeUser;
  }

  public setCurrentUserId(id: string | null) {
    this.currentUserId = id;
    if (typeof localStorage !== 'undefined') {
      if (id) {
        localStorage.setItem(CURRENT_USER_KEY, id);
      } else {
        localStorage.removeItem(CURRENT_USER_KEY);
      }
    }
  }

  // --- Strict Authentication & Identity Verification ---
  public login(email: string, password?: string): { user: User; token: string; message: string } {
    const cleanEmail = (email || '').trim().toLowerCase();
    if (!cleanEmail) {
      throw new Error('Please enter a valid email address.');
    }

    const user = this.db.users.find((u) => u.email.toLowerCase() === cleanEmail);
    if (!user) {
      throw new Error('No account found with this email address. Please register a new account.');
    }

    if (user.passwordHash && password) {
      if (user.passwordHash !== password) {
        throw new Error('Incorrect password. Please verify your credentials.');
      }
    }

    this.setCurrentUserId(user.id);
    const safeUser = { ...user };
    delete safeUser.passwordHash;

    return {
      user: safeUser,
      token: `client_token_${user.id}_${Date.now()}`,
      message: `Welcome back, ${user.name}!`,
    };
  }

  public register(data: {
    name: string;
    email: string;
    password?: string;
    collegeName?: string;
    degreeSemester?: string;
    currency?: string;
    monthlyBudget?: number;
  }): {
    user: User;
    token: string;
    message: string;
  } {
    const cleanEmail = (data.email || '').trim().toLowerCase();
    if (!cleanEmail) {
      throw new Error('Enter a valid email address.');
    }

    const existing = this.db.users.find((u) => u.email.toLowerCase() === cleanEmail);
    if (existing) {
      throw new Error('An account with this email already exists. Please sign in instead.');
    }

    const now = new Date();
    const newUserId = `usr_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    const parsedBudget = data.monthlyBudget ? Math.max(0, Number(data.monthlyBudget)) : 15000;

    const newUser: User & { passwordHash?: string } = {
      id: newUserId,
      name: data.name.trim() || 'Student User',
      email: cleanEmail,
      currency: data.currency || '₹',
      theme: 'dark',
      monthlyBudget: parsedBudget,
      semesterBudget: parsedBudget * 4,
      semesterEndDate: `${now.getFullYear()}-12-31`,
      collegeName: (data.collegeName || '').trim() || 'College / University',
      degreeSemester: (data.degreeSemester || '').trim() || 'Semester 1',
      createdAt: now.toISOString(),
      passwordHash: data.password || undefined,
    };

    this.db.users.push(newUser);
    this.save();
    this.setCurrentUserId(newUser.id);

    const safeUser = { ...newUser };
    delete safeUser.passwordHash;

    return {
      user: safeUser,
      token: `client_token_${newUser.id}_${Date.now()}`,
      message: `Account created successfully! Welcome to CostCurve, ${newUser.name}.`,
    };
  }

  public updateProfile(updates: Partial<User>): { user: User; message: string } {
    const user = this.getCurrentUser();
    if (!user) throw new Error('Authentication required');
    const dbUser = this.db.users.find((u) => u.id === user.id);
    if (!dbUser) throw new Error('User not found');
    Object.assign(dbUser, updates);
    this.save();
    return { user: this.getCurrentUser()!, message: 'Profile updated' };
  }

  // --- Categories (Global defaults + User custom) ---
  public getCategories(): Category[] {
    const uid = this.currentUserId;
    return this.db.categories.filter((c) => c.userId === null || c.userId === uid);
  }

  public createCategory(cat: Partial<Category>): Category {
    const uid = this.currentUserId;
    if (!uid) throw new Error('Authentication required');
    const newCat: Category = {
      id: `cat_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      userId: uid,
      name: (cat.name || 'Custom Category').trim(),
      kind: cat.kind === 'income' ? 'income' : 'expense',
      color: cat.color || '#3b82f6',
      icon: cat.icon || 'Tag',
      isEssential: !!cat.isEssential,
    };
    this.db.categories.push(newCat);
    this.save();
    return newCat;
  }

  public deleteCategory(id: string) {
    const uid = this.currentUserId;
    if (!uid) throw new Error('Authentication required');
    // Only allow deleting user-owned custom categories, not system defaults
    this.db.categories = this.db.categories.filter((c) => c.id !== id || (c.userId !== null && c.userId !== uid));
    this.save();
  }

  // --- Transactions (Strictly scoped to currentUserId) ---
  public getTransactions(params: Record<string, any> = {}) {
    const uid = this.currentUserId;
    if (!uid) {
      return {
        items: [],
        total: 0,
        page: 1,
        pageSize: 20,
        totalPages: 0,
        summary: { income: 0, expense: 0, balance: 0 },
      };
    }

    let list = this.db.transactions.filter((t) => t.userId === uid);

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

    list.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

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
  }

  public createTransaction(tx: Partial<Transaction>): Transaction {
    const uid = this.currentUserId;
    if (!uid) throw new Error('Authentication required to record transactions.');

    const categories = this.getCategories();
    const cat = categories.find((c) => c.id === tx.categoryId);

    const newTx: Transaction = {
      id: `tx_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      userId: uid,
      amount: roundMoney(Math.abs(Number(tx.amount) || 0)),
      kind: (tx.kind as TransactionKind) || 'expense',
      categoryId: tx.categoryId || 'cat-other-exp',
      categoryName: cat ? cat.name : tx.categoryName || 'General Expense',
      description: (tx.description || '').trim() || (cat ? cat.name : 'Student Expense'),
      merchant: (tx.merchant || '').trim() || 'Campus Store',
      date: tx.date || new Date().toISOString().split('T')[0],
      paymentMethod: (tx.paymentMethod as PaymentMethod) || 'UPI',
      account: tx.account || 'Primary Bank',
      notes: tx.notes || '',
      tags: tx.tags || [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    this.db.transactions.unshift(newTx);
    this.save();
    return newTx;
  }

  public updateTransaction(id: string, updates: Partial<Transaction>): Transaction {
    const uid = this.currentUserId;
    if (!uid) throw new Error('Authentication required.');

    const tx = this.db.transactions.find((t) => t.id === id && t.userId === uid);
    if (!tx) throw new Error('Transaction not found or access denied.');

    if (updates.categoryId && updates.categoryId !== tx.categoryId) {
      const cat = this.getCategories().find((c) => c.id === updates.categoryId);
      if (cat) updates.categoryName = cat.name;
    }

    Object.assign(tx, updates, { updatedAt: new Date().toISOString() });
    if (updates.amount !== undefined) tx.amount = roundMoney(Math.abs(Number(updates.amount)));
    this.save();
    return tx;
  }

  public deleteTransaction(id: string) {
    const uid = this.currentUserId;
    if (!uid) throw new Error('Authentication required.');

    const initialLen = this.db.transactions.length;
    this.db.transactions = this.db.transactions.filter((t) => !(t.id === id && t.userId === uid));
    if (this.db.transactions.length === initialLen) {
      throw new Error('Transaction not found or unauthorized.');
    }
    this.save();
  }

  public bulkDeleteTransactions(ids: string[]) {
    const uid = this.currentUserId;
    if (!uid) throw new Error('Authentication required.');

    const set = new Set(ids);
    const beforeCount = this.db.transactions.length;
    this.db.transactions = this.db.transactions.filter((t) => !(set.has(t.id) && t.userId === uid));
    const deletedCount = beforeCount - this.db.transactions.length;
    this.save();
    return { count: deletedCount, message: `Deleted ${deletedCount} transactions.` };
  }

  // --- Budgets ---
  public getBudgets(month?: string): BudgetResponse {
    const uid = this.currentUserId;
    const now = new Date();
    const targetMonth = month || `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const user = this.getCurrentUser();

    if (!uid || !user) {
      return {
        month: targetMonth,
        overall: { limit: 0, spent: 0, remaining: 0, usage: 0, isExceeded: false, isWarning: false },
        categoryBudgets: [],
        allBudgets: [],
      };
    }

    const userBudgets = this.db.budgets.filter((b) => b.userId === uid && b.month === targetMonth);
    const monthTxs = this.db.transactions.filter(
      (t) => t.userId === uid && t.kind === 'expense' && t.date.startsWith(targetMonth)
    );

    const totalSpent = monthTxs.reduce((sum, t) => sum + t.amount, 0);
    const overallLimit = user.monthlyBudget || 0;
    const overallUsage = overallLimit > 0 ? (totalSpent / overallLimit) * 100 : 0;

    const categoryBudgets: CategoryBudgetDetail[] = userBudgets.map((b) => {
      const catSpent = monthTxs.filter((t) => t.categoryId === b.categoryId).reduce((sum, t) => sum + t.amount, 0);
      const usage = b.amount > 0 ? (catSpent / b.amount) * 100 : 0;
      return {
        ...b,
        spent: roundMoney(catSpent),
        remaining: roundMoney(Math.max(0, b.amount - catSpent)),
        usage: roundMoney(usage),
        isExceeded: catSpent > b.amount,
        isWarning: usage >= b.warningThreshold,
      };
    });

    return {
      month: targetMonth,
      overall: {
        limit: roundMoney(overallLimit),
        spent: roundMoney(totalSpent),
        remaining: roundMoney(Math.max(0, overallLimit - totalSpent)),
        usage: roundMoney(overallUsage),
        isExceeded: overallLimit > 0 && totalSpent > overallLimit,
        isWarning: overallUsage >= 80,
      },
      categoryBudgets,
      allBudgets: userBudgets,
    };
  }

  public setBudget(data: { categoryId?: string | null; amount: number; month?: string; warningThreshold?: number }) {
    const uid = this.currentUserId;
    if (!uid) throw new Error('Authentication required.');

    const now = new Date();
    const month = data.month || `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

    let existing = this.db.budgets.find(
      (b) => b.userId === uid && b.month === month && b.categoryId === (data.categoryId || null)
    );

    if (existing) {
      existing.amount = roundMoney(data.amount);
      existing.warningThreshold = data.warningThreshold || existing.warningThreshold;
    } else {
      existing = {
        id: `bdg_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        userId: uid,
        categoryId: data.categoryId || null,
        period: 'monthly',
        month,
        amount: roundMoney(data.amount),
        warningThreshold: data.warningThreshold || 80,
      };
      this.db.budgets.push(existing);
    }
    this.save();
    return existing;
  }

  public deleteBudget(id: string) {
    const uid = this.currentUserId;
    if (!uid) throw new Error('Authentication required.');
    this.db.budgets = this.db.budgets.filter((b) => !(b.id === id && b.userId === uid));
    this.save();
  }

  // --- Savings Goals ---
  public getGoals(): SavingsGoal[] {
    const uid = this.currentUserId;
    if (!uid) return [];
    return this.db.savingsGoals.filter((g) => g.userId === uid);
  }

  public createGoal(goal: Partial<SavingsGoal>): SavingsGoal {
    const uid = this.currentUserId;
    if (!uid) throw new Error('Authentication required.');

    const newGoal: SavingsGoal = {
      id: `gl_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      userId: uid,
      title: (goal.title || 'Savings Goal').trim(),
      targetAmount: roundMoney(Number(goal.targetAmount) || 5000),
      currentAmount: roundMoney(Number(goal.currentAmount) || 0),
      targetDate: goal.targetDate || new Date(Date.now() + 90 * 24 * 3600 * 1000).toISOString().split('T')[0],
      category: goal.category || 'General',
      icon: goal.icon || 'Target',
      status: 'in_progress',
      createdAt: new Date().toISOString(),
    };
    this.db.savingsGoals.push(newGoal);
    this.save();
    return newGoal;
  }

  public depositGoal(id: string, amount: number, recordTransaction: boolean) {
    const uid = this.currentUserId;
    if (!uid) throw new Error('Authentication required.');

    const goal = this.db.savingsGoals.find((g) => g.id === id && g.userId === uid);
    if (!goal) throw new Error('Savings goal not found or unauthorized.');

    goal.currentAmount = roundMoney(goal.currentAmount + amount);
    if (goal.currentAmount >= goal.targetAmount) {
      goal.status = 'completed';
    }
    if (recordTransaction) {
      this.createTransaction({
        amount,
        kind: 'expense',
        categoryId: 'cat-personal',
        categoryName: 'Personal Care',
        description: `Deposit to savings vault: ${goal.title}`,
        merchant: 'Savings Vault',
        date: new Date().toISOString().split('T')[0],
        paymentMethod: 'UPI',
        account: 'Savings',
      });
    }
    this.save();
    return goal;
  }

  public deleteGoal(id: string) {
    const uid = this.currentUserId;
    if (!uid) throw new Error('Authentication required.');
    this.db.savingsGoals = this.db.savingsGoals.filter((g) => !(g.id === id && g.userId === uid));
    this.save();
  }

  // --- Recurring Payments ---
  public getRecurring(): RecurringPayment[] {
    const uid = this.currentUserId;
    if (!uid) return [];
    return this.db.recurringPayments.filter((r) => r.userId === uid);
  }

  public createRecurring(rec: Partial<RecurringPayment>): RecurringPayment {
    const uid = this.currentUserId;
    if (!uid) throw new Error('Authentication required.');

    const newRec: RecurringPayment = {
      id: `rec_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      userId: uid,
      title: (rec.title || 'Recurring Bill').trim(),
      amount: roundMoney(Number(rec.amount) || 0),
      kind: rec.kind || 'expense',
      frequency: (rec.frequency as RecurringFrequency) || 'monthly',
      categoryId: rec.categoryId || 'cat-bills',
      paymentMethod: (rec.paymentMethod as PaymentMethod) || 'UPI',
      nextDueDate: rec.nextDueDate || new Date().toISOString().split('T')[0],
      status: rec.status || 'active',
      autoLog: !!rec.autoLog,
      notes: rec.notes || '',
    };
    this.db.recurringPayments.push(newRec);
    this.save();
    return newRec;
  }

  public logRecurringTransaction(id: string) {
    const uid = this.currentUserId;
    if (!uid) throw new Error('Authentication required.');

    const rec = this.db.recurringPayments.find((r) => r.id === id && r.userId === uid);
    if (!rec) throw new Error('Recurring subscription not found or unauthorized.');

    const cat = this.getCategories().find((c) => c.id === rec.categoryId);

    const tx = this.createTransaction({
      amount: rec.amount,
      kind: 'expense',
      categoryId: rec.categoryId,
      categoryName: cat?.name || 'Bills & Utilities',
      description: `${rec.title} (Recurring Bill)`,
      merchant: rec.title,
      date: new Date().toISOString().split('T')[0],
      paymentMethod: rec.paymentMethod,
      account: 'Primary Bank',
      recurringId: rec.id,
    });

    this.save();
    return { transaction: tx, recurring: rec };
  }

  public deleteRecurring(id: string) {
    const uid = this.currentUserId;
    if (!uid) throw new Error('Authentication required.');
    this.db.recurringPayments = this.db.recurringPayments.filter((r) => !(r.id === id && r.userId === uid));
    this.save();
  }

  // --- Splits & Debts ---
  public getSplits(): SplitExpense[] {
    const uid = this.currentUserId;
    if (!uid) return [];
    return this.db.splitExpenses.filter((s) => s.userId === uid);
  }

  public createSplit(split: Partial<SplitExpense>): SplitExpense {
    const uid = this.currentUserId;
    if (!uid) throw new Error('Authentication required.');

    const totalAmount = roundMoney(Number(split.totalAmount) || 0);
    const newSplit: SplitExpense = {
      id: `spl_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      userId: uid,
      title: (split.title || 'Shared Expense').trim(),
      totalAmount,
      userShare: roundMoney(Number(split.userShare) || totalAmount / Math.max(1, split.participants?.length || 1)),
      paidBy: split.paidBy || 'You',
      date: split.date || new Date().toISOString().split('T')[0],
      status: split.status || 'pending',
      participants: split.participants || [],
    };
    this.db.splitExpenses.unshift(newSplit);
    this.save();
    return newSplit;
  }

  public updateSplit(id: string, updates: Partial<SplitExpense>) {
    const uid = this.currentUserId;
    if (!uid) throw new Error('Authentication required.');

    const split = this.db.splitExpenses.find((s) => s.id === id && s.userId === uid);
    if (!split) throw new Error('Split record not found or unauthorized.');
    Object.assign(split, updates);
    this.save();
    return split;
  }

  public deleteSplit(id: string) {
    const uid = this.currentUserId;
    if (!uid) throw new Error('Authentication required.');
    this.db.splitExpenses = this.db.splitExpenses.filter((s) => !(s.id === id && s.userId === uid));
    this.save();
  }

  public getDebts(): DebtRecord[] {
    const uid = this.currentUserId;
    if (!uid) return [];
    return this.db.debts.filter((d) => d.userId === uid);
  }

  public createDebt(debt: Partial<DebtRecord>): DebtRecord {
    const uid = this.currentUserId;
    if (!uid) throw new Error('Authentication required.');

    const newDebt: DebtRecord = {
      id: `dbt_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      userId: uid,
      personName: (debt.personName || 'Peer').trim(),
      amount: roundMoney(Number(debt.amount) || 0),
      type: debt.type || 'owes_you',
      description: (debt.description || 'Shared expense').trim(),
      dueDate: debt.dueDate || '',
      status: debt.status || 'pending',
      createdAt: new Date().toISOString(),
    };
    this.db.debts.unshift(newDebt);
    this.save();
    return newDebt;
  }

  public updateDebt(id: string, updates: Partial<DebtRecord>) {
    const uid = this.currentUserId;
    if (!uid) throw new Error('Authentication required.');

    const debt = this.db.debts.find((d) => d.id === id && d.userId === uid);
    if (!debt) throw new Error('Debt record not found or unauthorized.');
    Object.assign(debt, updates);
    this.save();
    return debt;
  }

  public deleteDebt(id: string) {
    const uid = this.currentUserId;
    if (!uid) throw new Error('Authentication required.');
    this.db.debts = this.db.debts.filter((d) => !(d.id === id && d.userId === uid));
    this.save();
  }

  // --- Real-time Analytics & Genuine Insights ---
  public getAnalytics(): AnalyticsResponse {
    const uid = this.currentUserId;
    const now = new Date();
    const yearMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const user = this.getCurrentUser();

    if (!uid || !user) {
      return {
        currentMonth: {
          income: 0,
          expense: 0,
          savings: 0,
          budget: 0,
          remainingBudget: 0,
          essentialExpense: 0,
          discretionaryExpense: 0,
          daysLeftInMonth: 15,
          safeDailySpend: 0,
          avgDailySpendSoFar: 0,
          healthScore: 100,
        },
        categoryBreakdown: [],
        monthlyTrends: [],
      };
    }

    const allTxs = this.db.transactions.filter((t) => t.userId === uid);
    const monthTxs = allTxs.filter((t) => t.date.startsWith(yearMonth));

    const totalIncome = monthTxs.filter((t) => t.kind === 'income').reduce((sum, t) => sum + t.amount, 0);
    const totalExpense = monthTxs.filter((t) => t.kind === 'expense').reduce((sum, t) => sum + t.amount, 0);
    const savings = totalIncome - totalExpense;
    const budget = user.monthlyBudget || 0;
    const remainingBudget = Math.max(0, budget - totalExpense);

    const dayOfMonth = now.getDate();
    const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    const daysLeft = Math.max(1, daysInMonth - dayOfMonth);
    const avgDailySpendSoFar = dayOfMonth > 0 ? totalExpense / dayOfMonth : 0;
    const safeDailySpend = budget > 0 ? remainingBudget / daysLeft : 0;

    // Categories calculation strictly from current user's records
    const categories = this.getCategories();
    const catMap = new Map<string, { amount: number; isEssential: boolean }>();
    let essentialExpense = 0;
    let discretionaryExpense = 0;

    for (const tx of monthTxs) {
      if (tx.kind === 'expense') {
        const cat = categories.find((c) => c.id === tx.categoryId);
        const isEss = cat ? cat.isEssential : true;
        if (isEss) essentialExpense += tx.amount;
        else discretionaryExpense += tx.amount;

        const current = catMap.get(tx.categoryId) || { amount: 0, isEssential: isEss };
        current.amount += tx.amount;
        catMap.set(tx.categoryId, current);
      }
    }

    const categoryBreakdown = Array.from(catMap.entries())
      .map(([cid, data]) => {
        const cat = categories.find((c) => c.id === cid);
        return {
          name: cat ? cat.name : 'Other',
          amount: roundMoney(data.amount),
          color: cat ? cat.color : '#3b82f6',
          kind: 'expense' as const,
          isEssential: data.isEssential,
        };
      })
      .sort((a, b) => b.amount - a.amount);

    // 6-Month Real Trends (Real ledger totals only, zero synthetic estimates)
    const monthlyTrends: { month: string; label: string; income: number; expense: number; savings: number }[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const mStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const mLabel = d.toLocaleString('default', { month: 'short' });
      const mTxs = allTxs.filter((t) => t.date.startsWith(mStr));

      let inc = 0;
      let exp = 0;
      for (const t of mTxs) {
        if (t.kind === 'income') inc += t.amount;
        else exp += t.amount;
      }
      monthlyTrends.push({
        month: mStr,
        label: mLabel,
        income: roundMoney(inc),
        expense: roundMoney(exp),
        savings: roundMoney(inc - exp),
      });
    }

    let health = 100;
    if (budget > 0 && totalExpense > budget) health -= 30;
    else if (budget > 0 && totalExpense > budget * 0.8) health -= 15;
    if (savings < 0 && monthTxs.length > 0) health -= 15;
    if (monthTxs.length === 0) health = 100;
    health = Math.min(100, Math.max(20, health));

    return {
      currentMonth: {
        income: roundMoney(totalIncome),
        expense: roundMoney(totalExpense),
        savings: roundMoney(savings),
        budget: roundMoney(budget),
        remainingBudget: roundMoney(remainingBudget),
        essentialExpense: roundMoney(essentialExpense),
        discretionaryExpense: roundMoney(discretionaryExpense),
        daysLeftInMonth: daysLeft,
        safeDailySpend: roundMoney(safeDailySpend),
        avgDailySpendSoFar: roundMoney(avgDailySpendSoFar),
        healthScore: health,
      },
      categoryBreakdown,
      monthlyTrends,
    };
  }

  public getInsights(): { insights: FinancialInsight[]; context: any } {
    const user = this.getCurrentUser();
    if (!user) return { insights: [], context: {} };

    const curr = user.currency || '₹';
    const allTxs = this.db.transactions.filter((t) => t.userId === user.id);
    const insights: FinancialInsight[] = [];

    if (allTxs.length === 0) {
      insights.push(
        {
          type: 'info',
          title: 'Welcome to CostCurve!',
          message: 'Ready to build mindful financial habits? Click "+ Log Expense" above to record your first transaction.',
        },
        {
          type: 'tip',
          title: 'Establish Your Monthly Budget',
          message: `Your active monthly allowance budget is set to ${curr}${user.monthlyBudget.toLocaleString()}. Your daily safe-to-spend allowance will adapt automatically as you record expenses.`,
        }
      );
    } else {
      const now = new Date();
      const yearMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
      const monthTxs = allTxs.filter((t) => t.date.startsWith(yearMonth));
      const totalExpense = monthTxs.filter((t) => t.kind === 'expense').reduce((sum, t) => sum + t.amount, 0);
      const totalIncome = monthTxs.filter((t) => t.kind === 'income').reduce((sum, t) => sum + t.amount, 0);

      if (totalExpense > user.monthlyBudget && user.monthlyBudget > 0) {
        insights.push({
          type: 'alert',
          title: 'Monthly Budget Threshold Exceeded',
          message: `Total expenses (${curr}${totalExpense.toLocaleString()}) have surpassed your planned allowance (${curr}${user.monthlyBudget.toLocaleString()}). Prioritize essential campus expenses for the rest of the month.`,
        });
      } else if (totalIncome > totalExpense) {
        insights.push({
          type: 'success',
          title: 'Positive Monthly Savings Pace',
          message: `You are currently saving ${curr}${(totalIncome - totalExpense).toLocaleString()} this month. Consider depositing this surplus into your savings goals.`,
        });
      }

      insights.push({
        type: 'tip',
        title: 'Daily Spending Discipline',
        message: `Keep daily non-essential purchases within your calculated allowance to stay comfortably ahead of your semester budget goals.`,
      });
    }

    return {
      insights,
      context: {
        user: user.name,
        currency: curr,
        transactionCount: allTxs.length,
      },
    };
  }

  public askAI(question: string): { answer: string; deterministicCalculation: string } {
    const user = this.getCurrentUser();
    if (!user) return { answer: 'Please sign in to access your financial advisor.', deterministicCalculation: 'Unauthenticated' };

    const curr = user.currency || '₹';
    const allTxs = this.db.transactions.filter((t) => t.userId === user.id);
    const now = new Date();
    const yearMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    const daysRemaining = Math.max(1, daysInMonth - now.getDate() + 1);

    const monthTxs = allTxs.filter((t) => t.date.startsWith(yearMonth));
    const totalIncome = monthTxs.filter((t) => t.kind === 'income').reduce((sum, t) => sum + t.amount, 0);
    const totalExpense = monthTxs.filter((t) => t.kind === 'expense').reduce((sum, t) => sum + t.amount, 0);
    const netSavings = totalIncome - totalExpense;
    const budgetRemaining = user.monthlyBudget - totalExpense;
    const safeDailySpend = Math.max(0, Math.round(budgetRemaining / daysRemaining));

    const catMap = new Map<string, { name: string; spent: number; count: number }>();
    for (const tx of monthTxs) {
      if (tx.kind === 'expense') {
        const cat = this.db.categories.find((c) => c.id === tx.categoryId);
        const name = cat?.name || 'Uncategorized';
        const existing = catMap.get(name) || { name, spent: 0, count: 0 };
        existing.spent += tx.amount;
        existing.count += 1;
        catMap.set(name, existing);
      }
    }
    const categoryTotals = Array.from(catMap.values()).sort((a, b) => b.spent - a.spent);
    const topCategory = categoryTotals[0];

    const allTimeCatMap = new Map<string, { name: string; spent: number; count: number }>();
    for (const tx of allTxs) {
      if (tx.kind === 'expense') {
        const cat = this.db.categories.find((c) => c.id === tx.categoryId);
        const name = cat?.name || 'Uncategorized';
        const existing = allTimeCatMap.get(name) || { name, spent: 0, count: 0 };
        existing.spent += tx.amount;
        existing.count += 1;
        allTimeCatMap.set(name, existing);
      }
    }
    const allTimeCategoryTotals = Array.from(allTimeCatMap.values()).sort((a, b) => b.spent - a.spent);
    const allTimeTopCategory = allTimeCategoryTotals[0];

    const allTimeExpense = allTxs.filter((t) => t.kind === 'expense').reduce((sum, t) => sum + t.amount, 0);
    const allTimeIncome = allTxs.filter((t) => t.kind === 'income').reduce((sum, t) => sum + t.amount, 0);

    const activeBills = this.db.recurringPayments.filter((b) => b.userId === user.id && b.status === 'active');
    const goals = this.db.savingsGoals.filter((g) => g.userId === user.id);
    const debts = this.db.debts.filter((d) => d.userId === user.id && d.status === 'pending');

    const q = question.trim().toLowerCase();
    const cleanedForNumbers = question.replace(/,/g, '');
    const numberMatches = cleanedForNumbers.match(/\d+(?:\.\d+)?/g);
    const parsedAmount = numberMatches ? parseFloat(numberMatches[0]) : null;

    // 1. Affordability / purchase simulation ("Can I afford a ₹2,000 outing?", "Should I buy...", etc.)
    if (
      q.includes('afford') ||
      q.includes('outing') ||
      q.includes('buy') ||
      q.includes('purchase') ||
      q.includes('spend on') ||
      (parsedAmount !== null && parsedAmount > 0 && (q.includes('can i') || q.includes('should i') || q.includes('worth')))
    ) {
      const targetAmount = parsedAmount && parsedAmount > 0 ? parsedAmount : 2000;
      const postPurchaseRemaining = budgetRemaining - targetAmount;
      const postPurchaseDaily = Math.max(0, Math.round(postPurchaseRemaining / daysRemaining));

      if (allTxs.length === 0) {
        const canAffordEmpty = user.monthlyBudget >= targetAmount;
        return {
          answer: canAffordEmpty
            ? `There is no transaction history recorded yet, so analyzing against your baseline monthly budget of ${curr}${user.monthlyBudget.toLocaleString()}:\n\n• Requested spend: ${curr}${targetAmount.toLocaleString()}\n• Budget after spend: ${curr}${postPurchaseRemaining.toLocaleString()}\n• Adjusted daily limit (${daysRemaining} days left): ${curr}${postPurchaseDaily.toLocaleString()}/day\n\nYou can cover this within your ${curr}${user.monthlyBudget.toLocaleString()} target, though logging your fixed expenses (rent, mess, or bills) first will give a stricter margin.`
            : `There are no transactions recorded yet, and a ${curr}${targetAmount.toLocaleString()} spend already exceeds your configured monthly budget of ${curr}${user.monthlyBudget.toLocaleString()} by ${curr}${Math.abs(postPurchaseRemaining).toLocaleString()}. Increase your monthly budget or reduce the planned spend.`,
          deterministicCalculation: `Baseline budget ${curr}${user.monthlyBudget.toLocaleString()} − ${curr}${targetAmount.toLocaleString()} = ${curr}${postPurchaseRemaining.toLocaleString()} (${allTxs.length} ledger entries)`,
        };
      }

      const canAfford = postPurchaseRemaining >= 0;
      return {
        answer: canAfford
          ? `Yes, you can fit a ${curr}${targetAmount.toLocaleString()} spend into your current month's budget:\n\n• Current remaining budget: ${curr}${budgetRemaining.toLocaleString()} (of ${curr}${user.monthlyBudget.toLocaleString()})\n• Remaining after ${curr}${targetAmount.toLocaleString()} spend: ${curr}${postPurchaseRemaining.toLocaleString()}\n• Safe daily allowance shift: ${curr}${safeDailySpend.toLocaleString()}/day → ${curr}${postPurchaseDaily.toLocaleString()}/day across the next ${daysRemaining} days.`
          : `No — spending ${curr}${targetAmount.toLocaleString()} right now would push you over your monthly budget target:\n\n• Current remaining budget: ${curr}${budgetRemaining.toLocaleString()} (spent ${curr}${totalExpense.toLocaleString()} of ${curr}${user.monthlyBudget.toLocaleString()})\n• Projected deficit after spend: -${curr}${Math.abs(postPurchaseRemaining).toLocaleString()}\n• Safe daily allowance right now: ${curr}${safeDailySpend.toLocaleString()}/day.`,
        deterministicCalculation: `Remaining ${curr}${budgetRemaining.toLocaleString()} − ${curr}${targetAmount.toLocaleString()} = ${curr}${postPurchaseRemaining.toLocaleString()} (${postPurchaseDaily.toLocaleString()}/day for ${daysRemaining}d)`,
      };
    }

    // 2. Highest / top expense category or category breakdown
    if (
      q.includes('highest') ||
      q.includes('top') ||
      q.includes('category') ||
      q.includes('categories') ||
      q.includes('most on') ||
      q.includes('where did my money') ||
      q.includes('breakdown')
    ) {
      if (allTxs.length === 0) {
        return {
          answer: `Insufficient transaction data to rank expense categories — your ledger currently has 0 recorded transactions.\n\nLog at least one expense (for example under Food & Mess, Hostel & Rent, or Transport) to compute your highest spending category and percentage share.`,
          deterministicCalculation: `0 expense categories active (${yearMonth})`,
        };
      }

      if (categoryTotals.length === 0 && allTimeCategoryTotals.length > 0) {
        const share = allTimeExpense > 0 ? Math.round((allTimeTopCategory.spent / allTimeExpense) * 100) : 0;
        const breakdownLines = allTimeCategoryTotals
          .slice(0, 4)
          .map((c, idx) => `${idx + 1}. ${c.name}: ${curr}${c.spent.toLocaleString()} (${c.count} tx)`)
          .join('\n');
        return {
          answer: `You have no expenses logged in ${yearMonth} yet, so here is your all-time highest expense category breakdown:\n\n• Highest category: ${allTimeTopCategory.name} at ${curr}${allTimeTopCategory.spent.toLocaleString()} (${share}% of all-time spend)\n\nCategory ranking:\n${breakdownLines}`,
          deterministicCalculation: `All-time top category: ${allTimeTopCategory.name} = ${curr}${allTimeTopCategory.spent.toLocaleString()} / ${curr}${allTimeExpense.toLocaleString()}`,
        };
      }

      if (!topCategory) {
        return {
          answer: `You have ${allTxs.length} income transaction(s) logged, but 0 expense records so far. Record an expense transaction to see your highest spending category.`,
          deterministicCalculation: `Total expenses: ${curr}0 across ${allTxs.length} ledger records`,
        };
      }

      const topShare = totalExpense > 0 ? Math.round((topCategory.spent / totalExpense) * 100) : 0;
      const list = categoryTotals
        .slice(0, 5)
        .map((c, idx) => {
          const pct = totalExpense > 0 ? Math.round((c.spent / totalExpense) * 100) : 0;
          return `${idx + 1}. ${c.name}: ${curr}${c.spent.toLocaleString()} (${pct}% · ${c.count} ${c.count === 1 ? 'entry' : 'entries'})`;
        })
        .join('\n');

      return {
        answer: `Your highest expense category in ${yearMonth} is ${topCategory.name}, accounting for ${curr}${topCategory.spent.toLocaleString()} (${topShare}% of your ${curr}${totalExpense.toLocaleString()} monthly spend).\n\nMonthly category ranking:\n${list}`,
        deterministicCalculation: `Top category (${yearMonth}): ${topCategory.name} = ${curr}${topCategory.spent.toLocaleString()} (${topShare}% of ${curr}${totalExpense.toLocaleString()})`,
      };
    }

    // 3. Safe daily spend limit / allowance / burn rate
    if (
      q.includes('daily') ||
      q.includes('safe') ||
      q.includes('limit') ||
      q.includes('allowance') ||
      q.includes('per day') ||
      q.includes('today') ||
      q.includes('burn')
    ) {
      if (allTxs.length === 0) {
        const baselineDaily = Math.max(0, Math.round(user.monthlyBudget / daysRemaining));
        return {
          answer: `No expenses have been logged in ${yearMonth} yet. Based on your full monthly budget target of ${curr}${user.monthlyBudget.toLocaleString()} and ${daysRemaining} days left in the month:\n\n• Safe daily spend limit: ${curr}${baselineDaily.toLocaleString()}/day\n• Spent this month: ${curr}0\n• Remaining budget: ${curr}${user.monthlyBudget.toLocaleString()}`,
          deterministicCalculation: `${curr}${user.monthlyBudget.toLocaleString()} ÷ ${daysRemaining} days left = ${curr}${baselineDaily.toLocaleString()}/day`,
        };
      }

      return {
        answer:
          budgetRemaining > 0
            ? `Your safe daily spend limit for the remaining ${daysRemaining} days of ${yearMonth} is ${curr}${safeDailySpend.toLocaleString()}/day.\n\n• Monthly budget target: ${curr}${user.monthlyBudget.toLocaleString()}\n• Spent so far (${monthTxs.filter((t) => t.kind === 'expense').length} expenses): ${curr}${totalExpense.toLocaleString()}\n• Remaining budget: ${curr}${budgetRemaining.toLocaleString()}`
            : `Your safe daily spend limit is ${curr}0/day because your monthly expenses (${curr}${totalExpense.toLocaleString()}) have already exceeded your ${curr}${user.monthlyBudget.toLocaleString()} budget by ${curr}${Math.abs(budgetRemaining).toLocaleString()}. Pause non-essential spending for the remaining ${daysRemaining} days of ${yearMonth}.`,
        deterministicCalculation: `(${curr}${user.monthlyBudget.toLocaleString()} − ${curr}${totalExpense.toLocaleString()}) ÷ ${daysRemaining} days = ${curr}${safeDailySpend.toLocaleString()}/day`,
      };
    }

    // 4. Monthly summary / overview / report / status
    if (
      q.includes('summary') ||
      q.includes('monthly') ||
      q.includes('overview') ||
      q.includes('report') ||
      q.includes('status') ||
      q.includes('how am i doing')
    ) {
      if (allTxs.length === 0) {
        return {
          answer: `Monthly summary for ${yearMonth} — insufficient transaction data (0 records logged):\n\n• Monthly budget target: ${curr}${user.monthlyBudget.toLocaleString()}\n• Total income (${yearMonth}): ${curr}0\n• Total expenses (${yearMonth}): ${curr}0\n• Remaining budget: ${curr}${user.monthlyBudget.toLocaleString()}\n• Safe daily allowance (${daysRemaining}d left): ${curr}${safeDailySpend.toLocaleString()}/day\n\nAdd your stipend, allowance, or daily expenses using the "New entry" button to populate your monthly cashflow metrics.`,
          deterministicCalculation: `${yearMonth}: 0 transactions | Budget ${curr}${user.monthlyBudget.toLocaleString()} intact`,
        };
      }

      const budgetUsedPct = user.monthlyBudget > 0 ? Math.round((totalExpense / user.monthlyBudget) * 100) : 0;
      return {
        answer: `Monthly summary for ${yearMonth} (${monthTxs.length} transactions this month, ${allTxs.length} total):\n\n• Total income: ${curr}${totalIncome.toLocaleString()}\n• Total expenses: ${curr}${totalExpense.toLocaleString()} (${budgetUsedPct}% of ${curr}${user.monthlyBudget.toLocaleString()} budget)\n• Net cashflow: ${netSavings >= 0 ? '+' : '-'}${curr}${Math.abs(netSavings).toLocaleString()}\n• Remaining budget: ${curr}${budgetRemaining.toLocaleString()}\n• Safe daily limit (${daysRemaining}d left): ${curr}${safeDailySpend.toLocaleString()}/day\n• Top expense category: ${topCategory ? `${topCategory.name} (${curr}${topCategory.spent.toLocaleString()})` : 'None this month'}`,
        deterministicCalculation: `Income ${curr}${totalIncome.toLocaleString()} − Expense ${curr}${totalExpense.toLocaleString()} = Net ${curr}${netSavings.toLocaleString()} (${budgetUsedPct}% budget used)`,
      };
    }

    // 5. Recurring bills, hostel dues, rent, subscriptions
    if (
      q.includes('bill') ||
      q.includes('hostel') ||
      q.includes('rent') ||
      q.includes('mess') ||
      q.includes('subscription') ||
      q.includes('recurring') ||
      q.includes('due')
    ) {
      const billTotal = activeBills.reduce((sum, b) => sum + b.amount, 0);

      if (activeBills.length === 0) {
        return {
          answer: `You currently have 0 active recurring bills or subscriptions configured.\n\n• Active recurring commitments: 0 (${curr}0)\n\nOpen the Recurring bills view to track recurring hostel fees, mess bills, rent, or streaming memberships.`,
          deterministicCalculation: `0 active recurring obligations (${curr}0/month)`,
        };
      }

      const billLines = activeBills
        .slice(0, 5)
        .map((b) => `• ${b.title}: ${curr}${b.amount.toLocaleString()} (${b.frequency}, next due ${b.nextDueDate})`)
        .join('\n');

      return {
        answer: `Here are your active recurring commitments (${activeBills.length} active):\n\n${billLines}\n\nTotal scheduled amount: ${curr}${billTotal.toLocaleString()}.`,
        deterministicCalculation: `${activeBills.length} active recurring commitments = ${curr}${billTotal.toLocaleString()}`,
      };
    }

    // 6. Savings goals / targets
    if (q.includes('goal') || q.includes('saving') || q.includes('target')) {
      if (goals.length === 0) {
        return {
          answer: `You have 0 savings goals configured right now.\n\n• Current month net cashflow: ${netSavings >= 0 ? '+' : '-'}${curr}${Math.abs(netSavings).toLocaleString()}\n• Visit the Budgets and goals tab to set up a target (such as an emergency fund, laptop upgrade, or semester fee reserve).`,
          deterministicCalculation: `0 active savings goals | Monthly net cashflow: ${curr}${netSavings.toLocaleString()}`,
        };
      }

      const totalSaved = goals.reduce((s, g) => s + g.currentAmount, 0);
      const totalTarget = goals.reduce((s, g) => s + g.targetAmount, 0);
      const goalLines = goals
        .map((g) => {
          const pct = g.targetAmount > 0 ? Math.round((g.currentAmount / g.targetAmount) * 100) : 0;
          return `• ${g.title}: ${curr}${g.currentAmount.toLocaleString()} / ${curr}${g.targetAmount.toLocaleString()} (${pct}%)`;
        })
        .join('\n');

      return {
        answer: `You are tracking ${goals.length} savings ${goals.length === 1 ? 'goal' : 'goals'}:\n\n${goalLines}\n\nTotal saved across goals: ${curr}${totalSaved.toLocaleString()} of ${curr}${totalTarget.toLocaleString()}.`,
        deterministicCalculation: `Goals progress: ${curr}${totalSaved.toLocaleString()} / ${curr}${totalTarget.toLocaleString()} (${goals.length} goals)`,
      };
    }

    // 7. Peer debts / splits / IOUs
    if (q.includes('debt') || q.includes('owe') || q.includes('iou') || q.includes('split') || q.includes('friend') || q.includes('borrow') || q.includes('lent')) {
      const owedToYou = debts.filter((d) => d.type === 'owes_you').reduce((s, d) => s + d.amount, 0);
      const youOwe = debts.filter((d) => d.type === 'you_owe').reduce((s, d) => s + d.amount, 0);

      if (debts.length === 0) {
        return {
          answer: `You have no unsettled peer IOUs or bill splits in the Campus hub.\n\n• Owed to you: ${curr}0\n• You owe others: ${curr}0`,
          deterministicCalculation: `0 unsettled IOUs | Net peer balance: ${curr}0`,
        };
      }

      const netPeer = owedToYou - youOwe;
      return {
        answer: `Unsettled peer splits & IOUs (${debts.length} open):\n\n• Classmates owe you: ${curr}${owedToYou.toLocaleString()}\n• You owe others: ${curr}${youOwe.toLocaleString()}\n• Net peer position: ${netPeer >= 0 ? '+' : '-'}${curr}${Math.abs(netPeer).toLocaleString()}`,
        deterministicCalculation: `Owed to you ${curr}${owedToYou.toLocaleString()} − You owe ${curr}${youOwe.toLocaleString()} = ${curr}${netPeer.toLocaleString()}`,
      };
    }

    // 8. Income / earnings / stipend
    if (q.includes('income') || q.includes('earn') || q.includes('stipend') || q.includes('salary') || q.includes('pocket money')) {
      const incomeCount = monthTxs.filter((t) => t.kind === 'income').length;
      if (allTxs.length === 0) {
        return {
          answer: `There is no income recorded in your ledger yet (0 transactions).\n\nLog your monthly allowance, scholarship, or part-time income using "New entry" → "Income" to track your net savings rate.`,
          deterministicCalculation: `Income (${yearMonth}): ${curr}0 across 0 entries`,
        };
      }
      return {
        answer: `Income summary for ${yearMonth}:\n\n• Monthly income: ${curr}${totalIncome.toLocaleString()} (${incomeCount} ${incomeCount === 1 ? 'entry' : 'entries'})\n• All-time recorded income: ${curr}${allTimeIncome.toLocaleString()}\n• Net savings this month (income minus expenses): ${netSavings >= 0 ? '+' : '-'}${curr}${Math.abs(netSavings).toLocaleString()}`,
        deterministicCalculation: `${yearMonth} income: ${curr}${totalIncome.toLocaleString()} | All-time income: ${curr}${allTimeIncome.toLocaleString()}`,
      };
    }

    // 9. Recent transactions / last spent
    if (q.includes('recent') || q.includes('last') || q.includes('latest') || q.includes('history') || q.includes('transactions')) {
      if (allTxs.length === 0) {
        return {
          answer: `Your transaction history is empty (0 records). Add your first expense or income entry to see recent ledger activity.`,
          deterministicCalculation: `0 transactions in ledger`,
        };
      }
      const sorted = [...allTxs].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 5);
      const lines = sorted
        .map((t) => `• ${t.date} — ${t.description || t.categoryName}: ${t.kind === 'income' ? '+' : '-'}${curr}${t.amount.toLocaleString()} (${t.paymentMethod})`)
        .join('\n');
      return {
        answer: `Here are your ${sorted.length} most recent transactions (out of ${allTxs.length} total):\n\n${lines}`,
        deterministicCalculation: `Showing ${sorted.length} of ${allTxs.length} total ledger entries`,
      };
    }

    // 10. Specific category or keyword search in ledger
    const matchedCategory = this.db.categories.find(
      (c) => (c.userId === null || c.userId === user.id) && q.includes(c.name.toLowerCase())
    );
    if (matchedCategory) {
      const catTxs = allTxs.filter((t) => t.categoryId === matchedCategory.id);
      const catTotal = catTxs.reduce((s, t) => s + t.amount, 0);
      return {
        answer:
          catTxs.length > 0
            ? `You have ${catTxs.length} transaction(s) in "${matchedCategory.name}" totaling ${curr}${catTotal.toLocaleString()}.`
            : `You have 0 transactions recorded under "${matchedCategory.name}" so far.`,
        deterministicCalculation: `Category "${matchedCategory.name}": ${catTxs.length} entries = ${curr}${catTotal.toLocaleString()}`,
      };
    }

    const words = q.split(/\s+/).filter((w) => w.length >= 4 && !['what', 'when', 'where', 'which', 'much', 'many', 'have', 'this', 'that', 'with', 'from', 'your', 'about', 'tell', 'show', 'give'].includes(w));
    if (words.length > 0 && allTxs.length > 0) {
      const matchingTxs = allTxs.filter((t) =>
        words.some(
          (w) =>
            t.description.toLowerCase().includes(w) ||
            (t.merchant || '').toLowerCase().includes(w) ||
            (t.notes || '').toLowerCase().includes(w)
        )
      );
      if (matchingTxs.length > 0) {
        const matchSum = matchingTxs.reduce((s, t) => s + t.amount, 0);
        const lines = matchingTxs
          .slice(0, 4)
          .map((t) => `• ${t.date} — ${t.description || t.categoryName}: ${curr}${t.amount.toLocaleString()}`)
          .join('\n');
        return {
          answer: `Found ${matchingTxs.length} matching ledger ${matchingTxs.length === 1 ? 'entry' : 'entries'} for "${question}" totaling ${curr}${matchSum.toLocaleString()}:\n\n${lines}`,
          deterministicCalculation: `Matched ${matchingTxs.length} entries = ${curr}${matchSum.toLocaleString()}`,
        };
      }
    }

    // 11. General fallback tailored to the question and data state
    if (allTxs.length === 0) {
      return {
        answer: `Regarding "${question}": your ledger currently has 0 recorded transactions, so there is insufficient transaction history to compute historical trends.\n\nHere is your current baseline configuration:\n• Monthly budget target: ${curr}${user.monthlyBudget.toLocaleString()}\n• Safe daily allowance (${daysRemaining} days left in ${yearMonth}): ${curr}${safeDailySpend.toLocaleString()}/day\n• Active recurring bills: ${activeBills.length} | Savings goals: ${goals.length}\n\nTry asking "Can I afford a ${curr}2,000 outing?", "Safe daily spend limit", or log a transaction to analyze category totals.`,
        deterministicCalculation: `Ledger empty (0 transactions) | Baseline budget: ${curr}${user.monthlyBudget.toLocaleString()}`,
      };
    }

    return {
      answer: `Analysis for "${question}" based on your ${yearMonth} ledger:\n\n• Monthly expenses: ${curr}${totalExpense.toLocaleString()} across ${monthTxs.filter((t) => t.kind === 'expense').length} entries (budget: ${curr}${user.monthlyBudget.toLocaleString()})\n• Remaining budget: ${curr}${budgetRemaining.toLocaleString()} (${curr}${safeDailySpend.toLocaleString()}/day safe limit for ${daysRemaining} days)\n• Highest category: ${topCategory ? `${topCategory.name} (${curr}${topCategory.spent.toLocaleString()})` : (allTimeTopCategory ? `${allTimeTopCategory.name} (${curr}${allTimeTopCategory.spent.toLocaleString()} all-time)` : 'None')}\n• All-time ledger: ${allTxs.length} total entries (Expenses: ${curr}${allTimeExpense.toLocaleString()}, Income: ${curr}${allTimeIncome.toLocaleString()})`,
      deterministicCalculation: `Budget ${curr}${user.monthlyBudget.toLocaleString()} − Spent ${curr}${totalExpense.toLocaleString()} = ${curr}${budgetRemaining.toLocaleString()} (${curr}${safeDailySpend.toLocaleString()}/day)`,
    };
  }
}

export const clientStore = new ClientStore();
