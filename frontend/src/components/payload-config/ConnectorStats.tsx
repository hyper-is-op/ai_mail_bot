import React from 'react';

interface ConnectorStatsProps {
  stats: {
    total: number;
    live: number;
    pending: number;
    drafts: number;
  };
}

export const ConnectorStats: React.FC<ConnectorStatsProps> = ({ stats }) => {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
      <div className="p-4 rounded-2xl border border-zinc-200 dark:border-white/10 bg-card/50 backdrop-blur-sm">
        <div className="text-xs text-muted-foreground font-medium">Total Connectors</div>
        <div className="text-2xl font-bold mt-1">{stats.total}</div>
      </div>

      <div className="p-4 rounded-2xl border border-emerald-500/20 bg-emerald-500/5">
        <div className="text-xs text-emerald-600 dark:text-emerald-400 font-medium">Active (Live)</div>
        <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 mt-1">{stats.live}</div>
      </div>

      <div className="p-4 rounded-2xl border border-amber-500/20 bg-amber-500/5">
        <div className="text-xs text-amber-600 dark:text-amber-400 font-medium">Pending Approvals</div>
        <div className="text-2xl font-bold text-amber-600 dark:text-amber-400 mt-1">{stats.pending}</div>
      </div>

      <div className="p-4 rounded-2xl border border-zinc-500/20 bg-zinc-500/5">
        <div className="text-xs text-muted-foreground font-medium">Drafts</div>
        <div className="text-2xl font-bold mt-1">{stats.drafts}</div>
      </div>
    </div>
  );
};

export default ConnectorStats;
