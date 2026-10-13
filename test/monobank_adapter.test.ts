import { describe, it, expect } from 'vitest';
import type { MonobankStatementItemDto } from '../src/services/monobank/types';
import type { Account } from '../src/types/finance';
import {
  convertMonobankApiItems,
  reconcileMonobankAccounts,
} from '../src/services/monobank/monobankApiAdapter';
import { deduplicateDrafts } from '../src/services/parsers/deduplication';

describe('Monobank API Adapter & Deduplication', () => {
  const mockAccount: Account = {
    id: 'monobank_black',
    name: 'Monobank Чорна',
    type: 'bank_card',
    currency: 'UAH',
    cardLast4: '1234',
    cardNumberMasked: '**** **** **** 1234',
    role: 'personal',
  };

  const sampleItems: MonobankStatementItemDto[] = [
    {
      id: 'tx_silpo_1',
      time: 1728820800, // 2024-10-13T12:00:00 (approx)
      description: 'Сільпо',
      mcc: 5411,
      amount: -45025, // -450.25 UAH
      currencyCode: 980,
      comment: 'Продукти на тиждень',
    },
    {
      id: 'tx_okko_2',
      time: 1728824400,
      description: 'WFP*OKKO AZS 24 KYIV',
      mcc: 5541,
      amount: -180000, // -1800.00 UAH
      currencyCode: 980,
    },
    {
      id: 'tx_salary_3',
      time: 1728828000,
      description: 'Зарахування зарплати',
      mcc: 0,
      amount: 4500000, // +45 000.00 UAH
      currencyCode: 980,
    },
  ];

  it('correctly maps API items to My Budget Transaction format', async () => {
    const transactions = await convertMonobankApiItems(sampleItems, mockAccount);

    expect(transactions).toHaveLength(3);

    // 1. Silpo grocery expense
    const t1 = transactions[0];
    expect(t1.id).toBe('mono_api_tx_silpo_1');
    expect(t1.amount).toBe(-450.25);
    expect(t1.currency).toBe('UAH');
    expect(t1.categoryId).toBe('groceries');
    expect(t1.subCategory).toBe('Супермаркети');
    expect(t1.notes).toBe('Продукти на тиждень');
    expect(t1.source).toBe('monobank');
    expect(t1.accountId).toBe('monobank_black');
    expect(t1.cardLast4).toBe('1234');
    expect(t1.hash).toBeDefined();

    // 2. OKKO fuel expense
    const t2 = transactions[1];
    expect(t2.amount).toBe(-1800.0);
    expect(t2.categoryId).toBe('transport');
    expect(t2.subCategory).toBe('Пальне');

    // 3. Salary income
    const t3 = transactions[2];
    expect(t3.amount).toBe(45000.0);
    expect(t3.categoryId).toBe('income_salary');
  });

  it('deduplicates API items against existing transaction hashes and IDs', async () => {
    const transactions = await convertMonobankApiItems(sampleItems, mockAccount);

    // Assume t1 is already in DB
    const existingHashes = new Set<string>([transactions[0].hash]);

    const { unique, duplicatesCount } = deduplicateDrafts(transactions, existingHashes);

    expect(duplicatesCount).toBe(1);
    expect(unique).toHaveLength(2);
    expect(unique.find(t => t.id === 'mono_api_tx_silpo_1')).toBeUndefined();
    expect(unique.find(t => t.id === 'mono_api_tx_okko_2')).toBeDefined();
  });

  it('reconciles API accounts with local existing accounts and creates missing ones', () => {
    const existingAccounts: Account[] = [
      {
        id: 'monobank_black',
        name: 'Monobank Чорна',
        type: 'bank_card',
        currency: 'UAH',
        cardLast4: '1234',
        cardNumberMasked: '**** **** **** 1234',
      },
    ];

    const apiAccounts = [
      {
        id: 'api_black_id',
        balance: 15000,
        creditLimit: 50000,
        type: 'black',
        currencyCode: 980,
        maskedPan: ['537541******1234'],
      },
      {
        id: 'api_white_id',
        balance: 3200,
        creditLimit: 0,
        type: 'white',
        currencyCode: 980,
        maskedPan: ['537541******5678'],
      },
    ];

    const { updatedExisting, newAccounts } = reconcileMonobankAccounts(
      apiAccounts,
      existingAccounts
    );

    // Existing black card should get updated balance and monobankAccountId
    expect(updatedExisting).toHaveLength(1);
    expect(updatedExisting[0].id).toBe('monobank_black');
    expect(updatedExisting[0].balance).toBe(15000);
    expect(updatedExisting[0].monobankAccountId).toBe('api_black_id');

    // White card was missing, so created as new account
    expect(newAccounts).toHaveLength(1);
    expect(newAccounts[0].cardLast4).toBe('5678');
    expect(newAccounts[0].balance).toBe(3200);
  });
});
