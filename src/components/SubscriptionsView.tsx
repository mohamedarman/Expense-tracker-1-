import React, { useState } from 'react';
import {
  CalendarClock,
  Plus,
  CheckCircle2,
  AlertCircle,
  Pause,
  Play,
  Trash2,
  CreditCard,
  X,
} from 'lucide-react';
import { RecurringPayment, Category, User, PaymentMethod } from '../types.ts';
import { api } from '../api.ts';

interface SubscriptionsViewProps {
  user: User;
  currency: string;
  recurring: RecurringPayment[];
  categories: Category[];
  onRefresh: () => void;
  onLogRecurring: (id: string) => void;
}

export const SubscriptionsView: React.FC<SubscriptionsViewProps> = ({
  user,
  currency,
  recurring,
  categories,
  onRefresh,
  onLogRecurring,
}) => {
  const [showModal, setShowModal] = useState(false);
  const [title, setTitle] = useState('');
  const [amount, setAmount] = useState('');
  const [kind, setKind] = useState<'expense' | 'income'>('expense');
  const [categoryId, setCategoryId] = useState('');
  const [frequency, setFrequency] = useState<any>('monthly');
  const [nextDueDate, setNextDueDate] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('UPI');
  const [notes, setNotes] = useState('');

  const activeBills = recurring.filter((r) => r.status === 'active');
  const totalMonthlyCommitment = activeBills
    .filter((r) => r.kind === 'expense')
    .reduce((sum, r) => {
      let multiplier = 1;
      if (r.frequency === 'weekly') multiplier = 4.3;
      if (r.frequency === 'semester') multiplier = 0.25;
      if (r.frequency === 'yearly') multiplier = 1 / 12;
      return sum + r.amount * multiplier;
    }, 0);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    const amt = parseFloat(amount);
    if (!title.trim() || isNaN(amt) || amt <= 0) {
      alert('Enter a valid title and amount.');
      return;
    }
    try {
      await api.createRecurring({
        title: title.trim(),
        amount: amt,
        kind,
        categoryId: categoryId || categories[0]?.id || 'cat-bills',
        frequency,
        nextDueDate: nextDueDate || new Date().toISOString().split('T')[0],
        paymentMethod,
        notes: notes.trim(),
      });
      setShowModal(false);
      setTitle('');
      setAmount('');
      setNotes('');
      onRefresh();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Remove this recurring schedule?')) return;
    try {
      await api.deleteRecurring(id);
      onRefresh();
    } catch (err: any) {
      alert(err.message);
    }
  };

  return (
    <div className="space-y-6 pb-12">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
            <CalendarClock className="w-5 h-5 text-teal-400" /> Recurring &amp; Subscriptions
          </h1>
          <p className="text-xs text-slate-400">
            Track fixed student commitments: Hostel room rent, broadband, mess dues, mobile pack, and streaming
          </p>
        </div>
        <button
          onClick={() => {
            setCategoryId(categories.find((c) => c.kind === 'expense')?.id || '');
            setShowModal(true);
          }}
          className="px-3.5 py-2 bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-semibold rounded-lg text-xs flex items-center gap-1.5 transition-colors shadow"
        >
          <Plus className="w-3.5 h-3.5" /> New Recurring Schedule
        </button>
      </div>

      {/* Summary Box */}
      <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800/80 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="text-xs text-slate-400 font-medium">
            Estimated monthly fixed commitments
          </div>
          <div className="text-2xl font-bold text-white mt-0.5 tabular-nums">
            {currency}{Math.round(totalMonthlyCommitment).toLocaleString()} <span className="text-xs font-normal text-slate-400">/ month</span>
          </div>
        </div>
        <div className="text-xs text-slate-400">
          <strong className="text-emerald-400">{activeBills.length}</strong> active schedules monitored
        </div>
      </div>

      {/* Subscriptions Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {recurring.length > 0 ? (
          recurring.map((rec) => {
            const cat = categories.find((c) => c.id === rec.categoryId);
            const due = new Date(rec.nextDueDate);
            const now = new Date();
            const daysUntil = Math.ceil((due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

            return (
              <div
                key={rec.id}
                className="p-5 rounded-2xl bg-slate-900/80 border border-slate-800/80 space-y-3 relative group"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-white truncate">{rec.title}</span>
                  <div className="flex items-center gap-1">
                    <span className="text-[11px] font-mono text-slate-400 capitalize">
                      {rec.frequency}
                    </span>
                    <button
                      onClick={() => handleDelete(rec.id)}
                      className="p-1 text-slate-500 hover:text-rose-400 opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                </div>

                <div className="flex items-baseline justify-between">
                  <div className={`text-xl font-bold font-mono tabular-nums ${
                    rec.kind === 'income' ? 'text-emerald-400' : 'text-slate-100'
                  }`}>
                    {rec.kind === 'income' ? '+' : '-'}{currency}{rec.amount.toLocaleString()}
                  </div>
                  <span className={`text-[11px] font-mono font-semibold ${
                    daysUntil <= 3
                      ? 'text-rose-400'
                      : daysUntil <= 7
                      ? 'text-amber-400'
                      : 'text-slate-400'
                  }`}>
                    {daysUntil <= 0 ? 'Due Today' : `Due in ${daysUntil}d`}
                  </span>
                </div>

                <div className="text-[11px] text-slate-400 flex items-center justify-between">
                  <span>Next date: <strong className="text-slate-300 font-mono">{rec.nextDueDate}</strong></span>
                  <span>{rec.paymentMethod}</span>
                </div>

                {rec.notes && (
                  <p className="text-[10px] text-slate-500 truncate">{rec.notes}</p>
                )}

                <div className="pt-2 border-t border-slate-800/60 flex items-center justify-between">
                  <span className="text-[10px] text-slate-400">{cat?.name || 'Fixed'}</span>
                  <button
                    onClick={() => onLogRecurring(rec.id)}
                    className="px-3 py-1 bg-teal-500/15 hover:bg-teal-500/25 text-teal-300 border border-teal-500/30 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" /> Pay &amp; Record
                  </button>
                </div>
              </div>
            );
          })
        ) : (
          <div className="col-span-full py-8 text-center text-xs text-slate-500 bg-slate-900/40 rounded-xl border border-slate-800/60">
            No recurring schedules found. Add your room rent, mess fee, or mobile plan.
          </div>
        )}
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <form onSubmit={handleCreate} className="bg-slate-900 border border-slate-800 rounded-2xl max-w-sm w-full p-5 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-white">Create Recurring Commitment</h3>
              <button type="button" onClick={() => setShowModal(false)} className="text-slate-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-400 mb-1">Title</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Hostel Rent, Spotify, Mobile Pack"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-200"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-slate-400 mb-1">Amount ({currency})</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    placeholder="e.g. 500"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-200 font-mono"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 mb-1">Cadence</label>
                  <select
                    value={frequency}
                    onChange={(e) => setFrequency(e.target.value as any)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-200"
                  >
                    <option value="monthly">Monthly</option>
                    <option value="weekly">Weekly</option>
                    <option value="semester">Semester (Every 4 mos)</option>
                    <option value="yearly">Yearly</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-slate-400 mb-1">Category</label>
                  <select
                    value={categoryId}
                    onChange={(e) => setCategoryId(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-200"
                  >
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-slate-400 mb-1">Next Due Date</label>
                  <input
                    type="date"
                    required
                    value={nextDueDate}
                    onChange={(e) => setNextDueDate(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-200"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-400 mb-1">Notes</label>
                <input
                  type="text"
                  placeholder="e.g. Split with room 304, pay before 5th"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-200"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="px-3 py-1.5 bg-slate-800 text-slate-300 rounded-lg text-xs"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-1.5 bg-teal-500 hover:bg-teal-600 text-slate-950 font-semibold rounded-lg text-xs"
              >
                Save Schedule
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
