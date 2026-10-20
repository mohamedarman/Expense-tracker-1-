import React, { useState } from 'react';
import {
  GraduationCap,
  Users,
  HandCoins,
  Calculator,
  Plus,
  CheckCircle2,
  Clock,
  Trash2,
  Sparkles,
  ArrowRight,
  AlertCircle,
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
  user,
  currency,
  splits,
  debts,
  analytics,
  onRefresh,
}) => {
  // Simulator state
  const [testSpend, setTestSpend] = useState<string>('800');

  // Split bill modal
  const [showSplitModal, setShowSplitModal] = useState(false);
  const [splitTitle, setSplitTitle] = useState('');
  const [splitTotal, setSplitTotal] = useState('');
  const [participantsText, setParticipantsText] = useState('Rahul, Rohan, Me');

  // Debt modal
  const [showDebtModal, setShowDebtModal] = useState(false);
  const [debtName, setDebtName] = useState('');
  const [debtType, setDebtType] = useState<'you_owe' | 'owes_you'>('owes_you');
  const [debtAmount, setDebtAmount] = useState('');
  const [debtDesc, setDebtDesc] = useState('');
  const [debtDueDate, setDebtDueDate] = useState('');

  const currentMonth = analytics?.currentMonth;
  const remBudget = currentMonth?.remainingBudget ?? 8000;
  const daysLeft = currentMonth?.daysLeftInMonth ?? 15;
  const currentDailyRate = currentMonth?.safeDailySpend ?? Math.round(remBudget / daysLeft);

  // Simulation calculation
  const plannedNum = parseFloat(testSpend) || 0;
  const simulatedRemaining = Math.max(0, remBudget - plannedNum);
  const simulatedDailyRate = daysLeft > 1 ? Math.round(simulatedRemaining / (daysLeft - 1)) : 0;
  const delta = simulatedDailyRate - currentDailyRate;

  // Split calculations
  const totalYouAreOwed = debts
    .filter((d) => d.type === 'owes_you' && d.status === 'pending')
    .reduce((sum, d) => sum + d.amount, 0);

  const totalYouOwe = debts
    .filter((d) => d.type === 'you_owe' && d.status === 'pending')
    .reduce((sum, d) => sum + d.amount, 0);

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
        dueDate: debtDueDate || new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
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
    <div className="space-y-8 pb-12">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
          <GraduationCap className="w-5 h-5 text-teal-400" /> Student Financial Hub
        </h1>
        <p className="text-xs text-slate-400">
          Smart tools built specifically for campus living: daily velocity simulation, roommate bill splitting, and peer IOUs
        </p>
      </div>

      {/* Daily Velocity Simulator */}
      <div className="p-5 rounded-2xl bg-gradient-to-r from-slate-900 via-teal-950/20 to-slate-900 border border-teal-500/30 space-y-4">
        <div className="flex items-center gap-2">
          <Calculator className="w-4 h-4 text-teal-400" />
          <h2 className="text-sm font-bold text-white">Interactive Daily Allowance Simulator</h2>
        </div>
        <p className="text-xs text-slate-300">
          Planning an outing, textbook purchase, or weekend trip? Test how spending today impacts your daily safe budget for the rest of the month:
        </p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
          <div className="space-y-1.5">
            <label className="text-xs text-slate-400">If I spend this amount today:</label>
            <div className="relative">
              <span className="absolute left-3 top-2.5 text-xs text-slate-400 font-mono">{currency}</span>
              <input
                type="number"
                value={testSpend}
                onChange={(e) => setTestSpend(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700/80 rounded-xl pl-8 pr-3 py-2 text-sm font-mono text-white focus:outline-none focus:border-teal-400"
              />
            </div>
          </div>

          <div className="p-3 bg-slate-800/60 rounded-xl border border-slate-700/60 space-y-1">
            <div className="text-[11px] text-slate-400">Current Daily Allowance</div>
            <div className="text-lg font-bold text-slate-200">
              {currency}{currentDailyRate.toLocaleString()} <span className="text-xs font-normal text-slate-400">/ day</span>
            </div>
            <div className="text-[10px] text-slate-500">{daysLeft} days remaining</div>
          </div>

          <div className="p-3 bg-teal-950/40 rounded-xl border border-teal-500/40 space-y-1">
            <div className="text-[11px] text-teal-300">Simulated New Daily Allowance</div>
            <div className="text-lg font-bold text-teal-300">
              {currency}{simulatedDailyRate.toLocaleString()} <span className="text-xs font-normal text-teal-400">/ day</span>
            </div>
            <div className={`text-[10px] font-semibold ${delta < 0 ? 'text-amber-400' : 'text-emerald-400'}`}>
              {delta < 0 ? `Reduction of ${currency}${Math.abs(delta)}/day` : 'No reduction'}
            </div>
          </div>
        </div>
      </div>

      {/* Bill Splitting Section */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm font-bold text-white flex items-center gap-2">
              <Users className="w-4 h-4 text-emerald-400" /> Roommate &amp; Group Bill Splitter
            </h2>
            <p className="text-xs text-slate-400">Split shared mess, WiFi broadband, flat groceries, and party expenses</p>
          </div>
          <button
            onClick={() => setShowSplitModal(true)}
            className="px-3 py-1.5 bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-semibold rounded-lg text-xs flex items-center gap-1.5 transition-colors shadow"
          >
            <Plus className="w-3.5 h-3.5" /> Split Bill
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {splits.length > 0 ? (
            splits.map((s) => (
              <div
                key={s.id}
                className="p-5 rounded-2xl bg-slate-900/80 border border-slate-800/80 space-y-3 relative group"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-white">{s.title}</span>
                  <div className="flex items-center gap-1.5">
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                      s.status === 'settled'
                        ? 'bg-emerald-500/15 text-emerald-400'
                        : 'bg-amber-500/15 text-amber-300'
                    }`}>
                      {s.status === 'settled' ? 'Fully Settled' : 'Pending Settlement'}
                    </span>
                    <button
                      onClick={() => handleDeleteSplit(s.id)}
                      className="p-1 text-slate-500 hover:text-rose-400 opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                <div className="flex items-baseline justify-between text-xs">
                  <span className="text-slate-400">Total Bill: <strong className="text-slate-200">{currency}{s.totalAmount}</strong></span>
                  <span className="text-slate-400">Your Share: <strong className="text-emerald-400">{currency}{s.userShare}</strong></span>
                </div>

                <div className="space-y-1.5 pt-2 border-t border-slate-800">
                  <div className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold">
                    Participants
                  </div>
                  <div className="space-y-1">
                    {s.participants.map((p, idx) => (
                      <div
                        key={idx}
                        onClick={() => handleToggleParticipantSettled(s, idx)}
                        className="flex items-center justify-between p-1.5 rounded-lg bg-slate-950/60 hover:bg-slate-800/60 cursor-pointer text-xs transition-colors"
                      >
                        <span className="text-slate-300 font-medium">{p.name}</span>
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-slate-400">{currency}{p.amount}</span>
                          {p.settled ? (
                            <span className="text-[10px] text-emerald-400 font-semibold flex items-center gap-1">
                              <CheckCircle2 className="w-3 h-3" /> Paid
                            </span>
                          ) : (
                            <span className="text-[10px] text-amber-400 font-semibold">
                              Pending
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ))
          ) : (
            <div className="col-span-full py-8 text-center text-xs text-slate-500 bg-slate-900/40 rounded-xl border border-slate-800/60">
              No split bills yet. Click "+ Split Bill" to divide hostel broadband, groceries, or dinner.
            </div>
          )}
        </div>
      </div>

      {/* Peer Debts & IOUs Section */}
      <div className="space-y-4 pt-4 border-t border-slate-800/80">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm font-bold text-white flex items-center gap-2">
              <HandCoins className="w-4 h-4 text-teal-400" /> Peer Debts &amp; IOUs
            </h2>
            <p className="text-xs text-slate-400">Keep track of money lent to classmates or borrowed for canteen chai</p>
          </div>
          <button
            onClick={() => setShowDebtModal(true)}
            className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-teal-300 border border-slate-700/80 rounded-lg text-xs flex items-center gap-1.5 transition-colors"
          >
            <Plus className="w-3.5 h-3.5" /> Record IOU
          </button>
        </div>

        {/* Debt Summary Chips */}
        <div className="grid grid-cols-2 gap-3 text-xs">
          <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl flex items-center justify-between">
            <span className="text-slate-400">Classmates owe you:</span>
            <span className="text-base font-bold text-emerald-400 font-mono">+{currency}{totalYouAreOwed.toLocaleString()}</span>
          </div>
          <div className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-xl flex items-center justify-between">
            <span className="text-slate-400">You owe others:</span>
            <span className="text-base font-bold text-rose-400 font-mono">-{currency}{totalYouOwe.toLocaleString()}</span>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
          {debts.length > 0 ? (
            debts.map((d) => (
              <div
                key={d.id}
                className="p-4 rounded-xl bg-slate-900/80 border border-slate-800/80 space-y-2 relative group"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-200">{d.personName}</span>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                    d.type === 'owes_you'
                      ? 'bg-emerald-500/15 text-emerald-400'
                      : 'bg-rose-500/15 text-rose-400'
                  }`}>
                    {d.type === 'owes_you' ? 'Owes You' : 'You Owe'}
                  </span>
                </div>

                <div className="flex items-baseline justify-between">
                  <div className={`text-lg font-bold font-mono ${
                    d.type === 'owes_you' ? 'text-emerald-400' : 'text-rose-400'
                  }`}>
                    {d.type === 'owes_you' ? '+' : '-'}{currency}{d.amount.toLocaleString()}
                  </div>
                  <span className="text-[10px] text-slate-400 flex items-center gap-1">
                    <Clock className="w-3 h-3" /> Due {d.dueDate}
                  </span>
                </div>

                {d.description && (
                  <p className="text-[11px] text-slate-400 truncate">{d.description}</p>
                )}

                <div className="pt-2 flex items-center justify-between border-t border-slate-800/60">
                  <button
                    onClick={() => handleSettleDebt(d)}
                    className={`px-2 py-1 rounded text-[11px] font-semibold transition-colors ${
                      d.status === 'settled'
                        ? 'bg-slate-800 text-slate-400'
                        : 'bg-teal-500/15 text-teal-300 hover:bg-teal-500/25'
                    }`}
                  >
                    {d.status === 'settled' ? 'Settled ✓' : 'Mark Settled'}
                  </button>
                  <button
                    onClick={() => handleDeleteDebt(d.id)}
                    className="text-slate-500 hover:text-rose-400 p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))
          ) : (
            <div className="col-span-full py-8 text-center text-xs text-slate-500 bg-slate-900/40 rounded-xl border border-slate-800/60">
              No debt or IOU records. All student balances are settled.
            </div>
          )}
        </div>
      </div>

      {/* Split Bill Modal */}
      {showSplitModal && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <form onSubmit={handleCreateSplit} className="bg-slate-900 border border-slate-800 rounded-2xl max-w-sm w-full p-5 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-white">Split Shared Bill</h3>
              <button type="button" onClick={() => setShowSplitModal(false)} className="text-slate-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-400 mb-1">Expense Title</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. WiFi Bill, Mess Advance, Dinner"
                  value={splitTitle}
                  onChange={(e) => setSplitTitle(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-200"
                />
              </div>

              <div>
                <label className="block text-slate-400 mb-1">Total Bill Amount ({currency})</label>
                <input
                  type="number"
                  step="0.01"
                  required
                  placeholder="e.g. 1200"
                  value={splitTotal}
                  onChange={(e) => setSplitTotal(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-200 font-mono"
                />
              </div>

              <div>
                <label className="block text-slate-400 mb-1">Participants (comma separated)</label>
                <input
                  type="text"
                  required
                  placeholder="Rahul, Rohan, Me"
                  value={participantsText}
                  onChange={(e) => setParticipantsText(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-200"
                />
                <span className="text-[10px] text-slate-500">
                  Equal share will be calculated for each person.
                </span>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowSplitModal(false)}
                className="px-3 py-1.5 bg-slate-800 text-slate-300 rounded-lg text-xs"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-1.5 bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-semibold rounded-lg text-xs"
              >
                Create Split
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Debt Modal */}
      {showDebtModal && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <form onSubmit={handleCreateDebt} className="bg-slate-900 border border-slate-800 rounded-2xl max-w-sm w-full p-5 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-white">Record Peer Debt / IOU</h3>
              <button type="button" onClick={() => setShowDebtModal(false)} className="text-slate-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setDebtType('owes_you')}
                  className={`py-2 rounded-lg font-medium transition-colors ${
                    debtType === 'owes_you'
                      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                      : 'bg-slate-950 text-slate-400 border border-slate-800'
                  }`}
                >
                  They Owe Me
                </button>
                <button
                  type="button"
                  onClick={() => setDebtType('you_owe')}
                  className={`py-2 rounded-lg font-medium transition-colors ${
                    debtType === 'you_owe'
                      ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                      : 'bg-slate-950 text-slate-400 border border-slate-800'
                  }`}
                >
                  I Owe Them
                </button>
              </div>

              <div>
                <label className="block text-slate-400 mb-1">Friend / Person Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Karthik, Room 304, Canteen"
                  value={debtName}
                  onChange={(e) => setDebtName(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-200"
                />
              </div>

              <div>
                <label className="block text-slate-400 mb-1">Amount ({currency})</label>
                <input
                  type="number"
                  step="0.01"
                  required
                  placeholder="e.g. 250"
                  value={debtAmount}
                  onChange={(e) => setDebtAmount(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-200 font-mono"
                />
              </div>

              <div>
                <label className="block text-slate-400 mb-1">Description / Notes</label>
                <input
                  type="text"
                  placeholder="e.g. Movie ticket share, canteen snack"
                  value={debtDesc}
                  onChange={(e) => setDebtDesc(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-200"
                />
              </div>

              <div>
                <label className="block text-slate-400 mb-1">Target Repayment Date</label>
                <input
                  type="date"
                  value={debtDueDate}
                  onChange={(e) => setDebtDueDate(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-200"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowDebtModal(false)}
                className="px-3 py-1.5 bg-slate-800 text-slate-300 rounded-lg text-xs"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-1.5 bg-teal-500 hover:bg-teal-600 text-slate-950 font-semibold rounded-lg text-xs"
              >
                Save Record
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
