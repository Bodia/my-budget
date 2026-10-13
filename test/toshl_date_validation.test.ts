import { describe, it, expect } from 'vitest';
import { 
  parseAndValidateToshlDate, 
  parseToshlRows 
} from '../src/services/parsers/toshlAdapter';

describe('SCRUM-19: Toshl Date Parsing & Validation', () => {
  describe('parseAndValidateToshlDate', () => {
    it('successfully parses standard DD.MM.YYYY dates to YYYY-MM-DD (AC-1, AC-2)', () => {
      const res = parseAndValidateToshlDate('24.08.2024');
      expect(res.isValid).toBe(true);
      expect(res.isoDate).toBe('2024-08-24');
      expect(res.isoDate).not.toContain('T12:00:00');
    });

    it('successfully parses Toshl DD.MM.YY format where YY is 20YY (AC-1)', () => {
      const res = parseAndValidateToshlDate('24.08.24');
      expect(res.isValid).toBe(true);
      expect(res.isoDate).toBe('2024-08-24');

      expect(parseAndValidateToshlDate('01.03.24').isoDate).toBe('2024-03-01');
      expect(parseAndValidateToshlDate('31.12.25').isoDate).toBe('2025-12-31');
      expect(parseAndValidateToshlDate('29.02.24').isoDate).toBe('2024-02-29'); // Leap year 2024
      expect(parseAndValidateToshlDate('29.02.23').isValid).toBe(false); // Non-leap year 2023
    });

    it('correctly handles start and end of months (AC-4)', () => {
      expect(parseAndValidateToshlDate('01.01.2024').isoDate).toBe('2024-01-01');
      expect(parseAndValidateToshlDate('31.01.2024').isoDate).toBe('2024-01-31');
      expect(parseAndValidateToshlDate('30.04.2024').isoDate).toBe('2024-04-30');
      expect(parseAndValidateToshlDate('31.12.2024').isoDate).toBe('2024-12-31');
    });

    it('correctly validates leap years (AC-4)', () => {
      // 2024 is a leap year (divisible by 4, not 100) -> 29 Feb is valid
      expect(parseAndValidateToshlDate('29.02.2024').isValid).toBe(true);
      expect(parseAndValidateToshlDate('29.02.2024').isoDate).toBe('2024-02-29');

      // 2023 is not a leap year -> 29 Feb is invalid
      expect(parseAndValidateToshlDate('29.02.2023').isValid).toBe(false);

      // 2000 is a leap year (divisible by 400) -> 29 Feb is valid
      expect(parseAndValidateToshlDate('29.02.2000').isValid).toBe(true);

      // 2100 is not a leap year (divisible by 100, not 400) -> 29 Feb is invalid
      expect(parseAndValidateToshlDate('29.02.2100').isValid).toBe(false);
    });

    it('rejects dates exceeding days in specific months (AC-3, AC-4)', () => {
      // April has 30 days
      expect(parseAndValidateToshlDate('31.04.2024').isValid).toBe(false);
      // June has 30 days
      expect(parseAndValidateToshlDate('31.06.2024').isValid).toBe(false);
      // September has 30 days
      expect(parseAndValidateToshlDate('31.09.2024').isValid).toBe(false);
      // November has 30 days
      expect(parseAndValidateToshlDate('31.11.2024').isValid).toBe(false);
      // February non-leap has 28 days
      expect(parseAndValidateToshlDate('30.02.2024').isValid).toBe(false);
      expect(parseAndValidateToshlDate('29.02.2025').isValid).toBe(false);
    });

    it('rejects invalid numbers or formats (AC-4)', () => {
      expect(parseAndValidateToshlDate('00.05.2024').isValid).toBe(false);
      expect(parseAndValidateToshlDate('32.01.2024').isValid).toBe(false);
      expect(parseAndValidateToshlDate('15.13.2024').isValid).toBe(false);
      expect(parseAndValidateToshlDate('15.00.2024').isValid).toBe(false);
      expect(parseAndValidateToshlDate('invalid-date').isValid).toBe(false);
      expect(parseAndValidateToshlDate('').isValid).toBe(false);
      expect(parseAndValidateToshlDate(null).isValid).toBe(false);
    });

    it('supports Excel dates or single digit days/months gracefully', () => {
      // Single digit D.M.YYYY
      expect(parseAndValidateToshlDate('5.8.2024').isoDate).toBe('2024-08-05');
      // Already formatted ISO YYYY-MM-DD
      expect(parseAndValidateToshlDate('2024-08-24').isoDate).toBe('2024-08-24');
      // JS Date instance (as returned by some xlsx parsers)
      const d = new Date(Date.UTC(2024, 7, 24));
      expect(parseAndValidateToshlDate(d).isoDate).toBe('2024-08-24');
    });
  });

  describe('parseToshlRows with Date Validation & Unresolved Rows Handling (AC-4, AC-5)', () => {
    it('parses valid rows without T12:00:00 and captures corrupted rows', async () => {
      const sampleRows = [
        {
          Date: '24.08.2024',
          Category: 'Groceries',
          Description: 'Сільпо',
          'Expense amount': '350.50',
          Currency: 'UAH',
          Account: 'Monobank Black'
        },
        {
          Date: '29.02.2023', // Invalid leap date!
          Category: 'Dining',
          Description: 'Кафе Львів',
          'Expense amount': '120.00',
          Currency: 'UAH',
          Account: 'Cash'
        },
        {
          Date: '31.12.2024',
          Category: 'Shopping',
          Description: 'Новорічні подарунки',
          'Expense amount': '1500.00',
          Currency: 'UAH',
          Account: 'Monobank Black'
        },
        {
          Date: '', // Empty date!
          Category: 'Transport',
          Description: 'Uber Taxi',
          'Expense amount': '200.00',
          Currency: 'UAH',
          Account: 'Monobank Black'
        }
      ];

      const { transactions, unresolvedRows } = await parseToshlRows(sampleRows);

      // Valid transactions: 2 (24.08.2024 and 31.12.2024)
      expect(transactions).toHaveLength(2);
      expect(transactions[0].date).toBe('2024-08-24');
      expect(transactions[0].date).not.toContain('T12:00:00');
      expect(transactions[1].date).toBe('2024-12-31');

      // Unresolved rows: 2 (invalid leap day + empty date)
      expect(unresolvedRows).toHaveLength(2);
      expect(unresolvedRows[0].description).toBe('Кафе Львів');
      expect(unresolvedRows[0].rawDate).toBe('29.02.2023');
      expect(unresolvedRows[1].description).toBe('Uber Taxi');
      expect(unresolvedRows[1].rawDate).toBe('');
    });

    it('creates a valid Transaction from an UnresolvedDateRow once user inputs date (AC-5)', async () => {
      const { createTransactionFromResolvedDate } = await import('../src/services/parsers/toshlAdapter');
      const unresolvedSample = {
        rowIndex: 3,
        rawRow: {
          Date: '',
          Category: 'Transport',
          Description: 'Uber Taxi',
          'Expense amount': '200.00',
          Currency: 'UAH',
          Account: 'Monobank Black',
        },
        description: 'Uber Taxi',
        amount: -200,
        currency: 'UAH',
        originalCategory: 'Transport',
        account: 'Monobank Black',
        rawDate: '',
        errorReason: 'Дата порожня',
      };

      const resolvedTx = await createTransactionFromResolvedDate(unresolvedSample, '2024-08-25');
      expect(resolvedTx.date).toBe('2024-08-25');
      expect(resolvedTx.amount).toBe(-200);
      expect(resolvedTx.description).toBe('Uber Taxi');
      expect(resolvedTx.source).toBe('toshl');
      expect(resolvedTx.hash).toBeTruthy();
    });
  });
});

