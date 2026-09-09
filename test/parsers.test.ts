import { describe, it, expect } from 'vitest';
import { parseMonobankDate, mapMccToCategory } from '../src/services/parsers/monobankAdapter';
import { mapToshlCategory } from '../src/services/parsers/toshlAdapter';
import { computeTransactionHash, deduplicateDrafts } from '../src/services/parsers/deduplication';
import { matchRule, evaluateTransactionCategory } from '../src/services/rules/ruleEngine';
import type { CategorizationRule, Transaction, Account } from '../src/types/finance';

describe('Monobank Parser Adapter', () => {
  it('correctly parses Ukrainian date format DD.MM.YYYY HH:mm:ss', () => {
    const iso = parseMonobankDate('15.03.2024 14:30:25');
    expect(iso).toBe('2024-03-15T14:30:25');
  });

  it('correctly maps MCC codes to categories', () => {
    const grocery = mapMccToCategory(5411);
    expect(grocery?.categoryId).toBe('groceries');

    const fuel = mapMccToCategory(5541);
    expect(fuel?.categoryId).toBe('transport');

    const restaurant = mapMccToCategory(5812);
    expect(restaurant?.categoryId).toBe('dining');
  });
});

describe('Toshl Parser Adapter', () => {
  it('maps Toshl categories accurately', () => {
    expect(mapToshlCategory('Groceries').categoryId).toBe('groceries');
    expect(mapToshlCategory('Restaurants & Bars').categoryId).toBe('dining');
    expect(mapToshlCategory('Car & Fuel').categoryId).toBe('transport');
    expect(mapToshlCategory('Rent & Bills').categoryId).toBe('housing');
  });
});

describe('Deduplication Engine', () => {
  it('generates deterministic hashes and filters out duplicates', async () => {
    const hash1 = await computeTransactionHash('2024-03-01T10:00:00', -450.50, 'Сільпо', 'acc1');
    const hash2 = await computeTransactionHash('2024-03-01T10:00:00', -450.50, 'Сільпо', 'acc1');
    expect(hash1).toBe(hash2);

    const incoming = [
      { hash: hash1, id: '1' },
      { hash: hash1, id: '2' },
      { hash: 'hash_unique_123', id: '3' },
    ];

    const existing = new Set<string>([hash1]);
    const { unique, duplicatesCount } = deduplicateDrafts(incoming, existing);

    expect(duplicatesCount).toBe(2);
    expect(unique.length).toBe(1);
    expect(unique[0].hash).toBe('hash_unique_123');
  });
});

describe('Rule Engine', () => {
  it('prioritizes user rules over default mappings', () => {
    const rule: CategorizationRule = {
      id: 'r1',
      matchField: 'description',
      operator: 'contains',
      pattern: 'OKKO|WOG',
      targetCategoryId: 'transport',
      targetSubCategory: 'Пальне',
      priority: 1,
      isActive: true,
    };

    const tx: Transaction = {
      id: 'tx1',
      hash: 'h1',
      date: '2024-03-01T10:00:00',
      amount: -1500,
      currency: 'UAH',
      description: 'АЗС OKKO №15 Київ',
      categoryId: 'other',
      source: 'monobank',
      accountId: 'acc1',
    };

    expect(matchRule(tx, rule)).toBe(true);

    const evaluated = evaluateTransactionCategory(tx, [rule]);
    expect(evaluated.categoryId).toBe('transport');
    expect(evaluated.subCategory).toBe('Пальне');
  });
});

describe('Bank Card Masking & Utils', () => {
  it('correctly sanitizes and validates 4 digits', async () => {
    const { sanitizeCardLast4, isValidCardLast4, formatCardMask, formatCardCompact } = await import('../src/utils/cardUtils');

    expect(sanitizeCardLast4('1234')).toBe('1234');
    expect(sanitizeCardLast4('12a3b4c')).toBe('1234');
    expect(sanitizeCardLast4('4441112223334821')).toBe('4441'); // first 4 digits if simple sanitization
    expect(isValidCardLast4('4821')).toBe(true);
    expect(isValidCardLast4('482')).toBe(false);
    expect(isValidCardLast4('4821a')).toBe(false);

    expect(formatCardMask('4821')).toBe('**** **** **** 4821');
    expect(formatCardCompact('4821')).toBe('•••• 4821');
  });

  it('correctly parses card number or mask from Monobank statement rows', async () => {
    const { parseMonobankRows } = await import('../src/services/parsers/monobankAdapter');

    const sampleRows = [
      {
        'Дата і час': '01.03.2024 12:00:00',
        'Опис': 'Сільпо',
        'Сума': -250.00,
        'Номер картки': '444111******9876',
        'MCC': 5411,
      },
      {
        'Дата і час': '02.03.2024 14:00:00',
        'Опис': 'Кав’ярня',
        'Сума': -60.00,
        'MCC': 5814,
      }
    ];

    const txs = await parseMonobankRows(sampleRows, 'monobank_black', '1234');
    expect(txs.length).toBe(2);
    expect(txs[0].cardLast4).toBe('9876');
    expect(txs[0].cardNumberMasked).toBe('**** **** **** 9876');

    // Second row falls back to account default
    expect(txs[1].cardLast4).toBe('1234');
    expect(txs[1].cardNumberMasked).toBe('**** **** **** 1234');
  });

  it('extracts card name from columns and generates fallback Monobank *XXXX', async () => {
    const { parseMonobankRows } = await import('../src/services/parsers/monobankAdapter');

    const sampleRows = [
      {
        'Дата і час': '01.03.2024 12:00:00',
        'Опис': 'Сільпо',
        'Сума': -250.00,
        'Номер картки': '444111******5555',
        'Назва картки': 'єПідтримка Дія',
      },
      {
        'Дата і час': '02.03.2024 14:00:00',
        'Опис': 'Кав’ярня',
        'Сума': -60.00,
        'Номер картки': '5375 41** **** 7777',
      }
    ];

    const txs = await parseMonobankRows(sampleRows, 'monobank_black', '1234');
    expect(txs[0].cardLast4).toBe('5555');
    expect(txs[0].accountName).toBe('єПідтримка Дія');

    expect(txs[1].cardLast4).toBe('7777');
    expect(txs[1].accountName).toBe('Monobank *7777');
  });

  it('automatically resolves and detects new cards vs existing cards during import', async () => {
    const { resolveImportAccounts } = await import('../src/services/parsers/ingestionManager');
    const existingAccounts: Account[] = [
      { id: 'monobank_black', name: 'Monobank Чорна', type: 'bank_card', currency: 'UAH', cardLast4: '1234', cardNumberMasked: '**** **** **** 1234', color: '#1677ff' },
      { id: 'cash', name: 'Готівка', type: 'cash', currency: 'UAH' },
    ];

    const drafts: Transaction[] = [
      {
        id: 't1',
        hash: 'h1',
        date: '2024-03-01T10:00:00',
        amount: -100,
        currency: 'UAH',
        description: 'Сільпо',
        categoryId: 'groceries',
        source: 'monobank',
        accountId: 'mono_1234',
        cardLast4: '1234',
        cardNumberMasked: '**** **** **** 1234',
        accountName: 'Monobank *1234',
      },
      {
        id: 't2',
        hash: 'h2',
        date: '2024-03-02T11:00:00',
        amount: -250,
        currency: 'UAH',
        description: 'WOG',
        categoryId: 'transport',
        source: 'monobank',
        accountId: 'mono_9999',
        cardLast4: '9999',
        cardNumberMasked: '**** **** **** 9999',
        accountName: 'Біла картка зарплатна',
      },
    ];

    const result = resolveImportAccounts(drafts, existingAccounts, 'monobank');

    // First transaction should be mapped to existing account 'monobank_black'
    expect(result.updatedDrafts[0].accountId).toBe('monobank_black');
    expect(result.updatedDrafts[0].accountName).toBe('Monobank Чорна');

    // Second transaction should have a brand-new account created
    expect(result.newAccounts.length).toBe(1);
    expect(result.newAccounts[0].cardLast4).toBe('9999');
    expect(result.newAccounts[0].name).toBe('Біла картка зарплатна');
    expect(result.newAccounts[0].type).toBe('bank_card');
    expect(result.newAccounts[0].role).toBe('shared_family');
    expect(result.updatedDrafts[1].accountId).toBe(result.newAccounts[0].id);

    // Total detected accounts should be 2 (1 existing + 1 new)
    expect(result.detectedAccounts.length).toBe(2);
  });
});


