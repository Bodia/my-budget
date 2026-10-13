import { describe, it, expect } from 'vitest';
import { 
  getLatestReportedMonth, 
  getCurrentYearRange, 
  getFilterRange, 
  formatUkrainianMonth 
} from '../src/utils/dateFilterUtils';

describe('SCRUM-22: Time Filter Overhaul & Date Range Utils', () => {
  const mockTransactions = [
    { date: '2024-06-15' },
    { date: '2024-07-02' },
    { date: '2024-08-20' },
    { date: '2024-08-31' },
  ];

  it('correctly formats Ukrainian month names', () => {
    expect(formatUkrainianMonth(2024, 1)).toBe('Січень 2024');
    expect(formatUkrainianMonth(2024, 8)).toBe('Серпень 2024');
    expect(formatUkrainianMonth(2026, 9)).toBe('Вересень 2026');
    expect(formatUkrainianMonth(2024, 12)).toBe('Грудень 2024');
  });

  describe('Latest Reported Month (Останній звітний місяць)', () => {
    it('identifies the latest reported month based on the closest transaction <= today', () => {
      const simulatedNow = new Date(2026, 8, 29); // 2026-09-29
      const result = getLatestReportedMonth(mockTransactions, simulatedNow);

      expect(result.year).toBe(2024);
      expect(result.month).toBe(8);
      expect(result.label).toBe('Серпень 2024');
      expect(result.startDate).toBe('2024-08-01');
      expect(result.endDate).toBe('2024-08-31');
    });

    it('ignores future-dated transactions if any exist beyond simulated now', () => {
      const withFuture = [
        ...mockTransactions,
        { date: '2027-01-10' }, // Future transaction
      ];
      const simulatedNow = new Date(2026, 8, 29);
      const result = getLatestReportedMonth(withFuture, simulatedNow);

      expect(result.year).toBe(2024);
      expect(result.month).toBe(8);
      expect(result.label).toBe('Серпень 2024');
    });

    it('falls back to current month if transactions array is empty', () => {
      const simulatedNow = new Date(2026, 8, 29); // September 2026
      const result = getLatestReportedMonth([], simulatedNow);

      expect(result.year).toBe(2026);
      expect(result.month).toBe(9);
      expect(result.label).toBe('Вересень 2026');
      expect(result.startDate).toBe('2026-09-01');
      expect(result.endDate).toBe('2026-09-30');
    });

    it('calculates MoM previous month correctly for latest reported month', () => {
      const simulatedNow = new Date(2026, 8, 29);
      const range = getFilterRange('latest_month', { startDate: '', endDate: '' }, mockTransactions, simulatedNow);

      expect(range.startDate).toBe('2024-08-01');
      expect(range.endDate).toBe('2024-08-31');
      expect(range.prevStartDate).toBe('2024-07-01');
      expect(range.prevEndDate).toBe('2024-07-31');
      expect(range.days).toBe(31);
    });
  });

  describe('Current Calendar Year (Поточний рік)', () => {
    it('returns the current calendar year range based on system date', () => {
      const simulatedNow = new Date(2026, 8, 29);
      const yearRange = getCurrentYearRange(simulatedNow);

      expect(yearRange.year).toBe(2026);
      expect(yearRange.startDate).toBe('2026-01-01');
      expect(yearRange.endDate).toBe('2026-12-31');
      expect(yearRange.label).toBe('Рік 2026');
    });

    it('calculates previous calendar year correctly for MoM', () => {
      const simulatedNow = new Date(2026, 8, 29);
      const range = getFilterRange('current_year', { startDate: '', endDate: '' }, mockTransactions, simulatedNow);

      expect(range.startDate).toBe('2026-01-01');
      expect(range.endDate).toBe('2026-12-31');
      expect(range.prevStartDate).toBe('2025-01-01');
      expect(range.prevEndDate).toBe('2025-12-31');
    });
  });

  describe('Custom Date Range (Конкретний діапазон)', () => {
    it('handles exact custom date ranges and computes days dynamically', () => {
      const custom = {
        startDate: '2024-07-01',
        endDate: '2024-07-15',
      };
      const range = getFilterRange('custom', custom, mockTransactions);

      expect(range.startDate).toBe('2024-07-01');
      expect(range.endDate).toBe('2024-07-15');
      expect(range.days).toBe(15);
      expect(range.prevEndDate).toBe('2024-06-30');
      expect(range.prevStartDate).toBe('2024-06-16');
    });

    it('falls back gracefully if start date is after end date', () => {
      const custom = {
        startDate: '2024-08-20',
        endDate: '2024-08-10', // Invalid: end before start
      };
      const range = getFilterRange('custom', custom, mockTransactions);

      // Should automatically normalize so startDate <= endDate
      expect(range.startDate).toBe('2024-08-10');
      expect(range.endDate).toBe('2024-08-20');
      expect(range.days).toBe(11);
    });
  });
});
