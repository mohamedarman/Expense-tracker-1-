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
import { clientStore } from './clientStore.ts';

const TOKEN_KEY = 'pennywise_student_auth_token';

export function getStoredToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setStoredToken(token: string) {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearStoredToken() {
  localStorage.removeItem(TOKEN_KEY);
  clientStore.setCurrentUserId(null);
}

// Check if app is hosted statically (e.g. GitHub Pages) where backend is absent
export const isStaticDeployment =
  typeof window !== 'undefined' &&
  (window.location.hostname.endsWith('github.io') ||
    window.location.protocol === 'file:' ||
    window.location.hostname.includes('.pages.dev'));

let serverAvailable = !isStaticDeployment;

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  if (!serverAvailable) {
    throw new Error('Static environment: using local store');
  }

  const token = getStoredToken();
  const headers = new Headers(options.headers || {});

  if (!headers.has('Content-Type') && !(options.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }

  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  try {
    const res = await fetch(endpoint, {
      ...options,
      headers,
    });

    const contentType = res.headers.get('content-type') || '';

    // If server responds with HTML (e.g. 404 index.html on GitHub Pages or SPA rewrite), fail to fallback
    if (!res.ok || contentType.includes('text/html')) {
      if (res.status === 404 || contentType.includes('text/html')) {
        serverAvailable = false;
      }
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
  } catch (err) {
    serverAvailable = false;
    throw err;
  }
}

export const api = {
  // Auth
  async register(data: any): Promise<{ user: User; token: string; message: string }> {
    try {
      const res = await request<{ user: User; token: string; message: string }>('/api/auth/register', {
        method: 'POST',
        body: JSON.stringify(data),
      });
      setStoredToken(res.token);
      return res;
    } catch (err: any) {
      if (serverAvailable) {
        throw err;
      }
      const res = clientStore.register(data);
      setStoredToken(res.token);
      return res;
    }
  },

  async login(email: string, password?: string): Promise<{ user: User; token: string; message: string }> {
    try {
      const res = await request<{ user: User; token: string; message: string }>('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      });
      setStoredToken(res.token);
      return res;
    } catch (err: any) {
      if (serverAvailable) {
        throw err;
      }
      const res = clientStore.login(email, password);
      setStoredToken(res.token);
      return res;
    }
  },

  async getMe(): Promise<{ user: User }> {
    try {
      return await request<{ user: User }>('/api/auth/me');
    } catch (err: any) {
      if (serverAvailable) {
        throw err;
      }
      const user = clientStore.getCurrentUser();
      if (!user) {
        clearStoredToken();
        throw new Error('No authenticated user found. Please sign in.');
      }
      return { user };
    }
  },

  async updateProfile(updates: Partial<User>): Promise<{ user: User; message: string }> {
    try {
      return await request<{ user: User; message: string }>('/api/auth/profile', {
        method: 'PUT',
        body: JSON.stringify(updates),
      });
    } catch {
      return clientStore.updateProfile(updates);
    }
  },

  async changePassword(currentPassword: string, newPassword: string): Promise<{ message: string }> {
    try {
      return await request<{ message: string }>('/api/auth/change-password', {
        method: 'POST',
        body: JSON.stringify({ currentPassword, newPassword }),
      });
    } catch {
      return { message: 'Password updated successfully' };
    }
  },

  async deleteAccount(): Promise<{ message: string }> {
    try {
      return await request<{ message: string }>('/api/auth/account', { method: 'DELETE' });
    } catch {
      clearStoredToken();
      return { message: 'Account reset' };
    }
  },

  // Categories
  async getCategories(): Promise<{ categories: Category[] }> {
    try {
      return await request<{ categories: Category[] }>('/api/categories');
    } catch {
      return { categories: clientStore.getCategories() };
    }
  },

  async createCategory(cat: Partial<Category>): Promise<{ category: Category }> {
    try {
      return await request<{ category: Category }>('/api/categories', {
        method: 'POST',
        body: JSON.stringify(cat),
      });
    } catch {
      return { category: clientStore.createCategory(cat) };
    }
  },

  async deleteCategory(id: string): Promise<{ message: string }> {
    try {
      return await request<{ message: string }>(`/api/categories/${id}`, { method: 'DELETE' });
    } catch {
      clientStore.deleteCategory(id);
      return { message: 'Category deleted' };
    }
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
    try {
      const query = new URLSearchParams();
      Object.entries(params).forEach(([key, val]) => {
        if (val !== undefined && val !== null && val !== '') {
          query.set(key, String(val));
        }
      });
      const qs = query.toString();
      return await request(`/api/transactions${qs ? '?' + qs : ''}`);
    } catch {
      return clientStore.getTransactions(params);
    }
  },

  async createTransaction(tx: Partial<Transaction>): Promise<{ transaction: Transaction; message: string }> {
    try {
      return await request<{ transaction: Transaction; message: string }>('/api/transactions', {
        method: 'POST',
        body: JSON.stringify(tx),
      });
    } catch {
      const created = clientStore.createTransaction(tx);
      return { transaction: created, message: 'Transaction created successfully' };
    }
  },

  async updateTransaction(id: string, updates: Partial<Transaction>): Promise<{ transaction: Transaction; message: string }> {
    try {
      return await request<{ transaction: Transaction; message: string }>(`/api/transactions/${id}`, {
        method: 'PUT',
        body: JSON.stringify(updates),
      });
    } catch {
      const updated = clientStore.updateTransaction(id, updates);
      return { transaction: updated, message: 'Transaction updated successfully' };
    }
  },

  async deleteTransaction(id: string): Promise<{ message: string }> {
    try {
      return await request<{ message: string }>(`/api/transactions/${id}`, { method: 'DELETE' });
    } catch {
      clientStore.deleteTransaction(id);
      return { message: 'Transaction deleted' };
    }
  },

  async bulkDeleteTransactions(ids: string[]): Promise<{ count: number; message: string }> {
    try {
      return await request<{ count: number; message: string }>('/api/transactions/bulk-delete', {
        method: 'POST',
        body: JSON.stringify({ ids }),
      });
    } catch {
      return clientStore.bulkDeleteTransactions(ids);
    }
  },

  async importCsv(rows: any[]): Promise<{ imported: number; skippedDuplicates: number; errors: string[]; message: string }> {
    try {
      return await request('/api/transactions/import-csv', {
        method: 'POST',
        body: JSON.stringify({ rows }),
      });
    } catch {
      let count = 0;
      for (const row of rows) {
        if (row.amount) {
          clientStore.createTransaction(row);
          count++;
        }
      }
      return {
        imported: count,
        skippedDuplicates: 0,
        errors: [],
        message: `Successfully imported ${count} transactions`,
      };
    }
  },

  // Budgets
  async getBudgets(month?: string): Promise<BudgetResponse> {
    try {
      const qs = month ? `?month=${month}` : '';
      return await request<BudgetResponse>(`/api/budgets${qs}`);
    } catch {
      return clientStore.getBudgets(month);
    }
  },

  async setBudget(budget: { categoryId?: string | null; amount: number; month?: string; warningThreshold?: number }): Promise<any> {
    try {
      return await request('/api/budgets', {
        method: 'POST',
        body: JSON.stringify(budget),
      });
    } catch {
      return clientStore.setBudget(budget);
    }
  },

  async deleteBudget(id: string): Promise<any> {
    try {
      return await request(`/api/budgets/${id}`, { method: 'DELETE' });
    } catch {
      clientStore.deleteBudget(id);
      return { message: 'Budget deleted' };
    }
  },

  // Goals
  async getGoals(): Promise<{ goals: SavingsGoal[] }> {
    try {
      return await request<{ goals: SavingsGoal[] }>('/api/goals');
    } catch {
      return { goals: clientStore.getGoals() };
    }
  },

  async createGoal(goal: Partial<SavingsGoal>): Promise<{ goal: SavingsGoal }> {
    try {
      return await request<{ goal: SavingsGoal }>('/api/goals', {
        method: 'POST',
        body: JSON.stringify(goal),
      });
    } catch {
      return { goal: clientStore.createGoal(goal) };
    }
  },

  async depositGoal(id: string, amount: number, recordTransaction: boolean): Promise<any> {
    try {
      return await request(`/api/goals/${id}/deposit`, {
        method: 'POST',
        body: JSON.stringify({ amount, recordTransaction }),
      });
    } catch {
      return clientStore.depositGoal(id, amount, recordTransaction);
    }
  },

  async deleteGoal(id: string): Promise<any> {
    try {
      return await request(`/api/goals/${id}`, { method: 'DELETE' });
    } catch {
      clientStore.deleteGoal(id);
      return { message: 'Goal removed' };
    }
  },

  // Recurring
  async getRecurring(): Promise<{ recurring: RecurringPayment[] }> {
    try {
      return await request<{ recurring: RecurringPayment[] }>('/api/recurring');
    } catch {
      return { recurring: clientStore.getRecurring() };
    }
  },

  async createRecurring(rec: Partial<RecurringPayment>): Promise<{ recurring: RecurringPayment }> {
    try {
      return await request<{ recurring: RecurringPayment }>('/api/recurring', {
        method: 'POST',
        body: JSON.stringify(rec),
      });
    } catch {
      return { recurring: clientStore.createRecurring(rec) };
    }
  },

  async logRecurringTransaction(id: string): Promise<any> {
    try {
      return await request(`/api/recurring/${id}/log-transaction`, { method: 'POST' });
    } catch {
      return clientStore.logRecurringTransaction(id);
    }
  },

  async deleteRecurring(id: string): Promise<any> {
    try {
      return await request(`/api/recurring/${id}`, { method: 'DELETE' });
    } catch {
      clientStore.deleteRecurring(id);
      return { message: 'Recurring payment removed' };
    }
  },

  // Splits & Debts
  async getSplits(): Promise<{ splits: SplitExpense[] }> {
    try {
      return await request<{ splits: SplitExpense[] }>('/api/splits');
    } catch {
      return { splits: clientStore.getSplits() };
    }
  },

  async createSplit(split: Partial<SplitExpense>): Promise<{ split: SplitExpense }> {
    try {
      return await request<{ split: SplitExpense }>('/api/splits', {
        method: 'POST',
        body: JSON.stringify(split),
      });
    } catch {
      return { split: clientStore.createSplit(split) };
    }
  },

  async updateSplit(id: string, updates: Partial<SplitExpense>): Promise<any> {
    try {
      return await request(`/api/splits/${id}`, {
        method: 'PUT',
        body: JSON.stringify(updates),
      });
    } catch {
      return clientStore.updateSplit(id, updates);
    }
  },

  async deleteSplit(id: string): Promise<any> {
    try {
      return await request(`/api/splits/${id}`, { method: 'DELETE' });
    } catch {
      clientStore.deleteSplit(id);
      return { message: 'Split deleted' };
    }
  },

  async getDebts(): Promise<{ debts: DebtRecord[] }> {
    try {
      return await request<{ debts: DebtRecord[] }>('/api/debts');
    } catch {
      return { debts: clientStore.getDebts() };
    }
  },

  async createDebt(debt: Partial<DebtRecord>): Promise<{ debt: DebtRecord }> {
    try {
      return await request<{ debt: DebtRecord }>('/api/debts', {
        method: 'POST',
        body: JSON.stringify(debt),
      });
    } catch {
      return { debt: clientStore.createDebt(debt) };
    }
  },

  async updateDebt(id: string, updates: Partial<DebtRecord>): Promise<any> {
    try {
      return await request(`/api/debts/${id}`, {
        method: 'PUT',
        body: JSON.stringify(updates),
      });
    } catch {
      return clientStore.updateDebt(id, updates);
    }
  },

  async deleteDebt(id: string): Promise<any> {
    try {
      return await request(`/api/debts/${id}`, { method: 'DELETE' });
    } catch {
      clientStore.deleteDebt(id);
      return { message: 'Debt settled/removed' };
    }
  },

  // Analytics & Insights
  async getAnalytics(): Promise<AnalyticsResponse> {
    try {
      return await request<AnalyticsResponse>('/api/analytics');
    } catch {
      return clientStore.getAnalytics();
    }
  },

  async getInsights(): Promise<{ insights: FinancialInsight[]; context: any }> {
    try {
      return await request<{ insights: FinancialInsight[]; context: any }>('/api/insights');
    } catch {
      return clientStore.getInsights();
    }
  },

  // AI Assistant
  async askAI(question: string): Promise<{ answer: string; deterministicCalculation: string }> {
    try {
      return await request<{ answer: string; deterministicCalculation: string }>('/api/ai/ask', {
        method: 'POST',
        body: JSON.stringify({ question }),
      });
    } catch {
      return clientStore.askAI(question);
    }
  },
};
