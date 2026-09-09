import React, { useState, useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { 
  Search, 
  Trash2, 
  Sparkles, 
  ChevronLeft, 
  ChevronRight, 
  ArrowUpDown, 
  Check, 
  CheckSquare, 
  Square,
  CreditCard,
  Edit2,
  X,
  AlertCircle
} from 'lucide-react';
import type { Transaction, Category, Account } from '../../types/finance';
import { db } from '../../db/database';
import { createRuleFromTransaction, applyRuleBackfill } from '../../services/rules/ruleEngine';
import { formatUah } from '../../services/analytics/kpiCalculator';
import { CardBadge } from '../cards/CardBadge';
import { CardNumberInput } from '../cards/CardNumberInput';
import { formatCardMask, isValidCardLast4 } from '../../utils/cardUtils';

interface TransactionsExplorerProps {
  transactions: Transaction[];
  categories: Category[];
  accounts?: Account[];
}

export const TransactionsExplorer: React.FC<TransactionsExplorerProps> = ({
  transactions,
  categories,
  accounts: propAccounts,
}) => {
  const liveAccounts = useLiveQuery(() => db.accounts.toArray(), []);
  const accounts = propAccounts && propAccounts.length > 0 ? propAccounts : (liveAccounts || []);

  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<string>('all');
  const [selectedSourceFilter, setSelectedSourceFilter] = useState<string>('all');
  const [selectedCardFilter, setSelectedCardFilter] = useState<string>('all');
  const [sortOrder, setSortOrder] = useState<'desc' | 'asc'>('desc');
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 30;

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [pendingRulePrompt, setPendingRulePrompt] = useState<{
    transaction: Transaction;
    newCategoryId: string;
  } | null>(null);

  // Card Assignment Modal State
  const [cardModalState, setCardModalState] = useState<{
    isOpen: boolean;
    targets: Transaction[];
    selectedAccountId: string;
    customLast4: string;
    applyToSimilar: boolean;
    error?: string | null;
  } | null>(null);

  const categoryMap = useMemo(() => new Map(categories.map(c => [c.id, c])), [categories]);
  const accountMap = useMemo(() => new Map(accounts.map(a => [a.id, a])), [accounts]);
  const cardAccounts = useMemo(() => accounts.filter(a => a.type === 'bank_card'), [accounts]);

  // Filter and sort transactions
  const filtered = useMemo(() => {
    let list = [...transactions];

    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase().trim();
      list = list.filter(t => {
        const accName = accountMap.get(t.accountId)?.name?.toLowerCase() || '';
        return (
          t.description.toLowerCase().includes(term) ||
          t.accountId.toLowerCase().includes(term) ||
          accName.includes(term) ||
          (t.cardLast4 && t.cardLast4.includes(term)) ||
          (t.cardNumberMasked && t.cardNumberMasked.toLowerCase().includes(term)) ||
          (t.notes && t.notes.toLowerCase().includes(term))
        );
      });
    }

    if (selectedCategoryFilter !== 'all') {
      list = list.filter(t => t.categoryId === selectedCategoryFilter);
    }

    if (selectedSourceFilter !== 'all') {
      list = list.filter(t => t.source === selectedSourceFilter);
    }

    if (selectedCardFilter !== 'all') {
      if (selectedCardFilter === 'none') {
        list = list.filter(t => !t.cardLast4);
      } else {
        const targetAcc = accountMap.get(selectedCardFilter);
        list = list.filter(t => 
          t.accountId === selectedCardFilter || 
          (targetAcc?.cardLast4 && t.cardLast4 === targetAcc.cardLast4)
        );
      }
    }

    list.sort((a, b) => {
      const timeA = new Date(a.date).getTime();
      const timeB = new Date(b.date).getTime();
      return sortOrder === 'desc' ? timeB - timeA : timeA - timeB;
    });

    return list;
  }, [transactions, searchTerm, selectedCategoryFilter, selectedSourceFilter, selectedCardFilter, sortOrder, accountMap]);

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

  // Open Card Modal for a single transaction
  const handleOpenSingleCardModal = (tx: Transaction) => {
    setCardModalState({
      isOpen: true,
      targets: [tx],
      selectedAccountId: tx.accountId || (cardAccounts[0]?.id || ''),
      customLast4: tx.cardLast4 || '',
      applyToSimilar: false,
      error: null,
    });
  };

  // Open Card Modal for batch selected transactions
  const handleOpenBatchCardModal = () => {
    const targets = transactions.filter(t => selectedIds.has(t.id));
    if (targets.length === 0) return;

    setCardModalState({
      isOpen: true,
      targets,
      selectedAccountId: cardAccounts[0]?.id || '',
      customLast4: '',
      applyToSimilar: false,
      error: null,
    });
  };

  // Save Card Assignment
  const handleSaveCardAssignment = async () => {
    if (!cardModalState) return;

    let targetLast4: string | undefined;
    let targetAccountId = cardModalState.selectedAccountId;

    if (targetAccountId === 'custom') {
      const clean = cardModalState.customLast4.trim();
      if (!isValidCardLast4(clean)) {
        setCardModalState(prev => prev ? { ...prev, error: 'Введіть коректні 4 цифри картки' } : null);
        return;
      }
      targetLast4 = clean;
    } else if (targetAccountId === 'none') {
      targetLast4 = undefined;
      targetAccountId = 'cash';
    } else {
      const acc = accountMap.get(targetAccountId);
      targetLast4 = acc?.cardLast4;
    }

    const masked = targetLast4 ? formatCardMask(targetLast4) : undefined;

    let affectedIds = cardModalState.targets.map(t => t.id);

    // Apply to similar if option checked for single transaction
    if (cardModalState.targets.length === 1 && cardModalState.applyToSimilar) {
      const desc = cardModalState.targets[0].description.toLowerCase().trim();
      const similar = transactions.filter(t => t.description.toLowerCase().trim() === desc);
      affectedIds = Array.from(new Set([...affectedIds, ...similar.map(s => s.id)]));
    }

    // Update transactions in database
    await Promise.all(
      affectedIds.map(id => db.transactions.update(id, {
        accountId: targetAccountId === 'custom' ? (cardModalState.targets[0]?.accountId || 'bank_card') : targetAccountId,
        cardLast4: targetLast4,
        cardNumberMasked: masked,
      }))
    );

    setCardModalState(null);
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
              placeholder="Пошук за описом, карткою (4 цифри) чи нотатками..."
              value={searchTerm}
              onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
              style={{ paddingLeft: 36 }}
            />
          </div>

          {/* Card / Account Dropdown Filter */}
          <div style={{ minWidth: 170 }}>
            <select
              className="select"
              value={selectedCardFilter}
              onChange={(e) => { setSelectedCardFilter(e.target.value); setCurrentPage(1); }}
            >
              <option value="all">Усі картки ({cardAccounts.length})</option>
              {cardAccounts.map((acc) => (
                <option key={acc.id} value={acc.id}>
                  {acc.cardLast4 ? `•••• ${acc.cardLast4} (${acc.name})` : acc.name}
                </option>
              ))}
              <option value="none">Без картки</option>
            </select>
          </div>

          {/* Category Dropdown Filter */}
          <div style={{ minWidth: 180 }}>
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
          <div style={{ minWidth: 140 }}>
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

          {/* Batch Actions */}
          {selectedIds.size > 0 && (
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <button
                onClick={handleOpenBatchCardModal}
                className="btn btn-secondary btn-sm"
                title="Призначити картку для обраних операцій"
              >
                <CreditCard size={14} />
                <span>Призначити картку ({selectedIds.size})</span>
              </button>

              <button
                onClick={handleDeleteSelected}
                className="btn btn-danger btn-sm"
              >
                <Trash2 size={14} />
                <span>Видалити ({selectedIds.size})</span>
              </button>
            </div>
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
                <th style={{ padding: '12px 16px', fontWeight: 600 }}>Картка</th>
                <th style={{ padding: '12px 16px', fontWeight: 600 }}>Категорія</th>
                <th style={{ padding: '12px 16px', fontWeight: 600 }}>Джерело</th>
                <th style={{ padding: '12px 16px', fontWeight: 600, textAlign: 'right' }}>Сума</th>
              </tr>
            </thead>
            <tbody>
              {paginated.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ padding: 48, textAlign: 'center', color: 'var(--text-tertiary)' }}>
                    Операцій не знайдено за вашим запитом
                  </td>
                </tr>
              ) : (
                paginated.map((t) => {
                  const isSelected = selectedIds.has(t.id);
                  const isExpense = t.amount < 0;
                  const account = accountMap.get(t.accountId);
                  const effectiveLast4 = t.cardLast4 || account?.cardLast4;

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

                      {/* Card Column: Masked last 4 digits */}
                      <td style={{ padding: '12px 16px' }}>
                        <button
                          type="button"
                          onClick={() => handleOpenSingleCardModal(t)}
                          className="btn btn-ghost btn-sm"
                          style={{
                            padding: '3px 8px',
                            fontSize: 12,
                            borderRadius: 'var(--radius-sm)',
                            background: 'var(--bg-surface-hover)',
                            border: '1px solid var(--border-default)',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 6,
                            cursor: 'pointer',
                          }}
                          title="Змінити картку або останні 4 цифри"
                        >
                          {effectiveLast4 ? (
                            <CardBadge
                              last4={effectiveLast4}
                              color={account?.color}
                              name={account?.name}
                            />
                          ) : (
                            <span style={{ fontSize: 11, color: 'var(--text-tertiary)', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                              <CreditCard size={13} />
                              <span>+ Вказати</span>
                            </span>
                          )}
                          <Edit2 size={11} color="var(--text-tertiary)" style={{ marginLeft: 2 }} />
                        </button>
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

      {/* Card Assignment Modal */}
      {cardModalState?.isOpen && (
        <div className="modal-backdrop" onClick={() => setCardModalState(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 480 }}>
            {/* Header */}
            <div style={{
              padding: '18px 24px',
              borderBottom: '1px solid var(--border-default)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}>
              <div>
                <h3 style={{ fontSize: 16, fontWeight: 700, fontFamily: 'var(--font-display)', color: 'var(--text-primary)' }}>
                  {cardModalState.targets.length > 1
                    ? `Призначити картку (${cardModalState.targets.length} операцій)`
                    : 'Призначення картки для транзакції'}
                </h3>
                {cardModalState.targets.length === 1 && (
                  <p style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>
                    "{cardModalState.targets[0].description}"
                  </p>
                )}
              </div>
              <button onClick={() => setCardModalState(null)} className="btn btn-ghost btn-sm" style={{ padding: 4 }}>
                <X size={18} />
              </button>
            </div>

            {/* Body */}
            <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 18 }}>
              {cardModalState.error && (
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  fontSize: 12,
                  color: 'var(--danger)',
                  background: 'var(--danger-bg)',
                  padding: '8px 12px',
                  borderRadius: 'var(--radius-sm)',
                }}>
                  <AlertCircle size={15} />
                  <span>{cardModalState.error}</span>
                </div>
              )}

              {/* Select saved card option */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)' }}>
                  Оберіть збережену картку або рахунок:
                </label>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {cardAccounts.map((acc) => (
                    <label
                      key={acc.id}
                      style={{
                        padding: '10px 14px',
                        borderRadius: 'var(--radius-sm)',
                        border: `1.5px solid ${cardModalState.selectedAccountId === acc.id ? 'var(--primary)' : 'var(--border-default)'}`,
                        background: cardModalState.selectedAccountId === acc.id ? 'var(--primary-bg)' : 'var(--bg-surface)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        cursor: 'pointer',
                        transition: 'var(--transition)',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <input
                          type="radio"
                          name="targetAccount"
                          value={acc.id}
                          checked={cardModalState.selectedAccountId === acc.id}
                          onChange={() => setCardModalState(prev => prev ? { ...prev, selectedAccountId: acc.id, error: null } : null)}
                        />
                        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>
                          {acc.name}
                        </span>
                      </div>
                      <CardBadge last4={acc.cardLast4} color={acc.color} />
                    </label>
                  ))}

                  {/* Custom 4 digits option */}
                  <label
                    style={{
                      padding: '10px 14px',
                      borderRadius: 'var(--radius-sm)',
                      border: `1.5px solid ${cardModalState.selectedAccountId === 'custom' ? 'var(--primary)' : 'var(--border-default)'}`,
                      background: cardModalState.selectedAccountId === 'custom' ? 'var(--primary-bg)' : 'var(--bg-surface)',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 10,
                      cursor: 'pointer',
                      transition: 'var(--transition)',
                    }}
                  >
                    <input
                      type="radio"
                      name="targetAccount"
                      value="custom"
                      checked={cardModalState.selectedAccountId === 'custom'}
                      onChange={() => setCardModalState(prev => prev ? { ...prev, selectedAccountId: 'custom', error: null } : null)}
                    />
                    <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>
                      Вказати інші 4 цифри вручну
                    </span>
                  </label>

                  {/* None option */}
                  <label
                    style={{
                      padding: '10px 14px',
                      borderRadius: 'var(--radius-sm)',
                      border: `1.5px solid ${cardModalState.selectedAccountId === 'none' ? 'var(--primary)' : 'var(--border-default)'}`,
                      background: cardModalState.selectedAccountId === 'none' ? 'var(--primary-bg)' : 'var(--bg-surface)',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 10,
                      cursor: 'pointer',
                      transition: 'var(--transition)',
                    }}
                  >
                    <input
                      type="radio"
                      name="targetAccount"
                      value="none"
                      checked={cardModalState.selectedAccountId === 'none'}
                      onChange={() => setCardModalState(prev => prev ? { ...prev, selectedAccountId: 'none', error: null } : null)}
                    />
                    <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                      Без картки (Готівка / зняти прив'язку)
                    </span>
                  </label>
                </div>
              </div>

              {/* Masked Input when custom selected */}
              {cardModalState.selectedAccountId === 'custom' && (
                <div style={{
                  padding: 14,
                  borderRadius: 'var(--radius-sm)',
                  background: 'var(--bg-surface-hover)',
                  border: '1px solid var(--border-default)',
                  animation: 'fadeIn 0.2s ease',
                }}>
                  <CardNumberInput
                    value={cardModalState.customLast4}
                    onChange={(val) => setCardModalState(prev => prev ? { ...prev, customLast4: val, error: null } : null)}
                    autoFocus
                  />
                </div>
              )}

              {/* Apply to similar checkbox (only for single transaction) */}
              {cardModalState.targets.length === 1 && (
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: 'var(--text-secondary)', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={cardModalState.applyToSimilar}
                    onChange={(e) => setCardModalState(prev => prev ? { ...prev, applyToSimilar: e.target.checked } : null)}
                  />
                  <span>
                    Застосувати цю картку також до всіх однакових операцій з описом "{cardModalState.targets[0].description}"
                  </span>
                </label>
              )}
            </div>

            {/* Footer */}
            <div style={{
              padding: '16px 24px',
              borderTop: '1px solid var(--border-default)',
              display: 'flex',
              justifyContent: 'flex-end',
              gap: 10,
            }}>
              <button
                onClick={() => setCardModalState(null)}
                className="btn btn-secondary btn-sm"
              >
                Скасувати
              </button>
              <button
                onClick={handleSaveCardAssignment}
                className="btn btn-primary btn-sm"
              >
                <Check size={14} />
                <span>Зберегти прив'язку</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
