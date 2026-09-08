import React from 'react';
import { AlertCircle, Sliders } from 'lucide-react';
import type { CategoryExpenseBreakdown } from '../../services/analytics/kpiCalculator';
import { formatUah } from '../../services/analytics/kpiCalculator';

interface BudgetProgressListProps {
  breakdown: CategoryExpenseBreakdown[];
  onOpenSettings?: () => void;
}

export const BudgetProgressList: React.FC<BudgetProgressListProps> = ({
  breakdown,
  onOpenSettings,
}) => {
  const budgetedCategories = breakdown.filter(b => b.budgetLimit && b.budgetLimit > 0);

  return (
    <div className="ant-card" style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div>
          <h3 style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-primary)', fontFamily: 'var(--font-display)' }}>
            Контроль бюджетів та лімітів
          </h3>
          <p style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
            Відстеження витрат за встановленими лімітами
          </p>
        </div>
        <button
          onClick={onOpenSettings}
          className="btn btn-ghost btn-sm"
          title="Налаштувати ліміти категорій"
        >
          <Sliders size={14} />
          <span>Налаштувати</span>
        </button>
      </div>

      {budgetedCategories.length === 0 ? (
        <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-tertiary)', fontSize: 13 }}>
          Немає налаштованих бюджетів. Натисніть «Налаштувати», щоб додати ліміти на категорії.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {budgetedCategories.map((c) => {
            const limit = c.budgetLimit || 1;
            const percent = Math.min(150, Math.round((c.amount / limit) * 100));
            const isOver = c.amount > limit;
            const isWarning = !isOver && percent >= 75;

            let progressColor = '#52c41a'; // emerald
            if (isOver) progressColor = '#ff4d4f'; // crimson
            else if (isWarning) progressColor = '#faad14'; // amber

            return (
              <div key={c.categoryId} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 13 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ width: 8, height: 8, borderRadius: '50%', background: c.categoryColor }} />
                    <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{c.categoryName}</span>
                    {isOver && (
                      <span className="badge badge-danger" style={{ fontSize: 10, padding: '1px 5px' }}>
                        <AlertCircle size={10} /> Перевитрата
                      </span>
                    )}
                  </div>
                  <div className="tabular-nums" style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                    <span style={{ fontWeight: 600, color: isOver ? 'var(--danger)' : 'var(--text-primary)' }}>
                      {formatUah(c.amount)}
                    </span>
                    {' / '}
                    <span>{formatUah(limit)}</span>
                    <span style={{ marginLeft: 6, fontWeight: 700, color: progressColor }}>
                      ({percent}%)
                    </span>
                  </div>
                </div>

                {/* Progress Bar (Ant Design Style) */}
                <div style={{
                  width: '100%',
                  height: 8,
                  borderRadius: 'var(--radius-full)',
                  background: 'var(--bg-surface-hover)',
                  overflow: 'hidden',
                  position: 'relative',
                }}>
                  <div style={{
                    width: `${Math.min(100, percent)}%`,
                    height: '100%',
                    borderRadius: 'var(--radius-full)',
                    background: progressColor,
                    transition: 'width 0.4s ease',
                  }} />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
