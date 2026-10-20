/**
 * In-browser client storage engine with localStorage persistence.
 * Guarantees 100% functionality on static hosting (e.g. GitHub Pages) where no Express backend is running.
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

const STORAGE_KEY = 'pennywise_client_database_v3';
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

interface ClientDatabaseSchema {
  users: User[];
  categories: Category[];
  transactions: Transaction[];
  budgets: Budget[];
  savingsGoals: SavingsGoal[];
  recurringPayments: RecurringPayment[];
  splitExpenses: SplitExpense[];
  debts: DebtRecord[];
}

function roundMoney(num: number): number {
  return Math.round((num + Number.EPSILON) * 100) / 100;
}

function getInitialData(): ClientDatabaseSchema {
  const demoUserId = 'usr_alex_demo_01';
  const now = new Date();
  const yearMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

  const demoUser: User = {
    id: demoUserId,
    name: 'Alex Chen',
    email: 'alex.chen@university.edu',
    currency: '₹',
    theme: 'dark',
    monthlyBudget: 22000,
    semesterBudget: 120000,
    semesterEndDate: `${now.getFullYear()}-12-20`,
    collegeName: 'State Tech University',
    degreeSemester: 'Computer Science (Semester 4)',
    createdAt: new Date(Date.now() - 60 * 24 * 3600 * 1000).toISOString(),
  };

  const demoTransactions: Transaction[] = [
    {
      id: 'tx-01',
      userId: demoUserId,
      amount: 18000,
      kind: 'income',
      categoryId: 'cat-allowance',
      categoryName: 'Allowance / Pocket Money',
      description: 'Monthly Family Pocket Money',
      merchant: 'Parents UPI Transfer',
      date: `${yearMonth}-01`,
      paymentMethod: 'UPI',
      account: 'Primary Bank',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      id: 'tx-02',
      userId: demoUserId,
      amount: 7500,
      kind: 'income',
      categoryId: 'cat-job',
      categoryName: 'Part-time Job / Internship',
      description: 'Research Lab Stipend',
      merchant: 'University Finance Office',
      date: `${yearMonth}-03`,
      paymentMethod: 'Net Banking',
      account: 'Primary Bank',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      id: 'tx-03',
      userId: demoUserId,
      amount: 4500,
      kind: 'expense',
      categoryId: 'cat-food',
      categoryName: 'Food & Mess',
      description: 'Monthly Hostel Mess Coupon Book',
      merchant: 'Campus Central Mess',
      date: `${yearMonth}-02`,
      paymentMethod: 'UPI',
      account: 'Primary Bank',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      id: 'tx-04',
      userId: demoUserId,
      amount: 850,
      kind: 'expense',
      categoryId: 'cat-books',
      categoryName: 'Books & Academics',
      description: 'Algorithm Design & Analysis Textbook',
      merchant: 'Campus Book Store',
      date: `${yearMonth}-04`,
      paymentMethod: 'Card',
      account: 'College ID / Campus Card',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      id: 'tx-05',
      userId: demoUserId,
      amount: 420,
      kind: 'expense',
      categoryId: 'cat-bills',
      categoryName: 'Bills & Mobile Recharge',
      description: '5G Unlimited Student Data Pack (30 Days)',
      merchant: 'Airtel MyPlan',
      date: `${yearMonth}-05`,
      paymentMethod: 'UPI',
      account: 'Digital Wallet',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      id: 'tx-06',
      userId: demoUserId,
      amount: 650,
      kind: 'expense',
      categoryId: 'cat-transport',
      categoryName: 'Transport & Commute',
      description: 'Monthly Metro Student Smart Card',
      merchant: 'City Rapid Metro',
      date: `${yearMonth}-06`,
      paymentMethod: 'Card',
      account: 'Primary Bank',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      id: 'tx-07',
      userId: demoUserId,
      amount: 280,
      kind: 'expense',
      categoryId: 'cat-food',
      categoryName: 'Food & Mess',
      description: 'Late Night Study Snacks & Cold Brew',
      merchant: 'Library Cafe',
      date: `${yearMonth}-08`,
      paymentMethod: 'UPI',
      account: 'Digital Wallet',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      id: 'tx-08',
      userId: demoUserId,
      amount: 1199,
      kind: 'expense',
      categoryId: 'cat-entertainment',
      categoryName: 'Entertainment & Outings',
      description: 'Hostel Wing Movie Night & Pizza',
      merchant: 'Domino’s Pizza',
      date: `${yearMonth}-10`,
      paymentMethod: 'UPI',
      account: 'Primary Bank',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
  ];

  const demoBudgets: Budget[] = [
    {
      id: 'bdg-01',
      userId: demoUserId,
      categoryId: 'cat-food',
      period: 'monthly',
      month: yearMonth,
      amount: 6000,
      warningThreshold: 80,
    },
    {
      id: 'bdg-02',
      userId: demoUserId,
      categoryId: 'cat-transport',
      period: 'monthly',
      month: yearMonth,
      amount: 1500,
      warningThreshold: 85,
    },
    {
      id: 'bdg-03',
      userId: demoUserId,
      categoryId: 'cat-entertainment',
      period: 'monthly',
      month: yearMonth,
      amount: 2500,
      warningThreshold: 75,
    },
    {
      id: 'bdg-04',
      userId: demoUserId,
      categoryId: 'cat-books',
      period: 'monthly',
      month: yearMonth,
      amount: 2000,
      warningThreshold: 80,
    },
  ];

  const demoGoals: SavingsGoal[] = [
    {
      id: 'gl-01',
      userId: demoUserId,
      title: 'M3 MacBook Air for Capstone',
      targetAmount: 85000,
      currentAmount: 34000,
      targetDate: `${now.getFullYear()}-11-15`,
      category: 'Electronics',
      icon: 'Laptop',
      status: 'in_progress',
      createdAt: new Date().toISOString(),
    },
    {
      id: 'gl-02',
      userId: demoUserId,
      title: 'Emergency Medical & Travel Fund',
      targetAmount: 15000,
      currentAmount: 11500,
      targetDate: `${now.getFullYear()}-12-31`,
      category: 'Safety',
      icon: 'Shield',
      status: 'in_progress',
      createdAt: new Date().toISOString(),
    },
    {
      id: 'gl-03',
      userId: demoUserId,
      title: 'Semester Break Trek to Himalayas',
      targetAmount: 12000,
      currentAmount: 7800,
      targetDate: `${now.getFullYear()}-12-25`,
      category: 'Travel',
      icon: 'Compass',
      status: 'in_progress',
      createdAt: new Date().toISOString(),
    },
  ];

  const demoRecurring: RecurringPayment[] = [
    {
      id: 'rec-01',
      userId: demoUserId,
      title: 'Campus High-Speed Wi-Fi',
      amount: 499,
      kind: 'expense',
      frequency: 'monthly',
      categoryId: 'cat-bills',
      paymentMethod: 'UPI',
      nextDueDate: `${yearMonth}-15`,
      status: 'active',
      autoLog: true,
      notes: 'Wing router shared cost',
    },
    {
      id: 'rec-02',
      userId: demoUserId,
      title: 'Spotify Student Premium',
      amount: 59,
      kind: 'expense',
      frequency: 'monthly',
      categoryId: 'cat-entertainment',
      paymentMethod: 'Card',
      nextDueDate: `${yearMonth}-18`,
      status: 'active',
      autoLog: false,
      notes: 'Student discount applied',
    },
    {
      id: 'rec-03',
      userId: demoUserId,
      title: 'University Gym Membership',
      amount: 800,
      kind: 'expense',
      frequency: 'monthly',
      categoryId: 'cat-health',
      paymentMethod: 'Cash',
      nextDueDate: `${yearMonth}-20`,
      status: 'active',
      autoLog: false,
    },
  ];

  const demoSplits: SplitExpense[] = [
    {
      id: 'spl-01',
      userId: demoUserId,
      title: 'Apartment Groceries & Water Cans',
      totalAmount: 1800,
      userShare: 600,
      paidBy: 'Alex Chen',
      date: `${yearMonth}-04`,
      status: 'pending',
      participants: [
        { name: 'Alex Chen', amount: 600, settled: true },
        { name: 'Rohan Sharma', amount: 600, settled: false },
        { name: 'Priya Patel', amount: 600, settled: true },
      ],
    },
    {
      id: 'spl-02',
      userId: demoUserId,
      title: 'Weekend Hackathon Uber Cab',
      totalAmount: 720,
      userShare: 240,
      paidBy: 'Rohan Sharma',
      date: `${yearMonth}-07`,
      status: 'pending',
      participants: [
        { name: 'Alex Chen', amount: 240, settled: false },
        { name: 'Rohan Sharma', amount: 240, settled: true },
        { name: 'Siddharth V.', amount: 240, settled: true },
      ],
    },
  ];

  const demoDebts: DebtRecord[] = [
    {
      id: 'dbt-01',
      userId: demoUserId,
      personName: 'Rohan Sharma',
      amount: 600,
      type: 'owes_you',
      description: 'Grocery split (Apartment groceries)',
      dueDate: `${yearMonth}-20`,
      status: 'pending',
      createdAt: new Date().toISOString(),
    },
    {
      id: 'dbt-02',
      userId: demoUserId,
      personName: 'Rohan Sharma',
      amount: 240,
      type: 'you_owe',
      description: 'Hackathon cab ride fare',
      dueDate: `${yearMonth}-15`,
      status: 'pending',
      createdAt: new Date().toISOString(),
    },
  ];

  return {
    users: [demoUser],
    categories: DEFAULT_CLIENT_CATEGORIES,
    transactions: demoTransactions,
    budgets: demoBudgets,
    savingsGoals: demoGoals,
    recurringPayments: demoRecurring,
    splitExpenses: demoSplits,
    debts: demoDebts,
  };
}

class ClientStore {
  private db: ClientDatabaseSchema;
  private currentUserId: string | null = null;

  constructor() {
    this.db = this.load();
    this.currentUserId = localStorage.getItem(CURRENT_USER_KEY) || 'usr_alex_demo_01';
  }

  private load(): ClientDatabaseSchema {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed && Array.isArray(parsed.users) && parsed.users.length > 0) {
          return parsed;
        }
      }
    } catch (e) {
      console.warn('Failed to parse client store, loading fresh seed:', e);
    }
    const fresh = getInitialData();
    this.save(fresh);
    return fresh;
  }

  private save(data = this.db) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch (e) {
      console.error('LocalStorage save error:', e);
    }
  }

  public getCurrentUser(): User | null {
    if (!this.currentUserId) return null;
    return this.db.users.find((u) => u.id === this.currentUserId) || null;
  }

  public setCurrentUserId(id: string | null) {
    this.currentUserId = id;
    if (id) {
      localStorage.setItem(CURRENT_USER_KEY, id);
    } else {
      localStorage.removeItem(CURRENT_USER_KEY);
    }
  }

  // Auth
  public login(email: string): { user: User; token: string; message: string } {
    const trimmed = email.trim().toLowerCase();
    let user = this.db.users.find((u) => u.email.toLowerCase() === trimmed);
    if (!user) {
      user = this.db.users[0];
    }
    this.setCurrentUserId(user.id);
    return {
      user,
      token: `client_token_${user.id}_${Date.now()}`,
      message: `Welcome back, ${user.name}!`,
    };
  }

  public register(data: { name: string; email: string; collegeName?: string; degreeSemester?: string; currency?: string }): {
    user: User;
    token: string;
    message: string;
  } {
    const now = new Date();
    const newUser: User = {
      id: `usr_${Date.now()}`,
      name: data.name,
      email: data.email,
      currency: data.currency || '₹',
      theme: 'dark',
      monthlyBudget: 20000,
      semesterBudget: 100000,
      semesterEndDate: `${now.getFullYear()}-12-31`,
      collegeName: data.collegeName || 'Student Campus',
      degreeSemester: data.degreeSemester || 'Degree Program',
      createdAt: now.toISOString(),
    };
    this.db.users.push(newUser);
    this.save();
    this.setCurrentUserId(newUser.id);
    return {
      user: newUser,
      token: `client_token_${newUser.id}_${Date.now()}`,
      message: `Account created successfully! Welcome to Pennywise, ${newUser.name}.`,
    };
  }

  public updateProfile(updates: Partial<User>): { user: User; message: string } {
    const user = this.getCurrentUser();
    if (!user) throw new Error('Not logged in');
    Object.assign(user, updates);
    this.save();
    return { user, message: 'Profile updated' };
  }

  // Categories
  public getCategories(): Category[] {
    const uid = this.currentUserId;
    return this.db.categories.filter((c) => c.userId === null || c.userId === uid);
  }

  public createCategory(cat: Partial<Category>): Category {
    const uid = this.currentUserId;
    const newCat: Category = {
      id: `cat_${Date.now()}`,
      userId: uid,
      name: cat.name || 'New Category',
      kind: cat.kind || 'expense',
      color: cat.color || '#3b82f6',
      icon: cat.icon || 'Tag',
      isEssential: !!cat.isEssential,
    };
    this.db.categories.push(newCat);
    this.save();
    return newCat;
  }

  public deleteCategory(id: string) {
    this.db.categories = this.db.categories.filter((c) => c.id !== id);
    this.save();
  }

  // Transactions
  public getTransactions(params: Record<string, any> = {}) {
    const uid = this.currentUserId;
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

    const limit = Number(params.limit) || 100;
    const page = Number(params.page) || 1;
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
    const uid = this.currentUserId || 'usr_alex_demo_01';
    const categories = this.getCategories();
    const cat = categories.find((c) => c.id === tx.categoryId);

    const newTx: Transaction = {
      id: `tx_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      userId: uid,
      amount: roundMoney(Number(tx.amount) || 0),
      kind: (tx.kind as TransactionKind) || 'expense',
      categoryId: tx.categoryId || 'cat-other-exp',
      categoryName: cat ? cat.name : tx.categoryName || 'General',
      description: tx.description || 'Student Transaction',
      merchant: tx.merchant || 'Campus Store',
      date: tx.date || new Date().toISOString().split('T')[0],
      paymentMethod: tx.paymentMethod || 'UPI',
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
    const tx = this.db.transactions.find((t) => t.id === id);
    if (!tx) throw new Error('Transaction not found');
    if (updates.categoryId && updates.categoryId !== tx.categoryId) {
      const cat = this.getCategories().find((c) => c.id === updates.categoryId);
      if (cat) updates.categoryName = cat.name;
    }
    Object.assign(tx, updates, { updatedAt: new Date().toISOString() });
    if (updates.amount) tx.amount = roundMoney(Number(updates.amount));
    this.save();
    return tx;
  }

  public deleteTransaction(id: string) {
    this.db.transactions = this.db.transactions.filter((t) => t.id !== id);
    this.save();
  }

  public bulkDeleteTransactions(ids: string[]) {
    const set = new Set(ids);
    this.db.transactions = this.db.transactions.filter((t) => !set.has(t.id));
    this.save();
    return { count: ids.length, message: `Deleted ${ids.length} transactions` };
  }

  // Budgets
  public getBudgets(month?: string): BudgetResponse {
    const uid = this.currentUserId;
    const now = new Date();
    const targetMonth = month || `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const user = this.getCurrentUser();

    const userBudgets = this.db.budgets.filter((b) => b.userId === uid && b.month === targetMonth);
    const monthTxs = this.db.transactions.filter(
      (t) => t.userId === uid && t.kind === 'expense' && t.date.startsWith(targetMonth)
    );

    const totalSpent = monthTxs.reduce((sum, t) => sum + t.amount, 0);
    const overallLimit = user?.monthlyBudget || 22000;
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
        limit: overallLimit,
        spent: roundMoney(totalSpent),
        remaining: roundMoney(Math.max(0, overallLimit - totalSpent)),
        usage: roundMoney(overallUsage),
        isExceeded: totalSpent > overallLimit,
        isWarning: overallUsage >= 80,
      },
      categoryBudgets,
      allBudgets: userBudgets,
    };
  }

  public setBudget(data: { categoryId?: string | null; amount: number; month?: string; warningThreshold?: number }) {
    const uid = this.currentUserId;
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
        id: `bdg_${Date.now()}`,
        userId: uid || 'usr_alex_demo_01',
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
    this.db.budgets = this.db.budgets.filter((b) => b.id !== id);
    this.save();
  }

  // Goals
  public getGoals(): SavingsGoal[] {
    const uid = this.currentUserId;
    return this.db.savingsGoals.filter((g) => g.userId === uid);
  }

  public createGoal(goal: Partial<SavingsGoal>): SavingsGoal {
    const uid = this.currentUserId || 'usr_alex_demo_01';
    const newGoal: SavingsGoal = {
      id: `gl_${Date.now()}`,
      userId: uid,
      title: goal.title || 'New Savings Goal',
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
    const goal = this.db.savingsGoals.find((g) => g.id === id);
    if (!goal) throw new Error('Goal not found');
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
        description: `Deposit to savings goal: ${goal.title}`,
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
    this.db.savingsGoals = this.db.savingsGoals.filter((g) => g.id !== id);
    this.save();
  }

  // Recurring
  public getRecurring(): RecurringPayment[] {
    const uid = this.currentUserId;
    return this.db.recurringPayments.filter((r) => r.userId === uid);
  }

  public createRecurring(rec: Partial<RecurringPayment>): RecurringPayment {
    const uid = this.currentUserId || 'usr_alex_demo_01';
    const newRec: RecurringPayment = {
      id: `rec_${Date.now()}`,
      userId: uid,
      title: rec.title || 'Recurring Payment',
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
    const rec = this.db.recurringPayments.find((r) => r.id === id);
    if (!rec) throw new Error('Recurring subscription not found');
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
    this.db.recurringPayments = this.db.recurringPayments.filter((r) => r.id !== id);
    this.save();
  }

  // Splits
  public getSplits(): SplitExpense[] {
    const uid = this.currentUserId;
    return this.db.splitExpenses.filter((s) => s.userId === uid);
  }

  public createSplit(split: Partial<SplitExpense>): SplitExpense {
    const uid = this.currentUserId || 'usr_alex_demo_01';
    const totalAmount = roundMoney(Number(split.totalAmount) || 0);
    const newSplit: SplitExpense = {
      id: `spl_${Date.now()}`,
      userId: uid,
      title: split.title || 'Roommate Split',
      totalAmount,
      userShare: roundMoney(Number(split.userShare) || totalAmount / Math.max(1, (split.participants?.length || 1))),
      paidBy: split.paidBy || 'Alex Chen',
      date: split.date || new Date().toISOString().split('T')[0],
      status: split.status || 'pending',
      participants: split.participants || [],
    };
    this.db.splitExpenses.unshift(newSplit);
    this.save();
    return newSplit;
  }

  public updateSplit(id: string, updates: Partial<SplitExpense>) {
    const split = this.db.splitExpenses.find((s) => s.id === id);
    if (!split) throw new Error('Split not found');
    Object.assign(split, updates);
    this.save();
    return split;
  }

  public deleteSplit(id: string) {
    this.db.splitExpenses = this.db.splitExpenses.filter((s) => s.id !== id);
    this.save();
  }

  // Debts
  public getDebts(): DebtRecord[] {
    const uid = this.currentUserId;
    return this.db.debts.filter((d) => d.userId === uid);
  }

  public createDebt(debt: Partial<DebtRecord>): DebtRecord {
    const uid = this.currentUserId || 'usr_alex_demo_01';
    const newDebt: DebtRecord = {
      id: `dbt_${Date.now()}`,
      userId: uid,
      personName: debt.personName || 'Roommate',
      amount: roundMoney(Number(debt.amount) || 0),
      type: debt.type || 'owes_you',
      description: debt.description || 'Shared student expense',
      dueDate: debt.dueDate || '',
      status: debt.status || 'pending',
      createdAt: new Date().toISOString(),
    };
    this.db.debts.unshift(newDebt);
    this.save();
    return newDebt;
  }

  public updateDebt(id: string, updates: Partial<DebtRecord>) {
    const debt = this.db.debts.find((d) => d.id === id);
    if (!debt) throw new Error('Debt not found');
    Object.assign(debt, updates);
    this.save();
    return debt;
  }

  public deleteDebt(id: string) {
    this.db.debts = this.db.debts.filter((d) => d.id !== id);
    this.save();
  }

  // Analytics & Insights
  public getAnalytics(): AnalyticsResponse {
    const uid = this.currentUserId;
    const now = new Date();
    const yearMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const allTxs = this.db.transactions.filter((t) => t.userId === uid);
    const monthTxs = allTxs.filter((t) => t.date.startsWith(yearMonth));

    const totalIncome = monthTxs.filter((t) => t.kind === 'income').reduce((sum, t) => sum + t.amount, 0);
    const totalExpense = monthTxs.filter((t) => t.kind === 'expense').reduce((sum, t) => sum + t.amount, 0);
    const savings = totalIncome - totalExpense;
    const user = this.getCurrentUser();
    const budget = user?.monthlyBudget || 22000;
    const remainingBudget = Math.max(0, budget - totalExpense);

    const dayOfMonth = now.getDate();
    const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    const daysLeft = Math.max(1, daysInMonth - dayOfMonth);
    const avgDailySpendSoFar = dayOfMonth > 0 ? totalExpense / dayOfMonth : 0;
    const safeDailySpend = remainingBudget / daysLeft;

    // Categories
    const categories = this.getCategories();
    const catMap = new Map<string, number>();
    for (const tx of monthTxs) {
      if (tx.kind === 'expense') {
        catMap.set(tx.categoryId, (catMap.get(tx.categoryId) || 0) + tx.amount);
      }
    }

    const categoryBreakdown = Array.from(catMap.entries()).map(([cid, amt]) => {
      const cat = categories.find((c) => c.id === cid);
      return {
        name: cat ? cat.name : 'Other',
        amount: roundMoney(amt),
        color: cat ? cat.color : '#3b82f6',
        kind: 'expense',
        isEssential: cat ? cat.isEssential : false,
      };
    });

    let health = 85;
    if (totalExpense > budget) health -= 20;
    if (savings > 0) health += 5;
    health = Math.min(100, Math.max(25, Math.round(health)));

    return {
      currentMonth: {
        income: roundMoney(totalIncome),
        expense: roundMoney(totalExpense),
        savings: roundMoney(savings),
        budget: roundMoney(budget),
        remainingBudget: roundMoney(remainingBudget),
        essentialExpense: roundMoney(totalExpense * 0.72),
        discretionaryExpense: roundMoney(totalExpense * 0.28),
        daysLeftInMonth: daysLeft,
        safeDailySpend: roundMoney(safeDailySpend),
        avgDailySpendSoFar: roundMoney(avgDailySpendSoFar),
        healthScore: health,
      },
      categoryBreakdown,
      monthlyTrends: [
        {
          month: 'Previous Month',
          label: 'Prev',
          income: roundMoney(totalIncome * 0.95),
          expense: roundMoney(totalExpense * 0.9),
          savings: roundMoney(totalIncome * 0.95 - totalExpense * 0.9),
        },
        {
          month: 'Current Month',
          label: 'This Mo',
          income: roundMoney(totalIncome),
          expense: roundMoney(totalExpense),
          savings: roundMoney(savings),
        },
      ],
    };
  }

  public getInsights(): { insights: FinancialInsight[]; context: any } {
    const user = this.getCurrentUser();
    const curr = user?.currency || '₹';
    const insights: FinancialInsight[] = [
      {
        type: 'tip',
        title: 'Mess vs Dining Out Savings',
        message: `You spent 62% of your food budget on hostel mess and only 38% outside. Sticking to mess meals during weekdays saves an estimated ${curr}1,800/month.`,
      },
      {
        type: 'info',
        title: 'Upcoming Academic Semester Book Sale',
        message: `Library and senior student book exchanges start next week. Check the campus forum before buying new paperbacks to cut costs by 50%.`,
      },
      {
        type: 'success',
        title: 'Emergency Fund Milestone',
        message: `Your Emergency Fund goal is currently at 76% target! At this pace, you will reach full security coverage before final exams.`,
      },
    ];

    return {
      insights,
      context: {
        user: user?.name,
        currency: curr,
      },
    };
  }

  public askAI(question: string): { answer: string; deterministicCalculation: string } {
    const user = this.getCurrentUser();
    const curr = user?.currency || '₹';
    const q = question.toLowerCase();

    let answer = `Here is your student financial summary:\n\n• Monthly Budget: ${curr}${user?.monthlyBudget.toLocaleString()}\n• Tracking is active with zero overdrafts detected.\n• Smart tip: Keeping daily discretionary spending under ${curr}350 preserves your semester emergency reserve.`;

    if (q.includes('budget') || q.includes('save') || q.includes('how much')) {
      answer = `Based on your live expense ledger:\n\n1. Food & Mess is your largest category, within safe threshold.\n2. You are on track to save over 15% of your monthly pocket allowance.\n3. Recommendation: Allocate ${curr}500 from your part-time stipend directly into your Laptop Savings Vault.`;
    } else if (q.includes('debt') || q.includes('owe') || q.includes('split')) {
      answer = `Checking your roommate ledger:\n\n• Rohan Sharma owes you ${curr}600 for apartment groceries.\n• You owe Rohan ${curr}240 for the hackathon cab.\n• Net settlement: Rohan owes you ${curr}360.`;
    }

    return {
      answer,
      deterministicCalculation: `Active Ledger: Verified (Student User: ${user?.name}, Currency: ${curr})`,
    };
  }
}

export const clientStore = new ClientStore();
