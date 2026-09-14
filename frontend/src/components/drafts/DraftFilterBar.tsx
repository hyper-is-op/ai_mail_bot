import React from 'react';
import { Search, Mail } from 'lucide-react';

interface DraftFilterBarProps {
  searchQuery: string;
  setSearchQuery: (val: string) => void;
  senderFilter: string;
  setSenderFilter: (val: string) => void;
  intentFilter: string;
  setIntentFilter: (val: string) => void;
  sentimentFilter: string;
  setSentimentFilter: (val: string) => void;
  minScore: number | '';
  setMinScore: (val: number | '') => void;
  statusFilter: string;
  setStatusFilter: (val: string) => void;
  onFilterChangeResetPage: () => void;
}

export const DraftFilterBar: React.FC<DraftFilterBarProps> = ({
  searchQuery,
  setSearchQuery,
  senderFilter,
  setSenderFilter,
  intentFilter,
  setIntentFilter,
  sentimentFilter,
  setSentimentFilter,
  minScore,
  setMinScore,
  statusFilter,
  setStatusFilter,
  onFilterChangeResetPage,
}) => {
  const hasActiveFilters =
    Boolean(searchQuery) ||
    Boolean(senderFilter) ||
    intentFilter !== 'ALL' ||
    sentimentFilter !== 'ALL' ||
    minScore !== '';

  const handleClearFilters = () => {
    setSearchQuery('');
    setSenderFilter('');
    setIntentFilter('ALL');
    setSentimentFilter('ALL');
    setMinScore('');
    onFilterChangeResetPage();
  };

  return (
    <div className="p-3.5 rounded-lg win11-card space-y-3">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2.5">
        {/* Keyword Search */}
        <div className="relative">
          <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search subject, body, sender..."
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              onFilterChangeResetPage();
            }}
            className="w-full pl-8 pr-3 py-1.5 text-xs rounded-md border border-black/[0.08] dark:border-white/[0.08] bg-white/70 dark:bg-white/[0.05] text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-b-2 focus:border-b-primary shadow-2xs"
          />
        </div>

        {/* Sender / Domain Filter */}
        <div className="relative">
          <Mail className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            placeholder="Filter by sender / domain..."
            value={senderFilter}
            onChange={(e) => {
              setSenderFilter(e.target.value);
              onFilterChangeResetPage();
            }}
            className="w-full pl-8 pr-3 py-1.5 text-xs rounded-md border border-black/[0.08] dark:border-white/[0.08] bg-white/70 dark:bg-white/[0.05] text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-b-2 focus:border-b-primary shadow-2xs"
          />
        </div>

        {/* Intent Filter */}
        <div>
          <select
            value={intentFilter}
            onChange={(e) => {
              setIntentFilter(e.target.value);
              onFilterChangeResetPage();
            }}
            className="w-full px-2.5 py-1.5 text-xs rounded-md border border-black/[0.08] dark:border-white/[0.08] bg-white/70 dark:bg-white/[0.05] text-foreground focus:outline-none focus:border-b-2 focus:border-b-primary shadow-2xs cursor-pointer"
          >
            <option value="ALL">All Intents</option>
            <option value="order_status">Order Status</option>
            <option value="general_query">General Query</option>
            <option value="ticket_created">Ticket Created</option>
            <option value="refund_request">Refund Request</option>
            <option value="cancellation">Cancellation</option>
            <option value="complaint">Complaint</option>
          </select>
        </div>

        {/* Sentiment Filter */}
        <div>
          <select
            value={sentimentFilter}
            onChange={(e) => {
              setSentimentFilter(e.target.value);
              onFilterChangeResetPage();
            }}
            className="w-full px-2.5 py-1.5 text-xs rounded-md border border-black/[0.08] dark:border-white/[0.08] bg-white/70 dark:bg-white/[0.05] text-foreground focus:outline-none focus:border-b-2 focus:border-b-primary shadow-2xs cursor-pointer"
          >
            <option value="ALL">All Sentiments</option>
            <option value="Positive">Positive</option>
            <option value="Neutral">Neutral</option>
            <option value="Negative">Negative</option>
            <option value="Urgent">Urgent</option>
          </select>
        </div>

        {/* Min Confidence Score */}
        <div>
          <select
            value={minScore}
            onChange={(e) => {
              setMinScore(e.target.value === '' ? '' : Number(e.target.value));
              onFilterChangeResetPage();
            }}
            className="w-full px-2.5 py-1.5 text-xs rounded-md border border-black/[0.08] dark:border-white/[0.08] bg-white/70 dark:bg-white/[0.05] text-foreground focus:outline-none focus:border-b-2 focus:border-b-primary shadow-2xs cursor-pointer"
          >
            <option value="">Any Confidence</option>
            <option value="90">&ge; 90% (High Quality)</option>
            <option value="80">&ge; 80% (Good)</option>
            <option value="70">&ge; 70% (Acceptable)</option>
            <option value="50">&ge; 50%</option>
          </select>
        </div>
      </div>

      {/* Status Tabs and Quick Reset */}
      <div className="flex flex-wrap items-center justify-between pt-2 border-t border-black/[0.06] dark:border-white/[0.06]">
        <div className="flex items-center gap-1.5">
          {(['pending', 'sent', 'discarded', 'ALL'] as const).map((st) => (
            <button
              key={st}
              type="button"
              onClick={() => {
                setStatusFilter(st);
                onFilterChangeResetPage();
              }}
              className={`px-3 py-1 text-xs font-semibold rounded-md transition-colors cursor-pointer ${
                statusFilter === st
                  ? 'bg-primary text-primary-foreground shadow-xs'
                  : 'text-muted-foreground hover:bg-black/[0.04] dark:hover:bg-white/[0.06] hover:text-foreground'
              }`}
            >
              {st === 'pending'
                ? 'Pending Review'
                : st === 'sent'
                ? 'Dispatched'
                : st === 'discarded'
                ? 'Discarded'
                : 'All Records'}
            </button>
          ))}
        </div>

        {hasActiveFilters && (
          <button
            type="button"
            onClick={handleClearFilters}
            className="text-xs text-primary hover:underline font-medium cursor-pointer"
          >
            Clear all filters
          </button>
        )}
      </div>
    </div>
  );
};
