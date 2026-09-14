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
        className={`cursor-pointer p-3.5 rounded-lg win11-card ${
          statusFilter === 'pending'
            ? 'ring-2 ring-primary border-primary/40'
            : ''
        }`}
      >
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-amber-600 dark:text-amber-400">
            Pending Review
          </span>
          <Clock className="w-4 h-4 text-amber-500" />
        </div>
        <div className="mt-1.5 text-2xl font-bold text-foreground">{metrics.pending}</div>
        <div className="text-[11px] text-muted-foreground">Awaiting inspection</div>
      </div>

      <div
        onClick={() => onSelectStatus('sent')}
        className={`cursor-pointer p-3.5 rounded-lg win11-card ${
          statusFilter === 'sent'
            ? 'ring-2 ring-primary border-primary/40'
            : ''
        }`}
      >
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">
            Dispatched
          </span>
          <CheckCircle className="w-4 h-4 text-emerald-500" />
        </div>
        <div className="mt-1.5 text-2xl font-bold text-foreground">{metrics.sent}</div>
        <div className="text-[11px] text-muted-foreground">Delivered via SMTP</div>
      </div>

      <div
        onClick={() => onSelectStatus('discarded')}
        className={`cursor-pointer p-3.5 rounded-lg win11-card ${
          statusFilter === 'discarded'
            ? 'ring-2 ring-primary border-primary/40'
            : ''
        }`}
      >
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-red-600 dark:text-red-400">
            Discarded
          </span>
          <Trash2 className="w-4 h-4 text-red-500" />
        </div>
        <div className="mt-1.5 text-2xl font-bold text-foreground">{metrics.discarded}</div>
        <div className="text-[11px] text-muted-foreground">Rejected or dropped</div>
      </div>

      <div className="p-3.5 rounded-lg win11-card">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-foreground">
            Avg Quality
          </span>
          <Sparkles className="w-4 h-4 text-primary" />
        </div>
        <div className="mt-1.5 text-2xl font-bold text-foreground">
          {metrics.avg_confidence}%
        </div>
        <div className="text-[11px] text-muted-foreground">AI confidence rating</div>
      </div>
    </div>
  );
};
