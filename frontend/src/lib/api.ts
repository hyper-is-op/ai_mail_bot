const BASE_URL = (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/+$/, '') || '/api';

function authHeaders(): Record<string, string> {
  const raw = localStorage.getItem('user');
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw);
    // If a legacy session stored a numeric or non-string client_id, evict it
    if (parsed.client_id !== undefined && parsed.client_id !== null && typeof parsed.client_id !== 'string') {
      localStorage.removeItem('user');
      return {};
    }
    const { token } = parsed;
    return token ? { Authorization: `Bearer ${token}` } : {};
  } catch {
    return {};
  }
}

async function handleAuthFailure(res: Response) {
  if (res.status === 401) {
    localStorage.removeItem('user');
    // Only redirect if not already on the login page to prevent wiping form state/error messages
    if (typeof window !== 'undefined' && window.location.pathname !== '/login') {
      window.location.href = '/login';
    }
  }
}

async function safeJson(res: Response, defaultError = 'Request failed'): Promise<any> {
  await handleAuthFailure(res);
  const text = await res.text();
  let data: any = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    if (!res.ok) {
      if (res.status === 502 || res.status === 503 || res.status === 504) {
        throw new Error(`Backend server is currently restarting or unreachable (Status ${res.status}). Please try again in a moment.`);
      }
      throw new Error(text || `${defaultError} (Status ${res.status})`);
    }
    return {};
  }
  if (!res.ok) {
    if (res.status === 502 || res.status === 503 || res.status === 504) {
      throw new Error(`Backend server is currently restarting or unreachable (Status ${res.status}). Please try again in a moment.`);
    }
    throw new Error(data?.detail || data?.message || data?.error || `${defaultError} (Status ${res.status})`);
  }
  return data !== null ? data : {};
}

export const api = {
  async health() {
    const res = await fetch(`${BASE_URL}/`);
    return safeJson(res, 'Health check failed');
  },
  async register(data: any) {
    const res = await fetch(`${BASE_URL}/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    return safeJson(res, 'Registration failed');
  },
  async login(data: any) {
    const res = await fetch(`${BASE_URL}/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    return safeJson(res, 'Login failed');
  },
  async forgotPasswordSendOtp(email: string) {
    const res = await fetch(`${BASE_URL}/forgot-password/send-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    });
    return safeJson(res, 'Failed to send verification code');
  },
  async forgotPasswordReset(data: { email: string; otp: string; new_password: string }) {
    const res = await fetch(`${BASE_URL}/forgot-password/reset`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    return safeJson(res, 'Password reset failed');
  },
  async adminResetClientPassword(data: { client_id: string; new_password: string }) {
    const res = await fetch(`${BASE_URL}/admin/reset-client-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify(data),
    });
    return safeJson(res, 'Admin password reset failed');
  },
  async setUserStatus(clientId: string, status: 'active' | 'inactive') {
    const res = await fetch(`${BASE_URL}/admin/set-user-status`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify({ client_id: clientId, status }),
    });
    return safeJson(res, 'Failed to update user status');
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
  async insertCreatePayload(data: { client_id: string; url: string; paylod: any }) {
    const res = await fetch(`${BASE_URL}/insert-create_payload_ticket`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify(data),
    });
    return safeJson(res, 'Failed to insert create payload');
  },
  async getCreatePayload(clientId: string) {
    const res = await fetch(`${BASE_URL}/get-create_payload/${clientId}`, { headers: authHeaders() });
    return safeJson(res, 'Failed to fetch create payload');
  },
  async insertGetPayload(data: { client_id: string; url: string; paylod: any }) {
    const res = await fetch(`${BASE_URL}/insert-payload_get_ticket`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify(data),
    });
    return safeJson(res, 'Failed to insert get payload');
  },
  async getGetPayload(clientId: string) {
    const res = await fetch(`${BASE_URL}/get-get_payload/${clientId}`, { headers: authHeaders() });
    return safeJson(res, 'Failed to fetch get payload');
  },
  async getDashboardStats(clientId: string, rangeType: string = "all", startDate?: string, endDate?: string) {
    let url = `${BASE_URL}/dashboard/stats/${clientId}?range_type=${rangeType}`;
    if (startDate && endDate) url += `&start_date=${startDate}&end_date=${endDate}`;
    const res = await fetch(url, { headers: authHeaders() });
    return safeJson(res, 'Failed to fetch dashboard stats');
  },
  async getEmails(clientId: string) {
    const res = await fetch(`${BASE_URL}/emails/${clientId}`, { headers: authHeaders() });
    return safeJson(res, 'Failed to fetch emails');
  },
  async getTickets(clientId: string) {
    const res = await fetch(`${BASE_URL}/tickets/${clientId}`, { headers: authHeaders() });
    return safeJson(res, 'Failed to fetch tickets');
  },
  async uploadRagData(data: { client_id: string; title: string; content: string }) {
    const res = await fetch(`${BASE_URL}/rag/upload`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', ...authHeaders() }, body: JSON.stringify(data),
    });
    return safeJson(res, 'Failed to upload RAG data');
  },
  async getRagDocuments(clientId: string) {
    const res = await fetch(`${BASE_URL}/rag/documents/${clientId}`, { headers: authHeaders() });
    return safeJson(res, 'Failed to fetch RAG documents');
  },
  async deleteRagDocument(clientId: string, docId: string) {
    const res = await fetch(`${BASE_URL}/rag/documents/${clientId}/${docId}`, { method: 'DELETE', headers: authHeaders() });
    return safeJson(res, 'Failed to delete RAG document');
  },
  async queryRag(data: { client_id: string; query: string }) {
    const res = await fetch(`${BASE_URL}/rag/query`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', ...authHeaders() }, body: JSON.stringify(data),
    });
    return safeJson(res, 'Failed to query RAG');
  },
  async retrieveRag(data: { client_id: string; query: string; top_k?: number }) {
    const res = await fetch(`${BASE_URL}/rag/retrieve`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', ...authHeaders() }, body: JSON.stringify(data),
    });
    return safeJson(res, 'Failed to retrieve RAG data');
  },
  async uploadRagFile(clientId: string, file: File) {
    const formData = new FormData();
    formData.append('client_id', clientId);
    formData.append('file', file);
    const res = await fetch(`${BASE_URL}/rag/upload-file`, { method: 'POST', headers: authHeaders(), body: formData });
    return safeJson(res, 'Failed to upload RAG file');
  },
  async getLlmMetrics(clientId: string) {
    const res = await fetch(`${BASE_URL}/llm/metrics/${clientId}`, { headers: authHeaders() });
    return safeJson(res, 'Failed to fetch LLM analytics');
  },
  async approveRegistration(email: string) {
    const res = await fetch(`${BASE_URL}/approve-registration`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', ...authHeaders() }, body: JSON.stringify({ email }),
    });
    return safeJson(res, 'Failed to approve registration');
  },
  async pauseEmail(data: { client_id: string; email: string }) {
    const res = await fetch(`${BASE_URL}/pause-email`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', ...authHeaders() }, body: JSON.stringify(data),
    });
    return safeJson(res, 'Failed to pause email');
  },
  async unpauseEmail(data: { client_id: string; email: string }) {
    const res = await fetch(`${BASE_URL}/unpause-email`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', ...authHeaders() }, body: JSON.stringify(data),
    });
    return safeJson(res, 'Failed to unpause email');
  },
  async getPausedEmails(clientId: string) {
    const res = await fetch(`${BASE_URL}/paused-emails/${clientId}`, { headers: authHeaders() });
    return safeJson(res, 'Failed to fetch paused emails');
  },
  async getPausedEmailHistory(clientId: string, status?: string) {
    let url = `${BASE_URL}/paused-email-history/${clientId}`;
    if (status) url += `?status=${status}`;
    const res = await fetch(url, { headers: authHeaders() });
    return safeJson(res, 'Failed to fetch paused email history');
  },
  async updatePausedEmailHistoryStatus(clientId: string, recordId: number, status: 'ignored' | 'replied') {
    const res = await fetch(`${BASE_URL}/paused-email-history/${clientId}/${recordId}`, {
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
    const res = await fetch(`${BASE_URL}/marketing-senders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify(data),
    });
    return safeJson(res, 'Failed to mark sender as marketing');
  },
  async unmarkMarketingSender(data: { client_id: string; sender_email: string }) {
    const res = await fetch(`${BASE_URL}/unmark-marketing-sender`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify(data),
    });
    return safeJson(res, 'Failed to unmark marketing sender');
  },
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
  async sendManualReply(data: { client_id: string; to_email: string; subject: string; body: string; reply_text: string }) {
    const res = await fetch(`${BASE_URL}/manual-reply`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', ...authHeaders() }, body: JSON.stringify(data),
    });
    return safeJson(res, 'Failed to send manual reply');
  },
  async approvePendingReply(data: { client_id: string; log_id: number }) {
    const res = await fetch(`${BASE_URL}/approve-pending-reply`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', ...authHeaders() }, body: JSON.stringify(data),
    });
    return safeJson(res, 'Failed to approve pending reply');
  },
  async getBudgetStatus(clientId: string) {
    const res = await fetch(`${BASE_URL}/budget-status/${clientId}`, { headers: authHeaders() });
    return safeJson(res, 'Failed to fetch budget status');
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
    return safeJson(res, 'Failed to create client');
  },
  async getPendingUsers() {
    const res = await fetch(`${BASE_URL}/admin/pending-users`, { headers: authHeaders() });
    return safeJson(res, 'Failed to fetch pending users');
  },
  async getClientFeatures(clientId: string) {
    const res = await fetch(`${BASE_URL}/admin/client-features/${clientId}`, { headers: authHeaders() });
    return safeJson(res, 'Failed to fetch features');
  },
  async setClientFeatures(data: { client_id: string; feature_ticket_creation: boolean; feature_auto_send: boolean; feature_rag: boolean; feature_order_tracking: boolean; feature_manual_reply: boolean; feature_strip_disclaimers?: boolean }) {
    const res = await fetch(`${BASE_URL}/admin/client-features`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', ...authHeaders() }, body: JSON.stringify(data),
    });
    return safeJson(res, 'Failed to update features');
  },
  async getClientLlmConfig(clientId: string) {
    const res = await fetch(`${BASE_URL}/admin/client-llm-config/${clientId}`, { headers: authHeaders() });
    return safeJson(res, 'Failed to fetch client LLM configuration');
  },
  async setClientLlmConfig(data: {
    client_id: string;
    caller_function: string;
    global_config_id?: number | null;
    provider?: string | null;
    api_key?: string | null;
    base_url?: string | null;
    model_name: string;
    api_version?: string | null;
  }) {
    const res = await fetch(`${BASE_URL}/admin/client-llm-config`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', ...authHeaders() }, body: JSON.stringify(data),
    });
    return safeJson(res, 'Failed to update client LLM configuration');
  },
  async refreshClientLlmConfig(data: {
    client_id: string;
    caller_function: string;
    global_config_id?: number | null;
    provider?: string | null;
    api_key?: string | null;
    base_url?: string | null;
    api_version?: string | null;
  }) {
    const res = await fetch(`${BASE_URL}/admin/client-llm-config/refresh`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', ...authHeaders() }, body: JSON.stringify(data),
    });
    return safeJson(res, 'Failed to refresh client LLM configuration');
  },
  async getClientModelConfig(clientId: string) {
    return this.getClientLlmConfig(clientId);
  },
  async setClientModelConfig(data: { client_id: string; caller_function: string; model_name: string }) {
    return this.setClientLlmConfig(data);
  },
  async setClientCostConfig(data: { client_id: string; cost_multiplier: number; monthly_budget_usd?: number | null }) {
    const res = await fetch(`${BASE_URL}/admin/client-cost-config`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', ...authHeaders() }, body: JSON.stringify(data),
    });
    return safeJson(res, 'Failed to update cost config');
  },

  // 1. Global Default LLM (Single fallback row: global_default_llm)
  async getGlobalDefaultLlm() {
    const res = await fetch(`${BASE_URL}/admin/global-default-llm`, { headers: authHeaders() });
    return safeJson(res, 'Failed to fetch Global Default LLM');
  },
  async setGlobalDefaultLlm(data: { provider: string; api_key: string; base_url?: string | null; model_name: string; api_version?: string | null }) {
    const res = await fetch(`${BASE_URL}/admin/global-default-llm`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', ...authHeaders() }, body: JSON.stringify(data),
    });
    return safeJson(res, 'Failed to update Global Default LLM');
  },
  async refreshGlobalDefaultLlm() {
    const res = await fetch(`${BASE_URL}/admin/global-default-llm/refresh`, {
      method: 'POST', headers: authHeaders(),
    });
    return safeJson(res, 'Failed to refresh Global Default LLM live models');
  },
  async toggleGlobalLlmOverride(is_override_active: boolean) {
    const res = await fetch(`${BASE_URL}/admin/global-default-llm/toggle-override`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', ...authHeaders() }, body: JSON.stringify({ is_override_active }),
    });
    return safeJson(res, 'Failed to toggle Global LLM Emergency Override');
  },

  // 2. Globally Available LLM Configs (Multiple pool templates: globally_available_llm_configs)
  async getGloballyAvailableLlmConfigs() {
    const res = await fetch(`${BASE_URL}/admin/globally-available-llm-configs`, { headers: authHeaders() });
    return safeJson(res, 'Failed to fetch globally available LLM configurations');
  },
  async saveGloballyAvailableLlmConfig(data: { id?: number; name: string; provider: string; api_key: string; base_url?: string | null; model_name: string; api_version?: string | null }) {
    const res = await fetch(`${BASE_URL}/admin/globally-available-llm-configs`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', ...authHeaders() }, body: JSON.stringify(data),
    });
    return safeJson(res, 'Failed to save globally available LLM configuration');
  },
  async deleteGloballyAvailableLlmConfig(configId: number) {
    const res = await fetch(`${BASE_URL}/admin/globally-available-llm-configs/${configId}`, {
      method: 'DELETE', headers: authHeaders(),
    });
    return safeJson(res, 'Failed to delete globally available LLM configuration');
  },
  async refreshGloballyAvailableLlmConfig(configId: number) {
    const res = await fetch(`${BASE_URL}/admin/globally-available-llm-configs/${configId}/refresh`, {
      method: 'POST', headers: authHeaders(),
    });
    return safeJson(res, 'Failed to refresh provider models');
  },

  // Backward compatibility alias for legacy methods
  async getLlmConfigs() {
    return this.getGloballyAvailableLlmConfigs();
  },
  async saveLlmConfig(data: any) {
    return this.saveGloballyAvailableLlmConfig(data);
  },
  async deleteLlmConfig(configId: number) {
    return this.deleteGloballyAvailableLlmConfig(configId);
  },
  async refreshLlmConfig(configId: number) {
    return this.refreshGloballyAvailableLlmConfig(configId);
  },
  async fetchProviderModels(data: { provider: string; api_key: string; base_url?: string; api_version?: string }) {
    const res = await fetch(`${BASE_URL}/admin/llm/fetch-models`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify(data),
    });
    return safeJson(res, 'Failed to fetch provider models');
  },
  async getAllBudgetStatuses() {
    const res = await fetch(`${BASE_URL}/admin/budget-status`, { headers: authHeaders() });
    return safeJson(res, 'Failed to fetch budget statuses');
  },
  async getAdminKnowledgeStats() {
    const res = await fetch(`${BASE_URL}/admin/knowledge-stats`, { headers: authHeaders() });
    return safeJson(res, 'Failed to fetch knowledge stats');
  },

  // ===== Delete Client =====
  async deleteClient(clientId: string) {
    const res = await fetch(`${BASE_URL}/admin/delete-client/${clientId}`, {
      method: 'DELETE',
      headers: authHeaders(),
    });
    return safeJson(res, 'Failed to delete client');
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
    return safeJson(res, 'Failed to update client profile');
  },
  async updateSelfProfile(data: { 
    client_id: string; 
    department_name?: string; 
    company_name?: string;
    score_threshold?: number;
    agent_type?: string;
    response_tone?: string;
  }) {
    const res = await fetch(`${BASE_URL}/client/profile`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify(data),
    });
    return safeJson(res, 'Failed to update profile');
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