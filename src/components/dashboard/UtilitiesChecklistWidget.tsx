import React from 'react';
import { 
  CheckCircle2, 
  Clock, 
  Zap, 
  Flame, 
  Home, 
  Droplets, 
  Wifi, 
  Building2 
} from 'lucide-react';
import type { UtilityStatusItem } from '../../services/analytics/kpiCalculator';
import { formatUah } from '../../services/analytics/kpiCalculator';

interface UtilitiesChecklistWidgetProps {
  utilities: UtilityStatusItem[];
}

export const UtilitiesChecklistWidget: React.FC<UtilitiesChecklistWidgetProps> = ({ utilities }) => {
  const paidCount = utilities.filter(u => u.isPaid).length;
  const totalCount = utilities.length;
  const progressPercent = Math.round((paidCount / totalCount) * 100);

  const getIcon = (id: UtilityStatusItem['id']) => {
    switch (id) {
      case 'electricity': return <Zap size={16} color="#eab308" />;
      case 'gas': return <Flame size={16} color="#f97316" />;
      case 'osbb': return <Home size={16} color="#8b5cf6" />;
      case 'water': return <Droplets size={16} color="#0ea5e9" />;
      case 'telecom': return <Wifi size={16} color="#10b981" />;
      default: return <Building2 size={16} color="var(--primary)" />;
    }
  };

  return (
    <div className="ant-card" style={{ padding: '24px', display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 36,
            height: 36,
            borderRadius: 'var(--radius-sm)',
            background: 'var(--primary-bg)',
            color: 'var(--primary)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}>
            <Building2 size={18} />
          </div>
          <div>
            <h3 style={{ fontSize: 16, fontWeight: 700, fontFamily: 'var(--font-display)', color: 'var(--text-primary)', margin: 0 }}>
              Комунальний чекліст
            </h3>
            <p style={{ fontSize: 12, color: 'var(--text-secondary)', margin: 0, marginTop: 2 }}>
              Моніторинг щомісячних обовʼязкових рахунків (ЖКП)
            </p>
          </div>
        </div>

        <div style={{ textAlign: 'right' }}>
          <span className="badge badge-primary" style={{ fontSize: 12, fontWeight: 600 }}>
            {paidCount} з {totalCount} сплачено
          </span>
        </div>
      </div>

      {/* Progress Bar */}
      <div style={{
        height: 6,
        borderRadius: 999,
        background: 'var(--border-default)',
        overflow: 'hidden',
        marginBottom: 16,
      }}>
        <div style={{
          height: '100%',
          width: `${progressPercent}%`,
          background: progressPercent === 100 ? 'var(--success)' : 'var(--primary)',
          borderRadius: 999,
          transition: 'width 0.4s ease',
        }} />
      </div>

      {/* Items list */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, flex: 1 }}>
        {utilities.map(item => (
          <div
            key={item.id}
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '10px 12px',
              borderRadius: 'var(--radius-sm)',
              background: item.isPaid ? 'var(--bg-surface)' : 'rgba(148, 163, 184, 0.05)',
              border: item.isPaid ? '1px solid var(--border-default)' : '1px dashed var(--border-default)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
              <div style={{
                width: 28,
                height: 28,
                borderRadius: 'var(--radius-sm)',
                background: 'var(--bg-surface-hover)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}>
                {getIcon(item.id)}
              </div>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>
                  {item.name}
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>
                  {item.merchant ? item.merchant : item.categoryLabel}
                </div>
              </div>
            </div>

            <div style={{ textAlign: 'right', flexShrink: 0 }}>
              {item.isPaid ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <div className="tabular-nums" style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>
                    {formatUah(item.paidAmount || 0)}
                  </div>
                  <CheckCircle2 size={16} color="var(--success)" />
                </div>
              ) : (
                <div style={{ display: 'flex', alignItems: 'center', gap: 4, color: 'var(--text-tertiary)', fontSize: 11 }}>
                  <Clock size={14} />
                  <span>Очікує оплати</span>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
