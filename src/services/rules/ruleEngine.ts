import type { CategorizationRule, Transaction } from '../../types/finance';
import { db } from '../../db/database';

export function matchRule(transaction: Transaction, rule: CategorizationRule): boolean {
  if (!rule.isActive) return false;

  let testValue = '';
  if (rule.matchField === 'description') {
    testValue = transaction.description.toLowerCase();
  } else if (rule.matchField === 'mcc') {
    testValue = String(transaction.mcc || '');
  } else if (rule.matchField === 'originalCategory') {
    testValue = (transaction.originalCategory || '').toLowerCase();
  }

  const pattern = rule.pattern.toLowerCase();

  switch (rule.operator) {
    case 'contains': {
      // Supports OR via '|' e.g. "silpo|сільпо"
      const subPatterns = pattern.split('|').map(p => p.trim());
      return subPatterns.some(p => p && testValue.includes(p));
    }
    case 'equals':
      return testValue === pattern;
    case 'startsWith':
      return testValue.startsWith(pattern);
    case 'regex':
      try {
        const re = new RegExp(rule.pattern, 'i');
        return re.test(testValue);
      } catch {
        return false;
      }
    default:
      return false;
  }
}

export function evaluateTransactionCategory(
  transaction: Transaction,
  rules: CategorizationRule[]
): { categoryId: string; subCategory?: string } {
  // Sorted by priority ascending
  const sortedRules = [...rules].filter(r => r.isActive).sort((a, b) => a.priority - b.priority);

  for (const rule of sortedRules) {
    if (matchRule(transaction, rule)) {
      return {
        categoryId: rule.targetCategoryId,
        subCategory: rule.targetSubCategory,
      };
    }
  }

  return {
    categoryId: transaction.categoryId,
    subCategory: transaction.subCategory,
  };
}

export async function createRuleFromTransaction(
  transaction: Transaction,
  targetCategoryId: string
): Promise<CategorizationRule> {
  // Extract a clean keyword or use the description
  const cleanPattern = transaction.description
    .replace(/[0-9*#]/g, '')
    .trim()
    .slice(0, 30);

  const existingRules = await db.rules.toArray();
  const maxPriority = existingRules.length > 0 ? Math.max(...existingRules.map(r => r.priority)) : 0;

  const newRule: CategorizationRule = {
    id: `rule_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    matchField: 'description',
    operator: 'contains',
    pattern: cleanPattern || transaction.description,
    targetCategoryId,
    priority: maxPriority + 1,
    isActive: true,
  };

  await db.rules.add(newRule);
  return newRule;
}

export async function applyRuleBackfill(rule: CategorizationRule): Promise<number> {
  const transactions = await db.transactions.toArray();
  const toUpdate: Transaction[] = [];

  for (const t of transactions) {
    if (matchRule(t, rule) && t.categoryId !== rule.targetCategoryId) {
      toUpdate.push({
        ...t,
        categoryId: rule.targetCategoryId,
        subCategory: rule.targetSubCategory || t.subCategory,
      });
    }
  }

  if (toUpdate.length > 0) {
    await db.transactions.bulkPut(toUpdate);
  }

  return toUpdate.length;
}
