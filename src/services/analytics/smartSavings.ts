import type { Transaction, Category, SavingInsight } from '../../types/finance';
import { formatUah } from './kpiCalculator';

export function analyzeSavingsOpportunities(
  transactions: Transaction[],
  categories: Category[]
): SavingInsight[] {
  if (transactions.length < 5) return [];

  const insights: SavingInsight[] = [];
  const categoryMap = new Map(categories.map(c => [c.id, c]));

  // 1. Recurring Subscriptions Detector
  const subscriptionKeywords = ['netflix', 'spotify', 'apple', 'google', 'youtube', 'megogo', 'kyivstar', 'vodafone', 'lifecell', 'chatgpt', 'gym', 'спортзал', 'підписка'];
  const monthlySubscriptionCandidates = new Map<string, { totalAmount: number; count: number; lastAmount: number }>();

  for (const t of transactions) {
    if (t.amount < 0) {
      const descLower = t.description.toLowerCase();
      const isSubKeyword = subscriptionKeywords.some(k => descLower.includes(k));
      if (isSubKeyword || t.categoryId === 'subscriptions') {
        const cleanName = t.description.slice(0, 20).trim();
        const current = monthlySubscriptionCandidates.get(cleanName) || { totalAmount: 0, count: 0, lastAmount: 0 };
        current.totalAmount += Math.abs(t.amount);
        current.count += 1;
        current.lastAmount = Math.abs(t.amount);
        monthlySubscriptionCandidates.set(cleanName, current);
      }
    }
  }

  let totalSubMonthly = 0;
  const activeSubs: string[] = [];
  monthlySubscriptionCandidates.forEach((data, name) => {
    totalSubMonthly += data.lastAmount;
    activeSubs.push(name);
  });

  if (activeSubs.length > 0) {
    const annualSubCost = totalSubMonthly * 12;
    insights.push({
      id: 'insight_subscriptions',
      type: 'subscription',
      title: `Регулярні підписки: ${activeSubs.length} активних сервісів`,
      description: `Ви витрачаєте приблизно ${formatUah(totalSubMonthly)} на місяць (${formatUah(annualSubCost)} на рік) на регулярні сервіси (${activeSubs.slice(0, 3).join(', ')}...). Ревізія невикористовуваних сервісів може зберегти до 30% цієї суми.`,
      potentialMonthlySavings: Math.round(totalSubMonthly * 0.3),
      potentialAnnualSavings: Math.round(annualSubCost * 0.3),
      severity: annualSubCost > 10000 ? 'warning' : 'info',
      actionText: 'Переглянути список підписок',
    });
  }

  // 2. Micro-expenses ("Latte Factor") Aggregator
  const microExpenses = transactions.filter(
    t => t.amount < 0 && Math.abs(t.amount) <= 180 && ['dining', 'groceries', 'other'].includes(t.categoryId)
  );

  if (microExpenses.length >= 8) {
    const totalMicroSpend = microExpenses.reduce((sum, t) => sum + Math.abs(t.amount), 0);
    const avgMonthlyMicro = totalMicroSpend / Math.max(1, Math.ceil(transactions.length / 40));
    const potentialMonthly = Math.round(avgMonthlyMicro * 0.35);

    insights.push({
      id: 'insight_latte_factor',
      type: 'latte_factor',
      title: 'Ефект лате: оптимізація дрібних витрат',
      description: `Дрібні регулярні покупки до 180 ₴ (кава з собою, перекуси, дрібниці) склали ${formatUah(totalMicroSpend)} (${microExpenses.length} разів). Зменшення кількості імпульсивних покупок на третину збереже вам солідну суму.`,
      potentialMonthlySavings: potentialMonthly,
      potentialAnnualSavings: potentialMonthly * 12,
      severity: 'warning',
      actionText: 'Встановити ліміт на каву та перекуси',
    });
  }

  // 3. Category Spike Detection (e.g. Dining / Restaurants vs Groceries)
  const diningExpenses = transactions
    .filter(t => t.amount < 0 && t.categoryId === 'dining')
    .reduce((sum, t) => sum + Math.abs(t.amount), 0);

  const groceryExpenses = transactions
    .filter(t => t.amount < 0 && t.categoryId === 'groceries')
    .reduce((sum, t) => sum + Math.abs(t.amount), 0);

  if (diningExpenses > 0 && groceryExpenses > 0 && diningExpenses > groceryExpenses * 0.7) {
    const potentialSaving = Math.round(diningExpenses * 0.25);
    insights.push({
      id: 'insight_dining_spike',
      type: 'spike',
      title: 'Висока частка витрат на ресторани та доставку',
      description: `Витрати на заклади та доставку їжі (${formatUah(diningExpenses)}) складають значну частку від домашніх продуктів (${formatUah(groceryExpenses)}). Приготування страв вдома навіть на 2 дні більше на тиждень збереже відчутний бюджет.`,
      potentialMonthlySavings: potentialSaving,
      potentialAnnualSavings: potentialSaving * 12,
      severity: 'warning',
      categoryId: 'dining',
      actionText: 'Встановити бюджет на кафе',
    });
  }

  // 4. 50/30/20 Budget Rule Check
  let totalIncome = 0;
  let totalNeeds = 0;
  let totalWants = 0;

  for (const t of transactions) {
    if (t.amount > 0) {
      totalIncome += t.amount;
    } else {
      const cat = categoryMap.get(t.categoryId);
      if (cat?.isEssential) {
        totalNeeds += Math.abs(t.amount);
      } else {
        totalWants += Math.abs(t.amount);
      }
    }
  }

  if (totalIncome > 0) {
    const wantsRatio = (totalWants / totalIncome) * 100;
    if (wantsRatio > 35) {
      const excessWants = totalWants - (totalIncome * 0.3);
      insights.push({
        id: 'insight_50_30_20',
        type: 'budget_50_30_20',
        title: 'Баланс бюджету: перевищення частки «Бажань»',
        description: `За правилом здорового бюджету 50/30/20, витрати на розваги, шопінг і ресторани не мають перевищувати 30% доходу. Зараз вони складають ${wantsRatio.toFixed(0)}%. Скорочення другорядних витрат дозволить наростити заощадження.`,
        potentialMonthlySavings: Math.max(500, Math.round(excessWants / 6)),
        potentialAnnualSavings: Math.max(6000, Math.round(excessWants * 2)),
        severity: 'info',
        actionText: 'Оптимізувати категорійні ліміти',
      });
    }
  }

  return insights;
}
