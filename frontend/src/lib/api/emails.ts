import { BASE_URL, authHeaders, safeJson } from './core';

export const emailsApi = {
  async processEmail(data: { client_id: string; from_email: string; subject: string; body: string }) {
    const res = await fetch(`${BASE_URL}/process-email`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify(data),
    });
    return safeJson(res, 'Failed to process email');
  },

  async acceptEmail(data: { client_id: string; email: string; password: string; score_threshold?: number; response_tone?: string; agent_type?: string }) {
    const res = await fetch(`${BASE_URL}/accept-email`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify(data),
    });
    return safeJson(res, 'Failed to accept email');
  },

  async getEmailAccount(clientId: string) {
    if (!clientId || (!clientId.startsWith('CLI-') && clientId !== 'ALL')) {
      return null;
    }
    const res = await fetch(`${BASE_URL}/email-account/${clientId}`, { headers: authHeaders() });
    return safeJson(res, 'Failed to fetch account');
  },

  async getAllEmailAccounts() {
    const res = await fetch(`${BASE_URL}/email-accounts`, { headers: authHeaders() });
    return safeJson(res, 'Failed to fetch accounts');
  },

  async createTicket(data: { client_id: string; mail_id: string; subject: string; body: string; status: 'Ticket_Generated' | 'Done_Replied' }) {
    const res = await fetch(`${BASE_URL}/create-ticket`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify(data),
    });
    return safeJson(res, 'Failed to create ticket');
  },

  async orderStatus(clientId: string, orderId: string) {
    const res = await fetch(`${BASE_URL}/order-status`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify({ client_id: clientId, order_id: orderId }),
    });
    return safeJson(res, 'Failed to fetch order status');
  },

  async getEmails(clientId: string) {
    const res = await fetch(`${BASE_URL}/emails/${clientId}`, { headers: authHeaders() });
    return safeJson(res, 'Failed to fetch emails');
  },

  async getTickets(clientId: string) {
    const res = await fetch(`${BASE_URL}/tickets/${clientId}`, { headers: authHeaders() });
    return safeJson(res, 'Failed to fetch tickets');
  },

  async sendManualReply(data: { client_id: string; to_email: string; subject: string; body: string; reply_text: string }) {
    const res = await fetch(`${BASE_URL}/manual-reply`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify(data),
    });
    return safeJson(res, 'Failed to send manual reply');
  },

  async approvePendingReply(data: { client_id: string; log_id: number }) {
    const res = await fetch(`${BASE_URL}/approve-pending-reply`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify(data),
    });
    return safeJson(res, 'Failed to approve pending reply');
  },

  async pauseEmail(data: { client_id: string; email: string }) {
    const res = await fetch(`${BASE_URL}/pause-email`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify(data),
    });
    return safeJson(res, 'Failed to pause email');
  },

  async unpauseEmail(data: { client_id: string; email: string }) {
    const res = await fetch(`${BASE_URL}/unpause-email`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify(data),
    });
    return safeJson(res, 'Failed to unpause email');
  },

  async getPausedEmails(clientId: string) {
    const res = await fetch(`${BASE_URL}/paused-emails/${clientId}`, { headers: authHeaders() });
    return safeJson(res, 'Failed to fetch paused emails');
  },

  async getPausedEmailHistory(clientId: string, status?: string) {
    let url = `${BASE_URL}/paused-emails/${clientId}/history`;
    if (status) url += `?status=${status}`;
    const res = await fetch(url, { headers: authHeaders() });
    return safeJson(res, 'Failed to fetch paused email history');
  },

  async updatePausedEmailHistoryStatus(clientId: string, recordId: number, status: 'ignored' | 'replied') {
    const res = await fetch(`${BASE_URL}/paused-emails/${clientId}/history/${recordId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify({ status }),
    });
    return safeJson(res, 'Failed to update paused email status');
  },

  async getMarketingSenders(clientId: string) {
    const res = await fetch(`${BASE_URL}/marketing-senders/${clientId}`, { headers: authHeaders() });
    return safeJson(res, 'Failed to fetch marketing senders');
  },

  async markMarketingSender(data: { client_id: string; sender_email: string }) {
    const res = await fetch(`${BASE_URL}/marketing-senders/mark`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify(data),
    });
    return safeJson(res, 'Failed to mark marketing sender');
  },

  async unmarkMarketingSender(data: { client_id: string; sender_email: string }) {
    const res = await fetch(`${BASE_URL}/marketing-senders/unmark`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify(data),
    });
    return safeJson(res, 'Failed to unmark marketing sender');
  },

  // ===== Blocked Keywords =====
  async getBlockedKeywords(clientId: string) {
    const res = await fetch(`${BASE_URL}/blocked-keywords/${clientId}`, { headers: authHeaders() });
    return safeJson(res, 'Failed to fetch blocked keywords');
  },

  async addBlockedKeyword(clientId: string, keyword: string) {
    const res = await fetch(`${BASE_URL}/blocked-keywords/add`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify({ client_id: clientId, keyword }),
    });
    return safeJson(res, 'Failed to add blocked keyword');
  },

  async deleteBlockedKeyword(clientId: string, keyword: string) {
    const res = await fetch(`${BASE_URL}/blocked-keywords/${clientId}/${encodeURIComponent(keyword)}`, {
      method: 'DELETE',
      headers: authHeaders(),
    });
    return safeJson(res, 'Failed to delete blocked keyword');
  },

  async getBlockedPolicy(clientId: string) {
    const res = await fetch(`${BASE_URL}/blocked-keywords/policy/${clientId}`, { headers: authHeaders() });
    return safeJson(res, 'Failed to fetch blocked policy');
  },

  async setBlockedPolicy(clientId: string, action: string) {
    const res = await fetch(`${BASE_URL}/blocked-keywords/policy`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify({ client_id: clientId, action }),
    });
    return safeJson(res, 'Failed to set blocked policy');
  },

  // ===== Email Disclaimers Management =====
  async getEmailDisclaimers(clientId: string) {
    const res = await fetch(`${BASE_URL}/email-disclaimers/${clientId}`, { headers: authHeaders() });
    return safeJson(res, 'Failed to fetch email disclaimers');
  },

  async addEmailDisclaimer(data: { client_id: string; disclaimer_text: string }) {
    const res = await fetch(`${BASE_URL}/email-disclaimers`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify(data),
    });
    return safeJson(res, 'Failed to add email disclaimer');
  },

  async deleteEmailDisclaimer(disclaimerId: number, clientId?: string) {
    let url = `${BASE_URL}/email-disclaimers/${disclaimerId}`;
    if (clientId) url += `?client_id=${clientId}`;
    const res = await fetch(url, {
      method: 'DELETE',
      headers: authHeaders(),
    });
    return safeJson(res, 'Failed to delete email disclaimer');
  },

  async toggleEmailDisclaimer(disclaimerId: number, isActive: boolean, clientId?: string) {
    let url = `${BASE_URL}/email-disclaimers/${disclaimerId}/toggle`;
    if (clientId) url += `?client_id=${clientId}`;
    const res = await fetch(url, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify({ is_active: isActive }),
    });
    return safeJson(res, 'Failed to toggle email disclaimer');
  },

  // ===== Blocked Emails =====
  async getBlockedEmails(clientId: string, status?: string) {
    let url = `${BASE_URL}/blocked-emails/${clientId}`;
    if (status) url += `?status=${status}`;
    const res = await fetch(url, { headers: authHeaders() });
    return safeJson(res, 'Failed to fetch blocked emails');
  },

  async updateBlockedEmailStatus(clientId: string, recordId: number, status: string) {
    const res = await fetch(`${BASE_URL}/blocked-emails/${clientId}/${recordId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify({ status }),
    });
    return safeJson(res, 'Failed to update blocked email status');
  },

  async bulkIgnoreBlockedEmails(clientId: string) {
    const res = await fetch(`${BASE_URL}/blocked-emails/${clientId}/bulk-ignore`, {
      method: 'PATCH',
      headers: authHeaders(),
    });
    return safeJson(res, 'Failed to bulk ignore blocked emails');
  },

  // ===== Chat History =====
  async getChatHistory(clientId: string, fromEmail: string) {
    const res = await fetch(`${BASE_URL}/chat-history/${clientId}/${encodeURIComponent(fromEmail)}`, { headers: authHeaders() });
    return safeJson(res, 'Failed to fetch chat history');
  },

  async clearChatHistory(clientId: string, fromEmail: string) {
    const res = await fetch(`${BASE_URL}/chat-history/${clientId}/${encodeURIComponent(fromEmail)}`, {
      method: 'DELETE',
      headers: authHeaders(),
    });
    return safeJson(res, 'Failed to clear chat history');
  },
};
