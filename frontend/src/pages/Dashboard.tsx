import { useState, useEffect, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { 
  RefreshCw, AlertCircle,
  Mail, Bot, Cpu, Clock, Ticket,
  ArrowRight, ShieldCheck, ShieldAlert,
  FileSpreadsheet, ArrowUpRight,
  Layers, CheckCheck, Target,
  TrendingUp, TrendingDown, Minus,
  Activity, Zap, Timer, Hourglass
} from 'lucide-react';
import { AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';
import { SettingsCard } from '@/components/fluent';
import LlmAnalytics from './LlmAnalytics';
import { useAppState } from '@/context/AppStateContext';
import { DashboardSkeleton } from '@/components/common/Skeleton';

function formatRelativeDuration(seconds: number | null | undefined): string {
  if (seconds === null || seconds === undefined || isNaN(seconds)) return 'Never';
  if (seconds < 60) return `${Math.floor(seconds)}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(seconds / 3600);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(seconds / 86400);
  return `${days}d ago`;
}

function DeltaBadge({ value, isPctPoint = false, inverse = false }: { value?: number; isPctPoint?: boolean; inverse?: boolean }) {
  if (value === undefined || value === null || isNaN(value)) return null;
  if (value === 0) {
    return (
      <span className="inline-flex items-center gap-0.5 text-[10px] font-medium text-muted-foreground bg-black/5 dark:bg-white/5 px-1.5 py-0.5 rounded" title="No change compared to prior period">
        <Minus className="w-2.5 h-2.5" /> 0%
      </span>
    );
  }
  const isPositive = value > 0;
  // If inverse is true (e.g. bounce rate, errors), positive is bad (rose) and negative is good (emerald)
  const isGood = inverse ? !isPositive : isPositive;
  const colorClass = isGood ? "text-emerald-600 dark:text-emerald-400 bg-emerald-500/10" : "text-rose-600 dark:text-rose-400 bg-rose-500/10";
  const Icon = isPositive ? TrendingUp : TrendingDown;
  const formatted = `${isPositive ? '+' : ''}${value}${isPctPoint ? ' pts' : '%'}`;

  return (
    <span className={cn("inline-flex items-center gap-0.5 text-[10px] font-semibold px-1.5 py-0.5 rounded", colorClass)} title={`Compared to previous period: ${formatted}`}>
      <Icon className="w-2.5 h-2.5 shrink-0" />
      {formatted}
    </span>
  );
}

export default function Dashboard() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { theme, selectedClientId, setSelectedClientId, clients, isAdmin } = useAppState();

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
    inbound_health: {
      total_inbound: 0,
      real_inquiries: 0,
      marketing_count: 0,
      spam_count: 0,
      blocked_count: 0,
      bounce_count: 0,
      bounce_rate: 0.0,
      delivery_health_score: 100.0,
      avg_daily_inbound: 0.0,
      monthly_inbound_volume: 0,
      hourly_profile: [] as Array<{ hour: number; count: number }>,
    },
    execution_latency: {
      total_execution_ms: 0,
      avg_latency_ms: 0,
      min_latency_ms: 0,
      max_latency_ms: 0,
      first_action: {
        avg_ms: 0,
        min_ms: 0,
        max_ms: 0,
      },
    },
    ingestion_health: {
      worker_heartbeat: { status: 'offline', last_seen_sec: null, label: 'Offline' } as any,
      queue_depth: 0,
      oldest_pending_sec: 0,
      client_sync: null as any,
    },
    conversational_performance: {
      customer_resolution_rate: 0.0,
      rag_resolved_count: 0,
      ticket_escalated_count: 0,
      fcr_count: 0,
      fcr_rate: 0.0,
      multi_turn_count: 0,
      runaway_risk_count: 0,
      avg_resolution_turns: 1.0,
      avg_resolution_duration_sec: 0,
      completed_conversations: {
        count: 0,
        avg_duration_sec: 0,
        min_duration_sec: 0,
        max_duration_sec: 0,
      },
      incomplete_conversations: {
        count: 0,
        total_duration_sec: 0,
        avg_duration_sec: 0,
        min_duration_sec: 0,
        max_duration_sec: 0,
      },
      rag_resolution_timing: {
        count: 0,
        avg_duration_sec: 0,
        min_duration_sec: 0,
        max_duration_sec: 0,
      },
      ticket_escalation_timing: {
        count: 0,
        avg_duration_sec: 0,
        min_duration_sec: 0,
        max_duration_sec: 0,
      },
      active_wip_conversations: 0,
      avg_active_wip_age_sec: 0,
      active_wip_aging: {
        under_1h: 0,
        warning_1_4h: 0,
        breached_over_4h: 0,
      },
      sentiment_trajectory: {
        improved: 0,
        neutral_stable: 0,
        deteriorated: 0,
      },
      sentiment_distribution: {
        positive: 0,
        neutral: 0,
        negative: 0,
        net_score: 0.0,
      },
      inferred_csat: 5.0,
      intent_breakdown: [] as Array<{ intent: string; count: number }>,
      intent_matrix: [] as any[],
    },
    deltas: {
      total_emails_pct: 0,
      ai_replies_pct: 0,
      automation_rate_pct: 0,
      bounce_rate_pct: 0,
    },
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
  const [timelineMode, setTimelineMode] = useState<'volume' | 'outcomes'>('volume');

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
          inbound_health: stats.inbound_health || {
            total_inbound: stats.total_emails || 0,
            real_inquiries: stats.total_emails || 0,
            marketing_count: 0,
            spam_count: 0,
            blocked_count: 0,
            bounce_count: 0,
            bounce_rate: 0.0,
            delivery_health_score: 100.0,
            avg_daily_inbound: 0.0,
            monthly_inbound_volume: 0,
          },
          execution_latency: stats.execution_latency || {
            total_execution_ms: 0,
            avg_latency_ms: 0,
            min_latency_ms: 0,
            max_latency_ms: 0,
            first_action: { avg_ms: 0, min_ms: 0, max_ms: 0 },
          },
          ingestion_health: stats.ingestion_health || {
            worker_heartbeat: stats.worker_heartbeat || { status: 'offline', last_seen_sec: null, label: 'Offline' },
            queue_depth: 0,
            oldest_pending_sec: stats.oldest_pending_seconds || 0,
            client_sync: stats.client_sync || null,
          },
          conversational_performance: stats.conversational_performance || {
            customer_resolution_rate: stats.total_emails > 0 ? Math.round((stats.ai_replies / stats.total_emails) * 100) : 0,
            rag_resolved_count: stats.ai_replies || 0,
            ticket_escalated_count: stats.tickets_generated || 0,
            fcr_count: stats.ai_replies || 0,
            fcr_rate: stats.total_emails > 0 ? Math.round((stats.ai_replies / stats.total_emails) * 100) : 0,
            multi_turn_count: 0,
            runaway_risk_count: 0,
            avg_resolution_turns: 1.0,
            avg_resolution_duration_sec: 0,
            completed_conversations: { count: 0, avg_duration_sec: 0, min_duration_sec: 0, max_duration_sec: 0 },
            incomplete_conversations: { count: 0, total_duration_sec: 0, avg_duration_sec: 0, min_duration_sec: 0, max_duration_sec: 0 },
            rag_resolution_timing: { count: 0, avg_duration_sec: 0, min_duration_sec: 0, max_duration_sec: 0 },
            ticket_escalation_timing: { count: 0, avg_duration_sec: 0, min_duration_sec: 0, max_duration_sec: 0 },
            active_wip_conversations: 0,
            avg_active_wip_age_sec: 0,
            active_wip_aging: { under_1h: 0, warning_1_4h: 0, breached_over_4h: 0 },
            sentiment_trajectory: { improved: 0, neutral_stable: 0, deteriorated: 0 },
            sentiment_distribution: { positive: 0, neutral: 0, negative: 0, net_score: 0.0 },
            inferred_csat: 5.0,
            intent_breakdown: [],
            intent_matrix: [],
          },
          deltas: stats.deltas || {
            total_emails_pct: 0,
            ai_replies_pct: 0,
            automation_rate_pct: 0,
            bounce_rate_pct: 0,
          },
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
    const normalized = chartData.map((item) => ({
      ...item,
      emails: item.emails ?? 0,
      aiReplied: item.aiReplied ?? 0,
      deflected: item.deflected ?? item.aiReplied ?? 0,
      escalated: item.escalated ?? 0,
      pending: item.pending ?? 0,
      failed: item.failed ?? 0,
    }));
    if (normalized.length === 1) {
      const item = normalized[0];
      const name = item.name || '';
      const hourMatch = name.match(/^(\d{1,2})\s*(AM|PM)$/i);
      const emptyPoint = { emails: 0, aiReplied: 0, deflected: 0, escalated: 0, pending: 0, failed: 0 };
      if (hourMatch) {
        const hour = parseInt(hourMatch[1], 10);
        const meridian = hourMatch[2].toUpperCase();
        const prevHour = hour === 1 ? 12 : hour - 1;
        const nextHour = hour === 12 ? 1 : hour + 1;
        const prevMeridian = (hour === 12 && meridian === 'PM') ? 'AM' : (hour === 12 && meridian === 'AM') ? 'PM' : meridian;
        const nextMeridian = (hour === 11 && meridian === 'AM') ? 'PM' : (hour === 11 && meridian === 'PM') ? 'AM' : meridian;
        return [
          { name: `${prevHour} ${prevMeridian}`, ...emptyPoint },
          item,
          { name: `${nextHour} ${nextMeridian}`, ...emptyPoint },
        ];
      }
      return [
        { name: 'Prior', ...emptyPoint },
        item,
        { name: 'Later', ...emptyPoint },
      ];
    }
    return normalized;
  }, [chartData]);

  // Donut data for Resolution Deflection composition
  const donutData = useMemo(() => {
    const data = [
      { name: 'AI Auto-Replied', value: metrics.ai_replies, color: '#10B981' },
      { name: 'Escalated to Ticket', value: metrics.tickets_generated, color: '#A855F7' },
      { name: 'Pending Review', value: metrics.pending_emails, color: '#F59E0B' },
      { name: 'Processing Errors', value: metrics.failed_emails, color: '#F43F5E' },
    ].filter((d) => d.value > 0);
    return data.length > 0 ? data : [{ name: 'No Inbound Traffic', value: 1, color: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)' }];
  }, [metrics.ai_replies, metrics.tickets_generated, metrics.pending_emails, metrics.failed_emails, isDark]);

  // Peak Hour load from 24-hour distribution
  const peakHourInfo = useMemo(() => {
    const profile = metrics.inbound_health?.hourly_profile || [];
    if (!profile.length) return null;
    const sorted = [...profile].sort((a, b) => b.count - a.count);
    const peak = sorted[0];
    if (!peak || peak.count === 0) return null;
    const period = peak.hour >= 12 ? 'PM' : 'AM';
    const displayHour = peak.hour === 0 ? 12 : peak.hour > 12 ? peak.hour - 12 : peak.hour;
    return {
      label: `${displayHour}:00 ${period}`,
      count: peak.count,
    };
  }, [metrics.inbound_health?.hourly_profile]);

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

      {loading && !metrics.total_emails ? (
        <DashboardSkeleton />
      ) : (
        <div className={cn("space-y-6 transition-opacity", loading && "opacity-50 pointer-events-none")}>
          {/* Date Filter Panel */}
          <div className="win11-card p-2 px-3 rounded-lg flex flex-col lg:flex-row lg:items-center justify-between gap-2.5 shadow-2xs">
            <div className="flex flex-wrap items-center gap-1">
              {[
                { id: 'all', label: 'All Time' },
                { id: 'today', label: 'Today' },
                { id: 'yesterday', label: 'Yesterday' },
                { id: 'this_week', label: 'This Week' },
                { id: 'last_week', label: 'Last Week' },
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

          {/* Live Ingestion Pipeline & Worker Health Strip */}
          <div className="win11-card p-3 rounded-xl border border-black/[0.06] dark:border-white/[0.08] shadow-2xs flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full animate-pulse bg-emerald-500" />
                <span className="font-semibold text-foreground">Worker Pipeline:</span>
                <span className={cn(
                  "px-2 py-0.5 rounded-md font-mono text-[11px] font-bold border",
                  (metrics.ingestion_health?.worker_heartbeat?.status ?? metrics.worker_heartbeat?.status) === 'healthy'
                    ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20"
                    : (metrics.ingestion_health?.worker_heartbeat?.status ?? metrics.worker_heartbeat?.status) === 'delayed'
                    ? "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20"
                    : "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20"
                )}>
                  {metrics.ingestion_health?.worker_heartbeat?.label || metrics.worker_heartbeat?.label || 'Active'}
                  {(metrics.ingestion_health?.worker_heartbeat?.last_seen_sec ?? metrics.worker_heartbeat?.last_seen_sec) !== null && (
                    <span className="font-normal opacity-80 ml-1">
                      ({metrics.ingestion_health?.worker_heartbeat?.last_seen_sec ?? metrics.worker_heartbeat?.last_seen_sec}s ago)
                    </span>
                  )}
                </span>
              </div>

              <div className="h-4 w-px bg-black/[0.08] dark:border-white/[0.08] hidden sm:block" />

              <div className="flex items-center gap-1.5 text-muted-foreground">
                <Layers className="w-3.5 h-3.5 text-primary" />
                <span>Queue Depth:</span>
                <span className={cn(
                  "font-mono font-bold",
                  (metrics.ingestion_health?.queue_depth ?? 0) > 10 ? "text-amber-600 dark:text-amber-400" : "text-foreground"
                )}>
                  {(metrics.ingestion_health?.queue_depth ?? 0).toLocaleString()} tasks
                </span>
              </div>

              <div className="h-4 w-px bg-black/[0.08] dark:border-white/[0.08] hidden sm:block" />

              <div className="flex items-center gap-1.5 text-muted-foreground">
                <Clock className="w-3.5 h-3.5 text-muted-foreground" />
                <span>Ingestion Lag:</span>
                <span className={cn(
                  "font-mono font-bold",
                  (metrics.ingestion_health?.oldest_pending_sec ?? 0) > 60 ? "text-amber-600 dark:text-amber-400" : "text-foreground"
                )}>
                  {(metrics.ingestion_health?.oldest_pending_sec ?? 0) > 60 
                    ? `${Math.round((metrics.ingestion_health?.oldest_pending_sec ?? 0) / 60)}m` 
                    : `${metrics.ingestion_health?.oldest_pending_sec ?? 0}s`}
                </span>
              </div>
            </div>

            {selectedClientId !== 'ALL' && metrics.client_sync && (
              <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                <span>Mailbox Polling:</span>
                <span className="font-mono font-semibold text-emerald-600 dark:text-emerald-400">
                  {metrics.client_sync.status === 'connected' ? 'Connected' : metrics.client_sync.status}
                  {metrics.client_sync.last_sync_sec !== null && ` (${metrics.client_sync.last_sync_sec}s ago)`}
                </span>
              </div>
            )}
          </div>

          {/* Real-Time Inbound Delivery Health, Volume Velocity & Traffic Classification */}
          <div className="win11-card p-3 rounded-xl border border-black/[0.06] dark:border-white/[0.08] shadow-2xs space-y-3">
            <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-3">
              {/* Left: Overall Health Score & Delivery Ratio */}
              <div className="flex items-center gap-3">
                <div className={cn(
                  "p-2 rounded-lg border shrink-0",
                  (metrics.inbound_health?.bounce_rate || 0) < 5
                    ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20"
                    : (metrics.inbound_health?.bounce_rate || 0) < 15
                    ? "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20"
                    : "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20"
                )}>
                  {(metrics.inbound_health?.bounce_rate || 0) < 5 ? (
                    <ShieldCheck className="w-5 h-5" />
                  ) : (
                    <ShieldAlert className="w-5 h-5" />
                  )}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-foreground">Inbound Delivery Health</span>
                    <span className={cn(
                      "px-2 py-0.5 rounded-full text-[10px] font-bold font-mono border",
                      (metrics.inbound_health?.bounce_rate || 0) < 5
                        ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20"
                        : (metrics.inbound_health?.bounce_rate || 0) < 15
                        ? "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20"
                        : "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20"
                    )}>
                      {metrics.inbound_health?.delivery_health_score ?? 100}% Healthy
                    </span>
                  </div>
                  <div className="text-[11px] text-muted-foreground flex flex-wrap items-center gap-2 mt-0.5">
                    <span className="flex items-center gap-1.5">
                      <span>Bounce Rate: <strong className="font-mono text-foreground">{metrics.inbound_health?.bounce_rate ?? 0}%</strong></span>
                      <DeltaBadge value={metrics.deltas?.bounce_rate_pct} isPctPoint inverse />
                    </span>
                    <span>•</span>
                    <span>Total Inbound: <strong className="font-mono text-foreground">{(metrics.inbound_health?.total_inbound ?? metrics.total_emails).toLocaleString()}</strong></span>
                  </div>
                </div>
              </div>

              {/* Center: Inbound Velocity & Cadence */}
              <div className="flex items-center gap-4 px-3 py-1.5 rounded-lg bg-black/[0.02] dark:bg-white/[0.02] border border-black/[0.04] dark:border-white/[0.06] text-xs">
                <div>
                  <div className="text-[10px] text-muted-foreground font-medium">Daily Cadence (Avg)</div>
                  <div className="font-mono font-bold text-foreground flex items-baseline gap-1 mt-0.5">
                    <span className="text-sm">{metrics.inbound_health?.avg_daily_inbound ?? 0}</span>
                    <span className="text-[10px] text-muted-foreground font-normal">mails/day</span>
                  </div>
                </div>
                <div className="h-6 w-px bg-black/[0.08] dark:bg-white/[0.08]" />
                <div>
                  <div className="text-[10px] text-muted-foreground font-medium">Trailing 30D Volume</div>
                  <div className="font-mono font-bold text-foreground flex items-baseline gap-1 mt-0.5">
                    <span className="text-sm">{(metrics.inbound_health?.monthly_inbound_volume ?? metrics.total_emails).toLocaleString()}</span>
                    <span className="text-[10px] text-muted-foreground font-normal">total</span>
                  </div>
                </div>
                {peakHourInfo && (
                  <>
                    <div className="h-6 w-px bg-black/[0.08] dark:bg-white/[0.08]" />
                    <div>
                      <div className="text-[10px] text-muted-foreground font-medium">Peak Traffic Hour</div>
                      <div className="font-mono font-bold text-primary flex items-baseline gap-1 mt-0.5">
                        <span className="text-sm">{peakHourInfo.label}</span>
                        <span className="text-[10px] text-muted-foreground font-normal">({peakHourInfo.count} mails)</span>
                      </div>
                    </div>
                  </>
                )}
              </div>

              {/* Right: Traffic Classification Badges Strip with Deep-Linking */}
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <button
                  onClick={() => navigate('/inbox?tab=All')}
                  className="px-2.5 py-1 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 transition-all border border-emerald-500/20 flex items-center gap-1.5 cursor-pointer text-left"
                  title="Click to view real customer requests in Mail Monitor"
                >
                  <span className="w-2 h-2 rounded-full bg-emerald-500" />
                  <span className="text-[11px] text-muted-foreground">Real Customer:</span>
                  <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">
                    {(metrics.inbound_health?.real_inquiries ?? metrics.total_emails).toLocaleString()}
                  </span>
                </button>

                <button
                  onClick={() => navigate('/inbox?tab=Marketing')}
                  className="px-2.5 py-1 rounded-lg bg-blue-500/10 hover:bg-blue-500/20 transition-all border border-blue-500/20 flex items-center gap-1.5 cursor-pointer text-left"
                  title="Click to view promotional and marketing emails"
                >
                  <span className="w-2 h-2 rounded-full bg-blue-500" />
                  <span className="text-[11px] text-muted-foreground">Marketing:</span>
                  <span className="font-mono font-bold text-blue-600 dark:text-blue-400">
                    {(metrics.inbound_health?.marketing_count ?? 0).toLocaleString()}
                  </span>
                </button>

                <button
                  onClick={() => navigate('/inbox?tab=Spam')}
                  className="px-2.5 py-1 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 transition-all border border-amber-500/20 flex items-center gap-1.5 cursor-pointer text-left"
                  title="Click to inspect spam classification"
                >
                  <span className="w-2 h-2 rounded-full bg-amber-500" />
                  <span className="text-[11px] text-muted-foreground">Spam:</span>
                  <span className="font-mono font-bold text-amber-600 dark:text-amber-400">
                    {(metrics.inbound_health?.spam_count ?? 0).toLocaleString()}
                  </span>
                </button>

                <button
                  onClick={() => navigate('/inbox?tab=Blocked')}
                  className="px-2.5 py-1 rounded-lg bg-zinc-500/10 hover:bg-zinc-500/20 transition-all border border-zinc-500/20 flex items-center gap-1.5 cursor-pointer text-left"
                  title="Click to inspect blocked senders"
                >
                  <span className="w-2 h-2 rounded-full bg-zinc-500" />
                  <span className="text-[11px] text-muted-foreground">Blocked:</span>
                  <span className="font-mono font-bold text-foreground">
                    {(metrics.inbound_health?.blocked_count ?? 0).toLocaleString()}
                  </span>
                </button>

                <button
                  onClick={() => navigate('/inbox?tab=Failed')}
                  className="px-2.5 py-1 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 transition-all border border-rose-500/20 flex items-center gap-1.5 cursor-pointer text-left"
                  title="Click to inspect bounced and undelivered emails"
                >
                  <span className="w-2 h-2 rounded-full bg-rose-500" />
                  <span className="text-[11px] text-muted-foreground">Bounces:</span>
                  <span className="font-mono font-bold text-rose-600 dark:text-rose-400">
                    {(metrics.inbound_health?.bounce_count ?? 0).toLocaleString()}
                  </span>
                </button>
              </div>
            </div>
          </div>

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
              <div className="flex items-baseline justify-between gap-1">
                <div className="text-xl sm:text-2xl font-bold font-mono tracking-tight text-foreground">
                  {metrics.total_emails.toLocaleString()}
                </div>
                <DeltaBadge value={metrics.deltas?.total_emails_pct} />
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
              <div className="flex items-baseline justify-between gap-1">
                <div className="text-xl sm:text-2xl font-bold font-mono tracking-tight text-foreground">
                  {metrics.ai_replies.toLocaleString()}
                </div>
                <DeltaBadge value={metrics.deltas?.ai_replies_pct} />
              </div>
              <div className="text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold flex items-center justify-between">
                <span>{successRate}% auto-reply rate</span>
                {metrics.deltas?.automation_rate_pct !== undefined && metrics.deltas?.automation_rate_pct !== 0 && (
                  <span className="text-[10px] text-muted-foreground font-mono" title="Change in automation rate vs prior period">
                    ({metrics.deltas.automation_rate_pct > 0 ? '+' : ''}{metrics.deltas.automation_rate_pct} pts)
                  </span>
                )}
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

          {/* End-to-End Pipeline Execution & Latency Telemetry */}
          <div className="win11-card p-3 rounded-xl border border-black/[0.06] dark:border-white/[0.08] shadow-2xs">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 pb-2.5 border-b border-black/[0.04] dark:border-white/[0.06]">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-md bg-primary/10 text-primary">
                  <Zap className="w-3.5 h-3.5" />
                </div>
                <div>
                  <h4 className="text-xs font-semibold text-foreground">Pipeline Execution &amp; Processing Latency</h4>
                  <p className="text-[10px] text-muted-foreground">End-to-end task turnaround, inference runtimes, and initial action dispatch</p>
                </div>
              </div>
              <div className="text-[11px] font-mono text-muted-foreground">
                Total Execution Time: <strong className="text-foreground">{((metrics.execution_latency?.total_execution_ms ?? 0) / 1000).toFixed(1)}s</strong>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2.5">
              {/* Avg Latency */}
              <div className="p-2.5 rounded-lg bg-black/[0.02] dark:bg-white/[0.02] border border-black/[0.04] dark:border-white/[0.06] space-y-1">
                <div className="flex items-center gap-1.5 text-muted-foreground">
                  <Clock className="w-3 h-3 text-primary" />
                  <span className="text-[10px] font-medium">Avg Execution Time</span>
                </div>
                <div className="text-lg font-bold font-mono text-foreground">
                  {metrics.execution_latency?.avg_latency_ms ?? 0} <span className="text-xs font-normal text-muted-foreground">ms</span>
                </div>
                <p className="text-[9px] text-muted-foreground">Per inbound mail item</p>
              </div>

              {/* Min Latency */}
              <div className="p-2.5 rounded-lg bg-black/[0.02] dark:bg-white/[0.02] border border-black/[0.04] dark:border-white/[0.06] space-y-1">
                <div className="flex items-center gap-1.5 text-muted-foreground">
                  <Activity className="w-3 h-3 text-emerald-500" />
                  <span className="text-[10px] font-medium">Lowest Latency</span>
                </div>
                <div className="text-lg font-bold font-mono text-emerald-600 dark:text-emerald-400">
                  {metrics.execution_latency?.min_latency_ms ?? 0} <span className="text-xs font-normal text-muted-foreground">ms</span>
                </div>
                <p className="text-[9px] text-muted-foreground">Fastest task response</p>
              </div>

              {/* Max Latency */}
              <div className="p-2.5 rounded-lg bg-black/[0.02] dark:bg-white/[0.02] border border-black/[0.04] dark:border-white/[0.06] space-y-1">
                <div className="flex items-center gap-1.5 text-muted-foreground">
                  <Timer className="w-3 h-3 text-amber-500" />
                  <span className="text-[10px] font-medium">Highest Latency</span>
                </div>
                <div className="text-lg font-bold font-mono text-amber-600 dark:text-amber-400">
                  {metrics.execution_latency?.max_latency_ms ?? 0} <span className="text-xs font-normal text-muted-foreground">ms</span>
                </div>
                <p className="text-[9px] text-muted-foreground">Peak execution latency</p>
              </div>

              {/* First Action Latency */}
              <div className="p-2.5 rounded-lg bg-black/[0.02] dark:bg-white/[0.02] border border-black/[0.04] dark:border-white/[0.06] space-y-1">
                <div className="flex items-center gap-1.5 text-muted-foreground">
                  <Hourglass className="w-3 h-3 text-blue-500" />
                  <span className="text-[10px] font-medium">Time to First Action</span>
                </div>
                <div className="text-lg font-bold font-mono text-blue-600 dark:text-blue-400">
                  {metrics.execution_latency?.first_action?.avg_ms ?? 0} <span className="text-xs font-normal text-muted-foreground">ms</span>
                </div>
                <div className="text-[9px] text-muted-foreground font-mono">
                  min: {metrics.execution_latency?.first_action?.min_ms ?? 0}ms • max: {metrics.execution_latency?.first_action?.max_ms ?? 0}ms
                </div>
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
                  {/* Telemetry View Controls & Legend */}
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 text-[11px] mb-3">
                    {/* View Mode Toggle */}
                    <div className="flex items-center p-0.5 rounded-lg bg-black/[0.04] dark:bg-white/[0.06] border border-black/[0.06] dark:border-white/[0.08]">
                      <button
                        type="button"
                        onClick={() => setTimelineMode('volume')}
                        className={cn(
                          "px-2.5 py-1 rounded-md text-xs font-semibold transition-all cursor-pointer",
                          timelineMode === 'volume'
                            ? "bg-white dark:bg-zinc-800 text-foreground shadow-2xs"
                            : "text-muted-foreground hover:text-foreground"
                        )}
                      >
                        Volume Velocity
                      </button>
                      <button
                        type="button"
                        onClick={() => setTimelineMode('outcomes')}
                        className={cn(
                          "px-2.5 py-1 rounded-md text-xs font-semibold transition-all cursor-pointer",
                          timelineMode === 'outcomes'
                            ? "bg-white dark:bg-zinc-800 text-foreground shadow-2xs"
                            : "text-muted-foreground hover:text-foreground"
                        )}
                      >
                        Pipeline Outcomes
                      </button>
                    </div>

                    {/* Dynamic Legend */}
                    {timelineMode === 'volume' ? (
                      <div className="flex items-center gap-4">
                        <div className="flex items-center gap-1.5">
                          <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: primaryColor }} />
                          <span className="text-muted-foreground font-medium">Inbound Emails</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: aiColor }} />
                          <span className="text-muted-foreground font-medium">AI Replied</span>
                        </div>
                      </div>
                    ) : (
                      <div className="flex flex-wrap items-center gap-3">
                        <div className="flex items-center gap-1.5">
                          <span className="w-2.5 h-2.5 rounded-sm bg-emerald-500" />
                          <span className="text-muted-foreground font-medium">Deflected</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <span className="w-2.5 h-2.5 rounded-sm bg-purple-500" />
                          <span className="text-muted-foreground font-medium">Escalated</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <span className="w-2.5 h-2.5 rounded-sm bg-amber-500" />
                          <span className="text-muted-foreground font-medium">Pending Review</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <span className="w-2.5 h-2.5 rounded-sm bg-rose-500" />
                          <span className="text-muted-foreground font-medium">Errors / Dropped</span>
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="h-[250px] w-full">
                    {processedChartData && processedChartData.length > 0 ? (
                      timelineMode === 'volume' ? (
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
                        <ResponsiveContainer width="100%" height="100%" minHeight={220}>
                          <BarChart data={processedChartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
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
                                  <div className="p-2.5 rounded-lg border border-black/[0.1] dark:border-white/[0.1] bg-white dark:bg-[#2C2C2C] shadow-lg text-xs space-y-1.5 min-w-[150px]">
                                    <div className="font-semibold text-foreground border-b border-black/[0.06] dark:border-white/[0.06] pb-1 text-[11px]">
                                      {label}
                                    </div>
                                    {payload.map((entry: any) => (
                                      <div key={entry.name} className="flex items-center justify-between gap-3 text-[11px]">
                                        <span className="flex items-center gap-1.5 font-medium" style={{ color: entry.fill }}>
                                          <span className="w-2 h-2 rounded-sm" style={{ backgroundColor: entry.fill }} />
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
                            <Bar dataKey="deflected" name="Deflected" stackId="outcomes" fill="#10B981" />
                            <Bar dataKey="escalated" name="Escalated" stackId="outcomes" fill="#A855F7" />
                            <Bar dataKey="pending" name="Pending Review" stackId="outcomes" fill="#F59E0B" />
                            <Bar dataKey="failed" name="Errors / Dropped" stackId="outcomes" fill="#F43F5E" radius={[3, 3, 0, 0]} />
                          </BarChart>
                        </ResponsiveContainer>
                      )
                    ) : (
                      <div className="h-full flex items-center justify-center text-xs text-muted-foreground">
                        No telemetry data recorded for the selected timeframe.
                      </div>
                    )}
                  </div>

                  {/* Summary Footer with Real Latency, Quality Triage & Escalation Alerts */}
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 pt-3 mt-3 border-t border-black/[0.06] dark:border-white/[0.08] text-center">
                    <div 
                      onClick={() => navigate('/drafts')}
                      className="p-2 rounded-md bg-black/[0.02] dark:bg-white/[0.02] hover:bg-black/[0.05] dark:hover:bg-white/[0.05] cursor-pointer transition-all"
                      title="Click to inspect drafts in Review Queue"
                    >
                      <div className="text-[10px] text-muted-foreground font-medium">Avg AI Confidence</div>
                      <div className="text-sm font-bold text-primary mt-0.5 font-mono">
                        {metrics.avg_confidence}%
                      </div>
                      <div className="text-[10px] mt-0.5">
                        {((metrics.confidence_breakdown as any)?.hallucination_risk ?? metrics.confidence_breakdown?.low) > 0 ? (
                          <span className="text-rose-600 dark:text-rose-400 font-semibold underline">
                            {(metrics.confidence_breakdown as any)?.hallucination_risk ?? metrics.confidence_breakdown?.low} at risk (&lt;60%)
                          </span>
                        ) : (
                          <span className="text-muted-foreground">0 low-signal</span>
                        )}
                      </div>
                    </div>
                    <div 
                      onClick={() => navigate('/tickets?priority=Critical')}
                      className="p-2 rounded-md bg-black/[0.02] dark:bg-white/[0.02] hover:bg-black/[0.05] dark:hover:bg-white/[0.05] cursor-pointer transition-all"
                      title="Click to inspect escalated tickets"
                    >
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
                <div className="p-4 space-y-3.5">
                  {/* Resolution Composition Donut */}
                  <div className="relative h-[155px] w-full flex items-center justify-center">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={donutData}
                          cx="50%"
                          cy="50%"
                          innerRadius={46}
                          outerRadius={65}
                          paddingAngle={donutData.length > 1 ? 3 : 0}
                          dataKey="value"
                        >
                          {donutData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip
                          content={({ active, payload }) => {
                            if (!active || !payload?.length) return null;
                            const d = payload[0] as any;
                            const numVal = Number(d?.value) || 0;
                            return (
                              <div className="p-2 rounded-lg border border-black/[0.1] dark:border-white/[0.1] bg-white dark:bg-[#2C2C2C] shadow-lg text-xs space-y-0.5">
                                <div className="font-semibold flex items-center gap-1.5" style={{ color: d?.payload?.color }}>
                                  <span className="w-2 h-2 rounded-full" style={{ backgroundColor: d?.payload?.color }} />
                                  {d?.name}
                                </div>
                                <div className="font-mono font-bold text-foreground pl-3.5">
                                  {numVal} {metrics.total_emails > 0 ? `(${Math.round((numVal / metrics.total_emails) * 100)}%)` : ''}
                                </div>
                              </div>
                            );
                          }}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none text-center">
                      <span className="text-xl font-bold font-mono tracking-tight text-foreground">
                        {successRate}%
                      </span>
                      <span className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider">
                        Deflected
                      </span>
                    </div>
                  </div>
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
                        <span>View Token Economics</span>
                      </span>
                      <ArrowRight className="w-3.5 h-3.5 text-muted-foreground" />
                    </button>
                  </div>
                </div>
              </SettingsCard>
            </div>
          </div>

          {/* Conversational Performance, CRR Deflection & Sentiment Health */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
            {/* Left 7 Cols (or 12 Cols if not admin): CRR Deflection & Multi-Turn Conversation Metrics */}
            <div className={isAdmin ? "lg:col-span-7" : "lg:col-span-12"}>
              <SettingsCard
                title="Customer Resolution Rate (CRR) & Conversational Deflection"
                description="Analysis of multi-turn inquiries resolved automatically without creating human support tickets"
              >
                <div className="p-4 space-y-4">
                  {/* Top Highlight: CRR, First-Contact Resolution (FCR) & Conversational Deflection */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-3.5 rounded-xl bg-black/[0.02] dark:bg-white/[0.02] border border-black/[0.04] dark:border-white/[0.06]">
                    <div className="space-y-1">
                      <div className="flex items-center gap-1.5">
                        <span className="text-[11px] font-semibold text-muted-foreground">Clean Resolution (CRR)</span>
                      </div>
                      <div className="text-2xl font-bold font-mono tracking-tight text-emerald-600 dark:text-emerald-400">
                        {metrics.conversational_performance?.customer_resolution_rate ?? 0}%
                      </div>
                      <p className="text-[10px] text-muted-foreground">
                        {(metrics.conversational_performance?.rag_resolved_count ?? 0).toLocaleString()} deflected without ticket
                      </p>
                    </div>

                    <div className="space-y-1 sm:border-l sm:border-black/[0.06] sm:dark:border-white/[0.08] sm:pl-3">
                      <div className="flex items-center gap-1.5">
                        <CheckCheck className="w-3.5 h-3.5 text-blue-500" />
                        <span className="text-[11px] font-semibold text-muted-foreground">First-Contact Resolution</span>
                      </div>
                      <div className="text-2xl font-bold font-mono tracking-tight text-blue-600 dark:text-blue-400">
                        {metrics.conversational_performance?.fcr_rate ?? 0}%
                      </div>
                      <p className="text-[10px] text-muted-foreground">
                        {(metrics.conversational_performance?.fcr_count ?? 0).toLocaleString()} closed in single turn (one-touch)
                      </p>
                    </div>

                    <div className="space-y-1 sm:border-l sm:border-black/[0.06] sm:dark:border-white/[0.08] sm:pl-3">
                      <div className="flex items-center gap-1.5">
                        <Target className="w-3.5 h-3.5 text-purple-500" />
                        <span className="text-[11px] font-semibold text-muted-foreground">Guided vs Escalated</span>
                      </div>
                      <div className="text-xs font-mono font-semibold text-foreground space-y-0.5">
                        <div className="flex justify-between">
                          <span className="text-muted-foreground font-normal">Multi-Turn (2-4):</span>
                          <span>{metrics.conversational_performance?.multi_turn_count ?? 0}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-rose-500 font-normal">Runaway (5+):</span>
                          <span className="text-rose-500">{metrics.conversational_performance?.runaway_risk_count ?? 0}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-purple-500 font-normal">Human Tickets:</span>
                          <span className="text-purple-500">{metrics.conversational_performance?.ticket_escalated_count ?? 0}</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Turnaround Time Breakdown: Completed vs Incomplete (Active WIP) */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3 rounded-xl bg-black/[0.02] dark:bg-white/[0.02] border border-black/[0.04] dark:border-white/[0.06]">
                    {/* Completed Conversations */}
                    <div className="space-y-1">
                      <div className="flex items-center justify-between text-xs font-semibold text-foreground">
                        <span className="flex items-center gap-1.5">
                          <CheckCheck className="w-3.5 h-3.5 text-emerald-500" />
                          <span>Completed Conversations</span>
                        </span>
                        <span className="font-mono text-emerald-600 dark:text-emerald-400 font-bold">
                          {metrics.conversational_performance?.completed_conversations?.count ?? 0}
                        </span>
                      </div>
                      <div className="text-lg font-bold font-mono text-foreground flex items-baseline gap-1.5 pt-1">
                        <span>Avg: {formatRelativeDuration(metrics.conversational_performance?.completed_conversations?.avg_duration_sec ?? 0).replace(' ago', '')}</span>
                      </div>
                      <div className="text-[10px] text-muted-foreground font-mono flex items-center justify-between">
                        <span>Min: {metrics.conversational_performance?.completed_conversations?.min_duration_sec ?? 0}s</span>
                        <span>Max: {formatRelativeDuration(metrics.conversational_performance?.completed_conversations?.max_duration_sec ?? 0).replace(' ago', '')}</span>
                      </div>
                    </div>

                    {/* Incomplete Conversations (Active In-Flight) */}
                    <div className="space-y-1 sm:border-l sm:border-black/[0.06] sm:dark:border-white/[0.08] sm:pl-3">
                      <div className="flex items-center justify-between text-xs font-semibold text-foreground">
                        <span className="flex items-center gap-1.5">
                          <Clock className="w-3.5 h-3.5 text-amber-500" />
                          <span>Incomplete (In-Flight WIP)</span>
                        </span>
                        <span className="font-mono text-amber-600 dark:text-amber-400 font-bold">
                          {metrics.conversational_performance?.incomplete_conversations?.count ?? 0}
                        </span>
                      </div>
                      <div className="text-lg font-bold font-mono text-foreground flex items-baseline gap-1.5 pt-1">
                        <span>Avg: {formatRelativeDuration(metrics.conversational_performance?.incomplete_conversations?.avg_duration_sec ?? 0).replace(' ago', '')}</span>
                      </div>
                      <div className="text-[10px] text-muted-foreground font-mono flex items-center justify-between">
                        <span>Min: {metrics.conversational_performance?.incomplete_conversations?.min_duration_sec ?? 0}s</span>
                        <span>Max: {formatRelativeDuration(metrics.conversational_performance?.incomplete_conversations?.max_duration_sec ?? 0).replace(' ago', '')}</span>
                      </div>
                    </div>
                  </div>

                  {/* Resolution Mechanism Timings: RAG Deflection vs Ticket Creation */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="p-3 rounded-lg border border-emerald-500/20 bg-emerald-500/5 space-y-1">
                      <div className="flex items-center justify-between text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                        <span>Autonomous RAG Deflection</span>
                        <span className="font-mono font-bold">{metrics.conversational_performance?.rag_resolution_timing?.count ?? metrics.conversational_performance?.rag_resolved_count ?? 0} resolved</span>
                      </div>
                      <div className="text-base font-bold font-mono text-foreground pt-0.5">
                        Avg: {formatRelativeDuration(metrics.conversational_performance?.rag_resolution_timing?.avg_duration_sec ?? 0).replace(' ago', '')}
                      </div>
                      <div className="text-[10px] text-muted-foreground font-mono flex justify-between">
                        <span>Min: {metrics.conversational_performance?.rag_resolution_timing?.min_duration_sec ?? 0}s</span>
                        <span>Max: {formatRelativeDuration(metrics.conversational_performance?.rag_resolution_timing?.max_duration_sec ?? 0).replace(' ago', '')}</span>
                      </div>
                    </div>

                    <div className="p-3 rounded-lg border border-purple-500/20 bg-purple-500/5 space-y-1">
                      <div className="flex items-center justify-between text-xs font-semibold text-purple-600 dark:text-purple-400">
                        <span>Human Ticket Escalation</span>
                        <span className="font-mono font-bold">{metrics.conversational_performance?.ticket_escalation_timing?.count ?? metrics.conversational_performance?.ticket_escalated_count ?? 0} raised</span>
                      </div>
                      <div className="text-base font-bold font-mono text-foreground pt-0.5">
                        Avg: {formatRelativeDuration(metrics.conversational_performance?.ticket_escalation_timing?.avg_duration_sec ?? 0).replace(' ago', '')}
                      </div>
                      <div className="text-[10px] text-muted-foreground font-mono flex justify-between">
                        <span>Min: {metrics.conversational_performance?.ticket_escalation_timing?.min_duration_sec ?? 0}s</span>
                        <span>Max: {formatRelativeDuration(metrics.conversational_performance?.ticket_escalation_timing?.max_duration_sec ?? 0).replace(' ago', '')}</span>
                      </div>
                    </div>
                  </div>

                  {/* Conversational Cadence: Avg Turns & Active WIP Queue with SLA Aging */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="p-3 rounded-lg border border-black/[0.06] dark:border-white/[0.08] bg-black/[0.01] dark:bg-white/[0.01] space-y-1">
                      <span className="text-[11px] font-semibold text-muted-foreground">Avg Resolution Turns</span>
                      <div className="text-xl font-bold font-mono text-foreground">
                        {metrics.conversational_performance?.avg_resolution_turns ?? 1.0} <span className="text-xs font-normal text-muted-foreground">turns</span>
                      </div>
                      <p className="text-[10px] text-muted-foreground">Exchanges per inquiry</p>
                    </div>

                    <div className="p-3 rounded-lg border border-black/[0.06] dark:border-white/[0.08] bg-black/[0.01] dark:bg-white/[0.01] space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-semibold text-muted-foreground">Active WIP Inquiries</span>
                        <button
                          onClick={() => navigate('/inbox?tab=Pending Review')}
                          className="text-[10px] text-primary hover:underline flex items-center gap-0.5 cursor-pointer"
                        >
                          <span>Queue</span>
                          <ArrowRight className="w-2.5 h-2.5" />
                        </button>
                      </div>
                      <div className="flex items-baseline gap-2">
                        <span className="text-xl font-bold font-mono text-foreground">
                          {(metrics.conversational_performance?.active_wip_conversations ?? 0).toLocaleString()}
                        </span>
                        <span className="text-[10px] text-muted-foreground">
                          avg {formatRelativeDuration(metrics.conversational_performance?.avg_active_wip_age_sec ?? 0)}
                        </span>
                      </div>
                      {/* SLA Aging Buckets */}
                      <div className="flex items-center gap-1.5 pt-0.5">
                        <span className="px-1.5 py-0.5 rounded text-[9px] font-mono font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20" title="< 1 hour">
                          &lt;1h: {metrics.conversational_performance?.active_wip_aging?.under_1h ?? 0}
                        </span>
                        <span className="px-1.5 py-0.5 rounded text-[9px] font-mono font-semibold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20" title="1 to 4 hours">
                          1-4h: {metrics.conversational_performance?.active_wip_aging?.warning_1_4h ?? 0}
                        </span>
                        <span className="px-1.5 py-0.5 rounded text-[9px] font-mono font-semibold bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20" title="> 4 hours (SLA breach risk)">
                          &gt;4h: {metrics.conversational_performance?.active_wip_aging?.breached_over_4h ?? 0}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </SettingsCard>
            </div>

            {/* Right 5 Cols: Customer Sentiment Trajectory & AI-Inferred CSAT (Admin Only) */}
            {isAdmin && (
              <div className="lg:col-span-5 space-y-4">
                <SettingsCard
                  title="Customer Sentiment & AI-Inferred CSAT"
                  description="Conversational mood progression, net sentiment range, and AI satisfaction"
                >
                  <div className="p-4 space-y-4">
                    {/* Inferred CSAT Hero Badge & Net Sentiment Score */}
                    <div className="p-4 rounded-xl bg-gradient-to-br from-primary/10 via-primary/5 to-transparent border border-primary/20 flex items-center justify-between">
                      <div>
                        <span className="text-xs font-semibold text-primary">AI-Inferred CSAT Rating</span>
                        <div className="text-3xl font-bold font-mono tracking-tight text-foreground flex items-center gap-1.5 mt-1">
                          <span>★</span>
                          <span>{metrics.conversational_performance?.inferred_csat ?? 5.0}</span>
                          <span className="text-xs font-normal text-muted-foreground">/ 5.0</span>
                        </div>
                        <p className="text-[10px] text-muted-foreground mt-0.5">
                          Derived from resolution deflection &amp; final interaction tone
                        </p>
                      </div>

                      <div className="text-right space-y-1">
                        <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 inline-block">
                          High Satisfaction
                        </span>
                        <div className="text-[10px] font-mono text-muted-foreground">
                          NSS: <strong className={cn(
                            (metrics.conversational_performance?.sentiment_distribution?.net_score ?? 0) >= 0 
                              ? "text-emerald-600 dark:text-emerald-400" 
                              : "text-rose-600 dark:text-rose-400"
                          )}>
                            {(metrics.conversational_performance?.sentiment_distribution?.net_score ?? 0) > 0 ? '+' : ''}
                            {metrics.conversational_performance?.sentiment_distribution?.net_score ?? 0}%
                          </strong>
                        </div>
                      </div>
                    </div>

                    {/* Sentiment Trajectory Breakdown */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-xs font-semibold text-foreground">
                        <span>Conversational Sentiment Range</span>
                        <span className="text-[10px] text-muted-foreground font-normal">Full dialogue lifecycle</span>
                      </div>

                      <div className="grid grid-cols-3 gap-2 text-center">
                        <div className="p-2.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
                          <div className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold">Positive</div>
                          <div className="text-lg font-bold font-mono text-emerald-600 dark:text-emerald-400 mt-0.5">
                            {metrics.conversational_performance?.sentiment_trajectory?.improved ?? 0}
                          </div>
                          <div className="text-[9px] text-muted-foreground mt-0.5">Satisfied / Delighted</div>
                        </div>

                        <div className="p-2.5 rounded-lg bg-blue-500/10 border border-blue-500/20">
                          <div className="text-[10px] text-blue-600 dark:text-blue-400 font-semibold">Neutral</div>
                          <div className="text-lg font-bold font-mono text-blue-600 dark:text-blue-400 mt-0.5">
                            {metrics.conversational_performance?.sentiment_trajectory?.neutral_stable ?? 0}
                          </div>
                          <div className="text-[9px] text-muted-foreground mt-0.5">Standard Inquiries</div>
                        </div>

                        <div className="p-2.5 rounded-lg bg-rose-500/10 border border-rose-500/20">
                          <div className="text-[10px] text-rose-600 dark:text-rose-400 font-semibold">Frustrated</div>
                          <div className="text-lg font-bold font-mono text-rose-600 dark:text-rose-400 mt-0.5">
                            {metrics.conversational_performance?.sentiment_trajectory?.deteriorated ?? 0}
                          </div>
                          <div className="text-[9px] text-muted-foreground mt-0.5">Urgent Escalations</div>
                        </div>
                      </div>
                    </div>

                    {/* Quick Link to Detailed Ticketing & Resolution Reports */}
                    <button
                      onClick={() => navigate('/reports')}
                      className="w-full flex items-center justify-between p-2.5 rounded-lg bg-primary/10 border border-primary/20 text-xs font-semibold text-primary hover:bg-primary/20 transition-all cursor-pointer"
                    >
                      <span className="flex items-center gap-2">
                        <FileSpreadsheet className="w-4 h-4" />
                        <span>Open Resolution Reports &amp; CSV Export</span>
                      </span>
                      <ArrowUpRight className="w-4 h-4" />
                    </button>
                  </div>
                </SettingsCard>
              </div>
            )}
          </div>

          {/* Technical Intent Automation & Deflection Matrix */}
          <SettingsCard
            title="Technical Intent Automation & Deflection Matrix"
            description="Cross-intent breakdown of inbound inquiries, autonomous RAG deflection rate, average conversation turns, and escalation triggers"
          >
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-black/[0.06] dark:border-white/[0.08] text-muted-foreground">
                    <th className="py-2.5 px-4 font-semibold">Technical Intent</th>
                    <th className="py-2.5 px-4 font-semibold text-right">Inbound Volume</th>
                    <th className="py-2.5 px-4 font-semibold">Autonomous Deflection Rate</th>
                    <th className="py-2.5 px-4 font-semibold text-center">Avg Turns</th>
                    <th className="py-2.5 px-4 font-semibold text-right">Tickets Raised</th>
                    <th className="py-2.5 px-4 font-semibold">Primary Escalation Trigger</th>
                    <th className="py-2.5 px-4 font-semibold text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-black/[0.04] dark:divide-white/[0.04]">
                  {(!metrics.conversational_performance?.intent_matrix || metrics.conversational_performance.intent_matrix.length === 0) ? (
                    <tr>
                      <td colSpan={7} className="py-6 text-center text-muted-foreground">
                        No intent conversational telemetry available for this time range.
                      </td>
                    </tr>
                  ) : (
                    metrics.conversational_performance.intent_matrix.map((row) => (
                      <tr 
                        key={row.intent}
                        className="hover:bg-black/[0.03] dark:hover:bg-white/[0.04] transition-colors"
                      >
                        <td className="py-3 px-4 font-medium text-foreground">
                          <span className="px-2 py-0.5 rounded-md font-mono text-[11px] font-semibold bg-primary/10 text-primary border border-primary/20">
                            {row.intent}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right font-mono font-semibold text-foreground">
                          {row.total_volume.toLocaleString()}
                        </td>
                        <td className="py-3 px-4 min-w-[180px]">
                          <div className="space-y-1">
                            <div className="flex items-center justify-between text-[11px]">
                              <span className="font-mono font-semibold text-emerald-600 dark:text-emerald-400">
                                {row.auto_sent_rate}%
                              </span>
                              <span className="text-[10px] text-muted-foreground font-mono">
                                {row.auto_sent_count} / {row.total_volume}
                              </span>
                            </div>
                            <div className="w-full h-1.5 rounded-full bg-black/[0.06] dark:bg-white/[0.08] overflow-hidden">
                              <div 
                                className="h-full bg-emerald-500 rounded-full transition-all"
                                style={{ width: `${Math.min(100, Math.max(0, row.auto_sent_rate))}%` }}
                              />
                            </div>
                          </div>
                        </td>
                        <td className="py-3 px-4 text-center font-mono text-foreground font-semibold">
                          {row.avg_turns} <span className="text-[10px] text-muted-foreground font-normal">turns</span>
                        </td>
                        <td className="py-3 px-4 text-right">
                          <div className="font-mono font-semibold text-purple-600 dark:text-purple-400">
                            {row.ticket_count.toLocaleString()}
                          </div>
                          <div className="text-[10px] text-muted-foreground font-mono">
                            {row.escalation_rate}%
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <span className={cn(
                            "px-2 py-0.5 rounded text-[11px] font-medium border",
                            row.primary_escalation_reason && row.primary_escalation_reason !== '-'
                              ? "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20"
                              : "bg-black/[0.04] dark:bg-white/[0.04] text-muted-foreground border-transparent"
                          )}>
                            {row.primary_escalation_reason}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right">
                          <button
                            onClick={() => navigate(`/reports?intent=${encodeURIComponent(row.intent)}`)}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-medium bg-black/[0.04] hover:bg-black/[0.08] dark:bg-white/[0.06] dark:hover:bg-white/[0.1] text-foreground transition-all cursor-pointer"
                          >
                            <span>Audit</span>
                            <ArrowRight className="w-3 h-3 text-muted-foreground" />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </SettingsCard>

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
        </div>
      )}
    </div>
  );
}
