import React from 'react';
import { ArrowDownRight, ArrowUpRight, Wallet, Flame, PiggyBank } from 'lucide-react';
import type { KPISummary } from '../../services/analytics/kpiCalculator';
import { formatUah } from '../../services/analytics/kpiCalculator';

interface KPICardsProps {
  kpi: KPISummary;
}

export const KPICards: React.FC<KPICardsProps> = ({ kpi }) => {
  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
      gap: 16,
      marginBottom: 24,
    }}>
      {/* 1. Expenses Card */}
      <div className="ant-card" style={{ padding: '20px 24px', position: 'relative', overflow: 'hidden' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
          <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-secondary)' }}>
            Витрати за період
          </span>
          <div style={{
            width: 34,
            height: 34,
            borderRadius: 'var(--radius-sm)',
            background: 'var(--danger-bg)',
            color: 'var(--danger)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}>
            <ArrowDownRight size={18} />
          </div>
        </div>
        <div className="tabular-nums" style={{
          fontSize: 28,
          fontWeight: 700,
          fontFamily: 'var(--font-display)',
          color: 'var(--text-primary)',
          letterSpacing: '-0.02em',
          marginBottom: 8,
        }}>
          {formatUah(kpi.totalExpenses)}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--text-secondary)' }}>
          <span className="badge badge-success" style={{ fontSize: 11 }}>
            ↓ 4.8%
          </span>
          <span>порівняно з минулим періодом</span>
        </div>
      </div>

      {/* 2. Income Card */}
      <div className="ant-card" style={{ padding: '20px 24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
          <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-secondary)' }}>
            Доходи за період
          </span>
          <div style={{
            width: 34,
            height: 34,
            borderRadius: 'var(--radius-sm)',
            background: 'var(--success-bg)',
            color: 'var(--success)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}>
            <ArrowUpRight size={18} />
          </div>
        </div>
        <div className="tabular-nums" style={{
          fontSize: 28,
          fontWeight: 700,
          fontFamily: 'var(--font-display)',
          color: 'var(--text-primary)',
          letterSpacing: '-0.02em',
          marginBottom: 8,
        }}>
          {formatUah(kpi.totalIncome)}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--text-secondary)' }}>
          <span className="badge badge-primary" style={{ fontSize: 11 }}>
            +2.5%
          </span>
          <span>стабільний грошовий потік</span>
        </div>
      </div>

      {/* 3. Net Savings Card */}
      <div className="ant-card" style={{ padding: '20px 24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
          <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-secondary)' }}>
            Чистий залишок (Заощадження)
          </span>
          <div style={{
            width: 34,
            height: 34,
            borderRadius: 'var(--radius-sm)',
            background: kpi.netSavings >= 0 ? 'var(--primary-bg)' : 'var(--danger-bg)',
            color: kpi.netSavings >= 0 ? 'var(--primary)' : 'var(--danger)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}>
            <PiggyBank size={18} />
          </div>
        </div>
        <div className="tabular-nums" style={{
          fontSize: 28,
          fontWeight: 700,
          fontFamily: 'var(--font-display)',
          color: kpi.netSavings >= 0 ? 'var(--success)' : 'var(--danger)',
          letterSpacing: '-0.02em',
          marginBottom: 8,
        }}>
          {formatUah(kpi.netSavings)}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--text-secondary)' }}>
          <span className="badge badge-success" style={{ fontSize: 11 }}>
            {kpi.savingsRate}%
          </span>
          <span>ставка заощаджень від доходу</span>
        </div>
      </div>

      {/* 4. Burn Rate Card */}
      <div className="ant-card" style={{ padding: '20px 24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
          <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-secondary)' }}>
            Середньоденний темп витрат
          </span>
          <div style={{
            width: 34,
            height: 34,
            borderRadius: 'var(--radius-sm)',
            background: 'var(--warning-bg)',
            color: 'var(--warning)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}>
            <Flame size={18} />
          </div>
        </div>
        <div className="tabular-nums" style={{
          fontSize: 28,
          fontWeight: 700,
          fontFamily: 'var(--font-display)',
          color: 'var(--text-primary)',
          letterSpacing: '-0.02em',
          marginBottom: 8,
        }}>
          {formatUah(kpi.dailyBurnRate)}
          <span style={{ fontSize: 14, color: 'var(--text-tertiary)', fontWeight: 500 }}>/день</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--text-secondary)' }}>
          <Wallet size={13} color="var(--text-tertiary)" />
          <span>{kpi.transactionCount} операцій у вибірці</span>
        </div>
      </div>

      {/* 5. Monobank Jars Savings Card */}
      <div className="ant-card" style={{ padding: '20px 24px', position: 'relative' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
          <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-secondary)' }}>
            Заощаджено у Банках (Jar Savings)
          </span>
          <div style={{
            width: 34,
            height: 34,
            borderRadius: 'var(--radius-sm)',
            background: 'rgba(99, 102, 241, 0.12)',
            color: '#6366f1',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}>
            <PiggyBank size={18} />
          </div>
        </div>
        <div className="tabular-nums" style={{
          fontSize: 28,
          fontWeight: 700,
          fontFamily: 'var(--font-display)',
          color: 'var(--text-primary)',
          letterSpacing: '-0.02em',
          marginBottom: 8,
        }}>
          {formatUah(kpi.totalSavedInJars)}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--text-secondary)' }}>
          <span className="badge badge-primary" style={{ fontSize: 11, background: 'rgba(99, 102, 241, 0.15)', color: '#6366f1' }}>
            {kpi.jarSavingsRate}%
          </span>
          <span>округлення, «На примхи» та депозити</span>
        </div>
      </div>
    </div>
  );
};

