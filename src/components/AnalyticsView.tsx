import React from 'react';
import {
  TrendingUp,
  PieChart,
  ShieldCheck,
  AlertTriangle,
  Lightbulb,
  CheckCircle2,
  Info,
  Layers,
  ArrowUpRight,
  ArrowDownLeft,
} from 'lucide-react';
import { AnalyticsResponse, FinancialInsight, User } from '../types.ts';

interface AnalyticsViewProps {
  user: User;
  currency: string;
  analytics: AnalyticsResponse | null;
  insights: FinancialInsight[];
}

export const AnalyticsView: React.FC<AnalyticsViewProps> = ({
  user,
  currency,
  analytics,
  insights,
}) => {
  const cur = analytics?.currentMonth;
  const totalExp = cur?.expense || 1;
  const essentialPct = cur ? Math.round((cur.essentialExpense / totalExp) * 100) : 60;
  const discretionaryPct = 100 - essentialPct;

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
          <TrendingUp className="w-5 h-5 text-teal-400" /> Financial Analytics &amp; Insights
        </h1>
        <p className="text-xs text-slate-400">
          Transparent, mathematical analysis of your spending patterns, essential necessities, and savings velocity
        </p>
      </div>

      {/* Explainable Insights Cards */}
      <div className="space-y-3">
        <h2 className="text-xs font-bold uppercase tracking-wider text-slate-300">
          Data-Driven Insights
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
          {insights.map((ins, idx) => {
            let borderClass = 'border-slate-800 bg-slate-900/80';
            let icon = <Info className="w-4 h-4 text-teal-400 shrink-0" />;

            if (ins.type === 'alert') {
              borderClass = 'border-rose-500/30 bg-rose-950/20';
              icon = <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />;
            } else if (ins.type === 'success') {
              borderClass = 'border-emerald-500/30 bg-emerald-950/20';
              icon = <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />;
            } else if (ins.type === 'tip') {
              borderClass = 'border-amber-500/30 bg-amber-950/20';
              icon = <Lightbulb className="w-4 h-4 text-amber-400 shrink-0" />;
            }

            return (
              <div
                key={idx}
                className={`p-4 rounded-xl border flex items-start gap-3 transition-all ${borderClass}`}
              >
                <div className="p-1 rounded-lg mt-0.5">{icon}</div>
                <div className="space-y-1">
                  <h3 className="text-xs font-bold text-white">{ins.title}</h3>
                  <p className="text-xs text-slate-300 leading-relaxed">{ins.message}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Main Grid: Essential vs Discretionary & Category Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Essential vs Discretionary */}
        <div className="p-5 rounded-2xl bg-slate-900/80 border border-slate-800/80 space-y-4">
          <div>
            <h2 className="text-sm font-bold text-white">Essential vs. Discretionary</h2>
            <p className="text-xs text-slate-400">Needs (Mess, Hostel, Academics) vs Wants</p>
          </div>

          <div className="space-y-3 pt-2">
            <div>
              <div className="flex items-center justify-between text-xs mb-1.5">
                <span className="text-slate-300 font-medium">Essential Needs</span>
                <span className="font-mono text-emerald-400 font-bold">
                  {currency}{(cur?.essentialExpense ?? 0).toLocaleString()} ({essentialPct}%)
                </span>
              </div>
              <div className="w-full h-2.5 bg-slate-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-emerald-500 rounded-full transition-all duration-500"
                  style={{ width: `${essentialPct}%` }}
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between text-xs mb-1.5">
                <span className="text-slate-300 font-medium">Discretionary / Leisure</span>
                <span className="font-mono text-amber-400 font-bold">
                  {currency}{(cur?.discretionaryExpense ?? 0).toLocaleString()} ({discretionaryPct}%)
                </span>
              </div>
              <div className="w-full h-2.5 bg-slate-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-amber-400 rounded-full transition-all duration-500"
                  style={{ width: `${discretionaryPct}%` }}
                />
              </div>
            </div>
          </div>

          <p className="text-[11px] text-slate-400 bg-slate-950/60 p-3 rounded-xl border border-slate-800">
            Rule of thumb for college students: Aim for at least 70% essential spending so sudden textbook or exam fee outlays don't cause a deficit.
          </p>
        </div>

        {/* Category Distribution Full */}
        <div className="lg:col-span-2 p-5 rounded-2xl bg-slate-900/80 border border-slate-800/80 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-bold text-white">Category Distribution</h2>
              <p className="text-xs text-slate-400">All expenditures sorted by total volume</p>
            </div>
            <span className="text-xs font-mono text-slate-400">
              Total: {currency}{(cur?.expense ?? 0).toLocaleString()}
            </span>
          </div>

          <div className="space-y-3 pt-2">
            {analytics?.categoryBreakdown && analytics.categoryBreakdown.length > 0 ? (
              analytics.categoryBreakdown.map((cat, idx) => {
                const pct = Math.round((cat.amount / (cur?.expense || 1)) * 100);
                return (
                  <div key={idx} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2">
                        <span
                          className="w-2.5 h-2.5 rounded-full"
                          style={{ backgroundColor: cat.color }}
                        />
                        <span className="font-medium text-slate-200">{cat.name}</span>
                        {cat.isEssential ? (
                          <span className="text-[9px] px-1.5 py-0.2 rounded bg-slate-800 text-slate-400">Essential</span>
                        ) : (
                          <span className="text-[9px] px-1.5 py-0.2 rounded bg-amber-500/10 text-amber-300">Discretionary</span>
                        )}
                      </div>
                      <span className="font-mono text-slate-300">
                        {currency}{cat.amount.toLocaleString()} ({pct}%)
                      </span>
                    </div>
                    <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-300"
                        style={{ width: `${pct}%`, backgroundColor: cat.color }}
                      />
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="py-8 text-center text-xs text-slate-500">
                No expense data recorded.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
