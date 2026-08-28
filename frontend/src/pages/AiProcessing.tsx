import { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Loader2, 
  Terminal, 
  Database, 
  Cpu, 
  CheckCircle2, 
  RefreshCw, 
  Eye, 
  ArrowRight,
  Sparkles,
  Award,
  Search,
  Copy,
  Check,
  X,
  Send,
  Ticket,
  Mail,
  Smile,
  Meh,
  Frown
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { api } from '@/lib/api';
import EmailBodyWithDisclaimer from '@/components/EmailBodyWithDisclaimer';

export default function AiProcessing() {
  const [logs, setLogs] = useState<any[]>([]);
  const [selectedLog, setSelectedLog] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState<'all' | 'sent' | 'ticket' | 'failed'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [drawerTab, setDrawerTab] = useState<'pipeline' | 'payload' | 'json'>('pipeline');
  
  const user = JSON.parse(localStorage.getItem('user') || '{}');
  const [selectedClientId, setSelectedClientId] = useState(user?.role === 'admin' ? 'ALL' : (user?.client_id || ''));
  const [clients, setClients] = useState<any[]>([]);

  useEffect(() => {
    if (user?.role === 'admin') {
      api.getAllEmailAccounts()
        .then((data) => setClients(data || []))
        .catch((err) => console.error("Failed to fetch clients for admin AI processing:", err));
    }
  }, []);

  useEffect(() => {
    if (selectedClientId) {
      fetchLogs(selectedClientId);
    }
  }, [selectedClientId]);

  const fetchLogs = async (cid = selectedClientId) => {
    if (!cid) return;
    setLoading(true);
    try {
      const data = await api.getEmails(cid);
      setLogs(data || []);
    } catch (err) {
      console.error("Failed to fetch AI processing logs:", err);
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  // Filter & Search Logic
  const filteredLogs = useMemo(() => {
    return logs.filter(log => {
      // Filter tab
      if (activeFilter === 'sent' && log.raw_status !== 'sent') return false;
      if (activeFilter === 'ticket' && log.raw_status !== 'ticket_created_and_sent') return false;
      if (activeFilter === 'failed' && !(log.raw_status && log.raw_status.includes('failed'))) return false;

      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchSender = (log.sender || '').toLowerCase().includes(q);
        const matchSubject = (log.subject || '').toLowerCase().includes(q);
        const matchCategory = (log.category || '').toLowerCase().includes(q);
        const matchPreview = (log.preview || '').toLowerCase().includes(q);
        if (!matchSender && !matchSubject && !matchCategory && !matchPreview) return false;
      }
      return true;
    });
  }, [logs, activeFilter, searchQuery]);

  // Aggregated Telemetry
  const totalLogs = logs.length;
  const autoRepliedCount = logs.filter(l => l.raw_status === 'sent').length;
  const ticketedCount = logs.filter(l => l.raw_status === 'ticket_created_and_sent').length;
  const avgScore = totalLogs > 0 
    ? Math.round(logs.reduce((acc, curr) => acc + (curr.score || 0), 0) / totalLogs) 
    : 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
        <div>
          <h2 className="text-2xl sm:text-3xl font-bold tracking-tight bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent flex items-center gap-2.5">
            <Cpu className="w-7 h-7 text-primary" />
            AI Processing & Pipeline Traces
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            Real-time trace logs, intent classifications, score distributions, and execution breakdowns.
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
            onClick={() => fetchLogs(selectedClientId)} 
            className="flex items-center gap-2 px-3.5 py-2 bg-white/5 hover:bg-white/10 text-foreground rounded-xl border border-white/10 transition-colors text-xs font-semibold"
          >
            <RefreshCw className={cn("w-3.5 h-3.5", loading && "animate-spin")} />
            Sync Logs
          </button>
        </div>
      </div>

      {/* KPI Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white/5 border border-white/10 rounded-2xl p-4 sm:p-5">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-semibold uppercase tracking-wider">Total Traces</span>
            <Mail className="w-4 h-4 text-primary" />
          </div>
          <h3 className="text-2xl sm:text-3xl font-black text-foreground mt-2">{totalLogs}</h3>
          <p className="text-[11px] text-muted-foreground mt-1">Processed email requests</p>
        </div>

        <div className="bg-white/5 border border-white/10 rounded-2xl p-4 sm:p-5">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-semibold uppercase tracking-wider">Avg Quality Score</span>
            <Award className="w-4 h-4 text-emerald-400" />
          </div>
          <h3 className="text-2xl sm:text-3xl font-black text-emerald-400 mt-2">{avgScore}%</h3>
          <p className="text-[11px] text-muted-foreground mt-1">Confidence rating average</p>
        </div>

        <div className="bg-white/5 border border-white/10 rounded-2xl p-4 sm:p-5">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-semibold uppercase tracking-wider">Auto-Sent</span>
            <Send className="w-4 h-4 text-blue-400" />
          </div>
          <h3 className="text-2xl sm:text-3xl font-black text-blue-400 mt-2">{autoRepliedCount}</h3>
          <p className="text-[11px] text-muted-foreground mt-1">Dispatched above threshold</p>
        </div>

        <div className="bg-white/5 border border-white/10 rounded-2xl p-4 sm:p-5">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-semibold uppercase tracking-wider">Triaged Tickets</span>
            <Ticket className="w-4 h-4 text-purple-400" />
          </div>
          <h3 className="text-2xl sm:text-3xl font-black text-purple-400 mt-2">{ticketedCount}</h3>
          <p className="text-[11px] text-muted-foreground mt-1">Escalated to ticket system</p>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-3">
        <div className="flex items-center gap-1 bg-white/5 p-1 rounded-xl border border-white/10">
          {[
            { key: 'all', label: 'All' },
            { key: 'sent', label: 'Auto-Replied' },
            { key: 'ticket', label: 'Escalated' },
            { key: 'failed', label: 'Failed' },
          ].map((f) => (
            <button
              key={f.key}
              onClick={() => setActiveFilter(f.key as any)}
              className={cn(
                "px-3 py-1.5 rounded-lg text-xs font-semibold transition-all",
                activeFilter === f.key 
                  ? "bg-primary text-primary-foreground shadow-sm" 
                  : "text-muted-foreground hover:text-foreground hover:bg-white/5"
              )}
            >
              {f.label}
            </button>
          ))}
        </div>

        <div className="relative min-w-[260px]">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search sender, subject, intent..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-white/5 border border-white/10 rounded-xl pl-9 pr-3 py-1.5 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>
      </div>

      {/* Logs Table */}
      <div className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden">
        {loading ? (
          <div className="py-20 flex flex-col items-center justify-center space-y-3">
            <Loader2 className="w-8 h-8 text-primary animate-spin" />
            <p className="text-xs text-muted-foreground font-medium">Loading AI processing traces...</p>
          </div>
        ) : filteredLogs.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-white/10 bg-white/5 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                  <th className="py-3.5 px-5">Timestamp</th>
                  <th className="py-3.5 px-5">Sender</th>
                  <th className="py-3.5 px-5">Subject / Query</th>
                  <th className="py-3.5 px-5 text-center">Sentiment</th>
                  <th className="py-3.5 px-5 text-center">Score</th>
                  <th className="py-3.5 px-5 text-center">Status</th>
                  <th className="py-3.5 px-5 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5 text-xs text-zinc-300">
                {filteredLogs.map(log => (
                  <tr key={log.id} className="hover:bg-white/5 transition-colors">
                    <td className="py-3.5 px-5 font-mono text-[11px] text-muted-foreground whitespace-nowrap">
                      {log.date_str || ''} {log.time || ''}
                    </td>
                    <td className="py-3.5 px-5 font-medium text-foreground max-w-[180px] truncate">
                      {log.sender}
                    </td>
                    <td className="py-3.5 px-5 max-w-[260px] truncate text-muted-foreground">
                      {log.subject}
                    </td>
                    <td className="py-3.5 px-5 text-center whitespace-nowrap">
                      <span className={cn(
                        "inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold border",
                        log.sentiment === 'Angry' ? 'bg-rose-500/10 text-rose-400 border-rose-500/20' :
                        log.sentiment === 'Happy' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' :
                        'bg-zinc-500/10 text-zinc-400 border-zinc-500/20'
                      )}>
                        {log.sentiment === 'Angry' ? <Frown className="w-3 h-3 text-rose-400" /> :
                         log.sentiment === 'Happy' ? <Smile className="w-3 h-3 text-emerald-400" /> :
                         <Meh className="w-3 h-3 text-zinc-400" />}
                        {log.sentiment || 'Neutral'}
                      </span>
                    </td>
                    <td className="py-3.5 px-5 text-center whitespace-nowrap">
                      <span className={cn(
                        "px-2 py-0.5 rounded-full text-[11px] font-bold",
                        (log.score || 0) >= 80 ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" :
                        (log.score || 0) >= 50 ? "bg-amber-500/10 text-amber-400 border border-amber-500/20" :
                        "bg-rose-500/10 text-rose-400 border border-rose-500/20"
                      )}>
                        {log.score || 0}%
                      </span>
                    </td>
                    <td className="py-3.5 px-5 text-center whitespace-nowrap">
                      <span className={cn(
                        "inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold",
                        log.raw_status === 'sent' ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" :
                        log.raw_status === 'ticket_created_and_sent' ? "bg-purple-500/10 text-purple-400 border border-purple-500/20" :
                        "bg-rose-500/10 text-rose-400 border border-rose-500/20"
                      )}>
                        <span className={cn(
                          "w-1.5 h-1.5 rounded-full",
                          log.raw_status === 'sent' ? "bg-emerald-400" :
                          log.raw_status === 'ticket_created_and_sent' ? "bg-purple-400" :
                          "bg-rose-400"
                        )} />
                        {log.raw_status === 'sent' ? "Auto-Sent" :
                         log.raw_status === 'ticket_created_and_sent' ? "Ticket Triaged" : 
                         "Failed"}
                      </span>
                    </td>
                    <td className="py-3.5 px-5 text-right whitespace-nowrap">
                      <button 
                        onClick={() => {
                          setSelectedLog(log);
                          setDrawerTab('pipeline');
                        }}
                        className="inline-flex items-center gap-1 px-2.5 py-1 bg-primary/10 hover:bg-primary/20 text-primary border border-primary/20 hover:border-primary/40 rounded-lg text-xs font-semibold transition-all"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        Inspect
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="py-16 flex flex-col items-center justify-center text-center space-y-3">
            <Terminal className="w-10 h-10 text-muted-foreground opacity-50" />
            <h4 className="text-sm font-semibold text-foreground">No Traces Found</h4>
            <p className="text-xs text-muted-foreground max-w-sm">
              No AI execution traces match your search or filter criteria.
            </p>
          </div>
        )}
      </div>

      {/* Trace Inspection Side Drawer */}
      <AnimatePresence>
        {selectedLog && (
          <>
            {/* Backdrop */}
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.6 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedLog(null)}
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
                    <Cpu className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-foreground">Execution Trace #{selectedLog.id}</h3>
                    <p className="text-xs text-muted-foreground truncate max-w-[340px]">{selectedLog.sender}</p>
                  </div>
                </div>
                <button 
                  onClick={() => setSelectedLog(null)}
                  className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-white/10 rounded-lg transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Drawer Tabs */}
              <div className="flex border-b border-white/10 px-5 bg-black/30">
                {[
                  { id: 'pipeline', label: 'Pipeline Steps' },
                  { id: 'payload', label: 'Input & Reply' },
                  { id: 'json', label: 'Raw Log' },
                ].map(t => (
                  <button
                    key={t.id}
                    onClick={() => setDrawerTab(t.id as any)}
                    className={cn(
                      "px-4 py-3 text-xs font-semibold border-b-2 transition-all",
                      drawerTab === t.id
                        ? "border-primary text-foreground"
                        : "border-transparent text-muted-foreground hover:text-foreground"
                    )}
                  >
                    {t.label}
                  </button>
                ))}
              </div>

              {/* Drawer Body */}
              <div className="flex-1 overflow-y-auto p-5 space-y-5">
                
                {/* 1. PIPELINE TAB */}
                {drawerTab === 'pipeline' && (
                  <div className="space-y-5">
                    {/* Summary Card */}
                    <div className="grid grid-cols-2 gap-3">
                      <div className="bg-white/5 border border-white/10 rounded-xl p-3.5">
                        <span className="text-[10px] uppercase font-bold text-muted-foreground">Customer Sentiment</span>
                        <div className="mt-1 flex items-center gap-1.5 text-xs font-semibold text-foreground">
                          {selectedLog.sentiment === 'Angry' ? <Frown className="w-3.5 h-3.5 text-rose-400" /> :
                           selectedLog.sentiment === 'Happy' ? <Smile className="w-3.5 h-3.5 text-emerald-400" /> :
                           <Meh className="w-3.5 h-3.5 text-zinc-400" />}
                          {selectedLog.sentiment || 'Neutral'}
                        </div>
                      </div>
                      <div className="bg-white/5 border border-white/10 rounded-xl p-3.5">
                        <span className="text-[10px] uppercase font-bold text-muted-foreground">Confidence Score</span>
                        <div className="text-sm font-bold text-primary mt-0.5">{selectedLog.score || 0}%</div>
                      </div>
                    </div>

                    {/* Step-by-Step Flow */}
                    <div className="relative border-l-2 border-white/10 ml-3 pl-5 space-y-6">
                      
                      {/* Step 1: Ingestion */}
                      <div className="relative">
                        <div className="absolute -left-[27px] top-0.5 w-3.5 h-3.5 rounded-full bg-emerald-500 border-2 border-zinc-950" />
                        <h5 className="text-xs font-bold text-foreground flex items-center gap-1.5">
                          1. Email Ingestion & Header Parsing
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                        </h5>
                        <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                          Parsed email payload from <span className="text-zinc-200">{selectedLog.sender}</span>. Subject: <span className="text-zinc-200">"{selectedLog.subject}"</span>.
                        </p>
                      </div>

                      {/* Step 2: Knowledge Base Check */}
                      <div className="relative">
                        <div className="absolute -left-[27px] top-0.5 w-3.5 h-3.5 rounded-full bg-emerald-500 border-2 border-zinc-950" />
                        <h5 className="text-xs font-bold text-foreground flex items-center gap-1.5">
                          2. Knowledge Base Retrieval
                          <Database className="w-3.5 h-3.5 text-emerald-400" />
                        </h5>
                        <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                          Queried vector store with semantic embeddings. Relevant documents and business policies retrieved.
                        </p>
                      </div>

                      {/* Step 3: LLM Generation */}
                      <div className="relative">
                        <div className="absolute -left-[27px] top-0.5 w-3.5 h-3.5 rounded-full bg-emerald-500 border-2 border-zinc-950" />
                        <h5 className="text-xs font-bold text-foreground flex items-center gap-1.5">
                          3. Model Synthesis & Persona Framing
                          <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
                        </h5>
                        <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                          Generated response adhering to configured tone guidelines and department persona.
                        </p>
                      </div>

                      {/* Step 4: Quality & Confidence Guard */}
                      <div className="relative">
                        <div className="absolute -left-[27px] top-0.5 w-3.5 h-3.5 rounded-full bg-emerald-500 border-2 border-zinc-950" />
                        <h5 className="text-xs font-bold text-foreground flex items-center gap-1.5">
                          4. Self-Evaluation Guard
                          <Award className="w-3.5 h-3.5 text-emerald-400" />
                        </h5>
                        <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                          Confidence evaluation output: <span className="font-bold text-primary">{selectedLog.score || 0}%</span>. Target threshold for auto-dispatch is 80%.
                        </p>
                      </div>

                      {/* Step 5: Routing Decision */}
                      <div className="relative">
                        <div className={cn(
                          "absolute -left-[27px] top-0.5 w-3.5 h-3.5 rounded-full border-2 border-zinc-950",
                          selectedLog.raw_status === 'sent' ? "bg-emerald-500" : "bg-purple-500"
                        )} />
                        <h5 className="text-xs font-bold text-foreground flex items-center gap-1.5">
                          5. Routing & Dispatch
                          <ArrowRight className="w-3.5 h-3.5 text-primary" />
                        </h5>
                        <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                          {selectedLog.raw_status === 'sent' ? (
                            <span className="text-emerald-400 font-medium">
                              Quality score met auto-send threshold (≥ 80%). Resolution email dispatched to customer via SMTP.
                            </span>
                          ) : (
                            <span className="text-purple-400 font-medium">
                              Quality score falls below threshold (&lt; 80%). Created ticket reference in database and sent acknowledgment update to customer.
                            </span>
                          )}
                        </p>
                      </div>

                    </div>
                  </div>
                )}

                {/* 2. PAYLOAD TAB */}
                {drawerTab === 'payload' && (
                  <div className="space-y-4">
                    {/* Customer Query */}
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">Customer Input</span>
                        <button
                          onClick={() => copyToClipboard(selectedLog.preview || '', 'input')}
                          className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground transition-colors"
                        >
                          {copiedId === 'input' ? <Check className="w-3 h-3 text-green-400" /> : <Copy className="w-3 h-3" />}
                          {copiedId === 'input' ? 'Copied' : 'Copy'}
                        </button>
                      </div>
                      <div className="bg-black/50 border border-white/10 rounded-xl p-3.5 text-xs text-zinc-300 font-mono leading-relaxed max-h-[300px] overflow-y-auto">
                        <EmailBodyWithDisclaimer content={selectedLog.preview || 'No input content.'} />
                      </div>
                    </div>

                    {/* AI Reply */}
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">AI Generated Response</span>
                        {selectedLog.reply && (
                          <button
                            onClick={() => copyToClipboard(selectedLog.reply, 'reply')}
                            className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground transition-colors"
                          >
                            {copiedId === 'reply' ? <Check className="w-3 h-3 text-green-400" /> : <Copy className="w-3 h-3" />}
                            {copiedId === 'reply' ? 'Copied' : 'Copy'}
                          </button>
                        )}
                      </div>
                      <div className="bg-black/50 border border-white/10 rounded-xl p-3.5 text-xs text-zinc-300 font-mono whitespace-pre-wrap leading-relaxed max-h-[280px] overflow-y-auto">
                        {selectedLog.reply || 'No reply generated (Failed or triaged before generation).'}
                      </div>
                    </div>
                  </div>
                )}

                {/* 3. JSON TAB */}
                {drawerTab === 'json' && (
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">Raw Database Record</span>
                      <button
                        onClick={() => copyToClipboard(JSON.stringify(selectedLog, null, 2), 'json')}
                        className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground transition-colors"
                      >
                        {copiedId === 'json' ? <Check className="w-3 h-3 text-green-400" /> : <Copy className="w-3 h-3" />}
                        {copiedId === 'json' ? 'Copied' : 'Copy JSON'}
                      </button>
                    </div>
                    <pre className="p-4 bg-black/60 border border-white/10 rounded-xl text-[11px] font-mono text-zinc-400 overflow-x-auto max-h-[460px]">
                      {JSON.stringify(selectedLog, null, 2)}
                    </pre>
                  </div>
                )}

              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
