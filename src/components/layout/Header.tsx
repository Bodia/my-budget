import React from 'react';
import { 
  PieChart, 
  TrendingUp, 
  Lightbulb, 
  Receipt, 
  Settings, 
  UploadCloud, 
  Sparkles, 
  Moon, 
  Sun 
} from 'lucide-react';
import type { CurrencyCode } from '../../types/finance';

export type ActiveNavTab = 'dashboard' | 'analytics' | 'insights' | 'transactions' | 'settings';

interface HeaderProps {
  activeTab: ActiveNavTab;
  onSelectTab: (tab: ActiveNavTab) => void;
  onOpenImport: () => void;
  onLoadDemo: () => void;
  currency: CurrencyCode;
  onChangeCurrency: (c: CurrencyCode) => void;
  isDark: boolean;
  onToggleTheme: () => void;
  totalTransactionsCount: number;
  isDemoActive?: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  onSelectTab,
  onOpenImport,
  onLoadDemo,
  currency,
  onChangeCurrency,
  isDark,
  onToggleTheme,
  totalTransactionsCount,
  isDemoActive = false,
}) => {
  return (
    <header style={{
      position: 'sticky',
      top: 0,
      zIndex: 100,
      background: 'var(--bg-card)',
      backdropFilter: 'blur(16px)',
      WebkitBackdropFilter: 'blur(16px)',
      borderBottom: '1px solid var(--border-default)',
      padding: '0 24px',
    }}>
      <div style={{
        maxWidth: 1400,
        margin: '0 auto',
        height: 64,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 16,
      }}>
        {/* Brand */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer' }} onClick={() => onSelectTab('dashboard')}>
          <div style={{
            width: 38,
            height: 38,
            borderRadius: 'var(--radius-md)',
            background: 'linear-gradient(135deg, #1677ff 0%, #722ed1 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#fff',
            boxShadow: '0 4px 12px rgba(22, 119, 255, 0.3)',
          }}>
            <PieChart size={20} />
          </div>
          <div>
            <div style={{
              fontFamily: 'var(--font-display)',
              fontSize: 18,
              fontWeight: 700,
              color: 'var(--text-primary)',
              letterSpacing: '-0.02em',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
            }}>
              My Budget
              <span className="badge badge-primary" style={{ fontSize: 11, padding: '1px 6px' }}>
                Local-First
              </span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 2 }}>
              <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>
                {totalTransactionsCount > 0 ? `${totalTransactionsCount} операцій` : '0 операцій'}
              </span>
              <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>•</span>
              <span style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4,
                fontSize: 10,
                fontWeight: 600,
                padding: '1px 6px',
                borderRadius: 8,
                background: isDemoActive ? 'rgba(250, 173, 20, 0.12)' : 'rgba(82, 196, 26, 0.12)',
                color: isDemoActive ? '#d48806' : '#389e0d',
                border: `1px solid ${isDemoActive ? 'rgba(250, 173, 20, 0.3)' : 'rgba(82, 196, 26, 0.3)'}`,
              }}>
                <span style={{
                  width: 5,
                  height: 5,
                  borderRadius: '50%',
                  background: isDemoActive ? '#faad14' : '#52c41a',
                }} />
                {isDemoActive ? '🧪 Демо-дані' : '🔒 Ваші реальні дані'}
              </span>
            </div>
          </div>
        </div>

        {/* Navigation Tabs */}
        <nav style={{
          display: 'flex',
          alignItems: 'center',
          gap: 4,
          background: 'var(--bg-surface)',
          padding: 4,
          borderRadius: 'var(--radius-md)',
          border: '1px solid var(--border-subtle)',
        }}>
          <button
            onClick={() => onSelectTab('dashboard')}
            className={`btn btn-sm ${activeTab === 'dashboard' ? 'btn-primary' : 'btn-ghost'}`}
            style={{ borderRadius: 'var(--radius-sm)' }}
          >
            <PieChart size={15} />
            <span>Дашборд</span>
          </button>
          <button
            onClick={() => onSelectTab('analytics')}
            className={`btn btn-sm ${activeTab === 'analytics' ? 'btn-primary' : 'btn-ghost'}`}
            style={{ borderRadius: 'var(--radius-sm)' }}
          >
            <TrendingUp size={15} />
            <span>Аналітика & Heatmap</span>
          </button>
          <button
            onClick={() => onSelectTab('insights')}
            className={`btn btn-sm ${activeTab === 'insights' ? 'btn-primary' : 'btn-ghost'}`}
            style={{ borderRadius: 'var(--radius-sm)' }}
          >
            <Lightbulb size={15} />
            <span>Розумна економія</span>
          </button>
          <button
            onClick={() => onSelectTab('transactions')}
            className={`btn btn-sm ${activeTab === 'transactions' ? 'btn-primary' : 'btn-ghost'}`}
            style={{ borderRadius: 'var(--radius-sm)' }}
          >
            <Receipt size={15} />
            <span>Транзакції</span>
          </button>
          <button
            onClick={() => onSelectTab('settings')}
            className={`btn btn-sm ${activeTab === 'settings' ? 'btn-primary' : 'btn-ghost'}`}
            style={{ borderRadius: 'var(--radius-sm)' }}
          >
            <Settings size={15} />
            <span>Дані & Правила</span>
          </button>
        </nav>

        {/* Action Controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {/* Currency Pill */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            background: 'var(--bg-surface)',
            border: '1px solid var(--border-default)',
            borderRadius: 'var(--radius-sm)',
            overflow: 'hidden',
          }}>
            {(['UAH', 'USD', 'EUR'] as CurrencyCode[]).map((c) => (
              <button
                key={c}
                onClick={() => onChangeCurrency(c)}
                style={{
                  padding: '4px 8px',
                  fontSize: 12,
                  fontWeight: 600,
                  border: 'none',
                  background: currency === c ? 'var(--primary)' : 'transparent',
                  color: currency === c ? '#ffffff' : 'var(--text-secondary)',
                  cursor: 'pointer',
                  transition: 'var(--transition)',
                }}
              >
                {c}
              </button>
            ))}
          </div>

          {/* Theme Toggle */}
          <button
            onClick={onToggleTheme}
            className="btn btn-secondary btn-sm"
            title={isDark ? 'Увімкнути світлу тему' : 'Увімкнути темну тему'}
            style={{ padding: '6px 8px' }}
          >
            {isDark ? <Sun size={15} color="#faad14" /> : <Moon size={15} color="#1677ff" />}
          </button>

          {/* Demo Button if database empty or for testing */}
          <button
            onClick={onLoadDemo}
            className="btn btn-secondary btn-sm"
            title="Завантажити 12 місяців тестових операцій Monobank та Toshl"
          >
            <Sparkles size={14} color="#722ed1" />
            <span>Демо-дані</span>
          </button>

          {/* Import Button */}
          <button
            onClick={onOpenImport}
            className="btn btn-primary btn-sm"
            style={{ boxShadow: '0 2px 8px rgba(22, 119, 255, 0.35)' }}
          >
            <UploadCloud size={15} />
            <span>Імпорт виписки</span>
          </button>
        </div>
      </div>
    </header>
  );
};
