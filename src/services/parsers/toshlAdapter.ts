import type { Transaction, UnresolvedDateRow } from '../../types/finance';
import { computeTransactionHash } from './deduplication';
import { enrichTransaction } from '../intelligence/recognitionEngine';
import { formatCardMask, extractCardLast4, cleanCardName } from '../../utils/cardUtils';

export function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || (year % 400 === 0);
}

export function isValidCalendarDate(day: number, month: number, year: number): boolean {
  if (year < 1900 || year > 2100) return false;
  if (month < 1 || month > 12) return false;
  const daysInMonth = [31, (isLeapYear(year) ? 29 : 28), 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  return day >= 1 && day <= daysInMonth[month - 1];
}

export function parseAndValidateToshlDate(rawDate: any): {
  isValid: boolean;
  isoDate?: string;
  error?: string;
} {
  if (rawDate === null || rawDate === undefined) {
    return { isValid: false, error: 'Дата відсутня' };
  }

  // Handle JS Date object (e.g. from Excel parser)
  if (rawDate instanceof Date) {
    if (isNaN(rawDate.getTime())) {
      return { isValid: false, error: 'Некоректний об’єкт дати' };
    }
    const y = rawDate.getFullYear();
    const m = rawDate.getMonth() + 1;
    const d = rawDate.getDate();
    if (!isValidCalendarDate(d, m, y)) {
      return { isValid: false, error: 'Дата поза межами календаря' };
    }
    const isoDate = `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    return { isValid: true, isoDate };
  }

  // Handle Excel serial date number
  if (typeof rawDate === 'number' && !isNaN(rawDate) && rawDate > 0) {
    const jsDate = new Date(Math.round((rawDate - 25569) * 86400 * 1000));
    if (!isNaN(jsDate.getTime())) {
      const y = jsDate.getUTCFullYear();
      const m = jsDate.getUTCMonth() + 1;
      const d = jsDate.getUTCDate();
      if (isValidCalendarDate(d, m, y)) {
        return { isValid: true, isoDate: `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}` };
      }
    }
  }

  const str = String(rawDate).trim();
  if (!str) {
    return { isValid: false, error: 'Дата порожня' };
  }

  // Format 1: DD.MM.YY or DD.MM.YYYY (also supports D.M.YY, DD-MM-YY, DD/MM/YY)
  const dotMatch = str.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{2}|\d{4})$/);
  if (dotMatch) {
    const day = parseInt(dotMatch[1], 10);
    const month = parseInt(dotMatch[2], 10);
    let year = parseInt(dotMatch[3], 10);
    if (dotMatch[3].length === 2) {
      year = 2000 + year;
    }

    if (!isValidCalendarDate(day, month, year)) {
      return { isValid: false, error: `Некоректна календарна дата ${str}` };
    }

    const isoDate = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    return { isValid: true, isoDate };
  }

  // Format 2: ISO YYYY-MM-DD
  const isoMatch = str.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (isoMatch) {
    const year = parseInt(isoMatch[1], 10);
    const month = parseInt(isoMatch[2], 10);
    const day = parseInt(isoMatch[3], 10);

    if (!isValidCalendarDate(day, month, year)) {
      return { isValid: false, error: `Некоректна календарна дата ${str}` };
    }

    const isoDate = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    return { isValid: true, isoDate };
  }

  return { isValid: false, error: `Формат дати не відповідає DD.MM.YY або DD.MM.YYYY (${str})` };
}

export function isToshlStatement(headers: string[]): boolean {
  const normalized = headers.map(h => h.toLowerCase().trim());

  // Reject if it contains Mono Budget signature
  if (normalized.some(h => h.includes('excluded from budget') || h.includes('виключено з бюджету'))) {
    return false;
  }

  const hasDate = normalized.includes('date');
  const hasCategory = normalized.includes('category');
  const hasToshlExpense = normalized.some(h => h.includes('expense amount') || h === 'expense');
  const hasToshlIncome = normalized.some(h => h.includes('income amount') || h === 'income');
  const hasMainCurrency = normalized.some(h => h.includes('main currency'));
  const hasAccount = normalized.includes('account');

  // Authentic Toshl export has either 'Expense amount' or 'Income amount' or 'Main currency'
  return hasDate && hasCategory && (hasToshlExpense || hasToshlIncome || (hasAccount && hasMainCurrency));
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
): Promise<{ transactions: Transaction[]; unresolvedRows: UnresolvedDateRow[] }> {
  const transactions: Transaction[] = [];
  const unresolvedRows: UnresolvedDateRow[] = [];

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

    const rawDate = row[dateKey];
    const dateValidation = parseAndValidateToshlDate(rawDate);

    if (!dateValidation.isValid || !dateValidation.isoDate) {
      unresolvedRows.push({
        rowIndex: i,
        rawRow: row,
        description: rawDesc,
        amount,
        currency,
        originalCategory: rawCategory,
        account: rawAccount,
        rawDate: rawDate !== undefined && rawDate !== null ? String(rawDate).trim() : '',
        errorReason: dateValidation.error || 'Некоректний або відсутній формат дати (очікується DD.MM.YYYY)',
      });
      continue;
    }

    const date = dateValidation.isoDate;

    // Account role and card profiling
    let accountRole: string | undefined;
    let accountId = rawAccount;
    let cardLast4: string | undefined = extractCardLast4(rawAccount);

    const lowerAcc = rawAccount.toLowerCase();
    if (lowerAcc.includes('white') || lowerAcc.includes('біла')) {
      accountRole = 'shared_family';
      accountId = 'monobank_white';
    } else if (lowerAcc.includes('black') || lowerAcc.includes('чорна')) {
      accountRole = 'personal';
      accountId = 'monobank_black';
      if (!cardLast4) cardLast4 = '1234';
    } else if (lowerAcc.includes('madeinukraine') || lowerAcc.includes('національний')) {
      accountRole = 'cashback_national';
      accountId = 'monobank_madeinukraine';
    } else if (lowerAcc.includes('cash') || lowerAcc.includes('готівка')) {
      accountId = 'cash';
    }

    const accountName = cleanCardName(rawAccount, cardLast4, 'Рахунок');

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
      accountName,
      cardLast4,
      cardNumberMasked: cardLast4 ? formatCardMask(cardLast4) : undefined,
      transactionType: enriched.transactionType,
      isSavings: Boolean(enriched.isSavings),
      isSubscription: enriched.isSubscription,
    });
  }

  return { transactions, unresolvedRows };
}

export async function createTransactionFromResolvedDate(
  unresolved: UnresolvedDateRow,
  validIsoDate: string
): Promise<Transaction> {
  const row = unresolved.rawRow || {};
  const keys = Object.keys(row);
  const descKey = keys.find(k => k.toLowerCase() === 'description') || keys[1];
  const categoryKey = keys.find(k => k.toLowerCase() === 'category');
  const tagsKey = keys.find(k => k.toLowerCase() === 'tags');
  const accountKey = keys.find(k => k.toLowerCase() === 'account');

  const rawCategory = categoryKey ? String(row[categoryKey] || 'Other').trim() : (unresolved.originalCategory || 'Other');
  const rawDesc = descKey ? String(row[descKey] || rawCategory).trim() : unresolved.description;
  const rawAccount = accountKey && row[accountKey] ? String(row[accountKey]).trim() : (unresolved.account || 'toshl_account');
  const currency = unresolved.currency || 'UAH';
  const amount = unresolved.amount;

  let accountRole: string | undefined;
  let accountId = rawAccount;
  let cardLast4: string | undefined = extractCardLast4(rawAccount);

  const lowerAcc = rawAccount.toLowerCase();
  if (lowerAcc.includes('white') || lowerAcc.includes('біла')) {
    accountRole = 'shared_family';
    accountId = 'monobank_white';
  } else if (lowerAcc.includes('black') || lowerAcc.includes('чорна')) {
    accountRole = 'personal';
    accountId = 'monobank_black';
    if (!cardLast4) cardLast4 = '1234';
  } else if (lowerAcc.includes('madeinukraine') || lowerAcc.includes('національний')) {
    accountRole = 'cashback_national';
    accountId = 'monobank_madeinukraine';
  } else if (lowerAcc.includes('cash') || lowerAcc.includes('готівка')) {
    accountId = 'cash';
  }

  const accountName = cleanCardName(rawAccount, cardLast4, 'Рахунок');

  const rowTags = tagsKey && row[tagsKey] 
    ? String(row[tagsKey]).split(',').map(s => s.trim()).filter(Boolean) 
    : [];

  const mapped = mapToshlCategory(rawCategory);

  const enriched = enrichTransaction({
    description: rawDesc,
    amount,
    categoryId: amount > 0 ? 'income_salary' : mapped.categoryId,
    subCategory: mapped.subCategory,
  }, accountRole);

  const mergedTags = Array.from(new Set([...rowTags, ...(enriched.tags || [])]));
  const hash = await computeTransactionHash(validIsoDate, amount, rawDesc, accountId);

  return {
    id: `toshl_${hash.slice(0, 16)}_${unresolved.rowIndex}`,
    hash,
    date: validIsoDate,
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
    accountName,
    cardLast4,
    cardNumberMasked: cardLast4 ? formatCardMask(cardLast4) : undefined,
    transactionType: enriched.transactionType,
    isSavings: Boolean(enriched.isSavings),
    isSubscription: enriched.isSubscription,
  };
}

