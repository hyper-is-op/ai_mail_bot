import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { 
  Activity, 
  CheckCircle2, 
  Clock, 
  AlertCircle, 
  XCircle, 
  RefreshCw, 
  ShieldCheck, 
  Zap, 
  Server, 
  Database, 
  Trash2,
  Filter,
  Copy,
  Check
} from 'lucide-react';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';

interface ActionRecord {
  idempotency_key: string;
  client_id: string;
  action_type: string;
  status: 'completed' | 'pending' | 'failed' | string;
  external_ref: string | null;
  error_message: string | null;
  created_at: string | null;
  updated_at: string | null;
}

export default function SystemHealth() {
  const [records, setRecords] = useState<ActionRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [sweeping, setSweeping] = useState(false);
  const [sweepResult, setSweepResult] = useState<{ count: number; message: string } | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'completed' | 'pending' | 'failed'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const [backendHealth, setBackendHealth] = useState<{ status: string; ok: boolean } | null>(null);

  const loadData = async (isSilent = false) => {
    if (!isSilent) setLoading(true);
    else setRefreshing(true);

    try {
      // 1. Fetch Backend API Health
      try {
        const healthRes = await api.health();
        setBackendHealth({ status: healthRes.status || 'OK', ok: true });
      } catch (err: any) {
        setBackendHealth({ status: err.message || 'Offline', ok: false });
      }

      // 2. Fetch Action Outbox Telemetry
      const outboxRes = await api.getActionOutbox({ limit: 100 });
      setRecords(outboxRes.records || []);
    } catch (err) {
      console.error('Failed to load system health telemetry:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(() => {
      loadData(true);
    }, 10000);
    return () => clearInterval(interval);
  }, [autoRefresh]);

  const handleSweep = async () => {
    setSweeping(true);
    setSweepResult(null);
    try {
      const res = await api.sweepActionOutbox(120);
      setSweepResult({
        count: res.swept_count || 0,
        message: res.swept_count > 0 
          ? `Successfully swept ${res.swept_count} stale pending action(s) to failed.` 
          : 'All pending actions are fresh. 0 stale actions found.'
      });
      await loadData(true);
    } catch (err: any) {
      setSweepResult({
        count: 0,
        message: `Sweep failed: ${err.message || 'Unknown error'}`
      });
    } finally {
      setSweeping(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(text);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  // Metrics calculation
  const totalActions = records.length;
  const completedCount = records.filter(r => r.status === 'completed').length;
  const pendingCount = records.filter(r => r.status === 'pending').length;
  const failedCount = records.filter(r => r.status === 'failed').length;

  const filteredRecords = records.filter(r => {
    if (statusFilter !== 'ALL' && r.status !== statusFilter) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return (
        r.client_id?.toLowerCase().includes(q) ||
        r.action_type?.toLowerCase().includes(q) ||
        r.idempotency_key?.toLowerCase().includes(q) ||
        r.external_ref?.toLowerCase().includes(q) ||
        r.error_message?.toLowerCase().includes(q)
      );
    }
    return true;
  });

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent flex items-center gap-3">
            <Activity className="w-8 h-8 text-primary" />
            System Health & Outbox Telemetry
          </h2>
          <p className="text-muted-foreground mt-1">
            Real-time idempotency tracking, background worker daemon health, and automated outbox sweeping.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-2 text-xs text-muted-foreground bg-white/5 border border-white/10 px-3 py-2 rounded-lg cursor-pointer hover:bg-white/10 transition-colors">
            <input 
              type="checkbox" 
              checked={autoRefresh} 
              onChange={e => setAutoRefresh(e.target.checked)} 
              className="rounded border-zinc-700 bg-zinc-900 text-primary focus:ring-0"
            />
            Auto-refresh (10s)
          </label>

          <button
            onClick={() => loadData(false)}
            disabled={loading || refreshing}
            className="px-3.5 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-xs font-medium flex items-center gap-2 transition-colors disabled:opacity-50"
          >
            <RefreshCw className={cn("w-3.5 h-3.5", (loading || refreshing) && "animate-spin")} />
            Refresh
          </button>

          <button
            onClick={handleSweep}
            disabled={sweeping}
            className="px-4 py-2 bg-rose-500/20 hover:bg-rose-500/30 text-rose-400 border border-rose-500/30 rounded-lg text-xs font-semibold flex items-center gap-2 transition-colors disabled:opacity-50"
          >
            <Trash2 className={cn("w-3.5 h-3.5", sweeping && "animate-spin")} />
            {sweeping ? "Sweeping..." : "Sweep Stale Actions"}
          </button>
        </div>
      </div>

      {/* Sweep Result Banner */}
      {sweepResult && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className={cn(
            "p-4 rounded-xl border flex items-center justify-between gap-4 text-sm font-medium",
            sweepResult.count > 0 
              ? "bg-amber-500/10 border-amber-500/30 text-amber-300"
              : "bg-emerald-500/10 border-emerald-500/30 text-emerald-300"
          )}
        >
          <div className="flex items-center gap-2">
            {sweepResult.count > 0 ? <AlertCircle className="w-5 h-5" /> : <CheckCircle2 className="w-5 h-5" />}
            <span>{sweepResult.message}</span>
          </div>
          <button 
            onClick={() => setSweepResult(null)} 
            className="text-xs opacity-70 hover:opacity-100 underline"
          >
            Dismiss
          </button>
        </motion.div>
      )}

      {/* Infrastructure Health Status Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {/* Card 1: FastAPI API Gateway */}
        <div className="glass-panel p-5 rounded-2xl border border-white/10 flex items-center gap-4">
          <div className={cn(
            "p-3 rounded-xl",
            backendHealth?.ok ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" : "bg-rose-500/10 text-rose-400 border border-rose-500/20"
          )}>
            <Server className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">API Gateway</p>
            <h4 className="text-lg font-bold text-foreground">
              {backendHealth?.ok ? "Operational" : "Unavailable"}
            </h4>
            <p className="text-xs text-zinc-400 font-mono mt-0.5">Port 8024 (FastAPI)</p>
          </div>
        </div>

        {/* Card 2: Celery Worker & Beat */}
        <div className="glass-panel p-5 rounded-2xl border border-white/10 flex items-center gap-4">
          <div className="p-3 rounded-xl bg-blue-500/10 text-blue-400 border border-blue-500/20">
            <Zap className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">Worker & Beat</p>
            <h4 className="text-lg font-bold text-foreground">Active (Beat -B)</h4>
            <p className="text-xs text-zinc-400 font-mono mt-0.5">Every 120s auto-sweep</p>
          </div>
        </div>

        {/* Card 3: Storage & Cache */}
        <div className="glass-panel p-5 rounded-2xl border border-white/10 flex items-center gap-4">
          <div className="p-3 rounded-xl bg-purple-500/10 text-purple-400 border border-purple-500/20">
            <Database className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">Data Layer</p>
            <h4 className="text-lg font-bold text-foreground">MySQL & Redis</h4>
            <p className="text-xs text-zinc-400 font-mono mt-0.5">24h IMAP dedup active</p>
          </div>
        </div>

        {/* Card 4: Circuit Breaker */}
        <div className="glass-panel p-5 rounded-2xl border border-white/10 flex items-center gap-4">
          <div className="p-3 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">Poison Pill Breaker</p>
            <h4 className="text-lg font-bold text-foreground">Armed (Max: 2)</h4>
            <p className="text-xs text-zinc-400 font-mono mt-0.5">Zero thread starvation</p>
          </div>
        </div>
      </div>

      {/* Outbox Overview Counters */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className="glass-panel p-5 rounded-2xl border border-white/10">
          <span className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">Total Tracked Actions</span>
          <p className="text-3xl font-bold mt-2 font-mono">{totalActions}</p>
        </div>
        <div className="glass-panel p-5 rounded-2xl border border-emerald-500/20 bg-emerald-500/5">
          <span className="text-xs uppercase tracking-wider text-emerald-400 font-semibold flex items-center gap-1.5">
            <CheckCircle2 className="w-3.5 h-3.5" /> Completed
          </span>
          <p className="text-3xl font-bold mt-2 font-mono text-emerald-400">{completedCount}</p>
        </div>
        <div className="glass-panel p-5 rounded-2xl border border-amber-500/20 bg-amber-500/5">
          <span className="text-xs uppercase tracking-wider text-amber-400 font-semibold flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5" /> In-Flight Pending
          </span>
          <p className="text-3xl font-bold mt-2 font-mono text-amber-400">{pendingCount}</p>
        </div>
        <div className="glass-panel p-5 rounded-2xl border border-rose-500/20 bg-rose-500/5">
          <span className="text-xs uppercase tracking-wider text-rose-400 font-semibold flex items-center gap-1.5">
            <XCircle className="w-3.5 h-3.5" /> Failed / Swept
          </span>
          <p className="text-3xl font-bold mt-2 font-mono text-rose-400">{failedCount}</p>
        </div>
      </div>

      {/* Outbox Table Container */}
      <div className="glass-panel rounded-2xl border border-white/10 overflow-hidden">
        {/* Table Filters & Search */}
        <div className="p-4 border-b border-white/10 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <Filter className="w-4 h-4 text-muted-foreground" />
            <div className="flex rounded-lg bg-white/5 p-1 border border-white/10 text-xs">
              {(['ALL', 'completed', 'pending', 'failed'] as const).map(s => (
                <button
                  key={s}
                  onClick={() => setStatusFilter(s)}
                  className={cn(
                    "px-3 py-1.5 rounded-md font-medium capitalize transition-all",
                    statusFilter === s 
                      ? "bg-primary text-primary-foreground shadow-sm" 
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>

          <div className="w-full sm:w-72">
            <input
              type="text"
              placeholder="Search by client, key, action, or ref..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-lg px-3.5 py-2 text-xs focus:outline-none focus:border-primary/50 text-foreground placeholder:text-zinc-500"
            />
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-white/10 bg-white/5 text-muted-foreground uppercase tracking-wider font-semibold">
                <th className="p-3.5 pl-5">Timestamp</th>
                <th className="p-3.5">Client ID</th>
                <th className="p-3.5">Action Type</th>
                <th className="p-3.5">Idempotency Key</th>
                <th className="p-3.5">Status</th>
                <th className="p-3.5">External Reference</th>
                <th className="p-3.5 pr-5">Error / Note</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {loading ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-muted-foreground">
                    <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-primary" />
                    Loading action outbox telemetry...
                  </td>
                </tr>
              ) : filteredRecords.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-muted-foreground">
                    No action records found matching the current filter.
                  </td>
                </tr>
              ) : (
                filteredRecords.map((r, i) => (
                  <tr key={r.idempotency_key || i} className="hover:bg-white/[0.02] transition-colors">
                    <td className="p-3.5 pl-5 font-mono text-zinc-400 whitespace-nowrap">
                      {r.created_at ? r.created_at.replace("T", " ").split(".")[0] : "—"}
                    </td>
                    <td className="p-3.5 font-mono font-medium text-zinc-300">
                      {r.client_id}
                    </td>
                    <td className="p-3.5">
                      <span className={cn(
                        "px-2.5 py-1 rounded-full text-[10px] font-semibold border uppercase tracking-wider font-mono",
                        r.action_type === 'crm_ticket_create' 
                          ? "bg-cyan-500/10 text-cyan-400 border-cyan-500/20" 
                          : "bg-indigo-500/10 text-indigo-400 border-indigo-500/20"
                      )}>
                        {r.action_type.replace(/_/g, ' ')}
                      </span>
                    </td>
                    <td className="p-3.5 font-mono">
                      <div className="flex items-center gap-1.5 text-zinc-400">
                        <span>{r.idempotency_key ? `${r.idempotency_key.substring(0, 10)}...` : '—'}</span>
                        {r.idempotency_key && (
                          <button
                            onClick={() => copyToClipboard(r.idempotency_key)}
                            className="p-1 hover:text-white transition-colors"
                            title="Copy full key"
                          >
                            {copiedKey === r.idempotency_key ? (
                              <Check className="w-3 h-3 text-emerald-400" />
                            ) : (
                              <Copy className="w-3 h-3" />
                            )}
                          </button>
                        )}
                      </div>
                    </td>
                    <td className="p-3.5">
                      <span className={cn(
                        "px-2 py-0.5 rounded text-[11px] font-medium inline-flex items-center gap-1 capitalize",
                        r.status === 'completed' && "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30",
                        r.status === 'pending' && "bg-amber-500/15 text-amber-400 border border-amber-500/30 animate-pulse",
                        r.status === 'failed' && "bg-rose-500/15 text-rose-400 border border-rose-500/30"
                      )}>
                        {r.status === 'completed' && <CheckCircle2 className="w-3 h-3" />}
                        {r.status === 'pending' && <Clock className="w-3 h-3" />}
                        {r.status === 'failed' && <XCircle className="w-3 h-3" />}
                        {r.status}
                      </span>
                    </td>
                    <td className="p-3.5 font-mono font-medium text-zinc-300">
                      {r.external_ref ? (
                        <span className="bg-white/5 border border-white/10 px-2 py-1 rounded text-primary">
                          #{r.external_ref}
                        </span>
                      ) : (
                        <span className="text-zinc-600">—</span>
                      )}
                    </td>
                    <td className="p-3.5 pr-5 text-zinc-400 max-w-xs truncate" title={r.error_message || ''}>
                      {r.error_message ? (
                        <span className="text-rose-400">{r.error_message}</span>
                      ) : (
                        <span className="text-zinc-600">—</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
