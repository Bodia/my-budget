import React, { useState, useRef } from 'react';
import { 
  X, 
  UploadCloud, 
  CheckCircle2, 
  AlertCircle, 
  ArrowRight, 
  Loader2,
  CreditCard,
  Sparkles
} from 'lucide-react';
import type { ImportSummary, Account, UnresolvedDateRow } from '../../types/finance';
import { processStatementFile, commitImport } from '../../services/parsers/ingestionManager';
import { parseAndValidateToshlDate, createTransactionFromResolvedDate } from '../../services/parsers/toshlAdapter';
import { formatUah } from '../../services/analytics/kpiCalculator';
import { CardBadge } from '../cards/CardBadge';

interface ImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (count: number, accountsCount?: number) => void;
}

export const ImportModal: React.FC<ImportModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [summary, setSummary] = useState<ImportSummary | null>(null);
  const [editableNewAccounts, setEditableNewAccounts] = useState<Account[]>([]);
  const [unresolvedRows, setUnresolvedRows] = useState<UnresolvedDateRow[]>([]);
  const [resolvedDates, setResolvedDates] = useState<Record<number, string>>({});
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleFile = async (file: File) => {
    setIsProcessing(true);
    setErrorMessage(null);
    try {
      const res = await processStatementFile(file);
      setSummary(res);
      setEditableNewAccounts(res.newAccounts || []);
      setUnresolvedRows(res.unresolvedRows || []);
      setResolvedDates({});
    } catch (err: any) {
      setErrorMessage(err.message || 'Помилка при читанні файлу. Перевірте формат виписки.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleApplyResolvedDate = async (row: UnresolvedDateRow, dateInput: string) => {
    const check = parseAndValidateToshlDate(dateInput);
    if (!check.isValid || !check.isoDate) {
      alert(`Некоректна дата "${dateInput}". Вкажіть дійсний день календаря у форматі ДД.ММ.РРРР (наприклад: 24.08.2024)`);
      return;
    }
    const tx = await createTransactionFromResolvedDate(row, check.isoDate);
    setSummary(prev => {
      if (!prev) return prev;
      const updatedDrafts = [tx, ...prev.draftTransactions];
      return {
        ...prev,
        draftTransactions: updatedDrafts,
        newRows: updatedDrafts.length,
        previewRows: updatedDrafts.slice(0, 8),
      };
    });
    setUnresolvedRows(prev => prev.filter(r => r.rowIndex !== row.rowIndex));
  };

  const handleDismissUnresolvedRow = (rowIndex: number) => {
    setUnresolvedRows(prev => prev.filter(r => r.rowIndex !== rowIndex));
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFile(e.dataTransfer.files[0]);
    }
  };

  const handleConfirm = async () => {
    if (!summary || summary.newRows === 0) {
      onClose();
      return;
    }
    const finalNewAccounts = editableNewAccounts;
    const nameMap = new Map(finalNewAccounts.map(a => [a.id, a.name]));
    const finalTransactions = summary.draftTransactions.map(tx => {
      if (nameMap.has(tx.accountId)) {
        return { ...tx, accountName: nameMap.get(tx.accountId) };
      }
      return tx;
    });

    const count = await commitImport(finalTransactions, finalNewAccounts);
    onSuccess(count, finalNewAccounts.length);
    onClose();
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 640 }}>
        {/* Modal Header */}
        <div className="modal-header" style={{
          padding: '20px 24px',
          borderBottom: '1px solid var(--border-default)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexShrink: 0,
        }}>
          <div>
            <h3 style={{ fontSize: 18, fontWeight: 700, fontFamily: 'var(--font-display)', color: 'var(--text-primary)' }}>
              Імпорт виписки
            </h3>
            <p style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
              Підтримується імпорт виписок Toshl Finance (CSV, XLSX)
            </p>
          </div>
          <button onClick={onClose} className="btn btn-ghost btn-sm" style={{ padding: 4 }}>
            <X size={18} />
          </button>
        </div>

        {/* Modal Body */}
        <div className="modal-body" style={{
          padding: 24,
          display: 'flex',
          flexDirection: 'column',
          gap: 20,
          flex: '1 1 auto',
          minHeight: 0,
          overflowY: 'auto',
        }}>
          {!summary ? (
            <>
              {/* Dropzone */}
              <div
                onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={onDrop}
                onClick={() => fileInputRef.current?.click()}
                style={{
                  border: `2px dashed ${isDragging ? 'var(--primary)' : 'var(--border-default)'}`,
                  borderRadius: 'var(--radius-md)',
                  padding: '40px 20px',
                  textAlign: 'center',
                  background: isDragging ? 'var(--primary-bg)' : 'var(--bg-surface-hover)',
                  cursor: 'pointer',
                  transition: 'var(--transition)',
                }}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  style={{ display: 'none' }}
                  onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
                />
                <div style={{
                  width: 54,
                  height: 54,
                  borderRadius: '50%',
                  background: 'var(--bg-surface)',
                  color: 'var(--primary)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  margin: '0 auto 16px',
                  boxShadow: 'var(--shadow-sm)',
                }}>
                  {isProcessing ? <Loader2 size={26} className="spin" /> : <UploadCloud size={26} />}
                </div>

                <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 6 }}>
                  {isProcessing ? 'Обробка та дедуплікація файлу...' : 'Перетягніть файл сюди або натисніть для вибору'}
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                  Файли експорту Toshl Finance (.CSV або .XLSX)
                </div>
              </div>

              {/* Privacy Shield Note */}
              <div style={{
                padding: '12px 16px',
                borderRadius: 'var(--radius-sm)',
                background: 'var(--success-bg)',
                border: '1px solid var(--success-border)',
                fontSize: 12,
                color: 'var(--success)',
                display: 'flex',
                alignItems: 'center',
                gap: 8,
              }}>
                <CheckCircle2 size={16} />
                <span>
                  <strong>100% приватність:</strong> файл парситься виключно локально у вашому браузері.
                </span>
              </div>

              {errorMessage && (
                <div style={{
                  padding: '12px 16px',
                  borderRadius: 'var(--radius-sm)',
                  background: 'var(--danger-bg)',
                  border: '1px solid var(--danger-border)',
                  fontSize: 13,
                  color: 'var(--danger)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                }}>
                  <AlertCircle size={16} />
                  <span>{errorMessage}</span>
                </div>
              )}
            </>
          ) : (
            /* Pre-import Summary Report */
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div style={{
                display: 'grid',
                gridTemplateColumns: unresolvedRows.length > 0 ? 'repeat(4, 1fr)' : 'repeat(3, 1fr)',
                gap: 12,
              }}>
                <div style={{ padding: 14, background: 'var(--bg-surface-hover)', borderRadius: 'var(--radius-sm)', textAlign: 'center' }}>
                  <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>Всього в файлі</div>
                  <div className="tabular-nums" style={{ fontSize: 22, fontWeight: 700, color: 'var(--text-primary)' }}>
                    {summary.totalRows}
                  </div>
                </div>

                <div style={{ padding: 14, background: 'var(--success-bg)', border: '1px solid var(--success-border)', borderRadius: 'var(--radius-sm)', textAlign: 'center' }}>
                  <div style={{ fontSize: 11, color: 'var(--success)' }}>Нових для запису</div>
                  <div className="tabular-nums" style={{ fontSize: 22, fontWeight: 700, color: 'var(--success)' }}>
                    {summary.newRows}
                  </div>
                </div>

                <div style={{ padding: 14, background: 'var(--warning-bg)', border: '1px solid var(--warning-border)', borderRadius: 'var(--radius-sm)', textAlign: 'center' }}>
                  <div style={{ fontSize: 11, color: 'var(--warning)' }}>Дублікати (пропущено)</div>
                  <div className="tabular-nums" style={{ fontSize: 22, fontWeight: 700, color: 'var(--warning)' }}>
                    {summary.duplicateRows}
                  </div>
                </div>

                {unresolvedRows.length > 0 && (
                  <div style={{ padding: 14, background: 'rgba(239, 68, 68, 0.08)', border: '1px solid rgba(239, 68, 68, 0.25)', borderRadius: 'var(--radius-sm)', textAlign: 'center' }}>
                    <div style={{ fontSize: 11, color: 'var(--danger)' }}>Потребують дати</div>
                    <div className="tabular-nums" style={{ fontSize: 22, fontWeight: 700, color: 'var(--danger)' }}>
                      {unresolvedRows.length}
                    </div>
                  </div>
                )}
              </div>

              {/* Unresolved Rows with Missing or Invalid Date (SCRUM-19) */}
              {unresolvedRows.length > 0 && (
                <div style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 10,
                  padding: 14,
                  background: 'rgba(245, 158, 11, 0.06)',
                  borderRadius: 'var(--radius-sm)',
                  border: '1.5px solid rgba(245, 158, 11, 0.35)',
                }}>
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    flexWrap: 'wrap',
                    gap: 6,
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>
                      <AlertCircle size={16} color="var(--warning)" />
                      <span>Рядки з пропущеною або пошкодженою датою ({unresolvedRows.length}):</span>
                    </div>
                    <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
                      Вкажіть дату (ДД.ММ.РРРР), щоб включити до імпорту
                    </span>
                  </div>

                  <div style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 8,
                    maxHeight: 200,
                    overflowY: 'auto',
                    paddingRight: 4,
                  }}>
                    {unresolvedRows.map((row) => (
                      <div
                        key={row.rowIndex}
                        style={{
                          padding: '10px 12px',
                          borderRadius: 'var(--radius-xs)',
                          background: 'var(--bg-surface)',
                          border: '1px solid var(--border-default)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          gap: 12,
                          flexWrap: 'wrap',
                        }}
                      >
                        <div style={{ flex: '1 1 200px', minWidth: 0 }}>
                          <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--text-primary)' }}>
                            {row.description}
                          </div>
                          <div style={{ fontSize: 11, color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginTop: 2 }}>
                            <span className="tabular-nums" style={{ fontWeight: 600, color: row.amount < 0 ? 'var(--danger)' : 'var(--success)' }}>
                              {formatUah(row.amount)}
                            </span>
                            <span>•</span>
                            <span style={{ color: 'var(--danger)' }}>
                              {row.rawDate ? `Значення: "${row.rawDate}" (${row.errorReason})` : 'Дата відсутня'}
                            </span>
                          </div>
                        </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <input
                        type="date"
                        value={resolvedDates[row.rowIndex] ?? ''}
                        onChange={(e) => setResolvedDates({ ...resolvedDates, [row.rowIndex]: e.target.value })}
                        className="input"
                        style={{
                          width: 135,
                          height: 32,
                          fontSize: 12,
                          padding: '3px 8px',
                          cursor: 'pointer',
                        }}
                        title="Оберіть дату через календар"
                      />
                      <button
                        type="button"
                        disabled={!resolvedDates[row.rowIndex]}
                        onClick={() => handleApplyResolvedDate(row, resolvedDates[row.rowIndex] || '')}
                        className="btn btn-primary btn-sm"
                        style={{ height: 32, padding: '0 10px', fontSize: 11, fontWeight: 600 }}
                      >
                        Додати
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDismissUnresolvedRow(row.rowIndex)}
                        className="btn btn-ghost btn-sm"
                        style={{ height: 32, padding: '0 6px', color: 'var(--text-tertiary)' }}
                        title="Пропустити цей рядок"
                      >
                        <X size={14} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

              {/* Source format badge hidden on UI for focused Toshl import flow; preserved in data layer */}

              {/* Detected Bank Cards / Accounts */}
              {summary.detectedAccounts && summary.detectedAccounts.length > 0 && (
                <div style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 10,
                  padding: 14,
                  background: 'var(--bg-surface-hover)',
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid var(--border-default)',
                }}>
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    fontSize: 12,
                    fontWeight: 600,
                    color: 'var(--text-secondary)',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <CreditCard size={15} style={{ color: 'var(--primary)' }} />
                      <span>Виявлені картки та рахунки ({summary.detectedAccounts.length}):</span>
                    </div>
                    {editableNewAccounts.length > 0 && (
                      <span style={{ fontSize: 11, color: 'var(--success)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4 }}>
                        <Sparkles size={13} />
                        <span>+{editableNewAccounts.length} нових буде збережено</span>
                      </span>
                    )}
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {summary.detectedAccounts.map((acc) => {
                      const isNew = editableNewAccounts.some(na => na.id === acc.id);
                      const currentAcc = editableNewAccounts.find(na => na.id === acc.id) || acc;

                      return (
                        <div
                          key={acc.id}
                          style={{
                            padding: '10px 12px',
                            borderRadius: 'var(--radius-sm)',
                            background: isNew ? 'var(--primary-bg)' : 'var(--bg-surface)',
                            border: isNew ? '1.5px solid var(--primary-border)' : '1px solid var(--border-subtle)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            gap: 12,
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, minWidth: 0 }}>
                            <div style={{
                              width: 30,
                              height: 30,
                              borderRadius: 'var(--radius-xs)',
                              background: currentAcc.color || 'var(--primary)',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              color: '#fff',
                              flexShrink: 0,
                              boxShadow: 'var(--shadow-sm)',
                            }}>
                              <CreditCard size={15} />
                            </div>

                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, minWidth: 0, flexWrap: 'wrap' }}>
                              {isNew ? (
                                <input
                                  type="text"
                                  value={currentAcc.name}
                                  onChange={(e) => {
                                    const updated = editableNewAccounts.map(na =>
                                      na.id === acc.id ? { ...na, name: e.target.value } : na
                                    );
                                    setEditableNewAccounts(updated);
                                  }}
                                  className="input"
                                  style={{
                                    padding: '3px 8px',
                                    fontSize: 12,
                                    fontWeight: 600,
                                    height: 28,
                                    maxWidth: 220,
                                  }}
                                  title="Назва картки з документа (можна змінити)"
                                />
                              ) : (
                                <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>
                                  {currentAcc.name}
                                </span>
                              )}

                              {currentAcc.cardLast4 ? (
                                <CardBadge last4={currentAcc.cardLast4} color={currentAcc.color} />
                              ) : null}

                              <span className="badge badge-secondary" style={{ fontSize: 10 }}>
                                {currentAcc.currency}
                              </span>
                            </div>
                          </div>

                          <div>
                            {isNew ? (
                              <span className="badge badge-primary" style={{ fontSize: 11, padding: '2px 8px' }}>
                                Нова картка (додасться)
                              </span>
                            ) : (
                              <span className="badge badge-secondary" style={{ fontSize: 11, padding: '2px 8px' }}>
                                Вже в системі
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Preview of first rows */}
              {summary.previewRows.length > 0 && (
                <div>
                  <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 8 }}>
                    Попередній перегляд (перші {summary.previewRows.length} операцій):
                  </div>
                  <div style={{
                    maxHeight: 180,
                    overflowY: 'auto',
                    border: '1px solid var(--border-default)',
                    borderRadius: 'var(--radius-sm)',
                    fontSize: 12,
                  }}>
                    {summary.previewRows.map((p, idx) => (
                      <div key={idx} style={{
                        padding: '8px 12px',
                        display: 'flex',
                        justifyContent: 'space-between',
                        borderBottom: '1px solid var(--border-subtle)',
                      }}>
                        <div>
                          <span style={{ color: 'var(--text-primary)', fontWeight: 500 }}>{p.description}</span>
                          <span style={{ color: 'var(--text-tertiary)', marginLeft: 8 }}>{p.date.slice(0, 10)}</span>
                        </div>
                        <span className="tabular-nums" style={{
                          fontWeight: 600,
                          color: p.amount < 0 ? 'var(--danger)' : 'var(--success)',
                        }}>
                          {formatUah(p.amount)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="modal-footer" style={{
          padding: '16px 24px',
          borderTop: '1px solid var(--border-default)',
          background: 'var(--bg-surface)',
          display: 'flex',
          justifyContent: 'flex-end',
          gap: 10,
          flexShrink: 0,
        }}>
          {summary && (
            <button
              onClick={() => setSummary(null)}
              className="btn btn-secondary btn-sm"
            >
              Обрати інший файл
            </button>
          )}
          <button onClick={onClose} className="btn btn-ghost btn-sm">
            Скасувати
          </button>
          {summary && (
            <button
              onClick={handleConfirm}
              disabled={summary.newRows === 0}
              className="btn btn-primary btn-sm"
            >
              <span>Застосувати ({summary.newRows} операцій)</span>
              <ArrowRight size={14} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
