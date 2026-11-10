import React from 'react';
import { AnalyticsResponse, FinancialInsight, User } from '../types.ts';

interface AnalyticsViewProps {
  user: User;
  currency: string;
  analytics: AnalyticsResponse | null;
  insights: FinancialInsight[];
}

export const AnalyticsView: React.FC<AnalyticsViewProps> = ({
  currency,
  analytics,
  insights,
}) => {
  const cur = analytics?.currentMonth;
  const totalExp = cur?.expense || 1;
  const essentialPct = cur
    ? Math.round((cur.essentialExpense / totalExp) * 100)
    : 0;
  const discretionaryPct = cur && cur.expense > 0 ? 100 - essentialPct : 0;

  return (
    <div className="space-y-8 pb-12 font-sans w-full min-w-0">
      {/* Header */}
      <div className="space-y-1 min-w-0">
        <div className="text-[12px] font-mono text-ink-muted">
          Category share and essential ratio
        </div>
        <h1 className="text-[24px] sm:text-[28px] font-medium text-ink-primary tracking-tight leading-tight">
          Spending analysis
        </h1>
      </div>

      {/* Main Grid: Category Distribution (2/3 width) & Essential vs Discretionary (1/3 width) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 min-w-0">
        {/* Category Distribution (2/3 width) */}
        <div className="lg:col-span-8 p-4 sm:p-6 rounded-xl surface-card space-y-5 min-w-0">
          <div className="flex flex-wrap items-center justify-between gap-2 min-w-0">
            <div className="space-y-0.5 min-w-0">
              <h2 className="text-[15px] font-medium text-ink-primary">
                Category distribution
              </h2>
              <p className="text-[13px] text-ink-secondary">
                Monthly expenditures ranked by volume
              </p>
            </div>
            <span className="text-[13px] font-mono tabular-nums text-ink-secondary shrink-0">
              Total: {currency}{Math.round(cur?.expense ?? 0).toLocaleString()}
            </span>
          </div>

          <div className="space-y-4 pt-1 min-w-0">
            {analytics?.categoryBreakdown &&
            analytics.categoryBreakdown.length > 0 ? (
              analytics.categoryBreakdown.map((cat, idx) => {
                const pct = Math.round((cat.amount / (cur?.expense || 1)) * 100);
                const isTopCategory = idx === 0;
                return (
                  <div key={idx} className="space-y-1.5 min-w-0">
                    <div className="flex items-center justify-between gap-2 text-[13px] min-w-0">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-ink-primary font-normal truncate min-w-0">
                          {cat.name}
                        </span>
                        <span className="hidden sm:inline text-[12px] text-ink-muted shrink-0">
                          · {cat.isEssential ? 'Essential' : 'Discretionary'}
                        </span>
                      </div>
                      <span className="font-mono text-[12px] tabular-nums text-ink-secondary shrink-0">
                        {currency}{Math.round(cat.amount).toLocaleString()} · {pct}%
                      </span>
                    </div>
                    <div className="w-full h-1.5 surface-deep rounded-sm overflow-hidden">
                      <div
                        className={`h-full transition-colors ${
                          isTopCategory
                            ? 'bg-[var(--accent)]'
                            : 'bg-[var(--text-muted)]'
                        }`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="py-12 text-center text-[13px] text-ink-muted">
                No expense data recorded for this period
              </div>
            )}
          </div>
        </div>

        {/* Essential vs Discretionary Split (1/3 width) */}
        <div className="lg:col-span-4 p-4 sm:p-6 rounded-xl surface-card flex flex-col justify-between space-y-6 min-w-0">
          <div className="space-y-5 min-w-0">
            <div className="space-y-0.5 min-w-0">
              <h2 className="text-[15px] font-medium text-ink-primary">
                Essential vs discretionary
              </h2>
              <p className="text-[13px] text-ink-secondary">
                Academic and living needs vs leisure
              </p>
            </div>

            <div className="space-y-4 min-w-0">
              <div className="space-y-1.5 min-w-0">
                <div className="flex items-center justify-between gap-2 text-[13px] min-w-0">
                  <span className="text-ink-primary truncate">Essential needs</span>
                  <span className="font-mono text-[12px] tabular-nums text-ink-secondary shrink-0">
                    {currency}{Math.round(cur?.essentialExpense ?? 0).toLocaleString()} · {essentialPct}%
                  </span>
                </div>
                <div className="w-full h-1.5 surface-deep rounded-sm overflow-hidden">
                  <div
                    className="h-full bg-[var(--accent)]"
                    style={{ width: `${essentialPct}%` }}
                  />
                </div>
              </div>

              <div className="space-y-1.5 min-w-0">
                <div className="flex items-center justify-between gap-2 text-[13px] min-w-0">
                  <span className="text-ink-primary truncate">Discretionary spend</span>
                  <span className="font-mono text-[12px] tabular-nums text-ink-secondary shrink-0">
                    {currency}{Math.round(cur?.discretionaryExpense ?? 0).toLocaleString()} · {discretionaryPct}%
                  </span>
                </div>
                <div className="w-full h-1.5 surface-deep rounded-sm overflow-hidden">
                  <div
                    className="h-full bg-[var(--text-muted)]"
                    style={{ width: `${discretionaryPct}%` }}
                  />
                </div>
              </div>
            </div>
          </div>

          <p className="text-[12px] text-ink-muted leading-relaxed pt-4 border-t hairline-border">
            Keeping essential costs near 70% leaves room for unscheduled textbook or exam outlays.
          </p>
        </div>
      </div>

      {/* Ledger Observations */}
      <div className="space-y-4 min-w-0">
        <h2 className="text-[16px] font-medium text-ink-primary">
          Ledger observations
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 min-w-0">
          {insights.map((ins, idx) => (
            <div
              key={idx}
              className="p-4 sm:p-5 rounded-xl surface-card space-y-1.5 min-w-0"
            >
              <div className="flex items-center justify-between gap-2 text-[13px] min-w-0">
                <h3 className="font-medium text-ink-primary truncate min-w-0">{ins.title}</h3>
                <span
                  className={`text-[12px] font-mono shrink-0 ${
                    ins.type === 'alert'
                      ? 'text-negative'
                      : ins.type === 'success'
                      ? 'text-positive'
                      : 'text-ink-muted'
                  }`}
                >
                  {ins.type === 'alert'
                    ? 'Attention'
                    : ins.type === 'success'
                    ? 'On track'
                    : 'Note'}
                </span>
              </div>
              <p className="text-[13px] text-ink-secondary leading-relaxed break-words">
                {ins.message}
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
