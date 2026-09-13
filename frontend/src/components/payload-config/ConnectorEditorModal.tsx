import React from 'react';
import {
  X,
  Sparkles,
  Lock,
  RefreshCw,
  Loader2,
  CheckCircle,
  XCircle,
} from 'lucide-react';
import { ConnectorFormData, OAuthTestResult, CONTEXT_VARS } from './types';

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
  if (!isOpen) return null;

  const insertVariable = (varName: string, field: 'request_template' | 'headers_template') => {
    setFormData((prev) => ({
      ...prev,
      [field]: prev[field] + `\n"${varName.replace(/[{}]/g, '')}": "${varName}",`,
    }));
  };

  return (
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
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl hover:bg-zinc-100 dark:hover:bg-white/5 text-muted-foreground"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={(e) => onSubmit(e, 'pending_approval')} className="flex flex-col flex-1 min-h-0 overflow-hidden">
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
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl border border-zinc-200 dark:border-white/10 hover:bg-zinc-100 dark:hover:bg-white/5 font-semibold transition-all text-xs cursor-pointer"
            >
              Cancel
            </button>

            <button
              type="button"
              disabled={submitting}
              onClick={(e) => onSubmit(e, 'draft')}
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
  );
};

export default ConnectorEditorModal;
