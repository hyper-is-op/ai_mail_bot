import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { api } from '@/lib/api';
import { 
  EmailItem, 
  ThreadItem, 
  PausedEmailItem, 
  BlockedEmailItem, 
  InboxTabType, 
  normalizeSubject 
} from '@/components/inbox/types';
import { InboxSidebar } from '@/components/inbox/InboxSidebar';
import { ThreadDetailView } from '@/components/inbox/ThreadDetailView';
import { PausedDetailView } from '@/components/inbox/PausedDetailView';
import { BlockedDetailView } from '@/components/inbox/BlockedDetailView';
import { useAppState } from '@/context/AppStateContext';

export default function Inbox() {
  const [searchParams] = useSearchParams();
  const directEmailId = searchParams.get('id');

  const [emailsList, setEmailsList] = useState<EmailItem[]>([]);
  const [blockedEmails, setBlockedEmails] = useState<BlockedEmailItem[]>([]);
  const [pausedHistory, setPausedHistory] = useState<PausedEmailItem[]>([]);
  const [marketingSenders, setMarketingSenders] = useState<string[]>([]);
  const [selectedThread, setSelectedThread] = useState<ThreadItem | null>(null);
  const [selectedBlockedItem, setSelectedBlockedItem] = useState<BlockedEmailItem | null>(null);
  const [selectedPausedItem, setSelectedPausedItem] = useState<PausedEmailItem | null>(null);
  const [activeTab, setActiveTab] = useState<InboxTabType>('All');
  const [failedSubTab, setFailedSubTab] = useState<'All' | 'Worker' | 'Auth' | 'Ticket' | 'LLM'>('All');
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

  const { selectedClientId, setSelectedClientId, clients, isAdmin } = useAppState();

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

    const envWsUrl = (window as any).__APP_CONFIG__?.WS_URL || import.meta.env.VITE_WS_URL as string | undefined;
    const apiUrl = (window as any).__APP_CONFIG__?.API_URL || import.meta.env.VITE_API_URL as string | undefined;
    let wsUrl: string;
    if (envWsUrl) {
      wsUrl = envWsUrl;
    } else if (apiUrl && apiUrl.startsWith('http')) {
      wsUrl = apiUrl.replace(/^http/, 'ws').replace(/\/+$/, '') + '/ws';
    } else {
      const wsProto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      wsUrl = `${wsProto}//${window.location.host}/ws`;
    }
    let ws: WebSocket | null = null;
    let reconnectTimeout: any = null;

    const connectWS = () => {
      try {
        const rawUser = localStorage.getItem('user');
        let token = '';
        if (rawUser) {
          try {
            token = JSON.parse(rawUser)?.token || '';
          } catch {
            // ignore json parse error
          }
        }
        if (!token) {
          console.warn("WebSocket connection skipped: No active session token found");
          return;
        }

        const authenticatedWsUrl = `${wsUrl}${wsUrl.includes('?') ? '&' : '?'}token=${encodeURIComponent(token)}`;
        ws = new WebSocket(authenticatedWsUrl);
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
        ws.onclose = (event) => {
          // If closed due to authentication failure (4001) or normal closure (1000), do not loop reconnect
          if (event.code === 4001) {
            console.warn("WebSocket authentication failed (code 4001). Reconnect aborted.");
            return;
          }
          if (event.code !== 1000) {
            reconnectTimeout = setTimeout(connectWS, 4000);
          }
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

  // Grouped conversation threads
  const getGroupedThreads = (): ThreadItem[] => {
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

    let isFailedMatch = false;
    if (activeTab === 'Failed' && latestStatus === 'failed') {
      const errorSummary = (thread.latest_email.summary || '').toLowerCase();
      const rawStatus = (thread.latest_email.raw_status || '').toLowerCase();

      const isTicketError = 
        rawStatus.includes('ticket') || 
        errorSummary.includes('ticket') || 
        errorSummary.includes('crm') || 
        errorSummary.includes('connector') || 
        errorSummary.includes('webhook');

      const isAuthError = 
        errorSummary.includes('authentication') || 
        errorSummary.includes('credential') || 
        errorSummary.includes('auth') || 
        errorSummary.includes('login') || 
        errorSummary.includes('535') || 
        errorSummary.includes('unauthorized') || 
        errorSummary.includes('oauth') || 
        errorSummary.includes('token');

      const isLlmError = 
        errorSummary.includes('llm') || 
        errorSummary.includes('timeout') || 
        errorSummary.includes('openai') || 
        errorSummary.includes('groq') || 
        errorSummary.includes('anthropic') || 
        errorSummary.includes('claude') || 
        errorSummary.includes('gemini') || 
        errorSummary.includes('deepseek') || 
        errorSummary.includes('grok') || 
        errorSummary.includes('rate limit') || 
        errorSummary.includes('429') || 
        errorSummary.includes('context length') || 
        errorSummary.includes('validation');

      const isWorkerError = 
        errorSummary.includes('worker') || 
        errorSummary.includes('celery') || 
        errorSummary.includes('redis') || 
        errorSummary.includes('unhandled') || 
        errorSummary.includes('exception') || 
        errorSummary.includes('connection refused') ||
        (!isTicketError && !isAuthError && !isLlmError);

      if (failedSubTab === 'All') isFailedMatch = true;
      else if (failedSubTab === 'Worker') isFailedMatch = isWorkerError;
      else if (failedSubTab === 'Auth') isFailedMatch = isAuthError;
      else if (failedSubTab === 'Ticket') isFailedMatch = isTicketError;
      else if (failedSubTab === 'LLM') isFailedMatch = isLlmError;
    }

    const matchesTab = activeTab === 'All' || 
      (activeTab === 'Marketing' && isMarketing) ||
      (activeTab === 'Replied' && (latestStatus === 'replied' || latestStatus === 'ticket_generated')) ||
      (activeTab === 'Processing' && latestStatus === 'processing') ||
      (activeTab === 'Failed' && isFailedMatch) ||
      (activeTab === 'Pending Review' && latestStatus === 'pending review');
    
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

  // Filter paused items (from paused_email_history)
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

  // Reset selection when switching tabs so the first item in the new view is selected
  const handleTabChange = (tab: InboxTabType) => {
    setActiveTab(tab);
    setSelectedThread(null);
    setSelectedPausedItem(null);
    setSelectedBlockedItem(null);
  };

  useEffect(() => {
    setSelectedThread(null);
    setSelectedPausedItem(null);
    setSelectedBlockedItem(null);
  }, [selectedClientId]);

  // Keep selected items synchronized with incoming data updates without jumping back to index 0
  useEffect(() => {
    if (activeTab === 'Blocked') {
      if (filteredBlockedEmails.length > 0) {
        if (!selectedBlockedItem) {
          setSelectedBlockedItem(filteredBlockedEmails[0]);
        } else {
          const updated = filteredBlockedEmails.find(b => b.id === selectedBlockedItem.id);
          if (updated) {
            setSelectedBlockedItem(updated);
          } else {
            setSelectedBlockedItem(filteredBlockedEmails[0]);
          }
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
          if (updated) {
            setSelectedPausedItem(updated);
          } else {
            setSelectedPausedItem(filteredPausedHistory[0]);
          }
        }
      } else {
        setSelectedPausedItem(null);
      }
    } else {
      if (filteredThreads.length > 0) {
        if (directEmailId) {
          const directMatch = filteredThreads.find(t => t.emails.some(e => String(e.id) === directEmailId));
          if (directMatch) {
            setSelectedThread(directMatch);
            return;
          }
        }
        if (!selectedThread) {
          setSelectedThread(filteredThreads[0]);
        } else {
          const updated = filteredThreads.find(t => t.key === selectedThread.key);
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
  }, [emailsList, blockedEmails, pausedHistory, activeTab, directEmailId]);

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(''), 4000);
  };

  const handleCreateTicket = async (email: any) => {
    const activeCid = selectedClientId === "ALL" ? (email.client_id || clients[0]?.client_id || '') : selectedClientId;
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

  const resetReplyState = () => {
    setIsReplying(false);
    setReplyText('');
  };

  const blockedPendingCount = blockedEmails.filter(b => b.status === 'pending_review' || !b.status).length;
  const pausedPendingCount = pausedHistory.filter(p => p.status === 'pending_review' || !p.status).length;
  const totalPausedBadge = pausedPendingCount > 0 ? pausedPendingCount : pausedEmails.length;
  const marketingCount = groupedThreads.filter(t => t.latest_email.category === 'Marketing / Promo' || (t.latest_email.status || '').toLowerCase() === 'no action needed' || t.latest_email.raw_status === 'no_action_needed' || isSenderMarketing(t.sender)).length;
  const failedCount = groupedThreads.filter(t => {
    const st = (t.latest_email.status || '').toLowerCase();
    return st === 'failed';
  }).length;
  const pendingReviewCount = groupedThreads.filter(t => (t.latest_email.status || '').toLowerCase() === 'pending review').length;

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
      <InboxSidebar
        isAdmin={isAdmin}
        clients={clients}
        selectedClientId={selectedClientId}
        onSelectClientId={setSelectedClientId}
        onRefresh={() => {
          fetchEmails(false, selectedClientId);
          fetchBlockedEmails(selectedClientId);
          fetchPausedEmails(selectedClientId);
          fetchPausedHistory(selectedClientId);
          fetchMarketingSenders(selectedClientId);
        }}
        activeTab={activeTab}
        setActiveTab={handleTabChange}
        failedSubTab={failedSubTab}
        setFailedSubTab={setFailedSubTab}
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        groupedThreads={groupedThreads}
        filteredThreads={filteredThreads}
        selectedThread={selectedThread}
        onSelectThread={setSelectedThread}
        filteredPausedHistory={filteredPausedHistory}
        selectedPausedItem={selectedPausedItem}
        onSelectPausedItem={setSelectedPausedItem}
        filteredBlockedEmails={filteredBlockedEmails}
        selectedBlockedItem={selectedBlockedItem}
        onSelectBlockedItem={setSelectedBlockedItem}
        pausedEmails={pausedEmails}
        onBulkIgnoreBlocked={handleBulkIgnoreBlocked}
        onResumeAllPaused={handleResumeAllPaused}
        counts={{
          marketing: marketingCount,
          failed: failedCount,
          pendingReview: pendingReviewCount,
          paused: totalPausedBadge,
          blocked: blockedPendingCount
        }}
        onResetReplyState={resetReplyState}
      />

      {/* Right Pane: Reading / Action View */}
      {activeTab === 'Paused' ? (
        <PausedDetailView
          selectedPausedItem={selectedPausedItem}
          toastMsg={toastMsg}
          onPauseToggle={handlePauseToggle}
          onUpdateStatus={handleUpdatePausedHistoryStatus}
          onCreateTicket={(email) => handleCreateTicket({ ...email, client_id: selectedClientId })}
          ticketLoadingId={ticketLoadingId}
          isReplying={isReplying}
          setIsReplying={setIsReplying}
          replyText={replyText}
          setReplyText={setReplyText}
          onSendManualReply={() => {
            if (selectedPausedItem) {
              handleSendManualReply(
                selectedPausedItem.from_email,
                selectedPausedItem.subject,
                selectedPausedItem.body,
                { pausedRecordId: selectedPausedItem.id }
              );
            }
          }}
          replyLoading={replyLoading}
        />
      ) : activeTab === 'Blocked' ? (
        <BlockedDetailView
          selectedBlockedItem={selectedBlockedItem}
          toastMsg={toastMsg}
          onUpdateStatus={handleUpdateBlockedStatus}
          onCreateTicket={(email) => handleCreateTicket({ ...email, client_id: selectedClientId })}
          ticketLoadingId={ticketLoadingId}
          isReplying={isReplying}
          setIsReplying={setIsReplying}
          replyText={replyText}
          setReplyText={setReplyText}
          onSendManualReply={() => {
            if (selectedBlockedItem) {
              handleSendManualReply(
                selectedBlockedItem.from_email,
                selectedBlockedItem.subject,
                selectedBlockedItem.body,
                { blockedRecordId: selectedBlockedItem.id }
              );
            }
          }}
          replyLoading={replyLoading}
        />
      ) : (
        <ThreadDetailView
          selectedThread={selectedThread}
          toastMsg={toastMsg}
          isSenderMarketing={isSenderMarketing}
          onToggleMarketingSender={handleToggleMarketingSender}
          pausedEmails={pausedEmails}
          onPauseToggle={handlePauseToggle}
          isReplying={isReplying}
          setIsReplying={setIsReplying}
          onClearHistory={handleClearHistory}
          viewHtmlMode={viewHtmlMode}
          setViewHtmlMode={setViewHtmlMode}
          showTraceFor={showTraceFor}
          setShowTraceFor={setShowTraceFor}
          onCreateTicket={handleCreateTicket}
          ticketLoadingId={ticketLoadingId}
          replyText={replyText}
          setReplyText={setReplyText}
          onSendManualReply={() => handleSendManualReply()}
          replyLoading={replyLoading}
        />
      )}
    </div>
  );
}
