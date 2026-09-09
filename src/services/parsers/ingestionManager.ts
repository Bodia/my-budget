import * as XLSX from 'xlsx';
import Papa from 'papaparse';
import type { ImportSummary, Transaction, Account } from '../../types/finance';
import { db } from '../../db/database';
import { isMonobankStatement, parseMonobankRows } from './monobankAdapter';
import { isToshlStatement, parseToshlRows } from './toshlAdapter';
import { deduplicateDrafts } from './deduplication';
import { cleanCardName, formatCardMask } from '../../utils/cardUtils';

const ACCOUNT_COLORS = [
  '#1677ff',
  '#10b981',
  '#8b5cf6',
  '#f59e0b',
  '#ec4899',
  '#06b6d4',
  '#1e293b',
  '#6366f1',
];

function inferAccountRole(name: string): Account['role'] {
  const lower = name.toLowerCase();
  if (lower.includes('біла') || lower.includes('white') || lower.includes('спільн') || lower.includes('family')) {
    return 'shared_family';
  }
  if (lower.includes('єпідтримка') || lower.includes('євідновлення') || lower.includes('національний') || lower.includes('cashback') || lower.includes('кешбек')) {
    return 'cashback_national';
  }
  return 'personal';
}

function inferAccountType(name: string): Account['type'] {
  const lower = name.toLowerCase();
  if (lower.includes('готівк') || lower.includes('cash')) {
    return 'cash';
  }
  if (lower.includes('банка') || lower.includes('депозит') || lower.includes('savings') || lower.includes('jar')) {
    return 'savings';
  }
  return 'bank_card';
}

export function resolveImportAccounts(
  drafts: Transaction[],
  existingAccounts: Account[],
  detectedSource: 'monobank' | 'toshl' | 'generic'
): {
  updatedDrafts: Transaction[];
  detectedAccounts: Account[];
  newAccounts: Account[];
} {
  const newAccounts: Account[] = [];
  const detectedAccountsMap = new Map<string, Account>();

  // Group transactions by card identity
  const groups = new Map<string, Transaction[]>();

  for (const tx of drafts) {
    const key = tx.cardLast4
      ? `last4:${tx.cardLast4}`
      : `name:${(tx.accountName || tx.accountId).toLowerCase().trim()}`;
    if (!groups.has(key)) {
      groups.set(key, []);
    }
    groups.get(key)!.push(tx);
  }

  let colorIdx = existingAccounts.length;

  for (const [, txs] of groups) {
    const sample = txs[0];
    const cardLast4 = sample.cardLast4;
    const rawName = sample.accountName || sample.accountId;
    const currency = sample.currency || 'UAH';
    const masked = sample.cardNumberMasked || (cardLast4 ? formatCardMask(cardLast4) : undefined);

    // Try matching with existing accounts
    const matchedAccount = existingAccounts.find(a => {
      if (cardLast4 && a.cardLast4 && a.cardLast4 === cardLast4) return true;
      if (a.id === sample.accountId) return true;
      if (rawName && a.name.toLowerCase().trim() === rawName.toLowerCase().trim()) return true;
      if (detectedSource === 'monobank' || detectedSource === 'toshl') {
        const lower = rawName.toLowerCase();
        if ((lower.includes('чорн') || lower.includes('black')) && a.id === 'monobank_black') return true;
        if ((lower.includes('біл') || lower.includes('white')) && a.id === 'monobank_white') return true;
      }
      return false;
    });

    if (matchedAccount) {
      // Re-link transactions to existing account ID and name
      txs.forEach(t => {
        t.accountId = matchedAccount.id;
        t.accountName = matchedAccount.name;
        if (!t.cardLast4 && matchedAccount.cardLast4) {
          t.cardLast4 = matchedAccount.cardLast4;
          t.cardNumberMasked = matchedAccount.cardNumberMasked;
        }
      });
      detectedAccountsMap.set(matchedAccount.id, matchedAccount);
    } else {
      // Create new account
      const resolvedName = cleanCardName(
        rawName,
        cardLast4,
        detectedSource === 'monobank' ? 'Monobank' : 'Картка'
      );

      const sanitizedSlug = cardLast4
        ? `card_${cardLast4}`
        : `acc_${resolvedName.toLowerCase().replace(/[^a-z0-9а-яіїєґ]/gi, '_').slice(0, 20)}`;

      // Ensure uniqueness
      const existsId = (id: string) =>
        existingAccounts.some(a => a.id === id) || newAccounts.some(a => a.id === id);
      let accountId = sanitizedSlug;
      if (existsId(accountId)) {
        accountId = `${sanitizedSlug}_${Date.now().toString(36)}`;
      }

      const assignedColor = ACCOUNT_COLORS[colorIdx % ACCOUNT_COLORS.length];
      colorIdx++;

      const newAcc: Account = {
        id: accountId,
        name: resolvedName,
        type: inferAccountType(resolvedName),
        currency,
        cardLast4: cardLast4 || undefined,
        cardNumberMasked: masked,
        color: assignedColor,
        role: inferAccountRole(resolvedName),
      };

      txs.forEach(t => {
        t.accountId = newAcc.id;
        t.accountName = newAcc.name;
      });

      newAccounts.push(newAcc);
      detectedAccountsMap.set(newAcc.id, newAcc);
    }
  }

  return {
    updatedDrafts: drafts,
    detectedAccounts: Array.from(detectedAccountsMap.values()),
    newAccounts,
  };
}

export async function processStatementFile(file: File): Promise<ImportSummary> {
  const isExcel = file.name.endsWith('.xlsx') || file.name.endsWith('.xls');
  let rawRows: Record<string, any>[] = [];
  let headers: string[] = [];

  if (isExcel) {
    const buffer = await file.arrayBuffer();
    const workbook = XLSX.read(buffer, { type: 'array' });
    const firstSheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[firstSheetName];
    
    // Read raw rows
    rawRows = XLSX.utils.sheet_to_json<Record<string, any>>(worksheet, { defval: '' });
    if (rawRows.length > 0) {
      headers = Object.keys(rawRows[0]);
    }
  } else {
    // CSV parsing
    const text = await file.text();
    const parsed = Papa.parse<Record<string, any>>(text, {
      header: true,
      skipEmptyLines: true,
    });
    rawRows = parsed.data;
    headers = parsed.meta.fields || (rawRows.length > 0 ? Object.keys(rawRows[0]) : []);
  }

  // Detect format
  let detectedSource: 'monobank' | 'toshl' | 'generic' = 'generic';
  let draftTransactions: Transaction[] = [];

  const existingAccounts = await db.accounts.toArray();
  const defaultCardAcc = existingAccounts.find(a => a.id === 'monobank_black' || a.type === 'bank_card');

  if (isMonobankStatement(headers)) {
    detectedSource = 'monobank';
    draftTransactions = await parseMonobankRows(
      rawRows,
      defaultCardAcc?.id || 'monobank_black',
      defaultCardAcc?.cardLast4 || '1234',
      defaultCardAcc?.role || 'personal'
    );
  } else if (isToshlStatement(headers)) {
    detectedSource = 'toshl';
    draftTransactions = await parseToshlRows(rawRows);
  } else {
    detectedSource = 'generic';
    draftTransactions = await parseMonobankRows(rawRows, 'generic_account');
  }

  // Reconcile and extract cards/accounts from the document
  const { updatedDrafts, detectedAccounts, newAccounts } = resolveImportAccounts(
    draftTransactions,
    existingAccounts,
    detectedSource
  );

  // Fetch existing records from DB for deduplication
  const existingRecords = await db.transactions.toArray();
  const existingHashes = new Set<string>(existingRecords.map(t => t.hash));

  const { unique, duplicatesCount } = deduplicateDrafts(updatedDrafts, existingHashes);

  return {
    fileName: file.name,
    detectedSource,
    totalRows: draftTransactions.length,
    newRows: unique.length,
    duplicateRows: duplicatesCount,
    previewRows: unique.slice(0, 8),
    draftTransactions: unique,
    detectedAccounts,
    newAccounts,
  };
}

export async function commitImport(
  transactions: Transaction[],
  newAccounts?: Account[]
): Promise<number> {
  if (!transactions.length) return 0;

  // Persist newly discovered accounts
  if (newAccounts && newAccounts.length > 0) {
    for (const acc of newAccounts) {
      const existing = await db.accounts.get(acc.id);
      if (!existing) {
        await db.accounts.add(acc);
      } else {
        await db.accounts.update(acc.id, acc);
      }
    }
  }

  // Also update existing accounts if statement revealed cardLast4/cardNumberMasked
  const accountIds = new Set(transactions.map(t => t.accountId));
  for (const accId of accountIds) {
    const txWithCard = transactions.find(t => t.accountId === accId && t.cardLast4);
    if (txWithCard && txWithCard.cardLast4) {
      const acc = await db.accounts.get(accId);
      if (acc && !acc.cardLast4) {
        await db.accounts.update(accId, {
          cardLast4: txWithCard.cardLast4,
          cardNumberMasked: txWithCard.cardNumberMasked,
        });
      }
    }
  }

  // If any residual demo records exist in database, purge them permanently
  const allCurrent = await db.transactions.toArray();
  const demoIds = allCurrent.filter(t => t.id.startsWith('demo_')).map(t => t.id);
  if (demoIds.length > 0) {
    await db.transactions.bulkDelete(demoIds);
  }

  await db.transactions.bulkAdd(transactions);
  return transactions.length;
}

