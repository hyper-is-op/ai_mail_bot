import React from 'react';
import { XCircle } from 'lucide-react';

interface RejectReasonModalProps {
  isOpen: boolean;
  onClose: () => void;
  rejectReason: string;
  setRejectReason: (val: string) => void;
  onConfirmReject: () => void;
}

export const RejectReasonModal: React.FC<RejectReasonModalProps> = ({
  isOpen,
  onClose,
  rejectReason,
  setRejectReason,
  onConfirmReject,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-card w-full max-w-md rounded-3xl border border-zinc-200 dark:border-white/10 shadow-2xl p-6 space-y-4">
        <h3 className="text-lg font-bold text-rose-600 flex items-center gap-2">
          <XCircle className="w-5 h-5" />
          Reject Connector Configuration
        </h3>
        <p className="text-xs text-muted-foreground">
          Provide a reason for rejection so the client can fix and resubmit.
        </p>

        <textarea
          value={rejectReason}
          onChange={(e) => setRejectReason(e.target.value)}
          rows={3}
          placeholder="e.g. URL is not accessible, missing required response fields, etc."
          className="w-full p-3 rounded-2xl border border-zinc-200 dark:border-white/10 bg-zinc-50 dark:bg-black/30 text-xs outline-none focus:ring-2 focus:ring-primary/20"
        />

        <div className="flex justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl border border-zinc-200 dark:border-white/10 text-xs font-semibold hover:bg-zinc-100 dark:hover:bg-white/5 transition-all cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirmReject}
            className="px-4 py-2 rounded-xl bg-rose-600 text-white text-xs font-semibold hover:bg-rose-500 transition-all cursor-pointer"
          >
            Confirm Rejection
          </button>
        </div>
      </div>
    </div>
  );
};

export default RejectReasonModal;
