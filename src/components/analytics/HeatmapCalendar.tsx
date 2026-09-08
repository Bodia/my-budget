import React, { useState } from 'react';
import { Calendar as CalendarIcon, Info } from 'lucide-react';
import type { Transaction } from '../../types/finance';
import { formatUah, calculateDailyHeatmap } from '../../services/analytics/kpiCalculator';

interface HeatmapCalendarProps {
  transactions: Transaction[];
}

export const HeatmapCalendar: React.FC<HeatmapCalendarProps> = ({ transactions }) => {
  const [hoveredDay, setHoveredDay] = useState<{ date: string; amount: number; count: number } | null>(null);

  const dailySpendMap = calculateDailyHeatmap(transactions);

  // Group transaction count per day
  const dailyCountMap = new Map<string, number>();
  for (const t of transactions) {
    if (t.amount < 0 && t.date) {
      const d = t.date.slice(0, 10);
      dailyCountMap.set(d, (dailyCountMap.get(d) || 0) + 1);
    }
  }

  // Generate 52 weeks ending today
  const today = new Date();
  const days: { date: string; amount: number; count: number; dayOfWeek: number }[] = [];

  for (let i = 364; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const dateStr = d.toISOString().slice(0, 10);
    const amount = dailySpendMap.get(dateStr) || 0;
    const count = dailyCountMap.get(dateStr) || 0;
    const dayOfWeek = (d.getDay() + 6) % 7; // Monday = 0, Sunday = 6
    days.push({ date: dateStr, amount, count, dayOfWeek });
  }

  // Group into weeks
  const weeks: typeof days[] = [];
  let currentWeek: typeof days = [];

  days.forEach((day, index) => {
    currentWeek.push(day);
    if (day.dayOfWeek === 6 || index === days.length - 1) {
      weeks.push(currentWeek);
      currentWeek = [];
    }
  });

  // Determine intensity color
  const getCellColor = (amount: number): string => {
    if (amount === 0) return 'var(--border-subtle)';
    if (amount < 350) return 'rgba(22, 119, 255, 0.25)';
    if (amount < 1000) return 'rgba(22, 119, 255, 0.5)';
    if (amount < 2500) return 'rgba(22, 119, 255, 0.75)';
    return '#1677ff'; // deep primary
  };

  const dayLabels = ['Пн', '', 'Ср', '', 'Пт', '', 'Нд'];

  return (
    <div className="ant-card" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h3 style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-primary)', fontFamily: 'var(--font-display)', display: 'flex', alignItems: 'center', gap: 8 }}>
            <CalendarIcon size={18} color="var(--primary)" />
            Календар витрат (Activity Heatmap за 365 днів)
          </h3>
          <p style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
            Насиченість кольору вказує на обсяг фінансових списань у кожен день
          </p>
        </div>

        {/* Dynamic Tooltip Summary */}
        <div style={{
          minHeight: 32,
          padding: '4px 12px',
          background: 'var(--bg-surface-hover)',
          borderRadius: 'var(--radius-sm)',
          fontSize: 12,
          color: 'var(--text-secondary)',
          display: 'flex',
          alignItems: 'center',
          gap: 6,
        }}>
          {hoveredDay ? (
            <>
              <strong style={{ color: 'var(--text-primary)' }}>{hoveredDay.date}:</strong>
              <span>{formatUah(hoveredDay.amount)}</span>
              <span>({hoveredDay.count} списань)</span>
            </>
          ) : (
            <>
              <Info size={13} />
              <span>Наведіть курсор на клітинку дня для перегляду суми</span>
            </>
          )}
        </div>
      </div>

      {/* Heatmap Grid */}
      <div style={{ overflowX: 'auto', paddingBottom: 8 }}>
        <div style={{ display: 'flex', gap: 4, minWidth: 780 }}>
          {/* Day of week labels */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginRight: 4 }}>
            {dayLabels.map((lbl, idx) => (
              <div key={idx} style={{ height: 12, fontSize: 10, color: 'var(--text-tertiary)', lineHeight: '12px' }}>
                {lbl}
              </div>
            ))}
          </div>

          {/* Weeks columns */}
          {weeks.map((week, wIdx) => (
            <div key={wIdx} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {week.map((day) => (
                <div
                  key={day.date}
                  onMouseEnter={() => setHoveredDay(day)}
                  onMouseLeave={() => setHoveredDay(null)}
                  style={{
                    width: 12,
                    height: 12,
                    borderRadius: 2,
                    backgroundColor: getCellColor(day.amount),
                    cursor: 'pointer',
                    transition: 'transform 0.1s ease',
                  }}
                  title={`${day.date}: ${formatUah(day.amount)}`}
                />
              ))}
            </div>
          ))}
        </div>
      </div>

      {/* Heatmap Scale Legend */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 8, fontSize: 11, color: 'var(--text-tertiary)' }}>
        <span>Менше витрат</span>
        <div style={{ width: 10, height: 10, borderRadius: 2, backgroundColor: 'var(--border-subtle)' }} />
        <div style={{ width: 10, height: 10, borderRadius: 2, backgroundColor: 'rgba(22, 119, 255, 0.25)' }} />
        <div style={{ width: 10, height: 10, borderRadius: 2, backgroundColor: 'rgba(22, 119, 255, 0.5)' }} />
        <div style={{ width: 10, height: 10, borderRadius: 2, backgroundColor: 'rgba(22, 119, 255, 0.75)' }} />
        <div style={{ width: 10, height: 10, borderRadius: 2, backgroundColor: '#1677ff' }} />
        <span>Більше витрат</span>
      </div>
    </div>
  );
};
