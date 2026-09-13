import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
  FileText,
  Send,
  Trash2,
  Edit3,
  CheckCircle,
  Clock,
  Search,
  RefreshCw,
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  Sparkles,
  User,
  Mail,
  Calendar,
  CheckSquare,
  Square,
  X,
  MessageSquare,
  ShieldCheck,
  Zap,
  Settings as SettingsIcon,
} from 'lucide-react';
import { api } from '../lib/api';

interface DraftItem {
  id: number;
  client_id: string;
  email_log_id?: number;
  from_email: string;
  sender_name?: string;
  to_email: string;
  subject: string;
  original_body: string;
  draft_reply: string;
  confidence_score: number;
  intent?: string;
  sentiment?: string;
  priority?: string;
  ticket_id?: string;
  in_reply_to?: string;
  message_id?: string;
  status: 'pending' | 'approved' | 'sent' | 'rejected' | 'discarded' | 'sending';
  rejection_reason?: string;
  reviewed_by?: string;
  reviewed_at?: string;
  sent_at?: string;
  created_at: string;
}

interface DraftMetrics {
  total: number;
  pending: number;
  sent: number;
  discarded: number;
  avg_confidence: number;
}

export function Drafts() {
  const [drafts, setDrafts] = useState<DraftItem[]>([]);
  const [metrics, setMetrics] = useState<DraftMetrics>({
    total: 0,
    pending: 0,
    sent: 0,
    discarded: 0,
    avg_confidence: 0,
  });
  const [loading, setLoading] = useState(false);
  const [totalCount, setTotalCount] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);

  // Multi-tenant Client Account State
  const user = JSON.parse(localStorage.getItem('user') || '{}');
  const isAdmin = user?.role === 'admin';
  const [accounts, setAccounts] = useState<any[]>([]);
  const [selectedClientId, setSelectedClientId] = useState<string>(
    isAdmin ? 'ALL' : user?.client_id || ''
  );

  // Filter States
  const [statusFilter, setStatusFilter] = useState<string>('pending');
  const [searchQuery, setSearchQuery] = useState('');
  const [senderFilter, setSenderFilter] = useState('');
  const [intentFilter, setIntentFilter] = useState('ALL');
  const [sentimentFilter, setSentimentFilter] = useState('ALL');
  const [minScore, setMinScore] = useState<number | ''>('');

  // Active Review Drawer State
  const [activeDraft, setActiveDraft] = useState<DraftItem | null>(null);
  const [editSubject, setEditSubject] = useState('');
  const [editBody, setEditBody] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [batchActionLoading, setBatchActionLoading] = useState(false);
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [autoSendEnabled, setAutoSendEnabled] = useState<boolean>(true);

  const showToast = (type: 'success' | 'error', message: string) => {
    setNotification({ type, message });
    setTimeout(() => setNotification(null), 4000);
  };

  // Load registered client accounts for Admin
  useEffect(() => {
    if (isAdmin) {
      api.getAllEmailAccounts().then((res) => {
        const accs = Array.isArray(res) ? res : res?.accounts || [];
        setAccounts(accs);
        if (!selectedClientId) {
          setSelectedClientId('ALL');
        }
      }).catch(console.error);
    }
  }, [isAdmin]);

  const activeCid = isAdmin ? selectedClientId : (user?.client_id || '');

  const loadClientFeatures = useCallback(async () => {
    if (!activeCid) return;
    try {
      const acc = await api.getEmailAccount(activeCid);
      if (acc && acc.feature_auto_send !== undefined) {
        setAutoSendEnabled(Boolean(acc.feature_auto_send));
      }
    } catch (e) {
      // fallback
    }
  }, [activeCid]);

  const loadMetrics = useCallback(async () => {
    if (!activeCid && isAdmin) {
      setMetrics({ total: 0, pending: 0, sent: 0, discarded: 0, avg_confidence: 0 });
      return;
    }
    try {
      const res = await api.getDraftMetrics(activeCid || undefined);
      if (res && !res.error) {
        setMetrics(res);
      }
    } catch (err) {
      console.error('Failed to load draft metrics:', err);
    }
  }, [activeCid, isAdmin]);

  const loadDrafts = useCallback(async () => {
    if (!activeCid && isAdmin) {
      setDrafts([]);
      setTotalCount(0);
      setTotalPages(1);
      return;
    }
    setLoading(true);
    try {
      const res = await api.getDrafts({
        client_id: activeCid || undefined,
        status: statusFilter,
        search: searchQuery || undefined,
        from_email: senderFilter || undefined,
        intent: intentFilter !== 'ALL' ? intentFilter : undefined,
        sentiment: sentimentFilter !== 'ALL' ? sentimentFilter : undefined,
        min_score: minScore !== '' ? Number(minScore) : undefined,
        page,
        page_size: 15,
      });

      if (res && res.items) {
        setDrafts(res.items);
        setTotalCount(res.total);
        setTotalPages(res.total_pages);
      } else {
        setDrafts([]);
        setTotalCount(0);
      }
    } catch (err) {
      console.error('Failed to load drafts:', err);
      showToast('error', 'Could not load drafts from server');
    } finally {
      setLoading(false);
    }
  }, [activeCid, isAdmin, statusFilter, searchQuery, senderFilter, intentFilter, sentimentFilter, minScore, page]);

  useEffect(() => {
    loadMetrics();
    loadDrafts();
    loadClientFeatures();
  }, [loadMetrics, loadDrafts, loadClientFeatures]);

  // Open review drawer
  const handleOpenReview = (draft: DraftItem) => {
    setActiveDraft(draft);
    setEditSubject(draft.subject);
    setEditBody(draft.draft_reply);
    setIsEditing(false);
  };

  // Close drawer
  const handleCloseDrawer = () => {
    setActiveDraft(null);
  };

  // Single Send
  const handleSendSingle = async (draftId: number) => {
    setActionLoading(true);
    try {
      const res = await api.sendDraft(draftId);
      if (res && res.success) {
        showToast('success', `Draft #${draftId} successfully dispatched!`);
        if (activeDraft?.id === draftId) {
          handleCloseDrawer();
        }
        loadDrafts();
        loadMetrics();
      } else {
        showToast('error', res.error || 'Failed to dispatch email');
      }
    } catch (err: any) {
      showToast('error', err.message || 'SMTP transmission error');
    } finally {
      setActionLoading(false);
    }
  };

  // Save changes to draft
  const handleSaveDraftChanges = async () => {
    if (!activeDraft) return;
    setActionLoading(true);
    try {
      const res = await api.updateDraft(activeDraft.id, {
        subject: editSubject,
        draft_reply: editBody,
      });
      if (res && res.status === 'success') {
        showToast('success', 'Draft updated successfully');
        setActiveDraft({ ...activeDraft, subject: editSubject, draft_reply: editBody });
        setIsEditing(false);
        loadDrafts();
      } else {
        showToast('error', res.error || 'Failed to save draft');
      }
    } catch (err: any) {
      showToast('error', err.message || 'Error updating draft');
    } finally {
      setActionLoading(false);
    }
  };

  // Discard single draft
  const handleDiscardSingle = async (draftId: number) => {
    if (!window.confirm('Are you sure you want to discard this draft?')) return;
    setActionLoading(true);
    try {
      const res = await api.discardDraft(draftId, 'Manually discarded by reviewer');
      if (res && res.status === 'success') {
        showToast('success', `Draft #${draftId} discarded`);
        if (activeDraft?.id === draftId) {
          handleCloseDrawer();
        }
        loadDrafts();
        loadMetrics();
      } else {
        showToast('error', res.error || 'Failed to discard draft');
      }
    } catch (err: any) {
      showToast('error', err.message || 'Error discarding draft');
    } finally {
      setActionLoading(false);
    }
  };

  // Selection toggle
  const toggleSelectAll = () => {
    if (selectedIds.length === drafts.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(drafts.map((d) => d.id));
    }
  };

  const toggleSelectOne = (id: number) => {
    if (selectedIds.includes(id)) {
      setSelectedIds(selectedIds.filter((item) => item !== id));
    } else {
      setSelectedIds([...selectedIds, id]);
    }
  };

  // Batch Send Selected
  const handleBatchSendSelected = async () => {
    if (!selectedIds.length) return;
    if (!window.confirm(`Are you sure you want to dispatch ${selectedIds.length} draft(s) now?`)) return;

    setBatchActionLoading(true);
    try {
      const res = await api.batchSendDrafts(selectedIds);
      if (res) {
        showToast('success', `Batch complete: ${res.sent} sent, ${res.failed} failed`);
        setSelectedIds([]);
        loadDrafts();
        loadMetrics();
      }
    } catch (err: any) {
      showToast('error', err.message || 'Batch send execution failed');
    } finally {
      setBatchActionLoading(false);
    }
  };

  // Batch Discard Selected
  const handleBatchDiscardSelected = async () => {
    if (!selectedIds.length) return;
    if (!window.confirm(`Are you sure you want to discard ${selectedIds.length} draft(s)?`)) return;

    setBatchActionLoading(true);
    try {
      let discarded = 0;
      for (const id of selectedIds) {
        await api.discardDraft(id, 'Bulk discarded');
        discarded++;
      }
      showToast('success', `${discarded} drafts discarded`);
      setSelectedIds([]);
      loadDrafts();
      loadMetrics();
    } catch (err: any) {
      showToast('error', err.message || 'Error during bulk discard');
    } finally {
      setBatchActionLoading(false);
    }
  };

  // Batch Send By Current Filters
  const handleBatchSendByFilter = async () => {
    if (
      !window.confirm(
        `Are you sure you want to batch-send ALL pending drafts matching current filter criteria (up to 100)?`
      )
    )
      return;

    setBatchActionLoading(true);
    try {
      const res = await api.batchSendByFilter({
        search: searchQuery || undefined,
        from_email: senderFilter || undefined,
        intent: intentFilter !== 'ALL' ? intentFilter : undefined,
        sentiment: sentimentFilter !== 'ALL' ? sentimentFilter : undefined,
        min_score: minScore !== '' ? Number(minScore) : undefined,
      });

      if (res && res.sent !== undefined) {
        showToast('success', `Filter Batch Complete: ${res.sent} sent, ${res.failed} failed`);
        setSelectedIds([]);
        loadDrafts();
        loadMetrics();
      } else {
        showToast('error', res.message || 'No matching drafts found');
      }
    } catch (err: any) {
      showToast('error', err.message || 'Error during filter-based batch send');
    } finally {
      setBatchActionLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Toast Notification */}
      {notification && (
        <div
          className={`fixed top-5 right-5 z-50 flex items-center gap-3 px-4 py-3 rounded-lg shadow-xl border text-sm font-medium transition-all ${
            notification.type === 'success'
              ? 'bg-emerald-950/90 text-emerald-200 border-emerald-700/60 shadow-emerald-950/30'
              : 'bg-red-950/90 text-red-200 border-red-700/60 shadow-red-950/30'
          }`}
        >
          {notification.type === 'success' ? (
            <CheckCircle className="w-4 h-4 text-emerald-400" />
          ) : (
            <AlertTriangle className="w-4 h-4 text-red-400" />
          )}
          {notification.message}
        </div>
      )}

      {/* Windows 11 Breadcrumbs & Header */}
      <div className="space-y-3">
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <span>Home</span>
          <span>&gt;</span>
          <span className="text-foreground font-medium">Pause &amp; Draft</span>
        </div>

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-semibold tracking-tight text-foreground flex items-center gap-2.5">
              Pause &amp; Draft
              {metrics.pending > 0 && (
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                  {metrics.pending} Pending
                </span>
              )}
            </h1>
            <p className="text-xs text-muted-foreground mt-1">
              Review AI-generated replies, edit draft wording, and dispatch emails individually or in smart batches.
            </p>
          </div>

          <div className="flex items-center gap-3">
            {/* Mode Status Indicator Badge */}
            <div className="flex items-center gap-2.5 px-3.5 py-2 rounded-lg win11-card">
              <div className="flex flex-col text-right">
                <span className="text-xs font-semibold text-foreground flex items-center justify-end gap-1.5">
                  {autoSendEnabled ? (
                    <>
                      <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                      Direct Auto-Send
                    </>
                  ) : (
                    <>
                      <span className="w-2 h-2 rounded-full bg-amber-500"></span>
                      Pause &amp; Draft Active
                    </>
                  )}
                </span>
                <span className="text-[10px] text-muted-foreground">
                  {autoSendEnabled ? 'Auto-dispatching replies' : 'Holding replies for review'}
                </span>
              </div>
              <Link
                to="/settings?tab=pause_draft"
                className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-black/[0.04] dark:hover:bg-white/[0.06] transition-colors"
                title="Configure Pause & Draft mode in Settings"
              >
                <SettingsIcon className="w-4 h-4" />
              </Link>
            </div>

            <button
              onClick={() => {
                loadMetrics();
                loadDrafts();
                loadClientFeatures();
              }}
              disabled={loading}
              className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg win11-card hover:bg-black/[0.04] dark:hover:bg-white/[0.06] text-foreground cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-primary' : ''}`} />
              Refresh
            </button>
          </div>
        </div>
      </div>

      {/* Admin Client Account Selector */}
      {isAdmin && (
        <div className="p-3.5 rounded-lg win11-card flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-l-4 border-l-primary">
          <div className="flex items-center gap-2.5">
            <User className="w-4 h-4 text-primary shrink-0" />
            <div>
              <span className="text-xs font-semibold text-foreground block">
                Managing Client Mailbox
              </span>
              <span className="text-[11px] text-muted-foreground">
                Admin accounts have no personal Gmail connected. Select a client to inspect their Pause &amp; Draft queue.
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <select
              value={selectedClientId}
              onChange={(e) => setSelectedClientId(e.target.value)}
              className="px-3 py-1.5 text-xs rounded-md border border-black/[0.08] dark:border-white/[0.08] bg-white/80 dark:bg-white/[0.05] text-foreground font-medium focus:outline-none focus:border-b-2 focus:border-b-primary shadow-2xs min-w-[220px]"
            >
              {accounts.length === 0 ? (
                <option value="">No registered client accounts</option>
              ) : (
                <>
                  <option value="ALL">All Clients ({accounts.length})</option>
                  {accounts.map((acc) => (
                    <option key={acc.client_id} value={acc.client_id}>
                      {acc.name || acc.client_id} ({acc.email})
                    </option>
                  ))}
                </>
              )}
            </select>
          </div>
        </div>
      )}

      {/* Windows 11 KPI Status Tiles */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div
          onClick={() => {
            setStatusFilter('pending');
            setPage(1);
          }}
          className={`cursor-pointer p-3.5 rounded-lg win11-card ${
            statusFilter === 'pending'
              ? 'ring-2 ring-primary border-primary/40'
              : ''
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-amber-600 dark:text-amber-400">
              Pending Review
            </span>
            <Clock className="w-4 h-4 text-amber-500" />
          </div>
          <div className="mt-1.5 text-2xl font-bold text-foreground">{metrics.pending}</div>
          <div className="text-[11px] text-muted-foreground">Awaiting inspection</div>
        </div>

        <div
          onClick={() => {
            setStatusFilter('sent');
            setPage(1);
          }}
          className={`cursor-pointer p-3.5 rounded-lg win11-card ${
            statusFilter === 'sent'
              ? 'ring-2 ring-primary border-primary/40'
              : ''
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">
              Dispatched
            </span>
            <CheckCircle className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="mt-1.5 text-2xl font-bold text-foreground">{metrics.sent}</div>
          <div className="text-[11px] text-muted-foreground">Delivered via SMTP</div>
        </div>

        <div
          onClick={() => {
            setStatusFilter('discarded');
            setPage(1);
          }}
          className={`cursor-pointer p-3.5 rounded-lg win11-card ${
            statusFilter === 'discarded'
              ? 'ring-2 ring-primary border-primary/40'
              : ''
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-red-600 dark:text-red-400">
              Discarded
            </span>
            <Trash2 className="w-4 h-4 text-red-500" />
          </div>
          <div className="mt-1.5 text-2xl font-bold text-foreground">{metrics.discarded}</div>
          <div className="text-[11px] text-muted-foreground">Rejected or dropped</div>
        </div>

        <div className="p-3.5 rounded-lg win11-card">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-foreground">
              Avg Quality
            </span>
            <Sparkles className="w-4 h-4 text-primary" />
          </div>
          <div className="mt-1.5 text-2xl font-bold text-foreground">
            {metrics.avg_confidence}%
          </div>
          <div className="text-[11px] text-muted-foreground">AI confidence rating</div>
        </div>
      </div>

      {/* Windows 11 Filter & Search Bar */}
      <div className="p-3.5 rounded-lg win11-card space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2.5">
          {/* Keyword Search */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search subject, body, sender..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setPage(1);
              }}
              className="w-full pl-8 pr-3 py-1.5 text-xs rounded-md border border-black/[0.08] dark:border-white/[0.08] bg-white/70 dark:bg-white/[0.05] text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-b-2 focus:border-b-primary shadow-2xs"
            />
          </div>

          {/* Sender / Domain Filter */}
          <div className="relative">
            <Mail className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              placeholder="Filter by sender / domain..."
              value={senderFilter}
              onChange={(e) => {
                setSenderFilter(e.target.value);
                setPage(1);
              }}
              className="w-full pl-8 pr-3 py-1.5 text-xs rounded-md border border-black/[0.08] dark:border-white/[0.08] bg-white/70 dark:bg-white/[0.05] text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-b-2 focus:border-b-primary shadow-2xs"
            />
          </div>

          {/* Intent Filter */}
          <div>
            <select
              value={intentFilter}
              onChange={(e) => {
                setIntentFilter(e.target.value);
                setPage(1);
              }}
              className="w-full px-2.5 py-1.5 text-xs rounded-md border border-black/[0.08] dark:border-white/[0.08] bg-white/70 dark:bg-white/[0.05] text-foreground focus:outline-none focus:border-b-2 focus:border-b-primary shadow-2xs"
            >
              <option value="ALL">All Intents</option>
              <option value="order_status">Order Status</option>
              <option value="general_query">General Query</option>
              <option value="ticket_created">Ticket Created</option>
              <option value="refund_request">Refund Request</option>
              <option value="cancellation">Cancellation</option>
              <option value="complaint">Complaint</option>
            </select>
          </div>

          {/* Sentiment Filter */}
          <div>
            <select
              value={sentimentFilter}
              onChange={(e) => {
                setSentimentFilter(e.target.value);
                setPage(1);
              }}
              className="w-full px-2.5 py-1.5 text-xs rounded-md border border-black/[0.08] dark:border-white/[0.08] bg-white/70 dark:bg-white/[0.05] text-foreground focus:outline-none focus:border-b-2 focus:border-b-primary shadow-2xs"
            >
              <option value="ALL">All Sentiments</option>
              <option value="Positive">Positive</option>
              <option value="Neutral">Neutral</option>
              <option value="Negative">Negative</option>
              <option value="Urgent">Urgent</option>
            </select>
          </div>

          {/* Min Confidence Score */}
          <div>
            <select
              value={minScore}
              onChange={(e) => {
                setMinScore(e.target.value === '' ? '' : Number(e.target.value));
                setPage(1);
              }}
              className="w-full px-2.5 py-1.5 text-xs rounded-md border border-black/[0.08] dark:border-white/[0.08] bg-white/70 dark:bg-white/[0.05] text-foreground focus:outline-none focus:border-b-2 focus:border-b-primary shadow-2xs"
            >
              <option value="">Any Confidence</option>
              <option value="90">&ge; 90% (High Quality)</option>
              <option value="80">&ge; 80% (Good)</option>
              <option value="70">&ge; 70% (Acceptable)</option>
              <option value="50">&ge; 50%</option>
            </select>
          </div>
        </div>

        {/* Status Tabs and Quick Reset */}
        <div className="flex flex-wrap items-center justify-between pt-2 border-t border-black/[0.06] dark:border-white/[0.06]">
          <div className="flex items-center gap-1.5">
            {(['pending', 'sent', 'discarded', 'ALL'] as const).map((st) => (
              <button
                key={st}
                onClick={() => {
                  setStatusFilter(st);
                  setPage(1);
                }}
                className={`px-3 py-1 text-xs font-semibold rounded-md transition-colors ${
                  statusFilter === st
                    ? 'bg-primary text-primary-foreground shadow-xs'
                    : 'text-muted-foreground hover:bg-black/[0.04] dark:hover:bg-white/[0.06] hover:text-foreground'
                }`}
              >
                {st === 'pending'
                  ? 'Pending Review'
                  : st === 'sent'
                  ? 'Dispatched'
                  : st === 'discarded'
                  ? 'Discarded'
                  : 'All Records'}
              </button>
            ))}
          </div>

          {(searchQuery || senderFilter || intentFilter !== 'ALL' || sentimentFilter !== 'ALL' || minScore !== '') && (
            <button
              onClick={() => {
                setSearchQuery('');
                setSenderFilter('');
                setIntentFilter('ALL');
                setSentimentFilter('ALL');
                setMinScore('');
                setPage(1);
              }}
              className="text-xs text-primary hover:underline font-medium"
            >
              Clear all filters
            </button>
          )}
        </div>
      </div>

      {/* Floating / Sticky Batch Action Bar */}
      {selectedIds.length > 0 && (
        <div className="sticky top-4 z-30 p-3 rounded-lg win11-card bg-[#282828] text-white shadow-xl flex flex-wrap items-center justify-between gap-3 animate-in fade-in">
          <div className="flex items-center gap-2.5">
            <span className="inline-flex items-center justify-center px-2 py-0.5 rounded text-xs font-bold bg-primary text-primary-foreground">
              {selectedIds.length} selected
            </span>
            <span className="text-xs font-medium text-foreground">
              Bulk actions for selected drafts
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleBatchSendSelected}
              disabled={batchActionLoading}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md bg-emerald-600 hover:bg-emerald-500 text-white transition-colors disabled:opacity-50"
            >
              <Send className="w-3 h-3" />
              {batchActionLoading ? 'Dispatching...' : `Send Selected (${selectedIds.length})`}
            </button>

            <button
              onClick={handleBatchDiscardSelected}
              disabled={batchActionLoading}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md bg-white/10 hover:bg-red-600 text-white transition-colors disabled:opacity-50"
            >
              <Trash2 className="w-3 h-3" />
              Discard Selected
            </button>

            <button
              onClick={() => setSelectedIds([])}
              className="text-xs text-muted-foreground hover:text-foreground px-2 py-1"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Filter-based Batch Dispatch Helper (when no items selected, but filters active on pending) */}
      {selectedIds.length === 0 && statusFilter === 'pending' && totalCount > 0 && (
        <div className="flex items-center justify-between px-3.5 py-2.5 rounded-lg border border-primary/20 bg-primary/10 text-xs text-foreground">
          <div className="flex items-center gap-2">
            <Zap className="w-3.5 h-3.5 text-primary" />
            <span>
              <strong>Smart Batch Dispatch:</strong> Send all {totalCount} drafts matching your current filter in one step.
            </span>
          </div>
          <button
            onClick={handleBatchSendByFilter}
            disabled={batchActionLoading}
            className="flex items-center gap-1 px-3 py-1 font-semibold rounded-md bg-primary text-primary-foreground shadow-xs hover:opacity-90 transition-opacity"
          >
            <Send className="w-3 h-3" />
          {batchActionLoading ? 'Dispatching...' : `Batch Send All (${totalCount})`}
          </button>
        </div>
      )}

      {/* Windows 11 Drafts List Table */}
      <div className="rounded-lg win11-card overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-black/[0.02] dark:bg-white/[0.03] text-[11px] font-semibold text-muted-foreground uppercase tracking-wider border-b border-black/[0.06] dark:border-white/[0.06]">
              <tr>
                <th className="p-3.5 w-10">
                  <button onClick={toggleSelectAll} className="flex items-center text-muted-foreground hover:text-foreground">
                    {drafts.length > 0 && selectedIds.length === drafts.length ? (
                      <CheckSquare className="w-4 h-4 text-primary" />
                    ) : (
                      <Square className="w-4 h-4" />
                    )}
                  </button>
                </th>
                <th className="p-3.5 font-semibold">Sender &amp; Customer</th>
                <th className="p-3.5 font-semibold">Subject &amp; AI Draft Snippet</th>
                <th className="p-3.5 font-semibold">Intent / Quality</th>
                <th className="p-3.5 font-semibold">Status</th>
                <th className="p-3.5 text-right font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-black/[0.04] dark:divide-white/[0.05]">
              {loading ? (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-muted-foreground">
                    <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-primary" />
                    Loading drafts...
                  </td>
                </tr>
              ) : drafts.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-12 text-center text-muted-foreground">
                    <FileText className="w-10 h-10 mx-auto mb-2.5 opacity-40 text-foreground" />
                    <p className="text-sm font-semibold text-foreground">No drafts found</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {statusFilter === 'pending'
                        ? 'All caught up! No drafts currently waiting for review.'
                        : 'No records matching the selected status or filters.'}
                    </p>
                  </td>
                </tr>
              ) : (
                drafts.map((draft) => {
                  const isSelected = selectedIds.includes(draft.id);
                  const isPending = draft.status === 'pending';

                  return (
                    <tr
                      key={draft.id}
                      className={`hover:bg-black/[0.03] dark:hover:bg-white/[0.04] transition-colors ${
                        isSelected ? 'bg-primary/10 dark:bg-primary/15' : ''
                      }`}
                    >
                      <td className="p-3.5">
                        <button
                          onClick={() => toggleSelectOne(draft.id)}
                          className="flex items-center text-muted-foreground hover:text-foreground"
                        >
                          {isSelected ? (
                            <CheckSquare className="w-4 h-4 text-primary" />
                          ) : (
                            <Square className="w-4 h-4" />
                          )}
                        </button>
                      </td>

                      <td className="p-3.5">
                        <div className="font-semibold text-foreground flex items-center gap-1.5">
                          <User className="w-3.5 h-3.5 text-muted-foreground" />
                          {draft.sender_name || draft.from_email.split('@')[0]}
                        </div>
                        <div className="text-[11px] text-muted-foreground">{draft.from_email}</div>
                        <div className="text-[10px] text-muted-foreground/80 mt-0.5 flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          {new Date(draft.created_at).toLocaleString()}
                        </div>
                      </td>

                      <td className="p-3.5 max-w-md">
                        <div className="font-medium text-foreground truncate">
                          {draft.subject}
                        </div>
                        <div className="text-[11px] text-muted-foreground line-clamp-2 mt-0.5 font-mono bg-black/[0.03] dark:bg-white/[0.04] p-1.5 rounded border border-black/[0.05] dark:border-white/[0.05]">
                          {draft.draft_reply}
                        </div>
                      </td>

                      <td className="p-3.5">
                        <div className="flex flex-col gap-1">
                          {draft.intent && (
                            <span className="inline-flex items-center w-fit px-2 py-0.5 rounded text-[10px] font-medium bg-black/[0.05] dark:bg-white/[0.08] text-foreground">
                              {draft.intent}
                            </span>
                          )}

                          <div className="flex items-center gap-1.5">
                            <div className="w-14 bg-black/[0.08] dark:bg-white/[0.1] h-1.5 rounded-full overflow-hidden">
                              <div
                                className={`h-full rounded-full ${
                                  draft.confidence_score >= 80
                                    ? 'bg-emerald-500'
                                    : draft.confidence_score >= 60
                                    ? 'bg-amber-500'
                                    : 'bg-red-500'
                                }`}
                                style={{ width: `${draft.confidence_score}%` }}
                              />
                            </div>
                            <span className="text-[11px] font-semibold text-foreground">
                              {draft.confidence_score}%
                            </span>
                          </div>
                        </div>
                      </td>

                      <td className="p-3.5">
                        {draft.status === 'pending' ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                            <Clock className="w-3 h-3" />
                            Pending
                          </span>
                        ) : draft.status === 'sent' ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                            <CheckCircle className="w-3 h-3" />
                            Dispatched
                          </span>
                        ) : draft.status === 'discarded' ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-red-500/15 text-red-600 dark:text-red-400 border border-red-500/20">
                            <Trash2 className="w-3 h-3" />
                            Discarded
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-black/[0.05] dark:bg-white/[0.08] text-muted-foreground">
                            {draft.status}
                          </span>
                        )}
                      </td>

                      <td className="p-3.5 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => handleOpenReview(draft)}
                            className="p-1.5 rounded-md hover:bg-black/[0.05] dark:hover:bg-white/[0.08] text-muted-foreground hover:text-foreground transition-colors"
                            title="Inspect & Edit Draft"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>

                          {isPending && (
                            <>
                              <button
                                onClick={() => handleSendSingle(draft.id)}
                                disabled={actionLoading}
                                className="p-1.5 rounded-md hover:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 transition-colors disabled:opacity-50"
                                title="Send Now"
                              >
                                <Send className="w-3.5 h-3.5" />
                              </button>

                              <button
                                onClick={() => handleDiscardSingle(draft.id)}
                                disabled={actionLoading}
                                className="p-1.5 rounded-md hover:bg-red-500/20 text-red-600 dark:text-red-400 transition-colors disabled:opacity-50"
                                title="Discard Draft"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Footer */}
        {totalPages > 1 && (
          <div className="p-3 border-t border-black/[0.06] dark:border-white/[0.06] flex items-center justify-between text-xs text-muted-foreground">
            <div>
              Showing page <strong>{page}</strong> of <strong>{totalPages}</strong> ({totalCount} total)
            </div>
            <div className="flex items-center gap-1">
              <button
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="p-1 rounded border border-black/[0.08] dark:border-white/[0.08] disabled:opacity-40 hover:bg-black/[0.04] dark:hover:bg-white/[0.06] text-foreground"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
              </button>
              <button
                disabled={page >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                className="p-1 rounded border border-black/[0.08] dark:border-white/[0.08] disabled:opacity-40 hover:bg-black/[0.04] dark:hover:bg-white/[0.06] text-foreground"
              >
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Review & Edit Modal Drawer (Windows 11 Dialog) */}
      {activeDraft && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-4xl max-h-[90vh] bg-white dark:bg-[#2C2C2C] rounded-lg shadow-2xl border border-black/[0.1] dark:border-white/[0.1] flex flex-col overflow-hidden">
            {/* Modal Header */}
            <div className="px-5 py-4 border-b border-black/[0.06] dark:border-white/[0.06] flex items-center justify-between bg-black/[0.02] dark:bg-white/[0.02]">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-primary/10 text-primary">
                  <FileText className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
                    Draft Review #{activeDraft.id}
                    <span
                      className={`px-2 py-0.2 rounded-full text-[10px] font-semibold ${
                        activeDraft.status === 'pending'
                          ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400'
                          : activeDraft.status === 'sent'
                          ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
                          : 'bg-red-500/15 text-red-600 dark:text-red-400'
                      }`}
                    >
                      {activeDraft.status.toUpperCase()}
                    </span>
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    To: {activeDraft.from_email} • Confidence: {activeDraft.confidence_score}%
                  </p>
                </div>
              </div>

              <button
                onClick={handleCloseDrawer}
                className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-black/[0.04] dark:hover:bg-white/[0.06] transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Body - Split View */}
            <div className="flex-1 overflow-y-auto p-5 grid grid-cols-1 md:grid-cols-2 gap-5 text-xs">
              {/* Left Column: Original Customer Email Context */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="font-semibold text-muted-foreground flex items-center gap-1.5">
                    <MessageSquare className="w-3.5 h-3.5" />
                    Incoming Customer Message
                  </h4>
                  {activeDraft.intent && (
                    <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-black/[0.04] dark:bg-white/[0.08] text-foreground">
                      Intent: {activeDraft.intent}
                    </span>
                  )}
                </div>

                <div className="p-3.5 rounded-lg border border-black/[0.08] dark:border-white/[0.08] bg-black/[0.02] dark:bg-black/[0.2] space-y-2">
                  <div className="text-muted-foreground">
                    <strong className="text-foreground">From:</strong> {activeDraft.from_email}
                  </div>
                  <div className="text-muted-foreground">
                    <strong className="text-foreground">Subject:</strong> {activeDraft.subject}
                  </div>
                  {activeDraft.ticket_id && (
                    <div className="text-primary font-semibold">
                      Ticket ID: {activeDraft.ticket_id}
                    </div>
                  )}
                  <hr className="border-black/[0.06] dark:border-white/[0.06] my-2" />
                  <div className="text-foreground whitespace-pre-wrap leading-relaxed">
                    {activeDraft.original_body}
                  </div>
                </div>

                <div className="p-3 rounded-lg bg-black/[0.02] dark:bg-white/[0.03] border border-black/[0.06] dark:border-white/[0.06] text-muted-foreground space-y-1">
                  <div className="flex items-center justify-between">
                    <span>Sentiment:</span>
                    <strong className="text-foreground">{activeDraft.sentiment || 'Neutral'}</strong>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Created:</span>
                    <span>{new Date(activeDraft.created_at).toLocaleString()}</span>
                  </div>
                  {activeDraft.reviewed_by && (
                    <div className="flex items-center justify-between">
                      <span>Reviewed By:</span>
                      <span>{activeDraft.reviewed_by}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Right Column: AI Generated Reply (Editable) */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="font-semibold text-primary flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5" />
                    AI Generated Response
                  </h4>
                  <span className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                    <ShieldCheck className="w-3.5 h-3.5" />
                    {activeDraft.confidence_score}% Confidence
                  </span>
                </div>

                <div className="space-y-2.5">
                  <div>
                    <label className="block text-[11px] font-medium text-muted-foreground mb-1">
                      Subject Line
                    </label>
                    <input
                      type="text"
                      value={editSubject}
                      onChange={(e) => {
                        setEditSubject(e.target.value);
                        setIsEditing(true);
                      }}
                      className="w-full px-2.5 py-1.5 text-xs rounded-md border border-black/[0.08] dark:border-white/[0.08] bg-white dark:bg-white/[0.05] text-foreground focus:outline-none focus:border-b-2 focus:border-b-primary shadow-2xs"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-medium text-muted-foreground mb-1">
                      Reply Body (Markdown &amp; Plain Text)
                    </label>
                    <textarea
                      rows={10}
                      value={editBody}
                      onChange={(e) => {
                        setEditBody(e.target.value);
                        setIsEditing(true);
                      }}
                      className="w-full p-2.5 text-xs font-mono rounded-md border border-black/[0.08] dark:border-white/[0.08] bg-white dark:bg-white/[0.05] text-foreground focus:outline-none focus:border-b-2 focus:border-b-primary leading-relaxed shadow-2xs"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="px-5 py-3 border-t border-black/[0.06] dark:border-white/[0.06] flex items-center justify-between bg-black/[0.02] dark:bg-white/[0.02]">
              <div className="flex items-center gap-2">
                {activeDraft.status === 'pending' && (
                  <button
                    onClick={() => handleDiscardSingle(activeDraft.id)}
                    disabled={actionLoading}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md text-red-600 dark:text-red-400 hover:bg-red-500/15 transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    Discard Draft
                  </button>
                )}
              </div>

              <div className="flex items-center gap-2">
                {isEditing && (
                  <button
                    onClick={handleSaveDraftChanges}
                    disabled={actionLoading}
                    className="px-3 py-1.5 text-xs font-medium rounded-md border border-black/[0.08] dark:border-white/[0.08] bg-black/[0.04] dark:bg-white/[0.08] text-foreground hover:opacity-80 transition-opacity"
                  >
                    {actionLoading ? 'Saving...' : 'Save Changes'}
                  </button>
                )}

                {activeDraft.status === 'pending' ? (
                  <button
                    onClick={async () => {
                      if (isEditing) {
                        await handleSaveDraftChanges();
                      }
                      await handleSendSingle(activeDraft.id);
                    }}
                    disabled={actionLoading}
                    className="flex items-center gap-1.5 px-4 py-1.5 text-xs font-semibold rounded-md bg-emerald-600 hover:bg-emerald-500 text-white shadow-xs transition-colors disabled:opacity-50"
                  >
                    <Send className="w-3.5 h-3.5" />
                    {actionLoading ? 'Dispatching...' : 'Approve & Send Now'}
                  </button>
                ) : (
                  <button
                    onClick={handleCloseDrawer}
                    className="px-3 py-1.5 text-xs font-medium rounded-md bg-black/[0.06] dark:bg-white/[0.08] text-foreground"
                  >
                    Close
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
