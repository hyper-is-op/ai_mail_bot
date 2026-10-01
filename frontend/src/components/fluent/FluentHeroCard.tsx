import React from 'react';
import { Wifi, RefreshCw, Bot, ExternalLink } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface FluentHeroCardProps {
  title: string;
  subtitle?: string;
  actionLabel?: string;
  onActionClick?: () => void;
  status1?: {
    icon?: React.ComponentType<{ className?: string }>;
    title: string;
    subtitle: string;
  };
  status2?: {
    icon?: React.ComponentType<{ className?: string }>;
    title: string;
    subtitle: string;
  };
  thumbnailUrl?: string;
  className?: string;
}

export const FluentHeroCard: React.FC<FluentHeroCardProps> = ({
  title,
  subtitle,
  actionLabel = 'Configure',
  onActionClick,
  status1 = {
    icon: Wifi,
    title: 'Mail Stream Connected',
    subtitle: 'IMAP/OAuth2 Secure',
  },
  status2 = {
    icon: RefreshCw,
    title: 'AI Processing Engine',
    subtitle: 'Healthy & Responsive',
  },
  thumbnailUrl,
  className,
}) => {
  const Status1Icon = status1.icon || Wifi;
  const Status2Icon = status2.icon || RefreshCw;

  return (
    <div
      className={cn(
        'win11-card rounded-lg p-4 sm:p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 border border-black/[0.08] dark:border-white/[0.08] bg-white dark:bg-[#2C2C2C] shadow-2xs',
        className
      )}
    >
      {/* Left: Device / Bot Identity Banner */}
      <div className="flex items-center gap-4 min-w-0">
        <div className="relative w-24 h-16 sm:w-28 sm:h-18 rounded-md overflow-hidden shrink-0 border border-black/[0.08] dark:border-white/[0.08] bg-gradient-to-tr from-sky-600 via-blue-700 to-indigo-800 flex items-center justify-center shadow-xs">
          {thumbnailUrl ? (
            <img
              src={thumbnailUrl}
              alt="System Identity"
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="flex flex-col items-center justify-center text-white/90">
              <Bot className="w-7 h-7" />
              <span className="text-[9px] font-bold tracking-wider uppercase mt-0.5 opacity-80">
                Agent 01
              </span>
            </div>
          )}
        </div>

        <div className="min-w-0">
          <h2 className="text-base sm:text-lg font-bold text-foreground tracking-tight truncate">
            {title}
          </h2>
          {subtitle && (
            <p className="text-xs text-muted-foreground font-mono mt-0.5 truncate">
              {subtitle}
            </p>
          )}
          {onActionClick && (
            <button
              type="button"
              onClick={onActionClick}
              className="text-xs font-semibold text-primary hover:underline inline-flex items-center gap-1 mt-1 cursor-pointer"
            >
              <span>{actionLabel}</span>
              <ExternalLink className="w-3 h-3" />
            </button>
          )}
        </div>
      </div>

      {/* Right: Live Telemetry / Connection Indicators */}
      <div className="flex flex-wrap sm:flex-nowrap items-center gap-4 sm:gap-6 border-t md:border-t-0 md:border-l border-black/[0.06] dark:border-white/[0.06] pt-3 md:pt-0 md:pl-6 shrink-0">
        {status1 && (
          <div className="flex items-center gap-3 min-w-[140px]">
            <div className="p-2 rounded-lg bg-sky-500/10 text-sky-600 dark:text-sky-400">
              <Status1Icon className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <div className="text-xs font-semibold text-foreground truncate">
                {status1.title}
              </div>
              <div className="text-[11px] text-muted-foreground truncate">
                {status1.subtitle}
              </div>
            </div>
          </div>
        )}

        {status2 && (
          <div className="flex items-center gap-3 min-w-[140px]">
            <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
              <Status2Icon className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <div className="text-xs font-semibold text-foreground truncate">
                {status2.title}
              </div>
              <div className="text-[11px] text-muted-foreground truncate">
                {status2.subtitle}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
