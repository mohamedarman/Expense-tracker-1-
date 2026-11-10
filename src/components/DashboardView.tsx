import React from 'react';
import {
  AlertTriangle,
  ArrowDownLeft,
  Plus,
  ChevronRight,
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

  const safeDailySpend = Math.round(currentMonthData?.safeDailySpend ?? 0);
  const daysLeft = currentMonthData?.daysLeftInMonth ?? 15;
  const remainingBudget = Math.round(currentMonthData?.remainingBudget ?? 0);
  const monthlyLimit = Math.round(currentMonthData?.budget ?? budgets?.overall.limit ?? 15000);
  const totalSpent = Math.round(currentMonthData?.expense ?? 0);
  const totalIncome = Math.round(currentMonthData?.income ?? 0);
  const essentialSpent = Math.round(currentMonthData?.essentialExpense ?? 0);
  const discretionarySpent = Math.round(currentMonthData?.discretionaryExpense ?? 0);
  const isBudgetExceeded = remainingBudget <= 0 && totalSpent > 0;
  const netBalance = totalIncome - totalSpent;
  const usagePct = budgets?.overall.usage ?? (monthlyLimit > 0 ? Math.round((totalSpent / monthlyLimit) * 100) : 0);

  const currentPeriodLabel = new Date().toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric',
  });

  const quickPresets = [
    { label: 'Campus canteen', amount: 60 },
    { label: 'Tea or coffee', amount: 40 },
    { label: 'Print and xerox', amount: 20 },
    { label: 'Metro transit', amount: 50 },
    { label: 'Study supplies', amount: 350 },
  ];

  return (
    <div className="space-y-6 pb-12 font-sans w-full min-w-0">
      {/* Page Context Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 min-w-0">
        <div className="space-y-1 min-w-0">
          <div className="text-[12px] font-mono text-ink-muted">
            Monthly allowance overview
          </div>
          <h1 className="text-[24px] sm:text-[28px] font-medium text-ink-primary tracking-tight leading-tight truncate">
            {currentPeriodLabel}
          </h1>
        </div>

        <div className="flex items-center gap-2 shrink-0 flex-wrap">
          <button
            type="button"
            onClick={() => onOpenAddTx('income')}
            className="h-9 px-3.5 btn-secondary rounded-lg text-[13px] font-normal flex items-center gap-2 whitespace-nowrap"
          >
            <ArrowDownLeft className="w-4 h-4 text-ink-muted shrink-0" strokeWidth={1.5} />
            <span>Add income</span>
          </button>
          <button
            type="button"
            onClick={() => onOpenAddTx('expense')}
            className="h-9 px-4 btn-primary rounded-lg text-[13px] font-medium flex items-center gap-2 whitespace-nowrap"
          >
            <Plus className="w-4 h-4 shrink-0" strokeWidth={1.75} />
            <span>Log expense</span>
          </button>
        </div>
      </div>

      {/* 1. Signature Moment: Daily Safe-to-Spend Allowance & Pace Instrument */}
      <section className="p-4 sm:p-6 rounded-xl surface-card space-y-5 min-w-0">
        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-5 min-w-0">
          <div className="space-y-2 min-w-0">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[12px] text-ink-muted font-mono">
              <span>Daily safe-to-spend allowance</span>
              <span aria-hidden="true">·</span>
              <span>{daysLeft} days left in month</span>
            </div>

            <div className="flex flex-wrap items-baseline gap-2.5 min-w-0">
              <span
                className={`text-[32px] sm:text-[42px] font-medium tracking-tight font-mono tabular-nums leading-none break-all ${
                  isBudgetExceeded ? 'text-negative' : 'text-accent'
                }`}
              >
                {currency}{safeDailySpend.toLocaleString()}
              </span>
              <span className="text-[14px] text-ink-secondary font-normal">
                per day
              </span>
            </div>

            <p className="text-[13px] text-ink-secondary max-w-2xl leading-relaxed break-words">
              {isBudgetExceeded ? (
                <span className="text-negative flex items-start sm:items-center gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 sm:mt-0" strokeWidth={1.5} />
                  <span>
                    Monthly budget exceeded by {currency}{Math.abs(remainingBudget).toLocaleString()}. Pause non-essential spending until next allowance.
                  </span>
                </span>
              ) : (
                <>
                  Calculated from <span className="text-ink-primary font-mono tabular-nums">{currency}{remainingBudget.toLocaleString()}</span> remaining budget divided across <span className="text-ink-primary font-mono tabular-nums">{daysLeft} days</span>
                </>
              )}
            </p>
          </div>

          {/* Quick-log Presets */}
          <div className="flex flex-col lg:items-end gap-2 min-w-0">
            <span className="text-[12px] text-ink-muted">
              Quick entry presets
            </span>
            <div className="flex items-center gap-1.5 flex-wrap">
              {quickPresets.map((preset, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => onOpenAddTx('expense')}
                  className="h-8 px-2.5 btn-secondary rounded-lg text-[12px] flex items-center gap-1.5 whitespace-nowrap"
                >
                  <span className="text-ink-secondary">{preset.label}</span>
                  <span className="font-mono text-ink-muted tabular-nums">
                    {currency}{preset.amount}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Signature Pace Bar */}
        <div className="pt-4 border-t hairline-border space-y-2 min-w-0">
          <div className="flex flex-wrap items-center justify-between gap-2 text-[12px] font-mono">
            <span className="text-ink-secondary break-words">
              Monthly budget pace: {currency}{totalSpent.toLocaleString()} of {currency}{monthlyLimit.toLocaleString()}
            </span>
            <span className="text-ink-muted tabular-nums shrink-0">
              {usagePct}% used
            </span>
          </div>
          <div className="w-full h-1.5 surface-deep rounded-sm overflow-hidden">
            <div
              className={`h-full transition-colors ${
                isBudgetExceeded ? 'bg-[var(--negative)]' : 'bg-[var(--accent)]'
              }`}
              style={{ width: `${Math.min(100, usagePct)}%` }}
            />
          </div>
        </div>
      </section>

      {/* 2. Unified 4-Column Stat Strip */}
      <section className="rounded-xl surface-card grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 divide-y lg:divide-y-0 sm:divide-x hairline-divide min-w-0">
        <div className="p-4 sm:p-5 space-y-2 min-w-0">
          <div className="text-[12px] text-ink-muted">Net month balance</div>
          <div
            className={`text-[24px] sm:text-[28px] font-medium font-mono tracking-tight tabular-nums leading-none break-words ${
              netBalance >= 0 ? 'text-ink-primary' : 'text-negative'
            }`}
          >
            {netBalance < 0 ? '-' : ''}{currency}{Math.abs(netBalance).toLocaleString()}
          </div>
          <div className="text-[12px] text-ink-secondary font-mono break-words">
            {totalIncome > 0
              ? `${Math.max(0, Math.round(((totalIncome - totalSpent) / totalIncome) * 100))}% savings rate vs income`
              : '0% savings rate this month'}
          </div>
        </div>

        <div className="p-4 sm:p-5 space-y-2 min-w-0">
          <div className="text-[12px] text-ink-muted">Allowance and income</div>
          <div className="text-[24px] sm:text-[28px] font-medium font-mono text-ink-primary tracking-tight tabular-nums leading-none break-words">
            {currency}{totalIncome.toLocaleString()}
          </div>
          <div className="text-[12px] text-ink-secondary break-words">
            Stipends, family allowance, part-time
          </div>
        </div>

        <div className="p-4 sm:p-5 space-y-2 min-w-0">
          <div className="text-[12px] text-ink-muted">Recorded expenses</div>
          <div className="text-[24px] sm:text-[28px] font-medium font-mono text-ink-primary tracking-tight tabular-nums leading-none break-words">
            {currency}{totalSpent.toLocaleString()}
          </div>
          <div className="text-[12px] text-ink-secondary font-mono tabular-nums break-words">
            {currency}{essentialSpent.toLocaleString()} essential · {currency}{discretionarySpent.toLocaleString()} discretionary
          </div>
        </div>

        <div className="p-4 sm:p-5 space-y-2 min-w-0">
          <div className="text-[12px] text-ink-muted">Remaining allowance</div>
          <div
            className={`text-[24px] sm:text-[28px] font-medium font-mono tracking-tight tabular-nums leading-none break-words ${
              isBudgetExceeded ? 'text-negative' : 'text-ink-primary'
            }`}
          >
            {currency}{Math.max(0, remainingBudget).toLocaleString()}
          </div>
          <div className="text-[12px] text-ink-secondary font-mono tabular-nums break-words">
            of {currency}{monthlyLimit.toLocaleString()} monthly limit
          </div>
        </div>
      </section>

      {/* 3. Main Data Row: 2/3 Width Main Chart + 1/3 Width Ranked Category List */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-6 min-w-0">
        {/* Main Chart */}
        <div className="lg:col-span-8 p-4 sm:p-6 rounded-xl surface-card flex flex-col justify-between space-y-6 min-w-0">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 min-w-0">
            <div className="space-y-0.5 min-w-0">
              <h2 className="text-[15px] font-medium text-ink-primary">Monthly cashflow comparison</h2>
              <p className="text-[13px] text-ink-secondary">
                Income and expenses across recorded months
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[12px] font-mono text-ink-secondary">
              <span className="flex items-center gap-1.5 whitespace-nowrap">
                <span className="w-2.5 h-2.5 rounded-[2px] bg-[var(--accent)] shrink-0" /> Current month spend
              </span>
              <span className="flex items-center gap-1.5 whitespace-nowrap">
                <span className="w-2.5 h-2.5 rounded-[2px] bg-[var(--text-muted)] opacity-50 shrink-0" /> Prior spend
              </span>
              <span className="flex items-center gap-1.5 whitespace-nowrap">
                <span className="w-2.5 h-2.5 rounded-[2px] border border-[var(--text-secondary)] shrink-0" /> Income
              </span>
            </div>
          </div>

          <div className="relative h-[240px] flex flex-col justify-end pt-4 min-w-0">
            {/* Muted Horizontal Gridlines */}
            <div className="absolute inset-x-0 top-4 bottom-7 flex flex-col justify-between pointer-events-none">
              <div className="border-b border-dashed hairline-border w-full" />
              <div className="border-b border-dashed hairline-border w-full" />
              <div className="border-b border-dashed hairline-border w-full" />
              <div className="border-b hairline-border w-full" />
            </div>

            {analytics?.monthlyTrends && analytics.monthlyTrends.length > 0 ? (
              <div className="relative z-10 flex items-end justify-between gap-1.5 sm:gap-4 h-[196px] px-1 sm:px-2 min-w-0">
                {analytics.monthlyTrends.map((m, idx) => {
                  const isCurrent = idx === analytics.monthlyTrends.length - 1;
                  const maxVal = Math.max(
                    ...analytics.monthlyTrends.map((t) => Math.max(t.income, t.expense)),
                    1000
                  );
                  const incHeight = Math.max(4, Math.round((m.income / maxVal) * 168));
                  const expHeight = Math.max(4, Math.round((m.expense / maxVal) * 168));

                  return (
                    <div key={idx} className="flex-1 min-w-0 flex flex-col items-center gap-2">
                      <div className="w-full flex items-end justify-center gap-1 sm:gap-1.5 h-[172px]">
                        <div
                          className="w-2.5 sm:w-4 rounded-t-[3px] bg-[var(--bg-raised)] border border-[var(--border-strong)] transition-opacity hover:opacity-80"
                          style={{ height: `${incHeight}px` }}
                          title={`${m.label} income: ${currency}${Math.round(m.income).toLocaleString()}`}
                        />
                        <div
                          className={`w-2.5 sm:w-4 rounded-t-[3px] transition-opacity hover:opacity-90 ${
                            isCurrent
                              ? 'bg-[var(--accent)]'
                              : 'bg-[var(--text-muted)] opacity-45'
                          }`}
                          style={{ height: `${expHeight}px` }}
                          title={`${m.label} expense: ${currency}${Math.round(m.expense).toLocaleString()}`}
                        />
                      </div>
                      <span
                        className={`text-[11px] sm:text-[12px] font-mono tabular-nums truncate max-w-full ${
                          isCurrent ? 'text-ink-primary font-medium' : 'text-ink-muted'
                        }`}
                      >
                        {m.label}
                      </span>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="h-full flex items-center justify-center text-[13px] text-ink-muted">
                No monthly cashflow history recorded yet
              </div>
            )}
          </div>
        </div>

        {/* Secondary Data Block: Ranked Category Share List */}
        <div className="lg:col-span-4 p-4 sm:p-6 rounded-xl surface-card flex flex-col justify-between space-y-5 min-w-0">
          <div className="space-y-4 min-w-0">
            <div className="flex items-center justify-between gap-2">
              <div className="space-y-0.5 min-w-0">
                <h2 className="text-[15px] font-medium text-ink-primary truncate">Spending by category</h2>
                <p className="text-[13px] text-ink-secondary truncate">Share of monthly expenses</p>
              </div>
              <button
                type="button"
                onClick={() => onNavigateTab('analytics')}
                className="text-[12px] text-ink-secondary hover:text-ink-primary transition-colors shrink-0"
              >
                Full breakdown
              </button>
            </div>

            <div className="space-y-3.5 pt-1">
              {analytics?.categoryBreakdown && analytics.categoryBreakdown.length > 0 ? (
                analytics.categoryBreakdown.slice(0, 5).map((cat, idx) => {
                  const total = currentMonthData?.expense || 1;
                  const pct = Math.round((cat.amount / total) * 100);
                  const isTopCategory = idx === 0;
                  return (
                    <div key={idx} className="space-y-1.5 min-w-0">
                      <div className="flex items-center justify-between gap-2 text-[13px] min-w-0">
                        <span className="text-ink-primary font-normal truncate min-w-0">{cat.name}</span>
                        <span className="text-ink-secondary font-mono tabular-nums text-[12px] shrink-0">
                          {currency}{Math.round(cat.amount).toLocaleString()} · {pct}%
                        </span>
                      </div>
                      <div className="w-full h-1 surface-deep rounded-sm overflow-hidden">
                        <div
                          className={`h-full ${
                            isTopCategory ? 'bg-[var(--accent)]' : 'bg-[var(--text-muted)]'
                          }`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="py-12 text-center text-[13px] text-ink-muted">
                  No category spending recorded this month
                </div>
              )}
            </div>
          </div>

          <div className="pt-4 border-t hairline-border flex flex-wrap items-center justify-between gap-2 text-[12px] font-mono text-ink-muted tabular-nums">
            <span>Essential: {currency}{essentialSpent.toLocaleString()}</span>
            <span>Discretionary: {currency}{discretionarySpent.toLocaleString()}</span>
          </div>
        </div>
      </section>

      {/* 4. Bottom Row: 2/3 Width Recent Ledger Table + 1/3 Width Commitments & Goals */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-6 min-w-0">
        {/* Recent Transactions Table */}
        <div className="lg:col-span-8 p-4 sm:p-6 rounded-xl surface-card space-y-4 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <div className="space-y-0.5 min-w-0">
              <h2 className="text-[15px] font-medium text-ink-primary">Recent transactions</h2>
              <p className="text-[13px] text-ink-secondary">Click any row to edit details</p>
            </div>
            <button
              type="button"
              onClick={() => onNavigateTab('transactions')}
              className="text-[12px] text-ink-secondary hover:text-ink-primary flex items-center gap-1 transition-colors shrink-0"
            >
              <span>All transactions</span>
              <ChevronRight className="w-3.5 h-3.5" strokeWidth={1.5} />
            </button>
          </div>

          {recentTransactions.length > 0 ? (
            <div className="divide-y hairline-divide">
              {recentTransactions.map((tx) => (
                <div
                  key={tx.id}
                  onClick={() => onEditTx(tx)}
                  className="py-2.5 px-2 flex items-center justify-between gap-3 hover:bg-[var(--bg-raised)] rounded-lg cursor-pointer transition-colors min-w-0"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center gap-0.5 sm:gap-4 min-w-0">
                    <span className="hidden sm:inline text-[12px] font-mono text-ink-muted tabular-nums w-24 shrink-0">
                      {tx.date}
                    </span>
                    <span className="text-[13px] text-ink-primary font-normal truncate min-w-0">
                      {tx.description || tx.categoryName}
                    </span>
                    <span className="text-[12px] text-ink-muted truncate">
                      <span className="sm:hidden font-mono">{tx.date} · </span>
                      {tx.categoryName}
                      {tx.merchant ? ` · ${tx.merchant}` : ''}
                    </span>
                  </div>

                  <div
                    className={`text-[13px] font-mono font-medium tabular-nums shrink-0 ${
                      tx.kind === 'income' ? 'text-positive' : 'text-ink-primary'
                    }`}
                  >
                    {tx.kind === 'income' ? '+' : '-'}{currency}{Math.round(tx.amount).toLocaleString()}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="py-10 text-center space-y-3">
              <p className="text-[13px] text-ink-muted">
                No transactions recorded for this account yet
              </p>
              <button
                type="button"
                onClick={() => onOpenAddTx('expense')}
                className="h-8 px-3.5 btn-secondary rounded-lg text-[12px] font-medium inline-flex items-center gap-1.5"
              >
                <Plus className="w-3.5 h-3.5" strokeWidth={1.5} />
                <span>Log first transaction</span>
              </button>
            </div>
          )}
        </div>

        {/* Upcoming Bills & Active Goals */}
        <div className="lg:col-span-4 space-y-6 min-w-0">
          {/* Upcoming Recurring Bills */}
          <div className="p-4 sm:p-6 rounded-xl surface-card space-y-4 min-w-0">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-[15px] font-medium text-ink-primary">
                Upcoming bills
              </h3>
              <button
                type="button"
                onClick={() => onNavigateTab('subscriptions')}
                className="text-[12px] text-ink-secondary hover:text-ink-primary transition-colors shrink-0"
              >
                Manage
              </button>
            </div>

            <div className="divide-y hairline-divide">
              {upcomingBills.length > 0 ? (
                upcomingBills.map((bill) => (
                  <div
                    key={bill.id}
                    className="py-2.5 first:pt-0 last:pb-0 flex items-center justify-between gap-3 text-[13px] min-w-0"
                  >
                    <div className="min-w-0">
                      <div className="text-ink-primary font-normal truncate">{bill.title}</div>
                      <div className="text-[12px] text-ink-muted font-mono">
                        Due {bill.nextDueDate}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="font-mono text-ink-primary tabular-nums">
                        {currency}{Math.round(bill.amount).toLocaleString()}
                      </span>
                      <button
                        type="button"
                        onClick={() => onLogRecurring(bill.id)}
                        className="h-7 px-2.5 btn-secondary rounded-md text-[12px] font-normal"
                      >
                        Record
                      </button>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-[13px] text-ink-muted py-4 text-center">
                  No recurring bills scheduled
                </div>
              )}
            </div>
          </div>

          {/* Savings Goals */}
          <div className="p-4 sm:p-6 rounded-xl surface-card space-y-4 min-w-0">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-[15px] font-medium text-ink-primary">
                Savings goals
              </h3>
              <button
                type="button"
                onClick={() => onNavigateTab('budgets')}
                className="text-[12px] text-ink-secondary hover:text-ink-primary transition-colors shrink-0"
              >
                View goals
              </button>
            </div>

            <div className="space-y-3.5">
              {goals.length > 0 ? (
                goals.slice(0, 3).map((goal) => {
                  const pct = Math.min(100, Math.round((goal.currentAmount / goal.targetAmount) * 100));
                  return (
                    <div key={goal.id} className="space-y-1.5 min-w-0">
                      <div className="flex items-center justify-between gap-2 text-[13px] min-w-0">
                        <span className="text-ink-primary truncate min-w-0">{goal.title}</span>
                        <span className="font-mono text-[12px] text-ink-secondary tabular-nums shrink-0">
                          {currency}{Math.round(goal.currentAmount).toLocaleString()} / {currency}{Math.round(goal.targetAmount).toLocaleString()}
                        </span>
                      </div>
                      <div className="w-full h-1 surface-deep rounded-sm overflow-hidden">
                        <div
                          className="h-full bg-[var(--accent)]"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="text-[13px] text-ink-muted py-4 text-center">
                  No active savings goals
                </div>
              )}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};
