import { BASE_URL, authHeaders, safeJson } from './core';

export const draftsApi = {
  async getMasterBotStatus(clientId: string) {
    const res = await fetch(`${BASE_URL}/master-bot-status/${clientId}`, { headers: authHeaders() });
    return safeJson(res, 'Failed to fetch master bot status');
  },

  async toggleAdminMasterBot(data: { client_id: string; admin_bot_enabled: boolean }) {
    const res = await fetch(`${BASE_URL}/admin/master-bot-toggle`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify(data),
    });
    return safeJson(res, 'Failed to toggle admin master bot');
  },

  async toggleClientMasterBot(data: { client_id: string; client_bot_enabled: boolean }) {
    const res = await fetch(`${BASE_URL}/client/master-bot-toggle`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify(data),
    });
    return safeJson(res, 'Failed to toggle client master bot');
  },

  async getClientFeatures(clientId: string) {
    const res = await fetch(`${BASE_URL}/admin/client-features/${clientId}`, { headers: authHeaders() });
    return safeJson(res, 'Failed to fetch features');
  },

  async setClientFeatures(data: { client_id: string; feature_ticket_creation: boolean; feature_auto_send: boolean; feature_rag: boolean; feature_order_tracking: boolean; feature_manual_reply: boolean; feature_strip_disclaimers?: boolean }) {
    const res = await fetch(`${BASE_URL}/admin/client-features`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify(data),
    });
    return safeJson(res, 'Failed to update features');
  },

  // -------------------------------------------------------------
  // DRAFTS & QUEUE REVIEW API
  // -------------------------------------------------------------
  async getDrafts(params: {
    client_id?: string;
    status?: string;
    search?: string;
    intent?: string;
    sentiment?: string;
    from_email?: string;
    min_score?: number;
    max_score?: number;
    date_from?: string;
    date_to?: string;
    page?: number;
    page_size?: number;
  }) {
    const query = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        query.append(key, String(value));
      }
    });
    const res = await fetch(`${BASE_URL}/drafts?${query.toString()}`, {
      headers: authHeaders(),
    });
    return safeJson(res, 'Failed to fetch drafts');
  },

  async getPendingDraftsCount(client_id?: string) {
    const query = client_id ? `?client_id=${encodeURIComponent(client_id)}` : '';
    const res = await fetch(`${BASE_URL}/drafts/count${query}`, {
      headers: authHeaders(),
    });
    return safeJson(res, 'Failed to fetch pending drafts count');
  },

  async getDraftMetrics(client_id?: string) {
    const query = client_id ? `?client_id=${encodeURIComponent(client_id)}` : '';
    const res = await fetch(`${BASE_URL}/drafts/metrics${query}`, {
      headers: authHeaders(),
    });
    return safeJson(res, 'Failed to fetch draft metrics');
  },

  async getDraft(id: number) {
    const res = await fetch(`${BASE_URL}/drafts/${id}`, {
      headers: authHeaders(),
    });
    return safeJson(res, 'Failed to fetch draft details');
  },

  async updateDraft(id: number, data: { subject?: string; draft_reply?: string; to_email?: string }) {
    const res = await fetch(`${BASE_URL}/drafts/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify(data),
    });
    return safeJson(res, 'Failed to update draft');
  },

  async sendDraft(id: number) {
    const res = await fetch(`${BASE_URL}/drafts/${id}/send`, {
      method: 'POST',
      headers: authHeaders(),
    });
    return safeJson(res, 'Failed to send draft');
  },

  async discardDraft(id: number, rejection_reason?: string) {
    const res = await fetch(`${BASE_URL}/drafts/${id}/discard`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify({ rejection_reason: rejection_reason || 'Manually discarded' }),
    });
    return safeJson(res, 'Failed to discard draft');
  },

  async batchSendDrafts(draft_ids: number[]) {
    const res = await fetch(`${BASE_URL}/drafts/batch-send`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify({ draft_ids }),
    });
    return safeJson(res, 'Failed to execute batch send');
  },

  async batchSendByFilter(params: {
    search?: string;
    intent?: string;
    sentiment?: string;
    from_email?: string;
    min_score?: number;
    max_score?: number;
    date_from?: string;
    date_to?: string;
  }) {
    const res = await fetch(`${BASE_URL}/drafts/batch-send-filter`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify(params),
    });
    return safeJson(res, 'Failed to execute batch send by filter');
  },

  async getActionOutbox(params?: { client_id?: string; status?: string; limit?: number }) {
    const q = new URLSearchParams();
    if (params?.client_id) q.set('client_id', params.client_id);
    if (params?.status) q.set('status', params.status);
    if (params?.limit) q.set('limit', String(params.limit));
    const qs = q.toString() ? `?${q.toString()}` : '';
    const res = await fetch(`${BASE_URL}/admin/action-outbox${qs}`, {
      headers: authHeaders(),
    });
    return safeJson(res, 'Failed to fetch action outbox telemetry');
  },

  async sweepActionOutbox(maxAgeSeconds?: number) {
    const q = maxAgeSeconds ? `?max_age_seconds=${maxAgeSeconds}` : '';
    const res = await fetch(`${BASE_URL}/admin/action-outbox/sweep${q}`, {
      method: 'POST',
      headers: authHeaders(),
    });
    return safeJson(res, 'Failed to trigger outbox sweep');
  },
};
