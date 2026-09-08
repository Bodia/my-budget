import React from 'react';
import { Bar } from '@ant-design/plots';
import type { MerchantSpendItem } from '../../services/analytics/kpiCalculator';

interface TopMerchantsChartProps {
  merchants: MerchantSpendItem[];
}

export const TopMerchantsChart: React.FC<TopMerchantsChartProps> = ({ merchants }) => {
  if (!merchants || merchants.length === 0) {
    return (
      <div className="ant-card" style={{ padding: 24, textAlign: 'center', height: 350, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ color: 'var(--text-tertiary)', fontSize: 14 }}>
          Немає даних контрагентів
        </div>
      </div>
    );
  }

  // Take top 8 items, reverse for bottom-to-top ascending display in Bar chart
  const data = [...merchants.slice(0, 8)].reverse();

  const config = {
    data,
    xField: 'merchant',
    yField: 'amount',
    colorField: 'amount',
    scale: {
      color: {
        palette: 'blues',
      },
      y: {
        nice: true,
      },
    },
    style: {
      radiusTopRight: 4,
      radiusBottomRight: 4,
      fill: '#1677ff',
    },
    tooltip: {
      items: [
        (d: any) => ({
          name: 'Всього витрачено',
          value: `${new Intl.NumberFormat('uk-UA').format(d.amount)} ₴ (${d.count} транзакцій)`,
        }),
      ],
    },
    legend: false,
    axis: {
      x: {
        labelSpacing: 8,
        labelAutoRotate: false,
      },
      y: {
        labelFormatter: (v: any) => `${Math.round(v / 1000)}k ₴`,
      },
    },
    animate: { enter: { type: 'waveIn' } },
  };

  return (
    <div className="ant-card" style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div>
          <h3 style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-primary)', fontFamily: 'var(--font-display)' }}>
            Топ-8 одержувачів коштів
          </h3>
          <p style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
            Контрагенти з найбільшим сумарним списанням (Ant Design Bar)
          </p>
        </div>
        <span className="badge badge-primary">
          Торговці
        </span>
      </div>

      <div style={{ flex: 1, minHeight: 280, position: 'relative' }}>
        <Bar {...config} />
      </div>
    </div>
  );
};
