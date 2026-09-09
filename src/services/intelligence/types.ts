import type { TransactionType } from '../../types/finance';

export interface EnrichedIntelligenceResult {
  transactionType: TransactionType;
  cleanMerchant?: string;
  categoryId?: string;
  subCategory?: string;
  tags?: string[];
  isSavings?: boolean;
  isSubscription?: boolean;
  notes?: string;
}

export interface MerchantRule {
  pattern: RegExp | string;
  cleanName: string;
  categoryId: string;
  subCategory?: string;
  tags?: string[];
  isSubscription?: boolean;
}
