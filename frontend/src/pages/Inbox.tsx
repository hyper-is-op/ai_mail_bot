import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Search, 
  Reply, 
  Ticket, 
  RefreshCw, 
  Loader2, 
  Inbox as InboxIcon, 
  Bot, 
  Sparkles, 
  PauseCircle, 
  PlayCircle, 
  Send, 
  RotateCcw,
  ChevronRight,
  ShieldAlert,
  CheckCheck,
  Ban,
  Filter,
  X,
  Smile,
  Meh,
  Frown,
  Code2,
  FileText,
  Megaphone,
  Shield
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { api } from '@/lib/api';
import EmailBodyWithDisclaimer from '@/components/EmailBodyWithDisclaimer';

const getCleanSnippet = (text: string) => {
  if (!text) return '';
  return text
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<head[^>]*>[\s\S]*?<\/head>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, ' ')
    .trim();
};

/**
 * Strips active executable scripts, objects, and event handlers,
 * and injects Content Security Policy and responsive styles to properly render HTML emails.
 */
const sanitizeSandboxedHtml = (rawHtml: string): string => {
  if (!rawHtml || typeof rawHtml !== 'string') return '';
  
  // 1. Strip dangerous tags
  let cleaned = rawHtml
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '')
    .replace(/<object\b[^<]*(?:(?!<\/object>)<[^<]*)*<\/object>/gi, '')
    .replace(/<embed\b[^>]*>/gi, '')
    .replace(/<applet\b[^>]*>/gi, '')
    .replace(/<meta\s+http-equiv=["']?refresh["']?[^>]*>/gi, '');

  // 2. Strip inline event handlers (onload, onclick, onerror, onmouseover, etc.)
  cleaned = cleaned.replace(/\son\w+\s*=\s*(?:'[^']*'|"[^"]*"|[^\s>]+)/gi, '');

  // 3. Neutralize javascript: pseudo-protocol in links
  cleaned = cleaned.replace(/href\s*=\s*['"]?javascript:[^'">]*['"]?/gi, 'href="#"');

  // 4. Inject CSP that allows all styles, fonts, and images while strictly blocking scripts & forms
  const securityAndStyleInjections = `
    <meta http-equiv="Content-Security-Policy" content="default-src * data: blob: 'unsafe-inline'; script-src 'none'; object-src 'none'; form-action 'none';">
    <base target="_blank">
    <style>
      body {
        margin: 0 !important;
        padding: 16px !important;
        background-color: #ffffff !important;
        color: #1a1a1a !important;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
        line-height: 1.5;
        -webkit-text-size-adjust: 100%;
        box-sizing: border-box;
      }
      img {
        max-width: 100% !important;
        height: auto !important;
      }
      table {
        max-width: 100% !important;
      }
    </style>
  `;
  
  if (/<head[^>]*>/i.test(cleaned)) {
    return cleaned.replace(/<head[^>]*>/i, `$&${securityAndStyleInjections}`);
  } else if (/<html[^>]*>/i.test(cleaned)) {
    return cleaned.replace(/<html[^>]*>/i, `$&<head>${securityAndStyleInjections}</head>`);
  }
  return `<!DOCTYPE html><html><head>${securityAndStyleInjections}</head><body>${cleaned}</body></html>`;
};

export default function Inbox() {
  const [emailsList, setEmailsList] = useState<any[]>([]);
  const [blockedEmails, setBlockedEmails] = useState<any[]>([]);
  const [pausedHistory, setPausedHistory] = useState<any[]>([]);
  const [marketingSenders, setMarketingSenders] = useState<string[]>([]);
  const [selectedThread, setSelectedThread] = useState<any>(null);
  const [selectedBlockedItem, setSelectedBlockedItem] = useState<any>(null);
  const [selectedPausedItem, setSelectedPausedItem] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<'All' | 'Marketing' | 'Replied' | 'Processing' | 'Failed' | 'Paused' | 'Blocked'>('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [ticketLoadingId, setTicketLoadingId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [toastMsg, setToastMsg] = useState('');
  const [showTraceFor, setShowTraceFor] = useState<number | null>(null);
  const [viewHtmlMode, setViewHtmlMode] = useState<Record<number, boolean>>({});
  
  // States for Manual Reply & Pause
  const [pausedEmails, setPausedEmails] = useState<string[]>([]);
  const [isReplying, setIsReplying] = useState(false);
  const [replyText, setReplyText] = useState('');
  const [replyLoading, setReplyLoading] = useState(false);

  const user = JSON.parse(localStorage.getItem('user') || '{}');
  const isAdmin = user?.role === 'admin';
  const [selectedClientId, setSelectedClientId] = useState(isAdmin ? 'ALL' : (user?.client_id || ''));
  const [clients, setClients] = useState<any[]>([]);

  // Fetch helpers
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

  const fetchPausedHistory = async (cid = selectedClientId) => {
    if (!cid) return;
    try {
      const data = await api.getPausedEmailHistory(cid);
      setPausedHistory(Array.isArray(data) ? data : []);
    } catch (err: any) {
      console.error("Failed to load paused email history:", err);
    }
  };

  const fetchBlockedEmails = async (cid = selectedClientId) => {
    if (!cid) return;
    try {
      const data = await api.getBlockedEmails(cid);
      setBlockedEmails(Array.isArray(data) ? data : []);
    } catch (err: any) {
      console.error("Failed to load blocked emails:", err);
    }
  };

  const fetchMarketingSenders = async (cid = selectedClientId) => {
    if (!cid) return;
    try {
      const data = await api.getMarketingSenders(cid);
      setMarketingSenders(Array.isArray(data) ? data : []);
    } catch (err: any) {
      console.error("Failed to load marketing senders:", err);
    }
  };

  const isSenderMarketing = (senderEmail: string) => {
    if (!senderEmail) return false;
    const clean = senderEmail.toLowerCase().trim();
    return marketingSenders.some(s => {
      const sClean = s.toLowerCase().trim();
      return sClean === clean || clean.endsWith(`@${sClean}`) || clean.endsWith(sClean);
    });
  };

  useEffect(() => {
    if (isAdmin) {
      api.getAllEmailAccounts()
        .then((data) => setClients(data || []))
        .catch((err) => console.error("Failed to fetch clients for admin inbox:", err));
    }
  }, [isAdmin]);

  // Initial Load
  useEffect(() => {
    if (selectedClientId) {
      fetchEmails(false, selectedClientId);
      fetchPausedEmails(selectedClientId);
      fetchPausedHistory(selectedClientId);
      fetchBlockedEmails(selectedClientId);
      fetchMarketingSenders(selectedClientId);
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
      try {
        ws = new WebSocket(wsUrl);
        ws.onopen = () => {
          console.log("⚡ Real-time WebSocket connected for inbox sync");
        };
        ws.onmessage = (event) => {
          try {
            const message = JSON.parse(event.data);
            if (message.type === 'NEW_EMAIL' && (selectedClientId === 'ALL' || message.client_id === selectedClientId)) {
              fetchEmails(true, selectedClientId);
              fetchPausedHistory(selectedClientId);
              fetchBlockedEmails(selectedClientId);
              fetchPausedEmails(selectedClientId);
              fetchMarketingSenders(selectedClientId);
            }
          } catch {
            // ignore non-json
          }
        };
        ws.onerror = (err) => {
          console.warn("WebSocket error, falling back to live poll:", err);
        };
        ws.onclose = () => {
          reconnectTimeout = setTimeout(connectWS, 4000);
        };
      } catch (err) {
        console.warn("WebSocket connection failed:", err);
      }
    };

    connectWS();

    // Fast background polling fallback (every 3.5s) to guarantee real-time updates under all conditions
    const pollInterval = setInterval(() => {
      fetchEmails(true, selectedClientId);
      fetchPausedHistory(selectedClientId);
      fetchBlockedEmails(selectedClientId);
      fetchPausedEmails(selectedClientId);
    }, 3500);

    return () => {
      if (ws) ws.close();
      if (reconnectTimeout) clearTimeout(reconnectTimeout);
      clearInterval(pollInterval);
    };
  }, [selectedClientId]);

  // Normalize subject to strip Re/Fwd prefixes for thread grouping
  const normalizeSubject = (subj: string) => {
    if (!subj) return 'No Subject';
    return subj.replace(/^(Re|RE|Fwd|FWD|fwd|re):\s*/i, '').trim();
  };

  // Grouped conversation threads
  const getGroupedThreads = () => {
    const threadMap: Record<string, any> = {};

    emailsList.forEach((email) => {
      const normSubj = normalizeSubject(email.subject);
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
      thread.emails.sort((a: any, b: any) => a.id - b.id);
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

    return threads.sort((a, b) => b.latest_email.id - a.latest_email.id);
  };

  const groupedThreads = getGroupedThreads();

  // Filter regular threads
  const filteredThreads = groupedThreads.filter(thread => {
    const latestStatus = (thread.latest_email.status || '').toLowerCase();
    const isMarketing = (
      thread.latest_email.category === 'Marketing / Promo' ||
      latestStatus === 'no action needed' ||
      thread.latest_email.raw_status === 'no_action_needed' ||
      thread.latest_email.raw_status === 'handled' ||
      isSenderMarketing(thread.sender)
    );

    const matchesTab = activeTab === 'All' || 
      (activeTab === 'Marketing' && isMarketing) ||
      (activeTab === 'Replied' && latestStatus === 'replied') ||
      (activeTab === 'Processing' && latestStatus === 'processing') ||
      (activeTab === 'Failed' && latestStatus === 'failed');
    
    const query = searchQuery.toLowerCase();
    const matchesSearch = 
      !query ||
      thread.sender.toLowerCase().includes(query) ||
      thread.subject.toLowerCase().includes(query) ||
      thread.emails.some((email: any) => 
        (email.preview || '').toLowerCase().includes(query) ||
        (email.reply || '').toLowerCase().includes(query)
      );
      
    return matchesTab && matchesSearch;
  });

  // Filter paused items (from paused_email_history & active paused threads)
  const filteredPausedHistory = pausedHistory.filter(item => {
    const query = searchQuery.toLowerCase();
    return !query || 
      (item.from_email || '').toLowerCase().includes(query) ||
      (item.subject || '').toLowerCase().includes(query) ||
      (item.body || '').toLowerCase().includes(query);
  });

  // Filter blocked emails
  const filteredBlockedEmails = blockedEmails.filter(item => {
    const query = searchQuery.toLowerCase();
    return !query || 
      (item.from_email || '').toLowerCase().includes(query) ||
      (item.subject || '').toLowerCase().includes(query) ||
      (item.body || '').toLowerCase().includes(query) ||
      (item.matched_keyword || '').toLowerCase().includes(query);
  });

  useEffect(() => {
    if (activeTab === 'Blocked') {
      if (filteredBlockedEmails.length > 0) {
        if (!selectedBlockedItem) {
          setSelectedBlockedItem(filteredBlockedEmails[0]);
        } else {
          const updated = filteredBlockedEmails.find(b => b.id === selectedBlockedItem.id);
          if (updated) setSelectedBlockedItem(updated);
        }
      } else {
        setSelectedBlockedItem(null);
      }
    } else if (activeTab === 'Paused') {
      if (filteredPausedHistory.length > 0) {
        if (!selectedPausedItem) {
          setSelectedPausedItem(filteredPausedHistory[0]);
        } else {
          const updated = filteredPausedHistory.find(p => p.id === selectedPausedItem.id);
          if (updated) setSelectedPausedItem(updated);
        }
      } else {
        setSelectedPausedItem(null);
      }
    } else {
      if (filteredThreads.length > 0) {
        if (!selectedThread) {
          setSelectedThread(filteredThreads[0]);
        } else {
          const updated = filteredThreads.find(t => t.key === selectedThread.key || t.sender.toLowerCase() === selectedThread.sender?.toLowerCase());
          if (updated) {
            setSelectedThread(updated);
          } else {
            setSelectedThread(filteredThreads[0]);
          }
        }
      } else {
        setSelectedThread(null);
      }
    }
  }, [emailsList, blockedEmails, pausedHistory, activeTab]);

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(''), 4000);
  };

  const handleCreateTicket = async (email: any) => {
    const activeCid = selectedClientId === "ALL" ? (email.client_id || '') : selectedClientId;
    if (!activeCid || !email) {
      showToast('Error: No active email or client session found');
      return;
    }
    setTicketLoadingId(email.id);
    try {
      const res = await api.createTicket({
        client_id: activeCid,
        mail_id: email.mailId || email.id?.toString(),
        subject: email.subject,
        body: email.preview || email.body,
        status: 'Ticket_Generated'
      });
      showToast(`Ticket generated! Reference: ${res.ticket_id}`);
      fetchEmails(true, selectedClientId);
    } catch (err: any) {
      showToast(`Error: ${err.message}`);
    } finally {
      setTicketLoadingId(null);
    }
  };

  const handlePauseToggle = async (email: string) => {
    const isPaused = pausedEmails.includes(email);
    const activeCid = selectedClientId === "ALL" ? (selectedThread?.latest_email?.client_id || clients[0]?.client_id || '') : selectedClientId;
    if (!activeCid) return;
    try {
      if (isPaused) {
        await api.unpauseEmail({ client_id: activeCid, email });
        setPausedEmails(prev => prev.filter(e => e !== email));
        showToast(`Auto-replies resumed for ${email}`);
      } else {
        await api.pauseEmail({ client_id: activeCid, email });
        setPausedEmails(prev => [...prev, email]);
        showToast(`Auto-replies paused for ${email}`);
      }
      fetchPausedEmails(activeCid);
    } catch (err: any) {
      showToast(`Error: ${err.message}`);
    }
  };

  const handleSendManualReply = async (
    recipientEmail?: string, 
    recipientSubject?: string, 
    recipientBody?: string, 
    options?: { blockedRecordId?: number; pausedRecordId?: number }
  ) => {
    const targetEmail = recipientEmail || selectedThread?.sender;
    const targetSubj = recipientSubject || selectedThread?.subject;
    const targetBody = recipientBody || (selectedThread?.latest_email?.body || selectedThread?.latest_email?.preview || "");
    const activeCid = selectedClientId === "ALL" ? (selectedThread?.latest_email?.client_id || clients[0]?.client_id || '') : selectedClientId;

    if (!targetEmail || !replyText.trim() || !activeCid) return;
    setReplyLoading(true);
    try {
      await api.sendManualReply({
        client_id: activeCid,
        to_email: targetEmail,
        subject: `Re: ${targetSubj}`,
        body: targetBody,
        reply_text: replyText
      });

      if (options?.blockedRecordId) {
        await api.updateBlockedEmailStatus(activeCid, options.blockedRecordId, 'replied');
        fetchBlockedEmails(activeCid);
      }

      if (options?.pausedRecordId) {
        await api.updatePausedEmailHistoryStatus(activeCid, options.pausedRecordId, 'replied');
        fetchPausedHistory(activeCid);
      }

      showToast('Manual reply sent successfully!');
      setReplyText('');
      setIsReplying(false);
      fetchEmails(true, selectedClientId);
    } catch (err: any) {
      showToast(`Error sending reply: ${err.message}`);
    } finally {
      setReplyLoading(false);
    }
  };

  const handleUpdateBlockedStatus = async (recordId: number, status: 'ignored' | 'replied') => {
    const activeCid = selectedClientId === "ALL" ? (clients[0]?.client_id || '') : selectedClientId;
    if (!activeCid) return;
    try {
      await api.updateBlockedEmailStatus(activeCid, recordId, status);
      showToast(`Email marked as ${status}.`);
      fetchBlockedEmails(activeCid);
    } catch (err: any) {
      showToast(`Error updating status: ${err.message}`);
    }
  };

  const handleUpdatePausedHistoryStatus = async (recordId: number, status: 'ignored' | 'replied') => {
    const activeCid = selectedClientId === "ALL" ? (clients[0]?.client_id || '') : selectedClientId;
    if (!activeCid) return;
    try {
      await api.updatePausedEmailHistoryStatus(activeCid, recordId, status);
      showToast(`Paused email marked as ${status}.`);
      fetchPausedHistory(activeCid);
    } catch (err: any) {
      showToast(`Error updating status: ${err.message}`);
    }
  };

  const handleBulkIgnoreBlocked = async () => {
    const activeCid = selectedClientId === "ALL" ? (clients[0]?.client_id || '') : selectedClientId;
    if (!activeCid) return;
    if (!window.confirm("Mark all pending review blocked emails as ignored?")) return;
    try {
      const res = await api.bulkIgnoreBlockedEmails(activeCid);
      showToast(`Marked ${res.rows_updated || 0} emails as ignored.`);
      fetchBlockedEmails(activeCid);
    } catch (err: any) {
      showToast(err.message || 'Bulk ignore failed');
    }
  };

  const handleResumeAllPaused = async () => {
    const activeCid = selectedClientId === "ALL" ? (clients[0]?.client_id || '') : selectedClientId;
    if (!activeCid || pausedEmails.length === 0) return;
    if (!window.confirm(`Resume auto-replies for all ${pausedEmails.length} paused contact(s)?`)) return;
    try {
      await Promise.all(pausedEmails.map(email => api.unpauseEmail({ client_id: activeCid, email })));
      setPausedEmails([]);
      showToast('All contacts resumed.');
      fetchPausedEmails(activeCid);
    } catch (err: any) {
      showToast(err.message || 'Failed to resume all');
    }
  };

  const handleClearHistory = async (senderEmail: string) => {
    const activeCid = selectedClientId === "ALL" ? (selectedThread?.latest_email?.client_id || clients[0]?.client_id || '') : selectedClientId;
    if (!activeCid) return;
    if (!window.confirm("Reset the AI conversation memory and verification cache for this sender?")) return;
    try {
      await api.clearChatHistory(activeCid, senderEmail);
      showToast('Conversation memory reset.');
    } catch (err: any) {
      showToast(err.message || 'Failed to reset session.');
    }
  };

  const handleToggleMarketingSender = async (senderEmail: string) => {
    const activeCid = selectedClientId === "ALL" ? (selectedThread?.latest_email?.client_id || clients[0]?.client_id || '') : selectedClientId;
    if (!activeCid || !senderEmail) return;
    const isMarked = isSenderMarketing(senderEmail);
    try {
      if (isMarked) {
        await api.unmarkMarketingSender({ client_id: activeCid, sender_email: senderEmail });
        showToast(`${senderEmail} removed from Marketing list.`);
      } else {
        await api.markMarketingSender({ client_id: activeCid, sender_email: senderEmail });
        showToast(`${senderEmail} marked as Marketing / Promotional.`);
      }
      fetchMarketingSenders(activeCid);
      fetchEmails(true, selectedClientId);
    } catch (err: any) {
      showToast(err.message || 'Failed to update marketing sender');
    }
  };

  const blockedPendingCount = blockedEmails.filter(b => b.status === 'pending_review' || !b.status).length;
  const pausedPendingCount = pausedHistory.filter(p => p.status === 'pending_review' || !p.status).length;
  const totalPausedBadge = pausedPendingCount > 0 ? pausedPendingCount : pausedEmails.length;
  const marketingCount = groupedThreads.filter(t => t.latest_email.category === 'Marketing / Promo' || (t.latest_email.status || '').toLowerCase() === 'no action needed' || t.latest_email.raw_status === 'no_action_needed' || isSenderMarketing(t.sender)).length;

  if (loading) {
    return (
      <div className="h-[calc(100vh-140px)] flex flex-col items-center justify-center space-y-3">
        <Loader2 className="w-8 h-8 text-primary animate-spin" />
        <p className="text-xs text-muted-foreground font-medium">Loading inbox conversations...</p>
      </div>
    );
  }

  return (
    <div className="flex h-[calc(100vh-140px)] gap-5">
      {/* Left Sidebar: Threads / Paused / Blocked List */}
      <div className="w-full md:w-[380px] lg:w-[420px] flex-shrink-0 rounded-2xl border border-zinc-200 dark:border-white/10 bg-card flex flex-col overflow-hidden shadow-sm">
        {/* Sidebar Header */}
        <div className="p-4 border-b border-zinc-200 dark:border-white/10 space-y-3 bg-zinc-50/50 dark:bg-white/[0.02]">
          <div className="flex justify-between items-center">
            <h2 className="text-base font-bold tracking-tight">Mail (Monitor/Control)</h2>
            <button 
              onClick={() => {
                fetchEmails(false, selectedClientId);
                fetchBlockedEmails(selectedClientId);
                fetchPausedEmails(selectedClientId);
                fetchPausedHistory(selectedClientId);
                fetchMarketingSenders(selectedClientId);
              }} 
              className="p-1.5 rounded-lg hover:bg-zinc-200 dark:hover:bg-white/10 text-muted-foreground hover:text-foreground transition-colors" 
              title="Refresh"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>

          {isAdmin && clients.length > 0 && (
            <div className="flex items-center gap-2 bg-zinc-100 dark:bg-white/5 border border-zinc-200 dark:border-white/10 rounded-xl px-2.5 py-1.5 text-xs">
              <span className="text-muted-foreground font-semibold text-[11px]">Client:</span>
              <select
                value={selectedClientId}
                onChange={(e) => setSelectedClientId(e.target.value)}
                className="bg-transparent font-medium text-foreground focus:outline-none cursor-pointer flex-1 text-xs"
              >
                <option value="ALL" className="dark:bg-zinc-900">All Clients</option>
                {clients.map((c) => (
                  <option key={c.client_id} value={c.client_id} className="dark:bg-zinc-900">
                    {c.client_id} {c.company_name ? `(${c.company_name})` : ''}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Filter & Search Bar */}
          <div className="flex items-center gap-2">
            {/* View Filter Dropdown */}
            <div className="flex items-center gap-1.5 bg-zinc-100 dark:bg-white/5 border border-zinc-200 dark:border-white/10 rounded-xl px-2.5 py-1.5 text-xs shrink-0">
              <Filter className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
              <select
                value={activeTab}
                onChange={(e) => {
                  setActiveTab(e.target.value as any);
                  setIsReplying(false);
                  setReplyText('');
                }}
                className="bg-transparent font-semibold text-foreground focus:outline-none cursor-pointer text-xs pr-1"
              >
                <option value="All" className="dark:bg-zinc-900">All ({groupedThreads.length})</option>
                <option value="Marketing" className="dark:bg-zinc-900">
                  Marketing {marketingCount > 0 ? `(${marketingCount})` : ''}
                </option>
                <option value="Replied" className="dark:bg-zinc-900">Replied</option>
                <option value="Processing" className="dark:bg-zinc-900">Processing</option>
                <option value="Failed" className="dark:bg-zinc-900">Failed</option>
                <option value="Paused" className="dark:bg-zinc-900">
                  Paused {totalPausedBadge > 0 ? `(${totalPausedBadge})` : ''}
                </option>
                <option value="Blocked" className="dark:bg-zinc-900">
                  Blocked {blockedPendingCount > 0 ? `(${blockedPendingCount})` : ''}
                </option>
              </select>
            </div>

            {/* Search bar */}
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
              <input 
                type="text" 
                placeholder={
                  activeTab === 'Blocked' 
                    ? "Search blocked..." 
                    : activeTab === 'Paused'
                    ? "Search paused..."
                    : "Search..."
                }
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-zinc-100 dark:bg-white/5 border border-zinc-200 dark:border-white/10 rounded-xl pl-8 pr-2.5 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-primary" 
              />
            </div>
          </div>
        </div>

        {/* Paused Banner with Resume All */}
        {activeTab === 'Paused' && (
          <div className="px-4 py-2 bg-amber-500/10 border-b border-amber-500/20 text-[11px] text-amber-700 dark:text-amber-300 flex items-center justify-between">
            <div className="flex items-center gap-1.5 font-medium">
              <PauseCircle className="w-3.5 h-3.5 text-amber-500" />
              <span>{pausedEmails.length} sender(s) paused • {pausedPendingCount} pending review</span>
            </div>
            {pausedEmails.length > 0 && (
              <button
                onClick={handleResumeAllPaused}
                className="text-[10px] px-2 py-0.5 rounded bg-amber-500/20 hover:bg-amber-500/30 text-amber-700 dark:text-amber-300 font-semibold transition-all flex items-center gap-1"
                title="Resume auto-replies for all paused contacts"
              >
                <PlayCircle className="w-3 h-3" />
                Resume All
              </button>
            )}
          </div>
        )}

        {/* Blocked Banner with Bulk Ignore */}
        {activeTab === 'Blocked' && (
          <div className="px-4 py-2 bg-rose-500/10 border-b border-rose-500/20 text-[11px] text-rose-700 dark:text-rose-300 flex items-center justify-between">
            <div className="flex items-center gap-1.5 font-medium">
              <ShieldAlert className="w-3.5 h-3.5 text-rose-500" />
              <span>{blockedPendingCount} pending review</span>
            </div>
            {blockedPendingCount > 0 && (
              <button
                onClick={handleBulkIgnoreBlocked}
                className="text-[10px] px-2 py-0.5 rounded bg-rose-500/20 hover:bg-rose-500/30 text-rose-700 dark:text-rose-300 font-semibold transition-all flex items-center gap-1"
              >
                <CheckCheck className="w-3 h-3" />
                Ignore All
              </button>
            )}
          </div>
        )}

        {/* Sidebar Item List */}
        <div className="flex-1 overflow-y-auto p-2 space-y-1 divide-y divide-zinc-100 dark:divide-white/[0.03]">
          {activeTab === 'Paused' ? (
            /* Paused Incoming Emails List */
            filteredPausedHistory.length > 0 ? (
              filteredPausedHistory.map((item) => {
                const isSelected = selectedPausedItem?.id === item.id;
                return (
                  <div
                    key={item.id}
                    onClick={() => {
                      setSelectedPausedItem(item);
                      setIsReplying(false);
                      setReplyText('');
                    }}
                    className={cn(
                      "p-3.5 rounded-xl cursor-pointer transition-all duration-150 border text-left",
                      isSelected 
                        ? "bg-amber-500/10 border-amber-500/20 shadow-sm" 
                        : "border-transparent hover:bg-zinc-100/70 dark:hover:bg-white/5"
                    )}
                  >
                    <div className="flex justify-between items-baseline mb-1">
                      <span className="font-semibold text-xs text-foreground truncate pr-2">
                        {item.from_email}
                      </span>
                      <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                        {item.created_at?.split(' ')[1] || item.created_at || ''}
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5 mb-1">
                      <p className="text-xs font-medium text-foreground/90 truncate flex-1">
                        {item.subject || 'No Subject'}
                      </p>
                    </div>

                    <p className="text-[11px] text-muted-foreground truncate line-clamp-1 mb-2">
                      {item.body}
                    </p>

                    <div className="flex items-center justify-between pt-1">
                      <span className="text-[10px] px-2 py-0.5 rounded-md font-semibold bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center gap-1">
                        <PauseCircle className="w-2.5 h-2.5" />
                        Paused Mail
                      </span>

                      <span className={cn(
                        "text-[10px] px-2 py-0.5 rounded font-medium",
                        item.status === 'replied' ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" :
                        item.status === 'ignored' ? "bg-zinc-500/10 text-muted-foreground" :
                        "bg-amber-500/10 text-amber-600 dark:text-amber-400 font-semibold"
                      )}>
                        {item.status === 'replied' ? 'Replied' : item.status === 'ignored' ? 'Ignored' : 'Pending Review'}
                      </span>
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="h-full flex flex-col items-center justify-center p-8 text-center space-y-2 text-muted-foreground">
                <PauseCircle className="w-8 h-8 opacity-40 text-amber-500" />
                <p className="text-xs font-medium">No incoming emails captured while paused.</p>
                {pausedEmails.length > 0 && (
                  <p className="text-[11px] text-muted-foreground/80">
                    {pausedEmails.length} contact(s) are currently paused. When they send emails, they will appear here.
                  </p>
                )}
              </div>
            )
          ) : activeTab === 'Blocked' ? (
            /* Blocked Emails List */
            filteredBlockedEmails.length > 0 ? (
              filteredBlockedEmails.map((item) => {
                const isSelected = selectedBlockedItem?.id === item.id;
                return (
                  <div
                    key={item.id}
                    onClick={() => {
                      setSelectedBlockedItem(item);
                      setIsReplying(false);
                      setReplyText('');
                    }}
                    className={cn(
                      "p-3.5 rounded-xl cursor-pointer transition-all duration-150 border text-left",
                      isSelected 
                        ? "bg-rose-500/10 border-rose-500/20 shadow-sm" 
                        : "border-transparent hover:bg-zinc-100/70 dark:hover:bg-white/5"
                    )}
                  >
                    <div className="flex justify-between items-baseline mb-1">
                      <span className="font-semibold text-xs text-foreground truncate pr-2">
                        {item.from_email}
                      </span>
                      <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                        {item.created_at?.split(' ')[1] || item.created_at || ''}
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5 mb-1">
                      <p className="text-xs font-medium text-foreground/90 truncate flex-1">
                        {item.subject || 'No Subject'}
                      </p>
                    </div>

                    <p className="text-[11px] text-muted-foreground truncate line-clamp-1 mb-2">
                      {item.body}
                    </p>

                    <div className="flex items-center justify-between pt-1">
                      <span className="text-[10px] px-2 py-0.5 rounded-md font-semibold bg-rose-500/10 text-rose-600 dark:text-rose-400 flex items-center gap-1">
                        <Ban className="w-2.5 h-2.5" />
                        "{item.matched_keyword}"
                      </span>

                      <span className={cn(
                        "text-[10px] px-2 py-0.5 rounded font-medium",
                        item.status === 'replied' ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" :
                        item.status === 'ignored' ? "bg-zinc-500/10 text-muted-foreground" :
                        "bg-amber-500/10 text-amber-600 dark:text-amber-400 font-semibold"
                      )}>
                        {item.status === 'replied' ? 'Replied' : item.status === 'ignored' ? 'Ignored' : 'Pending Review'}
                      </span>
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="h-full flex flex-col items-center justify-center p-8 text-center space-y-2 text-muted-foreground">
                <ShieldAlert className="w-8 h-8 opacity-40 text-rose-500" />
                <p className="text-xs font-medium">No emails blocked by keywords found.</p>
              </div>
            )
          ) : (
            /* Regular Conversation Thread List */
            filteredThreads.length > 0 ? (
              filteredThreads.map((thread) => {
                const isSelected = selectedThread?.key === thread.key;
                const isSenderPaused = pausedEmails.includes(thread.sender);
                return (
                  <div
                    key={thread.key}
                    onClick={() => {
                      setSelectedThread(thread);
                      setIsReplying(false);
                      setReplyText('');
                    }}
                    className={cn(
                      "p-3.5 rounded-xl cursor-pointer transition-all duration-150 border text-left",
                      isSelected 
                        ? isSenderPaused 
                          ? "bg-amber-500/10 border-amber-500/20 shadow-sm" 
                          : "bg-primary/10 border-primary/20 shadow-sm" 
                        : "border-transparent hover:bg-zinc-100/70 dark:hover:bg-white/5"
                    )}
                  >
                    <div className="flex justify-between items-baseline mb-1">
                      <span className="font-semibold text-xs text-foreground truncate pr-2">
                        {thread.sender}
                      </span>
                      <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                        {thread.time}
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5 mb-1">
                      <p className="text-xs font-medium text-foreground/90 truncate flex-1">
                        {thread.subject}
                      </p>
                      {thread.emails.length > 1 && (
                        <span className="bg-zinc-200 dark:bg-white/10 text-muted-foreground text-[10px] font-bold px-1.5 py-0.2 rounded-full shrink-0">
                          {thread.emails.length}
                        </span>
                      )}
                    </div>

                    <p className="text-[11px] text-muted-foreground truncate line-clamp-1 mb-2">
                      {getCleanSnippet(thread.latest_email.preview || thread.latest_email.body)}
                    </p>

                    <div className="flex items-center justify-between pt-1">
                      <div className="flex items-center gap-1.5">
                        <span className={cn("text-[10px] px-2 py-0.5 rounded-md font-semibold", 
                          thread.status === 'Replied' ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' :
                          thread.status === 'Failed' ? 'bg-rose-500/10 text-rose-600 dark:text-rose-400' :
                          thread.status === 'Processing' ? 'bg-blue-500/10 text-blue-600 dark:text-blue-400' :
                          thread.status === 'No Action Needed' ? 'bg-sky-500/10 text-sky-600 dark:text-sky-400 border border-sky-500/20' :
                          thread.status === 'Pending Review' ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400' :
                          'bg-purple-500/10 text-purple-600 dark:text-purple-400'
                        )}>
                          {thread.status}
                        </span>
                        {isSenderPaused && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-600 font-medium">
                            Paused
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                        {thread.sentiment && (
                          <span className={cn(
                            "inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-semibold border",
                            thread.sentiment === 'Angry' ? 'bg-rose-500/10 text-rose-500 border-rose-500/20' :
                            thread.sentiment === 'Happy' ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' :
                            'bg-zinc-500/10 text-zinc-400 border-zinc-500/20'
                          )}>
                            {thread.sentiment === 'Angry' ? <Frown className="w-2.5 h-2.5" /> :
                             thread.sentiment === 'Happy' ? <Smile className="w-2.5 h-2.5" /> :
                             <Meh className="w-2.5 h-2.5" />}
                            {thread.sentiment}
                          </span>
                        )}
                        <div className="flex items-center gap-1">
                          <span className={cn("w-1.5 h-1.5 rounded-full",
                            thread.priority === 'High' || thread.priority === 'Critical' ? 'bg-rose-500' :
                            thread.priority === 'Medium' ? 'bg-blue-500' : 'bg-zinc-400'
                          )} />
                          <span>{thread.priority}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="h-full flex flex-col items-center justify-center p-8 text-center space-y-2 text-muted-foreground">
                <InboxIcon className="w-8 h-8 opacity-40" />
                <p className="text-xs font-medium">No matching conversations found.</p>
              </div>
            )
          )}
        </div>
      </div>

      {/* Right Pane: Reading / Action View */}
      {activeTab === 'Paused' ? (
        /* Paused Email Detail View */
        selectedPausedItem ? (
          <div className="flex-1 rounded-2xl border border-zinc-200 dark:border-white/10 bg-card flex flex-col overflow-hidden shadow-sm relative">
            {/* Toast Notification */}
            <AnimatePresence>
              {toastMsg && (
                <motion.div 
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="absolute top-4 left-1/2 -translate-x-1/2 bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 px-4 py-2 rounded-xl text-xs font-semibold z-50 shadow-xl"
                >
                  {toastMsg}
                </motion.div>
              )}
            </AnimatePresence>

            {/* Paused Header */}
            <div className="p-5 border-b border-zinc-200 dark:border-white/10 flex flex-col sm:flex-row justify-between sm:items-center gap-3 bg-zinc-50/50 dark:bg-white/[0.01]">
              <div className="space-y-1 min-w-0">
                <h2 className="text-base sm:text-lg font-bold text-foreground truncate">
                  {selectedPausedItem.subject || 'No Subject'}
                </h2>
                <p className="text-xs text-muted-foreground flex items-center gap-2">
                  <span className="font-medium text-foreground">{selectedPausedItem.from_email}</span>
                  <span>•</span>
                  <span>Received: {selectedPausedItem.created_at}</span>
                </p>
              </div>

              {/* Actions Toolbar */}
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handlePauseToggle(selectedPausedItem.from_email)}
                  className="px-3 py-1.5 border border-amber-500/30 bg-amber-500/10 hover:bg-amber-500/20 text-amber-600 dark:text-amber-400 rounded-xl text-xs font-semibold transition-all flex items-center gap-1.5"
                  title="Resume automated bot replies for this sender"
                >
                  <PlayCircle className="w-3.5 h-3.5" />
                  Resume Bot
                </button>

                {(!selectedPausedItem.status || selectedPausedItem.status === 'pending_review') && (
                  <button
                    onClick={() => handleUpdatePausedHistoryStatus(selectedPausedItem.id, 'ignored')}
                    className="px-3 py-1.5 border border-zinc-200 dark:border-white/10 text-muted-foreground hover:text-foreground hover:bg-zinc-100 dark:hover:bg-white/5 rounded-xl text-xs font-semibold transition-all"
                  >
                    Mark Ignored
                  </button>
                )}

                <button 
                  onClick={() => setIsReplying(!isReplying)}
                  className={cn("px-3 py-1.5 rounded-xl text-xs font-semibold transition-all flex items-center gap-1.5 border", 
                    isReplying 
                      ? "bg-primary text-primary-foreground border-primary" 
                      : "bg-primary/10 border-primary/20 text-primary hover:bg-primary/20"
                  )}
                >
                  <Reply className="w-3.5 h-3.5" />
                  Manual Reply
                </button>

                <button 
                  onClick={() => handleCreateTicket({
                    client_id: selectedClientId,
                    mailId: selectedPausedItem.id?.toString(),
                    subject: selectedPausedItem.subject,
                    body: selectedPausedItem.body,
                    preview: selectedPausedItem.body
                  })}
                  disabled={ticketLoadingId === selectedPausedItem.id} 
                  className="px-3 py-1.5 border border-zinc-200 dark:border-white/10 hover:bg-zinc-100 dark:hover:bg-white/5 text-foreground rounded-xl text-xs font-semibold transition-all flex items-center gap-1"
                >
                  {ticketLoadingId === selectedPausedItem.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Ticket className="w-3 h-3" />}
                  Create Ticket
                </button>
              </div>
            </div>

            {/* Paused Notice Card */}
            <div className="mx-6 mt-4 p-3.5 rounded-xl border border-amber-500/20 bg-amber-500/5 flex items-start gap-3 text-xs">
              <PauseCircle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
              <div className="space-y-0.5">
                <span className="font-bold text-amber-600 dark:text-amber-400 text-[11px] uppercase tracking-wider">
                  Incoming Email Routed While Paused
                </span>
                <p className="text-foreground/90 leading-relaxed font-medium">
                  Auto-replies for <strong>{selectedPausedItem.from_email}</strong> were paused when this message arrived. Send a manual reply below or click <strong>Resume Bot</strong> to re-enable automation.
                </p>
              </div>
            </div>

            {/* Message Body */}
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              <div className="rounded-2xl border border-zinc-200 dark:border-white/10 bg-zinc-50/50 dark:bg-white/[0.02] p-5 space-y-3">
                <div className="flex justify-between items-center pb-2 border-b border-zinc-200/60 dark:border-white/5 text-xs text-muted-foreground">
                  <span className="font-semibold text-foreground">{selectedPausedItem.from_email}</span>
                  <span>{selectedPausedItem.created_at}</span>
                </div>
                <EmailBodyWithDisclaimer content={selectedPausedItem.body} className="text-sm text-foreground/90" />
              </div>
            </div>

            {/* Manual Reply Box for Paused Mail */}
            <AnimatePresence>
              {isReplying && (
                <motion.div 
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="border-t border-zinc-200 dark:border-white/10 bg-zinc-50/50 dark:bg-white/[0.02] p-4"
                >
                  <div className="space-y-3">
                    <div className="flex justify-between items-center text-xs">
                      <span className="font-semibold text-foreground">
                        Manual Reply to {selectedPausedItem.from_email}
                      </span>
                      <button onClick={() => setIsReplying(false)} className="text-muted-foreground hover:text-foreground">
                        <X className="w-4 h-4" />
                      </button>
                    </div>

                    <textarea 
                      value={replyText}
                      onChange={(e) => setReplyText(e.target.value)}
                      placeholder="Type your manual reply here..."
                      rows={4}
                      className="w-full bg-background border border-zinc-200 dark:border-white/10 rounded-xl p-3 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 resize-none font-sans"
                    />

                    <div className="flex justify-end gap-2">
                      <button 
                        onClick={() => setIsReplying(false)}
                        className="px-3.5 py-1.5 rounded-xl text-xs font-semibold text-muted-foreground hover:bg-zinc-100 dark:hover:bg-white/5"
                      >
                        Cancel
                      </button>
                      <button 
                        onClick={() => handleSendManualReply(selectedPausedItem.from_email, selectedPausedItem.subject, selectedPausedItem.body, { pausedRecordId: selectedPausedItem.id })}
                        disabled={replyLoading || !replyText.trim()}
                        className="px-4 py-1.5 bg-primary text-primary-foreground rounded-xl text-xs font-semibold hover:bg-primary/90 transition-all flex items-center gap-1.5 disabled:opacity-50 shadow-sm"
                      >
                        {replyLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                        Send Reply & Mark Handled
                      </button>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        ) : (
          <div className="flex-1 rounded-2xl border border-zinc-200 dark:border-white/10 bg-card flex flex-col items-center justify-center p-8 text-center space-y-3">
            <div className="p-3 rounded-2xl bg-amber-500/10">
              <PauseCircle className="w-8 h-8 text-amber-500" />
            </div>
            <h3 className="text-sm font-semibold text-foreground">Select a paused email</h3>
            <p className="text-xs text-muted-foreground max-w-sm">
              Incoming emails from paused contacts are collected here for your review and manual dispatch.
            </p>
          </div>
        )
      ) : activeTab === 'Blocked' ? (
        /* Blocked Email Detail View */
        selectedBlockedItem ? (
          <div className="flex-1 rounded-2xl border border-zinc-200 dark:border-white/10 bg-card flex flex-col overflow-hidden shadow-sm relative">
            {/* Toast Notification */}
            <AnimatePresence>
              {toastMsg && (
                <motion.div 
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="absolute top-4 left-1/2 -translate-x-1/2 bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 px-4 py-2 rounded-xl text-xs font-semibold z-50 shadow-xl"
                >
                  {toastMsg}
                </motion.div>
              )}
            </AnimatePresence>

            {/* Blocked Header */}
            <div className="p-5 border-b border-zinc-200 dark:border-white/10 flex flex-col sm:flex-row justify-between sm:items-center gap-3 bg-zinc-50/50 dark:bg-white/[0.01]">
              <div className="space-y-1 min-w-0">
                <h2 className="text-base sm:text-lg font-bold text-foreground truncate flex items-center gap-2">
                  {selectedBlockedItem.subject || 'No Subject'}
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20">
                    <Ban className="w-3 h-3" /> Keyword: "{selectedBlockedItem.matched_keyword}"
                  </span>
                </h2>
                <p className="text-xs text-muted-foreground flex items-center gap-2">
                  <span className="font-medium text-foreground">{selectedBlockedItem.from_email}</span>
                  <span>•</span>
                  <span>Received: {selectedBlockedItem.created_at}</span>
                </p>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-2">
                {(!selectedBlockedItem.status || selectedBlockedItem.status === 'pending_review') && (
                  <button
                    onClick={() => handleUpdateBlockedStatus(selectedBlockedItem.id, 'ignored')}
                    className="px-3 py-1.5 border border-zinc-200 dark:border-white/10 text-muted-foreground hover:text-foreground hover:bg-zinc-100 dark:hover:bg-white/5 rounded-xl text-xs font-semibold transition-all"
                  >
                    Mark Ignored
                  </button>
                )}

                <button 
                  onClick={() => setIsReplying(!isReplying)}
                  className={cn("px-3 py-1.5 rounded-xl text-xs font-semibold transition-all flex items-center gap-1.5 border", 
                    isReplying 
                      ? "bg-primary text-primary-foreground border-primary" 
                      : "bg-primary/10 border-primary/20 text-primary hover:bg-primary/20"
                  )}
                >
                  <Reply className="w-3.5 h-3.5" />
                  Manual Reply
                </button>

                <button 
                  onClick={() => handleCreateTicket({
                    client_id: selectedClientId,
                    mailId: selectedBlockedItem.id?.toString(),
                    subject: selectedBlockedItem.subject,
                    body: selectedBlockedItem.body,
                    preview: selectedBlockedItem.body
                  })}
                  disabled={ticketLoadingId === selectedBlockedItem.id} 
                  className="px-3 py-1.5 border border-zinc-200 dark:border-white/10 hover:bg-zinc-100 dark:hover:bg-white/5 text-foreground rounded-xl text-xs font-semibold transition-all flex items-center gap-1"
                >
                  {ticketLoadingId === selectedBlockedItem.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Ticket className="w-3 h-3" />}
                  Create Ticket
                </button>
              </div>
            </div>

            {/* Blocked Notice Card */}
            <div className="mx-6 mt-4 p-3.5 rounded-xl border border-rose-500/20 bg-rose-500/5 flex items-start gap-3 text-xs">
              <ShieldAlert className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
              <div className="space-y-0.5">
                <span className="font-bold text-rose-600 dark:text-rose-400 text-[11px] uppercase tracking-wider">
                  AI Auto-Reply Blocked by Keyword Rule
                </span>
                <p className="text-foreground/90 leading-relaxed font-medium">
                  This message triggered keyword filter <strong>"{selectedBlockedItem.matched_keyword}"</strong> and was diverted from automated responses. You can review and reply manually below.
                </p>
              </div>
            </div>

            {/* Message Body */}
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              <div className="rounded-2xl border border-zinc-200 dark:border-white/10 bg-zinc-50/50 dark:bg-white/[0.02] p-5 space-y-3">
                <div className="flex justify-between items-center pb-2 border-b border-zinc-200/60 dark:border-white/5 text-xs text-muted-foreground">
                  <span className="font-semibold text-foreground">{selectedBlockedItem.from_email}</span>
                  <span>{selectedBlockedItem.created_at}</span>
                </div>
                <EmailBodyWithDisclaimer content={selectedBlockedItem.body} className="text-sm text-foreground/90" />
              </div>
            </div>

            {/* Manual Reply Box for Blocked Mail */}
            <AnimatePresence>
              {isReplying && (
                <motion.div 
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="border-t border-zinc-200 dark:border-white/10 bg-zinc-50/50 dark:bg-white/[0.02] p-4"
                >
                  <div className="space-y-3">
                    <div className="flex justify-between items-center text-xs">
                      <span className="font-semibold text-foreground">
                        Manual Reply to {selectedBlockedItem.from_email}
                      </span>
                      <button onClick={() => setIsReplying(false)} className="text-muted-foreground hover:text-foreground">
                        <X className="w-4 h-4" />
                      </button>
                    </div>

                    <textarea 
                      value={replyText}
                      onChange={(e) => setReplyText(e.target.value)}
                      placeholder="Type your manual reply here..."
                      rows={4}
                      className="w-full bg-background border border-zinc-200 dark:border-white/10 rounded-xl p-3 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 resize-none font-sans"
                    />

                    <div className="flex justify-end gap-2">
                      <button 
                        onClick={() => setIsReplying(false)}
                        className="px-3.5 py-1.5 rounded-xl text-xs font-semibold text-muted-foreground hover:bg-zinc-100 dark:hover:bg-white/5"
                      >
                        Cancel
                      </button>
                      <button 
                        onClick={() => handleSendManualReply(selectedBlockedItem.from_email, selectedBlockedItem.subject, selectedBlockedItem.body, { blockedRecordId: selectedBlockedItem.id })}
                        disabled={replyLoading || !replyText.trim()}
                        className="px-4 py-1.5 bg-primary text-primary-foreground rounded-xl text-xs font-semibold hover:bg-primary/90 transition-all flex items-center gap-1.5 disabled:opacity-50 shadow-sm"
                      >
                        {replyLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                        Send Reply & Mark Handled
                      </button>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        ) : (
          <div className="flex-1 rounded-2xl border border-zinc-200 dark:border-white/10 bg-card flex flex-col items-center justify-center p-8 text-center space-y-3">
            <div className="p-3 rounded-2xl bg-rose-500/10">
              <ShieldAlert className="w-8 h-8 text-rose-500" />
            </div>
            <h3 className="text-sm font-semibold text-foreground">Select a blocked email</h3>
            <p className="text-xs text-muted-foreground max-w-sm">
              Emails diverted by blocked keyword filters appear here for manual review and response.
            </p>
          </div>
        )
      ) : selectedThread ? (
        /* Regular Thread View */
        <div className="flex-1 rounded-2xl border border-zinc-200 dark:border-white/10 bg-card flex flex-col overflow-hidden shadow-sm relative">
          {/* Toast Notification */}
          <AnimatePresence>
            {toastMsg && (
              <motion.div 
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="absolute top-4 left-1/2 -translate-x-1/2 bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 px-4 py-2 rounded-xl text-xs font-semibold z-50 shadow-xl"
              >
                {toastMsg}
              </motion.div>
            )}
          </AnimatePresence>

          {/* Conversation Header */}
          <div className="p-5 border-b border-zinc-200 dark:border-white/10 flex flex-col sm:flex-row justify-between sm:items-center gap-3 bg-zinc-50/50 dark:bg-white/[0.01]">
            <div className="space-y-1 min-w-0">
              <h2 className="text-base sm:text-lg font-bold text-foreground truncate">
                {selectedThread.subject}
              </h2>
              <p className="text-xs text-muted-foreground flex items-center gap-2">
                <span className="font-medium text-foreground">{selectedThread.sender}</span>
                <span>•</span>
                <span>{selectedThread.emails.length} {selectedThread.emails.length === 1 ? 'message' : 'messages'}</span>
              </p>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center gap-2">
              <button 
                onClick={() => handleToggleMarketingSender(selectedThread.sender)}
                className={cn("px-3 py-1.5 border rounded-xl text-xs font-semibold transition-all flex items-center gap-1.5",
                  isSenderMarketing(selectedThread.sender) 
                    ? "bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-500/30 hover:bg-sky-500/20" 
                    : "border-zinc-200 dark:border-white/10 text-muted-foreground hover:text-foreground hover:bg-zinc-100 dark:hover:bg-white/5"
                )}
                title={isSenderMarketing(selectedThread.sender) ? "Sender is marked as Marketing (click to unmark)" : "Mark sender as Marketing / Promotional"}
              >
                <Megaphone className="w-3.5 h-3.5" />
                {isSenderMarketing(selectedThread.sender) ? "Marked Marketing" : "Mark as Marketing"}
              </button>

              <button 
                onClick={() => handlePauseToggle(selectedThread.sender)}
                className={cn("px-3 py-1.5 border rounded-xl text-xs font-semibold transition-all flex items-center gap-1.5",
                  pausedEmails.includes(selectedThread.sender) 
                    ? "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30 hover:bg-amber-500/20" 
                    : "border-zinc-200 dark:border-white/10 text-muted-foreground hover:text-foreground hover:bg-zinc-100 dark:hover:bg-white/5"
                )}
              >
                {pausedEmails.includes(selectedThread.sender) ? <PlayCircle className="w-3.5 h-3.5" /> : <PauseCircle className="w-3.5 h-3.5" />}
                {pausedEmails.includes(selectedThread.sender) ? "Resume Bot" : "Pause Bot"}
              </button>

              <button 
                onClick={() => setIsReplying(!isReplying)}
                className={cn("px-3 py-1.5 rounded-xl text-xs font-semibold transition-all flex items-center gap-1.5 border", 
                  isReplying 
                    ? "bg-primary text-primary-foreground border-primary" 
                    : "border-zinc-200 dark:border-white/10 hover:bg-zinc-100 dark:hover:bg-white/5 text-foreground"
                )}
              >
                <Reply className="w-3.5 h-3.5" />
                Manual Reply
              </button>

              <button 
                onClick={() => handleClearHistory(selectedThread.sender)}
                className="p-1.5 border border-zinc-200 dark:border-white/10 hover:bg-rose-500/10 hover:text-rose-600 rounded-xl text-muted-foreground transition-all"
                title="Reset conversation context memory"
              >
                <RotateCcw className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Paused Mode Callout */}
          {pausedEmails.includes(selectedThread.sender) && (
            <div className="mx-6 mt-4 p-3.5 rounded-xl border border-amber-500/20 bg-amber-500/5 flex items-center justify-between text-xs">
              <div className="flex items-center gap-2 text-amber-700 dark:text-amber-300">
                <PauseCircle className="w-4 h-4 text-amber-500 shrink-0" />
                <span>Auto-replies are paused for this contact. Use <strong>Manual Reply</strong> to respond directly.</span>
              </div>
              <button
                onClick={() => setIsReplying(true)}
                className="px-3 py-1 bg-amber-500 text-white rounded-lg font-semibold hover:bg-amber-600 transition-all text-xs"
              >
                Reply Now
              </button>
            </div>
          )}

          {/* Quick Summary Bar (TL;DR if present) */}
          {selectedThread.latest_email.summary && (
            <div className="mx-6 mt-4 p-3.5 rounded-xl border border-primary/20 bg-primary/5 flex items-start gap-3 text-xs">
              <Sparkles className="w-4 h-4 text-primary shrink-0 mt-0.5" />
              <div className="space-y-0.5">
                <span className="font-bold text-primary text-[11px] uppercase tracking-wider">Conversation Summary</span>
                <p className="text-foreground/90 leading-relaxed font-medium">
                  {selectedThread.latest_email.summary}
                </p>
              </div>
            </div>
          )}

          {/* Messages Stream */}
          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            {selectedThread.emails.map((email: any, index: number) => {
              const isTraceOpen = showTraceFor === email.id;
              const hasReply = !!email.reply;
              return (
                <div key={email.id} className="space-y-3 text-xs">
                  {/* Customer Message Box */}
                  <div className="rounded-2xl border border-zinc-200 dark:border-white/10 bg-zinc-50/50 dark:bg-white/[0.02] p-4 sm:p-5 space-y-3">
                    <div className="flex justify-between items-center pb-2 border-b border-zinc-200/60 dark:border-white/5">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-[10px]">
                          {index + 1}
                        </div>
                        <span className="font-semibold text-foreground">{email.sender}</span>
                      </div>
                      
                      <div className="flex items-center gap-3 text-muted-foreground text-[11px]">
                        <span>{email.date_str} {email.time}</span>
                        <div className="flex items-center gap-1.5 font-medium">
                          {/* HTML vs Clean Text Toggle Button — Defaults to Original HTML */}
                          {(() => {
                            const hasHtmlContent = Boolean(
                              email.body_html || 
                              (typeof (email.body || email.preview) === 'string' && (
                                (email.body || email.preview).includes('<!DOCTYPE') ||
                                (email.body || email.preview).includes('<html') ||
                                (email.body || email.preview).includes('<table') ||
                                (email.body || email.preview).includes('<div') ||
                                (email.body || email.preview).includes('<p')
                              ))
                            );
                            const showHtml = hasHtmlContent && (viewHtmlMode[email.id] !== undefined ? viewHtmlMode[email.id] : true);

                            if (!hasHtmlContent) return null;

                            return (
                              <button
                                type="button"
                                onClick={() => setViewHtmlMode(prev => ({ ...prev, [email.id]: !(prev[email.id] !== undefined ? prev[email.id] : true) }))}
                                className={cn(
                                  "inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold border transition-colors",
                                  showHtml 
                                    ? "border-sky-500/30 bg-sky-500/10 text-sky-600 dark:text-sky-400 hover:bg-sky-500/20"
                                    : "border-zinc-300 dark:border-white/10 hover:bg-zinc-200 dark:hover:bg-white/10 text-foreground"
                                )}
                                title="Toggle between original rendered HTML email and clean text"
                              >
                                {showHtml ? (
                                  <>
                                    <FileText className="w-3 h-3 text-sky-500" />
                                    <span>Clean Text</span>
                                  </>
                                ) : (
                                  <>
                                    <Code2 className="w-3 h-3 text-sky-500" />
                                    <span>Original HTML</span>
                                  </>
                                )}
                              </button>
                            );
                          })()}

                          <span className="px-2 py-0.5 rounded bg-zinc-200 dark:bg-white/10 text-[10px]">
                            {email.priority || 'Medium'}
                          </span>
                          {email.sentiment && (
                            <span className={cn(
                              "inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold border",
                              email.sentiment === 'Angry' ? 'bg-rose-500/10 text-rose-500 border-rose-500/20' :
                              email.sentiment === 'Happy' ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' :
                              'bg-zinc-500/10 text-zinc-400 border-zinc-500/20'
                            )}>
                              {email.sentiment === 'Angry' ? <Frown className="w-2.5 h-2.5" /> :
                               email.sentiment === 'Happy' ? <Smile className="w-2.5 h-2.5" /> :
                               <Meh className="w-2.5 h-2.5" />}
                              {email.sentiment}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Customer Message Body (Defaults to Original HTML iframe when available, with Clean Text toggle) */}
                    {(() => {
                      const hasHtmlContent = Boolean(
                        email.body_html || 
                        (typeof (email.body || email.preview) === 'string' && (
                          (email.body || email.preview).includes('<!DOCTYPE') ||
                          (email.body || email.preview).includes('<html') ||
                          (email.body || email.preview).includes('<table') ||
                          (email.body || email.preview).includes('<div') ||
                          (email.body || email.preview).includes('<p')
                        ))
                      );
                      const showHtml = hasHtmlContent && (viewHtmlMode[email.id] !== undefined ? viewHtmlMode[email.id] : true);

                      if (showHtml) {
                        const rawContent = email.body_html || email.body || email.preview || '';
                        const sanitizedContent = sanitizeSandboxedHtml(rawContent);

                        return (
                          <div className="space-y-1.5">
                            <div className="flex items-center justify-between text-[10px] text-muted-foreground px-1">
                              <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-medium">
                                <Shield className="w-3 h-3" />
                                Sandboxed Secure View (Scripts &amp; Active Content Blocked)
                              </span>
                            </div>
                            <div className="rounded-xl overflow-hidden border border-zinc-200 dark:border-white/10 bg-white shadow-sm">
                              <iframe
                                srcDoc={sanitizedContent}
                                sandbox="allow-popups allow-popups-to-escape-sandbox"
                                className="w-full min-h-[480px] bg-white border-0"
                                title="Sandboxed Original HTML Email View"
                              />
                            </div>
                          </div>
                        );
                      }

                      return (
                        <EmailBodyWithDisclaimer content={email.body || email.preview} className="text-sm text-foreground/90" />
                      );
                    })()}

                    {/* Message Utilities Bar */}
                    <div className="flex flex-wrap items-center justify-between gap-2 pt-2 text-[11px] text-muted-foreground border-t border-zinc-200/40 dark:border-white/5">
                      <div className="flex items-center gap-2">
                        {email.confidence && (
                          <span className="font-mono">AI Confidence: {email.confidence}</span>
                        )}
                        {email.execution_steps && email.execution_steps.length > 0 && (
                          <button
                            onClick={() => setShowTraceFor(isTraceOpen ? null : email.id)}
                            className="text-primary hover:underline font-medium flex items-center gap-0.5"
                          >
                            <span>Trace ({email.execution_steps.length} steps)</span>
                            <ChevronRight className={cn("w-3 h-3 transition-transform", isTraceOpen ? "rotate-90" : "")} />
                          </button>
                        )}
                      </div>

                      <button 
                        onClick={() => handleCreateTicket(email)}
                        disabled={ticketLoadingId === email.id || email.status === 'Ticket_Generated'} 
                        className="px-2.5 py-1 text-xs font-semibold rounded-lg border border-zinc-200 dark:border-white/10 hover:bg-zinc-100 dark:hover:bg-white/5 text-foreground transition-all flex items-center gap-1 disabled:opacity-50"
                      >
                        {ticketLoadingId === email.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Ticket className="w-3 h-3" />}
                        {email.status === 'Ticket_Generated' ? 'Ticket Generated' : 'Create Ticket'}
                      </button>
                    </div>

                    {/* Execution Steps Drawer */}
                    {isTraceOpen && email.execution_steps && (
                      <div className="p-3 rounded-xl bg-zinc-100 dark:bg-black/30 border border-zinc-200 dark:border-white/5 space-y-2 text-[11px]">
                        <span className="font-semibold text-muted-foreground text-[10px] uppercase">Bot Decision Path</span>
                        <div className="flex flex-wrap gap-1.5">
                          {email.execution_steps.map((step: string, sIdx: number) => (
                            <span key={sIdx} className="px-2 py-0.5 rounded-md bg-zinc-200 dark:bg-white/10 font-mono text-[10px]">
                              {sIdx + 1}. {step}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Bot Reply Card (if generated) */}
                  {hasReply && (
                    <div className="ml-4 sm:ml-8 rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-4 sm:p-5 space-y-2">
                      <div className="flex items-center justify-between text-emerald-600 dark:text-emerald-400 font-semibold text-xs pb-1">
                        <div className="flex items-center gap-1.5">
                          <Bot className="w-4 h-4" />
                          <span>AI Auto-Reply</span>
                        </div>
                        <span className="text-[10px] font-mono opacity-80">Sent Resolution</span>
                      </div>

                      <EmailBodyWithDisclaimer content={email.reply} className="text-sm text-foreground/90" />
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Reply Composer Bottom Section */}
          <AnimatePresence>
            {isReplying && (
              <motion.div 
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="border-t border-zinc-200 dark:border-white/10 bg-zinc-50/50 dark:bg-white/[0.02] p-4"
              >
                <div className="space-y-3">
                  <div className="flex justify-between items-center text-xs">
                    <span className="font-semibold text-foreground">Manual Reply to {selectedThread.sender}</span>
                    <button onClick={() => setIsReplying(false)} className="text-muted-foreground hover:text-foreground">
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  <textarea 
                    value={replyText}
                    onChange={(e) => setReplyText(e.target.value)}
                    placeholder="Write your email response..."
                    rows={4}
                    className="w-full bg-background border border-zinc-200 dark:border-white/10 rounded-xl p-3 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 resize-none font-sans"
                  />

                  <div className="flex justify-end gap-2">
                    <button 
                      onClick={() => setIsReplying(false)}
                      className="px-3.5 py-1.5 rounded-xl text-xs font-semibold text-muted-foreground hover:bg-zinc-100 dark:hover:bg-white/5"
                    >
                      Cancel
                    </button>
                    <button 
                      onClick={() => handleSendManualReply()}
                      disabled={replyLoading || !replyText.trim()}
                      className="px-4 py-1.5 bg-primary text-primary-foreground rounded-xl text-xs font-semibold hover:bg-primary/90 transition-all flex items-center gap-1.5 disabled:opacity-50 shadow-sm"
                    >
                      {replyLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                      Send Email
                    </button>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      ) : (
        <div className="flex-1 rounded-2xl border border-zinc-200 dark:border-white/10 bg-card flex flex-col items-center justify-center p-8 text-center space-y-3">
          <div className="p-3 rounded-2xl bg-zinc-100 dark:bg-white/5">
            <InboxIcon className="w-8 h-8 text-muted-foreground/60" />
          </div>
          <h3 className="text-sm font-semibold text-foreground">Select a conversation</h3>
          <p className="text-xs text-muted-foreground max-w-sm">
            Choose an email thread on the left to read messages, inspect AI decisions, or send manual replies.
          </p>
        </div>
      )}
    </div>
  );
}
