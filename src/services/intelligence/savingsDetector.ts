import type { EnrichedIntelligenceResult } from './types';

/**
 * Detects Monobank rounding rules, percentage-on-whims, and personal jar savings
 */
export function detectSavings(description: string, amount: number): EnrichedIntelligenceResult | null {
  const desc = description.trim();
  const lower = desc.toLowerCase();

  // Exceptions: Military / charity jars (these are donations, not personal savings)
  const isMilitaryOrCharity = 
    lower.includes('3 ошб') || 
    lower.includes('ббс') || 
    lower.includes('ахіллес') || 
    lower.includes('uanimals') ||
    lower.includes('зсу') ||
    lower.includes('донація') ||
    lower.includes('благодій');

  if (isMilitaryOrCharity) {
    return null; // Handled by merchantDictionary / charity detection
  }

  // 1. Balance Rounding to Jars ("Округлення балансу «...»")
  if (lower.includes('округлення балансу') || lower.includes('округлення залишку')) {
    const jarNameMatch = desc.match(/[«"'](.+?)[»"']/);
    const jarName = jarNameMatch ? jarNameMatch[1] : 'Скарбничка';

    return {
      transactionType: 'savings_jar',
      cleanMerchant: `Округлення (${jarName})`,
      categoryId: 'savings',
      subCategory: 'Округлення решти',
      tags: ['savings', 'jar', 'rounding'],
      isSavings: true,
    };
  }

  // 2. Spending Percentage Jar ("На примхи")
  if (lower === 'на примхи' || lower.startsWith('на примхи')) {
    return {
      transactionType: 'savings_jar',
      cleanMerchant: 'Накопичення «На примхи»',
      categoryId: 'savings',
      subCategory: 'Відсоток від витрат',
      tags: ['savings', 'jar', 'whims'],
      isSavings: true,
    };
  }

  // 3. Deposit or Withdrawal from Personal Jar ("Поповнення «...»", "Часткове зняття банки «...»")
  if (lower.includes('поповнення «') || lower.includes('зняття банки «') || lower.includes('поповнення банки «')) {
    const jarNameMatch = desc.match(/[«"'](.+?)[»"']/);
    const jarName = jarNameMatch ? jarNameMatch[1] : 'Банка';
    const isWithdrawal = lower.includes('зняття') || amount > 0;

    return {
      transactionType: 'savings_jar',
      cleanMerchant: isWithdrawal ? `Зняття з банки (${jarName})` : `Поповнення банки (${jarName})`,
      categoryId: 'savings',
      subCategory: isWithdrawal ? 'Зняття заощаджень' : 'Поповнення банки',
      tags: ['savings', 'jar', isWithdrawal ? 'withdrawal' : 'deposit'],
      isSavings: true,
    };
  }

  // 4. Fixed Bank Term Deposit ("Відкриття депозиту")
  if (lower.includes('відкриття депозиту') || lower.includes('поповнення депозиту')) {
    return {
      transactionType: 'savings_jar',
      cleanMerchant: 'Депозит Monobank',
      categoryId: 'savings',
      subCategory: 'Строковий депозит',
      tags: ['savings', 'deposit'],
      isSavings: true,
    };
  }

  return null;
}

export function detectSavingsTransaction(description: string, amount: number) {
  const res = detectSavings(description, amount);
  return {
    isSavings: res?.isSavings ?? false,
    ruleName: res?.tags?.includes('rounding') ? 'monobank_rounding' : (res?.tags?.includes('whims') ? 'monobank_whims' : undefined),
    tags: res?.tags?.map(t => t === 'whims' ? 'savings_whims' : (t === 'withdrawal' ? 'jar_withdrawal' : t)) ?? [],
    cleanMerchant: res?.cleanMerchant,
  };
}
