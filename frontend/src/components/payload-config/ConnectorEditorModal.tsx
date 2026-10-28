import React, { useState, useMemo } from 'react';
import {
  Sparkles,
  Lock,
  RefreshCw,
  Loader2,
  CheckCircle,
  XCircle,
  Shield,
  AlertTriangle,
} from 'lucide-react';
import { BaseModal } from '@/components/common';
import { ConnectorFormData, OAuthTestResult, CONTEXT_VARS } from './types';
import { CONNECTOR_PRESETS, ConnectorPreset, detectUnfilledPlaceholders } from './connectorPresets';

interface ConnectorEditorModalProps {
  isOpen: boolean;
  onClose: () => void;
  editingId: number | null;
  formData: ConnectorFormData;
  setFormData: React.Dispatch<React.SetStateAction<ConnectorFormData>>;
  submitting: boolean;
  onSubmit: (e: React.FormEvent, targetStatus: 'draft' | 'pending_approval') => void;
  oauthTesting: boolean;
  oauthTestResult: OAuthTestResult | null;
  onTestOAuth: () => void;
  isAdmin: boolean;
  clients: any[];
}

export const ConnectorEditorModal: React.FC<ConnectorEditorModalProps> = ({
  isOpen,
  onClose,
  editingId,
  formData,
  setFormData,
  submitting,
  onSubmit,
  oauthTesting,
  oauthTestResult,
  onTestOAuth,
  isAdmin,
  clients,
}) => {
  const [presetCategory, setPresetCategory] = useState<'all' | 'CRM' | 'E-Commerce'>('all');

  const unfilledPlaceholders = useMemo(() => {
    return detectUnfilledPlaceholders(formData);
  }, [
    formData.url,
    formData.headers_template,
    formData.request_template,
    formData.auth_secret,
    formData.oauth_client_id,
    formData.oauth_client_secret,
  ]);

  if (!isOpen) return null;

  const insertVariable = (varName: string, field: 'request_template' | 'headers_template') => {
    setFormData((prev) => ({
      ...prev,
      [field]: prev[field] + `\n"${varName.replace(/[{}]/g, '')}": "${varName}",`,
    }));
  };

  const currentDescStyle: 'hybrid' | 'transcript' | 'summary' | null = (() => {
    if (formData.trigger_type !== 'ticket_create') return null;
    const t = formData.request_template || '';
    if (t.includes('{{history_summary}}') && t.includes('{{conversation_history}}')) {
      return 'hybrid';
    }
    if (t.includes('{{history_summary}}') && !t.includes('{{conversation_history}}')) {
      return 'summary';
    }
    if (t.includes('{{conversation_history}}')) {
      return 'transcript';
    }
    return null;
  })();

  const applyDescriptionFormat = (style: 'hybrid' | 'transcript' | 'summary') => {
    const isZoho =
      Boolean(formData.url?.toLowerCase().includes('desk.zoho')) ||
      Boolean(formData.headers_template?.includes('orgId')) ||
      Boolean(formData.request_template && formData.request_template.includes('white-space: pre-wrap'));

    const rawHybrid =
      '=== EXECUTIVE SUMMARY ===\\n\\n{{history_summary}}\\n\\n===================================\\nTHREAD CONVERSATION LOG\\n===================================\\n\\n{{conversation_history}}';
    const rawTranscript = '{{conversation_history}}';
    const rawSummary = '{{history_summary}}';

    const rawValue =
      style === 'hybrid'
        ? rawHybrid
        : style === 'summary'
        ? rawSummary
        : rawTranscript;

    const targetValue = isZoho
      ? `<div style="white-space: pre-wrap; font-family: inherit;">${rawValue}</div>`
      : rawValue;

    try {
      const parsed = JSON.parse(formData.request_template || '{}');
      if (parsed.comment && typeof parsed.comment === 'object' && 'body' in parsed.comment) {
        // Zendesk schema
        parsed.comment.body = targetValue;
      } else {
        // Standard schema (Zoho Desk, Freshdesk, generic CRM)
        parsed.description = targetValue;
      }
      setFormData((prev) => ({
        ...prev,
        request_template: JSON.stringify(parsed, null, 2),
      }));
    } catch {
      // Fallback clean template if existing JSON is empty or malformed
      const fallback = {
        subject: '{{subject}}',
        description: targetValue,
        departmentId: 'YOUR_DEPARTMENT_ID',
        priority: '{{priority}}',
        contact: {
          email: '{{from_email}}',
          firstName: '{{first_name}}',
          lastName: '{{last_name}}',
        },
      };
      setFormData((prev) => ({
        ...prev,
        request_template: JSON.stringify(fallback, null, 2),
      }));
    }
  };

  const handleApplyPreset = (preset: ConnectorPreset) => {
    setFormData((prev) => ({
      ...prev,
      ...preset.config,
      client_id: prev.client_id,
      id_pattern_regex: preset.config.id_pattern_regex || '',
      owner_email_path: preset.config.owner_email_path || '',
    }));
  };

  const filteredPresets = CONNECTOR_PRESETS.filter((p) => {
    if (presetCategory === 'all') return true;
    return p.category === presetCategory;
  });

  return (
    <BaseModal
      isOpen={isOpen}
      onClose={onClose}
      closeOnBackdropClick={!submitting}
      closeOnEscape={!submitting}
      maxWidth="max-w-3xl"
      title={editingId ? 'Update Connector Configuration' : 'Create New Connector'}
      subtitle={
        editingId
          ? 'Submitting an update creates a pending version. Active live connections remain uninterrupted.'
          : 'Configure a target CRM webhook endpoint with variable substitution.'
      }
      bodyClassName="flex flex-col min-h-0 p-0"
    >
      <form onSubmit={(e) => onSubmit(e, 'pending_approval')} className="flex flex-col flex-1 min-h-0 overflow-hidden">
          <div className="p-6 overflow-y-auto space-y-4 text-xs flex-1 scrollbar-thin">
            {/* Standard Presets Bar */}
            <div className="p-3.5 bg-zinc-50 dark:bg-white/[0.02] border border-zinc-200 dark:border-white/5 rounded-2xl space-y-3">
              <div className="flex items-center justify-between">
                <div className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-primary" />
                  Standard Connector Presets
                </div>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setPresetCategory('all')}
                    className={`px-2 py-0.5 rounded-md text-[10px] font-medium transition-colors ${
                      presetCategory === 'all'
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-zinc-200/50 dark:bg-white/5 text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    All ({CONNECTOR_PRESETS.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setPresetCategory('CRM')}
                    className={`px-2 py-0.5 rounded-md text-[10px] font-medium transition-colors ${
                      presetCategory === 'CRM'
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-zinc-200/50 dark:bg-white/5 text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    CRM & Tickets ({CONNECTOR_PRESETS.filter((p) => p.category === 'CRM').length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setPresetCategory('E-Commerce')}
                    className={`px-2 py-0.5 rounded-md text-[10px] font-medium transition-colors ${
                      presetCategory === 'E-Commerce'
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-zinc-200/50 dark:bg-white/5 text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    E-Commerce ({CONNECTOR_PRESETS.filter((p) => p.category === 'E-Commerce').length})
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                {filteredPresets.map((preset) => (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => handleApplyPreset(preset)}
                    className="p-2.5 rounded-xl text-left border border-zinc-200/80 dark:border-white/10 hover:border-primary/50 bg-white/70 dark:bg-white/[0.03] hover:bg-primary/[0.04] transition-all group cursor-pointer"
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-semibold text-foreground text-xs group-hover:text-primary transition-colors">
                        {preset.title}
                      </span>
                      <span className="text-[9px] font-mono px-1.5 py-0.2 rounded uppercase bg-zinc-100 dark:bg-white/10 text-muted-foreground">
                        {preset.config.http_method}
                      </span>
                    </div>
                    <p className="text-[10px] text-muted-foreground line-clamp-2 leading-snug">
                      {preset.description}
                    </p>
                  </button>
                ))}
              </div>
            </div>

            {/* Unfilled Placeholders Warning Banner */}
            {unfilledPlaceholders.length > 0 && (
              <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-800 dark:text-amber-300 space-y-1.5">
                <div className="flex items-center gap-1.5 font-semibold text-xs text-amber-700 dark:text-amber-400">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>Unconfigured Template Placeholders ({unfilledPlaceholders.length})</span>
                </div>
                <p className="text-[11px] leading-relaxed opacity-90">
                  The following placeholder tokens must be configured with your actual credentials/IDs before submitting for approval:
                </p>
                <div className="flex flex-wrap gap-1.5 pt-0.5">
                  {unfilledPlaceholders.map((token) => (
                    <span
                      key={token}
                      className="px-2 py-0.5 rounded-md font-mono text-[10px] bg-amber-500/20 text-amber-900 dark:text-amber-200 border border-amber-500/30 font-medium"
                    >
                      {token}
                    </span>
                  ))}
                </div>
              </div>
            )}

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
                  <option value="payment_status" className="dark:bg-zinc-900">payment_status (Payment & Transaction Status)</option>
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
                    onChange={(e: any) => setFormData({ ...formData, auth_type: e.target.value })}
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
                        <option value="refresh_token" className="dark:bg-zinc-900">refresh_token (Permanent Token / Zoho Desk)</option>
                        <option value="authorization_code" className="dark:bg-zinc-900">authorization_code (Zoho Self-Client Grant Token)</option>
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
                      <div className="flex items-center justify-between mb-1">
                        <label className="text-[11px] text-muted-foreground">Token Endpoint URL *</label>
                        <div className="flex gap-1 text-[10px]">
                          <button
                            type="button"
                            onClick={() => setFormData({ ...formData, oauth_token_url: 'https://accounts.zoho.in/oauth/v2/token' })}
                            className="text-primary hover:underline"
                          >
                            .in
                          </button>
                          <span className="text-zinc-400">|</span>
                          <button
                            type="button"
                            onClick={() => setFormData({ ...formData, oauth_token_url: 'https://accounts.zoho.com/oauth/v2/token' })}
                            className="text-primary hover:underline"
                          >
                            .com
                          </button>
                          <span className="text-zinc-400">|</span>
                          <button
                            type="button"
                            onClick={() => setFormData({ ...formData, oauth_token_url: 'https://accounts.zoho.eu/oauth/v2/token' })}
                            className="text-primary hover:underline"
                          >
                            .eu
                          </button>
                        </div>
                      </div>
                      <input
                        type="url"
                        value={formData.oauth_token_url}
                        onChange={(e) => setFormData({ ...formData, oauth_token_url: e.target.value })}
                        placeholder="https://accounts.zoho.in/oauth/v2/token"
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

                    {formData.oauth_grant_type === 'authorization_code' && (
                      <div>
                        <label className="text-[11px] text-muted-foreground block mb-1">Zoho Self-Client Grant Token * (10-min temporary code)</label>
                        <input
                          type="password"
                          value={formData.oauth_refresh_token}
                          onChange={(e) => setFormData({ ...formData, oauth_refresh_token: e.target.value })}
                          placeholder="Paste Grant Token (1000.xxxx...)"
                          className="w-full p-2 rounded-lg border border-zinc-200 dark:border-white/10 bg-transparent outline-none text-xs font-mono"
                        />
                        <p className="text-[10px] text-zinc-500 mt-0.5">
                          Click "Test Token Handshake" below to automatically exchange this code for a permanent refresh token.
                        </p>
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
                        onClick={onTestOAuth}
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
                          {oauthTestResult.success ? (
                            <>
                              <div>{oauthTestResult.message || `Token received successfully! Expires in ${oauthTestResult.expires_in || 3600}s.`}</div>
                              {oauthTestResult.refresh_token && (
                                <div className="mt-1 font-mono font-medium text-emerald-700 dark:text-emerald-300">
                                  ✓ Permanent Refresh Token retrieved and automatically populated into form.
                                </div>
                              )}
                            </>
                          ) : (
                            oauthTestResult.error
                          )}
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

            {/* Security & Validation (Regex & BOLA) */}
            <div className="p-4 rounded-2xl bg-zinc-50 dark:bg-white/[0.02] border border-zinc-200 dark:border-white/10 space-y-3">
              <div className="font-semibold flex items-center justify-between text-foreground">
                <div className="flex items-center gap-1.5">
                  <Shield className="w-4 h-4 text-primary" />
                  Security & Lookup Validation
                </div>
                <span className="text-[11px] text-muted-foreground font-normal">
                  Pre-flight input validation & BOLA protection
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-semibold text-muted-foreground block mb-1">
                    ID Pattern Validation Regex (Optional)
                  </label>
                  <input
                    type="text"
                    value={formData.id_pattern_regex || ''}
                    onChange={(e) => setFormData({ ...formData, id_pattern_regex: e.target.value })}
                    placeholder="e.g. ^\d{16,19}$ or ^\d+$"
                    className="w-full p-2 rounded-xl border border-zinc-200 dark:border-white/10 bg-transparent outline-none font-mono text-xs focus:ring-2 focus:ring-primary/20"
                  />
                  <p className="text-[10px] text-muted-foreground mt-1">
                    Validates customer ticket/docket ID before issuing HTTP calls. Rejects malformed IDs immediately.
                  </p>
                </div>

                <div>
                  <label className="text-[11px] font-semibold text-muted-foreground block mb-1">
                    Owner Email JSON Path (BOLA Defense)
                  </label>
                  <input
                    type="text"
                    value={formData.owner_email_path || ''}
                    onChange={(e) => setFormData({ ...formData, owner_email_path: e.target.value })}
                    placeholder="e.g. contact.email or orders[0].email"
                    className="w-full p-2 rounded-xl border border-zinc-200 dark:border-white/10 bg-transparent outline-none font-mono text-xs focus:ring-2 focus:ring-primary/20"
                  />
                  <p className="text-[10px] text-muted-foreground mt-1">
                    Verifies retrieved record belongs to requester before returning status data to customer.
                  </p>
                </div>
              </div>
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
                    className="px-2 py-1 rounded-lg bg-zinc-100 dark:bg-white/5 hover:bg-primary/10 hover:text-primary transition-all font-mono text-[11px] border border-zinc-200 dark:border-white/10 cursor-pointer"
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

            {/* Ticket Description Format Selector (ticket_create only) */}
            {formData.trigger_type === 'ticket_create' && (
              <div className="p-3.5 rounded-2xl bg-zinc-50 dark:bg-white/[0.02] border border-zinc-200 dark:border-white/10 space-y-2.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 font-semibold text-foreground">
                    <Sparkles className="w-3.5 h-3.5 text-primary" />
                    <span>Ticket Description Style</span>
                  </div>
                  <span className="text-[10px] text-muted-foreground">
                    Click to auto-format the description payload safely
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => applyDescriptionFormat('hybrid')}
                    className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                      currentDescStyle === 'hybrid'
                        ? 'border-primary/50 bg-primary/10 text-primary shadow-xs ring-1 ring-primary/30'
                        : 'border-zinc-200 dark:border-white/10 hover:border-zinc-300 dark:hover:border-white/20 bg-background/50'
                    }`}
                  >
                    <div className="font-semibold text-[11px] flex items-center justify-between">
                      <span>Hybrid Briefing</span>
                      <span className="text-[9px] px-1.5 py-0.5 rounded-md bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-medium border border-emerald-500/20">
                        Recommended
                      </span>
                    </div>
                    <p className="text-[10px] text-muted-foreground mt-1 leading-snug">
                      Executive summary at top + condensed multi-turn log below (+1.2s).
                    </p>
                  </button>

                  <button
                    type="button"
                    onClick={() => applyDescriptionFormat('transcript')}
                    className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                      currentDescStyle === 'transcript'
                        ? 'border-primary/50 bg-primary/10 text-primary shadow-xs ring-1 ring-primary/30'
                        : 'border-zinc-200 dark:border-white/10 hover:border-zinc-300 dark:hover:border-white/20 bg-background/50'
                    }`}
                  >
                    <div className="font-semibold text-[11px] flex items-center justify-between">
                      <span>Detailed Log Only</span>
                      <span className="text-[9px] px-1.5 py-0.5 rounded-md bg-blue-500/10 text-blue-600 dark:text-blue-400 font-medium border border-blue-500/20">
                        0ms Latency
                      </span>
                    </div>
                    <p className="text-[10px] text-muted-foreground mt-1 leading-snug">
                      Conversation history with condensed diagnostic bot actions.
                    </p>
                  </button>

                  <button
                    type="button"
                    onClick={() => applyDescriptionFormat('summary')}
                    className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                      currentDescStyle === 'summary'
                        ? 'border-primary/50 bg-primary/10 text-primary shadow-xs ring-1 ring-primary/30'
                        : 'border-zinc-200 dark:border-white/10 hover:border-zinc-300 dark:hover:border-white/20 bg-background/50'
                    }`}
                  >
                    <div className="font-semibold text-[11px] flex items-center justify-between">
                      <span>Executive Summary</span>
                      <span className="text-[9px] px-1.5 py-0.5 rounded-md bg-amber-500/10 text-amber-600 dark:text-amber-400 font-medium border border-amber-500/20">
                        High-Level
                      </span>
                    </div>
                    <p className="text-[10px] text-muted-foreground mt-1 leading-snug">
                      Concise 2-sentence synthesis of customer issue and status.
                    </p>
                  </button>
                </div>
              </div>
            )}

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
                  {(formData.trigger_type === 'order_status' || formData.trigger_type === 'ticket_status') && '(Requires "docket_no" & "ticket_status" mappings)'}
                  {formData.trigger_type === 'payment_status' && '(Requires "payment_status" mapping)'}
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
          <div className="p-4 sm:px-6 border-t border-border flex justify-end items-center gap-2.5 bg-card/80 shrink-0">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg border border-border text-foreground/80 hover:text-foreground bg-secondary hover:bg-secondary/80 font-semibold transition-all text-xs cursor-pointer"
            >
              Cancel
            </button>

            <button
              type="button"
              disabled={submitting}
              onClick={(e) => onSubmit(e, 'draft')}
              className="px-4 py-2 rounded-lg border border-border text-foreground/80 hover:text-foreground bg-secondary hover:bg-secondary/80 font-semibold transition-all text-xs cursor-pointer disabled:opacity-50"
            >
              Save as Draft
            </button>

            <button
              type="submit"
              disabled={submitting || unfilledPlaceholders.length > 0}
              title={
                unfilledPlaceholders.length > 0
                  ? `Please replace unconfigured placeholders (${unfilledPlaceholders.join(', ')}) before submitting for approval.`
                  : ''
              }
              className="px-5 py-2 rounded-lg bg-primary text-primary-foreground font-semibold hover:bg-primary/90 transition-all flex items-center gap-2 shadow-sm text-xs cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {submitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              <span>{editingId ? 'Submit Version for Approval' : 'Submit for Approval'}</span>
            </button>
          </div>
        </form>
    </BaseModal>
  );
};

export default ConnectorEditorModal;
