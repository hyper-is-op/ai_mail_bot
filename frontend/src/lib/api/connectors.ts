import { BASE_URL, authHeaders, safeJson } from './core';

export const connectorsApi = {
  async insertCreatePayload(data: { client_id: string; url: string; paylod: any }) {
    const res = await fetch(`${BASE_URL}/insert-create-payload`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify(data),
    });
    return safeJson(res, 'Failed to save create payload');
  },

  async getCreatePayload(clientId: string) {
    const res = await fetch(`${BASE_URL}/get-create-payload/${clientId}`, { headers: authHeaders() });
    return safeJson(res, 'Failed to fetch create payload');
  },

  async insertGetPayload(data: { client_id: string; url: string; paylod: any }) {
    const res = await fetch(`${BASE_URL}/insert-get-payload`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify(data),
    });
    return safeJson(res, 'Failed to save get payload');
  },

  async getGetPayload(clientId: string) {
    const res = await fetch(`${BASE_URL}/get-get-payload/${clientId}`, { headers: authHeaders() });
    return safeJson(res, 'Failed to fetch get payload');
  },

  // ===== Connector Configurations =====
  async createConnectorConfig(data: {
    client_id: string;
    trigger_type: string;
    http_method: string;
    url: string;
    headers_template?: string | null;
    request_template?: string | null;
    response_mapping?: string | null;
    auth_type: 'bearer' | 'basic' | 'api_key_header' | 'api_key_query';
    auth_secret?: string | null;
    auth_field_name?: string | null;
    payload_encoding?: 'plain' | 'base64_query';
    base64_query_param_name?: string | null;
    status?: 'draft' | 'pending_approval';
  }) {
    const res = await fetch(`${BASE_URL}/admin/connector-configs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify(data),
    });
    return safeJson(res, 'Failed to create connector config');
  },

  async listConnectorConfigs(clientId: string) {
    const res = await fetch(`${BASE_URL}/admin/connector-configs/${clientId}`, {
      headers: authHeaders(),
    });
    return safeJson(res, 'Failed to list connector configs');
  },

  async approveConnectorConfig(configId: number | string, data: { client_id: string }) {
    const res = await fetch(`${BASE_URL}/admin/connector-configs/${configId}/approve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify(data),
    });
    return safeJson(res, 'Failed to approve connector config');
  },

  async rejectConnectorConfig(configId: number | string, data: { client_id: string; reason?: string }) {
    const res = await fetch(`${BASE_URL}/admin/connector-configs/${configId}/reject`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify(data),
    });
    return safeJson(res, 'Failed to reject connector config');
  },

  async deleteDraftConnectorConfig(configId: number | string) {
    const res = await fetch(`${BASE_URL}/admin/connector-configs/${configId}`, {
      method: 'DELETE',
      headers: authHeaders(),
    });
    return safeJson(res, 'Failed to delete connector');
  },

  async deletePendingConnectorConfig(configId: number | string) {
    const res = await fetch(`${BASE_URL}/admin/connector-configs/${configId}`, {
      method: 'DELETE',
      headers: authHeaders(),
    });
    return safeJson(res, 'Failed to delete pending connector');
  },

  async requestDeleteConnector(configId: number | string) {
    const res = await fetch(`${BASE_URL}/admin/connector-configs/${configId}/request-deletion`, {
      method: 'POST',
      headers: authHeaders(),
    });
    return safeJson(res, 'Failed to request connector deletion');
  },

  async takedownConnector(configId: number | string) {
    const res = await fetch(`${BASE_URL}/admin/connector-configs/${configId}/takedown`, {
      method: 'POST',
      headers: authHeaders(),
    });
    return safeJson(res, 'Failed to take down connector');
  },

  async approveDeleteConnector(configId: number | string) {
    const res = await fetch(`${BASE_URL}/admin/connector-configs/${configId}/approve-deletion`, {
      method: 'POST',
      headers: authHeaders(),
    });
    return safeJson(res, 'Failed to approve connector deletion');
  },

  async rejectDeleteConnector(configId: number | string) {
    const res = await fetch(`${BASE_URL}/admin/connector-configs/${configId}/reject-deletion`, {
      method: 'POST',
      headers: authHeaders(),
    });
    return safeJson(res, 'Failed to reject connector deletion');
  },

  async cancelDeleteRequest(configId: number | string) {
    const res = await fetch(`${BASE_URL}/admin/connector-configs/${configId}/cancel-deletion`, {
      method: 'POST',
      headers: authHeaders(),
    });
    return safeJson(res, 'Failed to cancel deletion request');
  },

  async regenerateConnectorConfig(data: {
    client_id: string;
    trigger_type: string;
    http_method: string;
    url: string;
    headers_template?: string | null;
    request_template?: string | null;
    response_mapping?: string | null;
    auth_type: 'bearer' | 'basic' | 'api_key_header' | 'api_key_query' | 'oauth2_client_credentials';
    auth_secret?: string | null;
    auth_field_name?: string | null;
    payload_encoding?: 'plain' | 'base64_query';
    base64_query_param_name?: string | null;
  }) {
    const res = await fetch(`${BASE_URL}/admin/connector-configs/regenerate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify(data),
    });
    return safeJson(res, 'Failed to update/regenerate connector config');
  },

  async testOAuthTokenHandshake(data: {
    token_url: string;
    client_id: string;
    client_secret: string;
    refresh_token?: string;
    grant_type?: string;
    scope?: string;
    token_auth_method?: string;
    header_prefix?: string;
  }) {
    const res = await fetch(`${BASE_URL}/admin/connector-configs/test-oauth`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify(data),
    });
    return safeJson(res, 'Failed to execute OAuth 2.0 handshake');
  },

  async generateConnectorTemplatePreview(data: {
    client_id: string;
    trigger_type: string;
    crm_schema_description: string;
    sample_response?: string;
  }) {
    const res = await fetch(`${BASE_URL}/admin/connector-configs/generate-preview`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify(data),
    });
    return safeJson(res, 'Failed to generate connector template preview');
  },

  async getUrlAllowlist() {
    const res = await fetch(`${BASE_URL}/admin/url-allowlist`, {
      headers: authHeaders(),
    });
    return safeJson(res, 'Failed to fetch URL allowlist');
  },

  async addUrlAllowlist(data: { url: string }) {
    const res = await fetch(`${BASE_URL}/admin/url-allowlist`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify(data),
    });
    return safeJson(res, 'Failed to add URL to allowlist');
  },
};
