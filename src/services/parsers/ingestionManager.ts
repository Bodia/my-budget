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
    draftTransactions = await parseMonobankRows(rawRows);
  } else if (isToshlStatement(headers)) {
    detectedSource = 'toshl';
    draftTransactions = await parseToshlRows(rawRows);
  } else {
    detectedSource = 'generic';
    // Generic fallback mapping
    draftTransactions = await parseMonobankRows(rawRows, 'generic_account');
  }

  // Fetch existing records from DB
  const existingRecords = await db.transactions.toArray();
  const demoRecords = existingRecords.filter(t => t.isDemo || t.id.startsWith('demo_'));
  const hasDemoDataToReplace = demoRecords.length > 0;

  // For deduplication against existing DB, only consider real records
  // so imported files aren't falsely deduplicated against synthetic demo records
  const realRecords = existingRecords.filter(t => !t.isDemo && !t.id.startsWith('demo_'));
  const existingHashes = new Set<string>(realRecords.map(t => t.hash));

  const { unique, duplicatesCount } = deduplicateDrafts(draftTransactions, existingHashes);

  return {
    fileName: file.name,
    detectedSource,
    totalRows: draftTransactions.length,
    newRows: unique.length,
    duplicateRows: duplicatesCount,
    previewRows: unique.slice(0, 8),
    draftTransactions: unique,
    hasDemoDataToReplace,
    demoRowsCount: demoRecords.length,
  };
}

export interface CommitImportResult {
  importedCount: number;
  replacedDemoCount: number;
}

export async function commitImport(transactions: Transaction[]): Promise<CommitImportResult> {
  if (!transactions.length) return { importedCount: 0, replacedDemoCount: 0 };

  // If there are demo transactions in database, purge them so real data replaces demo data
  const allCurrent = await db.transactions.toArray();
  const demoIds = allCurrent
    .filter(t => t.isDemo || t.id.startsWith('demo_'))
    .map(t => t.id);

  if (demoIds.length > 0) {
    await db.transactions.bulkDelete(demoIds);
  }

  // Ensure imported records are explicitly marked isDemo: false
  const sanitized = transactions.map(t => ({ ...t, isDemo: false }));
  await db.transactions.bulkAdd(sanitized);

  return {
    importedCount: sanitized.length,
    replacedDemoCount: demoIds.length,
  };
}
