import React, { useState } from 'react';
import {
  Target,
  Plus,
  AlertTriangle,
  CheckCircle2,
  Calendar,
  TrendingUp,
  Trash2,
  ArrowRight,
  ShieldAlert,
  Coins,
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
  // Modal states
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

  // Semester calculations
  const now = new Date();
  const semesterEnd = user.semesterEndDate ? new Date(user.semesterEndDate) : new Date(now.getFullYear(), 11, 20);
  const diffTime = Math.max(0, semesterEnd.getTime() - now.getTime());
  const semesterDaysLeft = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  const semesterBudget = user.semesterBudget || 60000;

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
        targetDate: goalTargetDate || new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
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
    <div className="space-y-8 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-white tracking-tight">Budgets &amp; Savings Goals</h1>
          <p className="text-xs text-slate-400">
            Enforce spending limits, monitor category utilization, and save for college milestones
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              setSelectedCatId('');
              setBudgetAmount(overall?.limit ? String(overall.limit) : '15000');
              setShowBudgetModal(true);
            }}
            className="px-3.5 py-2 bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-semibold rounded-lg text-xs flex items-center gap-1.5 transition-colors shadow"
          >
            <Plus className="w-3.5 h-3.5" /> Set Budget
          </button>
          <button
            onClick={() => setShowGoalModal(true)}
            className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-teal-300 border border-slate-700/80 rounded-lg text-xs flex items-center gap-1.5 transition-colors"
          >
            <Plus className="w-3.5 h-3.5" /> Add Goal
          </button>
        </div>
      </div>

      {/* Top Cards: Monthly & Semester Budgets */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Monthly Overall */}
        <div className="p-5 rounded-2xl bg-slate-900/80 border border-slate-800/80 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Target className="w-4 h-4 text-emerald-400" />
              <h2 className="text-sm font-bold text-white">Monthly Overall Budget</h2>
            </div>
            <span className={`text-xs font-semibold font-mono ${
              overall?.isExceeded
                ? 'text-rose-400'
                : overall?.isWarning
                ? 'text-amber-400'
                : 'text-emerald-400'
            }`}>
              {overall?.isExceeded ? 'Exceeded' : overall?.isWarning ? 'Warning (>80%)' : 'On Track'}
            </span>
          </div>

          <div className="flex items-baseline justify-between">
            <div>
              <div className="text-2xl font-black text-white font-mono tabular-nums">
                {currency}{(overall?.spent ?? 0).toLocaleString()}
                <span className="text-xs text-slate-400 font-normal ml-1">
                  / {currency}{(overall?.limit ?? 15000).toLocaleString()}
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                {overall?.remaining && overall.remaining >= 0
                  ? `${currency}${overall.remaining.toLocaleString()} remaining`
                  : `Over budget by ${currency}${Math.abs(overall?.remaining || 0).toLocaleString()}`}
              </p>
            </div>
            <div className="text-right">
              <span className="text-xl font-mono font-bold text-slate-200 tabular-nums">
                {overall?.usage ?? 0}%
              </span>
            </div>
          </div>

          <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ${
                overall?.isExceeded ? 'bg-rose-500' : overall?.isWarning ? 'bg-amber-400' : 'bg-emerald-500'
              }`}
              style={{ width: `${Math.min(100, overall?.usage || 0)}%` }}
            />
          </div>
        </div>

        {/* Semester Budget */}
        <div className="p-5 rounded-2xl bg-slate-900/80 border border-slate-800/80 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-teal-400" />
              <h2 className="text-sm font-bold text-white">Semester Academic Budget</h2>
            </div>
            <span className="text-xs text-slate-400 font-mono">
              {semesterDaysLeft} days remaining
            </span>
          </div>

          <div className="flex items-baseline justify-between">
            <div>
              <div className="text-2xl font-black text-teal-300">
                {currency}{semesterBudget.toLocaleString()}
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Target end date: <span className="font-mono text-slate-300">{user.semesterEndDate || 'Dec 15, 2026'}</span>
              </p>
            </div>
            <div className="text-right">
              <span className="text-xs text-slate-400">Term velocity</span>
              <div className="text-sm font-mono font-bold text-slate-200">
                ~{currency}{semesterDaysLeft > 0 ? Math.round(semesterBudget / semesterDaysLeft) : 0}/day
              </div>
            </div>
          </div>

          <div className="w-full h-2.5 bg-slate-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-teal-500 rounded-full"
              style={{ width: '45%' }}
            />
          </div>
        </div>
      </div>

      {/* Category Budgets Grid */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm font-bold text-white">Category Spending Limits</h2>
            <p className="text-xs text-slate-400">Prevent overspending in food, rent, shopping, and entertainment</p>
          </div>
          <button
            onClick={() => {
              setSelectedCatId(expenseCategories[0]?.id || '');
              setBudgetAmount('3000');
              setShowBudgetModal(true);
            }}
            className="text-xs text-emerald-400 hover:text-emerald-300 font-semibold flex items-center gap-1"
          >
            + Add Category Limit
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
          {budgets?.categoryBudgets && budgets.categoryBudgets.length > 0 ? (
            budgets.categoryBudgets.map((b) => {
              const cat = categories.find((c) => c.id === b.categoryId);
              return (
                <div
                  key={b.id}
                  className="p-4 rounded-xl bg-slate-900/80 border border-slate-800/80 space-y-3 relative group"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-200 truncate">
                      {cat?.name || 'Category'}
                    </span>
                    <div className="flex items-center gap-1">
                      <span className={`text-[10px] font-bold px-1.5 py-0.2 rounded ${
                        b.isExceeded
                          ? 'bg-rose-500/20 text-rose-300'
                          : b.isWarning
                          ? 'bg-amber-500/20 text-amber-300'
                          : 'bg-emerald-500/20 text-emerald-300'
                      }`}>
                        {b.usage}%
                      </span>
                      <button
                        onClick={() => handleDeleteBudget(b.id)}
                        className="text-slate-500 hover:text-rose-400 p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                        title="Delete limit"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  </div>

                  <div className="flex items-baseline justify-between text-xs">
                    <span className="text-slate-400 font-mono">
                      Spent: <strong className="text-white">{currency}{b.spent.toLocaleString()}</strong>
                    </span>
                    <span className="text-slate-400 font-mono">
                      Limit: {currency}{b.amount.toLocaleString()}
                    </span>
                  </div>

                  <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-300 ${
                        b.isExceeded ? 'bg-rose-500' : b.isWarning ? 'bg-amber-400' : 'bg-emerald-500'
                      }`}
                      style={{ width: `${Math.min(100, b.usage)}%` }}
                    />
                  </div>

                  <div className="text-[11px] text-slate-400 flex items-center justify-between">
                    <span>
                      {b.remaining >= 0 ? `${currency}${b.remaining.toLocaleString()} left` : `Exceeded by ${currency}${Math.abs(b.remaining).toLocaleString()}`}
                    </span>
                    <span className="text-[10px] text-slate-500">Alert @ {b.warningThreshold}%</span>
                  </div>
                </div>
              );
            })
          ) : (
            <div className="col-span-full py-8 text-center text-xs text-slate-500 bg-slate-900/40 rounded-xl border border-slate-800/60">
              No category-specific limits configured yet. Click "+ Add Category Limit" to set one.
            </div>
          )}
        </div>
      </div>

      {/* Savings Goals Section */}
      <div className="space-y-4 pt-4 border-t border-slate-800/80">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm font-bold text-white">Student Savings Goals</h2>
            <p className="text-xs text-slate-400">Save for laptops, textbooks, certifications, and emergency funds</p>
          </div>
          <button
            onClick={() => setShowGoalModal(true)}
            className="text-xs text-teal-400 hover:text-teal-300 font-semibold flex items-center gap-1"
          >
            + Create Goal
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {goals.length > 0 ? (
            goals.map((goal) => {
              const pct = Math.min(100, Math.round((goal.currentAmount / goal.targetAmount) * 100));
              const isDone = goal.currentAmount >= goal.targetAmount;

              return (
                <div
                  key={goal.id}
                  className="p-5 rounded-2xl bg-slate-900/80 border border-slate-800/80 space-y-3 relative group"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-white flex items-center gap-2">
                      <Coins className="w-4 h-4 text-teal-400" />
                      {goal.title}
                    </span>
                    <button
                      onClick={() => handleDeleteGoal(goal.id)}
                      className="text-slate-500 hover:text-rose-400 p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                      title="Delete goal"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <div className="flex items-baseline justify-between">
                    <div>
                      <div className="text-xl font-bold font-mono text-emerald-400">
                        {currency}{goal.currentAmount.toLocaleString()}
                        <span className="text-xs text-slate-400 font-normal ml-1">
                          / {currency}{goal.targetAmount.toLocaleString()}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-400 mt-0.5">
                        Target date: <span className="font-mono text-slate-300">{goal.targetDate}</span>
                      </p>
                    </div>
                    <span className="font-mono font-bold text-slate-200 text-sm">
                      {pct}%
                    </span>
                  </div>

                  <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-colors ${
                        isDone ? 'bg-emerald-400' : 'bg-teal-400'
                      }`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>

                  <div className="pt-2 flex items-center justify-between">
                    <span className="text-[10px] px-2 py-0.5 rounded bg-slate-800 text-slate-400 font-medium">
                      {goal.category}
                    </span>
                    {!isDone ? (
                      <button
                        onClick={() => {
                          setDepositGoal(goal);
                          setDepositAmount('500');
                        }}
                        className="px-2.5 py-1 bg-teal-500/15 hover:bg-teal-500/25 text-teal-300 border border-teal-500/30 rounded-lg text-xs font-semibold transition-colors"
                      >
                        + Deposit
                      </button>
                    ) : (
                      <span className="text-[11px] text-emerald-400 font-semibold flex items-center gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5" /> Achieved!
                      </span>
                    )}
                  </div>
                </div>
              );
            })
          ) : (
            <div className="col-span-full py-8 text-center text-xs text-slate-500 bg-slate-900/40 rounded-xl border border-slate-800/60">
              No savings goals created. Set a goal for books, a new laptop, or travel!
            </div>
          )}
        </div>
      </div>

      {/* Set Budget Modal */}
      {showBudgetModal && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <form onSubmit={handleSaveBudget} className="bg-slate-900 border border-slate-800 rounded-2xl max-w-sm w-full p-5 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-white">Configure Spending Limit</h3>
              <button type="button" onClick={() => setShowBudgetModal(false)} className="text-slate-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-400 mb-1">Scope</label>
                <select
                  value={selectedCatId}
                  onChange={(e) => setSelectedCatId(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-200"
                >
                  <option value="">Overall Monthly Budget</option>
                  {expenseCategories.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-slate-400 mb-1">Budget Amount ({currency})</label>
                <input
                  type="number"
                  step="0.01"
                  required
                  placeholder="e.g. 5000"
                  value={budgetAmount}
                  onChange={(e) => setBudgetAmount(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-200 font-mono"
                />
              </div>

              <div>
                <label className="block text-slate-400 mb-1">Warning Alert Threshold ({budgetThreshold}%)</label>
                <input
                  type="range"
                  min="50"
                  max="95"
                  value={budgetThreshold}
                  onChange={(e) => setBudgetThreshold(parseInt(e.target.value, 10))}
                  className="w-full accent-emerald-500"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowBudgetModal(false)}
                className="px-3 py-1.5 bg-slate-800 text-slate-300 rounded-lg text-xs"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-1.5 bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-semibold rounded-lg text-xs"
              >
                Save Limit
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Add Goal Modal */}
      {showGoalModal && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <form onSubmit={handleCreateGoal} className="bg-slate-900 border border-slate-800 rounded-2xl max-w-sm w-full p-5 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-white">Create Savings Goal</h3>
              <button type="button" onClick={() => setShowGoalModal(false)} className="text-slate-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-400 mb-1">Goal Title</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Laptop, Semester Books, Trip"
                  value={goalTitle}
                  onChange={(e) => setGoalTitle(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-200"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-slate-400 mb-1">Target Amount ({currency})</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    placeholder="e.g. 25000"
                    value={goalTarget}
                    onChange={(e) => setGoalTarget(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-200 font-mono"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 mb-1">Already Saved ({currency})</label>
                  <input
                    type="number"
                    step="0.01"
                    placeholder="0"
                    value={goalInitial}
                    onChange={(e) => setGoalInitial(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-200 font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-slate-400 mb-1">Category</label>
                  <select
                    value={goalCategory}
                    onChange={(e) => setGoalCategory(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-200"
                  >
                    <option value="Tech">Tech / Hardware</option>
                    <option value="Books">Books &amp; Study</option>
                    <option value="Emergency">Emergency Fund</option>
                    <option value="Travel">Travel / Home</option>
                    <option value="Certification">Certification</option>
                  </select>
                </div>
                <div>
                  <label className="block text-slate-400 mb-1">Target Date</label>
                  <input
                    type="date"
                    value={goalTargetDate}
                    onChange={(e) => setGoalTargetDate(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-200"
                  />
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowGoalModal(false)}
                className="px-3 py-1.5 bg-slate-800 text-slate-300 rounded-lg text-xs"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-1.5 bg-teal-500 hover:bg-teal-600 text-slate-950 font-semibold rounded-lg text-xs"
              >
                Save Goal
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Deposit to Goal Modal */}
      {depositGoal && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <form onSubmit={handleDepositSubmit} className="bg-slate-900 border border-slate-800 rounded-2xl max-w-sm w-full p-5 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-white">Deposit to {depositGoal.title}</h3>
              <button type="button" onClick={() => setDepositGoal(null)} className="text-slate-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-400 mb-1">Deposit Amount ({currency})</label>
                <input
                  type="number"
                  step="0.01"
                  required
                  placeholder="e.g. 500"
                  value={depositAmount}
                  onChange={(e) => setDepositAmount(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-200 font-mono text-base"
                />
              </div>

              <label className="flex items-center gap-2 text-slate-300 cursor-pointer pt-1">
                <input
                  type="checkbox"
                  checked={recordDepositTx}
                  onChange={(e) => setRecordDepositTx(e.target.checked)}
                  className="rounded accent-emerald-500"
                />
                <span>Also record as an expense transaction from Primary Bank</span>
              </label>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setDepositGoal(null)}
                className="px-3 py-1.5 bg-slate-800 text-slate-300 rounded-lg text-xs"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-1.5 bg-teal-500 hover:bg-teal-600 text-slate-950 font-semibold rounded-lg text-xs"
              >
                Confirm Deposit
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
