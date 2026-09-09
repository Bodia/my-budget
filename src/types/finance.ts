export type CurrencyCode = 'UAH' | 'USD' | 'EUR' | string;

export interface Transaction {
  id: string;               // UUID or deterministic hash
  hash: string;             // sha256 of normalized fields for deduplication
  date: string;             // ISO 8601 string: "YYYY-MM-DDTHH:mm:ss"
  amount: number;           // Negative for expenses, positive for income
  currency: CurrencyCode;
  originalAmount?: number;  // If foreign transaction
  originalCurrency?: string;
  description: string;      // Merchant / clean transaction text
  originalCategory?: string;// Category reported by Monobank or Toshl
  categoryId: string;       // Normalized category ID in the system
  subCategory?: string;     // Optional subcategory (e.g. "Пальне", "Кава")
  mcc?: number;             // Merchant Category Code (from Monobank)
  source: 'monobank' | 'toshl' | 'generic' | 'manual';
  accountId: string;        // E.g. "Монобанка Чорна", "Toshl Wallet", "Готівка"
  cardLast4?: string;       // Last 4 digits of the card e.g. "1234"
  cardNumberMasked?: string;// Formatted masked card e.g. "**** **** **** 1234"
  notes?: string;           // Optional user notes
  isSubscription?: boolean; // Flagged by smart insight engine
}

export interface Category {
  id: string;
  name: string;             // Ukrainian display name
  icon: string;             // Lucide icon identifier
  color: string;            // HEX / HSL color for charts
  type: 'expense' | 'income';
  isEssential: boolean;     // For 50/30/20 budget analysis (Needs vs Wants)
  subCategories: string[];
}

export interface Budget {
  id: string;
  categoryId: string;
  monthlyLimit: number;     // Limit in base currency (UAH)
  currency: CurrencyCode;
  alertThresholdPercent: number; // Defaults to 80%
}

export interface CategorizationRule {
  id: string;
  matchField: 'description' | 'mcc' | 'originalCategory';
  operator: 'contains' | 'equals' | 'startsWith' | 'regex';
  pattern: string;
  targetCategoryId: string;
  targetSubCategory?: string;
  priority: number;         // Lower number = higher priority
  isActive: boolean;
}

export interface ExchangeRate {
  currency: CurrencyCode;
  rateToUah: number;        // e.g. 41.50 for USD
  updatedAt: string;        // ISO string
}

export interface Account {
  id: string;
  name: string;
  type: 'bank_card' | 'cash' | 'savings' | 'other';
  currency: CurrencyCode;
  cardLast4?: string;       // Last 4 digits of the card e.g. "1234"
  cardNumberMasked?: string;// Formatted masked card e.g. "**** **** **** 1234"
  color?: string;           // Optional accent color for the card
}

export type InsightType = 'subscription' | 'spike' | 'latte_factor' | 'budget_50_30_20';

export interface SavingInsight {
  id: string;
  type: InsightType;
  title: string;
  description: string;
  potentialMonthlySavings: number; // in UAH
  potentialAnnualSavings: number;  // in UAH
  severity: 'info' | 'warning' | 'danger';
  categoryId?: string;
  merchantName?: string;
  actionText?: string;
  actionPayload?: any;
}

export interface ImportSummary {
  fileName: string;
  detectedSource: 'monobank' | 'toshl' | 'generic';
  totalRows: number;
  newRows: number;
  duplicateRows: number;
  previewRows: Transaction[];
  draftTransactions: Transaction[];
}

export interface DateFilterRange {
  startDate: string; // "YYYY-MM-DD"
  endDate: string;   // "YYYY-MM-DD"
  label: string;
}
