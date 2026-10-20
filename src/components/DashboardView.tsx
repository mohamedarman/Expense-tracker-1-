import React from 'react';
import {
  TrendingUp,
  TrendingDown,
  Wallet,
  AlertTriangle,
  ArrowUpRight,
  ArrowDownLeft,
  Calendar,
  Clock,
  Sparkles,
  CheckCircle2,
  Plus,
  Target,
  Users,
  ChevronRight,
  CreditCard,
} from 'lucide-react';
import { User, Transaction, BudgetResponse, RecurringPayment, SavingsGoal, AnalyticsResponse, FinancialInsight } from '../types.ts';

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
  onNavigateTab: (tab: any) => void;
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
  insights,
  onOpenAddTx,
  onNavigateTab,
  onLogRecurring,
  onEditTx,
}) => {
  const currentMonthData = analytics?.currentMonth;
  const recentTransactions = transactions.slice(0, 6);

  // Calculate upcoming recurring payments in the next 14 days
  const upcomingBills = recurring
    .filter((r) => r.status === 'active')
    .slice(0, 3);

  const safeDailySpend = currentMonthData?.safeDailySpend ?? 0;
  const daysLeft = currentMonthData?.daysLeftInMonth ?? 15;
  const isBudgetExceeded = (currentMonthData?.remainingBudget ?? 0) <= 0;

  return (
    <div className="space-y-6 pb-12">
      {/* Top Banner: Daily Safe-to-Spend Gauge */}
      <div className={`p-4 md:p-5 rounded-2xl border transition-all ${
        isBudgetExceeded
          ? 'bg-gradient-to-r from-red-950/40 via-red-900/20 to-slate-900/80 border-red-500/30'
          : 'bg-gradient-to-r from-teal-950/40 via-slate-900/90 to-emerald-950/30 border-teal-500/30'
      }`}>
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-start gap-3.5">
            <div className={`p-2.5 rounded-xl mt-0.5 ${
              isBudgetExceeded ? 'bg-red-500/20 text-red-400' : 'bg-teal-500/20 text-teal-300'
            }`}>
              {isBudgetExceeded ? <AlertTriangle className="w-5 h-5" /> : <Sparkles className="w-5 h-5" />}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs uppercase tracking-wider font-semibold text-slate-400">
                  Student Daily Allowance Velocity
                </span>
                <span className="text-[11px] px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700">
                  {daysLeft} days remaining
                </span>
              </div>
              <div className="flex items-baseline gap-2 mt-1">
                <span className={`text-2xl md:text-3xl font-extrabold tracking-tight ${
                  isBudgetExceeded ? 'text-red-400' : 'text-teal-300'
                }`}>
                  {currency}{safeDailySpend.toLocaleString()}
                </span>
                <span className="text-xs text-slate-400 font-medium">/ day safe spending limit</span>
              </div>
              <p className="text-xs text-slate-400 mt-1">
                {isBudgetExceeded
                  ? `You have exceeded your monthly limit by ${currency}${Math.abs(currentMonthData?.remainingBudget || 0).toLocaleString()}. Avoid discretionary spending until the 1st.`
                  : `Calculated from your remaining monthly budget of ${currency}${(currentMonthData?.remainingBudget ?? 0).toLocaleString()} divided by ${daysLeft} days left.`}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              onClick={() => onOpenAddTx('expense')}
              className="px-3.5 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-semibold text-xs flex items-center gap-1.5 transition-colors shadow"
            >
              <Plus className="w-4 h-4" /> Log Expense
            </button>
            <button
              onClick={() => onOpenAddTx('income')}
              className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-emerald-400 font-semibold text-xs flex items-center gap-1.5 border border-slate-700 transition-colors"
            >
              <ArrowDownLeft className="w-4 h-4" /> Add Income
            </button>
          </div>
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5 md:gap-4">
        {/* Total Balance */}
        <div className="p-4 rounded-xl bg-slate-900/70 border border-slate-800/80 space-y-2">
          <div className="flex items-center justify-between text-xs text-slate-400 font-medium">
            <span>Net Balance</span>
            <Wallet className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-xl md:text-2xl font-bold text-white tracking-tight">
            {currency}{((currentMonthData?.income ?? 0) - (currentMonthData?.expense ?? 0)).toLocaleString()}
          </div>
          <div className="text-[11px] text-slate-500 flex items-center gap-1">
            <span>Savings rate:</span>
            <span className="text-emerald-400 font-semibold">
              {currentMonthData?.income ? Math.max(0, Math.round(((currentMonthData.income - currentMonthData.expense) / currentMonthData.income) * 100)) : 0}%
            </span>
          </div>
        </div>

        {/* Total Income */}
        <div className="p-4 rounded-xl bg-slate-900/70 border border-slate-800/80 space-y-2">
          <div className="flex items-center justify-between text-xs text-slate-400 font-medium">
            <span>Month Income</span>
            <ArrowDownLeft className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-xl md:text-2xl font-bold text-emerald-400 tracking-tight">
            +{currency}{(currentMonthData?.income ?? 0).toLocaleString()}
          </div>
          <div className="text-[11px] text-slate-500">Allowance, job &amp; scholarships</div>
        </div>

        {/* Total Expenses */}
        <div className="p-4 rounded-xl bg-slate-900/70 border border-slate-800/80 space-y-2">
          <div className="flex items-center justify-between text-xs text-slate-400 font-medium">
            <span>Month Expenses</span>
            <ArrowUpRight className="w-4 h-4 text-rose-400" />
          </div>
          <div className="text-xl md:text-2xl font-bold text-rose-400 tracking-tight">
            -{currency}{(currentMonthData?.expense ?? 0).toLocaleString()}
          </div>
          <div className="text-[11px] text-slate-500">
            Essential: {currency}{(currentMonthData?.essentialExpense ?? 0).toLocaleString()}
          </div>
        </div>

        {/* Remaining Budget */}
        <div className="p-4 rounded-xl bg-slate-900/70 border border-slate-800/80 space-y-2">
          <div className="flex items-center justify-between text-xs text-slate-400 font-medium">
            <span>Monthly Budget</span>
            <Target className="w-4 h-4 text-teal-400" />
          </div>
          <div className={`text-xl md:text-2xl font-bold tracking-tight ${
            isBudgetExceeded ? 'text-red-400' : 'text-white'
          }`}>
            {currency}{(currentMonthData?.remainingBudget ?? 0).toLocaleString()}
          </div>
          <div className="text-[11px] text-slate-500">
            of {currency}{(currentMonthData?.budget ?? 0).toLocaleString()} limit
          </div>
        </div>
      </div>

      {/* Budget Progress Bar */}
      {budgets && (
        <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800/80 space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold text-slate-300">Monthly Budget Utilization</span>
            <span className={`font-mono font-bold ${
              budgets.overall.usage > 90 ? 'text-rose-400' : budgets.overall.usage > 75 ? 'text-amber-400' : 'text-emerald-400'
            }`}>
              {budgets.overall.usage}% utilized ({currency}{budgets.overall.spent.toLocaleString()} / {currency}{budgets.overall.limit.toLocaleString()})
            </span>
          </div>
          <div className="w-full h-2.5 bg-slate-800 rounded-full overflow-hidden flex">
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
        </div>
      )}

      {/* Main Grid: Trends & Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* 6-Month Income vs Expenses Chart */}
        <div className="lg:col-span-2 p-5 rounded-2xl bg-slate-900/80 border border-slate-800/80 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-bold text-white">Monthly Cashflow Trend</h2>
              <p className="text-xs text-slate-400">Income vs. Expenses across past 6 months</p>
            </div>
            <div className="flex items-center gap-3 text-xs">
              <span className="flex items-center gap-1.5 text-slate-400">
                <span className="w-2.5 h-2.5 rounded-sm bg-emerald-500" /> Income
              </span>
              <span className="flex items-center gap-1.5 text-slate-400">
                <span className="w-2.5 h-2.5 rounded-sm bg-rose-500" /> Expenses
              </span>
            </div>
          </div>

          {/* Bar Chart Visualization */}
          <div className="h-48 flex items-end justify-between gap-3 pt-6 pb-2 px-2 border-b border-slate-800">
            {analytics?.monthlyTrends && analytics.monthlyTrends.length > 0 ? (
              analytics.monthlyTrends.map((m, idx) => {
                const maxVal = Math.max(
                  ...analytics.monthlyTrends.map((t) => Math.max(t.income, t.expense)),
                  1000
                );
                const incHeight = Math.max(8, (m.income / maxVal) * 140);
                const expHeight = Math.max(8, (m.expense / maxVal) * 140);

                return (
                  <div key={idx} className="flex-1 flex flex-col items-center gap-2 group">
                    <div className="w-full flex items-end justify-center gap-1 h-36">
                      <div
                        className="w-1/2 max-w-[18px] bg-emerald-500/80 hover:bg-emerald-400 rounded-t transition-all relative"
                        style={{ height: `${incHeight}px` }}
                        title={`${m.label} Income: ${currency}${m.income}`}
                      />
                      <div
                        className="w-1/2 max-w-[18px] bg-rose-500/80 hover:bg-rose-400 rounded-t transition-all relative"
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

        {/* Category Breakdown */}
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
            <p className="text-xs text-slate-400">Current month outflows</p>

            <div className="mt-4 space-y-2.5">
              {analytics?.categoryBreakdown && analytics.categoryBreakdown.length > 0 ? (
                analytics.categoryBreakdown.slice(0, 5).map((cat, idx) => {
                  const total = currentMonthData?.expense || 1;
                  const pct = Math.round((cat.amount / total) * 100);
                  return (
                    <div key={idx} className="space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-slate-300 font-medium truncate">{cat.name}</span>
                        <span className="text-slate-400 font-mono">
                          {currency}{cat.amount.toLocaleString()} ({pct}%)
                        </span>
                      </div>
                      <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full"
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

          <div className="pt-3 border-t border-slate-800 text-xs text-slate-400 flex items-center justify-between">
            <span>Essential: {currency}{(currentMonthData?.essentialExpense ?? 0).toLocaleString()}</span>
            <span>Discretionary: {currency}{(currentMonthData?.discretionaryExpense ?? 0).toLocaleString()}</span>
          </div>
        </div>
      </div>

      {/* Bottom Grid: Recent Transactions & Upcoming Bills */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent Transactions */}
        <div className="lg:col-span-2 p-5 rounded-2xl bg-slate-900/80 border border-slate-800/80 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-bold text-white">Recent Transactions</h2>
              <p className="text-xs text-slate-400">Latest activity on your account</p>
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
                    <div className={`p-2 rounded-xl text-xs font-bold ${
                      tx.kind === 'income' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-400'
                    }`}>
                      {tx.kind === 'income' ? <ArrowDownLeft className="w-4 h-4" /> : <ArrowUpRight className="w-4 h-4" />}
                    </div>
                    <div>
                      <div className="text-xs font-semibold text-slate-200 group-hover:text-white transition-colors">
                        {tx.description || tx.categoryName}
                      </div>
                      <div className="text-[11px] text-slate-400 flex items-center gap-2">
                        <span>{tx.date}</span>
                        <span>•</span>
                        <span className="font-mono">{tx.paymentMethod}</span>
                        {tx.merchant && (
                          <>
                            <span>•</span>
                            <span className="truncate max-w-[120px]">{tx.merchant}</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className={`text-xs font-bold font-mono ${
                    tx.kind === 'income' ? 'text-emerald-400' : 'text-slate-200'
                  }`}>
                    {tx.kind === 'income' ? '+' : '-'}{currency}{tx.amount.toLocaleString()}
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
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300">
                Upcoming Subscriptions
              </h3>
              <button
                onClick={() => onNavigateTab('subscriptions')}
                className="text-[11px] text-teal-400 hover:text-teal-300"
              >
                Manage
              </button>
            </div>

            <div className="space-y-2">
              {upcomingBills.length > 0 ? (
                upcomingBills.map((bill) => (
                  <div
                    key={bill.id}
                    className="p-2.5 rounded-xl bg-slate-800/50 border border-slate-700/50 flex items-center justify-between text-xs"
                  >
                    <div>
                      <div className="font-semibold text-slate-200">{bill.title}</div>
                      <div className="text-[10px] text-slate-400 flex items-center gap-1 mt-0.5">
                        <Calendar className="w-3 h-3 text-slate-500" />
                        <span>Due {bill.nextDueDate}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-slate-200">
                        {currency}{bill.amount.toLocaleString()}
                      </span>
                      <button
                        onClick={() => onLogRecurring(bill.id)}
                        className="px-2 py-1 bg-teal-500/15 hover:bg-teal-500/25 text-teal-300 border border-teal-500/30 rounded text-[10px] font-semibold transition-colors"
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
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300">
                Savings Goals
              </h3>
              <button
                onClick={() => onNavigateTab('budgets')}
                className="text-[11px] text-teal-400 hover:text-teal-300"
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
                      <span className="font-mono text-slate-400">
                        {currency}{goal.currentAmount.toLocaleString()} / {currency}{goal.targetAmount.toLocaleString()} ({pct}%)
                      </span>
                    </div>
                    <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-teal-400 to-emerald-400 rounded-full"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
