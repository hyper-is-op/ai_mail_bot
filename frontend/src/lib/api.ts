const BASE_URL = '/api';

function authHeaders(): Record<string, string> {
  const raw = localStorage.getItem('user');
  if (!raw) return {};
  try {
    const { token } = JSON.parse(raw);
    return token ? { Authorization: `Bearer ${token}` } : {};
  } catch {
    return {};
  }
}

async function handleAuthFailure(res: Response) {
  if (res.status === 401) {
    localStorage.removeItem('user');
    window.location.href = '/login';
  }
}

export const api = {
  async health() {
    const res = await fetch(`${BASE_URL}/`);
    return res.json();
  },
  async register(data: any) {
    const res = await fetch(`${BASE_URL}/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    const result = await res.json();
    if (!res.ok) throw new Error(result.detail || 'Registration failed');
    return result;
  },
  async login(data: any) {
    const res = await fetch(`${BASE_URL}/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    const result = await res.json();
    if (!res.ok) throw new Error(result.detail || 'Login failed');
    return result;
  },
  async forgotPasswordSendOtp(email: string) {
    const res = await fetch(`${BASE_URL}/forgot-password/send-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    });
    const result = await res.json();
    if (!res.ok) throw new Error(result.detail || 'Request failed');
    return result;
  },
  async forgotPasswordReset(data: { email: string; otp: string; new_password: string }) {
    const res = await fetch(`${BASE_URL}/forgot-password/reset`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    const result = await res.json();
    if (!res.ok) throw new Error(result.detail || 'Reset failed');
    return result;
  },
  async adminResetClientPassword(data: { client_id: string; new_password: string }) {
    const res = await fetch(`${BASE_URL}/admin/reset-client-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify(data),
    });
    const result = await res.json();
    if (!res.ok) throw new Error(result.detail || 'Reset failed');
    return result;
  },
  async logout() {
    await fetch(`${BASE_URL}/logout`, { method: 'POST', headers: authHeaders() });
  },
  async processEmail(data: { client_id: string; from_email: string; subject: string; body: string }) {
    const res = await fetch(`${BASE_URL}/process-email`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error('Failed to process email');
    return res.json();
  },
  async acceptEmail(data: { client_id: string; email: string; password: string; score_threshold?: number; response_tone?: string }) {
    const res = await fetch(`${BASE_URL}/accept-email`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify(data),
    });
    const result = await res.json();
    await handleAuthFailure(res);
    if (!res.ok) throw new Error(result.detail || 'Failed to accept email');
    return result;
  },
  async getEmailAccount(clientId: string) {
    const res = await fetch(`${BASE_URL}/email-account/${clientId}`, { headers: authHeaders() });
    const result = await res.json();
    await handleAuthFailure(res);
    if (!res.ok) throw new Error(result.detail || 'Failed to fetch account');
    return result;
  },
  async getAllEmailAccounts() {
    const res = await fetch(`${BASE_URL}/email-accounts`, { headers: authHeaders() });
    const result = await res.json();
    await handleAuthFailure(res);
    if (!res.ok) throw new Error(result.detail || 'Failed to fetch accounts');
    return result;
  },
  async createTicket(data: { client_id: string; mail_id: string; subject: string; body: string; status: 'Ticket_Generated' | 'Done_Replied' }) {
    const res = await fetch(`${BASE_URL}/create-ticket`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify(data),
    });
    const result = await res.json();
    await handleAuthFailure(res);
    if (!res.ok) throw new Error(result.detail || 'Failed to create ticket');
    return result;
  },
  async orderStatus(clientId: string, orderId: string) {
    const res = await fetch(`${BASE_URL}/order-status`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify({ client_id: clientId, order_id: orderId }),
    });
    const result = await res.json();
    await handleAuthFailure(res);
    if (!res.ok) throw new Error(result.detail || 'Failed to fetch order status');
    return result;
  },
  async insertCreatePayload(data: { client_id: string; url: string; paylod: any }) {
    const res = await fetch(`${BASE_URL}/insert-create_payload_ticket`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify(data),
    });
    const result = await res.json();
    await handleAuthFailure(res);
    if (!res.ok) throw new Error(result.detail || 'Failed to insert create payload');
    return result;
  },
  async getCreatePayload(clientId: string) {
    const res = await fetch(`${BASE_URL}/get-create_payload/${clientId}`, { headers: authHeaders() });
    const result = await res.json();
    await handleAuthFailure(res);
    if (!res.ok) throw new Error(result.detail || 'Failed to fetch create payload');
    return result;
  },
  async insertGetPayload(data: { client_id: string; url: string; paylod: any }) {
    const res = await fetch(`${BASE_URL}/insert-payload_get_ticket`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify(data),
    });
    const result = await res.json();
    await handleAuthFailure(res);
    if (!res.ok) throw new Error(result.detail || 'Failed to insert get payload');
    return result;
  },
  async getGetPayload(clientId: string) {
    const res = await fetch(`${BASE_URL}/get-get_payload/${clientId}`, { headers: authHeaders() });
    const result = await res.json();
    await handleAuthFailure(res);
    if (!res.ok) throw new Error(result.detail || 'Failed to fetch get payload');
    return result;
  },
  async getDashboardStats(clientId: string, rangeType: string = "all", startDate?: string, endDate?: string) {
    let url = `${BASE_URL}/dashboard/stats/${clientId}?range_type=${rangeType}`;
    if (startDate && endDate) url += `&start_date=${startDate}&end_date=${endDate}`;
    const res = await fetch(url, { headers: authHeaders() });
    const result = await res.json();
    await handleAuthFailure(res);
    if (!res.ok) throw new Error(result.detail || 'Failed to fetch dashboard stats');
    return result;
  },
  async getEmails(clientId: string) {
    const res = await fetch(`${BASE_URL}/emails/${clientId}`, { headers: authHeaders() });
    const result = await res.json();
    await handleAuthFailure(res);
    if (!res.ok) throw new Error(result.detail || 'Failed to fetch emails');
    return result;
  },
  async getTickets(clientId: string) {
    const res = await fetch(`${BASE_URL}/tickets/${clientId}`, { headers: authHeaders() });
    const result = await res.json();
    await handleAuthFailure(res);
    if (!res.ok) throw new Error(result.detail || 'Failed to fetch tickets');
    return result;
  },
  async uploadRagData(data: { client_id: string; title: string; content: string }) {
    const res = await fetch(`${BASE_URL}/rag/upload`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', ...authHeaders() }, body: JSON.stringify(data),
    });
    const result = await res.json();
    await handleAuthFailure(res);
    if (!res.ok) throw new Error(result.detail || 'Failed to upload RAG data');
    return result;
  },
  async getRagDocuments(clientId: string) {
    const res = await fetch(`${BASE_URL}/rag/documents/${clientId}`, { headers: authHeaders() });
    const result = await res.json();
    await handleAuthFailure(res);
    if (!res.ok) throw new Error(result.detail || 'Failed to fetch RAG documents');
    return result;
  },
  async deleteRagDocument(clientId: string, docId: string) {
    const res = await fetch(`${BASE_URL}/rag/documents/${clientId}/${docId}`, { method: 'DELETE', headers: authHeaders() });
    const result = await res.json();
    await handleAuthFailure(res);
    if (!res.ok) throw new Error(result.detail || 'Failed to delete RAG document');
    return result;
  },
  async queryRag(data: { client_id: string; query: string }) {
    const res = await fetch(`${BASE_URL}/rag/query`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', ...authHeaders() }, body: JSON.stringify(data),
    });
    const result = await res.json();
    await handleAuthFailure(res);
    if (!res.ok) throw new Error(result.detail || 'Failed to query RAG');
    return result;
  },
  async retrieveRag(data: { client_id: string; query: string; top_k?: number }) {
    const res = await fetch(`${BASE_URL}/rag/retrieve`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', ...authHeaders() }, body: JSON.stringify(data),
    });
    const result = await res.json();
    await handleAuthFailure(res);
    if (!res.ok) throw new Error(result.detail || 'Failed to retrieve RAG data');
    return result;
  },
  async uploadRagFile(clientId: string, file: File) {
    const formData = new FormData();
    formData.append('client_id', clientId);
    formData.append('file', file);
    const res = await fetch(`${BASE_URL}/rag/upload-file`, { method: 'POST', headers: authHeaders(), body: formData });
    const result = await res.json();
    await handleAuthFailure(res);
    if (!res.ok) throw new Error(result.detail || 'Failed to upload RAG file');
    return result;
  },
  async getLlmMetrics(clientId: string) {
    const res = await fetch(`${BASE_URL}/llm/metrics/${clientId}`, { headers: authHeaders() });
    const result = await res.json();
    await handleAuthFailure(res);
    if (!res.ok) throw new Error(result.detail || 'Failed to fetch LLM analytics');
    return result;
  },
  async approveRegistration(email: string) {
    const res = await fetch(`${BASE_URL}/approve-registration`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', ...authHeaders() }, body: JSON.stringify({ email }),
    });
    const result = await res.json();
    await handleAuthFailure(res);
    if (!res.ok) throw new Error(result.detail || 'Failed to approve registration');
    return result;
  },
  async pauseEmail(data: { client_id: string; email: string }) {
    const res = await fetch(`${BASE_URL}/pause-email`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', ...authHeaders() }, body: JSON.stringify(data),
    });
    const result = await res.json();
    await handleAuthFailure(res);
    if (!res.ok) throw new Error(result.detail || 'Failed to pause email');
    return result;
  },
  async unpauseEmail(data: { client_id: string; email: string }) {
    const res = await fetch(`${BASE_URL}/unpause-email`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', ...authHeaders() }, body: JSON.stringify(data),
    });
    const result = await res.json();
    await handleAuthFailure(res);
    if (!res.ok) throw new Error(result.detail || 'Failed to unpause email');
    return result;
  },
  async getPausedEmails(clientId: string) {
    const res = await fetch(`${BASE_URL}/paused-emails/${clientId}`, { headers: authHeaders() });
    const result = await res.json();
    await handleAuthFailure(res);
    if (!res.ok) throw new Error(result.detail || 'Failed to fetch paused emails');
    return result;
  },
  async sendManualReply(data: { client_id: string; to_email: string; subject: string; body: string; reply_text: string }) {
    const res = await fetch(`${BASE_URL}/manual-reply`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', ...authHeaders() }, body: JSON.stringify(data),
    });
    const result = await res.json();
    await handleAuthFailure(res);
    if (!res.ok) {
      const errMsg = typeof result.detail === 'string' ? result.detail : JSON.stringify(result.detail);
      throw new Error(errMsg || 'Failed to send manual reply');
    }
    return result;
  },
  async approvePendingReply(data: { client_id: string; log_id: number }) {
    const res = await fetch(`${BASE_URL}/approve-pending-reply`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', ...authHeaders() }, body: JSON.stringify(data),
    });
    const result = await res.json();
    await handleAuthFailure(res);
    if (!res.ok) throw new Error(result.detail || 'Failed to approve pending reply');
    return result;
  },
  async getBudgetStatus(clientId: string) {
    const res = await fetch(`${BASE_URL}/budget-status/${clientId}`, { headers: authHeaders() });
    const result = await res.json();
    await handleAuthFailure(res);
    if (!res.ok) throw new Error(result.detail || 'Failed to fetch budget status');
    return result;
  },

  async createClient(data: { 
    name: string; 
    phone_number: string; 
    login_email: string; 
    login_password: string; 
    imap_email?: string; 
    imap_password?: string; 
    score_threshold?: number; 
    response_tone?: string;
    agent_type?: string;
    department_name?: string;
    company_name?: string;
  }) {
    const res = await fetch(`${BASE_URL}/admin/create-client`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', ...authHeaders() }, body: JSON.stringify(data),
    });
    const result = await res.json();
    await handleAuthFailure(res);
    if (!res.ok) throw new Error(result.detail || 'Failed to create client');
    return result;
  },
  async getPendingUsers() {
    const res = await fetch(`${BASE_URL}/admin/pending-users`, { headers: authHeaders() });
    const result = await res.json();
    await handleAuthFailure(res);
    if (!res.ok) throw new Error(result.detail || 'Failed to fetch pending users');
    return result;
  },
  async setClientFeatures(data: { client_id: string; feature_ticket_creation: boolean; feature_auto_send: boolean; feature_rag: boolean; feature_order_tracking: boolean; feature_manual_reply: boolean }) {
    const res = await fetch(`${BASE_URL}/admin/client-features`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', ...authHeaders() }, body: JSON.stringify(data),
    });
    const result = await res.json();
    await handleAuthFailure(res);
    if (!res.ok) throw new Error(result.detail || 'Failed to update features');
    return result;
  },
  async getClientModelConfig(clientId: string) {
    const res = await fetch(`${BASE_URL}/admin/client-model-config/${clientId}`, { headers: authHeaders() });
    const result = await res.json();
    await handleAuthFailure(res);
    if (!res.ok) throw new Error(result.detail || 'Failed to fetch model config');
    return result;
  },
  async setClientModelConfig(data: { client_id: string; caller_function: string; model_name: string }) {
    const res = await fetch(`${BASE_URL}/admin/client-model-config`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', ...authHeaders() }, body: JSON.stringify(data),
    });
    const result = await res.json();
    await handleAuthFailure(res);
    if (!res.ok) throw new Error(result.detail || 'Failed to update model config');
    return result;
  },
  async setClientCostConfig(data: { client_id: string; cost_multiplier: number; monthly_budget_usd?: number | null }) {
    const res = await fetch(`${BASE_URL}/admin/client-cost-config`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', ...authHeaders() }, body: JSON.stringify(data),
    });
    const result = await res.json();
    await handleAuthFailure(res);
    if (!res.ok) throw new Error(result.detail || 'Failed to update cost config');
    return result;
  },
  async getAllBudgetStatuses() {
    const res = await fetch(`${BASE_URL}/admin/budget-status`, { headers: authHeaders() });
    const result = await res.json();
    await handleAuthFailure(res);
    if (!res.ok) throw new Error(result.detail || 'Failed to fetch budget statuses');
    return result;
  },
  async getAdminKnowledgeStats() {
    const res = await fetch(`${BASE_URL}/admin/knowledge-stats`, { headers: authHeaders() });
    const result = await res.json();
    await handleAuthFailure(res);
    if (!res.ok) throw new Error(result.detail || 'Failed to fetch knowledge stats');
    return result;
  },

  // ===== Delete Client =====
  async deleteClient(clientId: string) {
    const res = await fetch(`${BASE_URL}/admin/delete-client/${clientId}`, {
      method: 'DELETE',
      headers: authHeaders(),
    });
    const result = await res.json();
    await handleAuthFailure(res);
    if (!res.ok) throw new Error(result.detail || 'Failed to delete client');
    return result;
  },

  // ===== Blocked Keywords =====
  async getBlockedKeywords(clientId: string) {
    const res = await fetch(`${BASE_URL}/blocked-keywords/${clientId}`, { headers: authHeaders() });
    const result = await res.json();
    await handleAuthFailure(res);
    if (!res.ok) throw new Error(result.detail || 'Failed to fetch blocked keywords');
    return result;
  },
  async addBlockedKeyword(clientId: string, keyword: string) {
    const res = await fetch(`${BASE_URL}/blocked-keywords/add`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify({ client_id: clientId, keyword }),
    });
    const result = await res.json();
    await handleAuthFailure(res);
    if (!res.ok) throw new Error(result.detail || 'Failed to add blocked keyword');
    return result;
  },
  async deleteBlockedKeyword(clientId: string, keyword: string) {
    const res = await fetch(`${BASE_URL}/blocked-keywords/${clientId}/${encodeURIComponent(keyword)}`, {
      method: 'DELETE',
      headers: authHeaders(),
    });
    const result = await res.json();
    await handleAuthFailure(res);
    if (!res.ok) throw new Error(result.detail || 'Failed to delete blocked keyword');
    return result;
  },
  async getBlockedPolicy(clientId: string) {
    const res = await fetch(`${BASE_URL}/blocked-keywords/policy/${clientId}`, { headers: authHeaders() });
    const result = await res.json();
    await handleAuthFailure(res);
    if (!res.ok) throw new Error(result.detail || 'Failed to fetch blocked policy');
    return result;
  },
  async setBlockedPolicy(clientId: string, action: string) {
    const res = await fetch(`${BASE_URL}/blocked-keywords/policy`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify({ client_id: clientId, action }),
    });
    const result = await res.json();
    await handleAuthFailure(res);
    if (!res.ok) throw new Error(result.detail || 'Failed to set blocked policy');
    return result;
  },

  // ===== Blocked Emails =====
  async getBlockedEmails(clientId: string, status?: string) {
    let url = `${BASE_URL}/blocked-emails/${clientId}`;
    if (status) url += `?status=${status}`;
    const res = await fetch(url, { headers: authHeaders() });
    const result = await res.json();
    await handleAuthFailure(res);
    if (!res.ok) throw new Error(result.detail || 'Failed to fetch blocked emails');
    return result;
  },
  async updateBlockedEmailStatus(clientId: string, recordId: number, status: string) {
    const res = await fetch(`${BASE_URL}/blocked-emails/${clientId}/${recordId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify({ status }),
    });
    const result = await res.json();
    await handleAuthFailure(res);
    if (!res.ok) throw new Error(result.detail || 'Failed to update blocked email status');
    return result;
  },
  async bulkIgnoreBlockedEmails(clientId: string) {
    const res = await fetch(`${BASE_URL}/blocked-emails/${clientId}/bulk-ignore`, {
      method: 'PATCH',
      headers: authHeaders(),
    });
    const result = await res.json();
    await handleAuthFailure(res);
    if (!res.ok) throw new Error(result.detail || 'Failed to bulk ignore blocked emails');
    return result;
  },

  // ===== Chat History =====
  async getChatHistory(clientId: string, fromEmail: string) {
    const res = await fetch(`${BASE_URL}/chat-history/${clientId}/${encodeURIComponent(fromEmail)}`, { headers: authHeaders() });
    const result = await res.json();
    await handleAuthFailure(res);
    if (!res.ok) throw new Error(result.detail || 'Failed to fetch chat history');
    return result;
  },
  async clearChatHistory(clientId: string, fromEmail: string) {
    const res = await fetch(`${BASE_URL}/chat-history/${clientId}/${encodeURIComponent(fromEmail)}`, {
      method: 'DELETE',
      headers: authHeaders(),
    });
    const result = await res.json();
    await handleAuthFailure(res);
    if (!res.ok) throw new Error(result.detail || 'Failed to clear chat history');
    return result;
  },

  // ===== Profile Settings =====
  async updateClientProfile(data: { 
    client_id: string; 
    name?: string;
    phone_number?: string;
    login_email?: string;
    imap_email?: string;
    imap_password?: string;
    agent_type?: string; 
    department_name?: string; 
    company_name?: string;
  }) {
    const res = await fetch(`${BASE_URL}/admin/client-profile`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify(data),
    });
    const result = await res.json();
    await handleAuthFailure(res);
    if (!res.ok) throw new Error(result.detail || 'Failed to update client profile');
    return result;
  },
  async updateSelfProfile(data: { client_id: string; department_name?: string; company_name?: string }) {
    const res = await fetch(`${BASE_URL}/client/profile`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify(data),
    });
    const result = await res.json();
    await handleAuthFailure(res);
    if (!res.ok) throw new Error(result.detail || 'Failed to update profile');
    return result;
  },
};