import React from 'react';
import {
  Plus,
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
    <header className="h-14 border-b border-slate-800 bg-slate-900 sticky top-0 z-30 px-4 md:px-6 flex items-center justify-between transition-colors">
      <div className="flex items-center gap-3">
        <button
          onClick={onToggleMobileMenu}
          className="md:hidden p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800"
          aria-label="Toggle Navigation"
        >
          <Menu className="w-4 h-4" />
        </button>

        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-teal-500/10 border border-teal-500/30 flex items-center justify-center text-teal-300">
            <GraduationCap className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-white text-sm tracking-tight">Pennywise</span>
              <span className="hidden sm:inline-flex items-center px-1.5 py-0.2 rounded text-[10px] font-semibold bg-teal-500/10 text-teal-300 border border-teal-500/20">
                Student Finance
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2">
        {/* Currency Selector */}
        <select
          value={currency}
          onChange={(e) => onCurrencyChange(e.target.value)}
          className="bg-slate-950 border border-slate-800 text-xs text-slate-300 rounded-lg px-2 py-1.5 focus:outline-none focus:border-teal-500 font-mono"
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
          className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-750 text-teal-300 border border-slate-700/80 rounded-lg text-xs font-medium transition-colors"
          title="Ask Financial Advisor"
        >
          <Sparkles className="w-3.5 h-3.5 text-teal-400" />
          <span className="hidden sm:inline">Ask AI</span>
        </button>

        {/* Quick Add Button */}
        <button
          onClick={() => onOpenAddTx('expense')}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-bold rounded-lg text-xs transition-colors shadow-sm"
        >
          <Plus className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Add Record</span>
          <span className="sm:hidden">+</span>
        </button>

        {/* Theme Toggle */}
        <button
          onClick={onToggleTheme}
          className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
          title="Toggle Theme"
        >
          {user.theme === 'light' ? <Moon className="w-4 h-4 text-slate-300" /> : <Sun className="w-4 h-4 text-amber-400" />}
        </button>

        {/* Logout */}
        <button
          onClick={onLogout}
          className="p-1.5 text-slate-400 hover:text-red-400 rounded-lg hover:bg-slate-800 transition-colors"
          title="Sign Out"
        >
          <LogOut className="w-4 h-4" />
        </button>
      </div>
    </header>
  );
};
