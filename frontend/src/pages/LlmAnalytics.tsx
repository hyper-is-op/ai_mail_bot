import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { 
  Activity, 
  DollarSign, 
  Cpu, 
  Clock, 
  RefreshCw, 
  Terminal, 
  TrendingUp, 
  HelpCircle, 
  ArrowUpRight, 
  Layers,
  Search,
  ChevronRight
} from 'lucide-react';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';

export default function LlmAnalytics() {
  const [metrics, setMetrics] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filterModel, setFilterModel] = useState('All');
  const [filterCaller, setFilterCaller] = useState('All');

  const user = JSON.parse(localStorage.getItem('user') || '{}');
  const [selectedClientId, setSelectedClientId] = useState(user?.role === 'admin' ? 'ALL' : (user?.client_id || ''));
  const [clients, setClients] = useState<any[]>([]);

  useEffect(() => {
    if (user?.role === 'admin') {
      api.getAllEmailAccounts()
        .then((data) => {
          setClients(data);
        })
        .catch((err) => console.error("Failed to fetch clients for admin LLM analytics:", err));
    }
  }, []);

  const fetchMetrics = async (isRefresh = false, cid = selectedClientId) => {
    if (!cid) return;
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    
    try {
      const data = await api.getLlmMetrics(cid);
      setMetrics(data);
    } catch (err) {
      console.error("Failed to load LLM metrics:", err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    if (selectedClientId) {
      fetchMetrics(false, selectedClientId);
    }
  }, [selectedClientId]);

  if (loading) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center space-y-4">
        <RefreshCw className="w-10 h-10 text-primary animate-spin" />
        <p className="text-sm text-zinc-400 font-medium font-mono">Compiling LLM token telemetry & latency metrics...</p>
      </div>
    );
  }

  const totals = metrics?.totals || {
    total_requests: 0,
    total_prompt_tokens: 0,
    total_completion_tokens: 0,
    total_cost: 0.0,
    avg_latency: 0.0
  };

  const models = metrics?.models || [];
  const callers = metrics?.callers || [];
  const logs = metrics?.logs || [];

  // Filter logs for rendering
  const filteredLogs = logs.filter((log: any) => {
    const matchesModel = filterModel === 'All' || log.model_name === filterModel;
    const matchesCaller = filterCaller === 'All' || log.caller_function === filterCaller;
    return matchesModel && matchesCaller;
  });

  // Unique lists for filters
  const uniqueModels = Array.from(new Set(logs.map((l: any) => l.model_name)));
  const uniqueCallers = Array.from(new Set(logs.map((l: any) => l.caller_function)));

  return (
    <div className="space-y-6 pb-12">
      {/* Title */}
      <div className="flex flex-col sm:flex-row justify-between sm:items-end gap-4">
        <div>
          <h2 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">LLM Cost & Telemetry Analytics</h2>
          <p className="text-muted-foreground mt-1">Real-time token logging, cost calculations, and API response speed indicators.</p>
        </div>
        <div className="flex flex-wrap items-center gap-3 self-start sm:self-auto">
          {user?.role === 'admin' && clients.length > 0 && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground font-semibold">Client:</span>
              <select
                value={selectedClientId}
                onChange={(e) => setSelectedClientId(e.target.value)}
                className="bg-white/5 border border-white/10 rounded-xl px-3 py-1.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer"
              >
                <option value="ALL" className="bg-zinc-900 text-foreground">ALL</option>
                {clients.map((c) => (
                  <option key={c.client_id} value={c.client_id} className="bg-zinc-900 text-foreground">
                    {c.client_id} ({c.email})
                  </option>
                ))}
              </select>
            </div>
          )}
          <button 
            onClick={() => fetchMetrics(true, selectedClientId)} 
            disabled={refreshing}
            className="bg-white/5 border border-white/10 hover:bg-white/10 text-white rounded-xl px-4 py-2 text-sm font-semibold transition-all flex items-center gap-2"
          >
            <RefreshCw className={cn("w-4 h-4", refreshing && "animate-spin")} />
            Sync Metrics
          </button>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* Card 1: Total Cost */}
        <motion.div 
          initial={{ opacity: 0, y: 15 }} 
          animate={{ opacity: 1, y: 0 }}
          className="glass-panel p-6 rounded-2xl border border-white/10 relative overflow-hidden group hover:border-primary/30 transition-all"
        >
          <div className="absolute top-0 right-0 w-24 h-24 bg-primary/5 rounded-full blur-2xl group-hover:bg-primary/10 transition-all"></div>
          <div className="flex justify-between items-start mb-4">
            <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Accumulated Cost</span>
            <div className="bg-primary/20 p-2.5 rounded-xl border border-primary/30 text-primary">
              <DollarSign className="w-5 h-5" />
            </div>
          </div>
          <div className="space-y-1">
            <h3 className="text-2xl font-mono font-bold text-white">
              ${totals.total_cost.toFixed(6)}
            </h3>
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              <TrendingUp className="w-3 h-3 text-emerald-400" />
              Calculated dynamically via model rates
            </p>
          </div>
        </motion.div>

        {/* Card 2: Total Requests */}
        <motion.div 
          initial={{ opacity: 0, y: 15 }} 
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="glass-panel p-6 rounded-2xl border border-white/10 relative overflow-hidden group hover:border-accent/30 transition-all"
        >
          <div className="absolute top-0 right-0 w-24 h-24 bg-accent/5 rounded-full blur-2xl group-hover:bg-accent/10 transition-all"></div>
          <div className="flex justify-between items-start mb-4">
            <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Total API Completions</span>
            <div className="bg-accent/20 p-2.5 rounded-xl border border-accent/30 text-accent">
              <Cpu className="w-5 h-5" />
            </div>
          </div>
          <div className="space-y-1">
            <h3 className="text-2xl font-mono font-bold text-white">
              {totals.total_requests}
            </h3>
            <p className="text-xs text-muted-foreground">Active LLM invocations recorded</p>
          </div>
        </motion.div>

        {/* Card 3: Avg Latency */}
        <motion.div 
          initial={{ opacity: 0, y: 15 }} 
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="glass-panel p-6 rounded-2xl border border-white/10 relative overflow-hidden group hover:border-emerald-500/30 transition-all"
        >
          <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/5 rounded-full blur-2xl group-hover:bg-emerald-500/10 transition-all"></div>
          <div className="flex justify-between items-start mb-4">
            <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Avg Latency</span>
            <div className="bg-emerald-500/20 p-2.5 rounded-xl border border-emerald-500/30 text-emerald-400">
              <Clock className="w-5 h-5" />
            </div>
          </div>
          <div className="space-y-1">
            <h3 className="text-2xl font-mono font-bold text-white">
              {totals.avg_latency.toFixed(0)} <span className="text-xs text-muted-foreground">ms</span>
            </h3>
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              ~{(totals.avg_latency / 1000).toFixed(2)}s average model roundtrip
            </p>
          </div>
        </motion.div>

        {/* Card 4: Token Volumes */}
        <motion.div 
          initial={{ opacity: 0, y: 15 }} 
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="glass-panel p-6 rounded-2xl border border-white/10 relative overflow-hidden group hover:border-purple-500/30 transition-all"
        >
          <div className="absolute top-0 right-0 w-24 h-24 bg-purple-500/5 rounded-full blur-2xl group-hover:bg-purple-500/10 transition-all"></div>
          <div className="flex justify-between items-start mb-4">
            <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Total Tokens</span>
            <div className="bg-purple-500/20 p-2.5 rounded-xl border border-purple-500/30 text-purple-400">
              <Layers className="w-5 h-5" />
            </div>
          </div>
          <div className="space-y-1">
            <h3 className="text-2xl font-mono font-bold text-white">
              {totals.total_prompt_tokens + totals.total_completion_tokens}
            </h3>
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              Input: {totals.total_prompt_tokens} | Output: {totals.total_completion_tokens}
            </p>
          </div>
        </motion.div>
      </div>

      {/* Breakdown grids */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Model Metrics Table */}
        <div className="glass-panel p-6 rounded-2xl border border-white/10">
          <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
            <Cpu className="w-5 h-5 text-primary" /> Model Volume & Cost Breakdown
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead>
                <tr className="border-b border-white/10 text-muted-foreground font-semibold">
                  <th className="pb-3 pr-2">Model Name</th>
                  <th className="pb-3 text-center">Requests</th>
                  <th className="pb-3 text-right">Prompt Tokens</th>
                  <th className="pb-3 text-right">Completion</th>
                  <th className="pb-3 text-right">Avg Latency</th>
                  <th className="pb-3 text-right">Cost</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {models.length > 0 ? (
                  models.map((model: any) => (
                    <tr key={model.model_name} className="hover:bg-white/5 transition-colors">
                      <td className="py-3 font-mono text-xs text-zinc-300 truncate max-w-[150px]">{model.model_name}</td>
                      <td className="py-3 text-center text-white font-mono">{model.requests}</td>
                      <td className="py-3 text-right font-mono">{model.prompt_tokens}</td>
                      <td className="py-3 text-right font-mono">{model.completion_tokens}</td>
                      <td className="py-3 text-right font-mono">{model.avg_latency.toFixed(0)} ms</td>
                      <td className="py-3 text-right text-primary font-semibold font-mono">${model.cost.toFixed(5)}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-muted-foreground">No model analytics recorded yet.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Function Metrics Table */}
        <div className="glass-panel p-6 rounded-2xl border border-white/10">
          <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
            <Terminal className="w-5 h-5 text-accent" /> System Call Orchestrator Stats
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead>
                <tr className="border-b border-white/10 text-muted-foreground font-semibold">
                  <th className="pb-3">Subsystem / Logic Node</th>
                  <th className="pb-3 text-center">Calls</th>
                  <th className="pb-3 text-right">Prompt Tokens</th>
                  <th className="pb-3 text-right">Completion</th>
                  <th className="pb-3 text-right">Avg Latency</th>
                  <th className="pb-3 text-right">Cost</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {callers.length > 0 ? (
                  callers.map((caller: any) => (
                    <tr key={caller.caller_function} className="hover:bg-white/5 transition-colors">
                      <td className="py-3 text-zinc-200 font-medium flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-accent"></span>
                        {caller.caller_display}
                      </td>
                      <td className="py-3 text-center text-white font-mono">{caller.requests}</td>
                      <td className="py-3 text-right font-mono">{caller.prompt_tokens}</td>
                      <td className="py-3 text-right font-mono">{caller.completion_tokens}</td>
                      <td className="py-3 text-right font-mono">{caller.avg_latency.toFixed(0)} ms</td>
                      <td className="py-3 text-right text-accent font-semibold font-mono">${caller.cost.toFixed(5)}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-muted-foreground">No caller logs tracked yet.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Logs Table */}
      <div className="glass-panel p-6 rounded-2xl border border-white/10">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
          <h3 className="text-lg font-bold text-white flex items-center gap-2">
            <Activity className="w-5 h-5 text-emerald-400" /> Granular Execution Logs
          </h3>
          
          <div className="flex gap-4 flex-wrap">
            {/* Model Filter */}
            {uniqueModels.length > 0 && (
              <div className="flex items-center gap-2 text-xs">
                <span className="text-muted-foreground">Model:</span>
                <select 
                  value={filterModel}
                  onChange={(e) => setFilterModel(e.target.value)}
                  className="bg-white/5 border border-white/10 rounded-lg px-2 py-1 text-white focus:outline-none"
                >
                  <option value="All" className="bg-zinc-950">All Models</option>
                  {uniqueModels.map((m: any) => (
                    <option key={m} value={m} className="bg-zinc-950">{m}</option>
                  ))}
                </select>
              </div>
            )}
            
            {/* Caller Filter */}
            {uniqueCallers.length > 0 && (
              <div className="flex items-center gap-2 text-xs">
                <span className="text-muted-foreground">Caller:</span>
                <select 
                  value={filterCaller}
                  onChange={(e) => setFilterCaller(e.target.value)}
                  className="bg-white/5 border border-white/10 rounded-lg px-2 py-1 text-white focus:outline-none"
                >
                  <option value="All" className="bg-zinc-950">All Callers</option>
                  {uniqueCallers.map((c: any) => {
                    let display = c;
                    if (c === "detect_intent_llm") display = "Intent Classification";
                    else if (c === "generate_reply_llm") display = "Reply Draft Generation";
                    return (
                      <option key={c} value={c} className="bg-zinc-950">{display}</option>
                    );
                  })}
                </select>
              </div>
            )}
          </div>
        </div>

        <div className="overflow-x-auto max-h-96">
          <table className="w-full text-sm text-left">
            <thead>
              <tr className="border-b border-white/10 text-muted-foreground font-semibold sticky top-0 bg-zinc-950/90 backdrop-blur pb-3">
                <th className="pb-3">Timestamp</th>
                <th className="pb-3">Subsystem Node</th>
                <th className="pb-3">Model</th>
                <th className="pb-3 text-center">Prompt</th>
                <th className="pb-3 text-center">Completion</th>
                <th className="pb-3 text-right">Latency</th>
                <th className="pb-3 text-right">Calculated Cost</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {filteredLogs.length > 0 ? (
                filteredLogs.map((log: any) => (
                  <tr key={log.id} className="hover:bg-white/5 transition-colors">
                    <td className="py-3 text-xs text-muted-foreground whitespace-nowrap">{log.created_at}</td>
                    <td className="py-3 font-medium text-zinc-200">
                      {log.caller_display}
                    </td>
                    <td className="py-3 font-mono text-xs text-zinc-400">{log.model_name}</td>
                    <td className="py-3 text-center font-mono text-xs">{log.prompt_tokens}</td>
                    <td className="py-3 text-center font-mono text-xs">{log.completion_tokens}</td>
                    <td className="py-3 text-right font-mono text-xs">{log.latency_ms} ms</td>
                    <td className="py-3 text-right font-mono text-xs text-emerald-400">${log.cost.toFixed(6)}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-muted-foreground">No individual log records found matching filters.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
