import React from 'react';
import {
  Clock,
  CheckCircle,
  Trash2,
  Sparkles,
} from 'lucide-react';
import { DraftMetrics } from './types';

interface DraftMetricsCardsProps {
  metrics: DraftMetrics;
  statusFilter: string;
  onSelectStatus: (status: string) => void;
}

export const DraftMetricsCards: React.FC<DraftMetricsCardsProps> = ({
  metrics,
  statusFilter,
  onSelectStatus,
}) => {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      <div
        onClick={() => onSelectStatus('pending')}
        className={`cursor-pointer p-4 rounded-xl win11-card shadow-2xs transition-all ${
          statusFilter === 'pending'
            ? 'ring-2 ring-primary border-primary/40'
            : 'hover:border-primary/30'
        }`}
      >
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-amber-600 dark:text-amber-400">
            Pending Review
          </span>
          <Clock className="w-4 h-4 text-amber-500" />
        </div>
        <div className="mt-2 text-2xl sm:text-3xl font-bold text-foreground">{metrics.pending}</div>
        <div className="text-[11px] text-muted-foreground mt-0.5">Awaiting inspection</div>
      </div>

      <div
        onClick={() => onSelectStatus('sent')}
        className={`cursor-pointer p-4 rounded-xl win11-card shadow-2xs transition-all ${
          statusFilter === 'sent'
            ? 'ring-2 ring-primary border-primary/40'
            : 'hover:border-primary/30'
        }`}
      >
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">
            Dispatched
          </span>
          <CheckCircle className="w-4 h-4 text-emerald-500" />
        </div>
        <div className="mt-2 text-2xl sm:text-3xl font-bold text-foreground">{metrics.sent}</div>
        <div className="text-[11px] text-muted-foreground mt-0.5">Delivered via SMTP</div>
      </div>

      <div
        onClick={() => onSelectStatus('discarded')}
        className={`cursor-pointer p-4 rounded-xl win11-card shadow-2xs transition-all ${
          statusFilter === 'discarded'
            ? 'ring-2 ring-primary border-primary/40'
            : 'hover:border-primary/30'
        }`}
      >
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-rose-600 dark:text-rose-400">
            Discarded
          </span>
          <Trash2 className="w-4 h-4 text-rose-500" />
        </div>
        <div className="mt-2 text-2xl sm:text-3xl font-bold text-foreground">{metrics.discarded}</div>
        <div className="text-[11px] text-muted-foreground mt-0.5">Rejected or dropped</div>
      </div>

      <div className="p-4 rounded-xl win11-card shadow-2xs">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-foreground">
            Avg Quality
          </span>
          <Sparkles className="w-4 h-4 text-primary" />
        </div>
        <div className="mt-2 text-2xl sm:text-3xl font-bold text-foreground">
          {metrics.avg_confidence}%
        </div>
        <div className="text-[11px] text-muted-foreground mt-0.5">AI confidence rating</div>
      </div>
    </div>
  );
};
