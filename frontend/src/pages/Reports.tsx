import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { 
  Download, 
  Search, 
  Filter, 
  RotateCcw, 
  FileText, 
  AlertTriangle, 
  Clock, 
  Ticket, 
  Bot, 
  TrendingUp, 
  Sparkles,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Calendar,
  Printer
} from 'lucide-react';
import { analyticsApi, TicketingReportRecord, TicketingReportResponse } from '@/lib/api/analytics';
import { useAppState } from '@/context/AppStateContext';
import { cn } from '@/lib/utils';

export default function Reports() {
  const { selectedClientId, clients } = useAppState();
  const [searchParams] = useSearchParams();

  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [data, setData] = useState<TicketingReportResponse | null>(null);
  const [errorMsg, setErrorMsg] = useState('');

  // Filter States
  const [rangeType, setRangeType] = useState('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [intent, setIntent] = useState(searchParams.get('intent') || 'all');
  const [resolutionMode, setResolutionMode] = useState(searchParams.get('resolution_mode') || 'all');
  const [escalationReason, setEscalationReason] = useState(searchParams.get('escalation_reason') || 'all');
  const [search, setSearch] = useState(searchParams.get('search') || '');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  const fetchReport = async (pageNumber = page) => {
    if (!selectedClientId) return;
    setLoading(true);
    setErrorMsg('');
    try {
      const res = await analyticsApi.getTicketingReport(selectedClientId, {
        range_type: rangeType,
        start_date: startDate,
        end_date: endDate,
        intent: intent,
        resolution_mode: resolutionMode,
        escalation_reason: escalationReason,
        search: search,
        page: pageNumber,
        page_size: pageSize,
      });
      setData(res);
      setPage(pageNumber);
    } catch (err: any) {
      console.error('Failed to load report:', err);
      setErrorMsg(err.message || 'Failed to load report data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setPage(1);
    fetchReport(1);
  }, [selectedClientId, rangeType, intent, resolutionMode, escalationReason, pageSize]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    fetchReport(1);
  };

  const handleResetFilters = () => {
    setRangeType('all');
    setStartDate('');
    setEndDate('');
    setIntent('all');
    setResolutionMode('all');
    setEscalationReason('all');
    setSearch('');
    setPage(1);
  };

  const handleExportCsv = async () => {
    if (!selectedClientId) return;
    setExporting(true);
    try {
      const blob = await analyticsApi.downloadReportCsv(selectedClientId, {
        range_type: rangeType,
        start_date: startDate,
        end_date: endDate,
        intent: intent,
        resolution_mode: resolutionMode,
        escalation_reason: escalationReason,
        search: search,
      });

      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `ticketing_resolution_report_${selectedClientId}_${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err: any) {
      console.error('CSV Export failed:', err);
      alert('Failed to export CSV: ' + err.message);
    } finally {
      setExporting(false);
    }
  };

  const currentClient = clients.find((c) => c.client_id === selectedClientId);
  const clientName = currentClient?.company_name || currentClient?.name || selectedClientId;

  const summary = data?.summary || {
    total_records: 0,
    rag_deflected: 0,
    tickets_created: 0,
    manual_reviews: 0,
    deflection_rate: 0.0,
    avg_confidence: 0.0,
  };

  const pagination = data?.pagination || {
    page: 1,
    page_size: pageSize,
    total_rows: 0,
    total_pages: 1,
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-foreground">Ticketing &amp; Resolution Reports</h1>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-primary/10 text-primary border border-primary/20">
              Audit &amp; Telemetry
            </span>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            End-to-end conversation resolution audit, deflection telemetry, escalation root-causes, and conversational sentiment trajectory for <strong className="text-foreground">{clientName}</strong>
          </p>
        </div>

        <div className="flex items-center gap-2 print:hidden">
          <button
            onClick={() => window.print()}
            disabled={loading || summary.total_records === 0}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-black/[0.08] dark:border-white/[0.08] text-xs font-semibold hover:bg-black/[0.04] dark:hover:bg-white/[0.06] transition-all cursor-pointer disabled:opacity-50"
            title="Print or save PDF executive report"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Print / PDF</span>
          </button>

          <button
            onClick={() => fetchReport(page)}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-black/[0.08] dark:border-white/[0.08] text-xs font-semibold hover:bg-black/[0.04] dark:hover:bg-white/[0.06] transition-all cursor-pointer disabled:opacity-50"
          >
            <RotateCcw className={cn("w-3.5 h-3.5", loading && "animate-spin")} />
            <span>Refresh</span>
          </button>

          <button
            onClick={handleExportCsv}
            disabled={exporting || loading || summary.total_records === 0}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-semibold hover:opacity-90 transition-all cursor-pointer shadow-2xs disabled:opacity-50"
          >
            {exporting ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Download className="w-3.5 h-3.5" />
            )}
            <span>{exporting ? 'Streaming CSV...' : 'Export CSV'}</span>
          </button>
        </div>
      </div>

      {/* Top Executive KPI Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <div className="win11-card p-3.5 rounded-xl border border-black/[0.06] dark:border-white/[0.08] shadow-2xs space-y-1">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-semibold">Total Audits</span>
            <div className="p-1.5 rounded-md bg-blue-500/10 text-blue-600 dark:text-blue-400">
              <FileText className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="text-2xl font-bold font-mono text-foreground">
            {summary.total_records.toLocaleString()}
          </div>
          <div className="text-[11px] text-muted-foreground truncate">Matching query filters</div>
        </div>

        <div className="win11-card p-3.5 rounded-xl border border-black/[0.06] dark:border-white/[0.08] shadow-2xs space-y-1">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-semibold">RAG Deflected</span>
            <div className="p-1.5 rounded-md bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
              <Bot className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="text-2xl font-bold font-mono text-emerald-600 dark:text-emerald-400">
            {summary.rag_deflected.toLocaleString()}
          </div>
          <div className="text-[11px] text-emerald-600/80 font-semibold truncate">Resolved with zero ticket</div>
        </div>

        <div className="win11-card p-3.5 rounded-xl border border-black/[0.06] dark:border-white/[0.08] shadow-2xs space-y-1">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-semibold">Tickets Escalated</span>
            <div className="p-1.5 rounded-md bg-purple-500/10 text-purple-600 dark:text-purple-400">
              <Ticket className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="text-2xl font-bold font-mono text-purple-600 dark:text-purple-400">
            {summary.tickets_created.toLocaleString()}
          </div>
          <div className="text-[11px] text-purple-600/80 font-semibold truncate">Routed to human team</div>
        </div>

        <div className="win11-card p-3.5 rounded-xl border border-black/[0.06] dark:border-white/[0.08] shadow-2xs space-y-1">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-semibold">Pending Review</span>
            <div className="p-1.5 rounded-md bg-amber-500/10 text-amber-600 dark:text-amber-400">
              <Clock className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="text-2xl font-bold font-mono text-amber-600 dark:text-amber-400">
            {summary.manual_reviews.toLocaleString()}
          </div>
          <div className="text-[11px] text-amber-600/80 font-semibold truncate">Held for draft approval</div>
        </div>

        <div className="win11-card p-3.5 rounded-xl border border-black/[0.06] dark:border-white/[0.08] shadow-2xs space-y-1">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-semibold">Deflection Rate</span>
            <div className="p-1.5 rounded-md bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
              <TrendingUp className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="text-2xl font-bold font-mono text-foreground">
            {summary.deflection_rate}%
          </div>
          <div className="text-[11px] text-muted-foreground truncate">CRR (Deflected / Total)</div>
        </div>

        <div className="win11-card p-3.5 rounded-xl border border-black/[0.06] dark:border-white/[0.08] shadow-2xs space-y-1">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-semibold">Avg AI Score</span>
            <div className="p-1.5 rounded-md bg-primary/10 text-primary">
              <Sparkles className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="text-2xl font-bold font-mono text-primary">
            {summary.avg_confidence}%
          </div>
          <div className="text-[11px] text-muted-foreground truncate">Evaluation threshold 80%</div>
        </div>
      </div>

      {/* Interactive Filters Bar */}
      <div className="win11-card p-4 rounded-xl border border-black/[0.06] dark:border-white/[0.08] shadow-2xs space-y-3 print:hidden">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs font-semibold text-foreground">
            <Filter className="w-4 h-4 text-primary" />
            <span>Audit Query Filters</span>
          </div>

          <button
            onClick={handleResetFilters}
            className="text-xs text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
          >
            Reset Filters
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          {/* Time Range */}
          <div>
            <label className="text-[11px] text-muted-foreground font-medium block mb-1">Time Range</label>
            <select
              value={rangeType}
              onChange={(e) => setRangeType(e.target.value)}
              className="w-full bg-white dark:bg-[#202020] border border-black/[0.08] dark:border-white/[0.08] rounded-md px-2.5 py-1.5 text-xs text-foreground focus:outline-none focus:border-primary cursor-pointer"
            >
              <option value="all">All Time</option>
              <option value="today">Today</option>
              <option value="yesterday">Yesterday</option>
              <option value="this_month">This Month</option>
              <option value="last_month">Last Month</option>
              <option value="custom">Custom Range</option>
            </select>
          </div>

          {/* Resolution Mode */}
          <div>
            <label className="text-[11px] text-muted-foreground font-medium block mb-1">Resolution Mode</label>
            <select
              value={resolutionMode}
              onChange={(e) => setResolutionMode(e.target.value)}
              className="w-full bg-white dark:bg-[#202020] border border-black/[0.08] dark:border-white/[0.08] rounded-md px-2.5 py-1.5 text-xs text-foreground focus:outline-none focus:border-primary cursor-pointer"
            >
              <option value="all">All Resolution Modes</option>
              <option value="rag">RAG Deflected (Resolved)</option>
              <option value="ticket">Ticket Escalated (Human)</option>
              <option value="review">Manual Review (Held)</option>
              <option value="failed">Failed / Dropped</option>
            </select>
          </div>

          {/* Technical Intent */}
          <div>
            <label className="text-[11px] text-muted-foreground font-medium block mb-1">Technical Intent</label>
            <select
              value={intent}
              onChange={(e) => setIntent(e.target.value)}
              className="w-full bg-white dark:bg-[#202020] border border-black/[0.08] dark:border-white/[0.08] rounded-md px-2.5 py-1.5 text-xs text-foreground focus:outline-none focus:border-primary cursor-pointer"
            >
              <option value="all">All Intents</option>
              <option value="order_tracking">Order Tracking</option>
              <option value="troubleshooting">Troubleshooting</option>
              <option value="refund_request">Refund Request</option>
              <option value="cancellation">Cancellation</option>
              <option value="general_inquiry">General Inquiry</option>
              <option value="billing">Billing / Invoice</option>
              <option value="marketing">Marketing / Promotion</option>
            </select>
          </div>

          {/* Escalation Reason */}
          <div>
            <label className="text-[11px] text-muted-foreground font-medium block mb-1">Escalation Reason</label>
            <select
              value={escalationReason}
              onChange={(e) => setEscalationReason(e.target.value)}
              className="w-full bg-white dark:bg-[#202020] border border-black/[0.08] dark:border-white/[0.08] rounded-md px-2.5 py-1.5 text-xs text-foreground focus:outline-none focus:border-primary cursor-pointer"
            >
              <option value="all">All Escalation Reasons</option>
              <option value="kb_miss">Knowledge Base Miss (kb_miss)</option>
              <option value="connector_api_error">Connector API Error (connector_api_error)</option>
              <option value="low_confidence">Low AI Confidence (low_confidence)</option>
              <option value="max_turns_exceeded">Max Turns Exceeded (max_turns_exceeded)</option>
              <option value="policy_human_required">Policy Human Required (policy_human_required)</option>
              <option value="customer_requested_human">Customer Requested Human (customer_requested_human)</option>
            </select>
          </div>

          {/* Search */}
          <div className="sm:col-span-2">
            <label className="text-[11px] text-muted-foreground font-medium block mb-1">Search Customer / Subject</label>
            <form onSubmit={handleSearchSubmit} className="flex gap-2">
              <div className="relative flex-1">
                <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Filter by subject, sender email, or issue summary..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full pl-8 pr-3 py-1.5 bg-white dark:bg-[#202020] border border-black/[0.08] dark:border-white/[0.08] rounded-md text-xs text-foreground focus:outline-none focus:border-primary"
                />
              </div>
              <button
                type="submit"
                className="px-3 py-1.5 bg-primary text-primary-foreground rounded-md text-xs font-semibold hover:opacity-90 transition-all cursor-pointer"
              >
                Filter
              </button>
            </form>
          </div>
        </div>

        {/* Custom Date Range Picker */}
        {rangeType === 'custom' && (
          <div className="flex items-center gap-2 pt-2 border-t border-black/[0.04] dark:border-white/[0.04]">
            <span className="text-xs text-muted-foreground flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5" /> Date Range:
            </span>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="bg-white dark:bg-[#202020] border border-black/[0.08] dark:border-white/[0.08] rounded-md px-2 py-1 text-xs text-foreground focus:outline-none focus:border-primary cursor-pointer"
            />
            <span className="text-xs text-muted-foreground">to</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="bg-white dark:bg-[#202020] border border-black/[0.08] dark:border-white/[0.08] rounded-md px-2 py-1 text-xs text-foreground focus:outline-none focus:border-primary cursor-pointer"
            />
            <button
              onClick={() => { setPage(1); fetchReport(1); }}
              className="px-2.5 py-1 bg-primary text-primary-foreground rounded-md text-xs font-semibold hover:opacity-90 transition-all cursor-pointer"
            >
              Apply Dates
            </button>
          </div>
        )}
      </div>

      {/* Main Audit Records Table */}
      <div className="win11-card rounded-xl border border-black/[0.06] dark:border-white/[0.08] shadow-2xs overflow-hidden">
        <div className="p-4 border-b border-black/[0.06] dark:border-white/[0.08] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-semibold text-foreground">Resolution Audit Trail</h2>
            <span className="text-xs text-muted-foreground">
              (Page {pagination.page} of {pagination.total_pages} • {pagination.total_rows.toLocaleString()} records)
            </span>
          </div>

          <div className="flex items-center gap-2 text-xs print:hidden">
            <span className="text-muted-foreground">Rows per page:</span>
            <select
              value={pageSize}
              onChange={(e) => {
                setPageSize(Number(e.target.value));
                setPage(1);
              }}
              className="bg-white dark:bg-[#202020] border border-black/[0.08] dark:border-white/[0.08] rounded-md px-2 py-1 text-xs text-foreground focus:outline-none cursor-pointer"
            >
              <option value={10}>10</option>
              <option value={25}>25</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
            </select>
          </div>
        </div>

        {loading ? (
          <div className="p-12 text-center space-y-3">
            <Loader2 className="w-8 h-8 text-primary animate-spin mx-auto" />
            <p className="text-xs text-muted-foreground font-mono">Loading audit logs and resolution records...</p>
          </div>
        ) : errorMsg ? (
          <div className="p-8 text-center text-rose-500 space-y-2">
            <AlertTriangle className="w-8 h-8 mx-auto" />
            <p className="text-xs font-semibold">{errorMsg}</p>
          </div>
        ) : !data?.records || data.records.length === 0 ? (
          <div className="p-12 text-center text-muted-foreground space-y-2">
            <FileText className="w-8 h-8 mx-auto opacity-40" />
            <p className="text-sm font-medium">No records match the current filter selection</p>
            <p className="text-xs opacity-75">Try clearing your search keyword or changing the date range</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-black/[0.06] dark:border-white/[0.08] bg-black/[0.02] dark:bg-white/[0.02] text-muted-foreground">
                  <th className="py-2.5 px-3 font-semibold">ID / Thread</th>
                  <th className="py-2.5 px-3 font-semibold">Timestamp</th>
                  <th className="py-2.5 px-3 font-semibold">Customer Email</th>
                  <th className="py-2.5 px-3 font-semibold">Subject &amp; Summary</th>
                  <th className="py-2.5 px-3 font-semibold">Intent</th>
                  <th className="py-2.5 px-3 font-semibold">Resolution Mode</th>
                  <th className="py-2.5 px-3 font-semibold">Status</th>
                  <th className="py-2.5 px-3 font-semibold">Escalation Reason</th>
                  <th className="py-2.5 px-3 font-semibold text-center">Turns</th>
                  <th className="py-2.5 px-3 font-semibold text-center">Score</th>
                  <th className="py-2.5 px-3 font-semibold">Sentiment Shift</th>
                  <th className="py-2.5 px-3 font-semibold text-center">Sentiment Score</th>
                  <th className="py-2.5 px-3 font-semibold text-right">Est. Cost</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-black/[0.04] dark:divide-white/[0.04]">
                {data.records.map((r: TicketingReportRecord) => {
                  const isDeflected = r.resolution_mode === 'RAG Deflected';
                  const isTicket = r.resolution_mode === 'Ticket Escalated';
                  const isReview = r.resolution_mode === 'Manual Review';

                  return (
                    <tr 
                      key={r.id}
                      className="hover:bg-black/[0.02] dark:hover:bg-white/[0.03] transition-colors"
                    >
                      {/* ID / Thread */}
                      <td className="py-2.5 px-3 font-mono font-medium">
                        <div className="text-foreground">#{r.id}</div>
                        <div className="text-[10px] text-muted-foreground truncate max-w-[90px]" title={r.thread_id}>
                          {r.thread_id}
                        </div>
                      </td>

                      {/* Timestamp */}
                      <td className="py-2.5 px-3 text-muted-foreground whitespace-nowrap">
                        {r.timestamp}
                      </td>

                      {/* Customer Email */}
                      <td className="py-2.5 px-3 font-medium text-foreground whitespace-nowrap">
                        <span className="truncate block max-w-[150px]" title={r.customer_email}>
                          {r.customer_email}
                        </span>
                      </td>

                      {/* Subject & Summary */}
                      <td className="py-2.5 px-3 max-w-[220px]">
                        <div className="font-semibold text-foreground truncate" title={r.subject}>
                          {r.subject || 'No Subject'}
                        </div>
                        <div className="text-[11px] text-muted-foreground line-clamp-1 truncate" title={r.summary_of_issue}>
                          {r.summary_of_issue}
                        </div>
                      </td>

                      {/* Intent */}
                      <td className="py-2.5 px-3 whitespace-nowrap">
                        <span className="px-2 py-0.5 rounded-md font-mono text-[10px] font-semibold bg-black/[0.04] dark:bg-white/[0.06] text-foreground border border-black/[0.06] dark:border-white/[0.08]">
                          {r.technical_intent}
                        </span>
                      </td>

                      {/* Resolution Mode */}
                      <td className="py-2.5 px-3 whitespace-nowrap">
                        <span className={cn(
                          "px-2 py-0.5 rounded-full text-[10px] font-bold border",
                          isDeflected && "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20",
                          isTicket && "bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20",
                          isReview && "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20",
                          !isDeflected && !isTicket && !isReview && "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20"
                        )}>
                          {r.resolution_mode}
                        </span>
                      </td>

                      {/* Status */}
                      <td className="py-2.5 px-3 whitespace-nowrap">
                        <span className={cn(
                          "font-semibold text-[11px]",
                          r.status === 'Resolved' && "text-emerald-600 dark:text-emerald-400",
                          r.status === 'Escalated' && "text-purple-600 dark:text-purple-400",
                          r.status === 'Under Review' && "text-amber-600 dark:text-amber-400",
                          r.status === 'Failed' && "text-rose-600 dark:text-rose-400"
                        )}>
                          {r.status}
                        </span>
                      </td>

                      {/* Escalation Reason */}
                      <td className="py-2.5 px-3 whitespace-nowrap">
                        {r.escalation_reason ? (
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-medium bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20">
                            {r.escalation_reason}
                          </span>
                        ) : (
                          <span className="text-muted-foreground text-[10px]">—</span>
                        )}
                      </td>

                      {/* Turns */}
                      <td className="py-2.5 px-3 text-center font-mono font-semibold">
                        {r.total_turns}
                      </td>

                      {/* Score */}
                      <td className="py-2.5 px-3 text-center">
                        <span className={cn(
                          "font-mono font-bold text-xs",
                          r.confidence_score >= 80 ? "text-emerald-600 dark:text-emerald-400" :
                          r.confidence_score >= 60 ? "text-amber-600 dark:text-amber-400" : "text-rose-600 dark:text-rose-400"
                        )}>
                          {r.confidence_score}%
                        </span>
                      </td>

                      {/* Sentiment Shift */}
                      <td className="py-2.5 px-3 whitespace-nowrap text-[11px] font-medium text-foreground">
                        {r.sentiment_shift}
                      </td>

                      {/* Sentiment Score */}
                      <td className="py-2.5 px-3 text-center whitespace-nowrap">
                        <span className={cn(
                          "px-2 py-0.5 rounded text-[11px] font-bold font-mono",
                          r.sentiment_score > 0 ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" :
                          r.sentiment_score < 0 ? "bg-rose-500/10 text-rose-600 dark:text-rose-400" : "bg-blue-500/10 text-blue-600 dark:text-blue-400"
                        )}>
                          {r.sentiment_score > 0 ? `+${r.sentiment_score.toFixed(1)}` : r.sentiment_score.toFixed(1)}
                        </span>
                      </td>

                      {/* Estimated Cost */}
                      <td className="py-2.5 px-3 text-right font-mono font-semibold text-muted-foreground whitespace-nowrap">
                        ${r.estimated_cost.toFixed(4)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination Footer */}
        {data && data.records.length > 0 && (
          <div className="p-3 border-t border-black/[0.06] dark:border-white/[0.08] flex items-center justify-between">
            <div className="text-xs text-muted-foreground">
              Showing {(pagination.page - 1) * pagination.page_size + 1} to{' '}
              {Math.min(pagination.page * pagination.page_size, pagination.total_rows)} of{' '}
              {pagination.total_rows.toLocaleString()} entries
            </div>

            <div className="flex items-center gap-1.5 print:hidden">
              <button
                onClick={() => fetchReport(pagination.page - 1)}
                disabled={pagination.page <= 1 || loading}
                className="p-1.5 rounded-md border border-black/[0.08] dark:border-white/[0.08] text-foreground hover:bg-black/[0.04] dark:hover:bg-white/[0.06] transition-all cursor-pointer disabled:opacity-40"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>

              <span className="px-3 py-1 rounded-md text-xs font-mono font-semibold bg-black/[0.04] dark:bg-white/[0.06] text-foreground">
                {pagination.page} / {pagination.total_pages}
              </span>

              <button
                onClick={() => fetchReport(pagination.page + 1)}
                disabled={pagination.page >= pagination.total_pages || loading}
                className="p-1.5 rounded-md border border-black/[0.08] dark:border-white/[0.08] text-foreground hover:bg-black/[0.04] dark:hover:bg-white/[0.06] transition-all cursor-pointer disabled:opacity-40"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
