import React from 'react';
import { Pie } from '@ant-design/plots';
import type { CategoryExpenseBreakdown } from '../../services/analytics/kpiCalculator';

interface CategoryDonutChartProps {
  breakdown: CategoryExpenseBreakdown[];
  totalExpenses: number;
  onSelectCategory?: (categoryId: string) => void;
}

export const CategoryDonutChart: React.FC<CategoryDonutChartProps> = ({
  breakdown,
  totalExpenses,
  onSelectCategory,
}) => {

  if (!breakdown || breakdown.length === 0 || totalExpenses === 0) {
    return (
      <div className="ant-card" style={{ padding: 24, textAlign: 'center', height: '100%', minHeight: 380, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center' }}>
        <div style={{ color: 'var(--text-tertiary)', fontSize: 14 }}>
          Немає витрат за обраний період для побудови кругової діаграми
        </div>
      </div>
    );
  }

  // Top 7 categories + "Інші" grouping for clean Ant Design look
  const topCategories = breakdown.slice(0, 6);
  const otherAmount = breakdown.slice(6).reduce((sum, c) => sum + c.amount, 0);

  const chartData = topCategories.map((c) => ({
    type: c.categoryName,
    value: Math.round(c.amount),
    categoryId: c.categoryId,
    color: c.categoryColor,
  }));

  if (otherAmount > 0) {
    chartData.push({
      type: 'Інші категорії',
      value: Math.round(otherAmount),
      categoryId: 'other',
      color: '#94a3b8',
    });
  }

  const colorPalette = chartData.map(d => d.color);

  const config = {
    data: chartData,
    angleField: 'value',
    colorField: 'type',
    innerRadius: 0.65,
    radius: 0.88,
    scale: {
      color: {
        range: colorPalette,
      },
    },
    legend: {
      color: {
        position: 'bottom',
        layout: { justifyContent: 'center', flexWrap: 'wrap' },
      },
    },
    label: {
      text: (d: any) => `${d.type} (${((d.value / totalExpenses) * 100).toFixed(0)}%)`,
      style: {
        fontSize: 11,
        fill: 'var(--text-secondary)',
      },
      transform: [{ type: 'overlapDodgeY' }],
    },
    tooltip: {
      items: [
        (d: any) => ({
          name: d.type,
          value: `${new Intl.NumberFormat('uk-UA').format(d.value)} ₴ (${((d.value / totalExpenses) * 100).toFixed(1)}%)`,
        }),
      ],
    },
    interaction: {
      elementHighlight: true,
    },
    style: {
      stroke: 'var(--bg-surface)',
      lineWidth: 2,
    },
    animate: { enter: { type: 'waveIn' } },
  };

  return (
    <div className="ant-card" style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div>
          <h3 style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-primary)', fontFamily: 'var(--font-display)' }}>
            Структура витрат за категоріями
          </h3>
          <p style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
            Розподіл часток у відсотках (Ant Design Pie)
          </p>
        </div>
        <span className="badge badge-primary">
          {breakdown.length} категорій
        </span>
      </div>

      <div style={{ flex: 1, minHeight: 320, position: 'relative' }}>
        <Pie {...config} />
      </div>

      {/* Category List under chart for quick filtering */}
      <div style={{
        marginTop: 16,
        paddingTop: 16,
        borderTop: '1px solid var(--border-subtle)',
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
        gap: 8,
      }}>
        {breakdown.slice(0, 4).map((c) => (
          <div
            key={c.categoryId}
            onClick={() => onSelectCategory?.(c.categoryId)}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '6px 10px',
              borderRadius: 'var(--radius-sm)',
              background: 'var(--bg-surface-hover)',
              cursor: 'pointer',
              fontSize: 12,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: c.categoryColor }} />
              <span style={{ color: 'var(--text-primary)', fontWeight: 500 }}>{c.categoryName}</span>
            </div>
            <span className="tabular-nums" style={{ color: 'var(--text-secondary)', fontWeight: 600 }}>
              {c.percentage}%
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};
