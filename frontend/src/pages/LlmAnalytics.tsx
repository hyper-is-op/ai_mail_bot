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
  Layers,
  Server,
  BarChart3
} from 'lucide-react';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';

export default function LlmAnalytics() {
  const [metrics, setMetrics] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filterProvider, setFilterProvider] = useState('All');
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
        <p className="text-sm text-zinc-400 font-medium font-mono">Compiling multi-provider LLM token telemetry & latency metrics...</p>
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

  const providers = metrics?.providers || [];
  const models = metrics?.models || [];
  const callers = metrics?.callers || [];
  const logs = metrics?.logs || [];

  // Filter logs for rendering
  const filteredLogs = logs.filter((log: any) => {
    const logProvider = (log.provider || 'groq').toLowerCase();
    const matchesProvider = filterProvider === 'All' || logProvider === filterProvider.toLowerCase();
    const matchesModel = filterModel === 'All' || log.model_name === filterModel;
    const matchesCaller = filterCaller === 'All' || log.caller_function === filterCaller;
    return matchesProvider && matchesModel && matchesCaller;
  });

  // Unique lists for filters
  const uniqueProviders = Array.from(new Set(logs.map((l: any) => (l.provider || 'groq').toLowerCase())));
  const uniqueModels = Array.from(new Set(logs.map((l: any) => l.model_name)));
  const uniqueCallers = Array.from(new Set(logs.map((l: any) => l.caller_function)));

  const getProviderBadge = (prov: string) => {
    const p = (prov || 'groq').toLowerCase();
    switch (p) {
      case 'openai':
        return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
      case 'anthropic':
      case 'claude':
        return 'bg-amber-500/10 text-amber-400 border-amber-500/20';
      case 'gemini':
        return 'bg-blue-500/10 text-blue-400 border-blue-500/20';
      case 'grok':
        return 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20';
      case 'deepseek':
        return 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20';
      case 'azure':
        return 'bg-sky-500/10 text-sky-400 border-sky-500/20';
      case 'ollama':
        return 'bg-zinc-500/10 text-zinc-300 border-zinc-500/20';
      case 'groq':
      default:
        return 'bg-orange-500/10 text-orange-400 border-orange-500/20';
    }
  };

  return (
    <div className="space-y-6 pb-12">
      <div className="flex flex-col sm:flex-row justify-between sm:items-end gap-4">
        <div>
          <h2 className="text-2xl md:text-3xl font-semibold tracking-tight text-foreground flex items-center gap-2">
            <BarChart3 className="w-6 h-6 text-primary" /> LLM Token &amp; Cost Telemetry
          </h2>
          <p className="text-xs text-muted-foreground mt-1">Real-time usage analytics, token metrics, and per-call costs across AI providers.</p>
        </div>
        <div className="flex flex-wrap items-center gap-3 self-start sm:self-auto">
          {user?.role === 'admin' && clients.length > 0 && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground font-semibold">Client:</span>
              <select
                value={selectedClientId}
                onChange={(e) => setSelectedClientId(e.target.value)}
                className="win11-card rounded-lg px-3 py-1.5 text-xs text-foreground focus:outline-none focus:border-b-2 focus:border-b-primary cursor-pointer shadow-2xs"
              >
                <option value="ALL" className="bg-card text-foreground">ALL</option>
                {clients.map((c) => (
                  <option key={c.client_id} value={c.client_id} className="bg-card text-foreground">
                    {c.client_id} ({c.email})
                  </option>
                ))}
              </select>
            </div>
          )}
          <button 
            onClick={() => fetchMetrics(true, selectedClientId)} 
            disabled={refreshing}
            className="win11-card hover:bg-black/[0.04] dark:hover:bg-white/[0.06] text-foreground rounded-lg px-3.5 py-2 text-xs font-medium transition-all flex items-center gap-2 cursor-pointer shadow-2xs"
          >
            <RefreshCw className={cn("w-3.5 h-3.5", refreshing && "animate-spin text-primary")} />
            Sync Metrics
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} className="win11-card p-5 rounded-lg relative overflow-hidden group shadow-2xs">
          <div className="flex justify-between items-start mb-3">
            <span className="text-xs font-semibold text-muted-foreground">Accumulated Cost</span>
            <div className="bg-primary/10 p-2 rounded-lg text-primary">
              <DollarSign className="w-4 h-4" />
            </div>
          </div>
          <div className="space-y-1">
            <h3 className="text-2xl font-mono font-bold text-foreground">
              ${totals.total_cost.toFixed(6)}
            </h3>
            <p className="text-[11px] text-muted-foreground flex items-center gap-1">
              <TrendingUp className="w-3 h-3 text-emerald-500" />
              Dynamic per-provider token rates
            </p>
          </div>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }} className="win11-card p-5 rounded-lg relative overflow-hidden group shadow-2xs">
          <div className="flex justify-between items-start mb-3">
            <span className="text-xs font-semibold text-muted-foreground">API Invocations</span>
            <div className="bg-accent/10 p-2 rounded-lg text-accent">
              <Cpu className="w-4 h-4" />
            </div>
          </div>
          <div className="space-y-1">
            <h3 className="text-2xl font-mono font-bold text-foreground">
              {totals.total_requests}
            </h3>
            <p className="text-[11px] text-muted-foreground">Active completions recorded</p>
          </div>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="win11-card p-5 rounded-lg relative overflow-hidden group shadow-2xs">
          <div className="flex justify-between items-start mb-3">
            <span className="text-xs font-semibold text-muted-foreground">Avg Latency</span>
            <div className="bg-emerald-500/10 p-2 rounded-lg text-emerald-600 dark:text-emerald-400">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="space-y-1">
            <h3 className="text-2xl font-mono font-bold text-foreground">
              {totals.avg_latency.toFixed(0)} <span className="text-xs text-muted-foreground font-normal">ms</span>
            </h3>
            <p className="text-[11px] text-muted-foreground flex items-center gap-1">
              ~{(totals.avg_latency / 1000).toFixed(2)}s average model roundtrip
            </p>
          </div>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }} className="win11-card p-5 rounded-lg relative overflow-hidden group shadow-2xs">
          <div className="flex justify-between items-start mb-3">
            <span className="text-xs font-semibold text-muted-foreground">Total Tokens</span>
            <div className="bg-purple-500/10 p-2 rounded-lg text-purple-600 dark:text-purple-400">
              <Layers className="w-4 h-4" />
            </div>
          </div>
          <div className="space-y-1">
            <h3 className="text-2xl font-mono font-bold text-foreground">
              {(totals.total_prompt_tokens + totals.total_completion_tokens).toLocaleString()}
            </h3>
            <p className="text-[11px] text-muted-foreground">
              Prompt: {totals.total_prompt_tokens.toLocaleString()} | Completion: {totals.total_completion_tokens.toLocaleString()}
            </p>
          </div>
        </motion.div>
      </div>

      <div className="win11-card p-5 rounded-lg shadow-2xs">
        <h3 className="text-base font-semibold text-foreground mb-4 flex items-center gap-2">
          <Server className="w-4 h-4 text-primary" /> Multi-Provider Token &amp; Cost Breakdown
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {providers.length > 0 ? (
            providers.map((p: any) => (
              <div key={p.provider} className="p-3.5 rounded-lg border border-black/[0.06] dark:border-white/[0.08] bg-black/[0.02] dark:bg-white/[0.03] space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className={cn("text-[10px] font-bold px-2 py-0.5 rounded-full border uppercase tracking-wider", getProviderBadge(p.provider))}>
                    {p.provider}
                  </span>
                  <span className="text-xs text-muted-foreground font-mono">{p.requests} calls</span>
                </div>
                <div className="space-y-0.5">
                  <p className="text-lg font-bold font-mono text-foreground">${p.cost.toFixed(5)}</p>
                  <p className="text-[11px] text-muted-foreground flex items-center justify-between">
                    <span>Tokens: {(p.prompt_tokens + p.completion_tokens).toLocaleString()}</span>
                    <span className="font-mono">{p.avg_latency.toFixed(0)} ms</span>
                  </p>
                </div>
              </div>
            ))
          ) : (
            <div className="col-span-full py-6 text-center text-muted-foreground text-xs">
              No provider telemetry recorded yet.
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="win11-card p-5 rounded-lg shadow-2xs">
          <h3 className="text-base font-semibold text-foreground mb-4 flex items-center gap-2">
            <Cpu className="w-4 h-4 text-primary" /> Model Volume &amp; Cost Breakdown
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead>
                <tr className="border-b border-black/[0.06] dark:border-white/[0.08] text-muted-foreground font-semibold pb-2">
                  <th className="pb-2.5 pr-2">Model Name</th>
                  <th className="pb-2.5 text-center">Requests</th>
                  <th className="pb-2.5 text-right">Prompt</th>
                  <th className="pb-2.5 text-right">Completion</th>
                  <th className="pb-2.5 text-right">Avg Latency</th>
                  <th className="pb-2.5 text-right">Cost</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-black/[0.04] dark:divide-white/[0.05]">
                {models.length > 0 ? (
                  models.map((model: any) => (
                    <tr key={model.model_name} className="hover:bg-black/[0.03] dark:hover:bg-white/[0.04] transition-colors">
                      <td className="py-2.5 font-mono text-foreground font-medium truncate max-w-[150px]">{model.model_name}</td>
                      <td className="py-2.5 text-center text-foreground font-mono">{model.requests}</td>
                      <td className="py-2.5 text-right font-mono text-muted-foreground">{model.prompt_tokens}</td>
                      <td className="py-2.5 text-right font-mono text-muted-foreground">{model.completion_tokens}</td>
                      <td className="py-2.5 text-right font-mono text-muted-foreground">{model.avg_latency.toFixed(0)} ms</td>
                      <td className="py-2.5 text-right text-primary font-semibold font-mono">${model.cost.toFixed(5)}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={6} className="py-6 text-center text-muted-foreground text-xs">No model analytics recorded yet.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="win11-card p-5 rounded-lg shadow-2xs">
          <h3 className="text-base font-semibold text-foreground mb-4 flex items-center gap-2">
            <Terminal className="w-4 h-4 text-accent" /> Subsystem Orchestrator Stats
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead>
                <tr className="border-b border-black/[0.06] dark:border-white/[0.08] text-muted-foreground font-semibold pb-2">
                  <th className="pb-2.5">Subsystem Node</th>
                  <th className="pb-2.5 text-center">Calls</th>
                  <th className="pb-2.5 text-right">Prompt</th>
                  <th className="pb-2.5 text-right">Completion</th>
                  <th className="pb-2.5 text-right">Avg Latency</th>
                  <th className="pb-2.5 text-right">Cost</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-black/[0.04] dark:divide-white/[0.05]">
                {callers.length > 0 ? (
                  callers.map((caller: any) => (
                    <tr key={caller.caller_function} className="hover:bg-black/[0.03] dark:hover:bg-white/[0.04] transition-colors">
                      <td className="py-2.5 text-foreground font-medium flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-primary"></span>
                        {caller.caller_display}
                      </td>
                      <td className="py-2.5 text-center text-foreground font-mono">{caller.requests}</td>
                      <td className="py-2.5 text-right font-mono text-muted-foreground">{caller.prompt_tokens}</td>
                      <td className="py-2.5 text-right font-mono text-muted-foreground">{caller.completion_tokens}</td>
                      <td className="py-2.5 text-right font-mono text-muted-foreground">{caller.avg_latency.toFixed(0)} ms</td>
                      <td className="py-2.5 text-right text-primary font-semibold font-mono">${caller.cost.toFixed(5)}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={6} className="py-6 text-center text-muted-foreground text-xs">No caller logs tracked yet.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div className="win11-card p-5 rounded-lg shadow-2xs">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-4">
          <h3 className="text-base font-semibold text-foreground flex items-center gap-2">
            <Activity className="w-4 h-4 text-emerald-500" /> Granular Execution Logs
          </h3>
          
          <div className="flex gap-2.5 flex-wrap">
            {uniqueProviders.length > 0 && (
              <div className="flex items-center gap-1.5 text-xs">
                <span className="text-muted-foreground">Provider:</span>
                <select 
                  value={filterProvider}
                  onChange={(e) => setFilterProvider(e.target.value)}
                  className="bg-white dark:bg-white/[0.05] border border-black/[0.08] dark:border-white/[0.08] rounded-md px-2 py-1 text-xs text-foreground focus:outline-none focus:border-b-2 focus:border-b-primary cursor-pointer"
                >
                  <option value="All" className="bg-card text-foreground">All Providers</option>
                  {uniqueProviders.map((p: any) => (
                    <option key={p} value={p} className="bg-card text-foreground">{p.toUpperCase()}</option>
                  ))}
                </select>
              </div>
            )}

            {uniqueModels.length > 0 && (
              <div className="flex items-center gap-1.5 text-xs">
                <span className="text-muted-foreground">Model:</span>
                <select 
                  value={filterModel}
                  onChange={(e) => setFilterModel(e.target.value)}
                  className="bg-white dark:bg-white/[0.05] border border-black/[0.08] dark:border-white/[0.08] rounded-md px-2 py-1 text-xs text-foreground focus:outline-none focus:border-b-2 focus:border-b-primary cursor-pointer"
                >
                  <option value="All" className="bg-card text-foreground">All Models</option>
                  {uniqueModels.map((m: any) => (
                    <option key={m} value={m} className="bg-card text-foreground">{m}</option>
                  ))}
                </select>
              </div>
            )}
            
            {uniqueCallers.length > 0 && (
              <div className="flex items-center gap-1.5 text-xs">
                <span className="text-muted-foreground">Caller:</span>
                <select 
                  value={filterCaller}
                  onChange={(e) => setFilterCaller(e.target.value)}
                  className="bg-white dark:bg-white/[0.05] border border-black/[0.08] dark:border-white/[0.08] rounded-md px-2 py-1 text-xs text-foreground focus:outline-none focus:border-b-2 focus:border-b-primary cursor-pointer"
                >
                  <option value="All" className="bg-card text-foreground">All Callers</option>
                  {uniqueCallers.map((c: any) => {
                    let display = c;
                    if (c === "detect_intent_llm") display = "Intent Classification";
                    else if (c === "generate_reply_llm") display = "Reply Draft Generation";
                    return (
                      <option key={c} value={c} className="bg-card text-foreground">{display}</option>
                    );
                  })}
                </select>
              </div>
            )}
          </div>
        </div>

        <div className="overflow-x-auto max-h-96">
          <table className="w-full text-xs text-left">
            <thead>
              <tr className="border-b border-black/[0.06] dark:border-white/[0.08] text-muted-foreground font-semibold sticky top-0 bg-white/95 dark:bg-[#2C2C2C]/95 backdrop-blur pb-2.5">
                <th className="pb-2.5">Timestamp</th>
                <th className="pb-2.5">Provider</th>
                <th className="pb-2.5">Subsystem Node</th>
                <th className="pb-2.5">Model</th>
                <th className="pb-2.5 text-center">Prompt</th>
                <th className="pb-2.5 text-center">Completion</th>
                <th className="pb-2.5 text-right">Latency</th>
                <th className="pb-2.5 text-right">Calculated Cost</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-black/[0.04] dark:divide-white/[0.05]">
              {filteredLogs.length > 0 ? (
                filteredLogs.map((log: any) => (
                  <tr key={log.id} className="hover:bg-black/[0.03] dark:hover:bg-white/[0.04] transition-colors">
                    <td className="py-2.5 text-muted-foreground whitespace-nowrap">{log.created_at}</td>
                    <td className="py-2.5">
                      <span className={cn("text-[10px] font-bold px-2 py-0.5 rounded-full border uppercase tracking-wider", getProviderBadge(log.provider))}>
                        {log.provider || 'groq'}
                      </span>
                    </td>
                    <td className="py-2.5 font-medium text-foreground">
                      {log.caller_display}
                    </td>
                    <td className="py-2.5 font-mono text-muted-foreground">{log.model_name}</td>
                    <td className="py-2.5 text-center font-mono">{log.prompt_tokens}</td>
                    <td className="py-2.5 text-center font-mono">{log.completion_tokens}</td>
                    <td className="py-2.5 text-right font-mono text-muted-foreground">{log.latency_ms} ms</td>
                    <td className="py-2.5 text-right font-mono font-semibold text-emerald-600 dark:text-emerald-400">${log.cost.toFixed(6)}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={8} className="py-6 text-center text-muted-foreground text-xs">No individual log records found matching filters.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
