import React, { useState, useEffect, useRef } from 'react';
import {
  Eye,
  EyeOff,
  CheckCircle2,
  AlertCircle,
  Loader2,
  ExternalLink,
  ShieldCheck,
  StopCircle,
} from 'lucide-react';
import { db } from '../../db/database';
import type { Transaction } from '../../types/finance';
import {
  saveEncryptedToken,
  loadDecryptedToken,
  hasStoredToken,
  clearStoredToken,
  isValidTokenFormat,
} from '../../services/monobank/security';
import {
  MonobankClient,
  type ClientInfoResult,
} from '../../services/monobank/monobankClient';
import {
  createTimeChunks,
  MonobankSyncEngine,
  type SyncProgressEvent,
} from '../../services/monobank/syncEngine';
import {
  convertMonobankApiItems,
  reconcileMonobankAccounts,
  persistMonobankSync,
} from '../../services/monobank/monobankApiAdapter';
import { deduplicateDrafts } from '../../services/parsers/deduplication';
import { formatUah } from '../../services/analytics/kpiCalculator';

interface MonobankSyncTabProps {
  onSuccess: (count: number, accountsCount?: number) => void;
  onClose: () => void;
}

export const MonobankSyncTab: React.FC<MonobankSyncTabProps> = ({
  onSuccess,
  onClose,
}) => {
  const [tokenStatus, setTokenStatus] = useState<'loading' | 'unconnected' | 'connected'>('loading');
  const [tokenInput, setTokenInput] = useState('');
  const [showToken, setShowToken] = useState(false);
  const [clientInfo, setClientInfo] = useState<ClientInfoResult | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Sync selection state
  const [selectedAccountId, setSelectedAccountId] = useState<string>('0');
  const [selectedPeriodDays, setSelectedPeriodDays] = useState<number>(30);

  // Active sync state
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncProgress, setSyncProgress] = useState<SyncProgressEvent | null>(null);
  const [syncSummary, setSyncSummary] = useState<{
    newCount: number;
    duplicateCount: number;
    previewRows: Transaction[];
  } | null>(null);

  const syncEngineRef = useRef<MonobankSyncEngine | null>(null);

  // On mount: check stored token and verify
  useEffect(() => {
    let isMounted = true;

    async function init() {
      if (!hasStoredToken()) {
        if (isMounted) setTokenStatus('unconnected');
        return;
      }

      try {
        const decrypted = await loadDecryptedToken();
        if (!decrypted) {
          if (isMounted) setTokenStatus('unconnected');
          return;
        }

        const client = new MonobankClient();
        const info = await client.fetchClientInfo(decrypted);

        if (isMounted) {
          setClientInfo(info);
          setTokenStatus('connected');
          if (info.accounts.length > 0) {
            setSelectedAccountId(info.accounts[0].id);
          }
        }
      } catch (err: any) {
        console.error('Failed to init Monobank client:', err);
        if (isMounted) {
          setErrorMessage(err.message || 'Не вдалося підключитися за збереженим токеном.');
          setTokenStatus('unconnected');
        }
      }
    }

    init();
    return () => {
      isMounted = false;
    };
  }, []);

  const handleConnectToken = async () => {
    const trimmed = tokenInput.trim();
    if (!isValidTokenFormat(trimmed)) {
      setErrorMessage('Введіть коректний токен Monobank API (довжина від 20 символів без пробілів).');
      return;
    }

    setIsVerifying(true);
    setErrorMessage(null);

    try {
      const client = new MonobankClient();
      const info = await client.fetchClientInfo(trimmed);
      await saveEncryptedToken(trimmed);

      setClientInfo(info);
      setTokenStatus('connected');
      setTokenInput('');
      if (info.accounts.length > 0) {
        setSelectedAccountId(info.accounts[0].id);
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Помилка валідації токена. Перевірте правильність на api.monobank.ua.');
    } finally {
      setIsVerifying(false);
    }
  };

  const handleDisconnectToken = () => {
    clearStoredToken();
    setClientInfo(null);
    setTokenStatus('unconnected');
    setSyncSummary(null);
  };

  const handleStartSync = async () => {
    const decrypted = await loadDecryptedToken();
    if (!decrypted || !clientInfo) {
      setTokenStatus('unconnected');
      return;
    }

    setIsSyncing(true);
    setErrorMessage(null);
    setSyncSummary(null);

    const client = new MonobankClient();
    const engine = new MonobankSyncEngine({ cooldownSeconds: 60 });
    syncEngineRef.current = engine;

    const now = new Date();
    const startDate = new Date(now.getTime() - selectedPeriodDays * 24 * 60 * 60 * 1000);
    const chunks = createTimeChunks(startDate, now, 30);

    // Accounts to sync
    const targetApiAccounts = selectedAccountId === 'all'
      ? clientInfo.accounts
      : clientInfo.accounts.filter((a: any) => a.id === selectedAccountId);

    const existingAccounts = await db.accounts.toArray();
    const existingTransactions = await db.transactions.toArray();
    const existingHashes = new Set<string>(existingTransactions.map(t => t.hash));

    let allNewTransactions: Transaction[] = [];
    let totalDuplicates = 0;

    try {
      for (const apiAcc of targetApiAccounts) {
        const syncResult = await engine.startSync({
          token: decrypted,
          accountId: apiAcc.id,
          chunks,
          client,
          onProgress: (p: SyncProgressEvent) => setSyncProgress(p),
        });

        // Reconcile and find local account representation
        const { updatedExisting, newAccounts } = reconcileMonobankAccounts(
          [apiAcc],
          existingAccounts
        );
        const resolvedAccount = updatedExisting[0] || newAccounts[0] || {
          id: `mono_${apiAcc.id}`,
          name: 'Monobank',
          type: 'bank_card',
          currency: 'UAH',
        };

        const converted = await convertMonobankApiItems(syncResult.items, resolvedAccount);
        const { unique, duplicatesCount } = deduplicateDrafts(converted, existingHashes);

        allNewTransactions = allNewTransactions.concat(unique);
        totalDuplicates += duplicatesCount;
        unique.forEach((u: Transaction) => existingHashes.add(u.hash));
      }

      // Reconcile all accounts and update balances in DB
      const { updatedExisting, newAccounts } = reconcileMonobankAccounts(
        clientInfo.accounts,
        existingAccounts
      );

      await persistMonobankSync(allNewTransactions, updatedExisting, newAccounts);

      setSyncSummary({
        newCount: allNewTransactions.length,
        duplicateCount: totalDuplicates,
        previewRows: allNewTransactions.slice(0, 8),
      });

      onSuccess(allNewTransactions.length, newAccounts.length);
    } catch (err: any) {
      setErrorMessage(err.message || 'Помилка під час синхронізації');
    } finally {
      setIsSyncing(false);
      setSyncProgress(null);
    }
  };

  const handleStopSync = () => {
    if (syncEngineRef.current) {
      syncEngineRef.current.stop();
    }
  };

  if (tokenStatus === 'loading') {
    return (
      <div style={{ padding: 48, textAlign: 'center', color: 'var(--text-secondary)' }}>
        <Loader2 size={32} className="spin" style={{ margin: '0 auto 12px auto' }} />
        <div>Перевірка підключення Monobank API...</div>
      </div>
    );
  }

  // SCREEN 1: UNCONNECTED / FIRST ENTRY
  if (tokenStatus === 'unconnected') {
    return (
      <div style={{ padding: '24px' }}>
        <div style={{ textAlign: 'center', marginBottom: 20 }}>
          <div style={{
            width: 52,
            height: 52,
            borderRadius: 14,
            background: 'linear-gradient(135deg, #18181b, #09090b)',
            color: 'white',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 24,
            fontWeight: 800,
            margin: '0 auto 12px auto',
            boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
          }}>
            M
          </div>
          <h4 style={{ fontSize: 17, fontWeight: 700, fontFamily: 'var(--font-display)', color: 'var(--text-primary)', marginBottom: 6 }}>
            Пряме підключення Monobank Personal API
          </h4>
          <p style={{ fontSize: 12, color: 'var(--text-secondary)', maxWidth: 460, margin: '0 auto', lineHeight: 1.5 }}>
            Автоматичне вивантаження операцій та оновлення балансів карток.
            Токен шифрується локально алгоритмом <strong>AES-GCM (256-bit)</strong> і ніколи не передається третім особам.
          </p>
        </div>

        {/* Step-by-step instructions */}
        <div style={{
          background: 'var(--bg-primary)',
          borderRadius: 10,
          border: '1px solid var(--border-default)',
          padding: '14px 18px',
          marginBottom: 20,
          fontSize: 12,
        }}>
          <div style={{ fontWeight: 600, color: 'var(--text-primary)', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
            <ShieldCheck size={16} color="#34c759" /> Як отримати персональний токен:
          </div>
          <ol style={{ paddingLeft: 20, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
            <li>
              Перейдіть на офіційний сайт банку:{' '}
              <a
                href="https://api.monobank.ua/"
                target="_blank"
                rel="noreferrer"
                style={{ color: 'var(--accent)', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 4 }}
              >
                api.monobank.ua <ExternalLink size={12} />
              </a>
            </li>
            <li>Відскануйте QR-код додатком Monobank та підтвердьте авторизацію</li>
            <li>Скопіюйте згенерований токен та вставте його у поле нижче</li>
          </ol>
        </div>

        {/* Input */}
        <div style={{ marginBottom: 20 }}>
          <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 6 }}>
            ПЕРСОНАЛЬНИЙ ТОКЕН MONOBANK (X-Token):
          </label>
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              type={showToken ? 'text' : 'password'}
              value={tokenInput}
              onChange={(e) => setTokenInput(e.target.value)}
              placeholder="Вставте ваш токен (u2_...)"
              style={{
                flex: 1,
                padding: '10px 14px',
                borderRadius: 8,
                border: '1px solid var(--border-default)',
                background: 'var(--bg-primary)',
                color: 'var(--text-primary)',
                fontFamily: 'monospace',
                fontSize: 13,
              }}
            />
            <button
              type="button"
              onClick={() => setShowToken(!showToken)}
              className="btn btn-outline"
              style={{ padding: '0 12px' }}
            >
              {showToken ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
        </div>

        {errorMessage && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '10px 14px',
            background: 'rgba(255, 59, 48, 0.08)',
            border: '1px solid rgba(255, 59, 48, 0.3)',
            borderRadius: 8,
            color: 'var(--error)',
            fontSize: 12,
            marginBottom: 20,
          }}>
            <AlertCircle size={16} style={{ flexShrink: 0 }} />
            <span>{errorMessage}</span>
          </div>
        )}

        <button
          type="button"
          onClick={handleConnectToken}
          disabled={isVerifying || !tokenInput.trim()}
          className="btn btn-primary"
          style={{ width: '100%', padding: '12px', fontSize: 14, fontWeight: 700 }}
        >
          {isVerifying ? (
            <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
              <Loader2 size={16} className="spin" /> Перевірка токена в Monobank API...
            </span>
          ) : (
            '🔒 Зашифрувати, перевірити та підключити'
          )}
        </button>
      </div>
    );
  }

  // SCREEN 2: ACTIVE SYNC IN PROGRESS
  if (isSyncing && syncProgress) {
    const isCooldown = syncProgress.state === 'cooldown';
    const progressPercent = Math.round((syncProgress.currentChunkIndex / syncProgress.totalChunks) * 100);

    return (
      <div style={{ padding: '32px 24px', textAlign: 'center' }}>
        <h4 style={{ fontSize: 18, fontWeight: 700, fontFamily: 'var(--font-display)', marginBottom: 6 }}>
          {isCooldown ? '⏳ Очікування ліміту банку (Rate Limit)' : '⚡ Завантаження виписки з Monobank...'}
        </h4>
        <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 24 }}>
          {isCooldown
            ? `Чанк ${syncProgress.currentChunkIndex} з ${syncProgress.totalChunks} отримано. Очікування між запитами: ${syncProgress.secondsRemaining} с`
            : `Отримання операцій: Чанк ${syncProgress.currentChunkIndex} з ${syncProgress.totalChunks}`}
        </p>

        {/* Circular Countdown Timer */}
        {isCooldown ? (
          <div style={{
            width: 110,
            height: 110,
            borderRadius: '50%',
            border: '6px solid var(--accent)',
            margin: '0 auto 24px auto',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'var(--selected-bg)',
          }}>
            <div style={{ fontSize: 30, fontWeight: 800, color: 'var(--accent)' }}>
              {syncProgress.secondsRemaining}s
            </div>
            <div style={{ fontSize: 10, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>
              кулдаун
            </div>
          </div>
        ) : (
          <div style={{ margin: '20px 0' }}>
            <Loader2 size={48} className="spin" style={{ color: 'var(--accent)', margin: '0 auto' }} />
          </div>
        )}

        {/* Progress bar */}
        <div style={{
          background: 'var(--bg-tertiary)',
          height: 8,
          borderRadius: 4,
          overflow: 'hidden',
          maxWidth: 440,
          margin: '0 auto 12px auto',
        }}>
          <div style={{
            background: 'var(--accent)',
            width: `${progressPercent}%`,
            height: '100%',
            transition: 'width 0.4s ease',
          }} />
        </div>
        <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 24 }}>
          Прогрес: {progressPercent}% (отримано {syncProgress.totalItemsFetched} транзакцій)
        </div>

        <button
          type="button"
          onClick={handleStopSync}
          className="btn btn-outline"
          style={{ borderColor: 'var(--error)', color: 'var(--error)', padding: '8px 20px', fontSize: 13 }}
        >
          <StopCircle size={15} style={{ marginRight: 6 }} />
          Зупинити та зберегти завантажене
        </button>
      </div>
    );
  }

  // SCREEN 3: CONNECTED & READY TO SYNC
  return (
    <div style={{ padding: '24px' }}>
      {/* Client Connected Badge */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '12px 16px',
        background: 'rgba(52, 199, 89, 0.08)',
        border: '1px solid rgba(52, 199, 89, 0.25)',
        borderRadius: 10,
        marginBottom: 20,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <CheckCircle2 size={20} color="#34c759" />
          <div>
            <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--text-primary)' }}>
              Підключено: {clientInfo?.name}
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
              Токен захищено AES-GCM (256-bit) • Рахунків знайдено: {clientInfo?.accounts.length || 0}
            </div>
          </div>
        </div>
        <button
          type="button"
          onClick={handleDisconnectToken}
          className="btn btn-ghost btn-sm"
          style={{ fontSize: 11, color: 'var(--text-tertiary)' }}
        >
          Відключити
        </button>
      </div>

      {/* Account Selection */}
      <div style={{ marginBottom: 18 }}>
        <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 8, letterSpacing: '0.04em' }}>
          ОБЕРІТЬ РАХУНОК ДЛЯ СИНХРОНІЗАЦІЇ:
        </label>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 10 }}>
          <div
            onClick={() => setSelectedAccountId('all')}
            style={{
              padding: '12px',
              borderRadius: 8,
              border: selectedAccountId === 'all' ? '2px solid var(--accent)' : '1px solid var(--border-default)',
              background: selectedAccountId === 'all' ? 'var(--selected-bg)' : 'var(--bg-primary)',
              cursor: 'pointer',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontWeight: 700, fontSize: 13, color: 'var(--text-primary)' }}>Усі рахунки</span>
              {selectedAccountId === 'all' && <span style={{ fontSize: 10, color: 'var(--accent)', fontWeight: 'bold' }}>● ОБРАНО</span>}
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 4 }}>
              Синхронізувати всі {clientInfo?.accounts.length} картки
            </div>
          </div>

          {clientInfo?.accounts.map((acc: any) => {
            const isSelected = selectedAccountId === acc.id;
            const last4 = acc.maskedPan && acc.maskedPan[0] ? acc.maskedPan[0].slice(-4) : '';
            return (
              <div
                key={acc.id}
                onClick={() => setSelectedAccountId(acc.id)}
                style={{
                  padding: '12px',
                  borderRadius: 8,
                  border: isSelected ? '2px solid var(--accent)' : '1px solid var(--border-default)',
                  background: isSelected ? 'var(--selected-bg)' : 'var(--bg-primary)',
                  cursor: 'pointer',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontWeight: 700, fontSize: 13, color: 'var(--text-primary)' }}>
                    {acc.type === 'black' ? 'Чорна картка' : acc.type === 'white' ? 'Біла картка' : acc.type === 'fop' ? 'ФОП' : acc.type.toUpperCase()}
                  </span>
                  {isSelected && <span style={{ fontSize: 10, color: 'var(--accent)', fontWeight: 'bold' }}>● ОБРАНО</span>}
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 2 }}>
                  {last4 ? `•••• ${last4}` : 'IBAN'}
                </div>
                <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', marginTop: 4 }}>
                  {formatUah(acc.balance)} ₴
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Period Selection */}
      <div style={{ marginBottom: 20 }}>
        <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 8, letterSpacing: '0.04em' }}>
          ПЕРІОД ВИПИСКИ:
        </label>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
          {[
            { days: 30, title: '30 днів', sub: 'Миттєво (1 req)' },
            { days: 90, title: '3 місяці', sub: '~2 хв (3 req)' },
            { days: 180, title: '6 місяців', sub: '~5 хв (6 req)' },
            { days: 365, title: '1 рік', sub: '~11 хв (12 req)' },
          ].map(p => {
            const isSelected = selectedPeriodDays === p.days;
            return (
              <div
                key={p.days}
                onClick={() => setSelectedPeriodDays(p.days)}
                style={{
                  border: isSelected ? '2px solid var(--accent)' : '1px solid var(--border-default)',
                  background: isSelected ? 'var(--selected-bg)' : 'var(--bg-primary)',
                  borderRadius: 8,
                  padding: '10px 8px',
                  textAlign: 'center',
                  cursor: 'pointer',
                }}
              >
                <div style={{ fontWeight: 700, fontSize: 13, color: isSelected ? 'var(--accent)' : 'var(--text-primary)' }}>
                  {p.title}
                </div>
                <div style={{ fontSize: 10, color: isSelected ? 'var(--accent)' : 'var(--text-secondary)', marginTop: 2 }}>
                  {p.sub}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Rate limit advisory */}
      <div style={{
        fontSize: 12,
        color: 'var(--text-secondary)',
        background: 'var(--bg-primary)',
        padding: '12px 14px',
        borderRadius: 8,
        border: '1px solid var(--border-default)',
        marginBottom: 20,
        lineHeight: 1.5,
      }}>
        ℹ️ <strong>Ліміти Monobank:</strong> 1 запит на 60 секунд. Якщо вибрано понад 30 днів, синхронізатор витримає автоматичну паузу. Повторні операції будуть дедупліковані.
      </div>

      {errorMessage && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '10px 14px',
          background: 'rgba(255, 59, 48, 0.08)',
          border: '1px solid rgba(255, 59, 48, 0.3)',
          borderRadius: 8,
          color: 'var(--error)',
          fontSize: 12,
          marginBottom: 20,
        }}>
          <AlertCircle size={16} />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Start Sync Button */}
      <button
        type="button"
        onClick={handleStartSync}
        className="btn btn-primary"
        style={{ width: '100%', padding: '12px', fontSize: 14, fontWeight: 700 }}
      >
        🚀 Запустити синхронізацію Monobank
      </button>

      {/* Completed Summary View */}
      {syncSummary && (
        <div style={{
          marginTop: 20,
          padding: 16,
          background: 'rgba(52, 199, 89, 0.08)',
          border: '1px solid rgba(52, 199, 89, 0.25)',
          borderRadius: 10,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#34c759', fontWeight: 700, marginBottom: 8 }}>
            <CheckCircle2 size={18} />
            Синхронізація успішно завершена!
          </div>
          <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 12 }}>
            Додано <strong>{syncSummary.newCount}</strong> нових операцій (пропущено {syncSummary.duplicateCount} дублікатів). Баланси карток оновлено.
          </div>
          <button
            type="button"
            onClick={onClose}
            className="btn btn-primary btn-sm"
            style={{ width: '100%' }}
          >
            Готово / Закрити
          </button>
        </div>
      )}
    </div>
  );
};
