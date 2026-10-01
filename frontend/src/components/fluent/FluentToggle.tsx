import React from 'react';
import { cn } from '@/lib/utils';

interface FluentToggleProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  showLabel?: boolean;
  labelPosition?: 'left' | 'right';
  className?: string;
  id?: string;
  'aria-label'?: string;
}

export const FluentToggle: React.FC<FluentToggleProps> = ({
  checked,
  onChange,
  disabled = false,
  showLabel = true,
  labelPosition = 'left',
  className,
  id,
  'aria-label': ariaLabel,
}) => {
  const labelText = checked ? 'On' : 'Off';

  return (
    <div className={cn('inline-flex items-center gap-2 select-none', className)}>
      {showLabel && labelPosition === 'left' && (
        <span className="text-xs font-medium text-foreground w-6 text-right">
          {labelText}
        </span>
      )}

      <button
        type="button"
        role="switch"
        id={id}
        aria-checked={checked}
        aria-label={ariaLabel || (showLabel ? undefined : labelText)}
        disabled={disabled}
        onClick={() => !disabled && onChange(!checked)}
        className={cn(
          'relative inline-flex h-5 w-10 shrink-0 cursor-pointer rounded-full border transition-colors duration-150 ease-in-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2',
          checked
            ? 'bg-primary border-primary'
            : 'bg-black/[0.08] dark:bg-white/[0.12] border-black/25 dark:border-white/25 hover:bg-black/[0.14] dark:hover:bg-white/[0.18]',
          disabled && 'opacity-50 cursor-not-allowed'
        )}
      >
        <span
          className={cn(
            'pointer-events-none inline-block h-3.5 w-3.5 rounded-full shadow-xs transition-transform duration-150 ease-in-out mt-[2px]',
            checked
              ? 'translate-x-[22px] bg-white dark:bg-zinc-950'
              : 'translate-x-[3px] bg-zinc-700 dark:bg-zinc-200'
          )}
        />
      </button>

      {showLabel && labelPosition === 'right' && (
        <span className="text-xs font-medium text-foreground w-6 text-left">
          {labelText}
        </span>
      )}
    </div>
  );
};
