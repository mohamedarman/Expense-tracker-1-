import React, { useState } from 'react';
import {
  Plus,
  CheckCircle2,
  Trash2,
  X,
} from 'lucide-react';
import { User, BudgetResponse, SavingsGoal, Category } from '../types.ts';
import { api } from '../api.ts';

interface BudgetsGoalsViewProps {
  user: User;
  currency: string;
  budgets: BudgetResponse | null;
  goals: SavingsGoal[];
  categories: Category[];
  onRefresh: () => void;
}

export const BudgetsGoalsView: React.FC<BudgetsGoalsViewProps> = ({
  user,
  currency,
  budgets,
  goals,
  categories,
  onRefresh,
}) => {
  const [showBudgetModal, setShowBudgetModal] = useState(false);
  const [selectedCatId, setSelectedCatId] = useState<string>('');
  const [budgetAmount, setBudgetAmount] = useState<string>('');
  const [budgetThreshold, setBudgetThreshold] = useState<number>(80);

  const [showGoalModal, setShowGoalModal] = useState(false);
  const [goalTitle, setGoalTitle] = useState('');
  const [goalTarget, setGoalTarget] = useState('');
  const [goalInitial, setGoalInitial] = useState('');
  const [goalCategory, setGoalCategory] = useState('Tech');
  const [goalTargetDate, setGoalTargetDate] = useState('');

  const [depositGoal, setDepositGoal] = useState<SavingsGoal | null>(null);
  const [depositAmount, setDepositAmount] = useState('');
  const [recordDepositTx, setRecordDepositTx] = useState(true);

  const overall = budgets?.overall;
  const expenseCategories = categories.filter((c) => c.kind === 'expense');

  const now = new Date();
  const semesterEnd = user.semesterEndDate
    ? new Date(user.semesterEndDate)
    : new Date(now.getFullYear(), 11, 20);
  const diffTime = Math.max(0, semesterEnd.getTime() - now.getTime());
  const semesterDaysLeft = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  const semesterBudget = Math.round(user.semesterBudget || 60000);

  const handleSaveBudget = async (e: React.FormEvent) => {
    e.preventDefault();
    const amt = parseFloat(budgetAmount);
    if (isNaN(amt) || amt <= 0) {
      alert('Please enter a valid budget amount.');
      return;
    }
    try {
      await api.setBudget({
        categoryId: selectedCatId ? selectedCatId : null,
        amount: amt,
        warningThreshold: budgetThreshold,
      });
      setShowBudgetModal(false);
      setSelectedCatId('');
      setBudgetAmount('');
      onRefresh();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleDeleteBudget = async (id: string) => {
    if (!confirm('Remove this category budget?')) return;
    try {
      await api.deleteBudget(id);
      onRefresh();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleCreateGoal = async (e: React.FormEvent) => {
    e.preventDefault();
    const target = parseFloat(goalTarget);
    if (!goalTitle.trim() || isNaN(target) || target <= 0) {
      alert('Enter a valid goal title and target amount.');
      return;
    }
    try {
      await api.createGoal({
        title: goalTitle.trim(),
        targetAmount: target,
        currentAmount: goalInitial ? parseFloat(goalInitial) : 0,
        category: goalCategory,
        targetDate:
          goalTargetDate ||
          new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      });
      setShowGoalModal(false);
      setGoalTitle('');
      setGoalTarget('');
      setGoalInitial('');
      onRefresh();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleDepositSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!depositGoal) return;
    const amt = parseFloat(depositAmount);
    if (isNaN(amt) || amt <= 0) {
      alert('Enter a valid deposit amount.');
      return;
    }
    try {
      await api.depositGoal(depositGoal.id, amt, recordDepositTx);
      setDepositGoal(null);
      setDepositAmount('');
      onRefresh();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleDeleteGoal = async (id: string) => {
    if (!confirm('Delete this savings goal?')) return;
    try {
      await api.deleteGoal(id);
      onRefresh();
    } catch (err: any) {
      alert(err.message);
    }
  };

  return (
    <div className="space-y-8 pb-12 font-sans w-full min-w-0">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 min-w-0">
        <div className="space-y-1 min-w-0">
          <div className="text-[12px] font-mono text-ink-muted">
            Allowance caps and targets
          </div>
          <h1 className="text-[24px] sm:text-[28px] font-medium text-ink-primary tracking-tight leading-tight">
            Budgets and goals
          </h1>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={() => setShowGoalModal(true)}
            className="h-9 px-3.5 btn-secondary rounded-lg text-[13px] font-normal flex items-center gap-2 whitespace-nowrap"
          >
            <Plus className="w-4 h-4 text-ink-muted shrink-0" strokeWidth={1.5} />
            <span>New goal</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setSelectedCatId('');
              setBudgetAmount(overall?.limit ? String(overall.limit) : '15000');
              setShowBudgetModal(true);
            }}
            className="h-9 px-4 btn-primary rounded-lg text-[13px] font-medium flex items-center gap-2 whitespace-nowrap"
          >
            <Plus className="w-4 h-4 shrink-0" strokeWidth={1.75} />
            <span>Set budget</span>
          </button>
        </div>
      </div>

      {/* Top Summary Row: Monthly & Semester Budgets */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 min-w-0">
        <div className="p-4 sm:p-6 rounded-xl surface-card space-y-4 min-w-0">
          <div className="flex flex-wrap items-center justify-between gap-2 text-[13px]">
            <h2 className="font-medium text-ink-primary">Monthly overall budget</h2>
            <span
              className={`font-mono text-[12px] ${
                overall?.isExceeded
                  ? 'text-negative'
                  : overall?.isWarning
                  ? 'text-warning'
                  : 'text-ink-muted'
              }`}
            >
              {overall?.isExceeded
                ? 'Over limit'
                : overall?.isWarning
                ? 'Above 80% threshold'
                : 'Within limit'}
            </span>
          </div>

          <div className="flex flex-wrap items-baseline justify-between gap-2 min-w-0">
            <div className="space-y-1 min-w-0">
              <div className="text-[24px] sm:text-[28px] font-medium text-ink-primary font-mono tabular-nums leading-none break-words">
                {currency}{Math.round(overall?.spent ?? 0).toLocaleString()}
                <span className="text-[14px] text-ink-muted font-normal ml-2">
                  / {currency}{Math.round(overall?.limit ?? 15000).toLocaleString()}
                </span>
              </div>
              <p className="text-[12px] text-ink-secondary font-mono tabular-nums">
                {overall?.remaining && overall.remaining >= 0
                  ? `${currency}${Math.round(overall.remaining).toLocaleString()} remaining this month`
                  : `Exceeded by ${currency}${Math.round(Math.abs(overall?.remaining || 0)).toLocaleString()}`}
              </p>
            </div>
            <span className="text-[18px] font-mono font-medium text-ink-primary tabular-nums shrink-0">
              {overall?.usage ?? 0}%
            </span>
          </div>

          <div className="w-full h-1.5 surface-deep rounded-sm overflow-hidden">
            <div
              className={`h-full transition-colors ${
                overall?.isExceeded
                  ? 'bg-[var(--negative)]'
                  : overall?.isWarning
                  ? 'bg-[var(--warning)]'
                  : 'bg-[var(--accent)]'
              }`}
              style={{ width: `${Math.min(100, overall?.usage || 0)}%` }}
            />
          </div>
        </div>

        <div className="p-4 sm:p-6 rounded-xl surface-card space-y-4 min-w-0">
          <div className="flex flex-wrap items-center justify-between gap-2 text-[13px]">
            <h2 className="font-medium text-ink-primary">Semester academic budget</h2>
            <span className="text-[12px] text-ink-muted font-mono tabular-nums">
              {semesterDaysLeft} days remaining
            </span>
          </div>

          <div className="flex flex-wrap items-baseline justify-between gap-2 min-w-0">
            <div className="space-y-1 min-w-0">
              <div className="text-[24px] sm:text-[28px] font-medium text-ink-primary font-mono tabular-nums leading-none break-words">
                {currency}{semesterBudget.toLocaleString()}
              </div>
              <p className="text-[12px] text-ink-secondary">
                Term ends <span className="font-mono text-ink-primary">{user.semesterEndDate || '2026-12-15'}</span>
              </p>
            </div>
            <div className="text-right space-y-0.5 shrink-0">
              <span className="text-[12px] text-ink-muted block">Term pace</span>
              <span className="text-[14px] font-mono font-medium text-ink-primary tabular-nums">
                {currency}{semesterDaysLeft > 0 ? Math.round(semesterBudget / semesterDaysLeft).toLocaleString() : 0} / day
              </span>
            </div>
          </div>

          <div className="w-full h-1.5 surface-deep rounded-sm overflow-hidden">
            <div className="h-full bg-[var(--text-secondary)]" style={{ width: '45%' }} />
          </div>
        </div>
      </div>

      {/* Category Budgets Grid */}
      <div className="space-y-4 min-w-0">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="space-y-0.5 min-w-0">
            <h2 className="text-[16px] font-medium text-ink-primary">Category spending limits</h2>
            <p className="text-[13px] text-ink-secondary">
              Monthly caps for food, housing, transit, and study materials
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              setSelectedCatId(expenseCategories[0]?.id || '');
              setBudgetAmount('3000');
              setShowBudgetModal(true);
            }}
            className="text-[13px] text-ink-secondary hover:text-ink-primary font-normal transition-colors shrink-0"
          >
            + Add category limit
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 min-w-0">
          {budgets?.categoryBudgets && budgets.categoryBudgets.length > 0 ? (
            budgets.categoryBudgets.map((b) => {
              const cat = categories.find((c) => c.id === b.categoryId);
              return (
                <div
                  key={b.id}
                  className="p-4 sm:p-5 rounded-xl surface-card space-y-3 group min-w-0"
                >
                  <div className="flex items-center justify-between gap-2 min-w-0">
                    <span className="text-[14px] font-medium text-ink-primary truncate min-w-0">
                      {cat?.name || 'Category'}
                    </span>
                    <div className="flex items-center gap-2 shrink-0">
                      <span
                        className={`text-[12px] font-mono tabular-nums ${
                          b.isExceeded
                            ? 'text-negative'
                            : b.isWarning
                            ? 'text-warning'
                            : 'text-ink-muted'
                        }`}
                      >
                        {b.usage}%
                      </span>
                      <button
                        type="button"
                        onClick={() => handleDeleteBudget(b.id)}
                        className="text-ink-muted hover:text-negative p-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity"
                        title="Remove limit"
                      >
                        <Trash2 className="w-3.5 h-3.5" strokeWidth={1.5} />
                      </button>
                    </div>
                  </div>

                  <div className="flex items-baseline justify-between gap-2 text-[12px] font-mono tabular-nums">
                    <span className="text-ink-primary">
                      {currency}{Math.round(b.spent).toLocaleString()} spent
                    </span>
                    <span className="text-ink-muted">
                      of {currency}{Math.round(b.amount).toLocaleString()}
                    </span>
                  </div>

                  <div className="w-full h-1 surface-deep rounded-sm overflow-hidden">
                    <div
                      className={`h-full transition-colors ${
                        b.isExceeded
                          ? 'bg-[var(--negative)]'
                          : b.isWarning
                          ? 'bg-[var(--warning)]'
                          : 'bg-[var(--accent)]'
                      }`}
                      style={{ width: `${Math.min(100, b.usage)}%` }}
                    />
                  </div>

                  <div className="text-[12px] text-ink-muted font-mono flex items-center justify-between gap-2 tabular-nums">
                    <span>
                      {b.remaining >= 0
                        ? `${currency}${Math.round(b.remaining).toLocaleString()} remaining`
                        : `${currency}${Math.round(Math.abs(b.remaining)).toLocaleString()} over`}
                    </span>
                    <span>Alert at {b.warningThreshold}%</span>
                  </div>
                </div>
              );
            })
          ) : (
            <div className="col-span-full py-10 text-center text-[13px] text-ink-muted surface-card rounded-xl">
              No category-specific limits configured yet
            </div>
          )}
        </div>
      </div>

      {/* Savings Goals Section */}
      <div className="space-y-4 pt-4 border-t hairline-border min-w-0">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="space-y-0.5 min-w-0">
            <h2 className="text-[16px] font-medium text-ink-primary">Savings goals</h2>
            <p className="text-[13px] text-ink-secondary">
              Dedicated funds for hardware, textbooks, certifications, and emergencies
            </p>
          </div>
          <button
            type="button"
            onClick={() => setShowGoalModal(true)}
            className="text-[13px] text-ink-secondary hover:text-ink-primary font-normal transition-colors shrink-0"
          >
            + Create goal
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 min-w-0">
          {goals.length > 0 ? (
            goals.map((goal) => {
              const pct = Math.min(100, Math.round((goal.currentAmount / goal.targetAmount) * 100));
              const isDone = goal.currentAmount >= goal.targetAmount;

              return (
                <div
                  key={goal.id}
                  className="p-4 sm:p-5 rounded-xl surface-card space-y-3.5 group min-w-0"
                >
                  <div className="flex items-center justify-between gap-2 min-w-0">
                    <span className="text-[14px] font-medium text-ink-primary truncate min-w-0">
                      {goal.title}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleDeleteGoal(goal.id)}
                      className="text-ink-muted hover:text-negative p-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity shrink-0"
                      title="Delete goal"
                    >
                      <Trash2 className="w-3.5 h-3.5" strokeWidth={1.5} />
                    </button>
                  </div>

                  <div className="flex items-baseline justify-between gap-2 min-w-0">
                    <div className="space-y-0.5 min-w-0">
                      <div className="text-[20px] font-medium font-mono text-ink-primary tabular-nums break-words">
                        {currency}{Math.round(goal.currentAmount).toLocaleString()}
                        <span className="text-[12px] text-ink-muted font-normal ml-1.5">
                          / {currency}{Math.round(goal.targetAmount).toLocaleString()}
                        </span>
                      </div>
                      <p className="text-[12px] text-ink-muted font-mono truncate">
                        {goal.category} · Target {goal.targetDate}
                      </p>
                    </div>
                    <span className="font-mono font-medium text-ink-secondary text-[13px] tabular-nums shrink-0">
                      {pct}%
                    </span>
                  </div>

                  <div className="w-full h-1 surface-deep rounded-sm overflow-hidden">
                    <div
                      className={`h-full transition-colors ${
                        isDone ? 'bg-[var(--positive)]' : 'bg-[var(--accent)]'
                      }`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>

                  <div className="pt-1 flex items-center justify-between gap-2 text-[12px]">
                    <span className="text-ink-muted font-mono tabular-nums truncate">
                      {isDone
                        ? 'Target reached'
                        : `${currency}${Math.round(goal.targetAmount - goal.currentAmount).toLocaleString()} to go`}
                    </span>
                    {!isDone ? (
                      <button
                        type="button"
                        onClick={() => {
                          setDepositGoal(goal);
                          setDepositAmount('500');
                        }}
                        className="h-7 px-2.5 btn-secondary rounded-md text-[12px] font-normal shrink-0"
                      >
                        Add funds
                      </button>
                    ) : (
                      <span className="text-[12px] text-positive flex items-center gap-1 shrink-0">
                        <CheckCircle2 className="w-3.5 h-3.5" strokeWidth={1.5} /> Completed
                      </span>
                    )}
                  </div>
                </div>
              );
            })
          ) : (
            <div className="col-span-full py-10 text-center text-[13px] text-ink-muted surface-card rounded-xl">
              No savings goals created yet
            </div>
          )}
        </div>
      </div>

      {/* Set Budget Modal */}
      {showBudgetModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <form
            onSubmit={handleSaveBudget}
            className="surface-card rounded-xl max-w-sm w-full max-h-[calc(100dvh-1.5rem)] overflow-y-auto p-5 space-y-4 min-w-0"
          >
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-[15px] font-medium text-ink-primary">Set spending limit</h3>
              <button
                type="button"
                onClick={() => setShowBudgetModal(false)}
                className="text-ink-muted hover:text-ink-primary shrink-0"
              >
                <X className="w-4 h-4" strokeWidth={1.5} />
              </button>
            </div>

            <div className="space-y-3 text-[13px]">
              <div className="space-y-1.5">
                <label className="block text-ink-secondary">Scope</label>
                <select
                  value={selectedCatId}
                  onChange={(e) => setSelectedCatId(e.target.value)}
                  className="w-full min-w-0 h-9 input-field rounded-lg px-3"
                >
                  <option value="">Overall monthly budget</option>
                  {expenseCategories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="block text-ink-secondary">Monthly limit ({currency})</label>
                <input
                  type="number"
                  step="0.01"
                  required
                  placeholder="5000"
                  value={budgetAmount}
                  onChange={(e) => setBudgetAmount(e.target.value)}
                  className="w-full min-w-0 h-9 input-field rounded-lg px-3 font-mono tabular-nums"
                />
              </div>

              <div className="space-y-1.5">
                <label className="block text-ink-secondary">
                  Warning threshold ({budgetThreshold}%)
                </label>
                <input
                  type="range"
                  min="50"
                  max="95"
                  value={budgetThreshold}
                  onChange={(e) => setBudgetThreshold(parseInt(e.target.value, 10))}
                  className="w-full accent-[var(--accent)]"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowBudgetModal(false)}
                className="h-8 px-3.5 btn-secondary rounded-lg text-[12px]"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="h-8 px-4 btn-primary rounded-lg text-[12px] font-medium"
              >
                Save limit
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Add Goal Modal */}
      {showGoalModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <form
            onSubmit={handleCreateGoal}
            className="surface-card rounded-xl max-w-sm w-full max-h-[calc(100dvh-1.5rem)] overflow-y-auto p-5 space-y-4 min-w-0"
          >
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-[15px] font-medium text-ink-primary">New savings goal</h3>
              <button
                type="button"
                onClick={() => setShowGoalModal(false)}
                className="text-ink-muted hover:text-ink-primary shrink-0"
              >
                <X className="w-4 h-4" strokeWidth={1.5} />
              </button>
            </div>

            <div className="space-y-3 text-[13px]">
              <div className="space-y-1.5">
                <label className="block text-ink-secondary">Goal title</label>
                <input
                  type="text"
                  required
                  placeholder="Laptop, semester books, travel"
                  value={goalTitle}
                  onChange={(e) => setGoalTitle(e.target.value)}
                  className="w-full min-w-0 h-9 input-field rounded-lg px-3"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="block text-ink-secondary">Target ({currency})</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    placeholder="25000"
                    value={goalTarget}
                    onChange={(e) => setGoalTarget(e.target.value)}
                    className="w-full min-w-0 h-9 input-field rounded-lg px-3 font-mono tabular-nums"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="block text-ink-secondary">Saved so far ({currency})</label>
                  <input
                    type="number"
                    step="0.01"
                    placeholder="0"
                    value={goalInitial}
                    onChange={(e) => setGoalInitial(e.target.value)}
                    className="w-full min-w-0 h-9 input-field rounded-lg px-3 font-mono tabular-nums"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="block text-ink-secondary">Category</label>
                  <select
                    value={goalCategory}
                    onChange={(e) => setGoalCategory(e.target.value)}
                    className="w-full min-w-0 h-9 input-field rounded-lg px-3"
                  >
                    <option value="Tech">Tech and hardware</option>
                    <option value="Books">Books and study</option>
                    <option value="Emergency">Emergency reserve</option>
                    <option value="Travel">Travel</option>
                    <option value="Certification">Certification</option>
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="block text-ink-secondary">Target date</label>
                  <input
                    type="date"
                    value={goalTargetDate}
                    onChange={(e) => setGoalTargetDate(e.target.value)}
                    className="w-full min-w-0 h-9 input-field rounded-lg px-3 font-mono"
                  />
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowGoalModal(false)}
                className="h-8 px-3.5 btn-secondary rounded-lg text-[12px]"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="h-8 px-4 btn-primary rounded-lg text-[12px] font-medium"
              >
                Create goal
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Deposit to Goal Modal */}
      {depositGoal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <form
            onSubmit={handleDepositSubmit}
            className="surface-card rounded-xl max-w-sm w-full max-h-[calc(100dvh-1.5rem)] overflow-y-auto p-5 space-y-4 min-w-0"
          >
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-[15px] font-medium text-ink-primary truncate">
                Add funds to {depositGoal.title}
              </h3>
              <button
                type="button"
                onClick={() => setDepositGoal(null)}
                className="text-ink-muted hover:text-ink-primary shrink-0"
              >
                <X className="w-4 h-4" strokeWidth={1.5} />
              </button>
            </div>

            <div className="space-y-3 text-[13px]">
              <div className="space-y-1.5">
                <label className="block text-ink-secondary">Deposit amount ({currency})</label>
                <input
                  type="number"
                  step="0.01"
                  required
                  placeholder="500"
                  value={depositAmount}
                  onChange={(e) => setDepositAmount(e.target.value)}
                  className="w-full min-w-0 h-9 input-field rounded-lg px-3 font-mono tabular-nums"
                />
              </div>

              <label className="flex items-center gap-2 text-ink-secondary cursor-pointer pt-1 text-[12px]">
                <input
                  type="checkbox"
                  checked={recordDepositTx}
                  onChange={(e) => setRecordDepositTx(e.target.checked)}
                  className="rounded accent-[var(--accent)]"
                />
                <span>Record as an expense from Primary Bank</span>
              </label>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setDepositGoal(null)}
                className="h-8 px-3.5 btn-secondary rounded-lg text-[12px]"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="h-8 px-4 btn-primary rounded-lg text-[12px] font-medium"
              >
                Confirm deposit
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
