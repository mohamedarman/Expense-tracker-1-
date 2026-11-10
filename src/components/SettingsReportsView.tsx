import React, { useState } from 'react';
import {
  Download,
  Trash2,
  Printer,
} from 'lucide-react';
import {
  User,
  Category,
  Transaction,
  BudgetResponse,
  AnalyticsResponse,
} from '../types.ts';
import { api } from '../api.ts';

interface SettingsReportsViewProps {
  user: User;
  currency: string;
  categories: Category[];
  transactions: Transaction[];
  budgets: BudgetResponse | null;
  analytics: AnalyticsResponse | null;
  onRefreshUser: () => void;
  onRefreshAll: () => void;
  onLogout: () => void;
}

export const SettingsReportsView: React.FC<SettingsReportsViewProps> = ({
  user,
  currency,
  categories,
  budgets,
  analytics,
  onRefreshUser,
  onRefreshAll,
  onLogout,
}) => {
  const [name, setName] = useState(user.name);
  const [collegeName, setCollegeName] = useState(user.collegeName || '');
  const [degreeSemester, setDegreeSemester] = useState(user.degreeSemester || '');
  const [monthlyBudget, setMonthlyBudget] = useState(
    String(user.monthlyBudget || 15000)
  );
  const [semesterBudget, setSemesterBudget] = useState(
    String(user.semesterBudget || 60000)
  );
  const [semesterEndDate, setSemesterEndDate] = useState(
    user.semesterEndDate || '2026-12-15'
  );
  const [profileMsg, setProfileMsg] = useState<string | null>(null);

  const [newCatName, setNewCatName] = useState('');
  const [newCatKind, setNewCatKind] = useState<'expense' | 'income'>('expense');
  const [newCatIsEssential, setNewCatIsEssential] = useState(true);

  const [currentPw, setCurrentPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [pwMsg, setPwMsg] = useState<string | null>(null);

  const customCategories = categories.filter((c) => c.userId !== null);

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.updateProfile({
        name: name.trim(),
        collegeName: collegeName.trim(),
        degreeSemester: degreeSemester.trim(),
        monthlyBudget: parseFloat(monthlyBudget) || 15000,
        semesterBudget: parseFloat(semesterBudget) || 60000,
        semesterEndDate,
      });
      setProfileMsg('Profile saved');
      setTimeout(() => setProfileMsg(null), 2500);
      onRefreshUser();
    } catch (err: any) {
      setProfileMsg(`Error: ${err.message}`);
    }
  };

  const handleAddCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCatName.trim()) return;
    try {
      await api.createCategory({
        name: newCatName.trim(),
        kind: newCatKind,
        color: newCatKind === 'income' ? '#4cc38a' : '#2dd4bf',
        icon: 'Tag',
        isEssential: newCatIsEssential,
      });
      setNewCatName('');
      onRefreshAll();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleDeleteCategory = async (id: string) => {
    if (!confirm('Delete this custom category?')) return;
    try {
      await api.deleteCategory(id);
      onRefreshAll();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.changePassword(currentPw, newPw);
      setPwMsg('Password updated');
      setCurrentPw('');
      setNewPw('');
      setTimeout(() => setPwMsg(null), 2500);
    } catch (err: any) {
      setPwMsg(`Error: ${err.message}`);
    }
  };

  const handleExportJson = async () => {
    try {
      await api.exportUserDataArchive();
    } catch (err: any) {
      alert(err.message || 'Export failed');
    }
  };

  const handleDeleteAccount = async () => {
    if (
      !confirm(
        'Are you sure you want to permanently delete your account and all financial records?'
      )
    ) {
      return;
    }
    try {
      await api.deleteAccount();
      onLogout();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handlePrintReport = () => {
    window.print();
  };

  const curMonthData = analytics?.currentMonth;
  const income = Math.round(curMonthData?.income ?? 0);
  const expense = Math.round(curMonthData?.expense ?? 0);
  const netSavings = income - expense;

  return (
    <div className="space-y-8 pb-16 font-sans w-full min-w-0">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 print:hidden min-w-0">
        <div className="space-y-1 min-w-0">
          <div className="text-[12px] font-mono text-ink-muted">
            Account configuration and statements
          </div>
          <h1 className="text-[24px] sm:text-[28px] font-medium text-ink-primary tracking-tight leading-tight">
            Reports and settings
          </h1>
        </div>
        <button
          type="button"
          onClick={handlePrintReport}
          className="h-9 px-3.5 btn-secondary rounded-lg text-[13px] font-normal flex items-center gap-2 whitespace-nowrap self-start sm:self-auto shrink-0"
        >
          <Printer className="w-4 h-4 text-ink-muted shrink-0" strokeWidth={1.5} />
          <span>Print statement</span>
        </button>
      </div>

      {/* Printable Monthly Financial Statement */}
      <div className="p-4 sm:p-6 rounded-xl surface-card space-y-5 print:border-none print:bg-white print:text-black min-w-0">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 min-w-0">
          <div className="space-y-0.5 min-w-0">
            <h2 className="text-[16px] font-medium text-ink-primary print:text-black">
              Monthly financial statement
            </h2>
            <p className="text-[13px] text-ink-secondary print:text-gray-600 break-words">
              {user.name} · {user.collegeName || 'Student campus'} ·{' '}
              {user.degreeSemester || 'Current semester'}
            </p>
          </div>
          <span className="text-[12px] font-mono text-ink-muted shrink-0">
            {new Date().toLocaleDateString('en-US', {
              month: 'long',
              year: 'numeric',
            })}
          </span>
        </div>

        <div className="pt-4 border-t hairline-border grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 text-[13px] min-w-0">
          <div className="space-y-1 min-w-0">
            <span className="text-[12px] text-ink-muted block">Income and allowance</span>
            <div className="text-[20px] sm:text-[22px] font-medium text-ink-primary font-mono tabular-nums break-words">
              {currency}{income.toLocaleString()}
            </div>
          </div>
          <div className="space-y-1 min-w-0">
            <span className="text-[12px] text-ink-muted block">Recorded expenses</span>
            <div className="text-[20px] sm:text-[22px] font-medium text-ink-primary font-mono tabular-nums break-words">
              {currency}{expense.toLocaleString()}
            </div>
          </div>
          <div className="space-y-1 min-w-0">
            <span className="text-[12px] text-ink-muted block">Net month balance</span>
            <div
              className={`text-[20px] sm:text-[22px] font-medium font-mono tabular-nums break-words ${
                netSavings >= 0 ? 'text-positive' : 'text-negative'
              }`}
            >
              {netSavings < 0 ? '-' : ''}{currency}{Math.abs(netSavings).toLocaleString()}
            </div>
          </div>
          <div className="space-y-1 min-w-0">
            <span className="text-[12px] text-ink-muted block">Budget utilization</span>
            <div className="text-[20px] sm:text-[22px] font-medium text-ink-primary font-mono tabular-nums">
              {budgets?.overall.usage ?? 0}%
            </div>
          </div>
        </div>
      </div>

      {/* Academic & Student Profile */}
      <div className="p-4 sm:p-6 rounded-xl surface-card space-y-5 print:hidden min-w-0">
        <div className="space-y-0.5 min-w-0">
          <h2 className="text-[16px] font-medium text-ink-primary">
            Academic profile and defaults
          </h2>
          <p className="text-[13px] text-ink-secondary">
            Update your campus details and baseline allowance limits
          </p>
        </div>

        {profileMsg && (
          <div className="p-3 rounded-lg text-[13px] surface-raised text-ink-primary">
            {profileMsg}
          </div>
        )}

        <form onSubmit={handleUpdateProfile} className="space-y-4 text-[13px] min-w-0">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 min-w-0">
            <div className="space-y-1.5 min-w-0">
              <label className="block text-ink-secondary">Full name</label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full min-w-0 h-9 input-field rounded-lg px-3"
              />
            </div>
            <div className="space-y-1.5 min-w-0">
              <label className="block text-ink-secondary">College or university</label>
              <input
                type="text"
                value={collegeName}
                onChange={(e) => setCollegeName(e.target.value)}
                placeholder="State University"
                className="w-full min-w-0 h-9 input-field rounded-lg px-3"
              />
            </div>
            <div className="space-y-1.5 min-w-0">
              <label className="block text-ink-secondary">Degree and semester</label>
              <input
                type="text"
                value={degreeSemester}
                onChange={(e) => setDegreeSemester(e.target.value)}
                placeholder="Semester 5 (B.Tech CS)"
                className="w-full min-w-0 h-9 input-field rounded-lg px-3"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 min-w-0">
            <div className="space-y-1.5 min-w-0">
              <label className="block text-ink-secondary">
                Default monthly budget ({currency})
              </label>
              <input
                type="number"
                step="0.01"
                value={monthlyBudget}
                onChange={(e) => setMonthlyBudget(e.target.value)}
                className="w-full min-w-0 h-9 input-field rounded-lg px-3 font-mono tabular-nums"
              />
            </div>
            <div className="space-y-1.5 min-w-0">
              <label className="block text-ink-secondary">
                Semester budget ({currency})
              </label>
              <input
                type="number"
                step="0.01"
                value={semesterBudget}
                onChange={(e) => setSemesterBudget(e.target.value)}
                className="w-full min-w-0 h-9 input-field rounded-lg px-3 font-mono tabular-nums"
              />
            </div>
            <div className="space-y-1.5 min-w-0">
              <label className="block text-ink-secondary">Semester end date</label>
              <input
                type="date"
                value={semesterEndDate}
                onChange={(e) => setSemesterEndDate(e.target.value)}
                className="w-full min-w-0 h-9 input-field rounded-lg px-3 font-mono"
              />
            </div>
          </div>

          <div className="flex justify-end pt-1">
            <button
              type="submit"
              className="h-9 px-4 btn-primary rounded-lg text-[13px] font-medium"
            >
              Save profile
            </button>
          </div>
        </form>
      </div>

      {/* Custom Categories Manager */}
      <div className="p-4 sm:p-6 rounded-xl surface-card space-y-5 print:hidden min-w-0">
        <div className="space-y-0.5 min-w-0">
          <h2 className="text-[16px] font-medium text-ink-primary">
            Custom categories
          </h2>
          <p className="text-[13px] text-ink-secondary">
            Create categories for lab projects, campus clubs, or side income
          </p>
        </div>

        <form
          onSubmit={handleAddCategory}
          className="flex flex-col sm:flex-row gap-3 text-[13px] min-w-0"
        >
          <input
            type="text"
            required
            placeholder="Category name"
            value={newCatName}
            onChange={(e) => setNewCatName(e.target.value)}
            className="flex-1 min-w-0 h-9 input-field rounded-lg px-3"
          />
          <select
            value={newCatKind}
            onChange={(e) => setNewCatKind(e.target.value as any)}
            className="h-9 input-field rounded-lg px-3 min-w-0"
          >
            <option value="expense">Expense</option>
            <option value="income">Income</option>
          </select>
          <label className="h-9 flex items-center gap-2 px-3 input-field rounded-lg text-ink-secondary cursor-pointer shrink-0">
            <input
              type="checkbox"
              checked={newCatIsEssential}
              onChange={(e) => setNewCatIsEssential(e.target.checked)}
              className="rounded accent-[var(--accent)]"
            />
            <span>Essential</span>
          </label>
          <button
            type="submit"
            className="h-9 px-4 btn-secondary rounded-lg text-[13px] font-normal shrink-0"
          >
            Add category
          </button>
        </form>

        <div className="divide-y hairline-divide pt-1">
          {customCategories.length > 0 ? (
            customCategories.map((c) => (
              <div
                key={c.id}
                className="py-2.5 flex items-center justify-between gap-2 text-[13px] min-w-0"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-ink-primary font-normal truncate">{c.name}</span>
                  <span className="text-[12px] text-ink-muted capitalize shrink-0">
                    · {c.kind} · {c.isEssential ? 'Essential' : 'Discretionary'}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => handleDeleteCategory(c.id)}
                  className="text-ink-muted hover:text-negative p-1 shrink-0"
                  title="Delete category"
                >
                  <Trash2 className="w-3.5 h-3.5" strokeWidth={1.5} />
                </button>
              </div>
            ))
          ) : (
            <div className="text-[13px] text-ink-muted py-2">
              No custom categories created yet
            </div>
          )}
        </div>
      </div>

      {/* Security & Data Ownership */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 print:hidden min-w-0">
        <div className="p-4 sm:p-6 rounded-xl surface-card space-y-4 min-w-0">
          <div className="space-y-0.5 min-w-0">
            <h2 className="text-[16px] font-medium text-ink-primary">
              Update password
            </h2>
            <p className="text-[13px] text-ink-secondary">
              Change your account password
            </p>
          </div>

          {pwMsg && (
            <div className="p-3 rounded-lg text-[13px] surface-raised text-ink-primary">
              {pwMsg}
            </div>
          )}

          <form onSubmit={handleChangePassword} className="space-y-3 text-[13px] min-w-0">
            <div className="space-y-1.5 min-w-0">
              <label className="block text-ink-secondary">Current password</label>
              <input
                type="password"
                required
                value={currentPw}
                onChange={(e) => setCurrentPw(e.target.value)}
                className="w-full min-w-0 h-9 input-field rounded-lg px-3"
              />
            </div>
            <div className="space-y-1.5 min-w-0">
              <label className="block text-ink-secondary">
                New password (8+ characters)
              </label>
              <input
                type="password"
                required
                minLength={8}
                value={newPw}
                onChange={(e) => setNewPw(e.target.value)}
                className="w-full min-w-0 h-9 input-field rounded-lg px-3"
              />
            </div>
            <div className="pt-1">
              <button
                type="submit"
                className="h-9 px-4 btn-secondary rounded-lg text-[13px] font-normal"
              >
                Update password
              </button>
            </div>
          </form>
        </div>

        <div className="p-4 sm:p-6 rounded-xl surface-card flex flex-col justify-between space-y-4 min-w-0">
          <div className="space-y-1 min-w-0">
            <h2 className="text-[16px] font-medium text-ink-primary">
              Data export and account deletion
            </h2>
            <p className="text-[13px] text-ink-secondary leading-relaxed">
              Download a full JSON archive of your ledger records or permanently remove your account.
            </p>
          </div>

          <div className="flex flex-wrap gap-3 pt-2">
            <button
              type="button"
              onClick={handleExportJson}
              className="h-9 px-3.5 btn-secondary rounded-lg text-[13px] flex items-center gap-2"
            >
              <Download className="w-4 h-4 text-ink-muted shrink-0" strokeWidth={1.5} />
              <span>Export JSON archive</span>
            </button>
            <button
              type="button"
              onClick={handleDeleteAccount}
              className="h-9 px-3.5 rounded-lg border border-[#e5484d]/30 bg-[#e5484d]/10 text-negative text-[13px] flex items-center gap-2 hover:bg-[#e5484d]/20 transition-colors"
            >
              <Trash2 className="w-4 h-4 shrink-0" strokeWidth={1.5} />
              <span>Delete account</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
