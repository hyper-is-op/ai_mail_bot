import { useState, useEffect, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { 
  Search, 
  Inbox, 
  Ticket, 
  CheckCircle2, 
  Clock, 
  RefreshCw, 
  Copy, 
  Check, 
  ShieldAlert,
  Smile,
  Meh,
  Frown,
  Mail
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { copyToClipboard as safeCopyToClipboard } from '@/lib/clipboard';
import { api } from '@/lib/api';
import EmailBodyWithDisclaimer from '@/components/EmailBodyWithDisclaimer';
import { useAppState } from '@/context/AppStateContext';
import { 
  ReferenceBadge, 
  TableSkeleton, 
  Pagination, 
  BaseDrawer, 
  StatusBadge, 
  Input, 
  Select 
} from '@/components/common';

interface TicketRecord {
  id: string;
  mailId: string;
  customer_email?: string;
  customerEmail?: string;
  email_log_id?: number | string | null;
  emailLogId?: number | string | null;
  thread_id?: string | null;
  threadId?: string | null;
  intent?: string;
  subject: string;
  preview: string;
  status: string;
  priority: string;
  sentiment: string;
  time: string;
  date_str: string;
}

export default function Tickets() {
  const [searchParams] = useSearchParams();
  const [ticketsList, setTicketsList] = useState<TicketRecord[]>([]);
  const [selectedTicket, setSelectedTicket] = useState<TicketRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'Ticket_Generated' | 'Done_Replied'>('all');
  const [priorityFilter, setPriorityFilter] = useState<'all' | 'Critical' | 'High' | 'Medium' | 'Low'>('all');
  const [intentFilter, setIntentFilter] = useState<string>('all');
  const [copiedField, setCopiedField] = useState<string | null>(null);

  // Pagination & Server-side Metrics
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [totalRecords, setTotalRecords] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [metrics, setMetrics] = useState({
    total: 0,
    pending: 0,
    resolved: 0,
    urgent: 0,
  });

  useEffect(() => {
    const qParam = searchParams.get('q') || searchParams.get('reason');
    if (qParam) {
      setSearchQuery(qParam);
    }
    const prioParam = searchParams.get('priority');
    if (prioParam && ['Critical', 'High', 'Medium', 'Low'].includes(prioParam)) {
      setPriorityFilter(prioParam as any);
    }
  }, [searchParams]);

  const { selectedClientId } = useAppState();

  const fetchTickets = async (
    cid = selectedClientId,
    p = page,
    ps = pageSize,
    q = searchQuery,
    st = statusFilter,
    prio = priorityFilter,
    it = intentFilter
  ) => {
    if (!cid) return;
    setLoading(true);
    try {
      const data = await api.getTickets(cid, {
        page: p,
        page_size: ps,
        search: q.trim() || undefined,
        status: st !== 'all' ? st : undefined,
        priority: prio !== 'all' ? prio : undefined,
        intent: it !== 'all' ? it : undefined,
      });

      if (data && typeof data === 'object' && 'items' in data) {
        setTicketsList(data.items || []);
        setTotalRecords(data.total || 0);
        setTotalPages(data.total_pages || 1);
        if (data.metrics) {
          setMetrics(data.metrics);
        }
      } else if (Array.isArray(data)) {
        setTicketsList(data);
        setTotalRecords(data.length);
        setTotalPages(Math.max(1, Math.ceil(data.length / ps)));
      } else {
        setTicketsList([]);
        setTotalRecords(0);
        setTotalPages(1);
      }
    } catch (err) {
      console.error("Failed to fetch support tickets:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchTickets(selectedClientId, page, pageSize, searchQuery, statusFilter, priorityFilter, intentFilter);
    }, 250);
    return () => clearTimeout(timer);
  }, [selectedClientId, page, pageSize, searchQuery, statusFilter, priorityFilter, intentFilter]);

  const copyToClipboard = async (text: string, field: string) => {
    const ok = await safeCopyToClipboard(text);
    if (ok) {
      setCopiedField(field);
      setTimeout(() => setCopiedField(null), 2000);
    }
  };

  // Known and dynamic intents for filter dropdown
  const knownIntents = [
    'order_status',
    'ticket_status',
    'payment_status',
    'general_query',
    'ticket_created',
    'refund_request',
    'cancellation',
    'complaint',
    'general_support',
  ];
  const uniqueIntents = useMemo(() => {
    const set = new Set<string>(knownIntents);
    ticketsList.forEach(t => {
      if (t.intent) set.add(t.intent);
    });
    return Array.from(set).sort();
  }, [ticketsList]);

  // Telemetry Aggregates
  const totalCount = metrics.total;
  const pendingCount = metrics.pending;
  const resolvedCount = metrics.resolved;
  const urgentCount = metrics.urgent;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
        <div>
          <h2 className="text-2xl sm:text-3xl font-bold tracking-tight bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent flex items-center gap-2.5">
            <Ticket className="w-7 h-7 text-primary" />
            Reference Status & Ticket Records
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            Track customer ticket references, sentiment triage, escalation priority, and resolution states.
          </p>
        </div>

        <div className="flex items-center gap-3 self-start sm:self-auto">
          <button 
            onClick={() => fetchTickets(selectedClientId)} 
            className="flex items-center gap-2 px-3.5 py-2 win11-card hover:bg-black/[0.04] dark:hover:bg-white/[0.06] text-foreground rounded-xl transition-colors text-xs font-semibold cursor-pointer"
          >
            <RefreshCw className={cn("w-3.5 h-3.5", loading && "animate-spin")} />
            Sync Records
          </button>
        </div>
      </div>

      {/* KPI Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="win11-card rounded-xl p-4 sm:p-5 shadow-2xs">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-semibold uppercase tracking-wider">Total References</span>
            <Ticket className="w-4 h-4 text-primary" />
          </div>
          <h3 className="text-2xl sm:text-3xl font-bold text-foreground mt-2">{totalCount}</h3>
          <p className="text-[11px] text-muted-foreground mt-1">Logged support tickets</p>
        </div>

        <div className="win11-card rounded-xl p-4 sm:p-5 shadow-2xs">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-semibold uppercase tracking-wider">Pending Action</span>
            <Clock className="w-4 h-4 text-purple-400" />
          </div>
          <h3 className="text-2xl sm:text-3xl font-bold text-purple-400 mt-2">{pendingCount}</h3>
          <p className="text-[11px] text-muted-foreground mt-1">Ticket Generated & queued</p>
        </div>

        <div className="win11-card rounded-xl p-4 sm:p-5 shadow-2xs">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-semibold uppercase tracking-wider">Resolved / Replied</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          </div>
          <h3 className="text-2xl sm:text-3xl font-bold text-emerald-400 mt-2">{resolvedCount}</h3>
          <p className="text-[11px] text-muted-foreground mt-1">Completed & responded</p>
        </div>

        <div className="win11-card rounded-xl p-4 sm:p-5 shadow-2xs">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-semibold uppercase tracking-wider">High / Critical</span>
            <ShieldAlert className="w-4 h-4 text-rose-400" />
          </div>
          <h3 className="text-2xl sm:text-3xl font-bold text-rose-400 mt-2">{urgentCount}</h3>
          <p className="text-[11px] text-muted-foreground mt-1">Urgent escalation priority</p>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="flex flex-col md:flex-row justify-between items-stretch md:items-center gap-3">
        {/* Filter Chips */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Status Filter */}
          <div className="flex items-center gap-1 win11-card p-1 rounded-xl shadow-2xs">
            {[
              { key: 'all', label: 'All Status' },
              { key: 'Ticket_Generated', label: 'Pending' },
              { key: 'Done_Replied', label: 'Resolved' },
            ].map((f) => (
              <button
                key={f.key}
                onClick={() => {
                  setStatusFilter(f.key as any);
                  setPage(1);
                }}
                className={cn(
                  "px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer",
                  statusFilter === f.key 
                    ? "bg-primary text-primary-foreground shadow-2xs" 
                    : "text-muted-foreground hover:text-foreground hover:bg-secondary/60"
                )}
              >
                {f.label}
              </button>
            ))}
          </div>

          {/* Priority Dropdown */}
          <div className="w-36">
            <Select
              value={priorityFilter}
              onChange={(e) => {
                setPriorityFilter(e.target.value as any);
                setPage(1);
              }}
            >
              <option value="all" className="bg-card text-foreground">All Priorities</option>
              <option value="Critical" className="bg-card text-rose-500 font-semibold">Critical</option>
              <option value="High" className="bg-card text-orange-500 font-semibold">High</option>
              <option value="Medium" className="bg-card text-blue-500">Medium</option>
              <option value="Low" className="bg-card text-muted-foreground">Low</option>
            </Select>
          </div>

          {/* Intent Dropdown */}
          {uniqueIntents.length > 0 && (
            <div className="w-40">
              <Select
                value={intentFilter}
                onChange={(e) => {
                  setIntentFilter(e.target.value);
                  setPage(1);
                }}
                className="capitalize"
              >
                <option value="all" className="bg-card text-foreground">All Intents</option>
                {uniqueIntents.map(intent => (
                  <option key={intent} value={intent} className="bg-card text-foreground">
                    {intent.replace(/_/g, ' ')}
                  </option>
                ))}
              </Select>
            </div>
          )}
        </div>

        {/* Search Input */}
        <div className="min-w-[280px]">
          <Input
            icon={<Search className="w-4 h-4" />}
            placeholder="Search ticket ID, mail ID, thread, email, intent..."
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setPage(1);
            }}
          />
        </div>
      </div>

      {/* Tickets Table */}
      <div className="win11-card rounded-2xl overflow-hidden shadow-2xs relative">
        {loading && ticketsList.length > 0 && (
          <div className="absolute top-0 left-0 right-0 h-0.5 bg-primary/40 animate-pulse z-10" />
        )}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-border bg-card/60 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                <th className="py-3.5 px-5">Ticket / Mail ID</th>
                <th className="py-3.5 px-5">Thread ID</th>
                <th className="py-3.5 px-5">Customer Email</th>
                <th className="py-3.5 px-5">Subject</th>
                <th className="py-3.5 px-5 text-center">Intent</th>
                <th className="py-3.5 px-5 text-center">Priority</th>
                <th className="py-3.5 px-5 text-center">Sentiment</th>
                <th className="py-3.5 px-5 text-center">Status</th>
                <th className="py-3.5 px-5">Created At</th>
                <th className="py-3.5 px-5 text-right">Action</th>
              </tr>
            </thead>
            <tbody className={cn(
              "divide-y divide-border text-xs text-foreground/90 transition-opacity",
              loading && ticketsList.length > 0 && "opacity-50 pointer-events-none"
            )}>
              {loading && ticketsList.length === 0 ? (
                <TableSkeleton
                  rows={pageSize > 25 ? 12 : 8}
                  columns={10}
                  alignments={['left', 'left', 'left', 'left', 'center', 'center', 'center', 'center', 'left', 'right']}
                  cellTypes={['badge', 'badge', 'text', 'text', 'pill', 'pill', 'pill', 'pill', 'text', 'button']}
                  columnWidths={['w-16', 'w-24', 'w-36', 'w-48', 'w-20', 'w-16', 'w-16', 'w-20', 'w-24', 'w-16']}
                />
              ) : ticketsList.length > 0 ? (
                ticketsList.map(ticket => {
                  const customerEmail = ticket.customer_email || ticket.customerEmail || ticket.mailId;
                  const emailLogId = ticket.email_log_id || ticket.emailLogId;
                  const threadId = ticket.thread_id || ticket.threadId;

                  return (
                    <tr 
                      key={ticket.id} 
                      onClick={() => setSelectedTicket(ticket)}
                      className="hover:bg-white/5 transition-colors cursor-pointer"
                    >
                      {/* Ticket & Mail Log ID */}
                      <td className="py-3.5 px-5 whitespace-nowrap">
                        <div className="flex flex-col gap-1 items-start">
                          <ReferenceBadge id={ticket.id} type="ticket" truncateLength={0} />
                          {emailLogId ? (
                            <ReferenceBadge id={emailLogId} type="message" label="#" truncateLength={0} />
                          ) : null}
                        </div>
                      </td>

                      {/* Thread ID */}
                      <td className="py-3.5 px-5 whitespace-nowrap">
                        <ReferenceBadge id={threadId} type="thread" truncateLength={10} />
                      </td>

                      {/* Customer Email */}
                      <td className="py-3.5 px-5 font-medium text-foreground max-w-[200px] truncate" title={customerEmail}>
                        <div className="flex items-center gap-1.5">
                          <Mail className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                          <span className="truncate">{customerEmail}</span>
                        </div>
                      </td>

                      {/* Subject */}
                      <td className="py-3.5 px-5 max-w-[240px] truncate text-muted-foreground" title={ticket.subject}>
                        {ticket.subject}
                      </td>

                      {/* Intent */}
                      <td className="py-3.5 px-5 text-center whitespace-nowrap">
                        <span className="px-2 py-0.5 rounded-md font-mono text-[10px] font-semibold bg-black/[0.04] dark:bg-white/[0.06] text-foreground border border-black/[0.06] dark:border-white/[0.08]" title={ticket.intent}>
                          {ticket.intent || 'general_support'}
                        </span>
                      </td>

                      {/* Priority */}
                      <td className="py-3.5 px-5 text-center whitespace-nowrap">
                        <span className={cn(
                          "px-2.5 py-0.5 rounded-md text-[11px] font-semibold border",
                          ticket.priority === 'Critical' ? 'bg-rose-500/10 text-rose-400 border-rose-500/20' :
                          ticket.priority === 'High' ? 'bg-orange-500/10 text-orange-400 border-orange-500/20' :
                          ticket.priority === 'Medium' ? 'bg-blue-500/10 text-blue-400 border-blue-500/20' :
                          'bg-zinc-500/10 text-zinc-400 border-zinc-500/20'
                        )}>
                          {ticket.priority || 'Medium'}
                        </span>
                      </td>

                      {/* Sentiment */}
                      <td className="py-3.5 px-5 text-center whitespace-nowrap">
                        <span className={cn(
                          "inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold border",
                          ticket.sentiment === 'Angry' ? 'bg-rose-500/10 text-rose-400 border-rose-500/20' :
                          ticket.sentiment === 'Happy' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' :
                          'bg-zinc-500/10 text-zinc-400 border-zinc-500/20'
                        )}>
                          {ticket.sentiment === 'Angry' ? <Frown className="w-3 h-3 text-rose-400" /> :
                           ticket.sentiment === 'Happy' ? <Smile className="w-3 h-3 text-emerald-400" /> :
                           <Meh className="w-3 h-3 text-zinc-400" />}
                          {ticket.sentiment || 'Neutral'}
                        </span>
                      </td>

                      {/* Status */}
                      <td className="py-3.5 px-5 text-center whitespace-nowrap">
                        <StatusBadge
                          variant={ticket.status === 'Done_Replied' ? 'success' : 'purple'}
                          label={ticket.status === 'Done_Replied' ? 'Done (Replied)' : 'Generated'}
                          dot
                        />
                      </td>

                      {/* Created At */}
                      <td className="py-3.5 px-5 font-mono text-[11px] text-muted-foreground whitespace-nowrap">
                        {ticket.date_str || ticket.time || 'N/A'}
                      </td>

                      {/* Action */}
                      <td className="py-3.5 px-5 text-right whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                        <button 
                          onClick={() => setSelectedTicket(ticket)}
                          className="px-2.5 py-1 bg-zinc-100 dark:bg-white/5 hover:bg-zinc-200 dark:hover:bg-white/10 text-foreground border border-zinc-200 dark:border-white/10 rounded-lg text-xs font-semibold transition-all cursor-pointer"
                        >
                          View Details
                        </button>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={10} className="py-16 text-center">
                    <div className="flex flex-col items-center justify-center space-y-3">
                      <Inbox className="w-10 h-10 text-muted-foreground opacity-50" />
                      <h4 className="text-sm font-semibold text-foreground">No Reference Records Found</h4>
                      <p className="text-xs text-muted-foreground max-w-sm">
                        No ticket references match your active filter or search criteria.
                      </p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Standardized Pagination */}
        <Pagination
          page={page}
          pageSize={pageSize}
          totalCount={totalRecords}
          totalPages={totalPages}
          onPageChange={setPage}
          onPageSizeChange={setPageSize}
          loading={loading}
        />
      </div>

      {/* Ticket Details Side Drawer */}
      <BaseDrawer
        isOpen={Boolean(selectedTicket)}
        onClose={() => setSelectedTicket(null)}
        maxWidth="max-w-[580px]"
        icon={<Ticket className="w-5 h-5" />}
        title={
          selectedTicket ? (
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-foreground font-mono">{selectedTicket.id}</h3>
                <button
                  onClick={() => copyToClipboard(selectedTicket.id, 'id')}
                  className="text-muted-foreground hover:text-foreground transition-colors p-1 cursor-pointer"
                  title="Copy Ticket ID"
                >
                  {copiedField === 'id' ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
              </div>
              <div className="flex items-center gap-2 mt-1 flex-wrap">
                {(selectedTicket.email_log_id || selectedTicket.emailLogId) && (
                  <ReferenceBadge id={selectedTicket.email_log_id || selectedTicket.emailLogId} type="message" label="Mail #" truncateLength={0} />
                )}
                {(selectedTicket.thread_id || selectedTicket.threadId) && (
                  <ReferenceBadge id={selectedTicket.thread_id || selectedTicket.threadId} type="thread" truncateLength={12} />
                )}
              </div>
            </div>
          ) : undefined
        }
      >
        {selectedTicket && (
          <div className="flex-1 overflow-y-auto p-5 space-y-5">
                {/* Meta Grid - 4 Columns */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="bg-secondary/40 border border-border rounded-xl p-3 shadow-2xs">
                    <span className="text-[10px] uppercase font-bold text-muted-foreground">Status</span>
                    <div className="mt-1">
                      <StatusBadge
                        variant={selectedTicket.status === 'Done_Replied' ? 'success' : 'purple'}
                        label={selectedTicket.status === 'Done_Replied' ? 'Done (Replied)' : 'Generated'}
                        dot
                      />
                    </div>
                  </div>

                  <div className="bg-secondary/40 border border-border rounded-xl p-3 shadow-2xs">
                    <span className="text-[10px] uppercase font-bold text-muted-foreground">Priority</span>
                    <div className="mt-1">
                      <span className={cn(
                        "px-2 py-0.5 rounded text-[10px] font-bold border",
                        selectedTicket.priority === 'Critical' ? 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20' :
                        selectedTicket.priority === 'High' ? 'bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-500/20' :
                        selectedTicket.priority === 'Medium' ? 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20' : 
                        'bg-zinc-500/10 text-zinc-600 dark:text-zinc-400 border-zinc-500/20'
                      )}>
                        {selectedTicket.priority || 'Medium'}
                      </span>
                    </div>
                  </div>

                  <div className="bg-zinc-50 dark:bg-white/5 border border-zinc-200 dark:border-white/10 rounded-xl p-3 shadow-2xs">
                    <span className="text-[10px] uppercase font-bold text-muted-foreground">Sentiment</span>
                    <div className="mt-1 text-xs font-semibold text-foreground">
                      {selectedTicket.sentiment || 'Neutral'}
                    </div>
                  </div>

                  <div className="bg-zinc-50 dark:bg-white/5 border border-zinc-200 dark:border-white/10 rounded-xl p-3 shadow-2xs">
                    <span className="text-[10px] uppercase font-bold text-muted-foreground">Intent</span>
                    <div className="mt-1">
                      <span className="px-1.5 py-0.5 rounded font-mono text-[10px] font-semibold bg-black/[0.04] dark:bg-white/[0.06] text-foreground border border-black/[0.06] dark:border-white/[0.08] block truncate" title={selectedTicket.intent}>
                        {selectedTicket.intent || 'general_support'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Customer Mail Details */}
                <div className="bg-zinc-50 dark:bg-white/5 border border-zinc-200 dark:border-white/10 rounded-xl p-4 space-y-3 shadow-2xs">
                  <div>
                    <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block mb-1">Subject</span>
                    <p className="text-sm font-semibold text-foreground">{selectedTicket.subject}</p>
                  </div>
                  <div>
                    <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block mb-1">Customer Email</span>
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-mono font-medium text-foreground">
                        {selectedTicket.customer_email || selectedTicket.customerEmail || selectedTicket.mailId}
                      </p>
                      <button
                        onClick={() => copyToClipboard(selectedTicket.customer_email || selectedTicket.customerEmail || selectedTicket.mailId, 'email')}
                        className="text-muted-foreground hover:text-foreground transition-colors p-1 cursor-pointer"
                        title="Copy Customer Email"
                      >
                        {copiedField === 'email' ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </div>

                  {/* Thread & Log Identifiers */}
                  <div className="grid grid-cols-2 gap-3 pt-2 border-t border-zinc-200 dark:border-white/10">
                    <div>
                      <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block mb-1">Thread ID</span>
                      <ReferenceBadge 
                        id={selectedTicket.thread_id || selectedTicket.threadId} 
                        type="thread" 
                        truncateLength={0} 
                      />
                    </div>
                    <div>
                      <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block mb-1">Mail Log ID</span>
                      <ReferenceBadge 
                        id={selectedTicket.email_log_id || selectedTicket.emailLogId} 
                        type="message" 
                        label="#" 
                        truncateLength={0} 
                      />
                    </div>
                  </div>

                  {/* RFC Message ID */}
                  {selectedTicket.mailId && (
                    <div className="pt-2 border-t border-zinc-200 dark:border-white/10">
                      <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block mb-1">RFC Message-ID</span>
                      <p className="text-[11px] font-mono text-muted-foreground truncate select-all" title={selectedTicket.mailId}>
                        {selectedTicket.mailId}
                      </p>
                    </div>
                  )}

                  <div>
                    <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block mb-1">Logged Timestamp</span>
                    <p className="text-xs text-muted-foreground">{selectedTicket.date_str || selectedTicket.time}</p>
                  </div>
                </div>

                {/* Issue Body */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">Extracted Problem Description</span>
                    <button
                      onClick={() => copyToClipboard(selectedTicket.preview || '', 'body')}
                      className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                    >
                      {copiedField === 'body' ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
                      {copiedField === 'body' ? 'Copied' : 'Copy Text'}
                    </button>
                  </div>
                  <div className="bg-zinc-50 dark:bg-black/50 border border-zinc-200 dark:border-white/10 rounded-xl p-4 text-xs text-zinc-800 dark:text-zinc-200 font-mono leading-relaxed max-h-[300px] overflow-y-auto shadow-2xs">
                    <EmailBodyWithDisclaimer content={selectedTicket.preview || 'No problem body recorded.'} />
                  </div>
                </div>

              </div>
        )}
      </BaseDrawer>
    </div>
  );
}
