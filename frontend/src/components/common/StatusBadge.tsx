import React from 'react';
import { cn } from '@/lib/utils';

export type StatusVariant = 
  | 'success' 
  | 'warning' 
  | 'danger' 
  | 'info' 
  | 'neutral' 
  | 'purple';

export interface StatusBadgeProps {
  label: string;
  variant?: StatusVariant;
  size?: 'xs' | 'sm';
  className?: string;
  dot?: boolean;
}

const variantStyles: Record<StatusVariant, { badge: string; dot: string }> = {
  success: {
    badge: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20',
    dot: 'bg-emerald-500',
  },
  warning: {
    badge: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20',
    dot: 'bg-amber-500',
  },
  danger: {
    badge: 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20',
    dot: 'bg-rose-500',
  },
  info: {
    badge: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20',
    dot: 'bg-blue-500',
  },
  purple: {
    badge: 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20',
    dot: 'bg-purple-500',
  },
  neutral: {
    badge: 'bg-muted text-muted-foreground border-border',
    dot: 'bg-muted-foreground',
  },
};

export const StatusBadge: React.FC<StatusBadgeProps> = ({
  label,
  variant = 'neutral',
  size = 'xs',
  className,
  dot = false,
}) => {
  const styles = variantStyles[variant] || variantStyles.neutral;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 font-medium border rounded-full transition-colors",
        size === 'xs' ? "px-2 py-0.5 text-[11px]" : "px-2.5 py-1 text-xs",
        styles.badge,
        className
      )}
    >
      {dot && <span className={cn("w-1.5 h-1.5 rounded-full shrink-0", styles.dot)} />}
      <span className="capitalize">{label}</span>
    </span>
  );
};
