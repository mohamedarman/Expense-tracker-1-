export type TransactionKind = 'expense' | 'income';
export type PaymentMethod = 'UPI' | 'Cash' | 'Card' | 'Net Banking' | 'Digital Wallet' | 'Other';
export type AccountWallet = 'Primary Bank' | 'Pocket Cash' | 'College ID / Campus Card' | 'Savings' | 'Digital Wallet';
export type BudgetPeriod = 'monthly' | 'semester' | 'weekly';
export type RecurringFrequency = 'daily' | 'weekly' | 'monthly' | 'semester' | 'yearly';
export type DebtType = 'you_owe' | 'owes_you';
export type GoalStatus = 'in_progress' | 'completed';
export type AccountStatus = 'active' | 'suspended';
export type UserRole = 'owner' | 'admin' | 'user';

export interface User {
  id: string;
  name: string;
  email: string;
  currency: string;
  theme: 'dark' | 'light';
  monthlyBudget: number;
  semesterBudget: number;
  semesterEndDate: string;
  collegeName?: string;
  degreeSemester?: string;
  status?: AccountStatus;
  role?: UserRole;
  isAdmin?: boolean;
  emailVerified?: boolean;
  createdAt: string;
  updatedAt?: string;
}

export interface AdminRecord {
  uid: string;
  email: string;
  grantedBy: string;
  role: 'admin' | 'owner';
  createdAt: string;
  updatedAt: string;
}

export interface Category {
  id: string;
  userId: string | null;
  name: string;
  kind: TransactionKind;
  color: string;
  icon: string;
  isEssential: boolean;
  createdAt?: string;
  updatedAt?: string;
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
  date: string;
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
  categoryId: string | null;
  period: BudgetPeriod;
  month: string;
  amount: number;
  warningThreshold: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface CategoryBudgetDetail extends Budget {
  spent: number;
  remaining: number;
  usage: number;
  isExceeded: boolean;
  isWarning: boolean;
}

export interface BudgetResponse {
  month: string;
  overall: {
    limit: number;
    spent: number;
    remaining: number;
    usage: number;
    isExceeded: boolean;
    isWarning: boolean;
  };
  categoryBudgets: CategoryBudgetDetail[];
  allBudgets: Budget[];
}

export interface SavingsGoal {
  id: string;
  userId: string;
  title: string;
  targetAmount: number;
  currentAmount: number;
  targetDate: string;
  category: string;
  icon: string;
  status: GoalStatus;
  createdAt: string;
  updatedAt?: string;
}

export interface RecurringPayment {
  id: string;
  userId: string;
  title: string;
  amount: number;
  kind: TransactionKind;
  categoryId: string;
  frequency: RecurringFrequency;
  nextDueDate: string;
  paymentMethod: PaymentMethod;
  status: 'active' | 'paused' | 'cancelled';
  autoLog: boolean;
  notes?: string;
  createdAt?: string;
  updatedAt?: string;
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
  createdAt?: string;
  updatedAt?: string;
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
  updatedAt?: string;
}

export interface AnalyticsResponse {
  currentMonth: {
    income: number;
    expense: number;
    savings: number;
    budget: number;
    remainingBudget: number;
    essentialExpense: number;
    discretionaryExpense: number;
    daysLeftInMonth: number;
    safeDailySpend: number;
    avgDailySpendSoFar: number;
    healthScore: number;
  };
  categoryBreakdown: {
    name: string;
    amount: number;
    color: string;
    kind: string;
    isEssential: boolean;
  }[];
  monthlyTrends: {
    month: string;
    label: string;
    income: number;
    expense: number;
    savings: number;
  }[];
}

export interface FinancialInsight {
  type: 'alert' | 'success' | 'tip' | 'info';
  title: string;
  message: string;
}
