import React from 'react';
import { AlertCircle, Clock, Loader2, Zap } from 'lucide-react';

interface ConfirmAutoSendModalProps {
  isOpen: boolean;
  pendingTarget: boolean | null;
  targetClientId: string;
  threshold: number;
  loading: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export const ConfirmAutoSendModal: React.FC<ConfirmAutoSendModalProps> = ({
  isOpen,
  pendingTarget,
  targetClientId,
  threshold,
  loading,
  onConfirm,
  onCancel,
}) => {
  if (!isOpen || pendingTarget === null) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 dark:bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-white/10 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-5 animate-in zoom-in-95 duration-200">
        <div className="flex items-start gap-3.5">
          <div className={`p-3 rounded-xl shrink-0 ${
            pendingTarget === false
              ? 'bg-amber-500/10 border border-amber-500/20 text-amber-500'
              : 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-500'
          }`}>
            {pendingTarget === false ? (
              <Clock className="w-6 h-6" />
            ) : (
              <Zap className="w-6 h-6" />
            )}
          </div>
          <div className="space-y-1">
            <h3 className="text-lg font-bold text-zinc-900 dark:text-white">
              {pendingTarget === false
                ? 'Enable Pause & Draft Mode?'
                : 'Enable Direct Auto-Send Mode?'}
            </h3>
            <p className="text-xs text-muted-foreground">
              Target Account: <span className="font-semibold text-foreground font-mono">{targetClientId}</span>
            </p>
          </div>
        </div>

        {pendingTarget === false ? (
          <div className="p-4 rounded-xl bg-amber-500/5 border border-amber-500/20 text-xs text-zinc-700 dark:text-zinc-300 space-y-2">
            <p className="font-semibold text-amber-600 dark:text-amber-400 flex items-center gap-1.5">
              <AlertCircle className="w-4 h-4" />
              AI replies will be paused for human review
            </p>
            <p className="text-[11px] leading-relaxed text-muted-foreground">
              When <strong>Pause &amp; Draft</strong> is active, AI-generated email responses will <strong>not</strong> be automatically sent via SMTP. All replies will be placed into the <strong>Pause &amp; Draft</strong> inbox where operators can inspect, edit wording, and dispatch emails individually or in smart batches.
            </p>
          </div>
        ) : (
          <div className="p-4 rounded-xl bg-emerald-500/5 border border-emerald-500/20 text-xs text-zinc-700 dark:text-zinc-300 space-y-2">
            <p className="font-semibold text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
              <AlertCircle className="w-4 h-4" />
              Live automated dispatch will be activated
            </p>
            <p className="text-[11px] leading-relaxed text-muted-foreground">
              ⚠️ <strong>Warning:</strong> AI replies meeting your confidence threshold (≥ {threshold}%) will be <strong>automatically dispatched to customers via SMTP</strong> without prior human review. Please ensure your Knowledge Base and system settings are properly configured.
            </p>
          </div>
        )}

        <div className="flex items-center justify-end gap-2.5 pt-1">
          <button
            type="button"
            onClick={onCancel}
            disabled={loading}
            className="px-4 py-2 text-xs font-semibold text-zinc-700 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-white bg-zinc-100 dark:bg-white/5 hover:bg-zinc-200 dark:hover:bg-white/10 rounded-xl border border-zinc-200 dark:border-white/10 transition-colors cursor-pointer disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={loading}
            className={`px-4 py-2 text-xs font-semibold text-white rounded-xl shadow-lg transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50 ${
              pendingTarget === false
                ? 'bg-amber-500 hover:bg-amber-600 shadow-amber-500/20'
                : 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-600/20'
            }`}
          >
            {loading ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : pendingTarget === false ? (
              <Clock className="w-3.5 h-3.5" />
            ) : (
              <Zap className="w-3.5 h-3.5" />
            )}
            <span>
              {pendingTarget === false
                ? 'Confirm & Enable Pause & Draft'
                : 'Confirm & Enable Auto-Send'}
            </span>
          </button>
        </div>
      </div>
    </div>
  );
};
