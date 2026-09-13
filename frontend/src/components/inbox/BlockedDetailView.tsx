import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  ShieldAlert, 
  Ban, 
  Reply, 
  Ticket, 
  Loader2 
} from 'lucide-react';
import { cn } from '@/lib/utils';
import EmailBodyWithDisclaimer from '@/components/EmailBodyWithDisclaimer';
import { BlockedEmailItem } from './types';
import ManualReplyComposer from './ManualReplyComposer';

interface BlockedDetailViewProps {
  selectedBlockedItem: BlockedEmailItem | null;
  toastMsg?: string;
  onUpdateStatus: (recordId: number, status: 'ignored' | 'replied') => void;
  onCreateTicket: (email: any) => void;
  ticketLoadingId: number | null;
  isReplying: boolean;
  setIsReplying: (val: boolean) => void;
  replyText: string;
  setReplyText: (val: string) => void;
  onSendManualReply: () => void;
  replyLoading: boolean;
}

export const BlockedDetailView: React.FC<BlockedDetailViewProps> = ({
  selectedBlockedItem,
  toastMsg,
  onUpdateStatus,
  onCreateTicket,
  ticketLoadingId,
  isReplying,
  setIsReplying,
  replyText,
  setReplyText,
  onSendManualReply,
  replyLoading
}) => {
  if (!selectedBlockedItem) {
    return (
      <div className="flex-1 rounded-2xl border border-zinc-200 dark:border-white/10 bg-card flex flex-col items-center justify-center p-8 text-center space-y-3">
        <div className="p-3 rounded-2xl bg-rose-500/10">
          <ShieldAlert className="w-8 h-8 text-rose-500" />
        </div>
        <h3 className="text-sm font-semibold text-foreground">Select a blocked email</h3>
        <p className="text-xs text-muted-foreground max-w-sm">
          Emails diverted by blocked keyword filters appear here for manual review and response.
        </p>
      </div>
    );
  }

  return (
    <div className="flex-1 rounded-2xl border border-zinc-200 dark:border-white/10 bg-card flex flex-col overflow-hidden shadow-sm relative">
      {/* Toast Notification */}
      <AnimatePresence>
        {toastMsg && (
          <motion.div 
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="absolute top-4 left-1/2 -translate-x-1/2 bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 px-4 py-2 rounded-xl text-xs font-semibold z-50 shadow-xl"
          >
            {toastMsg}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Blocked Header */}
      <div className="p-5 border-b border-zinc-200 dark:border-white/10 flex flex-col sm:flex-row justify-between sm:items-center gap-3 bg-zinc-50/50 dark:bg-white/[0.01]">
        <div className="space-y-1 min-w-0">
          <h2 className="text-base sm:text-lg font-bold text-foreground truncate flex items-center gap-2">
            <span>{selectedBlockedItem.subject || 'No Subject'}</span>
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20 shrink-0">
              <Ban className="w-3 h-3" /> Keyword: "{selectedBlockedItem.matched_keyword}"
            </span>
          </h2>
          <p className="text-xs text-muted-foreground flex items-center gap-2">
            <span className="font-medium text-foreground">{selectedBlockedItem.from_email}</span>
            <span>•</span>
            <span>Received: {selectedBlockedItem.created_at}</span>
          </p>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2">
          {(!selectedBlockedItem.status || selectedBlockedItem.status === 'pending_review') && (
            <button
              onClick={() => onUpdateStatus(selectedBlockedItem.id, 'ignored')}
              className="px-3 py-1.5 border border-zinc-200 dark:border-white/10 text-muted-foreground hover:text-foreground hover:bg-zinc-100 dark:hover:bg-white/5 rounded-xl text-xs font-semibold transition-all"
            >
              Mark Ignored
            </button>
          )}

          <button 
            onClick={() => setIsReplying(!isReplying)}
            className={cn("px-3 py-1.5 rounded-xl text-xs font-semibold transition-all flex items-center gap-1.5 border", 
              isReplying 
                ? "bg-primary text-primary-foreground border-primary" 
                : "bg-primary/10 border-primary/20 text-primary hover:bg-primary/20"
            )}
          >
            <Reply className="w-3.5 h-3.5" />
            Manual Reply
          </button>

          <button 
            onClick={() => onCreateTicket({
              mailId: selectedBlockedItem.id?.toString(),
              subject: selectedBlockedItem.subject,
              body: selectedBlockedItem.body,
              preview: selectedBlockedItem.body
            })}
            disabled={ticketLoadingId === selectedBlockedItem.id} 
            className="px-3 py-1.5 border border-zinc-200 dark:border-white/10 hover:bg-zinc-100 dark:hover:bg-white/5 text-foreground rounded-xl text-xs font-semibold transition-all flex items-center gap-1"
          >
            {ticketLoadingId === selectedBlockedItem.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Ticket className="w-3 h-3" />}
            Create Ticket
          </button>
        </div>
      </div>

      {/* Blocked Notice Card */}
      <div className="mx-6 mt-4 p-3.5 rounded-xl border border-rose-500/20 bg-rose-500/5 flex items-start gap-3 text-xs">
        <ShieldAlert className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
        <div className="space-y-0.5">
          <span className="font-bold text-rose-600 dark:text-rose-400 text-[11px] uppercase tracking-wider">
            AI Auto-Reply Blocked by Keyword Rule
          </span>
          <p className="text-foreground/90 leading-relaxed font-medium">
            This message triggered keyword filter <strong>"{selectedBlockedItem.matched_keyword}"</strong> and was diverted from automated responses. You can review and reply manually below.
          </p>
        </div>
      </div>

      {/* Message Body */}
      <div className="flex-1 overflow-y-auto p-6 space-y-4">
        <div className="rounded-2xl border border-zinc-200 dark:border-white/10 bg-zinc-50/50 dark:bg-white/[0.02] p-5 space-y-3">
          <div className="flex justify-between items-center pb-2 border-b border-zinc-200/60 dark:border-white/5 text-xs text-muted-foreground">
            <span className="font-semibold text-foreground">{selectedBlockedItem.from_email}</span>
            <span>{selectedBlockedItem.created_at}</span>
          </div>
          <EmailBodyWithDisclaimer content={selectedBlockedItem.body} className="text-sm text-foreground/90" />
        </div>
      </div>

      {/* Manual Reply Drawer */}
      <ManualReplyComposer
        isOpen={isReplying}
        onClose={() => setIsReplying(false)}
        recipient={selectedBlockedItem.from_email}
        replyText={replyText}
        onChangeReplyText={setReplyText}
        onSend={onSendManualReply}
        loading={replyLoading}
        title={`Manual Reply to ${selectedBlockedItem.from_email}`}
        placeholder="Type your manual reply here..."
        sendButtonLabel="Send Reply & Mark Handled"
      />
    </div>
  );
};

export default BlockedDetailView;
