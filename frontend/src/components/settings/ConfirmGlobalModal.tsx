import React from 'react';
import { AlertCircle, Loader2, Save } from 'lucide-react';

interface ConfirmGlobalModalProps {
  isOpen: boolean;
  threshold: number;
  saving: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export const ConfirmGlobalModal: React.FC<ConfirmGlobalModalProps> = ({
  isOpen,
  threshold,
  saving,
  onConfirm,
  onCancel,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 dark:bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white dark:bg-zinc-900 border border-amber-500/30 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-5 animate-in zoom-in-95 duration-200">
        <div className="flex items-start gap-3.5">
          <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-500 shrink-0">
            <AlertCircle className="w-6 h-6" />
          </div>
          <div className="space-y-1">
            <h3 className="text-lg font-bold text-zinc-900 dark:text-white">Confirm Global Policy Change</h3>
            <p className="text-xs text-muted-foreground">
              You are modifying system-wide defaults under <span className="text-amber-500 font-bold">ALL Clients (Global)</span> scope.
            </p>
          </div>
        </div>

        <div className="p-3.5 rounded-xl bg-amber-500/5 border border-amber-500/20 text-xs text-zinc-700 dark:text-zinc-300 space-y-2">
          <div className="flex justify-between items-center pb-2 border-b border-amber-500/10">
            <span className="text-muted-foreground">New Global Confidence Threshold:</span>
            <span className="font-bold text-amber-500 font-mono text-sm">{threshold}%</span>
          </div>
          <p className="text-[11px] leading-relaxed text-muted-foreground">
            ⚠️ This update will immediately change the AI auto-reply score threshold for <strong>all client accounts</strong> across the platform that do not have custom overrides.
          </p>
        </div>

        <div className="flex items-center justify-end gap-2.5 pt-1">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 text-xs font-semibold text-zinc-700 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-white bg-zinc-100 dark:bg-white/5 hover:bg-zinc-200 dark:hover:bg-white/10 rounded-xl border border-zinc-200 dark:border-white/10 transition-colors cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={saving}
            className="px-4 py-2 text-xs font-semibold bg-amber-500 hover:bg-amber-600 text-white rounded-xl shadow-lg shadow-amber-500/20 transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
          >
            {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
            <span>Confirm &amp; Apply Globally</span>
          </button>
        </div>
      </div>
    </div>
  );
};
