import React, { useState, useMemo } from 'react';
import {
  Search,
  Plus,
  Download,
  Upload,
  Trash2,
  Edit2,
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
  CheckSquare,
  Square,
  AlertCircle,
  X,
} from 'lucide-react';
import { Transaction, Category, User } from '../types.ts';
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
  const [startDate] = useState('');
  const [endDate] = useState('');
  const [sortBy, setSortBy] = useState<'date' | 'amount'>('date');
  const [sortOrder, setSortOrder] = useState<'desc' | 'asc'>('desc');
  const [page, setPage] = useState(1);
  const pageSize = 15;

  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isDeletingBulk, setIsDeletingBulk] = useState(false);

  const [showImportModal, setShowImportModal] = useState(false);
  const [importCsvText, setImportCsvText] = useState('');
  const [importStatus, setImportStatus] = useState<string | null>(null);
  const [isImporting, setIsImporting] = useState(false);

  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    return transactions
      .filter((t) => {
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
      })
      .sort((a, b) => {
        if (sortBy === 'amount') {
          return sortOrder === 'asc' ? a.amount - b.amount : b.amount - a.amount;
        }
        return sortOrder === 'asc'
          ? new Date(a.date).getTime() - new Date(b.date).getTime()
          : new Date(b.date).getTime() - new Date(a.date).getTime();
      });
  }, [
    transactions,
    kindFilter,
    categoryFilter,
    accountFilter,
    paymentFilter,
    startDate,
    endDate,
    search,
    sortBy,
    sortOrder,
  ]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const paginated = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filtered.slice(start, start + pageSize);
  }, [filtered, page]);

  const filteredSummary = useMemo(() => {
    const income = filtered
      .filter((t) => t.kind === 'income')
      .reduce((acc, t) => acc + t.amount, 0);
    const expense = filtered
      .filter((t) => t.kind === 'expense')
      .reduce((acc, t) => acc + t.amount, 0);
    return { income: Math.round(income), expense: Math.round(expense), net: Math.round(income - expense) };
  }, [filtered]);

  const toggleSelectAll = () => {
    if (selectedIds.length === paginated.length && paginated.length > 0) {
      setSelectedIds([]);
    } else {
      setSelectedIds(paginated.map((t) => t.id));
    }
  };

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleDeleteSingle = async (id: string) => {
    try {
      await api.deleteTransaction(id);
      setDeleteConfirmId(null);
      setSelectedIds((prev) => prev.filter((item) => item !== id));
      onRefresh();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleBulkDelete = async () => {
    if (selectedIds.length === 0) return;
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

  const handleExportCsv = () => {
    window.location.href = '/api/transactions/export-csv';
  };

  const handleParseCsvAndImport = async () => {
    if (!importCsvText.trim()) return;
    setIsImporting(true);
    setImportStatus(null);
    try {
      const lines = importCsvText
        .trim()
        .split('\n')
        .map((l) => l.trim())
        .filter(Boolean);
      if (lines.length < 2) {
        throw new Error('CSV must contain a header and at least one data row');
      }

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
      const amtIdx = header.findIndex(
        (h) => h.includes('amount') || h.includes('cost') || h.includes('price')
      );
      const descIdx = header.findIndex(
        (h) =>
          h.includes('desc') ||
          h.includes('note') ||
          h.includes('title') ||
          h.includes('merchant')
      );
      const catIdx = header.findIndex((h) => h.includes('cat'));
      const kindIdx = header.findIndex((h) => h.includes('type') || h.includes('kind'));

      if (amtIdx === -1) {
        throw new Error('Could not identify an Amount column in CSV header');
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
        throw new Error('No valid transaction rows found in CSV');
      }

      const res = await api.importCsv(rows);
      setImportStatus(
        `Imported ${res.imported} records (${res.skippedDuplicates} duplicates skipped)`
      );
      setTimeout(() => {
        setShowImportModal(false);
        setImportCsvText('');
        setImportStatus(null);
        onRefresh();
      }, 1400);
    } catch (err: any) {
      setImportStatus(`Error: ${err.message}`);
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <div className="space-y-6 pb-12 font-sans w-full min-w-0">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 min-w-0">
        <div className="space-y-1 min-w-0">
          <div className="text-[12px] font-mono text-ink-muted">
            Account ledger
          </div>
          <h1 className="text-[24px] sm:text-[28px] font-medium text-ink-primary tracking-tight leading-tight">
            Transactions
          </h1>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={() => setShowImportModal(true)}
            className="h-9 px-3.5 btn-secondary rounded-lg text-[13px] font-normal flex items-center gap-2 whitespace-nowrap"
          >
            <Upload className="w-4 h-4 text-ink-muted shrink-0" strokeWidth={1.5} />
            <span>Import CSV</span>
          </button>
          <button
            type="button"
            onClick={handleExportCsv}
            className="h-9 px-3.5 btn-secondary rounded-lg text-[13px] font-normal flex items-center gap-2 whitespace-nowrap"
          >
            <Download className="w-4 h-4 text-ink-muted shrink-0" strokeWidth={1.5} />
            <span>Export CSV</span>
          </button>
          <button
            type="button"
            onClick={() => onOpenAddTx('expense')}
            className="h-9 px-4 btn-primary rounded-lg text-[13px] font-medium flex items-center gap-2 whitespace-nowrap"
          >
            <Plus className="w-4 h-4 shrink-0" strokeWidth={1.75} />
            <span>New transaction</span>
          </button>
        </div>
      </div>

      {/* Filter & Search Panel */}
      <div className="p-4 sm:p-5 rounded-xl surface-card space-y-4 min-w-0">
        <div className="flex flex-col md:flex-row gap-3 min-w-0">
          <div className="relative flex-1 min-w-0">
            <Search
              className="w-4 h-4 absolute left-3 top-2.5 text-ink-muted"
              strokeWidth={1.5}
            />
            <input
              type="text"
              placeholder="Search transactions"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              className="w-full min-w-0 h-9 pl-9 pr-3 input-field rounded-lg text-[13px]"
            />
          </div>

          <div className="grid grid-cols-3 md:flex p-1 surface-deep rounded-lg border hairline-border shrink-0">
            <button
              type="button"
              onClick={() => {
                setKindFilter('all');
                setPage(1);
              }}
              className={`h-7 px-3 text-[12px] rounded-md transition-colors ${
                kindFilter === 'all'
                  ? 'surface-active-row text-ink-primary font-medium'
                  : 'text-ink-muted hover:text-ink-primary'
              }`}
            >
              All
            </button>
            <button
              type="button"
              onClick={() => {
                setKindFilter('expense');
                setPage(1);
              }}
              className={`h-7 px-3 text-[12px] rounded-md transition-colors ${
                kindFilter === 'expense'
                  ? 'surface-active-row text-ink-primary font-medium'
                  : 'text-ink-muted hover:text-ink-primary'
              }`}
            >
              Expenses
            </button>
            <button
              type="button"
              onClick={() => {
                setKindFilter('income');
                setPage(1);
              }}
              className={`h-7 px-3 text-[12px] rounded-md transition-colors ${
                kindFilter === 'income'
                  ? 'surface-active-row text-ink-primary font-medium'
                  : 'text-ink-muted hover:text-ink-primary'
              }`}
            >
              Income
            </button>
          </div>
        </div>

        {/* Filter Selects */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-3 border-t hairline-border text-[13px] min-w-0">
          <select
            value={categoryFilter}
            onChange={(e) => {
              setCategoryFilter(e.target.value);
              setPage(1);
            }}
            className="w-full min-w-0 h-9 input-field rounded-lg px-2.5 text-ink-secondary"
          >
            <option value="all">All categories</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>

          <select
            value={accountFilter}
            onChange={(e) => {
              setAccountFilter(e.target.value);
              setPage(1);
            }}
            className="w-full min-w-0 h-9 input-field rounded-lg px-2.5 text-ink-secondary"
          >
            <option value="all">All accounts</option>
            <option value="Primary Bank">Primary Bank</option>
            <option value="Pocket Cash">Pocket Cash</option>
            <option value="College ID / Campus Card">Campus Card</option>
            <option value="Savings">Savings Reserve</option>
            <option value="Digital Wallet">Digital Wallet</option>
          </select>

          <select
            value={paymentFilter}
            onChange={(e) => {
              setPaymentFilter(e.target.value);
              setPage(1);
            }}
            className="w-full min-w-0 h-9 input-field rounded-lg px-2.5 text-ink-secondary"
          >
            <option value="all">All payment methods</option>
            <option value="UPI">UPI</option>
            <option value="Cash">Cash</option>
            <option value="Card">Card</option>
            <option value="Net Banking">Net Banking</option>
            <option value="Digital Wallet">Digital Wallet</option>
          </select>

          <div className="flex items-center gap-1.5 min-w-0">
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="flex-1 min-w-0 h-9 input-field rounded-lg px-2.5 text-ink-secondary"
            >
              <option value="date">Sort by date</option>
              <option value="amount">Sort by amount</option>
            </select>
            <button
              type="button"
              onClick={() => setSortOrder((o) => (o === 'asc' ? 'desc' : 'asc'))}
              className="h-9 w-9 shrink-0 flex items-center justify-center input-field rounded-lg text-ink-muted hover:text-ink-primary"
              title="Reverse sort order"
            >
              <ArrowUpDown className="w-4 h-4" strokeWidth={1.5} />
            </button>
          </div>
        </div>

        {/* Summary Strip */}
        <div className="flex flex-wrap items-center justify-between gap-2 text-[12px] text-ink-muted font-mono pt-1">
          <span>{filtered.length} matching entries</span>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 tabular-nums">
            <span>
              Income: <span className="text-positive">+{currency}{filteredSummary.income.toLocaleString()}</span>
            </span>
            <span>
              Expenses: <span className="text-ink-primary">-{currency}{filteredSummary.expense.toLocaleString()}</span>
            </span>
            <span>
              Net: <span className={filteredSummary.net >= 0 ? 'text-ink-primary' : 'text-negative'}>
                {filteredSummary.net < 0 ? '-' : ''}{currency}{Math.abs(filteredSummary.net).toLocaleString()}
              </span>
            </span>
          </div>
        </div>
      </div>

      {/* Bulk Selection Bar */}
      {selectedIds.length > 0 && (
        <div className="p-3 surface-raised rounded-xl flex items-center justify-between gap-2 text-[13px] min-w-0">
          <span className="text-ink-primary font-mono">
            {selectedIds.length} selected
          </span>
          <button
            type="button"
            onClick={handleBulkDelete}
            disabled={isDeletingBulk}
            className="h-8 px-3 bg-[var(--negative)] text-white font-medium rounded-lg flex items-center gap-1.5 text-[12px] disabled:opacity-50 shrink-0"
          >
            <Trash2 className="w-3.5 h-3.5" strokeWidth={1.5} />
            <span>{isDeletingBulk ? 'Deleting...' : 'Delete selected'}</span>
          </button>
        </div>
      )}

      {/* Transactions Container: Mobile Card List (< md) + Desktop Table (md+) */}
      <div className="surface-card rounded-xl overflow-hidden min-w-0">
        {/* Mobile Responsive Ledger List */}
        <div className="md:hidden divide-y hairline-divide">
          {paginated.length > 0 ? (
            paginated.map((tx) => {
              const isSelected = selectedIds.includes(tx.id);
              return (
                <div
                  key={tx.id}
                  className={`p-3.5 space-y-2 transition-colors min-w-0 ${
                    isSelected ? 'bg-[var(--bg-raised)]' : ''
                  }`}
                >
                  <div className="flex items-start justify-between gap-3 min-w-0">
                    <div className="flex items-start gap-2.5 min-w-0">
                      <button
                        type="button"
                        onClick={() => toggleSelect(tx.id)}
                        className="mt-0.5 text-ink-muted hover:text-ink-primary shrink-0"
                        aria-label="Select transaction"
                      >
                        {isSelected ? (
                          <CheckSquare className="w-4 h-4 text-ink-primary" strokeWidth={1.5} />
                        ) : (
                          <Square className="w-4 h-4" strokeWidth={1.5} />
                        )}
                      </button>
                      <div className="min-w-0 space-y-0.5">
                        <div className="text-[13px] font-normal text-ink-primary break-words">
                          {tx.description || tx.categoryName}
                        </div>
                        <div className="text-[12px] text-ink-muted font-mono">
                          {tx.date} · {tx.categoryName}
                        </div>
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <div
                        className={`text-[13px] font-mono font-medium tabular-nums ${
                          tx.kind === 'income' ? 'text-positive' : 'text-ink-primary'
                        }`}
                      >
                        {tx.kind === 'income' ? '+' : '-'}{currency}{Math.round(tx.amount).toLocaleString()}
                      </div>
                      <div className="text-[11px] text-ink-muted font-mono">
                        {tx.paymentMethod}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between gap-2 pl-6 text-[12px] text-ink-muted">
                    <span className="truncate">
                      {tx.account}
                      {tx.merchant ? ` · ${tx.merchant}` : ''}
                    </span>
                    <div className="inline-flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={() => onEditTx(tx)}
                        className="h-7 px-2 flex items-center gap-1 text-ink-secondary hover:text-ink-primary rounded-md border hairline-border"
                      >
                        <Edit2 className="w-3 h-3" strokeWidth={1.5} />
                        <span>Edit</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setDeleteConfirmId(tx.id)}
                        className="h-7 w-7 flex items-center justify-center text-ink-muted hover:text-negative rounded-md border hairline-border"
                        title="Delete transaction"
                      >
                        <Trash2 className="w-3.5 h-3.5" strokeWidth={1.5} />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })
          ) : (
            <div className="py-12 text-center text-[13px] text-ink-muted px-4">
              No matching transactions found
            </div>
          )}
        </div>

        {/* Desktop Table */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-left text-[13px]">
            <thead className="surface-deep border-b hairline-border text-ink-muted font-normal text-[12px] select-none">
              <tr className="h-10">
                <th className="px-4 w-10 text-center font-normal">
                  <button
                    type="button"
                    onClick={toggleSelectAll}
                    className="text-ink-muted hover:text-ink-primary flex items-center justify-center"
                  >
                    {selectedIds.length === paginated.length && paginated.length > 0 ? (
                      <CheckSquare className="w-4 h-4 text-ink-primary" strokeWidth={1.5} />
                    ) : (
                      <Square className="w-4 h-4" strokeWidth={1.5} />
                    )}
                  </button>
                </th>
                <th className="px-4 font-normal">Date</th>
                <th className="px-4 font-normal">Description</th>
                <th className="px-4 font-normal">Category</th>
                <th className="px-4 font-normal">Account and method</th>
                <th className="px-4 font-normal text-right">Amount</th>
                <th className="px-4 font-normal text-right w-24">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y hairline-divide">
              {paginated.length > 0 ? (
                paginated.map((tx) => {
                  const isSelected = selectedIds.includes(tx.id);
                  return (
                    <tr
                      key={tx.id}
                      className={`h-11 transition-colors ${
                        isSelected
                          ? 'bg-[var(--bg-raised)]'
                          : 'hover:bg-[var(--bg-raised)]/60'
                      }`}
                    >
                      <td className="px-4 text-center">
                        <button
                          type="button"
                          onClick={() => toggleSelect(tx.id)}
                          className="text-ink-muted hover:text-ink-primary flex items-center justify-center"
                        >
                          {isSelected ? (
                            <CheckSquare className="w-4 h-4 text-ink-primary" strokeWidth={1.5} />
                          ) : (
                            <Square className="w-4 h-4" strokeWidth={1.5} />
                          )}
                        </button>
                      </td>
                      <td className="px-4 font-mono text-[12px] text-ink-muted whitespace-nowrap tabular-nums">
                        {tx.date}
                      </td>
                      <td className="px-4 max-w-xs">
                        <div className="font-normal text-ink-primary truncate">
                          {tx.description || tx.categoryName}
                        </div>
                        {(tx.merchant || (tx.tags && tx.tags.length > 0)) && (
                          <div className="text-[12px] text-ink-muted truncate">
                            {tx.merchant}
                            {tx.merchant && tx.tags && tx.tags.length > 0 ? ' · ' : ''}
                            {tx.tags && tx.tags.length > 0 ? tx.tags.join(', ') : ''}
                          </div>
                        )}
                      </td>
                      <td className="px-4 whitespace-nowrap text-ink-secondary">
                        {tx.categoryName}
                      </td>
                      <td className="px-4 whitespace-nowrap text-[12px] text-ink-muted">
                        <span className="text-ink-secondary">{tx.account}</span>
                        <span> · {tx.paymentMethod}</span>
                      </td>
                      <td className="px-4 text-right font-mono font-medium whitespace-nowrap tabular-nums">
                        <span className={tx.kind === 'income' ? 'text-positive' : 'text-ink-primary'}>
                          {tx.kind === 'income' ? '+' : '-'}{currency}{Math.round(tx.amount).toLocaleString()}
                        </span>
                      </td>
                      <td className="px-4 text-right whitespace-nowrap">
                        <div className="inline-flex items-center justify-end gap-1">
                          <button
                            type="button"
                            onClick={() => onEditTx(tx)}
                            className="h-7 w-7 flex items-center justify-center text-ink-muted hover:text-ink-primary rounded-md hover:bg-[var(--bg-hover)]"
                            title="Edit transaction"
                          >
                            <Edit2 className="w-3.5 h-3.5" strokeWidth={1.5} />
                          </button>
                          <button
                            type="button"
                            onClick={() => setDeleteConfirmId(tx.id)}
                            className="h-7 w-7 flex items-center justify-center text-ink-muted hover:text-negative rounded-md hover:bg-[var(--bg-hover)]"
                            title="Delete transaction"
                          >
                            <Trash2 className="w-3.5 h-3.5" strokeWidth={1.5} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-[13px] text-ink-muted">
                    No matching transactions found
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {totalPages > 1 && (
          <div className="p-3 border-t hairline-border surface-deep flex items-center justify-between text-[12px] text-ink-muted font-mono">
            <span>
              Page {page} of {totalPages}
            </span>
            <div className="flex items-center gap-1">
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="h-7 w-7 flex items-center justify-center rounded-md border hairline-border hover:bg-[var(--bg-raised)] disabled:opacity-40"
              >
                <ChevronLeft className="w-4 h-4" strokeWidth={1.5} />
              </button>
              <button
                type="button"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                className="h-7 w-7 flex items-center justify-center rounded-md border hairline-border hover:bg-[var(--bg-raised)] disabled:opacity-40"
              >
                <ChevronRight className="w-4 h-4" strokeWidth={1.5} />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Delete Confirmation Modal */}
      {deleteConfirmId && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="surface-card rounded-xl max-w-sm w-full max-h-[calc(100dvh-1.5rem)] overflow-y-auto p-5 space-y-4 min-w-0">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-negative shrink-0 mt-0.5" strokeWidth={1.5} />
              <div className="space-y-1 min-w-0">
                <h3 className="text-[15px] font-medium text-ink-primary">Delete transaction</h3>
                <p className="text-[13px] text-ink-secondary">
                  This entry will be permanently removed from your ledger.
                </p>
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setDeleteConfirmId(null)}
                className="h-8 px-3.5 btn-secondary rounded-lg text-[12px]"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => handleDeleteSingle(deleteConfirmId)}
                className="h-8 px-3.5 bg-[var(--negative)] text-white font-medium rounded-lg text-[12px]"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CSV Import Modal */}
      {showImportModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="surface-card rounded-xl max-w-lg w-full max-h-[calc(100dvh-1.5rem)] overflow-y-auto p-5 sm:p-6 space-y-4 min-w-0">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-[15px] font-medium text-ink-primary">Import transactions from CSV</h3>
              <button
                type="button"
                onClick={() => setShowImportModal(false)}
                className="text-ink-muted hover:text-ink-primary shrink-0"
              >
                <X className="w-4 h-4" strokeWidth={1.5} />
              </button>
            </div>

            <p className="text-[13px] text-ink-secondary break-words">
              Paste CSV rows below. Include a header row with columns such as{' '}
              <code className="font-mono text-ink-primary">Date, Description, Category, Amount, Type</code>
            </p>

            <textarea
              rows={7}
              value={importCsvText}
              onChange={(e) => setImportCsvText(e.target.value)}
              placeholder={`Date,Description,Category,Amount,Type\n2026-10-12,Campus Mess,Food & Mess,250,expense\n2026-10-14,Tuition Stipend,Part-time Job,1500,income`}
              className="w-full min-w-0 input-field rounded-lg p-3 text-[12px] font-mono"
            />

            {importStatus && (
              <div
                className={`p-3 rounded-lg text-[12px] break-words ${
                  importStatus.startsWith('Imported')
                    ? 'surface-raised text-positive'
                    : 'surface-raised text-negative'
                }`}
              >
                {importStatus}
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowImportModal(false)}
                className="h-9 px-3.5 btn-secondary rounded-lg text-[13px]"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isImporting || !importCsvText.trim()}
                onClick={handleParseCsvAndImport}
                className="h-9 px-4 btn-primary rounded-lg text-[13px] font-medium disabled:opacity-50"
              >
                {isImporting ? 'Importing...' : 'Import CSV'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
