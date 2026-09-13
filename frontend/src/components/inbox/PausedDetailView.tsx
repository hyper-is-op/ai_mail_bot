import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  PlayCircle, 
  PauseCircle, 
  Reply, 
  Ticket, 
  Loader2 
} from 'lucide-react';
import { cn } from '@/lib/utils';
import EmailBodyWithDisclaimer from '@/components/EmailBodyWithDisclaimer';
import { PausedEmailItem } from './types';
import ManualReplyComposer from './ManualReplyComposer';

interface PausedDetailViewProps {
  selectedPausedItem: PausedEmailItem | null;
  toastMsg?: string;
  onPauseToggle: (email: string) => void;
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

export const PausedDetailView: React.FC<PausedDetailViewProps> = ({
  selectedPausedItem,
  toastMsg,
  onPauseToggle,
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
  if (!selectedPausedItem) {
    return (
      <div className="flex-1 rounded-2xl border border-zinc-200 dark:border-white/10 bg-card flex flex-col items-center justify-center p-8 text-center space-y-3">
        <div className="p-3 rounded-2xl bg-amber-500/10">
          <PauseCircle className="w-8 h-8 text-amber-500" />
        </div>
        <h3 className="text-sm font-semibold text-foreground">Select a paused email</h3>
        <p className="text-xs text-muted-foreground max-w-sm">
          Incoming emails from paused contacts are collected here for your review and manual dispatch.
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

      {/* Paused Header */}
      <div className="p-5 border-b border-zinc-200 dark:border-white/10 flex flex-col sm:flex-row justify-between sm:items-center gap-3 bg-zinc-50/50 dark:bg-white/[0.01]">
        <div className="space-y-1 min-w-0">
          <h2 className="text-base sm:text-lg font-bold text-foreground truncate">
            {selectedPausedItem.subject || 'No Subject'}
          </h2>
          <p className="text-xs text-muted-foreground flex items-center gap-2">
            <span className="font-medium text-foreground">{selectedPausedItem.from_email}</span>
            <span>•</span>
            <span>Received: {selectedPausedItem.created_at}</span>
          </p>
        </div>

        {/* Actions Toolbar */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => onPauseToggle(selectedPausedItem.from_email)}
            className="px-3 py-1.5 border border-amber-500/30 bg-amber-500/10 hover:bg-amber-500/20 text-amber-600 dark:text-amber-400 rounded-xl text-xs font-semibold transition-all flex items-center gap-1.5"
            title="Resume automated bot replies for this sender"
          >
            <PlayCircle className="w-3.5 h-3.5" />
            Resume Bot
          </button>

          {(!selectedPausedItem.status || selectedPausedItem.status === 'pending_review') && (
            <button
              onClick={() => onUpdateStatus(selectedPausedItem.id, 'ignored')}
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
              mailId: selectedPausedItem.id?.toString(),
              subject: selectedPausedItem.subject,
              body: selectedPausedItem.body,
              preview: selectedPausedItem.body
            })}
            disabled={ticketLoadingId === selectedPausedItem.id} 
            className="px-3 py-1.5 border border-zinc-200 dark:border-white/10 hover:bg-zinc-100 dark:hover:bg-white/5 text-foreground rounded-xl text-xs font-semibold transition-all flex items-center gap-1"
          >
            {ticketLoadingId === selectedPausedItem.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Ticket className="w-3 h-3" />}
            Create Ticket
          </button>
        </div>
      </div>

      {/* Paused Notice Card */}
      <div className="mx-6 mt-4 p-3.5 rounded-xl border border-amber-500/20 bg-amber-500/5 flex items-start gap-3 text-xs">
        <PauseCircle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
        <div className="space-y-0.5">
          <span className="font-bold text-amber-600 dark:text-amber-400 text-[11px] uppercase tracking-wider">
            Incoming Email Routed While Paused
          </span>
          <p className="text-foreground/90 leading-relaxed font-medium">
            Auto-replies for <strong>{selectedPausedItem.from_email}</strong> were paused when this message arrived. Send a manual reply below or click <strong>Resume Bot</strong> to re-enable automation.
          </p>
        </div>
      </div>

      {/* Message Body */}
      <div className="flex-1 overflow-y-auto p-6 space-y-4">
        <div className="rounded-2xl border border-zinc-200 dark:border-white/10 bg-zinc-50/50 dark:bg-white/[0.02] p-5 space-y-3">
          <div className="flex justify-between items-center pb-2 border-b border-zinc-200/60 dark:border-white/5 text-xs text-muted-foreground">
            <span className="font-semibold text-foreground">{selectedPausedItem.from_email}</span>
            <span>{selectedPausedItem.created_at}</span>
          </div>
          <EmailBodyWithDisclaimer content={selectedPausedItem.body} className="text-sm text-foreground/90" />
        </div>
      </div>

      {/* Manual Reply Drawer */}
      <ManualReplyComposer
        isOpen={isReplying}
        onClose={() => setIsReplying(false)}
        recipient={selectedPausedItem.from_email}
        replyText={replyText}
        onChangeReplyText={setReplyText}
        onSend={onSendManualReply}
        loading={replyLoading}
        title={`Manual Reply to ${selectedPausedItem.from_email}`}
        placeholder="Type your manual reply here..."
        sendButtonLabel="Send Reply & Mark Handled"
      />
    </div>
  );
};

export default PausedDetailView;
