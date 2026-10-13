import type { Transaction, Account } from '../../types/finance';
import type { MonobankStatementItemDto } from './types';
import { currencyCodeToAlpha, formatMonobankCardName } from './types';
import { mapMccToCategory } from '../parsers/monobankAdapter';
import { computeTransactionHash } from '../parsers/deduplication';
import { enrichTransaction } from '../intelligence/recognitionEngine';
import { formatCardMask, extractCardLast4 } from '../../utils/cardUtils';
import { db } from '../../db/database';

export async function convertMonobankApiItems(
  items: MonobankStatementItemDto[],
  account: Account
): Promise<Transaction[]> {
  const transactions: Transaction[] = [];

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    const amount = parseFloat((item.amount / 100).toFixed(2));
    const date = new Date(item.time * 1000).toISOString().slice(0, 19);
    const currency = currencyCodeToAlpha(item.currencyCode || 980);

    let categoryId = amount > 0 ? 'income_salary' : 'other';
    let subCategory: string | undefined;

    if (amount < 0 && item.mcc) {
      const mapped = mapMccToCategory(item.mcc);
      if (mapped) {
        categoryId = mapped.categoryId;
        subCategory = mapped.subCategory;
      }
    }

    const enriched = enrichTransaction(
      {
        description: item.description,
        amount,
        categoryId,
        subCategory,
      },
      account.role
    );

    const hash = await computeTransactionHash(date, amount, item.description, account.id);

    transactions.push({
      id: `mono_api_${item.id || hash.slice(0, 16)}`,
      hash,
      date,
      amount,
      currency,
      description: item.description,
      cleanMerchant: enriched.cleanMerchant || item.description,
      originalCategory: item.mcc ? `MCC ${item.mcc}` : undefined,
      categoryId: enriched.categoryId || categoryId,
      subCategory: enriched.subCategory || subCategory,
      tags: enriched.tags,
      mcc: item.mcc || undefined,
      source: 'monobank',
      accountId: account.id,
      accountName: account.name,
      cardLast4: account.cardLast4,
      cardNumberMasked: account.cardNumberMasked,
      notes: item.comment || undefined,
      transactionType: enriched.transactionType,
      isSavings: Boolean(enriched.isSavings),
      isSubscription: enriched.isSubscription,
    });
  }

  return transactions;
}

export function reconcileMonobankAccounts(
  apiAccounts: Array<{
    id: string;
    balance: number;
    creditLimit: number;
    type: string;
    currencyCode: number;
    maskedPan?: string[];
  }>,
  existingAccounts: Account[]
): {
  updatedExisting: Account[];
  newAccounts: Account[];
} {
  const updatedExisting: Account[] = [];
  const newAccounts: Account[] = [];
  const now = new Date().toISOString();

  const ACCOUNT_COLORS = [
    '#1677ff',
    '#10b981',
    '#8b5cf6',
    '#f59e0b',
    '#ec4899',
    '#06b6d4',
  ];

  for (const apiAcc of apiAccounts) {
    const pan = apiAcc.maskedPan && apiAcc.maskedPan.length > 0 ? apiAcc.maskedPan[0] : '';
    const last4 = pan ? extractCardLast4(pan) : undefined;
    const currency = currencyCodeToAlpha(apiAcc.currencyCode);

    // Try matching with existing account
    const matched = existingAccounts.find(a => {
      if (a.monobankAccountId && a.monobankAccountId === apiAcc.id) return true;
      if (last4 && a.cardLast4 && a.cardLast4 === last4) return true;
      if (apiAcc.type === 'black' && a.id === 'monobank_black') return true;
      if (apiAcc.type === 'white' && a.id === 'monobank_white') return true;
      if (apiAcc.type === 'fop' && (a.id === 'monobank_fop' || a.name.toLowerCase().includes('фоп'))) return true;
      return false;
    });

    if (matched) {
      const updated: Account = {
        ...matched,
        balance: apiAcc.balance,
        creditLimit: apiAcc.creditLimit,
        monobankAccountId: apiAcc.id,
        lastSyncedAt: now,
      };
      if (last4 && !updated.cardLast4) {
        updated.cardLast4 = last4;
        updated.cardNumberMasked = formatCardMask(last4);
      }
      updatedExisting.push(updated);
    } else {
      const name = formatMonobankCardName(apiAcc as any);
      const id = last4 ? `mono_${last4}` : `mono_${apiAcc.type}_${Date.now().toString(36)}`;
      const color = ACCOUNT_COLORS[(existingAccounts.length + newAccounts.length) % ACCOUNT_COLORS.length];
      const role: Account['role'] = apiAcc.type === 'fop' ? 'business' : apiAcc.type === 'white' ? 'shared_family' : 'personal';

      const newAcc: Account = {
        id,
        name,
        type: 'bank_card',
        currency,
        cardLast4: last4,
        cardNumberMasked: last4 ? formatCardMask(last4) : undefined,
        color,
        role,
        balance: apiAcc.balance,
        creditLimit: apiAcc.creditLimit,
        monobankAccountId: apiAcc.id,
        lastSyncedAt: now,
      };
      newAccounts.push(newAcc);
    }
  }

  return { updatedExisting, newAccounts };
}

export async function persistMonobankSync(
  transactions: Transaction[],
  updatedAccounts: Account[],
  newAccounts: Account[]
): Promise<number> {
  // Update existing accounts in DB
  for (const acc of updatedAccounts) {
    await db.accounts.put(acc);
  }

  // Add newly created accounts
  for (const acc of newAccounts) {
    await db.accounts.put(acc);
  }

  // Save new transactions
  if (transactions.length > 0) {
    // Purge any residual demo data
    const all = await db.transactions.toArray();
    const demoIds = all.filter(t => t.id.startsWith('demo_')).map(t => t.id);
    if (demoIds.length > 0) {
      await db.transactions.bulkDelete(demoIds);
    }

    await db.transactions.bulkAdd(transactions);
  }

  return transactions.length;
}
