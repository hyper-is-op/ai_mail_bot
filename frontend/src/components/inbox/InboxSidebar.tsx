import React from 'react';
import { 
  Search, 
  RefreshCw, 
  Inbox as InboxIcon, 
  PauseCircle, 
  PlayCircle, 
  ShieldAlert, 
  CheckCheck, 
  Ban, 
  Filter, 
  Smile, 
  Meh, 
  Frown 
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { 
  ThreadItem, 
  PausedEmailItem, 
  BlockedEmailItem, 
  InboxTabType, 
  getCleanSnippet 
} from './types';

interface InboxSidebarProps {
  isAdmin: boolean;
  clients: any[];
  selectedClientId: string;
  onSelectClientId: (id: string) => void;
  onRefresh: () => void;
  activeTab: InboxTabType;
  setActiveTab: (tab: InboxTabType) => void;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  groupedThreads: ThreadItem[];
  filteredThreads: ThreadItem[];
  selectedThread: ThreadItem | null;
  onSelectThread: (thread: ThreadItem) => void;
  filteredPausedHistory: PausedEmailItem[];
  selectedPausedItem: PausedEmailItem | null;
  onSelectPausedItem: (item: PausedEmailItem) => void;
  filteredBlockedEmails: BlockedEmailItem[];
  selectedBlockedItem: BlockedEmailItem | null;
  onSelectBlockedItem: (item: BlockedEmailItem) => void;
  pausedEmails: string[];
  onBulkIgnoreBlocked: () => void;
  onResumeAllPaused: () => void;
  counts: {
    marketing: number;
    failed: number;
    pendingReview: number;
    paused: number;
    blocked: number;
  };
  onResetReplyState: () => void;
}

export const InboxSidebar: React.FC<InboxSidebarProps> = ({
  isAdmin,
  clients,
  selectedClientId,
  onSelectClientId,
  onRefresh,
  activeTab,
  setActiveTab,
  searchQuery,
  setSearchQuery,
  groupedThreads,
  filteredThreads,
  selectedThread,
  onSelectThread,
  filteredPausedHistory,
  selectedPausedItem,
  onSelectPausedItem,
  filteredBlockedEmails,
  selectedBlockedItem,
  onSelectBlockedItem,
  pausedEmails,
  onBulkIgnoreBlocked,
  onResumeAllPaused,
  counts,
  onResetReplyState
}) => {
  const handleTabChange = (tab: InboxTabType) => {
    setActiveTab(tab);
    onResetReplyState();
  };

  return (
    <div className="w-full md:w-[380px] lg:w-[420px] flex-shrink-0 rounded-2xl border border-zinc-200 dark:border-white/10 bg-card flex flex-col overflow-hidden shadow-sm">
      {/* Sidebar Header */}
      <div className="p-4 border-b border-zinc-200 dark:border-white/10 space-y-3 bg-zinc-50/50 dark:bg-white/[0.02]">
        <div className="flex justify-between items-center">
          <h2 className="text-base font-bold tracking-tight">Mail (Monitor/Control)</h2>
          <button 
            onClick={onRefresh} 
            className="p-1.5 rounded-lg hover:bg-zinc-200 dark:hover:bg-white/10 text-muted-foreground hover:text-foreground transition-colors" 
            title="Refresh"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>

        {isAdmin && clients.length > 0 && (
          <div className="flex items-center gap-2 bg-zinc-100 dark:bg-white/5 border border-zinc-200 dark:border-white/10 rounded-xl px-2.5 py-1.5 text-xs">
            <span className="text-muted-foreground font-semibold text-[11px]">Client:</span>
            <select
              value={selectedClientId}
              onChange={(e) => onSelectClientId(e.target.value)}
              className="bg-transparent font-medium text-foreground focus:outline-none cursor-pointer flex-1 text-xs"
            >
              <option value="ALL" className="dark:bg-zinc-900">All Clients</option>
              {clients.map((c) => (
                <option key={c.client_id} value={c.client_id} className="dark:bg-zinc-900">
                  {c.client_id} {c.company_name ? `(${c.company_name})` : ''}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Filter & Search Bar */}
        <div className="flex items-center gap-2">
          {/* View Filter Dropdown */}
          <div className="flex items-center gap-1.5 bg-zinc-100 dark:bg-white/5 border border-zinc-200 dark:border-white/10 rounded-xl px-2.5 py-1.5 text-xs shrink-0">
            <Filter className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
            <select
              value={activeTab}
              onChange={(e) => handleTabChange(e.target.value as InboxTabType)}
              className="bg-transparent font-semibold text-foreground focus:outline-none cursor-pointer text-xs pr-1"
            >
              <option value="All" className="dark:bg-zinc-900">All ({groupedThreads.length})</option>
              <option value="Marketing" className="dark:bg-zinc-900">
                Marketing {counts.marketing > 0 ? `(${counts.marketing})` : ''}
              </option>
              <option value="Replied" className="dark:bg-zinc-900">Replied</option>
              <option value="Processing" className="dark:bg-zinc-900">Processing</option>
              <option value="Failed" className="dark:bg-zinc-900">
                Failed {counts.failed > 0 ? `(${counts.failed})` : ''}
              </option>
              <option value="Pending Review" className="dark:bg-zinc-900">
                Pending Review {counts.pendingReview > 0 ? `(${counts.pendingReview})` : ''}
              </option>
              <option value="Paused" className="dark:bg-zinc-900">
                Paused {counts.paused > 0 ? `(${counts.paused})` : ''}
              </option>
              <option value="Blocked" className="dark:bg-zinc-900">
                Blocked {counts.blocked > 0 ? `(${counts.blocked})` : ''}
              </option>
            </select>
          </div>

          {/* Search bar */}
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
            <input 
              type="text" 
              placeholder={
                activeTab === 'Blocked' 
                  ? "Search blocked..." 
                  : activeTab === 'Paused'
                  ? "Search paused..."
                  : "Search..."
              }
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-zinc-100 dark:bg-white/5 border border-zinc-200 dark:border-white/10 rounded-xl pl-8 pr-2.5 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-primary" 
            />
          </div>
        </div>

        {/* Quick Filter Section Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pt-1 text-[11px]">
          {(['All', 'Failed', 'Pending Review', 'Replied'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => handleTabChange(tab)}
              className={cn(
                "px-2.5 py-1 rounded-lg font-medium transition-all shrink-0 flex items-center gap-1",
                activeTab === tab
                  ? tab === 'Failed' 
                    ? "bg-rose-500/20 text-rose-600 dark:text-rose-400 font-semibold border border-rose-500/30"
                    : tab === 'Pending Review'
                    ? "bg-amber-500/20 text-amber-600 dark:text-amber-400 font-semibold border border-amber-500/30"
                    : "bg-primary text-primary-foreground font-semibold shadow-xs"
                  : "bg-zinc-100 dark:bg-white/5 text-muted-foreground hover:text-foreground border border-transparent"
              )}
            >
              <span>{tab}</span>
              {tab === 'Failed' && counts.failed > 0 && (
                <span className="px-1.5 py-0.2 rounded-full text-[9px] bg-rose-500 text-white font-bold">
                  {counts.failed}
                </span>
              )}
              {tab === 'Pending Review' && counts.pendingReview > 0 && (
                <span className="px-1.5 py-0.2 rounded-full text-[9px] bg-amber-500 text-white font-bold">
                  {counts.pendingReview}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Paused Banner with Resume All */}
      {activeTab === 'Paused' && (
        <div className="px-4 py-2 bg-amber-500/10 border-b border-amber-500/20 text-[11px] text-amber-700 dark:text-amber-300 flex items-center justify-between">
          <div className="flex items-center gap-1.5 font-medium">
            <PauseCircle className="w-3.5 h-3.5 text-amber-500" />
            <span>{pausedEmails.length} sender(s) paused • {counts.paused} pending review</span>
          </div>
          {pausedEmails.length > 0 && (
            <button
              onClick={onResumeAllPaused}
              className="text-[10px] px-2 py-0.5 rounded bg-amber-500/20 hover:bg-amber-500/30 text-amber-700 dark:text-amber-300 font-semibold transition-all flex items-center gap-1"
              title="Resume auto-replies for all paused contacts"
            >
              <PlayCircle className="w-3 h-3" />
              Resume All
            </button>
          )}
        </div>
      )}

      {/* Blocked Banner with Bulk Ignore */}
      {activeTab === 'Blocked' && (
        <div className="px-4 py-2 bg-rose-500/10 border-b border-rose-500/20 text-[11px] text-rose-700 dark:text-rose-300 flex items-center justify-between">
          <div className="flex items-center gap-1.5 font-medium">
            <ShieldAlert className="w-3.5 h-3.5 text-rose-500" />
            <span>{counts.blocked} pending review</span>
          </div>
          {counts.blocked > 0 && (
            <button
              onClick={onBulkIgnoreBlocked}
              className="text-[10px] px-2 py-0.5 rounded bg-rose-500/20 hover:bg-rose-500/30 text-rose-700 dark:text-rose-300 font-semibold transition-all flex items-center gap-1"
            >
              <CheckCheck className="w-3 h-3" />
              Ignore All
            </button>
          )}
        </div>
      )}

      {/* Sidebar Item List */}
      <div className="flex-1 overflow-y-auto p-2 space-y-1 divide-y divide-zinc-100 dark:divide-white/[0.03]">
        {activeTab === 'Paused' ? (
          /* Paused Incoming Emails List */
          filteredPausedHistory.length > 0 ? (
            filteredPausedHistory.map((item) => {
              const isSelected = selectedPausedItem?.id === item.id;
              return (
                <div
                  key={item.id}
                  onClick={() => {
                    onSelectPausedItem(item);
                    onResetReplyState();
                  }}
                  className={cn(
                    "p-3.5 rounded-xl cursor-pointer transition-all duration-150 border text-left",
                    isSelected 
                      ? "bg-amber-500/10 border-amber-500/20 shadow-sm" 
                      : "border-transparent hover:bg-zinc-100/70 dark:hover:bg-white/5"
                  )}
                >
                  <div className="flex justify-between items-baseline mb-1">
                    <span className="font-semibold text-xs text-foreground truncate pr-2">
                      {item.from_email}
                    </span>
                    <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                      {item.created_at?.split(' ')[1] || item.created_at || ''}
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5 mb-1">
                    <p className="text-xs font-medium text-foreground/90 truncate flex-1">
                      {item.subject || 'No Subject'}
                    </p>
                  </div>

                  <p className="text-[11px] text-muted-foreground truncate line-clamp-1 mb-2">
                    {item.body}
                  </p>

                  <div className="flex items-center justify-between pt-1">
                    <span className="text-[10px] px-2 py-0.5 rounded-md font-semibold bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center gap-1">
                      <PauseCircle className="w-2.5 h-2.5" />
                      Paused Mail
                    </span>

                    <span className={cn(
                      "text-[10px] px-2 py-0.5 rounded font-medium",
                      item.status === 'replied' ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" :
                      item.status === 'ignored' ? "bg-zinc-500/10 text-muted-foreground" :
                      "bg-amber-500/10 text-amber-600 dark:text-amber-400 font-semibold"
                    )}>
                      {item.status === 'replied' ? 'Replied' : item.status === 'ignored' ? 'Ignored' : 'Pending Review'}
                    </span>
                  </div>
                </div>
              );
            })
          ) : (
            <div className="h-full flex flex-col items-center justify-center p-8 text-center space-y-2 text-muted-foreground">
              <PauseCircle className="w-8 h-8 opacity-40 text-amber-500" />
              <p className="text-xs font-medium">No incoming emails captured while paused.</p>
              {pausedEmails.length > 0 && (
                <p className="text-[11px] text-muted-foreground/80">
                  {pausedEmails.length} contact(s) are currently paused. When they send emails, they will appear here.
                </p>
              )}
            </div>
          )
        ) : activeTab === 'Blocked' ? (
          /* Blocked Emails List */
          filteredBlockedEmails.length > 0 ? (
            filteredBlockedEmails.map((item) => {
              const isSelected = selectedBlockedItem?.id === item.id;
              return (
                <div
                  key={item.id}
                  onClick={() => {
                    onSelectBlockedItem(item);
                    onResetReplyState();
                  }}
                  className={cn(
                    "p-3.5 rounded-xl cursor-pointer transition-all duration-150 border text-left",
                    isSelected 
                      ? "bg-rose-500/10 border-rose-500/20 shadow-sm" 
                      : "border-transparent hover:bg-zinc-100/70 dark:hover:bg-white/5"
                  )}
                >
                  <div className="flex justify-between items-baseline mb-1">
                    <span className="font-semibold text-xs text-foreground truncate pr-2">
                      {item.from_email}
                    </span>
                    <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                      {item.created_at?.split(' ')[1] || item.created_at || ''}
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5 mb-1">
                    <p className="text-xs font-medium text-foreground/90 truncate flex-1">
                      {item.subject || 'No Subject'}
                    </p>
                  </div>

                  <p className="text-[11px] text-muted-foreground truncate line-clamp-1 mb-2">
                    {item.body}
                  </p>

                  <div className="flex items-center justify-between pt-1">
                    <span className="text-[10px] px-2 py-0.5 rounded-md font-semibold bg-rose-500/10 text-rose-600 dark:text-rose-400 flex items-center gap-1">
                      <Ban className="w-2.5 h-2.5" />
                      "{item.matched_keyword}"
                    </span>

                    <span className={cn(
                      "text-[10px] px-2 py-0.5 rounded font-medium",
                      item.status === 'replied' ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" :
                      item.status === 'ignored' ? "bg-zinc-500/10 text-muted-foreground" :
                      "bg-amber-500/10 text-amber-600 dark:text-amber-400 font-semibold"
                    )}>
                      {item.status === 'replied' ? 'Replied' : item.status === 'ignored' ? 'Ignored' : 'Pending Review'}
                    </span>
                  </div>
                </div>
              );
            })
          ) : (
            <div className="h-full flex flex-col items-center justify-center p-8 text-center space-y-2 text-muted-foreground">
              <ShieldAlert className="w-8 h-8 opacity-40 text-rose-500" />
              <p className="text-xs font-medium">No emails blocked by keywords found.</p>
            </div>
          )
        ) : (
          /* Regular Conversation Thread List */
          filteredThreads.length > 0 ? (
            filteredThreads.map((thread) => {
              const isSelected = selectedThread?.key === thread.key;
              const isSenderPaused = pausedEmails.includes(thread.sender);
              return (
                <div
                  key={thread.key}
                  onClick={() => {
                    onSelectThread(thread);
                    onResetReplyState();
                  }}
                  className={cn(
                    "p-3.5 rounded-xl cursor-pointer transition-all duration-150 border text-left",
                    isSelected 
                      ? isSenderPaused 
                        ? "bg-amber-500/10 border-amber-500/20 shadow-sm" 
                        : "bg-primary/10 border-primary/20 shadow-sm" 
                      : "border-transparent hover:bg-zinc-100/70 dark:hover:bg-white/5"
                  )}
                >
                  <div className="flex justify-between items-baseline mb-1">
                    <span className="font-semibold text-xs text-foreground truncate pr-2">
                      {thread.sender}
                    </span>
                    <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                      {thread.time}
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5 mb-1">
                    <p className="text-xs font-medium text-foreground/90 truncate flex-1">
                      {thread.subject}
                    </p>
                    {thread.emails.length > 1 && (
                      <span className="bg-zinc-200 dark:bg-white/10 text-muted-foreground text-[10px] font-bold px-1.5 py-0.2 rounded-full shrink-0">
                        {thread.emails.length}
                      </span>
                    )}
                  </div>

                  <p className="text-[11px] text-muted-foreground truncate line-clamp-1 mb-2">
                    {getCleanSnippet(thread.latest_email.preview || thread.latest_email.body)}
                  </p>

                  <div className="flex items-center justify-between pt-1">
                    <div className="flex items-center gap-1.5">
                      <span className={cn("text-[10px] px-2 py-0.5 rounded-md font-semibold", 
                        thread.status === 'Replied' ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' :
                        thread.status === 'Failed' ? 'bg-rose-500/10 text-rose-600 dark:text-rose-400' :
                        thread.status === 'Processing' ? 'bg-blue-500/10 text-blue-600 dark:text-blue-400' :
                        thread.status === 'No Action Needed' ? 'bg-sky-500/10 text-sky-600 dark:text-sky-400 border border-sky-500/20' :
                        thread.status === 'Pending Review' ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400' :
                        'bg-purple-500/10 text-purple-600 dark:text-purple-400'
                      )}>
                        {thread.status}
                      </span>
                      {isSenderPaused && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-600 font-medium">
                          Paused
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                      {thread.sentiment && (
                        <span className={cn(
                          "inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-semibold border",
                          thread.sentiment === 'Angry' ? 'bg-rose-500/10 text-rose-500 border-rose-500/20' :
                          thread.sentiment === 'Happy' ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' :
                          'bg-zinc-500/10 text-zinc-400 border-zinc-500/20'
                        )}>
                          {thread.sentiment === 'Angry' ? <Frown className="w-2.5 h-2.5" /> :
                           thread.sentiment === 'Happy' ? <Smile className="w-2.5 h-2.5" /> :
                           <Meh className="w-2.5 h-2.5" />}
                          {thread.sentiment}
                        </span>
                      )}
                      <div className="flex items-center gap-1">
                        <span className={cn("w-1.5 h-1.5 rounded-full",
                          thread.priority === 'High' || thread.priority === 'Critical' ? 'bg-rose-500' :
                          thread.priority === 'Medium' ? 'bg-blue-500' : 'bg-zinc-400'
                        )} />
                        <span>{thread.priority}</span>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })
          ) : (
            <div className="h-full flex flex-col items-center justify-center p-8 text-center space-y-2 text-muted-foreground">
              <InboxIcon className="w-8 h-8 opacity-40" />
              <p className="text-xs font-medium">No matching conversations found.</p>
            </div>
          )
        )}
      </div>
    </div>
  );
};

export default InboxSidebar;
