import React from 'react';
import { 
  AlertCircle, 
  CheckCircle2, 
  Loader2, 
  Power, 
  ShieldAlert, 
  Zap 
} from 'lucide-react';
import { BaseModal } from '@/components/common';
import { KillSwitchAction } from './types';

interface ConfirmKillSwitchModalProps {
  isOpen: boolean;
  pendingAction: KillSwitchAction | null;
  targetClientId: string;
  step: 1 | 2;
  setStep: (step: 1 | 2) => void;
  confirmText: string;
  setConfirmText: (text: string) => void;
  ack1: boolean;
  setAck1: (ack: boolean) => void;
  ack2: boolean;
  setAck2: (ack: boolean) => void;
  loading: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export const ConfirmKillSwitchModal: React.FC<ConfirmKillSwitchModalProps> = ({
  isOpen,
  pendingAction,
  targetClientId,
  step,
  setStep,
  confirmText,
  setConfirmText,
  ack1,
  setAck1,
  ack2,
  setAck2,
  loading,
  onConfirm,
  onCancel,
}) => {
  if (!pendingAction) return null;

  return (
    <BaseModal
      isOpen={isOpen}
      onClose={onCancel}
      closeOnBackdropClick={!loading}
      closeOnEscape={!loading}
      maxWidth="max-w-lg"
      icon={!pendingAction.enable ? <Power className="w-5 h-5" /> : <Zap className="w-5 h-5" />}
      iconContainerClassName={
        !pendingAction.enable
          ? 'bg-rose-500/15 border-rose-500/30 text-rose-500'
          : 'bg-emerald-500/15 border-emerald-500/30 text-emerald-500'
      }
      title={
        !pendingAction.enable
          ? step === 1
            ? 'Critical Warning: Engage Kill Switch (1/2)'
            : 'Final Verification: Engage Kill Switch (2/2)'
          : step === 1
          ? 'Resume Master Automation (1/2)'
          : 'Final Verification: Resume Automation (2/2)'
      }
      subtitle={
        <span>
          Target Account: <span className="font-semibold text-foreground font-mono">{targetClientId}</span>
          {pendingAction.type === 'admin' && (
            <span className="ml-2 px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-400 font-bold text-[10px]">
              ADMIN OVERRIDE
            </span>
          )}
        </span>
      }
      footer={
        step === 1 ? (
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
              onClick={() => setStep(2)}
              className={`px-4 py-2 text-xs font-semibold text-white rounded-lg shadow-sm transition-all flex items-center gap-1.5 cursor-pointer ${
                !pendingAction.enable
                  ? 'bg-rose-600 hover:bg-rose-700'
                  : 'bg-emerald-600 hover:bg-emerald-700'
              }`}
            >
              <span>Proceed to Step 2 Verification →</span>
            </button>
          </>
        ) : (
          <div className="flex items-center justify-between w-full">
            <button
              type="button"
              onClick={() => setStep(1)}
              className="px-3 py-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
            >
              ← Back to Step 1
            </button>
            <div className="flex items-center gap-2">
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
                disabled={
                  loading ||
                  (!pendingAction.enable &&
                    (!ack1 ||
                      !ack2 ||
                      !['STOP', 'KILL'].includes(confirmText.trim().toUpperCase()))) ||
                  (pendingAction.enable && !ack1)
                }
                onClick={onConfirm}
                className={`px-4 py-2 text-xs font-bold rounded-lg shadow-sm transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed text-white ${
                  !pendingAction.enable
                    ? 'bg-rose-600 hover:bg-rose-700'
                    : 'bg-emerald-600 hover:bg-emerald-700'
                }`}
              >
                {loading ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : !pendingAction.enable ? (
                  <Power className="w-3.5 h-3.5" />
                ) : (
                  <Zap className="w-3.5 h-3.5" />
                )}
                <span>
                  {!pendingAction.enable
                    ? 'Engage Master Kill Switch Now'
                    : 'Confirm & Resume Automation'}
                </span>
              </button>
            </div>
          </div>
        )
      }
    >
      <div className="p-5 space-y-4">
        {step === 1 ? (
          <div className="space-y-4">
            {!pendingAction.enable ? (
              <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-xs space-y-3">
                <p className="font-bold text-rose-600 dark:text-rose-400 flex items-center gap-1.5">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  Warning 1: Complete platform halt for this client.
                </p>
                <ul className="space-y-2 text-foreground/90 list-disc list-inside text-[11px] leading-relaxed">
                  <li><strong>Gmail Ingestion will STOP:</strong> Incoming customer emails will NOT be fetched, analyzed, or displayed in the bot stream.</li>
                  <li><strong>Zero AI Processing:</strong> No auto-replies, smart classifications, or AI drafts will be generated.</li>
                  <li><strong>No CRM Sync:</strong> Escalations to Zoho Desk or Shopify will be paused.</li>
                </ul>
              </div>
            ) : (
              <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-xs space-y-3">
                <p className="font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  Step 1: Re-enabling Automated Email Processing
                </p>
                <p className="text-foreground/90 text-[11px] leading-relaxed">
                  The background listener will immediately reconnect to Gmail, start fetching unread customer emails, and process them through your configured AI pipelines.
                </p>
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            {!pendingAction.enable ? (
              <div className="space-y-3.5">
                <div className="p-3.5 rounded-xl bg-secondary/50 border border-rose-500/30 text-xs space-y-2.5">
                  <p className="font-bold text-rose-500 dark:text-rose-400 text-xs flex items-center gap-1.5">
                    <ShieldAlert className="w-4 h-4" />
                    Warning 2: Double Confirmation Required
                  </p>

                  <label className="flex items-start gap-2.5 cursor-pointer select-none text-[11px] text-foreground/90">
                    <input
                      type="checkbox"
                      checked={ack1}
                      onChange={(e) => setAck1(e.target.checked)}
                      className="mt-0.5 rounded border-rose-500/40 text-rose-600 focus:ring-rose-500"
                    />
                    <span>I understand that <strong>ALL incoming customer emails</strong> will be left unread in Gmail without automated assistance.</span>
                  </label>

                  <label className="flex items-start gap-2.5 cursor-pointer select-none text-[11px] text-foreground/90">
                    <input
                      type="checkbox"
                      checked={ack2}
                      onChange={(e) => setAck2(e.target.checked)}
                      className="mt-0.5 rounded border-rose-500/40 text-rose-600 focus:ring-rose-500"
                    />
                    <span>I confirm that human support agents must manually monitor and answer support mailboxes.</span>
                  </label>
                </div>

                <div className="space-y-1.5">
                  <label className="block text-[11px] font-bold text-foreground/90 uppercase tracking-wider">
                    Type <span className="text-rose-500 dark:text-rose-400 font-mono">STOP</span> or <span className="text-rose-500 dark:text-rose-400 font-mono">KILL</span> to confirm:
                  </label>
                  <input
                    type="text"
                    placeholder="Type STOP or KILL here..."
                    value={confirmText}
                    onChange={(e) => setConfirmText(e.target.value)}
                    className="w-full bg-secondary/60 border border-rose-500/30 rounded-lg px-3.5 py-2 text-xs text-foreground focus:outline-none focus:border-rose-500 uppercase font-mono tracking-widest"
                  />
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-xs space-y-2">
                  <p className="font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4" />
                    Confirmation 2: Ready to Resume
                  </p>
                  <label className="flex items-start gap-2.5 cursor-pointer select-none text-[11px] text-foreground/90">
                    <input
                      type="checkbox"
                      checked={ack1}
                      onChange={(e) => setAck1(e.target.checked)}
                      className="mt-0.5 rounded border-emerald-500/40 text-emerald-600 focus:ring-emerald-500"
                    />
                    <span>I confirm that knowledge bases, thresholds, and mail integrations are properly configured for automated processing.</span>
                  </label>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </BaseModal>
  );
};

