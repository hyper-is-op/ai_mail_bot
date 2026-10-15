import React from 'react';
import { Globe, Plus } from 'lucide-react';
import { BaseModal } from '@/components/common';
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
  return (
    <BaseModal
      isOpen={isOpen}
      onClose={onClose}
      maxWidth="max-w-2xl"
      icon={<Globe className="w-5 h-5" />}
      iconContainerClassName="bg-emerald-500/10 border-emerald-500/20 text-emerald-600 dark:text-emerald-400"
      title="Target URL Allowlist"
      subtitle="Connectors must point to an allowlisted hostname/path before being approved."
    >
      <div className="p-6 space-y-6">
        <form onSubmit={onAddAllowlist} className="flex gap-2">
          <input
            type="url"
            value={newAllowlistUrl}
            onChange={(e) => setNewAllowlistUrl(e.target.value)}
            placeholder="https://api.crm.com or http://localhost:9000/create-ticket"
            required
            className="flex-1 p-2.5 rounded-lg border border-border bg-secondary/40 text-foreground text-xs font-mono outline-none focus:ring-2 focus:ring-primary/20"
          />
          <button
            type="submit"
            className="px-4 py-2.5 rounded-lg bg-emerald-600 text-white font-semibold text-xs hover:bg-emerald-700 flex items-center gap-1.5 cursor-pointer shadow-sm"
          >
            <Plus className="w-4 h-4" />
            <span>Add URL</span>
          </button>
        </form>

        <div className="rounded-xl border border-border overflow-hidden">
          <div className="p-3 bg-secondary/50 border-b border-border font-semibold text-xs text-foreground">
            Allowlisted Endpoints ({allowlist.length})
          </div>
          {allowlistLoading ? (
            <div className="p-8 text-center text-muted-foreground text-xs">Loading allowlist...</div>
          ) : allowlist.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground text-xs">No URLs on allowlist yet.</div>
          ) : (
            <div className="divide-y divide-border text-xs font-mono">
              {allowlist.map((item) => (
                <div key={item.id} className="p-3 flex justify-between items-center hover:bg-secondary/20 transition-colors">
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
    </BaseModal>
  );
};

export default AllowlistModal;

