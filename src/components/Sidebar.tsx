import React from 'react';
import {
  LayoutDashboard,
  Receipt,
  Target,
  GraduationCap,
  CalendarClock,
  TrendingUp,
  Settings,
  MessageSquare,
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
    { id: 'dashboard' as NavTab, label: 'Overview', icon: LayoutDashboard },
    { id: 'transactions' as NavTab, label: 'Transactions', icon: Receipt },
    { id: 'budgets' as NavTab, label: 'Budgets and goals', icon: Target },
    { id: 'student_hub' as NavTab, label: 'Campus hub', icon: GraduationCap },
    { id: 'subscriptions' as NavTab, label: 'Recurring bills', icon: CalendarClock },
    { id: 'analytics' as NavTab, label: 'Spending analysis', icon: TrendingUp },
    { id: 'settings' as NavTab, label: 'Reports and settings', icon: Settings },
  ];

  const handleNavClick = (tab: NavTab) => {
    onSelectTab(tab);
    onCloseMobile();
  };

  return (
    <>
      {isOpenMobile && (
        <div
          onClick={onCloseMobile}
          className="fixed inset-0 bg-black/60 z-40 md:hidden"
        />
      )}

      <aside
        className={`fixed md:static inset-y-0 left-0 z-40 w-[248px] surface-deep border-r hairline-border flex flex-col justify-between transition-transform duration-200 ease-out md:translate-x-0 shrink-0 ${
          isOpenMobile ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="p-4 space-y-5">
          {/* Student Profile Summary */}
          <div className="p-3 rounded-lg surface-card flex items-center gap-3">
            <div className="w-8 h-8 rounded-md surface-raised flex items-center justify-center text-ink-primary font-medium text-xs shrink-0 font-mono">
              {user.name.slice(0, 2).toUpperCase()}
            </div>
            <div className="overflow-hidden flex-1">
              <div className="text-[13px] font-medium text-ink-primary truncate">{user.name}</div>
              <div className="text-[12px] text-ink-muted truncate">
                {user.degreeSemester || 'Student account'}
              </div>
            </div>
          </div>

          {/* Dense Navigation Stack: 36px rows, 4px gap, aligned 16px icons */}
          <div className="space-y-2">
            <div className="px-2.5 text-[12px] text-ink-muted font-normal">
              Workspace
            </div>
            <nav className="flex flex-col gap-1">
              {navItems.map((item) => {
                const Icon = item.icon;
                const isActive = currentTab === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => handleNavClick(item.id)}
                    className={`w-full h-9 flex items-center gap-2.5 px-2.5 rounded-lg text-[14px] transition-colors text-left ${
                      isActive
                        ? 'surface-active-row text-ink-primary font-medium'
                        : 'text-ink-secondary hover:text-ink-primary hover:bg-[var(--bg-card)] font-normal'
                    }`}
                  >
                    <span className="w-4 h-4 flex items-center justify-center shrink-0">
                      <Icon
                        className={`w-4 h-4 ${isActive ? 'text-ink-primary' : 'text-ink-muted'}`}
                        strokeWidth={1.5}
                      />
                    </span>
                    <span className="truncate">{item.label}</span>
                  </button>
                );
              })}
            </nav>
          </div>
        </div>

        {/* Bottom Ledger Advisor Callout */}
        <div className="p-4 border-t hairline-border space-y-3">
          <button
            onClick={() => {
              onCloseMobile();
              onOpenAI();
            }}
            className="w-full p-3 rounded-lg surface-card hover:bg-[var(--bg-raised)] text-left transition-colors flex items-start gap-2.5"
          >
            <span className="w-4 h-4 flex items-center justify-center shrink-0 mt-0.5">
              <MessageSquare className="w-4 h-4 text-ink-muted" strokeWidth={1.5} />
            </span>
            <div className="overflow-hidden">
              <div className="text-[13px] font-medium text-ink-primary">
                Budget advisor
              </div>
              <div className="text-[12px] text-ink-muted leading-snug mt-0.5">
                Check daily allowance math and category pace
              </div>
            </div>
          </button>

          <div className="px-1 flex items-center justify-between text-[12px] text-ink-muted font-mono">
            <span>Currency: {user.currency || '₹'}</span>
            <span>{new Date().toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}</span>
          </div>
        </div>
      </aside>
    </>
  );
};
