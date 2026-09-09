import type { Transaction } from '../../types/finance';
import { computeTransactionHash } from './deduplication';
import { formatCardMask, extractCardLast4, cleanCardName } from '../../utils/cardUtils';
import { enrichTransaction } from '../intelligence/recognitionEngine';

export function isMonobankStatement(headers: string[]): boolean {
  const normalized = headers.map(h => h.toLowerCase().trim());
  const hasDate = normalized.some(h => h.includes('дата') && h.includes('час'));
  const hasDetails = normalized.some(h => h.includes('деталі'));
  const hasAmount = normalized.some(h => h.includes('сума в валюті') || h.includes('сума'));
  const hasMcc = normalized.some(h => h.includes('mcc'));

  return (hasDate && hasDetails) || (hasDate && hasMcc) || (hasDate && hasAmount);
}

export function parseMonobankDate(dateStr: string): string {
  // Typical formats: "01.03.2024 14:25:30" or "01.03.2024 14:25" or ISO string
  if (!dateStr) return new Date().toISOString();
  
  const trimmed = dateStr.trim();
  const parts = trimmed.match(/^(\d{2})\.(\d{2})\.(\d{4})\s+(\d{2}):(\d{2})(?::(\d{2}))?/);
  if (parts) {
    const [, day, month, year, hours, minutes, seconds = '00'] = parts;
    return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}`;
  }

  // Fallback to standard Date parse if format is already ISO or other standard
  const d = new Date(trimmed);
  if (!isNaN(d.getTime())) {
    return d.toISOString().slice(0, 19);
  }
  return new Date().toISOString().slice(0, 19);
}

export function mapMccToCategory(mcc?: number): { categoryId: string; subCategory?: string } | null {
  if (!mcc) return null;

  // Supermarkets & Groceries
  if ([5411, 5422, 5441, 5451, 5462, 5499].includes(mcc)) {
    return { categoryId: 'groceries', subCategory: 'Супермаркети' };
  }

  // Dining & Cafes
  if ([5811, 5812, 5813, 5814].includes(mcc)) {
    return { categoryId: 'dining', subCategory: mcc === 5814 ? 'Фастфуд' : 'Кафе та ресторани' };
  }

  // Transport & Fuel
  if ([5541, 5542].includes(mcc)) {
    return { categoryId: 'transport', subCategory: 'Пальне' };
  }
  if ([4121].includes(mcc)) {
    return { categoryId: 'transport', subCategory: 'Таксі' };
  }
  if ([4111, 4131, 4789, 7523].includes(mcc)) {
    return { categoryId: 'transport', subCategory: 'Громадський транспорт' };
  }

  // Subscriptions & Telecom
  if ([4814, 4899, 5968, 5815, 5816, 5817, 5735].includes(mcc)) {
    return { categoryId: 'subscriptions', subCategory: 'Стрімінг та софт' };
  }

  // Utilities / Housing
  if ([4900, 6513].includes(mcc)) {
    return { categoryId: 'housing', subCategory: 'Комунальні платежі' };
  }

  // Pharmacy & Health
  if ([5912, 5122].includes(mcc)) {
    return { categoryId: 'health', subCategory: 'Аптеки' };
  }
  if ([8011, 8021, 8049, 8099].includes(mcc)) {
    return { categoryId: 'health', subCategory: 'Медичні послуги' };
  }

  // Shopping & Clothes
  if ([5611, 5621, 5651, 5661, 5691, 5311, 5732, 5942, 5944].includes(mcc)) {
    return { categoryId: 'shopping', subCategory: 'Шопінг' };
  }

  // Travel & Hotels
  if ((mcc >= 3000 && mcc <= 3299) || [4511, 7011].includes(mcc)) {
    return { categoryId: 'travel', subCategory: 'Подорожі' };
  }

  return null;
}

export async function parseMonobankRows(
  rows: Record<string, any>[],
  accountId = 'monobank_black',
  fallbackCardLast4 = '1234',
  accountRole?: string
): Promise<Transaction[]> {
  const transactions: Transaction[] = [];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    
    // Find key fields irrespective of casing or minor column title variations
    const keys = Object.keys(row);
    const dateKey = keys.find(k => k.toLowerCase().includes('дата')) || keys[0];
    const descKey = keys.find(k => k.toLowerCase().includes('деталі') || k.toLowerCase().includes('опис')) || keys[1];
    const amountKey = keys.find(k => k.toLowerCase().includes('сума в валюті картки') || (k.toLowerCase().includes('сума') && !k.toLowerCase().includes('операції'))) || keys[3];
    const mccKey = keys.find(k => k.toLowerCase().includes('mcc'));

    const rawDate = String(row[dateKey] || '').trim();
    if (!rawDate) continue;

    const rawDesc = String(row[descKey] || 'Транзакція Monobank').trim();
    
    // Parse amount: handles "-145.20", " -145,20 ", or numbers
    let rawAmount = row[amountKey];
    if (typeof rawAmount === 'string') {
      rawAmount = parseFloat(rawAmount.replace(/\s/g, '').replace(',', '.'));
    }
    if (typeof rawAmount !== 'number' || isNaN(rawAmount)) continue;

    const date = parseMonobankDate(rawDate);
    const mcc = mccKey && row[mccKey] ? parseInt(String(row[mccKey]).trim(), 10) : undefined;
    
    // Detect card number and card name from row or fallback
    const cardNumberKey = keys.find(k => {
      const lk = k.toLowerCase();
      return (lk.includes('номер') && (lk.includes('карт') || lk.includes('card'))) ||
             lk === 'pan' || lk === 'card_number';
    });
    const cardNameKey = keys.find(k => {
      const lk = k.toLowerCase();
      return (lk.includes('назва') && (lk.includes('карт') || lk.includes('card'))) ||
             (lk.includes('тип') && lk.includes('карт')) ||
             lk === 'card_name';
    });
    const genericCardKey = keys.find(k => {
      const lk = k.toLowerCase();
      return (lk.includes('картк') || lk.includes('card') || lk.includes('карта')) && !lk.includes('сума') && !lk.includes('комісі');
    });
    const accountKey = keys.find(k => {
      const lk = k.toLowerCase();
      return (lk.includes('рахунок') && !lk.includes('залишок') && !lk.includes('сума')) || lk === 'account';
    });

    let cardLast4: string | undefined;
    if (cardNumberKey && row[cardNumberKey]) {
      cardLast4 = extractCardLast4(row[cardNumberKey]);
    }
    if (!cardLast4 && genericCardKey && row[genericCardKey]) {
      cardLast4 = extractCardLast4(row[genericCardKey]);
    }
    if (!cardLast4) {
      cardLast4 = fallbackCardLast4;
    }

    const cardNumberMasked = cardLast4 ? formatCardMask(cardLast4) : undefined;

    // Detect card / account name
    let accountName: string | undefined;
    if (cardNameKey && row[cardNameKey] && String(row[cardNameKey]).trim()) {
      accountName = cleanCardName(String(row[cardNameKey]), cardLast4, 'Monobank');
    } else if (genericCardKey && row[genericCardKey] && String(row[genericCardKey]).trim()) {
      const rawVal = String(row[genericCardKey]).trim();
      if (!/^[\d\s*•\-_]+$/.test(rawVal)) {
        accountName = cleanCardName(rawVal, cardLast4, 'Monobank');
      }
    } else if (accountKey && row[accountKey] && String(row[accountKey]).trim()) {
      accountName = cleanCardName(String(row[accountKey]), cardLast4, 'Monobank');
    }

    if (!accountName) {
      accountName = cardLast4 ? `Monobank *${cardLast4}` : 'Monobank Чорна';
    }

    // Baseline category from MCC
    let categoryId = rawAmount > 0 ? 'income_salary' : 'other';
    let subCategory: string | undefined;

    if (rawAmount < 0 && mcc) {
      const mccMapping = mapMccToCategory(mcc);
      if (mccMapping) {
        categoryId = mccMapping.categoryId;
        subCategory = mccMapping.subCategory;
      }
    }

    // Apply Intelligence Engine enrichment
    const enriched = enrichTransaction({
      description: rawDesc,
      amount: rawAmount,
      categoryId,
      subCategory,
    }, accountRole);

    const hash = await computeTransactionHash(date, rawAmount, rawDesc, accountId);

    transactions.push({
      id: `mono_${hash.slice(0, 16)}_${i}`,
      hash,
      date,
      amount: rawAmount,
      currency: 'UAH',
      description: rawDesc,
      cleanMerchant: enriched.cleanMerchant || rawDesc,
      originalCategory: mcc ? `MCC ${mcc}` : undefined,
      categoryId: enriched.categoryId || categoryId,
      subCategory: enriched.subCategory || subCategory,
      tags: enriched.tags,
      mcc: isNaN(Number(mcc)) ? undefined : mcc,
      source: 'monobank',
      accountId,
      accountName,
      cardLast4,
      cardNumberMasked,
      transactionType: enriched.transactionType,
      isSavings: Boolean(enriched.isSavings),
      isSubscription: enriched.isSubscription,
    });
  }

  return transactions;
}

