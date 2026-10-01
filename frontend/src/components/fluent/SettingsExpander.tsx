import React, { useState } from 'react';
import { ChevronRight, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface SettingsRowProps {
  icon?: React.ComponentType<{ className?: string }> | React.ReactNode;
  iconBg?: string;
  title: React.ReactNode;
  description?: React.ReactNode;
  action?: React.ReactNode;
  onClick?: () => void;
  expandable?: boolean;
  expanded?: boolean;
  onToggleExpand?: () => void;
  children?: React.ReactNode;
  className?: string;
}

export const SettingsRow: React.FC<SettingsRowProps> = ({
  icon,
  iconBg,
  title,
  description,
  action,
  onClick,
  expandable = false,
  expanded = false,
  onToggleExpand,
  children,
  className,
}) => {
  const [internalExpanded, setInternalExpanded] = useState(expanded);
  const isExpanded = onToggleExpand ? expanded : internalExpanded;

  const handleRowClick = () => {
    if (expandable) {
      if (onToggleExpand) {
        onToggleExpand();
      } else {
        setInternalExpanded(!internalExpanded);
      }
    } else if (onClick) {
      onClick();
    }
  };

  const isClickable = Boolean(onClick || expandable);

  const renderIcon = () => {
    if (!icon) return null;
    if (React.isValidElement(icon)) return icon;
    const IconComponent = icon as React.ComponentType<{ className?: string }>;
    return <IconComponent className="w-4 h-4 text-foreground" />;
  };

  return (
    <div className={cn('group/row transition-colors', className)}>
      <div
        onClick={isClickable ? handleRowClick : undefined}
        className={cn(
          'flex items-center justify-between p-3.5 sm:p-4 gap-3.5 select-none',
          isClickable && 'cursor-pointer hover:bg-black/[0.02] dark:hover:bg-white/[0.02]'
        )}
      >
        <div className="flex items-center gap-3.5 min-w-0 flex-1">
          {icon && (
            <div
              className={cn(
                'w-8 h-8 rounded-lg flex items-center justify-center shrink-0 border border-black/[0.06] dark:border-white/[0.08] bg-black/[0.03] dark:bg-white/[0.04]',
                iconBg
              )}
            >
              {renderIcon()}
            </div>
          )}

          <div className="min-w-0 flex-1">
            <div className="text-xs sm:text-sm font-semibold text-foreground truncate">
              {title}
            </div>
            {description && (
              <div className="text-[11px] sm:text-xs text-muted-foreground mt-0.5 leading-relaxed truncate sm:whitespace-normal">
                {description}
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0 ml-2" onClick={(e) => e.stopPropagation()}>
          {action}
          {expandable && (
            <button
              type="button"
              onClick={handleRowClick}
              className="p-1 rounded-md text-muted-foreground hover:text-foreground transition-transform"
            >
              {isExpanded ? (
                <ChevronDown className="w-4 h-4 text-muted-foreground" />
              ) : (
                <ChevronRight className="w-4 h-4 text-muted-foreground" />
              )}
            </button>
          )}
          {!expandable && onClick && !action && (
            <ChevronRight className="w-4 h-4 text-muted-foreground group-hover/row:translate-x-0.5 transition-transform" />
          )}
        </div>
      </div>

      {expandable && isExpanded && children && (
        <div className="p-4 pt-1 border-t border-black/[0.06] dark:border-white/[0.06] bg-black/[0.015] dark:bg-white/[0.015]">
          {children}
        </div>
      )}
    </div>
  );
};

export interface SettingsCardProps {
  title?: React.ReactNode;
  description?: React.ReactNode;
  headerAction?: React.ReactNode;
  footerLink?: {
    label: string;
    onClick: () => void;
  };
  children: React.ReactNode;
  className?: string;
}

export const SettingsCard: React.FC<SettingsCardProps> = ({
  title,
  description,
  headerAction,
  footerLink,
  children,
  className,
}) => {
  return (
    <div
      className={cn(
        'win11-card rounded-lg overflow-hidden border border-black/[0.08] dark:border-white/[0.08] bg-white dark:bg-[#2C2C2C] shadow-2xs',
        className
      )}
    >
      {(title || description || headerAction) && (
        <div className="p-4 pb-3 border-b border-black/[0.06] dark:border-white/[0.06] flex items-start justify-between gap-3">
          <div>
            {title && (
              <h3 className="text-sm sm:text-base font-semibold text-foreground tracking-tight">
                {title}
              </h3>
            )}
            {description && (
              <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
                {description}
              </p>
            )}
          </div>
          {headerAction && <div className="shrink-0">{headerAction}</div>}
        </div>
      )}

      <div className="divide-y divide-black/[0.06] dark:divide-white/[0.06]">
        {children}
      </div>

      {footerLink && (
        <div
          onClick={footerLink.onClick}
          className="p-3.5 px-4 border-t border-black/[0.06] dark:border-white/[0.06] flex items-center justify-between text-xs font-medium text-foreground hover:bg-black/[0.02] dark:hover:bg-white/[0.02] cursor-pointer transition-colors group"
        >
          <span>{footerLink.label}</span>
          <ChevronRight className="w-3.5 h-3.5 text-muted-foreground group-hover:translate-x-0.5 transition-transform" />
        </div>
      )}
    </div>
  );
};
