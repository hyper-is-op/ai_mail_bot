import React, { useState } from 'react';
import { Copy, Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { copyToClipboard } from '@/lib/clipboard';

export type ReferenceType = 'thread' | 'message' | 'ticket' | 'generic';

interface ReferenceBadgeProps {
  id: string | number | null | undefined;
  type?: ReferenceType;
  label?: string;
  truncateLength?: number;
  copyable?: boolean;
  className?: string;
  onClick?: (e: React.MouseEvent) => void;
  variant?: 'subtle' | 'outline' | 'ghost';
  size?: 'xs' | 'sm';
}

export const ReferenceBadge: React.FC<ReferenceBadgeProps> = ({
  id,
  type = 'generic',
  label,
  truncateLength = 10,
  copyable = true,
  className,
  onClick,
  variant = 'subtle',
  size = 'xs'
}) => {
  const [copied, setCopied] = useState(false);

  if (id === null || id === undefined || id === '') {
    return <span className="text-muted-foreground text-xs font-mono">—</span>;
  }

  const strId = String(id).trim();

  // Determine display text
  let displayText = strId;
  if (truncateLength && strId.length > truncateLength) {
    if (strId.startsWith('th_')) {
      displayText = `th_${strId.slice(3, 3 + truncateLength)}…`;
    } else {
      displayText = `${strId.slice(0, truncateLength)}…`;
    }
  }

  const handleCopy = async (e: React.MouseEvent) => {
    e.stopPropagation();
    const ok = await copyToClipboard(strId);
    if (ok) {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    }
  };

  const handleContainerClick = (e: React.MouseEvent) => {
    if (onClick) {
      onClick(e);
    } else if (copyable) {
      handleCopy(e);
    }
  };

  const typeColorClasses = {
    thread: 'text-indigo-700 bg-indigo-50 border-indigo-200 dark:text-indigo-300 dark:bg-indigo-950/50 dark:border-indigo-800/60 hover:border-indigo-300 dark:hover:border-indigo-700',
    message: 'text-sky-700 bg-sky-50 border-sky-200 dark:text-sky-300 dark:bg-sky-950/50 dark:border-sky-800/60 hover:border-sky-300 dark:hover:border-sky-700',
    ticket: 'text-purple-700 bg-purple-50 border-purple-200 dark:text-purple-300 dark:bg-purple-950/50 dark:border-purple-800/60 hover:border-purple-300 dark:hover:border-purple-700',
    generic: 'text-zinc-700 bg-zinc-100 border-zinc-200 dark:text-zinc-300 dark:bg-zinc-800/60 dark:border-zinc-700/60 hover:border-zinc-300 dark:hover:border-zinc-600'
  };

  const sizeClasses = {
    xs: 'text-[10px] px-1.5 py-0.5 gap-1',
    sm: 'text-xs px-2 py-0.5 gap-1.5'
  };

  const variantClasses = {
    subtle: '',
    outline: 'bg-transparent',
    ghost: 'bg-transparent border-transparent hover:border-transparent'
  };

  const isInteractive = Boolean(onClick || copyable);

  return (
    <div
      onClick={handleContainerClick}
      title={copied ? "Copied full ID to clipboard!" : `${type.toUpperCase()}: ${strId} (Click to copy)`}
      className={cn(
        "inline-flex items-center font-mono font-semibold rounded border transition-all group",
        sizeClasses[size],
        typeColorClasses[type],
        variantClasses[variant],
        isInteractive ? 'cursor-pointer hover:brightness-105 dark:hover:brightness-110' : '',
        className
      )}
    >
      {label && <span className="font-bold opacity-90 select-none">{label}</span>}
      <span className="tracking-tight select-text">{displayText}</span>

      {copyable && (
        <button
          type="button"
          onClick={handleCopy}
          className="opacity-50 group-hover:opacity-100 hover:text-foreground transition-opacity p-0.5 -mr-0.5 rounded focus:outline-none cursor-pointer"
          title={copied ? "Copied to clipboard!" : `Copy full ${type} ID`}
          aria-label={`Copy ${type} ID`}
        >
          {copied ? (
            <Check className="w-2.5 h-2.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
          ) : (
            <Copy className="w-2.5 h-2.5 shrink-0" />
          )}
        </button>
      )}
    </div>
  );
};

export default ReferenceBadge;
