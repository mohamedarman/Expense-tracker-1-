/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback } from 'react';
import { Navbar } from './components/Navbar.tsx';
import { Sidebar, NavTab } from './components/Sidebar.tsx';
import { DashboardView } from './components/DashboardView.tsx';
import { TransactionsView } from './components/TransactionsView.tsx';
import { BudgetsGoalsView } from './components/BudgetsGoalsView.tsx';
import { StudentHubView } from './components/StudentHubView.tsx';
import { SubscriptionsView } from './components/SubscriptionsView.tsx';
import { AnalyticsView } from './components/AnalyticsView.tsx';
import { SettingsReportsView } from './components/SettingsReportsView.tsx';
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
import { api, getStoredToken, clearStoredToken } from './api.ts';

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

  // Load active session
  useEffect(() => {
    const token = getStoredToken();
    if (!token) {
      setLoadingAuth(false);
      return;
    }
    api
      .getMe()
      .then((res) => {
        setUser(res.user);
        setCurrency(res.user.currency || '₹');
        if (res.user.theme === 'light') {
          document.documentElement.classList.remove('dark');
        } else {
          document.documentElement.classList.add('dark');
        }
      })
      .catch(() => {
        clearStoredToken();
        setUser(null);
      })
      .finally(() => {
        setLoadingAuth(false);
      });
  }, []);

  // Fetch all applet data
  const refreshAllData = useCallback(async () => {
    if (!user) return;
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

  useEffect(() => {
    if (user) {
      clearUserDataState();
      refreshAllData();
    } else {
      clearUserDataState();
    }
  }, [user?.id, refreshAllData, clearUserDataState]);

  const handleLogout = () => {
    clearStoredToken();
    setUser(null);
    clearUserDataState();
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
      alert(err.message);
    }
  };

  if (loadingAuth) {
    return (
      <div className="h-screen w-screen bg-slate-950 flex flex-col items-center justify-center space-y-3">
        <div className="w-10 h-10 border-4 border-emerald-500/20 border-t-emerald-500 rounded-full animate-spin" />
        <span className="text-xs text-slate-400 font-mono">Initializing Pennywise...</span>
      </div>
    );
  }

  if (!user) {
    return <AuthModal onSuccess={(u) => setUser(u)} />;
  }

  const healthScore = analytics?.currentMonth.healthScore ?? 85;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-teal-500/30 selection:text-teal-200">
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

      <div className="flex-1 flex overflow-hidden">
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
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto w-full">
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
