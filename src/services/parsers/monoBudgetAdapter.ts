import type { Transaction } from '../../types/finance';
import { computeTransactionHash } from './deduplication';
import { enrichTransaction } from '../intelligence/recognitionEngine';
import { formatCardMask, extractCardLast4, cleanCardName } from '../../utils/cardUtils';

/**
 * Checks whether the CSV/XLSX file headers match the Mono Budget (Моно Бюджет) export format.
 */
export function isMonoBudgetStatement(headers: string[]): boolean {
  const normalized = headers.map(h => h.toLowerCase().trim());
  
  // Specific signature column present only in Mono Budget
  const hasExcludedFromBudget = normalized.some(h => 
    h.includes('excluded from budget') || 
    h.includes('виключено з бюджету')
  );
  if (hasExcludedFromBudget) return true;

  // Combination check: Date, Description, Category, Amount, Account
  const hasDate = normalized.some(h => h === 'date' || h === 'дата');
  const hasDesc = normalized.some(h => h === 'description' || h === 'деталі' || h === 'опис');
  const hasCategory = normalized.some(h => h === 'category' || h === 'категорія');
  const hasAmount = normalized.some(h => h === 'amount' || h === 'сума');
  const hasAccount = normalized.some(h => h === 'account' || h === 'рахунок');

  // Must not have Toshl specific dual expense/income columns
  const hasToshlDualAmount = normalized.some(h => 
    h.includes('expense amount') || h.includes('income amount')
  );

  return hasDate && hasDesc && hasCategory && hasAmount && hasAccount && !hasToshlDualAmount;
}

/**
 * Parses Mono Budget date string: "2026-09-12 17:52" or "2026-09-12 17:52:00" or ISO.
 */
export function parseMonoBudgetDate(dateStr: string): string {
  if (!dateStr) return new Date().toISOString().slice(0, 19);
  const trimmed = dateStr.trim();

  // Format: "YYYY-MM-DD HH:mm" or "YYYY-MM-DD HH:mm:ss"
  const match = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})\s+(\d{2}):(\d{2})(?::(\d{2}))?/);
  if (match) {
    const [, year, month, day, hours, minutes, seconds = '00'] = match;
    return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}`;
  }

  // Fallback: "DD.MM.YYYY HH:mm:ss"
  const matchDotted = trimmed.match(/^(\d{2})\.(\d{2})\.(\d{4})\s+(\d{2}):(\d{2})(?::(\d{2}))?/);
  if (matchDotted) {
    const [, day, month, year, hours, minutes, seconds = '00'] = matchDotted;
    return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}`;
  }

  const d = new Date(trimmed);
  if (!isNaN(d.getTime())) {
    return d.toISOString().slice(0, 19);
  }

  return new Date().toISOString().slice(0, 19);
}

/**
 * Maps Ukrainian Mono Budget categories to internal system categories.
 */
export function mapMonoBudgetCategory(
  rawCategory: string, 
  rawDesc = '', 
  amount = 0
): { categoryId: string; subCategory?: string } {
  const cat = rawCategory.toLowerCase().trim();
  const desc = rawDesc.toLowerCase().trim();

  if (cat.includes('супермаркет') || cat.includes('продукт')) {
    return { categoryId: 'groceries', subCategory: 'Супермаркети' };
  }
  if (cat.includes('ресторан') || cat.includes('кафе') || cat.includes('бар') || cat.includes('харчування')) {
    return { categoryId: 'dining', subCategory: 'Ресторани' };
  }
  if (cat.includes('одяг') || cat.includes('взуття')) {
    return { categoryId: 'shopping', subCategory: 'Одяг та взуття' };
  }
  if (cat.includes('комунал') || cat.includes('житло')) {
    return { categoryId: 'housing', subCategory: 'Комунальні платежі' };
  }
  if (cat.includes('зв\'язок') || cat.includes('зв’язок') || cat.includes('звязок') || cat.includes('телефон')) {
    return { categoryId: 'subscriptions', subCategory: 'Мобільний зв\'язок' };
  }
  if (cat.includes('авто') || desc.includes('avto.pro') || desc.includes('мийка') || desc.includes('сто')) {
    return { categoryId: 'transport', subCategory: 'Авто' };
  }
  if (cat.includes('транспорт') || cat.includes('таксі')) {
    return { categoryId: 'transport', subCategory: 'Громадський транспорт' };
  }
  if (cat.includes('улюблен') || cat.includes('тварин') || cat.includes('зоо')) {
    return { categoryId: 'shopping', subCategory: 'Дім та затишок' };
  }
  if (cat.includes('розваг') || cat.includes('відпочинок') || cat.includes('ігри')) {
    return { categoryId: 'travel', subCategory: 'Хобі та дозвілля' };
  }
  if (cat.includes('здоров') || cat.includes('аптек') || cat.includes('лікар')) {
    return { categoryId: 'health', subCategory: 'Аптеки' };
  }
  if (cat.includes('переказ') || cat.includes('перевод')) {
    if (amount > 0) {
      if (desc.includes('сомбра') || desc.includes('тзов') || desc.includes('зарплат') || desc.includes('фоп')) {
        return { categoryId: 'income_salary', subCategory: 'Фриланс / ФОП' };
      }
      if (desc.includes('кешбек')) {
        return { categoryId: 'income_other', subCategory: 'Кешбек' };
      }
      return { categoryId: 'income_other', subCategory: 'Перекази від людей' };
    }
    // Tax payments (ГУК, ГУДПС)
    if (desc.includes('гук') || desc.includes('гудпс') || desc.includes('податк')) {
      return { categoryId: 'finance', subCategory: 'Податки' };
    }
    return { categoryId: 'finance', subCategory: 'Перекази' };
  }

  // Fallback
  return { categoryId: amount > 0 ? 'income_other' : 'other' };
}

/**
 * Parses all rows from a Mono Budget CSV/XLSX statement.
 */
export async function parseMonoBudgetRows(
  rows: Record<string, any>[]
): Promise<Transaction[]> {
  const transactions: Transaction[] = [];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const keys = Object.keys(row);

    const dateKey = keys.find(k => k.toLowerCase() === 'date' || k.toLowerCase().includes('дата')) || keys[0];
    const descKey = keys.find(k => k.toLowerCase() === 'description' || k.toLowerCase().includes('опис') || k.toLowerCase().includes('деталі')) || keys[1];
    const categoryKey = keys.find(k => k.toLowerCase() === 'category' || k.toLowerCase().includes('категорія'));
    const amountKey = keys.find(k => k.toLowerCase() === 'amount' || (k.toLowerCase().includes('сума') && !k.toLowerCase().includes('валюті')));
    const currencyKey = keys.find(k => k.toLowerCase() === 'currency' || k.toLowerCase().includes('валюта'));
    const accountKey = keys.find(k => k.toLowerCase() === 'account' || k.toLowerCase().includes('рахунок') || k.toLowerCase().includes('картка'));
    const tagsKey = keys.find(k => k.toLowerCase() === 'tags' || k.toLowerCase().includes('теги'));
    const noteKey = keys.find(k => k.toLowerCase() === 'note' || k.toLowerCase().includes('нотатка') || k.toLowerCase().includes('коментар'));
    const excludedKey = keys.find(k => k.toLowerCase().includes('excluded from budget') || k.toLowerCase().includes('виключено з бюджету'));

    const rawDate = String(row[dateKey] || '').trim();
    if (!rawDate) continue;

    let rawAmount = row[amountKey || 'Amount'];
    if (typeof rawAmount === 'string') {
      rawAmount = parseFloat(rawAmount.replace(/\s/g, '').replace(',', '.'));
    }
    if (typeof rawAmount !== 'number' || isNaN(rawAmount)) continue;

    const rawDesc = descKey && row[descKey] ? String(row[descKey]).trim() : 'Транзакція';
    const rawCategory = categoryKey && row[categoryKey] ? String(row[categoryKey]).trim() : 'Інше';
    const rawAccount = accountKey && row[accountKey] ? String(row[accountKey]).trim() : 'Чорна картка';
    const currency = currencyKey && row[currencyKey] ? String(row[currencyKey]).trim().toUpperCase() : 'UAH';
    const rawNote = noteKey && row[noteKey] ? String(row[noteKey]).trim() : undefined;

    // Check "Excluded from budget" column
    const rawExcluded = excludedKey && row[excludedKey] !== undefined ? String(row[excludedKey]).trim().toLowerCase() : '';
    const isExplicitlyExcluded = rawExcluded === 'так' || rawExcluded === 'yes' || rawExcluded === 'true';

    // Account ID and role inference
    let accountId = 'monobank_black';
    let accountName = 'Monobank Чорна';
    let cardLast4: string | undefined = extractCardLast4(rawAccount);
    let accountRole: string | undefined = 'personal';

    const lowerAcc = rawAccount.toLowerCase();
    if (lowerAcc.includes('чорн') || lowerAcc.includes('black')) {
      accountId = 'monobank_black';
      accountName = 'Monobank Чорна';
      accountRole = 'personal';
      if (!cardLast4) cardLast4 = '1234';
    } else if (lowerAcc.includes('біл') || lowerAcc.includes('white')) {
      accountId = 'monobank_white';
      accountName = 'Monobank Біла';
      accountRole = 'shared_family';
    } else if (lowerAcc.includes('фоп') || lowerAcc.includes('fop')) {
      accountId = 'monobank_fop';
      accountName = 'ФОП рахунок';
      accountRole = 'business';
    } else if (lowerAcc.includes('національний') || lowerAcc.includes('єпідтримка') || lowerAcc.includes('кешбек')) {
      accountId = 'monobank_cashback';
      accountName = cleanCardName(rawAccount, cardLast4, 'Monobank');
      accountRole = 'cashback_national';
    } else {
      accountId = `acc_${rawAccount.toLowerCase().replace(/[^a-z0-9а-яіїєґ]/gi, '_').slice(0, 20)}`;
      accountName = cleanCardName(rawAccount, cardLast4, 'Рахунок');
    }

    const date = parseMonoBudgetDate(rawDate);

    // Baseline category mapping
    const mapped = mapMonoBudgetCategory(rawCategory, rawDesc, rawAmount);

    // Intelligence Engine enrichment
    const enriched = enrichTransaction({
      description: rawDesc,
      amount: rawAmount,
      categoryId: mapped.categoryId,
      subCategory: mapped.subCategory,
    }, accountRole);

    // Resolve functional transaction type
    let transactionType = enriched.transactionType;
    let isSavings = Boolean(enriched.isSavings);

    // If description indicates jar savings ("Поповнення «...")
    if (rawDesc.includes('Поповнення «') || rawDesc.includes('Invest broker')) {
      isSavings = true;
      transactionType = 'savings_jar';
    } else if (isExplicitlyExcluded) {
      // Excluded operations (like internal card/FOP transfers)
      transactionType = 'transfer';
    }

    // Secondary tags from file + note + enrichment
    const fileTags = tagsKey && row[tagsKey]
      ? String(row[tagsKey]).split(',').map(s => s.trim()).filter(Boolean)
      : [];
    const mergedTags = Array.from(new Set([...fileTags, ...(enriched.tags || [])]));

    const hash = await computeTransactionHash(date, rawAmount, rawDesc, accountId);

    transactions.push({
      id: `monobudget_${hash.slice(0, 16)}_${i}`,
      hash,
      date,
      amount: rawAmount,
      currency,
      description: rawDesc,
      cleanMerchant: enriched.cleanMerchant || rawDesc,
      originalCategory: rawCategory,
      categoryId: enriched.categoryId || mapped.categoryId,
      subCategory: enriched.subCategory || mapped.subCategory,
      tags: mergedTags.length > 0 ? mergedTags : undefined,
      notes: rawNote,
      source: 'mono_budget',
      accountId,
      accountName,
      cardLast4,
      cardNumberMasked: cardLast4 ? formatCardMask(cardLast4) : undefined,
      transactionType,
      isSavings,
      isExcludedFromBudget: isExplicitlyExcluded,
      isSubscription: enriched.isSubscription,
    });
  }

  return transactions;
}
