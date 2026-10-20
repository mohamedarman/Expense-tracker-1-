import {
  User,
  Transaction,
  Category,
  BudgetResponse,
  SavingsGoal,
  RecurringPayment,
  SplitExpense,
  DebtRecord,
  AnalyticsResponse,
  FinancialInsight,
} from './types.ts';

const TOKEN_KEY = 'pennywise_student_auth_token';

export function getStoredToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setStoredToken(token: string) {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearStoredToken() {
  localStorage.removeItem(TOKEN_KEY);
}

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const token = getStoredToken();
  const headers = new Headers(options.headers || {});

  if (!headers.has('Content-Type') && !(options.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }

  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  const res = await fetch(endpoint, {
    ...options,
    headers,
  });

  if (!res.ok) {
    let errMessage = 'Request failed';
    try {
      const data = await res.json();
      errMessage = data.error || errMessage;
    } catch {
      errMessage = `HTTP error ${res.status}: ${res.statusText}`;
    }
    throw new Error(errMessage);
  }

  return res.json();
}

export const api = {
  // Auth
  async register(data: any): Promise<{ user: User; token: string; message: string }> {
    const res = await request<{ user: User; token: string; message: string }>('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify(data),
    });
    setStoredToken(res.token);
    return res;
  },

  async login(email: string, password: string): Promise<{ user: User; token: string; message: string }> {
    const res = await request<{ user: User; token: string; message: string }>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    setStoredToken(res.token);
    return res;
  },

  async getMe(): Promise<{ user: User }> {
    return request<{ user: User }>('/api/auth/me');
  },

  async updateProfile(updates: Partial<User>): Promise<{ user: User; message: string }> {
    return request<{ user: User; message: string }>('/api/auth/profile', {
      method: 'PUT',
      body: JSON.stringify(updates),
    });
  },

  async changePassword(currentPassword: string, newPassword: string): Promise<{ message: string }> {
    return request<{ message: string }>('/api/auth/change-password', {
      method: 'POST',
      body: JSON.stringify({ currentPassword, newPassword }),
    });
  },

  async deleteAccount(): Promise<{ message: string }> {
    return request<{ message: string }>('/api/auth/account', { method: 'DELETE' });
  },

  // Categories
  async getCategories(): Promise<{ categories: Category[] }> {
    return request<{ categories: Category[] }>('/api/categories');
  },

  async createCategory(cat: Partial<Category>): Promise<{ category: Category }> {
    return request<{ category: Category }>('/api/categories', {
      method: 'POST',
      body: JSON.stringify(cat),
    });
  },

  async deleteCategory(id: string): Promise<{ message: string }> {
    return request<{ message: string }>(`/api/categories/${id}`, { method: 'DELETE' });
  },

  // Transactions
  async getTransactions(params: Record<string, any> = {}): Promise<{
    items: Transaction[];
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
    summary: { income: number; expense: number; balance: number };
  }> {
    const query = new URLSearchParams();
    Object.entries(params).forEach(([key, val]) => {
      if (val !== undefined && val !== null && val !== '') {
        query.set(key, String(val));
      }
    });
    const qs = query.toString();
    return request(`/api/transactions${qs ? '?' + qs : ''}`);
  },

  async createTransaction(tx: Partial<Transaction>): Promise<{ transaction: Transaction; message: string }> {
    return request<{ transaction: Transaction; message: string }>('/api/transactions', {
      method: 'POST',
      body: JSON.stringify(tx),
    });
  },

  async updateTransaction(id: string, updates: Partial<Transaction>): Promise<{ transaction: Transaction; message: string }> {
    return request<{ transaction: Transaction; message: string }>(`/api/transactions/${id}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    });
  },

  async deleteTransaction(id: string): Promise<{ message: string }> {
    return request<{ message: string }>(`/api/transactions/${id}`, { method: 'DELETE' });
  },

  async bulkDeleteTransactions(ids: string[]): Promise<{ count: number; message: string }> {
    return request<{ count: number; message: string }>('/api/transactions/bulk-delete', {
      method: 'POST',
      body: JSON.stringify({ ids }),
    });
  },

  async importCsv(rows: any[]): Promise<{ imported: number; skippedDuplicates: number; errors: string[]; message: string }> {
    return request('/api/transactions/import-csv', {
      method: 'POST',
      body: JSON.stringify({ rows }),
    });
  },

  // Budgets
  async getBudgets(month?: string): Promise<BudgetResponse> {
    const qs = month ? `?month=${month}` : '';
    return request<BudgetResponse>(`/api/budgets${qs}`);
  },

  async setBudget(budget: { categoryId?: string | null; amount: number; month?: string; warningThreshold?: number }): Promise<any> {
    return request('/api/budgets', {
      method: 'POST',
      body: JSON.stringify(budget),
    });
  },

  async deleteBudget(id: string): Promise<any> {
    return request(`/api/budgets/${id}`, { method: 'DELETE' });
  },

  // Goals
  async getGoals(): Promise<{ goals: SavingsGoal[] }> {
    return request<{ goals: SavingsGoal[] }>('/api/goals');
  },

  async createGoal(goal: Partial<SavingsGoal>): Promise<{ goal: SavingsGoal }> {
    return request<{ goal: SavingsGoal }>('/api/goals', {
      method: 'POST',
      body: JSON.stringify(goal),
    });
  },

  async depositGoal(id: string, amount: number, recordTransaction: boolean): Promise<any> {
    return request(`/api/goals/${id}/deposit`, {
      method: 'POST',
      body: JSON.stringify({ amount, recordTransaction }),
    });
  },

  async deleteGoal(id: string): Promise<any> {
    return request(`/api/goals/${id}`, { method: 'DELETE' });
  },

  // Recurring
  async getRecurring(): Promise<{ recurring: RecurringPayment[] }> {
    return request<{ recurring: RecurringPayment[] }>('/api/recurring');
  },

  async createRecurring(rec: Partial<RecurringPayment>): Promise<{ recurring: RecurringPayment }> {
    return request<{ recurring: RecurringPayment }>('/api/recurring', {
      method: 'POST',
      body: JSON.stringify(rec),
    });
  },

  async logRecurringTransaction(id: string): Promise<any> {
    return request(`/api/recurring/${id}/log-transaction`, { method: 'POST' });
  },

  async deleteRecurring(id: string): Promise<any> {
    return request(`/api/recurring/${id}`, { method: 'DELETE' });
  },

  // Splits & Debts
  async getSplits(): Promise<{ splits: SplitExpense[] }> {
    return request<{ splits: SplitExpense[] }>('/api/splits');
  },

  async createSplit(split: Partial<SplitExpense>): Promise<{ split: SplitExpense }> {
    return request<{ split: SplitExpense }>('/api/splits', {
      method: 'POST',
      body: JSON.stringify(split),
    });
  },

  async updateSplit(id: string, updates: Partial<SplitExpense>): Promise<any> {
    return request(`/api/splits/${id}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    });
  },

  async deleteSplit(id: string): Promise<any> {
    return request(`/api/splits/${id}`, { method: 'DELETE' });
  },

  async getDebts(): Promise<{ debts: DebtRecord[] }> {
    return request<{ debts: DebtRecord[] }>('/api/debts');
  },

  async createDebt(debt: Partial<DebtRecord>): Promise<{ debt: DebtRecord }> {
    return request<{ debt: DebtRecord }>('/api/debts', {
      method: 'POST',
      body: JSON.stringify(debt),
    });
  },

  async updateDebt(id: string, updates: Partial<DebtRecord>): Promise<any> {
    return request(`/api/debts/${id}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    });
  },

  async deleteDebt(id: string): Promise<any> {
    return request(`/api/debts/${id}`, { method: 'DELETE' });
  },

  // Analytics & Insights
  async getAnalytics(): Promise<AnalyticsResponse> {
    return request<AnalyticsResponse>('/api/analytics');
  },

  async getInsights(): Promise<{ insights: FinancialInsight[]; context: any }> {
    return request<{ insights: FinancialInsight[]; context: any }>('/api/insights');
  },

  // AI Assistant
  async askAI(question: string): Promise<{ answer: string; deterministicCalculation: string }> {
    return request<{ answer: string; deterministicCalculation: string }>('/api/ai/ask', {
      method: 'POST',
      body: JSON.stringify({ question }),
    });
  },
};
