export type TimeFilterMode = 'latest_month' | 'current_year' | 'custom';

export interface CustomDateRange {
  startDate: string;
  endDate: string;
}

export interface ComputedFilterRange {
  mode: TimeFilterMode;
  startDate: string;
  endDate: string;
  label: string;
  days: number;
  prevStartDate: string;
  prevEndDate: string;
}

const UKRAINIAN_MONTHS = [
  'Січень',
  'Лютий',
  'Березень',
  'Квітень',
  'Травень',
  'Червень',
  'Липень',
  'Серпень',
  'Вересень',
  'Жовтень',
  'Листопад',
  'Грудень',
];

const pad = (n: number): string => (n < 10 ? `0${n}` : `${n}`);

export const formatDateString = (d: Date): string => {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

export const formatUkrainianMonth = (year: number, month: number): string => {
  const monthName = UKRAINIAN_MONTHS[month - 1] || '';
  return `${monthName} ${year}`;
};

/**
 * Finds the latest reported month based on the closest transaction <= today
 */
export const getLatestReportedMonth = (
  transactions: Array<{ date: string }>,
  now: Date = new Date()
): { year: number; month: number; label: string; startDate: string; endDate: string } => {
  const todayStr = formatDateString(now);

  // Filter transactions up to today
  const validDates = transactions
    .map(t => t.date.slice(0, 10))
    .filter(d => /^\d{4}-\d{2}-\d{2}$/.test(d) && d <= todayStr);

  if (validDates.length === 0) {
    const year = now.getFullYear();
    const month = now.getMonth() + 1;
    const lastDay = new Date(year, month, 0).getDate();
    return {
      year,
      month,
      label: formatUkrainianMonth(year, month),
      startDate: `${year}-${pad(month)}-01`,
      endDate: `${year}-${pad(month)}-${pad(lastDay)}`,
    };
  }

  // Find max date <= today
  validDates.sort();
  const maxDate = validDates[validDates.length - 1];
  const [yearStr, monthStr] = maxDate.split('-');
  const year = parseInt(yearStr, 10);
  const month = parseInt(monthStr, 10);
  const lastDay = new Date(year, month, 0).getDate();

  return {
    year,
    month,
    label: formatUkrainianMonth(year, month),
    startDate: `${year}-${pad(month)}-01`,
    endDate: `${year}-${pad(month)}-${pad(lastDay)}`,
  };
};

/**
 * Returns current calendar year range based on system date
 */
export const getCurrentYearRange = (
  now: Date = new Date()
): { year: number; label: string; startDate: string; endDate: string } => {
  const year = now.getFullYear();
  return {
    year,
    label: `Рік ${year}`,
    startDate: `${year}-01-01`,
    endDate: `${year}-12-31`,
  };
};

/**
 * Resolves date range, label, days, and MoM previous period
 */
export const getFilterRange = (
  mode: TimeFilterMode,
  customRange: CustomDateRange,
  transactions: Array<{ date: string }>,
  now: Date = new Date()
): ComputedFilterRange => {
  if (mode === 'latest_month') {
    const latest = getLatestReportedMonth(transactions, now);
    const prevMonthDate = new Date(latest.year, latest.month - 2, 1);
    const prevYear = prevMonthDate.getFullYear();
    const prevMonth = prevMonthDate.getMonth() + 1;
    const prevLastDay = new Date(prevYear, prevMonth, 0).getDate();

    const lastDay = new Date(latest.year, latest.month, 0).getDate();

    return {
      mode,
      startDate: latest.startDate,
      endDate: latest.endDate,
      label: latest.label,
      days: lastDay,
      prevStartDate: `${prevYear}-${pad(prevMonth)}-01`,
      prevEndDate: `${prevYear}-${pad(prevMonth)}-${pad(prevLastDay)}`,
    };
  }

  if (mode === 'current_year') {
    const yearRange = getCurrentYearRange(now);
    const prevYear = yearRange.year - 1;
    const isLeap = (yearRange.year % 4 === 0 && yearRange.year % 100 !== 0) || yearRange.year % 400 === 0;

    return {
      mode,
      startDate: yearRange.startDate,
      endDate: yearRange.endDate,
      label: yearRange.label,
      days: isLeap ? 366 : 365,
      prevStartDate: `${prevYear}-01-01`,
      prevEndDate: `${prevYear}-12-31`,
    };
  }

  // mode === 'custom'
  let start = customRange.startDate;
  let end = customRange.endDate;

  if (!start && !end) {
    const latest = getLatestReportedMonth(transactions, now);
    start = latest.startDate;
    end = latest.endDate;
  } else if (!start) {
    start = end;
  } else if (!end) {
    end = start;
  }

  // Normalize if start > end
  if (start > end) {
    const tmp = start;
    start = end;
    end = tmp;
  }

  const startDateObj = new Date(start);
  const endDateObj = new Date(end);
  const diffTime = Math.abs(endDateObj.getTime() - startDateObj.getTime());
  const days = Math.round(diffTime / (1000 * 60 * 60 * 24)) + 1;

  // Previous period: immediately preceding range of same length
  const prevEndDateObj = new Date(startDateObj);
  prevEndDateObj.setDate(prevEndDateObj.getDate() - 1);

  const prevStartDateObj = new Date(prevEndDateObj);
  prevStartDateObj.setDate(prevStartDateObj.getDate() - (days - 1));

  return {
    mode,
    startDate: start,
    endDate: end,
    label: `${start} — ${end}`,
    days,
    prevStartDate: formatDateString(prevStartDateObj),
    prevEndDate: formatDateString(prevEndDateObj),
  };
};
