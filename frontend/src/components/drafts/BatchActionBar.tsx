import React from 'react';
import { Send, Trash2, Zap } from 'lucide-react';

interface BatchActionBarProps {
  selectedIds: number[];
  onClearSelection: () => void;
  batchActionLoading: boolean;
  onBatchSendSelected: () => void;
  onBatchDiscardSelected: () => void;
  statusFilter: string;
  totalCount: number;
  onBatchSendByFilter: () => void;
}

export const BatchActionBar: React.FC<BatchActionBarProps> = ({
  selectedIds,
  onClearSelection,
  batchActionLoading,
  onBatchSendSelected,
  onBatchDiscardSelected,
  statusFilter,
  totalCount,
  onBatchSendByFilter,
}) => {
  return (
    <>
      {/* Floating / Sticky Batch Action Bar */}
      {selectedIds.length > 0 && (
        <div className="sticky top-4 z-30 p-3 rounded-lg win11-card bg-[#282828] text-white shadow-xl flex flex-wrap items-center justify-between gap-3 animate-in fade-in">
          <div className="flex items-center gap-2.5">
            <span className="inline-flex items-center justify-center px-2 py-0.5 rounded text-xs font-bold bg-primary text-primary-foreground">
              {selectedIds.length} selected
            </span>
            <span className="text-xs font-medium text-foreground">
              Bulk actions for selected drafts
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onBatchSendSelected}
              disabled={batchActionLoading}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md bg-emerald-600 hover:bg-emerald-500 text-white transition-colors disabled:opacity-50 cursor-pointer"
            >
              <Send className="w-3 h-3" />
              {batchActionLoading ? 'Dispatching...' : `Send Selected (${selectedIds.length})`}
            </button>

            <button
              type="button"
              onClick={onBatchDiscardSelected}
              disabled={batchActionLoading}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md bg-white/10 hover:bg-red-600 text-white transition-colors disabled:opacity-50 cursor-pointer"
            >
              <Trash2 className="w-3 h-3" />
              Discard Selected
            </button>

            <button
              type="button"
              onClick={onClearSelection}
              className="text-xs text-muted-foreground hover:text-foreground px-2 py-1 cursor-pointer"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Filter-based Batch Dispatch Helper */}
      {selectedIds.length === 0 && statusFilter === 'pending' && totalCount > 0 && (
        <div className="flex items-center justify-between px-3.5 py-2.5 rounded-lg border border-primary/20 bg-primary/10 text-xs text-foreground">
          <div className="flex items-center gap-2">
            <Zap className="w-3.5 h-3.5 text-primary" />
            <span>
              <strong>Smart Batch Dispatch:</strong> Send all {totalCount} drafts matching your current filter in one step.
            </span>
          </div>
          <button
            type="button"
            onClick={onBatchSendByFilter}
            disabled={batchActionLoading}
            className="flex items-center gap-1 px-3 py-1 font-semibold rounded-md bg-primary text-primary-foreground shadow-xs hover:opacity-90 transition-opacity cursor-pointer disabled:opacity-50"
          >
            <Send className="w-3 h-3" />
            {batchActionLoading ? 'Dispatching...' : `Batch Send All (${totalCount})`}
          </button>
        </div>
      )}
    </>
  );
};
