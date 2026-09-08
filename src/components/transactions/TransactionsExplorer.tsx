import React, { useState, useMemo } from 'react';
import { 
  Search, 
  Trash2, 
  Sparkles, 
  ChevronLeft, 
  ChevronRight, 
  ArrowUpDown, 
  Check, 
  CheckSquare, 
  Square 
} from 'lucide-react';
import type { Transaction, Category } from '../../types/finance';
import { db } from '../../db/database';
import { createRuleFromTransaction, applyRuleBackfill } from '../../services/rules/ruleEngine';
import { formatUah } from '../../services/analytics/kpiCalculator';

interface TransactionsExplorerProps {
  transactions: Transaction[];
  categories: Category[];
}

export const TransactionsExplorer: React.FC<TransactionsExplorerProps> = ({
  transactions,
  categories,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<string>('all');
  const [selectedSourceFilter, setSelectedSourceFilter] = useState<string>('all');
  const [sortOrder, setSortOrder] = useState<'desc' | 'asc'>('desc');
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 30;

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [pendingRulePrompt, setPendingRulePrompt] = useState<{
    transaction: Transaction;
    newCategoryId: string;
  } | null>(null);

  const categoryMap = useMemo(() => new Map(categories.map(c => [c.id, c])), [categories]);

  // Filter and sort transactions
  const filtered = useMemo(() => {
    let list = [...transactions];

    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase().trim();
      list = list.filter(t => 
        t.description.toLowerCase().includes(term) ||
        t.accountId.toLowerCase().includes(term) ||
        (t.notes && t.notes.toLowerCase().includes(term))
      );
    }

    if (selectedCategoryFilter !== 'all') {
      list = list.filter(t => t.categoryId === selectedCategoryFilter);
    }

    if (selectedSourceFilter !== 'all') {
      list = list.filter(t => t.source === selectedSourceFilter);
    }

    list.sort((a, b) => {
      const timeA = new Date(a.date).getTime();
      const timeB = new Date(b.date).getTime();
      return sortOrder === 'desc' ? timeB - timeA : timeA - timeB;
    });

    return list;
  }, [transactions, searchTerm, selectedCategoryFilter, selectedSourceFilter, sortOrder]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const paginated = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  // Handle single category change
  const handleChangeCategory = async (t: Transaction, newCatId: string) => {
    if (t.categoryId === newCatId) return;

    await db.transactions.update(t.id, { categoryId: newCatId });

    // Offer rule creation if description has multiple occurrences
    const countSimilar = transactions.filter(other => 
      other.id !== t.id && 
      other.description.toLowerCase().trim() === t.description.toLowerCase().trim()
    ).length;

    if (countSimilar > 0) {
      setPendingRulePrompt({ transaction: t, newCategoryId: newCatId });
    }
  };

  const handleConfirmRule = async () => {
    if (!pendingRulePrompt) return;
    const rule = await createRuleFromTransaction(
      pendingRulePrompt.transaction,
      pendingRulePrompt.newCategoryId
    );
    await applyRuleBackfill(rule);
    setPendingRulePrompt(null);
  };

  // Batch deletion
  const handleDeleteSelected = async () => {
    if (selectedIds.size === 0) return;
    if (window.confirm(`Видалити ${selectedIds.size} обраних транзакцій?`)) {
      await db.transactions.bulkDelete(Array.from(selectedIds));
      setSelectedIds(new Set());
    }
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === paginated.length && paginated.length > 0) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(paginated.map(p => p.id)));
    }
  };

  const toggleSelectOne = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedIds(next);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Rule Creation Banner Toast */}
      {pendingRulePrompt && (
        <div className="ant-card" style={{
          padding: '16px 20px',
          background: 'var(--primary-bg)',
          border: '1px solid var(--primary-border)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 12,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Sparkles size={18} color="var(--primary)" />
            <div style={{ fontSize: 13, color: 'var(--text-primary)' }}>
              Створити правило для <strong>"{pendingRulePrompt.transaction.description}"</strong>?
              {' '}Усі схожі та майбутні операції автоматично отримають категорію{' '}
              <strong>"{categoryMap.get(pendingRulePrompt.newCategoryId)?.name}"</strong>.
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={handleConfirmRule} className="btn btn-primary btn-sm">
              <Check size={14} />
              <span>Так, створити правило</span>
            </button>
            <button onClick={() => setPendingRulePrompt(null)} className="btn btn-secondary btn-sm">
              Ні, тільки для цієї
            </button>
          </div>
        </div>
      )}

      {/* Filter and Control Bar */}
      <div className="ant-card" style={{ padding: '16px 20px' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center', justifyContent: 'space-between' }}>
          {/* Search Box */}
          <div style={{ position: 'relative', minWidth: 260, flex: 1 }}>
            <Search size={16} color="var(--text-tertiary)" style={{ position: 'absolute', left: 12, top: 11 }} />
            <input
              type="text"
              className="input"
              placeholder="Пошук за описом, карткою чи нотатками..."
              value={searchTerm}
              onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
              style={{ paddingLeft: 36 }}
            />
          </div>

          {/* Category Dropdown Filter */}
          <div style={{ minWidth: 200 }}>
            <select
              className="select"
              value={selectedCategoryFilter}
              onChange={(e) => { setSelectedCategoryFilter(e.target.value); setCurrentPage(1); }}
            >
              <option value="all">Усі категорії ({categories.length})</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>

          {/* Source Filter */}
          <div style={{ minWidth: 150 }}>
            <select
              className="select"
              value={selectedSourceFilter}
              onChange={(e) => { setSelectedSourceFilter(e.target.value); setCurrentPage(1); }}
            >
              <option value="all">Усі джерела</option>
              <option value="monobank">Monobank</option>
              <option value="toshl">Toshl Finance</option>
              <option value="generic">Інші</option>
            </select>
          </div>

          {/* Sort Order Button */}
          <button
            onClick={() => setSortOrder(prev => prev === 'desc' ? 'asc' : 'desc')}
            className="btn btn-secondary btn-sm"
            title="Змінити напрямок сортування за датою"
          >
            <ArrowUpDown size={14} />
            <span>{sortOrder === 'desc' ? 'Спочатку нові' : 'Спочатку старі'}</span>
          </button>

          {/* Batch Delete Action */}
          {selectedIds.size > 0 && (
            <button
              onClick={handleDeleteSelected}
              className="btn btn-danger btn-sm"
            >
              <Trash2 size={14} />
              <span>Видалити ({selectedIds.size})</span>
            </button>
          )}
        </div>
      </div>

      {/* Main Table */}
      <div className="ant-card" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, textAlign: 'left' }}>
            <thead>
              <tr style={{ background: 'var(--bg-surface-hover)', borderBottom: '1px solid var(--border-default)', color: 'var(--text-secondary)' }}>
                <th style={{ padding: '12px 16px', width: 40 }}>
                  <span onClick={toggleSelectAll} style={{ cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
                    {selectedIds.size === paginated.length && paginated.length > 0 ? (
                      <CheckSquare size={16} color="var(--primary)" />
                    ) : (
                      <Square size={16} color="var(--text-tertiary)" />
                    )}
                  </span>
                </th>
                <th style={{ padding: '12px 16px', fontWeight: 600 }}>Дата</th>
                <th style={{ padding: '12px 16px', fontWeight: 600 }}>Опис / Контрагент</th>
                <th style={{ padding: '12px 16px', fontWeight: 600 }}>Категорія</th>
                <th style={{ padding: '12px 16px', fontWeight: 600 }}>Джерело</th>
                <th style={{ padding: '12px 16px', fontWeight: 600, textAlign: 'right' }}>Сума</th>
              </tr>
            </thead>
            <tbody>
              {paginated.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ padding: 48, textAlign: 'center', color: 'var(--text-tertiary)' }}>
                    Операцій не знайдено за вашим запитом
                  </td>
                </tr>
              ) : (
                paginated.map((t) => {
                  const isSelected = selectedIds.has(t.id);
                  const isExpense = t.amount < 0;

                  return (
                    <tr
                      key={t.id}
                      style={{
                        borderBottom: '1px solid var(--border-subtle)',
                        background: isSelected ? 'var(--primary-bg)' : 'transparent',
                        transition: 'background-color 0.15s ease',
                      }}
                    >
                      <td style={{ padding: '12px 16px' }}>
                        <span onClick={() => toggleSelectOne(t.id)} style={{ cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
                          {isSelected ? (
                            <CheckSquare size={16} color="var(--primary)" />
                          ) : (
                            <Square size={16} color="var(--text-tertiary)" />
                          )}
                        </span>
                      </td>
                      <td style={{ padding: '12px 16px', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
                        {t.date.replace('T', ' ').slice(0, 16)}
                      </td>
                      <td style={{ padding: '12px 16px', fontWeight: 500, color: 'var(--text-primary)' }}>
                        <div>{t.description}</div>
                        {t.mcc && (
                          <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>
                            MCC: {t.mcc} {t.subCategory ? `• ${t.subCategory}` : ''}
                          </span>
                        )}
                      </td>
                      <td style={{ padding: '12px 16px' }}>
                        <select
                          className="select"
                          value={t.categoryId}
                          onChange={(e) => handleChangeCategory(t, e.target.value)}
                          style={{
                            padding: '4px 8px',
                            fontSize: 12,
                            width: 'auto',
                            minWidth: 160,
                            borderRadius: 'var(--radius-sm)',
                          }}
                        >
                          {categories.map((c) => (
                            <option key={c.id} value={c.id}>{c.name}</option>
                          ))}
                        </select>
                      </td>
                      <td style={{ padding: '12px 16px' }}>
                        <span className={`badge ${t.source === 'monobank' ? 'badge-primary' : 'badge-warning'}`} style={{ textTransform: 'capitalize' }}>
                          {t.source}
                        </span>
                      </td>
                      <td className="tabular-nums" style={{
                        padding: '12px 16px',
                        textAlign: 'right',
                        fontWeight: 700,
                        color: isExpense ? 'var(--danger)' : 'var(--success)',
                        whiteSpace: 'nowrap',
                      }}>
                        {isExpense ? '-' : '+'}{formatUah(t.amount)}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Footer */}
        <div style={{
          padding: '12px 20px',
          borderTop: '1px solid var(--border-subtle)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          fontSize: 13,
          color: 'var(--text-secondary)',
        }}>
          <div>
            Показано {(currentPage - 1) * pageSize + 1}–{Math.min(currentPage * pageSize, filtered.length)} із {filtered.length}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <button
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="btn btn-secondary btn-sm"
            >
              <ChevronLeft size={14} />
              <span>Попередня</span>
            </button>
            <span>
              Сторінка <strong>{currentPage}</strong> із <strong>{totalPages}</strong>
            </span>
            <button
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="btn btn-secondary btn-sm"
            >
              <span>Наступна</span>
              <ChevronRight size={14} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
