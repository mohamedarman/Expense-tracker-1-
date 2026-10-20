import React, { useState } from 'react';
import {
  Settings,
  FileText,
  Download,
  Trash2,
  Plus,
  Shield,
  Printer,
  CheckCircle2,
  AlertTriangle,
  User as UserIcon,
  Palette,
  GraduationCap,
} from 'lucide-react';
import { User, Category, Transaction, BudgetResponse, AnalyticsResponse } from '../types.ts';
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
  transactions,
  budgets,
  analytics,
  onRefreshUser,
  onRefreshAll,
  onLogout,
}) => {
  // Profile Form State
  const [name, setName] = useState(user.name);
  const [collegeName, setCollegeName] = useState(user.collegeName || '');
  const [degreeSemester, setDegreeSemester] = useState(user.degreeSemester || '');
  const [monthlyBudget, setMonthlyBudget] = useState(String(user.monthlyBudget || 15000));
  const [semesterBudget, setSemesterBudget] = useState(String(user.semesterBudget || 60000));
  const [semesterEndDate, setSemesterEndDate] = useState(user.semesterEndDate || '2026-12-15');
  const [profileMsg, setProfileMsg] = useState<string | null>(null);

  // New Category State
  const [newCatName, setNewCatName] = useState('');
  const [newCatKind, setNewCatKind] = useState<'expense' | 'income'>('expense');
  const [newCatIsEssential, setNewCatIsEssential] = useState(true);

  // Password state
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
      setProfileMsg('Profile updated successfully!');
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
        color: newCatKind === 'income' ? '#10b981' : '#f59e0b',
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
      setPwMsg('Password changed successfully.');
      setCurrentPw('');
      setNewPw('');
      setTimeout(() => setPwMsg(null), 2500);
    } catch (err: any) {
      setPwMsg(`Error: ${err.message}`);
    }
  };

  const handleExportJson = () => {
    window.location.href = '/api/auth/export';
  };

  const handleDeleteAccount = async () => {
    if (!confirm('DANGER: Are you sure you want to permanently delete your account and all financial records? This action cannot be reversed!')) {
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

  return (
    <div className="space-y-8 pb-16">
      {/* Printable Monthly Summary Report Header */}
      <div className="p-6 rounded-2xl bg-slate-900/80 border border-slate-800/80 space-y-4 shadow print:border-none print:bg-white print:text-black">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <FileText className="w-5 h-5 text-teal-400 print:text-black" />
              <h2 className="text-base font-bold text-white print:text-black">Monthly Academic Financial Report</h2>
            </div>
            <p className="text-xs text-slate-400 print:text-gray-600">
              Student: <strong className="text-slate-200 print:text-black">{user.name}</strong> • {user.collegeName || 'College'} • {user.degreeSemester || 'Semester'}
            </p>
          </div>
          <button
            onClick={handlePrintReport}
            className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-teal-300 border border-slate-700/80 rounded-xl text-xs flex items-center gap-1.5 transition-colors print:hidden"
          >
            <Printer className="w-3.5 h-3.5" /> Print / Save as PDF
          </button>
        </div>

        {/* Report Stats Summary Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2 text-xs">
          <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800 print:bg-gray-100 print:border-gray-300">
            <span className="text-slate-400 print:text-gray-600">Total Income / Allowance</span>
            <div className="text-base font-bold text-emerald-400 print:text-black font-mono mt-0.5">
              +{currency}{(curMonthData?.income ?? 0).toLocaleString()}
            </div>
          </div>
          <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800 print:bg-gray-100 print:border-gray-300">
            <span className="text-slate-400 print:text-gray-600">Total Outflows</span>
            <div className="text-base font-bold text-rose-400 print:text-black font-mono mt-0.5">
              -{currency}{(curMonthData?.expense ?? 0).toLocaleString()}
            </div>
          </div>
          <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800 print:bg-gray-100 print:border-gray-300">
            <span className="text-slate-400 print:text-gray-600">Net Month Savings</span>
            <div className="text-base font-bold text-teal-300 print:text-black font-mono mt-0.5">
              {currency}{((curMonthData?.income ?? 0) - (curMonthData?.expense ?? 0)).toLocaleString()}
            </div>
          </div>
          <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800 print:bg-gray-100 print:border-gray-300">
            <span className="text-slate-400 print:text-gray-600">Monthly Budget Adherence</span>
            <div className="text-base font-bold text-white print:text-black font-mono mt-0.5">
              {budgets?.overall.usage ?? 0}% utilized
            </div>
          </div>
        </div>
      </div>

      {/* Profile & Academic Settings */}
      <div className="p-6 rounded-2xl bg-slate-900/80 border border-slate-800/80 space-y-4 print:hidden">
        <div className="flex items-center gap-2">
          <GraduationCap className="w-5 h-5 text-emerald-400" />
          <h2 className="text-sm font-bold text-white">Academic &amp; Student Profile</h2>
        </div>

        {profileMsg && (
          <div className="p-2.5 rounded-lg text-xs font-medium bg-emerald-500/10 text-emerald-300 border border-emerald-500/30">
            {profileMsg}
          </div>
        )}

        <form onSubmit={handleUpdateProfile} className="space-y-3.5 text-xs">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-slate-400 mb-1">Full Name</label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-200"
              />
            </div>
            <div>
              <label className="block text-slate-400 mb-1">College / Institute Name</label>
              <input
                type="text"
                value={collegeName}
                onChange={(e) => setCollegeName(e.target.value)}
                placeholder="e.g. National Institute of Technology"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-200"
              />
            </div>
            <div>
              <label className="block text-slate-400 mb-1">Semester / Year</label>
              <input
                type="text"
                value={degreeSemester}
                onChange={(e) => setDegreeSemester(e.target.value)}
                placeholder="e.g. Semester 5 (B.Tech CS)"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-200"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-slate-400 mb-1">Default Monthly Budget ({currency})</label>
              <input
                type="number"
                step="0.01"
                value={monthlyBudget}
                onChange={(e) => setMonthlyBudget(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-200 font-mono"
              />
            </div>
            <div>
              <label className="block text-slate-400 mb-1">Semester Budget ({currency})</label>
              <input
                type="number"
                step="0.01"
                value={semesterBudget}
                onChange={(e) => setSemesterBudget(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-200 font-mono"
              />
            </div>
            <div>
              <label className="block text-slate-400 mb-1">Semester End Date</label>
              <input
                type="date"
                value={semesterEndDate}
                onChange={(e) => setSemesterEndDate(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-200 font-mono"
              />
            </div>
          </div>

          <div className="flex justify-end pt-1">
            <button
              type="submit"
              className="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-bold rounded-xl text-xs transition-colors shadow"
            >
              Save Profile Changes
            </button>
          </div>
        </form>
      </div>

      {/* Custom Categories Manager */}
      <div className="p-6 rounded-2xl bg-slate-900/80 border border-slate-800/80 space-y-4 print:hidden">
        <div>
          <h2 className="text-sm font-bold text-white">Custom Categories</h2>
          <p className="text-xs text-slate-400">Add your own categories for specialized college projects or clubs</p>
        </div>

        <form onSubmit={handleAddCategory} className="flex flex-col sm:flex-row gap-2.5 text-xs">
          <input
            type="text"
            required
            placeholder="Category name (e.g. Robotics Club, Gaming)"
            value={newCatName}
            onChange={(e) => setNewCatName(e.target.value)}
            className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-200"
          />
          <select
            value={newCatKind}
            onChange={(e) => setNewCatKind(e.target.value as any)}
            className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-200"
          >
            <option value="expense">Expense Category</option>
            <option value="income">Income Category</option>
          </select>
          <label className="flex items-center gap-1.5 px-3 py-2 bg-slate-950 rounded-xl border border-slate-800 text-slate-300">
            <input
              type="checkbox"
              checked={newCatIsEssential}
              onChange={(e) => setNewCatIsEssential(e.target.checked)}
              className="rounded accent-emerald-500"
            />
            <span>Essential</span>
          </label>
          <button
            type="submit"
            className="px-4 py-2 bg-teal-500 hover:bg-teal-600 text-slate-950 font-bold rounded-xl text-xs transition-colors shrink-0"
          >
            + Add Category
          </button>
        </form>

        <div className="space-y-1.5 pt-2">
          {customCategories.length > 0 ? (
            customCategories.map((c) => (
              <div
                key={c.id}
                className="flex items-center justify-between p-2.5 rounded-xl bg-slate-950/60 border border-slate-800 text-xs"
              >
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: c.color }} />
                  <span className="font-semibold text-slate-200">{c.name}</span>
                  <span className="text-[10px] px-2 py-0.2 rounded bg-slate-800 text-slate-400 capitalize">
                    {c.kind}
                  </span>
                  {c.isEssential && (
                    <span className="text-[10px] px-1.5 py-0.2 rounded bg-emerald-500/10 text-emerald-300">
                      Essential
                    </span>
                  )}
                </div>
                <button
                  onClick={() => handleDeleteCategory(c.id)}
                  className="text-slate-500 hover:text-red-400 p-1"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))
          ) : (
            <div className="text-xs text-slate-500 py-2">
              No custom categories added yet. Default categories are active.
            </div>
          )}
        </div>
      </div>

      {/* Security & Password */}
      <div className="p-6 rounded-2xl bg-slate-900/80 border border-slate-800/80 space-y-4 print:hidden">
        <div className="flex items-center gap-2">
          <Shield className="w-5 h-5 text-teal-400" />
          <h2 className="text-sm font-bold text-white">Security &amp; Password</h2>
        </div>

        {pwMsg && (
          <div className="p-2.5 rounded-lg text-xs font-medium bg-teal-500/10 text-teal-300 border border-teal-500/30">
            {pwMsg}
          </div>
        )}

        <form onSubmit={handleChangePassword} className="space-y-3 text-xs max-w-md">
          <div>
            <label className="block text-slate-400 mb-1">Current Password</label>
            <input
              type="password"
              required
              value={currentPw}
              onChange={(e) => setCurrentPw(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-200"
            />
          </div>
          <div>
            <label className="block text-slate-400 mb-1">New Password (at least 8 chars)</label>
            <input
              type="password"
              required
              minLength={8}
              value={newPw}
              onChange={(e) => setNewPw(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-200"
            />
          </div>
          <button
            type="submit"
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-semibold border border-slate-700"
          >
            Update Password
          </button>
        </form>
      </div>

      {/* Data Privacy & Danger Zone */}
      <div className="p-6 rounded-2xl bg-slate-900/80 border border-slate-800/80 space-y-4 print:hidden">
        <div>
          <h2 className="text-sm font-bold text-white">Privacy &amp; Data Ownership</h2>
          <p className="text-xs text-slate-400">
            You own 100% of your financial records. Download all personal data anytime or permanently delete your account.
          </p>
        </div>

        <div className="flex flex-wrap gap-3 pt-2">
          <button
            onClick={handleExportJson}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700/80 rounded-xl text-xs flex items-center gap-2 transition-colors"
          >
            <Download className="w-4 h-4 text-emerald-400" /> Export Complete Personal Data (JSON)
          </button>
          <button
            onClick={handleDeleteAccount}
            className="px-4 py-2 bg-rose-950/40 hover:bg-rose-900/50 text-rose-300 border border-rose-800/40 rounded-xl text-xs flex items-center gap-2 transition-colors"
          >
            <Trash2 className="w-4 h-4 text-rose-400" /> Permanently Delete My Account
          </button>
        </div>
      </div>
    </div>
  );
};
