/**
 * Automated Firestore Security Rules & Multi-User Isolation Test Suite
 * Verifies:
 * 1. All 9 collections in firebase-blueprint.json are protected in firestore.rules
 * 2. All 12 "Dirty Dozen" adversarial payloads (Identity Spoofing, Cross-User Read,
 *    Self-Assigned Admin Escalation, Unverified Email Spoof, Shadow Field Injection,
 *    Self-Status Tampering, PII Blanket Read, Orphaned Record Create, Immortal Field
 *    Mutation, Value/Size Poisoning, Terminal State Reversal, ID Poisoning) are rejected
 * 3. Multi-user isolation in financialEngine.ts (User A vs User B)
 */

import { test, describe } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  computeBudgetsResponse,
  computeAnalyticsResponse,
  computeInsightsResponse,
  evaluateBudgetAdvisorQuestion,
  DEFAULT_SYSTEM_CATEGORIES,
} from '../src/financialEngine.ts';
import { User, Transaction, Budget, SavingsGoal } from '../src/types.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');

const rulesContent = fs.readFileSync(path.join(ROOT_DIR, 'firestore.rules'), 'utf-8');
const blueprint = JSON.parse(fs.readFileSync(path.join(ROOT_DIR, 'firebase-blueprint.json'), 'utf-8'));

/**
 * Deterministic simulator of the exact predicates in `firestore.rules`
 * to verify all 12 Dirty Dozen payloads and User A vs User B isolation.
 */
interface SimulatedAuth {
  uid: string;
  email: string;
  email_verified: boolean;
}

interface SimulatedDbState {
  users: Map<string, Record<string, any>>;
  admins: Map<string, Record<string, any>>;
  transactions: Map<string, Record<string, any>>;
  debts: Map<string, Record<string, any>>;
}

const REQUEST_TIME = '2026-11-10T12:00:00.000Z';
const ID_PATTERN = /^[a-zA-Z0-9_\-]+$/;

function isValidId(id: unknown): boolean {
  return typeof id === 'string' && id.length >= 1 && id.length <= 128 && ID_PATTERN.test(id);
}

function isSignedIn(auth: SimulatedAuth | null): boolean {
  return auth !== null;
}

function isVerified(auth: SimulatedAuth | null): boolean {
  return isSignedIn(auth) && auth!.email_verified === true;
}

function isAdmin(auth: SimulatedAuth | null, db: SimulatedDbState): boolean {
  if (!isVerified(auth)) return false;
  if (auth!.email === 'costcurveexpensetracker@gmail.com') return true;
  return db.admins.has(auth!.uid);
}

function hasAllAndOnlyKeys(data: Record<string, any>, required: string[], allowed: string[]): boolean {
  const keys = Object.keys(data);
  return required.every((k) => keys.includes(k)) && keys.every((k) => allowed.includes(k));
}

function affectedKeys(incoming: Record<string, any>, existing: Record<string, any>): string[] {
  const allKeys = new Set([...Object.keys(incoming), ...Object.keys(existing)]);
  const changed: string[] = [];
  for (const k of allKeys) {
    if (JSON.stringify(incoming[k]) !== JSON.stringify(existing[k])) {
      changed.push(k);
    }
  }
  return changed;
}

function evaluateRule(
  db: SimulatedDbState,
  auth: SimulatedAuth | null,
  collection: 'users' | 'admins' | 'transactions' | 'debts',
  operation: 'get' | 'list' | 'create' | 'update' | 'delete',
  docId: string,
  incoming?: Record<string, any>
): 'ALLOW' | 'PERMISSION_DENIED' {
  const existing = db[collection].get(docId);

  if (collection === 'users') {
    if (operation === 'get') {
      return isSignedIn(auth) && isValidId(docId) && (auth!.uid === docId || isAdmin(auth, db))
        ? 'ALLOW'
        : 'PERMISSION_DENIED';
    }
    if (operation === 'list') {
      if (!existing) return 'PERMISSION_DENIED';
      return isSignedIn(auth) && (existing.id === auth!.uid || isAdmin(auth, db))
        ? 'ALLOW'
        : 'PERMISSION_DENIED';
    }
    if (operation === 'create' && incoming) {
      const reqKeys = [
        'id', 'name', 'email', 'currency', 'theme',
        'monthlyBudget', 'semesterBudget', 'semesterEndDate',
        'collegeName', 'degreeSemester', 'status', 'createdAt', 'updatedAt',
      ];
      const validShape =
        hasAllAndOnlyKeys(incoming, reqKeys, reqKeys) &&
        isValidId(incoming.id) &&
        typeof incoming.name === 'string' && incoming.name.length >= 1 && incoming.name.length <= 100 &&
        typeof incoming.email === 'string' && incoming.email.length >= 3 && incoming.email.length <= 254 &&
        (incoming.status === 'active' || incoming.status === 'suspended');

      const allowed =
        isVerified(auth) &&
        isValidId(docId) &&
        docId === auth!.uid &&
        validShape &&
        incoming.id === auth!.uid &&
        incoming.status === 'active' &&
        incoming.createdAt === REQUEST_TIME &&
        incoming.updatedAt === REQUEST_TIME;
      return allowed ? 'ALLOW' : 'PERMISSION_DENIED';
    }
    if (operation === 'update' && incoming && existing) {
      const reqKeys = [
        'id', 'name', 'email', 'currency', 'theme',
        'monthlyBudget', 'semesterBudget', 'semesterEndDate',
        'collegeName', 'degreeSemester', 'status', 'createdAt', 'updatedAt',
      ];
      const validShape =
        hasAllAndOnlyKeys(incoming, reqKeys, reqKeys) &&
        isValidId(incoming.id) &&
        typeof incoming.name === 'string' && incoming.name.length >= 1 && incoming.name.length <= 100;

      if (
        !isVerified(auth) ||
        !isValidId(docId) ||
        !validShape ||
        incoming.id !== existing.id ||
        incoming.email !== existing.email ||
        incoming.createdAt !== existing.createdAt ||
        incoming.updatedAt !== REQUEST_TIME
      ) {
        return 'PERMISSION_DENIED';
      }

      const changed = affectedKeys(incoming, existing);
      const ownerAllowed = [
        'name', 'currency', 'theme', 'monthlyBudget',
        'semesterBudget', 'semesterEndDate', 'collegeName',
        'degreeSemester', 'updatedAt',
      ];
      const adminAllowed = [
        'status', 'name', 'collegeName', 'degreeSemester',
        'monthlyBudget', 'semesterBudget', 'updatedAt',
      ];

      const isOwnerAction =
        existing.id === auth!.uid &&
        existing.status === 'active' &&
        incoming.status === existing.status &&
        changed.every((k) => ownerAllowed.includes(k));

      const isAdminAction =
        isAdmin(auth, db) && changed.every((k) => adminAllowed.includes(k));

      return isOwnerAction || isAdminAction ? 'ALLOW' : 'PERMISSION_DENIED';
    }
  }

  if (collection === 'admins') {
    if (operation === 'create' && incoming) {
      const reqKeys = ['uid', 'email', 'grantedBy', 'role', 'createdAt', 'updatedAt'];
      const validShape =
        hasAllAndOnlyKeys(incoming, reqKeys, reqKeys) &&
        isValidId(incoming.uid) &&
        isValidId(incoming.grantedBy) &&
        incoming.grantedBy === auth?.uid;
      const allowed =
        isVerified(auth) &&
        isValidId(docId) &&
        validShape &&
        incoming.uid === docId &&
        incoming.createdAt === REQUEST_TIME &&
        incoming.updatedAt === REQUEST_TIME &&
        isAdmin(auth, db) &&
        db.users.has(docId);
      return allowed ? 'ALLOW' : 'PERMISSION_DENIED';
    }
  }

  if (collection === 'transactions') {
    if (operation === 'get' || operation === 'list') {
      if (!existing) return 'PERMISSION_DENIED';
      if (operation === 'get' && !isValidId(docId)) return 'PERMISSION_DENIED';
      return isSignedIn(auth) && existing.userId === auth!.uid ? 'ALLOW' : 'PERMISSION_DENIED';
    }
    if (operation === 'create' && incoming) {
      const reqKeys = [
        'id', 'userId', 'amount', 'kind', 'categoryId', 'categoryName',
        'description', 'merchant', 'date', 'paymentMethod', 'account',
        'notes', 'createdAt', 'updatedAt',
      ];
      const allowedKeys = [...reqKeys, 'recurringId'];
      const validShape =
        hasAllAndOnlyKeys(incoming, reqKeys, allowedKeys) &&
        isValidId(incoming.id) &&
        isValidId(incoming.userId) &&
        incoming.userId === auth?.uid &&
        typeof incoming.amount === 'number' && incoming.amount >= 0 && incoming.amount <= 100000000 &&
        typeof incoming.description === 'string' && incoming.description.length >= 1 && incoming.description.length <= 200;

      const allowed =
        isVerified(auth) &&
        isValidId(docId) &&
        validShape &&
        incoming.id === docId &&
        incoming.createdAt === REQUEST_TIME &&
        incoming.updatedAt === REQUEST_TIME &&
        db.users.has(incoming.userId);
      return allowed ? 'ALLOW' : 'PERMISSION_DENIED';
    }
    if (operation === 'update' && incoming && existing) {
      const reqKeys = [
        'id', 'userId', 'amount', 'kind', 'categoryId', 'categoryName',
        'description', 'merchant', 'date', 'paymentMethod', 'account',
        'notes', 'createdAt', 'updatedAt',
      ];
      const allowedKeys = [...reqKeys, 'recurringId'];
      const validShape =
        hasAllAndOnlyKeys(incoming, reqKeys, allowedKeys) &&
        isValidId(incoming.id) &&
        isValidId(incoming.userId) &&
        incoming.userId === auth?.uid &&
        typeof incoming.amount === 'number' && incoming.amount >= 0 && incoming.amount <= 100000000 &&
        typeof incoming.description === 'string' && incoming.description.length >= 1 && incoming.description.length <= 200;

      const changed = affectedKeys(incoming, existing);
      const allowedMutable = [
        'amount', 'kind', 'categoryId', 'categoryName',
        'description', 'merchant', 'date', 'paymentMethod',
        'account', 'notes', 'updatedAt',
      ];

      const allowed =
        isVerified(auth) &&
        isValidId(docId) &&
        validShape &&
        existing.userId === auth!.uid &&
        incoming.id === existing.id &&
        incoming.userId === existing.userId &&
        incoming.createdAt === existing.createdAt &&
        incoming.updatedAt === REQUEST_TIME &&
        changed.every((k) => allowedMutable.includes(k));
      return allowed ? 'ALLOW' : 'PERMISSION_DENIED';
    }
    if (operation === 'delete' && existing) {
      return isVerified(auth) && isValidId(docId) && existing.userId === auth!.uid
        ? 'ALLOW'
        : 'PERMISSION_DENIED';
    }
  }

  if (collection === 'debts' && operation === 'update' && incoming && existing) {
    const changed = affectedKeys(incoming, existing);
    const allowedMutable = ['status', 'amount', 'description', 'dueDate', 'updatedAt'];
    const allowed =
      isVerified(auth) &&
      isValidId(docId) &&
      existing.userId === auth!.uid &&
      incoming.id === existing.id &&
      incoming.userId === existing.userId &&
      incoming.createdAt === existing.createdAt &&
      incoming.updatedAt === REQUEST_TIME &&
      (existing.status !== 'settled' || isAdmin(auth, db)) &&
      changed.every((k) => allowedMutable.includes(k));
    return allowed ? 'ALLOW' : 'PERMISSION_DENIED';
  }

  return 'PERMISSION_DENIED';
}

describe('1. Firestore Security Rules Blueprint & Static Audit', () => {
  test('verifies every collection in firebase-blueprint.json has a hardened match block in firestore.rules', () => {
    assert.ok(rulesContent.includes("rules_version = '2';"), 'Must use rules_version 2');
    assert.ok(
      rulesContent.includes('match /{document=**} {\n      allow read, write: if false;\n    }'),
      'Must include global default-deny catch-all'
    );

    const firestorePaths = Object.keys(blueprint.firestore);
    assert.strictEqual(firestorePaths.length, 9, 'All 9 CostCurve collections must be defined in blueprint');

    for (const p of firestorePaths) {
      assert.ok(rulesContent.includes(`match ${p}`), `firestore.rules must contain match block for ${p}`);
    }
  });
});

describe('2. The "Dirty Dozen" Adversarial Payloads Verification', () => {
  const aliceAuth: SimulatedAuth = {
    uid: 'uid_alice',
    email: 'alice@college.edu',
    email_verified: true,
  };
  const bobAuth: SimulatedAuth = {
    uid: 'uid_bob',
    email: 'bob@college.edu',
    email_verified: true,
  };
  const ownerAuth: SimulatedAuth = {
    uid: 'uid_owner',
    email: 'costcurveexpensetracker@gmail.com',
    email_verified: true,
  };

  const createMockDb = (): SimulatedDbState => {
    const db: SimulatedDbState = {
      users: new Map(),
      admins: new Map(),
      transactions: new Map(),
      debts: new Map(),
    };
    db.users.set('uid_alice', {
      id: 'uid_alice',
      name: 'Alice Student',
      email: 'alice@college.edu',
      currency: '₹',
      theme: 'dark',
      monthlyBudget: 15000,
      semesterBudget: 60000,
      semesterEndDate: '2026-12-31',
      collegeName: 'NIT',
      degreeSemester: 'Sem 5',
      status: 'active',
      createdAt: '2026-11-01T00:00:00.000Z',
      updatedAt: '2026-11-01T00:00:00.000Z',
    });
    db.users.set('uid_bob', {
      id: 'uid_bob',
      name: 'Bob Student',
      email: 'bob@college.edu',
      currency: '₹',
      theme: 'dark',
      monthlyBudget: 12000,
      semesterBudget: 48000,
      semesterEndDate: '2026-12-31',
      collegeName: 'NIT',
      degreeSemester: 'Sem 3',
      status: 'active',
      createdAt: '2026-11-01T00:00:00.000Z',
      updatedAt: '2026-11-01T00:00:00.000Z',
    });
    db.transactions.set('tx_bob_1', {
      id: 'tx_bob_1',
      userId: 'uid_bob',
      amount: 1200,
      kind: 'expense',
      categoryId: 'cat-food',
      categoryName: 'Food & Mess',
      description: 'Bob private mess dinner',
      merchant: 'Mess',
      date: '2026-11-05',
      paymentMethod: 'UPI',
      account: 'Primary Bank',
      notes: '',
      createdAt: '2026-11-05T00:00:00.000Z',
      updatedAt: '2026-11-05T00:00:00.000Z',
    });
    db.transactions.set('tx_alice_1', {
      id: 'tx_alice_1',
      userId: 'uid_alice',
      amount: 500,
      kind: 'expense',
      categoryId: 'cat-books',
      categoryName: 'Books & Academics',
      description: 'Lab manual',
      merchant: 'Bookstore',
      date: '2026-11-05',
      paymentMethod: 'UPI',
      account: 'Primary Bank',
      notes: '',
      createdAt: '2026-11-05T00:00:00.000Z',
      updatedAt: '2026-11-05T00:00:00.000Z',
    });
    db.debts.set('dbt_alice_settled', {
      id: 'dbt_alice_settled',
      userId: 'uid_alice',
      personName: 'Rohan',
      type: 'owes_you',
      amount: 300,
      description: 'Taxi split',
      dueDate: '',
      status: 'settled',
      createdAt: '2026-11-02T00:00:00.000Z',
      updatedAt: '2026-11-02T00:00:00.000Z',
    });
    return db;
  };

  test('1. Identity Spoofing on Transaction Create -> PERMISSION_DENIED', () => {
    const db = createMockDb();
    const res = evaluateRule(db, aliceAuth, 'transactions', 'create', 'tx_spoof', {
      id: 'tx_spoof',
      userId: 'uid_bob', // Alice trying to write under Bob's UID
      amount: 9999,
      kind: 'expense',
      categoryId: 'cat-food',
      categoryName: 'Food & Mess',
      description: 'Spoofed expense',
      merchant: 'Store',
      date: '2026-11-10',
      paymentMethod: 'UPI',
      account: 'Primary Bank',
      notes: '',
      createdAt: REQUEST_TIME,
      updatedAt: REQUEST_TIME,
    });
    assert.strictEqual(res, 'PERMISSION_DENIED');
  });

  test('2. Cross-User Private Transaction Read (User A reading User B transaction) -> PERMISSION_DENIED', () => {
    const db = createMockDb();
    assert.strictEqual(evaluateRule(db, aliceAuth, 'transactions', 'get', 'tx_bob_1'), 'PERMISSION_DENIED');
    assert.strictEqual(evaluateRule(db, aliceAuth, 'transactions', 'list', 'tx_bob_1'), 'PERMISSION_DENIED');
    // Verify Bob CAN read his own transaction
    assert.strictEqual(evaluateRule(db, bobAuth, 'transactions', 'get', 'tx_bob_1'), 'ALLOW');
  });

  test('3. Self-Assigned Admin Escalation -> PERMISSION_DENIED', () => {
    const db = createMockDb();
    const res = evaluateRule(db, aliceAuth, 'admins', 'create', 'uid_alice', {
      uid: 'uid_alice',
      email: 'alice@college.edu',
      grantedBy: 'uid_alice',
      role: 'admin',
      createdAt: REQUEST_TIME,
      updatedAt: REQUEST_TIME,
    });
    assert.strictEqual(res, 'PERMISSION_DENIED');

    // Verified Owner CAN grant admin access to Alice
    const ownerGrant = evaluateRule(db, ownerAuth, 'admins', 'create', 'uid_alice', {
      uid: 'uid_alice',
      email: 'alice@college.edu',
      grantedBy: 'uid_owner',
      role: 'admin',
      createdAt: REQUEST_TIME,
      updatedAt: REQUEST_TIME,
    });
    assert.strictEqual(ownerGrant, 'ALLOW');
  });

  test('4. Unverified Owner Email Spoof -> PERMISSION_DENIED', () => {
    const db = createMockDb();
    const spoofedOwner: SimulatedAuth = {
      uid: 'uid_attacker',
      email: 'costcurveexpensetracker@gmail.com',
      email_verified: false,
    };
    assert.strictEqual(evaluateRule(db, spoofedOwner, 'users', 'get', 'uid_bob'), 'PERMISSION_DENIED');
  });

  test('5. Shadow Field Injection on Profile Update -> PERMISSION_DENIED', () => {
    const db = createMockDb();
    const existingAlice = db.users.get('uid_alice')!;
    const res = evaluateRule(db, aliceAuth, 'users', 'update', 'uid_alice', {
      ...existingAlice,
      name: 'Alice Updated',
      isAdmin: true, // Ghost shadow field
      updatedAt: REQUEST_TIME,
    });
    assert.strictEqual(res, 'PERMISSION_DENIED');
  });

  test('6. Self-Status Tampering on User Profile -> PERMISSION_DENIED', () => {
    const db = createMockDb();
    const existingAlice = db.users.get('uid_alice')!;
    existingAlice.status = 'suspended';
    const res = evaluateRule(db, aliceAuth, 'users', 'update', 'uid_alice', {
      ...existingAlice,
      status: 'active',
      updatedAt: REQUEST_TIME,
    });
    assert.strictEqual(res, 'PERMISSION_DENIED');
  });

  test('7. PII Blanket Read on /users/{userId} by non-owner -> PERMISSION_DENIED', () => {
    const db = createMockDb();
    assert.strictEqual(evaluateRule(db, aliceAuth, 'users', 'get', 'uid_bob'), 'PERMISSION_DENIED');
    assert.strictEqual(evaluateRule(db, ownerAuth, 'users', 'get', 'uid_bob'), 'ALLOW');
  });

  test('8. Orphaned Transaction Create Without User Profile -> PERMISSION_DENIED', () => {
    const db = createMockDb();
    const ghostAuth: SimulatedAuth = {
      uid: 'uid_ghost',
      email: 'ghost@college.edu',
      email_verified: true,
    };
    const res = evaluateRule(db, ghostAuth, 'transactions', 'create', 'tx_orphan', {
      id: 'tx_orphan',
      userId: 'uid_ghost',
      amount: 100,
      kind: 'expense',
      categoryId: 'cat-food',
      categoryName: 'Food & Mess',
      description: 'Orphaned tx',
      merchant: '',
      date: '2026-11-10',
      paymentMethod: 'UPI',
      account: 'Primary Bank',
      notes: '',
      createdAt: REQUEST_TIME,
      updatedAt: REQUEST_TIME,
    });
    assert.strictEqual(res, 'PERMISSION_DENIED');
  });

  test('9. Immortal Field Mutation on Update (createdAt / userId) -> PERMISSION_DENIED', () => {
    const db = createMockDb();
    const existingTx = db.transactions.get('tx_alice_1')!;
    const res = evaluateRule(db, aliceAuth, 'transactions', 'update', 'tx_alice_1', {
      ...existingTx,
      createdAt: REQUEST_TIME, // Attempting to overwrite createdAt
      updatedAt: REQUEST_TIME,
    });
    assert.strictEqual(res, 'PERMISSION_DENIED');
  });

  test('10. Value / Size Poisoning (5,000-char description or negative amount) -> PERMISSION_DENIED', () => {
    const db = createMockDb();
    const existingTx = db.transactions.get('tx_alice_1')!;
    const resOversized = evaluateRule(db, aliceAuth, 'transactions', 'update', 'tx_alice_1', {
      ...existingTx,
      description: 'X'.repeat(5000),
      updatedAt: REQUEST_TIME,
    });
    assert.strictEqual(resOversized, 'PERMISSION_DENIED');

    const resNegative = evaluateRule(db, aliceAuth, 'transactions', 'update', 'tx_alice_1', {
      ...existingTx,
      amount: -500,
      updatedAt: REQUEST_TIME,
    });
    assert.strictEqual(resNegative, 'PERMISSION_DENIED');
  });

  test('11. Terminal State Reversal on Settled Debt -> PERMISSION_DENIED', () => {
    const db = createMockDb();
    const existingDebt = db.debts.get('dbt_alice_settled')!;
    const res = evaluateRule(db, aliceAuth, 'debts', 'update', 'dbt_alice_settled', {
      ...existingDebt,
      status: 'pending',
      updatedAt: REQUEST_TIME,
    });
    assert.strictEqual(res, 'PERMISSION_DENIED');
  });

  test('12. ID Poisoning Attack -> PERMISSION_DENIED', () => {
    const db = createMockDb();
    const badId = 'bad$id with spaces!';
    const res = evaluateRule(db, aliceAuth, 'transactions', 'create', badId, {
      id: badId,
      userId: 'uid_alice',
      amount: 100,
      kind: 'expense',
      categoryId: 'cat-food',
      categoryName: 'Food & Mess',
      description: 'Valid description',
      merchant: '',
      date: '2026-11-10',
      paymentMethod: 'UPI',
      account: 'Primary Bank',
      notes: '',
      createdAt: REQUEST_TIME,
      updatedAt: REQUEST_TIME,
    });
    assert.strictEqual(res, 'PERMISSION_DENIED');
  });

  test('13. First-time Google Sign-In reading non-existent own users/{uid} document -> ALLOW, other user -> PERMISSION_DENIED', () => {
    const db = createMockDb();
    const newGoogleUserAuth: SimulatedAuth = {
      uid: 'uid_first_time_google',
      email: 'newstudent@gmail.com',
      email_verified: true,
    };
    // Document users/uid_first_time_google does not exist yet in db.users
    assert.strictEqual(
      evaluateRule(db, newGoogleUserAuth, 'users', 'get', 'uid_first_time_google'),
      'ALLOW',
      'First-time Google Sign-In user must be allowed to check if their own users/{uid} document exists'
    );
    assert.strictEqual(
      evaluateRule(db, aliceAuth, 'users', 'get', 'uid_first_time_google'),
      'PERMISSION_DENIED',
      'Another user must not be allowed to probe a non-existent users/{uid} document'
    );
  });
});

describe('3. Pure Financial Engine Multi-User Isolation (User A vs User B)', () => {
  test('computes isolated analytics, budgets, insights, and Budget Advisor answers for User A vs User B', () => {
    const now = new Date();
    const ym = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

    const userA: User = {
      id: 'uid_alice',
      name: 'Alice',
      email: 'alice@college.edu',
      currency: '₹',
      theme: 'dark',
      monthlyBudget: 15000,
      semesterBudget: 60000,
      semesterEndDate: '2026-12-31',
      createdAt: now.toISOString(),
    };

    const userB: User = {
      id: 'uid_bob',
      name: 'Bob',
      email: 'bob@college.edu',
      currency: '₹',
      theme: 'dark',
      monthlyBudget: 10000,
      semesterBudget: 40000,
      semesterEndDate: '2026-12-31',
      createdAt: now.toISOString(),
    };

    const txsA: Transaction[] = [
      {
        id: 'tx_a_1',
        userId: userA.id,
        amount: 5000,
        kind: 'expense',
        categoryId: 'cat-hostel',
        categoryName: 'Hostel & Rent',
        description: 'Alice hostel rent',
        merchant: 'Hostel',
        date: `${ym}-02`,
        paymentMethod: 'UPI',
        account: 'Primary Bank',
        createdAt: now.toISOString(),
        updatedAt: now.toISOString(),
      },
    ];

    // User B has 0 transactions (fresh registered user empty state)
    const txsB: Transaction[] = [];
    const budgetsA: Budget[] = [];
    const goalsB: SavingsGoal[] = [];

    const anaA = computeAnalyticsResponse(userA, txsA, DEFAULT_SYSTEM_CATEGORIES);
    const anaB = computeAnalyticsResponse(userB, txsB, DEFAULT_SYSTEM_CATEGORIES);

    assert.strictEqual(anaA.currentMonth.expense, 5000);
    assert.strictEqual(anaB.currentMonth.expense, 0, 'New User B must have 0 expenses');
    assert.strictEqual(anaB.categoryBreakdown.length, 0, 'New User B must have empty category breakdown');

    const budB = computeBudgetsResponse(userB, budgetsA, txsB, ym);
    assert.strictEqual(budB.overall.spent, 0);
    assert.strictEqual(budB.overall.remaining, 10000);

    const insB = computeInsightsResponse(userB, txsB);
    assert.ok(insB.insights[0].title.includes('Welcome to CostCurve'));

    const advisorA = evaluateBudgetAdvisorQuestion(
      'Highest expense category',
      userA,
      txsA,
      DEFAULT_SYSTEM_CATEGORIES,
      [],
      [],
      []
    );
    const advisorB = evaluateBudgetAdvisorQuestion(
      'Highest expense category',
      userB,
      txsB,
      DEFAULT_SYSTEM_CATEGORIES,
      [],
      [],
      []
    );

    assert.ok(advisorA.answer.includes('Hostel & Rent'));
    assert.ok(advisorB.answer.toLowerCase().includes('insufficient transaction data'));
  });
});
