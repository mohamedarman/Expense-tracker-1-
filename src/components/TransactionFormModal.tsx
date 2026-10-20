import React, { useState, useEffect } from 'react';
import { X, Plus, Edit2, Calendar, CreditCard, Tag } from 'lucide-react';
import { Transaction, Category, PaymentMethod, AccountWallet, TransactionKind } from '../types.ts';
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
      setError('Please enter a valid amount greater than zero.');
      return;
    }
    if (!categoryId) {
      setError('Please select a valid category.');
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
    <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            {transactionToEdit ? <Edit2 className="w-4 h-4 text-teal-400" /> : <Plus className="w-4 h-4 text-emerald-400" />}
            {transactionToEdit ? 'Edit Transaction' : 'Record New Transaction'}
          </h3>
          <button onClick={onClose} className="text-slate-400 hover:text-white">
            <X className="w-4 h-4" />
          </button>
        </div>

        {error && (
          <div className="p-2.5 rounded-lg bg-red-500/10 border border-red-500/30 text-red-300 text-xs">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-3.5 text-xs">
          {/* Kind Toggle */}
          <div className="grid grid-cols-2 gap-2 p-1 bg-slate-950 rounded-xl border border-slate-800">
            <button
              type="button"
              onClick={() => {
                setKind('expense');
                const cat = categories.find((c) => c.kind === 'expense');
                if (cat) setCategoryId(cat.id);
              }}
              className={`py-2 rounded-lg font-semibold transition-colors ${
                kind === 'expense'
                  ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Expense (-)
            </button>
            <button
              type="button"
              onClick={() => {
                setKind('income');
                const cat = categories.find((c) => c.kind === 'income');
                if (cat) setCategoryId(cat.id);
              }}
              className={`py-2 rounded-lg font-semibold transition-colors ${
                kind === 'income'
                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Income (+)
            </button>
          </div>

          {/* Amount & Date */}
          <div className="grid grid-cols-2 gap-2.5">
            <div>
              <label className="block text-slate-400 mb-1">Amount ({currency}) *</label>
              <div className="relative">
                <span className="absolute left-3 top-2.5 text-slate-400 font-mono">{currency}</span>
                <input
                  type="number"
                  step="0.01"
                  required
                  placeholder="0.00"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-8 pr-3 py-2 text-sm font-bold font-mono text-white focus:outline-none focus:border-teal-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-slate-400 mb-1">Date *</label>
              <input
                type="date"
                required
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-200 focus:outline-none focus:border-teal-500"
              />
            </div>
          </div>

          {/* Category */}
          <div>
            <label className="block text-slate-400 mb-1">Category *</label>
            <select
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-200 focus:outline-none focus:border-teal-500"
            >
              {filteredCategories.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>

          {/* Description & Merchant */}
          <div className="grid grid-cols-2 gap-2.5">
            <div>
              <label className="block text-slate-400 mb-1">Description</label>
              <input
                type="text"
                placeholder="e.g. Mess lunch, textbook"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-200 focus:outline-none focus:border-teal-500"
              />
            </div>
            <div>
              <label className="block text-slate-400 mb-1">Merchant / Payee</label>
              <input
                type="text"
                placeholder="e.g. Canteen, Amazon"
                value={merchant}
                onChange={(e) => setMerchant(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-200 focus:outline-none focus:border-teal-500"
              />
            </div>
          </div>

          {/* Account & Payment Method */}
          <div className="grid grid-cols-2 gap-2.5">
            <div>
              <label className="block text-slate-400 mb-1">Account / Wallet</label>
              <select
                value={account}
                onChange={(e) => setAccount(e.target.value as any)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-200 focus:outline-none focus:border-teal-500"
              >
                <option value="Primary Bank">Primary Bank</option>
                <option value="Pocket Cash">Pocket Cash</option>
                <option value="College ID / Campus Card">Campus Card</option>
                <option value="Savings">Savings Reserve</option>
                <option value="Digital Wallet">Digital Wallet</option>
              </select>
            </div>
            <div>
              <label className="block text-slate-400 mb-1">Payment Method</label>
              <select
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value as any)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-200 focus:outline-none focus:border-teal-500"
              >
                <option value="UPI">UPI (GPay / PhonePe)</option>
                <option value="Cash">Cash</option>
                <option value="Card">Debit / Credit Card</option>
                <option value="Net Banking">Net Banking</option>
                <option value="Digital Wallet">Wallet</option>
                <option value="Other">Other</option>
              </select>
            </div>
          </div>

          {/* Tags */}
          <div>
            <label className="block text-slate-400 mb-1">Tags (comma separated)</label>
            <input
              type="text"
              placeholder="e.g. mess, hostel, exam, weekend"
              value={tagsInput}
              onChange={(e) => setTagsInput(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-200 focus:outline-none focus:border-teal-500"
            />
          </div>

          {/* Buttons */}
          <div className="flex justify-end gap-2.5 pt-3">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-5 py-2 bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-bold rounded-xl text-xs transition-colors shadow disabled:opacity-50"
            >
              {loading ? 'Saving...' : transactionToEdit ? 'Update Record' : 'Save Record'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
