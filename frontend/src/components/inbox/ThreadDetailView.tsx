import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Reply, 
  Ticket, 
  Loader2, 
  Inbox as InboxIcon, 
  Bot, 
  Sparkles, 
  PauseCircle, 
  PlayCircle, 
  RotateCcw,
  ChevronRight,
  Smile,
  Meh,
  Frown,
  Code2,
  FileText,
  Megaphone,
  Shield,
  AlertCircle
} from 'lucide-react';
import { cn } from '@/lib/utils';
import EmailBodyWithDisclaimer from '@/components/EmailBodyWithDisclaimer';
import { ThreadItem, sanitizeSandboxedHtml } from './types';
import ManualReplyComposer from './ManualReplyComposer';

interface ThreadDetailViewProps {
  selectedThread: ThreadItem | null;
  toastMsg?: string;
  isSenderMarketing: (email: string) => boolean;
  onToggleMarketingSender: (email: string) => void;
  pausedEmails: string[];
  onPauseToggle: (email: string) => void;
  isReplying: boolean;
  setIsReplying: (val: boolean) => void;
  onClearHistory: (senderEmail: string) => void;
  viewHtmlMode: Record<number, boolean>;
  setViewHtmlMode: React.Dispatch<React.SetStateAction<Record<number, boolean>>>;
  showTraceFor: number | null;
  setShowTraceFor: React.Dispatch<React.SetStateAction<number | null>>;
  onCreateTicket: (email: any) => void;
  ticketLoadingId: number | null;
  replyText: string;
  setReplyText: (val: string) => void;
  onSendManualReply: () => void;
  replyLoading: boolean;
}

export const ThreadDetailView: React.FC<ThreadDetailViewProps> = ({
  selectedThread,
  toastMsg,
  isSenderMarketing,
  onToggleMarketingSender,
  pausedEmails,
  onPauseToggle,
  isReplying,
  setIsReplying,
  onClearHistory,
  viewHtmlMode,
  setViewHtmlMode,
  showTraceFor,
  setShowTraceFor,
  onCreateTicket,
  ticketLoadingId,
  replyText,
  setReplyText,
  onSendManualReply,
  replyLoading
}) => {
  if (!selectedThread) {
    return (
      <div className="flex-1 rounded-2xl border border-zinc-200 dark:border-white/10 bg-card flex flex-col items-center justify-center p-8 text-center space-y-3">
        <div className="p-3 rounded-2xl bg-zinc-100 dark:bg-white/5">
          <InboxIcon className="w-8 h-8 text-muted-foreground/60" />
        </div>
        <h3 className="text-sm font-semibold text-foreground">Select a conversation</h3>
        <p className="text-xs text-muted-foreground max-w-sm">
          Choose an email thread on the left to read messages, inspect AI decisions, or send manual replies.
        </p>
      </div>
    );
  }

  const isSenderPaused = pausedEmails.includes(selectedThread.sender);
  const isMarketing = isSenderMarketing(selectedThread.sender);

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

      {/* Conversation Header */}
      <div className="p-5 border-b border-zinc-200 dark:border-white/10 flex flex-col sm:flex-row justify-between sm:items-center gap-3 bg-zinc-50/50 dark:bg-white/[0.01]">
        <div className="space-y-1 min-w-0">
          <h2 className="text-base sm:text-lg font-bold text-foreground truncate">
            {selectedThread.subject}
          </h2>
          <p className="text-xs text-muted-foreground flex items-center gap-2">
            <span className="font-medium text-foreground">{selectedThread.sender}</span>
            <span>•</span>
            <span>{selectedThread.emails.length} {selectedThread.emails.length === 1 ? 'message' : 'messages'}</span>
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2">
          <button 
            type="button"
            onClick={() => onToggleMarketingSender(selectedThread.sender)}
            className={cn("px-3 py-1.5 border rounded-xl text-xs font-semibold transition-all flex items-center gap-1.5",
              isMarketing 
                ? "bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-500/30 hover:bg-sky-500/20" 
                : "border-zinc-200 dark:border-white/10 text-muted-foreground hover:text-foreground hover:bg-zinc-100 dark:hover:bg-white/5"
            )}
            title={isMarketing ? "Sender is marked as Marketing (click to unmark)" : "Mark sender as Marketing / Promotional"}
          >
            <Megaphone className="w-3.5 h-3.5" />
            {isMarketing ? "Marked Marketing" : "Mark as Marketing"}
          </button>

          <button 
            type="button"
            onClick={() => onPauseToggle(selectedThread.sender)}
            className={cn("px-3 py-1.5 border rounded-xl text-xs font-semibold transition-all flex items-center gap-1.5",
              isSenderPaused 
                ? "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30 hover:bg-amber-500/20" 
                : "border-zinc-200 dark:border-white/10 text-muted-foreground hover:text-foreground hover:bg-zinc-100 dark:hover:bg-white/5"
            )}
          >
            {isSenderPaused ? <PlayCircle className="w-3.5 h-3.5" /> : <PauseCircle className="w-3.5 h-3.5" />}
            {isSenderPaused ? "Resume Bot" : "Pause Bot"}
          </button>

          <button 
            type="button"
            onClick={() => setIsReplying(!isReplying)}
            className={cn("px-3 py-1.5 rounded-xl text-xs font-semibold transition-all flex items-center gap-1.5 border", 
              isReplying 
                ? "bg-primary text-primary-foreground border-primary" 
                : "border-zinc-200 dark:border-white/10 hover:bg-zinc-100 dark:hover:bg-white/5 text-foreground"
            )}
          >
            <Reply className="w-3.5 h-3.5" />
            Manual Reply
          </button>

          <button 
            type="button"
            onClick={() => onClearHistory(selectedThread.sender)}
            className="p-1.5 border border-zinc-200 dark:border-white/10 hover:bg-rose-500/10 hover:text-rose-600 rounded-xl text-muted-foreground transition-all"
            title="Reset conversation context memory"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Paused Mode Callout */}
      {isSenderPaused && (
        <div className="mx-6 mt-4 p-3.5 rounded-xl border border-amber-500/20 bg-amber-500/5 flex items-center justify-between text-xs">
          <div className="flex items-center gap-2 text-amber-700 dark:text-amber-300">
            <PauseCircle className="w-4 h-4 text-amber-500 shrink-0" />
            <span>Auto-replies are paused for this contact. Use <strong>Manual Reply</strong> to respond directly.</span>
          </div>
          <button
            type="button"
            onClick={() => setIsReplying(true)}
            className="px-3 py-1 bg-amber-500 text-white rounded-lg font-semibold hover:bg-amber-600 transition-all text-xs"
          >
            Reply Now
          </button>
        </div>
      )}

      {/* Pending Review / Failed Alert Callout */}
      {(selectedThread.status === 'Pending Review' || selectedThread.status === 'Failed') && (
        <div className="mx-6 mt-4 p-3.5 rounded-xl border border-amber-500/30 bg-amber-500/10 flex items-center justify-between text-xs">
          <div className="flex items-center gap-2 text-amber-800 dark:text-amber-300">
            <AlertCircle className="w-4 h-4 text-amber-500 shrink-0" />
            <span>
              <strong>Manual Review Required:</strong> Automated escalation could not complete (CRM ticket creation failed or needs review). Please inspect and send a manual reply.
            </span>
          </div>
          <button
            type="button"
            onClick={() => setIsReplying(true)}
            className="px-3 py-1 bg-amber-500 hover:bg-amber-600 text-white rounded-lg font-semibold transition-all text-xs shrink-0 ml-3"
          >
            Reply Now
          </button>
        </div>
      )}

      {/* Quick Summary Bar (TL;DR if present) */}
      {selectedThread.latest_email.summary && (
        <div className="mx-6 mt-4 p-3.5 rounded-xl border border-primary/20 bg-primary/5 flex items-start gap-3 text-xs">
          <Sparkles className="w-4 h-4 text-primary shrink-0 mt-0.5" />
          <div className="space-y-0.5">
            <span className="font-bold text-primary text-[11px] uppercase tracking-wider">Conversation Summary</span>
            <p className="text-foreground/90 leading-relaxed font-medium">
              {selectedThread.latest_email.summary}
            </p>
          </div>
        </div>
      )}

      {/* Messages Stream */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {selectedThread.emails.map((email, index) => {
          const isTraceOpen = showTraceFor === email.id;
          const hasReply = !!email.reply;

          const bodyText = (email.body || email.preview || '');
          const hasHtmlContent = Boolean(
            email.body_html || 
            (bodyText && (
              bodyText.includes('<!DOCTYPE') ||
              bodyText.includes('<html') ||
              bodyText.includes('<table') ||
              bodyText.includes('<div') ||
              bodyText.includes('<p')
            ))
          );
          const showHtml = hasHtmlContent && (viewHtmlMode[email.id] !== undefined ? viewHtmlMode[email.id] : true);

          return (
            <div key={email.id} className="space-y-3 text-xs">
              {/* Customer Message Box */}
              <div className="rounded-2xl border border-zinc-200 dark:border-white/10 bg-zinc-50/50 dark:bg-white/[0.02] p-4 sm:p-5 space-y-3">
                <div className="flex justify-between items-center pb-2 border-b border-zinc-200/60 dark:border-white/5">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-[10px]">
                      {index + 1}
                    </div>
                    <span className="font-semibold text-foreground">{email.sender}</span>
                  </div>
                  
                  <div className="flex items-center gap-3 text-muted-foreground text-[11px]">
                    <span>{email.date_str} {email.time}</span>
                    <div className="flex items-center gap-1.5 font-medium">
                      {/* HTML vs Clean Text Toggle Button */}
                      {hasHtmlContent && (
                        <button
                          type="button"
                          onClick={() => setViewHtmlMode(prev => ({ ...prev, [email.id]: !(prev[email.id] !== undefined ? prev[email.id] : true) }))}
                          className={cn(
                            "inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold border transition-colors",
                            showHtml 
                              ? "border-sky-500/30 bg-sky-500/10 text-sky-600 dark:text-sky-400 hover:bg-sky-500/20"
                              : "border-zinc-300 dark:border-white/10 hover:bg-zinc-200 dark:hover:bg-white/10 text-foreground"
                          )}
                          title="Toggle between original rendered HTML email and clean text"
                        >
                          {showHtml ? (
                            <>
                              <FileText className="w-3 h-3 text-sky-500" />
                              <span>Clean Text</span>
                            </>
                          ) : (
                            <>
                              <Code2 className="w-3 h-3 text-sky-500" />
                              <span>Original HTML</span>
                            </>
                          )}
                        </button>
                      )}

                      <span className="px-2 py-0.5 rounded bg-zinc-200 dark:bg-white/10 text-[10px]">
                        {email.priority || 'Medium'}
                      </span>
                      {email.sentiment && (
                        <span className={cn(
                          "inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold border",
                          email.sentiment === 'Angry' ? 'bg-rose-500/10 text-rose-500 border-rose-500/20' :
                          email.sentiment === 'Happy' ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' :
                          'bg-zinc-500/10 text-zinc-400 border-zinc-500/20'
                        )}>
                          {email.sentiment === 'Angry' ? <Frown className="w-2.5 h-2.5" /> :
                           email.sentiment === 'Happy' ? <Smile className="w-2.5 h-2.5" /> :
                           <Meh className="w-2.5 h-2.5" />}
                          {email.sentiment}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Customer Message Body (Defaults to Original HTML iframe when available, with Clean Text toggle) */}
                {(() => {
                  if (showHtml) {
                    const rawContent = email.body_html || email.body || email.preview || '';
                    const sanitizedContent = sanitizeSandboxedHtml(rawContent);

                    return (
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between text-[10px] text-muted-foreground px-1">
                          <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-medium">
                            <Shield className="w-3 h-3" />
                            Sandboxed Secure View (Scripts &amp; Active Content Blocked)
                          </span>
                        </div>
                        <div className="rounded-xl overflow-hidden border border-zinc-200 dark:border-white/10 bg-white shadow-sm">
                          <iframe
                            srcDoc={sanitizedContent}
                            sandbox="allow-popups allow-popups-to-escape-sandbox"
                            className="w-full min-h-[480px] bg-white border-0"
                            title="Sandboxed Original HTML Email View"
                          />
                        </div>
                      </div>
                    );
                  }

                  return (
                    <EmailBodyWithDisclaimer content={email.body || email.preview} className="text-sm text-foreground/90" />
                  );
                })()}

                {/* Message Utilities Bar */}
                <div className="flex flex-wrap items-center justify-between gap-2 pt-2 text-[11px] text-muted-foreground border-t border-zinc-200/40 dark:border-white/5">
                  <div className="flex items-center gap-2">
                    {email.confidence && (
                      <span className="font-mono">AI Confidence: {email.confidence}</span>
                    )}
                    {email.execution_steps && email.execution_steps.length > 0 && (
                      <button
                        type="button"
                        onClick={() => setShowTraceFor(isTraceOpen ? null : email.id)}
                        className="text-primary hover:underline font-medium flex items-center gap-0.5"
                      >
                        <span>Trace ({email.execution_steps.length} steps)</span>
                        <ChevronRight className={cn("w-3 h-3 transition-transform", isTraceOpen ? "rotate-90" : "")} />
                      </button>
                    )}
                  </div>

                  <button 
                    type="button"
                    onClick={() => onCreateTicket(email)}
                    disabled={ticketLoadingId === email.id || email.status === 'Ticket_Generated'} 
                    className="px-2.5 py-1 text-xs font-semibold rounded-lg border border-zinc-200 dark:border-white/10 hover:bg-zinc-100 dark:hover:bg-white/5 text-foreground transition-all flex items-center gap-1 disabled:opacity-50"
                  >
                    {ticketLoadingId === email.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Ticket className="w-3 h-3" />}
                    {email.status === 'Ticket_Generated' ? 'Ticket Generated' : 'Create Ticket'}
                  </button>
                </div>

                {/* Execution Steps Drawer */}
                {isTraceOpen && email.execution_steps && (
                  <div className="p-3 rounded-xl bg-zinc-100 dark:bg-black/30 border border-zinc-200 dark:border-white/5 space-y-2 text-[11px]">
                    <span className="font-semibold text-muted-foreground text-[10px] uppercase">Bot Decision Path</span>
                    <div className="flex flex-wrap gap-1.5">
                      {email.execution_steps.map((step: string, sIdx: number) => (
                        <span key={sIdx} className="px-2 py-0.5 rounded-md bg-zinc-200 dark:bg-white/10 font-mono text-[10px]">
                          {sIdx + 1}. {step}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Bot Reply Card (if generated) */}
              {hasReply && (
                <div className="ml-4 sm:ml-8 rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-4 sm:p-5 space-y-2">
                  <div className="flex items-center justify-between text-emerald-600 dark:text-emerald-400 font-semibold text-xs pb-1">
                    <div className="flex items-center gap-1.5">
                      <Bot className="w-4 h-4" />
                      <span>AI Auto-Reply</span>
                    </div>
                    <span className="text-[10px] font-mono opacity-80">Sent Resolution</span>
                  </div>

                  <EmailBodyWithDisclaimer content={email.reply} className="text-sm text-foreground/90" />
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Manual Reply Drawer */}
      <ManualReplyComposer
        isOpen={isReplying}
        onClose={() => setIsReplying(false)}
        recipient={selectedThread.sender}
        replyText={replyText}
        onChangeReplyText={setReplyText}
        onSend={onSendManualReply}
        loading={replyLoading}
        title={`Manual Reply to ${selectedThread.sender}`}
        placeholder="Write your email response..."
        sendButtonLabel="Send Email"
      />
    </div>
  );
};

export default ThreadDetailView;
