import React from 'react';
import { AlertCircle, Loader2, Save } from 'lucide-react';
import { BaseModal } from '@/components/common';

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
  return (
    <BaseModal
      isOpen={isOpen}
      onClose={onCancel}
      closeOnBackdropClick={!saving}
      closeOnEscape={!saving}
      maxWidth="max-w-md"
      icon={<AlertCircle className="w-5 h-5" />}
      iconContainerClassName="bg-amber-500/10 border-amber-500/20 text-amber-500"
      title="Confirm Global Policy Change"
      subtitle={
        <span>
          Modifying system-wide defaults under <span className="text-amber-500 font-bold">ALL Clients (Global)</span> scope.
        </span>
      }
      footer={
        <>
          <button
            type="button"
            onClick={onCancel}
            disabled={saving}
            className="px-4 py-2 text-xs font-semibold text-foreground/80 hover:text-foreground bg-secondary hover:bg-secondary/80 rounded-lg border border-border transition-colors cursor-pointer disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={saving}
            className="px-4 py-2 text-xs font-semibold bg-amber-500 hover:bg-amber-600 text-white rounded-lg shadow-sm transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
          >
            {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
            <span>Confirm &amp; Apply Globally</span>
          </button>
        </>
      }
    >
      <div className="p-5 space-y-4">
        <div className="p-3.5 rounded-lg bg-amber-500/5 border border-amber-500/20 text-xs text-foreground/90 space-y-2">
          <div className="flex justify-between items-center pb-2 border-b border-amber-500/10">
            <span className="text-muted-foreground">New Global Confidence Threshold:</span>
            <span className="font-bold text-amber-500 font-mono text-sm">{threshold}%</span>
          </div>
          <p className="text-[11px] leading-relaxed text-muted-foreground">
            ⚠️ This update will immediately change the AI auto-reply score threshold for <strong>all client accounts</strong> across the platform that do not have custom overrides.
          </p>
        </div>
      </div>
    </BaseModal>
  );
};

