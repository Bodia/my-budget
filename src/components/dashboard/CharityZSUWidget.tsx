import React from 'react';
import { Shield, Heart, Award } from 'lucide-react';
import type { Transaction } from '../../types/finance';
import { formatUah } from '../../services/analytics/kpiCalculator';

interface CharityZSUWidgetProps {
  transactions: Transaction[];
  totalDonations: number;
  totalIncome: number;
}

export const CharityZSUWidget: React.FC<CharityZSUWidgetProps> = ({
  transactions,
  totalDonations,
  totalIncome,
}) => {
  // Filter donations in the current transactions list
  const donationTransactions = transactions
    .filter(t => {
      if (t.amount >= 0) return false;
      return (
        t.categoryId === 'charity' ||
        t.tags?.includes('zsu') ||
        t.tags?.includes('charity') ||
        /ахіллес|повернись живим|притула|uanimals|drone|зсу|військов/i.test(t.description)
      );
    })
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 5);

  const donationRate = totalIncome > 0 ? ((totalDonations / totalIncome) * 100).toFixed(1) : '0';

  return (
    <div className="ant-card" style={{ padding: '24px', display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 36,
            height: 36,
            borderRadius: 'var(--radius-sm)',
            background: 'linear-gradient(135deg, rgba(0, 87, 183, 0.2) 0%, rgba(255, 215, 0, 0.2) 100%)',
            border: '1px solid rgba(255, 215, 0, 0.3)',
            color: '#38bdf8',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}>
            <Shield size={18} />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <h3 style={{ fontSize: 16, fontWeight: 700, fontFamily: 'var(--font-display)', color: 'var(--text-primary)', margin: 0 }}>
                Підтримка ЗСУ & Благодійність
              </h3>
              <span style={{
                fontSize: 10,
                fontWeight: 700,
                padding: '2px 6px',
                borderRadius: 999,
                background: 'linear-gradient(90deg, #0057b7 0%, #ffd700 100%)',
                color: '#fff',
                textShadow: '0 1px 2px rgba(0,0,0,0.4)',
                letterSpacing: '0.02em',
              }}>
                🇺🇦 UA
              </span>
            </div>
            <p style={{ fontSize: 12, color: 'var(--text-secondary)', margin: 0, marginTop: 2 }}>
              Автоматичний облік внесків на оборону та волонтерські фонди
            </p>
          </div>
        </div>

        <div style={{ textAlign: 'right' }}>
          <div className="tabular-nums" style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-primary)', fontFamily: 'var(--font-display)' }}>
            {formatUah(totalDonations)}
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
            {donationRate}% від доходу
          </div>
        </div>
      </div>

      {/* Donation List or Empty State */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: donationTransactions.length === 0 ? 'center' : 'flex-start' }}>
        {donationTransactions.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '24px 12px', color: 'var(--text-tertiary)' }}>
            <Heart size={28} style={{ opacity: 0.4, marginBottom: 8 }} />
            <div style={{ fontSize: 13, fontWeight: 500 }}>У цьому періоді донатів не виявлено</div>
            <div style={{ fontSize: 11, marginTop: 4 }}>
              Транзакції на фонди (Повернись живим, Притула, АХІЛЛЕС тощо) зʼявлятимуться тут автоматично.
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {donationTransactions.map(item => (
              <div
                key={item.id}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '10px 12px',
                  borderRadius: 'var(--radius-sm)',
                  background: 'var(--bg-surface-hover)',
                  border: '1px solid var(--border-subtle)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                  <Award size={16} color="#eab308" style={{ flexShrink: 0 }} />
                  <div style={{ minWidth: 0 }}>
                    <div style={{
                      fontSize: 13,
                      fontWeight: 600,
                      color: 'var(--text-primary)',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}>
                      {item.cleanMerchant || item.description}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 1 }}>
                      {item.date.slice(0, 10)} {item.tags?.includes('zsu') ? '• Сили оборони' : '• Благодійність'}
                    </div>
                  </div>
                </div>

                <div className="tabular-nums" style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', flexShrink: 0 }}>
                  {formatUah(Math.abs(item.amount))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
