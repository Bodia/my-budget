import React, { useState, useEffect, useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { CheckCircle2, UploadCloud } from 'lucide-react';

import { db } from './db/database';
import { 
  calculateKPIs, 
  calculateCategoryBreakdown, 
  calculateMonthlyCashflow, 
  calculateTopMerchants 
} from './services/analytics/kpiCalculator';
import { analyzeSavingsOpportunities } from './services/analytics/smartSavings';

import { Header, type ActiveNavTab } from './components/layout/Header';
import { KPICards } from './components/dashboard/KPICards';
import { CategoryDonutChart } from './components/dashboard/CategoryDonutChart';
import { CashflowChart } from './components/dashboard/CashflowChart';
import { TopMerchantsChart } from './components/dashboard/TopMerchantsChart';
import { BudgetProgressList } from './components/dashboard/BudgetProgressList';
import { SmartSavingsView } from './components/insights/SmartSavingsView';
import { HeatmapCalendar } from './components/analytics/HeatmapCalendar';
import { TransactionsExplorer } from './components/transactions/TransactionsExplorer';
import { ImportModal } from './components/import/ImportModal';
import { DataManagementModal } from './components/settings/DataManagementModal';
import type { CurrencyCode } from './types/finance';

export const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<ActiveNavTab>('dashboard');
  const [isDark, setIsDark] = useState<boolean>(true);
  const [currency, setCurrency] = useState<CurrencyCode>('UAH');
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Time period filter: '1m' | '3m' | '6m' | '12m' | 'all'
  const [timeRange, setTimeRange] = useState<'1m' | '3m' | '6m' | '12m' | 'all'>('12m');

  // Live queries from Dexie IndexedDB
  const rawTransactions = useLiveQuery(() => db.transactions.toArray(), []);
  const categories = useLiveQuery(() => db.categories.toArray(), []);
  const budgets = useLiveQuery(() => db.budgets.toArray(), []);
  const rules = useLiveQuery(() => db.rules.toArray(), []);
  const exchangeRates = useLiveQuery(() => db.exchangeRates.toArray(), []);

  // Theme effect
  useEffect(() => {
    if (isDark) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [isDark]);

  // Remove any legacy demo data from IndexedDB immediately on launch
  useEffect(() => {
    const purgeExistingDemoData = async () => {
      const all = await db.transactions.toArray();
      const demoIds = all.filter(t => t.id.startsWith('demo_')).map(t => t.id);
      if (demoIds.length > 0) {
        await db.transactions.bulkDelete(demoIds);
      }
    };
    purgeExistingDemoData();
  }, []);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  // Filter transactions by timeRange and currency
  const filteredTransactions = useMemo(() => {
    if (!rawTransactions) return [];

    let list = [...rawTransactions];
    const now = new Date();

    if (timeRange !== 'all') {
      const months = timeRange === '1m' ? 1 : timeRange === '3m' ? 3 : timeRange === '6m' ? 6 : 12;
      const cutoff = new Date(now.getFullYear(), now.getMonth() - months, 1).toISOString();
      list = list.filter(t => t.date >= cutoff);
    }

    // Currency conversion if USD or EUR selected
    if (currency !== 'UAH' && exchangeRates) {
      const rateObj = exchangeRates.find(r => r.currency === currency);
      const rate = rateObj && rateObj.rateToUah > 0 ? rateObj.rateToUah : (currency === 'USD' ? 41.5 : 45.2);
      list = list.map(t => ({
        ...t,
        amount: parseFloat((t.amount / rate).toFixed(2)),
        currency,
      }));
    }

    return list;
  }, [rawTransactions, timeRange, currency, exchangeRates]);

  // Calculated Analytics
  const kpi = useMemo(() => {
    const days = timeRange === '1m' ? 30 : timeRange === '3m' ? 90 : timeRange === '6m' ? 180 : 365;
    return calculateKPIs(filteredTransactions, days);
  }, [filteredTransactions, timeRange]);

  const categoryBreakdown = useMemo(() => {
    return calculateCategoryBreakdown(filteredTransactions, categories || [], budgets || []);
  }, [filteredTransactions, categories, budgets]);

  const cashflowData = useMemo(() => {
    return calculateMonthlyCashflow(filteredTransactions);
  }, [filteredTransactions]);

  const topMerchants = useMemo(() => {
    return calculateTopMerchants(filteredTransactions, 8);
  }, [filteredTransactions]);

  const savingsInsights = useMemo(() => {
    return analyzeSavingsOpportunities(filteredTransactions, categories || []);
  }, [filteredTransactions, categories]);

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* Top Header */}
      <Header
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        onOpenImport={() => setIsImportModalOpen(true)}
        currency={currency}
        onChangeCurrency={setCurrency}
        isDark={isDark}
        onToggleTheme={() => setIsDark(prev => !prev)}
        totalTransactionsCount={rawTransactions?.length || 0}
      />

      {/* Global Toast Alert */}
      {toastMessage && (
        <div style={{
          position: 'fixed',
          bottom: 24,
          right: 24,
          zIndex: 1100,
          background: 'var(--bg-surface)',
          border: '1px solid var(--primary-border)',
          borderRadius: 'var(--radius-md)',
          padding: '12px 20px',
          boxShadow: 'var(--shadow-lg)',
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          fontSize: 14,
          fontWeight: 500,
          color: 'var(--text-primary)',
          animation: 'scaleUp 0.15s ease',
        }}>
          <CheckCircle2 size={18} color="var(--success)" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Main Container */}
      <main style={{ maxWidth: 1400, margin: '0 auto', width: '100%', padding: '24px', flex: 1 }}>
        {/* Global Filter Bar: Period Selection */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 16,
          marginBottom: 24,
        }}>
          <div>
            <h1 style={{
              fontSize: 24,
              fontWeight: 700,
              fontFamily: 'var(--font-display)',
              color: 'var(--text-primary)',
              letterSpacing: '-0.02em',
              margin: 0,
            }}>
              {activeTab === 'dashboard' && 'Огляд фінансів & Дашборд'}
              {activeTab === 'analytics' && 'Глибока аналітика & Календар витрат'}
              {activeTab === 'insights' && 'Розумна економія (Де можна заощадити)'}
              {activeTab === 'transactions' && 'Журнал транзакцій та операцій'}
              {activeTab === 'settings' && 'Керування даними, бекапи та правила'}
            </h1>
            <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 2 }}>
              {activeTab === 'dashboard' && 'Ключові метрики, діаграми структури витрат та бюджети'}
              {activeTab === 'analytics' && 'Щоденна теплова карта та динаміка грошового потоку'}
              {activeTab === 'insights' && 'Персоналізовані рекомендації щодо скорочення перевитрат'}
              {activeTab === 'transactions' && 'Пошук, фільтрація та налаштування категорій'}
              {activeTab === 'settings' && 'Експорт / імпорт бекапу, налаштування лімітів та авто-мапінгу'}
            </p>
          </div>

          {/* Time range pills */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 4,
            background: 'var(--bg-surface)',
            padding: 4,
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--border-default)',
          }}>
            {[
              { id: '1m', label: '1 місяць' },
              { id: '3m', label: '3 місяці' },
              { id: '6m', label: '6 місяців' },
              { id: '12m', label: '1 рік' },
              { id: 'all', label: 'Всі часи' },
            ].map((p) => (
              <button
                key={p.id}
                onClick={() => setTimeRange(p.id as any)}
                className={`btn btn-sm ${timeRange === p.id ? 'btn-primary' : 'btn-ghost'}`}
                style={{ fontSize: 12, padding: '4px 10px' }}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        {/* TAB 1: DASHBOARD */}
        {activeTab === 'dashboard' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
            {/* Empty State Banner when database is clean */}
            {(!rawTransactions || rawTransactions.length === 0) && (
              <div className="ant-card" style={{
                padding: '40px 24px',
                textAlign: 'center',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 14,
                background: 'linear-gradient(180deg, var(--bg-card) 0%, var(--bg-surface-hover) 100%)',
                border: '1.5px dashed var(--primary-border)',
                borderRadius: 'var(--radius-lg)',
              }}>
                <div style={{
                  width: 58,
                  height: 58,
                  borderRadius: '50%',
                  background: 'rgba(22, 119, 255, 0.1)',
                  color: 'var(--primary)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}>
                  <UploadCloud size={28} />
                </div>
                <div style={{ maxWidth: 520 }}>
                  <h2 style={{ fontSize: 20, fontWeight: 700, fontFamily: 'var(--font-display)', color: 'var(--text-primary)', marginBottom: 6 }}>
                    База готова до ваших даних
                  </h2>
                  <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                    Демо-дані видалено. Завантажте файл виписки з Monobank (.xlsx, .csv) або Toshl Finance, щоб побудувати інтерактивні графіки та побачити рекомендації з економії.
                  </p>
                </div>
                <div style={{ display: 'flex', justifyContent: 'center', marginTop: 4 }}>
                  <button onClick={() => setIsImportModalOpen(true)} className="btn btn-primary btn-sm" style={{ padding: '8px 20px', fontSize: 13 }}>
                    <UploadCloud size={16} />
                    <span>Імпортувати виписку</span>
                  </button>
                </div>
              </div>
            )}

            {/* KPI Cards */}
            <KPICards kpi={kpi} />

            {/* Middle Grid: Category Donut & Cashflow Column Chart */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(420px, 1fr))',
              gap: 20,
            }}>
              <CategoryDonutChart
                breakdown={categoryBreakdown}
                totalExpenses={kpi.totalExpenses}
                onSelectCategory={() => setActiveTab('transactions')}
              />
              <CashflowChart data={cashflowData} />
            </div>

            {/* Bottom Grid: Budgets & Top Merchants */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(420px, 1fr))',
              gap: 20,
            }}>
              <BudgetProgressList
                breakdown={categoryBreakdown}
                onOpenSettings={() => setActiveTab('settings')}
              />
              <TopMerchantsChart merchants={topMerchants} />
            </div>
          </div>
        )}

        {/* TAB 2: ANALYTICS & HEATMAP */}
        {activeTab === 'analytics' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
            {/* Heatmap Calendar */}
            <HeatmapCalendar transactions={filteredTransactions} />

            {/* Cashflow dynamics chart */}
            <CashflowChart data={cashflowData} />

            {/* Category Breakdown Table */}
            <div className="ant-card" style={{ padding: 24 }}>
              <h3 style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-primary)', fontFamily: 'var(--font-display)', marginBottom: 16 }}>
                Детальний розподіл витрат за категоріями
              </h3>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, textAlign: 'left' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--border-default)', color: 'var(--text-secondary)' }}>
                      <th style={{ padding: '10px 12px' }}>Категорія</th>
                      <th style={{ padding: '10px 12px', textAlign: 'right' }}>Сума витрат</th>
                      <th style={{ padding: '10px 12px', textAlign: 'right' }}>Частка</th>
                      <th style={{ padding: '10px 12px', textAlign: 'right' }}>Місячний ліміт</th>
                    </tr>
                  </thead>
                  <tbody>
                    {categoryBreakdown.map((c) => (
                      <tr key={c.categoryId} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                        <td style={{ padding: '12px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <span style={{ width: 10, height: 10, borderRadius: '50%', background: c.categoryColor }} />
                            <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{c.categoryName}</span>
                          </div>
                        </td>
                        <td className="tabular-nums" style={{ padding: '12px', textAlign: 'right', fontWeight: 600, color: 'var(--text-primary)' }}>
                          {new Intl.NumberFormat('uk-UA').format(c.amount)} ₴
                        </td>
                        <td className="tabular-nums" style={{ padding: '12px', textAlign: 'right', color: 'var(--text-secondary)' }}>
                          <span className="badge badge-primary">{c.percentage}%</span>
                        </td>
                        <td className="tabular-nums" style={{ padding: '12px', textAlign: 'right', color: 'var(--text-tertiary)' }}>
                          {c.budgetLimit ? `${new Intl.NumberFormat('uk-UA').format(c.budgetLimit)} ₴` : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: SMART SAVINGS INSIGHTS */}
        {activeTab === 'insights' && (
          <SmartSavingsView
            insights={savingsInsights}
            transactions={filteredTransactions}
            onSetBudget={() => setActiveTab('settings')}
          />
        )}

        {/* TAB 4: TRANSACTIONS EXPLORER */}
        {activeTab === 'transactions' && (
          <TransactionsExplorer
            transactions={filteredTransactions}
            categories={categories || []}
          />
        )}

        {/* TAB 5: DATA & RULES MANAGEMENT */}
        {activeTab === 'settings' && (
          <DataManagementModal
            categories={categories || []}
            budgets={budgets || []}
            rules={rules || []}
            onReload={() => showToast('Дані успішно оновлено')}
          />
        )}
      </main>

      {/* Import Modal */}
      <ImportModal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        onSuccess={(count) => {
          showToast(`Успішно імпортовано ${count} нових операцій!`);
        }}
      />
    </div>
  );
};

export default App;


