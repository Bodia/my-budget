import React, { useState, useRef, useEffect, useMemo } from 'react';
import { 
  Calendar as CalendarIcon, 
  ChevronLeft, 
  ChevronRight, 
  ChevronsLeft, 
  ChevronsRight, 
  X, 
  Check 
} from 'lucide-react';
import type { CustomDateRange } from '../../utils/dateFilterUtils';

interface DateRangePickerProps {
  value: CustomDateRange;
  onChange: (range: CustomDateRange) => void;
  placeholder?: string;
}

const UKRAINIAN_MONTHS = [
  'Січень', 'Лютий', 'Березень', 'Квітень', 'Травень', 'Червень',
  'Липень', 'Серпень', 'Вересень', 'Жовтень', 'Листопад', 'Грудень'
];

const WEEKDAYS = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Нд'];

const pad = (n: number) => (n < 10 ? `0${n}` : `${n}`);

export const DateRangePicker: React.FC<DateRangePickerProps> = ({
  value,
  onChange,
  placeholder = 'Оберіть період дат...',
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Parse initial view from value or fallback to today
  const initialDate = useMemo(() => {
    if (value.startDate && /^\d{4}-\d{2}-\d{2}$/.test(value.startDate)) {
      const [y, m] = value.startDate.split('-').map(Number);
      return new Date(y, m - 1, 1);
    }
    return new Date();
  }, [value.startDate]);

  const [viewYear, setViewYear] = useState<number>(initialDate.getFullYear());
  const [viewMonth, setViewMonth] = useState<number>(initialDate.getMonth()); // 0-11

  // Pending selection state inside the picker
  const [tempStart, setTempStart] = useState<string>(value.startDate || '');
  const [tempEnd, setTempEnd] = useState<string>(value.endDate || '');
  const [hoverDate, setHoverDate] = useState<string | null>(null);

  // Sync internal state when prop value changes
  useEffect(() => {
    setTempStart(value.startDate || '');
    setTempEnd(value.endDate || '');
    if (value.startDate && /^\d{4}-\d{2}-\d{2}$/.test(value.startDate)) {
      const [y, m] = value.startDate.split('-').map(Number);
      setViewYear(y);
      setViewMonth(m - 1);
    }
  }, [value.startDate, value.endDate]);

  // Click outside to close
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  // Calendar calculations
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const firstDayOfWeek = (new Date(viewYear, viewMonth, 1).getDay() + 6) % 7; // Monday = 0

  const handlePrevYear = () => setViewYear(prev => prev - 1);
  const handleNextYear = () => setViewYear(prev => prev + 1);
  const handlePrevMonth = () => {
    if (viewMonth === 0) {
      setViewMonth(11);
      setViewYear(prev => prev - 1);
    } else {
      setViewMonth(prev => prev - 1);
    }
  };
  const handleNextMonth = () => {
    if (viewMonth === 11) {
      setViewMonth(0);
      setViewYear(prev => prev + 1);
    } else {
      setViewMonth(prev => prev + 1);
    }
  };

  const handleDayClick = (day: number) => {
    const clickedDateStr = `${viewYear}-${pad(viewMonth + 1)}-${pad(day)}`;

    if (!tempStart || (tempStart && tempEnd)) {
      // Starting new selection
      setTempStart(clickedDateStr);
      setTempEnd('');
    } else if (tempStart && !tempEnd) {
      // Completing selection
      if (clickedDateStr < tempStart) {
        setTempStart(clickedDateStr);
        setTempEnd(tempStart);
      } else {
        setTempEnd(clickedDateStr);
      }
    }
  };

  const handleApply = () => {
    if (!tempStart && !tempEnd) {
      onChange({ startDate: '', endDate: '' });
      setIsOpen(false);
      return;
    }

    let start = tempStart;
    let end = tempEnd || tempStart;
    if (start > end) {
      const t = start;
      start = end;
      end = t;
    }

    onChange({ startDate: start, endDate: end });
    setIsOpen(false);
  };

  const handleClear = () => {
    setTempStart('');
    setTempEnd('');
    onChange({ startDate: '', endDate: '' });
    setIsOpen(false);
  };

  // Helper for rendering day cell styles
  const isSelectedStart = (dateStr: string) => tempStart === dateStr;
  const isSelectedEnd = (dateStr: string) => tempEnd === dateStr;
  const isInRange = (dateStr: string) => {
    if (tempStart && tempEnd) {
      return dateStr > tempStart && dateStr < tempEnd;
    }
    if (tempStart && hoverDate && !tempEnd) {
      const min = tempStart < hoverDate ? tempStart : hoverDate;
      const max = tempStart < hoverDate ? hoverDate : tempStart;
      return dateStr > min && dateStr < max;
    }
    return false;
  };

  // Format trigger label
  const triggerLabel = useMemo(() => {
    if (value.startDate && value.endDate) {
      return `${value.startDate} — ${value.endDate}`;
    }
    if (value.startDate) {
      return `З: ${value.startDate}`;
    }
    return placeholder;
  }, [value.startDate, value.endDate, placeholder]);

  return (
    <div ref={containerRef} style={{ position: 'relative', display: 'inline-block' }}>
      {/* Trigger Button / Input */}
      <button
        type="button"
        onClick={() => setIsOpen(prev => !prev)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '7px 12px',
          background: 'var(--bg-app)',
          border: isOpen ? '1.5px solid var(--primary)' : '1px solid var(--border-default)',
          borderRadius: 'var(--radius-sm)',
          color: 'var(--text-primary)',
          fontSize: 13,
          cursor: 'pointer',
          outline: 'none',
          boxShadow: isOpen ? '0 0 0 2px var(--primary-bg)' : 'none',
          transition: 'var(--transition)',
          minWidth: 230,
          justifyContent: 'space-between',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <CalendarIcon size={16} color="var(--primary)" />
          <span style={{ fontWeight: value.startDate ? 600 : 400, color: value.startDate ? 'var(--text-primary)' : 'var(--text-tertiary)' }}>
            {triggerLabel}
          </span>
        </div>

        {value.startDate && (
          <span
            onClick={(e) => {
              e.stopPropagation();
              handleClear();
            }}
            title="Очистити вибір"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 18,
              height: 18,
              borderRadius: '50%',
              background: 'var(--border-subtle)',
              color: 'var(--text-secondary)',
            }}
          >
            <X size={12} />
          </span>
        )}
      </button>

      {/* Popover Calendar Dropdown */}
      {isOpen && (
        <div style={{
          position: 'absolute',
          top: 'calc(100% + 6px)',
          left: 0,
          zIndex: 1050,
          background: 'var(--bg-surface)',
          border: '1px solid var(--border-default)',
          borderRadius: 'var(--radius-md)',
          boxShadow: 'var(--shadow-lg)',
          padding: '16px',
          width: 310,
          userSelect: 'none',
          animation: 'scaleUp 0.12s ease-out',
        }}>
          {/* Header with Month/Year Navigation */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: 12,
          }}>
            <div style={{ display: 'flex', gap: 2 }}>
              <button
                type="button"
                onClick={handlePrevYear}
                title="Попередній рік"
                style={{
                  background: 'none',
                  border: 'none',
                  padding: 4,
                  cursor: 'pointer',
                  color: 'var(--text-secondary)',
                  borderRadius: 'var(--radius-xs)',
                  display: 'flex',
                  alignItems: 'center',
                }}
              >
                <ChevronsLeft size={16} />
              </button>
              <button
                type="button"
                onClick={handlePrevMonth}
                title="Попередній місяць"
                style={{
                  background: 'none',
                  border: 'none',
                  padding: 4,
                  cursor: 'pointer',
                  color: 'var(--text-secondary)',
                  borderRadius: 'var(--radius-xs)',
                  display: 'flex',
                  alignItems: 'center',
                }}
              >
                <ChevronLeft size={16} />
              </button>
            </div>

            <div style={{
              fontWeight: 700,
              fontSize: 14,
              color: 'var(--text-primary)',
              fontFamily: 'var(--font-display)',
            }}>
              {UKRAINIAN_MONTHS[viewMonth]} {viewYear}
            </div>

            <div style={{ display: 'flex', gap: 2 }}>
              <button
                type="button"
                onClick={handleNextMonth}
                title="Наступний місяць"
                style={{
                  background: 'none',
                  border: 'none',
                  padding: 4,
                  cursor: 'pointer',
                  color: 'var(--text-secondary)',
                  borderRadius: 'var(--radius-xs)',
                  display: 'flex',
                  alignItems: 'center',
                }}
              >
                <ChevronRight size={16} />
              </button>
              <button
                type="button"
                onClick={handleNextYear}
                title="Наступний рік"
                style={{
                  background: 'none',
                  border: 'none',
                  padding: 4,
                  cursor: 'pointer',
                  color: 'var(--text-secondary)',
                  borderRadius: 'var(--radius-xs)',
                  display: 'flex',
                  alignItems: 'center',
                }}
              >
                <ChevronsRight size={16} />
              </button>
            </div>
          </div>

          {/* Weekdays Header */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(7, 1fr)',
            gap: 2,
            textAlign: 'center',
            marginBottom: 6,
          }}>
            {WEEKDAYS.map(day => (
              <span key={day} style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-tertiary)', padding: '2px 0' }}>
                {day}
              </span>
            ))}
          </div>

          {/* Days Grid */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(7, 1fr)',
            gap: '3px 0',
            textAlign: 'center',
          }}>
            {/* Empty slots for offset */}
            {Array.from({ length: firstDayOfWeek }).map((_, i) => (
              <div key={`empty-${i}`} />
            ))}

            {/* Days of the month */}
            {Array.from({ length: daysInMonth }).map((_, i) => {
              const day = i + 1;
              const dateStr = `${viewYear}-${pad(viewMonth + 1)}-${pad(day)}`;
              const isStart = isSelectedStart(dateStr);
              const isEnd = isSelectedEnd(dateStr);
              const inRange = isInRange(dateStr);

              return (
                <div
                  key={dateStr}
                  style={{
                    background: inRange ? 'var(--primary-bg)' : 'transparent',
                    borderTopLeftRadius: isStart ? 'var(--radius-sm)' : 0,
                    borderBottomLeftRadius: isStart ? 'var(--radius-sm)' : 0,
                    borderTopRightRadius: isEnd ? 'var(--radius-sm)' : 0,
                    borderBottomRightRadius: isEnd ? 'var(--radius-sm)' : 0,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    height: 32,
                  }}
                  onMouseEnter={() => setHoverDate(dateStr)}
                  onMouseLeave={() => setHoverDate(null)}
                >
                  <button
                    type="button"
                    onClick={() => handleDayClick(day)}
                    style={{
                      width: 28,
                      height: 28,
                      borderRadius: (isStart || isEnd) ? 'var(--radius-sm)' : '50%',
                      background: (isStart || isEnd) ? 'var(--primary)' : 'transparent',
                      color: (isStart || isEnd) ? '#ffffff' : 'var(--text-primary)',
                      border: 'none',
                      cursor: 'pointer',
                      fontSize: 12,
                      fontWeight: (isStart || isEnd) ? 700 : 500,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      transition: 'background 0.15s ease',
                    }}
                  >
                    {day}
                  </button>
                </div>
              );
            })}
          </div>

          {/* Status info & Action Footer */}
          <div style={{
            marginTop: 14,
            paddingTop: 10,
            borderTop: '1px solid var(--border-subtle)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 8,
          }}>
            <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
              {tempStart && !tempEnd && 'Оберіть дату кінця...'}
              {tempStart && tempEnd && (
                <span>
                  {tempStart} → {tempEnd}
                </span>
              )}
              {!tempStart && 'Клікніть дату початку'}
            </div>

            <div style={{ display: 'flex', gap: 6 }}>
              <button
                type="button"
                onClick={handleClear}
                style={{
                  padding: '4px 8px',
                  borderRadius: 'var(--radius-xs)',
                  border: '1px solid var(--border-default)',
                  background: 'transparent',
                  color: 'var(--text-secondary)',
                  fontSize: 12,
                  cursor: 'pointer',
                }}
              >
                Скинути
              </button>
              <button
                type="button"
                onClick={handleApply}
                disabled={!tempStart}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4,
                  padding: '4px 10px',
                  borderRadius: 'var(--radius-xs)',
                  border: 'none',
                  background: tempStart ? 'var(--primary)' : 'var(--border-default)',
                  color: '#ffffff',
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: tempStart ? 'pointer' : 'not-allowed',
                }}
              >
                <Check size={13} />
                <span>Застосувати</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
