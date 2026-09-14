import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
  CheckCircle,
  RefreshCw,
  AlertTriangle,
  User,
  Settings as SettingsIcon,
} from 'lucide-react';
import { api } from '../lib/api';
import {
  DraftItem,
  DraftMetrics,
  DraftMetricsCards,
  DraftFilterBar,
  BatchActionBar,
  DraftsTable,
  DraftReviewModal,
} from '@/components/drafts';

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
      api.getAllEmailAccounts()
        .then((res) => {
          const accs = Array.isArray(res) ? res : res?.accounts || [];
          setAccounts(accs);
          if (!selectedClientId) {
            setSelectedClientId('ALL');
          }
        })
        .catch(console.error);
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
              type="button"
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
              onChange={(e) => {
                setSelectedClientId(e.target.value);
                setPage(1);
              }}
              className="px-3 py-1.5 text-xs rounded-md border border-black/[0.08] dark:border-white/[0.08] bg-white/80 dark:bg-white/[0.05] text-foreground font-medium focus:outline-none focus:border-b-2 focus:border-b-primary shadow-2xs min-w-[220px] cursor-pointer"
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

      {/* KPI Status Tiles */}
      <DraftMetricsCards
        metrics={metrics}
        statusFilter={statusFilter}
        onSelectStatus={(st) => {
          setStatusFilter(st);
          setPage(1);
        }}
      />

      {/* Filter & Search Bar */}
      <DraftFilterBar
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        senderFilter={senderFilter}
        setSenderFilter={setSenderFilter}
        intentFilter={intentFilter}
        setIntentFilter={setIntentFilter}
        sentimentFilter={sentimentFilter}
        setSentimentFilter={setSentimentFilter}
        minScore={minScore}
        setMinScore={setMinScore}
        statusFilter={statusFilter}
        setStatusFilter={setStatusFilter}
        onFilterChangeResetPage={() => setPage(1)}
      />

      {/* Floating & Filter-based Batch Action Bars */}
      <BatchActionBar
        selectedIds={selectedIds}
        onClearSelection={() => setSelectedIds([])}
        batchActionLoading={batchActionLoading}
        onBatchSendSelected={handleBatchSendSelected}
        onBatchDiscardSelected={handleBatchDiscardSelected}
        statusFilter={statusFilter}
        totalCount={totalCount}
        onBatchSendByFilter={handleBatchSendByFilter}
      />

      {/* Drafts List Table */}
      <DraftsTable
        drafts={drafts}
        loading={loading}
        statusFilter={statusFilter}
        selectedIds={selectedIds}
        onToggleSelectAll={toggleSelectAll}
        onToggleSelectOne={toggleSelectOne}
        onOpenReview={handleOpenReview}
        onSendSingle={handleSendSingle}
        onDiscardSingle={handleDiscardSingle}
        actionLoading={actionLoading}
        page={page}
        setPage={setPage}
        totalPages={totalPages}
        totalCount={totalCount}
      />

      {/* Review & Edit Modal Drawer */}
      <DraftReviewModal
        activeDraft={activeDraft}
        onClose={handleCloseDrawer}
        editSubject={editSubject}
        setEditSubject={setEditSubject}
        editBody={editBody}
        setEditBody={setEditBody}
        isEditing={isEditing}
        setIsEditing={setIsEditing}
        actionLoading={actionLoading}
        onDiscardSingle={handleDiscardSingle}
        onSaveDraftChanges={handleSaveDraftChanges}
        onSendSingle={handleSendSingle}
      />
    </div>
  );
}
export default Drafts;
