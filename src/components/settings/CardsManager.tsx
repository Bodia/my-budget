import React, { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { 
  CreditCard, 
  Plus, 
  Trash2, 
  Check, 
  Edit2, 
  X,
  AlertCircle
} from 'lucide-react';
import type { Account, CurrencyCode } from '../../types/finance';
import { db } from '../../db/database';
import { CardNumberInput } from '../cards/CardNumberInput';
import { CardBadge } from '../cards/CardBadge';
import { formatCardMask, isValidCardLast4 } from '../../utils/cardUtils';

const PRESET_COLORS = [
  { label: 'Синій', hex: '#1677ff' },
  { label: 'Чорний', hex: '#1e293b' },
  { label: 'Смарагдовий', hex: '#10b981' },
  { label: 'Фіолетовий', hex: '#8b5cf6' },
  { label: 'Бурштиновий', hex: '#f59e0b' },
  { label: 'Рожевий', hex: '#f43f5e' },
];

interface CardsManagerProps {
  onNotify?: (msg: string) => void;
}

export const CardsManager: React.FC<CardsManagerProps> = ({ onNotify }) => {
  const accounts = useLiveQuery(() => db.accounts.toArray(), []);
  
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Form fields
  const [cardName, setCardName] = useState('');
  const [cardLast4, setCardLast4] = useState('');
  const [currency, setCurrency] = useState<CurrencyCode>('UAH');
  const [selectedColor, setSelectedColor] = useState<string>('#1677ff');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const resetForm = () => {
    setCardName('');
    setCardLast4('');
    setCurrency('UAH');
    setSelectedColor('#1677ff');
    setErrorMessage(null);
    setIsAdding(false);
    setEditingId(null);
  };

  const handleStartEdit = (acc: Account) => {
    setEditingId(acc.id);
    setCardName(acc.name);
    setCardLast4(acc.cardLast4 || '');
    setCurrency(acc.currency || 'UAH');
    setSelectedColor(acc.color || '#1677ff');
    setIsAdding(true);
    setErrorMessage(null);
  };

  const handleSaveCard = async () => {
    const trimmedName = cardName.trim();
    if (!trimmedName) {
      setErrorMessage('Введіть назву картки');
      return;
    }

    const trimmedDigits = cardLast4.trim();
    if (trimmedDigits && !isValidCardLast4(trimmedDigits)) {
      setErrorMessage('Номер картки повинен містити рівно 4 останні цифри');
      return;
    }

    try {
      const masked = trimmedDigits ? formatCardMask(trimmedDigits) : undefined;
      const digits = trimmedDigits || undefined;

      if (editingId) {
        // Update existing
        await db.accounts.update(editingId, {
          name: trimmedName,
          cardLast4: digits,
          cardNumberMasked: masked,
          currency,
          color: selectedColor,
        });

        // Also update existing transactions that were linked to this account
        if (digits) {
          const matchingTxs = await db.transactions.where('accountId').equals(editingId).toArray();
          if (matchingTxs.length > 0) {
            await Promise.all(
              matchingTxs.map(tx => db.transactions.update(tx.id, {
                cardLast4: digits,
                cardNumberMasked: masked,
              }))
            );
          }
        }

        onNotify?.(`Картку "${trimmedName}" успішно оновлено`);
      } else {
        // Add new account/card
        const newId = `card_${Date.now()}`;
        await db.accounts.add({
          id: newId,
          name: trimmedName,
          type: 'bank_card',
          currency,
          cardLast4: digits,
          cardNumberMasked: masked,
          color: selectedColor,
        });
        onNotify?.(`Картку "${trimmedName}" успішно додано`);
      }

      resetForm();
    } catch (err: any) {
      setErrorMessage(err.message || 'Помилка при збереженні');
    }
  };

  const handleDeleteCard = async (acc: Account) => {
    if (window.confirm(`Видалити картку "${acc.name}"? Транзакції залишаться в системі.`)) {
      await db.accounts.delete(acc.id);
      onNotify?.(`Картку "${acc.name}" видалено`);
    }
  };

  const cardAccounts = (accounts || []).filter(a => a.type === 'bank_card');

  return (
    <div className="ant-card" style={{ padding: 24 }}>
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 16,
        flexWrap: 'wrap',
        gap: 12,
      }}>
        <div>
          <h3 style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-primary)', fontFamily: 'var(--font-display)' }}>
            Банківські картки та рахунки ({cardAccounts.length})
          </h3>
          <p style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
            Керуйте вашими картками з маскованими номерами (перші 12 цифр приховані зірочками)
          </p>
        </div>

        {!isAdding && (
          <button
            onClick={() => { resetForm(); setIsAdding(true); }}
            className="btn btn-primary btn-sm"
          >
            <Plus size={14} />
            <span>Додати картку</span>
          </button>
        )}
      </div>

      {/* Add / Edit Form */}
      {isAdding && (
        <div style={{
          marginBottom: 20,
          padding: 16,
          borderRadius: 'var(--radius-md)',
          background: 'var(--bg-surface-hover)',
          border: '1.5px solid var(--primary-border)',
          display: 'flex',
          flexDirection: 'column',
          gap: 16,
          animation: 'fadeIn 0.2s ease',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h4 style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>
              {editingId ? 'Редагувати картку' : 'Нова банківська картка'}
            </h4>
            <button onClick={resetForm} className="btn btn-ghost btn-sm" style={{ padding: 4 }}>
              <X size={16} />
            </button>
          </div>

          {errorMessage && (
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
              <span>{errorMessage}</span>
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 16 }}>
            {/* Card Name */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)' }}>
                Назва картки / банку
              </label>
              <input
                type="text"
                className="input"
                placeholder="напр. Monobank Чорна, Приват Gold"
                value={cardName}
                onChange={(e) => setCardName(e.target.value)}
                autoFocus
              />
            </div>

            {/* Masked Card Number Input */}
            <CardNumberInput
              value={cardLast4}
              onChange={setCardLast4}
            />
          </div>

          {/* Color & Currency Selection */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)' }}>Колір бейджа:</span>
              <div style={{ display: 'flex', gap: 6 }}>
                {PRESET_COLORS.map(c => (
                  <button
                    key={c.hex}
                    type="button"
                    title={c.label}
                    onClick={() => setSelectedColor(c.hex)}
                    style={{
                      width: 24,
                      height: 24,
                      borderRadius: '50%',
                      background: c.hex,
                      border: selectedColor === c.hex ? '2px solid var(--text-primary)' : '2px solid transparent',
                      cursor: 'pointer',
                      transform: selectedColor === c.hex ? 'scale(1.15)' : 'none',
                      transition: 'transform 0.15s ease',
                    }}
                  />
                ))}
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)' }}>Валюта:</span>
              <select
                className="select"
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
                style={{ width: 'auto', padding: '4px 10px', fontSize: 12 }}
              >
                <option value="UAH">UAH (₴)</option>
                <option value="USD">USD ($)</option>
                <option value="EUR">EUR (€)</option>
              </select>
            </div>

            {/* Form actions */}
            <div style={{ display: 'flex', gap: 8, marginLeft: 'auto' }}>
              <button onClick={resetForm} className="btn btn-secondary btn-sm">
                Скасувати
              </button>
              <button onClick={handleSaveCard} className="btn btn-primary btn-sm">
                <Check size={14} />
                <span>{editingId ? 'Зберегти зміни' : 'Створити картку'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Cards List Grid */}
      {cardAccounts.length === 0 ? (
        <div style={{
          padding: 24,
          textAlign: 'center',
          color: 'var(--text-tertiary)',
          fontSize: 13,
          border: '1px dashed var(--border-default)',
          borderRadius: 'var(--radius-md)',
        }}>
          Немає доданих карток. Натисніть «Додати картку», щоб створити першу картку.
        </div>
      ) : (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
          gap: 14,
        }}>
          {cardAccounts.map((acc) => (
            <div
              key={acc.id}
              style={{
                padding: '14px 16px',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--border-default)',
                background: 'var(--bg-surface)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 12,
                boxShadow: 'var(--shadow-sm)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{
                  width: 36,
                  height: 36,
                  borderRadius: 'var(--radius-sm)',
                  background: acc.color || 'var(--primary)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#ffffff',
                  boxShadow: 'var(--shadow-sm)',
                  flexShrink: 0,
                }}>
                  <CreditCard size={18} />
                </div>
                <div>
                  <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--text-primary)' }}>
                    {acc.name}
                  </div>
                  <div style={{ marginTop: 2, display: 'flex', alignItems: 'center', gap: 6 }}>
                    {acc.cardLast4 ? (
                      <CardBadge last4={acc.cardLast4} color={acc.color} />
                    ) : (
                      <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>Номер не вказано</span>
                    )}
                    <span className="badge badge-secondary" style={{ fontSize: 10 }}>
                      {acc.currency}
                    </span>
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <button
                  onClick={() => handleStartEdit(acc)}
                  className="btn btn-ghost btn-sm"
                  title="Редагувати картку"
                  style={{ padding: 6, color: 'var(--text-secondary)' }}
                >
                  <Edit2 size={14} />
                </button>
                <button
                  onClick={() => handleDeleteCard(acc)}
                  className="btn btn-ghost btn-sm"
                  title="Видалити картку"
                  style={{ padding: 6, color: 'var(--danger)' }}
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
