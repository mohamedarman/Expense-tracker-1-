import React, { useState } from 'react';
import {
  Plus,
  Trash2,
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
  currency,
  recurring,
  categories,
  onRefresh,
  onLogRecurring,
}) => {
  const [showModal, setShowModal] = useState(false);
  const [title, setTitle] = useState('');
  const [amount, setAmount] = useState('');
  const [kind] = useState<'expense' | 'income'>('expense');
  const [categoryId, setCategoryId] = useState('');
  const [frequency, setFrequency] = useState<any>('monthly');
  const [nextDueDate, setNextDueDate] = useState('');
  const [paymentMethod] = useState<PaymentMethod>('UPI');
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
    <div className="space-y-6 pb-12 font-sans w-full min-w-0">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 min-w-0">
        <div className="space-y-1 min-w-0">
          <div className="text-[12px] font-mono text-ink-muted">
            Fixed monthly commitments
          </div>
          <h1 className="text-[24px] sm:text-[28px] font-medium text-ink-primary tracking-tight leading-tight">
            Recurring bills
          </h1>
        </div>
        <button
          type="button"
          onClick={() => {
            setCategoryId(categories.find((c) => c.kind === 'expense')?.id || '');
            setShowModal(true);
          }}
          className="h-9 px-4 btn-primary rounded-lg text-[13px] font-medium flex items-center gap-2 whitespace-nowrap self-start sm:self-auto shrink-0"
        >
          <Plus className="w-4 h-4 shrink-0" strokeWidth={1.75} />
          <span>New recurring bill</span>
        </button>
      </div>

      {/* Summary Strip */}
      <div className="p-4 sm:p-6 rounded-xl surface-card flex flex-col sm:flex-row sm:items-center justify-between gap-4 min-w-0">
        <div className="space-y-1 min-w-0">
          <div className="text-[12px] text-ink-muted">
            Estimated monthly fixed commitment
          </div>
          <div className="text-[24px] sm:text-[28px] font-medium text-ink-primary font-mono tabular-nums leading-none break-words">
            {currency}{Math.round(totalMonthlyCommitment).toLocaleString()}{' '}
            <span className="text-[13px] font-normal text-ink-secondary">/ month</span>
          </div>
        </div>
        <div className="text-[13px] text-ink-secondary font-mono shrink-0">
          {activeBills.length} active schedules
        </div>
      </div>

      {/* Recurring Bills Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 min-w-0">
        {recurring.length > 0 ? (
          recurring.map((rec) => {
            const cat = categories.find((c) => c.id === rec.categoryId);
            const due = new Date(rec.nextDueDate);
            const now = new Date();
            const daysUntil = Math.ceil(
              (due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
            );

            return (
              <div
                key={rec.id}
                className="p-4 sm:p-5 rounded-xl surface-card space-y-4 group min-w-0"
              >
                <div className="flex items-center justify-between gap-2 min-w-0">
                  <span className="text-[14px] font-medium text-ink-primary truncate min-w-0">
                    {rec.title}
                  </span>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-[12px] font-mono text-ink-muted capitalize">
                      {rec.frequency}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleDelete(rec.id)}
                      className="p-1 text-ink-muted hover:text-negative opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity"
                    >
                      <Trash2 className="w-3.5 h-3.5" strokeWidth={1.5} />
                    </button>
                  </div>
                </div>

                <div className="flex items-baseline justify-between gap-2 min-w-0">
                  <div
                    className={`text-[22px] font-medium font-mono tabular-nums leading-none break-words ${
                      rec.kind === 'income' ? 'text-positive' : 'text-ink-primary'
                    }`}
                  >
                    {rec.kind === 'income' ? '+' : '-'}{currency}
                    {Math.round(rec.amount).toLocaleString()}
                  </div>
                  <span
                    className={`text-[12px] font-mono shrink-0 ${
                      daysUntil <= 3
                        ? 'text-negative'
                        : daysUntil <= 7
                        ? 'text-warning'
                        : 'text-ink-muted'
                    }`}
                  >
                    {daysUntil <= 0 ? 'Due today' : `Due in ${daysUntil}d`}
                  </span>
                </div>

                <div className="text-[12px] text-ink-secondary font-mono flex items-center justify-between gap-2">
                  <span>Next: {rec.nextDueDate}</span>
                  <span className="text-ink-muted">{rec.paymentMethod}</span>
                </div>

                {rec.notes && (
                  <p className="text-[12px] text-ink-muted truncate">{rec.notes}</p>
                )}

                <div className="pt-3 border-t hairline-border flex items-center justify-between gap-2">
                  <span className="text-[12px] text-ink-muted truncate min-w-0">
                    {cat?.name || 'Fixed bill'}
                  </span>
                  <button
                    type="button"
                    onClick={() => onLogRecurring(rec.id)}
                    className="h-7 px-2.5 btn-secondary rounded-md text-[12px] font-normal shrink-0"
                  >
                    Record payment
                  </button>
                </div>
              </div>
            );
          })
        ) : (
          <div className="col-span-full py-10 text-center text-[13px] text-ink-muted surface-card rounded-xl">
            No recurring bills scheduled yet
          </div>
        )}
      </div>

      {/* Create Recurring Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <form
            onSubmit={handleCreate}
            className="surface-card rounded-xl max-w-sm w-full max-h-[calc(100dvh-1.5rem)] overflow-y-auto p-5 space-y-4 min-w-0"
          >
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-[15px] font-medium text-ink-primary">
                New recurring commitment
              </h3>
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="text-ink-muted hover:text-ink-primary shrink-0"
              >
                <X className="w-4 h-4" strokeWidth={1.5} />
              </button>
            </div>

            <div className="space-y-3 text-[13px]">
              <div className="space-y-1.5">
                <label className="block text-ink-secondary">Title</label>
                <input
                  type="text"
                  required
                  placeholder="Hostel rent, broadband, mobile plan"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full min-w-0 h-9 input-field rounded-lg px-3"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="block text-ink-secondary">Amount ({currency})</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    placeholder="500"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    className="w-full min-w-0 h-9 input-field rounded-lg px-3 font-mono tabular-nums"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="block text-ink-secondary">Cadence</label>
                  <select
                    value={frequency}
                    onChange={(e) => setFrequency(e.target.value as any)}
                    className="w-full min-w-0 h-9 input-field rounded-lg px-3"
                  >
                    <option value="monthly">Monthly</option>
                    <option value="weekly">Weekly</option>
                    <option value="semester">Semester</option>
                    <option value="yearly">Yearly</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="block text-ink-secondary">Category</label>
                  <select
                    value={categoryId}
                    onChange={(e) => setCategoryId(e.target.value)}
                    className="w-full min-w-0 h-9 input-field rounded-lg px-3"
                  >
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="block text-ink-secondary">Next due date</label>
                  <input
                    type="date"
                    required
                    value={nextDueDate}
                    onChange={(e) => setNextDueDate(e.target.value)}
                    className="w-full min-w-0 h-9 input-field rounded-lg px-3 font-mono"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="block text-ink-secondary">Note</label>
                <input
                  type="text"
                  placeholder="Pay before the 5th"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full min-w-0 h-9 input-field rounded-lg px-3"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="h-8 px-3.5 btn-secondary rounded-lg text-[12px]"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="h-8 px-4 btn-primary rounded-lg text-[12px] font-medium"
              >
                Save schedule
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
