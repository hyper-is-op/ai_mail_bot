import { useState, useEffect } from 'react';
import {
  Code2,
  Loader2,
  CheckCircle,
  XCircle,
  Edit3,
  RefreshCw,
  Plus,
  Sparkles,
  Globe,
  Lock,
  ChevronDown,
  ChevronRight,
  AlertTriangle,
  Layers,
  Check,
  X,
  Trash2,
} from 'lucide-react';
import { api } from '@/lib/api';

const CONTEXT_VARS = [
  '{{client_id}}',
  '{{from_email}}',
  '{{subject}}',
  '{{body}}',
  '{{cleaned_body}}',
  '{{ticket_id}}',
  '{{intent}}',
  '{{sentiment}}',
  '{{priority}}',
];

interface ConnectorConfig {
  id: number;
  client_id: string;
  trigger_type: string;
  http_method: string;
  url: string;
  response_mapping?: string | null;
  headers_template?: string | null;
  request_template?: string | null;
  auth_type: string;
  auth_field_name?: string | null;
  payload_encoding?: 'plain' | 'base64_query';
  base64_query_param_name?: string | null;
  oauth_token_url?: string;
  oauth_client_id?: string;
  oauth_grant_type?: 'client_credentials' | 'refresh_token';
  oauth_header_prefix?: string;
  oauth_scope?: string;
  oauth_token_auth_method?: 'client_secret_post' | 'client_secret_basic';
  oauth_has_secret?: boolean;
  oauth_has_refresh_token?: boolean;
  status: 'draft' | 'pending_approval' | 'live' | 'disabled' | 'pending_deletion';
  version: number;
  created_by?: string;
  approved_by?: string;
  approved_at?: string;
  created_at: string;
  requires_regex_review?: boolean;
}

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
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [showDeleteModal, setShowDeleteModal] = useState<ConnectorConfig | null>(null);
  const [deletingDraftId, setDeletingDraftId] = useState<number | null>(null);

  // Allowlist state
  const [allowlist, setAllowlist] = useState<any[]>([]);
  const [newAllowlistUrl, setNewAllowlistUrl] = useState('');
  const [allowlistLoading, setAllowlistLoading] = useState(false);

  // Form State
  const defaultFormData = {
    client_id: selectedClientId || user?.client_id || '',
    trigger_type: 'ticket_create',
    custom_trigger: '',
    http_method: 'POST',
    url: '',
    auth_type: 'bearer' as 'bearer' | 'basic' | 'api_key_header' | 'api_key_query' | 'oauth2_client_credentials',
    auth_secret: '',
    auth_field_name: '',
    oauth_token_url: '',
    oauth_client_id: '',
    oauth_client_secret: '',
    oauth_refresh_token: '',
    oauth_grant_type: 'client_credentials' as 'client_credentials' | 'refresh_token',
    oauth_header_prefix: 'Bearer',
    oauth_scope: '',
    oauth_token_auth_method: 'client_secret_post' as 'client_secret_post' | 'client_secret_basic',
    payload_encoding: 'plain' as 'plain' | 'base64_query',
    base64_query_param_name: 'data',
    headers_template: '{\n  "Content-Type": "application/json"\n}',
    request_template: '{\n  "client_id": "{{client_id}}",\n  "mail_id": "{{from_email}}",\n  "subject": "{{subject}}",\n  "body": "{{body}}",\n  "priority_name": "{{priority}}"\n}',
    response_mapping: '{\n  "fields": [\n    {\n      "field": "ticket_id",\n      "path": "Refrence_No",\n      "extract_regex": null\n    }\n  ]\n}',
    status: 'pending_approval' as 'draft' | 'pending_approval',
  };
  const [formData, setFormData] = useState(defaultFormData);
  const [submitting, setSubmitting] = useState(false);
  const [oauthTesting, setOauthTesting] = useState(false);
  const [oauthTestResult, setOauthTestResult] = useState<{ success: boolean; message?: string; error?: string; expires_in?: number; duration_ms?: number } | null>(null);

  // AI Generator Form State
  const [aiForm, setAiForm] = useState({
    trigger_type: 'ticket_create',
    crm_schema_description: '',
    sample_response: '',
  });
  const [aiGenerating, setAiGenerating] = useState(false);
  const [aiResult, setAiResult] = useState<{ request_template?: any; response_mapping?: any; error?: string } | null>(null);

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

  const insertVariable = (varName: string, field: 'request_template' | 'headers_template') => {
    setFormData((prev) => ({
      ...prev,
      [field]: prev[field] + `\n"${varName.replace(/[{}]/g, '')}": "${varName}",`,
    }));
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
                onClick={openAllowlist}
                className="flex items-center gap-2 px-3 py-2 text-xs font-medium rounded-xl border border-zinc-200 dark:border-white/10 hover:bg-zinc-100 dark:hover:bg-white/5 transition-all text-muted-foreground hover:text-foreground"
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
            onClick={() => {
              setAiResult(null);
              setShowAiModal(true);
            }}
            className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20 hover:bg-purple-500/20 transition-all"
          >
            <Sparkles className="w-4 h-4" />
            AI Template Generator
          </button>

          <button
            onClick={handleOpenCreate}
            className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 transition-all shadow-sm"
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
          <button onClick={() => setMsg(null)} className="p-1 hover:opacity-75">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Stats Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="p-4 rounded-2xl border border-zinc-200 dark:border-white/10 bg-card/50 backdrop-blur-sm">
          <div className="text-xs text-muted-foreground font-medium">Total Connectors</div>
          <div className="text-2xl font-bold mt-1">{stats.total}</div>
        </div>

        <div className="p-4 rounded-2xl border border-emerald-500/20 bg-emerald-500/5">
          <div className="text-xs text-emerald-600 dark:text-emerald-400 font-medium">Active (Live)</div>
          <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 mt-1">{stats.live}</div>
        </div>

        <div className="p-4 rounded-2xl border border-amber-500/20 bg-amber-500/5">
          <div className="text-xs text-amber-600 dark:text-amber-400 font-medium">Pending Approvals</div>
          <div className="text-2xl font-bold text-amber-600 dark:text-amber-400 mt-1">{stats.pending}</div>
        </div>

        <div className="p-4 rounded-2xl border border-zinc-500/20 bg-zinc-500/5">
          <div className="text-xs text-muted-foreground font-medium">Drafts</div>
          <div className="text-2xl font-bold mt-1">{stats.drafts}</div>
        </div>
      </div>

      {/* Connector List */}
      <div className="rounded-2xl border border-zinc-200 dark:border-white/10 bg-card overflow-hidden">
        <div className="p-5 border-b border-zinc-200 dark:border-white/10 flex justify-between items-center bg-zinc-50/50 dark:bg-white/[0.02]">
          <div className="flex items-center gap-2">
            <Layers className="w-5 h-5 text-muted-foreground" />
            <h3 className="font-semibold text-base">Configured Endpoints</h3>
            <span className="text-xs px-2 py-0.5 rounded-full bg-zinc-200 dark:bg-white/10 text-muted-foreground">
              {connectors.length}
            </span>
          </div>

          <button
            onClick={loadConnectors}
            disabled={loading}
            className="p-1.5 text-muted-foreground hover:text-foreground rounded-lg hover:bg-zinc-100 dark:hover:bg-white/5 transition-all"
            title="Refresh List"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>

        {loading ? (
          <div className="p-12 text-center text-muted-foreground flex flex-col items-center gap-3">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
            <p className="text-sm">Loading connector configurations...</p>
          </div>
        ) : connectors.length === 0 ? (
          <div className="p-12 text-center text-muted-foreground flex flex-col items-center gap-3">
            <div className="p-3 rounded-2xl bg-zinc-100 dark:bg-white/5">
              <Code2 className="w-8 h-8 text-muted-foreground/60" />
            </div>
            <p className="font-medium text-sm text-foreground">No connectors configured yet</p>
            <p className="text-xs max-w-sm">
              Create a new connector for ticket creation or order tracking, or use the AI Generator to draft templates.
            </p>
            <button
              onClick={handleOpenCreate}
              className="mt-2 text-xs font-semibold px-4 py-2 rounded-xl bg-primary text-primary-foreground hover:bg-primary/90"
            >
              Add First Connector
            </button>
          </div>
        ) : (
          <div className="divide-y divide-zinc-200 dark:divide-white/5">
            {connectors.map((config) => {
              const isExpanded = expandedId === config.id;
              return (
                <div key={config.id} className="p-5 hover:bg-zinc-50/50 dark:hover:bg-white/[0.01] transition-all">
                  <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                    <div className="space-y-1.5 flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono text-xs px-2.5 py-1 rounded-lg bg-primary/10 text-primary font-semibold border border-primary/20">
                          {config.trigger_type}
                        </span>
                        <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-zinc-200 dark:bg-white/10">
                          {config.http_method}
                        </span>
                        <span
                          className={`text-xs px-2.5 py-0.5 rounded-full font-medium border ${
                            config.status === 'live'
                              ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-600 dark:text-emerald-400'
                              : config.status === 'pending_approval'
                              ? 'bg-amber-500/10 border-amber-500/20 text-amber-600 dark:text-amber-400 animate-pulse'
                              : config.status === 'pending_deletion'
                              ? 'bg-rose-500/10 border-rose-500/30 text-rose-600 dark:text-rose-400 animate-pulse'
                              : config.status === 'draft'
                              ? 'bg-zinc-500/10 border-zinc-500/20 text-zinc-600 dark:text-zinc-400'
                              : 'bg-zinc-500/10 border-zinc-500/20 text-zinc-500 dark:text-zinc-400'
                          }`}
                        >
                          {config.status === 'live'
                            ? '● Live'
                            : config.status === 'pending_approval'
                            ? '⏳ Pending Approval'
                            : config.status === 'pending_deletion'
                            ? '🗑️ Deletion Requested'
                            : config.status === 'draft'
                            ? 'Draft'
                            : 'Disabled'}
                        </span>
                        <span className="text-xs text-muted-foreground">v{config.version}</span>
                        {config.requires_regex_review && (
                          <span className="flex items-center gap-1 text-[11px] px-2 py-0.5 rounded bg-orange-500/10 text-orange-600 border border-orange-500/20">
                            <AlertTriangle className="w-3 h-3" />
                            Regex Review Needed
                          </span>
                        )}
                        {isAdmin && (
                          <span className="text-xs font-medium px-2 py-0.5 rounded bg-zinc-100 dark:bg-white/5 text-muted-foreground">
                            Client: {config.client_id}
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-2 font-mono text-xs text-foreground/90 truncate">
                        <Globe className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
                        <span className="truncate">{config.url}</span>
                      </div>

                      <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground pt-1">
                        <span className="flex items-center gap-1">
                          <Lock className="w-3 h-3" />
                          Auth: {config.auth_type}
                        </span>
                        <span>Created: {new Date(config.created_at).toLocaleDateString()}</span>
                        {config.approved_by && (
                          <span>Approved by: {config.approved_by}</span>
                        )}
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        onClick={() => setExpandedId(isExpanded ? null : config.id)}
                        className="px-3 py-1.5 text-xs font-medium rounded-xl border border-zinc-200 dark:border-white/10 hover:bg-zinc-100 dark:hover:bg-white/5 transition-all text-muted-foreground hover:text-foreground flex items-center gap-1"
                      >
                        {isExpanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                        {isExpanded ? 'Hide Specs' : 'View Specs'}
                      </button>

                      {config.status !== 'pending_deletion' && (
                        <button
                          onClick={() => handleOpenEdit(config)}
                          className="px-3 py-1.5 text-xs font-medium rounded-xl border border-zinc-200 dark:border-white/10 hover:bg-zinc-100 dark:hover:bg-white/5 transition-all text-muted-foreground hover:text-foreground flex items-center gap-1 cursor-pointer"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                          {config.status === 'live' ? 'Edit Version' : 'Edit'}
                        </button>
                      )}

                      {/* Live Takedown / Delete */}
                      {config.status === 'live' && (
                        <>
                          <button
                            onClick={() => handleTakedownLive(config)}
                            className="px-3 py-1.5 text-xs font-medium rounded-xl border border-amber-500/20 text-amber-600 hover:bg-amber-500/10 transition-all flex items-center gap-1 cursor-pointer"
                            title={isAdmin ? "Take Down Live Connector (Disable)" : "Request Admin to Take Down Live Connector"}
                          >
                            <AlertTriangle className="w-3.5 h-3.5" />
                            {isAdmin ? 'Take Down' : 'Request Takedown'}
                          </button>

                          <button
                            onClick={() => setShowDeleteModal(config)}
                            className="px-3 py-1.5 text-xs font-medium rounded-xl border border-rose-500/20 text-rose-600 hover:bg-rose-500/10 transition-all flex items-center gap-1 cursor-pointer"
                            title={isAdmin ? "Permanently Delete Live Connector" : "Request Admin to Delete Live Connector"}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            {isAdmin ? 'Delete' : 'Request Delete'}
                          </button>
                        </>
                      )}

                      {/* Draft Delete */}
                      {config.status === 'draft' && (
                        <button
                          onClick={() => setShowDeleteModal(config)}
                          className="px-3 py-1.5 text-xs font-medium rounded-xl border border-rose-500/20 text-rose-600 hover:bg-rose-500/10 transition-all flex items-center gap-1"
                          title="Delete Draft Connector"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          Delete Draft
                        </button>
                      )}

                      {/* Pending Approval Delete */}
                      {config.status === 'pending_approval' && (
                        <button
                          onClick={() => setShowDeleteModal(config)}
                          className="px-3 py-1.5 text-xs font-medium rounded-xl border border-rose-500/20 text-rose-600 hover:bg-rose-500/10 transition-all flex items-center gap-1"
                          title="Delete Pending Approval Connector"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          Delete Pending
                        </button>
                      )}

                      {/* Disabled Delete / Request Delete */}
                      {config.status === 'disabled' && (
                        <button
                          onClick={() => setShowDeleteModal(config)}
                          className="px-3 py-1.5 text-xs font-medium rounded-xl border border-rose-500/20 text-rose-600 hover:bg-rose-500/10 transition-all flex items-center gap-1"
                          title={isAdmin ? 'Delete Disabled Connector' : 'Request Deletion of Disabled Connector'}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          {isAdmin ? 'Delete Disabled' : 'Request Deletion'}
                        </button>
                      )}

                      {/* Pending Deletion Actions */}
                      {config.status === 'pending_deletion' && (
                        <>
                          {isAdmin ? (
                            <>
                              <button
                                onClick={() => handleApproveDeletion(config)}
                                className="px-3.5 py-1.5 text-xs font-semibold rounded-xl bg-rose-600 text-white hover:bg-rose-500 transition-all flex items-center gap-1 shadow-sm"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                                Approve Deletion
                              </button>
                              <button
                                onClick={() => handleRejectDeletion(config)}
                                className="px-3.5 py-1.5 text-xs font-semibold rounded-xl border border-zinc-200 dark:border-white/10 hover:bg-zinc-100 dark:hover:bg-white/5 transition-all flex items-center gap-1 text-muted-foreground hover:text-foreground"
                              >
                                <X className="w-3.5 h-3.5" />
                                Reject Deletion
                              </button>
                            </>
                          ) : (
                            <button
                              onClick={() => handleCancelDeletionRequest(config)}
                              className="px-3 py-1.5 text-xs font-medium rounded-xl border border-zinc-200 dark:border-white/10 hover:bg-zinc-100 dark:hover:bg-white/5 transition-all text-muted-foreground hover:text-foreground flex items-center gap-1"
                            >
                              <X className="w-3.5 h-3.5" />
                              Cancel Request
                            </button>
                          )}
                        </>
                      )}

                      {/* Pending Approval Actions */}
                      {isAdmin && config.status === 'pending_approval' && (
                        <>
                          <button
                            onClick={() => handleApprove(config)}
                            className="px-3.5 py-1.5 text-xs font-semibold rounded-xl bg-emerald-600 text-white hover:bg-emerald-500 transition-all flex items-center gap-1 shadow-sm"
                          >
                            <Check className="w-3.5 h-3.5" />
                            Approve Live
                          </button>
                          <button
                            onClick={() => {
                              setShowRejectModal(config.id);
                              setRejectReason('');
                            }}
                            className="px-3.5 py-1.5 text-xs font-semibold rounded-xl bg-rose-600/10 text-rose-600 hover:bg-rose-600/20 border border-rose-600/20 transition-all flex items-center gap-1"
                          >
                            <X className="w-3.5 h-3.5" />
                            Reject
                          </button>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Expanded Detail Panel */}
                  {isExpanded && (
                    <div className="mt-4 pt-4 border-t border-zinc-200 dark:border-white/5 space-y-4 text-xs font-mono">
                      {config.auth_type === 'oauth2_client_credentials' && (
                        <div className="p-3.5 rounded-xl bg-primary/[0.03] border border-primary/20 space-y-2">
                          <div className="flex items-center gap-2 font-sans font-semibold text-primary">
                            <Sparkles className="w-4 h-4" />
                            <span>OAuth 2.0 Authentication Specs</span>
                            <span className="font-mono text-[10px] px-2 py-0.5 rounded-full bg-primary/10 border border-primary/20">
                              {config.oauth_grant_type || 'client_credentials'}
                            </span>
                          </div>
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 font-mono text-[11px] pt-1">
                            <div>
                              <span className="text-muted-foreground font-sans block text-[10px]">Token URL:</span>
                              <span className="text-foreground font-semibold break-all">{config.oauth_token_url || '—'}</span>
                            </div>
                            <div>
                              <span className="text-muted-foreground font-sans block text-[10px]">Client ID:</span>
                              <span className="text-foreground font-semibold break-all">{config.oauth_client_id || '—'}</span>
                            </div>
                            <div>
                              <span className="text-muted-foreground font-sans block text-[10px]">Header Prefix / Scope:</span>
                              <span className="text-foreground font-semibold">
                                {config.oauth_header_prefix || 'Bearer'} {config.oauth_scope ? `(${config.oauth_scope})` : ''}
                              </span>
                            </div>
                          </div>
                        </div>
                      )}

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="p-3.5 rounded-xl bg-zinc-100 dark:bg-black/40 border border-zinc-200 dark:border-white/5 space-y-2">
                          <div className="flex justify-between items-center text-muted-foreground font-sans font-semibold">
                            <span>Request Template</span>
                            <span className="text-[10px]">JSON Payload</span>
                          </div>
                          <pre className="overflow-x-auto text-[11px] text-foreground/80 max-h-48 scrollbar-thin">
                            {config.request_template || '(No template)'}
                          </pre>
                        </div>

                        <div className="p-3.5 rounded-xl bg-zinc-100 dark:bg-black/40 border border-zinc-200 dark:border-white/5 space-y-2">
                          <div className="flex justify-between items-center text-muted-foreground font-sans font-semibold">
                            <span>Response Mapping</span>
                            <span className="text-[10px]">JMESPath &amp; Regex</span>
                          </div>
                          <pre className="overflow-x-auto text-[11px] text-foreground/80 max-h-48 scrollbar-thin">
                            {config.response_mapping || '(No mapping)'}
                          </pre>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Editor Modal (Create / Edit) */}
      {showEditor && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-black/60 backdrop-blur-sm">
          <div className="bg-card w-full max-w-3xl max-h-[90vh] flex flex-col rounded-3xl border border-zinc-200 dark:border-white/10 shadow-2xl overflow-hidden my-auto animate-in fade-in zoom-in-95 duration-200">
            <div className="p-6 pb-4 border-b border-zinc-200 dark:border-white/10 flex justify-between items-center shrink-0">
              <div>
                <h3 className="text-xl font-bold">
                  {editingId ? 'Update Connector Configuration' : 'Create New Connector'}
                </h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {editingId
                    ? 'Submitting an update creates a pending version. Active live connections remain uninterrupted.'
                    : 'Configure a target CRM webhook endpoint with variable substitution.'}
                </p>
              </div>
              <button
                onClick={() => setShowEditor(false)}
                className="p-2 rounded-xl hover:bg-zinc-100 dark:hover:bg-white/5 text-muted-foreground"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={(e) => handleSubmitConnector(e, 'pending_approval')} className="flex flex-col flex-1 min-h-0 overflow-hidden">
              <div className="p-6 overflow-y-auto space-y-4 text-xs flex-1 scrollbar-thin">
                {/* Quick Presets Bar */}
                <div className="p-3 bg-zinc-50 dark:bg-white/[0.02] border border-zinc-200 dark:border-white/5 rounded-xl space-y-2">
                  <div className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                    ⚡ Quick Presets (Click to load template)
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setFormData({
                          ...formData,
                          trigger_type: 'ticket_create',
                          http_method: 'POST',
                          url: 'https://desk.zoho.com/api/v1/tickets',
                          auth_type: 'oauth2_client_credentials',
                          oauth_grant_type: 'refresh_token',
                          oauth_header_prefix: 'Zoho-oauthtoken',
                          oauth_token_url: 'https://accounts.zoho.com/oauth/v2/token',
                          oauth_scope: 'Desk.tickets.CREATE,Desk.tickets.READ',
                          headers_template: '{\n  "orgId": "YOUR_ZOHO_ORG_ID",\n  "Content-Type": "application/json"\n}',
                          request_template: '{\n  "subject": "{{subject}}",\n  "description": "{{body}}",\n  "departmentId": "YOUR_DEPARTMENT_ID",\n  "contact": {\n    "email": "{{from_email}}"\n  },\n  "priority": "{{priority}}"\n}',
                          response_mapping: '{\n  "fields": [\n    {\n      "field": "ticket_id",\n      "path": "id",\n      "extract_regex": null\n    }\n  ]\n}',
                        });
                      }}
                      className="px-2.5 py-1 rounded-lg bg-orange-500/10 hover:bg-orange-500/20 text-orange-600 dark:text-orange-400 border border-orange-500/30 text-xs font-medium cursor-pointer transition-colors"
                    >
                      Zoho Desk (Tickets)
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setFormData({
                          ...formData,
                          trigger_type: 'ticket_create',
                          http_method: 'POST',
                          url: 'https://YOUR_DOMAIN.freshdesk.com/api/v2/tickets',
                          auth_type: 'basic',
                          auth_secret: '{\n  "username": "YOUR_FRESHDESK_API_KEY",\n  "password": "X"\n}',
                          headers_template: '{\n  "Content-Type": "application/json"\n}',
                          request_template: '{\n  "subject": "{{subject}}",\n  "description": "{{body}}",\n  "email": "{{from_email}}",\n  "priority": 1,\n  "status": 2\n}',
                          response_mapping: '{\n  "fields": [\n    {\n      "field": "ticket_id",\n      "path": "id",\n      "extract_regex": null\n    }\n  ]\n}',
                        });
                      }}
                      className="px-2.5 py-1 rounded-lg bg-blue-500/10 hover:bg-blue-500/20 text-blue-600 dark:text-blue-400 border border-blue-500/30 text-xs font-medium cursor-pointer transition-colors"
                    >
                      Freshdesk (Tickets)
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setFormData({
                          ...formData,
                          trigger_type: 'order_status',
                          http_method: 'GET',
                          url: 'https://YOUR_STORE.myshopify.com/admin/api/2024-01/orders.json',
                          auth_type: 'api_key_header',
                          auth_field_name: 'X-Shopify-Access-Token',
                          headers_template: '{\n  "Content-Type": "application/json"\n}',
                          request_template: '{\n  "name": "{{docket_no}}"\n}',
                          response_mapping: '{\n  "fields": [\n    {\n      "field": "docket_no",\n      "path": "orders[0].name",\n      "extract_regex": null\n    },\n    {\n      "field": "ticket_status",\n      "path": "orders[0].fulfillment_status || orders[0].financial_status",\n      "extract_regex": null\n    }\n  ]\n}',
                        });
                      }}
                      className="px-2.5 py-1 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 text-xs font-medium cursor-pointer transition-colors"
                    >
                      Shopify (Order Lookup)
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {isAdmin && (
                    <div>
                      <label className="font-semibold block mb-1">Target Client ID</label>
                      <select
                        value={formData.client_id}
                        onChange={(e) => setFormData({ ...formData, client_id: e.target.value })}
                        required
                        className="w-full p-2.5 rounded-xl border border-zinc-200 dark:border-white/10 bg-transparent focus:ring-2 focus:ring-primary/20 outline-none"
                      >
                        <option value="" disabled className="dark:bg-zinc-900">Select client...</option>
                        {clients.map((c) => (
                          <option key={c.client_id} value={c.client_id} className="dark:bg-zinc-900">
                            {c.client_id} ({c.company_name || 'Client'})
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  <div>
                    <label className="font-semibold block mb-1">Trigger Type</label>
                    <select
                      value={formData.trigger_type}
                      onChange={(e) => setFormData({ ...formData, trigger_type: e.target.value })}
                      className="w-full p-2.5 rounded-xl border border-zinc-200 dark:border-white/10 bg-transparent focus:ring-2 focus:ring-primary/20 outline-none"
                    >
                      <option value="ticket_create" className="dark:bg-zinc-900">ticket_create (Ticket Generation)</option>
                      <option value="ticket_status" className="dark:bg-zinc-900">ticket_status (Ticket Status Tracking)</option>
                      <option value="order_status" className="dark:bg-zinc-900">order_status (Order Status Tracking)</option>
                      <option value="custom" className="dark:bg-zinc-900">Custom Trigger...</option>
                    </select>
                  </div>
                </div>

                {formData.trigger_type === 'custom' && (
                  <div>
                    <label className="font-semibold block mb-1">Custom Trigger Name</label>
                    <input
                      type="text"
                      value={formData.custom_trigger}
                      onChange={(e) => setFormData({ ...formData, custom_trigger: e.target.value })}
                      placeholder="e.g. refund_request, customer_lookup"
                      required
                      className="w-full p-2.5 rounded-xl border border-zinc-200 dark:border-white/10 bg-transparent focus:ring-2 focus:ring-primary/20 outline-none"
                    />
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                  <div className="sm:col-span-1">
                    <label className="font-semibold block mb-1">HTTP Method</label>
                    <select
                      value={formData.http_method}
                      onChange={(e) => setFormData({ ...formData, http_method: e.target.value })}
                      className="w-full p-2.5 rounded-xl border border-zinc-200 dark:border-white/10 bg-transparent focus:ring-2 focus:ring-primary/20 outline-none font-mono"
                    >
                      <option value="POST">POST</option>
                      <option value="GET">GET</option>
                      <option value="PUT">PUT</option>
                      <option value="PATCH">PATCH</option>
                    </select>
                  </div>

                  <div className="sm:col-span-3">
                    <label className="font-semibold block mb-1">Target Endpoint URL</label>
                    <input
                      type="url"
                      value={formData.url}
                      onChange={(e) => setFormData({ ...formData, url: e.target.value })}
                      placeholder="https://api.crm.com/v1/tickets or http://localhost:9000/create-ticket"
                      required
                      className="w-full p-2.5 rounded-xl border border-zinc-200 dark:border-white/10 bg-transparent focus:ring-2 focus:ring-primary/20 outline-none font-mono"
                    />
                  </div>
                </div>

                {/* Auth Configuration */}
                <div className="p-4 rounded-2xl bg-zinc-50 dark:bg-white/[0.02] border border-zinc-200 dark:border-white/10 space-y-4">
                  <div className="font-semibold flex items-center justify-between text-foreground">
                    <div className="flex items-center gap-1.5">
                      <Lock className="w-4 h-4 text-primary" />
                      Authentication & Payload Encoding
                    </div>
                    {formData.auth_type === 'oauth2_client_credentials' && (
                      <span className="text-[11px] px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20 font-mono">
                        OAuth 2.0 Handshake Enabled
                      </span>
                    )}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="text-[11px] text-muted-foreground block mb-1">Auth Type</label>
                      <select
                        value={formData.auth_type}
                        onChange={(e: any) => {
                          setFormData({ ...formData, auth_type: e.target.value });
                          setOauthTestResult(null);
                        }}
                        className="w-full p-2 rounded-xl border border-zinc-200 dark:border-white/10 bg-transparent outline-none"
                      >
                        <option value="bearer" className="dark:bg-zinc-900">Bearer Token</option>
                        <option value="oauth2_client_credentials" className="dark:bg-zinc-900">OAuth 2.0 (Client Credentials)</option>
                        <option value="basic" className="dark:bg-zinc-900">Basic Auth (user:pass)</option>
                        <option value="api_key_header" className="dark:bg-zinc-900">API Key in Header</option>
                        <option value="api_key_query" className="dark:bg-zinc-900">API Key in Query Param</option>
                      </select>
                    </div>

                    {formData.auth_type !== 'oauth2_client_credentials' && (
                      <div>
                        <label className="text-[11px] text-muted-foreground block mb-1">
                          {formData.auth_type === 'api_key_header' || formData.auth_type === 'api_key_query'
                            ? 'Key Param Name (e.g. X-API-Key / key)'
                            : 'Auth Secret / Token (Encrypted)'}
                        </label>
                        <input
                          type="password"
                          value={formData.auth_secret}
                          onChange={(e) => setFormData({ ...formData, auth_secret: e.target.value })}
                          placeholder={editingId ? 'Leave blank to keep unchanged' : 'Secret / Token'}
                          className="w-full p-2 rounded-xl border border-zinc-200 dark:border-white/10 bg-transparent outline-none"
                        />
                      </div>
                    )}

                    <div>
                      <label className="text-[11px] text-muted-foreground block mb-1">Payload Encoding</label>
                      <select
                        value={formData.payload_encoding}
                        onChange={(e: any) => setFormData({ ...formData, payload_encoding: e.target.value })}
                        className="w-full p-2 rounded-xl border border-zinc-200 dark:border-white/10 bg-transparent outline-none"
                      >
                        <option value="plain" className="dark:bg-zinc-900">Plain JSON Body</option>
                        <option value="base64_query" className="dark:bg-zinc-900">Base64 in Query Param</option>
                      </select>
                    </div>
                  </div>

                  {/* Dedicated OAuth 2.0 Configuration Box */}
                  {formData.auth_type === 'oauth2_client_credentials' && (
                    <div className="p-3.5 rounded-xl border border-primary/20 bg-primary/[0.03] space-y-3">
                      <div className="text-xs font-semibold text-primary flex items-center justify-between">
                        <div className="flex items-center gap-1.5">
                          <Sparkles className="w-3.5 h-3.5" />
                          OAuth 2.0 (Client Credentials & Refresh Token / Zoho)
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <label className="text-[11px] text-muted-foreground block mb-1">Grant Type</label>
                          <select
                            value={formData.oauth_grant_type}
                            onChange={(e: any) => setFormData({ ...formData, oauth_grant_type: e.target.value })}
                            className="w-full p-2 rounded-lg border border-zinc-200 dark:border-white/10 bg-transparent outline-none text-xs"
                          >
                            <option value="client_credentials" className="dark:bg-zinc-900">client_credentials (Standard)</option>
                            <option value="refresh_token" className="dark:bg-zinc-900">refresh_token (Zoho Desk / Zoho CRM)</option>
                          </select>
                        </div>

                        <div>
                          <label className="text-[11px] text-muted-foreground block mb-1">Auth Header Prefix</label>
                          <input
                            type="text"
                            value={formData.oauth_header_prefix}
                            onChange={(e) => setFormData({ ...formData, oauth_header_prefix: e.target.value })}
                            placeholder="Bearer or Zoho-oauthtoken"
                            className="w-full p-2 rounded-lg border border-zinc-200 dark:border-white/10 bg-transparent outline-none text-xs font-mono"
                          />
                        </div>

                        <div>
                          <label className="text-[11px] text-muted-foreground block mb-1">Token Endpoint URL *</label>
                          <input
                            type="url"
                            value={formData.oauth_token_url}
                            onChange={(e) => setFormData({ ...formData, oauth_token_url: e.target.value })}
                            placeholder="https://accounts.zoho.com/oauth/v2/token"
                            className="w-full p-2 rounded-lg border border-zinc-200 dark:border-white/10 bg-transparent outline-none text-xs font-mono"
                          />
                        </div>

                        <div>
                          <label className="text-[11px] text-muted-foreground block mb-1">OAuth Client ID *</label>
                          <input
                            type="text"
                            value={formData.oauth_client_id}
                            onChange={(e) => setFormData({ ...formData, oauth_client_id: e.target.value })}
                            placeholder="client_xxxxxxxxxxxx"
                            className="w-full p-2 rounded-lg border border-zinc-200 dark:border-white/10 bg-transparent outline-none text-xs font-mono"
                          />
                        </div>

                        <div>
                          <label className="text-[11px] text-muted-foreground block mb-1">OAuth Client Secret *</label>
                          <input
                            type="password"
                            value={formData.oauth_client_secret}
                            onChange={(e) => setFormData({ ...formData, oauth_client_secret: e.target.value })}
                            placeholder="secret_xxxxxxxxxxxx"
                            className="w-full p-2 rounded-lg border border-zinc-200 dark:border-white/10 bg-transparent outline-none text-xs"
                          />
                        </div>

                        {formData.oauth_grant_type === 'refresh_token' && (
                          <div>
                            <label className="text-[11px] text-muted-foreground block mb-1">Refresh Token * (Zoho Permanent Token)</label>
                            <input
                              type="password"
                              value={formData.oauth_refresh_token}
                              onChange={(e) => setFormData({ ...formData, oauth_refresh_token: e.target.value })}
                              placeholder="1000.xxxx.xxxx"
                              className="w-full p-2 rounded-lg border border-zinc-200 dark:border-white/10 bg-transparent outline-none text-xs font-mono"
                            />
                          </div>
                        )}

                        <div>
                          <label className="text-[11px] text-muted-foreground block mb-1">Scope(s) (Optional)</label>
                          <input
                            type="text"
                            value={formData.oauth_scope}
                            onChange={(e) => setFormData({ ...formData, oauth_scope: e.target.value })}
                            placeholder="e.g. Desk.tickets.CREATE,Desk.tickets.READ"
                            className="w-full p-2 rounded-lg border border-zinc-200 dark:border-white/10 bg-transparent outline-none text-xs font-mono"
                          />
                        </div>

                        <div>
                          <label className="text-[11px] text-muted-foreground block mb-1">Token Request Auth Method</label>
                          <select
                            value={formData.oauth_token_auth_method}
                            onChange={(e: any) => setFormData({ ...formData, oauth_token_auth_method: e.target.value })}
                            className="w-full p-2 rounded-lg border border-zinc-200 dark:border-white/10 bg-transparent outline-none text-xs"
                          >
                            <option value="client_secret_post" className="dark:bg-zinc-900">client_secret_post (POST Body)</option>
                            <option value="client_secret_basic" className="dark:bg-zinc-900">client_secret_basic (Basic Header)</option>
                          </select>
                        </div>

                        <div className="flex items-end">
                          <button
                            type="button"
                            onClick={handleTestOAuth}
                            disabled={oauthTesting}
                            className="w-full py-2 px-3 rounded-lg bg-primary/10 hover:bg-primary/20 text-primary border border-primary/30 text-xs font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                          >
                            {oauthTesting ? (
                              <>
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                Verifying Token...
                              </>
                            ) : (
                              <>
                                <RefreshCw className="w-3.5 h-3.5" />
                                Test Token Handshake
                              </>
                            )}
                          </button>
                        </div>
                      </div>

                      {oauthTestResult && (
                        <div
                          className={`p-2.5 rounded-lg text-xs border flex items-start gap-2 ${
                            oauthTestResult.success
                              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-600 dark:text-emerald-400'
                              : 'bg-rose-500/10 border-rose-500/30 text-rose-600 dark:text-rose-400'
                          }`}
                        >
                          {oauthTestResult.success ? (
                            <CheckCircle className="w-4 h-4 shrink-0 mt-0.5 text-emerald-500" />
                          ) : (
                            <XCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-500" />
                          )}
                          <div className="space-y-0.5 flex-1">
                            <div className="font-semibold">
                              {oauthTestResult.success ? 'Handshake Successful' : 'Handshake Failed'}
                              {oauthTestResult.duration_ms !== undefined && (
                                <span className="font-normal opacity-75 ml-1.5">({oauthTestResult.duration_ms}ms)</span>
                              )}
                            </div>
                            <div className="text-[11px] leading-relaxed">
                              {oauthTestResult.success
                                ? `Token received successfully! Expires in ${oauthTestResult.expires_in || 3600}s. Tokens will be cached in Redis.`
                                : oauthTestResult.error}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {formData.payload_encoding === 'base64_query' && (
                    <div>
                      <label className="text-[11px] text-muted-foreground block mb-1">Base64 Query Param Name</label>
                      <input
                        type="text"
                        value={formData.base64_query_param_name}
                        onChange={(e) => setFormData({ ...formData, base64_query_param_name: e.target.value })}
                        placeholder="e.g. data or postData"
                        className="w-full p-2 rounded-xl border border-zinc-200 dark:border-white/10 bg-transparent outline-none font-mono"
                      />
                    </div>
                  )}
                </div>

                {/* Variable Chips */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="font-semibold">Context Placeholder Tokens</label>
                    <span className="text-[11px] text-muted-foreground">Click to append to template</span>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {CONTEXT_VARS.map((v) => (
                      <button
                        key={v}
                        type="button"
                        onClick={() => insertVariable(v, 'request_template')}
                        className="px-2 py-1 rounded-lg bg-zinc-100 dark:bg-white/5 hover:bg-primary/10 hover:text-primary transition-all font-mono text-[11px] border border-zinc-200 dark:border-white/10"
                      >
                        {v}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Headers Template */}
                <div>
                  <label className="font-semibold block mb-1">
                    Headers Template (JSON)
                    <span className="font-normal text-muted-foreground ml-2">
                      (e.g. {`{"orgId": "60001234567", "Content-Type": "application/json"}`})
                    </span>
                  </label>
                  <textarea
                    value={formData.headers_template}
                    onChange={(e) => setFormData({ ...formData, headers_template: e.target.value })}
                    rows={3}
                    placeholder={`{\n  "orgId": "YOUR_ZOHO_ORG_ID",\n  "Content-Type": "application/json"\n}`}
                    className="w-full p-3 rounded-2xl border border-zinc-200 dark:border-white/10 bg-zinc-50 dark:bg-black/30 font-mono text-xs outline-none focus:ring-2 focus:ring-primary/20"
                  />
                </div>

                {/* Request Template */}
                <div>
                  <label className="font-semibold block mb-1">Request Template (JSON)</label>
                  <textarea
                    value={formData.request_template}
                    onChange={(e) => setFormData({ ...formData, request_template: e.target.value })}
                    rows={5}
                    required
                    className="w-full p-3 rounded-2xl border border-zinc-200 dark:border-white/10 bg-zinc-50 dark:bg-black/30 font-mono text-xs outline-none focus:ring-2 focus:ring-primary/20"
                  />
                </div>

                {/* Response Mapping */}
                <div>
                  <label className="font-semibold block mb-1">
                    Response Mapping (JSON)
                    <span className="font-normal text-muted-foreground ml-2">
                      {formData.trigger_type === 'ticket_create' && '(Requires "ticket_id" mapping)'}
                      {formData.trigger_type === 'order_status' && '(Requires "docket_no" & "ticket_status" mappings)'}
                    </span>
                  </label>
                  <textarea
                    value={formData.response_mapping}
                    onChange={(e) => setFormData({ ...formData, response_mapping: e.target.value })}
                    rows={5}
                    required
                    className="w-full p-3 rounded-2xl border border-zinc-200 dark:border-white/10 bg-zinc-50 dark:bg-black/30 font-mono text-xs outline-none focus:ring-2 focus:ring-primary/20"
                  />
                </div>
              </div>

              {/* Sticky Footer */}
              <div className="p-4 sm:px-6 border-t border-zinc-200 dark:border-white/10 flex justify-end items-center gap-3 bg-card shrink-0">
                <button
                  type="button"
                  onClick={() => setShowEditor(false)}
                  className="px-4 py-2.5 rounded-xl border border-zinc-200 dark:border-white/10 hover:bg-zinc-100 dark:hover:bg-white/5 font-semibold transition-all text-xs cursor-pointer"
                >
                  Cancel
                </button>

                <button
                  type="button"
                  disabled={submitting}
                  onClick={(e) => handleSubmitConnector(e, 'draft')}
                  className="px-4 py-2.5 rounded-xl border border-zinc-200 dark:border-white/10 hover:bg-zinc-100 dark:hover:bg-white/5 font-semibold transition-all text-xs cursor-pointer"
                >
                  Save as Draft
                </button>

                <button
                  type="submit"
                  disabled={submitting}
                  className="px-6 py-2.5 rounded-xl bg-primary text-primary-foreground font-semibold hover:bg-primary/90 transition-all flex items-center gap-2 shadow-sm text-xs cursor-pointer"
                >
                  {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
                  {editingId ? 'Submit Version for Approval' : 'Submit for Approval'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* AI Template Preview Modal */}
      {showAiModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-black/60 backdrop-blur-sm">
          <div className="bg-card w-full max-w-2xl max-h-[90vh] flex flex-col rounded-3xl border border-zinc-200 dark:border-white/10 shadow-2xl overflow-hidden my-auto animate-in fade-in zoom-in-95 duration-200">
            <div className="p-6 pb-4 border-b border-zinc-200 dark:border-white/10 flex justify-between items-center shrink-0">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400">
                  <Sparkles className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-xl font-bold">AI Connector Template Generator</h3>
                  <p className="text-xs text-muted-foreground">
                    Describe your CRM schema and let the LLM generate the JSON mappings.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowAiModal(false)}
                className="p-2 rounded-xl hover:bg-zinc-100 dark:hover:bg-white/5 text-muted-foreground"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-4 flex-1 scrollbar-thin">
              <form onSubmit={handleGenerateAiPreview} className="space-y-4 text-xs">
                <div>
                  <label className="font-semibold block mb-1">Trigger Type</label>
                  <select
                    value={aiForm.trigger_type}
                    onChange={(e) => setAiForm({ ...aiForm, trigger_type: e.target.value })}
                    className="w-full p-2.5 rounded-xl border border-zinc-200 dark:border-white/10 bg-transparent outline-none"
                  >
                    <option value="ticket_create" className="dark:bg-zinc-900">ticket_create (Ticket Generation)</option>
                    <option value="order_status" className="dark:bg-zinc-900">order_status (Status Lookup)</option>
                  </select>
                </div>

                <div>
                  <label className="font-semibold block mb-1">Target CRM / API Description</label>
                  <textarea
                    value={aiForm.crm_schema_description}
                    onChange={(e) => setAiForm({ ...aiForm, crm_schema_description: e.target.value })}
                    rows={3}
                    required
                    placeholder="e.g. A ticketing REST API that takes JSON with 'subject', 'body', 'user_email', and 'severity'. Returns a JSON object with 'Refrence_No' for the created ticket id."
                    className="w-full p-3 rounded-2xl border border-zinc-200 dark:border-white/10 bg-zinc-50 dark:bg-black/30 outline-none"
                  />
                </div>

                <div>
                  <label className="font-semibold block mb-1">Sample CRM Response (Optional)</label>
                  <textarea
                    value={aiForm.sample_response}
                    onChange={(e) => setAiForm({ ...aiForm, sample_response: e.target.value })}
                    rows={3}
                    placeholder='e.g. {"status": "success", "ticket": {"id": "T-12345", "status": "Open"}}'
                    className="w-full p-3 rounded-2xl border border-zinc-200 dark:border-white/10 bg-zinc-50 dark:bg-black/30 font-mono text-[11px] outline-none"
                  />
                </div>

                <div className="flex justify-end">
                  <button
                    type="submit"
                    disabled={aiGenerating}
                    className="px-5 py-2.5 rounded-xl bg-purple-600 text-white font-semibold hover:bg-purple-500 transition-all flex items-center gap-2"
                  >
                    {aiGenerating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                    Generate Template Preview
                  </button>
                </div>
              </form>

              {aiResult && (
                <div className="mt-4 pt-4 border-t border-zinc-200 dark:border-white/10 space-y-4">
                  {aiResult.error ? (
                    <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-600 text-xs">
                      {aiResult.error}
                    </div>
                  ) : (
                    <>
                      <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 text-xs">
                        ✨ Template preview drafted successfully! Review below and apply to connector form.
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 font-mono text-[11px]">
                        <div className="p-3 rounded-xl bg-zinc-100 dark:bg-black/40 border border-zinc-200 dark:border-white/5">
                          <div className="font-sans font-semibold mb-1 text-muted-foreground">Draft Request Template</div>
                          <pre className="overflow-x-auto max-h-36 scrollbar-thin">
                            {JSON.stringify(aiResult.request_template, null, 2)}
                          </pre>
                        </div>

                        <div className="p-3 rounded-xl bg-zinc-100 dark:bg-black/40 border border-zinc-200 dark:border-white/5">
                          <div className="font-sans font-semibold mb-1 text-muted-foreground">Draft Response Mapping</div>
                          <pre className="overflow-x-auto max-h-36 scrollbar-thin">
                            {JSON.stringify(aiResult.response_mapping, null, 2)}
                          </pre>
                        </div>
                      </div>

                      <div className="flex justify-end gap-2">
                        <button
                          onClick={handleApplyAiResult}
                          className="px-5 py-2.5 rounded-xl bg-primary text-primary-foreground font-semibold hover:bg-primary/90 transition-all"
                        >
                          Use in Connector Form
                        </button>
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Admin Reject Modal */}
      {showRejectModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-card w-full max-w-md rounded-3xl border border-zinc-200 dark:border-white/10 shadow-2xl p-6 space-y-4">
            <h3 className="text-lg font-bold text-rose-600 flex items-center gap-2">
              <XCircle className="w-5 h-5" />
              Reject Connector Configuration
            </h3>
            <p className="text-xs text-muted-foreground">
              Provide a reason for rejection so the client can fix and resubmit.
            </p>

            <textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              rows={3}
              placeholder="e.g. URL is not accessible, missing required response fields, etc."
              className="w-full p-3 rounded-2xl border border-zinc-200 dark:border-white/10 bg-zinc-50 dark:bg-black/30 text-xs outline-none"
            />

            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setShowRejectModal(null)}
                className="px-4 py-2 rounded-xl border border-zinc-200 dark:border-white/10 text-xs font-semibold"
              >
                Cancel
              </button>
              <button
                onClick={handleReject}
                className="px-4 py-2 rounded-xl bg-rose-600 text-white text-xs font-semibold hover:bg-rose-500"
              >
                Confirm Rejection
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Draft / Disabled Confirmation Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-card w-full max-w-md rounded-3xl border border-zinc-200 dark:border-white/10 shadow-2xl p-6 space-y-4">
            <h3 className="text-lg font-bold text-rose-600 flex items-center gap-2">
              <Trash2 className="w-5 h-5" />
              {showDeleteModal.status === 'draft'
                ? 'Delete Draft Connector'
                : showDeleteModal.status === 'pending_approval'
                ? 'Delete Pending Approval Connector'
                : isAdmin
                ? 'Delete Disabled Connector'
                : 'Request Connector Deletion'}
            </h3>
            <p className="text-xs text-muted-foreground leading-relaxed">
              {showDeleteModal.status === 'draft' ? (
                <>
                  Are you sure you want to permanently delete draft connector{' '}
                  <span className="font-semibold text-foreground font-mono">#{showDeleteModal.id}</span> ({showDeleteModal.trigger_type})? This action cannot be undone.
                </>
              ) : showDeleteModal.status === 'pending_approval' ? (
                <>
                  Are you sure you want to permanently delete pending approval connector{' '}
                  <span className="font-semibold text-foreground font-mono">#{showDeleteModal.id}</span> ({showDeleteModal.trigger_type})? This will discard the submitted version and free up the pending slot. This action cannot be undone.
                </>
              ) : showDeleteModal.status === 'live' ? (
                isAdmin ? (
                  <>
                    Are you sure you want to permanently delete live connector{' '}
                    <span className="font-semibold text-foreground font-mono">#{showDeleteModal.id}</span> ({showDeleteModal.trigger_type})? As administrator, this will remove it permanently and immediately stop live webhook execution.
                  </>
                ) : (
                  <>
                    Requesting takedown and deletion of live connector{' '}
                    <span className="font-semibold text-foreground font-mono">#{showDeleteModal.id}</span> ({showDeleteModal.trigger_type}){' '}
                    <strong className="text-foreground">requires administrator approval</strong>. Submitting this will request the administrator to take down and permanently delete this live connector.
                  </>
                )
              ) : isAdmin ? (
                <>
                  Are you sure you want to permanently delete disabled connector{' '}
                  <span className="font-semibold text-foreground font-mono">#{showDeleteModal.id}</span> ({showDeleteModal.trigger_type})? As administrator, this will remove it permanently from the database.
                </>
              ) : (
                <>
                  Deleting disabled connector{' '}
                  <span className="font-semibold text-foreground font-mono">#{showDeleteModal.id}</span> ({showDeleteModal.trigger_type}){' '}
                  <strong className="text-foreground">requires administrator approval</strong>. Submitting this will send a deletion request to the administrator.
                </>
              )}
            </p>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowDeleteModal(null)}
                disabled={deletingDraftId !== null}
                className="px-4 py-2 rounded-xl border border-zinc-200 dark:border-white/10 text-xs font-semibold hover:bg-zinc-100 dark:hover:bg-white/5 transition-all cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteConfirm}
                disabled={deletingDraftId !== null}
                className="px-4 py-2 rounded-xl bg-rose-600 text-white text-xs font-semibold hover:bg-rose-500 transition-all flex items-center gap-1.5 shadow-sm cursor-pointer"
              >
                {deletingDraftId !== null && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                {showDeleteModal.status === 'draft' || showDeleteModal.status === 'pending_approval'
                  ? 'Confirm Delete'
                  : showDeleteModal.status === 'live'
                  ? isAdmin
                    ? 'Permanently Delete Live'
                    : 'Submit Takedown & Delete'
                  : isAdmin
                  ? 'Permanently Delete'
                  : 'Submit Deletion Request'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Admin Allowlist Modal */}
      {showAllowlistModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-card w-full max-w-2xl rounded-3xl border border-zinc-200 dark:border-white/10 shadow-2xl p-6 sm:p-8 space-y-6 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center border-b border-zinc-200 dark:border-white/10 pb-4">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-600">
                  <Globe className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-xl font-bold">Target URL Allowlist</h3>
                  <p className="text-xs text-muted-foreground">
                    Connectors must point to an allowlisted hostname/path before being approved.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowAllowlistModal(false)}
                className="p-2 rounded-xl hover:bg-zinc-100 dark:hover:bg-white/5 text-muted-foreground"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAddAllowlist} className="flex gap-2">
              <input
                type="url"
                value={newAllowlistUrl}
                onChange={(e) => setNewAllowlistUrl(e.target.value)}
                placeholder="https://api.crm.com or http://localhost:9000/create-ticket"
                required
                className="flex-1 p-2.5 rounded-xl border border-zinc-200 dark:border-white/10 bg-transparent text-xs font-mono outline-none"
              />
              <button
                type="submit"
                className="px-4 py-2.5 rounded-xl bg-emerald-600 text-white font-semibold text-xs hover:bg-emerald-500 flex items-center gap-1.5"
              >
                <Plus className="w-4 h-4" />
                Add URL
              </button>
            </form>

            <div className="rounded-2xl border border-zinc-200 dark:border-white/10 overflow-hidden">
              <div className="p-3 bg-zinc-50 dark:bg-white/[0.02] border-b border-zinc-200 dark:border-white/10 font-semibold text-xs">
                Allowlisted Endpoints ({allowlist.length})
              </div>
              {allowlistLoading ? (
                <div className="p-8 text-center text-muted-foreground text-xs">Loading allowlist...</div>
              ) : allowlist.length === 0 ? (
                <div className="p-8 text-center text-muted-foreground text-xs">No URLs on allowlist yet.</div>
              ) : (
                <div className="divide-y divide-zinc-200 dark:divide-white/5 text-xs font-mono">
                  {allowlist.map((item) => (
                    <div key={item.id} className="p-3 flex justify-between items-center">
                      <div className="truncate">
                        <span className="text-emerald-500 font-bold">{item.scheme}://</span>
                        <span className="text-foreground">{item.netloc}</span>
                        <span className="text-muted-foreground">{item.path}</span>
                      </div>
                      <span className="text-[10px] text-muted-foreground font-sans">
                        Added: {new Date(item.created_at).toLocaleDateString()}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
