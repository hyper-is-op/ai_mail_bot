import { useState, useEffect } from 'react';
import {
  Code2,
  CheckCircle,
  Plus,
  Sparkles,
  Globe,
  AlertTriangle,
  X,
} from 'lucide-react';
import { api } from '@/lib/api';
import {
  ConnectorConfig,
  ConnectorFormData,
  OAuthTestResult,
  AiTemplateForm,
  AiTemplateResult,
  AllowlistItem,
  defaultFormData,
} from '@/components/payload-config/types';
import { ConnectorStats } from '@/components/payload-config/ConnectorStats';
import { ConnectorList } from '@/components/payload-config/ConnectorList';
import { ConnectorEditorModal } from '@/components/payload-config/ConnectorEditorModal';
import { AiTemplateModal } from '@/components/payload-config/AiTemplateModal';
import { AllowlistModal } from '@/components/payload-config/AllowlistModal';
import { DeleteConfirmModal } from '@/components/payload-config/DeleteConfirmModal';
import { RejectReasonModal } from '@/components/payload-config/RejectReasonModal';

export default function PayloadConfig() {
  const user = JSON.parse(localStorage.getItem('user') || '{}');
  const isAdmin = user?.role === 'admin';

  const [selectedClientId, setSelectedClientId] = useState(user?.client_id || '');
  const [clients, setClients] = useState<any[]>([]);
  const [connectors, setConnectors] = useState<ConnectorConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);

  // Modals & Panels
  const [showEditor, setShowEditor] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [showAiModal, setShowAiModal] = useState(false);
  const [showAllowlistModal, setShowAllowlistModal] = useState(false);
  const [showRejectModal, setShowRejectModal] = useState<number | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [showDeleteModal, setShowDeleteModal] = useState<ConnectorConfig | null>(null);
  const [deletingDraftId, setDeletingDraftId] = useState<number | null>(null);

  // Allowlist state
  const [allowlist, setAllowlist] = useState<AllowlistItem[]>([]);
  const [newAllowlistUrl, setNewAllowlistUrl] = useState('');
  const [allowlistLoading, setAllowlistLoading] = useState(false);

  // Form State
  const [formData, setFormData] = useState<ConnectorFormData>(defaultFormData);
  const [submitting, setSubmitting] = useState(false);
  const [oauthTesting, setOauthTesting] = useState(false);
  const [oauthTestResult, setOauthTestResult] = useState<OAuthTestResult | null>(null);

  // AI Generator Form State
  const [aiForm, setAiForm] = useState<AiTemplateForm>({
    trigger_type: 'ticket_create',
    crm_schema_description: '',
    sample_response: '',
  });
  const [aiGenerating, setAiGenerating] = useState(false);
  const [aiResult, setAiResult] = useState<AiTemplateResult | null>(null);

  useEffect(() => {
    if (isAdmin) {
      api.getAllEmailAccounts()
        .then((data) => {
          const list = data || [];
          setClients(list);
          if (list.length > 0 && !selectedClientId) {
            setSelectedClientId(list[0].client_id);
          }
        })
        .catch((err) => console.error('Failed to fetch clients:', err));
    }
  }, [isAdmin]);

  useEffect(() => {
    loadConnectors();
  }, [selectedClientId]);

  const loadConnectors = async () => {
    if (!selectedClientId) return;
    setLoading(true);
    try {
      const data = await api.listConnectorConfigs(selectedClientId);
      setConnectors(Array.isArray(data) ? data : []);
    } catch (err: any) {
      console.error('Failed to load connector configs:', err);
      setMsg({ type: 'error', text: err.message || 'Failed to load connector configurations' });
    } finally {
      setLoading(false);
    }
  };

  const loadAllowlist = async () => {
    if (!isAdmin) return;
    setAllowlistLoading(true);
    try {
      const list = await api.getUrlAllowlist();
      setAllowlist(Array.isArray(list) ? list : []);
    } catch (err: any) {
      console.error('Failed to load URL allowlist:', err);
    } finally {
      setAllowlistLoading(false);
    }
  };

  const openAllowlist = () => {
    setShowAllowlistModal(true);
    loadAllowlist();
  };

  const handleAddAllowlist = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAllowlistUrl.trim()) return;
    try {
      await api.addUrlAllowlist({ url: newAllowlistUrl.trim() });
      setNewAllowlistUrl('');
      loadAllowlist();
      setMsg({ type: 'success', text: 'URL successfully added to allowlist.' });
    } catch (err: any) {
      setMsg({ type: 'error', text: err.message || 'Failed to add URL to allowlist' });
    }
  };

  const handleOpenCreate = () => {
    setEditingId(null);
    setOauthTestResult(null);
    setFormData({
      ...defaultFormData,
      client_id: selectedClientId || (clients[0]?.client_id || user?.client_id || ''),
    });
    setShowEditor(true);
  };

  const handleOpenEdit = (config: ConnectorConfig) => {
    setEditingId(config.id);
    setOauthTestResult(null);
    const isStandard = ['ticket_create', 'ticket_status', 'order_status'].includes(config.trigger_type);
    setFormData({
      ...defaultFormData,
      client_id: config.client_id,
      trigger_type: isStandard ? config.trigger_type : 'custom',
      custom_trigger: isStandard ? '' : config.trigger_type,
      http_method: config.http_method,
      url: config.url,
      auth_type: (config.auth_type as any) || 'bearer',
      auth_field_name: config.auth_field_name || '',
      auth_secret: '',
      oauth_token_url: config.oauth_token_url || '',
      oauth_client_id: config.oauth_client_id || '',
      oauth_client_secret: '',
      oauth_refresh_token: '',
      oauth_grant_type: (config.oauth_grant_type as any) || 'client_credentials',
      oauth_header_prefix: config.oauth_header_prefix || 'Bearer',
      oauth_scope: config.oauth_scope || '',
      oauth_token_auth_method: (config.oauth_token_auth_method as any) || 'client_secret_post',
      payload_encoding: (config.payload_encoding as any) || 'plain',
      base64_query_param_name: config.base64_query_param_name || 'data',
      headers_template: config.headers_template || '{\n  "Content-Type": "application/json"\n}',
      request_template: config.request_template || '',
      response_mapping: config.response_mapping || '',
      status: config.status === 'draft' ? 'draft' : 'pending_approval',
    });
    setShowEditor(true);
  };

  const handleTestOAuth = async () => {
    if (!formData.oauth_token_url || !formData.oauth_client_id || !formData.oauth_client_secret) {
      setOauthTestResult({ success: false, error: 'Token URL, Client ID, and Client Secret are required.' });
      return;
    }
    setOauthTesting(true);
    setOauthTestResult(null);
    try {
      const res = await api.testOAuthTokenHandshake({
        token_url: formData.oauth_token_url,
        client_id: formData.oauth_client_id,
        client_secret: formData.oauth_client_secret,
        refresh_token: formData.oauth_refresh_token || undefined,
        grant_type: formData.oauth_grant_type,
        header_prefix: formData.oauth_header_prefix,
        scope: formData.oauth_scope || undefined,
        token_auth_method: formData.oauth_token_auth_method,
      });
      setOauthTestResult(res);
    } catch (err: any) {
      setOauthTestResult({ success: false, error: err.message || 'Token handshake failed' });
    } finally {
      setOauthTesting(false);
    }
  };

  const handleSubmitConnector = async (e: React.FormEvent, targetStatus: 'draft' | 'pending_approval' = 'pending_approval') => {
    e.preventDefault();
    setSubmitting(true);
    setMsg(null);

    const actualTrigger = formData.trigger_type === 'custom' ? formData.custom_trigger.trim() : formData.trigger_type;
    if (!actualTrigger) {
      setMsg({ type: 'error', text: 'Please specify a trigger type.' });
      setSubmitting(false);
      return;
    }
    if (!formData.client_id) {
      setMsg({ type: 'error', text: 'Please specify a Client ID.' });
      setSubmitting(false);
      return;
    }

    try {
      let finalAuthSecret = formData.auth_secret || null;
      if (formData.auth_type === 'oauth2_client_credentials') {
        if (formData.oauth_token_url && formData.oauth_client_id) {
          finalAuthSecret = JSON.stringify({
            token_url: formData.oauth_token_url.trim(),
            client_id: formData.oauth_client_id.trim(),
            client_secret: formData.oauth_client_secret ? formData.oauth_client_secret.trim() : (editingId ? '__KEEP_EXISTING__' : ''),
            refresh_token: formData.oauth_refresh_token ? formData.oauth_refresh_token.trim() : (editingId ? '__KEEP_EXISTING__' : ''),
            grant_type: formData.oauth_grant_type || 'client_credentials',
            header_prefix: formData.oauth_header_prefix || 'Bearer',
            scope: formData.oauth_scope || '',
            token_auth_method: formData.oauth_token_auth_method || 'client_secret_post',
          });
        }
      }

      const payload: any = {
        client_id: formData.client_id,
        trigger_type: actualTrigger,
        http_method: formData.http_method,
        url: formData.url,
        headers_template: formData.headers_template || null,
        request_template: formData.request_template || null,
        response_mapping: formData.response_mapping || null,
        auth_type: formData.auth_type,
        auth_secret: finalAuthSecret,
        auth_field_name: formData.auth_field_name || null,
        payload_encoding: formData.payload_encoding,
        base64_query_param_name: formData.payload_encoding === 'base64_query' ? formData.base64_query_param_name : null,
        status: targetStatus,
      };

      if (editingId) {
        await api.regenerateConnectorConfig(payload);
        setMsg({
          type: 'success',
          text: targetStatus === 'pending_approval'
            ? 'Connector updated! A new version waiting for approval was created. Active live config remains running until approved.'
            : 'Connector changes saved as draft.',
        });
      } else {
        await api.createConnectorConfig(payload);
        setMsg({
          type: 'success',
          text: targetStatus === 'pending_approval'
            ? 'Connector submitted for approval successfully!'
            : 'Connector saved as draft.',
        });
      }

      setShowEditor(false);
      loadConnectors();
    } catch (err: any) {
      setMsg({ type: 'error', text: err.message || 'Failed to save connector configuration.' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleApprove = async (config: ConnectorConfig) => {
    try {
      await api.approveConnectorConfig(config.id, { client_id: config.client_id });
      setMsg({ type: 'success', text: `Connector #${config.id} (${config.trigger_type}) approved and activated!` });
      loadConnectors();
    } catch (err: any) {
      setMsg({ type: 'error', text: err.message || 'Approval failed' });
    }
  };

  const handleReject = async () => {
    if (!showRejectModal) return;
    try {
      const cfg = connectors.find((c) => c.id === showRejectModal);
      if (!cfg) return;
      await api.rejectConnectorConfig(showRejectModal, { client_id: cfg.client_id, reason: rejectReason });
      setMsg({ type: 'info', text: `Connector #${showRejectModal} was rejected.` });
      setShowRejectModal(null);
      setRejectReason('');
      loadConnectors();
    } catch (err: any) {
      setMsg({ type: 'error', text: err.message || 'Rejection failed' });
    }
  };

  const handleDeleteConfirm = async () => {
    if (!showDeleteModal) return;
    setDeletingDraftId(showDeleteModal.id);
    try {
      if (showDeleteModal.status === 'draft' || showDeleteModal.status === 'pending_approval') {
        await api.deleteDraftConnectorConfig(showDeleteModal.id);
        setMsg({
          type: 'success',
          text: `${showDeleteModal.status === 'pending_approval' ? 'Pending approval' : 'Draft'} connector #${showDeleteModal.id} (${showDeleteModal.trigger_type}) was permanently deleted.`,
        });
      } else if (showDeleteModal.status === 'live') {
        if (isAdmin) {
          await api.approveDeleteConnector(showDeleteModal.id);
          setMsg({
            type: 'success',
            text: `Live connector #${showDeleteModal.id} (${showDeleteModal.trigger_type}) was permanently deleted by admin.`,
          });
        } else {
          await api.requestDeleteConnector(showDeleteModal.id);
          setMsg({
            type: 'info',
            text: `Takedown & deletion requested for live connector #${showDeleteModal.id}. Awaiting administrator approval.`,
          });
        }
      } else if (showDeleteModal.status === 'disabled') {
        if (isAdmin) {
          await api.approveDeleteConnector(showDeleteModal.id);
          setMsg({
            type: 'success',
            text: `Disabled connector #${showDeleteModal.id} (${showDeleteModal.trigger_type}) was permanently deleted by admin.`,
          });
        } else {
          await api.requestDeleteConnector(showDeleteModal.id);
          setMsg({
            type: 'info',
            text: `Deletion requested for connector #${showDeleteModal.id}. Awaiting administrator approval.`,
          });
        }
      }
      setShowDeleteModal(null);
      loadConnectors();
    } catch (err: any) {
      setMsg({ type: 'error', text: err.message || 'Action failed' });
    } finally {
      setDeletingDraftId(null);
    }
  };

  const handleTakedownLive = async (config: ConnectorConfig) => {
    try {
      if (isAdmin) {
        await api.takedownConnector(config.id);
        setMsg({
          type: 'success',
          text: `Live connector #${config.id} (${config.trigger_type}) was taken down and disabled.`,
        });
      } else {
        await api.requestDeleteConnector(config.id);
        setMsg({
          type: 'info',
          text: `Takedown requested for live connector #${config.id}. Administrator has been notified.`,
        });
      }
      loadConnectors();
    } catch (err: any) {
      setMsg({ type: 'error', text: err.message || 'Failed to take down connector' });
    }
  };

  const handleApproveDeletion = async (config: ConnectorConfig) => {
    try {
      await api.approveDeleteConnector(config.id);
      setMsg({
        type: 'success',
        text: `Connector #${config.id} (${config.trigger_type}) deletion approved and permanently removed.`,
      });
      loadConnectors();
    } catch (err: any) {
      setMsg({ type: 'error', text: err.message || 'Failed to approve deletion' });
    }
  };

  const handleRejectDeletion = async (config: ConnectorConfig) => {
    try {
      await api.rejectDeleteConnector(config.id);
      setMsg({
        type: 'info',
        text: `Connector #${config.id} deletion request was rejected. Status remains disabled.`,
      });
      loadConnectors();
    } catch (err: any) {
      setMsg({ type: 'error', text: err.message || 'Failed to reject deletion' });
    }
  };

  const handleCancelDeletionRequest = async (config: ConnectorConfig) => {
    try {
      await api.cancelDeleteRequest(config.id);
      setMsg({
        type: 'info',
        text: `Deletion request for connector #${config.id} cancelled.`,
      });
      loadConnectors();
    } catch (err: any) {
      setMsg({ type: 'error', text: err.message || 'Failed to cancel deletion request' });
    }
  };

  const handleGenerateAiPreview = async (e: React.FormEvent) => {
    e.preventDefault();
    setAiGenerating(true);
    setAiResult(null);
    try {
      const activeClientId = selectedClientId || (clients[0]?.client_id || user?.client_id || 'test');
      const res = await api.generateConnectorTemplatePreview({
        client_id: activeClientId,
        trigger_type: aiForm.trigger_type,
        crm_schema_description: aiForm.crm_schema_description,
        sample_response: aiForm.sample_response,
      });
      setAiResult(res);
    } catch (err: any) {
      setAiResult({ error: err.message || 'Failed to generate preview' });
    } finally {
      setAiGenerating(false);
    }
  };

  const handleApplyAiResult = () => {
    if (!aiResult) return;
    setFormData((prev) => ({
      ...prev,
      trigger_type: aiForm.trigger_type,
      request_template: JSON.stringify(aiResult.request_template, null, 2),
      response_mapping: JSON.stringify(aiResult.response_mapping, null, 2),
    }));
    setShowAiModal(false);
    setShowEditor(true);
    setMsg({ type: 'info', text: 'AI template applied to connector form. Review and submit.' });
  };

  // Stats computation
  const stats = {
    total: connectors.length,
    live: connectors.filter((c) => c.status === 'live').length,
    pending: connectors.filter((c) => c.status === 'pending_approval' || c.status === 'pending_deletion').length,
    drafts: connectors.filter((c) => c.status === 'draft').length,
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-primary/10 text-primary">
              <Code2 className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-2xl sm:text-3xl font-bold tracking-tight bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">
                System Connector
              </h2>
              <p className="text-muted-foreground text-sm">
                Connect external CRM/Ticketing systems for dynamic ticket creation and status tracking.
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {isAdmin && (
            <>
              <button
                type="button"
                onClick={openAllowlist}
                className="flex items-center gap-2 px-3 py-2 text-xs font-medium rounded-xl border border-zinc-200 dark:border-white/10 hover:bg-zinc-100 dark:hover:bg-white/5 transition-all text-muted-foreground hover:text-foreground cursor-pointer"
              >
                <Globe className="w-4 h-4 text-emerald-500" />
                URL Allowlist
              </button>
              {clients.length > 0 && (
                <div className="flex items-center gap-2 bg-zinc-100 dark:bg-white/5 px-3 py-1.5 rounded-xl border border-zinc-200 dark:border-white/10">
                  <span className="text-xs text-muted-foreground font-semibold">Client:</span>
                  <select
                    value={selectedClientId}
                    onChange={(e) => setSelectedClientId(e.target.value)}
                    className="bg-transparent text-xs font-medium focus:outline-none cursor-pointer"
                  >
                    {clients.map((c) => (
                      <option key={c.client_id} value={c.client_id} className="dark:bg-zinc-900">
                        {c.client_id} {c.company_name ? `(${c.company_name})` : ''}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </>
          )}

          <button
            type="button"
            onClick={() => {
              setAiResult(null);
              setShowAiModal(true);
            }}
            className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20 hover:bg-purple-500/20 transition-all cursor-pointer"
          >
            <Sparkles className="w-4 h-4" />
            AI Template Generator
          </button>

          <button
            type="button"
            onClick={handleOpenCreate}
            className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 transition-all shadow-sm cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            New Connector
          </button>
        </div>
      </div>

      {/* Global Alert / Flash message */}
      {msg && (
        <div
          className={`flex items-center justify-between p-4 rounded-xl border transition-all ${
            msg.type === 'success'
              ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-600 dark:text-emerald-400'
              : msg.type === 'error'
              ? 'bg-rose-500/10 border-rose-500/20 text-rose-600 dark:text-rose-400'
              : 'bg-blue-500/10 border-blue-500/20 text-blue-600 dark:text-blue-400'
          }`}
        >
          <div className="flex items-center gap-2.5">
            {msg.type === 'success' ? (
              <CheckCircle className="w-5 h-5" />
            ) : (
              <AlertTriangle className="w-5 h-5" />
            )}
            <span className="text-sm font-medium">{msg.text}</span>
          </div>
          <button type="button" onClick={() => setMsg(null)} className="p-1 hover:opacity-75 cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Stats Cards */}
      <ConnectorStats stats={stats} />

      {/* Connector List */}
      <ConnectorList
        connectors={connectors}
        loading={loading}
        isAdmin={isAdmin}
        onRefresh={loadConnectors}
        onOpenCreate={handleOpenCreate}
        onOpenEdit={handleOpenEdit}
        onTakedownLive={handleTakedownLive}
        onShowDeleteModal={setShowDeleteModal}
        onApprove={handleApprove}
        onReject={(configId) => {
          setShowRejectModal(configId);
          setRejectReason('');
        }}
        onApproveDeletion={handleApproveDeletion}
        onRejectDeletion={handleRejectDeletion}
        onCancelDeletionRequest={handleCancelDeletionRequest}
      />

      {/* Editor Modal (Create / Edit) */}
      <ConnectorEditorModal
        isOpen={showEditor}
        onClose={() => setShowEditor(false)}
        editingId={editingId}
        formData={formData}
        setFormData={setFormData}
        submitting={submitting}
        onSubmit={handleSubmitConnector}
        oauthTesting={oauthTesting}
        oauthTestResult={oauthTestResult}
        onTestOAuth={handleTestOAuth}
        isAdmin={isAdmin}
        clients={clients}
      />

      {/* AI Template Preview Modal */}
      <AiTemplateModal
        isOpen={showAiModal}
        onClose={() => setShowAiModal(false)}
        aiForm={aiForm}
        setAiForm={setAiForm}
        aiGenerating={aiGenerating}
        aiResult={aiResult}
        onGenerateAiPreview={handleGenerateAiPreview}
        onApplyAiResult={handleApplyAiResult}
      />

      {/* Admin Reject Modal */}
      <RejectReasonModal
        isOpen={showRejectModal !== null}
        onClose={() => setShowRejectModal(null)}
        rejectReason={rejectReason}
        setRejectReason={setRejectReason}
        onConfirmReject={handleReject}
      />

      {/* Delete Draft / Disabled Confirmation Modal */}
      <DeleteConfirmModal
        connector={showDeleteModal}
        isOpen={showDeleteModal !== null}
        onClose={() => setShowDeleteModal(null)}
        onConfirm={handleDeleteConfirm}
        deleting={deletingDraftId !== null}
        isAdmin={isAdmin}
      />

      {/* Admin Allowlist Modal */}
      <AllowlistModal
        isOpen={showAllowlistModal}
        onClose={() => setShowAllowlistModal(false)}
        allowlist={allowlist}
        allowlistLoading={allowlistLoading}
        newAllowlistUrl={newAllowlistUrl}
        setNewAllowlistUrl={setNewAllowlistUrl}
        onAddAllowlist={handleAddAllowlist}
      />
    </div>
  );
}
