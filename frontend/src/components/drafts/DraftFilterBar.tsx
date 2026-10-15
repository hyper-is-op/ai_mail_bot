import React from 'react';
import { Search, Mail } from 'lucide-react';
import { Input, Select } from '@/components/common';

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
    <div className="p-3.5 sm:p-4 rounded-xl win11-card shadow-2xs space-y-3">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2.5">
        {/* Keyword Search */}
        <div>
          <Input
            icon={<Search className="w-3.5 h-3.5" />}
            placeholder="Search ID, thread, subject, sender..."
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              onFilterChangeResetPage();
            }}
          />
        </div>

        {/* Sender / Domain Filter */}
        <div>
          <Input
            icon={<Mail className="w-3.5 h-3.5" />}
            placeholder="Filter by sender / domain..."
            value={senderFilter}
            onChange={(e) => {
              setSenderFilter(e.target.value);
              onFilterChangeResetPage();
            }}
          />
        </div>

        {/* Intent Filter */}
        <div>
          <Select
            value={intentFilter}
            onChange={(e) => {
              setIntentFilter(e.target.value);
              onFilterChangeResetPage();
            }}
          >
            <option value="ALL">All Intents</option>
            <option value="order_status">Order Status</option>
            <option value="ticket_status">Ticket Status</option>
            <option value="payment_status">Payment Status</option>
            <option value="general_query">General Query</option>
            <option value="ticket_created">Ticket Created</option>
            <option value="refund_request">Refund Request</option>
            <option value="cancellation">Cancellation</option>
            <option value="complaint">Complaint</option>
          </Select>
        </div>

        {/* Sentiment Filter */}
        <div>
          <Select
            value={sentimentFilter}
            onChange={(e) => {
              setSentimentFilter(e.target.value);
              onFilterChangeResetPage();
            }}
          >
            <option value="ALL">All Sentiments</option>
            <option value="Positive">Positive</option>
            <option value="Neutral">Neutral</option>
            <option value="Negative">Negative</option>
            <option value="Urgent">Urgent</option>
          </Select>
        </div>

        {/* Min Confidence Score */}
        <div>
          <Select
            value={minScore}
            onChange={(e) => {
              setMinScore(e.target.value === '' ? '' : Number(e.target.value));
              onFilterChangeResetPage();
            }}
          >
            <option value="">Any Confidence</option>
            <option value="90">&ge; 90% (High Quality)</option>
            <option value="80">&ge; 80% (Good)</option>
            <option value="70">&ge; 70% (Acceptable)</option>
            <option value="50">&ge; 50%</option>
          </Select>
        </div>
      </div>

      {/* Status Tabs and Quick Reset */}
      <div className="flex flex-wrap items-center justify-between pt-2.5 border-t border-border">
        <div className="flex items-center gap-1.5">
          {(['pending', 'sent', 'discarded', 'ALL'] as const).map((st) => (
            <button
              key={st}
              type="button"
              onClick={() => {
                setStatusFilter(st);
                onFilterChangeResetPage();
              }}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                statusFilter === st
                  ? 'bg-primary text-primary-foreground shadow-2xs'
                  : 'text-muted-foreground hover:bg-secondary/60 hover:text-foreground'
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
            className="text-xs text-primary hover:underline font-semibold cursor-pointer"
          >
            Clear all filters
          </button>
        )}
      </div>
    </div>
  );
};

