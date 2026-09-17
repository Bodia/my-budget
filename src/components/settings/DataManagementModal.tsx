import React, { useState } from 'react';
import { 
  Download, 
  Upload, 
  Trash2, 
  Sparkles 
} from 'lucide-react';
import type { Category, Budget, CategorizationRule, Transaction } from '../../types/finance';
import { db } from '../../db/database';
import { CardsManager } from './CardsManager';
import { CategoryManager } from './CategoryManager';
import { BudgetLimitsManager } from './BudgetLimitsManager';
import { reclassifyAllTransactions } from '../../services/intelligence/recognitionEngine';

interface DataManagementModalProps {
  categories: Category[];
  budgets: Budget[];
  rules: CategorizationRule[];
  transactions?: Transaction[];
  onReload: () => void;
}

export const DataManagementModal: React.FC<DataManagementModalProps> = ({
  categories,
  budgets,
  rules,
  transactions = [],
  onReload,
}) => {
  const [isReclassifying, setIsReclassifying] = useState(false);

  const handleReclassify = async () => {
    setIsReclassifying(true);
    try {
      const updated = await reclassifyAllTransactions();
      alert(`Інтелектуальне розпізнавання завершено! Оновлено ${updated} транзакцій (чисті бренди, банки накопичення, повернення, теги).`);
      onReload();
    } catch (err: any) {
      alert('Помилка розпізнавання: ' + err.message);
    } finally {
      setIsReclassifying(false);
    }
  };

  // Backup Export
  const handleExportBackup = async () => {
    const allTransactions = await db.transactions.toArray();
    const allCategories = await db.categories.toArray();
    const allBudgets = await db.budgets.toArray();
    const allRules = await db.rules.toArray();
    const allAccounts = await db.accounts.toArray();

    const backupData = {
      version: 2,
      exportedAt: new Date().toISOString(),
      transactions: allTransactions,
      categories: allCategories,
      budgets: allBudgets,
      rules: allRules,
      accounts: allAccounts,
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
          if (json.accounts && Array.isArray(json.accounts)) {
            await db.accounts.clear();
            await db.accounts.bulkAdd(json.accounts);
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

          <button 
            onClick={handleReclassify} 
            disabled={isReclassifying} 
            className="btn btn-secondary btn-sm"
            title="Повторно розпізнати банки накопичення, повернення, теги та очистити назви українських брендів"
          >
            <Sparkles size={15} color="var(--primary)" />
            <span>{isReclassifying ? 'Оновлення...' : 'Перерозпізнати транзакції'}</span>
          </button>

          <button onClick={handleClearDatabase} className="btn btn-danger btn-sm" style={{ marginLeft: 'auto' }}>
            <Trash2 size={15} />
            <span>Очистити базу</span>
          </button>
        </div>
      </div>

      {/* Category Manager (SCRUM-10) */}
      <CategoryManager categories={categories} onNotify={onReload} />

      {/* Bank Cards & Accounts Manager */}
      <CardsManager onNotify={onReload} />

      {/* Dynamic Monthly Budget Limits Manager (SCRUM-11) */}
      <BudgetLimitsManager 
        categories={categories}
        budgets={budgets}
        transactions={transactions}
        onNotify={onReload}
      />

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
