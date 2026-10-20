import React from 'react';
import {
  Wallet,
  PlusCircle,
  Sun,
  Moon,
  LogOut,
  Menu,
  GraduationCap,
  Sparkles,
} from 'lucide-react';
import { User } from '../types.ts';

interface NavbarProps {
  user: User;
  onOpenAddTx: (defaultKind?: 'expense' | 'income') => void;
  onOpenAI: () => void;
  onToggleTheme: () => void;
  onLogout: () => void;
  onToggleMobileMenu: () => void;
  currency: string;
  onCurrencyChange: (c: string) => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  user,
  onOpenAddTx,
  onOpenAI,
  onToggleTheme,
  onLogout,
  onToggleMobileMenu,
  currency,
  onCurrencyChange,
}) => {
  return (
    <header className="h-16 border-b border-slate-800/80 bg-slate-900/90 backdrop-blur sticky top-0 z-30 px-4 md:px-6 flex items-center justify-between transition-colors">
      <div className="flex items-center gap-3">
        <button
          onClick={onToggleMobileMenu}
          className="md:hidden p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800"
          aria-label="Toggle Navigation"
        >
          <Menu className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-400 flex items-center justify-center text-slate-950 font-black shadow-md shadow-emerald-950/40">
            <GraduationCap className="w-5 h-5 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-white text-base tracking-tight">Pennywise</span>
              <span className="hidden sm:inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                Student Edition
              </span>
            </div>
            <div className="hidden sm:block text-[11px] text-slate-400">
              {user.collegeName || 'College Student Finance'}
            </div>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2.5 sm:gap-3">
        {/* Currency Picker */}
        <select
          value={currency}
          onChange={(e) => onCurrencyChange(e.target.value)}
          className="bg-slate-800 border border-slate-700/80 text-xs text-slate-200 rounded-lg px-2 py-1.5 focus:outline-none focus:border-teal-500 font-mono"
          title="Select Currency"
        >
          <option value="₹">₹ INR</option>
          <option value="$">$ USD</option>
          <option value="€">€ EUR</option>
          <option value="£">£ GBP</option>
          <option value="¥">¥ JPY</option>
          <option value="A$">A$ AUD</option>
        </select>

        {/* AI Assistant Button */}
        <button
          onClick={onOpenAI}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-teal-500/10 to-indigo-500/10 hover:from-teal-500/20 hover:to-indigo-500/20 text-teal-300 border border-teal-500/30 rounded-lg text-xs font-medium transition-all shadow-sm"
          title="Ask Financial Advisor"
        >
          <Sparkles className="w-3.5 h-3.5 text-teal-400 animate-pulse" />
          <span className="hidden sm:inline">Ask AI</span>
        </button>

        {/* Quick Add Button */}
        <button
          onClick={() => onOpenAddTx('expense')}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-semibold rounded-lg text-xs transition-colors shadow-md shadow-emerald-500/20"
        >
          <PlusCircle className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Add Record</span>
          <span className="sm:hidden">+</span>
        </button>

        {/* Theme Toggle */}
        <button
          onClick={onToggleTheme}
          className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800/80 transition-colors"
          title="Toggle Theme"
        >
          {user.theme === 'light' ? <Moon className="w-4 h-4 text-slate-300" /> : <Sun className="w-4 h-4 text-amber-400" />}
        </button>

        {/* Logout */}
        <button
          onClick={onLogout}
          className="p-2 text-slate-400 hover:text-red-400 rounded-lg hover:bg-slate-800/80 transition-colors"
          title="Sign Out"
        >
          <LogOut className="w-4 h-4" />
        </button>
      </div>
    </header>
  );
};
