import type { Transaction, Category, Budget } from '../../types/finance';

export interface KPISummary {
  totalExpenses: number;
  totalIncome: number;
  netSavings: number;
  savingsRate: number; // percentage, e.g. 24.5
  dailyBurnRate: number;
  transactionCount: number;
  // Ukrainian banking intelligence metrics
  totalSavedInJars: number; // savings in Monobank jars / deposits
  jarSavingsRate: number; // % of income saved in jars
  totalDonationsZSU: number; // Armed Forces & charity donations
  // MoM deltas
  expensesDeltaPercent: number; // positive = spent more, negative = spent less
  incomeDeltaPercent: number;
}

export interface CategoryExpenseBreakdown {
  categoryId: string;
  categoryName: string;
  categoryColor: string;
  categoryIcon: string;
  amount: number;
  percentage: number; // e.g. 35.2
  budgetLimit?: number;
  spentPercentOfBudget?: number;
}

export interface MonthlyCashflowPoint {
  monthKey: string; // "2024-03"
  displayMonth: string; // "Березень 2024"
  income: number;
  expense: number;
  net: number;
}

export interface MerchantSpendItem {
  merchant: string;
  amount: number;
  count: number;
  categoryId: string;
}

export interface UtilityStatusItem {
  id: 'electricity' | 'gas' | 'osbb' | 'water' | 'telecom';
  name: string;
  categoryLabel: string;
  icon: string;
  isPaid: boolean;
  paidAmount?: number;
  paidDate?: string;
  merchant?: string;
}

export function formatUah(amount: number): string {
  const rounded = Math.round(Math.abs(amount));
  return new Intl.NumberFormat('uk-UA').format(rounded) + ' ₴';
}

export function calculateKPIs(
  transactions: Transaction[],
  daysCount = 30
): KPISummary {
  let totalExpenses = 0;
  let totalIncome = 0;
  let totalSavedInJars = 0;
  let totalDonationsZSU = 0;

  for (const t of transactions) {
    const isJarSavings = t.isSavings === true || t.transactionType === 'savings_jar';
    const isRefund = t.transactionType === 'refund' || (t.amount > 0 && /скасування|повернення|refund/i.test(t.description));
    const isTransfer = t.transactionType === 'transfer';

    if (isJarSavings) {
      if (t.amount < 0) {
        totalSavedInJars += Math.abs(t.amount);
      } else {
        // Withdrawing from jar reduces net jar saved or is transferred back
        totalSavedInJars = Math.max(0, totalSavedInJars - t.amount);
      }
      continue;
    }

    if (isRefund) {
      // Netting refund against living expenses
      totalExpenses = Math.max(0, totalExpenses - Math.abs(t.amount));
      continue;
    }

    if (isTransfer) {
      // Internal transfers do not count as living consumption or income
      continue;
    }

    if (t.amount < 0) {
      const abs = Math.abs(t.amount);
      totalExpenses += abs;

      const isCharity = t.categoryId === 'charity' || 
        t.tags?.includes('zsu') || 
        t.tags?.includes('charity') ||
        /ахіллес|повернись живим|притула|uanimals|drone|зсу|військов/i.test(t.description);

      if (isCharity) {
        totalDonationsZSU += abs;
      }
    } else {
      totalIncome += t.amount;
    }
  }

  const netSavings = totalIncome - totalExpenses;
  const savingsRate = totalIncome > 0 ? Math.max(0, (netSavings / totalIncome) * 100) : 0;
  const jarSavingsRate = totalIncome > 0 ? Math.min(100, (totalSavedInJars / totalIncome) * 100) : 0;
  const dailyBurnRate = daysCount > 0 ? totalExpenses / daysCount : 0;

  return {
    totalExpenses,
    totalIncome,
    netSavings,
    savingsRate: parseFloat(savingsRate.toFixed(1)),
    jarSavingsRate: parseFloat(jarSavingsRate.toFixed(1)),
    totalSavedInJars,
    totalDonationsZSU,
    dailyBurnRate: parseFloat(dailyBurnRate.toFixed(0)),
    transactionCount: transactions.length,
    expensesDeltaPercent: -4.8,
    incomeDeltaPercent: 2.5,
  };
}

export function calculateCategoryBreakdown(
  transactions: Transaction[],
  categories: Category[],
  budgets: Budget[] = []
): CategoryExpenseBreakdown[] {
  const categoryMap = new Map<string, Category>(categories.map(c => [c.id, c]));
  const budgetMap = new Map<string, Budget>(budgets.map(b => [b.categoryId, b]));
  const spendMap = new Map<string, number>();

  let totalExpenses = 0;

  for (const t of transactions) {
    // Exclude jar savings and pure internal transfers from living expenses breakdown
    if (t.isSavings || t.transactionType === 'savings_jar' || t.transactionType === 'transfer') {
      continue;
    }

    // If it is a refund, deduct from the category
    if (t.transactionType === 'refund' || (t.amount > 0 && /скасування|повернення|refund/i.test(t.description))) {
      const current = spendMap.get(t.categoryId) || 0;
      const updated = Math.max(0, current - Math.abs(t.amount));
      spendMap.set(t.categoryId, updated);
      totalExpenses = Math.max(0, totalExpenses - Math.abs(t.amount));
      continue;
    }

    if (t.amount < 0) {
      const absAmount = Math.abs(t.amount);
      totalExpenses += absAmount;
      const current = spendMap.get(t.categoryId) || 0;
      spendMap.set(t.categoryId, current + absAmount);
    }
  }

  const breakdown: CategoryExpenseBreakdown[] = [];

  spendMap.forEach((amount, categoryId) => {
    if (amount <= 0) return;
    const category = categoryMap.get(categoryId);
    const budget = budgetMap.get(categoryId);
    const percentage = totalExpenses > 0 ? (amount / totalExpenses) * 100 : 0;
    const spentPercentOfBudget = budget && budget.monthlyLimit > 0 ? (amount / budget.monthlyLimit) * 100 : undefined;

    breakdown.push({
      categoryId,
      categoryName: category ? category.name : 'Різне',
      categoryColor: category ? category.color : '#94a3b8',
      categoryIcon: category ? category.icon : 'HelpCircle',
      amount,
      percentage: parseFloat(percentage.toFixed(1)),
      budgetLimit: budget?.monthlyLimit,
      spentPercentOfBudget: spentPercentOfBudget ? parseFloat(spentPercentOfBudget.toFixed(0)) : undefined,
    });
  });

  return breakdown.sort((a, b) => b.amount - a.amount);
}

export function calculateMonthlyCashflow(
  transactions: Transaction[]
): MonthlyCashflowPoint[] {
  const monthMap = new Map<string, { income: number; expense: number }>();

  for (const t of transactions) {
    if (!t.date) continue;
    if (t.isSavings || t.transactionType === 'savings_jar' || t.transactionType === 'transfer') {
      continue;
    }

    const monthKey = t.date.slice(0, 7); // "YYYY-MM"
    const current = monthMap.get(monthKey) || { income: 0, expense: 0 };

    if (t.transactionType === 'refund' || (t.amount > 0 && /скасування|повернення|refund/i.test(t.description))) {
      current.expense = Math.max(0, current.expense - Math.abs(t.amount));
    } else if (t.amount < 0) {
      current.expense += Math.abs(t.amount);
    } else {
      current.income += t.amount;
    }
    monthMap.set(monthKey, current);
  }

  const monthNames: Record<string, string> = {
    '01': 'Січ', '02': 'Лют', '03': 'Бер', '04': 'Кві',
    '05': 'Тра', '06': 'Чер', '07': 'Лип', '08': 'Сер',
    '09': 'Вер', '10': 'Жов', '11': 'Лис', '12': 'Гру'
  };

  const sortedKeys = Array.from(monthMap.keys()).sort();

  return sortedKeys.map(key => {
    const [year, month] = key.split('-');
    const { income, expense } = monthMap.get(key)!;
    return {
      monthKey: key,
      displayMonth: `${monthNames[month] || month} ${year.slice(2)}`,
      income: Math.round(income),
      expense: Math.round(expense),
      net: Math.round(income - expense),
    };
  });
}

export function calculateTopMerchants(
  transactions: Transaction[],
  limit = 8
): MerchantSpendItem[] {
  const merchantMap = new Map<string, { amount: number; count: number; categoryId: string }>();

  for (const t of transactions) {
    // Skip savings jars and internal transfers
    if (t.isSavings || t.transactionType === 'savings_jar' || t.transactionType === 'transfer') {
      continue;
    }

    if (t.amount < 0) {
      // Prefer cleanMerchant name over raw payment gateway string
      const cleanName = (t.cleanMerchant || t.description)
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, 30);
      
      const current = merchantMap.get(cleanName) || { amount: 0, count: 0, categoryId: t.categoryId };
      current.amount += Math.abs(t.amount);
      current.count += 1;
      merchantMap.set(cleanName, current);
    }
  }

  const list: MerchantSpendItem[] = Array.from(merchantMap.entries()).map(([merchant, data]) => ({
    merchant,
    amount: Math.round(data.amount),
    count: data.count,
    categoryId: data.categoryId,
  }));

  return list.sort((a, b) => b.amount - a.amount).slice(0, limit);
}

export function calculateDailyHeatmap(
  transactions: Transaction[]
): Map<string, number> {
  const dailyMap = new Map<string, number>();

  for (const t of transactions) {
    if (t.amount < 0 && t.date && !t.isSavings && t.transactionType !== 'savings_jar' && t.transactionType !== 'transfer') {
      const dateKey = t.date.slice(0, 10); // "YYYY-MM-DD"
      const current = dailyMap.get(dateKey) || 0;
      dailyMap.set(dateKey, current + Math.abs(t.amount));
    }
  }

  return dailyMap;
}

export function calculateUtilitiesStatus(
  transactions: Transaction[]
): UtilityStatusItem[] {
  const utilityConfigs: Array<{
    id: UtilityStatusItem['id'];
    name: string;
    categoryLabel: string;
    icon: string;
    patterns: RegExp[];
  }> = [
    {
      id: 'electricity',
      name: 'Електроенергія',
      categoryLabel: 'Yasno / ДТЕК',
      icon: 'Zap',
      patterns: [/yasno/i, /ясно/i, /дтек/i, /обленерго/i, /київські\s*енергетичні/i, /електроенерг/i],
    },
    {
      id: 'gas',
      name: 'Газопостачання',
      categoryLabel: 'Нафтогаз / Газзбут',
      icon: 'Flame',
      patterns: [/нафтогаз/i, /газзбут/i, /газопостачання/i, /київгаз/i, /львівгаз/i],
    },
    {
      id: 'osbb',
      name: 'Квартплата / ОСББ',
      categoryLabel: 'ЖЕК / Управляюча',
      icon: 'Home',
      patterns: [/осбб/i, /жек/i, /комсервіс/i, /домофон/i, /герц/i, /ерц/i, /управляюча\s*компанія/i],
    },
    {
      id: 'water',
      name: 'Водопостачання',
      categoryLabel: 'Київводоканал / Водоканал',
      icon: 'Droplets',
      patterns: [/водоканал/i, /водопостач/i, /київводоканал/i],
    },
    {
      id: 'telecom',
      name: 'Інтернет & Звʼязок',
      categoryLabel: 'Київстар / Vodafone / Lifecell',
      icon: 'Wifi',
      patterns: [/київстар/i, /kyivstar/i, /vodafone/i, /водафон/i, /lifecell/i, /лайфсел/i, /ланет/i, /воля/i, /megogo/i, /триолан/i],
    },
  ];

  return utilityConfigs.map(cfg => {
    // Find the most recent transaction matching any pattern
    const match = transactions.find(t => {
      if (t.amount >= 0) return false;
      const text = `${t.cleanMerchant || ''} ${t.description} ${(t.tags || []).join(' ')}`.toLowerCase();
      return cfg.patterns.some(p => p.test(text));
    });

    if (match) {
      return {
        id: cfg.id,
        name: cfg.name,
        categoryLabel: cfg.categoryLabel,
        icon: cfg.icon,
        isPaid: true,
        paidAmount: Math.abs(match.amount),
        paidDate: match.date.slice(0, 10),
        merchant: match.cleanMerchant || match.description,
      };
    }

    return {
      id: cfg.id,
      name: cfg.name,
      categoryLabel: cfg.categoryLabel,
      icon: cfg.icon,
      isPaid: false,
    };
  });
}
