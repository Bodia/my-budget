import type { Transaction } from '../../types/finance';
import { db } from '../../db/database';
import type { EnrichedIntelligenceResult } from './types';
import { detectSavings } from './savingsDetector';
import { detectRefund } from './refundMatcher';
import { matchMerchant } from './merchantDictionary';

/**
 * Enriches a raw transaction by running it through the 5-layer intelligence pipeline
 */
export function enrichTransaction(
  raw: { description: string; amount: number; categoryId?: string; subCategory?: string },
  accountRole?: string
): EnrichedIntelligenceResult {
  const desc = raw.description || '';
  const amount = raw.amount || 0;

  // Layer 1: Savings, Monobank Jars, and Rounding Detection
  const savingsMatch = detectSavings(desc, amount);
  if (savingsMatch) {
    return savingsMatch;
  }

  // Layer 2: Cancellations & Refund Netting
  const refundMatch = detectRefund(desc, amount);
  if (refundMatch) {
    return refundMatch;
  }

  // Layer 3: Merchant Catalog, Gateway Cleaner & Category/Tags
  const merchantMatch = matchMerchant(desc, amount);
  if (merchantMatch) {
    // If merchant provides category, use it; otherwise retain existing
    return {
      ...merchantMatch,
      categoryId: merchantMatch.categoryId || raw.categoryId,
      subCategory: merchantMatch.subCategory || raw.subCategory,
    };
  }

  // Layer 4: Contextual Card Role Fallback
  const isPositive = amount > 0;
  let fallbackCategory = raw.categoryId || (isPositive ? 'income_salary' : 'other');
  const fallbackTags: string[] = [];

  if (accountRole === 'shared_family' && !isPositive && (!raw.categoryId || raw.categoryId === 'other')) {
    fallbackCategory = 'groceries';
    fallbackTags.push('family', 'household');
  } else if (accountRole === 'personal' && !isPositive && (!raw.categoryId || raw.categoryId === 'other')) {
    fallbackCategory = 'leisure';
    fallbackTags.push('personal', 'whims');
  } else if (accountRole === 'cashback_national') {
    fallbackTags.push('national_cashback');
  }

  // Layer 5: Fallback standard classification
  return {
    transactionType: isPositive ? 'income' : 'expense',
    cleanMerchant: desc.trim(),
    categoryId: fallbackCategory,
    subCategory: raw.subCategory,
    tags: fallbackTags.length > 0 ? fallbackTags : undefined,
    isSavings: false,
  };
}

/**
 * Re-analyzes and enriches all existing transactions in the database
 */
export async function reclassifyAllTransactions(
  onProgress?: (processed: number, total: number) => void
): Promise<number> {
  const allTransactions = await db.transactions.toArray();
  const allAccounts = await db.accounts.toArray();
  const accountMap = new Map(allAccounts.map(a => [a.id, a]));

  const updated: Transaction[] = [];

  for (let i = 0; i < allTransactions.length; i++) {
    const tx = allTransactions[i];
    const account = accountMap.get(tx.accountId);
    const enriched = enrichTransaction(tx, account?.role);

    updated.push({
      ...tx,
      transactionType: enriched.transactionType,
      cleanMerchant: enriched.cleanMerchant || tx.cleanMerchant || tx.description,
      categoryId: enriched.categoryId || tx.categoryId,
      subCategory: enriched.subCategory || tx.subCategory,
      tags: enriched.tags && enriched.tags.length > 0 ? enriched.tags : tx.tags,
      isSavings: Boolean(enriched.isSavings),
      isSubscription: enriched.isSubscription !== undefined ? enriched.isSubscription : tx.isSubscription,
    });

    if (onProgress && (i % 50 === 0 || i === allTransactions.length - 1)) {
      onProgress(i + 1, allTransactions.length);
    }
  }

  if (updated.length > 0) {
    await db.transactions.bulkPut(updated);
  }

  return updated.length;
}
