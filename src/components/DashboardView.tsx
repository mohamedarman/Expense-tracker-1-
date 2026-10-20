import React from 'react';
import {
  Wallet,
  AlertTriangle,
  ArrowDownLeft,
  Calendar,
  Sparkles,
  CheckCircle2,
  Plus,
  Target,
  ChevronRight,
  TrendingUp,
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

  const upcomingBills = recurring
    .filter((r) => r.status === 'active')
    .slice(0, 3);

  const safeDailySpend = currentMonthData?.safeDailySpend ?? 0;
  const daysLeft = currentMonthData?.daysLeftInMonth ?? 15;
  const remainingBudget = currentMonthData?.remainingBudget ?? 0;
  const isBudgetExceeded = remainingBudget <= 0;
  const netBalance = (currentMonthData?.income ?? 0) - (currentMonthData?.expense ?? 0);

  return (
    <div className="space-y-6 pb-12 font-sans">
      {/* 1. Student Daily Safe-to-Spend Instrument (The Signature Element) */}
      <section className={`p-5 rounded-2xl border transition-all ${
        isBudgetExceeded
          ? 'bg-red-950/20 border-red-500/30 text-red-200'
          : 'bg-slate-900/90 border-slate-800 text-slate-100'
      }`}>
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                Daily Safe-to-Spend Allowance
              </span>
              <span className="text-[11px] px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 font-medium">
                {daysLeft} days left in month
              </span>
            </div>

            <div className="flex items-baseline gap-2.5">
              <span className={`text-3xl sm:text-4xl font-extrabold tracking-tight tabular-nums ${
                isBudgetExceeded ? 'text-red-400' : 'text-teal-300'
              }`}>
                {currency}{safeDailySpend.toLocaleString()}
              </span>
              <span className="text-xs text-slate-400 font-medium">/ day safe velocity</span>
            </div>

            <p className="text-xs text-slate-400 max-w-2xl leading-relaxed">
              {isBudgetExceeded ? (
                <span className="text-red-300 font-medium flex items-center gap-1.5">
                  <AlertTriangle className="w-3.5 h-3.5" />
                  Budget exceeded by {currency}{Math.abs(remainingBudget).toLocaleString()}. Freeze non-essential outings until next allowance.
                </span>
              ) : (
                <>
                  Derived mathematically: <span className="text-slate-200 font-mono">{currency}{remainingBudget.toLocaleString()}</span> remaining budget ÷ <span className="text-slate-200 font-mono">{daysLeft} days</span>. Spending under this limit guarantees you finish the month on track.
                </>
              )}
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => onOpenAddTx('expense')}
              className="px-3.5 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-bold text-xs flex items-center gap-1.5 transition-colors shadow"
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
      </section>

      {/* 2. KPIs as Type, Not Tiles (Taste-Skill Rule #2: No icons in coloured circles, clean typography) */}
      <section className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
        {/* Net Savings Balance */}
        <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800/80 space-y-1">
          <div className="text-[11px] text-slate-400 font-medium">Net Month Balance</div>
          <div className={`text-2xl font-bold tracking-tight tabular-nums ${
            netBalance >= 0 ? 'text-white' : 'text-red-400'
          }`}>
            {currency}{netBalance.toLocaleString()}
          </div>
          <div className="text-[11px] text-slate-500 flex items-center gap-1">
            <span>Savings rate:</span>
            <span className="text-emerald-400 font-semibold tabular-nums">
              {currentMonthData?.income ? Math.max(0, Math.round(((currentMonthData.income - currentMonthData.expense) / currentMonthData.income) * 100)) : 0}%
            </span>
          </div>
        </div>

        {/* Total Month Income */}
        <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800/80 space-y-1">
          <div className="text-[11px] text-slate-400 font-medium">Allowance &amp; Income</div>
          <div className="text-2xl font-bold text-emerald-400 tracking-tight tabular-nums">
            +{currency}{(currentMonthData?.income ?? 0).toLocaleString()}
          </div>
          <div className="text-[11px] text-slate-500">Family allowance, stipends, tutoring</div>
        </div>

        {/* Total Month Expenses (Quiet Polarity: ordinary expenses in clean text ink, not aggressive red) */}
        <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800/80 space-y-1">
          <div className="text-[11px] text-slate-400 font-medium">Recorded Expenses</div>
          <div className="text-2xl font-bold text-slate-100 tracking-tight tabular-nums">
            {currency}{(currentMonthData?.expense ?? 0).toLocaleString()}
          </div>
          <div className="text-[11px] text-slate-500">
            Essential: {currency}{(currentMonthData?.essentialExpense ?? 0).toLocaleString()}
          </div>
        </div>

        {/* Remaining Budget */}
        <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800/80 space-y-1">
          <div className="text-[11px] text-slate-400 font-medium">Monthly Budget Remaining</div>
          <div className={`text-2xl font-bold tracking-tight tabular-nums ${
            isBudgetExceeded ? 'text-red-400' : 'text-teal-300'
          }`}>
            {currency}{remainingBudget.toLocaleString()}
          </div>
          <div className="text-[11px] text-slate-500">
            of {currency}{(currentMonthData?.budget ?? 15000).toLocaleString()} allowance limit
          </div>
        </div>
      </section>

      {/* 3. Budget Utilization Bar */}
      {budgets && (
        <section className="p-4 rounded-xl bg-slate-900/50 border border-slate-800/80 space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold text-slate-300">Monthly Budget Adherence</span>
            <span className={`font-mono font-bold ${
              budgets.overall.usage > 100
                ? 'text-red-400'
                : budgets.overall.usage > 80
                ? 'text-amber-400'
                : 'text-emerald-400'
            }`}>
              {budgets.overall.usage}% utilized ({currency}{budgets.overall.spent.toLocaleString()} / {currency}{budgets.overall.limit.toLocaleString()})
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
              <p className="text-xs text-slate-400">Income vs. Outgoings over 6 months</p>
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

        {/* Category Breakdown (Taste-Skill: Pale tiles with dark ink of the same hue) */}
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

            <div className="mt-4 space-y-2.5">
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

          <div className="pt-3 border-t border-slate-800 text-xs text-slate-400 flex items-center justify-between">
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
                    <div className="w-8 h-8 rounded-lg bg-slate-800 flex items-center justify-center text-slate-400 text-xs font-semibold shrink-0">
                      {tx.kind === 'income' ? '+' : '–'}
                    </div>
                    <div>
                      <div className="text-xs font-semibold text-slate-200 group-hover:text-white transition-colors">
                        {tx.description || tx.categoryName}
                      </div>
                      <div className="text-[11px] text-slate-400 flex items-center gap-2">
                        <span className="font-mono">{tx.date}</span>
                        <span>•</span>
                        <span>{tx.categoryName}</span>
                        {tx.merchant && (
                          <>
                            <span>•</span>
                            <span className="truncate max-w-[120px]">{tx.merchant}</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className={`text-xs font-bold font-mono tabular-nums ${
                    tx.kind === 'income' ? 'text-emerald-400' : 'text-slate-200'
                  }`}>
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
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300">
                Upcoming Subscriptions
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
                      <div className="text-[10px] text-slate-400 flex items-center gap-1 mt-0.5">
                        <Calendar className="w-3 h-3 text-slate-500" />
                        <span>Due {bill.nextDueDate}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-slate-200 tabular-nums">
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
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300">
                Savings Goals
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
      </section>
    </div>
  );
};
