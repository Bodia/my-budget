import type { Transaction } from '../../types/finance';
import { computeTransactionHash } from './deduplication';

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
  accountId = 'monobank_card'
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
    
    // Default category from MCC or Income
    let categoryId = rawAmount > 0 ? 'income_salary' : 'other';
    let subCategory: string | undefined;

    if (rawAmount < 0 && mcc) {
      const mccMapping = mapMccToCategory(mcc);
      if (mccMapping) {
        categoryId = mccMapping.categoryId;
        subCategory = mccMapping.subCategory;
      }
    }

    const hash = await computeTransactionHash(date, rawAmount, rawDesc, accountId);

    transactions.push({
      id: `mono_${hash.slice(0, 16)}_${i}`,
      hash,
      date,
      amount: rawAmount,
      currency: 'UAH',
      description: rawDesc,
      originalCategory: mcc ? `MCC ${mcc}` : undefined,
      categoryId,
      subCategory,
      mcc: isNaN(Number(mcc)) ? undefined : mcc,
      source: 'monobank',
      accountId,
    });
  }

  return transactions;
}
