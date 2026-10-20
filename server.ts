/**
 * Production-Grade Express Server for Smart Student Expense Tracker
 * Features: REST APIs, Strict Authorization, Decimal Precision, Persistent Storage, Vite SPA Serving
 */

import express, { Request, Response, NextFunction } from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';
import { db, roundMoney, DEFAULT_STUDENT_CATEGORIES } from './server/db.ts';
import { hashPassword, verifyPassword, generateToken, verifyToken } from './server/auth.ts';
import { askFinancialAssistant, computeUserFinancialContext } from './server/ai.ts';
import { User, Transaction, Budget, PaymentMethod, AccountWallet, TransactionKind } from './server/types.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Request logger (excludes sensitive headers & bodies)
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    if (req.path.startsWith('/api')) {
      const duration = Date.now() - start;
      console.log(`[API] ${req.method} ${req.path} -> ${res.statusCode} (${duration}ms)`);
    }
  });
  next();
});

// Authentication Middleware
interface AuthenticatedRequest extends Request {
  user?: User;
}

function authenticateToken(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.substring(7) : null;

  if (!token) {
    return res.status(401).json({ error: 'Authentication required. Please sign in.' });
  }

  const payload = verifyToken(token);
  if (!payload) {
    return res.status(401).json({ error: 'Invalid or expired session. Please sign in again.' });
  }

  const user = db.getUserById(payload.userId);
  if (!user) {
    return res.status(401).json({ error: 'User account not found.' });
  }

  req.user = user;
  next();
}

// ----------------- HEALTH CHECK -----------------
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    app: 'Smart Student Expense Tracker',
    version: '2.0.0',
    timestamp: new Date().toISOString(),
    uptime: Math.round(process.uptime()),
  });
});

// ----------------- AUTH ROUTES -----------------
app.post('/api/auth/register', (req, res) => {
  try {
    const { name, email, password, confirmPassword, collegeName, degreeSemester, monthlyBudget, currency } = req.body;

    if (!name || typeof name !== 'string' || name.trim().length === 0 || name.length > 100) {
      return res.status(400).json({ error: 'Enter your name (up to 100 characters).' });
    }

    const cleanEmail = (email || '').trim().toLowerCase();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!cleanEmail || !emailRegex.test(cleanEmail) || cleanEmail.length > 150) {
      return res.status(400).json({ error: 'Enter a valid email address.' });
    }

    if (!password || typeof password !== 'string' || password.length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters long.' });
    }

    if (confirmPassword && password !== confirmPassword) {
      return res.status(400).json({ error: 'Passwords do not match.' });
    }

    const existing = db.getUserByEmail(cleanEmail);
    if (existing) {
      return res.status(409).json({ error: 'An account with this email address already exists.' });
    }

    const { hash, salt } = hashPassword(password);
    const newUser: User = {
      id: 'usr-' + crypto.randomUUID(),
      name: name.trim(),
      email: cleanEmail,
      passwordHash: hash,
      salt: salt,
      currency: currency || '₹',
      theme: 'dark',
      monthlyBudget: monthlyBudget ? roundMoney(monthlyBudget) : 15000,
      semesterBudget: monthlyBudget ? roundMoney(monthlyBudget * 4) : 60000,
      semesterEndDate: '2026-12-15',
      collegeName: collegeName ? collegeName.trim() : 'College / University',
      degreeSemester: degreeSemester ? degreeSemester.trim() : 'Semester 1',
      createdAt: new Date().toISOString(),
    };

    db.createUser(newUser);
    const token = generateToken(newUser);

    const safeUser = { ...newUser };
    delete (safeUser as any).passwordHash;
    delete (safeUser as any).salt;

    res.status(201).json({
      message: 'Account created successfully!',
      token,
      user: safeUser,
    });
  } catch (err: any) {
    console.error('Register error:', err);
    res.status(500).json({ error: 'Internal server error while creating account.' });
  }
});

app.post('/api/auth/login', (req, res) => {
  try {
    const { email, password } = req.body;
    const cleanEmail = (email || '').trim().toLowerCase();

    if (!cleanEmail || !password) {
      return res.status(400).json({ error: 'Email and password are required.' });
    }

    const user = db.getUserByEmail(cleanEmail);
    if (!user || !verifyPassword(password, user.passwordHash, user.salt)) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    const token = generateToken(user);
    const safeUser = { ...user };
    delete (safeUser as any).passwordHash;
    delete (safeUser as any).salt;

    res.json({
      message: "You're signed in.",
      token,
      user: safeUser,
    });
  } catch (err: any) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Internal server error during login.' });
  }
});

app.get('/api/auth/me', authenticateToken, (req: AuthenticatedRequest, res: Response) => {
  const safeUser = { ...req.user! };
  delete (safeUser as any).passwordHash;
  delete (safeUser as any).salt;
  res.json({ user: safeUser });
});

app.put('/api/auth/profile', authenticateToken, (req: AuthenticatedRequest, res: Response) => {
  try {
    const { name, currency, theme, monthlyBudget, semesterBudget, semesterEndDate, collegeName, degreeSemester } = req.body;
    const updates: Partial<User> = {};

    if (name && typeof name === 'string') updates.name = name.trim();
    if (currency && typeof currency === 'string') updates.currency = currency.trim();
    if (theme === 'dark' || theme === 'light') updates.theme = theme;
    if (monthlyBudget !== undefined) updates.monthlyBudget = roundMoney(monthlyBudget);
    if (semesterBudget !== undefined) updates.semesterBudget = roundMoney(semesterBudget);
    if (semesterEndDate && typeof semesterEndDate === 'string') updates.semesterEndDate = semesterEndDate;
    if (collegeName !== undefined) updates.collegeName = collegeName.trim();
    if (degreeSemester !== undefined) updates.degreeSemester = degreeSemester.trim();

    const updated = db.updateUser(req.user!.id, updates);
    if (!updated) return res.status(404).json({ error: 'User not found.' });

    const safeUser = { ...updated };
    delete (safeUser as any).passwordHash;
    delete (safeUser as any).salt;

    res.json({ message: 'Profile updated successfully.', user: safeUser });
  } catch (err: any) {
    console.error('Profile update error:', err);
    res.status(500).json({ error: 'Failed to update profile.' });
  }
});

app.post('/api/auth/change-password', authenticateToken, (req: AuthenticatedRequest, res: Response) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: 'Current password and new password are required.' });
    }

    if (newPassword.length < 8) {
      return res.status(400).json({ error: 'New password must be at least 8 characters long.' });
    }

    if (!verifyPassword(currentPassword, req.user!.passwordHash, req.user!.salt)) {
      return res.status(400).json({ error: 'Current password is incorrect.' });
    }

    const { hash, salt } = hashPassword(newPassword);
    db.updateUser(req.user!.id, { passwordHash: hash, salt });

    res.json({ message: 'Password changed successfully.' });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to change password.' });
  }
});

app.delete('/api/auth/account', authenticateToken, (req: AuthenticatedRequest, res: Response) => {
  db.deleteUser(req.user!.id);
  res.json({ message: 'Account and all associated financial records permanently deleted.' });
});

app.get('/api/auth/export', authenticateToken, (req: AuthenticatedRequest, res: Response) => {
  const data = db.exportUserData(req.user!.id);
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Content-Disposition', `attachment; filename=student-finance-export-${req.user!.id}.json`);
  res.json(data);
});

// ----------------- CATEGORIES ROUTES -----------------
app.get('/api/categories', authenticateToken, (req: AuthenticatedRequest, res: Response) => {
  const categories = db.getCategories(req.user!.id);
  res.json({ categories });
});

app.post('/api/categories', authenticateToken, (req: AuthenticatedRequest, res: Response) => {
  try {
    const { name, kind, color, icon, isEssential } = req.body;
    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return res.status(400).json({ error: 'Category name is required.' });
    }
    if (kind !== 'expense' && kind !== 'income') {
      return res.status(400).json({ error: 'Category kind must be expense or income.' });
    }

    const created = db.createCategory(req.user!.id, {
      name: name.trim(),
      kind,
      color: color || '#10b981',
      icon: icon || 'Tag',
      isEssential: !!isEssential,
    });

    res.status(201).json({ category: created });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to create category.' });
  }
});

app.delete('/api/categories/:id', authenticateToken, (req: AuthenticatedRequest, res: Response) => {
  const deleted = db.deleteCategory(req.user!.id, req.params.id);
  if (!deleted) {
    return res.status(400).json({ error: 'Cannot delete system default categories or category not found.' });
  }
  res.json({ message: 'Category deleted.' });
});

// ----------------- TRANSACTIONS ROUTES -----------------
app.get('/api/transactions', authenticateToken, (req: AuthenticatedRequest, res: Response) => {
  const { kind, categoryId, startDate, endDate, search, account, paymentMethod, sortBy, order, page, limit } = req.query;

  let list = db.getTransactions(req.user!.id);

  if (kind && (kind === 'expense' || kind === 'income')) {
    list = list.filter((t) => t.kind === kind);
  }
  if (categoryId) {
    list = list.filter((t) => t.categoryId === categoryId);
  }
  if (account) {
    list = list.filter((t) => t.account === account);
  }
  if (paymentMethod) {
    list = list.filter((t) => t.paymentMethod === paymentMethod);
  }
  if (startDate) {
    list = list.filter((t) => t.date >= (startDate as string));
  }
  if (endDate) {
    list = list.filter((t) => t.date <= (endDate as string));
  }
  if (search && typeof search === 'string' && search.trim()) {
    const q = search.trim().toLowerCase();
    list = list.filter(
      (t) =>
        t.description.toLowerCase().includes(q) ||
        t.merchant.toLowerCase().includes(q) ||
        t.categoryName.toLowerCase().includes(q) ||
        (t.tags && t.tags.some((tag) => tag.toLowerCase().includes(q)))
    );
  }

  // Summary calculations over filtered set
  let totalIncome = 0;
  let totalExpense = 0;
  list.forEach((t) => {
    if (t.kind === 'income') totalIncome = roundMoney(totalIncome + t.amount);
    else totalExpense = roundMoney(totalExpense + t.amount);
  });
  const netBalance = roundMoney(totalIncome - totalExpense);

  // Sorting
  const sortField = sortBy === 'amount' ? 'amount' : 'date';
  const sortOrder = order === 'asc' ? 1 : -1;
  list.sort((a, b) => {
    if (sortField === 'amount') return (a.amount - b.amount) * sortOrder;
    return (new Date(a.date).getTime() - new Date(b.date).getTime()) * sortOrder;
  });

  // Pagination
  const pageNum = Math.max(1, parseInt(page as string, 10) || 1);
  const pageSize = Math.max(1, Math.min(100, parseInt(limit as string, 10) || 20));
  const total = list.length;
  const totalPages = Math.ceil(total / pageSize);
  const paginated = list.slice((pageNum - 1) * pageSize, pageNum * pageSize);

  res.json({
    items: paginated,
    total,
    page: pageNum,
    pageSize,
    totalPages,
    summary: {
      income: totalIncome,
      expense: totalExpense,
      balance: netBalance,
    },
  });
});

app.post('/api/transactions', authenticateToken, (req: AuthenticatedRequest, res: Response) => {
  try {
    const { amount, kind, categoryId, description, merchant, date, paymentMethod, account, notes, tags, receiptUrl } = req.body;

    const numAmount = roundMoney(amount);
    if (numAmount <= 0 || numAmount > 99999999.99) {
      return res.status(400).json({ error: 'Enter a valid amount greater than 0.' });
    }

    if (kind !== 'expense' && kind !== 'income') {
      return res.status(400).json({ error: 'Transaction kind must be expense or income.' });
    }

    const categories = db.getCategories(req.user!.id);
    const category = categories.find((c) => c.id === categoryId);
    if (!category) {
      return res.status(400).json({ error: 'Selected category does not exist.' });
    }
    if (category.kind !== kind) {
      return res.status(400).json({ error: `Category "${category.name}" is for ${category.kind}s, not ${kind}s.` });
    }

    const txDate = date && !isNaN(Date.parse(date)) ? date : new Date().toISOString().split('T')[0];

    const validPaymentMethods: PaymentMethod[] = ['UPI', 'Cash', 'Card', 'Net Banking', 'Digital Wallet', 'Other'];
    const pMethod: PaymentMethod = validPaymentMethods.includes(paymentMethod) ? paymentMethod : 'UPI';

    const validAccounts: AccountWallet[] = ['Primary Bank', 'Pocket Cash', 'College ID / Campus Card', 'Savings', 'Digital Wallet'];
    const acc: AccountWallet = validAccounts.includes(account) ? account : 'Primary Bank';

    const created = db.createTransaction(req.user!.id, {
      amount: numAmount,
      kind,
      categoryId: category.id,
      categoryName: category.name,
      description: (description || '').trim(),
      merchant: (merchant || '').trim(),
      date: txDate,
      paymentMethod: pMethod,
      account: acc,
      notes: (notes || '').trim(),
      tags: Array.isArray(tags) ? tags.map((t) => String(t).trim()).filter(Boolean) : [],
      receiptUrl: receiptUrl || undefined,
    });

    res.status(201).json({ message: 'Transaction recorded.', transaction: created });
  } catch (err: any) {
    console.error('Create transaction error:', err);
    res.status(500).json({ error: 'Failed to record transaction.' });
  }
});

app.put('/api/transactions/:id', authenticateToken, (req: AuthenticatedRequest, res: Response) => {
  try {
    const existing = db.getTransactionById(req.user!.id, req.params.id);
    if (!existing) {
      return res.status(404).json({ error: 'Transaction not found.' });
    }

    const { amount, kind, categoryId, description, merchant, date, paymentMethod, account, notes, tags } = req.body;
    const updates: Partial<Transaction> = {};

    if (amount !== undefined) {
      const num = roundMoney(amount);
      if (num <= 0) return res.status(400).json({ error: 'Amount must be greater than zero.' });
      updates.amount = num;
    }

    if (kind !== undefined) {
      if (kind !== 'expense' && kind !== 'income') return res.status(400).json({ error: 'Invalid kind.' });
      updates.kind = kind;
    }

    if (categoryId !== undefined) {
      const categories = db.getCategories(req.user!.id);
      const cat = categories.find((c) => c.id === categoryId);
      if (!cat) return res.status(400).json({ error: 'Category not found.' });
      updates.categoryId = cat.id;
      updates.categoryName = cat.name;
    }

    if (description !== undefined) updates.description = description.trim();
    if (merchant !== undefined) updates.merchant = merchant.trim();
    if (date !== undefined && !isNaN(Date.parse(date))) updates.date = date;
    if (paymentMethod !== undefined) updates.paymentMethod = paymentMethod;
    if (account !== undefined) updates.account = account;
    if (notes !== undefined) updates.notes = notes.trim();
    if (Array.isArray(tags)) updates.tags = tags.map((t) => String(t).trim()).filter(Boolean);

    const updated = db.updateTransaction(req.user!.id, req.params.id, updates);
    res.json({ message: 'Transaction updated.', transaction: updated });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to update transaction.' });
  }
});

app.delete('/api/transactions/:id', authenticateToken, (req: AuthenticatedRequest, res: Response) => {
  const success = db.deleteTransaction(req.user!.id, req.params.id);
  if (!success) return res.status(404).json({ error: 'Transaction not found.' });
  res.json({ message: 'Transaction deleted.' });
});

app.post('/api/transactions/bulk-delete', authenticateToken, (req: AuthenticatedRequest, res: Response) => {
  const { ids } = req.body;
  if (!Array.isArray(ids) || ids.length === 0) {
    return res.status(400).json({ error: 'Please provide a non-empty array of transaction IDs.' });
  }
  const count = db.bulkDeleteTransactions(req.user!.id, ids);
  res.json({ message: `Successfully deleted ${count} transaction(s).`, count });
});

// CSV Export
app.get('/api/transactions/export-csv', authenticateToken, (req: AuthenticatedRequest, res: Response) => {
  const list = db.getTransactions(req.user!.id);
  const currency = req.user!.currency || 'INR';

  function safeCell(val: any): string {
    if (val === null || val === undefined) return '""';
    let str = String(val).replace(/"/g, '""');
    // Prevent CSV formula injection
    if (/^[=+\-@\t\r]/.test(str)) {
      str = "'" + str;
    }
    return `"${str}"`;
  }

  const headers = ['ID', 'Date', 'Type', 'Category', `Amount (${currency})`, 'Payment Method', 'Account', 'Merchant', 'Description', 'Notes', 'Tags'];
  const rows = [headers.join(',')];

  list.forEach((t) => {
    rows.push(
      [
        safeCell(t.id),
        safeCell(t.date),
        safeCell(t.kind),
        safeCell(t.categoryName),
        safeCell(t.amount.toFixed(2)),
        safeCell(t.paymentMethod),
        safeCell(t.account),
        safeCell(t.merchant),
        safeCell(t.description),
        safeCell(t.notes || ''),
        safeCell((t.tags || []).join('; ')),
      ].join(',')
    );
  });

  const csvContent = '\uFEFF' + rows.join('\r\n');
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename=student-transactions-export.csv');
  res.send(csvContent);
});

// CSV Import
app.post('/api/transactions/import-csv', authenticateToken, (req: AuthenticatedRequest, res: Response) => {
  try {
    const { rows } = req.body;
    if (!Array.isArray(rows) || rows.length === 0) {
      return res.status(400).json({ error: 'No transaction rows provided for import.' });
    }

    const existingTxs = db.getTransactions(req.user!.id);
    const existingSignatureSet = new Set(
      existingTxs.map((t) => `${t.date}_${t.kind}_${t.amount.toFixed(2)}_${t.description.trim().toLowerCase()}`)
    );

    const categories = db.getCategories(req.user!.id);
    let imported = 0;
    let skippedDuplicates = 0;
    const errors: string[] = [];

    rows.forEach((row, idx) => {
      try {
        const rawAmount = roundMoney(row.amount);
        if (rawAmount <= 0) {
          errors.push(`Row ${idx + 1}: Invalid amount "${row.amount}"`);
          return;
        }

        const kind: TransactionKind = (row.kind || row.type || 'expense').toLowerCase().includes('inc') ? 'income' : 'expense';
        const date = row.date && !isNaN(Date.parse(row.date)) ? row.date : new Date().toISOString().split('T')[0];
        const description = (row.description || row.desc || 'Imported Transaction').trim();

        // Duplicate check
        const signature = `${date}_${kind}_${rawAmount.toFixed(2)}_${description.toLowerCase()}`;
        if (existingSignatureSet.has(signature)) {
          skippedDuplicates++;
          return;
        }

        // Match category
        let cat = categories.find((c) => c.name.toLowerCase() === (row.category || '').trim().toLowerCase() && c.kind === kind);
        if (!cat) {
          cat = categories.find((c) => c.kind === kind) || categories[0];
        }

        db.createTransaction(req.user!.id, {
          amount: rawAmount,
          kind,
          categoryId: cat.id,
          categoryName: cat.name,
          description,
          merchant: (row.merchant || '').trim(),
          date,
          paymentMethod: row.paymentMethod || 'UPI',
          account: row.account || 'Primary Bank',
          notes: 'Imported via CSV',
          tags: ['imported'],
        });

        existingSignatureSet.add(signature);
        imported++;
      } catch (e: any) {
        errors.push(`Row ${idx + 1}: ${e.message}`);
      }
    });

    res.json({
      message: `Import complete: ${imported} imported, ${skippedDuplicates} duplicates skipped.`,
      imported,
      skippedDuplicates,
      errors,
    });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to process CSV import.' });
  }
});

// ----------------- BUDGETS ROUTES -----------------
app.get('/api/budgets', authenticateToken, (req: AuthenticatedRequest, res: Response) => {
  const currentMonth = req.query.month ? String(req.query.month) : new Date().toISOString().slice(0, 7);
  const budgets = db.getBudgets(req.user!.id, currentMonth);
  const transactions = db.getTransactions(req.user!.id).filter((t) => t.date.startsWith(currentMonth) && t.kind === 'expense');

  // Calculate spent per category
  const categorySpentMap: Record<string, number> = {};
  let totalSpent = 0;
  transactions.forEach((t) => {
    categorySpentMap[t.categoryId] = roundMoney((categorySpentMap[t.categoryId] || 0) + t.amount);
    totalSpent = roundMoney(totalSpent + t.amount);
  });

  const overallBudget = budgets.find((b) => b.categoryId === null);
  const overallLimit = overallBudget ? overallBudget.amount : req.user!.monthlyBudget;
  const overallRemaining = roundMoney(overallLimit - totalSpent);
  const overallUsage = overallLimit > 0 ? Math.round((totalSpent / overallLimit) * 100) : 0;

  const categoryBudgets = budgets
    .filter((b) => b.categoryId !== null)
    .map((b) => {
      const spent = categorySpentMap[b.categoryId!] || 0;
      const remaining = roundMoney(b.amount - spent);
      const usage = b.amount > 0 ? Math.round((spent / b.amount) * 100) : 0;
      return {
        ...b,
        spent,
        remaining,
        usage,
        isExceeded: spent > b.amount,
        isWarning: usage >= b.warningThreshold && spent <= b.amount,
      };
    });

  res.json({
    month: currentMonth,
    overall: {
      limit: overallLimit,
      spent: totalSpent,
      remaining: overallRemaining,
      usage: overallUsage,
      isExceeded: totalSpent > overallLimit,
      isWarning: overallUsage >= (overallBudget?.warningThreshold || 80) && totalSpent <= overallLimit,
    },
    categoryBudgets,
    allBudgets: budgets,
  });
});

app.post('/api/budgets', authenticateToken, (req: AuthenticatedRequest, res: Response) => {
  try {
    const { categoryId, period, month, amount, warningThreshold } = req.body;
    const num = roundMoney(amount);
    if (num <= 0) return res.status(400).json({ error: 'Budget amount must be greater than zero.' });

    const targetMonth = month || new Date().toISOString().slice(0, 7);

    const saved = db.setBudget(req.user!.id, {
      categoryId: categoryId || null,
      period: period || 'monthly',
      month: targetMonth,
      amount: num,
      warningThreshold: warningThreshold ? parseInt(warningThreshold, 10) : 80,
    });

    res.json({ message: 'Budget saved.', budget: saved });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to save budget.' });
  }
});

app.delete('/api/budgets/:id', authenticateToken, (req: AuthenticatedRequest, res: Response) => {
  const success = db.deleteBudget(req.user!.id, req.params.id);
  if (!success) return res.status(404).json({ error: 'Budget not found.' });
  res.json({ message: 'Budget removed.' });
});

// ----------------- SAVINGS GOALS -----------------
app.get('/api/goals', authenticateToken, (req: AuthenticatedRequest, res: Response) => {
  const goals = db.getSavingsGoals(req.user!.id);
  res.json({ goals });
});

app.post('/api/goals', authenticateToken, (req: AuthenticatedRequest, res: Response) => {
  try {
    const { title, targetAmount, currentAmount, targetDate, category, icon } = req.body;
    if (!title || typeof title !== 'string' || !title.trim()) {
      return res.status(400).json({ error: 'Goal title is required.' });
    }
    const target = roundMoney(targetAmount);
    if (target <= 0) return res.status(400).json({ error: 'Target amount must be greater than zero.' });

    const goal = db.createSavingsGoal(req.user!.id, {
      title: title.trim(),
      targetAmount: target,
      currentAmount: currentAmount ? roundMoney(currentAmount) : 0,
      targetDate: targetDate || new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      category: category || 'Personal',
      icon: icon || 'Target',
      status: currentAmount >= target ? 'completed' : 'in_progress',
    });

    res.status(201).json({ goal });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to create savings goal.' });
  }
});

app.post('/api/goals/:id/deposit', authenticateToken, (req: AuthenticatedRequest, res: Response) => {
  try {
    const { amount, recordTransaction } = req.body;
    const addAmt = roundMoney(amount);
    if (addAmt <= 0) return res.status(400).json({ error: 'Deposit amount must be positive.' });

    const goals = db.getSavingsGoals(req.user!.id);
    const goal = goals.find((g) => g.id === req.params.id);
    if (!goal) return res.status(404).json({ error: 'Goal not found.' });

    const newCurrent = roundMoney(goal.currentAmount + addAmt);
    const updated = db.updateSavingsGoal(req.user!.id, goal.id, {
      currentAmount: newCurrent,
      status: newCurrent >= goal.targetAmount ? 'completed' : 'in_progress',
    });

    // Optionally record an expense towards savings
    if (recordTransaction) {
      db.createTransaction(req.user!.id, {
        amount: addAmt,
        kind: 'expense',
        categoryId: 'cat-other-exp',
        categoryName: 'Savings Goal Deposit',
        description: `Deposit to goal: ${goal.title}`,
        merchant: 'Savings Reserve',
        date: new Date().toISOString().split('T')[0],
        paymentMethod: 'UPI',
        account: 'Savings',
        notes: `Goal progress: ${newCurrent}/${goal.targetAmount}`,
      });
    }

    res.json({ message: 'Funds deposited to goal.', goal: updated });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to deposit to goal.' });
  }
});

app.delete('/api/goals/:id', authenticateToken, (req: AuthenticatedRequest, res: Response) => {
  db.deleteSavingsGoal(req.user!.id, req.params.id);
  res.json({ message: 'Goal deleted.' });
});

// ----------------- RECURRING PAYMENTS -----------------
app.get('/api/recurring', authenticateToken, (req: AuthenticatedRequest, res: Response) => {
  const recurring = db.getRecurring(req.user!.id);
  res.json({ recurring });
});

app.post('/api/recurring', authenticateToken, (req: AuthenticatedRequest, res: Response) => {
  try {
    const { title, amount, kind, categoryId, frequency, nextDueDate, paymentMethod, notes, autoLog } = req.body;
    if (!title || !amount || roundMoney(amount) <= 0) {
      return res.status(400).json({ error: 'Title and positive amount are required.' });
    }

    const rec = db.createRecurring(req.user!.id, {
      title: title.trim(),
      amount: roundMoney(amount),
      kind: kind === 'income' ? 'income' : 'expense',
      categoryId: categoryId || 'cat-bills',
      frequency: frequency || 'monthly',
      nextDueDate: nextDueDate || new Date().toISOString().split('T')[0],
      paymentMethod: paymentMethod || 'UPI',
      status: 'active',
      autoLog: !!autoLog,
      notes: (notes || '').trim(),
    });

    res.status(201).json({ recurring: rec });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to create recurring subscription.' });
  }
});

app.post('/api/recurring/:id/log-transaction', authenticateToken, (req: AuthenticatedRequest, res: Response) => {
  try {
    const recs = db.getRecurring(req.user!.id);
    const rec = recs.find((r) => r.id === req.params.id);
    if (!rec) return res.status(404).json({ error: 'Recurring schedule not found.' });

    const categories = db.getCategories(req.user!.id);
    const cat = categories.find((c) => c.id === rec.categoryId) || categories[0];

    // Log transaction
    const tx = db.createTransaction(req.user!.id, {
      amount: rec.amount,
      kind: rec.kind,
      categoryId: cat.id,
      categoryName: cat.name,
      description: `Recurring: ${rec.title}`,
      merchant: rec.title,
      date: rec.nextDueDate || new Date().toISOString().split('T')[0],
      paymentMethod: rec.paymentMethod,
      account: 'Primary Bank',
      recurringId: rec.id,
      notes: rec.notes,
    });

    // Advance nextDueDate
    const curDate = new Date(rec.nextDueDate);
    if (rec.frequency === 'monthly') {
      curDate.setMonth(curDate.getMonth() + 1);
    } else if (rec.frequency === 'weekly') {
      curDate.setDate(curDate.getDate() + 7);
    } else if (rec.frequency === 'semester') {
      curDate.setMonth(curDate.getMonth() + 4);
    } else if (rec.frequency === 'yearly') {
      curDate.setFullYear(curDate.getFullYear() + 1);
    } else {
      curDate.setDate(curDate.getDate() + 1);
    }
    const nextDateStr = curDate.toISOString().split('T')[0];
    db.updateRecurring(req.user!.id, rec.id, { nextDueDate: nextDateStr });

    res.json({ message: 'Transaction recorded and recurring date advanced.', transaction: tx, nextDueDate: nextDateStr });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to record recurring transaction.' });
  }
});

app.delete('/api/recurring/:id', authenticateToken, (req: AuthenticatedRequest, res: Response) => {
  db.deleteRecurring(req.user!.id, req.params.id);
  res.json({ message: 'Recurring schedule removed.' });
});

// ----------------- SPLIT EXPENSES & DEBTS -----------------
app.get('/api/splits', authenticateToken, (req: AuthenticatedRequest, res: Response) => {
  const splits = db.getSplits(req.user!.id);
  res.json({ splits });
});

app.post('/api/splits', authenticateToken, (req: AuthenticatedRequest, res: Response) => {
  try {
    const { title, totalAmount, userShare, paidBy, participants, date } = req.body;
    if (!title || roundMoney(totalAmount) <= 0) {
      return res.status(400).json({ error: 'Title and valid total amount required.' });
    }

    const split = db.createSplit(req.user!.id, {
      title: title.trim(),
      totalAmount: roundMoney(totalAmount),
      userShare: roundMoney(userShare || totalAmount / ((participants?.length || 1) + 1)),
      date: date || new Date().toISOString().split('T')[0],
      paidBy: paidBy || 'You',
      status: 'pending',
      participants: Array.isArray(participants) ? participants : [],
    });

    res.status(201).json({ split });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to create split expense.' });
  }
});

app.put('/api/splits/:id', authenticateToken, (req: AuthenticatedRequest, res: Response) => {
  const updated = db.updateSplit(req.user!.id, req.params.id, req.body);
  if (!updated) return res.status(404).json({ error: 'Split not found.' });
  res.json({ split: updated });
});

app.delete('/api/splits/:id', authenticateToken, (req: AuthenticatedRequest, res: Response) => {
  db.deleteSplit(req.user!.id, req.params.id);
  res.json({ message: 'Split deleted.' });
});

app.get('/api/debts', authenticateToken, (req: AuthenticatedRequest, res: Response) => {
  const debts = db.getDebts(req.user!.id);
  res.json({ debts });
});

app.post('/api/debts', authenticateToken, (req: AuthenticatedRequest, res: Response) => {
  try {
    const { personName, type, amount, description, dueDate } = req.body;
    if (!personName || roundMoney(amount) <= 0) {
      return res.status(400).json({ error: 'Person name and positive amount are required.' });
    }

    const debt = db.createDebt(req.user!.id, {
      personName: personName.trim(),
      type: type === 'you_owe' ? 'you_owe' : 'owes_you',
      amount: roundMoney(amount),
      description: (description || '').trim(),
      dueDate: dueDate || new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      status: 'pending',
    });

    res.status(201).json({ debt });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to create debt record.' });
  }
});

app.put('/api/debts/:id', authenticateToken, (req: AuthenticatedRequest, res: Response) => {
  const updated = db.updateDebt(req.user!.id, req.params.id, req.body);
  if (!updated) return res.status(404).json({ error: 'Debt record not found.' });
  res.json({ debt: updated });
});

app.delete('/api/debts/:id', authenticateToken, (req: AuthenticatedRequest, res: Response) => {
  db.deleteDebt(req.user!.id, req.params.id);
  res.json({ message: 'Debt record deleted.' });
});

// ----------------- ANALYTICS & INSIGHTS -----------------
app.get('/api/analytics', authenticateToken, (req: AuthenticatedRequest, res: Response) => {
  const user = req.user!;
  const transactions = db.getTransactions(user.id);
  const budgets = db.getBudgets(user.id);
  const categories = db.getCategories(user.id);

  const now = new Date();
  const currentMonthStr = `${now.getFullYear()}-${(now.getMonth() + 1).toString().padStart(2, '0')}`;

  // Current month totals
  const currentMonthTxs = transactions.filter((t) => t.date.startsWith(currentMonthStr));
  let curIncome = 0;
  let curExpense = 0;
  let essentialExpense = 0;
  let discretionaryExpense = 0;
  const categoryMap: Record<string, { name: string; amount: number; color: string; kind: string; isEssential: boolean }> = {};

  currentMonthTxs.forEach((t) => {
    if (t.kind === 'income') {
      curIncome = roundMoney(curIncome + t.amount);
    } else {
      curExpense = roundMoney(curExpense + t.amount);
      const cat = categories.find((c) => c.id === t.categoryId);
      const isEss = cat ? cat.isEssential : true;
      if (isEss) essentialExpense = roundMoney(essentialExpense + t.amount);
      else discretionaryExpense = roundMoney(discretionaryExpense + t.amount);

      if (!categoryMap[t.categoryId]) {
        categoryMap[t.categoryId] = {
          name: t.categoryName,
          amount: 0,
          color: cat?.color || '#10b981',
          kind: t.kind,
          isEssential: isEss,
        };
      }
      categoryMap[t.categoryId].amount = roundMoney(categoryMap[t.categoryId].amount + t.amount);
    }
  });

  const categoryBreakdown = Object.values(categoryMap).sort((a, b) => b.amount - a.amount);

  // 6-Month Trend
  const monthlyTrends: { month: string; label: string; income: number; expense: number; savings: number }[] = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const mStr = `${d.getFullYear()}-${(d.getMonth() + 1).toString().padStart(2, '0')}`;
    const mLabel = d.toLocaleString('default', { month: 'short' });
    const mTxs = transactions.filter((t) => t.date.startsWith(mStr));

    let inc = 0;
    let exp = 0;
    mTxs.forEach((t) => {
      if (t.kind === 'income') inc = roundMoney(inc + t.amount);
      else exp = roundMoney(exp + t.amount);
    });

    monthlyTrends.push({
      month: mStr,
      label: mLabel,
      income: inc,
      expense: exp,
      savings: roundMoney(inc - exp),
    });
  }

  // Student Daily Spending Velocity
  const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const dayOfMonth = now.getDate();
  const daysLeft = Math.max(1, lastDay - dayOfMonth + 1);
  const overallBudget = budgets.find((b) => b.month === currentMonthStr && b.categoryId === null)?.amount || user.monthlyBudget;
  const remainingBudget = roundMoney(overallBudget - curExpense);
  const safeDailySpend = remainingBudget > 0 ? roundMoney(remainingBudget / daysLeft) : 0;
  const avgDailySpendSoFar = dayOfMonth > 0 ? roundMoney(curExpense / dayOfMonth) : 0;

  // Student Financial Health Score (0-100)
  let healthScore = 70; // baseline
  // 1. Budget adherence (+/- 15)
  if (curExpense <= overallBudget * 0.8) healthScore += 15;
  else if (curExpense <= overallBudget) healthScore += 5;
  else healthScore -= 20;

  // 2. Savings rate (+/- 15)
  const savingsRate = curIncome > 0 ? (curIncome - curExpense) / curIncome : 0;
  if (savingsRate >= 0.2) healthScore += 15;
  else if (savingsRate >= 0.1) healthScore += 8;
  else if (savingsRate < 0) healthScore -= 15;

  healthScore = Math.max(10, Math.min(100, healthScore));

  res.json({
    currentMonth: {
      income: curIncome,
      expense: curExpense,
      savings: roundMoney(curIncome - curExpense),
      budget: overallBudget,
      remainingBudget,
      essentialExpense,
      discretionaryExpense,
      daysLeftInMonth: daysLeft,
      safeDailySpend,
      avgDailySpendSoFar,
      healthScore,
    },
    categoryBreakdown,
    monthlyTrends,
  });
});

app.get('/api/insights', authenticateToken, (req: AuthenticatedRequest, res: Response) => {
  const user = req.user!;
  const transactions = db.getTransactions(user.id);
  const budgets = db.getBudgets(user.id);
  const goals = db.getSavingsGoals(user.id);

  const context = computeUserFinancialContext(user, transactions, budgets, goals);
  const insights: { type: 'alert' | 'success' | 'tip' | 'info'; title: string; message: string }[] = [];

  // Safe daily rate insight
  insights.push({
    type: context.budgetRemaining > 0 ? 'info' : 'alert',
    title: 'Daily Safe-to-Spend Limit',
    message: context.budgetRemaining > 0
      ? `You have ${context.daysRemainingInMonth} days left this month. You can safely spend up to ${context.currency}${context.safeDailySpend.toLocaleString()}/day without exceeding your ${context.currency}${context.monthlyBudget.toLocaleString()} budget.`
      : `You've exceeded your monthly budget by ${context.currency}${Math.abs(context.budgetRemaining).toLocaleString()}. Freeze discretionary spending for the remaining ${context.daysRemainingInMonth} days.`,
  });

  // Top category spike
  if (context.topCategories.length > 0) {
    const top = context.topCategories[0];
    insights.push({
      type: top.percentage > 40 ? 'alert' : 'tip',
      title: `Highest Outflow: ${top.name}`,
      message: `${top.name} represents ${top.percentage}% of your expenses this month (${context.currency}${top.amount.toLocaleString()}). Look out for potential canteen or subscription savings here.`,
    });
  }

  // Savings rate
  if (context.totalIncome > 0) {
    const rate = Math.round((context.netSavings / context.totalIncome) * 100);
    if (rate > 15) {
      insights.push({
        type: 'success',
        title: 'Strong Student Savings Rate',
        message: `Great discipline! You are saving ${rate}% (${context.currency}${context.netSavings.toLocaleString()}) of your total income/allowance this month.`,
      });
    } else if (rate < 0) {
      insights.push({
        type: 'alert',
        title: 'Deficit Warning',
        message: `Your expenses exceed your income this month by ${context.currency}${Math.abs(context.netSavings).toLocaleString()}. Check your upcoming debts or withdraw from emergency reserves.`,
      });
    }
  }

  res.json({ insights, context });
});

// AI Financial Assistant Endpoint
app.post('/api/ai/ask', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { question } = req.body;
    if (!question || typeof question !== 'string' || !question.trim()) {
      return res.status(400).json({ error: 'Question is required.' });
    }

    const user = req.user!;
    const transactions = db.getTransactions(user.id);
    const budgets = db.getBudgets(user.id);
    const goals = db.getSavingsGoals(user.id);

    const context = computeUserFinancialContext(user, transactions, budgets, goals);
    const result = await askFinancialAssistant(question.trim(), context);

    res.json(result);
  } catch (err: any) {
    console.error('AI assistant error:', err);
    res.status(500).json({ error: 'Failed to process financial query.' });
  }
});

// ----------------- VITE SPA & STATIC SERVING -----------------
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (req, res) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[SERVER] Smart Student Expense Tracker running at http://localhost:${PORT}`);
  });
}

startServer();
