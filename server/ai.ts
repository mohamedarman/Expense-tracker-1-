/**
 * AI Financial Assistant Service with Deterministic Grounding & Gemini API
 */

import { GoogleGenAI } from '@google/genai';
import { Transaction, Budget, SavingsGoal, User } from './types.ts';
import { roundMoney } from './db.ts';

export interface FinancialSummaryContext {
  currency: string;
  totalIncome: number;
  totalExpense: number;
  netSavings: number;
  monthlyBudget: number;
  budgetSpent: number;
  budgetRemaining: number;
  budgetPercentage: number;
  safeDailySpend: number;
  daysRemainingInMonth: number;
  topCategories: { name: string; amount: number; percentage: number }[];
  recentTransactions: { date: string; kind: string; category: string; amount: number; desc: string }[];
  activeGoals: { title: string; current: number; target: number; percentage: number }[];
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

  // Current month transactions
  const monthTransactions = transactions.filter((t) => t.date.startsWith(currentMonthPrefix));

  let totalIncome = 0;
  let totalExpense = 0;
  const categoryTotals: Record<string, number> = {};

  monthTransactions.forEach((t) => {
    if (t.kind === 'income') {
      totalIncome = roundMoney(totalIncome + t.amount);
    } else {
      totalExpense = roundMoney(totalExpense + t.amount);
      categoryTotals[t.categoryName] = roundMoney((categoryTotals[t.categoryName] || 0) + t.amount);
    }
  });

  const netSavings = roundMoney(totalIncome - totalExpense);

  // Overall budget
  const overallBudgetObj = budgets.find((b) => b.month === currentMonthPrefix && b.categoryId === null);
  const monthlyBudget = overallBudgetObj ? overallBudgetObj.amount : (user.monthlyBudget || 15000);
  const budgetSpent = totalExpense;
  const budgetRemaining = roundMoney(monthlyBudget - budgetSpent);
  const budgetPercentage = monthlyBudget > 0 ? Math.min(100, Math.round((budgetSpent / monthlyBudget) * 100)) : 0;

  // Days remaining calculation
  const lastDayOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const daysRemainingInMonth = Math.max(1, lastDayOfMonth - now.getDate() + 1);
  const safeDailySpend = budgetRemaining > 0 ? roundMoney(budgetRemaining / daysRemainingInMonth) : 0;

  // Top categories sorted
  const topCategories = Object.entries(categoryTotals)
    .map(([name, amount]) => ({
      name,
      amount,
      percentage: totalExpense > 0 ? Math.round((amount / totalExpense) * 100) : 0,
    }))
    .sort((a, b) => b.amount - a.amount);

  const recentTransactions = transactions.slice(0, 8).map((t) => ({
    date: t.date,
    kind: t.kind,
    category: t.categoryName,
    amount: t.amount,
    desc: t.description,
  }));

  const activeGoals = goals.map((g) => ({
    title: g.title,
    current: g.currentAmount,
    target: g.targetAmount,
    percentage: Math.min(100, Math.round((g.currentAmount / g.targetAmount) * 100)),
  }));

  return {
    currency,
    totalIncome,
    totalExpense,
    netSavings,
    monthlyBudget,
    budgetSpent,
    budgetRemaining,
    budgetPercentage,
    safeDailySpend,
    daysRemainingInMonth,
    topCategories,
    recentTransactions,
    activeGoals,
  };
}

/**
 * Deterministic rule-based assistant responses (used when Gemini is unavailable or for deterministic queries)
 */
export function getDeterministicAnswer(question: string, context: FinancialSummaryContext): string {
  const q = question.toLowerCase();

  if (q.includes('spend') && (q.includes('today') || q.includes('daily') || q.includes('safe'))) {
    return `Based on your remaining budget of ${context.currency}${context.budgetRemaining.toLocaleString()} and ${context.daysRemainingInMonth} days left in the month, your safe daily spending limit is ${context.currency}${context.safeDailySpend.toLocaleString()}/day. If you spend less than this, you'll finish the month on track!`;
  }

  if (q.includes('afford') || q.includes('budget') || q.includes('remaining')) {
    if (context.budgetRemaining <= 0) {
      return `Warning: You have currently exceeded your monthly budget by ${context.currency}${Math.abs(context.budgetRemaining).toLocaleString()} (Spent ${context.currency}${context.budgetSpent.toLocaleString()} of ${context.currency}${context.monthlyBudget.toLocaleString()}). Try to freeze non-essential spending for the remaining ${context.daysRemainingInMonth} days.`;
    }
    return `You have ${context.currency}${context.budgetRemaining.toLocaleString()} remaining out of your ${context.currency}${context.monthlyBudget.toLocaleString()} monthly budget (${context.budgetPercentage}% utilized). With ${context.daysRemainingInMonth} days left, you have a comfortable buffer of ${context.currency}${context.safeDailySpend.toLocaleString()} per day.`;
  }

  if (q.includes('category') || q.includes('highest') || q.includes('where') || q.includes('most')) {
    if (context.topCategories.length === 0) {
      return `You haven't recorded any expenses for the current month yet.`;
    }
    const top = context.topCategories[0];
    const top3 = context.topCategories.slice(0, 3).map((c) => `${c.name}: ${context.currency}${c.amount.toLocaleString()} (${c.percentage}%)`).join(', ');
    return `Your highest spending category this month is ${top.name} with ${context.currency}${top.amount.toLocaleString()} (${top.percentage}% of total expenses). Top 3 categories: ${top3}.`;
  }

  if (q.includes('summary') || q.includes('overview') || q.includes('how am i doing') || q.includes('month')) {
    return `Month-to-Date Financial Overview:\n• Total Income: ${context.currency}${context.totalIncome.toLocaleString()}\n• Total Expenses: ${context.currency}${context.totalExpense.toLocaleString()}\n• Net Savings: ${context.currency}${context.netSavings.toLocaleString()}\n• Budget Spent: ${context.budgetPercentage}% (${context.currency}${context.budgetSpent.toLocaleString()} of ${context.currency}${context.monthlyBudget.toLocaleString()})\n• Safe Daily Rate: ${context.currency}${context.safeDailySpend.toLocaleString()}/day for the next ${context.daysRemainingInMonth} days.`;
  }

  if (q.includes('goal') || q.includes('savings')) {
    if (context.activeGoals.length === 0) {
      return `You don't have any active savings goals yet. Create one in the Student Hub to track savings for college supplies, laptops, or emergencies!`;
    }
    const goalSummary = context.activeGoals.map((g) => `• ${g.title}: ${context.currency}${g.current.toLocaleString()} / ${context.currency}${g.target.toLocaleString()} (${g.percentage}%)`).join('\n');
    return `Here is your current savings goal status:\n${goalSummary}\nYour current month net savings is ${context.currency}${context.netSavings.toLocaleString()}.`;
  }

  return `Here is your quick financial status: You've spent ${context.currency}${context.budgetSpent.toLocaleString()} of your ${context.currency}${context.monthlyBudget.toLocaleString()} budget (${context.budgetPercentage}%). You have ${context.currency}${context.budgetRemaining.toLocaleString()} remaining with a safe daily velocity of ${context.currency}${context.safeDailySpend.toLocaleString()}/day across the next ${context.daysRemainingInMonth} days.`;
}

/**
 * Handle query using Gemini API with exact financial context
 */
export async function askFinancialAssistant(
  question: string,
  context: FinancialSummaryContext
): Promise<{ answer: string; deterministicCalculation: string }> {
  const deterministicAnswer = getDeterministicAnswer(question, context);
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') {
    return {
      answer: deterministicAnswer,
      deterministicCalculation: `Computed with verifiable ledger math (Budget: ${context.currency}${context.monthlyBudget}, Spent: ${context.currency}${context.budgetSpent}, Remaining: ${context.currency}${context.budgetRemaining})`,
    };
  }

  try {
    const ai = new GoogleGenAI({ apiKey });
    const prompt = `You are an empathetic, sharp college student financial advisor inside the Smart Student Expense Tracker.
You provide clear, direct, and actionable advice to help students manage allowance, hostel fees, and savings.

CRITICAL RULES:
1. ONLY cite exact numbers from the verified data below. NEVER invent or hallucinate amounts.
2. The user's active currency is ${context.currency}.
3. Keep responses concise (2 to 4 sentences or a clean bullet list).
4. Explain how values are derived (e.g. "Safe daily rate = Remaining budget / Days left").

VERIFIED STUDENT FINANCIAL DATA:
- Currency: ${context.currency}
- Total Income this month: ${context.currency}${context.totalIncome}
- Total Expenses this month: ${context.currency}${context.totalExpense}
- Net Savings this month: ${context.currency}${context.netSavings}
- Monthly Budget: ${context.currency}${context.monthlyBudget}
- Spent towards Budget: ${context.currency}${context.budgetSpent} (${context.budgetPercentage}%)
- Remaining Budget: ${context.currency}${context.budgetRemaining}
- Days Remaining in Month: ${context.daysRemainingInMonth} days
- Safe Daily Spending Limit: ${context.currency}${context.safeDailySpend} / day
- Top Spending Categories: ${JSON.stringify(context.topCategories)}
- Recent Transactions: ${JSON.stringify(context.recentTransactions)}
- Active Savings Goals: ${JSON.stringify(context.activeGoals)}

STUDENT QUESTION: "${question}"

Provide a friendly, financially accurate, and direct response:`;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
    });

    const aiText = response.text?.trim();
    return {
      answer: aiText || deterministicAnswer,
      deterministicCalculation: `Ground truth: Budget ${context.currency}${context.monthlyBudget} | Spent ${context.currency}${context.budgetSpent} | Remaining ${context.currency}${context.budgetRemaining} (${context.daysRemainingInMonth} days remaining)`,
    };
  } catch (err) {
    console.warn('Gemini API call failed, falling back to deterministic answer:', err);
    return {
      answer: deterministicAnswer,
      deterministicCalculation: `Ground truth: Budget ${context.currency}${context.monthlyBudget} | Spent ${context.currency}${context.budgetSpent} | Remaining ${context.currency}${context.budgetRemaining}`,
    };
  }
}
