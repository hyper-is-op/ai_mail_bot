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
  BarChart3,
  ShieldCheck,
  AlertTriangle,
  Calendar,
  MessageSquare,
  Coins,
  CheckCircle2,
  Mail
} from 'lucide-react';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';
import { useAppState } from '@/context/AppStateContext';

export default function LlmAnalytics() {
  const [metrics, setMetrics] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [timeWindow, setTimeWindow] = useState<'24h' | '7d' | '30d' | 'all'>('all');
  const [filterProvider, setFilterProvider] = useState('All');
  const [filterModel, setFilterModel] = useState('All');
  const [filterCaller, setFilterCaller] = useState('All');

  const { selectedClientId } = useAppState();

  const fetchMetrics = async (isRefresh = false, cid = selectedClientId, window = timeWindow) => {
    if (!cid) return;
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    
    try {
      const data = await api.getLlmMetrics(cid, window);
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
      fetchMetrics(false, selectedClientId, timeWindow);
    }
  }, [selectedClientId, timeWindow]);

  if (loading) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center space-y-4">
        <RefreshCw className="w-10 h-10 text-primary animate-spin" />
        <p className="text-sm text-zinc-400 font-medium font-mono">Compiling multi-provider token economics &amp; latency metrics...</p>
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
  const budget = metrics?.budget || { budget: null, spent: 0, percent: null, status: 'unlimited' };
  const guardrail = metrics?.guardrail_analysis || {
    productive_cost: 0,
    productive_requests: 0,
    guardrail_cost: 0,
    guardrail_requests: 0,
    guardrail_tax_percent: 0
  };
  const tokenEconomics = metrics?.token_economics || {
    avg_cost_per_email: totals.total_requests > 0 ? totals.total_cost / totals.total_requests : 0,
    avg_tokens_per_email: totals.total_requests > 0 ? (totals.total_prompt_tokens + totals.total_completion_tokens) / totals.total_requests : 0,
    avg_cost_per_conversation: 0,
    avg_tokens_per_conversation: 0,
    avg_turns_per_conversation: 1.0,
    total_conversations: 0,
    guardrail_overhead_ratio: guardrail.guardrail_tax_percent || 0,
    economics_by_intent: [],
  };
  const dailyTrends = metrics?.daily_trends || [];

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

  const maxDailyCost = Math.max(...dailyTrends.map((d: any) => d.cost), 0.001);

  return (
    <div className="space-y-6 pb-12">
      {/* Header with Title and Time Window Filter */}
      <div className="flex flex-col md:flex-row justify-between md:items-end gap-4">
        <div>
          <h2 className="text-2xl md:text-3xl font-semibold tracking-tight text-foreground flex items-center gap-2">
            <BarChart3 className="w-6 h-6 text-primary" /> Token Economics
          </h2>
          <p className="text-xs text-muted-foreground mt-1">Real-time usage analytics, token metrics, guardrail overhead, and unit economics across AI providers.</p>
        </div>
        <div className="flex flex-wrap items-center gap-3 self-start md:self-auto">
          {/* Time Window Pills */}
          <div className="flex bg-black/[0.04] dark:bg-white/[0.04] p-0.5 rounded-lg border border-black/[0.06] dark:border-white/[0.08]">
            {(['24h', '7d', '30d', 'all'] as const).map((w) => (
              <button
                key={w}
                onClick={() => setTimeWindow(w)}
                className={cn(
                  "px-3 py-1.5 text-xs font-medium rounded-md transition-all cursor-pointer",
                  timeWindow === w 
                    ? "bg-white dark:bg-zinc-800 text-foreground shadow-2xs font-semibold" 
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {w === '24h' ? '24 Hours' : w === '7d' ? '7 Days' : w === '30d' ? '30 Days' : 'All Time'}
              </button>
            ))}
          </div>

          <button 
            onClick={() => fetchMetrics(true, selectedClientId, timeWindow)} 
            disabled={refreshing}
            className="win11-card hover:bg-black/[0.04] dark:hover:bg-white/[0.06] text-foreground rounded-lg px-3.5 py-2 text-xs font-medium transition-all flex items-center gap-2 cursor-pointer shadow-2xs"
          >
            <RefreshCw className={cn("w-3.5 h-3.5", refreshing && "animate-spin text-primary")} />
            Sync Metrics
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} className="win11-card p-5 rounded-lg relative overflow-hidden group shadow-2xs">
          <div className="flex justify-between items-start mb-3">
            <span className="text-xs font-semibold text-muted-foreground">Period Cost ({timeWindow.toUpperCase()})</span>
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
              Prompt: {totals.total_prompt_tokens.toLocaleString()} | Out: {totals.total_completion_tokens.toLocaleString()}
            </p>
          </div>
        </motion.div>
      </div>

      {/* Monthly Budget & Turnover Velocity Card */}
      <div className="win11-card p-5 rounded-lg shadow-2xs space-y-4">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-primary" />
            <div>
              <h3 className="text-base font-semibold text-foreground">Budget Allocated &amp; Consumption Velocity</h3>
              <p className="text-xs text-muted-foreground">
                Turnover cycle: <span className="font-semibold text-foreground font-mono">{budget.turnover_type || 'Monthly (Calendar)'}</span> • Next Reset: <span className="font-semibold text-foreground font-mono">{budget.turnover_reset_date || 'End of Month'}</span> ({budget.days_until_reset ?? 0}d remaining)
              </p>
            </div>
          </div>
          <span className={cn(
            "text-xs px-2.5 py-1 rounded-full font-medium border flex items-center gap-1.5",
            budget.status === 'exceeded' 
              ? "bg-red-500/10 text-red-500 border-red-500/20"
              : budget.status === 'warning'
                ? "bg-amber-500/10 text-amber-500 border-amber-500/20"
                : "bg-emerald-500/10 text-emerald-500 border-emerald-500/20"
          )}>
            {budget.status === 'exceeded' ? <AlertTriangle className="w-3.5 h-3.5" /> : <ShieldCheck className="w-3.5 h-3.5" />}
            {budget.status === 'exceeded' 
              ? 'Budget Exceeded (Degrade/Hold)' 
              : budget.status === 'warning'
                ? `Budget Warning (${budget.percent}% Utilized)`
                : budget.budget 
                  ? `Quota Healthy (${budget.percent}% Utilized)`
                  : 'Unlimited (No Hard Cap)'}
          </span>
        </div>

        {/* Primary Budget Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 pt-1">
          <div className="p-3.5 rounded-lg border border-black/[0.06] dark:border-white/[0.08] bg-black/[0.02] dark:bg-white/[0.02] space-y-1">
            <span className="text-xs text-muted-foreground font-semibold">MTD Spend Consumption</span>
            <p className="text-2xl font-bold font-mono text-foreground">${Number(budget.spent || 0).toFixed(4)}</p>
            <p className="text-[11px] text-muted-foreground font-mono">
              Tokens: {(budget.spent_tokens ?? (totals.total_prompt_tokens + totals.total_completion_tokens)).toLocaleString()}
            </p>
          </div>

          <div className="p-3.5 rounded-lg border border-black/[0.06] dark:border-white/[0.08] bg-black/[0.02] dark:bg-white/[0.02] space-y-1">
            <span className="text-xs text-muted-foreground font-semibold">Budget Allocated</span>
            <p className="text-2xl font-bold font-mono text-foreground">
              {budget.budget !== null && budget.budget !== undefined ? `$${Number(budget.budget).toFixed(2)}` : '∞ Unlimited'}
            </p>
            <p className="text-[11px] text-muted-foreground">
              {budget.percent !== null && budget.percent !== undefined ? `${budget.percent}% consumed` : 'No hard budget ceiling'}
            </p>
          </div>

          <div className="p-3.5 rounded-lg border border-black/[0.06] dark:border-white/[0.08] bg-black/[0.02] dark:bg-white/[0.02] space-y-1">
            <span className="text-xs text-muted-foreground font-semibold">Day-Wise Avg Burn</span>
            <div className="text-2xl font-bold font-mono text-foreground">
              ${Number(budget.daily_avg_consumption?.avg_cost ?? 0).toFixed(4)}
              <span className="text-xs text-muted-foreground font-normal"> /day</span>
            </div>
            <div className="text-[10px] text-muted-foreground font-mono flex justify-between pt-0.5">
              <span>Min: ${Number(budget.daily_avg_consumption?.min_cost ?? 0).toFixed(4)}</span>
              <span>Max: ${Number(budget.daily_avg_consumption?.max_cost ?? 0).toFixed(4)}</span>
            </div>
          </div>

          <div className="p-3.5 rounded-lg border border-black/[0.06] dark:border-white/[0.08] bg-black/[0.02] dark:bg-white/[0.02] space-y-1">
            <span className="text-xs text-muted-foreground font-semibold">Projected Month-End</span>
            <div className="text-2xl font-bold font-mono text-primary">
              ${Number(budget.projected_month_end_spend ?? 0).toFixed(2)}
            </div>
            <p className="text-[10px] text-muted-foreground font-mono flex items-center gap-1">
              <span>Day Tokens: ~{Number(budget.daily_avg_consumption?.avg_tokens ?? 0).toLocaleString()}/d</span>
            </p>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="space-y-1 pt-1">
          <div className="flex justify-between text-xs font-mono">
            <span className="text-muted-foreground">Period Budget Consumption</span>
            <span className="font-semibold text-foreground">
              {budget.percent !== null && budget.percent !== undefined ? `${budget.percent}%` : 'N/A'}
            </span>
          </div>
          <div className="w-full bg-black/[0.06] dark:bg-white/[0.08] h-2.5 rounded-full overflow-hidden">
            <div 
              className={cn(
                "h-full transition-all duration-500 rounded-full",
                budget.status === 'exceeded' 
                  ? "bg-red-500" 
                  : budget.status === 'warning'
                    ? "bg-amber-500"
                    : "bg-emerald-500"
              )}
              style={{ width: `${Math.min(100, budget.percent || 0)}%` }}
            />
          </div>
        </div>
      </div>

      {/* Granular Unit Economics Deck (Per Email, Completed Threads, Incomplete WIP) */}
      <div className="win11-card p-5 rounded-lg shadow-2xs space-y-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
          <div>
            <h3 className="text-base font-semibold text-foreground flex items-center gap-2">
              <Coins className="w-4 h-4 text-emerald-500" /> Granular Unit Economics &amp; Conversation Lifecycle
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Unit economics comparing single emails processed against full completed multi-turn threads and active WIP burn
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-mono font-semibold border border-emerald-500/20">
              {tokenEconomics.total_conversations} threads tracked
            </span>
            <span className="text-xs px-2.5 py-1 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 font-mono font-semibold border border-amber-500/20">
              Guardrail Tax: {Number(tokenEconomics.guardrail_overhead_ratio || 0).toFixed(1)}%
            </span>
          </div>
        </div>

        {/* Section 1: Per-Email Unit Economics */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-semibold text-foreground flex items-center gap-1.5 uppercase tracking-wider text-muted-foreground">
              <Mail className="w-3.5 h-3.5 text-blue-500" /> Per-Mail Economics (All Invocations Aggregated Per Email)
            </h4>
            <span className="text-xs font-mono text-muted-foreground">
              {tokenEconomics.per_email?.total_emails ?? totals.total_requests} emails processed
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {/* Cost Per Email */}
            <div className="p-3.5 rounded-lg border border-blue-500/20 bg-blue-500/5 space-y-1">
              <span className="text-xs text-blue-600 dark:text-blue-400 font-semibold">Avg Cost / Mail</span>
              <div className="text-2xl font-bold font-mono text-foreground">
                ${Number(tokenEconomics.per_email?.avg_cost ?? tokenEconomics.avg_cost_per_email ?? 0).toFixed(5)}
              </div>
              <div className="text-[10px] text-muted-foreground font-mono flex justify-between pt-0.5">
                <span>Min: ${Number(tokenEconomics.per_email?.min_cost ?? 0).toFixed(5)}</span>
                <span>Max: ${Number(tokenEconomics.per_email?.max_cost ?? 0).toFixed(5)}</span>
              </div>
            </div>

            {/* Tokens Per Email */}
            <div className="p-3.5 rounded-lg border border-black/[0.06] dark:border-white/[0.08] bg-black/[0.02] dark:bg-white/[0.02] space-y-1">
              <span className="text-xs text-muted-foreground font-semibold">Avg Tokens / Mail</span>
              <div className="text-2xl font-bold font-mono text-foreground">
                {Math.round(tokenEconomics.per_email?.avg_tokens ?? tokenEconomics.avg_tokens_per_email ?? 0).toLocaleString()}
              </div>
              <div className="text-[10px] text-muted-foreground font-mono flex justify-between pt-0.5">
                <span>Min: {(tokenEconomics.per_email?.min_tokens ?? 0).toLocaleString()}</span>
                <span>Max: {(tokenEconomics.per_email?.max_tokens ?? 0).toLocaleString()}</span>
              </div>
            </div>

            {/* API Invocations Per Email */}
            <div className="p-3.5 rounded-lg border border-black/[0.06] dark:border-white/[0.08] bg-black/[0.02] dark:bg-white/[0.02] space-y-1">
              <span className="text-xs text-muted-foreground font-semibold">API Calls / Mail</span>
              <div className="text-2xl font-bold font-mono text-foreground">
                {Number(tokenEconomics.per_email?.api_invocations?.avg_per_mail ?? 1.0).toFixed(1)}
              </div>
              <div className="text-[10px] text-muted-foreground font-mono flex justify-between pt-0.5">
                <span>Min: {tokenEconomics.per_email?.api_invocations?.min_per_mail ?? 1} call</span>
                <span>Max: {tokenEconomics.per_email?.api_invocations?.max_per_mail ?? 1} calls</span>
              </div>
            </div>

            {/* Total Email Spend & Token Aggregate */}
            <div className="p-3.5 rounded-lg border border-black/[0.06] dark:border-white/[0.08] bg-black/[0.02] dark:bg-white/[0.02] space-y-1">
              <span className="text-xs text-muted-foreground font-semibold">Total Mail Spend</span>
              <div className="text-2xl font-bold font-mono text-foreground">
                ${Number(tokenEconomics.per_email?.total_cost ?? totals.total_cost ?? 0).toFixed(4)}
              </div>
              <p className="text-[10px] text-muted-foreground font-mono">
                Total Tokens: {(tokenEconomics.per_email?.total_tokens ?? (totals.total_prompt_tokens + totals.total_completion_tokens)).toLocaleString()}
              </p>
            </div>
          </div>
        </div>

        {/* Section 2: Completed Conversations vs Incomplete In-Flight WIP */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 pt-2">
          {/* Completed Conversations */}
          <div className="p-4 rounded-xl border border-emerald-500/20 bg-emerald-500/5 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                <h4 className="text-xs font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wide">
                  Completed Conversations (Full Multi-Turn Closed)
                </h4>
              </div>
              <span className="text-xs font-mono font-bold text-emerald-600 dark:text-emerald-400">
                {tokenEconomics.completed_conversations?.total_count ?? tokenEconomics.total_conversations ?? 0} threads
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 rounded-lg bg-white/60 dark:bg-black/40 border border-emerald-500/15 space-y-1">
                <span className="text-[11px] text-muted-foreground font-semibold">Avg Cost / Completed Thread</span>
                <div className="text-xl font-bold font-mono text-emerald-600 dark:text-emerald-400">
                  ${Number(tokenEconomics.completed_conversations?.avg_cost ?? tokenEconomics.avg_cost_per_conversation ?? 0).toFixed(5)}
                </div>
                <div className="text-[10px] text-muted-foreground font-mono flex justify-between pt-0.5">
                  <span>Min: ${Number(tokenEconomics.completed_conversations?.min_cost ?? 0).toFixed(5)}</span>
                  <span>Max: ${Number(tokenEconomics.completed_conversations?.max_cost ?? 0).toFixed(5)}</span>
                </div>
              </div>

              <div className="p-3 rounded-lg bg-white/60 dark:bg-black/40 border border-emerald-500/15 space-y-1">
                <span className="text-[11px] text-muted-foreground font-semibold">Avg Tokens / Completed Thread</span>
                <div className="text-xl font-bold font-mono text-foreground">
                  {Math.round(tokenEconomics.completed_conversations?.avg_tokens ?? tokenEconomics.avg_tokens_per_conversation ?? 0).toLocaleString()}
                </div>
                <div className="text-[10px] text-muted-foreground font-mono flex justify-between pt-0.5">
                  <span>Min: {(tokenEconomics.completed_conversations?.min_tokens ?? 0).toLocaleString()}</span>
                  <span>Max: {(tokenEconomics.completed_conversations?.max_tokens ?? 0).toLocaleString()}</span>
                </div>
              </div>
            </div>

            <div className="flex justify-between items-center text-xs font-mono text-muted-foreground pt-1 border-t border-emerald-500/10">
              <span>Avg Turns: <strong className="text-foreground">{Number(tokenEconomics.completed_conversations?.avg_turns ?? tokenEconomics.avg_turns_per_conversation ?? 1.0).toFixed(1)}</strong> (Min: {tokenEconomics.completed_conversations?.min_turns ?? 1}, Max: {tokenEconomics.completed_conversations?.max_turns ?? 1})</span>
              <span>API Calls: <strong className="text-foreground">{Number(tokenEconomics.completed_conversations?.avg_api_invocations ?? 1.0).toFixed(1)}</strong> (Max: {tokenEconomics.completed_conversations?.max_api_invocations ?? 1})</span>
            </div>
          </div>

          {/* Incomplete / In-Flight WIP Conversations */}
          <div className="p-4 rounded-xl border border-amber-500/20 bg-amber-500/5 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <Clock className="w-4 h-4 text-amber-500" />
                <h4 className="text-xs font-bold text-amber-600 dark:text-amber-400 uppercase tracking-wide">
                  Incomplete Conversations (Active In-Flight WIP)
                </h4>
              </div>
              <div className="flex items-center gap-2">
                {(tokenEconomics.incomplete_conversations?.runaway_risk_count ?? 0) > 0 && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded font-mono font-bold bg-rose-500/15 text-rose-500 border border-rose-500/25">
                    {tokenEconomics.incomplete_conversations?.runaway_risk_count} runaway alert
                  </span>
                )}
                <span className="text-xs font-mono font-bold text-amber-600 dark:text-amber-400">
                  {tokenEconomics.incomplete_conversations?.total_count ?? 0} active
                </span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 rounded-lg bg-white/60 dark:bg-black/40 border border-amber-500/15 space-y-1">
                <span className="text-[11px] text-muted-foreground font-semibold">Avg Cost Incurred (WIP)</span>
                <div className="text-xl font-bold font-mono text-amber-600 dark:text-amber-400">
                  ${Number(tokenEconomics.incomplete_conversations?.avg_cost ?? 0).toFixed(5)}
                </div>
                <div className="text-[10px] text-muted-foreground font-mono flex justify-between pt-0.5">
                  <span>Min: ${Number(tokenEconomics.incomplete_conversations?.min_cost ?? 0).toFixed(5)}</span>
                  <span>Max: ${Number(tokenEconomics.incomplete_conversations?.max_cost ?? 0).toFixed(5)}</span>
                </div>
              </div>

              <div className="p-3 rounded-lg bg-white/60 dark:bg-black/40 border border-amber-500/15 space-y-1">
                <span className="text-[11px] text-muted-foreground font-semibold">Avg Tokens Burned (WIP)</span>
                <div className="text-xl font-bold font-mono text-foreground">
                  {Math.round(tokenEconomics.incomplete_conversations?.avg_tokens ?? 0).toLocaleString()}
                </div>
                <div className="text-[10px] text-muted-foreground font-mono flex justify-between pt-0.5">
                  <span>Min: {(tokenEconomics.incomplete_conversations?.min_tokens ?? 0).toLocaleString()}</span>
                  <span>Max: {(tokenEconomics.incomplete_conversations?.max_tokens ?? 0).toLocaleString()}</span>
                </div>
              </div>
            </div>

            <div className="flex justify-between items-center text-xs font-mono text-muted-foreground pt-1 border-t border-amber-500/10">
              <span>WIP Total Spend: <strong className="text-foreground">${Number(tokenEconomics.incomplete_conversations?.total_cost ?? 0).toFixed(4)}</strong></span>
              <span>WIP Tokens: <strong className="text-foreground">{(tokenEconomics.incomplete_conversations?.total_tokens ?? 0).toLocaleString()}</strong></span>
            </div>
          </div>
        </div>

        {/* Intent Token Economics Breakdown */}
        {tokenEconomics.economics_by_intent && tokenEconomics.economics_by_intent.length > 0 && (
          <div className="pt-2 border-t border-black/[0.06] dark:border-white/[0.08] space-y-2">
            <h4 className="text-xs font-semibold text-foreground">Token &amp; Cost Breakdown by Customer Technical Intent</h4>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-black/[0.06] dark:border-white/[0.08] text-muted-foreground font-semibold pb-1.5">
                    <th className="py-2 px-3">Technical Intent</th>
                    <th className="py-2 px-3 text-right">Threads</th>
                    <th className="py-2 px-3 text-right">Total Tokens</th>
                    <th className="py-2 px-3 text-right">Total Spend ($)</th>
                    <th className="py-2 px-3 text-right">Avg Cost / Thread</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-black/[0.04] dark:divide-white/[0.04]">
                  {tokenEconomics.economics_by_intent.map((item: any, idx: number) => (
                    <tr key={idx} className="hover:bg-black/[0.02] dark:hover:bg-white/[0.02]">
                      <td className="py-2 px-3 font-semibold font-mono text-foreground flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-primary" />
                        {item.intent}
                      </td>
                      <td className="py-2 px-3 text-right font-mono text-foreground">{item.conversations}</td>
                      <td className="py-2 px-3 text-right font-mono text-muted-foreground">{item.total_tokens.toLocaleString()}</td>
                      <td className="py-2 px-3 text-right font-mono font-semibold text-foreground">${item.total_cost.toFixed(4)}</td>
                      <td className="py-2 px-3 text-right font-mono text-emerald-600 dark:text-emerald-400 font-bold">${item.avg_cost.toFixed(5)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* 14-Day Spend & Token Volume Trend Chart */}
      <div className="win11-card p-5 rounded-lg shadow-2xs space-y-4">
        <div className="flex justify-between items-center">
          <h3 className="text-base font-semibold text-foreground flex items-center gap-2">
            <Calendar className="w-4 h-4 text-primary" /> 14-Day Daily Burn-Rate &amp; Volume Trend
          </h3>
          <span className="text-xs text-muted-foreground font-mono">Rolling daily telemetry</span>
        </div>

        {dailyTrends.length > 0 ? (
          <div className="space-y-3">
            <div className="h-44 flex items-end gap-2 pt-6 pb-2 px-2 border-b border-black/[0.06] dark:border-white/[0.08]">
              {dailyTrends.map((d: any, idx: number) => {
                const heightPercent = Math.max(8, Math.min(100, Math.round((d.cost / maxDailyCost) * 100)));
                return (
                  <div key={idx} className="flex-1 flex flex-col items-center gap-1 group relative">
                    {/* Tooltip */}
                    <div className="opacity-0 group-hover:opacity-100 transition-opacity absolute -top-12 bg-zinc-900 text-white text-[10px] py-1 px-2 rounded pointer-events-none whitespace-nowrap z-10 font-mono shadow-lg">
                      <p>{d.date}: ${d.cost.toFixed(4)}</p>
                      <p className="text-zinc-400">{d.requests} calls | {d.tokens.toLocaleString()} tok</p>
                    </div>

                    <div className="w-full flex items-end justify-center h-32">
                      <div 
                        className="w-full max-w-[28px] bg-primary/80 hover:bg-primary rounded-t transition-all"
                        style={{ height: `${heightPercent}%` }}
                      />
                    </div>
                    <span className="text-[10px] text-muted-foreground font-mono truncate max-w-full">
                      {d.date}
                    </span>
                  </div>
                );
              })}
            </div>
            <div className="flex justify-between items-center text-xs text-muted-foreground px-1 font-mono">
              <span>Peak Day: ${maxDailyCost.toFixed(4)}</span>
              <span>14-Day Invocations: {dailyTrends.reduce((acc: number, d: any) => acc + d.requests, 0)} calls</span>
            </div>
          </div>
        ) : (
          <div className="py-8 text-center text-xs text-muted-foreground">
            No daily telemetry points recorded in the last 14 days.
          </div>
        )}
      </div>

      {/* Guardrail Tax vs Productive Generation Split */}
      <div className="win11-card p-5 rounded-lg shadow-2xs space-y-4">
        <div className="flex justify-between items-center">
          <h3 className="text-base font-semibold text-foreground flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-500" /> Guardrail Tax vs. Productive Generation
          </h3>
          <span className="text-xs font-mono text-muted-foreground">
            Guardrail Overhead: <strong className="text-foreground">{guardrail.guardrail_tax_percent}%</strong>
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="p-4 rounded-lg border border-black/[0.06] dark:border-white/[0.08] bg-black/[0.02] dark:bg-white/[0.02] space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-500" /> Productive Operations
              </span>
              <span className="text-xs text-muted-foreground font-mono">{guardrail.productive_requests} calls</span>
            </div>
            <p className="text-xl font-bold font-mono text-foreground">${guardrail.productive_cost.toFixed(5)}</p>
            <p className="text-[11px] text-muted-foreground">
              Reply draft generation, customer intent classification, and resolution flows.
            </p>
          </div>

          <div className="p-4 rounded-lg border border-black/[0.06] dark:border-white/[0.08] bg-black/[0.02] dark:bg-white/[0.02] space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-xs font-semibold text-amber-600 dark:text-amber-400 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-amber-500" /> Guardrail &amp; Evaluation Tax
              </span>
              <span className="text-xs text-muted-foreground font-mono">{guardrail.guardrail_requests} calls</span>
            </div>
            <p className="text-xl font-bold font-mono text-foreground">${guardrail.guardrail_cost.toFixed(5)}</p>
            <p className="text-[11px] text-muted-foreground">
              Quality scoring, hallucination guards, thread summarization, and issue scanning.
            </p>
          </div>
        </div>

        {/* Visual Split Bar */}
        <div className="space-y-1">
          <div className="w-full bg-black/[0.06] dark:bg-white/[0.08] h-3 rounded-full overflow-hidden flex">
            <div 
              className="bg-emerald-500 h-full transition-all" 
              style={{ width: `${Math.max(0, 100 - guardrail.guardrail_tax_percent)}%` }} 
              title={`Productive: ${(100 - guardrail.guardrail_tax_percent).toFixed(1)}%`}
            />
            <div 
              className="bg-amber-500 h-full transition-all" 
              style={{ width: `${guardrail.guardrail_tax_percent}%` }} 
              title={`Guardrails: ${guardrail.guardrail_tax_percent}%`}
            />
          </div>
          <div className="flex justify-between text-[11px] text-muted-foreground">
            <span>Productive: {(100 - guardrail.guardrail_tax_percent).toFixed(1)}%</span>
            <span>Guardrail Evaluation: {guardrail.guardrail_tax_percent}%</span>
          </div>
        </div>
      </div>

      {/* Multi-Provider Breakdown */}
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
              No provider telemetry recorded for this time window.
            </div>
          )}
        </div>
      </div>

      {/* Model & Caller Tables */}
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
                    <td colSpan={6} className="py-6 text-center text-muted-foreground text-xs">No model analytics recorded for this period.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="win11-card p-5 rounded-lg shadow-2xs">
          <h3 className="text-base font-semibold text-foreground mb-4 flex items-center gap-2">
            <Terminal className="w-4 h-4 text-accent" /> Subsystem Node Volume &amp; Costs
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
                        <span className="w-1.5 h-1.5 rounded-full bg-primary" />
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
                    <td colSpan={6} className="py-6 text-center text-muted-foreground text-xs">No caller logs tracked for this period.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Granular Execution Logs Table with Attribution */}
      <div className="win11-card p-5 rounded-lg shadow-2xs">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-4">
          <h3 className="text-base font-semibold text-foreground flex items-center gap-2">
            <Activity className="w-4 h-4 text-emerald-500" /> Granular Execution Logs &amp; Thread Attribution
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
                    else if (c === "llm_score") display = "Output Quality Evaluation";
                    else if (c === "generate_summary_llm") display = "Thread Summarization";
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
                <th className="pb-2.5">Attribution</th>
                <th className="pb-2.5">Model</th>
                <th className="pb-2.5 text-center">Prompt</th>
                <th className="pb-2.5 text-center">Completion</th>
                <th className="pb-2.5 text-right">Latency</th>
                <th className="pb-2.5 text-right">Cost</th>
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
                    <td className="py-2.5 font-mono text-muted-foreground">
                      {log.thread_id || log.email_log_id ? (
                        <span className="inline-flex items-center gap-1 text-[11px] px-1.5 py-0.5 rounded bg-black/[0.04] dark:bg-white/[0.06] text-foreground">
                          <MessageSquare className="w-3 h-3 text-primary" />
                          {log.email_log_id ? `#${log.email_log_id}` : ''}
                          {log.thread_id ? ` (${log.thread_id.slice(0, 8)})` : ''}
                        </span>
                      ) : (
                        <span className="text-[10px] text-muted-foreground italic">System Node</span>
                      )}
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
                  <td colSpan={9} className="py-6 text-center text-muted-foreground text-xs">No individual log records found matching filters for this period.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
