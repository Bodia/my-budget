import React, { useState, useRef } from 'react';
import { 
  X, 
  UploadCloud, 
  CheckCircle2, 
  AlertCircle, 
  ArrowRight, 
  Loader2,
  Info
} from 'lucide-react';
import type { ImportSummary } from '../../types/finance';
import { processStatementFile, commitImport } from '../../services/parsers/ingestionManager';
import { formatUah } from '../../services/analytics/kpiCalculator';

interface ImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (count: number, replacedDemoCount: number) => void;
}

export const ImportModal: React.FC<ImportModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [summary, setSummary] = useState<ImportSummary | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleFile = async (file: File) => {
    setIsProcessing(true);
    setErrorMessage(null);
    try {
      const res = await processStatementFile(file);
      setSummary(res);
    } catch (err: any) {
      setErrorMessage(err.message || 'Помилка при читанні файлу. Перевірте формат виписки.');
    } finally {
      setIsProcessing(false);
    }
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
    const res = await commitImport(summary.draftTransactions);
    onSuccess(res.importedCount, res.replacedDemoCount);
    onClose();
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 640 }}>
        {/* Modal Header */}
        <div style={{
          padding: '20px 24px',
          borderBottom: '1px solid var(--border-default)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}>
          <div>
            <h3 style={{ fontSize: 18, fontWeight: 700, fontFamily: 'var(--font-display)', color: 'var(--text-primary)' }}>
              Імпорт банківської виписки
            </h3>
            <p style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
              Підтримуються вигрузки Monobank (XLSX, CSV) та Toshl Finance
            </p>
          </div>
          <button onClick={onClose} className="btn btn-ghost btn-sm" style={{ padding: 4 }}>
            <X size={18} />
          </button>
        </div>

        {/* Modal Body */}
        <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 20 }}>
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
                  .XLSX, .XLS або .CSV (Monobank, Toshl тощо)
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
                gridTemplateColumns: 'repeat(3, 1fr)',
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
              </div>

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 13 }}>
                <span style={{ color: 'var(--text-secondary)' }}>Визначений формат:</span>
                <span className="badge badge-primary" style={{ textTransform: 'capitalize' }}>
                  {summary.detectedSource === 'monobank' ? 'Виписка Monobank' : summary.detectedSource === 'toshl' ? 'Toshl Finance' : 'Універсальний'}
                </span>
              </div>

              {/* Demo Data Replacement Alert */}
              {summary.hasDemoDataToReplace && (
                <div style={{
                  padding: '12px 16px',
                  borderRadius: 'var(--radius-sm)',
                  background: 'rgba(22, 119, 255, 0.08)',
                  border: '1px solid rgba(22, 119, 255, 0.3)',
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: 12,
                }}>
                  <Info size={18} color="var(--primary)" style={{ marginTop: 2, flexShrink: 0 }} />
                  <div style={{ fontSize: 12, color: 'var(--text-primary)', lineHeight: 1.5 }}>
                    <div style={{ fontWeight: 600, color: 'var(--primary)', marginBottom: 2 }}>
                      Автоматична заміна демо-даних
                    </div>
                    У базі виявлено <strong>{summary.demoRowsCount} тестових операцій</strong>. При імпорті їх буде <strong>повністю видалено</strong>, а замість них збережуться ваші реальні дані з файлу.
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
        <div style={{
          padding: '16px 24px',
          borderTop: '1px solid var(--border-default)',
          background: 'var(--bg-surface)',
          display: 'flex',
          justifyContent: 'flex-end',
          gap: 10,
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
              <span>
                {summary.hasDemoDataToReplace
                  ? `Замінити демо на реальні (${summary.newRows} оп.)`
                  : `Застосувати (${summary.newRows} операцій)`}
              </span>
              <ArrowRight size={14} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
