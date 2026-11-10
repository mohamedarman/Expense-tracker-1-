import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import {
  Transaction,
  Category,
  PaymentMethod,
  AccountWallet,
  TransactionKind,
} from '../types.ts';
import { api } from '../api.ts';

interface TransactionFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  categories: Category[];
  currency: string;
  transactionToEdit?: Transaction | null;
  defaultKind?: TransactionKind;
  onSuccess: () => void;
}

export const TransactionFormModal: React.FC<TransactionFormModalProps> = ({
  isOpen,
  onClose,
  categories,
  currency,
  transactionToEdit,
  defaultKind = 'expense',
  onSuccess,
}) => {
  const [kind, setKind] = useState<TransactionKind>(defaultKind);
  const [amount, setAmount] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [description, setDescription] = useState('');
  const [merchant, setMerchant] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('UPI');
  const [account, setAccount] = useState<AccountWallet>('Primary Bank');
  const [notes, setNotes] = useState('');
  const [tagsInput, setTagsInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (transactionToEdit) {
      setKind(transactionToEdit.kind);
      setAmount(String(transactionToEdit.amount));
      setCategoryId(transactionToEdit.categoryId);
      setDescription(transactionToEdit.description);
      setMerchant(transactionToEdit.merchant || '');
      setDate(transactionToEdit.date);
      setPaymentMethod(transactionToEdit.paymentMethod);
      setAccount(transactionToEdit.account);
      setNotes(transactionToEdit.notes || '');
      setTagsInput((transactionToEdit.tags || []).join(', '));
    } else {
      setKind(defaultKind);
      setAmount('');
      setDescription('');
      setMerchant('');
      setDate(new Date().toISOString().split('T')[0]);
      setPaymentMethod('UPI');
      setAccount('Primary Bank');
      setNotes('');
      setTagsInput('');
      const firstCat = categories.find((c) => c.kind === defaultKind);
      if (firstCat) setCategoryId(firstCat.id);
    }
    setError(null);
  }, [transactionToEdit, defaultKind, isOpen, categories]);

  if (!isOpen) return null;

  const filteredCategories = categories.filter((c) => c.kind === kind);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const num = parseFloat(amount);
    if (isNaN(num) || num <= 0) {
      setError('Enter a valid amount greater than zero.');
      return;
    }
    if (!categoryId) {
      setError('Select a category.');
      return;
    }

    setLoading(true);
    setError(null);

    const tags = tagsInput
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean);

    try {
      if (transactionToEdit) {
        await api.updateTransaction(transactionToEdit.id, {
          amount: num,
          kind,
          categoryId,
          description: description.trim(),
          merchant: merchant.trim(),
          date,
          paymentMethod,
          account,
          notes: notes.trim(),
          tags,
        });
      } else {
        await api.createTransaction({
          amount: num,
          kind,
          categoryId,
          description: description.trim(),
          merchant: merchant.trim(),
          date,
          paymentMethod,
          account,
          notes: notes.trim(),
          tags,
        });
      }
      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-3 sm:p-4 font-sans">
      <div className="surface-card rounded-xl max-w-md w-full max-h-[calc(100dvh-1.5rem)] overflow-y-auto p-4 sm:p-6 space-y-5 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-[16px] font-medium text-ink-primary">
            {transactionToEdit ? 'Edit transaction' : 'New transaction'}
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="text-ink-muted hover:text-ink-primary shrink-0 p-1"
          >
            <X className="w-4 h-4" strokeWidth={1.5} />
          </button>
        </div>

        {error && (
          <div className="p-3 rounded-lg bg-[#e5484d]/10 border border-[#e5484d]/30 text-negative text-[13px]">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4 text-[13px] min-w-0">
          {/* Kind Switcher */}
          <div className="grid grid-cols-2 p-1 surface-deep rounded-lg border hairline-border">
            <button
              type="button"
              onClick={() => {
                setKind('expense');
                const cat = categories.find((c) => c.kind === 'expense');
                if (cat) setCategoryId(cat.id);
              }}
              className={`h-8 rounded-md text-[12px] transition-colors ${
                kind === 'expense'
                  ? 'surface-active-row text-ink-primary font-medium'
                  : 'text-ink-muted hover:text-ink-primary'
              }`}
            >
              Expense
            </button>
            <button
              type="button"
              onClick={() => {
                setKind('income');
                const cat = categories.find((c) => c.kind === 'income');
                if (cat) setCategoryId(cat.id);
              }}
              className={`h-8 rounded-md text-[12px] transition-colors ${
                kind === 'income'
                  ? 'surface-active-row text-ink-primary font-medium'
                  : 'text-ink-muted hover:text-ink-primary'
              }`}
            >
              Income
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 min-w-0">
            <div className="space-y-1.5 min-w-0">
              <label className="block text-ink-secondary">Amount ({currency})</label>
              <div className="relative min-w-0">
                <span className="absolute left-3 top-2 text-ink-muted font-mono">
                  {currency}
                </span>
                <input
                  type="number"
                  step="0.01"
                  required
                  placeholder="0.00"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="w-full min-w-0 h-9 input-field rounded-lg pl-8 pr-3 font-mono font-medium tabular-nums"
                />
              </div>
            </div>

            <div className="space-y-1.5 min-w-0">
              <label className="block text-ink-secondary">Date</label>
              <input
                type="date"
                required
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full min-w-0 h-9 input-field rounded-lg px-3 font-mono"
              />
            </div>
          </div>

          <div className="space-y-1.5 min-w-0">
            <label className="block text-ink-secondary">Category</label>
            <select
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
              className="w-full min-w-0 h-9 input-field rounded-lg px-3"
            >
              {filteredCategories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 min-w-0">
            <div className="space-y-1.5 min-w-0">
              <label className="block text-ink-secondary">Description</label>
              <input
                type="text"
                placeholder="Mess lunch, textbook"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full min-w-0 h-9 input-field rounded-lg px-3"
              />
            </div>
            <div className="space-y-1.5 min-w-0">
              <label className="block text-ink-secondary">Merchant or payee</label>
              <input
                type="text"
                placeholder="Canteen, bookstore"
                value={merchant}
                onChange={(e) => setMerchant(e.target.value)}
                className="w-full min-w-0 h-9 input-field rounded-lg px-3"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 min-w-0">
            <div className="space-y-1.5 min-w-0">
              <label className="block text-ink-secondary">Account</label>
              <select
                value={account}
                onChange={(e) => setAccount(e.target.value as any)}
                className="w-full min-w-0 h-9 input-field rounded-lg px-3"
              >
                <option value="Primary Bank">Primary Bank</option>
                <option value="Pocket Cash">Pocket Cash</option>
                <option value="College ID / Campus Card">Campus Card</option>
                <option value="Savings">Savings Reserve</option>
                <option value="Digital Wallet">Digital Wallet</option>
              </select>
            </div>
            <div className="space-y-1.5 min-w-0">
              <label className="block text-ink-secondary">Payment method</label>
              <select
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value as any)}
                className="w-full min-w-0 h-9 input-field rounded-lg px-3"
              >
                <option value="UPI">UPI</option>
                <option value="Cash">Cash</option>
                <option value="Card">Card</option>
                <option value="Net Banking">Net Banking</option>
                <option value="Digital Wallet">Digital Wallet</option>
                <option value="Other">Other</option>
              </select>
            </div>
          </div>

          <div className="space-y-1.5 min-w-0">
            <label className="block text-ink-secondary">Tags (comma separated)</label>
            <input
              type="text"
              placeholder="mess, hostel, exam"
              value={tagsInput}
              onChange={(e) => setTagsInput(e.target.value)}
              className="w-full min-w-0 h-9 input-field rounded-lg px-3"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="h-9 px-3.5 btn-secondary rounded-lg text-[13px]"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="h-9 px-4 btn-primary rounded-lg text-[13px] font-medium disabled:opacity-50"
            >
              {loading
                ? 'Saving...'
                : transactionToEdit
                ? 'Update record'
                : 'Save record'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
