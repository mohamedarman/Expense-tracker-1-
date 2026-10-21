import React from 'react';
import {
  Plus,
  Sun,
  Moon,
  LogOut,
  Menu,
  GraduationCap,
  Bot,
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
    <header className="h-14 border-b border-slate-800 bg-slate-900/95 backdrop-blur-md sticky top-0 z-30 px-4 md:px-6 flex items-center justify-between gap-8 transition-colors select-none">
      {/* Zone 1: Brand Wordmark (Single text element, no adjacent badges) */}
      <div className="flex items-center gap-3 shrink-0">
        <button
          onClick={onToggleMobileMenu}
          className="md:hidden p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
          aria-label="Toggle Navigation Menu"
        >
          <Menu className="w-4 h-4" />
        </button>

        <a href="#dashboard" className="flex items-center gap-2.5 group">
          <img src="/logo.png" alt="CostCurve" className="w-8 h-8 rounded-lg"/>
          <span className="font-extrabold text-white text-base tracking-tight whitespace-nowrap">
            CostCurve
          </span>
        </a>
      </div>

      {/* Zone 2: Contextual Navigation Info (Quiet unboxed student metadata) */}
      <div className="hidden lg:flex items-center gap-2 text-xs text-slate-400 truncate">
        <span className="text-slate-300 font-medium truncate">{user.collegeName || 'Student Campus'}</span>
        <span aria-hidden="true" className="text-slate-600">·</span>
        <span className="truncate">{user.degreeSemester || 'Degree Program'}</span>
      </div>

      {/* Zone 3: Actions (Currency, Theme, AI Advisor & Primary Action) */}
      <div className="flex items-center gap-2.5 shrink-0">
        {/* Currency Selector */}
        <select
          value={currency}
          onChange={(e) => onCurrencyChange(e.target.value)}
          className="bg-slate-950 border border-slate-800 text-xs text-slate-300 rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-teal-500 font-mono transition-colors cursor-pointer"
          title="Select active currency"
        >
          <option value="₹">₹ INR</option>
          <option value="$">$ USD</option>
          <option value="€">€ EUR</option>
          <option value="£">£ GBP</option>
          <option value="¥">¥ JPY</option>
          <option value="A$">A$ AUD</option>
        </select>

        {/* AI Financial Advisor Trigger */}
        <button
          onClick={onOpenAI}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800/80 hover:bg-slate-800 text-teal-300 border border-slate-700/80 rounded-lg text-xs font-medium transition-colors whitespace-nowrap shrink-0"
          title="Consult AI Financial Advisor"
        >
          <Bot className="w-3.5 h-3.5 text-teal-400" />
          <span className="hidden sm:inline">Ask Advisor</span>
        </button>

        {/* Primary Action Button */}
        <button
          onClick={() => onOpenAddTx('expense')}
          className="flex items-center gap-1.5 px-3.5 py-1.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold rounded-lg text-xs transition-colors shadow-sm whitespace-nowrap shrink-0"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>New Entry</span>
        </button>

        {/* Theme Toggle */}
        <button
          onClick={onToggleTheme}
          className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
          title="Toggle light / dark mode"
          aria-label="Toggle theme"
        >
          {user.theme === 'light' ? (
            <Moon className="w-4 h-4 text-slate-300" />
          ) : (
            <Sun className="w-4 h-4 text-amber-300" />
          )}
        </button>

        {/* Logout */}
        <button
          onClick={onLogout}
          className="p-1.5 text-slate-400 hover:text-red-400 rounded-lg hover:bg-slate-800 transition-colors"
          title="Sign out"
          aria-label="Sign out"
        >
          <LogOut className="w-4 h-4" />
        </button>
      </div>
    </header>
  );
};
