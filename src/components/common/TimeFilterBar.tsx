import React from 'react';
import { Calendar, CalendarRange, Clock, Sparkles } from 'lucide-react';
import { DateRangePicker } from './DateRangePicker';
import type { TimeFilterMode, CustomDateRange, ComputedFilterRange } from '../../utils/dateFilterUtils';

interface TimeFilterBarProps {
  mode: TimeFilterMode;
  onChangeMode: (mode: TimeFilterMode) => void;
  customRange: CustomDateRange;
  onChangeCustomRange: (range: CustomDateRange) => void;
  computedRange: ComputedFilterRange;
  currentSystemYear: number;
}

export const TimeFilterBar: React.FC<TimeFilterBarProps> = ({
  mode,
  onChangeMode,
  customRange,
  onChangeCustomRange,
  computedRange,
  currentSystemYear,
}) => {
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      gap: 12,
      background: 'var(--bg-surface)',
      padding: '12px 16px',
      borderRadius: 'var(--radius-lg)',
      border: '1px solid var(--border-default)',
      boxShadow: 'var(--shadow-sm)',
    }}>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: 12,
      }}>
        {/* Buttons / Segmented Controls */}
        <div style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          background: 'var(--bg-app)',
          padding: 4,
          borderRadius: 'var(--radius-md)',
          border: '1px solid var(--border-subtle)',
        }}>
          {/* Mode 1: Latest Reported Month */}
          <button
            type="button"
            onClick={() => onChangeMode('latest_month')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              padding: '6px 14px',
              borderRadius: 'var(--radius-sm)',
              fontSize: 13,
              fontWeight: mode === 'latest_month' ? 600 : 500,
              border: 'none',
              cursor: 'pointer',
              transition: 'var(--transition)',
              background: mode === 'latest_month' ? 'var(--primary)' : 'transparent',
              color: mode === 'latest_month' ? '#ffffff' : 'var(--text-secondary)',
              boxShadow: mode === 'latest_month' ? 'var(--shadow-sm)' : 'none',
            }}
          >
            <Clock size={15} />
            <span>Останній звітний місяць</span>
          </button>

          {/* Mode 2: Current Year */}
          <button
            type="button"
            onClick={() => onChangeMode('current_year')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              padding: '6px 14px',
              borderRadius: 'var(--radius-sm)',
              fontSize: 13,
              fontWeight: mode === 'current_year' ? 600 : 500,
              border: 'none',
              cursor: 'pointer',
              transition: 'var(--transition)',
              background: mode === 'current_year' ? 'var(--primary)' : 'transparent',
              color: mode === 'current_year' ? '#ffffff' : 'var(--text-secondary)',
              boxShadow: mode === 'current_year' ? 'var(--shadow-sm)' : 'none',
            }}
          >
            <Calendar size={15} />
            <span>Поточний рік ({currentSystemYear})</span>
          </button>

          {/* Mode 3: Custom Date Range */}
          <button
            type="button"
            onClick={() => onChangeMode('custom')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              padding: '6px 14px',
              borderRadius: 'var(--radius-sm)',
              fontSize: 13,
              fontWeight: mode === 'custom' ? 600 : 500,
              border: 'none',
              cursor: 'pointer',
              transition: 'var(--transition)',
              background: mode === 'custom' ? 'var(--primary)' : 'transparent',
              color: mode === 'custom' ? '#ffffff' : 'var(--text-secondary)',
              boxShadow: mode === 'custom' ? 'var(--shadow-sm)' : 'none',
            }}
          >
            <CalendarRange size={15} />
            <span>Обрати період</span>
          </button>
        </div>

        {/* Informative Label / Badge */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          fontSize: 13,
          color: 'var(--text-secondary)',
        }}>
          {mode === 'latest_month' && (
            <div style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              padding: '4px 10px',
              borderRadius: 'var(--radius-md)',
              background: 'var(--primary-bg)',
              border: '1px solid var(--primary-border)',
              color: 'var(--primary-active)',
              fontWeight: 600,
            }}>
              <Sparkles size={14} color="var(--primary)" />
              <span>Звітний місяць: {computedRange.label}</span>
              <span style={{ fontSize: 11, opacity: 0.8, fontWeight: 400 }}>
                ({computedRange.startDate} — {computedRange.endDate})
              </span>
            </div>
          )}

          {mode === 'current_year' && (
            <div style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              padding: '4px 10px',
              borderRadius: 'var(--radius-md)',
              background: 'var(--cyan-bg)',
              border: '1px solid var(--cyan)',
              color: 'var(--text-primary)',
              fontWeight: 600,
            }}>
              <Calendar size={14} color="var(--cyan)" />
              <span>Календарний рік: {computedRange.label}</span>
            </div>
          )}

          {mode === 'custom' && (
            <div style={{
              fontSize: 12,
              color: 'var(--text-tertiary)',
            }}>
              Обрано {computedRange.days} {computedRange.days === 1 ? 'день' : computedRange.days < 5 ? 'дні' : 'днів'}
            </div>
          )}
        </div>
      </div>

      {/* Date Range Picker for Custom Mode */}
      {mode === 'custom' && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 16,
          paddingTop: 10,
          borderTop: '1px dashed var(--border-subtle)',
          flexWrap: 'wrap',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-secondary)' }}>
              Календарний діапазон:
            </span>
            <DateRangePicker
              value={customRange.startDate ? customRange : { startDate: computedRange.startDate, endDate: computedRange.endDate }}
              onChange={onChangeCustomRange}
              placeholder="Оберіть діапазон дат..."
            />
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginLeft: 'auto' }}>
            <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>
              Активний період: <strong style={{ color: 'var(--text-primary)' }}>{computedRange.startDate}</strong> — <strong style={{ color: 'var(--text-primary)' }}>{computedRange.endDate}</strong>
            </span>
          </div>
        </div>
      )}
    </div>
  );
};
