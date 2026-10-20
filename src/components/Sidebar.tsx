import React from 'react';
import {
  LayoutDashboard,
  Receipt,
  Target,
  GraduationCap,
  CalendarClock,
  TrendingUp,
  Settings,
  Sparkles,
  ShieldCheck,
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
  healthScore = 85,
  isOpenMobile,
  onCloseMobile,
  onOpenAI,
}) => {
  const navItems = [
    { id: 'dashboard' as NavTab, label: 'Dashboard', icon: LayoutDashboard },
    { id: 'transactions' as NavTab, label: 'Transactions', icon: Receipt },
    { id: 'budgets' as NavTab, label: 'Budgets & Goals', icon: Target },
    { id: 'student_hub' as NavTab, label: 'Student Hub', icon: GraduationCap, badge: 'Smart' },
    { id: 'subscriptions' as NavTab, label: 'Subscriptions', icon: CalendarClock },
    { id: 'analytics' as NavTab, label: 'Analytics', icon: TrendingUp },
    { id: 'settings' as NavTab, label: 'Reports & Settings', icon: Settings },
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
        className={`fixed md:static inset-y-0 left-0 z-40 w-64 bg-slate-900 border-r border-slate-800 flex flex-col justify-between transition-transform duration-200 ease-in-out md:translate-x-0 ${
          isOpenMobile ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="p-4 space-y-4">
          {/* Student Profile Card (Taste-Skill: Pale tint of student's own hue, quiet border) */}
          <div className="p-3.5 rounded-xl bg-slate-800/40 border border-slate-800 flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-teal-500/15 border border-teal-500/30 flex items-center justify-center text-teal-300 font-bold text-xs shrink-0 font-mono">
              {user.name.slice(0, 2).toUpperCase()}
            </div>
            <div className="overflow-hidden flex-1">
              <div className="text-xs font-bold text-white truncate">{user.name}</div>
              <div className="text-[11px] text-slate-400 truncate">{user.degreeSemester || 'Student'}</div>
            </div>
          </div>

          {/* Student Financial Health Score */}
          <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800/80 space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-400 flex items-center gap-1 font-medium text-[11px]">
                <ShieldCheck className="w-3.5 h-3.5 text-teal-400" /> Financial Health
              </span>
              <span className="font-bold text-teal-300 tabular-nums">{healthScore}/100</span>
            </div>
            <div className="w-full bg-slate-800 rounded-full h-1.5 overflow-hidden">
              <div
                className="bg-teal-400 h-full rounded-full transition-all duration-500"
                style={{ width: `${Math.min(100, Math.max(10, healthScore))}%` }}
              />
            </div>
            <p className="text-[10px] text-slate-500">
              {healthScore >= 80 ? 'Excellent discipline & buffer' : healthScore >= 60 ? 'Moderate spending balance' : 'Approaching budget limit'}
            </p>
          </div>

          {/* Navigation Links (Taste-Skill: Navigation recedes, active item is a clean neutral pill or quiet accent) */}
          <nav className="space-y-0.5">
            <div className="px-2 pb-1.5 text-[10px] font-semibold tracking-wider uppercase text-slate-500">
              Workspace
            </div>
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = currentTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => handleNavClick(item.id)}
                  className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium transition-colors text-left ${
                    isActive
                      ? 'bg-slate-800 text-white font-semibold'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <Icon className={`w-4 h-4 ${isActive ? 'text-teal-400' : 'text-slate-500'}`} />
                    <span>{item.label}</span>
                  </div>
                  {item.badge && (
                    <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-teal-500/10 text-teal-300 border border-teal-500/20">
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Bottom AI Assistant Banner */}
        <div className="p-4 border-t border-slate-800 space-y-2">
          <button
            onClick={() => {
              onOpenAI();
              onCloseMobile();
            }}
            className="w-full p-2.5 bg-slate-950 hover:bg-slate-800 border border-slate-800 rounded-xl flex items-center justify-between group transition-colors text-left"
          >
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-teal-500/10 text-teal-300">
                <Sparkles className="w-3.5 h-3.5" />
              </div>
              <div>
                <div className="text-xs font-semibold text-slate-200">AI Student Advisor</div>
                <div className="text-[10px] text-slate-500">Ask about budget &amp; velocity</div>
              </div>
            </div>
            <ChevronRight className="w-3.5 h-3.5 text-slate-500 group-hover:translate-x-0.5 transition-transform" />
          </button>
        </div>
      </aside>
    </>
  );
};
