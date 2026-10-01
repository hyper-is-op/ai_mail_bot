import { useState, useEffect, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { 
  RefreshCw, AlertCircle, Loader2,
  Mail, Bot, Cpu, Clock, Ticket,
  ArrowRight
} from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';
import { SettingsCard } from '@/components/fluent';
import LlmAnalytics from './LlmAnalytics';
import { useAppState } from '@/context/AppStateContext';

function formatRelativeDuration(seconds: number | null | undefined): string {
  if (seconds === null || seconds === undefined || isNaN(seconds)) return 'Never';
  if (seconds < 60) return `${Math.floor(seconds)}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(seconds / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export default function Dashboard() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { theme, selectedClientId, setSelectedClientId, clients } = useAppState();

  const activeTab = searchParams.get('tab') === 'llm' ? 'llm' : 'email';

  const handleTabChange = (tab: 'email' | 'llm') => {
    if (tab === 'llm') {
      setSearchParams({ tab: 'llm' });
    } else {
      setSearchParams({});
    }
  };

  const getFirstDayOfCurrentMonth = () => {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    return `${y}-${m}-01`;
  };

  const getLastDayOfCurrentMonth = () => {
    const d = new Date();
    const y = d.getFullYear();
    const m = d.getMonth() + 1;
    const lastDay = new Date(y, m, 0).getDate();
    const formattedMonth = String(m).padStart(2, '0');
    const formattedDay = String(lastDay).padStart(2, '0');
    return `${y}-${formattedMonth}-${formattedDay}`;
  };

  const [metrics, setMetrics] = useState({
    total_emails: 0,
    pending_emails: 0,
    ai_replies: 0,
    failed_emails: 0,
    tickets_generated: 0,
    orders_tracked: 0,
    active_accounts: 0,
    avg_confidence: 0,
    threshold: 80,
    confidence_breakdown: { passed_threshold: 0, below_threshold: 0, hallucination_risk: 0, high: 0, borderline: 0, low: 0 },
    escalation_risk_count: 0,
    oldest_pending_seconds: 0,
    worker_heartbeat: { status: 'offline', last_seen_sec: null, label: 'Offline' } as any,
    client_sync: null as any,
    client_breakdown: [] as any[],
  });
  
  const [chartData, setChartData] = useState<any[]>([]);
  const [recentEmails, setRecentEmails] = useState<any[]>([]);
  const [realLatency, setRealLatency] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');
  const [rangeType, setRangeType] = useState('today');
  const [startDate, setStartDate] = useState(getFirstDayOfCurrentMonth());
  const [endDate, setEndDate] = useState(getLastDayOfCurrentMonth());
  const [autoRefresh, setAutoRefresh] = useState<'off' | '30' | '60'>('off');

  useEffect(() => {
    if (selectedClientId) {
      fetchStats(selectedClientId);
    }
  }, [selectedClientId, rangeType]);

  // Auto-refresh interval handler
  useEffect(() => {
    if (autoRefresh === 'off' || !selectedClientId) return;
    const intervalMs = parseInt(autoRefresh, 10) * 1000;
    const timer = setInterval(() => {
      fetchStats(selectedClientId, true);
    }, intervalMs);
    return () => clearInterval(timer);
  }, [autoRefresh, selectedClientId, rangeType, startDate, endDate]);

  const fetchStats = async (cid: string = selectedClientId, silent = false) => {
    if (!cid) return;
    if (rangeType === 'custom' && (!startDate || !endDate)) {
      return;
    }
    if (!silent) setLoading(true);
    setErrorMsg('');
    try {
      const [statsRes, llmRes, emailsRes] = await Promise.allSettled([
        api.getDashboardStats(cid, rangeType, startDate, endDate),
        api.getLlmMetrics(cid),
        api.getEmails(cid),
      ]);

      if (statsRes.status === 'fulfilled' && statsRes.value) {
        const stats = statsRes.value;
        setMetrics({
          total_emails: stats.total_emails || 0,
          pending_emails: stats.pending_emails || 0,
          ai_replies: stats.ai_replies || 0,
          failed_emails: stats.failed_emails || 0,
          tickets_generated: stats.tickets_generated || 0,
          orders_tracked: stats.orders_tracked || 0,
          active_accounts: stats.active_accounts || 0,
          avg_confidence: stats.avg_confidence || 0,
          threshold: stats.threshold || 80,
          confidence_breakdown: stats.confidence_breakdown || { passed_threshold: 0, below_threshold: 0, hallucination_risk: 0, high: 0, borderline: 0, low: 0 },
          escalation_risk_count: stats.escalation_risk_count || 0,
          oldest_pending_seconds: stats.oldest_pending_seconds || 0,
          worker_heartbeat: stats.worker_heartbeat || { status: 'offline', last_seen_sec: null, label: 'Offline' },
          client_sync: stats.client_sync || null,
          client_breakdown: stats.client_breakdown || [],
        });
        setChartData(stats.chart_data || []);
      }

      if (llmRes.status === 'fulfilled' && llmRes.value?.totals) {
        setRealLatency(llmRes.value.totals.avg_latency || 0);
      }

      if (emailsRes.status === 'fulfilled' && Array.isArray(emailsRes.value)) {
        setRecentEmails(emailsRes.value.slice(0, 5));
      }
    } catch (err: any) {
      console.error("Dashboard stats failed to load:", err);
      if (!silent) setErrorMsg('Operational data is temporarily unavailable.');
    } finally {
      if (!silent) setLoading(false);
    }
  };

  const handleApplyCustomRange = () => {
    if (startDate && endDate && selectedClientId) {
      fetchStats(selectedClientId);
    }
  };

  const total = metrics.total_emails || 0;
  const successRate = total > 0 ? Math.round((metrics.ai_replies / total) * 100) : 0;
  const ticketRate = total > 0 ? Math.round((metrics.tickets_generated / total) * 100) : 0;
  const pendingRate = total > 0 ? Math.round((metrics.pending_emails / total) * 100) : 0;
  const failedRate = total > 0 ? Math.round((metrics.failed_emails / total) * 100) : 0;

  // Chart theme colors
  const isDark = theme === 'dark';
  const primaryColor = isDark ? '#60CDFF' : '#0067C0'; // Win11 Primary Blue
  const aiColor = isDark ? '#34D399' : '#10B981';      // Win11 Emerald Green

  // Process chart data so single points render clean, visible curves
  const processedChartData = useMemo(() => {
    if (!chartData || chartData.length === 0) return [];
    if (chartData.length === 1) {
      const item = chartData[0];
      const name = item.name || '';
      const hourMatch = name.match(/^(\d{1,2})\s*(AM|PM)$/i);
      if (hourMatch) {
        const hour = parseInt(hourMatch[1], 10);
        const meridian = hourMatch[2].toUpperCase();
        const prevHour = hour === 1 ? 12 : hour - 1;
        const nextHour = hour === 12 ? 1 : hour + 1;
        const prevMeridian = (hour === 12 && meridian === 'PM') ? 'AM' : (hour === 12 && meridian === 'AM') ? 'PM' : meridian;
        const nextMeridian = (hour === 11 && meridian === 'AM') ? 'PM' : (hour === 11 && meridian === 'PM') ? 'AM' : meridian;
        return [
          { name: `${prevHour} ${prevMeridian}`, emails: 0, aiReplied: 0 },
          item,
          { name: `${nextHour} ${nextMeridian}`, emails: 0, aiReplied: 0 },
        ];
      }
      return [
        { name: 'Prior', emails: 0, aiReplied: 0 },
        item,
        { name: 'Later', emails: 0, aiReplied: 0 },
      ];
    }
    return chartData;
  }, [chartData]);

  const currentClient = clients.find((c) => c.client_id === selectedClientId);
  const clientDisplayName = currentClient?.company_name || currentClient?.name || selectedClientId;

  const getStatusBadge = (status: string) => {
    const s = (status || '').toLowerCase();
    if (s.includes('replied')) {
      return (
        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
          Auto-Replied
        </span>
      );
    }
    if (s.includes('ticket')) {
      return (
        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20">
          Escalated
        </span>
      );
    }
    if (s.includes('fail') || s.includes('error')) {
      return (
        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20">
          Failed
        </span>
      );
    }
    return (
      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
        Pending Review
      </span>
    );
  };

  if (activeTab === 'llm') {
    return <LlmAnalytics />;
  }

  return (
    <div className="space-y-4 sm:space-y-5 select-none pb-12">
      {/* Windows 11 Dashboard Header */}
      <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-3">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <span>Email Operations Dashboard</span>
            {selectedClientId && selectedClientId !== 'ALL' && (
              <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">
                {clientDisplayName}
              </span>
            )}
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Operational Email Telemetry, Automation Rates &amp; AI Intelligence
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Daemon Ingestion Heartbeat */}
          <div 
            title={metrics.client_sync?.last_sync_sec !== null && metrics.client_sync?.last_sync_sec !== undefined 
              ? `Last account sweep: ${formatRelativeDuration(metrics.client_sync.last_sync_sec)}`
              : "Real-time IMAP listener heartbeat status"}
            className="flex items-center gap-2 win11-card px-2.5 py-1.5 rounded-md border border-black/[0.06] dark:border-white/[0.08] shadow-2xs"
          >
            <span className={cn(
              "w-2 h-2 rounded-full",
              metrics.worker_heartbeat?.status === 'healthy' ? "bg-emerald-500 animate-pulse" :
              metrics.worker_heartbeat?.status === 'delayed' ? "bg-amber-500" :
              metrics.worker_heartbeat?.status === 'stalled' ? "bg-rose-500 animate-ping" :
              metrics.worker_heartbeat?.status === 'standby' ? "bg-amber-400" : "bg-zinc-400"
            )} />
            <span className="text-[11px] font-medium text-foreground">
              Daemon: <span className={cn(
                "font-semibold",
                metrics.worker_heartbeat?.status === 'healthy' ? "text-emerald-600 dark:text-emerald-400" :
                metrics.worker_heartbeat?.status === 'delayed' || metrics.worker_heartbeat?.status === 'standby' ? "text-amber-600 dark:text-amber-400" :
                "text-rose-600 dark:text-rose-400"
              )}>
                {metrics.worker_heartbeat?.label || 'Offline'}
                {metrics.worker_heartbeat?.last_seen_sec !== null && metrics.worker_heartbeat?.last_seen_sec !== undefined && (
                  <span className="font-mono text-[10px] ml-1 opacity-80">({metrics.worker_heartbeat.last_seen_sec}s)</span>
                )}
              </span>
            </span>
          </div>

          {metrics.client_sync && metrics.client_sync.last_sync_sec !== null && (
            <div 
              title="Time since last successful mailbox poll check"
              className="hidden md:flex items-center gap-1.5 win11-card px-2 py-1.5 rounded-md border border-black/[0.06] dark:border-white/[0.08] shadow-2xs text-[11px]"
            >
              <span className="text-muted-foreground">Mailbox:</span>
              <span className="font-semibold text-foreground">
                {formatRelativeDuration(metrics.client_sync.last_sync_sec)}
              </span>
            </div>
          )}

          {/* Auto-Refresh Control */}
          <div className="flex items-center gap-1.5 win11-card px-2.5 py-1.5 rounded-md border border-black/[0.06] dark:border-white/[0.08] shadow-2xs">
            <span className={cn(
              "w-2 h-2 rounded-full",
              autoRefresh !== 'off' ? "bg-emerald-500 animate-pulse" : "bg-zinc-400 opacity-60"
            )} />
            <span className="text-[11px] text-muted-foreground font-medium">Auto-refresh:</span>
            <select
              value={autoRefresh}
              onChange={(e) => setAutoRefresh(e.target.value as any)}
              className="bg-transparent text-xs font-semibold text-foreground focus:outline-none cursor-pointer"
            >
              <option value="off" className="dark:bg-zinc-900">Off</option>
              <option value="30" className="dark:bg-zinc-900">30s</option>
              <option value="60" className="dark:bg-zinc-900">60s</option>
            </select>
          </div>

          <button
            onClick={() => fetchStats(selectedClientId)}
            className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-md win11-card hover:bg-black/[0.04] dark:hover:bg-white/[0.06] text-foreground transition-all cursor-pointer shadow-2xs"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Refresh Metrics</span>
          </button>
        </div>
      </div>

      {loading ? (
        <div className="min-h-[50vh] flex flex-col items-center justify-center space-y-4">
          <Loader2 className="w-9 h-9 text-primary animate-spin" />
          <p className="text-xs text-muted-foreground font-medium">Gathering operational telemetry and mail metrics...</p>
        </div>
      ) : (
        <>
          {/* Date Filter Panel */}
          <div className="win11-card p-2 px-3 rounded-lg flex flex-col lg:flex-row lg:items-center justify-between gap-2.5 shadow-2xs">
            <div className="flex flex-wrap items-center gap-1">
              {[
                { id: 'all', label: 'All Time' },
                { id: 'today', label: 'Today' },
                { id: 'yesterday', label: 'Yesterday' },
                { id: 'this_month', label: 'Current Month' },
                { id: 'last_month', label: 'Last Month' },
                { id: 'custom', label: 'Custom Range' },
              ].map((r) => (
                <button
                  key={r.id}
                  onClick={() => setRangeType(r.id)}
                  className={cn(
                    "px-2.5 py-1 rounded-md text-xs font-medium transition-all",
                    rangeType === r.id
                      ? "bg-primary text-primary-foreground font-semibold shadow-2xs"
                      : "text-muted-foreground hover:text-foreground hover:bg-black/[0.04] dark:hover:bg-white/[0.05]"
                  )}
                >
                  {r.label}
                </button>
              ))}
            </div>

            {rangeType === 'custom' && (
              <div className="flex flex-wrap items-center gap-2">
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="bg-white dark:bg-[#202020] border border-black/[0.08] dark:border-white/[0.08] rounded-md px-2 py-0.5 text-xs text-foreground focus:outline-none focus:border-b-2 focus:border-b-primary cursor-pointer"
                />
                <span className="text-xs text-muted-foreground">to</span>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="bg-white dark:bg-[#202020] border border-black/[0.08] dark:border-white/[0.08] rounded-md px-2 py-0.5 text-xs text-foreground focus:outline-none focus:border-b-2 focus:border-b-primary cursor-pointer"
                />
                <button
                  onClick={handleApplyCustomRange}
                  className="px-2.5 py-0.5 bg-primary text-primary-foreground rounded-md text-xs font-semibold hover:opacity-90 transition-all cursor-pointer"
                >
                  Apply
                </button>
              </div>
            )}
          </div>

          {errorMsg && (
            <div className="p-3 rounded-lg border bg-rose-500/10 border-rose-500/20 text-rose-600 dark:text-rose-400 flex items-center gap-2 text-xs font-medium">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* 5-Card Analytics KPI Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            {/* Card 1: Total Ingested */}
            <div className="win11-card p-3.5 rounded-xl border border-black/[0.06] dark:border-white/[0.08] shadow-2xs space-y-1">
              <div className="flex items-center justify-between text-muted-foreground">
                <span className="text-xs font-semibold">Total Ingested</span>
                <div className="p-1.5 rounded-md bg-blue-500/10 text-blue-600 dark:text-blue-400">
                  <Mail className="w-3.5 h-3.5" />
                </div>
              </div>
              <div className="text-xl sm:text-2xl font-bold font-mono tracking-tight text-foreground">
                {metrics.total_emails.toLocaleString()}
              </div>
              <div className="text-[11px] text-muted-foreground truncate">
                {metrics.active_accounts} active connector{metrics.active_accounts === 1 ? '' : 's'}
              </div>
            </div>

            {/* Card 2: AI Replied */}
            <div className="win11-card p-3.5 rounded-xl border border-black/[0.06] dark:border-white/[0.08] shadow-2xs space-y-1">
              <div className="flex items-center justify-between text-muted-foreground">
                <span className="text-xs font-semibold">AI Automated</span>
                <div className="p-1.5 rounded-md bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                  <Bot className="w-3.5 h-3.5" />
                </div>
              </div>
              <div className="text-xl sm:text-2xl font-bold font-mono tracking-tight text-foreground">
                {metrics.ai_replies.toLocaleString()}
              </div>
              <div className="text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold">
                {successRate}% auto-reply rate
              </div>
            </div>

            {/* Card 3: Pending Review & SLA */}
            <div 
              onClick={() => navigate('/drafts')}
              className="win11-card p-3.5 rounded-xl border border-black/[0.06] dark:border-white/[0.08] shadow-2xs space-y-1 cursor-pointer hover:border-amber-500/40 transition-all group"
            >
              <div className="flex items-center justify-between text-muted-foreground">
                <span className="text-xs font-semibold group-hover:text-foreground">Pending Review</span>
                <div className="p-1.5 rounded-md bg-amber-500/10 text-amber-600 dark:text-amber-400">
                  <Clock className="w-3.5 h-3.5" />
                </div>
              </div>
              <div className="text-xl sm:text-2xl font-bold font-mono tracking-tight text-foreground">
                {metrics.pending_emails.toLocaleString()}
              </div>
              <div className={cn(
                "text-[11px] font-semibold flex items-center justify-between",
                metrics.pending_emails > 0 && metrics.oldest_pending_seconds > 3600
                  ? "text-rose-600 dark:text-rose-400 font-bold"
                  : metrics.pending_emails > 0
                  ? "text-amber-600 dark:text-amber-400"
                  : "text-emerald-600 dark:text-emerald-400"
              )}>
                <span className="truncate">
                  {metrics.pending_emails > 0 && metrics.oldest_pending_seconds > 0 
                    ? `Queue age: ${formatRelativeDuration(metrics.oldest_pending_seconds)}` 
                    : metrics.pending_emails > 0 ? 'Awaiting operator' : 'Queue clear'}
                </span>
                <ArrowRight className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
              </div>
            </div>

            {/* Card 4: Tickets Escalated */}
            <div 
              onClick={() => navigate('/tickets')}
              className="win11-card p-3.5 rounded-xl border border-black/[0.06] dark:border-white/[0.08] shadow-2xs space-y-1 cursor-pointer hover:border-purple-500/40 transition-all group"
            >
              <div className="flex items-center justify-between text-muted-foreground">
                <span className="text-xs font-semibold group-hover:text-foreground">Escalated</span>
                <div className="p-1.5 rounded-md bg-purple-500/10 text-purple-600 dark:text-purple-400">
                  <Ticket className="w-3.5 h-3.5" />
                </div>
              </div>
              <div className="text-xl sm:text-2xl font-bold font-mono tracking-tight text-foreground">
                {metrics.tickets_generated.toLocaleString()}
              </div>
              <div className="text-[11px] text-purple-600 dark:text-purple-400 font-semibold flex items-center justify-between">
                <span>{ticketRate}% of total</span>
                <ArrowRight className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
              </div>
            </div>

            {/* Card 5: Processing Failures & Escalation Triage */}
            <div 
              onClick={() => navigate('/inbox')}
              className="win11-card p-3.5 rounded-xl border border-black/[0.06] dark:border-white/[0.08] shadow-2xs space-y-1 cursor-pointer hover:border-rose-500/40 transition-all group col-span-2 sm:col-span-1"
            >
              <div className="flex items-center justify-between text-muted-foreground">
                <span className="text-xs font-semibold group-hover:text-foreground">Errors &amp; Triage</span>
                <div className="p-1.5 rounded-md bg-rose-500/10 text-rose-600 dark:text-rose-400">
                  <AlertCircle className="w-3.5 h-3.5" />
                </div>
              </div>
              <div className="text-xl sm:text-2xl font-bold font-mono tracking-tight text-foreground">
                {metrics.failed_emails.toLocaleString()}
              </div>
              <div className={cn(
                "text-[11px] font-semibold flex items-center justify-between",
                metrics.escalation_risk_count > 0 || metrics.failed_emails > 0 ? "text-rose-600 dark:text-rose-400" : "text-muted-foreground"
              )}>
                <span className="truncate">
                  {metrics.escalation_risk_count > 0 
                    ? `${metrics.escalation_risk_count} urgent/frustrated` 
                    : metrics.failed_emails > 0 ? `${metrics.failed_emails} errors logged` : '0 errors'}
                </span>
                <ArrowRight className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
              </div>
            </div>
          </div>

          {/* Analytical Charts & Operational Resolution Section */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
            {/* Left 8 Cols: Ingestion & AI Automation AreaChart */}
            <div className="lg:col-span-8 space-y-4">
              <SettingsCard
                title="Email Ingestion & Automation Timeline"
                description="Live telemetry comparing raw incoming mail vs AI-generated responses"
              >
                <div className="p-4 pt-2">
                  {/* Telemetry Legend */}
                  <div className="flex items-center justify-end gap-4 text-[11px] mb-3">
                    <div className="flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: primaryColor }} />
                      <span className="text-muted-foreground font-medium">Inbound Emails</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: aiColor }} />
                      <span className="text-muted-foreground font-medium">AI Replied</span>
                    </div>
                  </div>

                  <div className="h-[250px] w-full">
                    {processedChartData && processedChartData.length > 0 ? (
                      <ResponsiveContainer width="100%" height="100%" minHeight={220}>
                        <AreaChart data={processedChartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                          <defs>
                            <linearGradient id="colorEmails" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor={primaryColor} stopOpacity={0.35}/>
                              <stop offset="95%" stopColor={primaryColor} stopOpacity={0.02}/>
                            </linearGradient>
                            <linearGradient id="colorAI" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor={aiColor} stopOpacity={0.35}/>
                              <stop offset="95%" stopColor={aiColor} stopOpacity={0.02}/>
                            </linearGradient>
                          </defs>
                          <XAxis 
                            dataKey="name" 
                            stroke="hsl(var(--muted-foreground))" 
                            fontSize={10} 
                            tickLine={false} 
                            axisLine={false} 
                          />
                          <YAxis 
                            stroke="hsl(var(--muted-foreground))" 
                            fontSize={10} 
                            tickLine={false} 
                            axisLine={false} 
                            allowDecimals={false}
                          />
                          <Tooltip 
                            content={({ active, payload, label }) => {
                              if (!active || !payload?.length) return null;
                              return (
                                <div className="p-2.5 rounded-lg border border-black/[0.1] dark:border-white/[0.1] bg-white dark:bg-[#2C2C2C] shadow-lg text-xs space-y-1.5 min-w-[140px]">
                                  <div className="font-semibold text-foreground border-b border-black/[0.06] dark:border-white/[0.06] pb-1 text-[11px]">
                                    {label}
                                  </div>
                                  {payload.map((entry: any) => (
                                    <div key={entry.name} className="flex items-center justify-between gap-3 text-[11px]">
                                      <span className="flex items-center gap-1.5 font-medium" style={{ color: entry.stroke || entry.color }}>
                                        <span className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.stroke || entry.color }} />
                                        {entry.name}
                                      </span>
                                      <span className="font-bold text-foreground font-mono">
                                        {entry.value}
                                      </span>
                                    </div>
                                  ))}
                                </div>
                              );
                            }}
                          />
                          <Area 
                            type="monotone" 
                            dataKey="emails" 
                            stroke={primaryColor} 
                            strokeWidth={2} 
                            fillOpacity={1} 
                            fill="url(#colorEmails)" 
                            name="Inbound Emails" 
                            dot={{ r: 3.5, strokeWidth: 2, fill: isDark ? '#202020' : '#FFFFFF', stroke: primaryColor }}
                            activeDot={{ r: 5.5, strokeWidth: 2, fill: primaryColor }}
                          />
                          <Area 
                            type="monotone" 
                            dataKey="aiReplied" 
                            stroke={aiColor} 
                            strokeWidth={2} 
                            fillOpacity={1} 
                            fill="url(#colorAI)" 
                            name="AI Replied" 
                            dot={{ r: 3.5, strokeWidth: 2, fill: isDark ? '#202020' : '#FFFFFF', stroke: aiColor }}
                            activeDot={{ r: 5.5, strokeWidth: 2, fill: aiColor }}
                          />
                        </AreaChart>
                      </ResponsiveContainer>
                    ) : (
                      <div className="h-full flex items-center justify-center text-xs text-muted-foreground">
                        No telemetry data recorded for the selected timeframe.
                      </div>
                    )}
                  </div>

                  {/* Summary Footer with Real Latency, Quality Triage & Escalation Alerts */}
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 pt-3 mt-3 border-t border-black/[0.06] dark:border-white/[0.08] text-center">
                    <div className="p-2 rounded-md bg-black/[0.02] dark:bg-white/[0.02]">
                      <div className="text-[10px] text-muted-foreground font-medium">Avg AI Confidence</div>
                      <div className="text-sm font-bold text-primary mt-0.5 font-mono">
                        {metrics.avg_confidence}%
                      </div>
                      <div className="text-[10px] mt-0.5">
                        {((metrics.confidence_breakdown as any)?.hallucination_risk ?? metrics.confidence_breakdown?.low) > 0 ? (
                          <span className="text-rose-600 dark:text-rose-400 font-semibold">
                            {(metrics.confidence_breakdown as any)?.hallucination_risk ?? metrics.confidence_breakdown?.low} at risk (&lt;60%)
                          </span>
                        ) : (
                          <span className="text-muted-foreground">0 low-signal</span>
                        )}
                      </div>
                    </div>
                    <div className="p-2 rounded-md bg-black/[0.02] dark:bg-white/[0.02]">
                      <div className="text-[10px] text-muted-foreground font-medium">Escalation &amp; Sentiment Risk</div>
                      <div className="text-sm font-bold text-foreground mt-0.5 font-mono flex items-center justify-center gap-1">
                        <span className={metrics.escalation_risk_count > 0 ? "text-rose-600 dark:text-rose-400" : ""}>
                          {metrics.escalation_risk_count}
                        </span>
                        <span className="text-[11px] text-muted-foreground font-normal">flagged</span>
                      </div>
                      <div className="text-[10px] text-muted-foreground mt-0.5">
                        Frustrated / High Priority
                      </div>
                    </div>
                    <div className="p-2 rounded-md bg-black/[0.02] dark:bg-white/[0.02] col-span-2 sm:col-span-1">
                      <div className="text-[10px] text-muted-foreground font-medium">Model Latency</div>
                      <div className="text-sm font-bold text-emerald-600 dark:text-emerald-400 mt-0.5 font-mono">
                        {realLatency > 0 ? `${(realLatency / 1000).toFixed(2)}s / call` : 'Active'}
                      </div>
                      <div className="text-[10px] text-muted-foreground mt-0.5">
                        Multi-provider inference
                      </div>
                    </div>
                  </div>
                </div>
              </SettingsCard>
            </div>

            {/* Right 4 Cols: Operational Resolution Breakdown */}
            <div className="lg:col-span-4 space-y-4">
              <SettingsCard
                title="Resolution Breakdown"
                description="Distribution of inbound mail across processing pipelines"
              >
                <div className="p-4 space-y-4">
                  {/* Progress 1: Auto-Reply */}
                  <div className="space-y-1.5">
                    <div className="flex justify-between items-center text-xs">
                      <span className="font-medium text-foreground flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-emerald-500" />
                        AI Auto-Replied
                      </span>
                      <span className="font-mono font-semibold text-emerald-600 dark:text-emerald-400">
                        {metrics.ai_replies} ({successRate}%)
                      </span>
                    </div>
                    <div className="w-full h-1.5 rounded-full bg-black/[0.06] dark:bg-white/[0.08] overflow-hidden">
                      <div 
                        className="h-full bg-emerald-500 rounded-full transition-all duration-500" 
                        style={{ width: `${Math.min(successRate, 100)}%` }} 
                      />
                    </div>
                  </div>

                  {/* Progress 2: Escalated Tickets */}
                  <div className="space-y-1.5">
                    <div className="flex justify-between items-center text-xs">
                      <span className="font-medium text-foreground flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-purple-500" />
                        Escalated to Ticket
                      </span>
                      <span className="font-mono font-semibold text-purple-600 dark:text-purple-400">
                        {metrics.tickets_generated} ({ticketRate}%)
                      </span>
                    </div>
                    <div className="w-full h-1.5 rounded-full bg-black/[0.06] dark:bg-white/[0.08] overflow-hidden">
                      <div 
                        className="h-full bg-purple-500 rounded-full transition-all duration-500" 
                        style={{ width: `${Math.min(ticketRate, 100)}%` }} 
                      />
                    </div>
                  </div>

                  {/* Progress 3: Pending Review */}
                  <div className="space-y-1.5">
                    <div className="flex justify-between items-center text-xs">
                      <span className="font-medium text-foreground flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-amber-500" />
                        Pending Review Queue
                      </span>
                      <span className="font-mono font-semibold text-amber-600 dark:text-amber-400">
                        {metrics.pending_emails} ({pendingRate}%)
                      </span>
                    </div>
                    <div className="w-full h-1.5 rounded-full bg-black/[0.06] dark:bg-white/[0.08] overflow-hidden">
                      <div 
                        className="h-full bg-amber-500 rounded-full transition-all duration-500" 
                        style={{ width: `${Math.min(pendingRate, 100)}%` }} 
                      />
                    </div>
                  </div>

                  {/* Progress 4: Errors & Failures */}
                  <div className="space-y-1.5">
                    <div className="flex justify-between items-center text-xs">
                      <span className="font-medium text-foreground flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-rose-500" />
                        Processing Errors
                      </span>
                      <span className="font-mono font-semibold text-rose-600 dark:text-rose-400">
                        {metrics.failed_emails} ({failedRate}%)
                      </span>
                    </div>
                    <div className="w-full h-1.5 rounded-full bg-black/[0.06] dark:bg-white/[0.08] overflow-hidden">
                      <div 
                        className="h-full bg-rose-500 rounded-full transition-all duration-500" 
                        style={{ width: `${Math.min(failedRate, 100)}%` }} 
                      />
                    </div>
                  </div>

                  {/* Policy-Aligned Confidence & Risk Floor Distribution */}
                  <div className="pt-3 border-t border-black/[0.06] dark:border-white/[0.08] space-y-2">
                    <div className="text-[11px] font-semibold text-foreground flex items-center justify-between">
                      <span>Policy Confidence Tiers</span>
                      <span className="text-[10px] text-muted-foreground font-mono">
                        Cutoff: {metrics.threshold}%
                      </span>
                    </div>

                    <div className="grid grid-cols-3 gap-1.5 text-center">
                      <div className="p-2 rounded-md bg-emerald-500/10 border border-emerald-500/20" title={`Emails scoring ≥ ${metrics.threshold}%, meeting active policy for auto-send`}>
                        <div className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-400">Pass (&ge;{metrics.threshold}%)</div>
                        <div className="text-sm font-bold font-mono text-emerald-600 dark:text-emerald-400 mt-0.5">
                          {(metrics.confidence_breakdown as any)?.passed_threshold ?? metrics.confidence_breakdown?.high ?? 0}
                        </div>
                      </div>
                      <div className="p-2 rounded-md bg-amber-500/10 border border-amber-500/20" title={`Emails scoring < ${metrics.threshold}%, routed to draft review by policy`}>
                        <div className="text-[10px] font-semibold text-amber-600 dark:text-amber-400">Held (&lt;{metrics.threshold}%)</div>
                        <div className="text-sm font-bold font-mono text-amber-600 dark:text-amber-400 mt-0.5">
                          {(metrics.confidence_breakdown as any)?.below_threshold ?? metrics.confidence_breakdown?.borderline ?? 0}
                        </div>
                      </div>
                      <div className="p-2 rounded-md bg-rose-500/10 border border-rose-500/20" title="Objective hallucination/low-signal floor (< 60%), independent of policy">
                        <div className="text-[10px] font-semibold text-rose-600 dark:text-rose-400">Risk (&lt;60%)</div>
                        <div className="text-sm font-bold font-mono text-rose-600 dark:text-rose-400 mt-0.5">
                          {(metrics.confidence_breakdown as any)?.hallucination_risk ?? metrics.confidence_breakdown?.low ?? 0}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Action Shortcuts for Operators */}
                  <div className="pt-3 border-t border-black/[0.06] dark:border-white/[0.08] space-y-2">
                    <button
                      onClick={() => navigate('/inbox')}
                      className="w-full flex items-center justify-between p-2 rounded-lg win11-card hover:bg-black/[0.04] dark:hover:bg-white/[0.06] text-xs font-medium text-foreground transition-all cursor-pointer"
                    >
                      <span className="flex items-center gap-2">
                        <Mail className="w-3.5 h-3.5 text-primary" />
                        <span>Inspect in Mail Monitor</span>
                      </span>
                      <ArrowRight className="w-3.5 h-3.5 text-muted-foreground" />
                    </button>
                    <button
                      onClick={() => handleTabChange('llm')}
                      className="w-full flex items-center justify-between p-2 rounded-lg win11-card hover:bg-black/[0.04] dark:hover:bg-white/[0.06] text-xs font-medium text-foreground transition-all cursor-pointer"
                    >
                      <span className="flex items-center gap-2">
                        <Cpu className="w-3.5 h-3.5 text-purple-500" />
                        <span>View LLM Token &amp; Cost Telemetry</span>
                      </span>
                      <ArrowRight className="w-3.5 h-3.5 text-muted-foreground" />
                    </button>
                  </div>
                </div>
              </SettingsCard>
            </div>
          </div>

          {/* Multi-Tenant Fleet Performance (Active in ALL Client Scope) */}
          {selectedClientId === 'ALL' && metrics.client_breakdown && metrics.client_breakdown.length > 0 && (
            <SettingsCard
              title="Tenant Fleet Performance"
              description="Cross-client automation volume, queue backlogs, error distribution, and confidence scores"
            >
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-black/[0.06] dark:border-white/[0.08] text-muted-foreground">
                      <th className="py-2.5 px-4 font-semibold">Tenant / Company</th>
                      <th className="py-2.5 px-4 font-semibold text-right">Inbound</th>
                      <th className="py-2.5 px-4 font-semibold text-right">AI Automated</th>
                      <th className="py-2.5 px-4 font-semibold text-right">Pending Review</th>
                      <th className="py-2.5 px-4 font-semibold text-right">Errors</th>
                      <th className="py-2.5 px-4 font-semibold text-right">Avg Confidence</th>
                      <th className="py-2.5 px-4 font-semibold text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-black/[0.04] dark:divide-white/[0.04]">
                    {metrics.client_breakdown.map((c) => (
                      <tr 
                        key={c.client_id}
                        className="hover:bg-black/[0.03] dark:hover:bg-white/[0.04] transition-colors"
                      >
                        <td className="py-2.5 px-4 font-medium text-foreground">
                          <div className="font-semibold text-foreground">{c.company_name || c.client_id}</div>
                          <div className="text-[10px] font-mono text-muted-foreground">{c.client_id}</div>
                        </td>
                        <td className="py-2.5 px-4 text-right font-mono font-semibold text-foreground">
                          {c.total_emails.toLocaleString()}
                        </td>
                        <td className="py-2.5 px-4 text-right">
                          <span className="font-mono text-emerald-600 dark:text-emerald-400 font-semibold">
                            {c.ai_replies.toLocaleString()} ({c.automation_rate}%)
                          </span>
                        </td>
                        <td className="py-2.5 px-4 text-right">
                          <span className={cn(
                            "font-mono font-semibold",
                            c.pending_emails > 0 ? "text-amber-600 dark:text-amber-400" : "text-muted-foreground"
                          )}>
                            {c.pending_emails.toLocaleString()}
                          </span>
                        </td>
                        <td className="py-2.5 px-4 text-right">
                          <span className={cn(
                            "font-mono font-semibold",
                            c.failed_emails > 0 ? "text-rose-600 dark:text-rose-400" : "text-muted-foreground"
                          )}>
                            {c.failed_emails.toLocaleString()}
                          </span>
                        </td>
                        <td className="py-2.5 px-4 text-right font-mono font-semibold text-primary">
                          {c.avg_score}%
                        </td>
                        <td className="py-2.5 px-4 text-right">
                          <button
                            onClick={() => setSelectedClientId(c.client_id)}
                            className="px-2.5 py-1 rounded-md text-[11px] font-medium bg-primary/10 text-primary hover:bg-primary/20 transition-all cursor-pointer shadow-2xs"
                          >
                            Focus Tenant
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </SettingsCard>
          )}

          {/* Live Inbound Processing Stream (Heartbeat Verification) */}
          <SettingsCard
            title="Live Inbound Processing Stream"
            description="Recent emails handled by the autonomous pipeline with real-time classification"
            footerLink={{
              label: 'View all emails in Mail Monitor',
              onClick: () => navigate('/inbox'),
            }}
          >
            <div className="overflow-x-auto">
              {recentEmails && recentEmails.length > 0 ? (
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-black/[0.06] dark:border-white/[0.08] text-muted-foreground">
                      <th className="py-2.5 px-4 font-semibold">Sender</th>
                      <th className="py-2.5 px-4 font-semibold">Subject</th>
                      <th className="py-2.5 px-4 font-semibold">Pipeline Outcome</th>
                      <th className="py-2.5 px-4 font-semibold text-right">Processed At</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-black/[0.04] dark:divide-white/[0.04]">
                    {recentEmails.map((item, idx) => {
                      const emailTargetId = item.id || (item.mailId ? item.mailId.replace('msg-', '') : '');
                      return (
                        <tr 
                          key={item.id || idx}
                          onClick={() => navigate(emailTargetId ? `/inbox?id=${emailTargetId}` : '/inbox')}
                          title="Click to inspect this email in Mail Monitor"
                          className="hover:bg-black/[0.03] dark:hover:bg-white/[0.04] transition-colors cursor-pointer group"
                        >
                          <td className="py-2.5 px-4 max-w-[200px]">
                            <div className="font-semibold text-foreground truncate group-hover:text-primary transition-colors">
                              {item.sender || item.from_email || item.from || 'Direct Message'}
                            </div>
                            <div className="flex items-center gap-1.5 mt-0.5">
                              {item.category && (
                                <span className="text-[9px] px-1.5 py-0.2 rounded font-medium bg-black/[0.04] dark:bg-white/[0.06] text-muted-foreground border border-black/[0.04] dark:border-white/[0.04]">
                                  {item.category}
                                </span>
                              )}
                              {item.sentiment && item.sentiment !== 'Neutral' && (
                                <span className={cn(
                                  "text-[9px] px-1.5 py-0.2 rounded font-semibold border",
                                  item.sentiment.toLowerCase() === 'frustrated' || item.sentiment.toLowerCase() === 'urgent'
                                    ? "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20"
                                    : "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20"
                                )}>
                                  {item.sentiment}
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="py-2.5 px-4 text-muted-foreground truncate max-w-[240px]">
                            {item.subject || 'No subject'}
                          </td>
                          <td className="py-2.5 px-4">
                            {getStatusBadge(item.status)}
                          </td>
                          <td className="py-2.5 px-4 text-right font-mono text-[11px] text-muted-foreground whitespace-nowrap">
                            {item.time || (item.created_at ? item.created_at.split(' ')[1] || item.created_at : 'Just now')}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              ) : (
                <div className="py-8 text-center text-xs text-muted-foreground space-y-1">
                  <p>No recent email activity recorded yet for this client scope.</p>
                  <p className="text-[11px] opacity-75">Incoming emails will stream here automatically.</p>
                </div>
              )}
            </div>
          </SettingsCard>
        </>
      )}
    </div>
  );
}
