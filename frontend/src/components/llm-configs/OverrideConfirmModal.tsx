import React from 'react';
import {
  AlertTriangle,
  Globe,
  AlertCircle,
  Check,
  Loader2,
  Save,
} from 'lucide-react';
import { BaseModal } from '@/components/common';

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
  return (
    <BaseModal
      isOpen={isOpen}
      onClose={onClose}
      closeOnBackdropClick={!overrideUpdating}
      closeOnEscape={!overrideUpdating}
      maxWidth="max-w-md"
      icon={pendingOverrideState ? <AlertTriangle className="w-5 h-5" /> : <Globe className="w-5 h-5" />}
      iconContainerClassName={
        pendingOverrideState
          ? 'bg-rose-500/10 border-rose-500/20 text-rose-500'
          : 'bg-primary/10 border-primary/20 text-primary'
      }
      title={pendingOverrideState ? 'Activate Emergency Global Override?' : 'Restore Normal LLM Routing?'}
      subtitle={
        pendingOverrideState
          ? 'Enforce platform-wide override using Global Default LLM.'
          : 'Disabling override to return to standard priority routing.'
      }
      footer={
        <>
          <button
            type="button"
            onClick={onClose}
            disabled={overrideUpdating}
            className="px-4 py-2 text-xs font-semibold text-foreground/80 hover:text-foreground bg-secondary hover:bg-secondary/80 rounded-lg border border-border transition-colors cursor-pointer disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={overrideUpdating}
            className={`px-4 py-2 text-xs font-semibold text-white rounded-lg transition-all shadow-sm flex items-center gap-2 cursor-pointer disabled:opacity-50 ${
              pendingOverrideState
                ? 'bg-rose-600 hover:bg-rose-700'
                : 'bg-primary hover:bg-primary/90'
            }`}
          >
            {overrideUpdating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
            <span>{pendingOverrideState ? 'Yes, Enforce Global Override' : 'Yes, Restore Normal Routing'}</span>
          </button>
        </>
      }
    >
      <div className="p-5 space-y-4">
        <div
          className={`p-3.5 rounded-lg border text-xs space-y-2 ${
            pendingOverrideState
              ? 'bg-rose-500/5 border-rose-500/20 text-foreground/90'
              : 'bg-primary/5 border-primary/20 text-foreground/90'
          }`}
        >
          {pendingOverrideState ? (
            <>
              <div className="font-semibold text-rose-500 dark:text-rose-400 flex items-center gap-1.5">
                <AlertCircle className="w-4 h-4" />
                CRITICAL SYSTEM IMPACT:
              </div>
              <p className="text-[11px] leading-relaxed text-muted-foreground">
                Enabling this will <strong>immediately bypass all client-specific custom models, API credentials, and template mappings</strong> across all mailboxes. Every incoming email and AI agent operation will be forced through <strong>{globalDefaultProvider.toUpperCase()} ({globalDefaultModel})</strong>.
              </p>
            </>
          ) : (
            <>
              <div className="font-semibold text-primary flex items-center gap-1.5">
                <Check className="w-4 h-4" />
                ROUTING RESTORATION:
              </div>
              <p className="text-[11px] leading-relaxed text-muted-foreground">
                Disabling this will re-enable per-client custom provider credentials and mapped template configurations according to client specific rules.
              </p>
            </>
          )}
        </div>
      </div>
    </BaseModal>
  );
};

