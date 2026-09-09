import { describe, it, expect } from 'vitest';
import { detectSavingsTransaction } from '../src/services/intelligence/savingsDetector';
import { isRefundOrCancellation } from '../src/services/intelligence/refundMatcher';
import { cleanMerchantName, matchUkrainianMerchant } from '../src/services/intelligence/merchantDictionary';
import { enrichTransaction } from '../src/services/intelligence/recognitionEngine';
import { 
  calculateKPIs, 
  calculateCategoryBreakdown, 
  calculateUtilitiesStatus,
  calculateTopMerchants 
} from '../src/services/analytics/kpiCalculator';
import type { Transaction, Category } from '../src/types/finance';

describe('1. Monobank Jars & Savings Detector', () => {
  it('detects balance rounding («Округлення балансу»)', () => {
    const res = detectSavingsTransaction('Округлення балансу в Банку «Мрія»', -14.50);
    expect(res.isSavings).toBe(true);
    expect(res.ruleName).toBe('monobank_rounding');
    expect(res.tags).toContain('savings');
    expect(res.tags).toContain('jar');
  });

  it('detects percent from expenses on whims («На примхи»)', () => {
    const res = detectSavingsTransaction('На примхи (10% від витрат)', -52.00);
    expect(res.isSavings).toBe(true);
    expect(res.ruleName).toBe('monobank_whims');
    expect(res.tags).toContain('savings_whims');
  });

  it('detects deposit into jar («У Банку»)', () => {
    const res = detectSavingsTransaction('Переказ у Банку «На квадрокоптер»', -500);
    expect(res.isSavings).toBe(true);
    expect(res.tags).toContain('jar');
  });

  it('detects withdrawal from jar into account', () => {
    const res = detectSavingsTransaction('З Банки «Резервний фонд»', 1200);
    expect(res.isSavings).toBe(true);
    expect(res.tags).toContain('jar_withdrawal');
  });

  it('detects bank term deposit placement', () => {
    const res = detectSavingsTransaction('Поповнення депозиту Стандартний', -10000);
    expect(res.isSavings).toBe(true);
    expect(res.tags).toContain('deposit');
  });

  it('does NOT misclassify regular grocery shopping as savings', () => {
    const res = detectSavingsTransaction('Сільпо, чек №1234', -350);
    expect(res.isSavings).toBe(false);
  });
});

describe('2. Refund & Cancellation Matcher', () => {
  it('detects cancellation prefix («Скасування. Bolt»)', () => {
    const res = isRefundOrCancellation('Скасування. Bolt Taxi Kyiv', 185);
    expect(res.isRefund).toBe(true);
    expect(res.originalQuery).toBe('Bolt Taxi Kyiv');
  });

  it('detects Ukrainian return («Повернення товару Розетка»)', () => {
    const res = isRefundOrCancellation('Повернення коштів Rozetka', 1420);
    expect(res.isRefund).toBe(true);
  });

  it('detects English refund with positive credit', () => {
    const res = isRefundOrCancellation('Refund APPLE.COM/BILL', 99);
    expect(res.isRefund).toBe(true);
  });

  it('does not classify regular income (e.g. salary) as refund', () => {
    const res = isRefundOrCancellation('Зарахування заробітної плати ТОВ ЕПАМ', 45000);
    expect(res.isRefund).toBe(false);
  });
});

describe('3. Ukrainian Merchant Dictionary & Gateway Cleaner', () => {
  it('cleans gateway prefixes and normalizes Ukrainian brands', () => {
    expect(cleanMerchantName('LIQPAY*SILPO KYIV UA')).toBe('Сільпо');
    expect(cleanMerchantName('WFP*NOVUS RETAIL')).toBe('Novus');
    expect(cleanMerchantName('TOV ATB-MARKET N432')).toBe('АТБ');
    expect(cleanMerchantName('FOP PETRENKO KAFE')).toBe('PETRENKO KAFE');
    expect(cleanMerchantName('PAYPAL *STEAM GAMES')).toBe('Steam');
  });

  it('identifies top gas stations and utilities', () => {
    const gas = matchUkrainianMerchant('WFP*OKKO AZS 24 KYIV');
    expect(gas?.cleanName).toBe('OKKO');
    expect(gas?.suggestedCategory).toBe('transport');
    expect(gas?.tags).toContain('fuel');

    const yasno = matchUkrainianMerchant('ТОВ КИЇВСЬКІ ЕНЕРГЕТИЧНІ ПОСЛУГИ YASNO');
    expect(yasno?.cleanName).toBe('Yasno');
    expect(yasno?.suggestedCategory).toBe('housing');
    expect(yasno?.tags).toContain('utilities');
  });

  it('identifies military aid and ZSU funds', () => {
    const zsu = matchUkrainianMerchant('БФ ПОВЕРНИСЬ ЖИВИМ');
    expect(zsu?.cleanName).toBe('Повернись живим');
    expect(zsu?.suggestedCategory).toBe('charity');
    expect(zsu?.tags).toContain('zsu');
  });
});

describe('4. Unified Intelligence Engine Pipeline', () => {
  it('enriches transaction with clean merchant, correct type, and tags', () => {
    const enriched = enrichTransaction({
      description: 'LIQPAY*SILPO CHORNOVOLA',
      amount: -450,
      currency: 'UAH',
      currentCategoryId: 'other',
    });

    expect(enriched.cleanMerchant).toBe('Сільпо');
    expect(enriched.transactionType).toBe('expense');
    expect(enriched.tags).toContain('groceries');
    expect(enriched.isSavings).toBe(false);
  });

  it('isolates jar savings properly in the pipeline', () => {
    const enriched = enrichTransaction({
      description: 'На примхи (10% від витрат)',
      amount: -85,
      currency: 'UAH',
      currentCategoryId: 'other',
    });

    expect(enriched.isSavings).toBe(true);
    expect(enriched.transactionType).toBe('savings_jar');
    expect(enriched.tags).toContain('savings_whims');
  });

  it('handles P2P contact transfers', () => {
    const enriched = enrichTransaction({
      description: 'Переказ на картку Анастасія О.',
      amount: -300,
      currency: 'UAH',
      currentCategoryId: 'other',
    });

    expect(enriched.tags).toContain('p2p_contact');
    expect(enriched.tags).toContain('p2p_family');
  });
});

describe('5. Analytics & KPI Calculations with Intelligence', () => {
  const dummyCategories: Category[] = [
    { id: 'groceries', name: 'Продукти', color: '#10b981', icon: 'ShoppingCart' },
    { id: 'transport', name: 'Транспорт', color: '#3b82f6', icon: 'Car' },
    { id: 'housing', name: 'Житло та комунальні', color: '#f59e0b', icon: 'Home' },
    { id: 'charity', name: 'Благодійність', color: '#ec4899', icon: 'Heart' },
  ];

  const transactions: Transaction[] = [
    {
      id: '1',
      hash: 'h1',
      date: '2024-03-01T10:00:00',
      amount: 50000,
      currency: 'UAH',
      description: 'Зарахування зарплати',
      categoryId: 'income',
      source: 'monobank',
      accountId: 'black',
      transactionType: 'income',
      isSavings: false,
    },
    {
      id: '2',
      hash: 'h2',
      date: '2024-03-02T12:00:00',
      amount: -2500,
      currency: 'UAH',
      description: 'LIQPAY*SILPO KYIV',
      cleanMerchant: 'Сільпо',
      categoryId: 'groceries',
      source: 'monobank',
      accountId: 'white',
      transactionType: 'expense',
      isSavings: false,
    },
    {
      id: '3',
      hash: 'h3',
      date: '2024-03-03T15:00:00',
      amount: -5000,
      currency: 'UAH',
      description: 'На примхи (10% від витрат)',
      cleanMerchant: 'Накопичення: На примхи',
      categoryId: 'other',
      source: 'monobank',
      accountId: 'black',
      transactionType: 'savings_jar',
      isSavings: true, // MUST NOT BE IN LIVING EXPENSES
    },
    {
      id: '4',
      hash: 'h4',
      date: '2024-03-04T18:00:00',
      amount: -300,
      currency: 'UAH',
      description: 'Bolt Taxi',
      cleanMerchant: 'Bolt',
      categoryId: 'transport',
      source: 'monobank',
      accountId: 'black',
      transactionType: 'expense',
      isSavings: false,
    },
    {
      id: '5',
      hash: 'h5',
      date: '2024-03-04T18:30:00',
      amount: 300,
      currency: 'UAH',
      description: 'Скасування. Bolt Taxi',
      cleanMerchant: 'Bolt',
      categoryId: 'transport',
      source: 'monobank',
      accountId: 'black',
      transactionType: 'refund', // MUST NET OUT AGAINST TRANSPORT EXPENSE
      isSavings: false,
    },
    {
      id: '6',
      hash: 'h6',
      date: '2024-03-05T11:00:00',
      amount: -1000,
      currency: 'UAH',
      description: 'БФ Повернись живим ЗСУ',
      cleanMerchant: 'Повернись живим',
      categoryId: 'charity',
      source: 'monobank',
      accountId: 'black',
      transactionType: 'expense',
      tags: ['zsu', 'charity'],
      isSavings: false,
    },
    {
      id: '7',
      hash: 'h7',
      date: '2024-03-06T14:00:00',
      amount: -1200,
      currency: 'UAH',
      description: 'Оплата рахунку YASNO електроенергія',
      cleanMerchant: 'Yasno',
      categoryId: 'housing',
      source: 'monobank',
      accountId: 'white',
      transactionType: 'expense',
      tags: ['utilities', 'electricity'],
      isSavings: false,
    },
  ];

  it('KPI calculator isolates jar savings and nets refunds correctly', () => {
    const kpi = calculateKPIs(transactions);

    // Living expenses: Silpo (2500) + Charity (1000) + Yasno (1200) + Bolt (300) - Refund Bolt (300) = 4700 UAH
    // Jar savings (5000) is excluded from living expenses!
    expect(kpi.totalExpenses).toBe(4700);
    expect(kpi.totalIncome).toBe(50000);
    expect(kpi.totalSavedInJars).toBe(5000);
    expect(kpi.jarSavingsRate).toBe(10); // 5000 / 50000 = 10%
    expect(kpi.totalDonationsZSU).toBe(1000);
  });

  it('category breakdown excludes jars and nets refunds to 0 for Bolt', () => {
    const breakdown = calculateCategoryBreakdown(transactions, dummyCategories);

    // Transport expense had 300 - 300 refund = 0, so it shouldn't have active spend
    const transportItem = breakdown.find(b => b.categoryId === 'transport');
    expect(transportItem).toBeUndefined();

    // Groceries should be exactly 2500 UAH
    const groceryItem = breakdown.find(b => b.categoryId === 'groceries');
    expect(groceryItem?.amount).toBe(2500);

    // Housing (Yasno) should be 1200 UAH
    const housingItem = breakdown.find(b => b.categoryId === 'housing');
    expect(housingItem?.amount).toBe(1200);
  });

  it('top merchants uses clean names and excludes jars', () => {
    const top = calculateTopMerchants(transactions);
    const names = top.map(t => t.merchant);

    expect(names).toContain('Сільпо');
    expect(names).toContain('Yasno');
    expect(names).toContain('Повернись живим');
    expect(names).not.toContain('На примхи (10% від витрат)');
  });

  it('utilities checklist correctly spots paid Yasno bill', () => {
    const status = calculateUtilitiesStatus(transactions);
    const electricity = status.find(s => s.id === 'electricity');
    const gas = status.find(s => s.id === 'gas');

    expect(electricity?.isPaid).toBe(true);
    expect(electricity?.paidAmount).toBe(1200);
    expect(electricity?.merchant).toBe('Yasno');

    expect(gas?.isPaid).toBe(false);
  });
});
