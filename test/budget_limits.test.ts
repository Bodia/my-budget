import { describe, it, expect } from 'vitest';
import { calculateCategoryBreakdown } from '../src/services/analytics/kpiCalculator';
import { DEFAULT_CATEGORIES, DEFAULT_BUDGETS } from '../src/db/database';
import type { Transaction, Budget, Category } from '../src/types/finance';

function createMockTx(partial: Partial<Transaction>): Transaction {
  return {
    id: 'tx_' + Math.random().toString(36).slice(2, 9),
    hash: 'hash_' + Math.random().toString(36).slice(2, 9),
    date: '2024-03-15T12:00:00',
    amount: -500,
    currency: 'UAH',
    description: 'Test expense',
    categoryId: 'groceries',
    source: 'monobank',
    accountId: 'monobank_black',
    ...partial,
  };
}

describe('SCRUM-11: Dynamic Monthly Budget Limits & Thresholds', () => {
  it('DEFAULT_BUDGETS contains a default budget for taxes_fop', () => {
    const taxBudget = DEFAULT_BUDGETS.find(b => b.categoryId === 'taxes_fop');
    expect(taxBudget).toBeDefined();
    expect(taxBudget?.monthlyLimit).toBeGreaterThan(0);
    expect(taxBudget?.alertThresholdPercent).toBe(80);
  });

  it('calculates spent percent of budget and respects custom limits', () => {
    const categories: Category[] = [
      {
        id: 'taxes_fop',
        name: 'Податки та ФОП',
        icon: 'Receipt',
        color: '#0284c7',
        type: 'expense',
        isEssential: true,
        subCategories: ['Єдиний податок', 'ЄСВ'],
      },
      {
        id: 'custom_courses',
        name: 'Курси та навчання',
        icon: 'GraduationCap',
        color: '#8b5cf6',
        type: 'expense',
        isEssential: false,
        subCategories: ['IT', 'English'],
        isCustom: true,
      },
    ];

    const budgets: Budget[] = [
      { id: 'b_taxes', categoryId: 'taxes_fop', monthlyLimit: 10000, currency: 'UAH', alertThresholdPercent: 80 },
      { id: 'b_courses', categoryId: 'custom_courses', monthlyLimit: 4000, currency: 'UAH', alertThresholdPercent: 75 },
    ];

    const transactions: Transaction[] = [
      // Taxes: 7500 spent out of 10000 limit = 75%
      createMockTx({ amount: -5000, categoryId: 'taxes_fop' }),
      createMockTx({ amount: -2500, categoryId: 'taxes_fop' }),
      // Courses: 4500 spent out of 4000 limit = 112.5% (Exceeded)
      createMockTx({ amount: -4500, categoryId: 'custom_courses' }),
    ];

    const breakdown = calculateCategoryBreakdown(transactions, categories, budgets);
    
    const taxItem = breakdown.find(b => b.categoryId === 'taxes_fop');
    expect(taxItem).toBeDefined();
    expect(taxItem?.amount).toBe(7500);
    expect(taxItem?.budgetLimit).toBe(10000);
    expect(taxItem?.spentPercentOfBudget).toBe(75);

    const courseItem = breakdown.find(b => b.categoryId === 'custom_courses');
    expect(courseItem).toBeDefined();
    expect(courseItem?.amount).toBe(4500);
    expect(courseItem?.budgetLimit).toBe(4000);
    expect(courseItem?.spentPercentOfBudget).toBe(113); // rounded to nearest int
  });

  it('excludes transfers and savings from budget consumption', () => {
    const categories: Category[] = [
      { id: 'groceries', name: 'Продукти', icon: 'ShoppingCart', color: '#10b981', type: 'expense', isEssential: true, subCategories: [] },
    ];
    const budgets: Budget[] = [
      { id: 'b_groc', categoryId: 'groceries', monthlyLimit: 5000, currency: 'UAH', alertThresholdPercent: 80 },
    ];

    const transactions: Transaction[] = [
      createMockTx({ amount: -2000, categoryId: 'groceries' }),
      createMockTx({ amount: -10000, categoryId: 'groceries', transactionType: 'transfer' }),
      createMockTx({ amount: -3000, categoryId: 'groceries', isSavings: true }),
    ];

    const breakdown = calculateCategoryBreakdown(transactions, categories, budgets);
    const item = breakdown.find(b => b.categoryId === 'groceries');
    expect(item?.amount).toBe(2000);
    expect(item?.spentPercentOfBudget).toBe(40);
  });
});
