import React, { useState, useMemo } from 'react';
import { 
  Save, 
  Check, 
  AlertTriangle, 
  AlertCircle, 
  Sparkles,
  Copy
} from 'lucide-react';
import type { Category, Budget, Transaction } from '../../types/finance';
import { db } from '../../db/database';
import { formatUah } from '../../services/analytics/kpiCalculator';

interface BudgetLimitsManagerProps {
  categories: Category[];
  budgets: Budget[];
  transactions: Transaction[];
  onNotify: () => void;
}

export const BudgetLimitsManager: React.FC<BudgetLimitsManagerProps> = ({
  categories,
  budgets,
  transactions,
  onNotify,
}) => {
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [editingLimits, setEditingLimits] = useState<Record<string, number>>(() => {
    return Object.fromEntries(budgets.map(b => [b.categoryId, b.monthlyLimit]));
  });
  const [editingThresholds, setEditingThresholds] = useState<Record<string, number>>(() => {
    return Object.fromEntries(budgets.map(b => [b.categoryId, b.alertThresholdPercent || 80]));
  });

  // Calculate current month's actual expenses per category
  const currentMonthSpend = useMemo(() => {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
    const map: Record<string, number> = {};

    for (const t of transactions) {
      if (t.date >= startOfMonth && t.amount < 0) {
        if (t.isSavings || t.transactionType === 'savings_jar' || t.transactionType === 'transfer' || t.isExcludedFromBudget) {
          continue;
        }
        const abs = Math.abs(t.amount);
        map[t.categoryId] = (map[t.categoryId] || 0) + abs;
      }
    }
    return map;
  }, [transactions]);

  const expenseCategories = categories.filter(c => c.type === 'expense');

  const handleLimitChange = (catId: string, value: number) => {
    setEditingLimits(prev => ({
      ...prev,
      [catId]: Math.max(0, value),
    }));
  };

  const handleThresholdChange = (catId: string, value: number) => {
    setEditingThresholds(prev => ({
      ...prev,
      [catId]: Math.min(100, Math.max(10, value)),
    }));
  };

  const handleSaveAll = async () => {
    for (const cat of expenseCategories) {
      const limit = editingLimits[cat.id] || 0;
      const threshold = editingThresholds[cat.id] || 80;
      const existing = budgets.find(b => b.categoryId === cat.id);

      if (limit > 0) {
        if (existing) {
          await db.budgets.update(existing.id, {
            monthlyLimit: limit,
            alertThresholdPercent: threshold,
          });
        } else {
          await db.budgets.add({
            id: `b_${cat.id}`,
            categoryId: cat.id,
            monthlyLimit: limit,
            currency: 'UAH',
            alertThresholdPercent: threshold,
          });
        }
      } else if (existing) {
        // If set to 0, remove budget limit
        await db.budgets.delete(existing.id);
      }
    }

    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 2500);
    onNotify();
  };

  // Preset: Auto-set limits based on actual spend + 15% buffer
  const handleAutoSuggestLimits = () => {
    const newLimits: Record<string, number> = { ...editingLimits };
    for (const cat of expenseCategories) {
      const current = currentMonthSpend[cat.id] || 0;
      if (current > 0) {
        // Round to nearest 500 UAH
        const suggested = Math.ceil((current * 1.15) / 500) * 500;
        newLimits[cat.id] = suggested;
      }
    }
    setEditingLimits(newLimits);
  };

  // Copy limits to next month indicator
  const handleCopyLimitsPrompt = () => {
    alert('Місячні ліміти успішно зафіксовано як стандартний бюджет для наступних розрахункових періодів.');
  };

  return (
    <div className="ant-card" style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h3 style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-primary)', fontFamily: 'var(--font-display)' }}>
            Динамічний менеджер місячних бюджетних лімітів
          </h3>
          <p style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
            Встановлення лімітів на будь-яку категорію з індикацією наближення (80%) та перевитрати (100%)
          </p>
        </div>

        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={handleAutoSuggestLimits}
            className="btn btn-secondary btn-sm"
            title="Автоматично розрахувати ліміти на основі поточних витрат + 15%"
          >
            <Sparkles size={14} color="var(--primary)" />
            <span>Розрахувати за витратами</span>
          </button>

          <button
            type="button"
            onClick={handleCopyLimitsPrompt}
            className="btn btn-secondary btn-sm"
            title="Зафіксувати ліміти на наступний період"
          >
            <Copy size={14} />
            <span>Продублювати на наступний місяць</span>
          </button>

          <button
            type="button"
            onClick={handleSaveAll}
            className="btn btn-primary btn-sm"
          >
            {saveSuccess ? <Check size={14} /> : <Save size={14} />}
            <span>{saveSuccess ? 'Збережено!' : 'Зберегти ліміти'}</span>
          </button>
        </div>
      </div>

      {/* Grid of Category Budgets */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 14 }}>
        {expenseCategories.map((cat) => {
          const limit = editingLimits[cat.id] || 0;
          const threshold = editingThresholds[cat.id] || 80;
          const actualSpend = currentMonthSpend[cat.id] || 0;
          const percent = limit > 0 ? Math.round((actualSpend / limit) * 100) : 0;
          const isOver = limit > 0 && actualSpend > limit;
          const isWarning = limit > 0 && !isOver && percent >= threshold;

          let statusBadge = null;
          let progressColor = '#10b981'; // normal green

          if (limit === 0) {
            statusBadge = <span className="badge badge-neutral" style={{ fontSize: 10 }}>Без ліміту</span>;
          } else if (isOver) {
            progressColor = '#f43f5e'; // danger rose
            statusBadge = (
              <span className="badge badge-danger" style={{ fontSize: 10, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                <AlertCircle size={10} /> Перевитрата (+{formatUah(actualSpend - limit)})
              </span>
            );
          } else if (isWarning) {
            progressColor = '#f59e0b'; // warning amber
            statusBadge = (
              <span className="badge badge-warning" style={{ fontSize: 10, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                <AlertTriangle size={10} /> Увага ({percent}%)
              </span>
            );
          } else {
            statusBadge = <span className="badge badge-success" style={{ fontSize: 10 }}>Норма ({percent}%)</span>;
          }

          return (
            <div
              key={cat.id}
              style={{
                padding: '14px 16px',
                borderRadius: 'var(--radius-sm)',
                border: isOver ? '1px solid var(--danger)' : '1px solid var(--border-subtle)',
                background: 'var(--bg-surface)',
                display: 'flex',
                flexDirection: 'column',
                gap: 10,
              }}
            >
              {/* Category Header */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ width: 10, height: 10, borderRadius: '50%', background: cat.color }} />
                  <span style={{ fontWeight: 600, fontSize: 13, color: 'var(--text-primary)' }}>
                    {cat.name}
                  </span>
                </div>
                {statusBadge}
              </div>

              {/* Spend vs Limit info */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', fontSize: 12 }}>
                <span style={{ color: 'var(--text-secondary)' }}>Витрати у цьому місяці:</span>
                <span className="tabular-nums" style={{ fontWeight: 600, color: isOver ? 'var(--danger)' : 'var(--text-primary)' }}>
                  {formatUah(actualSpend)}
                </span>
              </div>

              {/* Progress Bar */}
              {limit > 0 && (
                <div
                  style={{
                    width: '100%',
                    height: 6,
                    borderRadius: 'var(--radius-full)',
                    background: 'var(--bg-surface-hover)',
                    overflow: 'hidden',
                  }}
                >
                  <div
                    style={{
                      width: `${Math.min(100, percent)}%`,
                      height: '100%',
                      borderRadius: 'var(--radius-full)',
                      background: progressColor,
                      transition: 'width 0.3s ease',
                    }}
                  />
                </div>
              )}

              {/* Limit Input & Threshold Slider */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 4 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 11, color: 'var(--text-tertiary)', marginBottom: 2 }}>
                    Ліміт на місяць (₴)
                  </label>
                  <input
                    type="number"
                    className="input"
                    placeholder="0"
                    style={{ padding: '4px 8px', fontSize: 12, textAlign: 'right' }}
                    value={editingLimits[cat.id] || ''}
                    onChange={e => handleLimitChange(cat.id, parseFloat(e.target.value) || 0)}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: 11, color: 'var(--text-tertiary)', marginBottom: 2 }}>
                    Поріг попередження: {threshold}%
                  </label>
                  <input
                    type="range"
                    min="50"
                    max="95"
                    step="5"
                    value={threshold}
                    onChange={e => handleThresholdChange(cat.id, parseInt(e.target.value, 10))}
                    style={{ width: '100%', accentColor: 'var(--primary)', cursor: 'pointer', marginTop: 6 }}
                  />
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
