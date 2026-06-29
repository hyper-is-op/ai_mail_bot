import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Search, 
  Filter, 
  MoreVertical, 
  Reply, 
  Ticket, 
  CheckCircle, 
  RefreshCw, 
  Loader2, 
  Inbox as InboxIcon, 
  ChevronDown, 
  ChevronRight, 
  User, 
  Bot, 
  Calendar,
  Sparkles,
  MessageSquare,
  PauseCircle,
  PlayCircle,
  Send
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { api } from '@/lib/api';
import LangGraphVisualizer from '@/components/LangGraphVisualizer';

export default function Inbox() {
  const [emailsList, setEmailsList] = useState<any[]>([]);
  const [selectedThread, setSelectedThread] = useState<any>(null);
  const [activeTab, setActiveTab] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [ticketLoadingId, setTicketLoadingId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [toastMsg, setToastMsg] = useState('');
  const [expandedEmails, setExpandedEmails] = useState<Record<number, boolean>>({});
  
  // New States for Manual Reply & Pause
  const [pausedEmails, setPausedEmails] = useState<string[]>([]);
  const [isReplying, setIsReplying] = useState(false);
  const [replyText, setReplyText] = useState('');
  const [replyLoading, setReplyLoading] = useState(false);

  const user = JSON.parse(localStorage.getItem('user') || '{}');
  const [selectedClientId, setSelectedClientId] = useState(user?.client_id || '');
  const [clients, setClients] = useState<any[]>([]);

  // Fetch helper
  const fetchEmails = async (silent = false, cid = selectedClientId) => {
    if (!cid) return;
    if (!silent) setLoading(true);
    try {
      const data = await api.getEmails(cid);
      setEmailsList(data || []);
    } catch (err: any) {
      console.error("Failed to load email logs:", err);
    } finally {
      if (!silent) setLoading(false);
    }
  };

  const fetchPausedEmails = async (cid = selectedClientId) => {
    if (!cid) return;
    try {
      const data = await api.getPausedEmails(cid);
      setPausedEmails(data || []);
    } catch (err: any) {
      console.error("Failed to load paused emails:", err);
    }
  };

  useEffect(() => {
    if (user?.role === 'admin') {
      api.getAllEmailAccounts()
        .then((data) => {
          setClients(data);
          if (data.length > 0 && !selectedClientId) {
            setSelectedClientId(data[0].client_id);
          }
        })
        .catch((err) => console.error("Failed to fetch clients for admin inbox:", err));
    }
  }, []);

  // Initial Load
  useEffect(() => {
    if (selectedClientId) {
      fetchEmails(false, selectedClientId);
      fetchPausedEmails(selectedClientId);
    }
  }, [selectedClientId]);

  // WebSocket for Real-time auto-updates
  useEffect(() => {
    if (!selectedClientId) return;

    const wsProto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${wsProto}//${window.location.host}/ws`;
    let ws: WebSocket | null = null;
    let reconnectTimeout: any = null;

    const connectWS = () => {
      console.log("🔌 Connecting Real-time Inbox WebSocket to:", wsUrl);
      ws = new WebSocket(wsUrl);

      ws.onopen = () => {
        console.log("✅ Inbox WebSocket connected successfully");
      };

      ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          if (message.type === 'NEW_EMAIL' && message.client_id === selectedClientId) {
            console.log("📡 New email processed. Refreshing inbox silently...");
            fetchEmails(true, selectedClientId);
          }
        } catch (e) {
          console.warn("⚠️ Ignored non-JSON websocket frame:", event.data);
        }
      };

      ws.onclose = () => {
        console.log("🔌 WebSocket disconnected. Reconnecting in 5 seconds...");
        reconnectTimeout = setTimeout(connectWS, 5000);
      };

      ws.onerror = (err) => {
        console.error("❌ WebSocket error:", err);
        ws?.close();
      };
    };

    connectWS();

    return () => {
      if (ws) ws.close();
      if (reconnectTimeout) clearTimeout(reconnectTimeout);
    };
  }, [selectedClientId]);

  // Normalize subject to strip Re/Fwd prefixes for Gmail-style grouping
  const normalizeSubject = (subj: string) => {
    if (!subj) return 'No Subject';
    return subj.replace(/^(Re|RE|Fwd|FWD|fwd|re):\s*/i, '').trim();
  };

  // Compute grouped conversation threads
  const getGroupedThreads = () => {
    const threadMap: Record<string, any> = {};

    emailsList.forEach((email) => {
      const normSubj = normalizeSubject(email.subject);
      // Group by sender & normalized subject
      const key = `${email.sender.toLowerCase()}::${normSubj.toLowerCase()}`;

      if (!threadMap[key]) {
        threadMap[key] = {
          key,
          subject: normSubj,
          sender: email.sender,
          emails: []
        };
      }
      threadMap[key].emails.push(email);
    });

    const threads = Object.values(threadMap).map((thread: any) => {
      // Sort emails in chronological order (oldest first)
      thread.emails.sort((a: any, b: any) => a.id - b.id);
      // The latest status/sentiment/priority represents the thread summary
      const latest = thread.emails[thread.emails.length - 1];
      
      return {
        ...thread,
        id: latest.id,
        latest_email: latest,
        status: latest.status,
        priority: latest.priority,
        sentiment: latest.sentiment,
        score: latest.score,
        time: latest.time,
        date_str: latest.date_str
      };
    });

    // Sort threads so the ones with the newest updates bubble to the top
    return threads.sort((a, b) => b.latest_email.id - a.latest_email.id);
  };

  const groupedThreads = getGroupedThreads();

  // Filter threads based on Search and Tabs
  const filteredThreads = groupedThreads.filter(thread => {
    const latestStatus = thread.latest_email.status.toLowerCase();
    const matchesTab = activeTab === 'All' || latestStatus === activeTab.toLowerCase();
    
    const matchesSearch = 
      thread.sender.toLowerCase().includes(searchQuery.toLowerCase()) ||
      thread.subject.toLowerCase().includes(searchQuery.toLowerCase()) ||
      thread.emails.some((email: any) => 
        email.preview.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (email.reply && email.reply.toLowerCase().includes(searchQuery.toLowerCase()))
      );
      
    return matchesTab && matchesSearch;
  });

  // Track thread selection and default-expand the latest message
  useEffect(() => {
    if (filteredThreads.length > 0) {
      // If there's a pending navigation from notification, let it handle the selection
      if (localStorage.getItem('selected_email_id')) {
        return;
      }
      if (!selectedThread) {
        setSelectedThread(filteredThreads[0]);
      } else {
        // Keep selected thread synced with updated data
        const updated = filteredThreads.find(t => t.key === selectedThread.key);
        if (updated) {
          setSelectedThread(updated);
        }
      }
    } else {
      setSelectedThread(null);
    }
  }, [emailsList, filteredThreads.length]);

  // Handle selected email navigation from notifications
  useEffect(() => {
    const targetEmailIdStr = localStorage.getItem('selected_email_id');
    if (targetEmailIdStr && groupedThreads.length > 0) {
      const targetEmailId = parseInt(targetEmailIdStr, 10);
      const targetThread = groupedThreads.find(thread => 
        thread.emails.some((email: any) => email.id === targetEmailId)
      );
      if (targetThread) {
        setActiveTab('All');
        setSearchQuery('');
        setSelectedThread(targetThread);
        setExpandedEmails({ [targetEmailId]: true });
        localStorage.removeItem('selected_email_id');
      }
    }
  }, [emailsList, groupedThreads.length]);

  // Set latest message expanded by default when selectedThread changes
  useEffect(() => {
    if (selectedThread) {
      setExpandedEmails({ [selectedThread.latest_email.id]: true });
    }
  }, [selectedThread?.key]);

  const toggleEmailExpand = (id: number) => {
    setExpandedEmails(prev => ({
      ...prev,
      [id]: !prev[id]
    }));
  };

  const handleCreateTicket = async (email: any) => {
    if (!selectedClientId || !email) {
      setToastMsg('Error: No active email or client session found');
      setTimeout(() => setToastMsg(''), 5000);
      return;
    }
    setTicketLoadingId(email.id);
    setToastMsg('');
    try {
      const res = await api.createTicket({
        client_id: selectedClientId,
        mail_id: email.mailId,
        subject: email.subject,
        body: email.preview,
        status: 'Ticket_Generated'
      });
      setToastMsg(`Ticket Generated! ID: ${res.ticket_id}`);
      fetchEmails(true, selectedClientId); // reload silently
      setTimeout(() => setToastMsg(''), 5000);
    } catch (err: any) {
      setToastMsg(`Error: ${err.message}`);
      setTimeout(() => setToastMsg(''), 5000);
    } finally {
      setTicketLoadingId(null);
    }
  };

  const handlePauseToggle = async (email: string) => {
    const isPaused = pausedEmails.includes(email);
    try {
      if (isPaused) {
        await api.unpauseEmail({ client_id: selectedClientId, email });
        setPausedEmails(prev => prev.filter(e => e !== email));
        setToastMsg(`Unpaused auto-replies for ${email}`);
      } else {
        await api.pauseEmail({ client_id: selectedClientId, email });
        setPausedEmails(prev => [...prev, email]);
        setToastMsg(`Paused auto-replies for ${email}`);
      }
      setTimeout(() => setToastMsg(''), 3000);
    } catch (err: any) {
      setToastMsg(`Error: ${err.message}`);
      setTimeout(() => setToastMsg(''), 3000);
    }
  };

  const handleSendManualReply = async () => {
    if (!selectedThread || !replyText.trim()) return;
    setReplyLoading(true);
    try {
      await api.sendManualReply({
        client_id: selectedClientId,
        to_email: selectedThread.sender,
        subject: `Re: ${selectedThread.subject}`,
        body: selectedThread.latest_email.body || selectedThread.latest_email.preview || "",
        reply_text: replyText
      });
      setToastMsg('Reply sent successfully!');
      setReplyText('');
      setIsReplying(false);
      setTimeout(() => setToastMsg(''), 3000);
      fetchEmails(true, selectedClientId);
    } catch (err: any) {
      setToastMsg(`Error sending reply: ${err.message}`);
      setTimeout(() => setToastMsg(''), 5000);
    } finally {
      setReplyLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center space-y-4">
        <Loader2 className="w-10 h-10 text-primary animate-spin" />
        <p className="text-sm text-zinc-400 font-medium">Loading conversation threads from database...</p>
      </div>
    );
  }

  return (
    <div className="flex h-[calc(100vh-140px)] gap-6">
      {/* Thread List Sidebar */}
      <div className="w-1/3 glass-panel rounded-2xl flex flex-col overflow-hidden border border-white/10">
        <div className="p-4 border-b border-white/10">
          <div className="flex flex-col gap-2 mb-4">
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-2">
                <MessageSquare className="w-5 h-5 text-primary" />
                <h2 className="text-xl font-bold text-zinc-900 dark:text-white">Conversations</h2>
              </div>
              <button 
                onClick={() => fetchEmails(false, selectedClientId)} 
                className="p-1.5 hover:bg-white/10 rounded-lg text-zinc-400 hover:text-white transition-colors" 
                title="Sync Inbox"
              >
                <RefreshCw className="w-4 h-4" />
              </button>
            </div>
            {user?.role === 'admin' && clients.length > 0 && (
              <div className="flex items-center gap-2 bg-white/5 border border-white/5 rounded-xl px-3 py-1.5">
                <span className="text-xs text-muted-foreground font-semibold">Client:</span>
                <select
                  value={selectedClientId}
                  onChange={(e) => setSelectedClientId(e.target.value)}
                  className="bg-transparent text-xs text-foreground focus:outline-none cursor-pointer flex-1"
                >
                  {clients.map((c) => (
                    <option key={c.client_id} value={c.client_id} className="bg-zinc-950 text-foreground">
                      {c.client_id} ({c.email})
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>
          <div className="flex gap-2 mb-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input 
                type="text" 
                placeholder="Search conversations..." 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-black/10 dark:bg-white/5 border border-white/10 rounded-lg pl-9 pr-4 py-2 text-sm text-zinc-800 dark:text-white focus:outline-none focus:ring-1 focus:ring-primary" 
              />
            </div>
            <button className="p-2 bg-black/10 dark:bg-white/5 border border-white/10 rounded-lg hover:bg-white/10 transition-colors">
              <Filter className="w-4 h-4 text-zinc-300" />
            </button>
          </div>
          <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide text-sm">
            {['All', 'Processing', 'Replied', 'Failed'].map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={cn(
                  "px-3 py-1 rounded-full whitespace-nowrap transition-colors font-medium", 
                  activeTab === tab 
                    ? "bg-primary text-primary-foreground" 
                    : "bg-black/10 dark:bg-white/5 hover:bg-white/10 text-muted-foreground"
                )}
              >
                {tab}
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {filteredThreads.length > 0 ? (
            filteredThreads.map((thread) => (
              <div
                key={thread.key}
                onClick={() => setSelectedThread(thread)}
                className={cn(
                  "p-3 rounded-xl cursor-pointer transition-all duration-200 border border-transparent hover:border-white/10 hover:bg-white/5",
                  selectedThread?.key === thread.key ? "bg-primary/10 border-primary/20" : ""
                )}
              >
                <div className="flex justify-between items-start mb-1">
                  <span className="font-semibold text-sm text-zinc-800 dark:text-zinc-200 truncate pr-2">
                    {thread.sender}
                  </span>
                  <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                    {thread.time}
                  </span>
                </div>
                <div className="flex items-center gap-1.5 mb-1">
                  <p className="text-xs font-semibold text-zinc-800 dark:text-white truncate flex-1">
                    {thread.subject}
                  </p>
                  {thread.emails.length > 1 && (
                    <span className="bg-white/10 text-zinc-300 text-[10px] font-bold px-1.5 py-0.5 rounded-full shrink-0">
                      {thread.emails.length}
                    </span>
                  )}
                </div>
                <p className="text-xs text-muted-foreground truncate mb-2">
                  {thread.latest_email.preview}
                </p>
                <div className="flex items-center justify-between mt-2">
                  <span className={cn("text-[10px] px-2 py-0.5 rounded-full font-semibold", 
                    thread.status === 'Replied' ? 'bg-green-500/10 text-green-400' :
                    thread.status === 'Failed' ? 'bg-rose-500/10 text-rose-400' :
                    thread.status === 'Processing' ? 'bg-blue-500/10 text-blue-400' :
                    'bg-purple-500/10 text-purple-400'
                  )}>
                    {thread.status}
                  </span>
                  <div className="flex gap-1.5 items-center">
                    <span className={cn("text-[9px] px-1.5 py-0.5 rounded font-semibold",
                      thread.priority === 'Critical' ? 'bg-red-500/20 text-red-400 border border-red-500/30' :
                      thread.priority === 'High' ? 'bg-orange-500/20 text-orange-400 border border-orange-500/30' :
                      thread.priority === 'Medium' ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30' :
                      'bg-zinc-500/20 text-zinc-400 border border-zinc-500/30'
                    )}>
                      {thread.priority}
                    </span>
                    <span className={cn("text-[9px] px-1.5 py-0.5 rounded font-semibold",
                      thread.sentiment === 'Angry' ? 'bg-red-500/10 text-rose-400 border border-red-500/10' :
                      thread.sentiment === 'Happy' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/10' :
                      'bg-zinc-500/10 text-zinc-300 border border-zinc-500/10'
                    )}>
                      {thread.sentiment}
                    </span>
                  </div>
                </div>
              </div>
            ))
          ) : (
            <div className="h-full flex flex-col items-center justify-center p-6 text-center space-y-3">
              <InboxIcon className="w-8 h-8 text-zinc-500" />
              <p className="text-xs text-muted-foreground font-medium">No threads fit the criteria.</p>
            </div>
          )}
        </div>
      </div>

      {/* Gmail-Style Conversation Thread Panel */}
      {selectedThread ? (
        <div className="flex-1 glass-panel rounded-2xl flex flex-col overflow-hidden border border-white/10 relative">
          {toastMsg && (
            <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-black text-white px-4 py-2 rounded-full text-xs font-semibold z-50 animate-in fade-in slide-in-from-top-4 shadow-xl border border-white/20">
              {toastMsg}
            </div>
          )}

          {/* Thread Header */}
          <div className="p-6 border-b border-white/10 flex justify-between items-start bg-white/5">
            <div>
              <h2 className="text-xl font-bold text-zinc-900 dark:text-white mb-1">
                {selectedThread.subject}
                {pausedEmails.includes(selectedThread.sender) && (
                  <span className="ml-3 inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-semibold bg-amber-500/20 text-amber-500 border border-amber-500/30">
                    <PauseCircle className="w-3 h-3" /> Auto-Replies Paused
                  </span>
                )}
              </h2>
              <div className="flex items-center gap-3 text-xs text-muted-foreground">
                <span className="font-medium text-foreground">{selectedThread.sender}</span>
                <span>•</span>
                <span className="flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5" />
                  {selectedThread.emails.length} messages in conversation
                </span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button 
                onClick={() => handlePauseToggle(selectedThread.sender)}
                className={cn("px-3 py-1.5 border border-white/10 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1.5",
                  pausedEmails.includes(selectedThread.sender) ? "bg-amber-500/10 text-amber-500 hover:bg-amber-500/20 border-amber-500/30" : "text-zinc-300 hover:bg-white/5"
                )}
                title={pausedEmails.includes(selectedThread.sender) ? "Resume Auto-Replies" : "Pause Auto-Replies"}
              >
                {pausedEmails.includes(selectedThread.sender) ? <PlayCircle className="w-3.5 h-3.5" /> : <PauseCircle className="w-3.5 h-3.5" />}
                {pausedEmails.includes(selectedThread.sender) ? "Resume" : "Pause"}
              </button>
              <button 
                onClick={() => setIsReplying(!isReplying)}
                className={cn("p-2 border border-white/10 rounded-lg transition-colors", 
                  isReplying ? "bg-primary text-primary-foreground border-primary" : "text-zinc-300 hover:bg-white/5"
                )}
                title="Reply"
              >
                <Reply className="w-4 h-4" />
              </button>
              <button className="p-2 border border-white/10 rounded-lg text-zinc-300 hover:bg-white/5 transition-colors" title="Mark Complete"><CheckCircle className="w-4 h-4" /></button>
              <button className="p-2 border border-white/10 rounded-lg text-zinc-300 hover:bg-white/5 transition-colors" title="More"><MoreVertical className="w-4 h-4" /></button>
            </div>
          </div>

          {/* Manual Reply Box */}
          <AnimatePresence>
            {isReplying && (
              <motion.div 
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden border-b border-white/10 bg-white/5"
              >
                <div className="p-4 flex flex-col gap-3">
                  <textarea 
                    value={replyText}
                    onChange={(e) => setReplyText(e.target.value)}
                    placeholder="Type your manual reply here..."
                    className="w-full h-32 bg-black/20 border border-white/10 rounded-xl p-3 text-sm text-zinc-200 focus:outline-none focus:border-primary/50 resize-none"
                  />
                  <div className="flex justify-end gap-2">
                    <button 
                      onClick={() => setIsReplying(false)}
                      className="px-4 py-2 rounded-lg text-xs font-semibold text-zinc-400 hover:bg-white/5 transition-colors"
                    >
                      Cancel
                    </button>
                    <button 
                      onClick={handleSendManualReply}
                      disabled={replyLoading || !replyText.trim()}
                      className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-xs font-semibold hover:bg-primary/90 transition-colors flex items-center gap-2 disabled:opacity-50"
                    >
                      {replyLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                      Send Reply
                    </button>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* TL;DR Summary Card */}
          {selectedThread.latest_email.summary && (
            <div className="mx-6 mt-6 p-4 rounded-xl border border-primary/20 bg-primary/5 flex gap-3 items-start relative overflow-hidden group">
              <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full blur-3xl group-hover:bg-primary/10 transition-all duration-300"></div>
              <div className="p-2 rounded-lg bg-primary/15 border border-primary/25 text-primary shrink-0">
                <Sparkles className="w-4 h-4 text-primary animate-pulse" />
              </div>
              <div className="space-y-1 z-10">
                <h4 className="text-xs font-bold uppercase tracking-wider text-primary">Conversation Summary (TL;DR)</h4>
                <p className="text-sm text-zinc-800 dark:text-zinc-300 leading-relaxed font-medium">
                  {selectedThread.latest_email.summary}
                </p>
              </div>
            </div>
          )}

          {/* Nested Message Timeline */}
          <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-black/10">
            {selectedThread.emails.map((email: any, index: number) => {
              const isExpanded = !!expandedEmails[email.id];
              return (
                <div key={email.id} className="relative flex gap-4">
                  {/* Timeline connecting line */}
                  {index < selectedThread.emails.length - 1 && (
                    <div className="absolute left-6 top-10 bottom-0 w-0.5 bg-gradient-to-b from-white/10 to-transparent z-0"></div>
                  )}

                  {/* Left avatar icon */}
                  <div className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0 border z-10 bg-zinc-950 border-white/10 text-zinc-300 shadow-lg">
                    <User className="w-5 h-5" />
                  </div>

                  {/* Message body container */}
                  <div className="flex-1 min-w-0">
                    <div 
                      onClick={() => toggleEmailExpand(email.id)}
                      className={cn(
                        "w-full glass-panel border rounded-xl overflow-hidden transition-all duration-200 cursor-pointer select-none",
                        isExpanded ? "border-white/15 shadow-xl bg-white/5" : "border-white/5 hover:border-white/10 hover:bg-white/5 bg-white/2"
                      )}
                    >
                      {/* Accordion Header */}
                      <div className="p-4 flex items-center justify-between gap-4">
                        <div className="flex items-center gap-3 min-w-0">
                          <span className="text-xs text-muted-foreground font-mono font-bold">#{index + 1}</span>
                          <p className="text-sm font-semibold text-zinc-800 dark:text-zinc-200 truncate">
                            {isExpanded ? "Customer Inquiry" : email.preview}
                          </p>
                        </div>
                        <div className="flex items-center gap-3 shrink-0">
                          <span className="text-xs text-muted-foreground font-mono">{email.date_str} {email.time}</span>
                          <div className="flex items-center gap-1.5">
                            <span className={cn("text-[9px] px-1.5 py-0.5 rounded font-semibold",
                              email.priority === 'Critical' ? 'bg-red-500/20 text-red-400 border border-red-500/30' :
                              email.priority === 'High' ? 'bg-orange-500/20 text-orange-400 border border-orange-500/30' :
                              email.priority === 'Medium' ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30' :
                              'bg-zinc-500/20 text-zinc-400 border border-zinc-500/30'
                            )}>
                              {email.priority}
                            </span>
                            <span className={cn("text-[9px] px-1.5 py-0.5 rounded font-semibold",
                              email.sentiment === 'Angry' ? 'bg-red-500/10 text-rose-400 border-red-500/10' :
                              email.sentiment === 'Happy' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/10' :
                              'bg-zinc-500/10 text-zinc-300 border border-zinc-500/10'
                            )}>
                              {email.sentiment}
                            </span>
                          </div>
                          {isExpanded ? <ChevronDown className="w-4 h-4 text-zinc-400" /> : <ChevronRight className="w-4 h-4 text-zinc-400" />}
                        </div>
                      </div>

                      {/* Accordion Content */}
                      <AnimatePresence initial={false}>
                        {isExpanded && (
                          <motion.div 
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: "auto", opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            className="border-t border-white/5 overflow-hidden"
                          >
                            <div className="p-5 space-y-6">
                              {/* Metadata / AI Insights Card */}
                              <div className="bg-primary/5 border border-primary/20 rounded-xl p-4 flex flex-col sm:flex-row gap-4">
                                <div className="flex-1">
                                  <h4 className="text-xs font-bold text-primary uppercase tracking-wider mb-1">AI Classification</h4>
                                  <p className="text-sm text-primary/80">
                                    Intent processed with confidence level {email.confidence}. Classified as {email.priority} priority with a {email.sentiment.toLowerCase()} customer sentiment.
                                  </p>
                                </div>
                                <div className="w-px bg-primary/20 hidden sm:block"></div>
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="text-xs px-2 py-1 rounded bg-primary/10 text-primary border border-primary/20 font-medium">
                                    Confidence: {email.confidence}
                                  </span>
                                  <button 
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleCreateTicket(email);
                                    }}
                                    disabled={ticketLoadingId === email.id || email.status === 'Ticket_Generated'} 
                                    className="px-3 py-1 bg-primary text-primary-foreground text-xs font-semibold rounded-lg hover:bg-primary/95 transition-all flex items-center gap-1.5 disabled:opacity-50"
                                  >
                                    {ticketLoadingId === email.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Ticket className="w-3.5 h-3.5" />}
                                    Create CRM Ticket
                                  </button>
                                </div>
                              </div>

                              {/* LangGraph Agent Trace Visualizer (Isolated per email execution!) */}
                              <div className="border border-white/5 rounded-xl overflow-hidden bg-black/10">
                                <div className="px-4 py-2 border-b border-white/5 bg-white/2 flex justify-between items-center">
                                  <span className="text-[10px] uppercase font-bold tracking-wider text-accent flex items-center gap-1">
                                    <Sparkles className="w-3 h-3" /> Agent Execution Trace
                                  </span>
                                </div>
                                <div className="p-3 bg-black/10">
                                  <LangGraphVisualizer executionSteps={email.execution_steps} />
                                </div>
                              </div>

                              {/* Customer Query */}
                              <div className="space-y-1.5">
                                <h4 className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Customer Query</h4>
                                <p className="text-sm leading-relaxed text-zinc-800 dark:text-zinc-200 whitespace-pre-wrap bg-white/5 p-4 rounded-xl border border-white/5">
                                  {email.preview}
                                </p>
                              </div>

                              {/* AI Response Output */}
                              {email.reply && (
                                <div className="pt-5 border-t border-white/5 flex gap-4 items-start">
                                  <div className="w-8 h-8 rounded-lg bg-green-500/10 border border-green-500/20 flex items-center justify-center shrink-0 text-green-400">
                                    <Bot className="w-4 h-4" />
                                  </div>
                                  <div className="flex-1 min-w-0 space-y-1.5">
                                    <h4 className="text-xs font-bold text-green-400 uppercase tracking-wider">AI Suggested Reply Dispatch</h4>
                                    <p className="text-sm leading-relaxed text-zinc-800 dark:text-zinc-200 whitespace-pre-wrap bg-green-500/5 p-4 rounded-xl border border-green-500/10">
                                      {email.reply}
                                    </p>
                                  </div>
                                </div>
                              )}
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="flex-1 glass-panel rounded-2xl flex flex-col items-center justify-center p-6 border border-white/10 text-center space-y-4">
          <InboxIcon className="w-12 h-12 text-zinc-500 animate-pulse" />
          <h3 className="text-lg font-semibold text-zinc-900 dark:text-white">No Conversation Thread Selected</h3>
          <p className="text-sm text-muted-foreground max-w-md">Choose an email thread from the left sidebar to view nested client interactions, dynamic sentiment tags, and step-by-step trace timelines.</p>
        </div>
      )}
    </div>
  );
}
