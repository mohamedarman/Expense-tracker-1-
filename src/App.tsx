/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { Navbar } from './components/Navbar.tsx';
import { Sidebar, NavTab } from './components/Sidebar.tsx';
import { DashboardView } from './components/DashboardView.tsx';
import { TransactionsView } from './components/TransactionsView.tsx';
import { BudgetsGoalsView } from './components/BudgetsGoalsView.tsx';
import { StudentHubView } from './components/StudentHubView.tsx';
import { SubscriptionsView } from './components/SubscriptionsView.tsx';
import { AnalyticsView } from './components/AnalyticsView.tsx';
import { SettingsReportsView } from './components/SettingsReportsView.tsx';
import { AdminConsoleView } from './components/AdminConsoleView.tsx';
import { AssistantModal } from './components/AssistantModal.tsx';
import { TransactionFormModal } from './components/TransactionFormModal.tsx';
import { AuthModal } from './components/AuthModal.tsx';
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
  TransactionKind,
} from './types.ts';
import { api, clearLegacyLocalStorage, ensureUserProfileInFirestore } from './api.ts';
import { auth, getRedirectResult } from './firebase.ts';
import { clientStore } from './clientStore.ts';

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [loadingAuth, setLoadingAuth] = useState(true);
  const [currentTab, setCurrentTab] = useState<NavTab>('dashboard');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [currency, setCurrency] = useState('₹');

  // Resource states
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [budgets, setBudgets] = useState<BudgetResponse | null>(null);
  const [goals, setGoals] = useState<SavingsGoal[]>([]);
  const [recurring, setRecurring] = useState<RecurringPayment[]>([]);
  const [splits, setSplits] = useState<SplitExpense[]>([]);
  const [debts, setDebts] = useState<DebtRecord[]>([]);
  const [analytics, setAnalytics] = useState<AnalyticsResponse | null>(null);
  const [insights, setInsights] = useState<FinancialInsight[]>([]);

  // Modals
  const [showAddTxModal, setShowAddTxModal] = useState(false);
  const [addTxDefaultKind, setAddTxDefaultKind] = useState<TransactionKind>('expense');
  const [txToEdit, setTxToEdit] = useState<Transaction | null>(null);
  const [showAIModal, setShowAIModal] = useState(false);

  const clearUserDataState = useCallback(() => {
    setTransactions([]);
    setCategories([]);
    setBudgets(null);
    setGoals([]);
    setRecurring([]);
    setSplits([]);
    setDebts([]);
    setAnalytics(null);
    setInsights([]);
  }, []);

  // Subscribe to Firebase Authentication state changes & check local Email session fallback
  useEffect(() => {
    document.documentElement.classList.add('dark');
    clearLegacyLocalStorage();

    // Handle redirect result if mobile browser used signInWithRedirect
    getRedirectResult(auth)
      .then(async (result) => {
        if (result?.user) {
          clientStore.setCurrentUserId(null);
          const profile = await ensureUserProfileInFirestore(result.user);
          setUser(profile);
          setCurrency(profile.currency || '₹');
        }
      })
      .catch(() => {
        // Ignore redirect check errors when not returning from redirect
      });

    const unsubscribe = onAuthStateChanged(auth, async (fbUser) => {
      if (!fbUser) {
        // Check if user is authenticated via Email/Password session in clientStore
        const localUser = clientStore.getCurrentUser();
        if (localUser) {
          setUser(localUser);
          setCurrency(localUser.currency || '₹');
          if (localUser.theme === 'light') {
            document.documentElement.classList.remove('dark');
          } else {
            document.documentElement.classList.add('dark');
          }
          setLoadingAuth(false);
          return;
        }

        setUser(null);
        clearUserDataState();
        setCurrentTab('dashboard');
        setLoadingAuth(false);
        return;
      }

      try {
        clientStore.setCurrentUserId(null);
        const profile = await ensureUserProfileInFirestore(fbUser);
        setUser(profile);
        setCurrency(profile.currency || '₹');
        if (profile.theme === 'light') {
          document.documentElement.classList.remove('dark');
        } else {
          document.documentElement.classList.add('dark');
        }
      } catch (err) {
        console.error('Error loading authenticated user profile:', err);
        setUser(null);
        clearUserDataState();
      } finally {
        setLoadingAuth(false);
      }
    });

    return () => unsubscribe();
  }, [clearUserDataState]);

  // Fetch all user-scoped data
  const refreshAllData = useCallback(async () => {
    if (!user || user.status === 'suspended') return;
    try {
      const [
        txRes,
        catRes,
        budRes,
        goalRes,
        recRes,
        splitRes,
        debtRes,
        anaRes,
        insRes,
      ] = await Promise.all([
        api.getTransactions({ limit: 100 }),
        api.getCategories(),
        api.getBudgets(),
        api.getGoals(),
        api.getRecurring(),
        api.getSplits(),
        api.getDebts(),
        api.getAnalytics(),
        api.getInsights(),
      ]);

      setTransactions(txRes.items);
      setCategories(catRes.categories);
      setBudgets(budRes);
      setGoals(goalRes.goals);
      setRecurring(recRes.recurring);
      setSplits(splitRes.splits);
      setDebts(debtRes.debts);
      setAnalytics(anaRes);
      setInsights(insRes.insights);
    } catch (err) {
      console.error('Error refreshing app data:', err);
    }
  }, [user]);

  useEffect(() => {
    if (user && user.status !== 'suspended') {
      clearUserDataState();
      refreshAllData();
    } else {
      clearUserDataState();
    }
  }, [user?.id, user?.status, refreshAllData, clearUserDataState]);

  const handleLogout = async () => {
    clearUserDataState();
    setUser(null);
    setCurrentTab('dashboard');
    try {
      await api.logout();
    } catch (err) {
      console.error('Logout error:', err);
    }
  };

  const handleToggleTheme = () => {
    if (!user) return;
    const newTheme = user.theme === 'dark' ? 'light' : 'dark';
    setUser({ ...user, theme: newTheme });
    if (newTheme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    api.updateProfile({ theme: newTheme }).catch(console.error);
  };

  const handleCurrencyChange = (newCurr: string) => {
    setCurrency(newCurr);
    if (user) {
      setUser({ ...user, currency: newCurr });
      api.updateProfile({ currency: newCurr }).catch(console.error);
    }
  };

  const handleOpenAddTx = (defaultKind: TransactionKind = 'expense') => {
    setTxToEdit(null);
    setAddTxDefaultKind(defaultKind);
    setShowAddTxModal(true);
  };

  const handleEditTx = (tx: Transaction) => {
    setTxToEdit(tx);
    setShowAddTxModal(true);
  };

  const handleLogRecurring = async (id: string) => {
    try {
      await api.logRecurringTransaction(id);
      refreshAllData();
    } catch (err: any) {
      console.error(err.message);
    }
  };

  if (loadingAuth) {
    return (
      <div className="h-screen w-screen surface-page flex flex-col items-center justify-center gap-3">
        <div className="w-6 h-6 border-2 border-[var(--border-strong)] border-t-[var(--text-primary)] rounded-full animate-spin" />
        <span className="text-xs text-ink-muted font-mono">Loading CostCurve</span>
      </div>
    );
  }

  if (!user) {
    return (
      <AuthModal
        onSuccess={(u) => {
          clearUserDataState();
          setUser(u);
          setCurrency(u.currency || '₹');
        }}
      />
    );
  }

  // Handle suspended accounts
  if (user.status === 'suspended') {
    return (
      <div className="min-h-screen surface-page text-ink-primary flex items-center justify-center p-6 font-sans">
        <div className="max-w-md w-full p-6 rounded-xl surface-card space-y-4 text-[13px]">
          <div className="text-[12px] font-mono text-negative">Account status: Suspended</div>
          <h1 className="text-[20px] font-medium text-ink-primary">
            Your CostCurve account has been suspended
          </h1>
          <p className="text-ink-secondary leading-relaxed">
            Access to your workspace has been restricted by the platform administrator. If you believe this is an error, please contact the platform owner.
          </p>
          <div className="pt-2">
            <button
              type="button"
              onClick={handleLogout}
              className="h-9 px-4 btn-secondary rounded-lg text-[13px]"
            >
              Sign out
            </button>
          </div>
        </div>
      </div>
    );
  }

  const healthScore = analytics?.currentMonth.healthScore ?? 100;

  return (
    <div className="min-h-screen w-full max-w-full surface-page text-ink-primary flex flex-col font-sans">
      {/* Top Navbar */}
      <Navbar
        user={user}
        onOpenAddTx={handleOpenAddTx}
        onOpenAI={() => setShowAIModal(true)}
        onToggleTheme={handleToggleTheme}
        onLogout={handleLogout}
        onToggleMobileMenu={() => setMobileMenuOpen(!mobileMenuOpen)}
        currency={currency}
        onCurrencyChange={handleCurrencyChange}
      />

      <div className="flex-1 flex min-w-0 w-full">
        {/* Sidebar */}
        <Sidebar
          currentTab={currentTab}
          onSelectTab={setCurrentTab}
          user={user}
          healthScore={healthScore}
          isOpenMobile={mobileMenuOpen}
          onCloseMobile={() => setMobileMenuOpen(false)}
          onOpenAI={() => setShowAIModal(true)}
        />

        {/* Main Content Area */}
        <main className="flex-1 min-w-0 overflow-y-auto p-4 sm:p-6 lg:p-8 max-w-[1440px] mx-auto w-full">
          {currentTab === 'dashboard' && (
            <DashboardView
              user={user}
              currency={currency}
              transactions={transactions}
              budgets={budgets}
              recurring={recurring}
              goals={goals}
              analytics={analytics}
              insights={insights}
              onOpenAddTx={handleOpenAddTx}
              onNavigateTab={setCurrentTab}
              onLogRecurring={handleLogRecurring}
              onEditTx={handleEditTx}
            />
          )}

          {currentTab === 'transactions' && (
            <TransactionsView
              user={user}
              currency={currency}
              transactions={transactions}
              categories={categories}
              onOpenAddTx={handleOpenAddTx}
              onEditTx={handleEditTx}
              onRefresh={refreshAllData}
            />
          )}

          {currentTab === 'budgets' && (
            <BudgetsGoalsView
              user={user}
              currency={currency}
              budgets={budgets}
              goals={goals}
              categories={categories}
              onRefresh={refreshAllData}
            />
          )}

          {currentTab === 'student_hub' && (
            <StudentHubView
              user={user}
              currency={currency}
              splits={splits}
              debts={debts}
              analytics={analytics}
              onRefresh={refreshAllData}
            />
          )}

          {currentTab === 'subscriptions' && (
            <SubscriptionsView
              user={user}
              currency={currency}
              recurring={recurring}
              categories={categories}
              onRefresh={refreshAllData}
              onLogRecurring={handleLogRecurring}
            />
          )}

          {currentTab === 'analytics' && (
            <AnalyticsView
              user={user}
              currency={currency}
              analytics={analytics}
              insights={insights}
            />
          )}

          {currentTab === 'settings' && (
            <SettingsReportsView
              user={user}
              currency={currency}
              categories={categories}
              transactions={transactions}
              budgets={budgets}
              analytics={analytics}
              onRefreshUser={() => {
                api.getMe().then((res) => setUser(res.user));
              }}
              onRefreshAll={refreshAllData}
              onLogout={handleLogout}
            />
          )}

          {currentTab === 'admin' && user.isAdmin && (
            <AdminConsoleView currentUser={user} currency={currency} />
          )}
        </main>
      </div>

      {/* Transaction Add / Edit Modal */}
      <TransactionFormModal
        isOpen={showAddTxModal}
        onClose={() => {
          setShowAddTxModal(false);
          setTxToEdit(null);
        }}
        categories={categories}
        currency={currency}
        transactionToEdit={txToEdit}
        defaultKind={addTxDefaultKind}
        onSuccess={refreshAllData}
      />

      {/* AI Financial Assistant Modal */}
      <AssistantModal
        user={user}
        currency={currency}
        isOpen={showAIModal}
        onClose={() => setShowAIModal(false)}
      />
    </div>
  );
}
