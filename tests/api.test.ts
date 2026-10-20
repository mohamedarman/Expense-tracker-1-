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
