import React from 'react';
import {
  Plus,
  Sun,
  Moon,
  LogOut,
  Menu,
  MessageSquare,
} from 'lucide-react';
import { User } from '../types.ts';
import logo from '../assets/logo.png';

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
    <header className="min-h-14 border-b hairline-border surface-deep sticky top-0 z-30 px-3 sm:px-4 md:px-6 py-2 flex items-center justify-between gap-2 sm:gap-4 select-none w-full min-w-0">
      {/* Zone 1: Brand Wordmark */}
      <div className="flex items-center gap-2 sm:gap-3 min-w-0 shrink-0">
        <button
          type="button"
          onClick={onToggleMobileMenu}
          className="md:hidden h-8 w-8 shrink-0 flex items-center justify-center text-ink-muted hover:text-ink-primary rounded-lg hover:bg-[var(--bg-raised)] transition-colors"
          aria-label="Toggle navigation menu"
        >
          <Menu className="w-4 h-4" strokeWidth={1.5} />
        </button>

        <a href="#dashboard" className="flex items-center gap-2 min-w-0 shrink-0">
          <img
            src={logo}
            alt="CostCurve"
            referrerPolicy="no-referrer"
            className="w-6 h-6 rounded-md object-contain shrink-0"
          />
          <span className="font-medium text-ink-primary text-[15px] sm:text-[16px] leading-none tracking-tight whitespace-nowrap">
            CostCurve
          </span>
        </a>
      </div>

      {/* Zone 2: Quiet Unboxed Academic Context */}
      <div className="hidden lg:flex items-center gap-2 text-[13px] text-ink-muted min-w-0 truncate">
        <span className="text-ink-secondary truncate">{user.collegeName || 'Student campus'}</span>
        <span aria-hidden="true">·</span>
        <span className="truncate">{user.degreeSemester || 'Current semester'}</span>
      </div>

      {/* Zone 3: Quiet Chrome Controls & Single Primary Action */}
      <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
        <select
          value={currency}
          onChange={(e) => onCurrencyChange(e.target.value)}
          aria-label="Active currency"
          className="h-8 input-field text-xs rounded-lg px-1.5 sm:px-2.5 font-mono cursor-pointer shrink-0"
          title="Active currency"
        >
          <option value="₹">₹ INR</option>
          <option value="$">$ USD</option>
          <option value="€">€ EUR</option>
          <option value="£">£ GBP</option>
          <option value="¥">¥ JPY</option>
          <option value="A$">A$ AUD</option>
        </select>

        <button
          type="button"
          onClick={onOpenAI}
          className="h-8 px-2 sm:px-3 btn-secondary rounded-lg text-xs font-normal flex items-center justify-center gap-1.5 whitespace-nowrap shrink-0"
          title="Open budget advisor"
          aria-label="Open budget advisor"
        >
          <MessageSquare className="w-3.5 h-3.5 text-ink-muted shrink-0" strokeWidth={1.5} />
          <span className="hidden sm:inline">Advisor</span>
        </button>

        <button
          type="button"
          onClick={() => onOpenAddTx('expense')}
          className="h-8 px-2.5 sm:px-3.5 btn-primary rounded-lg text-xs font-medium flex items-center justify-center gap-1 whitespace-nowrap shrink-0"
        >
          <Plus className="w-3.5 h-3.5 shrink-0" strokeWidth={1.75} />
          <span className="hidden xs:inline sm:inline">New entry</span>
          <span className="xs:hidden sm:hidden">Add</span>
        </button>

        <button
          type="button"
          onClick={onToggleTheme}
          className="h-8 w-8 shrink-0 flex items-center justify-center text-ink-muted hover:text-ink-primary rounded-lg hover:bg-[var(--bg-raised)] transition-colors"
          title="Switch theme"
          aria-label="Switch theme"
        >
          {user.theme === 'light' ? (
            <Moon className="w-4 h-4" strokeWidth={1.5} />
          ) : (
            <Sun className="w-4 h-4" strokeWidth={1.5} />
          )}
        </button>

        <button
          type="button"
          onClick={onLogout}
          className="h-8 w-8 shrink-0 flex items-center justify-center text-ink-muted hover:text-negative rounded-lg hover:bg-[var(--bg-raised)] transition-colors"
          title="Sign out"
          aria-label="Sign out"
        >
          <LogOut className="w-4 h-4" strokeWidth={1.5} />
        </button>
      </div>
    </header>
  );
};
