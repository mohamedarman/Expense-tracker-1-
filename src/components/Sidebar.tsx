import React from 'react';
import {
  LayoutDashboard,
  Receipt,
  Target,
  GraduationCap,
  CalendarClock,
  TrendingUp,
  Settings,
  Bot,
  ChevronRight,
} from 'lucide-react';
import { User } from '../types.ts';

export type NavTab =
  | 'dashboard'
  | 'transactions'
  | 'budgets'
  | 'student_hub'
  | 'subscriptions'
  | 'analytics'
  | 'settings';

interface SidebarProps {
  currentTab: NavTab;
  onSelectTab: (tab: NavTab) => void;
  user: User;
  healthScore?: number;
  isOpenMobile: boolean;
  onCloseMobile: () => void;
  onOpenAI: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentTab,
  onSelectTab,
  user,
  isOpenMobile,
  onCloseMobile,
  onOpenAI,
}) => {
  const navItems = [
    { id: 'dashboard' as NavTab, label: 'Dashboard', icon: LayoutDashboard },
    { id: 'transactions' as NavTab, label: 'Transactions', icon: Receipt },
    { id: 'budgets' as NavTab, label: 'Budgets & Goals', icon: Target },
    { id: 'student_hub' as NavTab, label: 'Student Hub', icon: GraduationCap },
    { id: 'subscriptions' as NavTab, label: 'Subscriptions', icon: CalendarClock },
    { id: 'analytics' as NavTab, label: 'Analytics', icon: TrendingUp },
    { id: 'settings' as NavTab, label: 'Reports & Export', icon: Settings },
  ];

  const handleNavClick = (tab: NavTab) => {
    onSelectTab(tab);
    onCloseMobile();
  };

  return (
    <>
      {/* Mobile Backdrop */}
      {isOpenMobile && (
        <div
          onClick={onCloseMobile}
          className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-40 md:hidden"
        />
      )}

      {/* Sidebar Container */}
      <aside
        className={`fixed md:static inset-y-0 left-0 z-40 w-64 bg-slate-900/90 border-r border-slate-800 flex flex-col justify-between transition-transform duration-200 ease-in-out md:translate-x-0 ${
          isOpenMobile ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="p-4 space-y-4">
          {/* Student Profile Card (Clean, tasteful typography) */}
          <div className="p-3 rounded-xl bg-slate-800/40 border border-slate-800 flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-teal-500/10 border border-teal-500/30 flex items-center justify-center text-teal-300 font-bold text-xs shrink-0 font-mono">
              {user.name.slice(0, 2).toUpperCase()}
            </div>
            <div className="overflow-hidden flex-1">
              <div className="text-xs font-semibold text-white truncate">{user.name}</div>
              <div className="text-[11px] text-slate-400 truncate">{user.degreeSemester || 'Student Member'}</div>
            </div>
          </div>

          {/* Navigation Links */}
          <nav className="space-y-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = currentTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => handleNavClick(item.id)}
                  className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-xs transition-colors text-left ${
                    isActive
                      ? 'bg-slate-800 text-white font-semibold border-l-2 border-teal-400'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <Icon className={`w-4 h-4 ${isActive ? 'text-teal-400' : 'text-slate-400'}`} />
                    <span>{item.label}</span>
                  </div>
                  {isActive && <ChevronRight className="w-3.5 h-3.5 text-teal-400" />}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Bottom Student Advisor Callout */}
        <div className="p-4 border-t border-slate-800/80 space-y-3">
          <button
            onClick={() => {
              onCloseMobile();
              onOpenAI();
            }}
            className="w-full p-3 rounded-xl bg-slate-800/30 hover:bg-slate-800/60 border border-slate-800 text-left transition-colors group flex items-start gap-2.5"
          >
            <Bot className="w-4 h-4 text-teal-400 shrink-0 mt-0.5" />
            <div className="overflow-hidden">
              <div className="text-xs font-medium text-slate-200 group-hover:text-teal-300 transition-colors">
                Student Finance Advisor
              </div>
              <div className="text-[11px] text-slate-400 leading-tight mt-0.5">
                Deterministic budget checks &amp; spending advice
              </div>
            </div>
          </button>

          <div className="text-[11px] text-slate-500 text-center font-mono">
            {user.currency || '₹'} · Local ACID Ledger
          </div>
        </div>
      </aside>
    </>
  );
};
