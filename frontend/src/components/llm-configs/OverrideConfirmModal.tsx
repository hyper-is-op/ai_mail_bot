import React from 'react';
import {
  AlertTriangle,
  Globe,
  AlertCircle,
  Check,
  Loader2,
  Save,
} from 'lucide-react';

interface OverrideConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  pendingOverrideState: boolean;
  overrideUpdating: boolean;
  onConfirm: () => void;
  globalDefaultProvider: string;
  globalDefaultModel: string;
}

export const OverrideConfirmModal: React.FC<OverrideConfirmModalProps> = ({
  isOpen,
  onClose,
  pendingOverrideState,
  overrideUpdating,
  onConfirm,
  globalDefaultProvider,
  globalDefaultModel,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 dark:bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
      <div
        className={`bg-white dark:bg-zinc-900 border rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-5 animate-in zoom-in-95 duration-200 ${
          pendingOverrideState ? 'border-rose-500/40' : 'border-blue-500/40'
        }`}
      >
        <div className="flex items-start gap-3.5">
          <div
            className={`p-3 rounded-xl shrink-0 border ${
              pendingOverrideState
                ? 'bg-rose-500/10 border-rose-500/20 text-rose-500 dark:text-rose-400'
                : 'bg-blue-500/10 border-blue-500/20 text-blue-500 dark:text-blue-400'
            }`}
          >
            {pendingOverrideState ? <AlertTriangle className="w-6 h-6" /> : <Globe className="w-6 h-6" />}
          </div>
          <div className="space-y-1">
            <h3 className="text-lg font-bold text-zinc-900 dark:text-white">
              {pendingOverrideState ? 'Activate Emergency Global Override?' : 'Restore Normal LLM Routing?'}
            </h3>
            <p className="text-xs text-muted-foreground">
              {pendingOverrideState
                ? 'You are about to enforce platform-wide override using Global Default LLM.'
                : 'You are disabling the platform-wide override to return to standard priority routing.'}
            </p>
          </div>
        </div>

        <div
          className={`p-3.5 rounded-xl border text-xs space-y-2 ${
            pendingOverrideState
              ? 'bg-rose-500/5 border-rose-500/20 text-zinc-700 dark:text-zinc-300'
              : 'bg-blue-500/5 border-blue-500/20 text-zinc-700 dark:text-zinc-300'
          }`}
        >
          {pendingOverrideState ? (
            <>
              <div className="font-semibold text-rose-500 dark:text-rose-400 flex items-center gap-1.5">
                <AlertCircle className="w-4 h-4" />
                CRITICAL SYSTEM IMPACT:
              </div>
              <p className="text-[11px] leading-relaxed text-zinc-700 dark:text-zinc-300">
                Enabling this will <strong>immediately bypass all client-specific custom models, API credentials, and template mappings</strong> across all mailboxes. Every incoming email and AI agent operation will be forced through <strong>{globalDefaultProvider.toUpperCase()} ({globalDefaultModel})</strong>.
              </p>
            </>
          ) : (
            <>
              <div className="font-semibold text-blue-500 dark:text-blue-400 flex items-center gap-1.5">
                <Check className="w-4 h-4" />
                ROUTING RESTORATION:
              </div>
              <p className="text-[11px] leading-relaxed text-zinc-700 dark:text-zinc-300">
                Disabling this will re-enable per-client custom provider credentials and mapped template configurations according to client specific rules.
              </p>
            </>
          )}
        </div>

        <div className="flex items-center justify-end gap-2.5 pt-1">
          <button
            type="button"
            onClick={onClose}
            disabled={overrideUpdating}
            className="px-4 py-2 text-xs font-semibold text-zinc-700 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-white bg-zinc-100 dark:bg-white/5 hover:bg-zinc-200 dark:hover:bg-white/10 rounded-xl border border-zinc-200 dark:border-white/10 transition-colors cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={overrideUpdating}
            className={`px-4 py-2 text-xs font-semibold text-white rounded-xl transition-all shadow-md flex items-center gap-2 cursor-pointer disabled:opacity-50 ${
              pendingOverrideState
                ? 'bg-rose-600 hover:bg-rose-500 shadow-rose-600/20'
                : 'bg-primary hover:bg-primary/90 shadow-primary/20'
            }`}
          >
            {overrideUpdating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
            <span>{pendingOverrideState ? 'Yes, Enforce Global Override' : 'Yes, Restore Normal Routing'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
