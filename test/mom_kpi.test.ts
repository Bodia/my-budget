import { describe, it, expect } from 'vitest';
import { calculateKPIs } from '../src/services/analytics/kpiCalculator';
import type { Transaction } from '../src/types/finance';

function createMockTx(partial: Partial<Transaction>): Transaction {
  return {
    id: 'tx_' + Math.random().toString(36).slice(2, 9),
    hash: 'hash_' + Math.random().toString(36).slice(2, 9),
    date: '2024-03-15T12:00:00',
    amount: -100,
    currency: 'UAH',
    description: 'Test transaction',
    categoryId: 'groceries',
    source: 'monobank',
    accountId: 'monobank_black',
    ...partial,
  };
}

describe('SCRUM-9: Month-over-Month (MoM) Dynamic Deltas in KPI Calculator', () => {
  it('returns null deltas and hasPreviousPeriodData = false when no previous period exists', () => {
    const currentTx = [
      createMockTx({ amount: -1000, categoryId: 'groceries' }),
      createMockTx({ amount: 5000, categoryId: 'income_salary' }),
    ];

    const kpi = calculateKPIs(currentTx, 30);
    expect(kpi.hasPreviousPeriodData).toBe(false);
    expect(kpi.expensesDeltaPercent).toBeNull();
    expect(kpi.incomeDeltaPercent).toBeNull();
    expect(kpi.netSavingsDeltaPercent).toBeNull();
    expect(kpi.totalExpenses).toBe(1000);
    expect(kpi.totalIncome).toBe(5000);
  });

  it('correctly calculates MoM deltas when expenses decrease (positive trend)', () => {
    const prevTx = [
      createMockTx({ amount: -2000, categoryId: 'groceries' }),
      createMockTx({ amount: 10000, categoryId: 'income_salary' }),
    ];
    const currentTx = [
      createMockTx({ amount: -1500, categoryId: 'groceries' }), // 500 less expenses = -25%
      createMockTx({ amount: 12000, categoryId: 'income_salary' }), // 2000 more income = +20%
    ];

    const kpi = calculateKPIs(currentTx, 30, prevTx);
    expect(kpi.hasPreviousPeriodData).toBe(true);
    expect(kpi.totalExpenses).toBe(1500);
    expect(kpi.totalIncome).toBe(12000);

    // Expenses dropped from 2000 to 1500 (-25%)
    expect(kpi.expensesDeltaPercent).toBe(-25);
    expect(kpi.expensesDeltaAmount).toBe(-500);

    // Income grew from 10000 to 12000 (+20%)
    expect(kpi.incomeDeltaPercent).toBe(20);
    expect(kpi.incomeDeltaAmount).toBe(2000);

    // Net savings grew from 8000 to 10500 (+31.25% ~ +31.3%)
    expect(kpi.netSavingsDeltaPercent).toBeCloseTo(31.3, 1);
  });

  it('correctly calculates MoM deltas when expenses increase (warning trend)', () => {
    const prevTx = [
      createMockTx({ amount: -1000, categoryId: 'groceries' }),
      createMockTx({ amount: 5000, categoryId: 'income_salary' }),
    ];
    const currentTx = [
      createMockTx({ amount: -1500, categoryId: 'groceries' }), // +50% expense increase
      createMockTx({ amount: 5000, categoryId: 'income_salary' }),
    ];

    const kpi = calculateKPIs(currentTx, 30, prevTx);
    expect(kpi.expensesDeltaPercent).toBe(50);
    expect(kpi.expensesDeltaAmount).toBe(500);
    expect(kpi.incomeDeltaPercent).toBe(0);
  });

  it('strictly excludes internal transfers and budget-excluded operations from both periods', () => {
    const prevTx = [
      createMockTx({ amount: -1000, categoryId: 'groceries' }),
      createMockTx({ amount: -5000, transactionType: 'transfer', description: 'Переказ на картку дружини' }),
      createMockTx({ amount: 10000, categoryId: 'income_salary' }),
    ];
    const currentTx = [
      createMockTx({ amount: -1000, categoryId: 'groceries' }),
      createMockTx({ amount: -20000, isExcludedFromBudget: true, description: 'Обмін валют' }),
      createMockTx({ amount: 10000, categoryId: 'income_salary' }),
    ];

    const kpi = calculateKPIs(currentTx, 30, prevTx);
    expect(kpi.totalExpenses).toBe(1000);
    expect(kpi.expensesDeltaPercent).toBe(0);
    expect(kpi.expensesDeltaAmount).toBe(0);
  });

  it('handles Monobank jar savings separately without bloating living expenses', () => {
    const prevTx = [
      createMockTx({ amount: -1000, categoryId: 'groceries' }),
      createMockTx({ amount: -500, isSavings: true, transactionType: 'savings_jar', description: 'Округлення балансу в Банку' }),
      createMockTx({ amount: 5000, categoryId: 'income_salary' }),
    ];
    const currentTx = [
      createMockTx({ amount: -1000, categoryId: 'groceries' }),
      createMockTx({ amount: -1500, isSavings: true, transactionType: 'savings_jar', description: 'На примхи в Банку' }),
      createMockTx({ amount: 5000, categoryId: 'income_salary' }),
    ];

    const kpi = calculateKPIs(currentTx, 30, prevTx);
    // Living expenses remain 1000 in both periods
    expect(kpi.totalExpenses).toBe(1000);
    expect(kpi.expensesDeltaPercent).toBe(0);
    expect(kpi.totalSavedInJars).toBe(1500);
  });
});
