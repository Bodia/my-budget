import { describe, it, expect } from 'vitest';
import { parseMonobankDate, mapMccToCategory } from '../src/services/parsers/monobankAdapter';
import { mapToshlCategory } from '../src/services/parsers/toshlAdapter';
import { computeTransactionHash, deduplicateDrafts } from '../src/services/parsers/deduplication';
import { matchRule, evaluateTransactionCategory } from '../src/services/rules/ruleEngine';
import type { CategorizationRule, Transaction } from '../src/types/finance';

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
