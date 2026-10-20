import React, { useState, useMemo } from 'react';
import {
  Search,
  Filter,
  Plus,
  Download,
  Upload,
  Trash2,
  Edit2,
  ArrowUpDown,
  ArrowUpRight,
  ArrowDownLeft,
  ChevronLeft,
  ChevronRight,
  CheckSquare,
  Square,
  AlertCircle,
  FileSpreadsheet,
  X,
  Check,
} from 'lucide-react';
import { Transaction, Category, User, PaymentMethod, AccountWallet } from '../types.ts';
import { api } from '../api.ts';

interface TransactionsViewProps {
  user: User;
  currency: string;
  transactions: Transaction[];
  categories: Category[];
  onOpenAddTx: (defaultKind?: 'expense' | 'income') => void;
  onEditTx: (tx: Transaction) => void;
  onRefresh: () => void;
}

export const TransactionsView: React.FC<TransactionsViewProps> = ({
  user,
  currency,
  transactions,
  categories,
  onOpenAddTx,
  onEditTx,
  onRefresh,
}) => {
  const [search, setSearch] = useState('');
  const [kindFilter, setKindFilter] = useState<'all' | 'expense' | 'income'>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [accountFilter, setAccountFilter] = useState<string>('all');
  const [paymentFilter, setPaymentFilter] = useState<string>('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [sortBy, setSortBy] = useState<'date' | 'amount'>('date');
  const [sortOrder, setSortOrder] = useState<'desc' | 'asc'>('desc');
  const [page, setPage] = useState(1);
  const pageSize = 15;

  // Bulk selection
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isDeletingBulk, setIsDeletingBulk] = useState(false);

  // CSV Import Modal State
  const [showImportModal, setShowImportModal] = useState(false);
  const [importCsvText, setImportCsvText] = useState('');
  const [importStatus, setImportStatus] = useState<string | null>(null);
  const [isImporting, setIsImporting] = useState(false);

  // Delete single confirmation
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  // Filtered & Sorted Transactions
  const filtered = useMemo(() => {
    return transactions.filter((t) => {
      if (kindFilter !== 'all' && t.kind !== kindFilter) return false;
      if (categoryFilter !== 'all' && t.categoryId !== categoryFilter) return false;
      if (accountFilter !== 'all' && t.account !== accountFilter) return false;
      if (paymentFilter !== 'all' && t.paymentMethod !== paymentFilter) return false;
      if (startDate && t.date < startDate) return false;
      if (endDate && t.date > endDate) return false;
      if (search.trim()) {
        const q = search.trim().toLowerCase();
        const matchesDesc = t.description.toLowerCase().includes(q);
        const matchesMerchant = t.merchant.toLowerCase().includes(q);
        const matchesCat = t.categoryName.toLowerCase().includes(q);
        const matchesTags = t.tags?.some((tag) => tag.toLowerCase().includes(q));
        if (!matchesDesc && !matchesMerchant && !matchesCat && !matchesTags) return false;
      }
      return true;
    }).sort((a, b) => {
      if (sortBy === 'amount') {
        return sortOrder === 'asc' ? a.amount - b.amount : b.amount - a.amount;
      }
      return sortOrder === 'asc'
        ? new Date(a.date).getTime() - new Date(b.date).getTime()
        : new Date(b.date).getTime() - new Date(a.date).getTime();
    });
  }, [transactions, kindFilter, categoryFilter, accountFilter, paymentFilter, startDate, endDate, search, sortBy, sortOrder]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const paginated = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filtered.slice(start, start + pageSize);
  }, [filtered, page, pageSize]);

  // Totals for filtered records
  const filteredSummary = useMemo(() => {
    let inc = 0;
    let exp = 0;
    filtered.forEach((t) => {
      if (t.kind === 'income') inc += t.amount;
      else exp += t.amount;
    });
    return { income: inc, expense: exp, net: inc - exp };
  }, [filtered]);

  const toggleSelectAll = () => {
    if (selectedIds.length === paginated.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(paginated.map((t) => t.id));
    }
  };

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]));
  };

  const handleBulkDelete = async () => {
    if (selectedIds.length === 0) return;
    if (!confirm(`Are you sure you want to delete ${selectedIds.length} selected transaction(s)?`)) return;
    setIsDeletingBulk(true);
    try {
      await api.bulkDeleteTransactions(selectedIds);
      setSelectedIds([]);
      onRefresh();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setIsDeletingBulk(false);
    }
  };

  const handleDeleteSingle = async (id: string) => {
    try {
      await api.deleteTransaction(id);
      setDeleteConfirmId(null);
      onRefresh();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleExportCsv = () => {
    window.location.href = '/api/transactions/export-csv';
  };

  // CSV Import Parser
  const handleParseCsvAndImport = async () => {
    if (!importCsvText.trim()) return;
    setIsImporting(true);
    setImportStatus(null);
    try {
      const lines = importCsvText.trim().split('\n').map((l) => l.trim()).filter(Boolean);
      if (lines.length < 2) {
        throw new Error('CSV must contain at least a header and 1 data row.');
      }

      // Simple CSV line parser handling quotes
      const parseLine = (line: string): string[] => {
        const result: string[] = [];
        let cur = '';
        let insideQuotes = false;
        for (let i = 0; i < line.length; i++) {
          const char = line[i];
          if (char === '"') {
            insideQuotes = !insideQuotes;
          } else if (char === ',' && !insideQuotes) {
            result.push(cur.trim());
            cur = '';
          } else {
            cur += char;
          }
        }
        result.push(cur.trim());
        return result;
      };

      const header = parseLine(lines[0]).map((h) => h.toLowerCase().replace(/[^a-z0-9]/g, ''));
      const dateIdx = header.findIndex((h) => h.includes('date'));
      const amtIdx = header.findIndex((h) => h.includes('amount') || h.includes('cost') || h.includes('price'));
      const descIdx = header.findIndex((h) => h.includes('desc') || h.includes('note') || h.includes('title') || h.includes('merchant'));
      const catIdx = header.findIndex((h) => h.includes('cat'));
      const kindIdx = header.findIndex((h) => h.includes('type') || h.includes('kind'));

      if (amtIdx === -1) {
        throw new Error('Could not identify an "Amount" column in CSV header.');
      }

      const rows: any[] = [];
      for (let i = 1; i < lines.length; i++) {
        const cols = parseLine(lines[i]);
        if (cols.length <= amtIdx) continue;

        const amtStr = cols[amtIdx].replace(/[^0-9.-]/g, '');
        const amount = parseFloat(amtStr);
        if (isNaN(amount) || amount <= 0) continue;

        rows.push({
          date: dateIdx !== -1 ? cols[dateIdx] : new Date().toISOString().split('T')[0],
          amount,
          description: descIdx !== -1 ? cols[descIdx] : 'Imported item',
          category: catIdx !== -1 ? cols[catIdx] : undefined,
          kind: kindIdx !== -1 ? cols[kindIdx] : 'expense',
        });
      }

      if (rows.length === 0) {
        throw new Error('No valid transaction rows found in CSV.');
      }

      const res = await api.importCsv(rows);
      setImportStatus(`Success! Imported ${res.imported} records (${res.skippedDuplicates} duplicates skipped).`);
      setTimeout(() => {
        setShowImportModal(false);
        setImportCsvText('');
        setImportStatus(null);
        onRefresh();
      }, 1500);
    } catch (err: any) {
      setImportStatus(`Error: ${err.message}`);
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <div className="space-y-5 pb-12">
      {/* Top Header & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-white tracking-tight">Transactions Ledger</h1>
          <p className="text-xs text-slate-400">
            Track, filter, and audit every student expenditure and income source
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => onOpenAddTx('expense')}
            className="px-3 py-1.5 bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-semibold rounded-lg text-xs flex items-center gap-1.5 transition-colors shadow"
          >
            <Plus className="w-3.5 h-3.5" /> Add Transaction
          </button>
          <button
            onClick={() => setShowImportModal(true)}
            className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700/80 rounded-lg text-xs flex items-center gap-1.5 transition-colors"
          >
            <Upload className="w-3.5 h-3.5 text-teal-400" /> Import CSV
          </button>
          <button
            onClick={handleExportCsv}
            className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700/80 rounded-lg text-xs flex items-center gap-1.5 transition-colors"
          >
            <Download className="w-3.5 h-3.5 text-emerald-400" /> Export CSV
          </button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800/80 space-y-3">
        <div className="flex flex-col md:flex-row gap-3">
          {/* Search box */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3 top-3 text-slate-500" />
            <input
              type="text"
              placeholder="Search description, merchant, tag, or category..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              className="w-full pl-9 pr-3 py-2 bg-slate-950/70 border border-slate-800 rounded-lg text-xs text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-emerald-500/50"
            />
          </div>

          {/* Type Filter */}
          <div className="flex bg-slate-950/80 p-0.5 rounded-lg border border-slate-800 shrink-0">
            <button
              onClick={() => { setKindFilter('all'); setPage(1); }}
              className={`px-3 py-1.5 text-xs rounded-md transition-colors ${
                kindFilter === 'all' ? 'bg-emerald-500/20 text-emerald-300 font-semibold' : 'text-slate-400'
              }`}
            >
              All
            </button>
            <button
              onClick={() => { setKindFilter('expense'); setPage(1); }}
              className={`px-3 py-1.5 text-xs rounded-md transition-colors ${
                kindFilter === 'expense' ? 'bg-rose-500/20 text-rose-300 font-semibold' : 'text-slate-400'
              }`}
            >
              Expenses
            </button>
            <button
              onClick={() => { setKindFilter('income'); setPage(1); }}
              className={`px-3 py-1.5 text-xs rounded-md transition-colors ${
                kindFilter === 'income' ? 'bg-emerald-500/20 text-emerald-300 font-semibold' : 'text-slate-400'
              }`}
            >
              Income
            </button>
          </div>
        </div>

        {/* Extended Filter Dropdowns */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 border-t border-slate-800/60 text-xs">
          {/* Category */}
          <select
            value={categoryFilter}
            onChange={(e) => { setCategoryFilter(e.target.value); setPage(1); }}
            className="bg-slate-950/80 border border-slate-800 rounded-lg px-2.5 py-1.5 text-slate-300 focus:outline-none focus:border-teal-500"
          >
            <option value="all">All Categories</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>{c.name} ({c.kind})</option>
            ))}
          </select>

          {/* Account */}
          <select
            value={accountFilter}
            onChange={(e) => { setAccountFilter(e.target.value); setPage(1); }}
            className="bg-slate-950/80 border border-slate-800 rounded-lg px-2.5 py-1.5 text-slate-300 focus:outline-none focus:border-teal-500"
          >
            <option value="all">All Accounts</option>
            <option value="Primary Bank">Primary Bank</option>
            <option value="Pocket Cash">Pocket Cash</option>
            <option value="College ID / Campus Card">Campus Card</option>
            <option value="Savings">Savings Reserve</option>
            <option value="Digital Wallet">Digital Wallet</option>
          </select>

          {/* Payment Method */}
          <select
            value={paymentFilter}
            onChange={(e) => { setPaymentFilter(e.target.value); setPage(1); }}
            className="bg-slate-950/80 border border-slate-800 rounded-lg px-2.5 py-1.5 text-slate-300 focus:outline-none focus:border-teal-500"
          >
            <option value="all">All Methods</option>
            <option value="UPI">UPI (GPay / PhonePe / Paytm)</option>
            <option value="Cash">Cash</option>
            <option value="Card">Debit / Credit Card</option>
            <option value="Net Banking">Net Banking</option>
            <option value="Digital Wallet">Wallet</option>
          </select>

          {/* Sort By */}
          <div className="flex items-center gap-1.5">
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="flex-1 bg-slate-950/80 border border-slate-800 rounded-lg px-2.5 py-1.5 text-slate-300 focus:outline-none focus:border-teal-500"
            >
              <option value="date">Sort: Date</option>
              <option value="amount">Sort: Amount</option>
            </select>
            <button
              onClick={() => setSortOrder((o) => (o === 'asc' ? 'desc' : 'asc'))}
              className="p-1.5 bg-slate-950/80 border border-slate-800 rounded-lg text-slate-300 hover:text-white"
              title="Toggle sort direction"
            >
              <ArrowUpDown className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Filter Summary Strip */}
        <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1">
          <span>
            Showing <strong className="text-white">{filtered.length}</strong> records
          </span>
          <div className="flex items-center gap-3">
            <span>Income: <strong className="text-emerald-400">+{currency}{filteredSummary.income.toLocaleString()}</strong></span>
            <span>Expenses: <strong className="text-rose-400">-{currency}{filteredSummary.expense.toLocaleString()}</strong></span>
            <span>Net: <strong className={filteredSummary.net >= 0 ? 'text-teal-300' : 'text-red-400'}>
              {currency}{filteredSummary.net.toLocaleString()}
            </strong></span>
          </div>
        </div>
      </div>

      {/* Bulk Action Header when items selected */}
      {selectedIds.length > 0 && (
        <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl flex items-center justify-between text-xs">
          <span className="text-rose-300 font-medium">
            {selectedIds.length} transaction(s) selected
          </span>
          <button
            onClick={handleBulkDelete}
            disabled={isDeletingBulk}
            className="px-3 py-1 bg-rose-600 hover:bg-rose-700 text-white font-semibold rounded-lg flex items-center gap-1.5 transition-colors disabled:opacity-50"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>{isDeletingBulk ? 'Deleting...' : 'Delete Selected'}</span>
          </button>
        </div>
      )}

      {/* Transactions Table */}
      <div className="bg-slate-900/80 border border-slate-800/80 rounded-2xl overflow-hidden shadow">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-950/70 border-b border-slate-800 text-slate-400 uppercase font-semibold text-[10px] tracking-wider select-none">
              <tr>
                <th className="py-3 px-3 w-10 text-center">
                  <button onClick={toggleSelectAll} className="text-slate-400 hover:text-white">
                    {selectedIds.length === paginated.length && paginated.length > 0 ? (
                      <CheckSquare className="w-4 h-4 text-emerald-400" />
                    ) : (
                      <Square className="w-4 h-4" />
                    )}
                  </button>
                </th>
                <th className="py-3 px-3">Date</th>
                <th className="py-3 px-3">Description</th>
                <th className="py-3 px-3">Category</th>
                <th className="py-3 px-3">Account &amp; Method</th>
                <th className="py-3 px-3 text-right">Amount</th>
                <th className="py-3 px-3 text-center w-24">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-sans">
              {paginated.length > 0 ? (
                paginated.map((tx) => {
                  const isSelected = selectedIds.includes(tx.id);
                  return (
                    <tr
                      key={tx.id}
                      className={`hover:bg-slate-800/30 transition-colors ${
                        isSelected ? 'bg-slate-800/40' : ''
                      }`}
                    >
                      <td className="py-3 px-3 text-center">
                        <button onClick={() => toggleSelect(tx.id)} className="text-slate-400 hover:text-white">
                          {isSelected ? (
                            <CheckSquare className="w-4 h-4 text-emerald-400" />
                          ) : (
                            <Square className="w-4 h-4" />
                          )}
                        </button>
                      </td>
                      <td className="py-3 px-3 font-mono text-slate-400 whitespace-nowrap">
                        {tx.date}
                      </td>
                      <td className="py-3 px-3 max-w-xs">
                        <div className="font-semibold text-slate-200 truncate">
                          {tx.description || tx.categoryName}
                        </div>
                        {tx.merchant && (
                          <div className="text-[10px] text-slate-500 truncate">{tx.merchant}</div>
                        )}
                        {tx.tags && tx.tags.length > 0 && (
                          <div className="flex gap-1.5 mt-1 flex-wrap text-[10px] text-slate-500 font-mono">
                            {tx.tags.map((tag, i) => (
                              <span key={i}>#{tag}</span>
                            ))}
                          </div>
                        )}
                      </td>
                      <td className="py-3 px-3 whitespace-nowrap text-slate-300 font-medium">
                        {tx.categoryName}
                      </td>
                      <td className="py-3 px-3 whitespace-nowrap text-slate-400">
                        <div className="font-medium text-slate-300">{tx.account}</div>
                        <div className="text-[10px] text-slate-500 font-mono">{tx.paymentMethod}</div>
                      </td>
                      <td className="py-3 px-3 text-right font-mono font-bold whitespace-nowrap">
                        <span className={tx.kind === 'income' ? 'text-emerald-400' : 'text-slate-200'}>
                          {tx.kind === 'income' ? '+' : '-'}{currency}{tx.amount.toLocaleString()}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-center whitespace-nowrap">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            onClick={() => onEditTx(tx)}
                            className="p-1.5 text-slate-400 hover:text-teal-300 rounded hover:bg-slate-800"
                            title="Edit Transaction"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => setDeleteConfirmId(tx.id)}
                            className="p-1.5 text-slate-400 hover:text-red-400 rounded hover:bg-slate-800"
                            title="Delete Transaction"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-xs text-slate-500">
                    No transactions match your filters. Try clearing search filters or click "+ Add Transaction".
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Bar */}
        {totalPages > 1 && (
          <div className="p-3 border-t border-slate-800/80 bg-slate-950/40 flex items-center justify-between text-xs text-slate-400">
            <span>
              Page <strong className="text-white">{page}</strong> of <strong className="text-white">{totalPages}</strong>
            </span>
            <div className="flex items-center gap-1">
              <button
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="p-1.5 rounded-lg border border-slate-800 hover:bg-slate-800 disabled:opacity-40 transition-colors"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                disabled={page >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                className="p-1.5 rounded-lg border border-slate-800 hover:bg-slate-800 disabled:opacity-40 transition-colors"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Delete Single Modal */}
      {deleteConfirmId && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-sm w-full p-5 space-y-4 shadow-2xl">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-red-500/10 text-red-400">
                <AlertCircle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white">Delete Transaction?</h3>
                <p className="text-xs text-slate-400">This action cannot be undone.</p>
              </div>
            </div>
            <div className="flex justify-end gap-2.5 pt-2">
              <button
                onClick={() => setDeleteConfirmId(null)}
                className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDeleteSingle(deleteConfirmId)}
                className="px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-lg text-xs"
              >
                Confirm Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CSV Import Modal */}
      {showImportModal && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <FileSpreadsheet className="w-5 h-5 text-teal-400" />
                <h3 className="text-sm font-bold text-white">Import Transactions from CSV</h3>
              </div>
              <button onClick={() => setShowImportModal(false)} className="text-slate-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-slate-400">
              Paste CSV rows or upload a file. The first row should contain headers such as: <code className="text-teal-300">Date, Description, Category, Amount, Type</code>.
            </p>

            <textarea
              rows={8}
              value={importCsvText}
              onChange={(e) => setImportCsvText(e.target.value)}
              placeholder={`Date,Description,Category,Amount,Type\n2026-10-12,Campus Mess,Food & Mess,250,expense\n2026-10-14,Tuition Stipend,Part-time Job,1500,income`}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs font-mono text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-teal-500"
            />

            {importStatus && (
              <div className={`p-3 rounded-lg text-xs font-medium ${
                importStatus.startsWith('Success') ? 'bg-emerald-500/10 text-emerald-300 border border-emerald-500/30' : 'bg-red-500/10 text-red-300 border border-red-500/30'
              }`}>
                {importStatus}
              </div>
            )}

            <div className="flex justify-end gap-2.5 pt-2">
              <button
                onClick={() => setShowImportModal(false)}
                className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs"
              >
                Cancel
              </button>
              <button
                disabled={isImporting || !importCsvText.trim()}
                onClick={handleParseCsvAndImport}
                className="px-4 py-2 bg-teal-500 hover:bg-teal-600 text-slate-950 font-semibold rounded-lg text-xs disabled:opacity-50 transition-colors shadow"
              >
                {isImporting ? 'Processing...' : 'Validate & Import'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
