import React from 'react';
import {
  AlertTriangle,
  ArrowDownLeft,
  Calendar,
  CheckCircle2,
  Plus,
  ChevronRight,
  Utensils,
  Coffee,
  Printer,
  Bus,
  BookOpen,
} from 'lucide-react';
import {
  User,
  Transaction,
  BudgetResponse,
  RecurringPayment,
  SavingsGoal,
  AnalyticsResponse,
  FinancialInsight,
} from '../types.ts';
import { NavTab } from './Sidebar.tsx';

interface DashboardViewProps {
  user: User;
  currency: string;
  transactions: Transaction[];
  budgets: BudgetResponse | null;
  recurring: RecurringPayment[];
  goals: SavingsGoal[];
  analytics: AnalyticsResponse | null;
  insights: FinancialInsight[];
  onOpenAddTx: (defaultKind?: 'expense' | 'income') => void;
  onNavigateTab: (tab: NavTab) => void;
  onLogRecurring: (id: string) => void;
  onEditTx: (tx: Transaction) => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  user,
  currency,
  transactions,
  budgets,
  recurring,
  goals,
  analytics,
  onOpenAddTx,
  onNavigateTab,
  onLogRecurring,
  onEditTx,
}) => {
  const currentMonthData = analytics?.currentMonth;
  const recentTransactions = transactions.slice(0, 6);

  const upcomingBills = recurring
    .filter((r) => r.status === 'active')
    .slice(0, 3);

  const safeDailySpend = currentMonthData?.safeDailySpend ?? 0;
  const daysLeft = currentMonthData?.daysLeftInMonth ?? 15;
  const remainingBudget = currentMonthData?.remainingBudget ?? 0;
  const isBudgetExceeded = remainingBudget <= 0;
  const netBalance = (currentMonthData?.income ?? 0) - (currentMonthData?.expense ?? 0);

  // Common quick expenses for college students
  const quickPresets = [
    { label: 'Campus Canteen', amount: 60, icon: Utensils, cat: 'cat-food' },
    { label: 'Tea / Coffee', amount: 40, icon: Coffee, cat: 'cat-food' },
    { label: 'Print & Xerox', amount: 20, icon: Printer, cat: 'cat-academics' },
    { label: 'Metro / Transit', amount: 50, icon: Bus, cat: 'cat-transport' },
    { label: 'Study Supplies', amount: 350, icon: BookOpen, cat: 'cat-academics' },
  ];

  return (
    <div className="space-y-6 pb-12 font-sans">
      {/* 1. Signature Fintech Instrument: Student Daily Safe-to-Spend Velocity */}
      <section
        className={`p-5 rounded-2xl border transition-all ${
          isBudgetExceeded
            ? 'bg-rose-950/20 border-rose-500/30 text-rose-200'
            : 'bg-slate-900/90 border-slate-800 text-slate-100'
        }`}
      >
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1.5">
            {/* Unboxed metadata header */}
            <div className="flex items-center gap-2 text-xs text-slate-400">
              <span className="font-semibold text-slate-300">Daily Safe-to-Spend Allowance</span>
              <span aria-hidden="true" className="text-slate-600">·</span>
              <span className="font-mono text-slate-300">{daysLeft} days remaining in month</span>
            </div>

            <div className="flex items-baseline gap-3">
              <span
                className={`text-3xl sm:text-4xl font-extrabold tracking-tight font-mono tabular-nums ${
                  isBudgetExceeded ? 'text-rose-400' : 'text-teal-300'
                }`}
              >
                {currency}{safeDailySpend.toLocaleString()}
              </span>
              <span className="text-xs text-slate-400 font-medium">/ day velocity</span>
            </div>

            <p className="text-xs text-slate-400 max-w-2xl leading-relaxed">
              {isBudgetExceeded ? (
                <span className="text-rose-300 font-medium flex items-center gap-1.5">
                  <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                  Budget limit exceeded by {currency}{Math.abs(remainingBudget).toLocaleString()}. Pause discretionary expenses until your next stipend or allowance.
                </span>
              ) : (
                <>
                  Mathematically grounded: <span className="text-slate-200 font-mono font-medium">{currency}{remainingBudget.toLocaleString()}</span> remaining budget ÷ <span className="text-slate-200 font-mono font-medium">{daysLeft} days</span>. Spending under this rate ensures you never run short before month end.
                </>
              )}
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => onOpenAddTx('expense')}
              className="px-4 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs flex items-center gap-1.5 transition-colors shadow-sm whitespace-nowrap shrink-0"
            >
              <Plus className="w-4 h-4" /> Log Expense
            </button>
            <button
              onClick={() => onOpenAddTx('income')}
              className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-750 text-emerald-400 font-semibold text-xs flex items-center gap-1.5 border border-slate-700 transition-colors whitespace-nowrap shrink-0"
            >
              <ArrowDownLeft className="w-4 h-4" /> Add Income
            </button>
          </div>
        </div>
      </section>

      {/* Quick Action Presets (College Everyday Micro-Expenses) */}
      <section className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <span className="text-xs font-medium text-slate-400 shrink-0">
          Quick-log preset:
        </span>
        <div className="flex items-center gap-2 flex-wrap">
          {quickPresets.map((preset, idx) => {
            const Icon = preset.icon;
            return (
              <button
                key={idx}
                onClick={() => onOpenAddTx('expense')}
                className="px-2.5 py-1.5 rounded-lg bg-slate-800/60 hover:bg-slate-800 text-slate-300 border border-slate-700/60 text-xs flex items-center gap-1.5 transition-colors group"
                title={`Quick log ${preset.label} (${currency}${preset.amount})`}
              >
                <Icon className="w-3.5 h-3.5 text-teal-400" />
                <span>{preset.label}</span>
                <span className="font-mono text-slate-400 group-hover:text-teal-300 tabular-nums">
                  {currency}{preset.amount}
                </span>
              </button>
            );
          })}
        </div>
      </section>

      {/* 2. Core Financial Indicators (Clean Typography, Tabular Figures) */}
      <section className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
        {/* Net Month Balance */}
        <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800/80 space-y-1">
          <div className="text-xs text-slate-400 font-medium">Net Month Balance</div>
          <div
            className={`text-2xl font-bold font-mono tracking-tight tabular-nums ${
              netBalance >= 0 ? 'text-white' : 'text-rose-400'
            }`}
          >
            {currency}{netBalance.toLocaleString()}
          </div>
          <div className="text-[11px] text-slate-500 flex items-center gap-1">
            <span>Savings rate:</span>
            <span className="text-emerald-400 font-mono font-semibold tabular-nums">
              {currentMonthData?.income
                ? Math.max(
                    0,
                    Math.round(
                      ((currentMonthData.income - currentMonthData.expense) / currentMonthData.income) * 100
                    )
                  )
                : 0}
              %
            </span>
          </div>
        </div>

        {/* Total Month Income */}
        <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800/80 space-y-1">
          <div className="text-xs text-slate-400 font-medium">Allowance &amp; Income</div>
          <div className="text-2xl font-bold font-mono text-emerald-400 tracking-tight tabular-nums">
            +{currency}{(currentMonthData?.income ?? 0).toLocaleString()}
          </div>
          <div className="text-[11px] text-slate-500 truncate">Family allowance, stipends, tutoring</div>
        </div>

        {/* Total Month Expenses */}
        <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800/80 space-y-1">
          <div className="text-xs text-slate-400 font-medium">Recorded Expenses</div>
          <div className="text-2xl font-bold font-mono text-slate-100 tracking-tight tabular-nums">
            {currency}{(currentMonthData?.expense ?? 0).toLocaleString()}
          </div>
          <div className="text-[11px] text-slate-500 font-mono">
            Essential: {currency}{(currentMonthData?.essentialExpense ?? 0).toLocaleString()}
          </div>
        </div>

        {/* Remaining Budget */}
        <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800/80 space-y-1">
          <div className="text-xs text-slate-400 font-medium">Monthly Budget Remaining</div>
          <div
            className={`text-2xl font-bold font-mono tracking-tight tabular-nums ${
              isBudgetExceeded ? 'text-rose-400' : 'text-teal-300'
            }`}
          >
            {currency}{remainingBudget.toLocaleString()}
          </div>
          <div className="text-[11px] text-slate-500 font-mono">
            of {currency}{(currentMonthData?.budget ?? 15000).toLocaleString()} allowance limit
          </div>
        </div>
      </section>

      {/* 3. Budget Utilization Bar */}
      {budgets && (
        <section className="p-4 rounded-xl bg-slate-900/50 border border-slate-800/80 space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold text-slate-300">Monthly Budget Adherence</span>
            <span
              className={`font-mono font-bold tabular-nums ${
                budgets.overall.usage > 100
                  ? 'text-rose-400'
                  : budgets.overall.usage > 80
                  ? 'text-amber-400'
                  : 'text-emerald-400'
              }`}
            >
              {budgets.overall.usage}% utilized ({currency}{budgets.overall.spent.toLocaleString()} / {currency}
              {budgets.overall.limit.toLocaleString()})
            </span>
          </div>
          <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden flex">
            <div
              className={`h-full rounded-full transition-all duration-500 ${
                budgets.overall.usage > 100
                  ? 'bg-rose-500'
                  : budgets.overall.usage > 80
                  ? 'bg-amber-400'
                  : 'bg-emerald-500'
              }`}
              style={{ width: `${Math.min(100, budgets.overall.usage)}%` }}
            />
          </div>
        </section>
      )}

      {/* 4. Cashflow Trend & Category Distribution */}
      <section className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Cashflow Trend */}
        <div className="lg:col-span-2 p-5 rounded-2xl bg-slate-900/80 border border-slate-800/80 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-bold text-white">Monthly Cashflow Trend</h2>
              <p className="text-xs text-slate-400">Income vs. Expenses across recorded months</p>
            </div>
            <div className="flex items-center gap-4 text-xs">
              <span className="flex items-center gap-1.5 text-slate-300">
                <span className="w-2.5 h-2.5 rounded-sm bg-emerald-500" /> Income
              </span>
              <span className="flex items-center gap-1.5 text-slate-300">
                <span className="w-2.5 h-2.5 rounded-sm bg-slate-400" /> Expenses
              </span>
            </div>
          </div>

          <div className="h-44 flex items-end justify-between gap-3 pt-6 pb-2 px-2 border-b border-slate-800">
            {analytics?.monthlyTrends && analytics.monthlyTrends.length > 0 ? (
              analytics.monthlyTrends.map((m, idx) => {
                const maxVal = Math.max(
                  ...analytics.monthlyTrends.map((t) => Math.max(t.income, t.expense)),
                  1000
                );
                const incHeight = Math.max(6, (m.income / maxVal) * 120);
                const expHeight = Math.max(6, (m.expense / maxVal) * 120);

                return (
                  <div key={idx} className="flex-1 flex flex-col items-center gap-2 group">
                    <div className="w-full flex items-end justify-center gap-1 h-32">
                      <div
                        className="w-1/2 max-w-[16px] bg-emerald-500/80 hover:bg-emerald-400 rounded-t transition-all relative"
                        style={{ height: `${incHeight}px` }}
                        title={`${m.label} Income: ${currency}${m.income}`}
                      />
                      <div
                        className="w-1/2 max-w-[16px] bg-slate-400/80 hover:bg-slate-300 rounded-t transition-all relative"
                        style={{ height: `${expHeight}px` }}
                        title={`${m.label} Expense: ${currency}${m.expense}`}
                      />
                    </div>
                    <span className="text-[11px] font-mono text-slate-400">{m.label}</span>
                  </div>
                );
              })
            ) : (
              <div className="w-full flex items-center justify-center text-xs text-slate-500">
                No monthly history available yet.
              </div>
            )}
          </div>
        </div>

        {/* Category Breakdown (Clean typography, hairline progress bars) */}
        <div className="p-5 rounded-2xl bg-slate-900/80 border border-slate-800/80 space-y-4 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold text-white">Expense Categories</h2>
              <button
                onClick={() => onNavigateTab('analytics')}
                className="text-xs text-teal-400 hover:text-teal-300 font-medium"
              >
                View all
              </button>
            </div>
            <p className="text-xs text-slate-400">Current month outgoings</p>

            <div className="mt-4 space-y-3">
              {analytics?.categoryBreakdown && analytics.categoryBreakdown.length > 0 ? (
                analytics.categoryBreakdown.slice(0, 5).map((cat, idx) => {
                  const total = currentMonthData?.expense || 1;
                  const pct = Math.round((cat.amount / total) * 100);
                  return (
                    <div key={idx} className="space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-slate-300 font-medium truncate">{cat.name}</span>
                        <span className="text-slate-400 font-mono tabular-nums">
                          {currency}{cat.amount.toLocaleString()} ({pct}%)
                        </span>
                      </div>
                      <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all duration-300"
                          style={{ width: `${pct}%`, backgroundColor: cat.color }}
                        />
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="py-8 text-center text-xs text-slate-500">
                  No expenses recorded this month.
                </div>
              )}
            </div>
          </div>

          <div className="pt-3 border-t border-slate-800 text-xs text-slate-400 flex items-center justify-between font-mono">
            <span>Essential: {currency}{(currentMonthData?.essentialExpense ?? 0).toLocaleString()}</span>
            <span>Discretionary: {currency}{(currentMonthData?.discretionaryExpense ?? 0).toLocaleString()}</span>
          </div>
        </div>
      </section>

      {/* 5. Recent Activity Ledger & Upcoming Fixed Dues */}
      <section className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent Transactions */}
        <div className="lg:col-span-2 p-5 rounded-2xl bg-slate-900/80 border border-slate-800/80 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-bold text-white">Recent Transactions</h2>
              <p className="text-xs text-slate-400">Latest recorded ledger entries</p>
            </div>
            <button
              onClick={() => onNavigateTab('transactions')}
              className="text-xs text-teal-400 hover:text-teal-300 font-medium flex items-center gap-1"
            >
              See all <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="divide-y divide-slate-800/60">
            {recentTransactions.length > 0 ? (
              recentTransactions.map((tx) => (
                <div
                  key={tx.id}
                  onClick={() => onEditTx(tx)}
                  className="py-3 flex items-center justify-between hover:bg-slate-800/30 px-2 rounded-lg cursor-pointer transition-colors group"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-slate-800 flex items-center justify-center text-slate-400 text-xs font-semibold shrink-0 font-mono">
                      {tx.kind === 'income' ? '+' : '–'}
                    </div>
                    <div>
                      <div className="text-xs font-semibold text-slate-200 group-hover:text-white transition-colors">
                        {tx.description || tx.categoryName}
                      </div>
                      {/* Quiet unboxed metadata */}
                      <div className="text-[11px] text-slate-400 flex items-center gap-1.5 mt-0.5">
                        <span className="font-mono">{tx.date}</span>
                        <span aria-hidden="true">·</span>
                        <span className="text-slate-300">{tx.categoryName}</span>
                        {tx.merchant && (
                          <>
                            <span aria-hidden="true">·</span>
                            <span className="truncate max-w-[120px] text-slate-400">{tx.merchant}</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  <div
                    className={`text-xs font-bold font-mono tabular-nums ${
                      tx.kind === 'income' ? 'text-emerald-400' : 'text-slate-200'
                    }`}
                  >
                    {tx.kind === 'income' ? '+' : '–'}{currency}{tx.amount.toLocaleString()}
                  </div>
                </div>
              ))
            ) : (
              <div className="py-8 text-center text-xs text-slate-500">
                No recent transactions found. Click "+ Log Expense" above to start!
              </div>
            )}
          </div>
        </div>

        {/* Upcoming Subscriptions & Goals */}
        <div className="space-y-4">
          {/* Upcoming Bills */}
          <div className="p-5 rounded-2xl bg-slate-900/80 border border-slate-800/80 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-semibold text-slate-300">
                Upcoming recurring bills
              </h3>
              <button
                onClick={() => onNavigateTab('subscriptions')}
                className="text-[11px] text-teal-400 hover:text-teal-300 font-medium"
              >
                Manage
              </button>
            </div>

            <div className="space-y-2">
              {upcomingBills.length > 0 ? (
                upcomingBills.map((bill) => (
                  <div
                    key={bill.id}
                    className="p-3 rounded-xl bg-slate-800/40 border border-slate-700/40 flex items-center justify-between text-xs"
                  >
                    <div>
                      <div className="font-semibold text-slate-200">{bill.title}</div>
                      <div className="text-[11px] text-slate-400 flex items-center gap-1 mt-0.5 font-mono">
                        <Calendar className="w-3 h-3 text-slate-500" />
                        <span>Due {bill.nextDueDate}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-slate-200 font-mono tabular-nums">
                        {currency}{bill.amount.toLocaleString()}
                      </span>
                      <button
                        onClick={() => onLogRecurring(bill.id)}
                        className="px-2.5 py-1 bg-teal-500/15 hover:bg-teal-500/25 text-teal-300 border border-teal-500/30 rounded text-[10px] font-semibold transition-colors"
                        title="Mark as paid and record transaction"
                      >
                        Pay
                      </button>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-xs text-slate-500 py-3 text-center">
                  No upcoming bills scheduled.
                </div>
              )}
            </div>
          </div>

          {/* Active Savings Goals Card */}
          <div className="p-5 rounded-2xl bg-slate-900/80 border border-slate-800/80 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-semibold text-slate-300">
                Savings goals
              </h3>
              <button
                onClick={() => onNavigateTab('budgets')}
                className="text-[11px] text-teal-400 hover:text-teal-300 font-medium"
              >
                Goals
              </button>
            </div>

            <div className="space-y-3">
              {goals.slice(0, 2).map((goal) => {
                const pct = Math.min(100, Math.round((goal.currentAmount / goal.targetAmount) * 100));
                return (
                  <div key={goal.id} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-medium text-slate-300">{goal.title}</span>
                      <span className="font-mono text-slate-400 tabular-nums">
                        {currency}{goal.currentAmount.toLocaleString()} / {currency}
                        {goal.targetAmount.toLocaleString()} ({pct}%)
                      </span>
                    </div>
                    <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-teal-400 rounded-full"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};
