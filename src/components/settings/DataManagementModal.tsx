import React, { useState } from 'react';
import { 
  Download, 
  Upload, 
  Trash2, 
  Save, 
  Check 
} from 'lucide-react';
import type { Category, Budget, CategorizationRule } from '../../types/finance';
import { db } from '../../db/database';

interface DataManagementModalProps {
  categories: Category[];
  budgets: Budget[];
  rules: CategorizationRule[];
  onReload: () => void;
}

export const DataManagementModal: React.FC<DataManagementModalProps> = ({
  categories,
  budgets,
  rules,
  onReload,
}) => {
  const [budgetLimits, setBudgetLimits] = useState<Record<string, number>>(
    Object.fromEntries(budgets.map(b => [b.categoryId, b.monthlyLimit]))
  );
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Backup Export
  const handleExportBackup = async () => {
    const transactions = await db.transactions.toArray();
    const allCategories = await db.categories.toArray();
    const allBudgets = await db.budgets.toArray();
    const allRules = await db.rules.toArray();

    const backupData = {
      version: 1,
      exportedAt: new Date().toISOString(),
      transactions,
      categories: allCategories,
      budgets: allBudgets,
      rules: allRules,
    };

    const blob = new Blob([JSON.stringify(backupData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `my-budget-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Backup Restore
  const handleImportBackup = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const json = JSON.parse(event.target?.result as string);
        if (json.transactions && Array.isArray(json.transactions)) {
          await db.transactions.clear();
          await db.transactions.bulkAdd(json.transactions);
          if (json.budgets) {
            await db.budgets.clear();
            await db.budgets.bulkAdd(json.budgets);
          }
          if (json.rules) {
            await db.rules.clear();
            await db.rules.bulkAdd(json.rules);
          }
          alert(`Успішно відновлено ${json.transactions.length} операцій!`);
          onReload();
        }
      } catch (err: any) {
        alert('Невірний формат файлу бекапу: ' + err.message);
      }
    };
    reader.readAsText(file);
  };

  // Save budget limits
  const handleSaveBudgets = async () => {
    for (const [catId, limit] of Object.entries(budgetLimits)) {
      const existing = budgets.find(b => b.categoryId === catId);
      if (existing) {
        await db.budgets.update(existing.id, { monthlyLimit: limit });
      } else {
        await db.budgets.add({
          id: `b_${catId}`,
          categoryId: catId,
          monthlyLimit: limit,
          currency: 'UAH',
          alertThresholdPercent: 80,
        });
      }
    }
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 2000);
    onReload();
  };

  // Clear Database
  const handleClearDatabase = async () => {
    if (window.confirm('Ви впевнені, що хочете видалити всі транзакції з локальної бази? Цю дію неможливо скасувати.')) {
      await db.transactions.clear();
      onReload();
      alert('Базу транзакцій очищено.');
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* Top Banner: Local-first Data Portability */}
      <div className="ant-card" style={{ padding: 24 }}>
        <h3 style={{ fontSize: 18, fontWeight: 700, fontFamily: 'var(--font-display)', color: 'var(--text-primary)', marginBottom: 8 }}>
          Керування даними та резервне копіювання
        </h3>
        <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 20 }}>
          Ваші дані зберігаються виключно у вашому браузері. Ви можете зберегти повний бекап або перенести дані на інший комп'ютер в 1 клік.
        </p>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
          <button onClick={handleExportBackup} className="btn btn-primary btn-sm">
            <Download size={15} />
            <span>Експортувати бекап (JSON)</span>
          </button>

          <label className="btn btn-secondary btn-sm" style={{ cursor: 'pointer' }}>
            <Upload size={15} />
            <span>Відновити з бекапу</span>
            <input type="file" accept=".json" onChange={handleImportBackup} style={{ display: 'none' }} />
          </label>

          <button onClick={handleClearDatabase} className="btn btn-danger btn-sm" style={{ marginLeft: 'auto' }}>
            <Trash2 size={15} />
            <span>Очистити базу</span>
          </button>
        </div>
      </div>

      {/* Monthly Budget Limits Configuration */}
      <div className="ant-card" style={{ padding: 24 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <div>
            <h3 style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-primary)', fontFamily: 'var(--font-display)' }}>
              Щомісячні бюджети та ліміти витрат (UAH)
            </h3>
            <p style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
              Вкажіть планову суму витрат на кожну категорію
            </p>
          </div>
          <button onClick={handleSaveBudgets} className="btn btn-primary btn-sm">
            {saveSuccess ? <Check size={14} /> : <Save size={14} />}
            <span>{saveSuccess ? 'Збережено!' : 'Зберегти зміни'}</span>
          </button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16 }}>
          {categories.filter(c => c.type === 'expense').map((cat) => (
            <div key={cat.id} style={{
              padding: 12,
              borderRadius: 'var(--radius-sm)',
              border: '1px solid var(--border-default)',
              background: 'var(--bg-surface-hover)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 12,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ width: 10, height: 10, borderRadius: '50%', background: cat.color }} />
                <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)' }}>{cat.name}</span>
              </div>
              <div style={{ width: 120 }}>
                <input
                  type="number"
                  className="input"
                  style={{ padding: '4px 8px', fontSize: 13, textAlign: 'right' }}
                  value={budgetLimits[cat.id] || ''}
                  placeholder="0"
                  onChange={(e) => {
                    const val = parseFloat(e.target.value) || 0;
                    setBudgetLimits(prev => ({ ...prev, [cat.id]: val }));
                  }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Rules Manager List */}
      <div className="ant-card" style={{ padding: 24 }}>
        <h3 style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-primary)', fontFamily: 'var(--font-display)', marginBottom: 8 }}>
          Правила автоматичної категоризації ({rules.length})
        </h3>
        <p style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 16 }}>
          Правила пріоритетно призначають категорії операціям при імпорті виписок
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {rules.map((rule) => {
            const targetCat = categories.find(c => c.id === rule.targetCategoryId);
            return (
              <div key={rule.id} style={{
                padding: '10px 14px',
                borderRadius: 'var(--radius-sm)',
                border: '1px solid var(--border-subtle)',
                background: 'var(--bg-surface)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                fontSize: 13,
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span className="badge badge-primary">Пріоритет {rule.priority}</span>
                  <span style={{ color: 'var(--text-primary)' }}>
                    Якщо опис <strong>{rule.operator}</strong> "{rule.pattern}"
                  </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <span className="badge badge-success">
                    ➔ {targetCat?.name || rule.targetCategoryId}
                  </span>
                  <button
                    onClick={async () => {
                      await db.rules.delete(rule.id);
                      onReload();
                    }}
                    className="btn btn-ghost btn-sm"
                    style={{ color: 'var(--danger)', padding: 4 }}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
