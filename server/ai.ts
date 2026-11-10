/**
 * Financial Assistant Service with Deterministic Ledger Grounding & Gemini API
 */

import { GoogleGenAI } from '@google/genai';
import { Transaction, Budget, SavingsGoal, User } from './types.ts';
import { roundMoney, db } from './db.ts';

export interface FinancialSummaryContext {
  currency: string;
  totalTransactionCount: number;
  monthTransactionCount: number;
  totalIncome: number;
  totalExpense: number;
  essentialExpense: number;
  discretionaryExpense: number;
  netSavings: number;
  monthlyBudget: number;
  budgetSpent: number;
  budgetRemaining: number;
  budgetPercentage: number;
  safeDailySpend: number;
  avgDailySpendSoFar: number;
  daysRemainingInMonth: number;
  topCategories: { name: string; amount: number; percentage: number; count: number }[];
  recentTransactions: { date: string; kind: string; category: string; amount: number; desc: string; merchant?: string }[];
  activeGoals: { title: string; current: number; target: number; percentage: number }[];
  upcomingBills: { title: string; amount: number; nextDueDate: string; frequency: string }[];
  debtSummary: { owedToYou: number; youOwe: number; pendingCount: number };
}

/**
 * Deterministically compute financial facts from user's authorized transaction records
 */
export function computeUserFinancialContext(
  user: User,
  transactions: Transaction[],
  budgets: Budget[],
  goals: SavingsGoal[]
): FinancialSummaryContext {
  const currency = user.currency || '₹';
  const now = new Date();
  const currentMonthPrefix = `${now.getFullYear()}-${(now.getMonth() + 1).toString().padStart(2, '0')}`;

  const monthTransactions = transactions.filter((t) => t.date.startsWith(currentMonthPrefix));
  const categories = db.getCategories(user.id);
  const recurring = db.getRecurring(user.id).filter((r) => r.status === 'active');
  const debts = db.getDebts(user.id).filter((d) => d.status === 'pending');

  let totalIncome = 0;
  let totalExpense = 0;
  let essentialExpense = 0;
  let discretionaryExpense = 0;
  const categoryTotals: Record<string, { amount: number; count: number }> = {};

  monthTransactions.forEach((t) => {
    if (t.kind === 'income') {
      totalIncome = roundMoney(totalIncome + t.amount);
    } else {
      totalExpense = roundMoney(totalExpense + t.amount);
      const cat = categories.find((c) => c.id === t.categoryId);
      const isEss = cat ? cat.isEssential : true;
      if (isEss) essentialExpense = roundMoney(essentialExpense + t.amount);
      else discretionaryExpense = roundMoney(discretionaryExpense + t.amount);

      const catName = t.categoryName || cat?.name || 'Uncategorized';
      if (!categoryTotals[catName]) {
        categoryTotals[catName] = { amount: 0, count: 0 };
      }
      categoryTotals[catName].amount = roundMoney(categoryTotals[catName].amount + t.amount);
      categoryTotals[catName].count += 1;
    }
  });

  const netSavings = roundMoney(totalIncome - totalExpense);

  const overallBudgetObj = budgets.find((b) => b.month === currentMonthPrefix && b.categoryId === null);
  const monthlyBudget = overallBudgetObj ? overallBudgetObj.amount : (user.monthlyBudget || 15000);
  const budgetSpent = totalExpense;
  const budgetRemaining = roundMoney(monthlyBudget - budgetSpent);
  const budgetPercentage = monthlyBudget > 0 ? Math.round((budgetSpent / monthlyBudget) * 100) : 0;

  const lastDayOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const dayOfMonth = Math.max(1, now.getDate());
  const daysRemainingInMonth = Math.max(1, lastDayOfMonth - now.getDate() + 1);
  const safeDailySpend = budgetRemaining > 0 ? roundMoney(budgetRemaining / daysRemainingInMonth) : 0;
  const avgDailySpendSoFar = roundMoney(totalExpense / dayOfMonth);

  const topCategories = Object.entries(categoryTotals)
    .map(([name, data]) => ({
      name,
      amount: data.amount,
      count: data.count,
      percentage: totalExpense > 0 ? Math.round((data.amount / totalExpense) * 100) : 0,
    }))
    .sort((a, b) => b.amount - a.amount);

  const recentTransactions = transactions.slice(0, 10).map((t) => ({
    date: t.date,
    kind: t.kind,
    category: t.categoryName,
    amount: t.amount,
    desc: t.description,
    merchant: t.merchant,
  }));

  const activeGoals = goals.map((g) => ({
    title: g.title,
    current: g.currentAmount,
    target: g.targetAmount,
    percentage: Math.min(100, Math.round((g.currentAmount / g.targetAmount) * 100)),
  }));

  const upcomingBills = recurring.slice(0, 5).map((r) => ({
    title: r.title,
    amount: r.amount,
    nextDueDate: r.nextDueDate,
    frequency: r.frequency,
  }));

  const owedToYou = roundMoney(
    debts.filter((d) => d.type === 'owes_you').reduce((s, d) => s + d.amount, 0)
  );
  const youOwe = roundMoney(
    debts.filter((d) => d.type === 'you_owe').reduce((s, d) => s + d.amount, 0)
  );

  return {
    currency,
    totalTransactionCount: transactions.length,
    monthTransactionCount: monthTransactions.length,
    totalIncome,
    totalExpense,
    essentialExpense,
    discretionaryExpense,
    netSavings,
    monthlyBudget,
    budgetSpent,
    budgetRemaining,
    budgetPercentage,
    safeDailySpend,
    avgDailySpendSoFar,
    daysRemainingInMonth,
    topCategories,
    recentTransactions,
    activeGoals,
    upcomingBills,
    debtSummary: {
      owedToYou,
      youOwe,
      pendingCount: debts.length,
    },
  };
}

/**
 * Deterministic rule-based assistant responses grounded in actual ledger numbers
 */
export function getDeterministicAnswer(question: string, context: FinancialSummaryContext): string {
  const q = question.trim().toLowerCase();
  const curr = context.currency;
  const hasAnyTx = context.totalTransactionCount > 0;
  const hasMonthTx = context.monthTransactionCount > 0;

  // 1. Check for specific amount affordability question (e.g., "Can I afford a 2,000 outing?", "spend 500")
  const amountMatches = question.replace(/,/g, '').match(/(\d+(?:\.\d+)?)/g);
  const parsedAmount = amountMatches ? parseFloat(amountMatches[0]) : null;

  if (
    q.includes('afford') ||
    q.includes('outing') ||
    q.includes('buy') ||
    q.includes('trip') ||
    q.includes('purchase') ||
    (parsedAmount !== null && (q.includes('can i') || q.includes('spend') || q.includes('if i')))
  ) {
    const testAmt = parsedAmount !== null && parsedAmount > 0 ? parsedAmount : 2000;
    const postRemaining = roundMoney(context.budgetRemaining - testAmt);
    const nextDays = Math.max(1, context.daysRemainingInMonth - 1);
    const newDailyRate = postRemaining > 0 ? roundMoney(postRemaining / nextDays) : 0;
    const rateDrop = roundMoney(context.safeDailySpend - newDailyRate);

    if (!hasMonthTx) {
      if (testAmt <= context.monthlyBudget) {
        return `You have no recorded expenses this month yet, so your full monthly budget of ${curr}${context.monthlyBudget.toLocaleString()} is untouched.\n\n• Planned spend: ${curr}${testAmt.toLocaleString()}\n• Budget remaining after spend: ${curr}${postRemaining.toLocaleString()}\n• Adjusted daily safe-to-spend rate: ${curr}${newDailyRate.toLocaleString()}/day (down from ${curr}${context.safeDailySpend.toLocaleString()}/day across ${nextDays} remaining days)\n\nYes, this fits within your baseline allowance, though logging your fixed hostel or mess dues first will give a stricter picture.`;
      }
      return `Even with 0 recorded expenses this month, a ${curr}${testAmt.toLocaleString()} outlay exceeds your entire ${curr}${context.monthlyBudget.toLocaleString()} monthly budget by ${curr}${Math.abs(postRemaining).toLocaleString()}.`;
    }

    if (context.budgetRemaining <= 0) {
      return `No — you have already exceeded your ${curr}${context.monthlyBudget.toLocaleString()} monthly budget by ${curr}${Math.abs(context.budgetRemaining).toLocaleString()} (${curr}${context.budgetSpent.toLocaleString()} spent across ${context.monthTransactionCount} transactions). Taking on an extra ${curr}${testAmt.toLocaleString()} expense would push your deficit to ${curr}${Math.abs(postRemaining).toLocaleString()}.`;
    }

    if (testAmt > context.budgetRemaining) {
      return `No — spending ${curr}${testAmt.toLocaleString()} would exceed your remaining monthly budget of ${curr}${context.budgetRemaining.toLocaleString()} by ${curr}${Math.abs(postRemaining).toLocaleString()}.\n\n• Current spent: ${curr}${context.budgetSpent.toLocaleString()} of ${curr}${context.monthlyBudget.toLocaleString()} (${context.budgetPercentage}%)\n• Current safe daily limit: ${curr}${context.safeDailySpend.toLocaleString()}/day\n\nConsider scaling the expense below ${curr}${context.budgetRemaining.toLocaleString()} or using dedicated savings goal funds.`;
    }

    return `Yes, you can cover a ${curr}${testAmt.toLocaleString()} expense within your remaining ${curr}${context.budgetRemaining.toLocaleString()} budget.\n\n• Remaining budget after spend: ${curr}${postRemaining.toLocaleString()}\n• Current daily safe limit: ${curr}${context.safeDailySpend.toLocaleString()}/day\n• New daily safe limit: ${curr}${newDailyRate.toLocaleString()}/day (a reduction of ${curr}${Math.max(0, rateDrop).toLocaleString()}/day for the remaining ${nextDays} days)`;
  }

  // 2. Highest / Top Expense Category or Category Breakdown
  if (
    q.includes('category') ||
    q.includes('categories') ||
    q.includes('highest') ||
    q.includes('most') ||
    q.includes('where') ||
    q.includes('breakdown') ||
    q.includes('biggest expense')
  ) {
    if (!hasMonthTx || context.topCategories.length === 0) {
      return `There is insufficient transaction data to calculate your highest expense category (${context.monthTransactionCount} expense entries recorded this month).\n\nOnce you log expenses under categories like Food & Mess, Hostel & Rent, or Academics, I will rank your largest outflows and their exact share of your ${curr}${context.monthlyBudget.toLocaleString()} budget.`;
    }
    const top = context.topCategories[0];
    const breakdownList = context.topCategories
      .slice(0, 4)
      .map(
        (c, idx) =>
          `${idx + 1}. ${c.name}: ${curr}${c.amount.toLocaleString()} (${c.percentage}% of spend · ${c.count} ${c.count === 1 ? 'entry' : 'entries'})`
      )
      .join('\n');

    return `Your highest expense category this month is ${top.name} at ${curr}${top.amount.toLocaleString()} (${top.percentage}% of your ${curr}${context.totalExpense.toLocaleString()} total expenses).\n\nCategory ranking this month:\n${breakdownList}`;
  }

  // 3. Safe Daily Spending Limit / Daily Velocity
  if (
    q.includes('daily') ||
    q.includes('safe') ||
    q.includes('limit') ||
    q.includes('velocity') ||
    q.includes('per day') ||
    q.includes('today')
  ) {
    if (!hasMonthTx) {
      return `Your safe daily spend limit is currently ${curr}${context.safeDailySpend.toLocaleString()}/day.\n\n• Monthly allowance budget: ${curr}${context.monthlyBudget.toLocaleString()}\n• Recorded expenses this month: ${curr}0 (no transactions logged yet)\n• Days remaining in month: ${context.daysRemainingInMonth} days\n\nFormula: ${curr}${context.monthlyBudget.toLocaleString()} ÷ ${context.daysRemainingInMonth} days = ${curr}${context.safeDailySpend.toLocaleString()}/day.`;
    }
    if (context.budgetRemaining <= 0) {
      return `Your safe daily spend limit is ${curr}0/day because your monthly expenses (${curr}${context.budgetSpent.toLocaleString()}) have reached or exceeded your ${curr}${context.monthlyBudget.toLocaleString()} budget with ${context.daysRemainingInMonth} days remaining.`;
    }
    return `Your safe daily spend limit is ${curr}${context.safeDailySpend.toLocaleString()}/day for the next ${context.daysRemainingInMonth} days.\n\n• Remaining monthly budget: ${curr}${context.budgetRemaining.toLocaleString()} (out of ${curr}${context.monthlyBudget.toLocaleString()})\n• Expenses logged so far: ${curr}${context.budgetSpent.toLocaleString()} (${context.budgetPercentage}% used)\n• Average daily spend so far: ${curr}${context.avgDailySpendSoFar.toLocaleString()}/day`;
  }

  // 4. Monthly Summary / Overview
  if (
    q.includes('summary') ||
    q.includes('summarize') ||
    q.includes('overview') ||
    q.includes('monthly') ||
    q.includes('month') ||
    q.includes('how am i doing') ||
    q.includes('report') ||
    q.includes('status')
  ) {
    if (!hasMonthTx) {
      return `Monthly summary (${context.daysRemainingInMonth} days remaining in month):\n\n• Recorded income: ${curr}0\n• Recorded expenses: ${curr}0 (0 transactions logged this month)\n• Monthly budget limit: ${curr}${context.monthlyBudget.toLocaleString()}\n• Remaining allowance: ${curr}${context.budgetRemaining.toLocaleString()}\n• Safe daily spend rate: ${curr}${context.safeDailySpend.toLocaleString()}/day\n\nNo transactions have been logged for the current month yet. Use "New entry" to record your stipend or first expense.`;
    }
    const topCatText =
      context.topCategories.length > 0
        ? `${context.topCategories[0].name} (${curr}${context.topCategories[0].amount.toLocaleString()})`
        : 'None';
    return `Month-to-date summary (${context.monthTransactionCount} transactions):\n\n• Income and allowance: ${curr}${context.totalIncome.toLocaleString()}\n• Total expenses: ${curr}${context.totalExpense.toLocaleString()} (${curr}${context.essentialExpense.toLocaleString()} essential · ${curr}${context.discretionaryExpense.toLocaleString()} discretionary)\n• Net balance: ${curr}${context.netSavings.toLocaleString()}\n• Budget used: ${context.budgetPercentage}% (${curr}${context.budgetSpent.toLocaleString()} of ${curr}${context.monthlyBudget.toLocaleString()})\n• Remaining allowance: ${curr}${context.budgetRemaining.toLocaleString()} (${curr}${context.safeDailySpend.toLocaleString()}/day over ${context.daysRemainingInMonth} days)\n• Top category: ${topCatText}`;
  }

  // 5. Recurring Bills / Hostel / Subscriptions
  if (
    q.includes('bill') ||
    q.includes('recurring') ||
    q.includes('subscription') ||
    q.includes('hostel') ||
    q.includes('rent') ||
    q.includes('due') ||
    q.includes('fixed')
  ) {
    if (context.upcomingBills.length === 0) {
      return `You have no active recurring bills or subscriptions scheduled in your ledger. Add fixed commitments like hostel rent, mess dues, or broadband in the "Recurring bills" tab.`;
    }
    const list = context.upcomingBills
      .map((b) => `• ${b.title}: ${curr}${b.amount.toLocaleString()} (${b.frequency}, next due ${b.nextDueDate})`)
      .join('\n');
    return `You have ${context.upcomingBills.length} active recurring schedule(s):\n\n${list}`;
  }

  // 6. Savings Goals
  if (q.includes('goal') || q.includes('saving') || q.includes('target')) {
    if (context.activeGoals.length === 0) {
      return `You have no active savings goals configured yet. Open "Budgets and goals" to set a target for textbooks, hardware, or emergency funds.`;
    }
    const goalSummary = context.activeGoals
      .map(
        (g) =>
          `• ${g.title}: ${curr}${g.current.toLocaleString()} / ${curr}${g.target.toLocaleString()} (${g.percentage}%)`
      )
      .join('\n');
    return `Active savings goals (${context.activeGoals.length}):\n\n${goalSummary}\n\nNet month balance available: ${curr}${context.netSavings.toLocaleString()}.`;
  }

  // 7. Debts / IOUs / Splits
  if (
    q.includes('debt') ||
    q.includes('iou') ||
    q.includes('owe') ||
    q.includes('split') ||
    q.includes('roommate') ||
    q.includes('friend')
  ) {
    if (context.debtSummary.pendingCount === 0) {
      return `All peer balances are settled — you have 0 pending IOUs right now.`;
    }
    return `Peer IOU status (${context.debtSummary.pendingCount} pending records):\n\n• Classmates owe you: +${curr}${context.debtSummary.owedToYou.toLocaleString()}\n• You owe others: -${curr}${context.debtSummary.youOwe.toLocaleString()}\n• Net peer position: ${curr}${(context.debtSummary.owedToYou - context.debtSummary.youOwe).toLocaleString()}`;
  }

  // 8. Recent Transactions or Specific Keyword Search in Ledger
  if (
    q.includes('recent') ||
    q.includes('last') ||
    q.includes('latest') ||
    q.includes('transaction') ||
    q.includes('history')
  ) {
    if (!hasAnyTx) {
      return `Your transaction ledger is currently empty (0 recorded entries). Click "New entry" in the top bar to log an expense or allowance.`;
    }
    const recentList = context.recentTransactions
      .slice(0, 5)
      .map(
        (t) =>
          `• ${t.date}: ${t.desc || t.category} (${t.category}) — ${t.kind === 'income' ? '+' : '-'}${curr}${t.amount.toLocaleString()}`
      )
      .join('\n');
    return `Latest recorded transactions (${context.totalTransactionCount} total in ledger):\n\n${recentList}`;
  }

  // 9. Fallback: Search if any word in the question matches a category or transaction description
  const words = q
    .replace(/[^a-z0-9\s]/g, '')
    .split(/\s+/)
    .filter((w) => w.length >= 3 && !['what', 'how', 'much', 'the', 'this', 'for', 'and', 'are', 'can', 'you', 'tell', 'show'].includes(w));

  for (const word of words) {
    const matchedCat = context.topCategories.find((c) => c.name.toLowerCase().includes(word));
    if (matchedCat) {
      return `In "${matchedCat.name}", you have spent ${curr}${matchedCat.amount.toLocaleString()} across ${matchedCat.count} transaction(s) this month, representing ${matchedCat.percentage}% of your total monthly expenses (${curr}${context.totalExpense.toLocaleString()}).`;
    }
  }

  if (!hasAnyTx) {
    return `Regarding "${question.trim()}": Your ledger currently has 0 recorded transactions.\n\n• Configured monthly budget: ${curr}${context.monthlyBudget.toLocaleString()}\n• Safe daily spend rate: ${curr}${context.safeDailySpend.toLocaleString()}/day across ${context.daysRemainingInMonth} remaining days\n\nLog your first expense or income entry to unlock category rankings and cashflow analysis.`;
  }

  const leadCat =
    context.topCategories.length > 0
      ? ` Your largest category is ${context.topCategories[0].name} at ${curr}${context.topCategories[0].amount.toLocaleString()} (${context.topCategories[0].percentage}%).`
      : '';

  return `Based on your ${context.monthTransactionCount} transaction(s) this month, you have spent ${curr}${context.budgetSpent.toLocaleString()} of your ${curr}${context.monthlyBudget.toLocaleString()} budget (${context.budgetPercentage}% used), leaving ${curr}${context.budgetRemaining.toLocaleString()} (${curr}${context.safeDailySpend.toLocaleString()}/day over ${context.daysRemainingInMonth} days).${leadCat}`;
}

/**
 * Handle query using deterministic ledger analysis + optional Gemini API enhancement
 */
export async function askFinancialAssistant(
  question: string,
  context: FinancialSummaryContext
): Promise<{ answer: string; deterministicCalculation: string }> {
  const deterministicAnswer = getDeterministicAnswer(question, context);
  const calcLine = `Budget ${context.currency}${context.monthlyBudget.toLocaleString()} · Spent ${context.currency}${context.budgetSpent.toLocaleString()} (${context.budgetPercentage}%) · Remaining ${context.currency}${context.budgetRemaining.toLocaleString()} · Safe daily ${context.currency}${context.safeDailySpend.toLocaleString()}/day`;

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') {
    return {
      answer: deterministicAnswer,
      deterministicCalculation: calcLine,
    };
  }

  try {
    const ai = new GoogleGenAI({ apiKey });
    const prompt = `You are a concise, mathematically exact college student budget advisor inside CostCurve.
Answer the student's question directly using ONLY the verified ledger figures below. Do not invent numbers or use exclamation marks.

VERIFIED LEDGER CONTEXT:
- Currency: ${context.currency}
- Transactions this month: ${context.monthTransactionCount} (Total in ledger: ${context.totalTransactionCount})
- Monthly Income: ${context.currency}${context.totalIncome}
- Monthly Expenses: ${context.currency}${context.totalExpense} (Essential: ${context.currency}${context.essentialExpense}, Discretionary: ${context.currency}${context.discretionaryExpense})
- Net Balance: ${context.currency}${context.netSavings}
- Monthly Budget Limit: ${context.currency}${context.monthlyBudget}
- Remaining Budget: ${context.currency}${context.budgetRemaining} (${context.budgetPercentage}% used)
- Days Remaining in Month: ${context.daysRemainingInMonth}
- Safe Daily Spend Limit: ${context.currency}${context.safeDailySpend}/day
- Top Categories: ${JSON.stringify(context.topCategories)}
- Active Savings Goals: ${JSON.stringify(context.activeGoals)}
- Upcoming Recurring Bills: ${JSON.stringify(context.upcomingBills)}
- Deterministic Baseline Answer: ${deterministicAnswer}

STUDENT QUESTION: "${question}"`;

    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
    });

    const aiText = response.text?.trim();
    return {
      answer: aiText || deterministicAnswer,
      deterministicCalculation: calcLine,
    };
  } catch {
    return {
      answer: deterministicAnswer,
      deterministicCalculation: calcLine,
    };
  }
}
