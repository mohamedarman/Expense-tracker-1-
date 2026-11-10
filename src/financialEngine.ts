import {
  User,
  Transaction,
  Category,
  Budget,
  BudgetResponse,
  CategoryBudgetDetail,
  SavingsGoal,
  RecurringPayment,
  DebtRecord,
  AnalyticsResponse,
  FinancialInsight,
} from './types.ts';

export const DEFAULT_SYSTEM_CATEGORIES: Category[] = [
  { id: 'cat-food', userId: null, name: 'Food & Mess', kind: 'expense', color: '#10b981', icon: 'Utensils', isEssential: true },
  { id: 'cat-hostel', userId: null, name: 'Hostel & Rent', kind: 'expense', color: '#06b6d4', icon: 'Home', isEssential: true },
  { id: 'cat-books', userId: null, name: 'Books & Academics', kind: 'expense', color: '#3b82f6', icon: 'BookOpen', isEssential: true },
  { id: 'cat-fees', userId: null, name: 'College Fees', kind: 'expense', color: '#6366f1', icon: 'GraduationCap', isEssential: true },
  { id: 'cat-transport', userId: null, name: 'Transport & Commute', kind: 'expense', color: '#8b5cf6', icon: 'Bus', isEssential: true },
  { id: 'cat-bills', userId: null, name: 'Bills & Mobile Recharge', kind: 'expense', color: '#ec4899', icon: 'Smartphone', isEssential: true },
  { id: 'cat-health', userId: null, name: 'Health & Pharmacy', kind: 'expense', color: '#14b8a6', icon: 'HeartPulse', isEssential: true },
  { id: 'cat-entertainment', userId: null, name: 'Entertainment & Outings', kind: 'expense', color: '#f59e0b', icon: 'Film', isEssential: false },
  { id: 'cat-shopping', userId: null, name: 'Shopping & Gear', kind: 'expense', color: '#f97316', icon: 'ShoppingBag', isEssential: false },
  { id: 'cat-personal', userId: null, name: 'Personal Care', kind: 'expense', color: '#eab308', icon: 'Sparkles', isEssential: false },
  { id: 'cat-other-exp', userId: null, name: 'Other Expenses', kind: 'expense', color: '#64748b', icon: 'MoreHorizontal', isEssential: false },
  { id: 'cat-allowance', userId: null, name: 'Allowance / Pocket Money', kind: 'income', color: '#10b981', icon: 'Wallet', isEssential: true },
  { id: 'cat-scholarship', userId: null, name: 'Scholarship / Grant', kind: 'income', color: '#06b6d4', icon: 'Award', isEssential: true },
  { id: 'cat-job', userId: null, name: 'Part-time Job / Internship', kind: 'income', color: '#3b82f6', icon: 'Briefcase', isEssential: true },
  { id: 'cat-freelance', userId: null, name: 'Freelance / Tutoring', kind: 'income', color: '#8b5cf6', icon: 'Laptop', isEssential: true },
  { id: 'cat-gift', userId: null, name: 'Gifts & Awards', kind: 'income', color: '#f59e0b', icon: 'Gift', isEssential: false },
  { id: 'cat-other-inc', userId: null, name: 'Other Income', kind: 'income', color: '#64748b', icon: 'ArrowDownLeft', isEssential: false },
];

export function roundMoney(num: number): number {
  if (isNaN(num) || !isFinite(num)) return 0;
  return Math.round((num + Number.EPSILON) * 100) / 100;
}

export function computeBudgetsResponse(
  user: User,
  userBudgets: Budget[],
  allTxs: Transaction[],
  month?: string
): BudgetResponse {
  const now = new Date();
  const targetMonth = month || `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const monthBudgets = userBudgets.filter((b) => b.month === targetMonth);
  const monthTxs = allTxs.filter((t) => t.kind === 'expense' && t.date.startsWith(targetMonth));

  const totalSpent = monthTxs.reduce((sum, t) => sum + t.amount, 0);
  const overallLimit = user.monthlyBudget || 0;
  const overallUsage = overallLimit > 0 ? (totalSpent / overallLimit) * 100 : 0;

  const categoryBudgets: CategoryBudgetDetail[] = monthBudgets.map((b) => {
    const catSpent = monthTxs.filter((t) => t.categoryId === b.categoryId).reduce((sum, t) => sum + t.amount, 0);
    const usage = b.amount > 0 ? (catSpent / b.amount) * 100 : 0;
    return {
      ...b,
      spent: roundMoney(catSpent),
      remaining: roundMoney(Math.max(0, b.amount - catSpent)),
      usage: roundMoney(usage),
      isExceeded: catSpent > b.amount,
      isWarning: usage >= b.warningThreshold,
    };
  });

  return {
    month: targetMonth,
    overall: {
      limit: roundMoney(overallLimit),
      spent: roundMoney(totalSpent),
      remaining: roundMoney(Math.max(0, overallLimit - totalSpent)),
      usage: roundMoney(overallUsage),
      isExceeded: overallLimit > 0 && totalSpent > overallLimit,
      isWarning: overallUsage >= 80,
    },
    categoryBudgets,
    allBudgets: monthBudgets,
  };
}

export function computeAnalyticsResponse(
  user: User,
  allTxs: Transaction[],
  categories: Category[]
): AnalyticsResponse {
  const now = new Date();
  const yearMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const monthTxs = allTxs.filter((t) => t.date.startsWith(yearMonth));

  const totalIncome = monthTxs.filter((t) => t.kind === 'income').reduce((sum, t) => sum + t.amount, 0);
  const totalExpense = monthTxs.filter((t) => t.kind === 'expense').reduce((sum, t) => sum + t.amount, 0);
  const savings = totalIncome - totalExpense;
  const budget = user.monthlyBudget || 0;
  const remainingBudget = Math.max(0, budget - totalExpense);

  const dayOfMonth = now.getDate();
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const daysLeft = Math.max(1, daysInMonth - dayOfMonth);
  const avgDailySpendSoFar = dayOfMonth > 0 ? totalExpense / dayOfMonth : 0;
  const safeDailySpend = budget > 0 ? remainingBudget / daysLeft : 0;

  const catMap = new Map<string, { amount: number; isEssential: boolean }>();
  let essentialExpense = 0;
  let discretionaryExpense = 0;

  for (const tx of monthTxs) {
    if (tx.kind === 'expense') {
      const cat = categories.find((c) => c.id === tx.categoryId);
      const isEss = cat ? cat.isEssential : true;
      if (isEss) essentialExpense += tx.amount;
      else discretionaryExpense += tx.amount;

      const current = catMap.get(tx.categoryId) || { amount: 0, isEssential: isEss };
      current.amount += tx.amount;
      catMap.set(tx.categoryId, current);
    }
  }

  const categoryBreakdown = Array.from(catMap.entries())
    .map(([cid, data]) => {
      const cat = categories.find((c) => c.id === cid);
      return {
        name: cat ? cat.name : 'Other',
        amount: roundMoney(data.amount),
        color: cat ? cat.color : '#3b82f6',
        kind: 'expense' as const,
        isEssential: data.isEssential,
      };
    })
    .sort((a, b) => b.amount - a.amount);

  const monthlyTrends: { month: string; label: string; income: number; expense: number; savings: number }[] = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const mStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const mLabel = d.toLocaleString('default', { month: 'short' });
    const mTxs = allTxs.filter((t) => t.date.startsWith(mStr));

    let inc = 0;
    let exp = 0;
    for (const t of mTxs) {
      if (t.kind === 'income') inc += t.amount;
      else exp += t.amount;
    }
    monthlyTrends.push({
      month: mStr,
      label: mLabel,
      income: roundMoney(inc),
      expense: roundMoney(exp),
      savings: roundMoney(inc - exp),
    });
  }

  let health = 100;
  if (budget > 0 && totalExpense > budget) health -= 30;
  else if (budget > 0 && totalExpense > budget * 0.8) health -= 15;
  if (savings < 0 && monthTxs.length > 0) health -= 15;
  if (monthTxs.length === 0) health = 100;
  health = Math.min(100, Math.max(20, health));

  return {
    currentMonth: {
      income: roundMoney(totalIncome),
      expense: roundMoney(totalExpense),
      savings: roundMoney(savings),
      budget: roundMoney(budget),
      remainingBudget: roundMoney(remainingBudget),
      essentialExpense: roundMoney(essentialExpense),
      discretionaryExpense: roundMoney(discretionaryExpense),
      daysLeftInMonth: daysLeft,
      safeDailySpend: roundMoney(safeDailySpend),
      avgDailySpendSoFar: roundMoney(avgDailySpendSoFar),
      healthScore: health,
    },
    categoryBreakdown,
    monthlyTrends,
  };
}

export function computeInsightsResponse(
  user: User,
  allTxs: Transaction[]
): { insights: FinancialInsight[]; context: any } {
  const curr = user.currency || '₹';
  const insights: FinancialInsight[] = [];

  if (allTxs.length === 0) {
    insights.push(
      {
        type: 'info',
        title: 'Welcome to CostCurve!',
        message: 'Your private cloud ledger is active and empty. Click "New entry" above to record your first income or expense.',
      },
      {
        type: 'tip',
        title: 'Establish Your Monthly Budget',
        message: `Your active monthly allowance budget is set to ${curr}${user.monthlyBudget.toLocaleString()}. Your daily safe-to-spend allowance will adapt automatically as you record expenses.`,
      }
    );
  } else {
    const now = new Date();
    const yearMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const monthTxs = allTxs.filter((t) => t.date.startsWith(yearMonth));
    const totalExpense = monthTxs.filter((t) => t.kind === 'expense').reduce((sum, t) => sum + t.amount, 0);
    const totalIncome = monthTxs.filter((t) => t.kind === 'income').reduce((sum, t) => sum + t.amount, 0);

    if (totalExpense > user.monthlyBudget && user.monthlyBudget > 0) {
      insights.push({
        type: 'alert',
        title: 'Monthly Budget Threshold Exceeded',
        message: `Total expenses (${curr}${totalExpense.toLocaleString()}) have surpassed your planned allowance (${curr}${user.monthlyBudget.toLocaleString()}). Prioritize essential campus expenses for the rest of the month.`,
      });
    } else if (totalIncome > totalExpense) {
      insights.push({
        type: 'success',
        title: 'Positive Monthly Savings Pace',
        message: `You are currently saving ${curr}${(totalIncome - totalExpense).toLocaleString()} this month. Consider depositing this surplus into your savings goals.`,
      });
    }

    insights.push({
      type: 'tip',
      title: 'Daily Spending Discipline',
      message: 'Keep daily non-essential purchases within your calculated allowance to stay comfortably ahead of your semester budget goals.',
    });
  }

  return {
    insights,
    context: {
      user: user.name,
      currency: curr,
      transactionCount: allTxs.length,
    },
  };
}

export function evaluateBudgetAdvisorQuestion(
  question: string,
  user: User,
  allTxs: Transaction[],
  categories: Category[],
  recurringPayments: RecurringPayment[],
  savingsGoals: SavingsGoal[],
  debts: DebtRecord[]
): { answer: string; deterministicCalculation: string } {
  const curr = user.currency || '₹';
  const now = new Date();
  const yearMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const daysRemaining = Math.max(1, daysInMonth - now.getDate() + 1);

  const monthTxs = allTxs.filter((t) => t.date.startsWith(yearMonth));
  const totalIncome = monthTxs.filter((t) => t.kind === 'income').reduce((sum, t) => sum + t.amount, 0);
  const totalExpense = monthTxs.filter((t) => t.kind === 'expense').reduce((sum, t) => sum + t.amount, 0);
  const netSavings = totalIncome - totalExpense;
  const budgetRemaining = user.monthlyBudget - totalExpense;
  const safeDailySpend = Math.max(0, Math.round(budgetRemaining / daysRemaining));

  const catMap = new Map<string, { name: string; spent: number; count: number }>();
  for (const tx of monthTxs) {
    if (tx.kind === 'expense') {
      const cat = categories.find((c) => c.id === tx.categoryId);
      const name = cat?.name || tx.categoryName || 'Uncategorized';
      const existing = catMap.get(name) || { name, spent: 0, count: 0 };
      existing.spent += tx.amount;
      existing.count += 1;
      catMap.set(name, existing);
    }
  }
  const categoryTotals = Array.from(catMap.values()).sort((a, b) => b.spent - a.spent);
  const topCategory = categoryTotals[0];

  const allTimeCatMap = new Map<string, { name: string; spent: number; count: number }>();
  for (const tx of allTxs) {
    if (tx.kind === 'expense') {
      const cat = categories.find((c) => c.id === tx.categoryId);
      const name = cat?.name || tx.categoryName || 'Uncategorized';
      const existing = allTimeCatMap.get(name) || { name, spent: 0, count: 0 };
      existing.spent += tx.amount;
      existing.count += 1;
      allTimeCatMap.set(name, existing);
    }
  }
  const allTimeCategoryTotals = Array.from(allTimeCatMap.values()).sort((a, b) => b.spent - a.spent);
  const allTimeTopCategory = allTimeCategoryTotals[0];

  const allTimeExpense = allTxs.filter((t) => t.kind === 'expense').reduce((sum, t) => sum + t.amount, 0);
  const allTimeIncome = allTxs.filter((t) => t.kind === 'income').reduce((sum, t) => sum + t.amount, 0);

  const activeBills = recurringPayments.filter((b) => b.status === 'active');
  const activeDebts = debts.filter((d) => d.status === 'pending');

  const q = question.trim().toLowerCase();
  const cleanedForNumbers = question.replace(/,/g, '');
  const numberMatches = cleanedForNumbers.match(/\d+(?:\.\d+)?/g);
  const parsedAmount = numberMatches ? parseFloat(numberMatches[0]) : null;

  if (
    q.includes('afford') ||
    q.includes('outing') ||
    q.includes('buy') ||
    q.includes('purchase') ||
    q.includes('spend on') ||
    (parsedAmount !== null && parsedAmount > 0 && (q.includes('can i') || q.includes('should i') || q.includes('worth')))
  ) {
    const targetAmount = parsedAmount && parsedAmount > 0 ? parsedAmount : 2000;
    const postPurchaseRemaining = budgetRemaining - targetAmount;
    const postPurchaseDaily = Math.max(0, Math.round(postPurchaseRemaining / daysRemaining));

    if (allTxs.length === 0) {
      const canAffordEmpty = user.monthlyBudget >= targetAmount;
      return {
        answer: canAffordEmpty
          ? `There is no transaction history recorded yet, so analyzing against your baseline monthly budget of ${curr}${user.monthlyBudget.toLocaleString()}:\n\n• Requested spend: ${curr}${targetAmount.toLocaleString()}\n• Budget after spend: ${curr}${postPurchaseRemaining.toLocaleString()}\n• Adjusted daily limit (${daysRemaining} days left): ${curr}${postPurchaseDaily.toLocaleString()}/day\n\nYou can cover this within your ${curr}${user.monthlyBudget.toLocaleString()} target, though logging your fixed expenses (rent, mess, or bills) first will give a stricter margin.`
          : `There are no transactions recorded yet, and a ${curr}${targetAmount.toLocaleString()} spend already exceeds your configured monthly budget of ${curr}${user.monthlyBudget.toLocaleString()} by ${curr}${Math.abs(postPurchaseRemaining).toLocaleString()}. Increase your monthly budget or reduce the planned spend.`,
        deterministicCalculation: `Baseline budget ${curr}${user.monthlyBudget.toLocaleString()} − ${curr}${targetAmount.toLocaleString()} = ${curr}${postPurchaseRemaining.toLocaleString()} (${allTxs.length} ledger entries)`,
      };
    }

    const canAfford = postPurchaseRemaining >= 0;
    return {
      answer: canAfford
        ? `Yes, you can fit a ${curr}${targetAmount.toLocaleString()} spend into your current month's budget:\n\n• Current remaining budget: ${curr}${budgetRemaining.toLocaleString()} (of ${curr}${user.monthlyBudget.toLocaleString()})\n• Remaining after ${curr}${targetAmount.toLocaleString()} spend: ${curr}${postPurchaseRemaining.toLocaleString()}\n• Safe daily allowance shift: ${curr}${safeDailySpend.toLocaleString()}/day → ${curr}${postPurchaseDaily.toLocaleString()}/day across the next ${daysRemaining} days.`
        : `No — spending ${curr}${targetAmount.toLocaleString()} right now would push you over your monthly budget target:\n\n• Current remaining budget: ${curr}${budgetRemaining.toLocaleString()} (spent ${curr}${totalExpense.toLocaleString()} of ${curr}${user.monthlyBudget.toLocaleString()})\n• Projected deficit after spend: -${curr}${Math.abs(postPurchaseRemaining).toLocaleString()}\n• Safe daily allowance right now: ${curr}${safeDailySpend.toLocaleString()}/day.`,
      deterministicCalculation: `Remaining ${curr}${budgetRemaining.toLocaleString()} − ${curr}${targetAmount.toLocaleString()} = ${curr}${postPurchaseRemaining.toLocaleString()} (${postPurchaseDaily.toLocaleString()}/day for ${daysRemaining}d)`,
    };
  }

  if (
    q.includes('highest') ||
    q.includes('top') ||
    q.includes('category') ||
    q.includes('categories') ||
    q.includes('most on') ||
    q.includes('where did my money') ||
    q.includes('breakdown')
  ) {
    if (allTxs.length === 0) {
      return {
        answer: `Insufficient transaction data to rank expense categories — your ledger currently has 0 recorded transactions.\n\nLog at least one expense (for example under Food & Mess, Hostel & Rent, or Transport) to compute your highest spending category and percentage share.`,
        deterministicCalculation: `0 expense categories active (${yearMonth})`,
      };
    }

    if (categoryTotals.length === 0 && allTimeCategoryTotals.length > 0) {
      const share = allTimeExpense > 0 ? Math.round((allTimeTopCategory.spent / allTimeExpense) * 100) : 0;
      const breakdownLines = allTimeCategoryTotals
        .slice(0, 4)
        .map((c, idx) => `${idx + 1}. ${c.name}: ${curr}${c.spent.toLocaleString()} (${c.count} tx)`)
        .join('\n');
      return {
        answer: `You have no expenses logged in ${yearMonth} yet, so here is your all-time highest expense category breakdown:\n\n• Highest category: ${allTimeTopCategory.name} at ${curr}${allTimeTopCategory.spent.toLocaleString()} (${share}% of all-time spend)\n\nCategory ranking:\n${breakdownLines}`,
        deterministicCalculation: `All-time top category: ${allTimeTopCategory.name} = ${curr}${allTimeTopCategory.spent.toLocaleString()} / ${curr}${allTimeExpense.toLocaleString()}`,
      };
    }

    if (!topCategory) {
      return {
        answer: `You have ${allTxs.length} income transaction(s) logged, but 0 expense records so far. Record an expense transaction to see your highest spending category.`,
        deterministicCalculation: `Total expenses: ${curr}0 across ${allTxs.length} ledger records`,
      };
    }

    const topShare = totalExpense > 0 ? Math.round((topCategory.spent / totalExpense) * 100) : 0;
    const list = categoryTotals
      .slice(0, 5)
      .map((c, idx) => {
        const pct = totalExpense > 0 ? Math.round((c.spent / totalExpense) * 100) : 0;
        return `${idx + 1}. ${c.name}: ${curr}${c.spent.toLocaleString()} (${pct}% · ${c.count} ${c.count === 1 ? 'entry' : 'entries'})`;
      })
      .join('\n');

    return {
      answer: `Your highest expense category in ${yearMonth} is ${topCategory.name}, accounting for ${curr}${topCategory.spent.toLocaleString()} (${topShare}% of your ${curr}${totalExpense.toLocaleString()} monthly spend).\n\nMonthly category ranking:\n${list}`,
      deterministicCalculation: `Top category (${yearMonth}): ${topCategory.name} = ${curr}${topCategory.spent.toLocaleString()} (${topShare}% of ${curr}${totalExpense.toLocaleString()})`,
    };
  }

  if (
    q.includes('daily') ||
    q.includes('safe') ||
    q.includes('limit') ||
    q.includes('allowance') ||
    q.includes('per day') ||
    q.includes('today') ||
    q.includes('burn')
  ) {
    if (allTxs.length === 0) {
      const baselineDaily = Math.max(0, Math.round(user.monthlyBudget / daysRemaining));
      return {
        answer: `No expenses have been logged in ${yearMonth} yet. Based on your full monthly budget target of ${curr}${user.monthlyBudget.toLocaleString()} and ${daysRemaining} days left in the month:\n\n• Safe daily spend limit: ${curr}${baselineDaily.toLocaleString()}/day\n• Spent this month: ${curr}0\n• Remaining budget: ${curr}${user.monthlyBudget.toLocaleString()}`,
        deterministicCalculation: `${curr}${user.monthlyBudget.toLocaleString()} ÷ ${daysRemaining} days left = ${curr}${baselineDaily.toLocaleString()}/day`,
      };
    }

    return {
      answer:
        budgetRemaining > 0
          ? `Your safe daily spend limit for the remaining ${daysRemaining} days of ${yearMonth} is ${curr}${safeDailySpend.toLocaleString()}/day.\n\n• Monthly budget target: ${curr}${user.monthlyBudget.toLocaleString()}\n• Spent so far (${monthTxs.filter((t) => t.kind === 'expense').length} expenses): ${curr}${totalExpense.toLocaleString()}\n• Remaining budget: ${curr}${budgetRemaining.toLocaleString()}`
          : `Your safe daily spend limit is ${curr}0/day because your monthly expenses (${curr}${totalExpense.toLocaleString()}) have already exceeded your ${curr}${user.monthlyBudget.toLocaleString()} budget by ${curr}${Math.abs(budgetRemaining).toLocaleString()}. Pause non-essential spending for the remaining ${daysRemaining} days of ${yearMonth}.`,
      deterministicCalculation: `(${curr}${user.monthlyBudget.toLocaleString()} − ${curr}${totalExpense.toLocaleString()}) ÷ ${daysRemaining} days = ${curr}${safeDailySpend.toLocaleString()}/day`,
    };
  }

  if (
    q.includes('summary') ||
    q.includes('monthly') ||
    q.includes('overview') ||
    q.includes('report') ||
    q.includes('status') ||
    q.includes('how am i doing')
  ) {
    if (allTxs.length === 0) {
      return {
        answer: `Monthly summary for ${yearMonth} — insufficient transaction data (0 records logged):\n\n• Monthly budget target: ${curr}${user.monthlyBudget.toLocaleString()}\n• Total income (${yearMonth}): ${curr}0\n• Total expenses (${yearMonth}): ${curr}0\n• Remaining budget: ${curr}${user.monthlyBudget.toLocaleString()}\n• Safe daily allowance (${daysRemaining}d left): ${curr}${safeDailySpend.toLocaleString()}/day\n\nAdd your stipend, allowance, or daily expenses using the "New entry" button to populate your monthly cashflow metrics.`,
        deterministicCalculation: `${yearMonth}: 0 transactions | Budget ${curr}${user.monthlyBudget.toLocaleString()} intact`,
      };
    }

    const budgetUsedPct = user.monthlyBudget > 0 ? Math.round((totalExpense / user.monthlyBudget) * 100) : 0;
    return {
      answer: `Monthly summary for ${yearMonth} (${monthTxs.length} transactions this month, ${allTxs.length} total):\n\n• Total income: ${curr}${totalIncome.toLocaleString()}\n• Total expenses: ${curr}${totalExpense.toLocaleString()} (${budgetUsedPct}% of ${curr}${user.monthlyBudget.toLocaleString()} budget)\n• Net cashflow: ${netSavings >= 0 ? '+' : '-'}${curr}${Math.abs(netSavings).toLocaleString()}\n• Remaining budget: ${curr}${budgetRemaining.toLocaleString()}\n• Safe daily limit (${daysRemaining}d left): ${curr}${safeDailySpend.toLocaleString()}/day\n• Top expense category: ${topCategory ? `${topCategory.name} (${curr}${topCategory.spent.toLocaleString()})` : 'None this month'}`,
      deterministicCalculation: `Income ${curr}${totalIncome.toLocaleString()} − Expense ${curr}${totalExpense.toLocaleString()} = Net ${curr}${netSavings.toLocaleString()} (${budgetUsedPct}% budget used)`,
    };
  }

  if (
    q.includes('bill') ||
    q.includes('hostel') ||
    q.includes('rent') ||
    q.includes('mess') ||
    q.includes('subscription') ||
    q.includes('recurring') ||
    q.includes('due')
  ) {
    const billTotal = activeBills.reduce((sum, b) => sum + b.amount, 0);
    if (activeBills.length === 0) {
      return {
        answer: `You currently have 0 active recurring bills or subscriptions configured.\n\n• Active recurring commitments: 0 (${curr}0)\n\nOpen the Recurring bills view to track recurring hostel fees, mess bills, rent, or streaming memberships.`,
        deterministicCalculation: `0 active recurring obligations (${curr}0/month)`,
      };
    }

    const billLines = activeBills
      .slice(0, 5)
      .map((b) => `• ${b.title}: ${curr}${b.amount.toLocaleString()} (${b.frequency}, next due ${b.nextDueDate})`)
      .join('\n');

    return {
      answer: `Here are your active recurring commitments (${activeBills.length} active):\n\n${billLines}\n\nTotal scheduled amount: ${curr}${billTotal.toLocaleString()}.`,
      deterministicCalculation: `${activeBills.length} active recurring commitments = ${curr}${billTotal.toLocaleString()}`,
    };
  }

  if (q.includes('goal') || q.includes('saving') || q.includes('target')) {
    if (savingsGoals.length === 0) {
      return {
        answer: `You have 0 savings goals configured right now.\n\n• Current month net cashflow: ${netSavings >= 0 ? '+' : '-'}${curr}${Math.abs(netSavings).toLocaleString()}\n• Visit the Budgets and goals tab to set up a target (such as an emergency fund, laptop upgrade, or semester fee reserve).`,
        deterministicCalculation: `0 active savings goals | Monthly net cashflow: ${curr}${netSavings.toLocaleString()}`,
      };
    }

    const totalSaved = savingsGoals.reduce((s, g) => s + g.currentAmount, 0);
    const totalTarget = savingsGoals.reduce((s, g) => s + g.targetAmount, 0);
    const goalLines = savingsGoals
      .map((g) => {
        const pct = g.targetAmount > 0 ? Math.round((g.currentAmount / g.targetAmount) * 100) : 0;
        return `• ${g.title}: ${curr}${g.currentAmount.toLocaleString()} / ${curr}${g.targetAmount.toLocaleString()} (${pct}%)`;
      })
      .join('\n');

    return {
      answer: `You are tracking ${savingsGoals.length} savings ${savingsGoals.length === 1 ? 'goal' : 'goals'}:\n\n${goalLines}\n\nTotal saved across goals: ${curr}${totalSaved.toLocaleString()} of ${curr}${totalTarget.toLocaleString()}.`,
      deterministicCalculation: `Goals progress: ${curr}${totalSaved.toLocaleString()} / ${curr}${totalTarget.toLocaleString()} (${savingsGoals.length} goals)`,
    };
  }

  if (q.includes('debt') || q.includes('owe') || q.includes('iou') || q.includes('split') || q.includes('friend') || q.includes('borrow') || q.includes('lent')) {
    const owedToYou = activeDebts.filter((d) => d.type === 'owes_you').reduce((s, d) => s + d.amount, 0);
    const youOwe = activeDebts.filter((d) => d.type === 'you_owe').reduce((s, d) => s + d.amount, 0);

    if (activeDebts.length === 0) {
      return {
        answer: `You have no unsettled peer IOUs or bill splits in the Campus hub.\n\n• Owed to you: ${curr}0\n• You owe others: ${curr}0`,
        deterministicCalculation: `0 unsettled IOUs | Net peer balance: ${curr}0`,
      };
    }

    const netPeer = owedToYou - youOwe;
    return {
      answer: `Unsettled peer splits & IOUs (${activeDebts.length} open):\n\n• Classmates owe you: ${curr}${owedToYou.toLocaleString()}\n• You owe others: ${curr}${youOwe.toLocaleString()}\n• Net peer position: ${netPeer >= 0 ? '+' : '-'}${curr}${Math.abs(netPeer).toLocaleString()}`,
      deterministicCalculation: `Owed to you ${curr}${owedToYou.toLocaleString()} − You owe ${curr}${youOwe.toLocaleString()} = ${curr}${netPeer.toLocaleString()}`,
    };
  }

  if (q.includes('income') || q.includes('earn') || q.includes('stipend') || q.includes('salary') || q.includes('pocket money')) {
    const incomeCount = monthTxs.filter((t) => t.kind === 'income').length;
    if (allTxs.length === 0) {
      return {
        answer: `There is no income recorded in your ledger yet (0 transactions).\n\nLog your monthly allowance, scholarship, or part-time income using "New entry" → "Income" to track your net savings rate.`,
        deterministicCalculation: `Income (${yearMonth}): ${curr}0 across 0 entries`,
      };
    }
    return {
      answer: `Income summary for ${yearMonth}:\n\n• Monthly income: ${curr}${totalIncome.toLocaleString()} (${incomeCount} ${incomeCount === 1 ? 'entry' : 'entries'})\n• All-time recorded income: ${curr}${allTimeIncome.toLocaleString()}\n• Net savings this month (income minus expenses): ${netSavings >= 0 ? '+' : '-'}${curr}${Math.abs(netSavings).toLocaleString()}`,
      deterministicCalculation: `${yearMonth} income: ${curr}${totalIncome.toLocaleString()} | All-time income: ${curr}${allTimeIncome.toLocaleString()}`,
    };
  }

  if (q.includes('recent') || q.includes('last') || q.includes('latest') || q.includes('history') || q.includes('transactions')) {
    if (allTxs.length === 0) {
      return {
        answer: `Your transaction history is empty (0 records). Add your first expense or income entry to see recent ledger activity.`,
        deterministicCalculation: `0 transactions in ledger`,
      };
    }
    const sorted = [...allTxs].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 5);
    const lines = sorted
      .map((t) => `• ${t.date} — ${t.description || t.categoryName}: ${t.kind === 'income' ? '+' : '-'}${curr}${t.amount.toLocaleString()} (${t.paymentMethod})`)
      .join('\n');
    return {
      answer: `Here are your ${sorted.length} most recent transactions (out of ${allTxs.length} total):\n\n${lines}`,
      deterministicCalculation: `Showing ${sorted.length} of ${allTxs.length} total ledger entries`,
    };
  }

  const matchedCategory = categories.find(
    (c) => (c.userId === null || c.userId === user.id) && q.includes(c.name.toLowerCase())
  );
  if (matchedCategory) {
    const catTxs = allTxs.filter((t) => t.categoryId === matchedCategory.id);
    const catTotal = catTxs.reduce((s, t) => s + t.amount, 0);
    return {
      answer:
        catTxs.length > 0
          ? `You have ${catTxs.length} transaction(s) in "${matchedCategory.name}" totaling ${curr}${catTotal.toLocaleString()}.`
          : `You have 0 transactions recorded under "${matchedCategory.name}" so far.`,
      deterministicCalculation: `Category "${matchedCategory.name}": ${catTxs.length} entries = ${curr}${catTotal.toLocaleString()}`,
    };
  }

  if (allTxs.length === 0) {
    return {
      answer: `Regarding "${question}": your ledger currently has 0 recorded transactions, so there is insufficient transaction history to compute historical trends.\n\nHere is your current baseline configuration:\n• Monthly budget target: ${curr}${user.monthlyBudget.toLocaleString()}\n• Safe daily allowance (${daysRemaining} days left in ${yearMonth}): ${curr}${safeDailySpend.toLocaleString()}/day\n• Active recurring bills: ${activeBills.length} | Savings goals: ${savingsGoals.length}\n\nTry asking "Can I afford a ${curr}2,000 outing?", "Safe daily spend limit", or log a transaction to analyze category totals.`,
      deterministicCalculation: `Ledger empty (0 transactions) | Baseline budget: ${curr}${user.monthlyBudget.toLocaleString()}`,
    };
  }

  return {
    answer: `Analysis for "${question}" based on your ${yearMonth} ledger:\n\n• Monthly expenses: ${curr}${totalExpense.toLocaleString()} across ${monthTxs.filter((t) => t.kind === 'expense').length} entries (budget: ${curr}${user.monthlyBudget.toLocaleString()})\n• Remaining budget: ${curr}${budgetRemaining.toLocaleString()} (${curr}${safeDailySpend.toLocaleString()}/day safe limit for ${daysRemaining} days)\n• Highest category: ${topCategory ? `${topCategory.name} (${curr}${topCategory.spent.toLocaleString()})` : (allTimeTopCategory ? `${allTimeTopCategory.name} (${curr}${allTimeTopCategory.spent.toLocaleString()} all-time)` : 'None')}\n• All-time ledger: ${allTxs.length} total entries (Expenses: ${curr}${allTimeExpense.toLocaleString()}, Income: ${curr}${allTimeIncome.toLocaleString()})`,
    deterministicCalculation: `Budget ${curr}${user.monthlyBudget.toLocaleString()} − Spent ${curr}${totalExpense.toLocaleString()} = ${curr}${budgetRemaining.toLocaleString()} (${curr}${safeDailySpend.toLocaleString()}/day)`,
  };
}
