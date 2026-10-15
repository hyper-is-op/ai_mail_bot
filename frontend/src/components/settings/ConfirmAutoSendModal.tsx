import React from 'react';
import { AlertCircle, Clock, Loader2, Zap } from 'lucide-react';
import { BaseModal } from '@/components/common';

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
  return (
    <BaseModal
      isOpen={isOpen && pendingTarget !== null}
      onClose={onCancel}
      closeOnBackdropClick={!loading}
      closeOnEscape={!loading}
      maxWidth="max-w-md"
      icon={pendingTarget === false ? <Clock className="w-5 h-5" /> : <Zap className="w-5 h-5" />}
      iconContainerClassName={
        pendingTarget === false
          ? 'bg-amber-500/10 border-amber-500/20 text-amber-500'
          : 'bg-emerald-500/10 border-emerald-500/20 text-emerald-500'
      }
      title={
        pendingTarget === false
          ? 'Enable Pause & Draft Mode?'
          : 'Enable Direct Auto-Send Mode?'
      }
      subtitle={
        <span>
          Target Account: <span className="font-semibold text-foreground font-mono">{targetClientId}</span>
        </span>
      }
      footer={
        <>
          <button
            type="button"
            onClick={onCancel}
            disabled={loading}
            className="px-4 py-2 text-xs font-semibold text-foreground/80 hover:text-foreground bg-secondary hover:bg-secondary/80 rounded-lg border border-border transition-colors cursor-pointer disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={loading}
            className={`px-4 py-2 text-xs font-semibold text-white rounded-lg shadow-sm transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50 ${
              pendingTarget === false
                ? 'bg-amber-500 hover:bg-amber-600'
                : 'bg-emerald-600 hover:bg-emerald-700'
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
        </>
      }
    >
      <div className="p-5 space-y-4">
        {pendingTarget === false ? (
          <div className="p-4 rounded-xl bg-amber-500/5 border border-amber-500/20 text-xs text-foreground/90 space-y-2">
            <p className="font-semibold text-amber-600 dark:text-amber-400 flex items-center gap-1.5">
              <AlertCircle className="w-4 h-4" />
              AI replies will be paused for human review
            </p>
            <p className="text-[11px] leading-relaxed text-muted-foreground">
              When <strong>Pause &amp; Draft</strong> is active, AI-generated email responses will <strong>not</strong> be automatically sent via SMTP. All replies will be placed into the <strong>Pause &amp; Draft</strong> inbox where operators can inspect, edit wording, and dispatch emails individually or in smart batches.
            </p>
          </div>
        ) : (
          <div className="p-4 rounded-xl bg-emerald-500/5 border border-emerald-500/20 text-xs text-foreground/90 space-y-2">
            <p className="font-semibold text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
              <AlertCircle className="w-4 h-4" />
              Live automated dispatch will be activated
            </p>
            <p className="text-[11px] leading-relaxed text-muted-foreground">
              ⚠️ <strong>Warning:</strong> AI replies meeting your confidence threshold (≥ {threshold}%) will be <strong>automatically dispatched to customers via SMTP</strong> without prior human review. Please ensure your Knowledge Base and system settings are properly configured.
            </p>
          </div>
        )}
      </div>
    </BaseModal>
  );
};

