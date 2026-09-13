import React from 'react';
import { Globe, X, Plus } from 'lucide-react';
import { AllowlistItem } from './types';

interface AllowlistModalProps {
  isOpen: boolean;
  onClose: () => void;
  allowlist: AllowlistItem[];
  allowlistLoading: boolean;
  newAllowlistUrl: string;
  setNewAllowlistUrl: (url: string) => void;
  onAddAllowlist: (e: React.FormEvent) => void;
}

export const AllowlistModal: React.FC<AllowlistModalProps> = ({
  isOpen,
  onClose,
  allowlist,
  allowlistLoading,
  newAllowlistUrl,
  setNewAllowlistUrl,
  onAddAllowlist,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-card w-full max-w-2xl rounded-3xl border border-zinc-200 dark:border-white/10 shadow-2xl p-6 sm:p-8 space-y-6 max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center border-b border-zinc-200 dark:border-white/10 pb-4">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-600">
              <Globe className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-xl font-bold">Target URL Allowlist</h3>
              <p className="text-xs text-muted-foreground">
                Connectors must point to an allowlisted hostname/path before being approved.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl hover:bg-zinc-100 dark:hover:bg-white/5 text-muted-foreground"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={onAddAllowlist} className="flex gap-2">
          <input
            type="url"
            value={newAllowlistUrl}
            onChange={(e) => setNewAllowlistUrl(e.target.value)}
            placeholder="https://api.crm.com or http://localhost:9000/create-ticket"
            required
            className="flex-1 p-2.5 rounded-xl border border-zinc-200 dark:border-white/10 bg-transparent text-xs font-mono outline-none"
          />
          <button
            type="submit"
            className="px-4 py-2.5 rounded-xl bg-emerald-600 text-white font-semibold text-xs hover:bg-emerald-500 flex items-center gap-1.5 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            Add URL
          </button>
        </form>

        <div className="rounded-2xl border border-zinc-200 dark:border-white/10 overflow-hidden">
          <div className="p-3 bg-zinc-50 dark:bg-white/[0.02] border-b border-zinc-200 dark:border-white/10 font-semibold text-xs">
            Allowlisted Endpoints ({allowlist.length})
          </div>
          {allowlistLoading ? (
            <div className="p-8 text-center text-muted-foreground text-xs">Loading allowlist...</div>
          ) : allowlist.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground text-xs">No URLs on allowlist yet.</div>
          ) : (
            <div className="divide-y divide-zinc-200 dark:divide-white/5 text-xs font-mono">
              {allowlist.map((item) => (
                <div key={item.id} className="p-3 flex justify-between items-center">
                  <div className="truncate">
                    <span className="text-emerald-500 font-bold">{item.scheme}://</span>
                    <span className="text-foreground">{item.netloc}</span>
                    <span className="text-muted-foreground">{item.path}</span>
                  </div>
                  <span className="text-[10px] text-muted-foreground font-sans">
                    Added: {new Date(item.created_at).toLocaleDateString()}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AllowlistModal;
