import React from 'react';
import { CreditCard } from 'lucide-react';
import { formatCardCompact } from '../../utils/cardUtils';

interface CardBadgeProps {
  last4?: string;
  name?: string;
  color?: string;
  showName?: boolean;
  size?: 'sm' | 'md';
}

export const CardBadge: React.FC<CardBadgeProps> = ({
  last4,
  name,
  color,
  showName = false,
  size = 'sm',
}) => {
  if (!last4) {
    return (
      <span style={{
        fontSize: size === 'sm' ? 11 : 12,
        color: 'var(--text-tertiary)',
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
      }}>
        <CreditCard size={size === 'sm' ? 12 : 14} />
        <span>—</span>
      </span>
    );
  }

  const badgeColor = color || 'var(--primary)';
  const formatted = formatCardCompact(last4);

  return (
    <span
      title={name ? `${name} (${formatted})` : formatted}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        padding: size === 'sm' ? '2px 8px' : '4px 10px',
        borderRadius: 'var(--radius-sm)',
        background: 'var(--bg-surface-hover)',
        border: '1px solid var(--border-default)',
        fontSize: size === 'sm' ? 12 : 13,
        fontWeight: 600,
        fontFamily: 'monospace',
        color: 'var(--text-primary)',
        whiteSpace: 'nowrap',
        boxShadow: 'var(--shadow-sm)',
      }}
    >
      <span style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: size === 'sm' ? 16 : 20,
        height: size === 'sm' ? 16 : 20,
        borderRadius: 4,
        background: badgeColor,
        color: '#ffffff',
      }}>
        <CreditCard size={size === 'sm' ? 10 : 12} />
      </span>
      {showName && name && (
        <span style={{
          fontFamily: 'var(--font-sans)',
          fontWeight: 500,
          color: 'var(--text-secondary)',
          marginRight: 2,
        }}>
          {name}:
        </span>
      )}
      <span style={{ letterSpacing: '0.5px' }}>{formatted}</span>
    </span>
  );
};
