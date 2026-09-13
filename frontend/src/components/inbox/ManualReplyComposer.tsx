import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Send, Loader2 } from 'lucide-react';

interface ManualReplyComposerProps {
  isOpen: boolean;
  onClose: () => void;
  recipient: string;
  replyText: string;
  onChangeReplyText: (text: string) => void;
  onSend: () => void;
  loading: boolean;
  title?: string;
  placeholder?: string;
  sendButtonLabel?: string;
}

export const ManualReplyComposer: React.FC<ManualReplyComposerProps> = ({
  isOpen,
  onClose,
  recipient,
  replyText,
  onChangeReplyText,
  onSend,
  loading,
  title,
  placeholder = "Type your manual reply here...",
  sendButtonLabel = "Send Email"
}) => {
  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div 
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: 'auto', opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          className="border-t border-zinc-200 dark:border-white/10 bg-zinc-50/50 dark:bg-white/[0.02] p-4"
        >
          <div className="space-y-3">
            <div className="flex justify-between items-center text-xs">
              <span className="font-semibold text-foreground">
                {title || `Manual Reply to ${recipient}`}
              </span>
              <button 
                type="button" 
                onClick={onClose} 
                className="text-muted-foreground hover:text-foreground p-0.5 rounded transition-colors"
                title="Close reply box"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <textarea 
              value={replyText}
              onChange={(e) => onChangeReplyText(e.target.value)}
              placeholder={placeholder}
              rows={4}
              className="w-full bg-background border border-zinc-200 dark:border-white/10 rounded-xl p-3 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 resize-none font-sans"
            />

            <div className="flex justify-end gap-2">
              <button 
                type="button"
                onClick={onClose}
                className="px-3.5 py-1.5 rounded-xl text-xs font-semibold text-muted-foreground hover:bg-zinc-100 dark:hover:bg-white/5 transition-colors"
              >
                Cancel
              </button>
              <button 
                type="button"
                onClick={onSend}
                disabled={loading || !replyText.trim()}
                className="px-4 py-1.5 bg-primary text-primary-foreground rounded-xl text-xs font-semibold hover:bg-primary/90 transition-all flex items-center gap-1.5 disabled:opacity-50 shadow-sm"
              >
                {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                {sendButtonLabel}
              </button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default ManualReplyComposer;
