import React from 'react';
import { Column } from '@ant-design/plots';
import type { MonthlyCashflowPoint } from '../../services/analytics/kpiCalculator';

interface CashflowChartProps {
  data: MonthlyCashflowPoint[];
}

export const CashflowChart: React.FC<CashflowChartProps> = ({ data }) => {
  if (!data || data.length === 0) {
    return (
      <div className="ant-card" style={{ padding: 24, textAlign: 'center', height: 380, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ color: 'var(--text-tertiary)', fontSize: 14 }}>
          Немає даних грошового потоку для побудови графіку
        </div>
      </div>
    );
  }

  // Transform data into grouped format for Ant Design Column
  const chartData: { month: string; type: string; value: number }[] = [];
  data.forEach((d) => {
    chartData.push({
      month: d.displayMonth,
      type: 'Доходи',
      value: d.income,
    });
    chartData.push({
      month: d.displayMonth,
      type: 'Витрати',
      value: d.expense,
    });
  });

  const config = {
    data: chartData,
    xField: 'month',
    yField: 'value',
    colorField: 'type',
    group: true,
    scale: {
      color: {
        range: ['#52c41a', '#ff4d4f'],
      },
      y: {
        nice: true,
      },
    },
    style: {
      radiusTopLeft: 6,
      radiusTopRight: 6,
    },
    legend: {
      color: {
        position: 'top',
        layout: { justifyContent: 'flex-end' },
      },
    },
    tooltip: {
      items: [
        (d: any) => ({
          name: d.type,
          value: `${new Intl.NumberFormat('uk-UA').format(d.value)} ₴`,
        }),
      ],
    },
    axis: {
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
            Динаміка доходів та витрат (Cashflow)
          </h3>
          <p style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
            Щомісячне порівняння надходжень та списань (Ant Design Column)
          </p>
        </div>
        <span className="badge badge-success">
          {data.length} місяців
        </span>
      </div>

      <div style={{ flex: 1, minHeight: 320, position: 'relative' }}>
        <Column {...config} />
      </div>
    </div>
  );
};
