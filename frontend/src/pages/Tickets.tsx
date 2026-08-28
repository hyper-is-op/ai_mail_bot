import { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Search, 
  Loader2, 
  Inbox, 
  Ticket, 
  CheckCircle2, 
  Clock, 
  RefreshCw, 
  Copy, 
  Check, 
  X, 
  ShieldAlert,
  Smile,
  Meh,
  Frown
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { api } from '@/lib/api';
import EmailBodyWithDisclaimer from '@/components/EmailBodyWithDisclaimer';

export default function Tickets() {
  const [ticketsList, setTicketsList] = useState<any[]>([]);
  const [selectedTicket, setSelectedTicket] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'Ticket_Generated' | 'Done_Replied'>('all');
  const [priorityFilter, setPriorityFilter] = useState<'all' | 'Critical' | 'High' | 'Medium' | 'Low'>('all');
  const [copiedField, setCopiedField] = useState<string | null>(null);

  const user = JSON.parse(localStorage.getItem('user') || '{}');
  const [selectedClientId, setSelectedClientId] = useState(user?.role === 'admin' ? 'ALL' : (user?.client_id || ''));
  const [clients, setClients] = useState<any[]>([]);

  useEffect(() => {
    if (user?.role === 'admin') {
      api.getAllEmailAccounts()
        .then((data) => setClients(data || []))
        .catch((err) => console.error("Failed to fetch clients for admin tickets:", err));
    }
  }, []);

  useEffect(() => {
    if (selectedClientId) {
      fetchTickets(selectedClientId);
    }
  }, [selectedClientId]);

  const fetchTickets = async (cid = selectedClientId) => {
    if (!cid) return;
    setLoading(true);
    try {
      const data = await api.getTickets(cid);
      setTicketsList(data || []);
    } catch (err) {
      console.error("Failed to fetch support tickets:", err);
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = (text: string, field: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 2000);
  };

  // Filter & Search Logic
  const filteredTickets = useMemo(() => {
    return ticketsList.filter(ticket => {
      // Status filter
      if (statusFilter !== 'all' && ticket.status !== statusFilter) return false;
      // Priority filter
      if (priorityFilter !== 'all' && ticket.priority !== priorityFilter) return false;

      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchId = (ticket.id || '').toLowerCase().includes(q);
        const matchSubject = (ticket.subject || '').toLowerCase().includes(q);
        const matchMail = (ticket.mailId || '').toLowerCase().includes(q);
        const matchBody = (ticket.preview || '').toLowerCase().includes(q);
        if (!matchId && !matchSubject && !matchMail && !matchBody) return false;
      }
      return true;
    });
  }, [ticketsList, statusFilter, priorityFilter, searchQuery]);

  // Telemetry Aggregates
  const totalCount = ticketsList.length;
  const pendingCount = ticketsList.filter(t => t.status === 'Ticket_Generated').length;
  const resolvedCount = ticketsList.filter(t => t.status === 'Done_Replied').length;
  const urgentCount = ticketsList.filter(t => t.priority === 'Critical' || t.priority === 'High').length;

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
          {user?.role === 'admin' && clients.length > 0 && (
            <div className="flex items-center gap-2 bg-white/5 border border-white/10 rounded-xl px-3 py-1.5">
              <span className="text-xs text-muted-foreground font-medium">Client:</span>
              <select
                value={selectedClientId}
                onChange={(e) => setSelectedClientId(e.target.value)}
                className="bg-transparent text-xs text-foreground focus:outline-none cursor-pointer"
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
            onClick={() => fetchTickets(selectedClientId)} 
            className="flex items-center gap-2 px-3.5 py-2 bg-white/5 hover:bg-white/10 text-foreground rounded-xl border border-white/10 transition-colors text-xs font-semibold"
          >
            <RefreshCw className={cn("w-3.5 h-3.5", loading && "animate-spin")} />
            Sync Records
          </button>
        </div>
      </div>

      {/* KPI Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white/5 border border-white/10 rounded-2xl p-4 sm:p-5">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-semibold uppercase tracking-wider">Total References</span>
            <Ticket className="w-4 h-4 text-primary" />
          </div>
          <h3 className="text-2xl sm:text-3xl font-black text-foreground mt-2">{totalCount}</h3>
          <p className="text-[11px] text-muted-foreground mt-1">Logged support tickets</p>
        </div>

        <div className="bg-white/5 border border-white/10 rounded-2xl p-4 sm:p-5">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-semibold uppercase tracking-wider">Pending Action</span>
            <Clock className="w-4 h-4 text-purple-400" />
          </div>
          <h3 className="text-2xl sm:text-3xl font-black text-purple-400 mt-2">{pendingCount}</h3>
          <p className="text-[11px] text-muted-foreground mt-1">Ticket Generated & queued</p>
        </div>

        <div className="bg-white/5 border border-white/10 rounded-2xl p-4 sm:p-5">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-semibold uppercase tracking-wider">Resolved / Replied</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          </div>
          <h3 className="text-2xl sm:text-3xl font-black text-emerald-400 mt-2">{resolvedCount}</h3>
          <p className="text-[11px] text-muted-foreground mt-1">Completed & responded</p>
        </div>

        <div className="bg-white/5 border border-white/10 rounded-2xl p-4 sm:p-5">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-semibold uppercase tracking-wider">High / Critical</span>
            <ShieldAlert className="w-4 h-4 text-rose-400" />
          </div>
          <h3 className="text-2xl sm:text-3xl font-black text-rose-400 mt-2">{urgentCount}</h3>
          <p className="text-[11px] text-muted-foreground mt-1">Urgent escalation priority</p>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="flex flex-col md:flex-row justify-between items-stretch md:items-center gap-3">
        {/* Filter Chips */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Status Filter */}
          <div className="flex items-center gap-1 bg-white/5 p-1 rounded-xl border border-white/10">
            {[
              { key: 'all', label: 'All Status' },
              { key: 'Ticket_Generated', label: 'Pending' },
              { key: 'Done_Replied', label: 'Resolved' },
            ].map((f) => (
              <button
                key={f.key}
                onClick={() => setStatusFilter(f.key as any)}
                className={cn(
                  "px-3 py-1.5 rounded-lg text-xs font-semibold transition-all",
                  statusFilter === f.key 
                    ? "bg-primary text-primary-foreground shadow-sm" 
                    : "text-muted-foreground hover:text-foreground hover:bg-white/5"
                )}
              >
                {f.label}
              </button>
            ))}
          </div>

          {/* Priority Dropdown */}
          <select
            value={priorityFilter}
            onChange={(e) => setPriorityFilter(e.target.value as any)}
            className="bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer"
          >
            <option value="all" className="bg-zinc-900 text-foreground">All Priorities</option>
            <option value="Critical" className="bg-zinc-900 text-rose-400 font-semibold">Critical</option>
            <option value="High" className="bg-zinc-900 text-orange-400 font-semibold">High</option>
            <option value="Medium" className="bg-zinc-900 text-blue-400">Medium</option>
            <option value="Low" className="bg-zinc-900 text-zinc-400">Low</option>
          </select>
        </div>

        {/* Search Input */}
        <div className="relative min-w-[280px]">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search reference ID, email, subject..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-white/5 border border-white/10 rounded-xl pl-9 pr-3 py-2 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>
      </div>

      {/* Tickets Table */}
      <div className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden">
        {loading ? (
          <div className="py-20 flex flex-col items-center justify-center space-y-3">
            <Loader2 className="w-8 h-8 text-primary animate-spin" />
            <p className="text-xs text-muted-foreground font-medium">Loading reference statuses...</p>
          </div>
        ) : filteredTickets.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-white/10 bg-white/5 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                  <th className="py-3.5 px-5">Reference ID</th>
                  <th className="py-3.5 px-5">Customer / Mail</th>
                  <th className="py-3.5 px-5">Subject</th>
                  <th className="py-3.5 px-5 text-center">Priority</th>
                  <th className="py-3.5 px-5 text-center">Sentiment</th>
                  <th className="py-3.5 px-5 text-center">Status</th>
                  <th className="py-3.5 px-5">Created At</th>
                  <th className="py-3.5 px-5 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5 text-xs text-zinc-300">
                {filteredTickets.map(ticket => (
                  <tr 
                    key={ticket.id} 
                    onClick={() => setSelectedTicket(ticket)}
                    className="hover:bg-white/5 transition-colors cursor-pointer"
                  >
                    <td className="py-3.5 px-5 font-mono font-bold text-primary whitespace-nowrap">
                      {ticket.id}
                    </td>
                    <td className="py-3.5 px-5 font-medium text-foreground max-w-[180px] truncate">
                      {ticket.mailId}
                    </td>
                    <td className="py-3.5 px-5 max-w-[260px] truncate text-muted-foreground">
                      {ticket.subject}
                    </td>
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
                    <td className="py-3.5 px-5 text-center whitespace-nowrap">
                      <span className={cn(
                        "inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold",
                        ticket.status === 'Done_Replied' ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" :
                        "bg-purple-500/10 text-purple-400 border border-purple-500/20"
                      )}>
                        <span className={cn(
                          "w-1.5 h-1.5 rounded-full",
                          ticket.status === 'Done_Replied' ? "bg-emerald-400" : "bg-purple-400"
                        )} />
                        {ticket.status === 'Done_Replied' ? "Done (Replied)" : "Generated"}
                      </span>
                    </td>
                    <td className="py-3.5 px-5 font-mono text-[11px] text-muted-foreground whitespace-nowrap">
                      {ticket.date_str || ticket.time || 'N/A'}
                    </td>
                    <td className="py-3.5 px-5 text-right whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                      <button 
                        onClick={() => setSelectedTicket(ticket)}
                        className="px-2.5 py-1 bg-white/5 hover:bg-white/10 text-foreground border border-white/10 rounded-lg text-xs font-semibold transition-all"
                      >
                        View Details
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="py-16 flex flex-col items-center justify-center text-center space-y-3">
            <Inbox className="w-10 h-10 text-muted-foreground opacity-50" />
            <h4 className="text-sm font-semibold text-foreground">No Reference Records Found</h4>
            <p className="text-xs text-muted-foreground max-w-sm">
              No ticket references match your active filter or search criteria.
            </p>
          </div>
        )}

        {/* Footer Summary */}
        <div className="p-4 border-t border-white/10 flex justify-between items-center text-xs text-muted-foreground bg-white/5">
          <span>Showing {filteredTickets.length} of {ticketsList.length} records</span>
          <span className="font-mono text-[11px]">Database table: ticket_record</span>
        </div>
      </div>

      {/* Ticket Details Side Drawer */}
      <AnimatePresence>
        {selectedTicket && (
          <>
            {/* Backdrop */}
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.6 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedTicket(null)}
              className="fixed inset-0 bg-black/60 dark:bg-black/80 z-40"
            />

            {/* Side Drawer */}
            <motion.div
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "spring", damping: 26, stiffness: 220 }}
              className="fixed right-0 top-0 bottom-0 w-full max-w-[560px] bg-white dark:bg-zinc-950 border-l border-zinc-200 dark:border-white/10 shadow-2xl z-50 flex flex-col overflow-hidden"
            >
              {/* Drawer Header */}
              <div className="p-5 border-b border-zinc-200 dark:border-white/10 bg-zinc-50 dark:bg-white/5 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-primary/10 text-primary rounded-xl border border-primary/20">
                    <Ticket className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-base font-bold text-foreground font-mono">{selectedTicket.id}</h3>
                      <button
                        onClick={() => copyToClipboard(selectedTicket.id, 'id')}
                        className="text-muted-foreground hover:text-foreground transition-colors p-1"
                        title="Copy Reference ID"
                      >
                        {copiedField === 'id' ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                    <p className="text-xs text-muted-foreground truncate max-w-[340px]">{selectedTicket.mailId}</p>
                  </div>
                </div>
                <button 
                  onClick={() => setSelectedTicket(null)}
                  className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-white/10 rounded-lg transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Drawer Body */}
              <div className="flex-1 overflow-y-auto p-5 space-y-5">
                {/* Meta Grid */}
                <div className="grid grid-cols-3 gap-3">
                  <div className="bg-white/5 border border-white/10 rounded-xl p-3.5">
                    <span className="text-[10px] uppercase font-bold text-muted-foreground">Status</span>
                    <div className="mt-1">
                      <span className={cn(
                        "inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold",
                        selectedTicket.status === 'Done_Replied' ? "bg-emerald-500/10 text-emerald-400" : "bg-purple-500/10 text-purple-400"
                      )}>
                        {selectedTicket.status === 'Done_Replied' ? "Done (Replied)" : "Generated"}
                      </span>
                    </div>
                  </div>

                  <div className="bg-white/5 border border-white/10 rounded-xl p-3.5">
                    <span className="text-[10px] uppercase font-bold text-muted-foreground">Priority</span>
                    <div className="mt-1">
                      <span className={cn(
                        "px-2 py-0.5 rounded text-[10px] font-bold",
                        selectedTicket.priority === 'Critical' ? 'text-rose-400' :
                        selectedTicket.priority === 'High' ? 'text-orange-400' :
                        selectedTicket.priority === 'Medium' ? 'text-blue-400' : 'text-zinc-400'
                      )}>
                        {selectedTicket.priority || 'Medium'}
                      </span>
                    </div>
                  </div>

                  <div className="bg-white/5 border border-white/10 rounded-xl p-3.5">
                    <span className="text-[10px] uppercase font-bold text-muted-foreground">Sentiment</span>
                    <div className="mt-1 text-xs font-semibold text-foreground">
                      {selectedTicket.sentiment || 'Neutral'}
                    </div>
                  </div>
                </div>

                {/* Customer Mail Details */}
                <div className="bg-white/5 border border-white/10 rounded-xl p-4 space-y-3">
                  <div>
                    <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block mb-1">Subject</span>
                    <p className="text-sm font-semibold text-foreground">{selectedTicket.subject}</p>
                  </div>
                  <div>
                    <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block mb-1">Customer Email</span>
                    <p className="text-xs font-mono text-zinc-300">{selectedTicket.mailId}</p>
                  </div>
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
                      className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground transition-colors"
                    >
                      {copiedField === 'body' ? <Check className="w-3 h-3 text-green-400" /> : <Copy className="w-3 h-3" />}
                      {copiedField === 'body' ? 'Copied' : 'Copy Text'}
                    </button>
                  </div>
                  <div className="bg-black/50 border border-white/10 rounded-xl p-4 text-xs text-zinc-300 font-mono leading-relaxed max-h-[300px] overflow-y-auto">
                    <EmailBodyWithDisclaimer content={selectedTicket.preview || 'No problem body recorded.'} />
                  </div>
                </div>

              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
