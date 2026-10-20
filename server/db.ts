/**
 * File-backed ACID Persistent Database with Decimal Precision and User Isolation
 */

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import {
  DatabaseSchema,
  User,
  Category,
  Transaction,
  Budget,
  SavingsGoal,
  RecurringPayment,
  SplitExpense,
  DebtRecord,
} from './types.ts';
import { hashPassword } from './auth.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.resolve(__dirname, '../data');
const DB_FILE = path.resolve(DATA_DIR, 'db.json');

// Ensure data folder exists
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

export const DEFAULT_STUDENT_CATEGORIES: Omit<Category, 'userId'>[] = [
  // Expenses
  { id: 'cat-food', name: 'Food & Mess', kind: 'expense', color: '#10b981', icon: 'Utensils', isEssential: true },
  { id: 'cat-hostel', name: 'Hostel & Rent', kind: 'expense', color: '#06b6d4', icon: 'Home', isEssential: true },
  { id: 'cat-books', name: 'Books & Academics', kind: 'expense', color: '#3b82f6', icon: 'BookOpen', isEssential: true },
  { id: 'cat-fees', name: 'College Fees', kind: 'expense', color: '#6366f1', icon: 'GraduationCap', isEssential: true },
  { id: 'cat-transport', name: 'Transport & Commute', kind: 'expense', color: '#8b5cf6', icon: 'Bus', isEssential: true },
  { id: 'cat-bills', name: 'Bills & Mobile Recharge', kind: 'expense', color: '#ec4899', icon: 'Smartphone', isEssential: true },
  { id: 'cat-health', name: 'Health & Pharmacy', kind: 'expense', color: '#14b8a6', icon: 'HeartPulse', isEssential: true },
  { id: 'cat-entertainment', name: 'Entertainment & Outings', kind: 'expense', color: '#f59e0b', icon: 'Film', isEssential: false },
  { id: 'cat-shopping', name: 'Shopping & Gear', kind: 'expense', color: '#f97316', icon: 'ShoppingBag', isEssential: false },
  { id: 'cat-personal', name: 'Personal Care', kind: 'expense', color: '#eab308', icon: 'Sparkles', isEssential: false },
  { id: 'cat-other-exp', name: 'Other Expenses', kind: 'expense', color: '#64748b', icon: 'MoreHorizontal', isEssential: false },
  // Income
  { id: 'cat-allowance', name: 'Allowance / Pocket Money', kind: 'income', color: '#10b981', icon: 'Wallet', isEssential: true },
  { id: 'cat-scholarship', name: 'Scholarship / Grant', kind: 'income', color: '#06b6d4', icon: 'Award', isEssential: true },
  { id: 'cat-job', name: 'Part-time Job / Internship', kind: 'income', color: '#3b82f6', icon: 'Briefcase', isEssential: true },
  { id: 'cat-freelance', name: 'Freelance / Tutoring', kind: 'income', color: '#8b5cf6', icon: 'Laptop', isEssential: true },
  { id: 'cat-gift', name: 'Gifts & Awards', kind: 'income', color: '#f59e0b', icon: 'Gift', isEssential: false },
  { id: 'cat-other-inc', name: 'Other Income', kind: 'income', color: '#64748b', icon: 'ArrowDownLeft', isEssential: false },
];

/**
 * Precision money formatting (2 decimal places)
 */
export function roundMoney(amount: number | string): number {
  const num = typeof amount === 'string' ? parseFloat(amount) : amount;
  if (isNaN(num) || !isFinite(num)) return 0;
  return Math.round((num + Number.EPSILON) * 100) / 100;
}

class Database {
  private data: DatabaseSchema;

  constructor() {
    this.data = this.load();
    if (this.data.users.length === 0) {
      this.seedInitialDemoData();
    }
  }

  private load(): DatabaseSchema {
    if (fs.existsSync(DB_FILE)) {
      try {
        const raw = fs.readFileSync(DB_FILE, 'utf-8');
        const parsed = JSON.parse(raw);
        return {
          users: parsed.users || [],
          categories: parsed.categories || [],
          transactions: parsed.transactions || [],
          budgets: parsed.budgets || [],
          savingsGoals: parsed.savingsGoals || [],
          recurringPayments: parsed.recurringPayments || [],
          splitExpenses: parsed.splitExpenses || [],
          debts: parsed.debts || [],
        };
      } catch (err) {
        console.error('Error reading db.json, creating clean schema:', err);
      }
    }
    return {
      users: [],
      categories: DEFAULT_STUDENT_CATEGORIES.map((c) => ({ ...c, userId: null })),
      transactions: [],
      budgets: [],
      savingsGoals: [],
      recurringPayments: [],
      splitExpenses: [],
      debts: [],
    };
  }

  /**
   * Atomic flush to disk
   */
  private save(): void {
    const tempFile = `${DB_FILE}.${Date.now()}.${crypto.randomBytes(4).toString('hex')}.tmp`;
    const payload = JSON.stringify(this.data, null, 2);
    fs.writeFileSync(tempFile, payload, 'utf-8');
    fs.renameSync(tempFile, DB_FILE);
  }

  private seedInitialDemoData(): void {
    const { hash, salt } = hashPassword('StudentPass123!');
    const demoUser: User = {
      id: 'demo-student-id-001',
      name: 'Alex Chen',
      email: 'demo@student.edu',
      passwordHash: hash,
      salt: salt,
      currency: '₹',
      theme: 'dark',
      monthlyBudget: 15000,
      semesterBudget: 60000,
      semesterEndDate: '2026-12-15',
      collegeName: 'National Institute of Technology',
      degreeSemester: 'Semester 5 (B.Tech CS)',
      createdAt: new Date().toISOString(),
    };

    this.data.users.push(demoUser);

    // Initial default categories
    this.data.categories = DEFAULT_STUDENT_CATEGORIES.map((c) => ({ ...c, userId: null }));

    // Generate realistic student transactions for current month and past month
    const today = new Date();
    const curYear = today.getFullYear();
    const curMonth = today.getMonth() + 1;
    const mStr = curMonth.toString().padStart(2, '0');

    const sampleTransactions: Omit<Transaction, 'id' | 'createdAt' | 'updatedAt'>[] = [
      {
        userId: demoUser.id,
        amount: 15000,
        kind: 'income',
        categoryId: 'cat-allowance',
        categoryName: 'Allowance / Pocket Money',
        description: 'Monthly student allowance from parents',
        merchant: 'Parent Bank Transfer',
        date: `${curYear}-${mStr}-01`,
        paymentMethod: 'Net Banking',
        account: 'Primary Bank',
        notes: 'Monthly allowance received for rent & mess',
        tags: ['allowance', 'family'],
      },
      {
        userId: demoUser.id,
        amount: 4500,
        kind: 'income',
        categoryId: 'cat-freelance',
        categoryName: 'Freelance / Tutoring',
        description: 'Web development stipend for college lab',
        merchant: 'College Research Lab',
        date: `${curYear}-${mStr}-05`,
        paymentMethod: 'UPI',
        account: 'Primary Bank',
        notes: 'Python assistant stipend',
        tags: ['freelance', 'academic'],
      },
      {
        userId: demoUser.id,
        amount: 4500,
        kind: 'expense',
        categoryId: 'cat-hostel',
        categoryName: 'Hostel & Rent',
        description: 'Hostel shared room rent',
        merchant: 'Hostel Warden Office',
        date: `${curYear}-${mStr}-02`,
        paymentMethod: 'UPI',
        account: 'Primary Bank',
        tags: ['hostel', 'fixed'],
      },
      {
        userId: demoUser.id,
        amount: 1200,
        kind: 'expense',
        categoryId: 'cat-food',
        categoryName: 'Food & Mess',
        description: 'Campus mess weekly advance meal token',
        merchant: 'Campus Canteen',
        date: `${curYear}-${mStr}-03`,
        paymentMethod: 'UPI',
        account: 'Primary Bank',
        tags: ['mess', 'food'],
      },
      {
        userId: demoUser.id,
        amount: 850,
        kind: 'expense',
        categoryId: 'cat-books',
        categoryName: 'Books & Academics',
        description: 'Algorithms textbook & notebook stationery',
        merchant: 'University Bookstore',
        date: `${curYear}-${mStr}-07`,
        paymentMethod: 'Card',
        account: 'Primary Bank',
        tags: ['books', 'study'],
      },
      {
        userId: demoUser.id,
        amount: 349,
        kind: 'expense',
        categoryId: 'cat-bills',
        categoryName: 'Bills & Mobile Recharge',
        description: '5G unlimited student data recharge pack',
        merchant: 'Jio Mobile',
        date: `${curYear}-${mStr}-08`,
        paymentMethod: 'UPI',
        account: 'Digital Wallet',
        tags: ['mobile', 'bills'],
      },
      {
        userId: demoUser.id,
        amount: 420,
        kind: 'expense',
        categoryId: 'cat-transport',
        categoryName: 'Transport & Commute',
        description: 'Metro smartcard monthly top-up',
        merchant: 'City Metro',
        date: `${curYear}-${mStr}-10`,
        paymentMethod: 'UPI',
        account: 'Primary Bank',
        tags: ['metro', 'travel'],
      },
      {
        userId: demoUser.id,
        amount: 680,
        kind: 'expense',
        categoryId: 'cat-entertainment',
        categoryName: 'Entertainment & Outings',
        description: 'Weekend movie and snack with roommates',
        merchant: 'PVR Cinemas',
        date: `${curYear}-${mStr}-12`,
        paymentMethod: 'UPI',
        account: 'Pocket Cash',
        tags: ['weekend', 'friends'],
      },
      {
        userId: demoUser.id,
        amount: 320,
        kind: 'expense',
        categoryId: 'cat-food',
        categoryName: 'Food & Mess',
        description: 'Late night library tea and sandwiches',
        merchant: 'Night Canteen',
        date: `${curYear}-${mStr}-14`,
        paymentMethod: 'UPI',
        account: 'Pocket Cash',
        tags: ['food', 'night'],
      },
    ];

    sampleTransactions.forEach((t) => {
      this.data.transactions.push({
        ...t,
        id: 'tx-' + crypto.randomUUID(),
        amount: roundMoney(t.amount),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
    });

    // Seed budgets
    this.data.budgets.push(
      {
        id: 'b-overall',
        userId: demoUser.id,
        categoryId: null,
        period: 'monthly',
        month: `${curYear}-${mStr}`,
        amount: 15000,
        warningThreshold: 80,
      },
      {
        id: 'b-food',
        userId: demoUser.id,
        categoryId: 'cat-food',
        period: 'monthly',
        month: `${curYear}-${mStr}`,
        amount: 4000,
        warningThreshold: 80,
      },
      {
        id: 'b-hostel',
        userId: demoUser.id,
        categoryId: 'cat-hostel',
        period: 'monthly',
        month: `${curYear}-${mStr}`,
        amount: 5000,
        warningThreshold: 90,
      },
      {
        id: 'b-entertainment',
        userId: demoUser.id,
        categoryId: 'cat-entertainment',
        period: 'monthly',
        month: `${curYear}-${mStr}`,
        amount: 1500,
        warningThreshold: 75,
      }
    );

    // Seed savings goals
    this.data.savingsGoals.push(
      {
        id: 'goal-laptop',
        userId: demoUser.id,
        title: 'MacBook Air for Coding',
        targetAmount: 85000,
        currentAmount: 38000,
        targetDate: `${curYear + 1}-03-31`,
        category: 'Electronics',
        icon: 'Laptop',
        status: 'in_progress',
        createdAt: new Date().toISOString(),
      },
      {
        id: 'goal-emergency',
        userId: demoUser.id,
        title: 'Emergency Medical & Travel Fund',
        targetAmount: 10000,
        currentAmount: 6500,
        targetDate: `${curYear}-12-31`,
        category: 'Emergency',
        icon: 'Shield',
        status: 'in_progress',
        createdAt: new Date().toISOString(),
      },
      {
        id: 'goal-cert',
        userId: demoUser.id,
        title: 'AWS Certified Cloud Practitioner',
        targetAmount: 8000,
        currentAmount: 8000,
        targetDate: `${curYear}-${mStr}-20`,
        category: 'Certification',
        icon: 'Award',
        status: 'completed',
        createdAt: new Date().toISOString(),
      }
    );

    // Seed recurring subscriptions / fees
    this.data.recurringPayments.push(
      {
        id: 'rec-spotify',
        userId: demoUser.id,
        title: 'Spotify Student Premium',
        amount: 59,
        kind: 'expense',
        categoryId: 'cat-entertainment',
        frequency: 'monthly',
        nextDueDate: `${curYear}-${mStr}-25`,
        paymentMethod: 'Card',
        status: 'active',
        autoLog: true,
        notes: 'Student discount plan verified with college email',
      },
      {
        id: 'rec-wifi',
        userId: demoUser.id,
        title: 'Hostel Floor Broadband Sharing',
        amount: 300,
        kind: 'expense',
        categoryId: 'cat-bills',
        frequency: 'monthly',
        nextDueDate: `${curYear}-${mStr}-28`,
        paymentMethod: 'UPI',
        status: 'active',
        autoLog: false,
        notes: 'Pay to Rahul (Room 304)',
      },
      {
        id: 'rec-hostel',
        userId: demoUser.id,
        title: 'Monthly Hostel Room Fee',
        amount: 4500,
        kind: 'expense',
        categoryId: 'cat-hostel',
        frequency: 'monthly',
        nextDueDate: `${curYear}-${(curMonth % 12 + 1).toString().padStart(2, '0')}-02`,
        paymentMethod: 'UPI',
        status: 'active',
        autoLog: false,
        notes: 'Pay by 5th of each month',
      }
    );

    // Seed split bill
    this.data.splitExpenses.push({
      id: 'split-001',
      userId: demoUser.id,
      title: 'Room Groceries & Filter Water Cans',
      totalAmount: 1800,
      userShare: 600,
      date: `${curYear}-${mStr}-06`,
      paidBy: 'Alex Chen',
      status: 'pending',
      participants: [
        { name: 'Alex Chen (You)', amount: 600, settled: true },
        { name: 'Rohan Sharma', amount: 600, settled: true },
        { name: 'Karthik Rao', amount: 600, settled: false },
      ],
    });

    // Seed debt record
    this.data.debts.push(
      {
        id: 'debt-001',
        userId: demoUser.id,
        personName: 'Karthik Rao',
        type: 'owes_you',
        amount: 600,
        description: 'His share for Room Groceries',
        dueDate: `${curYear}-${mStr}-22`,
        status: 'pending',
        createdAt: new Date().toISOString(),
      },
      {
        id: 'debt-002',
        userId: demoUser.id,
        personName: 'Library Dept',
        type: 'you_owe',
        amount: 50,
        description: 'Late return fine for Data Structures book',
        dueDate: `${curYear}-${mStr}-25`,
        status: 'pending',
        createdAt: new Date().toISOString(),
      }
    );

    this.save();
  }

  // --- User Operations ---
  public getUserById(id: string): User | undefined {
    return this.data.users.find((u) => u.id === id);
  }

  public getUserByEmail(email: string): User | undefined {
    return this.data.users.find((u) => u.email.toLowerCase() === email.toLowerCase());
  }

  public createUser(user: User): User {
    this.data.users.push(user);
    this.save();
    return user;
  }

  public updateUser(id: string, updates: Partial<User>): User | null {
    const idx = this.data.users.findIndex((u) => u.id === id);
    if (idx === -1) return null;
    this.data.users[idx] = { ...this.data.users[idx], ...updates };
    this.save();
    return this.data.users[idx];
  }

  public deleteUser(id: string): boolean {
    this.data.users = this.data.users.filter((u) => u.id !== id);
    this.data.transactions = this.data.transactions.filter((t) => t.userId !== id);
    this.data.budgets = this.data.budgets.filter((b) => b.userId !== id);
    this.data.savingsGoals = this.data.savingsGoals.filter((g) => g.userId !== id);
    this.data.recurringPayments = this.data.recurringPayments.filter((r) => r.userId !== id);
    this.data.splitExpenses = this.data.splitExpenses.filter((s) => s.userId !== id);
    this.data.debts = this.data.debts.filter((d) => d.userId !== id);
    this.save();
    return true;
  }

  // --- Category Operations ---
  public getCategories(userId: string): Category[] {
    return this.data.categories.filter((c) => c.userId === null || c.userId === userId);
  }

  public createCategory(userId: string, category: Omit<Category, 'id' | 'userId'>): Category {
    const newCat: Category = {
      ...category,
      id: 'cat-' + crypto.randomUUID(),
      userId,
    };
    this.data.categories.push(newCat);
    this.save();
    return newCat;
  }

  public deleteCategory(userId: string, categoryId: string): boolean {
    const idx = this.data.categories.findIndex((c) => c.id === categoryId && c.userId === userId);
    if (idx === -1) return false;
    this.data.categories.splice(idx, 1);
    this.save();
    return true;
  }

  // --- Transaction Operations ---
  public getTransactions(userId: string): Transaction[] {
    return this.data.transactions
      .filter((t) => t.userId === userId)
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }

  public getTransactionById(userId: string, id: string): Transaction | undefined {
    return this.data.transactions.find((t) => t.id === id && t.userId === userId);
  }

  public createTransaction(userId: string, tx: Omit<Transaction, 'id' | 'userId' | 'createdAt' | 'updatedAt'>): Transaction {
    const newTx: Transaction = {
      ...tx,
      id: 'tx-' + crypto.randomUUID(),
      userId,
      amount: roundMoney(tx.amount),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    this.data.transactions.push(newTx);
    this.save();
    return newTx;
  }

  public updateTransaction(userId: string, id: string, updates: Partial<Transaction>): Transaction | null {
    const idx = this.data.transactions.findIndex((t) => t.id === id && t.userId === userId);
    if (idx === -1) return null;
    if (updates.amount !== undefined) {
      updates.amount = roundMoney(updates.amount);
    }
    this.data.transactions[idx] = {
      ...this.data.transactions[idx],
      ...updates,
      updatedAt: new Date().toISOString(),
    };
    this.save();
    return this.data.transactions[idx];
  }

  public deleteTransaction(userId: string, id: string): boolean {
    const prevLen = this.data.transactions.length;
    this.data.transactions = this.data.transactions.filter((t) => !(t.id === id && t.userId === userId));
    if (this.data.transactions.length !== prevLen) {
      this.save();
      return true;
    }
    return false;
  }

  public bulkDeleteTransactions(userId: string, ids: string[]): number {
    const set = new Set(ids);
    const prevLen = this.data.transactions.length;
    this.data.transactions = this.data.transactions.filter((t) => !(t.userId === userId && set.has(t.id)));
    const deletedCount = prevLen - this.data.transactions.length;
    if (deletedCount > 0) {
      this.save();
    }
    return deletedCount;
  }

  // --- Budgets Operations ---
  public getBudgets(userId: string, month?: string): Budget[] {
    return this.data.budgets.filter((b) => b.userId === userId && (!month || b.month === month));
  }

  public setBudget(userId: string, budget: Omit<Budget, 'id' | 'userId'>): Budget {
    const existingIdx = this.data.budgets.findIndex(
      (b) => b.userId === userId && b.month === budget.month && b.categoryId === budget.categoryId
    );
    const amount = roundMoney(budget.amount);
    if (existingIdx !== -1) {
      this.data.budgets[existingIdx].amount = amount;
      this.data.budgets[existingIdx].warningThreshold = budget.warningThreshold || 80;
      this.save();
      return this.data.budgets[existingIdx];
    } else {
      const newB: Budget = {
        ...budget,
        id: 'b-' + crypto.randomUUID(),
        userId,
        amount,
        warningThreshold: budget.warningThreshold || 80,
      };
      this.data.budgets.push(newB);
      this.save();
      return newB;
    }
  }

  public deleteBudget(userId: string, id: string): boolean {
    const prevLen = this.data.budgets.length;
    this.data.budgets = this.data.budgets.filter((b) => !(b.id === id && b.userId === userId));
    if (this.data.budgets.length !== prevLen) {
      this.save();
      return true;
    }
    return false;
  }

  // --- Savings Goals ---
  public getSavingsGoals(userId: string): SavingsGoal[] {
    return this.data.savingsGoals.filter((g) => g.userId === userId);
  }

  public createSavingsGoal(userId: string, goal: Omit<SavingsGoal, 'id' | 'userId' | 'createdAt'>): SavingsGoal {
    const newGoal: SavingsGoal = {
      ...goal,
      id: 'goal-' + crypto.randomUUID(),
      userId,
      targetAmount: roundMoney(goal.targetAmount),
      currentAmount: roundMoney(goal.currentAmount || 0),
      createdAt: new Date().toISOString(),
    };
    this.data.savingsGoals.push(newGoal);
    this.save();
    return newGoal;
  }

  public updateSavingsGoal(userId: string, id: string, updates: Partial<SavingsGoal>): SavingsGoal | null {
    const idx = this.data.savingsGoals.findIndex((g) => g.id === id && g.userId === userId);
    if (idx === -1) return null;
    if (updates.targetAmount !== undefined) updates.targetAmount = roundMoney(updates.targetAmount);
    if (updates.currentAmount !== undefined) updates.currentAmount = roundMoney(updates.currentAmount);
    this.data.savingsGoals[idx] = { ...this.data.savingsGoals[idx], ...updates };
    this.save();
    return this.data.savingsGoals[idx];
  }

  public deleteSavingsGoal(userId: string, id: string): boolean {
    const prevLen = this.data.savingsGoals.length;
    this.data.savingsGoals = this.data.savingsGoals.filter((g) => !(g.id === id && g.userId === userId));
    if (this.data.savingsGoals.length !== prevLen) {
      this.save();
      return true;
    }
    return false;
  }

  // --- Recurring Payments ---
  public getRecurring(userId: string): RecurringPayment[] {
    return this.data.recurringPayments.filter((r) => r.userId === userId);
  }

  public createRecurring(userId: string, rec: Omit<RecurringPayment, 'id' | 'userId'>): RecurringPayment {
    const newRec: RecurringPayment = {
      ...rec,
      id: 'rec-' + crypto.randomUUID(),
      userId,
      amount: roundMoney(rec.amount),
    };
    this.data.recurringPayments.push(newRec);
    this.save();
    return newRec;
  }

  public updateRecurring(userId: string, id: string, updates: Partial<RecurringPayment>): RecurringPayment | null {
    const idx = this.data.recurringPayments.findIndex((r) => r.id === id && r.userId === userId);
    if (idx === -1) return null;
    if (updates.amount !== undefined) updates.amount = roundMoney(updates.amount);
    this.data.recurringPayments[idx] = { ...this.data.recurringPayments[idx], ...updates };
    this.save();
    return this.data.recurringPayments[idx];
  }

  public deleteRecurring(userId: string, id: string): boolean {
    const prevLen = this.data.recurringPayments.length;
    this.data.recurringPayments = this.data.recurringPayments.filter((r) => !(r.id === id && r.userId === userId));
    if (this.data.recurringPayments.length !== prevLen) {
      this.save();
      return true;
    }
    return false;
  }

  // --- Split Expenses ---
  public getSplits(userId: string): SplitExpense[] {
    return this.data.splitExpenses.filter((s) => s.userId === userId);
  }

  public createSplit(userId: string, split: Omit<SplitExpense, 'id' | 'userId'>): SplitExpense {
    const newSplit: SplitExpense = {
      ...split,
      id: 'split-' + crypto.randomUUID(),
      userId,
      totalAmount: roundMoney(split.totalAmount),
      userShare: roundMoney(split.userShare),
    };
    this.data.splitExpenses.push(newSplit);
    this.save();
    return newSplit;
  }

  public updateSplit(userId: string, id: string, updates: Partial<SplitExpense>): SplitExpense | null {
    const idx = this.data.splitExpenses.findIndex((s) => s.id === id && s.userId === userId);
    if (idx === -1) return null;
    this.data.splitExpenses[idx] = { ...this.data.splitExpenses[idx], ...updates };
    this.save();
    return this.data.splitExpenses[idx];
  }

  public deleteSplit(userId: string, id: string): boolean {
    const prev = this.data.splitExpenses.length;
    this.data.splitExpenses = this.data.splitExpenses.filter((s) => !(s.id === id && s.userId === userId));
    if (this.data.splitExpenses.length !== prev) {
      this.save();
      return true;
    }
    return false;
  }

  // --- Debts ---
  public getDebts(userId: string): DebtRecord[] {
    return this.data.debts.filter((d) => d.userId === userId);
  }

  public createDebt(userId: string, debt: Omit<DebtRecord, 'id' | 'userId' | 'createdAt'>): DebtRecord {
    const newDebt: DebtRecord = {
      ...debt,
      id: 'debt-' + crypto.randomUUID(),
      userId,
      amount: roundMoney(debt.amount),
      createdAt: new Date().toISOString(),
    };
    this.data.debts.push(newDebt);
    this.save();
    return newDebt;
  }

  public updateDebt(userId: string, id: string, updates: Partial<DebtRecord>): DebtRecord | null {
    const idx = this.data.debts.findIndex((d) => d.id === id && d.userId === userId);
    if (idx === -1) return null;
    if (updates.amount !== undefined) updates.amount = roundMoney(updates.amount);
    this.data.debts[idx] = { ...this.data.debts[idx], ...updates };
    this.save();
    return this.data.debts[idx];
  }

  public deleteDebt(userId: string, id: string): boolean {
    const prev = this.data.debts.length;
    this.data.debts = this.data.debts.filter((d) => !(d.id === id && d.userId === userId));
    if (this.data.debts.length !== prev) {
      this.save();
      return true;
    }
    return false;
  }

  /**
   * Complete data export for privacy compliance
   */
  public exportUserData(userId: string) {
    const user = this.getUserById(userId);
    if (!user) return null;
    return {
      profile: {
        id: user.id,
        name: user.name,
        email: user.email,
        currency: user.currency,
        college: user.collegeName,
        semester: user.degreeSemester,
        createdAt: user.createdAt,
      },
      categories: this.getCategories(userId),
      transactions: this.getTransactions(userId),
      budgets: this.getBudgets(userId),
      savingsGoals: this.getSavingsGoals(userId),
      recurringPayments: this.getRecurring(userId),
      splitExpenses: this.getSplits(userId),
      debts: this.getDebts(userId),
      exportDate: new Date().toISOString(),
    };
  }
}

export const db = new Database();
