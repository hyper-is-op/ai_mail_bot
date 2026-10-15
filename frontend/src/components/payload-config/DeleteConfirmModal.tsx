import React from 'react';
import { Trash2, Loader2 } from 'lucide-react';
import { BaseModal } from '@/components/common';
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
  if (!connector) return null;

  const title =
    connector.status === 'draft'
      ? 'Delete Draft Connector'
      : connector.status === 'pending_approval'
      ? 'Delete Pending Approval Connector'
      : isAdmin
      ? 'Delete Disabled Connector'
      : 'Request Connector Deletion';

  return (
    <BaseModal
      isOpen={isOpen}
      onClose={onClose}
      closeOnBackdropClick={!deleting}
      closeOnEscape={!deleting}
      maxWidth="max-w-md"
      icon={<Trash2 className="w-5 h-5" />}
      iconContainerClassName="bg-rose-500/10 border-rose-500/20 text-rose-500"
      title={title}
      subtitle={
        <span>
          Target Connector <span className="font-semibold text-foreground font-mono">#{connector.id}</span> ({connector.trigger_type})
        </span>
      }
      footer={
        <>
          <button
            type="button"
            onClick={onClose}
            disabled={deleting}
            className="px-4 py-2 text-xs font-semibold text-foreground/80 hover:text-foreground bg-secondary hover:bg-secondary/80 rounded-lg border border-border transition-colors cursor-pointer disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={deleting}
            className="px-4 py-2 text-xs font-semibold bg-rose-600 hover:bg-rose-700 text-white rounded-lg shadow-sm transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
          >
            {deleting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            <span>
              {connector.status === 'draft' || connector.status === 'pending_approval'
                ? 'Confirm Delete'
                : connector.status === 'live'
                ? isAdmin
                  ? 'Permanently Delete Live'
                  : 'Submit Takedown & Delete'
                : isAdmin
                ? 'Permanently Delete'
                : 'Submit Deletion Request'}
            </span>
          </button>
        </>
      }
    >
      <div className="p-5 space-y-4">
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
      </div>
    </BaseModal>
  );
};

export default DeleteConfirmModal;

