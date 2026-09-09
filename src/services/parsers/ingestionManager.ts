import * as XLSX from 'xlsx';
import Papa from 'papaparse';
import type { ImportSummary, Transaction } from '../../types/finance';
import { db } from '../../db/database';
import { isMonobankStatement, parseMonobankRows } from './monobankAdapter';
import { isToshlStatement, parseToshlRows } from './toshlAdapter';
import { deduplicateDrafts } from './deduplication';

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

  if (isMonobankStatement(headers)) {
    detectedSource = 'monobank';
    const accounts = await db.accounts.toArray();
    const defaultCardAcc = accounts.find(a => a.id === 'monobank_black' || a.type === 'bank_card');
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
    // Generic fallback mapping
    draftTransactions = await parseMonobankRows(rawRows, 'generic_account');
  }

  // Fetch existing records from DB for deduplication
  const existingRecords = await db.transactions.toArray();
  const existingHashes = new Set<string>(existingRecords.map(t => t.hash));

  const { unique, duplicatesCount } = deduplicateDrafts(draftTransactions, existingHashes);

  return {
    fileName: file.name,
    detectedSource,
    totalRows: draftTransactions.length,
    newRows: unique.length,
    duplicateRows: duplicatesCount,
    previewRows: unique.slice(0, 8),
    draftTransactions: unique,
  };
}

export async function commitImport(transactions: Transaction[]): Promise<number> {
  if (!transactions.length) return 0;

  // If any residual demo records exist in database, purge them permanently
  const allCurrent = await db.transactions.toArray();
  const demoIds = allCurrent.filter(t => t.id.startsWith('demo_')).map(t => t.id);
  if (demoIds.length > 0) {
    await db.transactions.bulkDelete(demoIds);
  }

  await db.transactions.bulkAdd(transactions);
  return transactions.length;
}
