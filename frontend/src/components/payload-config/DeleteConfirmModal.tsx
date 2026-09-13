import React from 'react';
import { Trash2, Loader2 } from 'lucide-react';
import { ConnectorConfig } from './types';

interface DeleteConfirmModalProps {
  connector: ConnectorConfig | null;
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  deleting: boolean;
  isAdmin: boolean;
}

export const DeleteConfirmModal: React.FC<DeleteConfirmModalProps> = ({
  connector,
  isOpen,
  onClose,
  onConfirm,
  deleting,
  isAdmin,
}) => {
  if (!isOpen || !connector) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-card w-full max-w-md rounded-3xl border border-zinc-200 dark:border-white/10 shadow-2xl p-6 space-y-4">
        <h3 className="text-lg font-bold text-rose-600 flex items-center gap-2">
          <Trash2 className="w-5 h-5" />
          {connector.status === 'draft'
            ? 'Delete Draft Connector'
            : connector.status === 'pending_approval'
            ? 'Delete Pending Approval Connector'
            : isAdmin
            ? 'Delete Disabled Connector'
            : 'Request Connector Deletion'}
        </h3>
        <p className="text-xs text-muted-foreground leading-relaxed">
          {connector.status === 'draft' ? (
            <>
              Are you sure you want to permanently delete draft connector{' '}
              <span className="font-semibold text-foreground font-mono">#{connector.id}</span> ({connector.trigger_type})? This action cannot be undone.
            </>
          ) : connector.status === 'pending_approval' ? (
            <>
              Are you sure you want to permanently delete pending approval connector{' '}
              <span className="font-semibold text-foreground font-mono">#{connector.id}</span> ({connector.trigger_type})? This will discard the submitted version and free up the pending slot. This action cannot be undone.
            </>
          ) : connector.status === 'live' ? (
            isAdmin ? (
              <>
                Are you sure you want to permanently delete live connector{' '}
                <span className="font-semibold text-foreground font-mono">#{connector.id}</span> ({connector.trigger_type})? As administrator, this will remove it permanently and immediately stop live webhook execution.
              </>
            ) : (
              <>
                Requesting takedown and deletion of live connector{' '}
                <span className="font-semibold text-foreground font-mono">#{connector.id}</span> ({connector.trigger_type}){' '}
                <strong className="text-foreground">requires administrator approval</strong>. Submitting this will request the administrator to take down and permanently delete this live connector.
              </>
            )
          ) : isAdmin ? (
            <>
              Are you sure you want to permanently delete disabled connector{' '}
              <span className="font-semibold text-foreground font-mono">#{connector.id}</span> ({connector.trigger_type})? As administrator, this will remove it permanently from the database.
            </>
          ) : (
            <>
              Deleting disabled connector{' '}
              <span className="font-semibold text-foreground font-mono">#{connector.id}</span> ({connector.trigger_type}){' '}
              <strong className="text-foreground">requires administrator approval</strong>. Submitting this will send a deletion request to the administrator.
            </>
          )}
        </p>

        <div className="flex justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={onClose}
            disabled={deleting}
            className="px-4 py-2 rounded-xl border border-zinc-200 dark:border-white/10 text-xs font-semibold hover:bg-zinc-100 dark:hover:bg-white/5 transition-all cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={deleting}
            className="px-4 py-2 rounded-xl bg-rose-600 text-white text-xs font-semibold hover:bg-rose-500 transition-all flex items-center gap-1.5 shadow-sm cursor-pointer"
          >
            {deleting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            {connector.status === 'draft' || connector.status === 'pending_approval'
              ? 'Confirm Delete'
              : connector.status === 'live'
              ? isAdmin
                ? 'Permanently Delete Live'
                : 'Submit Takedown & Delete'
              : isAdmin
              ? 'Permanently Delete'
              : 'Submit Deletion Request'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default DeleteConfirmModal;
