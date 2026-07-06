import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Loader2, 
  Terminal, 
  Database, 
  Cpu, 
  CheckCircle, 
  AlertTriangle, 
  Play, 
  RefreshCw, 
  Eye, 
  FileText, 
  ArrowRight,
  Sparkles,
  Award,
  ChevronRight,
  X
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { api } from '@/lib/api';

export default function AiProcessing() {
  const [logs, setLogs] = useState<any[]>([]);
  const [selectedLog, setSelectedLog] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState('All');
  
  const user = JSON.parse(localStorage.getItem('user') || '{}');
  const [selectedClientId, setSelectedClientId] = useState(user?.role === 'admin' ? 'ALL' : (user?.client_id || ''));
  const [clients, setClients] = useState<any[]>([]);

  useEffect(() => {
    if (user?.role === 'admin') {
      api.getAllEmailAccounts()
        .then((data) => {
          setClients(data);
        })
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

  // Filter logic
  const filteredLogs = logs.filter(log => {
    if (activeFilter === 'All') return true;
    if (activeFilter === 'Auto-Replied') return log.raw_status === 'sent';
    if (activeFilter === 'Escalated') return log.raw_status === 'ticket_created_and_sent';
    if (activeFilter === 'Failed') return log.raw_status && log.raw_status.includes('failed');
    return true;
  });

  // Telemetry Aggregates
  const totalLogs = logs.length;
  const avgScore = totalLogs > 0 
    ? Math.round(logs.reduce((acc, curr) => acc + (curr.score || 0), 0) / totalLogs) 
    : 0;
  const autoRepliedCount = logs.filter(l => l.raw_status === 'sent').length;
  const ticketedCount = logs.filter(l => l.raw_status === 'ticket_created_and_sent').length;

  if (loading) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center space-y-4">
        <Loader2 className="w-10 h-10 text-primary animate-spin" />
        <p className="text-sm text-zinc-400 font-medium">Listening to AI reasoning traces...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 relative h-[calc(100vh-140px)] overflow-y-auto pr-2">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row justify-between sm:items-end gap-4">
        <div>
          <h2 className="text-3xl font-extrabold text-white tracking-tight flex items-center gap-2">
            <Cpu className="w-8 h-8 text-primary animate-pulse" />
            AI Processing Logs
          </h2>
          <p className="text-zinc-400 text-sm mt-1">
            Real-time execution pipeline, intent classification scoreboards, and RAG retrieval traces.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3 self-start sm:self-auto">
          {user?.role === 'admin' && clients.length > 0 && (
            <div className="flex items-center gap-2 bg-white/5 border border-white/10 rounded-xl px-3 py-1.5">
              <span className="text-xs text-muted-foreground font-semibold">Client:</span>
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
            className="flex items-center gap-2 px-4 py-2 bg-white/5 hover:bg-white/10 text-white rounded-xl border border-white/10 transition-colors text-sm font-medium"
          >
            <RefreshCw className="w-4 h-4" />
            Sync Traces
          </button>
        </div>
      </div>

      {/* Telemetry Stats Grid */}
      <div className="grid grid-cols-4 gap-4">
        <div className="glass-panel p-5 rounded-2xl border border-white/5 bg-gradient-to-br from-white/5 to-transparent">
          <span className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Total Traces Logs</span>
          <h3 className="text-3xl font-black text-white mt-2">{totalLogs}</h3>
          <p className="text-xs text-zinc-500 mt-1">AI pipelines executions polled</p>
        </div>
        <div className="glass-panel p-5 rounded-2xl border border-white/5 bg-gradient-to-br from-white/5 to-transparent">
          <span className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Avg Quality Score</span>
          <div className="flex items-baseline gap-2 mt-2">
            <h3 className="text-3xl font-black text-emerald-400">{avgScore}%</h3>
            <Award className="w-4 h-4 text-emerald-400" />
          </div>
          <p className="text-xs text-zinc-500 mt-1">Overall answer confidence rating</p>
        </div>
        <div className="glass-panel p-5 rounded-2xl border border-white/5 bg-gradient-to-br from-white/5 to-transparent">
          <span className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Auto-Send Approvals</span>
          <h3 className="text-3xl font-black text-blue-400 mt-2">{autoRepliedCount}</h3>
          <p className="text-xs text-zinc-500 mt-1">Score meeting target thresholds</p>
        </div>
        <div className="glass-panel p-5 rounded-2xl border border-white/5 bg-gradient-to-br from-white/5 to-transparent">
          <span className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Triaged to CRM</span>
          <h3 className="text-3xl font-black text-purple-400 mt-2">{ticketedCount}</h3>
          <p className="text-xs text-zinc-500 mt-1">Transferred due to lower score</p>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex gap-2">
        {['All', 'Auto-Replied', 'Escalated', 'Failed'].map(filter => (
          <button
            key={filter}
            onClick={() => setActiveFilter(filter)}
            className={cn(
              "px-4 py-1.5 rounded-lg text-sm font-semibold transition-all duration-200",
              activeFilter === filter 
                ? "bg-primary text-primary-foreground shadow-lg shadow-primary/20" 
                : "bg-white/5 text-zinc-400 hover:text-white hover:bg-white/10"
            )}
          >
            {filter}
          </button>
        ))}
      </div>

      {/* Main Logs Table */}
      <div className="glass-panel rounded-2xl border border-white/10 overflow-hidden">
        {filteredLogs.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-white/10 bg-white/5 text-xs font-bold uppercase tracking-wider text-zinc-400">
                  <th className="py-4 px-6">Timestamp</th>
                  <th className="py-4 px-6">Source Customer</th>
                  <th className="py-4 px-6">Subject / Query</th>
                  <th className="py-4 px-6 text-center">Triage Score</th>
                  <th className="py-4 px-6 text-center">Pipeline Outcome</th>
                  <th className="py-4 px-6 text-right">Inspection</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5 text-sm text-zinc-300">
                {filteredLogs.map(log => (
                  <tr key={log.id} className="hover:bg-white/5 transition-colors">
                    <td className="py-4 px-6 font-mono text-xs text-zinc-400 whitespace-nowrap">
                      {log.date_str} {log.time}
                    </td>
                    <td className="py-4 px-6 font-medium text-white max-w-[180px] truncate">
                      {log.sender}
                    </td>
                    <td className="py-4 px-6 max-w-[240px] truncate">
                      {log.subject}
                    </td>
                    <td className="py-4 px-6 text-center">
                      <span className={cn(
                        "px-2.5 py-0.5 rounded-full text-xs font-bold",
                        (log.score || 0) >= 80 ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" :
                        (log.score || 0) >= 50 ? "bg-amber-500/10 text-amber-400 border border-amber-500/20" :
                        "bg-rose-500/10 text-rose-400 border border-rose-500/20"
                      )}>
                        {log.score}%
                      </span>
                    </td>
                    <td className="py-4 px-6 text-center">
                      <span className={cn(
                        "inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold whitespace-nowrap",
                        log.raw_status === 'sent' ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" :
                        log.raw_status === 'ticket_created_and_sent' ? "bg-purple-500/10 text-purple-400 border border-purple-500/20" :
                        "bg-rose-500/10 text-rose-400 border border-rose-500/20"
                      )}>
                        <span className={cn(
                          "w-1.5 h-1.5 rounded-full",
                          log.raw_status === 'sent' ? "bg-emerald-400 animate-pulse" :
                          log.raw_status === 'ticket_created_and_sent' ? "bg-purple-400 animate-pulse" :
                          "bg-rose-400"
                        )} />
                        {log.raw_status === 'sent' ? "Auto-Send Approved" :
                         log.raw_status === 'ticket_created_and_sent' ? "Triage Reference" : 
                         "Execution Failed"}
                      </span>
                    </td>
                    <td className="py-4 px-6 text-right">
                      <button 
                        onClick={() => setSelectedLog(log)}
                        className="inline-flex items-center gap-1 px-3 py-1 bg-primary/10 hover:bg-primary/20 text-primary border border-primary/20 hover:border-primary/40 rounded-lg text-xs font-bold transition-all"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        Trace
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center p-16 text-center space-y-4">
            <Terminal className="w-12 h-12 text-zinc-500" />
            <h4 className="text-lg font-bold text-white">No Traces Logged</h4>
            <p className="text-zinc-400 text-sm max-w-sm">
              Either there are no emails processed yet, or they don't match the active filter criteria. Try changing filters or syncing logs.
            </p>
          </div>
        )}
      </div>

      {/* Trace Side-Drawer Modal */}
      <AnimatePresence>
        {selectedLog && (
          <>
            {/* Backdrop */}
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.5 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedLog(null)}
              className="fixed inset-0 bg-black z-40"
            />

            {/* Modal Body */}
            <motion.div
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 200 }}
              className="fixed right-0 top-0 bottom-0 w-[550px] bg-zinc-950 border-l border-white/10 shadow-2xl z-50 flex flex-col overflow-hidden"
            >
              {/* Drawer Header */}
              <div className="p-6 border-b border-white/10 bg-white/5 flex justify-between items-center">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-primary/10 text-primary rounded-lg">
                    <Cpu className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-white">Agent Execution Trace</h3>
                    <p className="text-xs text-zinc-400 font-mono">Trace ID: trace-{selectedLog.id}</p>
                  </div>
                </div>
                <button 
                  onClick={() => setSelectedLog(null)}
                  className="p-1.5 hover:bg-white/10 text-zinc-400 hover:text-white rounded-lg transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Drawer Contents */}
              <div className="flex-1 overflow-y-auto p-6 space-y-6">
                
                {/* Intent/Score Card */}
                <div className="glass-panel p-4 rounded-xl border border-white/10 bg-gradient-to-r from-primary/10 via-transparent to-transparent flex justify-between items-center">
                  <div>
                    <span className="text-[10px] uppercase font-bold text-zinc-400 tracking-wider">Classification Intent</span>
                    <h4 className="text-base font-bold text-white mt-0.5">{selectedLog.category}</h4>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] uppercase font-bold text-zinc-400 tracking-wider">AI Score</span>
                    <div className="text-lg font-black text-primary">{selectedLog.score}%</div>
                  </div>
                </div>

                {/* Timeline Flow */}
                <div className="space-y-6">
                  <h4 className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Execution Pipeline Steps</h4>
                  
                  <div className="relative border-l border-white/10 pl-6 ml-3 space-y-6">
                    {/* Step 1 */}
                    <div className="relative">
                      <div className="absolute -left-[31px] top-0 w-4 h-4 rounded-full bg-emerald-500 border-4 border-zinc-950 flex items-center justify-center" />
                      <h5 className="text-sm font-bold text-white flex items-center gap-1.5">
                        1. Log Receipt
                        <CheckCircle className="w-3.5 h-3.5 text-emerald-400" />
                      </h5>
                      <p className="text-xs text-zinc-400 mt-1">
                        Received raw email payload from <span className="font-semibold text-zinc-200">{selectedLog.sender}</span>.
                      </p>
                    </div>

                    {/* Step 2 */}
                    <div className="relative">
                      <div className="absolute -left-[31px] top-0 w-4 h-4 rounded-full bg-emerald-500 border-4 border-zinc-950 flex items-center justify-center" />
                      <h5 className="text-sm font-bold text-white flex items-center gap-1.5">
                        2. RAG Context Lookup
                        <Database className="w-3.5 h-3.5 text-emerald-400" />
                      </h5>
                      <p className="text-xs text-zinc-400 mt-1">
                        Queried vector store collection matching active client. 
                        {selectedLog.rag_id ? (
                          <span className="block mt-1 font-mono text-[10px] text-primary/80">Active RAG ID: {selectedLog.rag_id}</span>
                        ) : (
                          <span className="block mt-1 font-mono text-[10px] text-zinc-500">Default fallback index applied</span>
                        )}
                      </p>
                    </div>

                    {/* Step 3 */}
                    <div className="relative">
                      <div className="absolute -left-[31px] top-0 w-4 h-4 rounded-full bg-emerald-500 border-4 border-zinc-950 flex items-center justify-center" />
                      <h5 className="text-sm font-bold text-white flex items-center gap-1.5">
                        3. Reply Synthesis
                        <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
                      </h5>
                      <p className="text-xs text-zinc-400 mt-1">
                        LLM completed synthesis of answers matching contextual rules.
                      </p>
                    </div>

                    {/* Step 4 */}
                    <div className="relative">
                      <div className="absolute -left-[31px] top-0 w-4 h-4 rounded-full bg-emerald-500 border-4 border-zinc-950 flex items-center justify-center" />
                      <h5 className="text-sm font-bold text-white flex items-center gap-1.5">
                        4. Quality Assessment Scoreboard
                        <Award className="w-3.5 h-3.5 text-emerald-400" />
                      </h5>
                      <p className="text-xs text-zinc-400 mt-1">
                        Self-scoring pipeline evaluated quality of draft reply. Score: <span className="font-bold text-primary">{selectedLog.score}%</span>.
                      </p>
                    </div>

                    {/* Step 5 */}
                    <div className="relative">
                      <div className={cn(
                        "absolute -left-[31px] top-0 w-4 h-4 rounded-full border-4 border-zinc-950 flex items-center justify-center",
                        selectedLog.raw_status === 'sent' ? "bg-emerald-500" : "bg-purple-500"
                      )} />
                      <h5 className="text-sm font-bold text-white flex items-center gap-1.5">
                        5. Pipeline Routing Outcome
                        <ArrowRight className="w-3.5 h-3.5" />
                      </h5>
                      <p className="text-xs text-zinc-400 mt-1">
                        {selectedLog.raw_status === 'sent' ? (
                          <span>{"Score met target threshold (>= 80%). Auto-Send Approved & reply successfully dispatched."}</span>
                        ) : (
                          <span>{"Score falls below threshold (< 80%). Reference status triaged & created automatically. Notification update email sent to user."}</span>
                        )}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Raw Email Snippets */}
                <div className="space-y-3">
                  <h4 className="text-xs font-bold text-zinc-400 uppercase tracking-wider flex items-center gap-1">
                    <FileText className="w-3.5 h-3.5 text-zinc-400" />
                    Operational Payloads
                  </h4>
                  <div className="bg-white/5 border border-white/10 rounded-xl p-4 space-y-4">
                    <div>
                      <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider block mb-1">Customer Input</span>
                      <p className="text-xs text-zinc-300 font-mono whitespace-pre-line bg-black/40 p-3 rounded-lg border border-white/5">
                        {selectedLog.preview}
                      </p>
                    </div>
                    {selectedLog.reply && (
                      <div>
                        <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider block mb-1">AI Output (Suggested Reply)</span>
                        <p className="text-xs text-zinc-300 font-mono whitespace-pre-line bg-black/40 p-3 rounded-lg border border-white/5">
                          {selectedLog.reply}
                        </p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Raw Database Record JSON representation */}
                <div className="space-y-3">
                  <h4 className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Raw Database Log JSON</h4>
                  <pre className="p-4 bg-black/60 border border-white/5 rounded-xl text-[10px] font-mono text-zinc-400 overflow-x-auto">
                    {JSON.stringify(selectedLog, null, 2)}
                  </pre>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
