import type { Transaction } from '../../types/finance';
import { computeTransactionHash } from './deduplication';
import { enrichTransaction } from '../intelligence/recognitionEngine';
import { formatCardMask } from '../../utils/cardUtils';

export function isToshlStatement(headers: string[]): boolean {
  const normalized = headers.map(h => h.toLowerCase().trim());
  const hasDate = normalized.includes('date');
  const hasCategory = normalized.includes('category');
  const hasExpense = normalized.some(h => h.includes('expense') || h.includes('amount'));
  const hasAccount = normalized.includes('account');

  return (hasDate && hasCategory && (hasExpense || hasAccount));
}

export function mapToshlCategory(rawCategory: string): { categoryId: string; subCategory?: string } {
  const cat = rawCategory.toLowerCase().trim();

  if (cat.includes('grocer') || cat.includes('food') || cat.includes('supermarket') || cat.includes('продукти')) {
    return { categoryId: 'groceries' };
  }
  if (cat.includes('restaur') || cat.includes('dining') || cat.includes('caf') || cat.includes('coffee') || cat.includes('кафе') || cat.includes('бар')) {
    return { categoryId: 'dining' };
  }
  if (cat.includes('transport') || cat.includes('car') || cat.includes('fuel') || cat.includes('gas') || cat.includes('taxi') || cat.includes('транспорт') || cat.includes('авто')) {
    return { categoryId: 'transport' };
  }
  if (cat.includes('home') || cat.includes('rent') || cat.includes('bill') || cat.includes('utilit') || cat.includes('житло') || cat.includes('комунал')) {
    return { categoryId: 'housing' };
  }
  if (cat.includes('health') || cat.includes('pharm') || cat.includes('med') || cat.includes('sport') || cat.includes('лікар') || cat.includes('аптек')) {
    return { categoryId: 'health' };
  }
  if (cat.includes('subscript') || cat.includes('soft') || cat.includes('stream') || cat.includes('phone') || cat.includes('підписк')) {
    return { categoryId: 'subscriptions' };
  }
  if (cat.includes('shop') || cat.includes('cloth') || cat.includes('electr') || cat.includes('покупк') || cat.includes('одяг')) {
    return { categoryId: 'shopping' };
  }
  if (cat.includes('travel') || cat.includes('hotel') || cat.includes('flight') || cat.includes('holiday') || cat.includes('подорож')) {
    return { categoryId: 'travel' };
  }
  if (cat.includes('salary') || cat.includes('income') || cat.includes('дохід') || cat.includes('зарплат')) {
    return { categoryId: 'income_salary' };
  }

  return { categoryId: 'other' };
}

export async function parseToshlRows(
  rows: Record<string, any>[]
): Promise<Transaction[]> {
  const transactions: Transaction[] = [];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const keys = Object.keys(row);

    const dateKey = keys.find(k => k.toLowerCase() === 'date') || keys[0];
    const descKey = keys.find(k => k.toLowerCase() === 'description') || keys[1];
    const categoryKey = keys.find(k => k.toLowerCase() === 'category');
    const tagsKey = keys.find(k => k.toLowerCase() === 'tags');
    const expenseKey = keys.find(k => k.toLowerCase().includes('expense amount') || k.toLowerCase() === 'expense');
    const incomeKey = keys.find(k => k.toLowerCase().includes('income amount') || k.toLowerCase() === 'income');
    const amountKey = keys.find(k => k.toLowerCase() === 'amount');
    const accountKey = keys.find(k => k.toLowerCase() === 'account');
    const currencyKey = keys.find(k => k.toLowerCase() === 'currency');

    const rawDate = String(row[dateKey] || '').trim();
    if (!rawDate) continue;

    let date = rawDate;
    if (!date.includes('T')) {
      date = `${date}T12:00:00`;
    }

    let amount = 0;
    if (expenseKey && row[expenseKey] !== undefined && row[expenseKey] !== '') {
      const exp = parseFloat(String(row[expenseKey]).replace(/\s/g, '').replace(',', '.'));
      if (!isNaN(exp) && exp > 0) amount = -exp;
    } else if (incomeKey && row[incomeKey] !== undefined && row[incomeKey] !== '') {
      const inc = parseFloat(String(row[incomeKey]).replace(/\s/g, '').replace(',', '.'));
      if (!isNaN(inc) && inc > 0) amount = inc;
    } else if (amountKey && row[amountKey] !== undefined) {
      amount = parseFloat(String(row[amountKey]).replace(/\s/g, '').replace(',', '.'));
    }

    if (isNaN(amount) || amount === 0) continue;

    const rawCategory = categoryKey ? String(row[categoryKey] || 'Other').trim() : 'Other';
    const rawDesc = descKey ? String(row[descKey] || rawCategory).trim() : rawCategory;
    const rawAccount = accountKey && row[accountKey] ? String(row[accountKey]).trim() : 'toshl_account';
    const currency = currencyKey && row[currencyKey] ? String(row[currencyKey]).trim().toUpperCase() : 'UAH';

    // Account role and card profiling
    let accountRole: string | undefined;
    let accountId = rawAccount;
    let cardLast4: string | undefined;

    const lowerAcc = rawAccount.toLowerCase();
    if (lowerAcc.includes('white') || lowerAcc.includes('біла')) {
      accountRole = 'shared_family';
      accountId = 'monobank_white';
    } else if (lowerAcc.includes('black') || lowerAcc.includes('чорна')) {
      accountRole = 'personal';
      accountId = 'monobank_black';
      cardLast4 = '1234';
    } else if (lowerAcc.includes('madeinukraine') || lowerAcc.includes('національний')) {
      accountRole = 'cashback_national';
      accountId = 'monobank_madeinukraine';
    } else if (lowerAcc.includes('cash') || lowerAcc.includes('готівка')) {
      accountId = 'cash';
    }

    // Secondary tags from file
    const rowTags = tagsKey && row[tagsKey] 
      ? String(row[tagsKey]).split(',').map(s => s.trim()).filter(Boolean) 
      : [];

    const mapped = mapToshlCategory(rawCategory);

    // Intelligence Engine enrichment
    const enriched = enrichTransaction({
      description: rawDesc,
      amount,
      categoryId: amount > 0 ? 'income_salary' : mapped.categoryId,
      subCategory: mapped.subCategory,
    }, accountRole);

    const mergedTags = Array.from(new Set([...rowTags, ...(enriched.tags || [])]));

    const hash = await computeTransactionHash(date, amount, rawDesc, accountId);

    transactions.push({
      id: `toshl_${hash.slice(0, 16)}_${i}`,
      hash,
      date,
      amount,
      currency,
      description: rawDesc,
      cleanMerchant: enriched.cleanMerchant || rawDesc,
      originalCategory: rawCategory,
      categoryId: enriched.categoryId || mapped.categoryId,
      subCategory: enriched.subCategory || mapped.subCategory,
      tags: mergedTags.length > 0 ? mergedTags : undefined,
      source: 'toshl',
      accountId,
      cardLast4,
      cardNumberMasked: cardLast4 ? formatCardMask(cardLast4) : undefined,
      transactionType: enriched.transactionType,
      isSavings: Boolean(enriched.isSavings),
      isSubscription: enriched.isSubscription,
    });
  }

  return transactions;
}

