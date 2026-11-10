import React, { useState } from 'react';
import {
  Plus,
  CheckCircle2,
  Trash2,
  X,
} from 'lucide-react';
import { User, SplitExpense, DebtRecord, AnalyticsResponse } from '../types.ts';
import { api } from '../api.ts';

interface StudentHubViewProps {
  user: User;
  currency: string;
  splits: SplitExpense[];
  debts: DebtRecord[];
  analytics: AnalyticsResponse | null;
  onRefresh: () => void;
}

export const StudentHubView: React.FC<StudentHubViewProps> = ({
  currency,
  splits,
  debts,
  analytics,
  onRefresh,
}) => {
  const [testSpend, setTestSpend] = useState<string>('800');

  const [showSplitModal, setShowSplitModal] = useState(false);
  const [splitTitle, setSplitTitle] = useState('');
  const [splitTotal, setSplitTotal] = useState('');
  const [participantsText, setParticipantsText] = useState('Rahul, Rohan, Me');

  const [showDebtModal, setShowDebtModal] = useState(false);
  const [debtName, setDebtName] = useState('');
  const [debtType, setDebtType] = useState<'you_owe' | 'owes_you'>('owes_you');
  const [debtAmount, setDebtAmount] = useState('');
  const [debtDesc, setDebtDesc] = useState('');
  const [debtDueDate, setDebtDueDate] = useState('');

  const currentMonth = analytics?.currentMonth;
  const remBudget = Math.round(currentMonth?.remainingBudget ?? 8000);
  const daysLeft = currentMonth?.daysLeftInMonth ?? 15;
  const currentDailyRate = Math.round(
    currentMonth?.safeDailySpend ?? Math.round(remBudget / daysLeft)
  );

  const plannedNum = parseFloat(testSpend) || 0;
  const simulatedRemaining = Math.max(0, remBudget - plannedNum);
  const simulatedDailyRate = daysLeft > 1 ? Math.round(simulatedRemaining / (daysLeft - 1)) : 0;
  const delta = simulatedDailyRate - currentDailyRate;

  const totalYouAreOwed = Math.round(
    debts
      .filter((d) => d.type === 'owes_you' && d.status === 'pending')
      .reduce((sum, d) => sum + d.amount, 0)
  );

  const totalYouOwe = Math.round(
    debts
      .filter((d) => d.type === 'you_owe' && d.status === 'pending')
      .reduce((sum, d) => sum + d.amount, 0)
  );

  const handleCreateSplit = async (e: React.FormEvent) => {
    e.preventDefault();
    const total = parseFloat(splitTotal);
    if (!splitTitle.trim() || isNaN(total) || total <= 0) {
      alert('Enter a valid split title and total.');
      return;
    }
    const names = participantsText
      .split(',')
      .map((n) => n.trim())
      .filter(Boolean);
    if (names.length === 0) {
      alert('Add at least one participant.');
      return;
    }

    const share = Math.round((total / names.length) * 100) / 100;
    const participants = names.map((name) => ({
      name,
      amount: share,
      settled: name.toLowerCase().includes('me') || name.toLowerCase().includes('you'),
    }));

    try {
      await api.createSplit({
        title: splitTitle.trim(),
        totalAmount: total,
        userShare: share,
        paidBy: 'You',
        participants,
      });
      setShowSplitModal(false);
      setSplitTitle('');
      setSplitTotal('');
      onRefresh();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleToggleParticipantSettled = async (split: SplitExpense, pIdx: number) => {
    const updatedParts = [...split.participants];
    updatedParts[pIdx].settled = !updatedParts[pIdx].settled;
    const allDone = updatedParts.every((p) => p.settled);
    try {
      await api.updateSplit(split.id, {
        participants: updatedParts,
        status: allDone ? 'settled' : 'pending',
      });
      onRefresh();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleDeleteSplit = async (id: string) => {
    if (!confirm('Delete this split record?')) return;
    try {
      await api.deleteSplit(id);
      onRefresh();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleCreateDebt = async (e: React.FormEvent) => {
    e.preventDefault();
    const amt = parseFloat(debtAmount);
    if (!debtName.trim() || isNaN(amt) || amt <= 0) {
      alert('Enter a valid name and amount.');
      return;
    }
    try {
      await api.createDebt({
        personName: debtName.trim(),
        type: debtType,
        amount: amt,
        description: debtDesc.trim(),
        dueDate:
          debtDueDate ||
          new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      });
      setShowDebtModal(false);
      setDebtName('');
      setDebtAmount('');
      setDebtDesc('');
      onRefresh();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleSettleDebt = async (debt: DebtRecord) => {
    try {
      await api.updateDebt(debt.id, {
        status: debt.status === 'pending' ? 'settled' : 'pending',
      });
      onRefresh();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleDeleteDebt = async (id: string) => {
    if (!confirm('Delete this debt record?')) return;
    try {
      await api.deleteDebt(id);
      onRefresh();
    } catch (err: any) {
      alert(err.message);
    }
  };

  return (
    <div className="space-y-8 pb-12 font-sans w-full min-w-0">
      {/* Header */}
      <div className="space-y-1 min-w-0">
        <div className="text-[12px] font-mono text-ink-muted">
          Shared expenses and allowance simulation
        </div>
        <h1 className="text-[24px] sm:text-[28px] font-medium text-ink-primary tracking-tight leading-tight">
          Campus hub
        </h1>
      </div>

      {/* Daily Allowance Impact Simulator */}
      <div className="p-4 sm:p-6 rounded-xl surface-card space-y-5 min-w-0">
        <div className="space-y-1 min-w-0">
          <h2 className="text-[15px] font-medium text-ink-primary">
            Daily allowance impact simulator
          </h2>
          <p className="text-[13px] text-ink-secondary">
            Test how a planned purchase today changes your daily safe-to-spend rate for the rest of the month
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-1 min-w-0">
          <div className="space-y-1.5 min-w-0">
            <label className="text-[12px] text-ink-muted block">Planned spend today</label>
            <div className="relative min-w-0">
              <span className="absolute left-3 top-2 text-[13px] text-ink-muted font-mono">
                {currency}
              </span>
              <input
                type="number"
                value={testSpend}
                onChange={(e) => setTestSpend(e.target.value)}
                className="w-full min-w-0 h-9 input-field rounded-lg pl-8 pr-3 text-[14px] font-mono tabular-nums"
              />
            </div>
          </div>

          <div className="space-y-1 md:border-l hairline-border md:pl-6 min-w-0">
            <div className="text-[12px] text-ink-muted">Current daily rate</div>
            <div className="text-[22px] sm:text-[24px] font-medium text-ink-primary font-mono tabular-nums leading-none break-words">
              {currency}{currentDailyRate.toLocaleString()}{' '}
              <span className="text-[13px] font-normal text-ink-muted">/ day</span>
            </div>
            <div className="text-[12px] text-ink-muted font-mono">{daysLeft} days left</div>
          </div>

          <div className="space-y-1 md:border-l hairline-border md:pl-6 min-w-0">
            <div className="text-[12px] text-ink-muted">Adjusted daily rate from tomorrow</div>
            <div className="text-[22px] sm:text-[24px] font-medium text-accent font-mono tabular-nums leading-none break-words">
              {currency}{simulatedDailyRate.toLocaleString()}{' '}
              <span className="text-[13px] font-normal text-ink-secondary">/ day</span>
            </div>
            <div className="text-[12px] font-mono text-ink-secondary tabular-nums break-words">
              {delta < 0
                ? `${currency}${Math.abs(delta).toLocaleString()} lower per day vs current rate`
                : 'No change vs current rate'}
            </div>
          </div>
        </div>
      </div>

      {/* Roommate & Group Bill Splitting */}
      <div className="space-y-4 min-w-0">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="space-y-0.5 min-w-0">
            <h2 className="text-[16px] font-medium text-ink-primary">
              Roommate and group splits
            </h2>
            <p className="text-[13px] text-ink-secondary">
              Divide shared broadband, flat groceries, and group meals
            </p>
          </div>
          <button
            type="button"
            onClick={() => setShowSplitModal(true)}
            className="h-9 px-4 btn-primary rounded-lg text-[13px] font-medium flex items-center gap-2 whitespace-nowrap shrink-0"
          >
            <Plus className="w-4 h-4 shrink-0" strokeWidth={1.75} />
            <span>Split bill</span>
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 min-w-0">
          {splits.length > 0 ? (
            splits.map((s) => (
              <div
                key={s.id}
                className="p-4 sm:p-5 rounded-xl surface-card space-y-4 group min-w-0"
              >
                <div className="flex items-center justify-between gap-2 min-w-0">
                  <span className="text-[14px] font-medium text-ink-primary truncate min-w-0">{s.title}</span>
                  <div className="flex items-center gap-2 shrink-0">
                    <span
                      className={`text-[12px] font-mono ${
                        s.status === 'settled' ? 'text-positive' : 'text-ink-muted'
                      }`}
                    >
                      {s.status === 'settled' ? 'Settled' : 'Pending'}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleDeleteSplit(s.id)}
                      className="p-1 text-ink-muted hover:text-negative opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity"
                    >
                      <Trash2 className="w-3.5 h-3.5" strokeWidth={1.5} />
                    </button>
                  </div>
                </div>

                <div className="flex flex-wrap items-baseline justify-between gap-2 text-[13px] font-mono tabular-nums">
                  <span className="text-ink-secondary">
                    Total: <span className="text-ink-primary">{currency}{Math.round(s.totalAmount).toLocaleString()}</span>
                  </span>
                  <span className="text-ink-secondary">
                    Your share: <span className="text-ink-primary">{currency}{Math.round(s.userShare).toLocaleString()}</span>
                  </span>
                </div>

                <div className="space-y-2 pt-3 border-t hairline-border min-w-0">
                  <div className="text-[12px] text-ink-muted">
                    Participants (click to toggle status)
                  </div>
                  <div className="divide-y hairline-divide">
                    {s.participants.map((p, idx) => (
                      <div
                        key={idx}
                        onClick={() => handleToggleParticipantSettled(s, idx)}
                        className="py-2 px-2 flex items-center justify-between gap-2 rounded-md hover:bg-[var(--bg-raised)] cursor-pointer text-[13px] transition-colors min-w-0"
                      >
                        <span className="text-ink-primary truncate min-w-0">{p.name}</span>
                        <div className="flex items-center gap-3 font-mono text-[12px] tabular-nums shrink-0">
                          <span className="text-ink-secondary">{currency}{Math.round(p.amount).toLocaleString()}</span>
                          {p.settled ? (
                            <span className="text-positive flex items-center gap-1">
                              <CheckCircle2 className="w-3.5 h-3.5" strokeWidth={1.5} /> Paid
                            </span>
                          ) : (
                            <span className="text-ink-muted">Unpaid</span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ))
          ) : (
            <div className="col-span-full py-10 text-center text-[13px] text-ink-muted surface-card rounded-xl">
              No shared bill splits recorded yet
            </div>
          )}
        </div>
      </div>

      {/* Peer Debts & IOUs */}
      <div className="space-y-4 pt-4 border-t hairline-border min-w-0">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="space-y-0.5 min-w-0">
            <h2 className="text-[16px] font-medium text-ink-primary">Peer balances and IOUs</h2>
            <p className="text-[13px] text-ink-secondary">
              Track money lent to classmates or borrowed on campus
            </p>
          </div>
          <button
            type="button"
            onClick={() => setShowDebtModal(true)}
            className="h-9 px-3.5 btn-secondary rounded-lg text-[13px] font-normal flex items-center gap-2 whitespace-nowrap shrink-0"
          >
            <Plus className="w-4 h-4 text-ink-muted shrink-0" strokeWidth={1.5} />
            <span>Record IOU</span>
          </button>
        </div>

        {/* Unified 2-Column Balance Strip */}
        <div className="rounded-xl surface-card grid grid-cols-1 sm:grid-cols-2 divide-y sm:divide-y-0 sm:divide-x hairline-divide min-w-0">
          <div className="p-4 flex items-center justify-between gap-2 min-w-0">
            <span className="text-[13px] text-ink-secondary">Classmates owe you</span>
            <span className="text-[18px] sm:text-[20px] font-medium text-positive font-mono tabular-nums shrink-0">
              +{currency}{totalYouAreOwed.toLocaleString()}
            </span>
          </div>
          <div className="p-4 flex items-center justify-between gap-2 min-w-0">
            <span className="text-[13px] text-ink-secondary">You owe others</span>
            <span className="text-[18px] sm:text-[20px] font-medium text-negative font-mono tabular-nums shrink-0">
              -{currency}{totalYouOwe.toLocaleString()}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 min-w-0">
          {debts.length > 0 ? (
            debts.map((d) => (
              <div
                key={d.id}
                className="p-4 sm:p-5 rounded-xl surface-card space-y-3 group min-w-0"
              >
                <div className="flex items-center justify-between gap-2 min-w-0">
                  <span className="text-[14px] font-medium text-ink-primary truncate min-w-0">{d.personName}</span>
                  <span className="text-[12px] font-mono text-ink-muted shrink-0">
                    {d.type === 'owes_you' ? 'Owes you' : 'You owe'}
                  </span>
                </div>

                <div className="flex items-baseline justify-between gap-2 min-w-0">
                  <div
                    className={`text-[20px] font-medium font-mono tabular-nums break-words ${
                      d.type === 'owes_you' ? 'text-positive' : 'text-negative'
                    }`}
                  >
                    {d.type === 'owes_you' ? '+' : '-'}{currency}{Math.round(d.amount).toLocaleString()}
                  </div>
                  <span className="text-[12px] text-ink-muted font-mono shrink-0">
                    Due {d.dueDate}
                  </span>
                </div>

                {d.description && (
                  <p className="text-[12px] text-ink-secondary truncate">{d.description}</p>
                )}

                <div className="pt-3 flex items-center justify-between border-t hairline-border">
                  <button
                    type="button"
                    onClick={() => handleSettleDebt(d)}
                    className="h-7 px-2.5 btn-secondary rounded-md text-[12px] font-normal"
                  >
                    {d.status === 'settled' ? 'Settled' : 'Mark settled'}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDeleteDebt(d.id)}
                    className="text-ink-muted hover:text-negative p-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity"
                  >
                    <Trash2 className="w-3.5 h-3.5" strokeWidth={1.5} />
                  </button>
                </div>
              </div>
            ))
          ) : (
            <div className="col-span-full py-10 text-center text-[13px] text-ink-muted surface-card rounded-xl">
              No peer IOUs recorded
            </div>
          )}
        </div>
      </div>

      {/* Split Bill Modal */}
      {showSplitModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <form
            onSubmit={handleCreateSplit}
            className="surface-card rounded-xl max-w-sm w-full max-h-[calc(100dvh-1.5rem)] overflow-y-auto p-5 space-y-4 min-w-0"
          >
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-[15px] font-medium text-ink-primary">Split shared bill</h3>
              <button
                type="button"
                onClick={() => setShowSplitModal(false)}
                className="text-ink-muted hover:text-ink-primary shrink-0"
              >
                <X className="w-4 h-4" strokeWidth={1.5} />
              </button>
            </div>

            <div className="space-y-3 text-[13px]">
              <div className="space-y-1.5">
                <label className="block text-ink-secondary">Expense title</label>
                <input
                  type="text"
                  required
                  placeholder="WiFi bill, groceries, dinner"
                  value={splitTitle}
                  onChange={(e) => setSplitTitle(e.target.value)}
                  className="w-full min-w-0 h-9 input-field rounded-lg px-3"
                />
              </div>

              <div className="space-y-1.5">
                <label className="block text-ink-secondary">Total bill amount ({currency})</label>
                <input
                  type="number"
                  step="0.01"
                  required
                  placeholder="1200"
                  value={splitTotal}
                  onChange={(e) => setSplitTotal(e.target.value)}
                  className="w-full min-w-0 h-9 input-field rounded-lg px-3 font-mono tabular-nums"
                />
              </div>

              <div className="space-y-1.5">
                <label className="block text-ink-secondary">Participants (comma separated)</label>
                <input
                  type="text"
                  required
                  placeholder="Rahul, Rohan, Me"
                  value={participantsText}
                  onChange={(e) => setParticipantsText(e.target.value)}
                  className="w-full min-w-0 h-9 input-field rounded-lg px-3"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowSplitModal(false)}
                className="h-8 px-3.5 btn-secondary rounded-lg text-[12px]"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="h-8 px-4 btn-primary rounded-lg text-[12px] font-medium"
              >
                Create split
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Debt Modal */}
      {showDebtModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <form
            onSubmit={handleCreateDebt}
            className="surface-card rounded-xl max-w-sm w-full max-h-[calc(100dvh-1.5rem)] overflow-y-auto p-5 space-y-4 min-w-0"
          >
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-[15px] font-medium text-ink-primary">Record peer IOU</h3>
              <button
                type="button"
                onClick={() => setShowDebtModal(false)}
                className="text-ink-muted hover:text-ink-primary shrink-0"
              >
                <X className="w-4 h-4" strokeWidth={1.5} />
              </button>
            </div>

            <div className="space-y-3 text-[13px]">
              <div className="grid grid-cols-2 p-1 surface-deep rounded-lg border hairline-border">
                <button
                  type="button"
                  onClick={() => setDebtType('owes_you')}
                  className={`h-8 rounded-md text-[12px] transition-colors ${
                    debtType === 'owes_you'
                      ? 'surface-active-row text-ink-primary font-medium'
                      : 'text-ink-muted hover:text-ink-primary'
                  }`}
                >
                  They owe me
                </button>
                <button
                  type="button"
                  onClick={() => setDebtType('you_owe')}
                  className={`h-8 rounded-md text-[12px] transition-colors ${
                    debtType === 'you_owe'
                      ? 'surface-active-row text-ink-primary font-medium'
                      : 'text-ink-muted hover:text-ink-primary'
                  }`}
                >
                  I owe them
                </button>
              </div>

              <div className="space-y-1.5">
                <label className="block text-ink-secondary">Person name</label>
                <input
                  type="text"
                  required
                  placeholder="Karthik, Room 304"
                  value={debtName}
                  onChange={(e) => setDebtName(e.target.value)}
                  className="w-full min-w-0 h-9 input-field rounded-lg px-3"
                />
              </div>

              <div className="space-y-1.5">
                <label className="block text-ink-secondary">Amount ({currency})</label>
                <input
                  type="number"
                  step="0.01"
                  required
                  placeholder="250"
                  value={debtAmount}
                  onChange={(e) => setDebtAmount(e.target.value)}
                  className="w-full min-w-0 h-9 input-field rounded-lg px-3 font-mono tabular-nums"
                />
              </div>

              <div className="space-y-1.5">
                <label className="block text-ink-secondary">Note</label>
                <input
                  type="text"
                  placeholder="Movie ticket, canteen snack"
                  value={debtDesc}
                  onChange={(e) => setDebtDesc(e.target.value)}
                  className="w-full min-w-0 h-9 input-field rounded-lg px-3"
                />
              </div>

              <div className="space-y-1.5">
                <label className="block text-ink-secondary">Due date</label>
                <input
                  type="date"
                  value={debtDueDate}
                  onChange={(e) => setDebtDueDate(e.target.value)}
                  className="w-full min-w-0 h-9 input-field rounded-lg px-3 font-mono"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowDebtModal(false)}
                className="h-8 px-3.5 btn-secondary rounded-lg text-[12px]"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="h-8 px-4 btn-primary rounded-lg text-[12px] font-medium"
              >
                Save record
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
