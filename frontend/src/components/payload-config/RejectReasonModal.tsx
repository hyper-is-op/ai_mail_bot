import React from 'react';
import { XCircle } from 'lucide-react';
import { BaseModal } from '@/components/common';

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
  return (
    <BaseModal
      isOpen={isOpen}
      onClose={onClose}
      maxWidth="max-w-md"
      icon={<XCircle className="w-5 h-5" />}
      iconContainerClassName="bg-rose-500/10 border-rose-500/20 text-rose-500"
      title="Reject Connector Configuration"
      subtitle="Provide a reason for rejection so the client can fix and resubmit."
      footer={
        <>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-lg border border-border text-xs font-semibold text-foreground/80 hover:text-foreground bg-secondary hover:bg-secondary/80 transition-colors cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirmReject}
            disabled={!rejectReason.trim()}
            className="px-4 py-2 rounded-lg bg-rose-600 text-white text-xs font-semibold hover:bg-rose-700 transition-colors cursor-pointer disabled:opacity-50"
          >
            Confirm Rejection
          </button>
        </>
      }
    >
      <div className="p-5 space-y-3">
        <textarea
          value={rejectReason}
          onChange={(e) => setRejectReason(e.target.value)}
          rows={3}
          placeholder="e.g. URL is not accessible, missing required response fields, etc."
          className="w-full p-3 rounded-lg border border-border bg-secondary/50 text-foreground text-xs outline-none focus:ring-2 focus:ring-primary/20"
        />
      </div>
    </BaseModal>
  );
};


export default RejectReasonModal;
