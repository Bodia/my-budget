import React from 'react';
import { 
  PieChart, 
  TrendingUp, 
  Lightbulb, 
  Receipt, 
  Settings, 
  UploadCloud, 
  Moon, 
  Sun 
} from 'lucide-react';
import type { CurrencyCode } from '../../types/finance';

export type ActiveNavTab = 'dashboard' | 'analytics' | 'insights' | 'transactions' | 'settings';

interface HeaderProps {
  activeTab: ActiveNavTab;
  onSelectTab: (tab: ActiveNavTab) => void;
  onOpenImport: () => void;
  currency: CurrencyCode;
  onChangeCurrency: (c: CurrencyCode) => void;
  isDark: boolean;
  onToggleTheme: () => void;
  totalTransactionsCount: number;
}

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  onSelectTab,
  onOpenImport,
  currency,
  onChangeCurrency,
  isDark,
  onToggleTheme,
  totalTransactionsCount,
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
      padding: '0 16px',
    }}>
      <div className="app-header-container">
        {/* Brand */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', flexShrink: 0 }} onClick={() => onSelectTab('dashboard')}>
          <div style={{
            width: 36,
            height: 36,
            borderRadius: 'var(--radius-md)',
            background: 'linear-gradient(135deg, #1677ff 0%, #722ed1 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#fff',
            boxShadow: '0 4px 12px rgba(22, 119, 255, 0.3)',
            flexShrink: 0,
          }}>
            <PieChart size={18} />
          </div>
          <div>
            <div style={{
              fontFamily: 'var(--font-display)',
              fontSize: 17,
              fontWeight: 700,
              color: 'var(--text-primary)',
              letterSpacing: '-0.02em',
              lineHeight: 1.2,
            }}>
              My Budget
            </div>
            <div className="header-brand-subtitle" style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 1 }}>
              {totalTransactionsCount > 0 ? `${totalTransactionsCount} операцій` : 'Журнал фінансів'}
            </div>
          </div>
        </div>

        {/* Navigation Tabs */}
        <nav className="app-nav">
          <button
            onClick={() => onSelectTab('dashboard')}
            className={`btn btn-sm ${activeTab === 'dashboard' ? 'btn-primary' : 'btn-ghost'}`}
            style={{ borderRadius: 'var(--radius-sm)', padding: '6px 10px' }}
            title="Дашборд"
          >
            <PieChart size={15} />
            <span className="nav-btn-text">Дашборд</span>
          </button>
          <button
            onClick={() => onSelectTab('analytics')}
            className={`btn btn-sm ${activeTab === 'analytics' ? 'btn-primary' : 'btn-ghost'}`}
            style={{ borderRadius: 'var(--radius-sm)', padding: '6px 10px' }}
            title="Аналітика & Heatmap"
          >
            <TrendingUp size={15} />
            <span className="nav-btn-text">Аналітика <span className="nav-btn-text-long">& Heatmap</span></span>
          </button>
          <button
            onClick={() => onSelectTab('insights')}
            className={`btn btn-sm ${activeTab === 'insights' ? 'btn-primary' : 'btn-ghost'}`}
            style={{ borderRadius: 'var(--radius-sm)', padding: '6px 10px' }}
            title="Розумна економія"
          >
            <Lightbulb size={15} />
            <span className="nav-btn-text">Розумна економія</span>
          </button>
          <button
            onClick={() => onSelectTab('transactions')}
            className={`btn btn-sm ${activeTab === 'transactions' ? 'btn-primary' : 'btn-ghost'}`}
            style={{ borderRadius: 'var(--radius-sm)', padding: '6px 10px' }}
            title="Транзакції"
          >
            <Receipt size={15} />
            <span className="nav-btn-text">Транзакції</span>
          </button>
          <button
            onClick={() => onSelectTab('settings')}
            className={`btn btn-sm ${activeTab === 'settings' ? 'btn-primary' : 'btn-ghost'}`}
            style={{ borderRadius: 'var(--radius-sm)', padding: '6px 10px' }}
            title="Дані & Правила"
          >
            <Settings size={15} />
            <span className="nav-btn-text">Дані <span className="nav-btn-text-long">& Правила</span></span>
          </button>
        </nav>

        {/* Action Controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
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
                  padding: '4px 7px',
                  fontSize: 11,
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

          {/* Import Button */}
          <button
            onClick={onOpenImport}
            className="btn btn-primary btn-sm"
            title="Імпортувати виписку"
            style={{ boxShadow: '0 2px 8px rgba(22, 119, 255, 0.35)', padding: '6px 12px' }}
          >
            <UploadCloud size={15} />
            <span className="import-btn-label">Імпорт виписки</span>
          </button>
        </div>
      </div>
    </header>
  );
};
