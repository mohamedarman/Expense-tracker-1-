/**
 * Automated Test Suite for Smart Student Expense Tracker
 * Runs with Node.js built-in test runner: `tsx --test tests/api.test.ts`
 */

import { test, describe } from 'node:test';
import assert from 'node:assert';
import { hashPassword, verifyPassword, generateToken, verifyToken } from '../server/auth.ts';
import { db, roundMoney } from '../server/db.ts';
import { computeUserFinancialContext, getDeterministicAnswer } from '../server/ai.ts';
import { User, Transaction, Budget, SavingsGoal } from '../server/types.ts';

describe('1. Cryptography and Authentication Security', () => {
  test('hashes password with random salt and verifies correctly', () => {
    const password = 'StudentSecurePassword2026!';
    const { hash, salt } = hashPassword(password);

    assert.ok(hash && hash.length > 32, 'Hash must be generated');
    assert.ok(salt && salt.length === 32, 'Salt must be 32 hex chars');

    const isValid = verifyPassword(password, hash, salt);
    assert.strictEqual(isValid, true, 'Correct password must verify');

    const isWrongValid = verifyPassword('WrongPassword123', hash, salt);
    assert.strictEqual(isWrongValid, false, 'Wrong password must be rejected');
  });

  test('generates and verifies signed session tokens', () => {
    const dummyUser: User = {
      id: 'test-user-token-01',
      name: 'Rohan Test',
      email: 'rohan@test.edu',
      passwordHash: 'dummy',
      salt: 'dummy',
      currency: '₹',
      theme: 'dark',
      monthlyBudget: 15000,
      semesterBudget: 60000,
      semesterEndDate: '2026-12-15',
      createdAt: new Date().toISOString(),
    };

    const token = generateToken(dummyUser);
    assert.ok(token.includes('.'), 'Token must contain signature separation');

    const verified = verifyToken(token);
    assert.ok(verified !== null, 'Token must verify successfully');
    assert.strictEqual(verified?.userId, dummyUser.id);
    assert.strictEqual(verified?.email, dummyUser.email);

    // Tampered token must fail
    const tampered = token + 'tampered';
    assert.strictEqual(verifyToken(tampered), null, 'Tampered token must fail verification');
  });
});

describe('2. Decimal Precision and Monetary Calculations', () => {
  test('rounds floating point accurately to 2 decimal places', () => {
    assert.strictEqual(roundMoney(0.1 + 0.2), 0.3);
    assert.strictEqual(roundMoney(149.999), 150);
    assert.strictEqual(roundMoney(-5.004), -5);
    assert.strictEqual(roundMoney('NaN'), 0);
  });

  test('calculates safe daily spending velocity accurately', () => {
    const remainingBudget = 6000;
    const daysRemaining = 20;
    const dailyVelocity = roundMoney(remainingBudget / daysRemaining);
    assert.strictEqual(dailyVelocity, 300);
  });
});

describe('3. Database User Isolation and CRUD', () => {
  const userA: User = {
    id: 'test-isolation-user-A',
    name: 'Student A',
    email: 'userA@college.edu',
    passwordHash: 'dummy',
    salt: 'dummy',
    currency: '₹',
    theme: 'dark',
    monthlyBudget: 12000,
    semesterBudget: 48000,
    semesterEndDate: '2026-12-15',
    createdAt: new Date().toISOString(),
  };

  const userB: User = {
    id: 'test-isolation-user-B',
    name: 'Student B',
    email: 'userB@college.edu',
    passwordHash: 'dummy',
    salt: 'dummy',
    currency: '₹',
    theme: 'dark',
    monthlyBudget: 10000,
    semesterBudget: 40000,
    semesterEndDate: '2026-12-15',
    createdAt: new Date().toISOString(),
  };

  test('creates transaction and guarantees user isolation', () => {
    const txA = db.createTransaction(userA.id, {
      amount: 450,
      kind: 'expense',
      categoryId: 'cat-food',
      categoryName: 'Food & Mess',
      description: 'Hostel canteen snack',
      merchant: 'Canteen',
      date: '2026-10-15',
      paymentMethod: 'UPI',
      account: 'Primary Bank',
      tags: ['food'],
    });

    assert.ok(txA.id.startsWith('tx-'), 'Transaction ID must be prefixed');
    assert.strictEqual(txA.amount, 450);

    // User A can access
    const foundA = db.getTransactionById(userA.id, txA.id);
    assert.ok(foundA !== undefined, 'User A should find own transaction');

    // User B CANNOT access User A's transaction
    const foundB = db.getTransactionById(userB.id, txA.id);
    assert.strictEqual(foundB, undefined, 'User B must not access User A transaction');

    // User B cannot delete User A's transaction
    const deleteAttempt = db.deleteTransaction(userB.id, txA.id);
    assert.strictEqual(deleteAttempt, false, 'User B must not be able to delete User A record');

    // Cleanup
    db.deleteTransaction(userA.id, txA.id);
  });
});

describe('4. Financial Context & Deterministic Assistant', () => {
  test('derives verifiable financial context without hallucination', () => {
    const user: User = {
      id: 'student-summary-test',
      name: 'Summary Student',
      email: 'summary@student.edu',
      passwordHash: 'x',
      salt: 'x',
      currency: '₹',
      theme: 'dark',
      monthlyBudget: 10000,
      semesterBudget: 40000,
      semesterEndDate: '2026-12-15',
      createdAt: new Date().toISOString(),
    };

    const now = new Date();
    const curMonthStr = `${now.getFullYear()}-${(now.getMonth() + 1).toString().padStart(2, '0')}`;

    const transactions: Transaction[] = [
      {
        id: 'tx-1',
        userId: user.id,
        amount: 8000,
        kind: 'income',
        categoryId: 'cat-allowance',
        categoryName: 'Allowance / Pocket Money',
        description: 'Monthly pocket money',
        merchant: 'Parents',
        date: `${curMonthStr}-01`,
        paymentMethod: 'Net Banking',
        account: 'Primary Bank',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      {
        id: 'tx-2',
        userId: user.id,
        amount: 3200,
        kind: 'expense',
        categoryId: 'cat-food',
        categoryName: 'Food & Mess',
        description: 'Mess card',
        merchant: 'Mess',
        date: `${curMonthStr}-03`,
        paymentMethod: 'UPI',
        account: 'Primary Bank',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      {
        id: 'tx-3',
        userId: user.id,
        amount: 800,
        kind: 'expense',
        categoryId: 'cat-books',
        categoryName: 'Books & Academics',
        description: 'Math notebook',
        merchant: 'Stationery',
        date: `${curMonthStr}-05`,
        paymentMethod: 'UPI',
        account: 'Primary Bank',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ];

    const budgets: Budget[] = [
      {
        id: 'b-1',
        userId: user.id,
        categoryId: null,
        period: 'monthly',
        month: curMonthStr,
        amount: 10000,
        warningThreshold: 80,
      },
    ];

    const goals: SavingsGoal[] = [
      {
        id: 'g-1',
        userId: user.id,
        title: 'Semester Laptop',
        targetAmount: 50000,
        currentAmount: 25000,
        targetDate: '2026-12-31',
        category: 'Tech',
        icon: 'Laptop',
        status: 'in_progress',
        createdAt: new Date().toISOString(),
      },
    ];

    const context = computeUserFinancialContext(user, transactions, budgets, goals);

    assert.strictEqual(context.totalIncome, 8000);
    assert.strictEqual(context.totalExpense, 4000);
    assert.strictEqual(context.netSavings, 4000);
    assert.strictEqual(context.budgetSpent, 4000);
    assert.strictEqual(context.budgetRemaining, 6000);
    assert.strictEqual(context.budgetPercentage, 40);
    assert.strictEqual(context.topCategories[0].name, 'Food & Mess');

    // Test deterministic answer engine
    const answerDaily = getDeterministicAnswer('What is my safe daily spending limit?', context);
    assert.ok(answerDaily.includes('safe daily spending limit'));
    assert.ok(answerDaily.includes('₹6,000'));

    const answerCategory = getDeterministicAnswer('Which category is highest?', context);
    assert.ok(answerCategory.includes('Food & Mess'));
    assert.ok(answerCategory.includes('₹3,200'));
  });
});

describe('5. Multi-User End-to-End Account Isolation & Zero Leakage', () => {
  test('guarantees complete data isolation between two independent accounts in ClientStore', async () => {
    const { ClientStore } = await import('../src/clientStore.ts');
    const store = new ClientStore();

    // 1. Account A registers
    const regA = store.register({
      name: 'Alice Student',
      email: 'alice@college.edu',
      password: 'AlicePassword123!',
      monthlyBudget: 15000,
    });
    assert.ok(regA.user.id, 'User A should receive ID');
    assert.strictEqual(store.getCurrentUserId(), regA.user.id);

    // Account A creates private financial records
    const txA1 = store.createTransaction({
      kind: 'income',
      amount: 12000,
      categoryId: 'cat-allowance',
      categoryName: 'Allowance / Pocket Money',
      description: 'Monthly Allowance',
      date: '2026-10-01',
    });
    const txA2 = store.createTransaction({
      kind: 'expense',
      amount: 3500,
      categoryId: 'cat-hostel',
      categoryName: 'Hostel & Rent',
      description: 'Hostel Rent Share',
      date: '2026-10-02',
    });
    const bdgA = store.setBudget({
      categoryId: 'cat-hostel',
      amount: 4000,
      month: '2026-10',
    });
    const goalA = store.createGoal({
      title: 'Private Coding Laptop',
      targetAmount: 60000,
      currentAmount: 15000,
    });
    const debtA = store.createDebt({
      personName: 'Rohan Sharma',
      amount: 500,
      type: 'owes_you',
      description: 'Private lunch split',
    });

    // Verify User A data is present
    const dataA = store.getTransactions();
    assert.strictEqual(dataA.total, 2);
    assert.strictEqual(dataA.summary.income, 12000);
    assert.strictEqual(dataA.summary.expense, 3500);
    assert.strictEqual(dataA.summary.balance, 8500);

    // 2. Account A logs out
    store.setCurrentUserId(null);
    assert.strictEqual(store.getCurrentUser(), null);

    // 3. Account B registers
    const regB = store.register({
      name: 'Bob Roommate',
      email: 'bob@college.edu',
      password: 'BobPassword123!',
      monthlyBudget: 10000,
    });
    assert.ok(regB.user.id !== regA.user.id, 'User B must have distinct ID');
    assert.strictEqual(store.getCurrentUserId(), regB.user.id);

    // 4. CRITICAL: Account B MUST see ZERO records from Account A
    const dataB = store.getTransactions();
    assert.strictEqual(dataB.total, 0, 'Account B must have 0 transactions');
    assert.strictEqual(dataB.items.length, 0);
    assert.strictEqual(dataB.summary.income, 0, 'Account B income must be 0');
    assert.strictEqual(dataB.summary.expense, 0, 'Account B expense must be 0');
    assert.strictEqual(dataB.summary.balance, 0, 'Account B balance must be 0');

    const budgetsB = store.getBudgets('2026-10');
    assert.strictEqual(budgetsB.categoryBudgets.length, 0, 'Account B must have 0 category budgets');
    assert.strictEqual(budgetsB.overall.spent, 0, 'Account B spent must be 0');

    const goalsB = store.getGoals();
    assert.strictEqual(goalsB.length, 0, 'Account B must have 0 savings goals');

    const debtsB = store.getDebts();
    assert.strictEqual(debtsB.length, 0, 'Account B must have 0 debts');

    const analyticsB = store.getAnalytics();
    assert.strictEqual(analyticsB.currentMonth.income, 0, 'Account B analytics income must be 0');
    assert.strictEqual(analyticsB.currentMonth.expense, 0, 'Account B analytics expense must be 0');
    assert.strictEqual(analyticsB.categoryBreakdown.length, 0, 'Account B category breakdown must be empty');

    // 5. Account B cannot read, update, or delete Account A's records
    assert.throws(() => {
      store.updateTransaction(txA2.id, { amount: 1 });
    }, /Transaction not found or access denied/);

    assert.throws(() => {
      store.deleteTransaction(txA2.id);
    }, /Transaction not found or unauthorized/);

    assert.throws(() => {
      store.depositGoal(goalA.id, 500, false);
    }, /Savings goal not found or unauthorized/);

    // 6. Account B logs out and Account A signs back in
    store.setCurrentUserId(null);
    const loginA = store.login('alice@college.edu', 'AlicePassword123!');
    assert.strictEqual(loginA.user.id, regA.user.id);

    // Account A's data remains 100% intact
    const restoredA = store.getTransactions();
    assert.strictEqual(restoredA.total, 2);
    assert.strictEqual(restoredA.summary.expense, 3500);
    assert.strictEqual(store.getGoals().length, 1);
    assert.strictEqual(store.getDebts().length, 1);
  });

  test('guarantees complete server-side database isolation between independent accounts in db engine', () => {
    const user1: User = {
      id: 'srv-user-isolation-1',
      name: 'Server User One',
      email: 'srv1@college.edu',
      passwordHash: 'dummy1',
      salt: 'salt1',
      currency: '₹',
      theme: 'dark',
      monthlyBudget: 15000,
      semesterBudget: 60000,
      semesterEndDate: '2026-12-15',
      createdAt: new Date().toISOString(),
    };

    const user2: User = {
      id: 'srv-user-isolation-2',
      name: 'Server User Two',
      email: 'srv2@college.edu',
      passwordHash: 'dummy2',
      salt: 'salt2',
      currency: '₹',
      theme: 'dark',
      monthlyBudget: 10000,
      semesterBudget: 40000,
      semesterEndDate: '2026-12-15',
      createdAt: new Date().toISOString(),
    };

    db.createUser(user1);
    db.createUser(user2);

    const tx1 = db.createTransaction(user1.id, {
      amount: 1500,
      kind: 'expense',
      categoryId: 'cat-food',
      categoryName: 'Food & Mess',
      description: 'Hostel Mess Bill',
      merchant: 'Hostel Mess',
      date: '2026-10-10',
      paymentMethod: 'UPI',
      account: 'Primary Bank',
    });

    const b1 = db.setBudget(user1.id, {
      categoryId: 'cat-food',
      amount: 5000,
      period: 'monthly',
      month: '2026-10',
      warningThreshold: 80,
    });

    const g1 = db.createSavingsGoal(user1.id, {
      title: 'Emergency Medical Vault',
      targetAmount: 10000,
      currentAmount: 2000,
      targetDate: '2026-12-31',
      category: 'Emergency',
      icon: 'Shield',
      status: 'in_progress',
    });

    const d1 = db.createDebt(user1.id, {
      personName: 'Rohan',
      type: 'owes_you',
      amount: 400,
      description: 'Lunch bill',
      dueDate: '2026-10-25',
      status: 'pending',
    });

    // User 2 queries must return EMPTY arrays
    assert.strictEqual(db.getTransactions(user2.id).length, 0, 'User 2 must see 0 transactions');
    assert.strictEqual(db.getBudgets(user2.id).length, 0, 'User 2 must see 0 budgets');
    assert.strictEqual(db.getSavingsGoals(user2.id).length, 0, 'User 2 must see 0 goals');
    assert.strictEqual(db.getDebts(user2.id).length, 0, 'User 2 must see 0 debts');

    // User 2 cannot access or mutate User 1 records
    assert.strictEqual(db.getTransactionById(user2.id, tx1.id), undefined);
    assert.strictEqual(db.updateTransaction(user2.id, tx1.id, { amount: 5 }), null);
    assert.strictEqual(db.deleteTransaction(user2.id, tx1.id), false);
    assert.strictEqual(db.deleteBudget(user2.id, b1.id), false);
    assert.strictEqual(db.deleteSavingsGoal(user2.id, g1.id), false);
    assert.strictEqual(db.deleteDebt(user2.id, d1.id), false);

    // Cleanup
    db.deleteUser(user1.id);
    db.deleteUser(user2.id);
  });
});
