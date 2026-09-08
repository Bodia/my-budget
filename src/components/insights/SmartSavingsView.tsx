import React from 'react';
import { 
  Lightbulb, 
  Sparkles, 
  AlertTriangle, 
  ArrowRight, 
  Coffee, 
  Tv, 
  ShieldCheck 
} from 'lucide-react';
import type { SavingInsight, Transaction } from '../../types/finance';
import { formatUah } from '../../services/analytics/kpiCalculator';

interface SmartSavingsViewProps {
  insights: SavingInsight[];
  transactions: Transaction[];
  onSetBudget?: (categoryId: string, amount: number) => void;
}

export const SmartSavingsView: React.FC<SmartSavingsViewProps> = ({
  insights,
  transactions,
  onSetBudget,
}) => {
  const totalMonthlyPotential = insights.reduce((sum, i) => sum + i.potentialMonthlySavings, 0);
  const totalAnnualPotential = insights.reduce((sum, i) => sum + i.potentialAnnualSavings, 0);

  // Filter detected subscriptions for the detail view
  const subKeywords = ['netflix', 'spotify', 'apple', 'youtube', 'megogo', 'kyivstar', 'sportlife'];
  const subscriptions = transactions.filter(t => 
    t.amount < 0 && (
      t.categoryId === 'subscriptions' || 
      subKeywords.some(k => t.description.toLowerCase().includes(k))
    )
  ).slice(0, 10);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24, paddingBottom: 40 }}>
      {/* Hero Banner with Cumulative Potential */}
      <div className="ant-card" style={{
        padding: '28px 32px',
        background: 'linear-gradient(135deg, rgba(22, 119, 255, 0.12) 0%, rgba(114, 46, 209, 0.12) 100%)',
        border: '1px solid var(--primary-border)',
        position: 'relative',
        overflow: 'hidden',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 20 }}>
          <div style={{ maxWidth: 640 }}>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
              <span className="badge badge-primary">
                <Sparkles size={12} /> AI-асистент фінансового аналізу
              </span>
            </div>
            <h2 style={{
              fontSize: 26,
              fontWeight: 700,
              fontFamily: 'var(--font-display)',
              color: 'var(--text-primary)',
              marginBottom: 8,
              letterSpacing: '-0.02em',
            }}>
              Розумні пропозиції для економії та оптимізації
            </h2>
            <p style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
              Алгоритм проаналізував ваші транзакції, регулярні списання та динаміку витрат. Нижче зібрані конкретні рекомендації, які не погіршують якість життя, але вивільняють кошти для заощаджень.
            </p>
          </div>

          <div style={{
            background: 'var(--bg-surface)',
            padding: '16px 24px',
            borderRadius: 'var(--radius-md)',
            boxShadow: 'var(--shadow-md)',
            border: '1px solid var(--border-subtle)',
            textAlign: 'right',
            minWidth: 240,
          }}>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)', fontWeight: 500, marginBottom: 4 }}>
              Потенціал щорічної оптимізації:
            </div>
            <div className="tabular-nums" style={{
              fontSize: 32,
              fontWeight: 800,
              fontFamily: 'var(--font-display)',
              color: 'var(--success)',
              letterSpacing: '-0.02em',
            }}>
              {formatUah(totalAnnualPotential)}
            </div>
            <div style={{ fontSize: 13, color: 'var(--text-tertiary)', marginTop: 4 }}>
              до <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{formatUah(totalMonthlyPotential)}</span> на місяць
            </div>
          </div>
        </div>
      </div>

      {/* Grid of Actionable Insight Cards */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))',
        gap: 20,
      }}>
        {insights.map((insight) => {
          let Icon = Lightbulb;
          let badgeColor = 'badge-primary';
          let borderAccent = 'var(--primary)';

          if (insight.type === 'subscription') {
            Icon = Tv;
            badgeColor = 'badge-primary';
            borderAccent = '#1677ff';
          } else if (insight.type === 'latte_factor') {
            Icon = Coffee;
            badgeColor = 'badge-warning';
            borderAccent = '#faad14';
          } else if (insight.type === 'spike') {
            Icon = AlertTriangle;
            badgeColor = 'badge-danger';
            borderAccent = '#ff4d4f';
          } else if (insight.type === 'budget_50_30_20') {
            Icon = ShieldCheck;
            badgeColor = 'badge-success';
            borderAccent = '#52c41a';
          }

          return (
            <div
              key={insight.id}
              className="ant-card"
              style={{
                padding: '24px',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                borderLeft: `4px solid ${borderAccent}`,
                transition: 'var(--transition)',
              }}
            >
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
                  <div style={{
                    width: 40,
                    height: 40,
                    borderRadius: 'var(--radius-md)',
                    background: 'var(--bg-surface-hover)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: borderAccent,
                  }}>
                    <Icon size={20} />
                  </div>
                  <span className={`badge ${badgeColor}`} style={{ fontSize: 11 }}>
                    {insight.type === 'subscription' && 'Підписки'}
                    {insight.type === 'latte_factor' && 'Мікровитрати'}
                    {insight.type === 'spike' && 'Сплеск витрат'}
                    {insight.type === 'budget_50_30_20' && 'Правило 50/30/20'}
                  </span>
                </div>

                <h3 style={{
                  fontSize: 17,
                  fontWeight: 600,
                  fontFamily: 'var(--font-display)',
                  color: 'var(--text-primary)',
                  marginBottom: 10,
                }}>
                  {insight.title}
                </h3>

                <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: 20 }}>
                  {insight.description}
                </p>
              </div>

              <div>
                <div style={{
                  padding: '12px 16px',
                  background: 'var(--bg-surface-hover)',
                  borderRadius: 'var(--radius-sm)',
                  marginBottom: 16,
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}>
                  <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                    Очікувана економія:
                  </span>
                  <span className="tabular-nums" style={{ fontSize: 15, fontWeight: 700, color: 'var(--success)' }}>
                    +{formatUah(insight.potentialMonthlySavings)} / міс.
                  </span>
                </div>

                {insight.actionText && (
                  <button
                    onClick={() => {
                      if (insight.categoryId && onSetBudget) {
                        onSetBudget(insight.categoryId, 5000);
                      }
                    }}
                    className="btn btn-secondary btn-sm"
                    style={{ width: '100%', justifyContent: 'center' }}
                  >
                    <span>{insight.actionText}</span>
                    <ArrowRight size={14} />
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Subscription Breakdown Table */}
      {subscriptions.length > 0 && (
        <div className="ant-card" style={{ padding: '24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <div>
              <h3 style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-primary)', fontFamily: 'var(--font-display)' }}>
                Виявлені регулярні підписки та сервіси
              </h3>
              <p style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                Платежі, що списуються з регулярною періодичністю
              </p>
            </div>
            <span className="badge badge-primary">
              {subscriptions.length} сервісів
            </span>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, textAlign: 'left' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border-default)', color: 'var(--text-tertiary)' }}>
                  <th style={{ padding: '10px 12px', fontWeight: 500 }}>Сервіс / Опис</th>
                  <th style={{ padding: '10px 12px', fontWeight: 500 }}>Останнє списання</th>
                  <th style={{ padding: '10px 12px', fontWeight: 500 }}>Джерело</th>
                  <th style={{ padding: '10px 12px', fontWeight: 500, textAlign: 'right' }}>Сума на місяць</th>
                  <th style={{ padding: '10px 12px', fontWeight: 500, textAlign: 'right' }}>Сума на рік</th>
                </tr>
              </thead>
              <tbody>
                {subscriptions.map((s, idx) => (
                  <tr key={idx} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                    <td style={{ padding: '12px', fontWeight: 500, color: 'var(--text-primary)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <Tv size={15} color="var(--primary)" />
                        <span>{s.description}</span>
                      </div>
                    </td>
                    <td style={{ padding: '12px', color: 'var(--text-secondary)' }}>
                      {s.date.slice(0, 10)}
                    </td>
                    <td style={{ padding: '12px' }}>
                      <span className="badge badge-primary" style={{ textTransform: 'capitalize' }}>
                        {s.source}
                      </span>
                    </td>
                    <td className="tabular-nums" style={{ padding: '12px', textAlign: 'right', fontWeight: 600, color: 'var(--danger)' }}>
                      {formatUah(s.amount)}
                    </td>
                    <td className="tabular-nums" style={{ padding: '12px', textAlign: 'right', fontWeight: 700, color: 'var(--text-primary)' }}>
                      {formatUah(Math.abs(s.amount) * 12)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
