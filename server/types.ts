/**
 * Core domain types and interfaces for Smart Student Expense Tracker
 */

export type TransactionKind = 'expense' | 'income';
export type PaymentMethod = 'UPI' | 'Cash' | 'Card' | 'Net Banking' | 'Digital Wallet' | 'Other';
export type AccountWallet = 'Primary Bank' | 'Pocket Cash' | 'College ID / Campus Card' | 'Savings' | 'Digital Wallet';
export type BudgetPeriod = 'monthly' | 'semester' | 'weekly';
export type RecurringFrequency = 'daily' | 'weekly' | 'monthly' | 'semester' | 'yearly';
export type DebtType = 'you_owe' | 'owes_you';
export type GoalStatus = 'in_progress' | 'completed';

export interface User {
  id: string;
  name: string;
  email: string;
  passwordHash: string;
  salt: string;
  currency: string;
  theme: 'dark' | 'light';
  monthlyBudget: number;
  semesterBudget: number;
  semesterEndDate: string;
  collegeName?: string;
  degreeSemester?: string;
  createdAt: string;
}

export interface Category {
  id: string;
  userId: string | null; // null = global default
  name: string;
  kind: TransactionKind;
  color: string;
  icon: string;
  isEssential: boolean;
}

export interface Transaction {
  id: string;
  userId: string;
  amount: number;
  kind: TransactionKind;
  categoryId: string;
  categoryName: string;
  description: string;
  merchant: string;
  date: string; // YYYY-MM-DD
  paymentMethod: PaymentMethod;
  account: AccountWallet;
  notes?: string;
  tags?: string[];
  receiptUrl?: string;
  recurringId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Budget {
  id: string;
  userId: string;
  categoryId: string | null; // null = overall budget
  period: BudgetPeriod;
  month: string; // YYYY-MM
  amount: number;
  warningThreshold: number; // percentage, e.g. 80
}

export interface SavingsGoal {
  id: string;
  userId: string;
  title: string;
  targetAmount: number;
  currentAmount: number;
  targetDate: string; // YYYY-MM-DD
  category: string;
  icon: string;
  status: GoalStatus;
  createdAt: string;
}

export interface RecurringPayment {
  id: string;
  userId: string;
  title: string;
  amount: number;
  kind: TransactionKind;
  categoryId: string;
  frequency: RecurringFrequency;
  nextDueDate: string; // YYYY-MM-DD
  paymentMethod: PaymentMethod;
  status: 'active' | 'paused' | 'cancelled';
  autoLog: boolean;
  notes?: string;
}

export interface SplitParticipant {
  name: string;
  amount: number;
  settled: boolean;
}

export interface SplitExpense {
  id: string;
  userId: string;
  title: string;
  totalAmount: number;
  userShare: number;
  date: string;
  paidBy: string;
  status: 'pending' | 'settled';
  participants: SplitParticipant[];
}

export interface DebtRecord {
  id: string;
  userId: string;
  personName: string;
  type: DebtType;
  amount: number;
  description: string;
  dueDate: string;
  status: 'pending' | 'settled';
  createdAt: string;
}

export interface DatabaseSchema {
  users: User[];
  categories: Category[];
  transactions: Transaction[];
  budgets: Budget[];
  savingsGoals: SavingsGoal[];
  recurringPayments: RecurringPayment[];
  splitExpenses: SplitExpense[];
  debts: DebtRecord[];
}
