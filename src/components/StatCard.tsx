import React from 'react';
import type { LucideIcon } from 'lucide-react';

interface StatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: LucideIcon;
  variant?: 'credit' | 'debt' | 'warning' | 'info' | 'primary';
  badgeText?: string;
}

export const StatCard: React.FC<StatCardProps> = ({
  title,
  value,
  subtitle,
  icon: Icon,
  variant = 'primary',
  badgeText,
}) => {
  const getColors = () => {
    switch (variant) {
      case 'credit':
        return {
          bgIcon: 'rgba(16, 185, 129, 0.15)',
          colorIcon: 'var(--color-credit)',
          border: 'rgba(16, 185, 129, 0.25)',
        };
      case 'debt':
        return {
          bgIcon: 'rgba(244, 63, 94, 0.15)',
          colorIcon: 'var(--color-debt)',
          border: 'rgba(244, 63, 94, 0.25)',
        };
      case 'warning':
        return {
          bgIcon: 'rgba(245, 158, 11, 0.15)',
          colorIcon: 'var(--color-warning)',
          border: 'rgba(245, 158, 11, 0.25)',
        };
      case 'info':
        return {
          bgIcon: 'rgba(6, 182, 212, 0.15)',
          colorIcon: 'var(--accent-teal)',
          border: 'rgba(6, 182, 212, 0.25)',
        };
      default:
        return {
          bgIcon: 'rgba(99, 102, 241, 0.15)',
          colorIcon: 'var(--accent-indigo)',
          border: 'rgba(99, 102, 241, 0.25)',
        };
    }
  };

  const colors = getColors();

  return (
    <div
      className="card card-hover"
      style={{
        border: `1px solid ${colors.border}`,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
        <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-muted)' }}>
          {title}
        </span>
        <div
          style={{
            width: '36px',
            height: '36px',
            borderRadius: 'var(--radius-md)',
            background: colors.bgIcon,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: colors.colorIcon,
          }}
        >
          <Icon size={18} />
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem' }}>
        <span style={{ fontSize: '1.65rem', fontWeight: 800, color: 'var(--text-main)', letterSpacing: '-0.02em' }}>
          {value}
        </span>
        {badgeText && (
          <span className={`badge badge-${variant}`} style={{ fontSize: '0.7rem' }}>
            {badgeText}
          </span>
        )}
      </div>

      {subtitle && (
        <div style={{ fontSize: '0.775rem', color: 'var(--text-muted)', marginTop: '0.4rem' }}>
          {subtitle}
        </div>
      )}
    </div>
  );
};
