import type { EnrichedIntelligenceResult } from './types';

/**
 * Detects merchant cancellations and refunds (e.g. "Скасування. Bolt", "Повернення товару")
 */
export function detectRefund(description: string, amount: number): EnrichedIntelligenceResult | null {
  // Refunds are typically positive adjustments (amount > 0)
  if (amount <= 0) return null;

  const desc = description.trim();
  const lower = desc.toLowerCase();

  // Monobank Bolt / service cancellation pattern: "Скасування. <Merchant>"
  if (lower.startsWith('скасування.') || lower.startsWith('скасування:')) {
    const rawTarget = desc.replace(/^скасування[.:]\s*/i, '').trim();
    
    // Check known services
    if (rawTarget.toLowerCase().includes('bolt')) {
      return {
        transactionType: 'refund',
        cleanMerchant: 'Bolt (Скасовано)',
        categoryId: 'transport',
        subCategory: 'Таксі',
        tags: ['refund', 'taxi', 'bolt'],
        isSavings: false,
      };
    }

    if (rawTarget.toLowerCase().includes('uber') || rawTarget.toLowerCase().includes('uklon')) {
      return {
        transactionType: 'refund',
        cleanMerchant: `${rawTarget} (Скасовано)`,
        categoryId: 'transport',
        subCategory: 'Таксі',
        tags: ['refund', 'taxi'],
        isSavings: false,
      };
    }

    return {
      transactionType: 'refund',
      cleanMerchant: `${rawTarget || 'Транзакція'} (Скасовано)`,
      tags: ['refund', 'cancellation'],
      isSavings: false,
    };
  }

  // General refund patterns
  if (lower.startsWith('повернення') || lower.includes('refund')) {
    const clean = desc.replace(/^повернення\s*(товару|коштів)?\s*[:.-]?\s*/i, '').trim();
    return {
      transactionType: 'refund',
      cleanMerchant: clean ? `${clean} (Повернення)` : 'Повернення коштів',
      tags: ['refund'],
      isSavings: false,
    };
  }

  return null;
}
