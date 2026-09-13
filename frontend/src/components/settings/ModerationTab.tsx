import React from 'react';
import { Shield, Megaphone, Loader2, Plus } from 'lucide-react';

interface ModerationTabProps {
  keywords: string[];
  newKeyword: string;
  setNewKeyword: (val: string) => void;
  keywordSaving: boolean;
  handleAddKeyword: (e: React.FormEvent) => void;
  handleDeleteKeyword: (kw: string) => void;
  marketingSenders: string[];
  newMarketingSender: string;
  setNewMarketingSender: (val: string) => void;
  marketingLoading: boolean;
  marketingSaving: boolean;
  handleAddMarketingSender: (e: React.FormEvent) => void;
  handleDeleteMarketingSender: (sender: string) => void;
}

export const ModerationTab: React.FC<ModerationTabProps> = ({
  keywords,
  newKeyword,
  setNewKeyword,
  keywordSaving,
  handleAddKeyword,
  handleDeleteKeyword,
  marketingSenders,
  newMarketingSender,
  setNewMarketingSender,
  marketingLoading,
  marketingSaving,
  handleAddMarketingSender,
  handleDeleteMarketingSender,
}) => {
  return (
    <div className="space-y-6">
      {/* Blocked Keywords Card */}
      <div className="glass-panel p-6 rounded-2xl border border-white/10 space-y-4">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-400">
            <Shield className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-bold text-zinc-900 dark:text-white">Blocked Keywords</h3>
            <p className="text-xs text-zinc-400">
              Emails containing any of these keywords will be blocked from automated AI replies and routed to the Inbox Blocked tab.
            </p>
          </div>
        </div>

        <form onSubmit={handleAddKeyword} className="flex gap-2">
          <input
            type="text"
            required
            placeholder="e.g. refund, cancel, payment, legal"
            value={newKeyword}
            onChange={(e) => setNewKeyword(e.target.value)}
            className="flex-1 bg-white/5 border border-white/10 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-primary"
          />
          <button
            disabled={keywordSaving}
            type="submit"
            className="bg-primary text-primary-foreground text-xs font-semibold px-4 py-2 rounded-xl flex items-center gap-1 hover:bg-primary/90 transition-all shadow-sm"
          >
            Add Keyword
          </button>
        </form>

        {keywords.length > 0 ? (
          <div className="flex flex-wrap gap-2 pt-2 max-h-60 overflow-y-auto pr-1">
            {keywords.map((kw) => (
              <span
                key={kw}
                className="inline-flex items-center gap-1.5 bg-white/5 border border-white/10 rounded-full px-3 py-1 text-xs text-zinc-300"
              >
                <span>{kw}</span>
                <button
                  type="button"
                  onClick={() => handleDeleteKeyword(kw)}
                  className="text-zinc-500 hover:text-rose-400 transition-colors text-sm font-bold"
                >
                  &times;
                </button>
              </span>
            ))}
          </div>
        ) : (
          <p className="text-xs text-muted-foreground text-center py-6 border border-dashed border-white/10 rounded-xl">
            No keywords defined. All messages pass through to automated replies.
          </p>
        )}
      </div>

      {/* Marketing & Promotional Senders Card */}
      <div className="glass-panel p-6 rounded-2xl border border-white/10 space-y-4">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-lg bg-sky-500/10 border border-sky-500/20 text-sky-400">
            <Megaphone className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-bold text-zinc-900 dark:text-white">Marketing &amp; Promotional Senders</h3>
            <p className="text-xs text-zinc-400">
              Senders or domain patterns added here will be automatically classified as Marketing / Promotional. Incoming emails from these senders will completely bypass AI reply processing, draft creation, and ticket generation.
            </p>
          </div>
        </div>

        <form onSubmit={handleAddMarketingSender} className="flex gap-2">
          <input
            type="text"
            required
            placeholder="e.g. newsletter@partner.com, @mail.internshala.com, or promo-alerts"
            value={newMarketingSender}
            onChange={(e) => setNewMarketingSender(e.target.value)}
            className="flex-1 bg-white/5 border border-white/10 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-primary"
          />
          <button
            disabled={marketingSaving}
            type="submit"
            className="bg-primary text-primary-foreground text-xs font-semibold px-4 py-2 rounded-xl flex items-center gap-1 hover:bg-primary/90 transition-all shadow-sm"
          >
            {marketingSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
            Add Sender
          </button>
        </form>

        {marketingLoading ? (
          <div className="py-4 flex justify-center">
            <Loader2 className="w-5 h-5 text-primary animate-spin" />
          </div>
        ) : marketingSenders.length > 0 ? (
          <div className="flex flex-wrap gap-2 pt-2 max-h-60 overflow-y-auto pr-1">
            {marketingSenders.map((sender) => (
              <span
                key={sender}
                className="inline-flex items-center gap-1.5 bg-sky-500/10 border border-sky-500/20 rounded-full px-3 py-1 text-xs text-sky-300"
              >
                <span>{sender}</span>
                <button
                  type="button"
                  onClick={() => handleDeleteMarketingSender(sender)}
                  className="text-zinc-500 hover:text-rose-400 transition-colors text-sm font-bold ml-1 cursor-pointer"
                  title="Remove Sender"
                >
                  &times;
                </button>
              </span>
            ))}
          </div>
        ) : (
          <p className="text-xs text-muted-foreground text-center py-6 border border-dashed border-white/10 rounded-xl">
            No marketing senders configured. You can add specific email addresses or domains above.
          </p>
        )}
      </div>
    </div>
  );
};
