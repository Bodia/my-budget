import React from 'react';
import { CreditCard } from 'lucide-react';
import { sanitizeCardLast4 } from '../../utils/cardUtils';

interface CardNumberInputProps {
  value: string; // The 4 digits
  onChange: (last4: string) => void;
  placeholder?: string;
  autoFocus?: boolean;
  disabled?: boolean;
}

export const CardNumberInput: React.FC<CardNumberInputProps> = ({
  value,
  onChange,
  placeholder = '1234',
  autoFocus = false,
  disabled = false,
}) => {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    // Extract only digits; if pasted full card number (e.g. 16 digits), take the last 4
    const cleanDigits = raw.replace(/\D/g, '');
    const last4 = sanitizeCardLast4(cleanDigits.length > 4 ? cleanDigits.slice(-4) : cleanDigits);
    onChange(last4);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)' }}>
        Номер картки (останні 4 цифри)
      </label>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        background: 'var(--bg-surface)',
        border: '1px solid var(--border-default)',
        borderRadius: 'var(--radius-md)',
        padding: '6px 12px',
        gap: 8,
        transition: 'var(--transition)',
        boxShadow: 'var(--shadow-sm)',
      }}>
        <CreditCard size={18} color="var(--primary)" style={{ flexShrink: 0 }} />
        
        {/* Protected 12 asterisks prefix */}
        <div style={{
          fontFamily: 'monospace',
          fontSize: 14,
          fontWeight: 600,
          letterSpacing: '2px',
          color: 'var(--text-tertiary)',
          userSelect: 'none',
          display: 'flex',
          alignItems: 'center',
          gap: 6,
        }}>
          <span>••••</span>
          <span>••••</span>
          <span>••••</span>
        </div>

        {/* 4 digits editable input */}
        <input
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          maxLength={4}
          value={value}
          onChange={handleChange}
          placeholder={placeholder}
          autoFocus={autoFocus}
          disabled={disabled}
          style={{
            width: 68,
            fontFamily: 'monospace',
            fontSize: 15,
            fontWeight: 700,
            letterSpacing: '2px',
            padding: '2px 6px',
            border: '1px solid var(--primary-border)',
            borderRadius: 'var(--radius-sm)',
            background: 'var(--primary-bg)',
            color: 'var(--primary)',
            outline: 'none',
            textAlign: 'center',
          }}
          title="Введіть 4 останні цифри картки"
        />
      </div>
      <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>
        Перші 12 цифр надійно захищені зірочками. Введіть лише останні 4 цифри.
      </span>
    </div>
  );
};
