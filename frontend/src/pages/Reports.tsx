import { useState, useEffect, useRef } from 'react';
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
  Loader2, 
  Printer,
  Columns,
  Plus,
  Trash2,
  ChevronDown,
  SlidersHorizontal
} from 'lucide-react';
import { 
  analyticsApi, 
  TicketingReportRecord, 
  TicketingReportResponse,
  ReportColumnProfile 
} from '@/lib/api/analytics';
import { useAppState } from '@/context/AppStateContext';
import { cn } from '@/lib/utils';
import { 
  ReferenceBadge, 
  TableSkeleton, 
  Pagination, 
  Select, 
  Input,
  BaseModal 
} from '@/components/common';

interface ColumnDef {
  id: string;
  label: string;
  align?: 'left' | 'center' | 'right';
  width?: string;
  type?: 'badge' | 'text' | 'pill';
}

const ALL_COLUMNS: ColumnDef[] = [
  { id: 'id_thread', label: 'ID / Thread', align: 'left', width: 'w-20', type: 'badge' },
  { id: 'timestamp', label: 'Timestamp', align: 'left', width: 'w-24', type: 'text' },
  { id: 'customer_email', label: 'Customer Email', align: 'left', width: 'w-32', type: 'text' },
  { id: 'subject_summary', label: 'Subject & Summary', align: 'left', width: 'w-48', type: 'text' },
  { id: 'intent', label: 'Intent', align: 'left', width: 'w-20', type: 'pill' },
  { id: 'resolution_mode', label: 'Resolution Mode', align: 'left', width: 'w-24', type: 'pill' },
  { id: 'status', label: 'Status', align: 'left', width: 'w-16', type: 'pill' },
  { id: 'escalation_reason', label: 'Escalation Reason', align: 'left', width: 'w-24', type: 'text' },
  { id: 'turns', label: 'Turns', align: 'center', width: 'w-8', type: 'text' },
  { id: 'score', label: 'Score', align: 'center', width: 'w-10', type: 'text' },
  { id: 'sentiment_shift', label: 'Sentiment Shift', align: 'left', width: 'w-16', type: 'badge' },
  { id: 'sentiment_score', label: 'Sentiment Score', align: 'center', width: 'w-10', type: 'text' },
  { id: 'tokens', label: 'Tokens', align: 'right', width: 'w-14', type: 'text' },
  { id: 'latency', label: 'Processing Time', align: 'right', width: 'w-14', type: 'text' },
  { id: 'cost', label: 'Est. Cost', align: 'right', width: 'w-16', type: 'text' },
];

export default function Reports() {
  const { selectedClientId, clients, isAdmin } = useAppState();
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
  const [searchField, setSearchField] = useState(searchParams.get('search_field') || 'all');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  // Column Profiles & Customization State
  const [profiles, setProfiles] = useState<ReportColumnProfile[]>([]);
  const [activeProfileId, setActiveProfileId] = useState<string | number>('overview');
  const [visibleColumns, setVisibleColumns] = useState<string[]>([
    'timestamp', 'customer_email', 'subject_summary', 'intent', 'status', 'resolution_mode', 'score'
  ]);
  const [columnMenuOpen, setColumnMenuOpen] = useState(false);
  const [exportMenuOpen, setExportMenuOpen] = useState(false);

  // Profile Creation Modal State
  const [profileModalOpen, setProfileModalOpen] = useState(false);
  const [newProfileName, setNewProfileName] = useState('');
  const [newProfileCols, setNewProfileCols] = useState<string[]>([]);
  const [profileError, setProfileError] = useState('');
  const [savingProfile, setSavingProfile] = useState(false);

  const columnMenuRef = useRef<HTMLDivElement>(null);
  const exportMenuRef = useRef<HTMLDivElement>(null);

  // Close dropdowns on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (columnMenuRef.current && !columnMenuRef.current.contains(e.target as Node)) {
        setColumnMenuOpen(false);
      }
      if (exportMenuRef.current && !exportMenuRef.current.contains(e.target as Node)) {
        setExportMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const loadProfiles = async () => {
    if (!selectedClientId) return;
    try {
      const res = await analyticsApi.getReportProfiles(selectedClientId);
      if (res && res.profiles) {
        setProfiles(res.profiles);
        const current = res.profiles.find((p) => p.id === activeProfileId);
        if (!current) {
          const overview = res.profiles.find((p) => p.id === 'overview') || res.profiles[0];
          if (overview) {
            setActiveProfileId(overview.id);
            setVisibleColumns(overview.columns);
          }
        }
      }
    } catch (err) {
      console.error('Failed to load report profiles:', err);
    }
  };

  useEffect(() => {
    loadProfiles();
  }, [selectedClientId]);

  const selectProfile = (profile: ReportColumnProfile) => {
    setActiveProfileId(profile.id);
    setVisibleColumns([...profile.columns]);
    setColumnMenuOpen(false);
  };

  const activeProfile = profiles.find((p) => p.id === activeProfileId);
  const isModified = activeProfile
    ? visibleColumns.length !== activeProfile.columns.length ||
      visibleColumns.some((c) => !activeProfile.columns.includes(c))
    : false;

  const toggleColumn = (colId: string) => {
    setVisibleColumns((prev) => {
      if (prev.includes(colId)) {
        if (prev.length <= 1) return prev; // keep at least 1 column
        return prev.filter((c) => c !== colId);
      } else {
        return [...prev, colId];
      }
    });
  };

  const handleCreateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedClientId || selectedClientId === 'ALL') return;
    const name = newProfileName.trim();
    if (!name) {
      setProfileError('Profile name cannot be empty');
      return;
    }
    if (['overview', 'quality & sentiment', 'ops & billing'].includes(name.toLowerCase())) {
      setProfileError(`'${name}' is a reserved default profile name`);
      return;
    }
    if (newProfileCols.length === 0) {
      setProfileError('Please select at least one column');
      return;
    }
    setSavingProfile(true);
    setProfileError('');
    try {
      const created = await analyticsApi.createReportProfile(selectedClientId, {
        name,
        columns: newProfileCols,
      });
      await loadProfiles();
      setActiveProfileId(created.id);
      setVisibleColumns(created.columns);
      setProfileModalOpen(false);
      setNewProfileName('');
    } catch (err: any) {
      setProfileError(err.message || 'Failed to create profile');
    } finally {
      setSavingProfile(false);
    }
  };

  const handleDeleteProfile = async (profile: ReportColumnProfile) => {
    if (profile.is_default || !selectedClientId || selectedClientId === 'ALL') return;
    if (!window.confirm(`Are you sure you want to delete profile "${profile.name}"?`)) return;
    try {
      await analyticsApi.deleteReportProfile(selectedClientId, profile.id);
      if (activeProfileId === profile.id) {
        const overview = profiles.find((p) => p.id === 'overview') || profiles[0];
        if (overview) {
          setActiveProfileId(overview.id);
          setVisibleColumns(overview.columns);
        }
      }
      await loadProfiles();
    } catch (err: any) {
      alert('Failed to delete profile: ' + err.message);
    }
  };

  const columnOptions = [
    { value: 'all', label: 'All Columns' },
    ...ALL_COLUMNS.map((c) => ({
      value: c.id,
      label: c.id === 'cost' ? (isAdmin ? 'Cost (Billed / Raw)' : 'Est. Cost') : c.label,
    })),
  ];

  const getSearchPlaceholder = () => {
    switch (searchField) {
      case 'id_thread': return 'Filter by ID (#123), Thread (th_...), or Ticket ID...';
      case 'timestamp': return 'Filter by date/time (e.g. 2026-10-08, 15:07)...';
      case 'customer_email': return 'Filter by customer email (e.g. user@domain.com)...';
      case 'subject_summary': return 'Filter by subject, summary, or email body...';
      case 'intent': return 'Filter by intent (e.g. order_tracking, troubleshooting)...';
      case 'resolution_mode': return 'Filter by mode (RAG Deflected, Ticket Escalated, etc.)...';
      case 'status': return 'Filter by status (Resolved, Escalated, Under Review, etc.)...';
      case 'escalation_reason': return 'Filter by escalation reason (e.g. kb_miss, low_confidence)...';
      case 'turns': return 'Filter by turn count (e.g. 1, 2, 3)...';
      case 'score': return 'Filter by AI score (e.g. 80, 95)...';
      case 'sentiment_shift': return 'Filter by sentiment (Neutral, Delighted, Frustrated)...';
      case 'sentiment_score': return 'Filter by sentiment score (1.0, 0.0, -1.0)...';
      case 'tokens': return 'Filter by tokens consumed (e.g. 1500)...';
      case 'latency': return 'Filter by latency/time (e.g. 1.5s, 1500ms)...';
      case 'cost': return 'Filter by estimated cost (e.g. 0.00185)...';
      default: return 'Search across all 15 columns (ID, thread, email, time, tokens, cost...)...';
    }
  };

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
        search_field: searchField,
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
  }, [selectedClientId, rangeType, intent, resolutionMode, escalationReason, pageSize, searchField]);

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
    setSearchField('all');
    setPage(1);
  };

  const handleExportCsv = async (exportCols?: string[]) => {
    if (!selectedClientId) return;
    setExporting(true);
    setExportMenuOpen(false);
    try {
      const blob = await analyticsApi.downloadReportCsv(selectedClientId, {
        range_type: rangeType,
        start_date: startDate,
        end_date: endDate,
        intent: intent,
        resolution_mode: resolutionMode,
        escalation_reason: escalationReason,
        search: search,
        search_field: searchField,
        columns: exportCols,
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

  // Compute active columns to render in table
  const activeCols = ALL_COLUMNS.filter((c) => visibleColumns.includes(c.id));
  const defaultProfiles = profiles.filter((p) => p.is_default);
  const customProfiles = profiles.filter((p) => !p.is_default);

  const renderTableCell = (columnId: string, r: TicketingReportRecord) => {
    const isDeflected = r.resolution_mode === 'RAG Deflected';
    const isTicket = r.resolution_mode === 'Ticket Escalated';
    const isReview = r.resolution_mode === 'Manual Review';
    const isDropped = r.resolution_mode === 'Filtered / Dropped';
    const isFailed = r.resolution_mode === 'Failed';

    switch (columnId) {
      case 'id_thread':
        return (
          <td key={columnId} className="py-2.5 px-3 whitespace-nowrap">
            <div className="flex flex-col gap-1 items-start">
              <ReferenceBadge id={r.id} type="message" label="#" truncateLength={0} />
              {r.thread_id && (
                <ReferenceBadge id={r.thread_id} type="thread" truncateLength={8} />
              )}
            </div>
          </td>
        );
      case 'timestamp':
        return (
          <td key={columnId} className="py-2.5 px-3 text-muted-foreground whitespace-nowrap">
            {r.timestamp}
          </td>
        );
      case 'customer_email':
        return (
          <td key={columnId} className="py-2.5 px-3 font-medium text-foreground whitespace-nowrap">
            <span className="truncate block max-w-[150px]" title={r.customer_email}>
              {r.customer_email}
            </span>
          </td>
        );
      case 'subject_summary':
        return (
          <td key={columnId} className="py-2.5 px-3 max-w-[220px]">
            <div className="font-semibold text-foreground truncate" title={r.subject}>
              {r.subject || 'No Subject'}
            </div>
            <div className="text-[11px] text-muted-foreground line-clamp-1 truncate" title={r.summary_of_issue}>
              {r.summary_of_issue}
            </div>
          </td>
        );
      case 'intent':
        return (
          <td key={columnId} className="py-2.5 px-3 whitespace-nowrap">
            <span className="px-2 py-0.5 rounded-md font-mono text-[10px] font-semibold bg-black/[0.04] dark:bg-white/[0.06] text-foreground border border-black/[0.06] dark:border-white/[0.08]">
              {r.technical_intent}
            </span>
          </td>
        );
      case 'resolution_mode':
        return (
          <td key={columnId} className="py-2.5 px-3 whitespace-nowrap">
            <span className={cn(
              "px-2 py-0.5 rounded-full text-[10px] font-bold border",
              isDeflected && "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20",
              isTicket && "bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20",
              isReview && "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20",
              isDropped && "bg-zinc-500/10 text-zinc-600 dark:text-zinc-400 border-zinc-500/20",
              isFailed && "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20",
              !isDeflected && !isTicket && !isReview && !isDropped && !isFailed && "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20"
            )}>
              {r.resolution_mode}
            </span>
          </td>
        );
      case 'status':
        return (
          <td key={columnId} className="py-2.5 px-3 whitespace-nowrap">
            <span className={cn(
              "font-semibold text-[11px]",
              r.status === 'Resolved' && "text-emerald-600 dark:text-emerald-400",
              r.status === 'Escalated' && "text-purple-600 dark:text-purple-400",
              r.status === 'Under Review' && "text-amber-600 dark:text-amber-400",
              r.status === 'Dropped' && "text-zinc-600 dark:text-zinc-400",
              r.status === 'Failed' && "text-rose-600 dark:text-rose-400",
              r.status === 'Open' && "text-blue-600 dark:text-blue-400"
            )}>
              {r.status}
            </span>
          </td>
        );
      case 'escalation_reason':
        return (
          <td key={columnId} className="py-2.5 px-3 whitespace-nowrap">
            {r.escalation_reason ? (
              <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-medium bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20">
                {r.escalation_reason}
              </span>
            ) : (
              <span className="text-muted-foreground text-[10px]">—</span>
            )}
          </td>
        );
      case 'turns':
        return (
          <td key={columnId} className="py-2.5 px-3 text-center font-mono font-semibold">
            {r.total_turns}
          </td>
        );
      case 'score':
        return (
          <td key={columnId} className="py-2.5 px-3 text-center">
            <span className={cn(
              "font-mono font-bold text-xs",
              r.confidence_score >= 80 ? "text-emerald-600 dark:text-emerald-400" :
              r.confidence_score >= 60 ? "text-amber-600 dark:text-amber-400" : "text-rose-600 dark:text-rose-400"
            )}>
              {r.confidence_score}%
            </span>
          </td>
        );
      case 'sentiment_shift':
        return (
          <td key={columnId} className="py-2.5 px-3 whitespace-nowrap text-[11px] font-medium text-foreground">
            {r.sentiment_shift}
          </td>
        );
      case 'sentiment_score':
        return (
          <td key={columnId} className="py-2.5 px-3 text-center whitespace-nowrap">
            <span className={cn(
              "px-2 py-0.5 rounded text-[11px] font-bold font-mono",
              r.sentiment_score > 0 ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" :
              r.sentiment_score < 0 ? "bg-rose-500/10 text-rose-600 dark:text-rose-400" : "bg-blue-500/10 text-blue-600 dark:text-blue-400"
            )}>
              {r.sentiment_score > 0 ? `+${r.sentiment_score.toFixed(1)}` : r.sentiment_score.toFixed(1)}
            </span>
          </td>
        );
      case 'tokens':
        return (
          <td key={columnId} className="py-2.5 px-3 text-right whitespace-nowrap font-mono">
            <span 
              className="font-semibold text-foreground text-[11px]" 
              title={`Total: ${r.total_tokens || 0} tokens (Prompt: ${r.prompt_tokens || 0}, Completion: ${r.completion_tokens || 0})`}
            >
              {(r.total_tokens || 0).toLocaleString()}
            </span>
            {(r.prompt_tokens !== undefined && r.completion_tokens !== undefined && (r.total_tokens || 0) > 0) && (
              <div className="text-[9px] text-muted-foreground flex items-center justify-end gap-1">
                <span>{r.prompt_tokens.toLocaleString()}p</span>
                <span>•</span>
                <span>{r.completion_tokens.toLocaleString()}c</span>
              </div>
            )}
          </td>
        );
      case 'latency':
        return (
          <td key={columnId} className="py-2.5 px-3 text-right whitespace-nowrap font-mono">
            {r.latency_ms && r.latency_ms > 0 ? (
              <div 
                className="flex flex-col items-end cursor-help"
                title={`Total processing duration: ${r.latency_ms.toLocaleString()} ms (${(r.latency_sec ?? (r.latency_ms / 1000)).toFixed(2)}s)`}
              >
                <span className="font-semibold text-foreground text-[11px]">
                  {(r.latency_sec ?? (r.latency_ms / 1000)).toFixed(2)}s
                </span>
                <span className="text-[9px] text-muted-foreground">
                  {r.latency_ms.toLocaleString()} ms
                </span>
              </div>
            ) : (
              <span className="text-muted-foreground text-[11px]">—</span>
            )}
          </td>
        );
      case 'cost':
        return (
          <td key={columnId} className="py-2.5 px-3 text-right whitespace-nowrap font-mono">
            {isAdmin && r.raw_cost !== undefined ? (
              <div className="flex flex-col items-end">
                <span className="font-semibold text-foreground text-[11px]">
                  ${(r.billed_cost !== undefined ? r.billed_cost : r.estimated_cost).toFixed(4)}
                  <span className="ml-1 text-[9px] font-normal text-muted-foreground uppercase">billed</span>
                </span>
                <span className="text-[10px] text-muted-foreground">
                  ${r.raw_cost.toFixed(4)}
                  <span className="ml-0.5 text-[8px] uppercase">raw</span>
                  {r.margin !== undefined && (
                    <span className={cn(
                      "ml-1 text-[8px] font-semibold",
                      r.margin >= 0 ? "text-emerald-500" : "text-rose-500"
                    )}>
                      ({r.margin >= 0 ? '+' : ''}${r.margin.toFixed(4)})
                    </span>
                  )}
                </span>
              </div>
            ) : (
              <span className="font-semibold text-muted-foreground">
                ${(r.billed_cost !== undefined ? r.billed_cost : r.estimated_cost).toFixed(4)}
              </span>
            )}
          </td>
        );
      default:
        return null;
    }
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
          {isAdmin && (
            <button
              onClick={() => window.print()}
              disabled={loading || summary.total_records === 0}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-black/[0.08] dark:border-white/[0.08] text-xs font-semibold hover:bg-black/[0.04] dark:hover:bg-white/[0.06] transition-all cursor-pointer disabled:opacity-50"
              title="Print or save PDF executive report"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Print / PDF</span>
            </button>
          )}

          <button
            onClick={() => fetchReport(page)}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-black/[0.08] dark:border-white/[0.08] text-xs font-semibold hover:bg-black/[0.04] dark:hover:bg-white/[0.06] transition-all cursor-pointer disabled:opacity-50"
          >
            <RotateCcw className={cn("w-3.5 h-3.5", loading && "animate-spin")} />
            <span>Refresh</span>
          </button>

          {/* Export Dropdown Split Button */}
          <div className="relative" ref={exportMenuRef}>
            <div className="inline-flex rounded-lg shadow-2xs">
              <button
                onClick={() => handleExportCsv(visibleColumns)}
                disabled={exporting || loading || summary.total_records === 0}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-l-lg bg-primary text-primary-foreground text-xs font-semibold hover:opacity-90 transition-all cursor-pointer disabled:opacity-50"
                title={`Export current view (${visibleColumns.length} columns)`}
              >
                {exporting ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Download className="w-3.5 h-3.5" />
                )}
                <span>{exporting ? 'Exporting...' : 'Export CSV'}</span>
              </button>
              <button
                onClick={() => setExportMenuOpen(!exportMenuOpen)}
                disabled={exporting || loading || summary.total_records === 0}
                className="px-2 py-1.5 rounded-r-lg bg-primary text-primary-foreground text-xs border-l border-primary-foreground/20 hover:opacity-90 transition-all cursor-pointer disabled:opacity-50"
                title="Choose export options"
              >
                <ChevronDown className="w-3.5 h-3.5" />
              </button>
            </div>

            {exportMenuOpen && (
              <div className="absolute right-0 mt-1.5 w-60 rounded-xl bg-white dark:bg-[#1f1f1f] border border-black/[0.08] dark:border-white/[0.1] shadow-lg z-30 p-1.5 text-xs animate-in fade-in-50 zoom-in-95">
                <div className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                  Export Options
                </div>
                <button
                  onClick={() => handleExportCsv(visibleColumns)}
                  className="w-full text-left px-2.5 py-1.5 rounded-lg hover:bg-black/[0.04] dark:hover:bg-white/[0.06] flex items-center justify-between cursor-pointer"
                >
                  <span className="font-medium text-foreground">Current View Only</span>
                  <span className="text-[10px] text-muted-foreground font-mono">{visibleColumns.length} cols</span>
                </button>
                <button
                  onClick={() => handleExportCsv()}
                  className="w-full text-left px-2.5 py-1.5 rounded-lg hover:bg-black/[0.04] dark:hover:bg-white/[0.06] flex items-center justify-between cursor-pointer"
                >
                  <span className="font-medium text-foreground">Full Raw Dataset</span>
                  <span className="text-[10px] text-muted-foreground font-mono">All 15 cols</span>
                </button>
              </div>
            )}
          </div>
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
            <Select
              value={rangeType}
              onChange={(e) => setRangeType(e.target.value)}
            >
              <option value="all">All Time</option>
              <option value="today">Today</option>
              <option value="yesterday">Yesterday</option>
              <option value="this_week">This Week</option>
              <option value="last_week">Last Week</option>
              <option value="this_month">This Month</option>
              <option value="last_month">Last Month</option>
              <option value="custom">Custom Range</option>
            </Select>
          </div>

          {/* Resolution Mode */}
          <div>
            <label className="text-[11px] text-muted-foreground font-medium block mb-1">Resolution Mode</label>
            <Select
              value={resolutionMode}
              onChange={(e) => setResolutionMode(e.target.value)}
            >
              <option value="all">All Resolution Modes</option>
              <option value="rag">RAG Deflected (Resolved)</option>
              <option value="ticket">Ticket Escalated</option>
              <option value="review">Manual Review (Draft Held)</option>
              <option value="filtered">Filtered / Dropped</option>
              <option value="failed">Processing Failed</option>
            </Select>
          </div>

          {/* Intent */}
          <div>
            <label className="text-[11px] text-muted-foreground font-medium block mb-1">Intent</label>
            <Select
              value={intent}
              onChange={(e) => setIntent(e.target.value)}
            >
              <option value="all">All Intents</option>
              <option value="order_tracking">Order Tracking</option>
              <option value="technical_support">Technical Support</option>
              <option value="billing_inquiry">Billing Inquiry</option>
              <option value="product_question">Product Question</option>
              <option value="cancellation_refund">Cancellation &amp; Refund</option>
              <option value="troubleshooting">Troubleshooting</option>
              <option value="account_access">Account Access</option>
              <option value="general_inquiry">General Inquiry</option>
            </Select>
          </div>

          {/* Escalation Reason */}
          <div>
            <label className="text-[11px] text-muted-foreground font-medium block mb-1">Escalation Reason</label>
            <Select
              value={escalationReason}
              onChange={(e) => setEscalationReason(e.target.value)}
            >
              <option value="all">All Escalation Reasons</option>
              <option value="kb_miss">Knowledge Base Miss</option>
              <option value="low_confidence">Low AI Confidence (&lt;80%)</option>
              <option value="diagnostic_exhausted">Diagnostic Steps Exhausted</option>
              <option value="negative_sentiment">Negative Sentiment Shift</option>
              <option value="complex_workflow">Complex Human Escalation</option>
              <option value="customer_requested">Customer Requested Agent</option>
              <option value="hostile_threat">Hostile / Legal Language</option>
            </Select>
          </div>

          {/* Search Field Target */}
          <div>
            <label className="text-[11px] text-muted-foreground font-medium block mb-1">Search Column</label>
            <Select
              value={searchField}
              onChange={(e) => setSearchField(e.target.value)}
            >
              {columnOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </Select>
          </div>

          {/* Keyword Search */}
          <div>
            <label className="text-[11px] text-muted-foreground font-medium block mb-1">Keyword Query</label>
            <form onSubmit={handleSearchSubmit} className="relative">
              <Input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={getSearchPlaceholder()}
                className="pr-8"
              />
              <button
                type="submit"
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground cursor-pointer"
              >
                <Search className="w-3.5 h-3.5" />
              </button>
            </form>
          </div>
        </div>

        {/* Custom Date Range Picker */}
        {rangeType === 'custom' && (
          <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-black/[0.04] dark:border-white/[0.04]">
            <div className="flex items-center gap-2">
              <span className="text-[11px] text-muted-foreground font-medium">From:</span>
              <Input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-auto text-xs py-1"
              />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[11px] text-muted-foreground font-medium">To:</span>
              <Input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-auto text-xs py-1"
              />
            </div>
            <button
              onClick={() => {
                setPage(1);
                fetchReport(1);
              }}
              className="px-3 py-1 rounded-md bg-primary text-primary-foreground text-xs font-semibold hover:opacity-90 transition-all cursor-pointer"
            >
              Apply Dates
            </button>
          </div>
        )}
      </div>

      {/* Main Resolution Audit Table Section with Profile Selector */}
      <div className="win11-card rounded-xl border border-black/[0.06] dark:border-white/[0.08] shadow-2xs overflow-hidden">
        
        {/* Profile Selector & Column Control Bar */}
        <div className="p-3.5 border-b border-black/[0.06] dark:border-white/[0.08] bg-black/[0.01] dark:bg-white/[0.01] flex flex-col md:flex-row md:items-center justify-between gap-3 print:hidden">
          
          {/* Left: Column Profiles Navigation */}
          <div className="flex flex-wrap items-center gap-2">
            
            {/* Default Profiles Card */}
            <div className="flex items-center gap-1 p-1 rounded-xl bg-black/[0.03] dark:bg-white/[0.04] border border-black/[0.08] dark:border-white/[0.08]">
              <div className="px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-muted-foreground border-r border-black/[0.08] dark:border-white/[0.08] mr-0.5">
                Default
              </div>
              {defaultProfiles.map((p) => {
                const isActive = activeProfileId === p.id;
                return (
                  <button
                    key={p.id}
                    onClick={() => selectProfile(p)}
                    className={cn(
                      "px-2.5 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5",
                      isActive
                        ? "bg-white dark:bg-[#282828] text-foreground shadow-xs border border-black/[0.06] dark:border-white/[0.1]"
                        : "text-muted-foreground hover:text-foreground hover:bg-black/[0.03] dark:hover:bg-white/[0.04]"
                    )}
                  >
                    <span>{p.name}</span>
                    <span className={cn(
                      "text-[10px] px-1.5 py-0.2 rounded-full",
                      isActive ? "bg-primary/10 text-primary font-bold" : "bg-black/[0.05] dark:bg-white/[0.08] text-muted-foreground"
                    )}>
                      {p.columns.length}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Custom Profiles Section */}
            {customProfiles.length > 0 && (
              <div className="flex items-center gap-1 p-1 rounded-xl bg-black/[0.03] dark:bg-white/[0.04] border border-black/[0.08] dark:border-white/[0.08]">
                <div className="px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-muted-foreground border-r border-black/[0.08] dark:border-white/[0.08] mr-0.5">
                  Custom
                </div>
                {customProfiles.map((p) => {
                  const isActive = activeProfileId === p.id;
                  return (
                    <div
                      key={p.id}
                      className={cn(
                        "group flex items-center gap-1 pl-2.5 pr-1.5 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer",
                        isActive
                          ? "bg-white dark:bg-[#282828] text-foreground shadow-xs border border-black/[0.06] dark:border-white/[0.1]"
                          : "text-muted-foreground hover:text-foreground hover:bg-black/[0.03] dark:hover:bg-white/[0.04]"
                      )}
                    >
                      <button
                        onClick={() => selectProfile(p)}
                        className="flex items-center gap-1.5 cursor-pointer"
                      >
                        <span>{p.name}</span>
                        <span className={cn(
                          "text-[10px] px-1.5 py-0.2 rounded-full",
                          isActive ? "bg-primary/10 text-primary font-bold" : "bg-black/[0.05] dark:bg-white/[0.08] text-muted-foreground"
                        )}>
                          {p.columns.length}
                        </span>
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteProfile(p);
                        }}
                        className="opacity-0 group-hover:opacity-100 hover:text-rose-500 p-0.5 rounded transition-opacity cursor-pointer ml-1"
                        title={`Delete "${p.name}" profile`}
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Add Custom Profile Button */}
            {selectedClientId !== 'ALL' && (
              <button
                onClick={() => {
                  setNewProfileName('');
                  setNewProfileCols([...visibleColumns]);
                  setProfileError('');
                  setProfileModalOpen(true);
                }}
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-dashed border-black/[0.15] dark:border-white/[0.15] text-xs font-semibold text-muted-foreground hover:text-foreground hover:border-primary/50 transition-all cursor-pointer"
              >
                <Plus className="w-3 h-3 text-primary" />
                <span>New Profile</span>
              </button>
            )}

            {/* Modified View Indicator */}
            {isModified && (
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400 text-[11px] font-medium border border-amber-500/20">
                <span>Customized ({visibleColumns.length} cols)</span>
                {selectedClientId !== 'ALL' && (
                  <button
                    onClick={() => {
                      setNewProfileName('');
                      setNewProfileCols([...visibleColumns]);
                      setProfileError('');
                      setProfileModalOpen(true);
                    }}
                    className="underline font-bold hover:text-amber-700 dark:hover:text-amber-300 cursor-pointer ml-1"
                  >
                    Save as Profile
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Right: Columns Visibility Popover & Rows Selector */}
          <div className="flex items-center gap-2 self-end md:self-auto">
            {/* Columns Visibility Dropdown */}
            <div className="relative" ref={columnMenuRef}>
              <button
                onClick={() => setColumnMenuOpen(!columnMenuOpen)}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-black/[0.08] dark:border-white/[0.08] bg-white dark:bg-[#202020] text-xs font-semibold hover:bg-black/[0.02] dark:hover:bg-white/[0.04] transition-all cursor-pointer"
              >
                <Columns className="w-3.5 h-3.5 text-muted-foreground" />
                <span>Columns ({visibleColumns.length}/{ALL_COLUMNS.length})</span>
                <ChevronDown className="w-3 h-3 text-muted-foreground" />
              </button>

              {columnMenuOpen && (
                <div className="absolute right-0 mt-1.5 w-64 rounded-xl bg-white dark:bg-[#1f1f1f] border border-black/[0.08] dark:border-white/[0.1] shadow-xl z-30 p-2 text-xs animate-in fade-in-50 zoom-in-95">
                  <div className="flex items-center justify-between pb-2 mb-2 border-b border-black/[0.06] dark:border-white/[0.08]">
                    <span className="font-semibold text-foreground text-xs">Toggle Visible Columns</span>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setVisibleColumns(ALL_COLUMNS.map((c) => c.id))}
                        className="text-[10px] text-primary hover:underline cursor-pointer"
                      >
                        All
                      </button>
                      <button
                        onClick={() => {
                          if (activeProfile) setVisibleColumns([...activeProfile.columns]);
                        }}
                        className="text-[10px] text-muted-foreground hover:underline cursor-pointer"
                      >
                        Reset
                      </button>
                    </div>
                  </div>

                  <div className="max-h-60 overflow-y-auto space-y-1 pr-1">
                    {ALL_COLUMNS.map((col) => {
                      const isChecked = visibleColumns.includes(col.id);
                      const displayLabel = col.id === 'cost' ? (isAdmin ? 'Cost (Billed / Raw)' : 'Est. Cost') : col.label;
                      return (
                        <label
                          key={col.id}
                          className="flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-black/[0.03] dark:hover:bg-white/[0.05] cursor-pointer text-xs"
                        >
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => toggleColumn(col.id)}
                            className="rounded border-black/[0.2] dark:border-white/[0.2] text-primary focus:ring-primary/20"
                          />
                          <span className={cn(isChecked ? "text-foreground font-medium" : "text-muted-foreground")}>
                            {displayLabel}
                          </span>
                        </label>
                      );
                    })}
                  </div>

                  {isModified && selectedClientId !== 'ALL' && (
                    <div className="pt-2 mt-2 border-t border-black/[0.06] dark:border-white/[0.08]">
                      <button
                        onClick={() => {
                          setColumnMenuOpen(false);
                          setNewProfileName('');
                          setNewProfileCols([...visibleColumns]);
                          setProfileError('');
                          setProfileModalOpen(true);
                        }}
                        className="w-full py-1 px-2 rounded-md bg-primary/10 text-primary hover:bg-primary/20 text-xs font-semibold text-center transition-colors cursor-pointer"
                      >
                        Save this column set as profile
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Rows Per Page Selector */}
            <div className="flex items-center gap-1.5 text-xs">
              <span className="text-muted-foreground">Rows:</span>
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
        </div>

        {/* Dynamic Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-black/[0.06] dark:border-white/[0.08] bg-black/[0.02] dark:bg-white/[0.02] text-muted-foreground">
                {activeCols.map((col) => (
                  <th
                    key={col.id}
                    className={cn(
                      "py-2.5 px-3 font-semibold",
                      col.align === 'center' ? 'text-center' : col.align === 'right' ? 'text-right' : 'text-left'
                    )}
                  >
                    {col.id === 'cost' ? (isAdmin ? 'Cost (Billed / Raw)' : 'Est. Cost') : col.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className={cn(
              "divide-y divide-black/[0.04] dark:divide-white/[0.04] transition-opacity",
              loading && data?.records && data.records.length > 0 && "opacity-50 pointer-events-none"
            )}>
              {loading && (!data?.records || data.records.length === 0) ? (
                <TableSkeleton
                  rows={pageSize > 25 ? 12 : 8}
                  columns={activeCols.length}
                  alignments={activeCols.map((c) => c.align || 'left')}
                  cellTypes={activeCols.map((c) => c.type || 'text')}
                  columnWidths={activeCols.map((c) => c.width || 'w-20')}
                />
              ) : errorMsg ? (
                <tr>
                  <td colSpan={activeCols.length} className="p-8 text-center text-rose-500 space-y-2">
                    <AlertTriangle className="w-8 h-8 mx-auto" />
                    <p className="text-xs font-semibold">{errorMsg}</p>
                  </td>
                </tr>
              ) : !data?.records || data.records.length === 0 ? (
                <tr>
                  <td colSpan={activeCols.length} className="p-12 text-center text-muted-foreground space-y-2">
                    <FileText className="w-8 h-8 mx-auto opacity-40" />
                    <p className="text-sm font-medium">No records match the current filter selection</p>
                    <p className="text-xs opacity-75">Try clearing your search keyword or changing the date range</p>
                  </td>
                </tr>
              ) : (
                data.records.map((r: TicketingReportRecord) => (
                  <tr 
                    key={r.id}
                    className="hover:bg-black/[0.02] dark:hover:bg-white/[0.03] transition-colors"
                  >
                    {activeCols.map((col) => renderTableCell(col.id, r))}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Standardized Pagination */}
        {data && data.records.length > 0 && (
          <Pagination
            page={pagination.page}
            pageSize={pageSize}
            totalCount={pagination.total_rows}
            totalPages={pagination.total_pages}
            onPageChange={(newPage) => {
              setPage(newPage);
              fetchReport(newPage);
            }}
            onPageSizeChange={(newSize) => {
              setPageSize(newSize);
              setPage(1);
            }}
            pageSizeOptions={[10, 25, 50, 100]}
            loading={loading}
          />
        )}
      </div>

      {/* Modal: Create Custom Column Profile */}
      <BaseModal
        isOpen={profileModalOpen}
        onClose={() => setProfileModalOpen(false)}
        title="Create Custom Column Profile"
        subtitle={`Save a custom column set for ${clientName}`}
        icon={<SlidersHorizontal className="w-5 h-5 text-primary" />}
        maxWidth="max-w-md"
        footer={
          <div className="flex items-center justify-end gap-2 w-full">
            <button
              type="button"
              onClick={() => setProfileModalOpen(false)}
              className="px-3.5 py-1.5 rounded-lg border border-black/[0.08] dark:border-white/[0.08] text-xs font-semibold hover:bg-black/[0.04] dark:hover:bg-white/[0.06] transition-all cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleCreateProfile}
              disabled={savingProfile || !newProfileName.trim() || newProfileCols.length === 0}
              className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-semibold hover:opacity-90 transition-all cursor-pointer disabled:opacity-50"
            >
              {savingProfile && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              <span>Save Profile</span>
            </button>
          </div>
        }
      >
        <form onSubmit={handleCreateProfile} className="space-y-4">
          <div>
            <label className="text-xs font-semibold text-foreground block mb-1.5">
              Profile Name
            </label>
            <Input
              type="text"
              placeholder="e.g. Executive Summary, Finance Audit, CSAT Review..."
              value={newProfileName}
              onChange={(e) => {
                setNewProfileName(e.target.value);
                if (profileError) setProfileError('');
              }}
              autoFocus
            />
            {profileError && (
              <p className="text-[11px] text-rose-500 font-medium mt-1">
                {profileError}
              </p>
            )}
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-semibold text-foreground">
                Select Columns ({newProfileCols.length}/{ALL_COLUMNS.length})
              </label>
              <div className="flex items-center gap-2 text-[10px]">
                <button
                  type="button"
                  onClick={() => setNewProfileCols(ALL_COLUMNS.map((c) => c.id))}
                  className="text-primary hover:underline cursor-pointer"
                >
                  Select All
                </button>
                <span>•</span>
                <button
                  type="button"
                  onClick={() => setNewProfileCols([])}
                  className="text-muted-foreground hover:underline cursor-pointer"
                >
                  Clear All
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-1.5 p-2 rounded-xl bg-black/[0.02] dark:bg-white/[0.02] border border-black/[0.06] dark:border-white/[0.08] max-h-56 overflow-y-auto">
              {ALL_COLUMNS.map((col) => {
                const checked = newProfileCols.includes(col.id);
                const displayLabel = col.id === 'cost' ? (isAdmin ? 'Cost (Billed / Raw)' : 'Est. Cost') : col.label;
                return (
                  <label
                    key={col.id}
                    className={cn(
                      "flex items-center gap-2 p-1.5 rounded-lg text-xs cursor-pointer transition-colors",
                      checked ? "bg-primary/5 text-foreground font-medium" : "text-muted-foreground hover:bg-black/[0.02] dark:hover:bg-white/[0.04]"
                    )}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => {
                        if (checked) {
                          setNewProfileCols((prev) => prev.filter((id) => id !== col.id));
                        } else {
                          setNewProfileCols((prev) => [...prev, col.id]);
                        }
                      }}
                      className="rounded border-black/[0.2] dark:border-white/[0.2] text-primary focus:ring-primary/20"
                    />
                    <span className="truncate">{displayLabel}</span>
                  </label>
                );
              })}
            </div>
          </div>
        </form>
      </BaseModal>
    </div>
  );
}
